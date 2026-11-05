/**
 * AudioWorklet processor: physically-informed V8 synthesis.
 *
 * The processor runs its own crank-angle clock at audio rate (phase-locked to the
 * physics model) and generates sound from discrete engine EVENTS, exactly when they
 * happen in the 720° cycle:
 *   - exhaust blowdown pulse at each cylinder's exhaust-valve-opening angle, routed to
 *     its own bank (left/right) -> header waveguide -> turbine -> muffler waveguide
 *   - induction pulse at intake valve opening, valve-seating clicks at IVC/EVC
 *   - limiter / 2-step cut events (no combustion) decided per cylinder by the ECU model
 *   - pops & bangs (afterfire) in the downpipe for the bank that fired
 *   - compression "chug" and geared starter whine while cranking
 * Continuous sources: twin turbo compressor whistle (slightly detuned pair -> beating),
 * spool whoosh, intake roar, closed-throttle hiss, blow-off valve vent, wastegate hiss,
 * timing chain whine, fuel pump, nitrous solenoid hiss.
 *
 * This function is stringified and loaded through a Blob URL, so it must be fully
 * self-contained (no imports, no closures over module scope).
 */
export function engineWorkletMain() {
  const TAU = Math.PI * 2;

  class OnePole {
    constructor() { this.y = 0; this.a = 0; }
    setCutoff(fc, sr) { this.a = 1 - Math.exp(-TAU * Math.min(fc, sr * 0.45) / sr); }
    process(x) { this.y += this.a * (x - this.y); return this.y; }
  }

  class SVF {
    // Chamberlin/TPT state-variable filter (bandpass / lowpass)
    constructor() { this.ic1 = 0; this.ic2 = 0; this.g = 0; this.k = 1; this.a1 = 0; this.a2 = 0; this.a3 = 0; }
    set(fc, q, sr) {
      this.g = Math.tan(Math.PI * Math.min(fc, sr * 0.45) / sr);
      this.k = 1 / q;
      this.a1 = 1 / (1 + this.g * (this.g + this.k));
      this.a2 = this.g * this.a1;
      this.a3 = this.g * this.a2;
    }
    process(x) {
      const v3 = x - this.ic2;
      const v1 = this.a1 * this.ic1 + this.a2 * v3;
      const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
      this.ic1 = 2 * v1 - this.ic1;
      this.ic2 = 2 * v2 - this.ic2;
      this.lp = v2;
      return v1; // bandpass
    }
  }

  class Waveguide {
    // Pipe resonance: delay line with damped, inverting reflection (open end)
    constructor(maxLen) { this.buf = new Float32Array(maxLen); this.idx = 0; this.len = 1; this.g = 0.5; this.lp = 0; this.damp = 0.5; }
    process(x) {
      let r = this.idx - this.len; if (r < 0) r += this.buf.length;
      const delayed = this.buf[r];
      this.lp += this.damp * (delayed - this.lp);
      const y = x - this.g * this.lp;
      this.buf[this.idx] = y;
      this.idx++; if (this.idx >= this.buf.length) this.idx = 0;
      return y;
    }
  }

  const MAX_VOICES = 48;

  class EngineProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      const sr = sampleRate;
      this.sr = sr;
      this.seed = 22222;

      // engine timing config (overwritten by 'config')
      this.firing = [495, 45, 315, 225, 675, 585, 135, 405];
      this.bank = [0, 0, 0, 0, 1, 1, 1, 1];
      this.evo = 122; this.ivo = 348; this.ivc = 592; this.evc = 372;
      this.cylGain = new Float32Array(8);
      this.cylTone = new Float32Array(8);
      for (let i = 0; i < 8; i++) { this.cylGain[i] = 0.92 + 0.16 * this.rand01(); this.cylTone[i] = 0.85 + 0.3 * this.rand01(); }

      // targets from physics
      this.t = {
        rpm: 0, throttle: 0, map: 1, boost: 0, turbo: 0, wg: 0, running: false, starter: false,
        pump: false, timeScale: 1, nitrous: false, roughness: 0.035, overrun: false, mic: 'tailpipe', volume: 1
      };
      // smoothed
      this.rpm = 0; this.map = 1; this.thr = 0; this.boost = 0; this.turbo = 0; this.wg = 0; this.ts = 1;
      this.runLevel = 0; this.starterLevel = 0; this.pumpLevel = 0; this.nitrousLevel = 0;
      this.motorSpeed = 0;
      this.cut = new Uint8Array(8);
      this.popPending = new Float32Array(8);

      this.angle = 0;            // cycle degrees 0..720
      this.phaseErr = 0;

      // voices (struct of arrays)
      this.vOn = new Uint8Array(MAX_VOICES);
      this.vKind = new Uint8Array(MAX_VOICES);   // 0 exhaust pulse, 1 pop, 2 intake pulse, 3 click, 4 chug, 5 bov, 6 solenoid
      this.vBank = new Uint8Array(MAX_VOICES);
      this.vT = new Float32Array(MAX_VOICES);
      this.vTau = new Float32Array(MAX_VOICES);
      this.vAmp = new Float32Array(MAX_VOICES);
      this.vAux = new Float32Array(MAX_VOICES);
      this.vDelay = new Float32Array(MAX_VOICES);

      // exhaust system per bank
      const ms = (x) => Math.round(x * sr / 1000);
      this.header = [new Waveguide(ms(20)), new Waveguide(ms(20))];
      this.header[0].len = ms(2.9); this.header[1].len = ms(3.25);
      this.header.forEach((w) => { w.g = 0.58; w.damp = 0.45; });
      this.muffler = [new Waveguide(ms(30)), new Waveguide(ms(30))];
      this.muffler[0].len = ms(7.4); this.muffler[1].len = ms(8.1);
      this.muffler.forEach((w) => { w.g = 0.42; w.damp = 0.3; });
      this.turbineLp = [new OnePole(), new OnePole()];
      this.mufflerLp = [new OnePole(), new OnePole()];
      this.mufflerLp2 = [new OnePole(), new OnePole()];
      this.mufflerLpB = [new OnePole(), new OnePole()];
      this.body = [new SVF(), new SVF()];
      this.dcL = 0; this.dcR = 0; this.dcxL = 0; this.dcxR = 0;

      // continuous sources
      this.intakeBp = new SVF();
      this.hissBp = new SVF();
      this.spoolBp = [new SVF(), new SVF()];
      this.bovBp = new SVF();
      this.nosBp = new SVF();
      this.clickHp = 0;
      this.chainPh = 0; this.altPh = 0; this.turboPh = [0, 0]; this.turboPh2 = [0, 0];
      this.starterPh = 0; this.motorPh = 0; this.pumpPh = 0;
      this.micLpL = new OnePole(); this.micLpR = new OnePole();
      this.bovEnv = 0; this.bovT = 10; this.bovAmp = 0;
      this.wgNoise = new OnePole();

      this.frame = 0;
      this.port.onmessage = (e) => this.onMessage(e.data);
      this.setMic('tailpipe');
    }

    rand01() {
      // xorshift32
      let x = this.seed | 0;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.seed = x;
      return ((x >>> 0) / 4294967296);
    }
    noise() { return this.rand01() * 2 - 1; }

    setMic(mic) {
      this.t.mic = mic;
      // [exhaust, intake, mech, turbo, bov, starter, lowpass Hz, width]
      const presets = {
        tailpipe: [1.0, 0.22, 0.12, 0.32, 0.55, 0.35, 15000, 0.85],
        bay: [0.42, 1.0, 0.95, 1.0, 1.0, 1.0, 14000, 0.55],
        control: [0.75, 0.3, 0.18, 0.35, 0.4, 0.45, 1500, 0.3]
      };
      this.mix = presets[mic] || presets.tailpipe;
      this.micLpL.setCutoff(this.mix[6], this.sr);
      this.micLpR.setCutoff(this.mix[6], this.sr);
    }

    onMessage(d) {
      if (d.type === 'config') {
        this.firing = d.firing; this.bank = d.bank;
        this.evo = d.evo; this.ivo = d.ivo; this.ivc = d.ivc; this.evc = d.evc;
      } else if (d.type === 'state') {
        Object.assign(this.t, d.s);
        if (d.s.cut) for (let i = 0; i < 8; i++) this.cut[i] = d.s.cut[i] ? 1 : 0;
        if (typeof d.s.angle === 'number') {
          let err = d.s.angle - this.angle;
          if (err > 360) err -= 720; else if (err < -360) err += 720;
          this.phaseErr = err;
        }
      } else if (d.type === 'pop') {
        this.popPending[d.cyl] = Math.max(this.popPending[d.cyl], d.amp);
      } else if (d.type === 'bov') {
        this.bovT = 0; this.bovAmp = d.amp;
      } else if (d.type === 'solenoid') {
        this.spawn(6, 0, 0.004, d.amp || 0.5, 0, 0);
      } else if (d.type === 'mic') {
        this.setMic(d.mic);
      }
    }

    spawn(kind, bank, tau, amp, aux, delay) {
      for (let v = 0; v < MAX_VOICES; v++) {
        if (!this.vOn[v]) {
          this.vOn[v] = 1; this.vKind[v] = kind; this.vBank[v] = bank;
          this.vT[v] = -(delay || 0); this.vTau[v] = tau; this.vAmp[v] = amp; this.vAux[v] = aux || 0;
          return;
        }
      }
    }

    crossed(prev, cur, target) {
      return prev <= cur ? (target > prev && target <= cur) : (target > prev || target <= cur);
    }

    onCylinderEvents(prev, cur, rpmEff) {
      const run = this.t.running;
      const load = Math.min(1.25, Math.max(0, this.map / 3.5));
      const rpmN = this.rpm / 8500;
      // blowdown lasts ~50 crank degrees
      const tauPulse = Math.min(0.006, Math.max(0.00022, (50 / (6 * Math.max(rpmEff, 1))) / 3.2));
      for (let i = 0; i < 8; i++) {
        const f = this.firing[i];
        const b = this.bank[i];
        // exhaust valve opening -> blowdown pulse
        if (this.crossed(prev, cur, (f + this.evo) % 720)) {
          let amp;
          let noiseAmt;
          if (run && !this.cut[i]) {
            const rough = this.t.roughness * (1 - Math.min(1, load * 1.2));
            amp = (0.18 + 0.82 * Math.pow(load, 0.8)) * this.cylGain[i] * (1 + rough * 2.2 * this.noise());
            if (this.t.overrun) amp *= 0.32;
            noiseAmt = 0.18 + 0.4 * load;
          } else {
            // no combustion: only the compressed charge escaping
            amp = 0.05 + 0.05 * Math.min(1, this.map);
            noiseAmt = 0.15;
          }
          this.spawn(0, b, tauPulse * this.cylTone[i], amp, noiseAmt, 0);
          const pop = this.popPending[i];
          if (pop > 0) {
            this.popPending[i] = 0;
            // afterfire happens further down the pipe, a few ms later
            this.spawn(1, b, 0.0006 + 0.0006 * this.rand01(), pop * 0.55, 0.018 + 0.03 * this.rand01(), 0.003 + 0.006 * this.rand01());
          }
        }
        // intake valve opening -> induction pulse (intake side)
        if (this.crossed(prev, cur, (f + this.ivo) % 720)) {
          this.spawn(2, b, tauPulse * 1.6, 0.25 * Math.min(1.6, this.map) + 0.04, 0, 0);
        }
        // valves seating -> mechanical tick
        if (this.crossed(prev, cur, (f + this.ivc) % 720) || this.crossed(prev, cur, (f + this.evc) % 720)) {
          this.spawn(3, b, 0.0005, (0.008 + 0.04 * rpmN) * (0.8 + 0.4 * this.rand01()), 0, 0);
        }
        // compression TDC while cranking / coasting without fire -> chug
        if (!run && this.rpm > 30 && this.crossed(prev, cur, f)) {
          this.spawn(4, b, 0.05, 0.22 * Math.min(1, this.rpm / 250), 0, 0);
        }
      }
    }

    compressionMod(angle) {
      // crank speed fluctuation from compression strokes while cranking (~±25 %)
      let m = 0;
      for (let i = 0; i < 8; i++) {
        let rel = angle - this.firing[i];
        if (rel > 360) rel -= 720; else if (rel < -360) rel += 720;
        if (rel > -100 && rel < 40) m += Math.exp(-((rel + 25) * (rel + 25)) / 900);
      }
      return 1 - 0.32 * Math.min(1, m);
    }

    process(inputs, outputs) {
      const out = outputs[0];
      const L = out[0];
      const R = out[1] || out[0];
      const n = L.length;
      const sr = this.sr;
      const t = this.t;
      const mix = this.mix;

      // per-block parameter smoothing
      const k = (tauS) => 1 - Math.exp(-n / (sr * tauS));
      this.rpm += (t.rpm - this.rpm) * k(0.012);
      this.map += (t.map - this.map) * k(0.02);
      this.thr += (t.throttle - this.thr) * k(0.02);
      this.boost += (t.boost - this.boost) * k(0.05);
      this.turbo += (t.turbo - this.turbo) * k(0.06);
      this.wg += (t.wg - this.wg) * k(0.08);
      this.ts += (t.timeScale - this.ts) * k(0.1);
      this.runLevel += ((t.running ? 1 : 0) - this.runLevel) * k(0.03);
      this.starterLevel += ((t.starter ? 1 : 0) - this.starterLevel) * k(t.starter ? 0.01 : 0.12);
      this.pumpLevel += ((t.pump ? 1 : 0) - this.pumpLevel) * k(0.15);
      this.nitrousLevel += ((t.nitrous ? 1 : 0) - this.nitrousLevel) * k(0.02);

      const ts = Math.max(0.01, this.ts);
      const rpmN = Math.min(1.1, this.rpm / 8500);
      const load = Math.min(1.25, Math.max(0, this.map / 3.5));
      const airflow = this.map * this.rpm / 8500;
      const cont = Math.min(1, Math.max(0, (ts - 0.08) / 0.92)); // continuous sources fade in slow-mo

      // filter coefficient updates per block
      for (let b = 0; b < 2; b++) {
        this.turbineLp[b].setCutoff(6500 - 3800 * Math.min(1, this.turbo), sr);
        const mfc = 420 + 2400 * rpmN * (0.45 + 0.55 * Math.min(1, load)) * cont;
        this.mufflerLp[b].setCutoff(mfc, sr);
        this.mufflerLpB[b].setCutoff(mfc * 1.8, sr);
        this.mufflerLp2[b].setCutoff(2200 + 5000 * rpmN, sr);
        this.body[b].set(78 + 18 * b + 30 * rpmN, 1.6, sr);
        this.spoolBp[b].set(1100 + 2600 * this.turbo, 0.9, sr);
      }
      this.intakeBp.set(220 + 700 * this.thr + 900 * rpmN, 1.4, sr);
      this.hissBp.set(2600 + 1200 * rpmN, 2.5, sr);
      this.bovBp.set(1500 + 1700 * Math.exp(-this.bovT / 0.09), 1.1, sr);
      this.nosBp.set(5200, 0.8, sr);
      this.wgNoise.setCutoff(3000, sr);

      // starter motor speed (geared 150:9 to the ring gear, freewheels down after release)
      const motorTarget = t.starter ? this.rpm * 16.7 : 0;
      this.motorSpeed += (motorTarget - this.motorSpeed) * k(t.starter ? 0.05 : 0.35);

      // phase lock towards physics crank angle (spread over the block)
      const lock = Math.max(-0.25, Math.min(0.25, this.phaseErr / 720));
      this.phaseErr *= 0.85;

      const gEx = mix[0], gIn = mix[1], gMe = mix[2], gTu = mix[3], gBov = mix[4], gSt = mix[5], width = mix[7];
      const turboGain = 0.03 * this.turbo * this.turbo * (0.25 + 0.75 * Math.min(1, Math.max(0, this.boost) / 2.5)) * cont;
      const spoolGain = 0.028 * this.turbo * Math.min(1.5, airflow) * cont;
      const intakeGain = (0.015 + 0.2 * Math.min(1.5, airflow)) * cont * (this.rpm > 20 ? 1 : 0);
      const hissGain = this.thr < 0.06 && this.rpm > 1800 ? 0.035 * rpmN * (1 - Math.min(1, this.map)) * cont : 0;
      const chainGain = 0.006 * Math.pow(rpmN, 1.4) * cont;
      const wgGain = 0.035 * this.wg * this.turbo * Math.min(1, load) * cont;
      const turboF = [1100 + 5600 * this.turbo, (1100 + 5600 * this.turbo) * 1.011];
      const chainF = this.rpm / 60 * 25;
      const altF = this.rpm / 60 * 1.73 * 36;
      const meshF = this.motorSpeed / 60 * 9;          // pinion teeth meshing
      const motorF = this.motorSpeed / 60 * 2;         // commutator hum

      for (let s = 0; s < n; s++) {
        // ---- crank clock
        let rpmEff = this.rpm * ts;
        if (!t.running && this.starterLevel > 0.05) rpmEff *= this.compressionMod(this.angle);
        const dA = rpmEff * 6 / sr * (1 + lock);
        const prev = this.angle;
        let cur = prev + dA;
        if (cur >= 720) cur -= 720;
        this.angle = cur;
        if (dA > 0) this.onCylinderEvents(prev, cur, rpmEff);

        // ---- voices
        let exc0 = 0, exc1 = 0, post0 = 0, post1 = 0, intake = 0, mech = 0, bovSig = 0;
        const dt = 1 / sr;
        for (let v = 0; v < MAX_VOICES; v++) {
          if (!this.vOn[v]) continue;
          const tv = this.vT[v];
          this.vT[v] = tv + dt * (this.vKind[v] <= 2 ? 1 : 1);
          if (tv < 0) continue;
          const tau = this.vTau[v];
          const x = tv / tau;
          let y = 0;
          switch (this.vKind[v]) {
            case 0: { // exhaust blowdown: fast-rise pressure pulse + combustion roughness noise
              y = this.vAmp[v] * (x * Math.exp(1 - x) + this.vAux[v] * this.noise() * Math.exp(-x * 0.7));
              if (x > 9) this.vOn[v] = 0;
              if (this.vBank[v] === 0) exc0 += y; else exc1 += y;
              break;
            }
            case 1: { // afterfire pop: sharp crack + ragged noise tail
              const tail = this.vAux[v];
              y = this.vAmp[v] * (2.2 * x * Math.exp(1 - x) + 0.9 * this.noise() * Math.exp(-tv / tail) * (0.6 + 0.4 * Math.sin(tv * 900)));
              if (tv > tail * 6) this.vOn[v] = 0;
              if (this.vBank[v] === 0) post0 += y; else post1 += y;
              break;
            }
            case 2: { // induction pulse (negative pressure)
              y = -this.vAmp[v] * x * Math.exp(1 - x);
              if (x > 8) this.vOn[v] = 0;
              intake += y;
              break;
            }
            case 3: { // valve seat tick (high-passed noise)
              const nz = this.noise();
              y = this.vAmp[v] * (nz - this.clickHp) * Math.exp(-x);
              this.clickHp = nz;
              if (x > 6) this.vOn[v] = 0;
              mech += y;
              break;
            }
            case 4: { // compression chug while cranking
              y = this.vAmp[v] * Math.sin(TAU * 55 * tv) * Math.exp(-x) * (1 - Math.exp(-tv / 0.004));
              if (x > 5) this.vOn[v] = 0;
              mech += y * 1.4;
              break;
            }
            case 6: { // solenoid clunk
              y = this.vAmp[v] * (Math.sin(TAU * 90 * tv) * 0.7 + this.noise() * 0.5) * Math.exp(-x);
              if (x > 8) this.vOn[v] = 0;
              mech += y;
              break;
            }
          }
        }

        // ---- exhaust path per bank: header -> turbine -> downpipe/muffler -> tailpipe
        const turbAtt = 1 - 0.35 * Math.min(1, this.turbo);
        let e0 = this.header[0].process(exc0);
        let e1 = this.header[1].process(exc1);
        e0 = this.turbineLp[0].process(e0) * turbAtt;
        e1 = this.turbineLp[1].process(e1) * turbAtt;
        const wgn = this.wgNoise.process(this.noise()) * wgGain;
        e0 = this.muffler[0].process(e0 + post0 * 0.6 + wgn);
        e1 = this.muffler[1].process(e1 + post1 * 0.6 + wgn);
        e0 = this.mufflerLpB[0].process(this.mufflerLp[0].process(e0));
        e1 = this.mufflerLpB[1].process(this.mufflerLp[1].process(e1));
        e0 += this.body[0].process(e0) * 0.9 + this.mufflerLp2[0].process(post0) * 0.55;
        e1 += this.body[1].process(e1) * 0.9 + this.mufflerLp2[1].process(post1) * 0.55;

        // ---- intake & turbo
        const nz = this.noise();
        let intk = this.intakeBp.process(nz) * intakeGain + intake * 0.6;
        intk += this.hissBp.process(this.noise()) * hissGain;
        let tL = 0, tR = 0;
        if (turboGain > 1e-5 || spoolGain > 1e-5) {
          for (let b = 0; b < 2; b++) {
            this.turboPh[b] += turboF[b] / sr; if (this.turboPh[b] > 1) this.turboPh[b] -= 1;
            this.turboPh2[b] += turboF[b] * 2 / sr; if (this.turboPh2[b] > 1) this.turboPh2[b] -= 1;
            const w = Math.sin(TAU * this.turboPh[b]) + 0.28 * Math.sin(TAU * this.turboPh2[b]);
            const sp = this.spoolBp[b].process(this.noise());
            const sig = w * turboGain * (1 + 0.15 * this.noise()) + sp * spoolGain;
            if (b === 0) tL = sig; else tR = sig;
          }
        }

        // ---- blow-off valve vent: pssshh with compressor flutter tail
        if (this.bovT < 1.5) {
          const bt = this.bovT;
          const env = (1 - Math.exp(-bt / 0.004)) * Math.exp(-bt / (0.13 + 0.22 * this.bovAmp));
          const flutter = bt > 0.06 ? 1 - 0.4 * (0.5 + 0.5 * Math.sin(TAU * 21 * bt)) : 1;
          bovSig = this.bovBp.process(this.noise()) * env * flutter * 0.55 * this.bovAmp;
          this.bovT += 1 / sr;
        }

        // ---- mechanical: timing chain + alternator whine, fuel pump, starter
        this.chainPh += chainF / sr; if (this.chainPh > 1) this.chainPh -= 1;
        this.altPh += altF / sr; if (this.altPh > 1) this.altPh -= 1;
        mech += Math.sin(TAU * this.chainPh) * chainGain + Math.sin(TAU * this.altPh) * chainGain * 0.25;
        let st = 0;
        if (this.starterLevel > 0.002 || this.motorSpeed > 50) {
          this.starterPh += meshF / sr; if (this.starterPh > 1) this.starterPh -= 1;
          this.motorPh += motorF / sr; if (this.motorPh > 1) this.motorPh -= 1;
          const tri = 1 - 4 * Math.abs(this.starterPh - 0.5);
          const saw = this.motorPh * 2 - 1;
          const mspd = Math.min(1, this.motorSpeed / 4000);
          st = (tri * 0.09 * this.starterLevel + saw * 0.05 * mspd + this.noise() * 0.02 * mspd) ;
        }
        if (this.pumpLevel > 0.002) {
          this.pumpPh += 168 / sr; if (this.pumpPh > 1) this.pumpPh -= 1;
          const p = Math.sin(TAU * this.pumpPh) + 0.4 * Math.sin(TAU * this.pumpPh * 2);
          mech += p * 0.012 * this.pumpLevel * (t.running ? 0.35 : 1);
        }
        if (this.nitrousLevel > 0.002) {
          intk += this.nosBp.process(this.noise()) * 0.05 * this.nitrousLevel;
        }

        // ---- mix to stereo
        const exL = e0 * (0.5 + width * 0.5) + e1 * (0.5 - width * 0.5);
        const exR = e1 * (0.5 + width * 0.5) + e0 * (0.5 - width * 0.5);
        const centre = intk * gIn + mech * gMe + st * gSt + bovSig * gBov;
        let l = exL * gEx * 0.5 + centre + (tL * 0.8 + tR * 0.2) * gTu;
        let r = exR * gEx * 0.5 + centre + (tR * 0.8 + tL * 0.2) * gTu;

        // DC block (exhaust pulses are unipolar)
        const dl = l - this.dcxL + 0.9985 * this.dcL; this.dcxL = l; this.dcL = dl;
        const dr = r - this.dcxR + 0.9985 * this.dcR; this.dcxR = r; this.dcR = dr;
        l = this.micLpL.process(dl);
        r = this.micLpR.process(dr);
        const vol = t.volume;
        L[s] = l * vol;
        if (R !== L) R[s] = r * vol;
      }

      // report crank phase back occasionally (diagnostics)
      this.frame++;
      return true;
    }
  }

  registerProcessor('apex-v8-engine', EngineProcessor);
}

export const ENGINE_WORKLET_SOURCE = `(${engineWorkletMain.toString()})();`;
