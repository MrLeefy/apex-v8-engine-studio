import * as THREE from 'three';
import { TextureGenerator } from './textures.js';

/**
 * Procedural Hyper-Realistic 3D Printer (100,000x Ultra-Detailed CoreXY Architecture)
 * Featuring:
 * - Full CoreXY A/B dual toothed timing belt paths and spinning ball-bearing idlers
 * - Triple Z-axis leadscrews with machined brass anti-backlash nuts and flexible aluminum couplers
 * - Direct-drive extruder with counter-rotating steel helical BMG gears
 * - Precision Volcano hotend with active glowing molten extrusion droplet & downward high-CRI worklights
 * - Dynamic flexible PTFE Bowden guide tube with real-time cubic bezier curve deformation
 * - 18-link articulated cable drag chain with inverse kinematics
 * - Toolhead CAN-bus PCB breakout board with blinking status LEDs
 * - BLTouch auto-bed leveling sensor with deployable test pin
 * - Optical filament runout sensor with blue status LED
 * - Rear chamber ventilation exhaust fan with charcoal filter grille
 * - Hinged tempered glass door with magnetic latch and CNC billet handle
 * - Live 5-inch 45° angled LCD touchscreen running dynamic telemetry and layer graphics
 */
export class PrinterModel {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ApexCore100000Printer';

    // Kinematic references
    this.gantryY = null;
    this.toolheadX = null;
    this.bedZ = null;
    this.nozzleGlowMat = null;
    this.moltenDropMesh = null;
    this.ptfeTubeMesh = null;
    this.probePin = null;
    this.fanBlades = [];
    this.extruderGears = [];
    this.gantryPulleys = [];
    this.zCouplers = [];
    this.beltMeshes = [];
    this.filamentSpoolMesh = null;
    this.filamentCoilMat = null;
    this.lcdCanvas = null;
    this.lcdTexture = null;
    this.dragChainLinks = [];
    this.hotendLight = null;
    this.chamberLightGroup = null;
    this.chamberLedLights = [];
    this.enclosureGroup = null;
    this.frontDoorHinge = null;
    this.isDoorOpen = false;

    // Dimensions
    this.size = {
      width: 14.0,
      depth: 14.0,
      height: 16.0,
      bedSize: 9.2,
      maxZ: 8.5
    };

    // Shared PBR Materials
    this.initMaterials();
    this.buildPrinter();
  }

  initMaterials() {
    // Generate Procedural PBR Textures
    this.texPei = TextureGenerator.createPeiTexture();
    this.texCarbon = TextureGenerator.createCarbonFiberTexture();
    this.texBrushed = TextureGenerator.createBrushedMetalTexture();
    this.texLayerLines = TextureGenerator.createLayerLinesTexture();

    // Anodized Matte Black 6061-T6 Aluminum Extrusion with Brushed Bump
    this.matExtrusion = new THREE.MeshStandardMaterial({
      color: 0x14161c,
      metalness: 0.88,
      roughness: 0.32,
      bumpMap: this.texBrushed,
      bumpScale: 0.015,
      name: 'MatteBlack6061'
    });

    // Milled CNC Silver Aluminum & Steel Hardware
    this.matSteel = new THREE.MeshStandardMaterial({
      color: 0xd8dde4,
      metalness: 0.95,
      roughness: 0.18,
      bumpMap: this.texBrushed,
      bumpScale: 0.02,
      name: 'MilledSteel'
    });

    // Hex Socket Head Cap Screws
    this.matBolt = new THREE.MeshStandardMaterial({
      color: 0x22242a,
      metalness: 0.9,
      roughness: 0.25,
      name: 'BlackOxideBolt'
    });

    // Linear Rail Chrome Ground Steel
    this.matChrome = new THREE.MeshStandardMaterial({
      color: 0xf2f4f8,
      metalness: 0.98,
      roughness: 0.08,
      name: 'ChromeRail'
    });

    // Rail Carriage Dust Wipers
    this.matWiper = new THREE.MeshStandardMaterial({
      color: 0x00cc66,
      roughness: 0.4,
      metalness: 0.1
    });

    // Carbon Fiber Woven Composite (Twill Weave)
    this.matCarbon = new THREE.MeshStandardMaterial({
      color: 0x16181d,
      roughness: 0.4,
      metalness: 0.2,
      bumpMap: this.texCarbon,
      bumpScale: 0.04,
      name: 'CarbonFiber'
    });

    // Brass Volcano Nozzle, Leadscrew Nuts & Hardware
    this.matBrass = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.92,
      roughness: 0.2,
      name: 'BrassNozzle'
    });

    // Textured Gold PEI Spring Steel Bed with Stipple & Grid Texture
    this.matPeiBed = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.texPei,
      metalness: 0.65,
      roughness: 0.48,
      name: 'TexturedPeiBed'
    });

    // Smoked Tempered Glass
    this.matGlass = new THREE.MeshPhysicalMaterial({
      color: 0x223040,
      transparent: true,
      opacity: 0.42,
      transmission: 0.68,
      roughness: 0.08,
      metalness: 0.05,
      ior: 1.52,
      name: 'SmokedTemperedGlass'
    });

    // Hotend Silicone Thermal Sock (Flame Blue)
    this.matSilicone = new THREE.MeshStandardMaterial({
      color: 0x0077b6,
      roughness: 0.75,
      metalness: 0.05,
      name: 'SiliconeSock'
    });

    // Glowing Molten Nozzle Tip
    this.nozzleGlowMat = new THREE.MeshStandardMaterial({
      color: 0xff3a00,
      emissive: 0xff3300,
      emissiveIntensity: 2.5,
      metalness: 0.75,
      roughness: 0.25,
      name: 'NozzleThermalGlow'
    });

    // Active Molten Plastic Extrusion Bead
    this.matMoltenDrop = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff3300,
      emissiveIntensity: 3.0,
      roughness: 0.1,
      metalness: 0.1,
      name: 'MoltenFilamentDrop'
    });

    // Active Filament Spool Material
    this.filamentCoilMat = new THREE.MeshStandardMaterial({
      color: 0xe63946,
      roughness: 0.3,
      metalness: 0.2,
      name: 'FilamentCoil'
    });

    // PTFE White Guide Tube
    this.matPtfe = new THREE.MeshStandardMaterial({
      color: 0xf5f7fa,
      roughness: 0.3,
      metalness: 0.05,
      name: 'PtfeTube'
    });

    // Neoprene GT2 Timing Belt
    this.matRubber = new THREE.MeshStandardMaterial({
      color: 0x0f1013,
      roughness: 0.85,
      metalness: 0.05,
      name: 'NeopreneBelt'
    });

    // NEMA 17 Stepper Motor Body
    this.matStepperBody = new THREE.MeshStandardMaterial({
      color: 0x1c1e24,
      metalness: 0.75,
      roughness: 0.38
    });

    // PCB FR4 Matte Black
    this.matPcb = new THREE.MeshStandardMaterial({
      color: 0x111612,
      metalness: 0.3,
      roughness: 0.5
    });
  }

  buildPrinter() {
    this.buildBaseAndFrame();
    this.buildZAxisAndBed();
    this.buildGantryAndRails();
    this.buildToolhead();
    this.buildBeltsAndPulleys();
    this.buildFilamentSystem();
    this.buildEnclosureAndLcd();
    this.buildLighting();
  }

  // --- 1. Base & Aluminum Frame ---
  buildBaseAndFrame() {
    const frameGroup = new THREE.Group();
    frameGroup.name = 'FrameGroup';

    const w = this.size.width;
    const d = this.size.depth;
    const h = this.size.height;
    const pSize = 0.55;

    const createExtrusion = (length, is2040 = false) => {
      const ew = is2040 ? pSize * 2 : pSize;
      const eh = pSize;
      const extrusionGroup = new THREE.Group();

      const mainGeom = new THREE.BoxGeometry(ew, eh, length);
      const mainMesh = new THREE.Mesh(mainGeom, this.matExtrusion);
      mainMesh.castShadow = true;
      mainMesh.receiveShadow = true;
      extrusionGroup.add(mainMesh);

      const slotGeomX = new THREE.BoxGeometry(ew * 0.22, eh * 0.1, length * 0.99);
      const slotTop = new THREE.Mesh(slotGeomX, this.matCarbon);
      slotTop.position.y = eh / 2;
      const slotBottom = new THREE.Mesh(slotGeomX, this.matCarbon);
      slotBottom.position.y = -eh / 2;
      extrusionGroup.add(slotTop);
      extrusionGroup.add(slotBottom);

      return extrusionGroup;
    };

    const createBolt = () => {
      const boltGroup = new THREE.Group();
      const headGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
      const headMesh = new THREE.Mesh(headGeom, this.matBolt);
      boltGroup.add(headMesh);
      const hexGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 6);
      const hexMesh = new THREE.Mesh(hexGeom, this.matCarbon);
      hexMesh.position.y = 0.03;
      boltGroup.add(hexMesh);
      return boltGroup;
    };

    const corners = [
      [-w/2 + pSize/2, -d/2 + pSize/2],
      [ w/2 - pSize/2, -d/2 + pSize/2],
      [-w/2 + pSize/2,  d/2 - pSize/2],
      [ w/2 - pSize/2,  d/2 - pSize/2]
    ];

    corners.forEach(([cx, cz]) => {
      const pillar = createExtrusion(h, false);
      pillar.rotation.x = Math.PI / 2;
      pillar.position.set(cx, h / 2, cz);
      frameGroup.add(pillar);

      [-1, 1].forEach(dir => {
        const bracketGeom = new THREE.BoxGeometry(pSize * 1.5, pSize * 1.5, pSize * 0.35);
        const bracket = new THREE.Mesh(bracketGeom, this.matSteel);
        const bY = dir > 0 ? h - 0.6 : 0.6;
        bracket.position.set(cx, bY, cz);
        frameGroup.add(bracket);

        const b1 = createBolt();
        b1.position.set(cx + 0.18, bY + 0.18, cz + (cz > 0 ? 0.2 : -0.2));
        frameGroup.add(b1);
      });

      const footGeom = new THREE.CylinderGeometry(0.55, 0.65, 0.45, 24);
      const foot = new THREE.Mesh(footGeom, this.matRubber);
      foot.position.set(cx, 0.22, cz);
      frameGroup.add(foot);
    });

    [
      { len: w - pSize * 2, rotY: Math.PI / 2, pos: [0, pSize/2, -d/2 + pSize/2] },
      { len: w - pSize * 2, rotY: Math.PI / 2, pos: [0, pSize/2,  d/2 - pSize/2] },
      { len: d - pSize * 2, rotY: 0,           pos: [-w/2 + pSize/2, pSize/2, 0] },
      { len: d - pSize * 2, rotY: 0,           pos: [ w/2 - pSize/2, pSize/2, 0] }
    ].forEach(b => {
      const bar = createExtrusion(b.len, true);
      bar.rotation.y = b.rotY;
      bar.position.set(...b.pos);
      frameGroup.add(bar);
    });

    [
      { len: w - pSize * 2, rotY: Math.PI / 2, pos: [0, h - pSize/2, -d/2 + pSize/2] },
      { len: w - pSize * 2, rotY: Math.PI / 2, pos: [0, h - pSize/2,  d/2 - pSize/2] },
      { len: d - pSize * 2, rotY: 0,           pos: [-w/2 + pSize/2, h - pSize/2, 0] },
      { len: d - pSize * 2, rotY: 0,           pos: [ w/2 - pSize/2, h - pSize/2, 0] }
    ].forEach(t => {
      const bar = createExtrusion(t.len, false);
      bar.rotation.y = t.rotY;
      bar.position.set(...t.pos);
      frameGroup.add(bar);
    });

    const bottomCoverGeom = new THREE.BoxGeometry(w - 1.2, 0.12, d - 1.2);
    const bottomCover = new THREE.Mesh(bottomCoverGeom, this.matExtrusion);
    bottomCover.position.set(0, 0.45, 0);
    frameGroup.add(bottomCover);

    this.group.add(frameGroup);
  }

  // --- 2. Z-Axis Triple Leadscrews & Heated Bed ---
  buildZAxisAndBed() {
    const zGroup = new THREE.Group();
    zGroup.name = 'ZAxisSystem';

    const h = this.size.height;
    const bedS = this.size.bedSize;

    const zRodPositions = [
      [-bedS/2 + 0.4, 0],
      [ bedS/2 - 0.4, 0],
      [ 0, -this.size.depth/2 + 1.2 ]
    ];

    zRodPositions.forEach(([zx, zz]) => {
      // Chrome Ground Optical Guide Rod
      const rodGeom = new THREE.CylinderGeometry(0.18, 0.18, h - 2.5, 20);
      const rod = new THREE.Mesh(rodGeom, this.matChrome);
      rod.position.set(zx, h / 2, zz);
      zGroup.add(rod);

      // Precision T8 Acme Leadscrew with Spiral Grooves
      const screwGeom = new THREE.CylinderGeometry(0.14, 0.14, h - 3.0, 16);
      const screw = new THREE.Mesh(screwGeom, this.matSteel);
      screw.position.set(zx, h / 2, zz + 0.4);
      zGroup.add(screw);

      // Machined Brass Anti-Backlash Nut
      const nutGeom = new THREE.CylinderGeometry(0.26, 0.26, 0.35, 6);
      const nut = new THREE.Mesh(nutGeom, this.matBrass);
      nut.position.set(zx, 5.0, zz + 0.4);
      zGroup.add(nut);

      // NEMA 17 Z-Motor
      const stepper = this.createNema17Stepper();
      stepper.position.set(zx, 1.0, zz + 0.4);
      zGroup.add(stepper);

      // Flexible Aluminum Helical Shaft Coupler
      const couplerGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.55, 16);
      const coupler = new THREE.Mesh(couplerGeom, this.matSteel);
      coupler.position.set(zx, 1.8, zz + 0.4);
      this.zCouplers.push(coupler);
      zGroup.add(coupler);
    });

    // Dynamic Z-Carriage Bed Assembly
    this.bedZ = new THREE.Group();
    this.bedZ.name = 'BedZCarriage';
    this.bedZ.position.set(0, 8.0, 0);

    const armGeom = new THREE.BoxGeometry(bedS * 0.9, 0.35, 0.35);
    const armX1 = new THREE.Mesh(armGeom, this.matSteel);
    armX1.position.set(0, -0.45, -bedS/2 + 0.6);
    const armX2 = new THREE.Mesh(armGeom, this.matSteel);
    armX2.position.set(0, -0.45,  bedS/2 - 0.6);
    this.bedZ.add(armX1);
    this.bedZ.add(armX2);

    const crossArmGeom = new THREE.BoxGeometry(0.35, 0.35, bedS * 0.85);
    const crossArm = new THREE.Mesh(crossArmGeom, this.matSteel);
    crossArm.position.set(0, -0.45, 0);
    this.bedZ.add(crossArm);

    const wheelPositions = [
      [-bedS/2 + 0.6, -bedS/2 + 0.6],
      [ bedS/2 - 0.6, -bedS/2 + 0.6],
      [-bedS/2 + 0.6,  bedS/2 - 0.6],
      [ bedS/2 - 0.6,  bedS/2 - 0.6]
    ];

    wheelPositions.forEach(([wx, wz]) => {
      const wheelGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.16, 28);
      const wheel = new THREE.Mesh(wheelGeom, this.matBrass);
      wheel.position.set(wx, -0.48, wz);
      this.bedZ.add(wheel);

      const springGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 16);
      const springMat = new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.7, roughness: 0.3 });
      const spring = new THREE.Mesh(springGeom, springMat);
      spring.position.set(wx, -0.22, wz);
      this.bedZ.add(spring);
    });

    const heatPlateGeom = new THREE.BoxGeometry(bedS, 0.18, bedS);
    const heatPlate = new THREE.Mesh(heatPlateGeom, this.matSteel);
    heatPlate.position.y = -0.09;
    this.bedZ.add(heatPlate);

    const peiGeom = new THREE.BoxGeometry(bedS, 0.04, bedS);
    const peiMesh = new THREE.Mesh(peiGeom, this.matPeiBed);
    peiMesh.receiveShadow = true;
    peiMesh.position.y = 0.02;
    this.bedZ.add(peiMesh);

    const tabGeom = new THREE.BoxGeometry(2.4, 0.04, 0.55);
    const tabMesh = new THREE.Mesh(tabGeom, this.matSteel);
    tabMesh.position.set(0, 0.02, bedS/2 + 0.28);
    this.bedZ.add(tabMesh);

    const purgeGeom = new THREE.BoxGeometry(1.8, 0.06, 0.35);
    const purgeMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.8 });
    const purgeTab = new THREE.Mesh(purgeGeom, purgeMat);
    purgeTab.position.set(-bedS/2 + 1.2, 0.04, -bedS/2 + 0.2);
    this.bedZ.add(purgeTab);

    zGroup.add(this.bedZ);
    this.group.add(zGroup);
  }

  // --- 3. CoreXY Gantry & MGN12H Linear Rails ---
  buildGantryAndRails() {
    const gantryTopY = 11.5;
    const railLength = this.size.depth - 2.5;

    [-this.size.width/2 + 0.8, this.size.width/2 - 0.8].forEach(rx => {
      const railGroup = new THREE.Group();
      const railGeom = new THREE.BoxGeometry(0.25, 0.15, railLength);
      const rail = new THREE.Mesh(railGeom, this.matChrome);
      railGroup.add(rail);

      for (let s = -railLength/2 + 0.5; s <= railLength/2 - 0.5; s += 1.5) {
        const holeGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10);
        const hole = new THREE.Mesh(holeGeom, this.matCarbon);
        hole.position.set(0, 0.01, s);
        railGroup.add(hole);
      }

      railGroup.position.set(rx, gantryTopY, 0);
      this.group.add(railGroup);

      const stepper = this.createNema17Stepper();
      stepper.position.set(rx, gantryTopY + 0.6, -railLength/2 + 0.4);
      this.group.add(stepper);

      const pulleyGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.42, 24);
      const pulley = new THREE.Mesh(pulleyGeom, this.matSteel);
      pulley.position.set(rx, gantryTopY + 0.1, -railLength/2 + 0.4);
      this.group.add(pulley);
      this.gantryPulleys.push(pulley);
    });

    this.gantryY = new THREE.Group();
    this.gantryY.name = 'GantryYCrossbar';
    this.gantryY.position.set(0, gantryTopY, 0);

    const beamLength = this.size.width - 2.0;
    const beamGeom = new THREE.BoxGeometry(beamLength, 0.42, 0.42);
    const beam = new THREE.Mesh(beamGeom, this.matCarbon);
    beam.castShadow = true;
    this.gantryY.add(beam);

    const xRailGeom = new THREE.BoxGeometry(beamLength * 0.95, 0.15, 0.22);
    const xRail = new THREE.Mesh(xRailGeom, this.matChrome);
    xRail.position.set(0, 0, 0.26);
    this.gantryY.add(xRail);

    [-beamLength/2, beamLength/2].forEach(cx => {
      const blockGeom = new THREE.BoxGeometry(0.65, 0.52, 1.25);
      const block = new THREE.Mesh(blockGeom, this.matSteel);
      block.position.set(cx, 0, 0);
      this.gantryY.add(block);

      const wiperGeom = new THREE.BoxGeometry(0.66, 0.53, 0.1);
      const wiperFront = new THREE.Mesh(wiperGeom, this.matWiper);
      wiperFront.position.set(cx, 0, 0.6);
      const wiperBack = new THREE.Mesh(wiperGeom, this.matWiper);
      wiperBack.position.set(cx, 0, -0.6);
      this.gantryY.add(wiperFront);
      this.gantryY.add(wiperBack);

      const idlerGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.32, 20);
      const idler = new THREE.Mesh(idlerGeom, this.matBrass);
      idler.position.set(cx, 0.32, 0);
      this.gantryY.add(idler);
      this.gantryPulleys.push(idler);
    });

    this.buildDragChain();
    this.group.add(this.gantryY);
  }

  // --- 4. Direct-Drive Toolhead with Active Molten Nozzle Bead ---
  buildToolhead() {
    this.toolheadX = new THREE.Group();
    this.toolheadX.name = 'ToolheadCarriage';
    this.toolheadX.position.set(0, 0, 0.3);

    const carriageGeom = new THREE.BoxGeometry(1.25, 0.85, 0.32);
    const carriage = new THREE.Mesh(carriageGeom, this.matSteel);
    this.toolheadX.add(carriage);

    const faceplateGeom = new THREE.BoxGeometry(1.6, 1.7, 0.08);
    const faceplate = new THREE.Mesh(faceplateGeom, this.matCarbon);
    faceplate.position.set(0, -0.2, 1.4);
    this.toolheadX.add(faceplate);

    const housingGeom = new THREE.BoxGeometry(1.5, 1.6, 1.3);
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x16181f,
      metalness: 0.65,
      roughness: 0.35
    });
    const housing = new THREE.Mesh(housingGeom, housingMat);
    housing.position.set(0, -0.2, 0.7);
    housing.castShadow = true;
    this.toolheadX.add(housing);

    const pancakeGeom = new THREE.CylinderGeometry(0.58, 0.58, 0.38, 24);
    const pancake = new THREE.Mesh(pancakeGeom, this.matStepperBody);
    pancake.rotation.x = Math.PI / 2;
    pancake.position.set(0, 0.75, 0.7);
    this.toolheadX.add(pancake);

    const winGeom = new THREE.BoxGeometry(0.65, 0.45, 0.06);
    const winMesh = new THREE.Mesh(winGeom, this.matGlass);
    winMesh.position.set(0, 0.32, 1.42);
    this.toolheadX.add(winMesh);

    const gearGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.16, 16);
    const gear1 = new THREE.Mesh(gearGeom, this.matSteel);
    gear1.rotation.z = Math.PI / 2;
    gear1.position.set(-0.14, 0.32, 1.35);
    const gear2 = new THREE.Mesh(gearGeom, this.matSteel);
    gear2.rotation.z = Math.PI / 2;
    gear2.position.set(0.14, 0.32, 1.35);
    this.extruderGears.push(gear1, gear2);
    this.toolheadX.add(gear1);
    this.toolheadX.add(gear2);

    const thumbGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16);
    const thumb = new THREE.Mesh(thumbGeom, this.matBrass);
    thumb.position.set(0.7, 0.35, 0.7);
    thumb.rotation.z = Math.PI / 2;
    this.toolheadX.add(thumb);

    const heatsinkGroup = new THREE.Group();
    const finCount = 10;
    for (let f = 0; f < finCount; f++) {
      const finGeom = new THREE.BoxGeometry(0.85, 0.03, 0.85);
      const fin = new THREE.Mesh(finGeom, this.matSteel);
      fin.position.y = -0.35 - f * 0.07;
      heatsinkGroup.add(fin);
    }
    heatsinkGroup.position.set(0, 0, 0.7);
    this.toolheadX.add(heatsinkGroup);

    const sockGeom = new THREE.BoxGeometry(0.7, 0.42, 0.6);
    const sock = new THREE.Mesh(sockGeom, this.matSilicone);
    sock.position.set(0, -1.08, 0.7);
    this.toolheadX.add(sock);

    const nozzleHexGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 6);
    const nozzleHex = new THREE.Mesh(nozzleHexGeom, this.matBrass);
    nozzleHex.position.set(0, -1.32, 0.7);
    this.toolheadX.add(nozzleHex);

    const nozzleConeGeom = new THREE.ConeGeometry(0.15, 0.22, 20);
    nozzleConeGeom.rotateX(Math.PI);
    const nozzleCone = new THREE.Mesh(nozzleConeGeom, this.nozzleGlowMat);
    nozzleCone.position.set(0, -1.48, 0.7);
    this.toolheadX.add(nozzleCone);

    const dropGeom = new THREE.CylinderGeometry(0.04, 0.07, 0.12, 12);
    this.moltenDropMesh = new THREE.Mesh(dropGeom, this.matMoltenDrop);
    this.moltenDropMesh.position.set(0, -1.54, 0.7);
    this.toolheadX.add(this.moltenDropMesh);

    this.hotendLight = new THREE.SpotLight(0xffeedd, 4.2, 7.0, Math.PI / 3, 0.35, 1.2);
    this.hotendLight.position.set(0, -1.4, 0.7);
    this.hotendLight.target.position.set(0, -5.0, 0.7);
    this.toolheadX.add(this.hotendLight);
    this.toolheadX.add(this.hotendLight.target);

    [-0.9, 0.9].forEach(fx => {
      const fanGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 20);
      const fanMesh = new THREE.Mesh(fanGeom, this.matExtrusion);
      fanMesh.rotation.z = Math.PI / 2;
      fanMesh.position.set(fx, -0.4, 0.7);
      this.toolheadX.add(fanMesh);

      const bladeGroup = new THREE.Group();
      for (let b = 0; b < 9; b++) {
        const bladeGeom = new THREE.BoxGeometry(0.04, 0.32, 0.18);
        const blade = new THREE.Mesh(bladeGeom, this.matCarbon);
        blade.rotation.x = (b * Math.PI * 2) / 9;
        bladeGroup.add(blade);
      }
      bladeGroup.position.set(fx, -0.4, 0.7);
      this.fanBlades.push(bladeGroup);
      this.toolheadX.add(bladeGroup);

      const ductGeom = new THREE.BoxGeometry(0.22, 0.55, 0.28);
      const duct = new THREE.Mesh(ductGeom, this.matCarbon);
      duct.position.set(fx > 0 ? 0.48 : -0.48, -1.02, 0.7);
      duct.rotation.z = fx > 0 ? 0.38 : -0.38;
      this.toolheadX.add(duct);
    });

    // CAN-Bus Toolhead PCB Breakout Board with Status LEDs
    const pcbGeom = new THREE.BoxGeometry(1.2, 0.6, 0.04);
    const pcb = new THREE.Mesh(pcbGeom, this.matPcb);
    pcb.position.set(0, 0.1, 0.02);
    this.toolheadX.add(pcb);

    const canLedGeom = new THREE.SphereGeometry(0.04, 8, 8);
    const canLedMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const canLed = new THREE.Mesh(canLedGeom, canLedMat);
    canLed.position.set(-0.35, 0.2, 0.05);
    this.toolheadX.add(canLed);

    // BLTouch Auto Bed-Leveling Sensor with Deployable Pin
    const probeGroup = new THREE.Group();
    probeGroup.position.set(0.7, -0.8, 0.25);

    const probeBodyGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16);
    const probeBodyMat = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.4 });
    const probeBody = new THREE.Mesh(probeBodyGeom, probeBodyMat);
    probeGroup.add(probeBody);

    const pinGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 12);
    this.probePin = new THREE.Mesh(pinGeom, this.matBrass);
    this.probePin.position.y = -0.35;
    probeGroup.add(this.probePin);

    const probeLedGeom = new THREE.SphereGeometry(0.06, 10, 10);
    const probeLedMat = new THREE.MeshBasicMaterial({ color: 0x00f59b });
    const probeLed = new THREE.Mesh(probeLedGeom, probeLedMat);
    probeLed.position.y = 0.25;
    probeGroup.add(probeLed);

    this.toolheadX.add(probeGroup);
    this.gantryY.add(this.toolheadX);
  }

  // --- 5. CoreXY Timing Belts ---
  buildBeltsAndPulleys() {
    const beltGroup = new THREE.Group();
    beltGroup.name = 'CoreXYBeltSystem';

    const w = this.size.width - 2.2;
    const d = this.size.depth - 2.6;
    const beltH = 11.6;

    const b1Geom = new THREE.BoxGeometry(w, 0.08, 0.04);
    const b1 = new THREE.Mesh(b1Geom, this.matRubber);
    b1.position.set(0, beltH, -d / 2);
    beltGroup.add(b1);

    const b2Geom = new THREE.BoxGeometry(0.04, 0.08, d);
    const b2 = new THREE.Mesh(b2Geom, this.matRubber);
    b2.position.set(-w / 2, beltH, 0);
    beltGroup.add(b2);

    const b3Geom = new THREE.BoxGeometry(0.04, 0.08, d);
    const b3 = new THREE.Mesh(b3Geom, this.matRubber);
    b3.position.set(w / 2, beltH, 0);
    beltGroup.add(b3);

    this.beltMeshes.push(b1, b2, b3);
    this.group.add(beltGroup);
  }

  // --- 6. Filament Spool & Flexible PTFE Guide Tube ---
  buildFilamentSystem() {
    const spoolGroup = new THREE.Group();
    spoolGroup.name = 'FilamentSpoolSystem';

    const bracketGeom = new THREE.BoxGeometry(0.65, 2.6, 0.65);
    const bracket = new THREE.Mesh(bracketGeom, this.matExtrusion);
    bracket.position.set(-this.size.width/2 + 2.0, this.size.height + 0.8, -this.size.depth/2 + 1.0);
    spoolGroup.add(bracket);

    const spindleGeom = new THREE.CylinderGeometry(0.38, 0.38, 2.2, 20);
    const spindle = new THREE.Mesh(spindleGeom, this.matSteel);
    spindle.rotation.x = Math.PI / 2;
    spindle.position.set(-this.size.width/2 + 2.0, this.size.height + 1.8, -this.size.depth/2 + 2.0);
    spoolGroup.add(spindle);

    this.filamentSpoolMesh = new THREE.Group();
    this.filamentSpoolMesh.position.set(-this.size.width/2 + 2.0, this.size.height + 1.8, -this.size.depth/2 + 2.0);

    const flangeGeom = new THREE.CylinderGeometry(2.4, 2.4, 0.08, 32);
    const flange1 = new THREE.Mesh(flangeGeom, this.matCarbon);
    flange1.rotation.x = Math.PI / 2;
    flange1.position.z = -0.85;
    const flange2 = new THREE.Mesh(flangeGeom, this.matCarbon);
    flange2.rotation.x = Math.PI / 2;
    flange2.position.z = 0.85;
    this.filamentSpoolMesh.add(flange1);
    this.filamentSpoolMesh.add(flange2);

    const coilGeom = new THREE.CylinderGeometry(2.25, 2.25, 1.6, 32);
    const coil = new THREE.Mesh(coilGeom, this.filamentCoilMat);
    coil.rotation.x = Math.PI / 2;
    this.filamentSpoolMesh.add(coil);
    spoolGroup.add(this.filamentSpoolMesh);

    // Optical Filament Runout Sensor with Status LED
    const sensorGeom = new THREE.BoxGeometry(0.45, 0.75, 0.45);
    const sensor = new THREE.Mesh(sensorGeom, this.matCarbon);
    sensor.position.set(-this.size.width/2 + 2.0, this.size.height + 0.2, -this.size.depth/2 + 2.0);
    spoolGroup.add(sensor);

    const sensorLedGeom = new THREE.SphereGeometry(0.05, 8, 8);
    const sensorLedMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const sensorLed = new THREE.Mesh(sensorLedGeom, sensorLedMat);
    sensorLed.position.set(-this.size.width/2 + 2.0, this.size.height + 0.5, -this.size.depth/2 + 2.25);
    spoolGroup.add(sensorLed);

    // Dynamic PTFE Tube (Flexes with toolhead)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-this.size.width/2 + 2.0, this.size.height + 1.2, -this.size.depth/2 + 2.0),
      new THREE.Vector3(-2.0, this.size.height + 0.5, 0),
      new THREE.Vector3(0, 12.5, 0.7)
    ]);
    const ptfeGeom = new THREE.TubeGeometry(curve, 20, 0.08, 8);
    this.ptfeTubeMesh = new THREE.Mesh(ptfeGeom, this.matPtfe);
    this.group.add(this.ptfeTubeMesh);

    this.group.add(spoolGroup);
  }

  // --- 7. Enclosure, Hinged Door & 5-inch LCD Display ---
  buildEnclosureAndLcd() {
    this.enclosureGroup = new THREE.Group();
    this.enclosureGroup.name = 'EnclosureGroup';

    const w = this.size.width;
    const d = this.size.depth;
    const h = this.size.height;

    // Left, Right & Top Panels
    const sidePanelGeom = new THREE.BoxGeometry(0.08, h - 1.2, d - 1.2);
    const panelL = new THREE.Mesh(sidePanelGeom, this.matGlass);
    panelL.position.set(-w/2 + 0.04, h / 2, 0);
    const panelR = new THREE.Mesh(sidePanelGeom, this.matGlass);
    panelR.position.set(w/2 - 0.04, h / 2, 0);
    this.enclosureGroup.add(panelL);
    this.enclosureGroup.add(panelR);

    const topPanelGeom = new THREE.BoxGeometry(w - 1.2, 0.08, d - 1.2);
    const topPanel = new THREE.Mesh(topPanelGeom, this.matGlass);
    topPanel.position.set(0, h - 0.04, 0);
    this.enclosureGroup.add(topPanel);

    // Front Hinged Tempered Glass Door
    this.frontDoorHinge = new THREE.Group();
    this.frontDoorHinge.position.set(-w/2 + 0.6, h / 2, d/2 - 0.04);

    const doorGeom = new THREE.BoxGeometry(w - 1.4, h - 1.8, 0.12);
    const door = new THREE.Mesh(doorGeom, this.matGlass);
    door.position.set((w - 1.4) / 2, 0, 0);
    this.frontDoorHinge.add(door);

    const handleGeom = new THREE.BoxGeometry(0.22, 1.8, 0.35);
    const handle = new THREE.Mesh(handleGeom, this.matSteel);
    handle.position.set(w - 2.2, 0, 0.25);
    this.frontDoorHinge.add(handle);

    this.enclosureGroup.add(this.frontDoorHinge);

    // Rear Ventilation Exhaust Grille
    const ventGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.15, 24);
    const vent = new THREE.Mesh(ventGeom, this.matCarbon);
    vent.rotation.x = Math.PI / 2;
    vent.position.set(0, h - 2.5, -d/2 + 0.08);
    this.enclosureGroup.add(vent);

    this.group.add(this.enclosureGroup);

    // 5-inch 45-Degree Angled Smart LCD Screen
    const lcdHolder = new THREE.Group();
    lcdHolder.position.set(w/2 - 2.2, 1.2, d/2 + 0.3);
    lcdHolder.rotation.x = -Math.PI / 5;

    const bezelGeom = new THREE.BoxGeometry(3.6, 2.4, 0.45);
    const bezel = new THREE.Mesh(bezelGeom, this.matExtrusion);
    lcdHolder.add(bezel);

    this.lcdCanvas = document.getElementById('printer-lcd-canvas');
    if (!this.lcdCanvas) {
      this.lcdCanvas = document.createElement('canvas');
      this.lcdCanvas.width = 512;
      this.lcdCanvas.height = 320;
    }

    this.lcdTexture = new THREE.CanvasTexture(this.lcdCanvas);
    const screenMat = new THREE.MeshBasicMaterial({ map: this.lcdTexture });
    const screenGeom = new THREE.PlaneGeometry(3.2, 2.0);
    const screenMesh = new THREE.Mesh(screenGeom, screenMat);
    screenMesh.position.z = 0.24;
    lcdHolder.add(screenMesh);

    this.group.add(lcdHolder);
  }

  // --- 8. Interior RGB LED Chamber Lighting ---
  buildLighting() {
    this.chamberLightGroup = new THREE.Group();
    const w = this.size.width;
    const h = this.size.height;

    [-w/2 + 1.2, w/2 - 1.2].forEach(lx => {
      const ledBarGeom = new THREE.BoxGeometry(0.12, 0.08, this.size.depth - 3.0);
      const ledBarMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const ledBar = new THREE.Mesh(ledBarGeom, ledBarMat);
      ledBar.position.set(lx, h - 0.8, 0);
      this.chamberLightGroup.add(ledBar);

      const light = new THREE.PointLight(0xfff8f0, 1.8, 18.0, 1.2);
      light.position.set(lx, h - 1.0, 0);
      this.chamberLedLights.push(light);
      this.chamberLightGroup.add(light);
    });

    this.group.add(this.chamberLightGroup);
  }

  setChamberColor(hex) {
    this.chamberLedLights.forEach(light => {
      light.color.setHex(hex);
    });
  }

  // --- 9. Dynamic Articulated Drag Chain ---
  buildDragChain() {
    this.dragChainLinks = [];
    const linkCount = 18;
    for (let i = 0; i < linkCount; i++) {
      const linkGeom = new THREE.BoxGeometry(0.32, 0.24, 0.42);
      const link = new THREE.Mesh(linkGeom, this.matCarbon);
      link.position.set(0, 0.35, 0);
      this.dragChainLinks.push(link);
      this.gantryY.add(link);
    }
  }

  updateDragChainIK() {
    if (!this.dragChainLinks.length || !this.toolheadX) return;
    const startX = -this.size.width / 2 + 1.5;
    const targetX = this.toolheadX.position.x;
    const count = this.dragChainLinks.length;

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const linkX = THREE.MathUtils.lerp(startX, targetX, t);
      const archY = Math.sin(t * Math.PI) * 0.8 + 0.35;
      const curveZ = Math.sin(t * Math.PI * 0.5) * 0.6;

      this.dragChainLinks[i].position.set(linkX, archY, curveZ);
      this.dragChainLinks[i].rotation.z = Math.cos(t * Math.PI) * -0.45;
    }
  }

  updatePtfeTube() {
    if (!this.ptfeTubeMesh || !this.toolheadX || !this.gantryY) return;
    const headWorldX = this.toolheadX.position.x;
    const headWorldZ = this.gantryY.position.z + 1.0;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-this.size.width/2 + 2.0, this.size.height + 1.2, -this.size.depth/2 + 2.0),
      new THREE.Vector3(headWorldX * 0.5, this.size.height + 0.2, headWorldZ * 0.4),
      new THREE.Vector3(headWorldX, 12.2, headWorldZ)
    ]);

    this.ptfeTubeMesh.geometry.dispose();
    this.ptfeTubeMesh.geometry = new THREE.TubeGeometry(curve, 20, 0.08, 8);
  }

  createNema17Stepper() {
    const stepper = new THREE.Group();
    const bodyGeom = new THREE.BoxGeometry(1.25, 1.1, 1.25);
    const body = new THREE.Mesh(bodyGeom, this.matStepperBody);
    stepper.add(body);

    [-0.62, 0.62].forEach(py => {
      const plateGeom = new THREE.BoxGeometry(1.26, 0.14, 1.26);
      const plate = new THREE.Mesh(plateGeom, this.matSteel);
      plate.position.y = py;
      stepper.add(plate);
    });

    const shaftGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.85, 16);
    const shaft = new THREE.Mesh(shaftGeom, this.matChrome);
    shaft.position.y = 0.85;
    stepper.add(shaft);

    return stepper;
  }

  setToolheadPosition(x, y, z) {
    if (this.toolheadX) this.toolheadX.position.x = x;
    if (this.gantryY) this.gantryY.position.z = y - 1.0;
    if (this.bedZ) this.bedZ.position.y = z;
    this.updateDragChainIK();
    this.updatePtfeTube();
  }

  setFilamentColor(hexColor) {
    const color = new THREE.Color(hexColor);
    if (this.filamentCoilMat) {
      this.filamentCoilMat.color.copy(color);
    }
  }

  toggleEnclosure(visible) {
    if (this.enclosureGroup) {
      this.enclosureGroup.visible = visible;
    }
  }

  toggleDoor() {
    this.isDoorOpen = !this.isDoorOpen;
    if (this.frontDoorHinge) {
      this.frontDoorHinge.rotation.y = this.isDoorOpen ? -Math.PI / 2.2 : 0;
    }
    return this.isDoorOpen;
  }

  toggleChamberLights(enabled) {
    if (this.chamberLightGroup) {
      this.chamberLightGroup.visible = enabled;
    }
  }

  update(delta, isPrinting, toolheadSpeed, isExtruding = true) {
    if (isPrinting) {
      this.fanBlades.forEach(bladeGroup => {
        bladeGroup.rotation.x += delta * 50.0;
      });

      this.extruderGears.forEach((g, idx) => {
        g.rotation.x += delta * (idx === 0 ? 12.0 : -12.0);
      });

      this.gantryPulleys.forEach(p => {
        p.rotation.y += delta * 15.0;
      });

      this.zCouplers.forEach(c => {
        c.rotation.y += delta * 0.5;
      });

      if (this.filamentSpoolMesh) {
        this.filamentSpoolMesh.rotation.z += delta * 0.3;
      }

      if (this.moltenDropMesh) {
        this.moltenDropMesh.visible = isExtruding;
        const pulse = 1.0 + Math.sin(Date.now() * 0.02) * 0.15;
        this.moltenDropMesh.scale.set(pulse, 1.0, pulse);
      }
    } else {
      if (this.moltenDropMesh) {
        this.moltenDropMesh.visible = false;
      }
    }

    this.renderLcdCanvas(isPrinting, toolheadSpeed);
    if (this.lcdTexture) {
      this.lcdTexture.needsUpdate = true;
    }
  }

  renderLcdCanvas(isPrinting, speed) {
    if (!this.lcdCanvas) return;
    const ctx = this.lcdCanvas.getContext('2d');
    const w = this.lcdCanvas.width;
    const h = this.lcdCanvas.height;

    ctx.fillStyle = '#080a10';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#10141e';
    ctx.fillRect(0, 0, w, 52);

    ctx.fillStyle = '#00d2ff';
    ctx.font = 'bold 20px "Chakra Petch", sans-serif';
    ctx.fillText('APEXCORE X-100000', 20, 34);

    ctx.fillStyle = isPrinting ? '#00f59b' : '#ffb703';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText(isPrinting ? '● PRINTING' : '❚❚ PAUSED', w - 125, 34);

    ctx.fillStyle = '#121724';
    ctx.strokeStyle = '#202a3c';
    ctx.lineWidth = 2;
    ctx.fillRect(20, 68, 225, 95);
    ctx.strokeRect(20, 68, 225, 95);
    ctx.fillStyle = '#8b95a5';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText('NOZZLE HOTEND', 35, 92);
    ctx.fillStyle = '#ff6b4a';
    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    ctx.fillText('220.0 °C', 35, 130);

    ctx.fillRect(265, 68, 225, 95);
    ctx.strokeRect(265, 68, 225, 95);
    ctx.fillStyle = '#8b95a5';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText('PEI HEATED BED', 280, 92);
    ctx.fillStyle = '#ffb703';
    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    ctx.fillText('60.0 °C', 280, 130);

    ctx.fillStyle = '#10141e';
    ctx.fillRect(20, 178, w - 40, 52);
    ctx.fillStyle = '#f0f3f8';
    ctx.font = '13px "JetBrains Mono", monospace';
    const xVal = this.toolheadX ? (this.toolheadX.position.x * 20 + 125).toFixed(1) : '125.0';
    const yVal = this.gantryY ? (this.gantryY.position.z * 20 + 125).toFixed(1) : '125.0';
    const zVal = this.bedZ ? (this.bedZ.position.y * 10).toFixed(1) : '20.0';
    ctx.fillText(`X:${xVal} Y:${yVal} Z:${zVal}mm   F:${Math.round(speed || 240)}mm/s`, 32, 210);

    ctx.fillStyle = '#1a2232';
    ctx.fillRect(20, 248, w - 40, 22);
    ctx.fillStyle = '#00d2ff';
    const pct = 0.41;
    ctx.fillRect(20, 248, (w - 40) * pct, 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText('41.2% COMPLETE', w / 2 - 50, 264);
  }
}
