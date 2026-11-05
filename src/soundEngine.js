import { ENGINE_WORKLET_SOURCE } from './audio/engineWorklet.js';
import { FIRING_DEG, BANK_OF } from './engineTiming.js';

/**
 * SoundEngine: Web Audio front-end for the event-driven V8 synthesiser.
 *
 * Signal chain:
 *   EngineProcessor (AudioWorklet, stereo, per-cylinder events)
 *     -> dry ----------------------------\
 *     -> dyno-cell convolution reverb ----+-> bus -> peak limiter -> master -> out
 *   UI clicks ---------------------------/
 *
 * The physics model pushes its state every animation frame; the worklet keeps its
 * own sample-accurate crank clock phase-locked to it.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ready = false;
    this.failed = false;
    this.node = null;
    this.masterGain = null;
    this.volume = 0.8;
    this.mic = 'tailpipe';
    this.cam = { evo: 122, ivo: 348, ivc: 592, evc: 372 };
    this._initPromise = null;
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  init() {
    if (this._initPromise) { this.resume(); return this._initPromise; }
    this._initPromise = this._init();
    return this._initPromise;
  }

  async _init() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      const ctx = this.ctx;

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.enabled ? this.volume : 0;

      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -10;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 8;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.12;

      this.bus = ctx.createGain();
      this.bus.gain.value = 1;
      this.bus.connect(this.limiter);
      this.limiter.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      // Dyno cell acoustics: concrete room, ~0.9 s RT60 with early reflections
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.createRoomImpulse(0.9);
      this.wetGain = ctx.createGain();
      this.dryGain = ctx.createGain();
      this.reverb.connect(this.wetGain);
      this.wetGain.connect(this.bus);
      this.dryGain.connect(this.bus);

      if (!ctx.audioWorklet) throw new Error('AudioWorklet not supported');
      const url = URL.createObjectURL(new Blob([ENGINE_WORKLET_SOURCE], { type: 'application/javascript' }));
      try {
        await ctx.audioWorklet.addModule(url);
      } catch (blobErr) {
        // sandboxed hosts may refuse blob: modules; fall back to the published file
        await ctx.audioWorklet.addModule(new URL('engine-worklet.js', document.baseURI).href);
      } finally {
        URL.revokeObjectURL(url);
      }

      this.node = new AudioWorkletNode(ctx, 'apex-v8-engine', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 1.15;
      this.node.connect(this.engineGain);
      this.engineGain.connect(this.dryGain);
      this.engineGain.connect(this.reverb);

      this.sendConfig();
      this.setMic(this.mic);
      this.ready = true;
      if (ctx.state === 'suspended') await ctx.resume();
    } catch (e) {
      this.failed = true;
      console.warn('Engine audio unavailable:', e);
    }
  }

  createRoomImpulse(rt60) {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * rt60 * 1.3);
    const buf = ctx.createBuffer(2, len, sr);
    const early = [0.0071, 0.0113, 0.0167, 0.0219, 0.0288, 0.0347];
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        // late diffuse tail, darkening over time (air + absorption)
        const decay = Math.pow(10, (-3 * t) / rt60);
        const a = 0.25 + 0.7 * Math.exp(-t / 0.25);
        lp += a * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * decay * 0.5 * Math.min(1, t / 0.012);
      }
      early.forEach((et, k) => {
        const idx = Math.floor((et + (ch ? 0.0013 * k : 0)) * sr);
        if (idx < len) d[idx] += (ch ? -1 : 1) * 0.6 * Math.pow(0.78, k);
      });
    }
    return buf;
  }

  sendConfig() {
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'config', firing: FIRING_DEG, bank: BANK_OF,
      evo: this.cam.evo, ivo: this.cam.ivo, ivc: this.cam.ivc, evc: this.cam.evc
    });
  }

  setCam(profile) {
    this.cam = { evo: profile.evo, ivo: profile.ivo, ivc: profile.ivc, evc: profile.evc };
    this.sendConfig();
  }

  setMic(mic) {
    this.mic = mic;
    if (!this.node) return;
    this.node.port.postMessage({ type: 'mic', mic });
    const t = this.ctx.currentTime;
    // control room hears the cell through glass: more room, less direct
    const wet = { tailpipe: 0.16, bay: 0.1, control: 0.42 }[mic] ?? 0.16;
    const dry = { tailpipe: 1.0, bay: 1.0, control: 0.7 }[mic] ?? 1.0;
    this.wetGain.gain.setTargetAtTime(wet, t, 0.05);
    this.dryGain.gain.setTargetAtTime(dry, t, 0.05);
  }

  setVolume(v) {
    this.volume = v;
    if (this.masterGain && this.enabled) this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.ctx) this.init();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.02);
    }
    return this.enabled;
  }

  /** Push the physics state (called every frame). */
  update(phys, timeScale = 1) {
    if (!this.ready || !this.node) return;
    this.node.port.postMessage({
      type: 'state',
      s: {
        rpm: phys.rpm,
        throttle: phys.throttlePlate,
        map: phys.map,
        boost: phys.map - 1,
        turbo: phys.turboSpeed,
        wg: phys.wastegate,
        running: phys.combustion,
        starter: phys.starterEngaged,
        pump: phys.fuelPump,
        overrun: !!phys.overrun,
        nitrous: phys.nitrousActive,
        cut: phys.cutFlags,
        angle: phys.cycleDeg,
        roughness: phys.cam.roughness,
        timeScale,
        volume: 1
      }
    });
  }

  pop(cyl, amp) {
    if (this.node) this.node.port.postMessage({ type: 'pop', cyl, amp });
  }

  bov(amp) {
    if (this.node) this.node.port.postMessage({ type: 'bov', amp });
  }

  solenoid(amp = 0.5) {
    if (this.node) this.node.port.postMessage({ type: 'solenoid', amp });
  }

  /** Kept for the (unused) CoreXY printer simulator module. */
  updateStepper() {}

  playCompleteChime() {
    if (!this.ctx || !this.enabled || !this.bus) return;
    const t0 = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0 + i * 0.12);
      gain.gain.setValueAtTime(0.12, t0 + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.12 + 0.6);
      osc.connect(gain);
      gain.connect(this.bus);
      osc.start(t0 + i * 0.12);
      osc.stop(t0 + i * 0.12 + 0.65);
    });
  }

  playClick() {
    if (!this.ctx || !this.enabled || !this.bus) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(this.bus);
      osc.start(t);
      osc.stop(t + 0.05);
    } catch (e) { /* ignore */ }
  }
}
