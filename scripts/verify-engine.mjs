/**
 * Headless verification of engine realism: physics calibration + acoustic signature.
 * Runs the real EnginePhysics and the real AudioWorklet processor offline in Node.
 *   npm run verify:engine
 */
import { EnginePhysics } from '../src/enginePhysics.js';
import { ENGINE_WORKLET_SOURCE } from '../src/audio/engineWorklet.js';
import { FIRING_DEG, BANK_OF, CAM_PROFILES, FIRING_ORDER_LABEL } from '../src/engineTiming.js';

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};
const sim = (e, sec, cb) => { for (let t = 0; t < sec; t += 1 / 60) { e.update(1 / 60); cb && cb(); } };

// ------------------------------------------------------------------ timing
const spacing = [...FIRING_DEG].sort((a, b) => a - b).map((d, i, a) => (a[(i + 1) % 8] - d + 720) % 720);
check('even 90° firing intervals (cross-plane)', spacing.every((s) => s === 90), spacing.join(','));
check('firing order derived from crank geometry', FIRING_ORDER_LABEL.join('-') === '1-4-2-3-6-7-5-8', FIRING_ORDER_LABEL.join('-'));

// ------------------------------------------------------------------ physics
{
  const e = new EnginePhysics();
  e.coolant = 88; e.oilTemp = 90;
  let caught = null;
  e.on('state', (s) => { if (s === 'running') caught = e.time; });
  e.startEngine();
  sim(e, 10);
  check('starts: prime + crank + catch within 1.4–3 s', caught > 1.4 && caught < 3, `${caught?.toFixed(2)} s`);
  let mn = 1e9, mx = 0;
  sim(e, 6, () => { mn = Math.min(mn, e.rpm); mx = Math.max(mx, e.rpm); });
  check('warm idle 780–880 RPM with natural jitter', mn > 780 && mx < 880 && mx - mn > 5, `${mn.toFixed(0)}–${mx.toFixed(0)}`);

  e.keyThrottle = 1; const t0 = e.time; let t7 = null;
  sim(e, 2, () => { if (!t7 && e.rpm > 7000) t7 = e.time - t0; });
  check('free-rev idle→7000 in 0.6–1.3 s', t7 > 0.6 && t7 < 1.3, `${t7?.toFixed(2)} s`);
  let peak = 0; sim(e, 1, () => { peak = Math.max(peak, e.rpm); });
  check('hard-cut limiter holds below 8,700', peak < 8700 && peak > 8450, `peak ${peak.toFixed(0)}`);
  e.keyThrottle = 0; let pops = 0, bov = 0;
  e.on('pop', () => pops++); e.on('bov', () => bov++);
  sim(e, 4);
  check('overrun pops on lift-off', pops > 5, `${pops} pops`);
  check('returns to idle without stalling', e.state === 'running' && e.rpm < 1100, `${e.rpm.toFixed(0)} RPM`);

  e.holdRpm(3500); sim(e, 3); e.keyThrottle = 1;
  const s0 = e.time; let b1 = null;
  sim(e, 5, () => { if (!b1 && e.map - 1 > 1.0) b1 = e.time - s0; });
  check('turbo lag under load: 1 bar in 0.6–2.0 s at 3,500', b1 > 0.6 && b1 < 2.0, `${b1?.toFixed(2)} s`);
  check('wastegate holds 2.5 bar ±0.2', Math.abs(e.map - 1 - 2.5) < 0.2, `${(e.map - 1).toFixed(2)} bar`);
  e.keyThrottle = 0; sim(e, 1);
  check('blow-off valve vents on throttle lift under boost', bov > 0);
  e.cancelAbsorber(); sim(e, 3);

  let data = null; e.on('sweep', (s, d) => { if (s === 'done') data = d; });
  e.startSweep(); sim(e, 22);
  const pk = data && data.reduce((a, b) => (b.hp > a.hp ? b : a));
  const pt = data && data.reduce((a, b) => (b.tq > a.tq ? b : a));
  check('dyno pull: ~1,100 HP near 8,000 RPM', pk && pk.hp > 1000 && pk.hp < 1200 && pk.rpm > 7000, pk && `${pk.hp.toFixed(0)} HP @ ${pk.rpm.toFixed(0)}`);
  check('dyno pull: ~875 lb-ft mid-range', pt && pt.tq > 800 && pt.tq < 950 && pt.rpm > 4000 && pt.rpm < 6500, pt && `${pt.tq.toFixed(0)} lb-ft @ ${pt.rpm.toFixed(0)}`);
}

// ------------------------------------------------------------------ acoustics
globalThis.sampleRate = 48000;
let Proc;
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {}, onmessage: null }; } };
globalThis.registerProcessor = (n, c) => { Proc = c; };
(0, eval)(ENGINE_WORKLET_SOURCE);

function render(state, seconds, mic = 'tailpipe', onBlock) {
  const p = new Proc();
  const cam = CAM_PROFILES.street;
  p.onMessage({ type: 'config', firing: FIRING_DEG, bank: BANK_OF, evo: cam.evo, ivo: cam.ivo, ivc: cam.ivc, evc: cam.evc });
  p.onMessage({ type: 'mic', mic });
  const n = Math.floor(seconds * 48000);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i += 128) {
    const st = typeof state === 'function' ? state(i / 48000) : state;
    p.onMessage({ type: 'state', s: { cut: new Array(8).fill(false), timeScale: 1, volume: 1, roughness: 0.035, ...st } });
    if (onBlock) onBlock(p, i / 48000);
    const bl = new Float32Array(128), br = new Float32Array(128);
    p.process([], [[bl, br]]);
    L.set(bl.subarray(0, Math.min(128, n - i)), i); R.set(br.subarray(0, Math.min(128, n - i)), i);
  }
  return { L, R };
}

function spectrum(x, sr = 48000) {
  let N = 1; while (N < x.length) N <<= 1; N >>= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) {
      const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
      const ur = re[i + k], ui = im[i + k];
      const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
      const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
    }
  }
  const mag = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
  return { mag, df: sr / N };
}
const bandEnergy = (s, f, w = 1.5) => {
  let e = 0; for (let k = Math.floor((f - w) / s.df); k <= Math.ceil((f + w) / s.df); k++) e += (s.mag[k] || 0) ** 2; return e;
};
const finite = (a) => a.every(Number.isFinite);

// exact order analysis: amplitude at k * (rpm/120) for k = 1..40 (orders 0.5 .. 20)
function orders(x, rpm) {
  const c = rpm / 120, n = x.length, out = [];
  for (let k = 1; k <= 40; k++) {
    const w0 = (2 * Math.PI * k * c) / 48000;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); re += x[i] * w * Math.cos(w0 * i); im -= x[i] * w * Math.sin(w0 * i); }
    out.push({ order: k / 2, db: 0, m: Math.hypot(re, im) });
  }
  const mx = Math.max(...out.map((o) => o.m));
  out.forEach((o) => { o.db = 20 * Math.log10(o.m / mx); });
  return out;
}
const top = (o) => o.reduce((a, b) => (b.m > a.m ? b : a));

{
  const idle = { rpm: 900, map: 0.3, throttle: 0.02, running: true };
  const { L, R } = render(idle, 4.5);
  const x = L.map((v, i) => v + R[i]).subarray(48000);   // both banks (mono sum)
  check('audio: finite output, no NaN', finite(x));
  const o = orders(x.subarray(0, 96000), 900);
  check('idle: dominant line is firing order 4 (rpm/15 = 60 Hz)', top(o).order === 4, `top order ${top(o).order}`);
  const halfMax = Math.max(...o.filter((q) => q.order % 4 !== 0).map((q) => q.db));
  check('idle: cross-plane half-order burble present (−35…−3 dB)', halfMax > -35 && halfMax < -3, `${halfMax.toFixed(1)} dB`);
  const ob = orders(L.subarray(48000, 144000), 900);
  const bankHalf = Math.max(...ob.filter((q) => q.order % 2 !== 0).map((q) => q.db));
  check('idle: single bank pipe carries strong uneven-firing orders', bankHalf > -25, `${bankHalf.toFixed(1)} dB`);
  const s = spectrum(x);
  let tot = 0, low = 0; for (let k = 1; k < s.mag.length; k++) { const e2 = s.mag[k] ** 2; tot += e2; if (k * s.df < 1000) low += e2; }
  check('idle: >85% of energy below 1 kHz (deep exhaust note)', low / tot > 0.85, `${(100 * low / tot).toFixed(1)}%`);
}

for (const rpm of [2500, 4000, 6000, 7500]) {
  const { L, R } = render({ rpm, map: 3.4, throttle: 1, running: true, boost: 2.4, turbo: 0.9 }, 2);
  const o = orders(L.map((v, i) => v + R[i]).subarray(24000, 72000), rpm);
  check(`${rpm} RPM WOT: firing order 4 is the strongest engine order`, top(o).order === 4, `top order ${top(o).order}`);
}

{
  const rpm = 6000;
  const { L, R } = render({ rpm, map: 3.4, throttle: 1, running: true, boost: 2.4, turbo: 0.9 }, 2.5);
  const s = spectrum(L.map((v, i) => v + R[i]).subarray(24000));
  // turbo whistle line present under boost
  const tf = 1100 + 5600 * 0.9;
  let whistle = 0, floor = 0;
  for (let f = tf - 3; f <= tf + 3; f++) whistle = Math.max(whistle, bandEnergy(s, f, 1));
  for (let f = tf + 150; f <= tf + 400; f += 10) floor += bandEnergy(s, f, 1) / 26;
  check('boost: twin-turbo compressor whistle audible above broadband', whistle > floor * 4, `${(10 * Math.log10(whistle / floor)).toFixed(1)} dB over floor`);
}

{
  // limiter: cut cylinders -> missing pulses -> big amplitude modulation vs normal running
  const env = (x) => { const w = 480; const out = []; for (let i = 0; i + w < x.length; i += w) { let e = 0; for (let j = 0; j < w; j++) e += x[i + j] ** 2; out.push(Math.sqrt(e / w)); } return out; };
  const cv = (a) => { const m = a.reduce((p, c) => p + c, 0) / a.length; return Math.sqrt(a.reduce((p, c) => p + (c - m) ** 2, 0) / a.length) / m; };
  const base = { rpm: 8550, map: 1.6, throttle: 1, running: true, boost: 0.6, turbo: 0.5 };
  const normal = render(base, 2).L.subarray(24000);
  const cutting = render((t) => ({ ...base, cut: new Array(8).fill(Math.floor(t * 30) % 2 === 0) }), 2).L.subarray(24000);
  check('rev limiter: audible cut stutter', cv(env(cutting)) > 2 * cv(env(normal)), `envelope CV ${cv(env(cutting)).toFixed(2)} vs ${cv(env(normal)).toFixed(2)}`);
  // BOV event produces a broadband burst
  const bov = render({ rpm: 4000, map: 0.5, throttle: 0, running: true, turbo: 0.8, boost: -0.5 }, 1.2, 'bay',
    (p, t) => { if (t > 0.3 && t < 0.31) p.onMessage({ type: 'bov', amp: 1 }); }).L;
  const rms = (a, b) => { let e = 0; for (let i = a; i < b; i++) e += bov[i] ** 2; return Math.sqrt(e / (b - a)); };
  check('blow-off valve vent burst', rms(15500, 20000) > 1.5 * rms(4000, 14000), `${(rms(15500, 20000) / rms(4000, 14000)).toFixed(1)}× louder`);
  // starter cranking: gear whine with compression-stroke speed modulation
  const crank = render({ rpm: 220, map: 0.9, throttle: 0, running: false, starter: true }, 2.5, 'bay').L.subarray(36000);
  check('starter cranking produces output', finite(crank) && Math.max(...crank.map(Math.abs)) > 0.01);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll engine realism checks passed');
process.exit(failures ? 1 : 0);
