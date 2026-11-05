import { FIRING_SEQUENCE, CYL_NUMBER, BANK_OF, FIRING_ORDER_LABEL, CAM_PROFILES } from './engineTiming.js';
import { REDLINE_RPM, LAUNCH_RPM } from './enginePhysics.js';

/**
 * UIController: HUD, engine controls (ignition, throttle, dyno absorber, 2-step,
 * nitrous), live ECU telemetry, firing-order strip, dyno sheet, viewports,
 * exploded view and component inspector.
 */
export class UIController {
  constructor(app) {
    this.app = app;
    this.currentMode = 'inspect';
    this.isXRay = false;
    this.isWireframe = false;
    this.keys = new Set();
    this.telemetryTimer = 0;
    this.lastState = null;
    this.prevSweepData = null;

    this.cacheDOM();
    this.buildFiringLeds();
    this.bindEvents();
    this.bindEngineEvents();
    this.initDefaultInspector();
    this.drawDynoChart();
  }

  $(id) { return document.getElementById(id); }

  cacheDOM() {
    this.modeTabs = document.querySelectorAll('.mode-tab');
    this.headerStatus = this.$('header-status');

    this.btnXRay = this.$('btn-xray-toggle');
    this.btnSnapshot = this.$('btn-snapshot');
    this.btnSound = this.$('btn-sound');

    this.viewSelect = this.$('view-preset-select');
    this.explodedSlider = this.$('exploded-slider');
    this.explodedVal = this.$('exploded-val');
    this.btnWireframe = this.$('btn-wireframe-toggle');
    this.btnResetCam = this.$('btn-reset-view');
    this.navChips = document.querySelectorAll('.nav-chip');
    this.rgbDots = document.querySelectorAll('.rgb-dot');

    this.inspectorName = this.$('inspector-name');
    this.inspectorCategory = this.$('inspector-category');
    this.inspectorSpecs = this.$('inspector-specs');
    this.inspectorDesc = this.$('inspector-desc');
    this.inspectorTag = this.$('inspector-tag');

    this.hoverTooltip = this.$('hover-tooltip');
    this.ttName = this.$('tt-name');
    this.ttSub = this.$('tt-sub');

    // engine control & telemetry
    this.dynoRpm = this.$('dyno-rpm');
    this.dynoRpmBar = this.$('dyno-rpm-bar');
    this.barThrottle = this.$('bar-throttle');
    this.barMap = this.$('bar-map');
    this.dynoLiveTag = this.$('dyno-live-tag');
    this.btnStart = this.$('btn-start');
    this.btnStartLabel = this.$('btn-start-label');
    this.tele = {
      hp: this.$('dyno-hp'), tq: this.$('dyno-tq'), boost: this.$('dyno-boost'), afr: this.$('dyno-afr'),
      ign: this.$('dyno-ign'), turbo: this.$('dyno-turbo'), egt: this.$('dyno-egt'), oilp: this.$('dyno-oilp'),
      inj: this.$('dyno-inj'), coolant: this.$('dyno-coolant'), oil: this.$('dyno-oil'), absorber: this.$('dyno-absorber')
    };
    this.crankReadout = this.$('crank-angle-readout');
    this.firingLedWrap = this.$('firing-leds');
    this.throttleSlider = this.$('throttle-slider');
    this.throttleVal = this.$('throttle-val');
    this.btnPull = this.$('btn-dyno-pull');
    this.btnHold = this.$('btn-hold');
    this.btnLaunch = this.$('btn-launch');
    this.btnNitrous = this.$('btn-nitrous');
    this.micSelect = this.$('mic-select');
    this.camSelect = this.$('cam-select');
    this.timeScaleSelect = this.$('timescale-select');
    this.volumeSlider = this.$('volume-slider');
    this.popsToggle = this.$('pops-toggle');
    this.chart = this.$('dyno-chart');
    this.chartTag = this.$('dyno-chart-tag');
    this.specFiring = this.$('spec-firing-order');

    this.toast = this.$('hud-toast');
    this.toastMsg = this.$('toast-message');
  }

  buildFiringLeds() {
    if (this.specFiring) this.specFiring.textContent = FIRING_ORDER_LABEL.join('-');
    if (!this.firingLedWrap) return;
    // start the strip at cylinder 1
    const seq = FIRING_SEQUENCE.slice();
    const k = seq.findIndex((i) => CYL_NUMBER[i] === 1);
    const ordered = seq.slice(k).concat(seq.slice(0, k));
    this.leds = ordered.map((cyl) => {
      const el = document.createElement('div');
      el.className = `fs-led ${BANK_OF[cyl] ? 'bank-r' : 'bank-l'}`;
      el.innerHTML = `<i></i><b>${CYL_NUMBER[cyl]}</b>`;
      el.title = `Cylinder ${CYL_NUMBER[cyl]} (${BANK_OF[cyl] ? 'right' : 'left'} bank)`;
      this.firingLedWrap.appendChild(el);
      return { cyl, dot: el.querySelector('i') };
    });
  }

  // ------------------------------------------------------------------ events
  bindEvents() {
    const sound = () => this.app.sound;
    const physics = () => this.app.physics;

    // audio can only start from a user gesture
    const unlock = () => { sound().init(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    this.modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.setMode(tab.getAttribute('data-mode'));
        sound().playClick();
      });
    });

    this.btnXRay?.addEventListener('click', () => {
      this.isXRay = !this.isXRay;
      this.btnXRay.classList.toggle('active', this.isXRay);
      this.app.engine.setXRay(this.isXRay);
      sound().playClick();
      this.showToast(this.isXRay ? 'Ghost X-Ray: watch each chamber light up in firing order' : 'Solid PBR Render Active');
    });

    this.btnSnapshot?.addEventListener('click', () => this.takeSnapshot());

    this.btnSound?.addEventListener('click', () => {
      sound().init();
      const enabled = sound().toggle();
      this.btnSound.classList.toggle('active', enabled);
      this.showToast(enabled ? 'Acoustic Sound Engine Active' : 'Sound Muted');
    });

    this.viewSelect?.addEventListener('change', (e) => {
      this.app.setCameraPreset(e.target.value);
      sound().playClick();
      this.showToast(`Camera Preset: ${e.target.options[e.target.selectedIndex].text}`);
    });

    this.explodedSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.explodedVal.textContent = `${val.toFixed(0)}%`;
      this.app.engine.setExploded(val / 100);
    });

    this.btnWireframe?.addEventListener('click', () => {
      this.isWireframe = !this.isWireframe;
      this.btnWireframe.classList.toggle('active', this.isWireframe);
      this.app.toggleWireframe(this.isWireframe);
      sound().playClick();
    });

    this.btnResetCam?.addEventListener('click', () => {
      this.app.setCameraPreset('isometric');
      if (this.viewSelect) this.viewSelect.value = 'isometric';
      sound().playClick();
      this.showToast('Camera Viewport Reset');
    });

    this.navChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const preset = chip.getAttribute('data-preset');
        this.app.setCameraPreset(preset);
        if (this.viewSelect) this.viewSelect.value = preset;
        sound().playClick();
        this.showToast(`Navigated to: ${chip.textContent}`);
      });
    });

    this.rgbDots.forEach(dot => {
      dot.addEventListener('click', () => {
        this.rgbDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.app.setUnderglowColor(parseInt(dot.getAttribute('data-hex')));
        sound().playClick();
        this.showToast(`Underglow Theme: ${dot.getAttribute('title')}`);
      });
    });

    // ---- engine controls
    this.btnStart?.addEventListener('click', () => this.toggleIgnition());

    this.throttleSlider?.addEventListener('input', (e) => {
      physics().handThrottle = parseInt(e.target.value, 10) / 100;
    });

    this.btnPull?.addEventListener('click', () => this.toggleDynoPull());
    this.btnHold?.addEventListener('click', () => this.toggleHold());
    this.btnLaunch?.addEventListener('click', () => this.toggleLaunch());

    if (this.btnNitrous) {
      const on = (e) => { e.preventDefault(); this.setNitrous(true); };
      const off = () => this.setNitrous(false);
      this.btnNitrous.addEventListener('pointerdown', on);
      this.btnNitrous.addEventListener('pointerup', off);
      this.btnNitrous.addEventListener('pointerleave', off);
    }

    this.micSelect?.addEventListener('change', (e) => {
      sound().setMic(e.target.value);
      this.showToast(`Microphone: ${e.target.options[e.target.selectedIndex].text}`);
    });

    this.camSelect?.addEventListener('change', (e) => {
      const name = e.target.value;
      physics().setCam(name);
      this.app.engine.setCamProfile(name);
      sound().setCam(CAM_PROFILES[name]);
      this.showToast(`Camshafts: ${CAM_PROFILES[name].label} • idle ${CAM_PROFILES[name].idleRpm} RPM`);
    });

    this.timeScaleSelect?.addEventListener('change', (e) => {
      this.app.timeScale = parseFloat(e.target.value);
      this.showToast(this.app.timeScale < 1
        ? `Slow motion ${this.app.timeScale}× — every event (spark, valves, pulses) slowed together`
        : 'Real time');
    });

    this.volumeSlider?.addEventListener('input', (e) => {
      sound().setVolume(parseInt(e.target.value, 10) / 100);
    });

    this.popsToggle?.addEventListener('change', (e) => {
      physics().popsMap = e.target.checked;
      this.showToast(e.target.checked ? 'Overrun pops & bangs map enabled' : 'Factory decel fuel cut (no pops)');
    });

    // ---- keyboard
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' && e.target.type !== 'range')) return;
      const code = e.code;
      if (code === 'Space' || code === 'ArrowUp') {
        e.preventDefault();
        // don't let SPACE "click" whichever button has focus
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
      }
      if (e.repeat) return;
      this.keys.add(code);
      if (code === 'KeyS') this.toggleIgnition();
      else if (code === 'KeyD') this.toggleDynoPull();
      else if (code === 'KeyH') this.toggleHold();
      else if (code === 'KeyL') this.toggleLaunch();
      else if (code === 'KeyN') this.setNitrous(true);
      this.updateKeyThrottle();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyN') this.setNitrous(false);
      this.updateKeyThrottle();
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.updateKeyThrottle(); this.setNitrous(false); });
  }

  updateKeyThrottle() {
    const k = this.keys;
    let v = 0;
    if (k.has('KeyE')) v = 0.35;
    if (k.has('Space') || k.has('ArrowUp') || k.has('KeyW')) v = 1;
    this.app.physics.keyThrottle = v;
  }

  bindEngineEvents() {
    const p = this.app.physics;
    p.on('stall', () => this.showToast('⚠️ ENGINE STALLED'));
    p.on('sweep', (phase, data) => {
      if (phase === 'start') this.showToast('📈 Dyno pull: stabilising at 2,500 RPM, WOT…');
      else if (phase === 'sweep') this.showToast('📈 Sweeping 2,500 → 8,300 RPM at 450 RPM/s');
      else if (phase === 'abort') this.showToast('Dyno pull aborted');
      else if (phase === 'done' && data && data.length) {
        const pk = data.reduce((a, b) => (b.hp > a.hp ? b : a));
        const pt = data.reduce((a, b) => (b.tq > a.tq ? b : a));
        this.prevSweepData = this.sweepData || null;
        this.sweepData = data;
        if (this.chartTag) this.chartTag.textContent = `${Math.round(pk.hp)} HP • ${Math.round(pt.tq)} LB-FT`;
        this.showToast(`🏁 ${Math.round(pk.hp)} HP @ ${Math.round(pk.rpm / 50) * 50} • ${Math.round(pt.tq)} lb-ft @ ${Math.round(pt.rpm / 50) * 50}`);
        this.drawDynoChart();
      }
    });
  }

  toggleIgnition() {
    const p = this.app.physics;
    this.app.sound.init();
    if (p.state === 'off') {
      p.startEngine();
      this.showToast('🔑 Ignition ON • fuel pump priming…');
    } else {
      p.stopEngine();
      this.setHoldUi(false);
      this.showToast('Ignition OFF');
    }
    this.app.sound.playClick();
  }

  toggleDynoPull() {
    const p = this.app.physics;
    if (p.absorberMode === 'sweep') { p.cancelAbsorber(); return; }
    if (!p.isRunning) { this.showToast('Start the engine first (S)'); return; }
    if (p.coolant < 60) this.showToast('Engine is cold — power will be down until it warms up');
    p.launchArmed = false;
    this.btnLaunch?.classList.remove('on');
    p.startSweep();
    this.setHoldUi(false);
    if (this.currentMode !== 'dyno') this.setMode('dyno');
  }

  toggleHold() {
    const p = this.app.physics;
    if (p.absorberMode === 'hold') { p.cancelAbsorber(); this.setHoldUi(false); this.showToast('Absorber released • free revving'); return; }
    if (!p.isRunning) { this.showToast('Start the engine first (S)'); return; }
    const target = Math.max(1500, Math.round(p.rpm / 100) * 100);
    p.holdRpm(target);
    this.setHoldUi(true);
    this.showToast(`⚓ Water brake holding ${target.toLocaleString()} RPM — add throttle to load the engine`);
  }

  setHoldUi(on) { this.btnHold?.classList.toggle('on', on); }

  toggleLaunch() {
    const p = this.app.physics;
    p.launchArmed = !p.launchArmed;
    this.btnLaunch?.classList.toggle('on', p.launchArmed);
    this.app.sound.solenoid(0.3);
    this.showToast(p.launchArmed
      ? `🔥 2-step armed: hold WOT (SPACE) to sit on the ${LAUNCH_RPM.toLocaleString()} RPM launch limiter`
      : '2-step disarmed');
  }

  setNitrous(on) {
    const p = this.app.physics;
    if (p.nitrousButton === on) return;
    p.nitrousButton = on;
    this.btnNitrous?.classList.toggle('on', on);
    if (on) this.app.sound.solenoid(0.6);
  }

  setMode(mode) {
    this.currentMode = mode;
    this.modeTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-mode') === mode));

    if (mode === 'inspect') {
      this.app.setCameraPreset('isometric');
      if (this.explodedSlider) {
        this.explodedSlider.value = 0;
        this.explodedVal.textContent = '0%';
        this.app.engine.setExploded(0);
      }
      this.showToast('3D Inspector Mode Active • Click parts to inspect');
    } else if (mode === 'exploded') {
      this.app.setCameraPreset('isometric');
      if (this.explodedSlider) {
        this.explodedSlider.value = 60;
        this.explodedVal.textContent = '60%';
        this.app.engine.setExploded(0.6);
      }
      this.showToast('Exploded X-Ray Assembly Active');
    } else if (mode === 'dyno') {
      this.app.setCameraPreset('dyno');
      if (this.viewSelect) this.viewSelect.value = 'dyno';
      if (this.explodedSlider) {
        this.explodedSlider.value = 0;
        this.explodedVal.textContent = '0%';
        this.app.engine.setExploded(0);
      }
      if (!this.app.physics.isRunning) this.showToast('Dyno cell • press S (or START) to fire it up, SPACE to rev');
    }
  }

  // ------------------------------------------------------------------ per-frame
  update(delta) {
    const p = this.app.physics;
    const rpm = p.rpm;

    // fast visual elements every frame
    if (this.dynoRpmBar) this.dynoRpmBar.style.width = `${Math.min(100, (rpm / 9000) * 100)}%`;
    if (this.barThrottle) this.barThrottle.style.width = `${(p.throttlePlate * 100).toFixed(1)}%`;
    if (this.barMap) this.barMap.style.width = `${Math.min(100, (p.map / 3.6) * 100).toFixed(1)}%`;

    if (this.leds) {
      const ts = Math.max(this.app.timeScale, 0.01);
      for (const led of this.leds) {
        const since = (p.time - p.lastFireTime[led.cyl]) / ts;
        const g = p.combustion ? Math.exp(-since / 0.06) : 0;
        led.dot.style.background = g > 0.02 ? `rgba(255, ${Math.round(120 + 100 * g)}, 40, ${0.15 + 0.85 * g})` : '';
        led.dot.style.boxShadow = g > 0.05 ? `0 0 ${Math.round(4 + 10 * g)}px rgba(255,140,40,${g})` : '';
      }
    }

    // DOM text at ~15 Hz
    this.telemetryTimer += delta;
    if (this.telemetryTimer < 1 / 15) return;
    this.telemetryTimer = 0;

    if (this.dynoRpm) this.dynoRpm.textContent = Math.round(rpm / 10) * 10 > 0 ? (Math.round(rpm / 10) * 10).toLocaleString() : '0';
    if (this.crankReadout) this.crankReadout.textContent = `CYCLE ${Math.round(p.cycleDeg).toString().padStart(3, '0')}° / 720°`;

    const t = this.tele;
    const running = p.combustion;
    const hp = Math.max(0, p.horsepower);
    this.set(t.hp, `${Math.round(hp)} HP`);
    this.set(t.tq, `${Math.round(Math.max(0, p.torqueLbFt))} LB-FT`);
    const boost = p.map - 1;
    this.set(t.boost, boost >= 0 ? `${boost.toFixed(2)} BAR` : `${Math.round(-boost * 29.53)} inHg`);
    this.cls(t.boost, boost > 2.6 ? 'hot' : boost > 0.2 ? 'warn' : '');
    this.set(t.afr, running ? (p.afr > 0 ? `${p.afr.toFixed(1)}:1` : 'CUT') : '--');
    this.cls(t.afr, p.afr > 0 && p.afr < 12.2 ? 'good' : p.afr === 0 && running ? 'hot' : '');
    this.set(t.ign, running ? (p.sparkAdvance >= 0 ? `${p.sparkAdvance.toFixed(1)}° BTDC` : `${(-p.sparkAdvance).toFixed(0)}° ATDC`) : '--');
    this.set(t.turbo, `${Math.round(p.turboRpm / 1000)}K RPM`);
    this.set(t.egt, `${Math.round(p.egt)} °C`);
    this.cls(t.egt, p.egt > 950 ? 'hot' : p.egt > 800 ? 'warn' : '');
    this.set(t.oilp, `${Math.round(p.oilPressure)} PSI`);
    this.cls(t.oilp, running && p.oilPressure < 10 ? 'hot' : '');
    this.set(t.inj, `${Math.round(p.injDuty)} %`);
    this.set(t.coolant, `${Math.round(p.coolant)} °C`);
    this.cls(t.coolant, p.coolant < 60 ? 'warn' : p.coolant > 105 ? 'hot' : '');
    this.set(t.oil, `${Math.round(p.oilTemp)} °C`);
    this.set(t.absorber, p.absorberMode === 'off' ? 'OFF'
      : `${Math.round(p.absorberTorque * 0.7376)} LB-FT`);

    // state tag + start button
    let tag = 'ENGINE OFF';
    let red = false;
    if (p.state === 'priming') tag = 'FUEL PRIME';
    else if (p.state === 'cranking') tag = p.combustion ? 'CATCHING…' : 'CRANKING';
    else if (p.state === 'running') {
      if (p.cutting) { tag = 'REV LIMITER'; red = true; }
      else if (p.launchCutting) { tag = '2-STEP ACTIVE'; red = true; }
      else if (p.sweep) { tag = p.sweep.phase === 'sweep' ? 'DYNO PULL' : 'DYNO SETTLE'; red = true; }
      else if (p.absorberMode === 'hold') { tag = `HOLD ${Math.round(p.absorberTarget).toLocaleString()}`; red = p.pedal > 0.3; }
      else if (p.overrun) tag = 'OVERRUN';
      else if (p.idleMode) tag = p.coolant < 60 ? 'COLD IDLE' : 'IDLE';
      else { tag = 'REVVING'; red = rpm > REDLINE_RPM * 0.6; }
      if (p.nitrousActive) tag += ' • N2O';
    }
    if (this.dynoLiveTag) {
      this.dynoLiveTag.textContent = tag;
      this.dynoLiveTag.classList.toggle('red', red);
    }
    if (this.btnStart && p.state !== this.lastState) {
      this.lastState = p.state;
      this.btnStart.classList.toggle('running', p.state === 'running');
      this.btnStart.classList.toggle('busy', p.state === 'priming' || p.state === 'cranking');
      this.btnStartLabel.textContent = p.state === 'running' ? 'STOP ENGINE'
        : p.state === 'off' ? 'START ENGINE' : p.state === 'priming' ? 'PRIMING…' : 'CRANKING…';
      if (p.state === 'off') this.setHoldUi(false);
    }
    if (p.absorberMode !== 'hold') this.setHoldUi(false);
    this.btnPull?.classList.toggle('on', p.absorberMode === 'sweep');
    if (this.throttleVal) {
      this.throttleVal.textContent = `${Math.round(p.pedal * 100)}%`;
    }
    if (this.headerStatus) this.headerStatus.textContent = `${tag} • ${this.app.fps || 60} FPS`;

    if (p.sweep && p.sweep.phase === 'sweep') this.drawDynoChart(p.sweep.data);
  }

  set(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }
  cls(el, c) {
    if (!el) return;
    el.classList.toggle('warn', c === 'warn');
    el.classList.toggle('hot', c === 'hot');
    el.classList.toggle('good', c === 'good');
  }

  // ------------------------------------------------------------------ dyno sheet
  drawDynoChart(live) {
    const c = this.chart;
    if (!c) return;
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    const pad = { l: 46, r: 40, t: 14, b: 30 };
    const x0 = 2000, x1 = 8500, yMax = 1300, bMax = 3.0;
    const X = (r) => pad.l + ((r - x0) / (x1 - x0)) * (W - pad.l - pad.r);
    const Y = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
    const YB = (v) => H - pad.b - (v / bMax) * (H - pad.t - pad.b);

    g.clearRect(0, 0, W, H);
    g.font = '18px JetBrains Mono, monospace';
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.fillStyle = 'rgba(255,255,255,0.45)';
    for (let r = 2000; r <= 8500; r += 1000) {
      g.beginPath(); g.moveTo(X(r), pad.t); g.lineTo(X(r), H - pad.b); g.stroke();
      g.fillText(`${r / 1000}k`, X(r) - 10, H - 8);
    }
    for (let v = 0; v <= yMax; v += 250) {
      g.beginPath(); g.moveTo(pad.l, Y(v)); g.lineTo(W - pad.r, Y(v)); g.stroke();
      g.fillText(`${v}`, 2, Y(v) + 6);
    }
    g.fillStyle = 'rgba(255,183,3,0.6)';
    for (let b = 0; b <= bMax; b += 1) g.fillText(`${b}`, W - pad.r + 10, YB(b) + 6);

    const line = (data, key, color, scale, width, dash) => {
      if (!data || data.length < 2) return;
      g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash || []);
      g.beginPath();
      data.forEach((pt, i) => {
        const yy = scale === 'b' ? YB(pt[key]) : Y(pt[key]);
        if (i === 0) g.moveTo(X(pt.rpm), yy); else g.lineTo(X(pt.rpm), yy);
      });
      g.stroke();
      g.setLineDash([]);
    };
    if (this.prevSweepData) {
      line(this.prevSweepData, 'hp', 'rgba(255,77,109,0.25)', 'y', 2, [6, 6]);
      line(this.prevSweepData, 'tq', 'rgba(0,210,255,0.25)', 'y', 2, [6, 6]);
    }
    const data = live || this.sweepData;
    line(data, 'boost', 'rgba(255,183,3,0.85)', 'b', 2);
    line(data, 'tq', '#00d2ff', 'y', 3);
    line(data, 'hp', '#ff4d6d', 'y', 3);
    if (!data || data.length < 2) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.font = '20px JetBrains Mono, monospace';
      g.fillText('Start engine, then DYNO PULL (D)', pad.l + 40, H / 2);
    }
  }

  // ------------------------------------------------------------------ inspector
  updateHoverTooltip(data, clientX, clientY) {
    if (!this.hoverTooltip) return;
    this.hoverTooltip.style.display = 'block';
    this.hoverTooltip.style.left = `${clientX}px`;
    this.hoverTooltip.style.top = `${clientY}px`;
    if (this.ttName) this.ttName.textContent = data.name || 'Component';
    if (this.ttSub) this.ttSub.textContent = `${data.category || 'V8 Engine'} • Click to Inspect`;
  }

  hideHoverTooltip() {
    if (this.hoverTooltip) this.hoverTooltip.style.display = 'none';
  }

  showComponentInspector(data) {
    if (this.inspectorName) this.inspectorName.textContent = data.name || 'V8 Component';
    if (this.inspectorCategory) this.inspectorCategory.textContent = (data.category || 'ENGINE SUBASSEMBLY').toUpperCase();
    if (this.inspectorSpecs) this.inspectorSpecs.textContent = data.specs || 'High-Strength Automotive Metallurgy';
    if (this.inspectorDesc) this.inspectorDesc.textContent = data.description || 'Precision engineered component operating in high-stress racing conditions.';
    if (this.inspectorTag) this.inspectorTag.textContent = 'INSPECTED';
  }

  initDefaultInspector() {
    this.showComponentInspector({
      name: 'Left DOHC Cylinder Head',
      category: 'Cylinder Heads & Valvetrain',
      specs: 'CNC Ported 4-Valve Combustion Chambers • Copper-Beryllium Seats',
      description: 'Features high-flow tumble intake ports and sodium-filled exhaust valves designed for maximum volumetric efficiency under 2.5 bar boost.'
    });
  }

  takeSnapshot() {
    this.app.renderer.render(this.app.scene, this.app.camera);
    const dataURL = this.app.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Apex_V8_TwinTurbo_${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    this.showToast('📸 4K Studio Snapshot Saved!');
  }

  showToast(msg) {
    if (!this.toast) return;
    this.toastMsg.textContent = msg;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toast.classList.remove('show'), 3200);
  }
}
