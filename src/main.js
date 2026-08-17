import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SoundEngine } from './soundEngine.js';
import { EngineModel } from './engineModel.js';
import { UIController } from './uiController.js';
import { ThreeDebugBridge } from './threeDebugBridge.js';
import { CadAssetOverlay } from './cad/CadAssetOverlay.js';
import { installGmt800ReferenceFrontDrive } from './cad/Gmt800ReferenceFrontDrive.js';
import { refineGmt800FrontDrive } from './cad/Gmt800FrontDriveRefinement.js';

/**
 * 2006 Chevrolet Tahoe 5.3L Vortec 5300 interactive engine studio.
 * The scene is centered on the real Gen III pushrod engine model and supports
 * orbit inspection, exploded assembly, translucent cutaway and synchronized
 * crank/piston/valvetrain animation.
 *
 * CAD strategy:
 * - EngineModel is the mechanically/dimensionally grounded procedural fallback.
 * - The GMT800-specific reference front drive corrects the generic accessory layout.
 * - The OE-photo refinement fixes shared generator/P.S. bracket topology and routing.
 * - CadAssetOverlay loads provenance-verified CAD-derived parts when available.
 * - A third-party mesh can never silently replace the fallback as "OEM CAD".
 */
class App {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = new THREE.Clock();
    this.sound = null;
    this.engine = null;
    this.ui = null;
    this.debugBridge = null;
    this.cadOverlay = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredMesh = null;
    this.selectedMesh = null;
    this.keyLight = null;
    this.rimLight = null;
    this.underglowLight = null;
    this.turntable = null;
    this.cameraMode = 'orbit';
    this.camTargetPos = new THREE.Vector3(7.2, 4.6, 7.2);
    this.camLookAtTarget = new THREE.Vector3(0, 0.65, 0);
    this.isAnimatingPreset = false;
    this.presetLerpProgress = 0;
    this.init();
  }

  init() {
    this.initScene();
    this.initLightingAndStudio();
    this.initSubsystems();
    this.initEventListeners();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080a10);
    this.scene.fog = new THREE.FogExp2(0x080a10, 0.013);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.05, 120);
    this.camera.position.set(7.2, 4.6, 7.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.generateStudioEnvironment();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minPolarAngle = 0.04;
    this.controls.maxPolarAngle = Math.PI - 0.04;
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 28;
    this.controls.target.set(0, 0.65, 0);
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.6;
    this.controls.rotateSpeed = 0.9;
    this.controls.zoomSpeed = 1.2;
  }

  generateStudioEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x111520);

    const top = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: 0xffead6, side: THREE.DoubleSide }));
    top.position.y = 8;
    top.rotation.x = Math.PI / 2;
    env.add(top);

    const left = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshBasicMaterial({ color: 0xd6e8ff, side: THREE.DoubleSide }));
    left.position.set(-6, 2, 0);
    left.rotation.y = Math.PI / 2;
    env.add(left);

    const right = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshBasicMaterial({ color: 0xe8edf3, side: THREE.DoubleSide }));
    right.position.set(6, 2, 0);
    right.rotation.y = -Math.PI / 2;
    env.add(right);

    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
  }

  initLightingAndStudio() {
    this.scene.add(new THREE.HemisphereLight(0xeee8dc, 0x0a0c14, 0.65));

    this.keyLight = new THREE.DirectionalLight(0xfff5e6, 2.7);
    this.keyLight.position.set(6, 12, 5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(4096, 4096);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 32;
    this.keyLight.shadow.camera.left = -8;
    this.keyLight.shadow.camera.right = 8;
    this.keyLight.shadow.camera.top = 8;
    this.keyLight.shadow.camera.bottom = -8;
    this.keyLight.shadow.bias = -0.0002;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const fill = new THREE.DirectionalLight(0xd0e0f0, 1.15);
    fill.position.set(-8, 6, -4);
    this.scene.add(fill);

    this.rimLight = new THREE.DirectionalLight(0xc8ddf0, 1.45);
    this.rimLight.position.set(-4, 8, -10);
    this.scene.add(this.rimLight);

    this.underglowLight = new THREE.PointLight(0xffe0c0, 0.35, 9);
    this.underglowLight.position.set(0, -1.25, 0);
    this.scene.add(this.underglowLight);

    const accent = new THREE.SpotLight(0xffffff, 1.35, 15, Math.PI / 8, 0.6, 1);
    accent.position.set(3, 0.7, -5);
    accent.target.position.set(0, 0.7, 0);
    this.scene.add(accent, accent.target);

    const standGroup = new THREE.Group();
    const standMat = new THREE.MeshStandardMaterial({ color: 0x151821, metalness: 0.85, roughness: 0.35 });
    this.turntable = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.45, 0.35, 64), standMat);
    this.turntable.position.y = -1.95;
    this.turntable.receiveShadow = true;
    standGroup.add(this.turntable);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.27, 0.03, 16, 64), new THREE.MeshBasicMaterial({ color: 0x00d2ff }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.77;
    standGroup.add(ring);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: 0.9, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.97;
    floor.receiveShadow = true;
    standGroup.add(floor);

    const grid = new THREE.GridHelper(30, 30, 0x00d2ff, 0x161c28);
    grid.position.y = -1.76;
    standGroup.add(grid);
    this.scene.add(standGroup);
  }

  initSubsystems() {
    this.sound = new SoundEngine();
    this.engine = new EngineModel();

    // Replace the old generic front dress, then refine it against genuine GM
    // bracket imagery and a real GMT800 Tahoe front-engine reference.
    installGmt800ReferenceFrontDrive(this.engine);
    refineGmt800FrontDrive(this.engine);

    // EngineModel.registerPart currently owns inspector metadata. Preserve the
    // engineering belt identities explicitly after registration so the audit
    // and CAD handoff retain the actual GMT800 two-drive contract.
    if (this.engine.serpentineBelt) {
      this.engine.serpentineBelt.userData.belt = {
        ribs: 6,
        gmPart: '12637202/12637204',
        catalogLengthMm: '2345 or 2365 depending equipment code',
        drives: ['crank', 'water pump/fan', 'generator', 'power steering', 'idler', 'main tensioner']
      };
    }
    if (this.engine.acDriveBelt) {
      this.engine.acDriveBelt.userData.belt = {
        ribs: 4,
        gmPart: '12576447',
        catalogLengthMm: 960,
        drives: ['crank inner sheave', 'A/C compressor', 'A/C tensioner']
      };
    }

    this.scene.add(this.engine.group);

    // CAD-derived geometry is additive/replacement-by-proof. Missing assets do
    // not break the studio, while verified CAD can replace procedural groups.
    this.cadOverlay = new CadAssetOverlay(this);
    this.cadOverlay.loadAvailable().catch(error => console.warn('[CAD] overlay load failed', error));

    this.ui = new UIController(this);
    this.debugBridge = new ThreeDebugBridge(this);

    window.__CAD_REPORT__ = () => this.cadOverlay?.getReport();
  }

  initEventListeners() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('mousemove', e => this.onMouseMove(e));
    window.addEventListener('click', e => this.onClick(e));
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  onMouseMove(e) {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (!this.engine) return;

    const intersects = this.raycaster.intersectObjects(this.engine.inspectableParts, true);
    if (intersects.length) {
      const hit = intersects[0].object;
      if (hit.userData?.name) {
        document.body.style.cursor = 'pointer';
        this.hoveredMesh = hit;
        this.ui?.updateHoverTooltip(hit.userData, e.clientX, e.clientY);
        return;
      }
    }
    document.body.style.cursor = 'default';
    this.hoveredMesh = null;
    this.ui?.hideHoverTooltip();
  }

  onClick() {
    if (!this.hoveredMesh?.userData || !this.ui) return;
    this.selectedMesh = this.hoveredMesh;
    this.ui.showComponentInspector(this.hoveredMesh.userData);
    this.sound?.playClick();
  }

  setCameraPreset(preset) {
    this.cameraMode = preset;
    this.isAnimatingPreset = true;
    this.presetLerpProgress = 0;

    const presets = {
      isometric: [[7.2, 4.6, 7.2], [0, 0.65, 0]],
      front: [[0, 1.35, -7.0], [0, 0.55, -0.35]],
      top: [[0, 8.5, 0.2], [0, 1.25, 0]],
      side: [[-7.2, 1.65, 0.5], [-0.45, 0.85, 0]],
      macro: [[-3.0, 1.35, -0.8], [-0.85, 0.75, -0.55]],
      rear: [[0, 1.2, 7.0], [0, 0.35, 1.35]]
    };
    const [pos, target] = presets[preset] || presets.isometric;
    this.camTargetPos.set(...pos);
    this.camLookAtTarget.set(...target);
  }

  setUnderglowColor(hex) {
    this.underglowLight?.color.setHex(hex);
  }

  toggleWireframe(enabled) {
    this.scene.traverse(child => {
      if (!child.isMesh || !child.material) return;
      if (Array.isArray(child.material)) child.material.forEach(m => { m.wireframe = enabled; });
      else child.material.wireframe = enabled;
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.engine?.update(delta);
    this.ui?.update(delta);

    if (this.isAnimatingPreset) {
      this.presetLerpProgress += delta * 3;
      const t = Math.min(this.presetLerpProgress, 1);
      this.camera.position.lerp(this.camTargetPos, t * 0.12);
      this.controls.target.lerp(this.camLookAtTarget, t * 0.12);
      if (this.presetLerpProgress >= 1) this.isAnimatingPreset = false;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => new App());
