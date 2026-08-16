/**
 * WebAudio helper for the engine studio and retained CoreXY printer demo.
 * Engine audio now represents a naturally aspirated cross-plane 5.3L V8;
 * all former turbo-spool / BOV effects have been removed.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.stepperOscA = null;
    this.stepperOscB = null;
    this.stepperGain = null;
    this.stepperFilter = null;
    this.fanGain = null;
    this.engineGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineOsc3 = null;
    this.engineFilter = null;
    this.isEngineRunning = false;
    this.lastRpm = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.34, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.setupStepperSound();
      this.setupFanSound();
      this.setupEngineSound();
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.ctx) this.init();
    if (this.masterGain && this.ctx) this.masterGain.gain.setValueAtTime(this.enabled ? 0.34 : 0, this.ctx.currentTime);
    return this.enabled;
  }

  setupStepperSound() {
    if (!this.ctx) return;
    this.stepperOscA = this.ctx.createOscillator();
    this.stepperOscB = this.ctx.createOscillator();
    this.stepperOscA.type = 'square';
    this.stepperOscB.type = 'square';
    this.stepperOscA.frequency.value = 220;
    this.stepperOscB.frequency.value = 220;
    this.stepperFilter = this.ctx.createBiquadFilter();
    this.stepperFilter.type = 'bandpass';
    this.stepperFilter.frequency.value = 550;
    this.stepperFilter.Q.value = 4.5;
    this.stepperGain = this.ctx.createGain();
    this.stepperGain.gain.value = 0;
    this.stepperOscA.connect(this.stepperFilter);
    this.stepperOscB.connect(this.stepperFilter);
    this.stepperFilter.connect(this.stepperGain);
    this.stepperGain.connect(this.masterGain);
    this.stepperOscA.start();
    this.stepperOscB.start();
  }

  setupFanSound() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    this.fanGain = this.ctx.createGain();
    this.fanGain.gain.value = 0.06;
    source.connect(filter);
    filter.connect(this.fanGain);
    this.fanGain.connect(this.masterGain);
    source.start();
  }

  setupEngineSound() {
    if (!this.ctx) return;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 900;

    // Four exhaust events per crank revolution form the strongest pulse train.
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc3 = this.ctx.createOscillator();
    this.engineOsc3.type = 'square';

    const g1 = this.ctx.createGain();
    const g2 = this.ctx.createGain();
    const g3 = this.ctx.createGain();
    g1.gain.value = 0.50;
    g2.gain.value = 0.27;
    g3.gain.value = 0.08;

    this.engineOsc1.connect(g1);
    this.engineOsc2.connect(g2);
    this.engineOsc3.connect(g3);
    g1.connect(this.engineFilter);
    g2.connect(this.engineFilter);
    g3.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.engineOsc3.start();
  }

  updateStepper(vx, vy, isMoving) {
    if (!this.ctx || !this.stepperGain || !this.enabled || this.isEngineRunning) {
      if (this.stepperGain && this.ctx) this.stepperGain.gain.setValueAtTime(0, this.ctx.currentTime);
      return;
    }
    if (!isMoving) {
      this.stepperGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      return;
    }
    const speedA = Math.abs(vx + vy) || 120;
    const speedB = Math.abs(vx - vy) || 120;
    const freqA = 160 + Math.min(speedA * 2, 1100);
    const freqB = 160 + Math.min(speedB * 2, 1100);
    const t = this.ctx.currentTime;
    this.stepperOscA.frequency.setTargetAtTime(freqA, t, 0.02);
    this.stepperOscB.frequency.setTargetAtTime(freqB, t, 0.02);
    this.stepperFilter.frequency.setTargetAtTime(Math.max(freqA, freqB) * 1.6, t, 0.02);
    this.stepperGain.gain.setTargetAtTime(0.038, t, 0.03);
  }

  setEngineMode(active) {
    this.isEngineRunning = active;
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(active ? 0.25 : 0, t, 0.1);
    if (active && this.stepperGain) this.stepperGain.gain.setTargetAtTime(0, t, 0.05);
  }

  updateRPM(rpm) {
    if (!this.ctx) this.init();
    if (!this.isEngineRunning && rpm > 0) this.setEngineMode(true);
    this.updateEngineRPM(rpm);
  }

  updateEngineRPM(rpm) {
    if (!this.ctx || !this.engineOsc1 || !this.enabled) return;
    if (!this.isEngineRunning && rpm > 0) this.setEngineMode(true);
    const t = this.ctx.currentTime;
    const crankHz = Math.max(10, rpm / 60);
    const exhaustPulseHz = crankHz * 4;

    this.engineOsc1.frequency.setTargetAtTime(exhaustPulseHz, t, 0.035);
    this.engineOsc2.frequency.setTargetAtTime(exhaustPulseHz * 0.5, t, 0.035);
    this.engineOsc3.frequency.setTargetAtTime(exhaustPulseHz * 2, t, 0.035);
    this.engineFilter.frequency.setTargetAtTime(420 + (Math.min(rpm, 5600) / 5600) * 1800, t, 0.05);
    this.engineGain.gain.setTargetAtTime(0.16 + (Math.min(rpm, 5600) / 5600) * 0.13, t, 0.06);
    this.lastRpm = rpm;
  }

  playClick() {
    if (!this.ctx || !this.enabled) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.10, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }

  playCompleteChime() {
    if (!this.ctx || !this.enabled) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = this.ctx.currentTime + i * 0.12;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  }
}
