/**
 * UIController: Handles all interactive HUD elements, Dyno Rev Bench,
 * Exploded View slider, Viewport presets, and Component Inspector tooltips.
 */
export class UIController {
  constructor(app) {
    this.app = app;
    this.currentMode = 'inspect';
    this.isXRay = false;
    this.isWireframe = false;

    this.cacheDOM();
    this.bindEvents();
    this.initDefaultInspector();
  }

  cacheDOM() {
    // Mode Switcher Tabs
    this.modeTabs = document.querySelectorAll('.mode-tab');
    this.headerStatus = document.getElementById('header-status');

    // Header Action Toggles
    this.btnXRay = document.getElementById('btn-xray-toggle');
    this.btnSnapshot = document.getElementById('btn-snapshot');
    this.btnSound = document.getElementById('btn-sound');

    // Viewport Bar
    this.viewSelect = document.getElementById('view-preset-select');
    this.explodedSlider = document.getElementById('exploded-slider');
    this.explodedVal = document.getElementById('exploded-val');
    this.btnWireframe = document.getElementById('btn-wireframe-toggle');
    this.btnResetCam = document.getElementById('btn-reset-view');

    // Nav Chips
    this.navChips = document.querySelectorAll('.nav-chip');

    // Underglow RGB Dots
    this.rgbDots = document.querySelectorAll('.rgb-dot');

    // Component Inspector
    this.inspectorName = document.getElementById('inspector-name');
    this.inspectorCategory = document.getElementById('inspector-category');
    this.inspectorSpecs = document.getElementById('inspector-specs');
    this.inspectorDesc = document.getElementById('inspector-desc');
    this.inspectorTag = document.getElementById('inspector-tag');

    // Hover Tooltip
    this.hoverTooltip = document.getElementById('hover-tooltip');
    this.ttName = document.getElementById('tt-name');
    this.ttSub = document.getElementById('tt-sub');

    // Dyno HUD & Controls
    this.dynoRpm = document.getElementById('dyno-rpm');
    this.dynoRpmBar = document.getElementById('dyno-rpm-bar');
    this.dynoHp = document.getElementById('dyno-hp');
    this.dynoTq = document.getElementById('dyno-tq');
    this.dynoBoost = document.getElementById('dyno-boost');
    this.dynoOil = document.getElementById('dyno-oil');
    this.dynoLiveTag = document.getElementById('dyno-live-tag');
    this.throttleSlider = document.getElementById('throttle-slider');
    this.btnNitrous = document.getElementById('btn-nitrous');
    this.btnLaunch = document.getElementById('btn-launch');

    // Toast
    this.toast = document.getElementById('hud-toast');
    this.toastMsg = document.getElementById('toast-message');
  }

  bindEvents() {
    // Mode Switcher Tabs
    this.modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode');
        this.setMode(mode);
        this.app.sound.playClick();
      });
    });

    // X-Ray Toggle
    if (this.btnXRay) {
      this.btnXRay.addEventListener('click', () => {
        this.isXRay = !this.isXRay;
        this.btnXRay.classList.toggle('active', this.isXRay);
        this.app.engine.setXRay(this.isXRay);
        this.app.sound.playClick();
        this.showToast(this.isXRay ? 'Ghost X-Ray Cutaway Mode Active' : 'Solid PBR Render Active');
      });
    }

    // 4K Snapshot
    if (this.btnSnapshot) {
      this.btnSnapshot.addEventListener('click', () => {
        this.takeSnapshot();
      });
    }

    // Sound Engine Toggle
    if (this.btnSound) {
      this.btnSound.addEventListener('click', () => {
        this.app.sound.resume();
        const enabled = this.app.sound.toggle();
        this.btnSound.classList.toggle('active', enabled);
        this.showToast(enabled ? 'Acoustic Sound Engine Active' : 'Sound Muted');
      });
    }

    // Viewport Camera Preset Select
    if (this.viewSelect) {
      this.viewSelect.addEventListener('change', (e) => {
        const preset = e.target.value;
        this.app.setCameraPreset(preset);
        this.app.sound.playClick();
        this.showToast(`Camera Preset: ${e.target.options[e.target.selectedIndex].text}`);
      });
    }

    // Exploded View Slider
    if (this.explodedSlider) {
      this.explodedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.explodedVal.textContent = `${val.toFixed(0)}%`;
        this.app.engine.setExploded(val / 100);
      });
    }

    // Wireframe Toggle
    if (this.btnWireframe) {
      this.btnWireframe.addEventListener('click', () => {
        this.isWireframe = !this.isWireframe;
        this.btnWireframe.classList.toggle('active', this.isWireframe);
        this.app.toggleWireframe(this.isWireframe);
        this.app.sound.playClick();
      });
    }

    // Reset Camera
    if (this.btnResetCam) {
      this.btnResetCam.addEventListener('click', () => {
        this.app.setCameraPreset('isometric');
        if (this.viewSelect) this.viewSelect.value = 'isometric';
        this.app.sound.playClick();
        this.showToast('Camera Viewport Reset');
      });
    }

    // Nav Chips
    this.navChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const preset = chip.getAttribute('data-preset');
        this.app.setCameraPreset(preset);
        if (this.viewSelect) this.viewSelect.value = preset;
        this.app.sound.playClick();
        this.showToast(`Navigated to: ${chip.textContent}`);
      });
    });

    // Studio Underglow RGB Dots
    this.rgbDots.forEach(dot => {
      dot.addEventListener('click', () => {
        this.rgbDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        const hex = parseInt(dot.getAttribute('data-hex'));
        this.app.setUnderglowColor(hex);
        this.app.sound.playClick();
        this.showToast(`Underglow Theme: ${dot.getAttribute('title')}`);
      });
    });

    // Dyno Throttle Slider
    if (this.throttleSlider) {
      this.throttleSlider.addEventListener('input', (e) => {
        const rpm = parseInt(e.target.value);
        this.updateDynoTelemetry(rpm);
      });
    }

    // Nitrous Shot
    if (this.btnNitrous) {
      this.btnNitrous.addEventListener('click', () => {
        if (this.throttleSlider) this.throttleSlider.value = 8500;
        this.updateDynoTelemetry(8500);
        this.showToast('⚡ NITROUS PURGE ACTIVATED! 1,150 HP @ 8500 RPM');
      });
    }

    // 2-Step Launch Control
    if (this.btnLaunch) {
      this.btnLaunch.addEventListener('click', () => {
        if (this.throttleSlider) this.throttleSlider.value = 4500;
        this.updateDynoTelemetry(4500);
        this.showToast('🔥 2-STEP LAUNCH CONTROL ENGAGED (4,500 RPM • 1.8 BAR BOOST)');
      });
    }

    // Initial click audio unlock
    window.addEventListener('click', () => {
      if (this.app.sound) this.app.sound.resume();
    }, { once: true });
  }

  setMode(mode) {
    this.currentMode = mode;
    this.modeTabs.forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-mode') === mode);
    });

    if (mode === 'inspect') {
      this.app.setCameraPreset('isometric');
      if (this.explodedSlider) {
        this.explodedSlider.value = 0;
        this.explodedVal.textContent = '0%';
        this.app.engine.setExploded(0);
      }
      this.updateDynoTelemetry(850);
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
      this.app.setCameraPreset('front');
      this.updateDynoTelemetry(6800);
      if (this.throttleSlider) this.throttleSlider.value = 6800;
      this.showToast('V8 Dyno Bench Active • Pull throttle to rev!');
    }
  }

  updateDynoTelemetry(rpm) {
    if (this.dynoRpm) this.dynoRpm.textContent = rpm.toLocaleString();
    if (this.dynoRpmBar) {
      const pct = ((rpm - 800) / (8500 - 800)) * 100;
      this.dynoRpmBar.style.width = `${pct}%`;
    }

    // Realistic Twin-Turbo HP & Torque Curves
    let hp = 0;
    let tq = 0;
    let boost = 0;

    if (rpm <= 1000) {
      hp = 118;
      tq = 195;
      boost = 0.0;
      if (this.dynoLiveTag) {
        this.dynoLiveTag.textContent = 'IDLE • 850 RPM';
        this.dynoLiveTag.classList.remove('red');
      }
    } else {
      const norm = (rpm - 1000) / 7500;
      boost = (norm * 2.5).toFixed(1);
      hp = Math.round(118 + norm * 980 + Math.sin(norm * Math.PI) * 120);
      tq = Math.round(195 + Math.sin(norm * Math.PI * 0.9) * 695);
      if (this.dynoLiveTag) {
        this.dynoLiveTag.textContent = `PULLING • ${rpm} RPM`;
        this.dynoLiveTag.classList.add('red');
      }
    }

    if (this.dynoHp) this.dynoHp.textContent = `${hp} HP`;
    if (this.dynoTq) this.dynoTq.textContent = `${tq} LB-FT`;
    if (this.dynoBoost) this.dynoBoost.textContent = `${boost} BAR`;
    if (this.dynoOil) this.dynoOil.textContent = `${Math.round(85 + (rpm / 8500) * 22)} °C`;

    this.app.engine.setRPM(rpm);
    if (this.app.sound) {
      this.app.sound.updateRPM(rpm);
    }
  }

  updateHoverTooltip(data, clientX, clientY) {
    if (!this.hoverTooltip) return;
    this.hoverTooltip.style.display = 'block';
    this.hoverTooltip.style.left = `${clientX}px`;
    this.hoverTooltip.style.top = `${clientY}px`;

    if (this.ttName) this.ttName.textContent = data.name || 'Component';
    if (this.ttSub) this.ttSub.textContent = `${data.category || 'V8 Engine'} • Click to Inspect`;
  }

  hideHoverTooltip() {
    if (this.hoverTooltip) {
      this.hoverTooltip.style.display = 'none';
    }
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
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2800);
  }

  update(delta) {
    // Dynamic telemetry updates if revving
  }
}
