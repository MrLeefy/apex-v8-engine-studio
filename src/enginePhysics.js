import {
  CYL_COUNT, FIRING_DEG, CAM_PROFILES, wrap
} from './engineTiming.js';

/**
 * Real-time physical model of the Apex-V8 5.0L twin-turbo on an engine dyno.
 *
 * Everything is integrated in 1 ms sub-steps so timing is independent of frame rate:
 *  - Rotating assembly with inertia, friction, pumping and per-cylinder compression torque
 *  - Electronic throttle body (rate limited) + filling/emptying intake manifold model
 *    (choked-flow throttle, speed-density engine demand) -> MAP / vacuum / boost
 *  - Twin turbos with shaft inertia (real lag), wastegate control and blow-off valve
 *  - Starter motor, fuel pump prime, ECU cam/crank sync, start flare, cold fast-idle, stall
 *  - Idle air PI controller, hard-cut rev limiter, 2-step launch limiter, overrun pops map
 *  - Per-event combustion with cycle-to-cycle variation (lumpy race-cam idle)
 *  - Water-brake dyno absorber: hold-RPM mode and automated WOT sweep
 *  - Thermal model: EGT, coolant, oil temperature, oil pressure
 */

const RAD_TO_RPM = 60 / (2 * Math.PI);
const RPM_TO_RAD = (2 * Math.PI) / 60;
const SUBSTEP = 1 / 1000;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function gauss() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const REDLINE_RPM = 8500;
export const LIMITER_RPM = 8600;
export const LAUNCH_RPM = 4500;

export class EnginePhysics {
  constructor() {
    // Mechanical
    this.inertia = 0.42;            // kg·m² crank + flywheel + rods + dyno coupling
    this.omega = 0;                 // rad/s
    this.crankAngle = 0;            // rad, kept in [0, 4π)
    this.time = 0;                  // simulated seconds

    // Driver / ECU inputs
    this.handThrottle = 0;          // 0..1 slider
    this.keyThrottle = 0;           // 0..1 keyboard / hold button
    this.pedal = 0;
    this.throttlePlate = 0;         // actual ETB position 0..1
    this.iac = 0.012;               // idle air (equivalent area fraction)
    this.iacI = 0.012;
    this.camName = 'street';
    this.cam = CAM_PROFILES.street;
    this.popsMap = true;
    this.launchArmed = false;
    this.nitrousButton = false;
    this.nitrousActive = false;
    this.nitrousBottle = 1.0;       // fraction remaining

    // Lifecycle: off | priming | cranking | running
    this.state = 'off';
    this.stateTime = 0;
    this.ignitionOn = false;
    this.fuelPump = false;
    this.combustion = false;
    this.starterEngaged = false;
    this.crankSyncAngle = 0;
    this.startFlare = 0;
    this.stalled = false;

    // Air path
    this.map = 1.0;                 // manifold absolute pressure (bar)
    this.boostPressure = 1.0;       // compressor outlet absolute (bar)
    this.turboSpeed = 0;            // normalised shaft speed 0..~1.1
    this.wastegate = 0;
    this.boostTarget = 2.5;         // bar gauge
    this.bovOpen = false;
    this.airflow = 0;               // normalised engine air demand

    // Combustion / ECU outputs
    this.cutting = false;           // rev limiter fuel/spark cut active
    this.launchCutting = false;
    this.cutFlags = new Array(CYL_COUNT).fill(false);
    this.lastFireTime = new Array(CYL_COUNT).fill(-10);
    this.eventGain = 1;             // torque multiplier for current firing interval
    this.prevCycleDeg = 0;
    this.sparkAdvance = 0;
    this.afr = 14.7;
    this.injDuty = 0;
    this.indicatedTorque = 0;
    this.brakeTorque = 0;           // Nm
    this.torqueSmoothed = 0;

    // Dyno absorber
    this.absorberMode = 'off';      // off | hold | sweep
    this.absorberTarget = 0;
    this.absorberI = 0;
    this.absorberTorque = 0;
    this.sweep = null;              // { phase, startRpm, endRpm, rate, data: [] }
    this.lastSweep = null;

    // Thermal
    this.ambient = 22;
    this.coolant = 42;              // engine has been sitting a while
    this.oilTemp = 38;
    this.egt = 22;
    this.oilPressure = 0;           // psi

    // Event listeners
    this.listeners = {};
  }

  on(evt, fn) { (this.listeners[evt] = this.listeners[evt] || []).push(fn); }
  emit(evt, ...args) { (this.listeners[evt] || []).forEach((fn) => fn(...args)); }

  get rpm() { return this.omega * RAD_TO_RPM; }
  get cycleDeg() { return wrap(this.crankAngle * 180 / Math.PI, 720); }
  get boostGauge() { return this.map - 1.0; }
  get horsepower() { return Math.max(0, this.torqueSmoothed) * this.rpm / 7120.9; }
  get torqueLbFt() { return this.torqueSmoothed * 0.73756; }
  get turboRpm() { return this.turboSpeed * 168000; }
  get isRunning() { return this.state === 'running'; }

  setCam(name) {
    if (!CAM_PROFILES[name]) return;
    this.camName = name;
    this.cam = CAM_PROFILES[name];
  }

  // ------------------------------------------------------------ lifecycle
  startEngine() {
    if (this.state !== 'off') return false;
    this.stalled = false;
    this.ignitionOn = true;
    this.fuelPump = true;
    this.state = 'priming';
    this.stateTime = 0;
    this.emit('state', 'priming');
    return true;
  }

  stopEngine() {
    if (this.state === 'off') return;
    this.ignitionOn = false;
    this.fuelPump = false;
    this.combustion = false;
    this.starterEngaged = false;
    this.state = 'off';
    this.stateTime = 0;
    this.cancelAbsorber();
    this.emit('state', 'off');
  }

  toggleEngine() {
    if (this.state === 'off') this.startEngine();
    else this.stopEngine();
  }

  // ------------------------------------------------------------ dyno absorber
  holdRpm(target) {
    if (!this.isRunning) return false;
    this.absorberMode = 'hold';
    this.absorberTarget = clamp(target, 1500, 8000);
    this.absorberI = 0;
    this.sweep = null;
    return true;
  }

  startSweep() {
    if (!this.isRunning) return false;
    this.absorberMode = 'sweep';
    this.absorberTarget = Math.max(this.rpm, 2400);
    this.absorberI = 0;
    this.sweep = { phase: 'settle', t: 0, startRpm: 2500, endRpm: 8300, rate: 450, data: [], lastLogged: 0 };
    this.emit('sweep', 'start');
    return true;
  }

  cancelAbsorber() {
    if (this.sweep && this.sweep.phase !== 'done') this.emit('sweep', 'abort');
    this.absorberMode = 'off';
    this.absorberTorque = 0;
    this.sweep = null;
  }

  // ------------------------------------------------------------ sub-models
  volumetricEfficiency(rpm) {
    const peak = 4700 + this.cam.veShift;
    const ve = 0.66 + 0.36 * Math.exp(-Math.pow((rpm - peak) / 5200, 2));
    // big cams lose cylinder filling at low speed (reversion through overlap)
    const lowLoss = this.camName === 'race' ? 0.16 * Math.exp(-Math.pow(rpm / 2200, 2)) : 0;
    return ve - lowLoss;
  }

  frictionTorque(rpm) {
    if (rpm < 1) return 0;
    const visc = 1 + clamp((80 - this.oilTemp) / 60, 0, 1) * 0.55; // cold oil drags
    // crank/rod/piston friction + valvetrain + oil & water pump + alternator
    return (27 + 0.0105 * rpm + 1.55e-6 * rpm * rpm) * visc;
  }

  /** Per-cylinder compression/expansion torque (Nm) – dominant when not firing. */
  compressionTorque(cycleDeg) {
    let t = 0;
    for (let i = 0; i < CYL_COUNT; i++) {
      let rel = cycleDeg - FIRING_DEG[i];
      if (rel > 360) rel -= 720; else if (rel < -360) rel += 720;
      if (rel > -110 && rel < 110) {
        const r = rel / 57.2958;
        // resists while compressing (rel<0), returns most of it on expansion
        t += -Math.sin(r) * Math.exp(-(rel * rel) / 2400) * (rel < 0 ? 1 : 0.82);
      }
    }
    return t * 58 * clamp(this.map + 0.25, 0.3, 1.6);
  }

  plateArea(p) {
    // throttle plate effective area fraction (butterfly is very non-linear)
    return 1 - Math.cos(p * Math.PI / 2);
  }

  idleTarget() {
    let target = this.cam.idleRpm;
    target += clamp((70 - this.coolant) * 9, 0, 420);   // cold fast idle
    target += this.startFlare;
    return target;
  }

  // ------------------------------------------------------------ main update
  update(dt) {
    let remaining = Math.min(dt, 0.1);
    while (remaining > 1e-9) {
      const h = Math.min(SUBSTEP, remaining);
      this.step(h);
      remaining -= h;
    }
    // smoothed outputs for gauges
    const k = 1 - Math.exp(-dt / 0.12);
    this.torqueSmoothed += (this.brakeTorque - this.torqueSmoothed) * k;
  }

  step(h) {
    this.time += h;
    this.stateTime += h;
    const rpm = this.rpm;

    // ---- lifecycle state machine
    if (this.state === 'priming') {
      if (this.stateTime > 1.1) {
        this.state = 'cranking';
        this.stateTime = 0;
        this.starterEngaged = true;
        this.crankSyncAngle = 0;
        this.emit('state', 'cranking');
        this.emit('starter', true);
      }
    } else if (this.state === 'cranking') {
      // ECU needs ~1.5 revs of cam/crank signal to sync before injecting; cold engines
      // need extra cranking to build fuel film.
      const needed = 720 + clamp((60 - this.coolant) * 14, 0, 540);
      if (!this.combustion && this.crankSyncAngle > needed && rpm > 120) {
        this.combustion = true;
        this.startFlare = 380;
      }
      if (this.combustion && rpm > 520) {
        this.state = 'running';
        this.stateTime = 0;
        this.starterEngaged = false;
        this.emit('starter', false);
        this.emit('state', 'running');
      }
      if (this.stateTime > 6) {
        // failed start, release key
        this.starterEngaged = false;
        this.emit('starter', false);
        this.stopEngine();
      }
    } else if (this.state === 'running') {
      if (rpm < 280) {
        this.stalled = true;
        this.stopEngine();
        this.emit('stall');
      }
    }
    this.startFlare *= Math.exp(-h / 1.4);

    // ---- pedal -> electronic throttle body
    let pedal = Math.max(this.handThrottle, this.keyThrottle);
    if (this.sweep) {
      pedal = this.sweep.phase === 'release' || this.sweep.phase === 'done' ? 0 : 1;
    }
    this.pedal = pedal;
    const etbRate = 1 / 0.075;   // full travel in 75 ms
    const dp = clamp(pedal - this.throttlePlate, -etbRate * h, etbRate * h);
    this.throttlePlate += dp;

    // ---- idle air controller
    const running = this.combustion;
    const idleErr = this.idleTarget() - rpm;
    this.idleMode = running && this.state === 'running' && this.pedal < 0.02 &&
      this.absorberMode === 'off' && idleErr > -450;
    if (this.state === 'cranking' || this.state === 'priming') {
      // fixed "crank air" schedule, more when cold
      this.iacI = 0.0105 + clamp((60 - this.coolant) / 40, 0, 1) * 0.004;
      this.iac = this.iacI;
    } else if (this.idleMode) {
      this.iacI = clamp(this.iacI + idleErr * 1.2e-5 * h, 0.0, 0.05);
      this.iac = clamp(this.iacI + idleErr * 5e-6, 0.0, 0.06);
    } else if (running) {
      // dashpot: keep some air when throttle snaps shut so it doesn't stall
      this.iac += (this.iacI + 0.006 - this.iac) * (1 - Math.exp(-h / 0.6));
    } else {
      this.iac = 0.012;
    }

    // ---- turbo + compressor outlet pressure
    const ve = this.volumetricEfficiency(rpm);
    const engineDemand = (pressure) => pressure * ve * rpm / 6000;
    const qe = engineDemand(this.map);
    this.airflow = qe;
    // Exhaust energy available to the turbines: mass flow x temperature. Retarded
    // spark with a cut (2-step) dumps extra heat into the turbine.
    const egtFactor = 0.75 + clamp(this.egt / 950, 0, 1.2) * 0.25;
    let exhaustEnergy = (running ? qe : qe * 0.3) * egtFactor;
    if (this.launchCutting) exhaustEnergy += 0.24;
    // Boost the turbos could support at this exhaust energy (turbine map). Above the
    // boost threshold the loop through MAP has gain > 1, so boost "hits" hard.
    const BMAX = 3.3;
    const uncapped = BMAX * clamp((exhaustEnergy - 0.307) / 1.67, 0, 1);
    // wastegate bypasses exhaust once the manifold reaches the boost target
    const capped = Math.min(uncapped, this.boostTarget * 1.12 + 0.03);
    const wgTarget = uncapped > 0.05 ? clamp(1 - capped / uncapped, 0, 0.95) : 0;
    this.wastegate += (wgTarget - this.wastegate) * (1 - Math.exp(-h / 0.08));
    // shaft dynamics: spools faster with more exhaust flow, freewheels down slowly
    const potNow = BMAX * this.turboSpeed * this.turboSpeed;
    const spoolTau = capped > potNow ? 0.24 + 0.5 / (1 + 3 * exhaustEnergy) : 1.9;
    const pot = potNow + (capped - potNow) * (1 - Math.exp(-h / spoolTau));
    this.turboSpeed = Math.sqrt(Math.max(0, pot) / BMAX);
    const potential = 1 + 0.97 * pot;

    // blow-off valve: vacuum referenced, opens when throttle shuts under boost
    const bovShouldOpen = (this.boostPressure - this.map) > 0.45 && this.throttlePlate < 0.5;
    if (bovShouldOpen && !this.bovOpen) {
      this.bovOpen = true;
      const vent = this.boostPressure - 1;
      if (vent > 0.3) this.emit('bov', clamp(vent / 2.5, 0, 1.2));
    } else if (this.bovOpen && (this.boostPressure - this.map) < 0.15) {
      this.bovOpen = false;
    }
    let pbTarget = potential - 0.04 * qe * this.throttlePlate;   // intercooler pressure drop
    if (this.bovOpen) pbTarget = 1.02;
    const pbTau = this.bovOpen ? 0.06 : 0.12;
    this.boostPressure += (Math.max(1.0, pbTarget) - this.boostPressure) * (1 - Math.exp(-h / pbTau));

    // ---- intake manifold filling / emptying
    const area = clamp(this.plateArea(this.throttlePlate) + this.iac + 0.002, 0, 1);
    const ratio = this.map / this.boostPressure;
    const psi = ratio < 0.528 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((ratio - 0.528) / 0.472, 2)));
    const qt = 3.1 * area * this.boostPressure * psi;
    this.map = clamp(this.map + (qt - qe) * 46 * h, 0.12, this.boostPressure);

    // ---- combustion events (spark/fuel decisions per cylinder)
    const cycle = this.cycleDeg;
    const prev = this.prevCycleDeg;
    if (this.omega > 0) {
      for (let i = 0; i < CYL_COUNT; i++) {
        const f = FIRING_DEG[i];
        const crossed = prev <= cycle ? (f > prev && f <= cycle) : (f > prev || f <= cycle);
        if (crossed) this.onFiringEvent(i, rpm);
      }
    }
    this.prevCycleDeg = cycle;

    // ---- torque
    const load = clamp(this.map / 3.5, 0, 1.2);
    const boost = Math.max(0, this.map - 1);
    let spark = clamp(10 + rpm / 260, 12, 34) - boost * 6.2 - clamp((this.map - 0.5) * 4, 0, 4);
    if (this.idleMode) spark = 15 + clamp(idleErr * 0.03, -9, 12);   // ECU idle-spark torque control
    if (this.launchCutting) spark = -8;
    // pops map: heavy retard on overrun so fuel finishes burning in the exhaust
    if (this.overrun && this.popsMap) spark = -12;
    this.sparkAdvance = spark;

    let tInd = 0;
    if (running) {
      const sparkEff = 1 - Math.pow((spark - (34 - boost * 3)) / 55, 2) - boost * 0.045;
      const lambdaEff = boost > 0.1 ? 1.03 : 1.0;
      const slowBurn = 0.8 + 0.2 * clamp(rpm / 2500, 0, 1);     // low turbulence at idle
      tInd = 440 * ve * this.map * clamp(sparkEff, 0.35, 1) * lambdaEff * slowBurn;
      // overrun: ECU cuts fuel (or only lights a little for the pops map)
      if (this.pedal < 0.03 && !this.idleMode && rpm > this.idleTarget() + 350 && this.absorberMode === 'off') {
        tInd *= this.popsMap ? 0.12 : 0;
        this.overrun = true;
      } else this.overrun = false;
      if (this.nitrousActive) tInd += 260;
      if (this.cutting || this.launchCutting) tInd *= 0.08;   // cut cylinders
      tInd *= this.eventGain;
    }
    this.indicatedTorque = tInd;
    const pumping = 40 * (1.05 - Math.min(this.map, 1.05)) * clamp(rpm / 1500, 0, 1);
    const friction = this.frictionTorque(rpm);
    const compression = this.compressionTorque(cycle);
    this.brakeTorque = tInd - friction - pumping;

    // starter motor (geared torque at crank, falls with speed)
    let starter = 0;
    if (this.starterEngaged) {
      starter = Math.max(0, 210 * (1 - rpm / 330));
      this.crankSyncAngle += this.omega * h * 57.2958;
    }

    // ---- dyno absorber
    this.updateAbsorber(h, rpm);

    // ---- integrate
    const net = this.brakeTorque + compression + starter - this.absorberTorque;
    this.omega += (net / this.inertia) * h;
    if (this.omega < 0) this.omega = rpm < 40 ? 0 : this.omega * 0.5;
    if (!running && !this.starterEngaged && this.omega < 3) {
      // engine comes to rest against compression
      this.omega *= Math.exp(-h / 0.08);
      if (this.omega < 0.05) this.omega = 0;
    }
    this.crankAngle = wrap(this.crankAngle + this.omega * h, Math.PI * 4);

    // ---- rev limiter (hard cut with hysteresis)
    if (this.rpm > LIMITER_RPM) this.cutting = true;
    else if (this.rpm < LIMITER_RPM - 140) this.cutting = false;

    // 2-step launch control: holds 4500 with pops and builds boost
    const launchActive = this.launchArmed && running && this.pedal > 0.8 && this.absorberMode === 'off';
    if (launchActive && this.rpm > LAUNCH_RPM) this.launchCutting = true;
    else if (!launchActive || this.rpm < LAUNCH_RPM - 150) this.launchCutting = false;

    // nitrous: armed window 3000+ rpm, >85% throttle
    this.nitrousActive = this.nitrousButton && running && this.rpm > 3000 && this.throttlePlate > 0.85 &&
      this.nitrousBottle > 0 && !this.cutting && !this.launchCutting;
    if (this.nitrousActive) this.nitrousBottle = Math.max(0, this.nitrousBottle - h / 35);

    this.updateThermal(h, running, load);
    this.updateEcuReadouts(running, boost);
  }

  onFiringEvent(i, rpm) {
    if (!this.combustion) { this.cutFlags[i] = true; return; }
    const cut = this.cutting || (this.launchCutting && Math.random() < 0.72);
    this.cutFlags[i] = cut;
    const lowLoad = 1 - clamp((this.map - 0.3) / 0.9, 0, 1);
    const sigma = this.cam.roughness * (0.3 + 0.7 * lowLoad) * (rpm < 2200 ? 1 : 0.4);
    this.eventGain = cut ? 1 : clamp(1 + sigma * gauss(), 0.4, 1.6);
    if (!cut) this.lastFireTime[i] = this.time;

    // Pops & bangs: unburnt fuel lighting off in the hot exhaust
    let popChance = 0;
    if (cut) popChance = this.launchCutting ? 0.55 : 0.32;
    else if (this.popsMap && this.overrun && rpm > 2300 && this.egt > 420) {
      popChance = 0.05 + 0.1 * clamp((rpm - 2300) / 4000, 0, 1);
    }
    if (popChance > 0 && Math.random() < popChance) {
      const intensity = clamp(0.35 + Math.random() * 0.75 + (this.launchCutting ? 0.3 : 0), 0, 1.4);
      this.emit('pop', i, intensity);
    }
    this.emit('fire', i, cut);
  }

  updateAbsorber(h, rpm) {
    if (this.absorberMode === 'off') { this.absorberTorque = 0; return; }
    const sw = this.sweep;
    if (sw) {
      sw.t += h;
      if (sw.phase === 'settle') {
        // bring engine to the start speed with WOT and let boost build
        this.absorberTarget = sw.startRpm;
        if (sw.t > 2.2 && Math.abs(rpm - sw.startRpm) < 120) { sw.phase = 'sweep'; sw.t = 0; this.emit('sweep', 'sweep'); }
      } else if (sw.phase === 'sweep') {
        this.absorberTarget = sw.startRpm + sw.rate * sw.t;
        if (rpm >= sw.lastLogged + 50 && rpm > sw.startRpm) {
          sw.lastLogged = Math.floor(rpm / 50) * 50;
          sw.data.push({ rpm, tq: this.torqueSmoothed * 0.73756, hp: this.horsepower, boost: Math.max(0, this.map - 1) });
        }
        if (this.absorberTarget >= sw.endRpm) { sw.phase = 'release'; sw.t = 0; this.lastSweep = sw.data; this.emit('sweep', 'done', sw.data); }
      } else if (sw.phase === 'release') {
        // absorber eases off while throttle is closed
        this.absorberTarget = 0;
        if (sw.t > 0.6) { this.absorberMode = 'off'; this.absorberTorque = 0; this.sweep = null; return; }
      }
    }
    if (this.absorberTarget <= 0) { this.absorberTorque *= Math.exp(-h / 0.15); return; }
    const err = rpm - this.absorberTarget;            // positive -> need more load
    this.absorberI = clamp(this.absorberI + err * 9 * h, -400, 2600);
    const t = clamp(err * 5 + this.absorberI, 0, 2800); // water brake can only absorb
    this.absorberTorque += (t - this.absorberTorque) * (1 - Math.exp(-h / 0.03));
  }

  updateThermal(h, running, load) {
    const rpm = this.rpm;
    const rpmN = rpm / REDLINE_RPM;
    // EGT: rises with load, speed and retarded spark; turbine housings glow above ~750°C
    let egtTarget = this.ambient;
    if (running) {
      egtTarget = 330 + 520 * clamp(load, 0, 1) + 230 * rpmN;
      if (this.launchCutting) egtTarget += 260;
      if (this.cutting) egtTarget += 120;
      if (this.pedal < 0.03 && rpm > 1500) egtTarget = 380 + 120 * rpmN;    // overrun cools
    } else if (rpm > 50) {
      egtTarget = Math.max(this.ambient, this.egt * 0.8);
    }
    const egtTau = egtTarget > this.egt ? 1.6 : 5.0;
    this.egt += (egtTarget - this.egt) * (1 - Math.exp(-h / egtTau));

    // Coolant: heat from combustion, thermostat opens at 88°C
    // ~3 min idle warm-up from cold; a 15 s pull adds a few degrees (dyno cooling tower)
    const heat = running ? (0.26 + 0.11 * this.airflow * clamp(this.map, 0.3, 3.5)) : 0;
    const cool = (this.coolant > 88 ? (this.coolant - 88) * 0.35 : 0) + (this.coolant - this.ambient) * 0.0015;
    this.coolant += (heat - cool) * h;
    // Oil lags coolant, heated by bearing shear at speed
    const oilTarget = Math.max(this.ambient, this.coolant + (running ? 6 + 22 * rpmN : -5));
    this.oilTemp += (oilTarget - this.oilTemp) * (1 - Math.exp(-h / 25));

    // Oil pressure from the crank-driven pump, viscosity dependent, relief at 95 psi
    const visc = 1 + clamp((90 - this.oilTemp) / 90, 0, 0.8);
    const opTarget = rpm > 30 ? clamp((8 + rpm * 0.0105) * visc, 0, 95) : 0;
    this.oilPressure += (opTarget - this.oilPressure) * (1 - Math.exp(-h / 0.25));
  }

  updateEcuReadouts(running, boost) {
    if (!running) { this.afr = 0; this.injDuty = 0; return; }
    if (this.cutting || (this.launchCutting && this.indicatedTorque < 50)) {
      this.afr = 0; // cut
    } else if (this.pedal < 0.03 && this.rpm > 1800) {
      this.afr = this.popsMap ? 13.4 : 0;        // overrun: pops map keeps a little fuel, else DFCO
    } else {
      let afr = 14.7;
      if (this.map > 1.0) afr = 14.7 - clamp((this.map - 1.0) / 2.5, 0, 1) * 3.1;
      else if (this.throttlePlate > 0.85) afr = 12.6;
      afr -= clamp((60 - this.coolant) / 40, 0, 1) * 1.3;   // cold enrichment
      if (this.rpm < 1400 && this.pedal < 0.05) afr += Math.sin(this.time * 2 * Math.PI * 1.2) * 0.25; // O2 closed-loop switching
      this.afr = afr;
    }
    const fuel = this.afr > 0 ? this.airflow * this.map * 14.7 / this.afr : 0;
    this.injDuty = clamp(fuel / 2.25 * 100 * (this.nitrousActive ? 1.15 : 1), 0, 100);
  }
}
