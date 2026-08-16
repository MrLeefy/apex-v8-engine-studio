import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { SoundEngine } from './soundEngine.js';
import { EngineModel } from './engineModel.js';
import { UIController } from './uiController.js';
import { ThreeDebugBridge } from './threeDebugBridge.js';

/**
 * Main Application Bootstrap for Apex-V8 Twin-Turbo Engine Studio & Dyno Simulator.
 * Features:
 * - Standalone photorealistic 3D V8 engine with zero-clipping slider-crank kinematics
 * - 360° Studio Orbit, Turntable lighting, and macro inspection viewports
 * - Interactive mouse raycaster for real-time component inspection tooltips
 * - Exploded view assembly slider (0 - 100%)
 * - Translucent Ghost X-Ray cutaway mode
 * - Dyno revving bench with throttle synthesis, nitrous boost, and exhaust combustion flames
 */
class App {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // Core Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = new THREE.Clock();

    // Subsystems
    this.sound = null;
    this.engine = null;
    this.ui = null;

    // Interactive Raycaster for Engine Component Inspection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredMesh = null;
    this.selectedMesh = null;

    // Studio Lighting
    this.keyLight = null;
    this.rimLight = null;
    this.underglowLight = null;
    this.turntable = null;

    // Camera control states
    this.cameraMode = 'orbit';
    this.camTargetPos = new THREE.Vector3(7.5, 4.5, 7.5);
    this.camLookAtTarget = new THREE.Vector3(0, 0.5, 0);

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
    this.scene.fog = new THREE.FogExp2(0x080a10, 0.015);
    
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.05, 120);
    this.camera.position.set(7.5, 4.5, 7.5);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.appendChild(this.renderer.domElement);

    // Generate a neutral studio environment map for metal reflections
    this.generateStudioEnvironment();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minPolarAngle = 0.05;           // Can look from nearly straight above
    this.controls.maxPolarAngle = Math.PI - 0.05; // Can look from nearly straight below
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 25.0;
    this.controls.target.set(0, 0.5, 0);
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.6;
    this.controls.rotateSpeed = 0.9;
    this.controls.zoomSpeed = 1.2;

    // Track whether we're animating to a preset
    this.isAnimatingPreset = false;
    this.presetLerpProgress = 0;
  }

  generateStudioEnvironment() {
    // Create a simple procedural studio environment cube map for metal reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x111520);
    
    // Warm overhead panel
    const topLight = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe8d0, side: THREE.DoubleSide })
    );
    topLight.position.y = 8;
    topLight.rotation.x = Math.PI / 2;
    envScene.add(topLight);

    // Cool side reflectors
    const sideL = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 6),
      new THREE.MeshBasicMaterial({ color: 0xd0e8ff, side: THREE.DoubleSide })
    );
    sideL.position.set(-6, 2, 0);
    sideL.rotation.y = Math.PI / 2;
    envScene.add(sideL);

    const sideR = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 6),
      new THREE.MeshBasicMaterial({ color: 0xe0e8f0, side: THREE.DoubleSide })
    );
    sideR.position.set(6, 2, 0);
    sideR.rotation.y = -Math.PI / 2;
    envScene.add(sideR);

    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    this.scene.environment = envMap;
    pmremGenerator.dispose();
  }

  initLightingAndStudio() {
    // Soft hemisphere ambient fill (warm sky / cool ground)
    const hemiLight = new THREE.HemisphereLight(0xeee8dc, 0x0a0c14, 0.6);
    this.scene.add(hemiLight);

    // Key Light: Warm directional (simulates large overhead studio softbox)
    this.keyLight = new THREE.DirectionalLight(0xfff5e6, 2.8);
    this.keyLight.position.set(6, 12, 5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 4096;
    this.keyLight.shadow.mapSize.height = 4096;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 30.0;
    const d = 8;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0002;
    this.keyLight.shadow.normalBias = 0.02;
    this.keyLight.shadow.radius = 2;
    this.scene.add(this.keyLight);

    // Fill Light: Cooler, dimmer directional from opposite side
    const fillLight = new THREE.DirectionalLight(0xd0e0f0, 1.2);
    fillLight.position.set(-8, 6, -4);
    this.scene.add(fillLight);

    // Rim/Back Light: Cool edge separation light
    this.rimLight = new THREE.DirectionalLight(0xc8ddf0, 1.5);
    this.rimLight.position.set(-4, 8, -10);
    this.scene.add(this.rimLight);

    // Subtle warm bounce from below (simulates floor reflections, NOT garish underglow)
    this.underglowLight = new THREE.PointLight(0xffe0c0, 0.4, 8);
    this.underglowLight.position.set(0, -1.0, 0);
    this.scene.add(this.underglowLight);

    // Small accent spot from front-low to catch metallic specular highlights
    const accentSpot = new THREE.SpotLight(0xffffff, 1.5, 15, Math.PI / 8, 0.6, 1);
    accentSpot.position.set(3, 0.5, -5);
    accentSpot.target.position.set(0, 0.5, 0);
    this.scene.add(accentSpot);
    this.scene.add(accentSpot.target);

    // Circular CNC Billet Turntable Stand
    const turntableGroup = new THREE.Group();
    const standGeom = new THREE.CylinderGeometry(4.2, 4.4, 0.35, 64);
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x151821,
      metalness: 0.85,
      roughness: 0.35
    });
    this.turntable = new THREE.Mesh(standGeom, standMat);
    this.turntable.position.y = -1.65;
    this.turntable.receiveShadow = true;
    turntableGroup.add(this.turntable);

    // Glowing Beveled Edge Ring
    const ringGeom = new THREE.TorusGeometry(4.22, 0.03, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.48;
    turntableGroup.add(ring);

    // Dark Studio Floor
    const floorGeom = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x07080b,
      roughness: 0.9,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.66;
    floor.receiveShadow = true;
    turntableGroup.add(floor);

    // Grid Markings
    const grid = new THREE.GridHelper(30, 30, 0x00d2ff, 0x161c28);
    grid.position.y = -1.64;
    turntableGroup.add(grid);

    this.scene.add(turntableGroup);
  }

  initSubsystems() {
    this.sound = new SoundEngine();
    this.engine = new EngineModel();
    this.scene.add(this.engine.group);
    this.ui = new UIController(this);
    this.debugBridge = new ThreeDebugBridge(this);
  }

  initEventListeners() {
    window.addEventListener('resize', () => this.onResize());

    // Mouse Raycasting on Engine Parts
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('click', (e) => this.onClick(e));
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

    if (intersects.length > 0) {
      const topHit = intersects[0].object;
      if (topHit.userData && topHit.userData.name) {
        document.body.style.cursor = 'pointer';
        this.hoveredMesh = topHit;
        if (this.ui) {
          this.ui.updateHoverTooltip(topHit.userData, e.clientX, e.clientY);
        }
        return;
      }
    }

    document.body.style.cursor = 'default';
    this.hoveredMesh = null;
    if (this.ui) {
      this.ui.hideHoverTooltip();
    }
  }

  onClick(e) {
    if (this.hoveredMesh && this.hoveredMesh.userData && this.ui) {
      this.selectedMesh = this.hoveredMesh;
      this.ui.showComponentInspector(this.hoveredMesh.userData);
      this.sound.playClick();
    }
  }

  setCameraPreset(preset) {
    this.cameraMode = preset;
    this.isAnimatingPreset = true;
    this.presetLerpProgress = 0;

    if (preset === 'isometric') {
      this.camTargetPos.set(7.0, 4.2, 7.0);
      this.camLookAtTarget.set(0, 0.4, 0);
    } else if (preset === 'front') {
      this.camTargetPos.set(0, 1.2, -6.5);
      this.camLookAtTarget.set(0, 0.5, 0);
    } else if (preset === 'top') {
      this.camTargetPos.set(0, 8.5, 0.2);
      this.camLookAtTarget.set(0, 0.4, 0);
    } else if (preset === 'side') {
      this.camTargetPos.set(-6.8, 1.5, 0.4);
      this.camLookAtTarget.set(0, 0.4, 0);
    } else if (preset === 'macro') {
      this.camTargetPos.set(-2.2, 2.2, 1.8);
      this.camLookAtTarget.set(-1.0, 1.25, 0.45);
    } else if (preset === 'rear') {
      this.camTargetPos.set(0, 1.2, 6.5);
      this.camLookAtTarget.set(0, 0.4, 0);
    }
  }

  setUnderglowColor(hex) {
    if (this.underglowLight) {
      this.underglowLight.color.setHex(hex);
    }
  }

  toggleWireframe(enabled) {
    this.scene.traverse(child => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.wireframe = enabled);
        } else {
          child.material.wireframe = enabled;
        }
      }
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.engine) {
      this.engine.update(delta);
    }

    if (this.ui) {
      this.ui.update(delta);
    }

    // Only lerp camera during preset transitions, then hand control back to user
    if (this.isAnimatingPreset) {
      this.presetLerpProgress += delta * 3.0;
      const t = Math.min(this.presetLerpProgress, 1.0);
      this.camera.position.lerp(this.camTargetPos, t * 0.12);
      this.controls.target.lerp(this.camLookAtTarget, t * 0.12);
      if (this.presetLerpProgress >= 1.0) {
        this.isAnimatingPreset = false;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});
