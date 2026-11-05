/**
 * Offline render of a scripted session through the real physics model and the real
 * AudioWorklet synthesiser (same code the browser runs), written as stereo WAV.
 *   npm run render:demo -- [tailpipe|bay|control] [outDir]
 * Script: cold start -> idle -> blips -> limiter -> overrun pops -> hold 3,500 + boost
 * (BOV on lift) -> 2-step -> full dyno pull -> shutdown.
 */
import fs from 'fs';
import path from 'path';
import { ENGINE_WORKLET_SOURCE } from '../src/audio/engineWorklet.js';
import { EnginePhysics } from '../src/enginePhysics.js';
import { FIRING_DEG, BANK_OF, CAM_PROFILES } from '../src/engineTiming.js';

const mic = process.argv[2] || 'tailpipe';
const outDir = process.argv[3] || 'artifacts';
const camName = process.argv[4] || 'street';
const SR = 48000;

globalThis.sampleRate = SR;
let Proc;
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {}, onmessage: null }; } };
globalThis.registerProcessor = (n, c) => { Proc = c; };
(0, eval)(ENGINE_WORKLET_SOURCE);

const cam = CAM_PROFILES[camName];
const p = new Proc();
p.onMessage({ type: 'config', firing: FIRING_DEG, bank: BANK_OF, evo: cam.evo, ivo: cam.ivo, ivc: cam.ivc, evc: cam.evc });
p.onMessage({ type: 'mic', mic });

const e = new EnginePhysics();
e.setCam(camName);
e.on('pop', (cyl, amp) => p.onMessage({ type: 'pop', cyl, amp }));
e.on('bov', (amp) => p.onMessage({ type: 'bov', amp }));
e.on('starter', (on) => { if (on) p.onMessage({ type: 'solenoid', amp: 0.8 }); });

// [time s, action]
const script = [
  [0.3, () => e.startEngine()],
  [7, () => { e.keyThrottle = 0.35; }], [7.25, () => { e.keyThrottle = 0; }],
  [9, () => { e.keyThrottle = 1; }], [9.35, () => { e.keyThrottle = 0; }],
  [11.5, () => { e.keyThrottle = 1; }], [13.5, () => { e.keyThrottle = 0; }],      // to the limiter, then overrun pops
  [17, () => { e.holdRpm(3500); }], [17.5, () => { e.keyThrottle = 1; }],          // loaded: hear the turbos spool
  [21.5, () => { e.keyThrottle = 0; }],                                            // BOV
  [23, () => { e.cancelAbsorber(); }],
  [25, () => { e.launchArmed = true; e.keyThrottle = 1; }],                        // 2-step
  [28, () => { e.keyThrottle = 0; e.launchArmed = false; }],
  [31, () => { e.startSweep(); }],                                                 // full dyno pull
  [50, () => { e.stopEngine(); }]
];
const DURATION = 54;

const frames = [];
let si = 0;
const frame = 1 / 60;
let rendered = 0;
let peak = 0;
for (let t = 0; t < DURATION; t += frame) {
  while (si < script.length && script[si][0] <= t) script[si++][1]();
  e.update(frame);
  p.onMessage({
    type: 'state', s: {
      rpm: e.rpm, throttle: e.throttlePlate, map: e.map, boost: e.map - 1, turbo: e.turboSpeed, wg: e.wastegate,
      running: e.combustion, starter: e.starterEngaged, pump: e.fuelPump, overrun: !!e.overrun,
      nitrous: e.nitrousActive, cut: e.cutFlags, angle: e.cycleDeg, roughness: e.cam.roughness, timeScale: 1, volume: 1
    }
  });
  const target = Math.round((t + frame) * SR);
  while (rendered < target) {
    const L = new Float32Array(128), R = new Float32Array(128);
    p.process([], [[L, R]]);
    for (let i = 0; i < 128; i++) { frames.push(L[i], R[i]); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
    rendered += 128;
  }
}

// gentle soft-clip limiter + normalise (stands in for the browser's DynamicsCompressor)
const g = 1.6 / peak;
const out = Buffer.alloc(44 + frames.length * 2);
out.write('RIFF', 0); out.writeUInt32LE(36 + frames.length * 2, 4); out.write('WAVE', 8);
out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write('data', 36); out.writeUInt32LE(frames.length * 2, 40);
for (let i = 0; i < frames.length; i++) {
  const v = Math.tanh(frames[i] * g) * 0.89;
  out.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
}
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `apex_v8_${camName}_${mic}.wav`);
fs.writeFileSync(file, out);
console.log(`wrote ${file} (${DURATION}s)`);
