/**
 * Enhanced SoundEngine: Dual CoreXY Stepper Motors (A/B decoupled acoustics),
 * Airflow fans, Extruder micro-stepping, V8 multi-cylinder dyno roar,
 * and Turbo Blow-Off Valve (BOV) flutter.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;

    // Dual CoreXY Stepper Motor Nodes (Motor A & Motor B)
    this.stepperOscA = null;
    this.stepperOscB = null;
    this.stepperGain = null;
    this.stepperFilter = null;

    // Cooling Fan Nodes
    this.fanNoise = null;
    this.fanGain = null;

    // V8 Engine Revving Nodes
    this.engineGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineOsc3 = null;
    this.engineFilter = null;
    this.turboOsc = null;
    this.turboGain = null;

    this.isEngineRunning = false;
    this.lastRpm = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupStepperSound();
      this.setupFanSound();
      this.setupEngineSound();
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.ctx) this.init();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.enabled ? 0.35 : 0, this.ctx.currentTime);
    }
    return this.enabled;
  }

  setupStepperSound() {
    if (!this.ctx) return;

    // CoreXY Motor A
    this.stepperOscA = this.ctx.createOscillator();
    this.stepperOscA.type = 'square';
    this.stepperOscA.frequency.setValueAtTime(220, this.ctx.currentTime);

    // CoreXY Motor B
    this.stepperOscB = this.ctx.createOscillator();
    this.stepperOscB.type = 'square';
    this.stepperOscB.frequency.setValueAtTime(220, this.ctx.currentTime);

    this.stepperFilter = this.ctx.createBiquadFilter();
    this.stepperFilter.type = 'bandpass';
    this.stepperFilter.frequency.setValueAtTime(550, this.ctx.currentTime);
    this.stepperFilter.Q.setValueAtTime(4.5, this.ctx.currentTime);

    this.stepperGain = this.ctx.createGain();
    this.stepperGain.gain.setValueAtTime(0, this.ctx.currentTime);

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
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const fanFilter = this.ctx.createBiquadFilter();
    fanFilter.type = 'lowpass';
    fanFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);

    this.fanGain = this.ctx.createGain();
    this.fanGain.gain.setValueAtTime(0.07, this.ctx.currentTime);

    noiseSource.connect(fanFilter);
    fanFilter.connect(this.fanGain);
    this.fanGain.connect(this.masterGain);

    noiseSource.start();
  }

  setupEngineSound() {
    if (!this.ctx) return;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(800, this.ctx.currentTime);

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(50, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(25, this.ctx.currentTime);

    this.engineOsc3 = this.ctx.createOscillator();
    this.engineOsc3.type = 'sawtooth';
    this.engineOsc3.frequency.setValueAtTime(100, this.ctx.currentTime);

    this.turboOsc = this.ctx.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboOsc.frequency.setValueAtTime(1200, this.ctx.currentTime);

    this.turboGain = this.ctx.createGain();
    this.turboGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.turboOsc.connect(this.turboGain);
    this.turboGain.connect(this.masterGain);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineOsc3.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.engineOsc3.start();
    this.turboOsc.start();
  }

  /**
   * Authentic CoreXY Stepper Motor Kinematics Sound:
   * In CoreXY:
   * Motor A speed = |vx + vy|
   * Motor B speed = |vx - vy|
   */
  updateStepper(vx, vy, isMoving) {
    if (!this.ctx || !this.stepperGain || !this.enabled || this.isEngineRunning) {
      if (this.stepperGain) this.stepperGain.gain.setValueAtTime(0, this.ctx.currentTime);
      return;
    }

    if (!isMoving) {
      this.stepperGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      return;
    }

    const speedA = Math.abs(vx + vy) || 120;
    const speedB = Math.abs(vx - vy) || 120;

    const freqA = 160 + Math.min(speedA * 2.0, 1100);
    const freqB = 160 + Math.min(speedB * 2.0, 1100);

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
    if (active) {
      this.engineGain.gain.setTargetAtTime(0.28, t, 0.1);
      if (this.stepperGain) this.stepperGain.gain.setTargetAtTime(0, t, 0.05);
    } else {
      this.engineGain.gain.setTargetAtTime(0, t, 0.1);
      if (this.turboGain) this.turboGain.gain.setTargetAtTime(0, t, 0.1);
    }
  }

  updateRPM(rpm) {
    if (!this.isEngineRunning && rpm > 0) {
      this.setEngineMode(true);
    }
    this.updateEngineRPM(rpm);
  }

  updateEngineRPM(rpm) {
    if (!this.ctx || !this.engineOsc1 || !this.enabled) return;
    if (!this.isEngineRunning && rpm > 0) {
      this.setEngineMode(true);
    }

    const t = this.ctx.currentTime;
    const baseFreq = Math.max(20, (rpm / 60) * 4 * 0.4);

    this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.04);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.04);
    this.engineOsc3.frequency.setTargetAtTime(baseFreq * 2.0, t, 0.04);

    this.engineFilter.frequency.setTargetAtTime(300 + (rpm / 8500) * 2400, t, 0.04);

    // Turbo spool sound
    if (this.turboOsc && this.turboGain) {
      const turboFreq = 800 + (rpm / 8500) * 3400;
      const turboVol = (rpm > 2800) ? Math.min(0.065, ((rpm - 2800) / 5700) * 0.065) : 0;
      this.turboOsc.frequency.setTargetAtTime(turboFreq, t, 0.06);
      this.turboGain.gain.setTargetAtTime(turboVol, t, 0.06);
    }

    // Trigger BOV flutter if RPM drops suddenly from high boost
    if (this.lastRpm - rpm > 1500 && this.lastRpm > 5000) {
      this.playTurboBov();
    }
    this.lastRpm = rpm;
  }

  playTurboBov() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Sequential flutter pulses
    [0, 0.08, 0.16].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400 - idx * 250, t + offset);
      osc.frequency.exponentialRampToValueAtTime(300, t + offset + 0.07);

      gain.gain.setValueAtTime(0.08 - idx * 0.02, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.07);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.07);
    });
  }

  playClick() {
    if (!this.ctx || !this.enabled) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }

  playCompleteChime() {
    if (!this.ctx || !this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.12 + 0.6);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(this.ctx.currentTime + i * 0.12);
      osc.stop(this.ctx.currentTime + i * 0.12 + 0.65);
    });
  }
}
