/**
 * UI controller for the 2006 Chevrolet Tahoe 5.3L Vortec 5300 studio.
 * The old 5.0L twin-turbo / nitrous telemetry has intentionally been removed.
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
    this.modeTabs = document.querySelectorAll('.mode-tab');
    this.headerStatus = document.getElementById('header-status');
    this.btnXRay = document.getElementById('btn-xray-toggle');
    this.btnSnapshot = document.getElementById('btn-snapshot');
    this.btnSound = document.getElementById('btn-sound');
    this.viewSelect = document.getElementById('view-preset-select');
    this.explodedSlider = document.getElementById('exploded-slider');
    this.explodedVal = document.getElementById('exploded-val');
    this.btnWireframe = document.getElementById('btn-wireframe-toggle');
    this.btnResetCam = document.getElementById('btn-reset-view');
    this.navChips = document.querySelectorAll('.nav-chip');
    this.rgbDots = document.querySelectorAll('.rgb-dot');
    this.inspectorName = document.getElementById('inspector-name');
    this.inspectorCategory = document.getElementById('inspector-category');
    this.inspectorSpecs = document.getElementById('inspector-specs');
    this.inspectorDesc = document.getElementById('inspector-desc');
    this.inspectorTag = document.getElementById('inspector-tag');
    this.hoverTooltip = document.getElementById('hover-tooltip');
    this.ttName = document.getElementById('tt-name');
    this.ttSub = document.getElementById('tt-sub');
    this.dynoRpm = document.getElementById('dyno-rpm');
    this.dynoRpmBar = document.getElementById('dyno-rpm-bar');
    this.dynoHp = document.getElementById('dyno-hp');
    this.dynoTq = document.getElementById('dyno-tq');
    this.dynoBoost = document.getElementById('dyno-boost');
    this.dynoOil = document.getElementById('dyno-oil');
    this.dynoLiveTag = document.getElementById('dyno-live-tag');
    this.throttleSlider = document.getElementById('throttle-slider');
    this.btnPeak = document.getElementById('btn-nitrous');
    this.btnCruise = document.getElementById('btn-launch');
    this.toast = document.getElementById('hud-toast');
    this.toastMsg = document.getElementById('toast-message');
  }

  bindEvents() {
    this.modeTabs.forEach(tab => tab.addEventListener('click', () => {
      this.setMode(tab.getAttribute('data-mode'));
      this.app.sound?.playClick();
    }));

    this.btnXRay?.addEventListener('click', () => {
      this.isXRay = !this.isXRay;
      this.btnXRay.classList.toggle('active', this.isXRay);
      this.app.engine.setXRay(this.isXRay);
      this.app.sound?.playClick();
      this.showToast(this.isXRay ? 'Cutaway X-Ray active — block/head castings translucent' : 'Solid factory-style render active');
    });

    this.btnSnapshot?.addEventListener('click', () => this.takeSnapshot());

    this.btnSound?.addEventListener('click', () => {
      this.app.sound?.resume();
      const enabled = this.app.sound?.toggle();
      this.btnSound.classList.toggle('active', !!enabled);
      this.showToast(enabled ? 'Vortec V8 sound active' : 'Sound muted');
    });

    this.viewSelect?.addEventListener('change', e => {
      const preset = e.target.value;
      this.app.setCameraPreset(preset);
      this.app.sound?.playClick();
      this.showToast(`View: ${e.target.options[e.target.selectedIndex].text}`);
    });

    this.explodedSlider?.addEventListener('input', e => {
      const val = Number(e.target.value);
      if (this.explodedVal) this.explodedVal.textContent = `${val.toFixed(0)}%`;
      this.app.engine.setExploded(val / 100);
    });

    this.btnWireframe?.addEventListener('click', () => {
      this.isWireframe = !this.isWireframe;
      this.btnWireframe.classList.toggle('active', this.isWireframe);
      this.app.toggleWireframe(this.isWireframe);
      this.app.sound?.playClick();
    });

    this.btnResetCam?.addEventListener('click', () => {
      this.app.setCameraPreset('isometric');
      if (this.viewSelect) this.viewSelect.value = 'isometric';
      this.app.sound?.playClick();
      this.showToast('Camera reset to complete-engine view');
    });

    this.navChips.forEach(chip => chip.addEventListener('click', () => {
      const preset = chip.getAttribute('data-preset');
      this.app.setCameraPreset(preset);
      if (this.viewSelect) this.viewSelect.value = preset;
      this.app.sound?.playClick();
      this.showToast(`Focused: ${chip.textContent}`);
    }));

    this.rgbDots.forEach(dot => dot.addEventListener('click', () => {
      this.rgbDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      this.app.setUnderglowColor(parseInt(dot.getAttribute('data-hex')));
      this.app.sound?.playClick();
    }));

    this.throttleSlider?.addEventListener('input', e => this.updateDynoTelemetry(Number(e.target.value)));

    // Keep legacy element IDs for CSS/backward compatibility, but actions are now stock engine presets.
    this.btnPeak?.addEventListener('click', () => {
      if (this.throttleSlider) this.throttleSlider.value = '5200';
      this.updateDynoTelemetry(5200);
      this.showToast('Factory rated power point: 295 HP @ 5,200 RPM');
    });

    this.btnCruise?.addEventListener('click', () => {
      if (this.throttleSlider) this.throttleSlider.value = '2000';
      this.updateDynoTelemetry(2000);
      this.showToast('Running view set to 2,000 RPM');
    });

    window.addEventListener('click', () => this.app.sound?.resume(), { once: true });
  }

  setMode(mode) {
    this.currentMode = mode;
    this.modeTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-mode') === mode));

    if (mode === 'inspect') {
      this.app.setCameraPreset('isometric');
      if (this.explodedSlider) this.explodedSlider.value = '0';
      if (this.explodedVal) this.explodedVal.textContent = '0%';
      this.app.engine.setExploded(0);
      this.updateDynoTelemetry(650);
      this.showToast('3D Inspector — click any modeled engine component');
    } else if (mode === 'exploded') {
      this.app.setCameraPreset('isometric');
      if (this.explodedSlider) this.explodedSlider.value = '62';
      if (this.explodedVal) this.explodedVal.textContent = '62%';
      this.app.engine.setExploded(0.62);
      this.showToast('Exploded assembly view — stock subassemblies separated');
    } else if (mode === 'dyno') {
      this.app.setCameraPreset('front');
      if (this.explodedSlider) this.explodedSlider.value = '0';
      if (this.explodedVal) this.explodedVal.textContent = '0%';
      this.app.engine.setExploded(0);
      if (this.throttleSlider) this.throttleSlider.value = '2000';
      this.updateDynoTelemetry(2000);
      this.showToast('Running engine view — OHV valvetrain and rotating assembly synchronized');
    }
  }

  /**
   * Display-only stock curve approximation constrained to the factory rating points.
   * It is not presented as a measured chassis-dyno curve.
   */
  updateDynoTelemetry(rpm) {
    const min = 650;
    const max = 5600;
    const clamped = Math.max(min, Math.min(max, rpm));
    if (this.dynoRpm) this.dynoRpm.textContent = Math.round(clamped).toLocaleString();
    if (this.dynoRpmBar) this.dynoRpmBar.style.width = `${((clamped - min) / (max - min)) * 100}%`;

    let tq;
    if (clamped <= 1000) tq = 160 + (clamped - 650) * 0.18;
    else if (clamped <= 2500) tq = 223 + (clamped - 1000) * (92 / 1500);
    else if (clamped <= 4000) tq = 315 + (clamped - 2500) * (20 / 1500);
    else if (clamped <= 5200) tq = 335 - (clamped - 4000) * (37 / 1200);
    else tq = 298 - (clamped - 5200) * (22 / 400);

    const hp = tq * clamped / 5252;
    const displayHp = clamped === 5200 ? 295 : Math.round(hp);
    const displayTq = clamped === 4000 ? 335 : Math.round(tq);

    if (this.dynoHp) this.dynoHp.textContent = `${displayHp} HP`;
    if (this.dynoTq) this.dynoTq.textContent = `${displayTq} LB-FT`;
    if (this.dynoBoost) this.dynoBoost.textContent = 'N/A • N/A';
    if (this.dynoOil) this.dynoOil.textContent = 'L59 5.3L';
    if (this.dynoLiveTag) {
      this.dynoLiveTag.textContent = clamped <= 750 ? 'IDLE • 650 RPM' : `RUNNING • ${Math.round(clamped).toLocaleString()} RPM`;
      this.dynoLiveTag.classList.toggle('red', clamped > 4500);
    }

    this.app.engine.setRPM(clamped);
    this.app.sound?.updateRPM(clamped);
  }

  updateHoverTooltip(data, clientX, clientY) {
    if (!this.hoverTooltip) return;
    this.hoverTooltip.style.display = 'block';
    this.hoverTooltip.style.left = `${clientX}px`;
    this.hoverTooltip.style.top = `${clientY}px`;
    if (this.ttName) this.ttName.textContent = data.name || 'Engine Component';
    if (this.ttSub) this.ttSub.textContent = `${data.category || '2006 Tahoe 5.3L'} • Click to Inspect`;
  }

  hideHoverTooltip() {
    if (this.hoverTooltip) this.hoverTooltip.style.display = 'none';
  }

  showComponentInspector(data) {
    if (this.inspectorName) this.inspectorName.textContent = data.name || 'Vortec 5300 Component';
    if (this.inspectorCategory) this.inspectorCategory.textContent = (data.category || 'ENGINE ASSEMBLY').toUpperCase();
    if (this.inspectorSpecs) this.inspectorSpecs.textContent = data.specs || '2006 Tahoe 5.3L Gen III specification';
    if (this.inspectorDesc) this.inspectorDesc.textContent = data.description || 'Modeled as part of the stock 2006 Tahoe Vortec 5300 assembly.';
    if (this.inspectorTag) this.inspectorTag.textContent = 'INSPECTED';
  }

  initDefaultInspector() {
    this.showComponentInspector({
      name: 'Gen III 5.3L Cast-Iron Block',
      category: 'Block & Crankcase',
      specs: '3.780 in bore • 4.400 in bore spacing • 9.240 in nominal deck • 90° V8',
      description: 'Deep-skirt L59/LM7-family Vortec 5300 block used by the 2006 Tahoe. The studio defaults to the L59 / VIN-Z FlexFuel identity.'
    });
  }

  takeSnapshot() {
    this.app.renderer.render(this.app.scene, this.app.camera);
    const dataURL = this.app.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `2006_Tahoe_5.3_Vortec_${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    this.showToast('Tahoe 5.3L studio snapshot saved');
  }

  showToast(msg) {
    if (!this.toast || !this.toastMsg) return;
    this.toastMsg.textContent = msg;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toast.classList.remove('show'), 2800);
  }

  update() {}
}
