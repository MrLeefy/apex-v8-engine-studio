import * as THREE from 'three';
import { TextureGenerator } from './textures.js';
import { TAHOE_53, inch, mm } from './tahoe53Specs.js';

const PI2 = Math.PI * 2;
const PI4 = Math.PI * 4;
const DEG = Math.PI / 180;

/**
 * Procedural 2006 Chevrolet Tahoe 5.3L Vortec 5300 engine.
 *
 * This is intentionally NOT the old fictional 5.0L DOHC twin-turbo engine.
 * The model follows the Gen III LM7/L59 truck-engine architecture:
 * - 90° iron-block V8, 96 mm bore x 92 mm stroke
 * - single in-block camshaft, hydraulic roller lifters, pushrods, 16 valves
 * - cathedral-port aluminum heads, composite truck intake, 78 mm ETC throttle
 * - stock cast exhaust manifolds, coil-near-plug ignition
 * - crank-driven gerotor oil pump, timing chain, truck accessory drive
 *
 * Scene scale is dimensional: 1 Three.js unit = 4 real inches.
 */
export class EngineModel {
  constructor() {
    this.spec = TAHOE_53;
    this.group = new THREE.Group();
    this.group.name = '2006_Tahoe_5.3L_Vortec_5300_L59_LM7';

    this.inspectableParts = [];
    this.explodables = [];
    this.xrayMaterials = [];
    this.pistons = [];
    this.valveEvents = [];
    this.pulleys = [];
    this.camshafts = [];
    this.valves = [];
    this.turbos = []; // compatibility: intentionally empty on this naturally aspirated engine
    this.exhaustHeaders = [];

    this.crankAngle = 0;
    this.rpm = 650;
    this.isRevving = false;
    this.explodeFactor = 0;
    this.isXRay = false;

    this.subassemblies = {
      block: null,
      oilPan: null,
      crankGroup: null,
      leftHead: null,
      rightHead: null,
      leftValveCover: null,
      rightValveCover: null,
      intakePlenum: null,
      leftTurbo: null,
      rightTurbo: null,
      leftExhaust: null,
      rightExhaust: null,
      frontDrive: null,
      oilFilter: null,
      starterMotor: null,
      fuelSystem: null,
      plumbing: null,
      ignition: null,
      valvetrain: null
    };

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
    this._yAxis = new THREE.Vector3(0, 1, 0);

    this.initMaterials();
    this.buildEngine();
  }

  initMaterials() {
    this.texCasting = TextureGenerator.createCastingGrainTexture();
    this.texBrushed = TextureGenerator.createBrushedMetalTexture();
    this.texBelt = TextureGenerator.createBeltGrooveTexture();

    this.matIron = new THREE.MeshStandardMaterial({ color: 0x34373a, metalness: 0.65, roughness: 0.72, bumpMap: this.texCasting, bumpScale: 0.018, name: 'GenIII_CastIronBlock' });
    this.matHead = new THREE.MeshStandardMaterial({ color: 0xaeb4b8, metalness: 0.72, roughness: 0.48, bumpMap: this.texCasting, bumpScale: 0.01, name: '356T6_AluminumHead' });
    this.matAluminum = new THREE.MeshStandardMaterial({ color: 0xb9bec3, metalness: 0.82, roughness: 0.34, bumpMap: this.texBrushed, bumpScale: 0.005, name: 'CastAluminum' });
    this.matSteel = new THREE.MeshStandardMaterial({ color: 0x70777d, metalness: 0.94, roughness: 0.28, name: 'NodularIronSteel' });
    this.matJournal = new THREE.MeshStandardMaterial({ color: 0xc7cdd1, metalness: 0.98, roughness: 0.14, name: 'MachinedJournal' });
    this.matPiston = new THREE.MeshStandardMaterial({ color: 0xc9cdd0, metalness: 0.78, roughness: 0.31, name: 'CastAluminumPiston' });
    this.matComposite = new THREE.MeshStandardMaterial({ color: 0x17191a, metalness: 0.02, roughness: 0.79, name: 'BlackCompositeNylon' });
    this.matRubber = new THREE.MeshStandardMaterial({ color: 0x111212, metalness: 0.01, roughness: 0.92, bumpMap: this.texBelt, bumpScale: 0.015, name: 'EPDMRubber' });
    this.matGasket = new THREE.MeshStandardMaterial({ color: 0x686b6c, metalness: 0.45, roughness: 0.55, name: 'MLS_Gasket' });
    this.matCopper = new THREE.MeshStandardMaterial({ color: 0xb57545, metalness: 0.78, roughness: 0.31, name: 'CopperWinding' });
    this.matPorcelain = new THREE.MeshStandardMaterial({ color: 0xf2efe8, metalness: 0.03, roughness: 0.21, name: 'SparkPlugCeramic' });
    this.matConnector = new THREE.MeshStandardMaterial({ color: 0x303233, metalness: 0.03, roughness: 0.72, name: 'ElectricalConnector' });
    this.matFuelRail = new THREE.MeshStandardMaterial({ color: 0x999fa3, metalness: 0.88, roughness: 0.26, name: 'FuelRail' });
    this.matInjector = new THREE.MeshStandardMaterial({ color: 0x2b2d2e, metalness: 0.1, roughness: 0.55, name: 'FuelInjector' });
    this.matExhaust = new THREE.MeshStandardMaterial({ color: 0x58534c, metalness: 0.58, roughness: 0.84, bumpMap: this.texCasting, bumpScale: 0.02, name: 'CastNodularIronExhaust' });
    this.matHeader = this.matExhaust; // compatibility with older dyno UI
    this.matBelt = this.matRubber;
    this.matYellow = new THREE.MeshStandardMaterial({ color: 0xd9aa16, metalness: 0.08, roughness: 0.45, name: 'ServiceYellow' });
    this.matRed = new THREE.MeshStandardMaterial({ color: 0xa8231f, metalness: 0.15, roughness: 0.44, name: 'ConnectorSealRed' });

    this.xrayMaterials.push(this.matIron, this.matHead, this.matComposite, this.matAluminum, this.matExhaust);
  }

  registerPart(mesh, metadata) {
    mesh.userData = { ...metadata, engine: '2006 Chevrolet Tahoe 5.3L Vortec 5300' };
    this.inspectableParts.push(mesh);
    return mesh;
  }

  meta(name, category, specs, description) {
    return { name, category, specs, description };
  }

  rememberExplode(group, vector) {
    group.userData.explodeBase = group.position.clone();
    group.userData.explodeVector = vector.clone();
    this.explodables.push(group);
  }

  box(w, h, d, mat, pos = null, name = '') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    if (pos) mesh.position.copy(pos);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  cyl(r, h, mat, pos = null, radial = 32, name = '') {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, radial), mat);
    if (pos) mesh.position.copy(pos);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  bolt(radius, length, mat = this.matSteel) {
    const g = new THREE.Group();
    const shank = this.cyl(radius * 0.55, length, mat, null, 12);
    const head = this.cyl(radius, radius * 0.65, mat, new THREE.Vector3(0, length * 0.5, 0), 6);
    g.add(shank, head);
    return g;
  }

  tube(points, radius, material, segments = 28, radial = 10, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.35);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, radial, closed), material);
    mesh.castShadow = true;
    return mesh;
  }

  orientUnitCylinder(mesh, a, b) {
    this._tmpDir.subVectors(b, a);
    const len = this._tmpDir.length();
    if (len < 1e-5) return;
    this._tmpDir.multiplyScalar(1 / len);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(this._yAxis, this._tmpDir);
    mesh.scale.set(1, len, 1);
  }

  axisForBank(bank) {
    const angle = bank === 'L' ? 135 * DEG : 45 * DEG;
    return { angle, vec: new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0), rotationZ: angle - Math.PI / 2 };
  }

  cylinderZ(bank, index) {
    const spacing = inch(this.spec.geometry.boreSpacingIn);
    const offset = inch(this.spec.geometry.cylinderBankOffsetIn);
    const front = -1.65;
    return front + index * spacing + (bank === 'L' ? -offset * 0.5 : offset * 0.5);
  }

  journalZ(index) {
    return -1.65 + index * inch(this.spec.geometry.boreSpacingIn);
  }

  buildEngine() {
    this.buildBlockAndOilPan();
    this.buildCrankAndPistons();
    this.buildCamTimingAndOilPump();
    this.buildHeadsAndValvetrain();
    this.buildIntakeAndFuel();
    this.buildIgnition();
    this.buildStockExhaust();
    this.buildFrontAccessoryDrive();
    this.buildAccessoriesAndSensors();
    this.buildPlumbingAndHarness();
    this.setRPM(650);
  }

  // ---------------------------------------------------------------------------
  // BLOCK / PAN
  // ---------------------------------------------------------------------------
  buildBlockAndOilPan() {
    const block = new THREE.Group();
    block.name = 'GenIII_5.3_CastIron_Block';

    const shape = new THREE.Shape();
    shape.moveTo(-1.34, -0.72);
    shape.lineTo(1.34, -0.72);
    shape.lineTo(1.49, 0.45);
    shape.lineTo(2.03, 1.38);
    shape.lineTo(1.66, 1.78);
    shape.lineTo(0.63, 1.28);
    shape.quadraticCurveTo(0, 1.02, -0.63, 1.28);
    shape.lineTo(-1.66, 1.78);
    shape.lineTo(-2.03, 1.38);
    shape.lineTo(-1.49, 0.45);
    shape.closePath();

    const length = 4.62;
    const casting = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
      depth: length,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.045,
      bevelThickness: 0.045
    }), this.matIron);
    casting.position.z = -length / 2;
    casting.castShadow = true;
    casting.receiveShadow = true;
    block.add(casting);
    this.registerPart(casting, this.meta(
      'Gen III 5.3L Deep-Skirt Cast-Iron Block',
      'Block & Crankcase',
      'L59/LM7 • 9.240 in nominal deck • 4.400 in bore spacing • six-bolt-main architecture',
      'Factory-style iron Vortec 5300 block. Unlike the previous model, this is not an aluminum racing block.'
    ));

    // Dimensional cylinder bores: 3.780 in nominal, 4.400 in spacing.
    const boreRadius = inch(this.spec.geometry.boreIn) / 2;
    const sleeveHeight = inch(7.0);
    for (const bank of ['L', 'R']) {
      const bankAxis = this.axisForBank(bank);
      for (let i = 0; i < 4; i++) {
        const bore = new THREE.Mesh(new THREE.CylinderGeometry(boreRadius, boreRadius, sleeveHeight, 36, 1, true), this.matJournal);
        bore.rotation.z = bankAxis.rotationZ;
        const centerDist = inch(5.55);
        bore.position.set(bankAxis.vec.x * centerDist, bankAxis.vec.y * centerDist, this.cylinderZ(bank, i));
        block.add(bore);
        this.registerPart(bore, this.meta(
          `Cylinder ${bank === 'L' ? [1, 3, 5, 7][i] : [2, 4, 6, 8][i]} Bore`,
          'Block & Crankcase',
          '96.0–96.018 mm service bore diameter',
          'Cylinder centerline placed from published 4.400-in bore spacing and Gen III bank offset.'
        ));
      }
    }

    // Five main cap locations and horizontal cross-bolts.
    for (let i = 0; i < 5; i++) {
      const z = -2.17 + i * 1.08;
      const cap = this.box(1.45, 0.24, 0.28, this.matSteel, new THREE.Vector3(0, -0.48, z), `MainCap_${i + 1}`);
      block.add(cap);
      for (const x of [-1.42, 1.42]) {
        const sideBolt = this.bolt(0.075, 0.26, this.matSteel);
        sideBolt.rotation.z = Math.PI / 2;
        sideBolt.position.set(x, -0.45, z);
        block.add(sideBolt);
      }
    }

    // Core plugs along both sides.
    for (const x of [-1.55, 1.55]) {
      for (const z of [-1.38, -0.22, 0.94]) {
        const plug = this.cyl(0.16, 0.04, this.matSteel, new THREE.Vector3(x, 0.62, z), 24);
        plug.rotation.z = Math.PI / 2;
        block.add(plug);
      }
    }

    // Valley knock sensors.
    for (const z of [-0.66, 0.58]) {
      const ks = new THREE.Group();
      const body = this.cyl(0.085, 0.16, this.matSteel, null, 20);
      const top = this.cyl(0.055, 0.09, this.matConnector, new THREE.Vector3(0, 0.11, 0), 12);
      ks.add(body, top);
      ks.position.set(0, 1.28, z);
      block.add(ks);
      this.registerPart(body, this.meta('Valley Knock Sensor', 'Sensors', 'Two Gen III valley-mounted knock sensors', 'Mounted beneath the intake manifold in the lifter valley.'));
    }

    // Bellhousing flange bosses / rear face.
    const rearFace = this.box(3.0, 2.8, 0.12, this.matIron, new THREE.Vector3(0, 0.2, 2.35), 'RearBlockFace');
    block.add(rearFace);

    this.subassemblies.block = block;
    this.group.add(block);

    // Oil pan / sump.
    const pan = new THREE.Group();
    pan.name = 'Truck_OilPan_Assembly';
    const panShape = new THREE.Shape();
    panShape.moveTo(-1.22, 0.03);
    panShape.lineTo(1.22, 0.03);
    panShape.lineTo(1.12, -0.46);
    panShape.lineTo(0.92, -1.02);
    panShape.lineTo(-0.92, -1.02);
    panShape.lineTo(-1.12, -0.46);
    panShape.closePath();
    const panMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(panShape, { depth: 4.05, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }), this.matAluminum);
    panMesh.position.set(0, -0.72, -2.02);
    panMesh.castShadow = true;
    pan.add(panMesh);
    this.registerPart(panMesh, this.meta('GMT800 Truck Oil Pan', 'Lubrication', 'Deep-sump aluminum truck pan', 'Lower sump, gasket rail, pickup volume and drain location represented.'));

    for (let i = 0; i < 9; i++) {
      const z = -1.84 + i * 0.46;
      for (const x of [-1.18, 1.18]) {
        const b = this.cyl(0.035, 0.07, this.matSteel, new THREE.Vector3(x, -0.74, z), 6);
        pan.add(b);
      }
    }
    const drain = this.cyl(0.105, 0.15, this.matSteel, new THREE.Vector3(0.78, -1.72, 1.42), 6);
    drain.rotation.z = Math.PI / 2;
    pan.add(drain);

    this.subassemblies.oilPan = pan;
    this.group.add(pan);
    this.rememberExplode(pan, new THREE.Vector3(0, -2.0, 0));
  }

  // ---------------------------------------------------------------------------
  // CRANK / PISTONS / RODS
  // ---------------------------------------------------------------------------
  buildCrankAndPistons() {
    const rotating = new THREE.Group();
    rotating.name = 'Rotating_Assembly';
    this.subassemblies.crankGroup = rotating;

    this.crankshaft = new THREE.Group();
    this.crankshaft.name = 'Nodular_Iron_CrossPlane_Crankshaft';
    rotating.add(this.crankshaft);

    const crankLength = 4.72;
    const main = this.cyl(inch(this.spec.geometry.mainJournalDiameterIn) / 2, crankLength, this.matJournal, null, 32, 'CrankMainAxis');
    main.rotation.x = Math.PI / 2;
    this.crankshaft.add(main);
    this.registerPart(main, this.meta('Nodular-Iron Crankshaft', 'Rotating Assembly', '3.622 in stroke • 2.559 in main journals • internally balanced', 'Cross-plane Gen III crankshaft with four phased rod journals.'));

    const r = inch(this.spec.geometry.crankRadiusIn);
    const rodJournalR = inch(this.spec.geometry.rodJournalDiameterIn) / 2;
    const journalPhases = [135, 225, 45, 315].map(v => v * DEG);

    // Five visible main journals.
    for (let i = 0; i < 5; i++) {
      const z = -2.2 + i * 1.1;
      const j = this.cyl(inch(this.spec.geometry.mainJournalDiameterIn) / 2, 0.22, this.matJournal, new THREE.Vector3(0, 0, z), 32);
      j.rotation.x = Math.PI / 2;
      this.crankshaft.add(j);
    }

    for (let i = 0; i < 4; i++) {
      const phase = journalPhases[i];
      const z = this.journalZ(i);
      const x = Math.cos(phase) * r;
      const y = Math.sin(phase) * r;

      const pin = this.cyl(rodJournalR, 0.34, this.matJournal, new THREE.Vector3(x, y, z), 32, `RodJournal_${i + 1}`);
      pin.rotation.x = Math.PI / 2;
      this.crankshaft.add(pin);

      // Two crank webs for each rod journal.
      for (const dz of [-0.23, 0.23]) {
        const web = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.58, 4, 12), this.matSteel);
        web.rotation.z = phase - Math.PI / 2;
        web.position.set(x * 0.48, y * 0.48, z + dz);
        this.crankshaft.add(web);
      }

      const counter = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.42, 0.18, 24), this.matSteel);
      counter.rotation.x = Math.PI / 2;
      counter.position.set(-Math.cos(phase) * 0.34, -Math.sin(phase) * 0.34, z + 0.28);
      this.crankshaft.add(counter);
    }

    // Gen III 24X reluctor wheel at rear.
    const reluctor = new THREE.Group();
    reluctor.position.z = 1.93;
    const reluctorCore = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.055, 10, 48), this.matSteel);
    reluctor.add(reluctorCore);
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * PI2;
      const tooth = this.box(0.045, 0.12, 0.08, this.matSteel, new THREE.Vector3(Math.cos(a) * 0.54, Math.sin(a) * 0.54, 0));
      tooth.rotation.z = a;
      reluctor.add(tooth);
    }
    this.crankshaft.add(reluctor);

    // Flexplate (automatic transmission), rear of engine.
    this.flywheel = new THREE.Group();
    this.flywheel.name = 'Automatic_Flexplate';
    this.flywheel.position.z = 2.48;
    const plate = this.cyl(1.17, 0.075, this.matSteel, null, 64);
    plate.rotation.x = Math.PI / 2;
    this.flywheel.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.06, 10, 72), this.matSteel);
    this.flywheel.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * PI2;
      const hole = this.cyl(0.045, 0.09, this.matIron, new THREE.Vector3(Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0), 12);
      hole.rotation.x = Math.PI / 2;
      this.flywheel.add(hole);
    }
    this.crankshaft.add(this.flywheel);
    this.registerPart(plate, this.meta('Automatic Transmission Flexplate', 'Rear Drive', 'GMT800 4-speed automatic drive plate representation', 'Bolts to the crank flange and carries the starter ring gear.'));

    // Pistons and powdered-metal rods.
    const pistonNumbers = { L: [1, 3, 5, 7], R: [2, 4, 6, 8] };
    for (const bank of ['L', 'R']) {
      const bankAxis = this.axisForBank(bank);
      for (let i = 0; i < 4; i++) {
        const cylNo = pistonNumbers[bank][i];
        this.createPistonRod(rotating, bank, i, cylNo, bankAxis, journalPhases[i]);
      }
    }

    this.group.add(rotating);
  }

  createPistonRod(parent, bank, index, cylinderNo, bankAxis, journalPhase) {
    const piston = new THREE.Group();
    piston.name = `Piston_${cylinderNo}`;
    piston.rotation.z = bankAxis.rotationZ;

    const boreR = inch(this.spec.geometry.boreIn) / 2;
    const pistonR = boreR * 0.965;
    const crown = this.cyl(pistonR, 0.42, this.matPiston, new THREE.Vector3(0, 0.13, 0), 36, `PistonCrown_${cylinderNo}`);
    piston.add(crown);

    // Shallow dish on crown as a dark inset to communicate the stock dished piston.
    const dish = this.cyl(pistonR * 0.56, 0.018, this.matIron, new THREE.Vector3(0, 0.348, 0), 32);
    piston.add(dish);

    // Three-ring package.
    for (let ringIndex = 0; ringIndex < 3; ringIndex++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(pistonR * 0.995, 0.012, 6, 32), this.matSteel);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.25 - ringIndex * 0.055;
      piston.add(ring);
    }

    // Floating wrist pin on 2005–2007 architecture.
    const wrist = this.cyl(inch(0.943) / 2, pistonR * 1.65, this.matJournal, new THREE.Vector3(0, 0.02, 0), 24);
    wrist.rotation.z = Math.PI / 2;
    piston.add(wrist);

    parent.add(piston);
    this.registerPart(crown, this.meta(
      `Cylinder ${cylinderNo} Cast Aluminum Piston`,
      'Rotating Assembly',
      `3.780 in bore class • 3.622 in stroke • 9.5:1 engine compression`,
      'Stock-style dished piston with three-ring package and floating wrist pin representation.'
    ));

    // Rod is a unit-height mesh continuously oriented between crank pin and wrist pin.
    const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 12), this.matSteel);
    rodMesh.name = `ConnectingRod_${cylinderNo}`;
    rodMesh.castShadow = true;
    parent.add(rodMesh);
    this.registerPart(rodMesh, this.meta(
      `Cylinder ${cylinderNo} Powdered-Metal Connecting Rod`,
      'Rotating Assembly',
      '6.098 in center-to-center • I-beam stock architecture',
      'Connects the floating piston pin to its cross-plane crank journal.'
    ));

    // Big-end cap and two rod-bolt cues move with rod midpoint orientation.
    const rodCap = this.cyl(0.19, 0.13, this.matSteel, null, 20);
    rodCap.name = `RodCap_${cylinderNo}`;
    parent.add(rodCap);

    const firingIndex = this.spec.architecture.firingOrder.indexOf(cylinderNo);
    const firingAngle = firingIndex * Math.PI / 2;

    const item = {
      cylinderNo,
      bank,
      bankAxis,
      journalPhase,
      journalIndex: index,
      z: this.cylinderZ(bank, index),
      journalZ: this.journalZ(index),
      piston,
      rodMesh,
      rodCap,
      crown,
      firingAngle,
      rodLength: inch(this.spec.geometry.rodLengthIn),
      crankRadius: inch(this.spec.geometry.crankRadiusIn)
    };
    this.pistons.push(item);
    this.updatePiston(item);
  }

  updatePiston(p) {
    const physicalPinAngle = this.crankAngle + p.journalPhase;
    const theta = physicalPinAngle - p.bankAxis.angle;
    const r = p.crankRadius;
    const l = p.rodLength;
    const sin = Math.sin(theta);
    const s = r * Math.cos(theta) + Math.sqrt(Math.max(0.00001, l * l - r * r * sin * sin));

    const wrist = this._tmpA.set(p.bankAxis.vec.x * s, p.bankAxis.vec.y * s, p.z);
    p.piston.position.copy(wrist);

    const crankPin = this._tmpB.set(
      Math.cos(physicalPinAngle) * r,
      Math.sin(physicalPinAngle) * r,
      p.journalZ + (p.bank === 'L' ? -0.075 : 0.075)
    );
    this.orientUnitCylinder(p.rodMesh, crankPin, wrist);
    p.rodMesh.scale.x = 1;
    p.rodMesh.scale.z = 1;
    p.rodCap.position.copy(crankPin);
    p.rodCap.rotation.x = Math.PI / 2;
  }

  // ---------------------------------------------------------------------------
  // CAM / TIMING / OIL PUMP
  // ---------------------------------------------------------------------------
  buildCamTimingAndOilPump() {
    const valvetrain = new THREE.Group();
    valvetrain.name = 'SingleCam_Timing_OilPump';
    this.subassemblies.valvetrain = valvetrain;

    const camY = inch(4.914);
    this.camshaft = new THREE.Group();
    this.camshaft.name = 'Single_InBlock_Camshaft';
    this.camshaft.position.set(0, camY, 0);
    const shaft = this.cyl(mm(55) / 2, 4.48, this.matSteel, null, 32, 'CamshaftCore');
    shaft.rotation.x = Math.PI / 2;
    this.camshaft.add(shaft);

    // 16 lobes spaced along the single camshaft.
    for (let i = 0; i < 16; i++) {
      const z = -1.82 + i * 0.242;
      const lobe = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.12, 3, 10), this.matSteel);
      lobe.rotation.x = Math.PI / 2;
      lobe.rotation.z = (i * 47 * DEG) % PI2;
      lobe.position.z = z;
      this.camshaft.add(lobe);
    }
    valvetrain.add(this.camshaft);
    this.camshafts = [this.camshaft];
    this.registerPart(shaft, this.meta('Single In-Block Camshaft', 'Valvetrain', 'OHV • 16 lobes • rotates at 1/2 crankshaft speed', 'The defining Gen III pushrod layout; there are no camshafts in the cylinder heads.'));

    const frontZ = -2.36;
    // Cam and crank sprockets.
    const crankSprocket = this.cyl(0.31, 0.10, this.matSteel, new THREE.Vector3(0, 0, frontZ), 28);
    crankSprocket.rotation.x = Math.PI / 2;
    valvetrain.add(crankSprocket);
    const camSprocket = this.cyl(0.55, 0.10, this.matSteel, new THREE.Vector3(0, camY, frontZ), 36);
    camSprocket.rotation.x = Math.PI / 2;
    valvetrain.add(camSprocket);

    // Timing chain: paired straight runs plus arcs approximated by a closed path.
    const chainPath = [
      new THREE.Vector3(-0.28, -0.10, frontZ - 0.03),
      new THREE.Vector3(-0.55, camY, frontZ - 0.03),
      new THREE.Vector3(0, camY + 0.56, frontZ - 0.03),
      new THREE.Vector3(0.55, camY, frontZ - 0.03),
      new THREE.Vector3(0.28, -0.10, frontZ - 0.03),
      new THREE.Vector3(0, -0.32, frontZ - 0.03)
    ];
    this.timingChain = this.tube(chainPath, 0.035, this.matSteel, 56, 6, true);
    valvetrain.add(this.timingChain);

    // Crank-driven gerotor oil pump around crank snout.
    const oilPumpHousing = this.cyl(0.55, 0.18, this.matAluminum, new THREE.Vector3(0, 0, frontZ - 0.15), 40);
    oilPumpHousing.rotation.x = Math.PI / 2;
    valvetrain.add(oilPumpHousing);
    this.registerPart(oilPumpHousing, this.meta('Crankshaft-Driven Gerotor Oil Pump', 'Lubrication', 'Front-mounted Gen III gerotor oil pump', 'Concentric with the crankshaft behind the timing cover.'));

    // Pickup tube from pump to sump screen.
    const pickup = this.tube([
      new THREE.Vector3(-0.2, -0.18, frontZ + 0.05),
      new THREE.Vector3(-0.65, -0.7, -1.6),
      new THREE.Vector3(-0.52, -1.25, 0.35),
      new THREE.Vector3(0, -1.36, 0.55)
    ], 0.055, this.matSteel, 36, 10);
    valvetrain.add(pickup);
    const screen = this.cyl(0.23, 0.10, this.matSteel, new THREE.Vector3(0, -1.36, 0.55), 28);
    screen.rotation.z = Math.PI / 2;
    valvetrain.add(screen);

    this.group.add(valvetrain);
  }

  // ---------------------------------------------------------------------------
  // HEADS / PUSHROD VALVETRAIN
  // ---------------------------------------------------------------------------
  buildHeadsAndValvetrain() {
    const headL = this.createHead('L');
    const headR = this.createHead('R');
    this.subassemblies.leftHead = headL;
    this.subassemblies.rightHead = headR;
    this.group.add(headL, headR);

    const coverL = this.createValveCover('L');
    const coverR = this.createValveCover('R');
    this.subassemblies.leftValveCover = coverL;
    this.subassemblies.rightValveCover = coverR;
    this.group.add(coverL, coverR);

    const pushrodGroup = new THREE.Group();
    pushrodGroup.name = 'Lifters_Pushrods_Rockers_Valves';

    const cylinderNumbers = { L: [1, 3, 5, 7], R: [2, 4, 6, 8] };
    const deck = inch(this.spec.geometry.deckHeightNominalIn);
    const camY = inch(4.914);

    for (const bank of ['L', 'R']) {
      const axis = this.axisForBank(bank);
      const tangent = new THREE.Vector3(-axis.vec.y, axis.vec.x, 0);
      for (let i = 0; i < 4; i++) {
        const cylinderNo = cylinderNumbers[bank][i];
        const z = this.cylinderZ(bank, i);
        const fireIdx = this.spec.architecture.firingOrder.indexOf(cylinderNo);
        const firingAngle = fireIdx * Math.PI / 2;

        // Lifter pair sits in the valley near the cam.
        const lifterBaseCenter = new THREE.Vector3(axis.vec.x * 0.34, camY + 0.18, z);
        const lifters = [];
        const pushrods = [];
        const rockers = [];
        const valves = [];

        for (const type of ['intake', 'exhaust']) {
          const side = type === 'intake' ? -1 : 1;
          const lifterBase = lifterBaseCenter.clone().add(tangent.clone().multiplyScalar(side * 0.10));
          const lifter = this.cyl(inch(this.spec.geometry.lifterDiameterIn) / 2, 0.28, this.matSteel, lifterBase, 18, `${type}_Lifter_Cyl${cylinderNo}`);
          lifter.rotation.z = axis.rotationZ * 0.25;
          pushrodGroup.add(lifter);
          lifters.push({ mesh: lifter, base: lifterBase.clone(), type });

          const rockerBase = new THREE.Vector3(axis.vec.x * (deck + 0.72), axis.vec.y * (deck + 0.72), z + side * 0.10);
          const pushEnd = rockerBase.clone().add(tangent.clone().multiplyScalar(type === 'intake' ? -0.14 : 0.14));
          const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1, 10), this.matJournal);
          this.orientUnitCylinder(pr, lifterBase, pushEnd);
          pushrodGroup.add(pr);
          pushrods.push(pr);

          const rocker = new THREE.Group();
          rocker.position.copy(rockerBase);
          rocker.rotation.z = axis.rotationZ;
          const arm = this.box(0.42, 0.075, 0.11, this.matSteel, new THREE.Vector3(side * 0.06, 0, 0));
          rocker.add(arm);
          const pivot = this.cyl(0.065, 0.13, this.matJournal, new THREE.Vector3(0, 0, 0), 16);
          pivot.rotation.x = Math.PI / 2;
          rocker.add(pivot);
          pushrodGroup.add(rocker);
          rockers.push({ group: rocker, baseRot: axis.rotationZ, type });

          // Valve center slightly intake-side / exhaust-side of bore axis.
          const valveBase = new THREE.Vector3(axis.vec.x * (deck + 0.49), axis.vec.y * (deck + 0.49), z + side * 0.14);
          const valve = new THREE.Group();
          valve.position.copy(valveBase);
          valve.rotation.z = axis.rotationZ + side * 6 * DEG;
          const stem = this.cyl(0.026, 0.58, this.matJournal, new THREE.Vector3(0, -0.12, 0), 12);
          valve.add(stem);
          const head = this.cyl(type === 'intake' ? 0.145 : 0.125, 0.035, this.matJournal, new THREE.Vector3(0, -0.42, 0), 20);
          valve.add(head);
          const spring = new THREE.Mesh(new THREE.TorusKnotGeometry(0.075, 0.012, 36, 6, 2, 5), this.matSteel);
          spring.scale.set(1, 1.55, 1);
          spring.rotation.x = Math.PI / 2;
          spring.position.y = 0.12;
          valve.add(spring);
          const retainer = this.cyl(0.09, 0.035, this.matSteel, new THREE.Vector3(0, 0.23, 0), 18);
          valve.add(retainer);
          pushrodGroup.add(valve);
          valves.push({ group: valve, base: valveBase.clone(), axis: axis.vec.clone(), type, spring });
          this.valves.push(valve);
          this.registerPart(stem, this.meta(
            `Cylinder ${cylinderNo} ${type === 'intake' ? 'Intake' : 'Exhaust'} Valve`,
            'OHV Valvetrain',
            'Two valves per cylinder • hydraulic roller / pushrod actuation',
            'Valve is actuated through lifter, pushrod and 1.7:1 rocker arm from the single block camshaft.'
          ));
        }

        this.valveEvents.push({ cylinderNo, firingAngle, axis, lifters, pushrods, rockers, valves });
      }
    }

    this.group.add(pushrodGroup);
    this.registerPart(pushrodGroup.children.find(x => x.isMesh), this.meta('Hydraulic Roller Lifter / Pushrod System', 'OHV Valvetrain', '16 lifters • 16 pushrods • 16 rocker arms • 16 valves', 'Correct pushrod Gen III layout replacing the old DOHC 32-valve system.'));

    this.rememberExplode(headL, this.axisForBank('L').vec.clone().multiplyScalar(1.7));
    this.rememberExplode(headR, this.axisForBank('R').vec.clone().multiplyScalar(1.7));
    this.rememberExplode(coverL, this.axisForBank('L').vec.clone().multiplyScalar(2.7));
    this.rememberExplode(coverR, this.axisForBank('R').vec.clone().multiplyScalar(2.7));
  }

  createHead(bank) {
    const axis = this.axisForBank(bank);
    const deck = inch(this.spec.geometry.deckHeightNominalIn);
    const group = new THREE.Group();
    group.name = `${bank === 'L' ? 'Driver' : 'Passenger'}_CathedralPort_AluminumHead`;
    group.position.set(axis.vec.x * deck, axis.vec.y * deck, 0);
    group.rotation.z = axis.rotationZ;

    const body = this.box(1.44, 0.58, 4.58, this.matHead, new THREE.Vector3(0, 0.30, 0), `${bank}_HeadCasting`);
    group.add(body);
    this.registerPart(body, this.meta(
      `${bank === 'L' ? 'Driver/Left' : 'Passenger/Right'} Aluminum Cylinder Head`,
      'Cylinder Heads',
      'Gen III 356-T6 aluminum • cathedral intake ports • two valves/cylinder',
      'Stock-style Vortec 5300 cathedral-port cylinder head casting.'
    ));

    const gasket = this.box(1.40, 0.025, 4.62, this.matGasket, new THREE.Vector3(0, -0.018, 0), `${bank}_HeadGasket`);
    group.add(gasket);

    // Combustion chambers and port cues.
    for (let i = 0; i < 4; i++) {
      const z = this.cylinderZ(bank, i);
      const localZ = z; // head group has no longitudinal translation
      const chamber = this.cyl(inch(this.spec.geometry.boreIn) * 0.43, 0.025, this.matIron, new THREE.Vector3(0, -0.04, localZ), 28);
      group.add(chamber);

      const intakePort = this.box(0.25, 0.25, 0.20, this.matIron, new THREE.Vector3(-0.66, 0.28, localZ - 0.08));
      intakePort.scale.y = 1.35;
      group.add(intakePort);
      const exhaustPort = this.cyl(0.13, 0.20, this.matIron, new THREE.Vector3(0.67, 0.30, localZ + 0.10), 18);
      exhaustPort.rotation.z = Math.PI / 2;
      group.add(exhaustPort);
    }

    // Head bolt stations.
    for (let i = 0; i < 5; i++) {
      const z = -2.0 + i * 1.0;
      for (const x of [-0.45, 0.45]) {
        const b = this.cyl(0.045, 0.10, this.matSteel, new THREE.Vector3(x, 0.60, z), 6);
        group.add(b);
      }
    }
    return group;
  }

  createValveCover(bank) {
    const axis = this.axisForBank(bank);
    const deck = inch(this.spec.geometry.deckHeightNominalIn);
    const group = new THREE.Group();
    group.name = `${bank}_ValveCover_CoilMount`;
    group.position.set(axis.vec.x * (deck + 0.73), axis.vec.y * (deck + 0.73), 0);
    group.rotation.z = axis.rotationZ;

    const shape = new THREE.Shape();
    shape.moveTo(-0.58, -0.13);
    shape.lineTo(0.58, -0.13);
    shape.quadraticCurveTo(0.68, 0.04, 0.50, 0.28);
    shape.lineTo(-0.50, 0.28);
    shape.quadraticCurveTo(-0.68, 0.04, -0.58, -0.13);
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 4.38, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2 }), this.matAluminum);
    mesh.position.z = -2.19;
    mesh.castShadow = true;
    group.add(mesh);
    this.registerPart(mesh, this.meta(
      `${bank === 'L' ? 'Driver' : 'Passenger'} Valve Cover`,
      'Cylinder Heads',
      'Gen III truck valve-cover / coil-mount assembly',
      'Covers the rocker valvetrain and supports the coil-near-plug ignition brackets.'
    ));

    for (let i = 0; i < 4; i++) {
      const z = this.cylinderZ(bank, i);
      const b = this.cyl(0.035, 0.08, this.matSteel, new THREE.Vector3(0, 0.32, z), 6);
      group.add(b);
    }
    return group;
  }

  // ---------------------------------------------------------------------------
  // INTAKE / FUEL
  // ---------------------------------------------------------------------------
  buildIntakeAndFuel() {
    const intake = new THREE.Group();
    intake.name = 'Composite_Truck_Intake_Manifold';

    const lower = this.box(1.72, 0.32, 4.10, this.matComposite, new THREE.Vector3(0, 2.13, 0), 'IntakeLower');
    intake.add(lower);
    const plenum = this.box(1.50, 0.72, 3.42, this.matComposite, new THREE.Vector3(0, 2.55, 0.12), 'IntakePlenum');
    plenum.scale.x = 1.08;
    intake.add(plenum);
    this.registerPart(plenum, this.meta(
      'Composite Truck Intake Manifold',
      'Air Induction',
      'One-piece composite • eight long runners • cathedral-port Gen III interface',
      'Stock naturally aspirated truck plenum and runner layout; no carbon race plenum and no forced induction.'
    ));

    // Eight curved runners, four to each bank.
    for (const bank of ['L', 'R']) {
      const axis = this.axisForBank(bank);
      for (let i = 0; i < 4; i++) {
        const z = this.cylinderZ(bank, i);
        const end = new THREE.Vector3(axis.vec.x * 1.62, axis.vec.y * 1.62 + 0.55, z);
        const start = new THREE.Vector3(bank === 'L' ? -0.42 : 0.42, 2.52, z + (bank === 'L' ? 0.10 : -0.10));
        const mid = start.clone().lerp(end, 0.55);
        mid.y += 0.18;
        const runner = this.tube([start, mid, end], 0.14, this.matComposite, 24, 12);
        intake.add(runner);
      }
    }

    // 78 mm electronic throttle body at the front (negative Z).
    const tb = new THREE.Group();
    tb.name = '78mm_Electronic_ThrottleBody';
    tb.position.set(0, 2.50, -2.15);
    tb.rotation.x = Math.PI / 2;
    const body = new THREE.Mesh(new THREE.TorusGeometry(mm(this.spec.architecture.throttleBodyMm) / 2 + 0.08, 0.12, 12, 36), this.matAluminum);
    tb.add(body);
    const bore = this.cyl(mm(this.spec.architecture.throttleBodyMm) / 2, 0.26, this.matAluminum, null, 36);
    tb.add(bore);
    const blade = this.box(mm(this.spec.architecture.throttleBodyMm) * 0.90, 0.02, mm(this.spec.architecture.throttleBodyMm) * 0.90, this.matCopper);
    blade.rotation.x = 8 * DEG;
    tb.add(blade);
    const actuator = this.box(0.34, 0.34, 0.26, this.matConnector, new THREE.Vector3(0.48, 0, 0));
    tb.add(actuator);
    intake.add(tb);
    this.registerPart(bore, this.meta('78 mm Electronic Throttle Body', 'Air Induction', 'Gen III 78 mm ETC throttle opening', 'Front-mounted electronic throttle body feeding the composite truck intake.'));

    // MAP sensor on rear plenum.
    const map = this.box(0.17, 0.10, 0.28, this.matConnector, new THREE.Vector3(0, 2.93, 1.52), 'MAP_Sensor');
    intake.add(map);
    this.registerPart(map, this.meta('MAP Sensor', 'Sensors', 'Manifold absolute pressure sensor', 'Mounted on the intake plenum and used by the PCM for load calculation.'));

    this.subassemblies.intakePlenum = intake;
    this.group.add(intake);
    this.rememberExplode(intake, new THREE.Vector3(0, 2.6, 0));

    // Fuel rails and eight injectors.
    const fuel = new THREE.Group();
    fuel.name = 'Sequential_Port_Fuel_System';
    for (const bank of ['L', 'R']) {
      const x = bank === 'L' ? -0.92 : 0.92;
      const rail = this.box(0.12, 0.13, 3.85, this.matFuelRail, new THREE.Vector3(x, 2.25, 0), `${bank}_FuelRail`);
      fuel.add(rail);
      this.registerPart(rail, this.meta(`${bank === 'L' ? 'Driver' : 'Passenger'} Fuel Rail`, 'Fuel System', 'Sequential multi-port injection rail', 'Feeds four injectors on this bank. L59 calibration supports gasoline/E85 FlexFuel.'));
      for (let i = 0; i < 4; i++) {
        const z = this.cylinderZ(bank, i);
        const injector = new THREE.Group();
        injector.position.set(x, 2.09, z);
        injector.rotation.z = bank === 'L' ? -18 * DEG : 18 * DEG;
        const bodyI = this.cyl(0.055, 0.30, this.matInjector, null, 16);
        injector.add(bodyI);
        const tip = this.cyl(0.032, 0.11, this.matFuelRail, new THREE.Vector3(0, -0.18, 0), 12);
        injector.add(tip);
        const conn = this.box(0.11, 0.08, 0.12, this.matConnector, new THREE.Vector3(0.10, 0.04, 0));
        injector.add(conn);
        fuel.add(injector);
        this.registerPart(bodyI, this.meta(`Cylinder ${bank === 'L' ? [1, 3, 5, 7][i] : [2, 4, 6, 8][i]} Fuel Injector`, 'Fuel System', 'Sequential port fuel injector', 'Injector sprays into the intake port upstream of the intake valve.'));
      }
    }
    const crossover = this.tube([
      new THREE.Vector3(-0.92, 2.25, -1.93),
      new THREE.Vector3(0, 2.42, -2.02),
      new THREE.Vector3(0.92, 2.25, -1.93)
    ], 0.035, this.matRubber, 22, 8);
    fuel.add(crossover);
    this.subassemblies.fuelSystem = fuel;
    this.group.add(fuel);
    this.rememberExplode(fuel, new THREE.Vector3(0, 2.2, 0));
  }

  // ---------------------------------------------------------------------------
  // IGNITION
  // ---------------------------------------------------------------------------
  buildIgnition() {
    const ignition = new THREE.Group();
    ignition.name = 'Coil_Near_Plug_Ignition';
    const numbers = { L: [1, 3, 5, 7], R: [2, 4, 6, 8] };

    for (const bank of ['L', 'R']) {
      const axis = this.axisForBank(bank);
      const tangent = new THREE.Vector3(-axis.vec.y, axis.vec.x, 0);
      const railCenter = axis.vec.clone().multiplyScalar(inch(this.spec.geometry.deckHeightNominalIn) + 1.0);
      const rail = this.box(0.12, 0.12, 4.18, this.matSteel, new THREE.Vector3(railCenter.x, railCenter.y, 0), `${bank}_CoilRail`);
      rail.rotation.z = axis.rotationZ;
      ignition.add(rail);

      for (let i = 0; i < 4; i++) {
        const cylNo = numbers[bank][i];
        const z = this.cylinderZ(bank, i);
        const coil = new THREE.Group();
        coil.name = `IgnitionCoil_${cylNo}`;
        coil.position.set(railCenter.x, railCenter.y + 0.08, z);
        coil.rotation.z = axis.rotationZ;
        const body = this.box(0.34, 0.24, 0.42, this.matConnector, new THREE.Vector3(0, 0, 0));
        coil.add(body);
        const tower = this.cyl(0.055, 0.18, this.matConnector, new THREE.Vector3(0.15, -0.12, 0), 14);
        coil.add(tower);
        ignition.add(coil);
        this.registerPart(body, this.meta(`Cylinder ${cylNo} Ignition Coil`, 'Ignition', 'Coil-near-plug Gen III ignition', 'Individual PCM-controlled coil mounted near its spark plug.'));

        // Spark plug at the outer side of the head.
        const plugBase = axis.vec.clone().multiplyScalar(inch(this.spec.geometry.deckHeightNominalIn) + 0.34);
        plugBase.add(tangent.clone().multiplyScalar(0.43));
        plugBase.z = z;
        const plug = new THREE.Group();
        plug.position.copy(plugBase);
        plug.rotation.z = axis.rotationZ + 12 * DEG;
        const hex = this.cyl(0.075, 0.10, this.matSteel, null, 6);
        plug.add(hex);
        const ceramic = this.cyl(0.052, 0.22, this.matPorcelain, new THREE.Vector3(0, 0.14, 0), 16);
        plug.add(ceramic);
        ignition.add(plug);

        // Short plug wire / boot from coil to plug.
        const wireStart = coil.position.clone().add(axis.vec.clone().multiplyScalar(-0.08));
        const wireEnd = plugBase.clone().add(axis.vec.clone().multiplyScalar(0.12));
        const wire = this.tube([wireStart, wireStart.clone().lerp(wireEnd, 0.5).add(new THREE.Vector3(0, 0.08, 0)), wireEnd], 0.035, this.matRubber, 18, 8);
        ignition.add(wire);
      }
    }

    this.subassemblies.ignition = ignition;
    this.group.add(ignition);
    this.rememberExplode(ignition, new THREE.Vector3(0, 2.8, 0));
  }

  // ---------------------------------------------------------------------------
  // STOCK CAST EXHAUST (NO TURBOS)
  // ---------------------------------------------------------------------------
  buildStockExhaust() {
    const buildSide = (bank) => {
      const g = new THREE.Group();
      g.name = `${bank}_Stock_Cast_Exhaust_Manifold`;
      const axis = this.axisForBank(bank);
      const tangent = new THREE.Vector3(-axis.vec.y, axis.vec.x, 0);
      const outerSign = bank === 'L' ? -1 : 1;

      const logX = outerSign * 2.25;
      const logY = 1.24;
      const log = this.tube([
        new THREE.Vector3(logX, logY, -1.72),
        new THREE.Vector3(logX + outerSign * 0.05, logY - 0.02, -0.55),
        new THREE.Vector3(logX + outerSign * 0.03, logY - 0.08, 0.62),
        new THREE.Vector3(logX, logY - 0.16, 1.78)
      ], 0.17, this.matExhaust, 34, 12);
      g.add(log);
      this.exhaustHeaders.push(log);
      this.registerPart(log, this.meta(
        `${bank === 'L' ? 'Driver' : 'Passenger'} Cast Exhaust Manifold`,
        'Exhaust',
        'Stock cast nodular-iron log manifold • naturally aspirated',
        'Four exhaust ports merge into the stock-style manifold outlet. There are no turbochargers or tubular race headers.'
      ));

      for (let i = 0; i < 4; i++) {
        const z = this.cylinderZ(bank, i);
        const start = axis.vec.clone().multiplyScalar(inch(this.spec.geometry.deckHeightNominalIn) + 0.34);
        start.add(tangent.clone().multiplyScalar(bank === 'L' ? 0.58 : -0.58));
        start.z = z;
        const end = new THREE.Vector3(logX, logY, z);
        const branch = this.tube([start, start.clone().lerp(end, 0.5).add(new THREE.Vector3(outerSign * 0.08, -0.10, 0)), end], 0.11, this.matExhaust, 20, 10);
        g.add(branch);
        this.exhaustHeaders.push(branch);
      }

      const outlet = this.cyl(0.23, 0.36, this.matExhaust, new THREE.Vector3(logX, logY - 0.33, 1.62), 24);
      outlet.rotation.x = Math.PI / 2;
      outlet.rotation.z = 22 * DEG * outerSign;
      g.add(outlet);
      return g;
    };

    const left = buildSide('L');
    const right = buildSide('R');
    this.subassemblies.leftExhaust = left;
    this.subassemblies.rightExhaust = right;
    this.group.add(left, right);
    this.rememberExplode(left, new THREE.Vector3(-2.0, 0, 0));
    this.rememberExplode(right, new THREE.Vector3(2.0, 0, 0));
  }

  // ---------------------------------------------------------------------------
  // FRONT ACCESSORY DRIVE / COOLING
  // ---------------------------------------------------------------------------
  buildFrontAccessoryDrive() {
    const drive = new THREE.Group();
    drive.name = 'GMT800_Front_Accessory_Drive';
    const z = -2.53;

    // Front timing cover.
    const timingCover = this.box(2.55, 2.62, 0.16, this.matAluminum, new THREE.Vector3(0, 0.44, z + 0.18), 'FrontTimingCover');
    drive.add(timingCover);
    this.registerPart(timingCover, this.meta('Front Timing Cover', 'Front Drive', 'Gen III front cover / front seal carrier', 'Encloses the timing chain and front oil-pump area.'));

    // Water pump casting and dual outlet bosses.
    const wpBody = this.cyl(0.62, 0.30, this.matAluminum, new THREE.Vector3(0, 1.05, z - 0.02), 40, 'WaterPumpBody');
    wpBody.rotation.x = Math.PI / 2;
    drive.add(wpBody);
    const wpLeft = this.cyl(0.27, 0.32, this.matAluminum, new THREE.Vector3(-0.55, 0.95, z - 0.01), 28);
    wpLeft.rotation.x = Math.PI / 2;
    drive.add(wpLeft);
    const wpRight = this.cyl(0.27, 0.32, this.matAluminum, new THREE.Vector3(0.55, 0.95, z - 0.01), 28);
    wpRight.rotation.x = Math.PI / 2;
    drive.add(wpRight);
    this.registerPart(wpBody, this.meta('Mechanical Water Pump', 'Cooling', 'Belt-driven GMT800 Gen III water pump', 'Front-mounted coolant pump with thermostat/inlet and cylinder-head crossover function.'));

    // Thermostat inlet neck low passenger side.
    const tstat = this.cyl(0.20, 0.36, this.matAluminum, new THREE.Vector3(0.52, 0.55, z - 0.04), 24);
    tstat.rotation.z = 62 * DEG;
    drive.add(tstat);

    const crank = this.createPulley(0.57, 0.20, 0, -0.02, z - 0.18, 'Harmonic Balancer / Crank Pulley', this.matSteel);
    const water = this.createPulley(0.47, 0.15, 0, 1.06, z - 0.22, 'Water Pump Pulley', this.matSteel);
    const alternator = this.createAlternator(1.08, 1.55, z - 0.10);
    const ps = this.createPumpAccessory(-1.04, 0.78, z - 0.12, 'Power Steering Pump', 0.36);
    const ac = this.createPumpAccessory(1.02, 0.12, z - 0.10, 'A/C Compressor', 0.39, true);
    const tensioner = this.createPulley(0.27, 0.12, -0.58, 1.48, z - 0.22, 'Automatic Belt Tensioner', this.matSteel);
    const idler = this.createPulley(0.24, 0.12, 0.57, 0.64, z - 0.22, 'Idler Pulley', this.matSteel);
    drive.add(crank, water, alternator, ps, ac, tensioner, idler);

    // Serpentine belt path approximates tangent wrap around actual accessory locations.
    const beltPoints = [
      new THREE.Vector3(-0.48, -0.30, z - 0.34),
      new THREE.Vector3(-1.25, 0.56, z - 0.34),
      new THREE.Vector3(-1.00, 1.12, z - 0.34),
      new THREE.Vector3(-0.62, 1.72, z - 0.34),
      new THREE.Vector3(0.20, 1.53, z - 0.34),
      new THREE.Vector3(1.26, 1.70, z - 0.34),
      new THREE.Vector3(1.35, 1.32, z - 0.34),
      new THREE.Vector3(0.72, 0.68, z - 0.34),
      new THREE.Vector3(1.30, 0.18, z - 0.34),
      new THREE.Vector3(0.55, -0.38, z - 0.34)
    ];
    this.serpentineBelt = this.tube(beltPoints, 0.055, this.matRubber, 100, 10, true);
    drive.add(this.serpentineBelt);
    this.registerPart(this.serpentineBelt, this.meta('Serpentine Accessory Belt', 'Front Drive', 'Single multi-rib accessory belt', 'Routes crankshaft power to water pump, alternator, power steering and A/C through tensioner/idler pulleys.'));

    this.subassemblies.frontDrive = drive;
    this.group.add(drive);
    this.rememberExplode(drive, new THREE.Vector3(0, 0, -2.5));
  }

  createPulley(radius, width, x, y, z, label, material = this.matSteel) {
    const g = new THREE.Group();
    g.name = label.replace(/\s+/g, '_');
    g.position.set(x, y, z);
    const rim = this.cyl(radius, width, material, null, 36);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    const hub = this.cyl(radius * 0.28, width * 1.12, this.matJournal, null, 24);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    this.pulleys.push(g);
    this.registerPart(rim, this.meta(label, 'Front Drive', 'Belt-driven accessory pulley', 'Stock front-drive pulley represented at the correct functional location.'));
    return g;
  }

  createAlternator(x, y, z) {
    const g = new THREE.Group();
    g.name = 'Alternator';
    g.position.set(x, y, z);
    const body = this.cyl(0.42, 0.48, this.matAluminum, null, 36);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * PI2;
      const slot = this.box(0.05, 0.16, 0.05, this.matIron, new THREE.Vector3(Math.cos(a) * 0.34, Math.sin(a) * 0.34, -0.25));
      slot.rotation.z = a;
      g.add(slot);
    }
    const wind = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.045, 8, 32), this.matCopper);
    wind.position.z = -0.25;
    g.add(wind);
    const pulley = this.createPulley(0.22, 0.13, 0, 0, -0.31, 'Alternator Pulley', this.matSteel);
    g.add(pulley);
    this.registerPart(body, this.meta('Alternator', 'Front Drive', 'GMT800 charging-system alternator representation', 'Belt-driven alternator mounted high at the front accessory bracket.'));
    return g;
  }

  createPumpAccessory(x, y, z, label, pulleyR, clutch = false) {
    const g = new THREE.Group();
    g.name = label.replace(/\s+/g, '_');
    g.position.set(x, y, z);
    const body = this.cyl(pulleyR * 0.78, 0.48, this.matAluminum, null, 30);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const pulley = this.createPulley(pulleyR, 0.15, 0, 0, -0.28, `${label} Pulley`, this.matSteel);
    g.add(pulley);
    if (clutch) {
      const clutchPlate = this.cyl(pulleyR * 0.72, 0.045, this.matSteel, new THREE.Vector3(0, 0, -0.37), 28);
      clutchPlate.rotation.x = Math.PI / 2;
      g.add(clutchPlate);
    }
    this.registerPart(body, this.meta(label, 'Front Drive', 'Belt-driven accessory', `Stock-style ${label.toLowerCase()} body and mounting location.`));
    return g;
  }

  // ---------------------------------------------------------------------------
  // STARTER / FILTER / SENSORS / DIPSTICK
  // ---------------------------------------------------------------------------
  buildAccessoriesAndSensors() {
    // Oil filter lower driver side.
    const filter = new THREE.Group();
    filter.name = 'Oil_Filter_Assembly';
    filter.position.set(-1.16, -0.64, 1.28);
    filter.rotation.z = -12 * DEG;
    const filterBody = this.cyl(0.26, 0.78, this.matComposite, null, 28);
    filter.add(filterBody);
    const base = this.cyl(0.29, 0.08, this.matSteel, new THREE.Vector3(0, 0.41, 0), 28);
    filter.add(base);
    this.subassemblies.oilFilter = filter;
    this.group.add(filter);
    this.registerPart(filterBody, this.meta('Spin-On Engine Oil Filter', 'Lubrication', 'Lower driver-side filter location', 'Threads onto the block/oil-filter pad and filters pressurized engine oil.'));
    this.rememberExplode(filter, new THREE.Vector3(-1.5, -0.6, 0));

    // Starter lower passenger rear near flexplate.
    const starter = new THREE.Group();
    starter.name = 'Starter_Motor_Assembly';
    starter.position.set(1.16, -0.36, 1.67);
    const starterBody = this.cyl(0.26, 0.90, this.matSteel, null, 28);
    starterBody.rotation.x = Math.PI / 2;
    starter.add(starterBody);
    const solenoid = this.cyl(0.14, 0.62, this.matConnector, new THREE.Vector3(0, 0.26, 0), 22);
    solenoid.rotation.x = Math.PI / 2;
    starter.add(solenoid);
    const pinion = this.cyl(0.105, 0.16, this.matJournal, new THREE.Vector3(0, -0.02, 0.50), 18);
    pinion.rotation.x = Math.PI / 2;
    starter.add(pinion);
    this.subassemblies.starterMotor = starter;
    this.group.add(starter);
    this.registerPart(starterBody, this.meta('Starter Motor', 'Starting System', 'Passenger-side Gen III starter location', 'Engages the flexplate ring gear at the rear of the engine.'));
    this.rememberExplode(starter, new THREE.Vector3(1.6, -0.4, 0.5));

    // Dipstick tube and yellow handle, passenger side.
    const dipstick = this.tube([
      new THREE.Vector3(1.12, -0.50, -0.35),
      new THREE.Vector3(1.55, 0.45, -0.75),
      new THREE.Vector3(1.72, 1.42, -1.12)
    ], 0.025, this.matSteel, 24, 8);
    this.group.add(dipstick);
    const dipHandle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 24), this.matYellow);
    dipHandle.rotation.y = Math.PI / 2;
    dipHandle.position.set(1.72, 1.52, -1.12);
    this.group.add(dipHandle);

    // ECT sensor front head area.
    const ect = this.cyl(0.055, 0.16, this.matCopper, new THREE.Vector3(-1.32, 1.74, -1.92), 12);
    ect.rotation.z = 45 * DEG;
    this.group.add(ect);
    this.registerPart(ect, this.meta('Engine Coolant Temperature Sensor', 'Sensors', 'Front cylinder-head coolant temperature sensor', 'Reports engine coolant temperature to the PCM.'));

    // Oil pressure sender rear/top.
    const oilPressure = this.cyl(0.075, 0.20, this.matConnector, new THREE.Vector3(0.18, 1.45, 1.93), 16);
    this.group.add(oilPressure);
    this.registerPart(oilPressure, this.meta('Engine Oil Pressure Sensor', 'Sensors', 'Rear upper block oil-pressure sender', 'Monitors main oil-gallery pressure.'));

    // Cam sensor rear of block / valley area.
    const camSensor = this.box(0.12, 0.18, 0.26, this.matConnector, new THREE.Vector3(0, 1.18, 2.14));
    this.group.add(camSensor);
    this.registerPart(camSensor, this.meta('Camshaft Position Sensor', 'Sensors', 'Gen III rear cam position sensing location', 'Provides cam phase reference to the PCM.'));

    // Crank sensor right rear lower block.
    const crankSensor = this.box(0.12, 0.16, 0.26, this.matConnector, new THREE.Vector3(1.18, -0.10, 1.88));
    this.group.add(crankSensor);
    this.registerPart(crankSensor, this.meta('Crankshaft Position Sensor', 'Sensors', 'Gen III 24X crank position sensing', 'Reads the 24X reluctor wheel at the rear of the crankshaft.'));
  }

  // ---------------------------------------------------------------------------
  // HOSES / HARNESS / PCV
  // ---------------------------------------------------------------------------
  buildPlumbingAndHarness() {
    const g = new THREE.Group();
    g.name = 'Engine_Hoses_Wiring_Harness';

    // Main top harness.
    const loom = this.tube([
      new THREE.Vector3(0, 2.94, -1.85),
      new THREE.Vector3(0, 3.02, -0.55),
      new THREE.Vector3(0.02, 2.98, 0.72),
      new THREE.Vector3(0.12, 2.82, 1.78)
    ], 0.07, this.matRubber, 34, 10);
    g.add(loom);

    // Injector / coil branch harnesses.
    for (const bank of ['L', 'R']) {
      const side = bank === 'L' ? -1 : 1;
      for (let i = 0; i < 4; i++) {
        const z = this.cylinderZ(bank, i);
        const branch = this.tube([
          new THREE.Vector3(0, 2.98, z),
          new THREE.Vector3(side * 0.55, 2.78, z),
          new THREE.Vector3(side * 1.30, 2.28, z)
        ], 0.022, this.matRubber, 14, 7);
        g.add(branch);
      }
    }

    // PCV / crankcase ventilation connection.
    const pcv = this.tube([
      new THREE.Vector3(-1.25, 2.14, 1.25),
      new THREE.Vector3(-0.65, 2.55, 1.22),
      new THREE.Vector3(-0.28, 2.75, 0.82)
    ], 0.045, this.matRubber, 22, 8);
    g.add(pcv);

    // Upper radiator outlet hose stub and lower inlet stub.
    const upper = this.tube([
      new THREE.Vector3(-0.30, 1.18, -2.60),
      new THREE.Vector3(-0.65, 1.45, -2.92),
      new THREE.Vector3(-1.15, 1.55, -3.08)
    ], 0.13, this.matRubber, 22, 12);
    g.add(upper);
    const lower = this.tube([
      new THREE.Vector3(0.52, 0.55, -2.58),
      new THREE.Vector3(0.94, 0.30, -2.90),
      new THREE.Vector3(1.32, 0.22, -3.10)
    ], 0.14, this.matRubber, 22, 12);
    g.add(lower);

    this.subassemblies.plumbing = g;
    this.group.add(g);
    this.rememberExplode(g, new THREE.Vector3(0, 3.0, 0));
  }

  // ---------------------------------------------------------------------------
  // STATE / KINEMATICS
  // ---------------------------------------------------------------------------
  setRPM(targetRpm) {
    this.rpm = Math.max(0, targetRpm);
    this.isRevving = this.rpm > 0;
  }

  setExploded(factor) {
    this.explodeFactor = THREE.MathUtils.clamp(factor, 0, 1);
    this.updateExplodedTransforms();
  }

  setXRay(enabled) {
    this.isXRay = enabled;
    for (const mat of this.xrayMaterials) {
      mat.transparent = enabled;
      mat.opacity = enabled ? 0.20 : 1.0;
      mat.depthWrite = !enabled;
      mat.needsUpdate = true;
    }
  }

  wrapCycle(a) {
    return ((a % PI4) + PI4) % PI4;
  }

  cyclicDistance(a, b, period = PI4) {
    let d = ((a - b + period * 0.5) % period + period) % period - period * 0.5;
    return Math.abs(d);
  }

  valvePulse(cycle, center, width) {
    const d = this.cyclicDistance(cycle, this.wrapCycle(center), PI4);
    if (d >= width) return 0;
    return 0.5 + 0.5 * Math.cos(Math.PI * d / width);
  }

  updateValvetrain() {
    const cycle = this.wrapCycle(this.crankAngle);
    const maxValveLift = inch(0.47); // visual/representative stock lift envelope, not a claimed cam grind number

    for (const e of this.valveEvents) {
      // Four-stroke sequence referenced to cylinder firing at e.firingAngle:
      // power -> exhaust -> intake -> compression -> fire.
      const exhaustCenter = e.firingAngle + Math.PI * 1.55;
      const intakeCenter = e.firingAngle + Math.PI * 2.55;
      const exhaustLift = this.valvePulse(cycle, exhaustCenter, 0.62 * Math.PI) * maxValveLift;
      const intakeLift = this.valvePulse(cycle, intakeCenter, 0.62 * Math.PI) * maxValveLift;

      for (const v of e.valves) {
        const lift = v.type === 'intake' ? intakeLift : exhaustLift;
        v.group.position.copy(v.base).addScaledVector(v.axis, -lift);
        v.spring.scale.y = 1.55 - lift * 0.7;
      }
      for (const l of e.lifters) {
        const lift = l.type === 'intake' ? intakeLift : exhaustLift;
        l.mesh.position.copy(l.base).addScaledVector(e.axis.vec, lift / this.spec.architecture.rockerRatio);
      }
      for (const r of e.rockers) {
        const lift = r.type === 'intake' ? intakeLift : exhaustLift;
        r.group.rotation.z = r.baseRot + (r.type === 'intake' ? -1 : 1) * lift * 0.9;
      }
    }
  }

  update(delta) {
    if (!this.isRevving || this.rpm <= 0) return;
    const radPerSec = this.rpm * PI2 / 60;
    this.crankAngle = (this.crankAngle + radPerSec * delta) % PI4;

    if (this.crankshaft) this.crankshaft.rotation.z = this.crankAngle;
    if (this.camshaft) this.camshaft.rotation.z = this.crankAngle * 0.5;
    for (const p of this.pistons) this.updatePiston(p);
    this.updateValvetrain();

    for (let i = 0; i < this.pulleys.length; i++) {
      const pulley = this.pulleys[i];
      pulley.rotation.z += radPerSec * delta * (i === 0 ? 1 : 1.15);
    }
  }

  updateExplodedTransforms() {
    const f = this.explodeFactor;
    for (const item of this.explodables) {
      const base = item.userData.explodeBase;
      const vec = item.userData.explodeVector;
      if (!base || !vec) continue;
      item.position.copy(base).addScaledVector(vec, f);
    }
  }
}
