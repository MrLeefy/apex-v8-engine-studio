import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CAD_MM_TO_SCENE = 1 / 101.6;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

export class ReferenceCadFasteners {
  constructor(engine) {
    this.engine = engine;
    this.loader = new GLTFLoader();
    this.group = new THREE.Group();
    this.group.name = 'STEP_Derived_Reference_Fasteners';
    this.group.userData = {
      geometryTier: 'DIMENSIONALLY_RECONSTRUCTED',
      transformTier: 'REFERENCE_POSITIONED',
      warning: 'Published GM dimensions drive the CAD solids; placement is not claimed as OEM-coordinate verified.'
    };
    this.engine.group.add(this.group);
    this.families = [];
    this.errors = [];
    this.ready = false;
    window.__REFERENCE_FASTENERS__ = this;
  }

  async install() {
    const jobs = [
      this.installHeadBolts(),
      this.installRockerBolts(),
      this.installExhaustManifoldBolts(),
      this.installWaterPumpBolts(),
      this.installBalancerBolt(),
      this.installValleyBolts(),
      this.installWaterPumpInletBolts(),
      this.installCoolantBleedBolts(),
      this.installBlockDrainPlugs(),
      this.installThrottleStuds(),
      this.installExhaustPipeStuds()
    ];
    await Promise.allSettled(jobs);
    this.ready = true;
    const total = this.families.reduce((n, item) => n + item.count, 0);
    console.info(`[CAD fasteners] ${total} STEP-derived hardware instances across ${this.families.length} rendered families; ${this.errors.length} load errors.`);
    return this.report();
  }

  report() {
    return {
      ready: this.ready,
      geometryTier: 'DIMENSIONALLY_RECONSTRUCTED',
      transformTier: 'REFERENCE_POSITIONED',
      familyCount: this.families.length,
      instanceCount: this.families.reduce((n, item) => n + item.count, 0),
      families: this.families.map(item => ({ id: item.id, gmPart: item.gmPart, count: item.count })),
      errors: [...this.errors]
    };
  }

  async loadGeometry(url, id) {
    try {
      const gltf = await this.loader.loadAsync(url);
      let found = null;
      gltf.scene.traverse(obj => {
        if (!found && obj.isMesh && obj.geometry) found = obj;
      });
      if (!found) throw new Error('GLB contains no mesh geometry');
      return found.geometry.clone();
    } catch (error) {
      this.errors.push({ id, path: url, message: error.message });
      throw error;
    }
  }

  async createFamily(options) {
    const id = options.id;
    const gmPart = options.gmPart;
    const url = options.path;
    const placements = options.placements || [];
    const material = options.material || this.engine.matSteel;
    const parent = options.parent || this.group;
    const geometry = await this.loadGeometry(url, id);
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    mesh.name = `CAD_Fasteners_${id}_${gmPart}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      name: `${id.replaceAll('_', ' ')} — STEP-derived family`,
      category: 'CAD-derived fasteners',
      specs: `GM ${gmPart} • ${placements.length} instances • generated OpenCascade B-rep`,
      description: 'Real helical-thread CAD geometry driven by published GM nominal dimensions. Assembly positions are reference-registered, not OEM-coordinate verified.',
      gmPart,
      geometryTier: 'DIMENSIONALLY_RECONSTRUCTED',
      transformTier: 'REFERENCE_POSITIONED'
    };

    const scale = new THREE.Vector3(CAD_MM_TO_SCENE, CAD_MM_TO_SCENE, CAD_MM_TO_SCENE);
    const matrix = new THREE.Matrix4();
    placements.forEach((placement, index) => {
      const q = placement.quaternion || quaternionTo(placement.axis || Z_AXIS);
      matrix.compose(placement.position, q, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
    this.engine.inspectableParts.push(mesh);
    this.families.push({ id, gmPart, count: placements.length, mesh });
    return mesh;
  }

  async installHeadBolts() {
    const longPath = '/cad/19258707-head-bolt-long.glb';
    const shortPath = '/cad/12558840-head-bolt-short.glb';
    for (const bank of ['L', 'R']) {
      const head = bank === 'L' ? this.engine.subassemblies.leftHead : this.engine.subassemblies.rightHead;
      if (!head) continue;
      const longPlacements = [];
      const shortPlacements = [];
      for (const z of [-2.0, -1.0, 0, 1.0, 2.0]) {
        for (const x of [-0.43, 0.43]) {
          longPlacements.push(localBolt(new THREE.Vector3(x, 0.02, z), new THREE.Vector3(0, 1, 0)));
        }
      }
      for (const z of [-1.95, -0.98, 0, 0.98, 1.95]) {
        shortPlacements.push(localBolt(new THREE.Vector3(0.62, 0.12, z), new THREE.Vector3(0, 1, 0)));
      }
      await this.createFamily({ id: `head_bolt_long_${bank}`, gmPart: '19258707', path: longPath, parent: head, placements: longPlacements });
      await this.createFamily({ id: `head_bolt_short_${bank}`, gmPart: '12558840', path: shortPath, parent: head, placements: shortPlacements });
    }
  }

  async installRockerBolts() {
    const placements = [];
    for (const event of this.engine.valveEvents || []) {
      for (const rocker of event.rockers || []) {
        const axis = event.axis.vec.clone().normalize();
        placements.push(localBolt(rocker.group.position.clone().addScaledVector(axis, -0.22), axis));
      }
    }
    return this.createFamily({ id: 'rocker_bolt', gmPart: '12560961', path: '/cad/12560961-rocker-bolt.glb', placements });
  }

  async installExhaustManifoldBolts() {
    const placements = [];
    const deck = this.engine.spec.geometry.deckHeightNominalIn / this.engine.spec.scene.inchesPerUnit;
    for (const bank of ['L', 'R']) {
      const bankAxis = this.engine.axisForBank(bank).vec.clone().normalize();
      const tangent = new THREE.Vector3(-bankAxis.y, bankAxis.x, 0);
      const exhaustOut = tangent.multiplyScalar(bank === 'L' ? 1 : -1).normalize();
      for (const z of [-1.92, -1.16, -0.38, 0.38, 1.16, 1.92]) {
        const base = bankAxis.clone().multiplyScalar(deck + 0.35)
          .addScaledVector(exhaustOut, 0.48)
          .add(new THREE.Vector3(0, 0, z));
        base.addScaledVector(exhaustOut, -0.18);
        placements.push(localBolt(base, exhaustOut));
      }
    }
    return this.createFamily({ id: 'exhaust_manifold_bolt', gmPart: '11546600', path: '/cad/11546600-exhaust-bolt.glb', placements });
  }

  async installWaterPumpBolts() {
    const stations = [
      [-0.63, 0.56], [-0.43, 1.12], [-0.18, 0.33],
      [0.18, 0.33], [0.43, 1.12], [0.63, 0.56]
    ];
    const tipZ = -2.80 + 83 / 101.6;
    const placements = stations.map(([x, y]) => localBolt(new THREE.Vector3(x, y, tipZ), new THREE.Vector3(0, 0, -1)));
    return this.createFamily({ id: 'water_pump_bolt', gmPart: '12551926', path: '/cad/12551926-water-pump-bolt.glb', placements });
  }

  async installBalancerBolt() {
    const tipZ = -3.16 + 103 / 101.6;
    return this.createFamily({
      id: 'crank_balancer_bolt',
      gmPart: '12557840',
      path: '/cad/12557840-balancer-bolt.glb',
      placements: [localBolt(new THREE.Vector3(0, -0.66, tipZ), new THREE.Vector3(0, 0, -1))]
    });
  }

  async installValleyBolts() {
    const placements = [];
    for (const x of [-0.42, 0.42]) {
      for (const z of [-1.78, -0.89, 0, 0.89, 1.78]) {
        placements.push(localBolt(new THREE.Vector3(x, 1.12, z), new THREE.Vector3(0, 1, 0)));
      }
    }
    return this.createFamily({ id: 'valley_cover_bolt', gmPart: '11515758', path: '/cad/11515758-valley-cover-bolt.glb', placements });
  }

  async installWaterPumpInletBolts() {
    return this.createFamily({
      id: 'water_pump_inlet_bolt',
      gmPart: '11516480',
      path: '/cad/11516480-water-pump-inlet-bolt.glb',
      placements: [
        localBolt(new THREE.Vector3(-0.73, 0.43, -2.59), new THREE.Vector3(0, 0, -1)),
        localBolt(new THREE.Vector3(-0.45, 0.25, -2.59), new THREE.Vector3(0, 0, -1))
      ]
    });
  }

  async installCoolantBleedBolts() {
    const placements = [
      [-0.62, 1.33, -1.76], [0.62, 1.33, -1.76],
      [-0.62, 1.33, 1.54], [0.62, 1.33, 1.54]
    ].map(coords => localBolt(new THREE.Vector3(...coords), new THREE.Vector3(0, 1, 0)));
    return this.createFamily({ id: 'coolant_bleed_pipe_bolt', gmPart: '11514008', path: '/cad/11514008-coolant-bleed-bolt.glb', placements });
  }

  async installBlockDrainPlugs() {
    return this.createFamily({
      id: 'block_coolant_drain_plug',
      gmPart: '11588949',
      path: '/cad/11588949-block-drain-plug.glb',
      placements: [
        localBolt(new THREE.Vector3(-1.42, 0.18, 0.78), new THREE.Vector3(-1, 0, 0)),
        localBolt(new THREE.Vector3(1.42, 0.18, 0.78), new THREE.Vector3(1, 0, 0))
      ]
    });
  }

  async installThrottleStuds() {
    const intake = this.engine.subassemblies.intakePlenum || this.group;
    const placements = [
      [-0.27, 2.30, -2.02], [0.27, 2.30, -2.02], [0, 2.72, -2.02]
    ].map(coords => localBolt(new THREE.Vector3(...coords), new THREE.Vector3(0, 0, -1)));
    return this.createFamily({ id: 'throttle_body_stud', gmPart: '89017691', path: '/cad/89017691-throttle-body-stud.glb', parent: intake, placements });
  }

  async installExhaustPipeStuds() {
    const placements = [];
    for (const side of [-1, 1]) {
      const center = new THREE.Vector3(side * 2.25, 0.91, 1.62);
      const axis = new THREE.Vector3(side * 0.25, -0.92, 0.30).normalize();
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2;
        const radial = new THREE.Vector3(0, Math.cos(a) * 0.16, Math.sin(a) * 0.16);
        placements.push(localBolt(center.clone().add(radial).addScaledVector(axis, -0.16), axis));
      }
    }
    return this.createFamily({ id: 'exhaust_pipe_stud', gmPart: '11589264', path: '/cad/11589264-exhaust-pipe-stud.glb', placements });
  }
}

function quaternionTo(axis) {
  return new THREE.Quaternion().setFromUnitVectors(Z_AXIS, axis.clone().normalize());
}

function localBolt(position, axis) {
  return { position, axis: axis.clone().normalize() };
}
