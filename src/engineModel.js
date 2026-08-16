import * as THREE from 'three';
import { TextureGenerator } from './textures.js';

/**
 * Ultra-Realistic CAD Procedural Apex-V8 5.0L Twin-Turbo Racing Engine Model.
 * Built using high-precision Three.js geometric construction:
 * - Extruded V8 block with curved valley and ribbed skirt
 * - Contoured cylinder heads with port bumps and domed valve covers
 * - Detailed plumbing, hoses, wiring looms, and sensors
 * - Advanced Twin Turbos with detailed compressor covers
 */
export class EngineModel {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ApexV8Engine';

    // Interactive Inspectable Meshes Registry
    this.inspectableParts = [];

    // Materials
    this.initMaterials();

    // Kinematic Components
    this.crankshaft = null;
    this.flywheel = null;
    this.pistons = [];
    this.camshafts = [];
    this.valves = [];
    this.turbos = [];
    this.pulleys = [];
    this.timingBelt = null;
    this.exhaustHeaders = [];
    this.flameParticles = null;

    // Subassemblies for Exploded View
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
      plumbing: null
    };

    // Engine State
    this.crankAngle = 0;
    this.rpm = 850;
    this.isRevving = false;
    this.explodeFactor = 0;
    this.isXRay = false;

    this.buildEngine();
    this.buildFlameFX();
  }

  initMaterials() {
    this.texCasting = TextureGenerator.createCastingGrainTexture();
    this.texCarbon = TextureGenerator.createCarbonFiberTexture();
    this.texBrushed = TextureGenerator.createBrushedMetalTexture();
    this.texBelt = TextureGenerator.createBeltGrooveTexture();

    this.matBlock = new THREE.MeshStandardMaterial({
      color: 0x48505e, metalness: 0.85, roughness: 0.38,
      bumpMap: this.texCasting, bumpScale: 0.015, name: 'CastAluminumBlock'
    });

    this.matIron = new THREE.MeshStandardMaterial({
      color: 0x222630, metalness: 0.8, roughness: 0.55,
      bumpMap: this.texCasting, bumpScale: 0.02, name: 'CastIronSkirt'
    });

    this.matLiner = new THREE.MeshStandardMaterial({
      color: 0xf4f7fa, metalness: 0.98, roughness: 0.06, name: 'PolishedLiner'
    });

    this.matForged = new THREE.MeshStandardMaterial({
      color: 0x86909c, metalness: 0.92, roughness: 0.22,
      bumpMap: this.texBrushed, bumpScale: 0.008, name: 'Forged4340Steel'
    });

    this.matPiston = new THREE.MeshStandardMaterial({
      color: 0xd4dbe6, metalness: 0.9, roughness: 0.18,
      bumpMap: this.texBrushed, bumpScale: 0.005, name: 'BilletPiston'
    });

    this.matAnodized = new THREE.MeshStandardMaterial({
      color: 0xd90429, metalness: 0.78, roughness: 0.22, name: 'AnodizedValveCover'
    });

    this.matPlenum = new THREE.MeshStandardMaterial({
      color: 0x181a20, roughness: 0.28, metalness: 0.25,
      map: this.texCarbon, name: 'CarbonPlenum'
    });

    this.matHeader = new THREE.MeshStandardMaterial({
      color: 0xd0c4b2, metalness: 0.96, roughness: 0.14,
      emissive: 0x000000, emissiveIntensity: 0.0, name: 'StainlessHeaders'
    });

    this.matGold = new THREE.MeshStandardMaterial({
      color: 0xd4af37, metalness: 0.92, roughness: 0.18, name: 'MachinedGold'
    });

    this.matAnodizedBlue = new THREE.MeshStandardMaterial({
      color: 0x0077b6, metalness: 0.85, roughness: 0.2, name: 'AnodizedBlue'
    });

    this.matBelt = new THREE.MeshStandardMaterial({
      color: 0x111215, roughness: 0.9, metalness: 0.05,
      bumpMap: this.texBelt, bumpScale: 0.02, name: 'RubberBelt'
    });

    this.matTurboComp = new THREE.MeshStandardMaterial({
      color: 0xe6ebf2, metalness: 0.95, roughness: 0.14, name: 'TurboCompressor'
    });

    this.matTurboTurb = new THREE.MeshStandardMaterial({
      color: 0x544840, metalness: 0.75, roughness: 0.6,
      bumpMap: this.texCasting, bumpScale: 0.02, name: 'TurboTurbine'
    });

    this.matPorcelain = new THREE.MeshStandardMaterial({
      color: 0xfcfcfc, roughness: 0.1, metalness: 0.05, name: 'CeramicPorcelain'
    });

    this.matGasket = new THREE.MeshStandardMaterial({
      color: 0xb87333, metalness: 0.88, roughness: 0.28, name: 'CopperGasket'
    });

    this.matBraided = new THREE.MeshStandardMaterial({
      color: 0xa0a8b4, metalness: 0.9, roughness: 0.35,
      bumpMap: this.texCarbon, bumpScale: 0.015, name: 'BraidedHose'
    });
  }

  registerPart(mesh, metadata) {
    mesh.userData = metadata;
    this.inspectableParts.push(mesh);
  }

  buildEngine() {
    this.buildBlockAndOilPan();
    this.buildCrankAndFlywheel();
    this.buildPistonsAndRods();
    this.buildCylinderHeadsAndValves();
    this.buildIntakeSystem();
    this.buildExhaustAndTurbos();
    this.buildFrontDrive();
    this.buildAccessories();
    this.buildFuelSystem();
    this.buildPlumbingAndWiring();
  }

  // --- 1. Engine Block & Deep Sump Oil Pan ---
  buildBlockAndOilPan() {
    const blockGroup = new THREE.Group();
    blockGroup.name = 'EngineBlockGroup';

    // 1. Extruded Engine Block with Curved Valley
    const blockShape = new THREE.Shape();
    blockShape.moveTo(0, -0.2); // Bottom center
    blockShape.lineTo(1.15, -0.2); // Bottom right
    blockShape.lineTo(1.15, 0.5); // Side right
    blockShape.lineTo(1.5, 0.8); // Water jacket bulge right
    blockShape.lineTo(1.5, 1.4); // Right bank lower edge
    blockShape.lineTo(1.05, 1.85); // Right bank deck outer edge
    blockShape.lineTo(0.35, 1.15); // Right bank inner valley
    blockShape.quadraticCurveTo(0, 0.9, -0.35, 1.15); // Curved valley
    blockShape.lineTo(-1.05, 1.85); // Left bank deck outer edge
    blockShape.lineTo(-1.5, 1.4); // Left bank lower edge
    blockShape.lineTo(-1.5, 0.8); // Water jacket bulge left
    blockShape.lineTo(-1.15, 0.5); // Side left
    blockShape.lineTo(-1.15, -0.2); // Bottom left
    blockShape.lineTo(0, -0.2); // Close

    const extrudeSettings = {
      depth: 4.1,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 2,
      bevelSize: 0.04,
      bevelThickness: 0.04
    };

    const blockMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(blockShape, extrudeSettings), this.matBlock);
    blockMesh.position.set(0, -0.05, -2.05); // Center longitudinally
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;
    blockGroup.add(blockMesh);

    this.registerPart(blockMesh, {
      name: 'Extruded Cast Aluminum V8 Engine Block',
      category: 'Engine Block',
      specs: '356-T6 Aluminum • Cross-Bolted Mains • Curved Lifter Valley',
      description: 'Massively reinforced bottom-end architecture with contoured water jackets.'
    });

    // 2. Ribbed Lower Skirt (Crankcase)
    const skirtShape = new THREE.Shape();
    skirtShape.moveTo(-1.2, -0.2);
    skirtShape.lineTo(1.2, -0.2);
    skirtShape.lineTo(1.25, -0.8);
    skirtShape.lineTo(-1.25, -0.8);
    skirtShape.lineTo(-1.2, -0.2);
    
    const skirtGeom = new THREE.ExtrudeGeometry(skirtShape, { depth: 4.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 });
    const skirt = new THREE.Mesh(skirtGeom, this.matIron);
    skirt.position.set(0, -0.05, -2.05);
    blockGroup.add(skirt);

    // Cross-bolted main cap hex bolts on the skirt side
    for (let b = 0; b < 5; b++) {
      const zPos = -1.6 + b * 0.8;
      [-1.25, 1.25].forEach(xPos => {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 6), this.matGold);
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(xPos, -0.5, zPos);
        blockGroup.add(bolt);
      });
    }

    // Cylinders / Sleeves
    const boreGeom = new THREE.CylinderGeometry(0.45, 0.45, 1.7, 32, 1, true);
    
    // Left Bank (+45°)
    const boreZ_L = [-1.35, -0.45, 0.45, 1.35];
    boreZ_L.forEach((bz, idx) => {
      const bore = new THREE.Mesh(boreGeom, this.matLiner);
      bore.rotation.z = Math.PI / 4;
      bore.position.set(-0.65, 1.1, bz);
      blockGroup.add(bore);
    });

    // Right Bank (-45°)
    const boreZ_R = [-1.20, -0.30, 0.60, 1.50];
    boreZ_R.forEach((bz, idx) => {
      const bore = new THREE.Mesh(boreGeom, this.matLiner);
      bore.rotation.z = -Math.PI / 4;
      bore.position.set(0.65, 1.1, bz);
      blockGroup.add(bore);
    });

    // Freeze plugs on the side of the block
    for(let p=0; p<3; p++) {
      const zPos = -1.0 + p * 1.0;
      [-1.5, 1.5].forEach(px => {
        const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), this.matGold);
        plug.rotation.z = Math.PI / 2;
        plug.position.set(px, 0.8, zPos);
        blockGroup.add(plug);
      });
    }

    // Knock sensors in the valley
    [-0.45, 0.45].forEach(z => {
      const knock = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15, 16), this.matForged);
      knock.position.set(0, 1.0, z);
      blockGroup.add(knock);
    });

    this.subassemblies.block = blockGroup;
    this.group.add(blockGroup);

    // 3. Deep Sump Ribbed Oil Pan
    const panGroup = new THREE.Group();
    panGroup.name = 'OilPanGroup';

    const panShape = new THREE.Shape();
    panShape.moveTo(-1.25, 0);
    panShape.lineTo(1.25, 0);
    panShape.lineTo(1.1, -0.5);
    panShape.lineTo(1.1, -1.0);
    panShape.lineTo(-1.1, -1.0);
    panShape.lineTo(-1.1, -0.5);
    panShape.lineTo(-1.25, 0);

    const panBody = new THREE.Mesh(new THREE.ExtrudeGeometry(panShape, { depth: 3.8, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 }), this.matForged);
    panBody.position.set(0, -0.85, -1.9);
    panBody.castShadow = true;
    panGroup.add(panBody);

    // Perimeter Bolts
    for (let b = 0; b < 8; b++) {
      const bz = -1.7 + b * 0.48;
      [-1.2, 1.2].forEach(bx => {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 6), this.matGold);
        bolt.position.set(bx, -0.85, bz);
        panGroup.add(bolt);
      });
    }

    // Drain plug
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 6), this.matGold);
    plug.position.set(0, -1.85, 1.5);
    panGroup.add(plug);

    this.subassemblies.oilPan = panGroup;
    this.group.add(panGroup);
  }

  // --- 2. Forged Cross-Plane Crankshaft & Flywheel ---
  buildCrankAndFlywheel() {
    this.crankshaft = new THREE.Group();
    this.crankshaft.name = 'CrankshaftAssembly';
    this.crankshaft.position.set(0, -0.15, 0);

    const shaftGeom = new THREE.CylinderGeometry(0.2, 0.2, 4.4, 32);
    const mainShaft = new THREE.Mesh(shaftGeom, this.matLiner);
    mainShaft.rotation.x = Math.PI / 2;
    this.crankshaft.add(mainShaft);

    const crankPinPhases = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    const crankRadius = 0.35;

    for (let c = 0; c < 4; c++) {
      const zPos = -1.35 + c * 0.9;
      const phase = crankPinPhases[c];

      // Counterweight with rounded lathe profile
      const webShape = new THREE.Shape();
      webShape.moveTo(0, 0);
      webShape.lineTo(0.65, 0);
      webShape.quadraticCurveTo(0.7, 0.1, 0.65, 0.32);
      webShape.lineTo(0, 0.32);
      
      const webGeom = new THREE.ExtrudeGeometry(webShape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 });
      const web = new THREE.Mesh(webGeom, this.matForged);
      web.rotation.z = phase + Math.PI;
      web.position.set(Math.cos(phase + Math.PI) * 0.25, Math.sin(phase + Math.PI) * 0.25, zPos - 0.09);
      this.crankshaft.add(web);

      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 32), this.matLiner);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(Math.cos(phase) * crankRadius, Math.sin(phase) * crankRadius, zPos);
      this.crankshaft.add(pin);
    }

    this.flywheel = new THREE.Group();
    const flywheelMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.22, 48), this.matForged);
    flywheelMesh.rotation.x = Math.PI / 2;
    this.flywheel.add(flywheelMesh);

    const ringMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.08, 64), this.matForged);
    ringMesh.rotation.x = Math.PI / 2;
    this.flywheel.add(ringMesh);

    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 6), this.matGold);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0);
      this.flywheel.add(bolt);
    }

    this.flywheel.position.set(0, 0, 2.2);
    this.crankshaft.add(this.flywheel);

    this.subassemblies.crankGroup = this.crankshaft;
    this.group.add(this.crankshaft);
  }

  // --- 3. 8 Forged Pistons & Connecting Rods ---
  buildPistonsAndRods() {
    const crankPinPhases = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

    for (let i = 0; i < 4; i++) {
      const zL = -1.35 + i * 0.9;
      const zR = -1.20 + i * 0.9;
      const phase = crankPinPhases[i];

      this.createPistonAssembly('L', i, phase, Math.PI / 4, zL);
      this.createPistonAssembly('R', i + 4, phase + Math.PI / 2, -Math.PI / 4, zR);
    }
  }

  createPistonAssembly(bank, index, phase, bankAngle, zPos) {
    const assemblyGroup = new THREE.Group();
    assemblyGroup.name = `PistonAssembly_${index}_${bank}`;
    assemblyGroup.rotation.z = bankAngle;
    assemblyGroup.position.set(0, -0.15, zPos);

    // Domed Piston Crown
    const crownShape = new THREE.Shape();
    crownShape.moveTo(0, 0);
    crownShape.lineTo(0.44, 0);
    crownShape.lineTo(0.44, 0.35);
    crownShape.quadraticCurveTo(0.2, 0.45, 0, 0.45);
    
    const crownGeom = new THREE.LatheGeometry(crownShape.getPoints(), 32);
    const crown = new THREE.Mesh(crownGeom, this.matPiston);
    crown.castShadow = true;

    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.445, 0.445, 0.02, 32), this.matForged);
      ring.position.y = 0.25 - r * 0.07;
      crown.add(ring);
    }

    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.65, 32), this.matLiner);
    pin.rotation.z = Math.PI / 2;
    pin.position.y = 0.1;
    crown.add(pin);

    const conRodGroup = new THREE.Group();
    const rodLength = 1.35;
    
    // I-Beam rod with ExtrudeGeometry
    const rodShape = new THREE.Shape();
    rodShape.moveTo(-0.06, -rodLength);
    rodShape.lineTo(0.06, -rodLength);
    rodShape.lineTo(0.04, 0);
    rodShape.lineTo(-0.04, 0);
    rodShape.lineTo(-0.06, -rodLength);
    const rodBeam = new THREE.Mesh(new THREE.ExtrudeGeometry(rodShape, {depth: 0.16, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01}), this.matForged);
    rodBeam.position.z = -0.08;
    conRodGroup.add(rodBeam);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 32), this.matForged);
    cap.rotation.x = Math.PI / 2;
    cap.position.y = -rodLength;
    conRodGroup.add(cap);

    [-0.15, 0.15].forEach(bx => {
      const rodBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 6), this.matGold);
      rodBolt.position.set(bx, -rodLength + 0.05, 0);
      conRodGroup.add(rodBolt);
    });

    assemblyGroup.add(crown);
    assemblyGroup.add(conRodGroup);
    this.group.add(assemblyGroup);

    this.pistons.push({
      group: assemblyGroup, crown: crown, conRod: conRodGroup,
      bank: bank, bankAngle: bankAngle, phase: phase,
      zPos: zPos, rodLength: rodLength, crankRadius: 0.35
    });
  }

  // --- 4. Cylinder Heads & Billet Valve Covers ---
  buildCylinderHeadsAndValves() {
    const headL = this.createCylinderHead('L', Math.PI / 4, 1.95, -0.65, 1.1);
    this.subassemblies.leftHead = headL;
    this.group.add(headL);

    const headR = this.createCylinderHead('R', -Math.PI / 4, 1.95, 0.65, 1.1);
    this.subassemblies.rightHead = headR;
    this.group.add(headR);

    const coverL = this.createValveCover('L', Math.PI / 4, 2.70, -0.65, 1.1);
    this.subassemblies.leftValveCover = coverL;
    this.group.add(coverL);

    const coverR = this.createValveCover('R', -Math.PI / 4, 2.70, 0.65, 1.1);
    this.subassemblies.rightValveCover = coverR;
    this.group.add(coverR);
  }

  createCylinderHead(bank, bankAngle, deckDist, pivotX, pivotY) {
    const headGroup = new THREE.Group();
    headGroup.name = `CylinderHead_${bank}`;
    headGroup.rotation.z = bankAngle;
    headGroup.position.set(pivotX, pivotY, 0); // Position at block deck

    // Contoured Cylinder Head Casting using Extrude
    const headShape = new THREE.Shape();
    headShape.moveTo(-0.7, 0);
    headShape.lineTo(0.7, 0);
    // Exhaust port bump
    headShape.lineTo(0.7, 0.3);
    headShape.quadraticCurveTo(0.85, 0.45, 0.7, 0.6);
    headShape.lineTo(0.45, 0.75);
    headShape.lineTo(-0.45, 0.75);
    // Intake port bump
    headShape.lineTo(-0.7, 0.6);
    headShape.quadraticCurveTo(-0.85, 0.45, -0.7, 0.3);
    headShape.lineTo(-0.7, 0);

    const extrudeSettings = { depth: 4.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 };
    const casting = new THREE.Mesh(new THREE.ExtrudeGeometry(headShape, extrudeSettings), this.matBlock);
    casting.position.set(0, 0, -2.05);
    casting.castShadow = true;
    headGroup.add(casting);

    // Copper MLS Gasket
    const gasket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 4.15), this.matGasket);
    gasket.position.y = -0.015;
    headGroup.add(gasket);

    // 4 Spark Plugs
    const boreZs = bank === 'L' ? [-1.35, -0.45, 0.45, 1.35] : [-1.20, -0.30, 0.60, 1.50];
    boreZs.forEach(bz => {
      const sparkPlug = new THREE.Group();
      sparkPlug.position.set(0, 0.45, bz);

      const hexBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 6), this.matGold);
      sparkPlug.add(hexBase);

      const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.22, 16), this.matPorcelain);
      insulator.position.y = 0.16;
      sparkPlug.add(insulator);

      const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 16), this.matLiner);
      terminal.position.y = 0.3;
      sparkPlug.add(terminal);

      headGroup.add(sparkPlug);
    });

    // Dual Camshafts
    [-0.32, 0.32].forEach(cx => {
      const camGroup = new THREE.Group();
      camGroup.position.set(cx, 0.6, 0);

      const camShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.15, 32), this.matLiner);
      camShaft.rotation.x = Math.PI / 2;
      camGroup.add(camShaft);

      for (let v = 0; v < 8; v++) {
        const lobe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.1, 16), this.matForged);
        lobe.rotation.x = Math.PI / 2;
        lobe.rotation.z = (v * Math.PI) / 4;
        lobe.position.set(0, 0, -1.6 + v * 0.46);
        camGroup.add(lobe);
      }

      headGroup.add(camGroup);
      this.camshafts.push(camGroup);
    });

    // 16 Valves
    for (let v = 0; v < 8; v++) {
      const zPos = -1.6 + v * 0.46;
      [-0.32, 0.32].forEach(vx => {
        const valveGroup = new THREE.Group();
        valveGroup.position.set(vx, 0.3, zPos);

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 16), this.matLiner);
        valveGroup.add(stem);

        const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.28, 16), this.matGold);
        spring.position.y = 0.08;
        valveGroup.add(spring);

        headGroup.add(valveGroup);
        this.valves.push(valveGroup);
      });
    }

    return headGroup;
  }

  createValveCover(bank, bankAngle, baseDist, pivotX, pivotY) {
    const coverGroup = new THREE.Group();
    coverGroup.name = `ValveCover_${bank}`;
    coverGroup.rotation.z = bankAngle;
    coverGroup.position.set(pivotX, pivotY, 0);

    // Domed Valve Cover Profile
    const coverShape = new THREE.Shape();
    coverShape.moveTo(-0.7, 0);
    coverShape.lineTo(0.7, 0);
    coverShape.lineTo(0.7, 0.1);
    coverShape.quadraticCurveTo(0, 0.5, -0.7, 0.1);
    coverShape.lineTo(-0.7, 0);

    const extrudeSettings = { depth: 4.15, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 };
    const cover = new THREE.Mesh(new THREE.ExtrudeGeometry(coverShape, extrudeSettings), this.matAnodized);
    cover.position.set(0, 0.75, -2.075);
    cover.castShadow = true;
    coverGroup.add(cover);

    // Embossed ribs
    for (let f = 0; f < 5; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 3.8), this.matTurboComp);
      // Position ribs along the dome
      const xOffset = -0.4 + f * 0.2;
      const yOffset = 0.75 + 0.1 + (0.5 - 0.1) * (1 - Math.pow(xOffset/0.7, 2)) + 0.03;
      fin.position.set(xOffset, yOffset, 0);
      coverGroup.add(fin);
    }

    // Coil Packs
    const boreZs = bank === 'L' ? [-1.35, -0.45, 0.45, 1.35] : [-1.20, -0.30, 0.60, 1.50];
    boreZs.forEach((bz, idx) => {
      const coil = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.24), this.matPlenum);
      coil.position.set(0, 0.75 + 0.35, bz);
      coverGroup.add(coil);

      const term = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), this.matGold);
      term.position.set(0, 0.75 + 0.45, bz);
      coverGroup.add(term);
    });

    // PCV Valve
    if (bank === 'R') {
      const pcv = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15, 16), this.matAnodizedBlue);
      pcv.position.set(0.3, 0.95, -1.5);
      coverGroup.add(pcv);
    }

    // Oil Filler Cap
    if (bank === 'L') {
      const capNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 32), this.matGold);
      capNeck.position.set(-0.35, 1.0, 1.4);
      coverGroup.add(capNeck);
    }

    // Perimeter Bolts
    for(let b=0; b<6; b++) {
      const bz = -1.9 + b*0.76;
      [-0.65, 0.65].forEach(bx => {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6), this.matGold);
        bolt.position.set(bx, 0.75, bz);
        coverGroup.add(bolt);
      });
    }

    return coverGroup;
  }

  // --- 5. Carbon Fiber Intake Plenum & Swept Velocity Runners ---
  buildIntakeSystem() {
    const intakeGroup = new THREE.Group();
    intakeGroup.name = 'IntakeSystemGroup';
    intakeGroup.position.set(0, 1.8, 0);

    // Domed Plenum
    const plenumShape = new THREE.Shape();
    plenumShape.moveTo(-0.7, 0);
    plenumShape.lineTo(0.7, 0);
    plenumShape.quadraticCurveTo(0.7, 0.5, 0, 0.6);
    plenumShape.quadraticCurveTo(-0.7, 0.5, -0.7, 0);
    const plenum = new THREE.Mesh(new THREE.ExtrudeGeometry(plenumShape, {depth: 3.6, bevelEnabled: true}), this.matPlenum);
    plenum.position.set(0, 0.1, -1.8);
    plenum.castShadow = true;
    intakeGroup.add(plenum);

    // 8 Curved Mandrel-Swept Carbon Velocity Runners
    for (let r = 0; r < 4; r++) {
      const zL = -1.35 + r * 0.9;
      const zR = -1.20 + r * 0.9;

      const curveL = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.4, 0.3, zL),
        new THREE.Vector3(-0.8, 0.4, zL),
        new THREE.Vector3(-1.3, -0.1, zL)
      ]);
      const runnerL = new THREE.Mesh(new THREE.TubeGeometry(curveL, 32, 0.16, 16), this.matPlenum);
      runnerL.castShadow = true;
      intakeGroup.add(runnerL);

      const curveR = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.4, 0.3, zR),
        new THREE.Vector3(0.8, 0.4, zR),
        new THREE.Vector3(1.3, -0.1, zR)
      ]);
      const runnerR = new THREE.Mesh(new THREE.TubeGeometry(curveR, 32, 0.16, 16), this.matPlenum);
      runnerR.castShadow = true;
      intakeGroup.add(runnerR);
    }

    // Dual 85mm Billet Throttle Bodies
    [-0.35, 0.35].forEach(tx => {
      const tbBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 32), this.matForged);
      tbBody.rotation.x = Math.PI / 2;
      tbBody.position.set(tx, 0.3, -1.95);
      intakeGroup.add(tbBody);

      // Flared velocity trumpet bellmouth
      const trumpetShape = new THREE.Shape();
      trumpetShape.moveTo(0, 0);
      trumpetShape.lineTo(0.3, 0);
      trumpetShape.quadraticCurveTo(0.36, 0.1, 0.38, 0.2);
      trumpetShape.lineTo(0, 0.2);
      const trumpet = new THREE.Mesh(new THREE.LatheGeometry(trumpetShape.getPoints(), 32), this.matAnodizedBlue);
      trumpet.rotation.x = -Math.PI / 2;
      trumpet.position.set(tx, 0.3, -2.15);
      intakeGroup.add(trumpet);

      // Throttle linkage
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16), this.matGold);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(tx + 0.34, 0.3, -1.95);
      intakeGroup.add(wheel);
    });

    this.subassemblies.intakePlenum = intakeGroup;
    this.group.add(intakeGroup);
  }

  // --- 6. Equal-Length 4-into-1 Headers & Symmetrical Twin Turbos ---
  buildExhaustAndTurbos() {
    const exhaustL = this.createExhaustAndTurbo('L', -2.1, 0.4);
    this.subassemblies.leftExhaust = exhaustL.exhaust;
    this.subassemblies.leftTurbo = exhaustL.turbo;
    this.group.add(exhaustL.exhaust);
    this.group.add(exhaustL.turbo);

    const exhaustR = this.createExhaustAndTurbo('R', 2.1, 0.4);
    this.subassemblies.rightExhaust = exhaustR.exhaust;
    this.subassemblies.rightTurbo = exhaustR.turbo;
    this.group.add(exhaustR.exhaust);
    this.group.add(exhaustR.turbo);
  }

  createExhaustAndTurbo(bank, posX, posY) {
    const isLeft = bank === 'L';
    const exhaustGroup = new THREE.Group();
    exhaustGroup.name = `ExhaustHeaders_${bank}`;
    exhaustGroup.position.set(posX, posY, 0);

    const boreZs = isLeft ? [-1.35, -0.45, 0.45, 1.35] : [-1.20, -0.30, 0.60, 1.50];
    boreZs.forEach((bz) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(isLeft ? 0.75 : -0.75, 0.85, bz),
        new THREE.Vector3(isLeft ? 0.45 : -0.45, 0.45, bz * 0.6),
        new THREE.Vector3(isLeft ? 0.15 : -0.15, 0.1, 0.1),
        new THREE.Vector3(0, 0, 0.2)
      ]);
      const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.14, 16), this.matHeader);
      pipe.castShadow = true;
      exhaustGroup.add(pipe);
      this.exhaustHeaders.push(pipe);
    });

    // 4-into-1 Merge Collector Flange
    const collector = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.4, 32), this.matHeader);
    collector.rotation.x = Math.PI / 2;
    collector.position.set(0, 0, 0.2);
    exhaustGroup.add(collector);

    // Precision Twin Turbocharger Assembly
    const turboGroup = new THREE.Group();
    turboGroup.name = `Turbocharger_${bank}`;
    turboGroup.position.set(posX, posY - 0.1, 0.4);

    // Turbine Housing (Volute approximation using sweeping tube)
    const voluteCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.4, 0),
      new THREE.Vector3(0.3, 0.3, 0),
      new THREE.Vector3(0.4, 0, 0),
      new THREE.Vector3(0, -0.4, 0),
      new THREE.Vector3(-0.3, 0, 0),
      new THREE.Vector3(0, 0.2, 0)
    ], false);
    const turbMesh = new THREE.Mesh(new THREE.TubeGeometry(voluteCurve, 32, 0.15, 16), this.matTurboTurb);
    turbMesh.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;
    turboGroup.add(turbMesh);

    // Turbine Flange
    const tFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 32), this.matTurboTurb);
    tFlange.rotation.x = Math.PI / 2;
    tFlange.position.z = -0.1;
    turboGroup.add(tFlange);

    // CHRA (Center Housing)
    const chra = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.25, 32), this.matForged);
    chra.rotation.x = Math.PI / 2;
    chra.position.z = -0.22;
    turboGroup.add(chra);

    // Compressor Housing Volute
    const compVolute = new THREE.Mesh(new THREE.TubeGeometry(voluteCurve, 32, 0.16, 16), this.matTurboComp);
    compVolute.rotation.y = isLeft ? -Math.PI / 2 : Math.PI / 2;
    compVolute.position.z = -0.38;
    turboGroup.add(compVolute);

    // Flared Intake Horn
    const hornShape = new THREE.Shape();
    hornShape.moveTo(0, 0);
    hornShape.lineTo(0.28, 0);
    hornShape.quadraticCurveTo(0.32, 0.1, 0.36, 0.2);
    hornShape.lineTo(0, 0.2);
    const horn = new THREE.Mesh(new THREE.LatheGeometry(hornShape.getPoints(), 32), this.matAnodizedBlue);
    horn.rotation.x = -Math.PI / 2;
    horn.position.z = -0.38;
    turboGroup.add(horn);

    // Compressor Wheel
    const wheel = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.28, 16), this.matForged);
    wheel.geometry.rotateX(Math.PI / 2);
    wheel.position.z = -0.42;
    turboGroup.add(wheel);

    // Wastegate
    const wg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 32), this.matAnodized);
    wg.position.set(0, 0.5, 0);
    turboGroup.add(wg);

    const wgRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 16), this.matGold);
    wgRod.position.set(0, 0.28, 0.15);
    turboGroup.add(wgRod);

    this.turbos.push({ group: turboGroup, wheel: wheel, isLeft: isLeft });
    return { exhaust: exhaustGroup, turbo: turboGroup };
  }

  // --- 7. Front Accessory Drive & Serpentine Belt ---
  buildFrontDrive() {
    const driveGroup = new THREE.Group();
    driveGroup.name = 'FrontTimingDriveGroup';
    driveGroup.position.set(0, 0, -2.15);

    // Water Pump Housing
    const wpShape = new THREE.Shape();
    wpShape.moveTo(-0.4, 0.3);
    wpShape.lineTo(0.4, 0.3);
    wpShape.lineTo(0.5, 0.7);
    wpShape.lineTo(0.3, 1.1);
    wpShape.lineTo(-0.3, 1.1);
    wpShape.lineTo(-0.5, 0.7);
    const wpCasting = new THREE.Mesh(new THREE.ExtrudeGeometry(wpShape, {depth: 0.15, bevelEnabled:true}), this.matBlock);
    driveGroup.add(wpCasting);

    const crankPulley = this.createPulley(0.52, 0.18, 0, -0.15, 0.12, 'Harmonic Damper Crank Pulley', 4);
    driveGroup.add(crankPulley);

    const wpNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.35, 32), this.matForged);
    wpNeck.rotation.x = Math.PI / 2;
    wpNeck.position.set(0, 0.85, 0.05);
    driveGroup.add(wpNeck);
    
    const wpPulley = this.createPulley(0.44, 0.18, 0, 0.85, 0.12, 'High-Flow Water Pump Pulley', 5);
    driveGroup.add(wpPulley);

    // Alternator
    const altGroup = new THREE.Group();
    altGroup.position.set(1.05, 1.15, 0.12);
    const altBody = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.4, 32), this.matForged);
    altBody.geometry.rotateX(Math.PI / 2);
    altGroup.add(altBody);
    const stator = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 16, 32), this.matGasket);
    stator.position.z = 0.05;
    altGroup.add(stator);
    const altPulley = this.createPulley(0.3, 0.18, 0, 0, 0.25, '220A Alternator Pulley', 3);
    altGroup.add(altPulley);
    driveGroup.add(altGroup);

    // AC Compressor
    const acPulley = this.createPulley(0.4, 0.18, -0.95, 0.35, 0.12, 'AC Compressor Pulley', 4);
    driveGroup.add(acPulley);

    // Tensioner & Idler
    const idler1 = this.createPulley(0.25, 0.16, 0.65, 0.35, 0.12, 'Tensioner Idler Pulley #1', 3);
    const idler2 = this.createPulley(0.25, 0.16, -0.65, 1.25, 0.12, 'Upper Idler Pulley #2', 3);
    driveGroup.add(idler1);
    driveGroup.add(idler2);

    // Tangential Serpentine Belt Curve
    const beltCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.67, 0.12),
      new THREE.Vector3(-0.95, -0.05, 0.12),
      new THREE.Vector3(-0.95, 0.75, 0.12),
      new THREE.Vector3(-0.65, 1.5, 0.12),
      new THREE.Vector3(0, 1.29, 0.12),
      new THREE.Vector3(1.05, 1.45, 0.12),
      new THREE.Vector3(1.35, 1.15, 0.12),
      new THREE.Vector3(0.65, 0.1, 0.12)
    ], true);

    const beltGeom = new THREE.TubeGeometry(beltCurve, 128, 0.065, 16, true);
    this.timingBelt = new THREE.Mesh(beltGeom, this.matBelt);
    driveGroup.add(this.timingBelt);

    this.subassemblies.frontDrive = driveGroup;
    this.group.add(driveGroup);
  }

  createPulley(radius, width, posX, posY, posZ, label, spokeCount = 4) {
    const pulleyGroup = new THREE.Group();

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 32), this.matAnodized);
    rim.rotation.x = Math.PI / 2;
    pulleyGroup.add(rim);

    const web = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius * 0.85, width * 0.4, 32), this.matForged);
    web.rotation.x = Math.PI / 2;
    pulleyGroup.add(web);

    for (let h = 0; h < spokeCount; h++) {
      const a = (h / spokeCount) * Math.PI * 2;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, width + 0.02, 16), this.matBelt);
      hole.rotation.x = Math.PI / 2;
      hole.position.set(Math.cos(a) * radius * 0.55, Math.sin(a) * radius * 0.55, 0);
      pulleyGroup.add(hole);
    }

    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, width + 0.04, 6), this.matGold);
    bolt.rotation.x = Math.PI / 2;
    pulleyGroup.add(bolt);

    pulleyGroup.position.set(posX, posY, posZ);
    this.pulleys.push(pulleyGroup);

    return pulleyGroup;
  }

  // --- 8. Fuel Rails & Injectors ---
  buildFuelSystem() {
    const fuelGroup = new THREE.Group();
    fuelGroup.name = 'FuelSystemGroup';

    [-1.05, 1.05].forEach((rx, bIdx) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.8), this.matAnodizedBlue);
      rail.position.set(rx, 1.85, 0);
      fuelGroup.add(rail);

      for (let j = 0; j < 4; j++) {
        const jz = -1.3 + j * 0.88;
        const injector = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 16), this.matGold);
        injector.position.set(rx, 1.72, jz);
        fuelGroup.add(injector);
      }

      [-1.9, 1.9].forEach(fz => {
        const fitting = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 6), this.matAnodized);
        fitting.rotation.x = Math.PI / 2;
        fitting.position.set(rx, 1.85, fz);
        fuelGroup.add(fitting);
      });
    });

    const crossCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.05, 1.85, -1.9),
      new THREE.Vector3(0, 2.05, -2.0),
      new THREE.Vector3(1.05, 1.85, -1.9)
    ]);
    const crossLine = new THREE.Mesh(new THREE.TubeGeometry(crossCurve, 32, 0.035, 16), this.matBraided);
    fuelGroup.add(crossLine);

    this.subassemblies.fuelSystem = fuelGroup;
    this.group.add(fuelGroup);
  }

  // --- 9. Accessories: Oil Filter & Starter ---
  buildAccessories() {
    const filterGroup = new THREE.Group();
    filterGroup.position.set(-1.3, -0.4, 0.8);
    filterGroup.rotation.z = Math.PI / 3;

    const filterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 32), this.matAnodizedBlue);
    filterGroup.add(filterBody);

    const filterBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 32), this.matGold);
    filterBase.position.y = -0.4;
    filterGroup.add(filterBase);

    this.subassemblies.oilFilter = filterGroup;
    this.group.add(filterGroup);

    const starterGroup = new THREE.Group();
    starterGroup.position.set(1.1, -0.5, 1.4);

    const starterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 32), this.matIron);
    starterBody.rotation.x = Math.PI / 2;
    starterGroup.add(starterBody);

    const solenoid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 32), this.matGold);
    solenoid.rotation.x = Math.PI / 2;
    solenoid.position.set(0, 0.3, 0);
    starterGroup.add(solenoid);

    this.subassemblies.starterMotor = starterGroup;
    this.group.add(starterGroup);
  }

  // --- 10. Plumbing, Hoses & Wiring Looms ---
  buildPlumbingAndWiring() {
    const plumbingGroup = new THREE.Group();
    plumbingGroup.name = 'PlumbingGroup';

    // Upper Radiator Hose
    const upperHoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.5, -2.1),
      new THREE.Vector3(0.5, 1.8, -2.5),
      new THREE.Vector3(1.0, 1.7, -3.0)
    ]);
    const upperHose = new THREE.Mesh(new THREE.TubeGeometry(upperHoseCurve, 32, 0.15, 16), this.matBelt);
    plumbingGroup.add(upperHose);

    // Lower Radiator Hose
    const lowerHoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.3, 0.85, -2.2),
      new THREE.Vector3(0.8, 0.5, -2.6),
      new THREE.Vector3(1.2, 0.2, -3.0)
    ]);
    const lowerHose = new THREE.Mesh(new THREE.TubeGeometry(lowerHoseCurve, 32, 0.18, 16), this.matBelt);
    plumbingGroup.add(lowerHose);

    // PCV Hose
    const pcvHoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.3, 0.95 + 1.1, -1.5), // From R valve cover
      new THREE.Vector3(0.1, 1.5, -1.5),
      new THREE.Vector3(0, 1.9, -1.0) // To intake
    ]);
    const pcvHose = new THREE.Mesh(new THREE.TubeGeometry(pcvHoseCurve, 32, 0.05, 16), this.matBelt);
    plumbingGroup.add(pcvHose);

    // Wiring Harness Loom (Top valley)
    const loomCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.3, -1.8),
      new THREE.Vector3(0, 1.3, 0),
      new THREE.Vector3(0, 1.3, 1.8)
    ]);
    const loom = new THREE.Mesh(new THREE.TubeGeometry(loomCurve, 32, 0.08, 16), this.matBelt);
    plumbingGroup.add(loom);

    // Coil wires branching from loom
    for(let w=0; w<4; w++) {
      const wz = -1.35 + w*0.9;
      // Left coil branch
      const wCurveL = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.3, wz),
        new THREE.Vector3(-0.3, 1.5, wz),
        new THREE.Vector3(-0.65, 1.85, wz)
      ]);
      plumbingGroup.add(new THREE.Mesh(new THREE.TubeGeometry(wCurveL, 16, 0.02, 8), this.matBelt));

      // Right coil branch
      const wCurveR = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.3, wz),
        new THREE.Vector3(0.3, 1.5, wz),
        new THREE.Vector3(0.65, 1.85, wz)
      ]);
      plumbingGroup.add(new THREE.Mesh(new THREE.TubeGeometry(wCurveR, 16, 0.02, 8), this.matBelt));
    }

    // Turbo Oil Feed Lines
    const oilFeedLCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.15, 0.5, 0), // Block gallery
      new THREE.Vector3(-1.6, 0.8, 0.2),
      new THREE.Vector3(-2.1, 0.6, 0.4) // Turbo CHRA
    ]);
    plumbingGroup.add(new THREE.Mesh(new THREE.TubeGeometry(oilFeedLCurve, 32, 0.035, 16), this.matBraided));

    const oilFeedRCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.15, 0.5, 0),
      new THREE.Vector3(1.6, 0.8, 0.2),
      new THREE.Vector3(2.1, 0.6, 0.4)
    ]);
    plumbingGroup.add(new THREE.Mesh(new THREE.TubeGeometry(oilFeedRCurve, 32, 0.035, 16), this.matBraided));

    this.subassemblies.plumbing = plumbingGroup;
    this.group.add(plumbingGroup);
  }

  buildFlameFX() {
    const count = 40;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 3.5;
      pos[i * 3 + 1] = 0.4;
      pos[i * 3 + 2] = 2.4 + Math.random() * 1.2;

      cols[i * 3 + 0] = 0.2 + Math.random() * 0.8;
      cols[i * 3 + 1] = 0.4 + Math.random() * 0.4;
      cols[i * 3 + 2] = 1.0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });

    this.flameParticles = new THREE.Points(geom, mat);
    this.group.add(this.flameParticles);
  }

  setRPM(targetRpm) {
    this.rpm = targetRpm;
    this.isRevving = targetRpm > 0;
  }

  setExploded(factor) {
    this.explodeFactor = THREE.MathUtils.clamp(factor, 0, 1);
    this.updateExplodedTransforms();
  }

  setXRay(enabled) {
    this.isXRay = enabled;
    const opacity = enabled ? 0.25 : 1.0;
    const transparent = enabled;

    [this.matBlock, this.matIron, this.matAnodized].forEach(m => {
      m.transparent = transparent;
      m.opacity = opacity;
      m.needsUpdate = true;
    });
  }

  update(delta) {
    if (this.isRevving && this.rpm > 0) {
      const radPerSec = (this.rpm * Math.PI * 2) / 60;
      this.crankAngle += radPerSec * delta;

      if (this.crankshaft) {
        this.crankshaft.rotation.z = this.crankAngle;
      }

      this.pistons.forEach((piston) => {
        const theta = this.crankAngle + piston.phase;
        const r = piston.crankRadius;
        const l = piston.rodLength;

        const s = r * Math.cos(theta) + Math.sqrt(l * l - r * r * Math.sin(theta) * Math.sin(theta));
        piston.crown.position.y = s + 0.1;

        const phi = Math.asin((r / l) * Math.sin(theta));
        piston.conRod.position.y = s + 0.1;
        piston.conRod.rotation.z = phi;
      });

      this.camshafts.forEach((cam) => {
        cam.rotation.z = this.crankAngle * 0.5;
      });

      this.valves.forEach((valve, idx) => {
        const camPhase = this.crankAngle * 0.5 + idx * 0.785;
        const valveLift = Math.max(0, Math.sin(camPhase)) * 0.09;
        valve.position.y = 0.3 - valveLift;
      });

      this.pulleys.forEach((p) => {
        p.rotation.z = this.crankAngle * 0.8;
      });

      this.turbos.forEach((t) => {
        t.wheel.rotation.z += radPerSec * delta * 4.0;
      });

      if (this.rpm > 3500) {
        const heatPct = (this.rpm - 3500) / 5000;
        this.matHeader.emissive.setHex(0xff3300);
        this.matHeader.emissiveIntensity = heatPct * 2.2 * (0.85 + Math.sin(this.crankAngle * 4) * 0.15);

        if (this.flameParticles) {
          this.flameParticles.material.opacity = heatPct * (0.6 + Math.sin(this.crankAngle * 8) * 0.4);
        }
      } else {
        this.matHeader.emissiveIntensity = 0;
        if (this.flameParticles) {
          this.flameParticles.material.opacity = 0;
        }
      }
    }
  }

  updateExplodedTransforms() {
    const f = this.explodeFactor;
    const s = this.subassemblies;

    if (s.oilPan) s.oilPan.position.y = -f * 1.8;
    if (s.intakePlenum) s.intakePlenum.position.y = 1.8 + f * 2.5;

    if (s.leftHead) s.leftHead.position.set(-0.65 - f * 1.6, 1.1 + f * 1.6, 0);
    if (s.rightHead) s.rightHead.position.set(0.65 + f * 1.6, 1.1 + f * 1.6, 0);

    if (s.leftValveCover) s.leftValveCover.position.set(-0.65 - f * 2.8, 1.1 + f * 2.8, 0);
    if (s.rightValveCover) s.rightValveCover.position.set(0.65 + f * 2.8, 1.1 + f * 2.8, 0);

    if (s.leftTurbo) s.leftTurbo.position.set(-2.1 - f * 2.2, 0.4, 0.4);
    if (s.rightTurbo) s.rightTurbo.position.set(2.1 + f * 2.2, 0.4, 0.4);

    if (s.leftExhaust) s.leftExhaust.position.set(-2.1 - f * 1.4, 0.4, 0);
    if (s.rightExhaust) s.rightExhaust.position.set(2.1 + f * 1.4, 0.4, 0);

    if (s.frontDrive) s.frontDrive.position.set(0, 0, -2.15 - f * 2.2);
    if (s.oilFilter) s.oilFilter.position.set(-1.3 - f * 1.5, -0.4, 0.8);
    if (s.starterMotor) s.starterMotor.position.set(1.1 + f * 1.5, -0.5, 1.4);
    if (s.fuelSystem) s.fuelSystem.position.y = f * 2.6;
    if (s.plumbing) s.plumbing.position.y = f * 3.5;
  }
}
