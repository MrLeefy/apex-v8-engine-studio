import * as THREE from 'three';

const DEG = Math.PI / 180;
const FRONT_Z = -2.58;

/**
 * High-detail GMT800 front-drive fallback reconstructed from the 2000-2006
 * Tahoe physical layout and OE catalog identities.
 *
 * This is deliberately tagged DIMENSIONALLY_RECONSTRUCTED / reference-based,
 * NOT OEM CAD. It exists so the visible fallback is mechanically faithful while
 * true CAD-derived parts are acquired by CadAssetOverlay.
 */
export function installGmt800ReferenceFrontDrive(engine) {
  const old = engine.subassemblies?.frontDrive;
  if (old) old.visible = false;

  // Do not animate invisible placeholder pulleys anymore.
  if (Array.isArray(engine.pulleys) && old) {
    engine.pulleys = engine.pulleys.filter(p => !isDescendantOf(p, old));
  }

  const g = new THREE.Group();
  g.name = 'GMT800_2006_Tahoe_Reference_Front_Drive';
  g.userData.fidelity = 'DIMENSIONALLY_RECONSTRUCTED';
  g.userData.note = 'Reference-grounded fallback; superseded automatically by provenance-verified CAD assets.';

  const cast = engine.matAluminum;
  const steel = engine.matSteel;
  const darkSteel = engine.matIron;
  const rubber = engine.matRubber;
  const copper = engine.matCopper;
  const connector = engine.matConnector;

  // ---------------------------------------------------------------------------
  // Front cover / block-facing structure
  // ---------------------------------------------------------------------------
  const coverShape = new THREE.Shape();
  coverShape.moveTo(-1.10, -0.55);
  coverShape.lineTo(1.10, -0.55);
  coverShape.lineTo(1.34, 0.25);
  coverShape.lineTo(1.08, 1.38);
  coverShape.quadraticCurveTo(0.45, 1.75, 0, 1.62);
  coverShape.quadraticCurveTo(-0.45, 1.75, -1.08, 1.38);
  coverShape.lineTo(-1.34, 0.25);
  coverShape.closePath();
  const cover = new THREE.Mesh(new THREE.ExtrudeGeometry(coverShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.025,
    bevelSegments: 2
  }), cast);
  cover.position.set(0, 0.05, FRONT_Z + 0.18);
  cover.castShadow = true;
  g.add(cover);
  register(engine, cover, 'Engine Front Cover', '12633906', 'Front Drive', 'GM front cover; reference fallback geometry');

  // Front-cover perimeter fastener stations: catalog lists 8 M8 cover bolts.
  const coverBolts = [
    [-0.94, -0.22], [0.94, -0.22], [-1.10, 0.45], [1.10, 0.45],
    [-0.82, 1.10], [0.82, 1.10], [-0.34, 1.48], [0.34, 1.48]
  ];
  for (const [x, y] of coverBolts) {
    const b = makeAxialBolt(engine, 0.055, 0.12, steel, `${x}_${y}`);
    b.position.set(x, y, FRONT_Z - 0.015);
    g.add(b);
  }

  // ---------------------------------------------------------------------------
  // Water pump, hub, thermostat inlet and six M8x1.25x83 fasteners
  // ---------------------------------------------------------------------------
  const waterPump = new THREE.Group();
  waterPump.name = 'GM_12703898_Water_Pump';
  waterPump.position.set(0, 0.78, FRONT_Z - 0.02);

  const wpCenter = axialCylinder(0.56, 0.34, cast, 48);
  waterPump.add(wpCenter);
  const wpLobeL = axialCylinder(0.34, 0.28, cast, 36);
  wpLobeL.position.set(-0.48, -0.03, 0.03);
  waterPump.add(wpLobeL);
  const wpLobeR = axialCylinder(0.34, 0.28, cast, 36);
  wpLobeR.position.set(0.48, -0.03, 0.03);
  waterPump.add(wpLobeR);

  // Cast connecting bridges / ribs.
  for (const [x, rot] of [[-0.36, -22], [0.36, 22]]) {
    const rib = engine.box(0.18, 0.58, 0.16, cast, new THREE.Vector3(x, -0.18, 0.04));
    rib.rotation.z = rot * DEG;
    waterPump.add(rib);
  }

  const hub = axialCylinder(0.20, 0.48, steel, 32);
  hub.position.z = -0.20;
  waterPump.add(hub);

  const wpBoltStations = [
    [-0.63, -0.22], [-0.43, 0.34], [-0.18, -0.45],
    [0.18, -0.45], [0.43, 0.34], [0.63, -0.22]
  ];
  for (let i = 0; i < wpBoltStations.length; i++) {
    const [x, y] = wpBoltStations[i];
    const bolt = makeAxialBolt(engine, 0.050, 0.15, steel, `WaterPumpBolt_${i + 1}`);
    bolt.position.set(x, y, -0.18);
    waterPump.add(bolt);
  }

  // Thermostat / lower radiator inlet is low passenger-side on the pump.
  const inlet = new THREE.Group();
  inlet.position.set(-0.62, -0.34, -0.02);
  inlet.rotation.z = -55 * DEG;
  const inletBody = engine.cyl(0.19, 0.48, cast, null, 28);
  inletBody.rotation.z = Math.PI / 2;
  inlet.add(inletBody);
  const neckLip = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.025, 8, 28), cast);
  neckLip.rotation.y = Math.PI / 2;
  neckLip.position.x = 0.24;
  inlet.add(neckLip);
  waterPump.add(inlet);

  g.add(waterPump);
  register(engine, wpCenter, 'Water Pump Assembly', '12703898', 'Cooling', 'GM water-pump kit; six M8x1.25x83 mounting bolts represented');
  register(engine, inletBody, 'Water Pump Inlet / Thermostat Housing', '12600172', 'Cooling', 'Includes production-style inlet and thermostat location');

  // Water-pump/fan pulley: large black stamped-steel pulley in front-center.
  const waterPulley = makeGroovedPulley(engine, {
    name: 'Water_Pump_Fan_Pulley', x: 0, y: 0.78, z: FRONT_Z - 0.45,
    radius: 0.50, width: 0.12, grooves: 6, material: darkSteel, hubMaterial: steel
  });
  g.add(waterPulley);

  // ---------------------------------------------------------------------------
  // Harmonic balancer / crank drive. Main and A/C belts use separate planes.
  // ---------------------------------------------------------------------------
  const crank = new THREE.Group();
  crank.name = 'Harmonic_Balancer_Crank_Pulley';
  crank.position.set(0, -0.66, FRONT_Z - 0.42);
  const damperBack = axialCylinder(0.61, 0.20, darkSteel, 56);
  crank.add(damperBack);
  const damperRubber = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.06, 10, 56), rubber);
  crank.add(damperRubber);
  const mainSheave = groovedSheave(0.59, 0.15, 6, darkSteel);
  mainSheave.position.z = -0.14;
  crank.add(mainSheave);
  const acSheave = groovedSheave(0.48, 0.10, 4, darkSteel);
  acSheave.position.z = 0.14;
  crank.add(acSheave);
  const crankBolt = makeAxialBolt(engine, 0.12, 0.22, steel, 'CrankBalancerBolt');
  crankBolt.position.z = -0.22;
  crank.add(crankBolt);
  g.add(crank);
  engine.pulleys.push(crank);
  register(engine, damperBack, 'Harmonic Balancer / Crank Pulley', '12557840 bolt / OE balancer assembly', 'Front Drive', 'Dual belt-plane crank drive; center bolt modeled as M16x2x103 identity');

  // ---------------------------------------------------------------------------
  // Driver-side (viewer right) generator / P.S. cast bracket and alternator.
  // ---------------------------------------------------------------------------
  const genBracket = new THREE.Group();
  genBracket.name = 'GM_12554030_Generator_PS_Bracket';
  genBracket.position.set(0.76, 0.84, FRONT_Z + 0.02);

  const bracketBase = engine.box(0.85, 1.58, 0.24, cast, new THREE.Vector3(0.08, 0.22, 0));
  bracketBase.rotation.z = -8 * DEG;
  genBracket.add(bracketBase);
  const upperEar = engine.box(0.62, 0.28, 0.30, cast, new THREE.Vector3(0.30, 1.02, 0));
  upperEar.rotation.z = 18 * DEG;
  genBracket.add(upperEar);
  const lowerEar = engine.box(0.58, 0.28, 0.30, cast, new THREE.Vector3(-0.15, -0.64, 0));
  lowerEar.rotation.z = -18 * DEG;
  genBracket.add(lowerEar);

  // Cast reinforcing ribs on the face.
  for (let i = 0; i < 4; i++) {
    const rib = engine.box(0.065, 1.25 - i * 0.13, 0.055, cast, new THREE.Vector3(-0.18 + i * 0.18, 0.20, -0.17));
    rib.rotation.z = (-24 + i * 14) * DEG;
    genBracket.add(rib);
  }

  // Four bracket mounting bolts represented from catalog architecture.
  const gbBolts = [[-0.22, -0.46], [0.22, -0.06], [0.11, 0.55], [0.36, 0.92]];
  gbBolts.forEach(([x, y], i) => {
    const b = makeAxialBolt(engine, 0.057, 0.18, steel, `GenPSBracketBolt_${i + 1}`);
    b.position.set(x, y, -0.19);
    genBracket.add(b);
  });
  g.add(genBracket);
  register(engine, bracketBase, 'Generator & Power-Steering Pump Bracket', '12554030', 'Front Drive', 'GM catalog-identified front accessory bracket; surface geometry remains reference reconstructed');

  // Alternator high driver side.
  const alternator = buildAlternator(engine, 1.14, 1.62, FRONT_Z - 0.34);
  g.add(alternator.group);
  engine.pulleys.push(alternator.pulley);
  register(engine, alternator.body, 'Alternator / Generator', 'equipment-dependent OE generator', 'Electrical / Front Drive', 'GMT800 high-mounted generator location; exact amperage unit remains equipment-code dependent');

  // Power-steering pump / pulley on opposite upper side.
  const ps = buildPowerSteering(engine, -1.12, 0.64, FRONT_Z - 0.32);
  g.add(ps.group);
  engine.pulleys.push(ps.pulley);
  register(engine, ps.body, 'Power Steering Pump', '19420684', 'Steering / Front Drive', 'GMT800 1500-series pump identity represented with pressed-on pulley');

  // ---------------------------------------------------------------------------
  // Main idler and two-bolt replacement tensioner.
  // ---------------------------------------------------------------------------
  const idler = makeGroovedPulley(engine, {
    name: 'Main_Smooth_Idler_12669569', x: 0.28, y: 1.22, z: FRONT_Z - 0.46,
    radius: 0.27, width: 0.11, grooves: 0, material: darkSteel, hubMaterial: steel
  });
  g.add(idler);

  const mainTensioner = buildTensioner(engine, 0.48, 0.36, FRONT_Z - 0.40, '12609719', false);
  g.add(mainTensioner.group);
  engine.pulleys.push(mainTensioner.pulley);
  register(engine, mainTensioner.body, 'Main Accessory Drive Belt Tensioner', '12609719', 'Front Drive', 'Two-bolt service design; replaces earlier three-bolt tensioner');

  // ---------------------------------------------------------------------------
  // Passenger low A/C bracket + compressor + dedicated 4-rib tensioner.
  // ---------------------------------------------------------------------------
  const acBracket = new THREE.Group();
  acBracket.name = 'GM_12643257_AC_Compressor_Bracket';
  acBracket.position.set(-1.06, -0.20, FRONT_Z + 0.02);
  const acBase = engine.box(0.72, 0.76, 0.30, cast, new THREE.Vector3(0, 0, 0));
  acBase.rotation.z = 12 * DEG;
  acBracket.add(acBase);
  const acEar1 = engine.box(0.34, 0.25, 0.35, cast, new THREE.Vector3(0.25, 0.42, 0));
  acBracket.add(acEar1);
  const acEar2 = engine.box(0.34, 0.25, 0.35, cast, new THREE.Vector3(-0.27, -0.42, 0));
  acBracket.add(acEar2);
  for (let i = 0; i < 3; i++) {
    const b = makeAxialBolt(engine, 0.057, 0.17, steel, `ACBracketBolt_${i + 1}`);
    const positions = [[-0.22, 0.19], [0.20, 0.28], [0.02, -0.28]];
    b.position.set(...positions[i], -0.19);
    acBracket.add(b);
  }
  g.add(acBracket);
  register(engine, acBase, 'A/C Compressor Mounting Bracket', '12643257', 'A/C Front Drive', 'Catalog-identified bracket with three primary mounting fasteners represented');

  const ac = buildAcCompressor(engine, -1.34, -0.42, FRONT_Z - 0.25);
  g.add(ac.group);
  engine.pulleys.push(ac.pulley);
  register(engine, ac.body, 'A/C Compressor', '37183465 / service supersession 19436043', 'A/C Front Drive', 'Low passenger-side compressor with separate four-groove clutch drive');

  const acTensioner = buildTensioner(engine, -0.56, -0.72, FRONT_Z - 0.24, '12580196', true);
  g.add(acTensioner.group);
  engine.pulleys.push(acTensioner.pulley);
  register(engine, acTensioner.body, 'A/C Compressor Belt Tensioner', '12580196', 'A/C Front Drive', 'Dedicated secondary-belt tensioner; not part of the main six-rib loop');

  // ---------------------------------------------------------------------------
  // Two physically separate belt planes.
  // ---------------------------------------------------------------------------
  const mainBeltZ = FRONT_Z - 0.58;
  const mainBelt = beltTube([
    [-0.50, -0.91], [-1.43, -0.02], [-1.38, 0.74], [-0.88, 0.98],
    [0.66, 1.74], [1.35, 1.79], [1.48, 1.48], [0.55, 1.12],
    [0.15, 0.82], [0.69, 0.36], [0.58, -0.05], [0.42, -0.75]
  ], mainBeltZ, 0.050, rubber);
  mainBelt.name = 'Main_6_Rib_Accessory_Belt';
  mainBelt.userData.belt = { ribs: 6, gmPart: '12637202/12637204', catalogLengthMm: '2345 or 2365 depending equipment code', drives: ['crank', 'water pump/fan', 'generator', 'power steering', 'idler', 'main tensioner'] };
  g.add(mainBelt);
  register(engine, mainBelt, 'Main 6-Rib Accessory Drive Belt', '12637202 / 12637204', 'Front Drive', 'Separate fan/water-pump/generator/P.S. belt. Exact service length depends on equipment code.');

  const acBeltZ = FRONT_Z - 0.27;
  const acBelt = beltTube([
    [-0.37, -0.90], [-0.92, -1.04], [-1.60, -0.70], [-1.60, -0.24],
    [-1.34, -0.10], [-0.80, -0.34], [-0.42, -0.63]
  ], acBeltZ, 0.042, rubber);
  acBelt.name = 'Dedicated_4_Rib_AC_Belt';
  acBelt.userData.belt = { ribs: 4, gmPart: '12576447', catalogLengthMm: 960, drives: ['crank inner sheave', 'A/C compressor', 'A/C tensioner'] };
  g.add(acBelt);
  register(engine, acBelt, 'Dedicated 4-Rib A/C Compressor Belt', '12576447', 'A/C Front Drive', 'Catalog-listed 960 mm four-rib A/C drive belt for applicable equipment codes.');

  engine.group.add(g);
  engine.subassemblies.frontDrive = g;
  engine.serpentineBelt = mainBelt;
  engine.acDriveBelt = acBelt;

  if (typeof engine.rememberExplode === 'function') {
    engine.rememberExplode(g, new THREE.Vector3(0, 0, -2.5));
  }

  return g;
}

function isDescendantOf(obj, ancestor) {
  let p = obj;
  while (p) {
    if (p === ancestor) return true;
    p = p.parent;
  }
  return false;
}

function register(engine, mesh, name, part, category, description) {
  engine.registerPart(mesh, engine.meta(
    name,
    category,
    `GM/OE identity ${part} • reference-reconstructed fallback`,
    `${description}. This mesh is not claimed to be OEM surface CAD; CadAssetOverlay may replace it with provenance-verified geometry.`
  ));
}

function axialCylinder(radius, depth, material, segments = 36) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), material);
  m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeAxialBolt(engine, radius, length, material, name) {
  const g = new THREE.Group();
  g.name = name;
  const shank = axialCylinder(radius * 0.58, length, material, 12);
  const head = axialCylinder(radius, radius * 0.72, material, 6);
  head.position.z = -length * 0.52;
  g.add(shank, head);
  return g;
}

function groovedSheave(radius, width, grooves, material) {
  const group = new THREE.Group();
  const core = axialCylinder(radius * 0.97, width, material, 48);
  group.add(core);
  if (grooves > 0) {
    for (let i = 0; i <= grooves; i++) {
      const z = -width / 2 + (i / grooves) * width;
      const lip = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 6, 48), material);
      lip.position.z = z;
      group.add(lip);
    }
  }
  return group;
}

function makeGroovedPulley(engine, { name, x, y, z, radius, width, grooves, material, hubMaterial }) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  g.add(groovedSheave(radius, width, grooves, material));
  const hub = axialCylinder(radius * 0.22, width * 1.28, hubMaterial, 24);
  g.add(hub);
  const bolt = axialCylinder(radius * 0.09, width * 1.38, hubMaterial, 6);
  bolt.position.z = -0.02;
  g.add(bolt);
  engine.pulleys.push(g);
  return g;
}

function buildAlternator(engine, x, y, z) {
  const g = new THREE.Group();
  g.name = 'GMT800_Alternator';
  g.position.set(x, y, z);

  const body = axialCylinder(0.40, 0.48, engine.matAluminum, 48);
  g.add(body);
  const rear = axialCylinder(0.34, 0.14, engine.matAluminum, 42);
  rear.position.z = 0.28;
  g.add(rear);
  const copper = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.045, 8, 40), engine.matCopper);
  copper.position.z = -0.23;
  g.add(copper);

  // Alternator case ventilation windows.
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const slot = engine.box(0.045, 0.17, 0.055, engine.matIron, new THREE.Vector3(Math.cos(a) * 0.33, Math.sin(a) * 0.33, -0.25));
    slot.rotation.z = a;
    g.add(slot);
  }

  // Two mounting ears / long through bolts.
  for (const sx of [-1, 1]) {
    const ear = engine.box(0.18, 0.22, 0.40, engine.matAluminum, new THREE.Vector3(sx * 0.38, -0.15, 0.03));
    g.add(ear);
    const bolt = makeAxialBolt(engine, 0.055, 0.52, engine.matSteel, `AlternatorThroughBolt_${sx}`);
    bolt.position.set(sx * 0.38, -0.15, -0.18);
    g.add(bolt);
  }

  const pulley = new THREE.Group();
  pulley.name = 'Alternator_6_Rib_Pulley';
  pulley.position.z = -0.34;
  pulley.add(groovedSheave(0.21, 0.12, 6, engine.matSteel));
  const nut = axialCylinder(0.075, 0.10, engine.matSteel, 6);
  nut.position.z = -0.08;
  pulley.add(nut);
  g.add(pulley);

  return { group: g, body, pulley };
}

function buildPowerSteering(engine, x, y, z) {
  const g = new THREE.Group();
  g.name = 'GMT800_Power_Steering_Pump';
  g.position.set(x, y, z);
  const body = axialCylinder(0.30, 0.43, engine.matSteel, 36);
  g.add(body);
  const neck = engine.cyl(0.12, 0.42, engine.matSteel, new THREE.Vector3(-0.18, 0.26, 0.10), 24);
  neck.rotation.z = -18 * DEG;
  g.add(neck);
  const reservoir = engine.box(0.34, 0.48, 0.34, engine.matComposite, new THREE.Vector3(-0.26, 0.43, 0.10));
  g.add(reservoir);
  const cap = axialCylinder(0.11, 0.06, engine.matComposite, 24);
  cap.position.set(-0.26, 0.69, 0.10);
  g.add(cap);

  const pulley = new THREE.Group();
  pulley.name = 'Power_Steering_6_Rib_Pulley';
  pulley.position.z = -0.32;
  const sheave = groovedSheave(0.40, 0.12, 6, engine.matIron);
  pulley.add(sheave);
  // Molded/spoked look.
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const spoke = engine.box(0.08, 0.46, 0.055, engine.matIron, new THREE.Vector3(Math.cos(a) * 0.15, Math.sin(a) * 0.15, -0.08));
    spoke.rotation.z = a;
    pulley.add(spoke);
  }
  g.add(pulley);
  return { group: g, body, pulley };
}

function buildAcCompressor(engine, x, y, z) {
  const g = new THREE.Group();
  g.name = 'GMT800_AC_Compressor';
  g.position.set(x, y, z);
  const body = axialCylinder(0.34, 0.72, engine.matAluminum, 32);
  g.add(body);
  // Longitudinal cast case ribs.
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const rib = engine.box(0.045, 0.18, 0.62, engine.matAluminum, new THREE.Vector3(Math.cos(a) * 0.30, Math.sin(a) * 0.30, 0));
    rib.rotation.z = a;
    g.add(rib);
  }
  const rearHead = axialCylinder(0.35, 0.12, engine.matAluminum, 30);
  rearHead.position.z = 0.40;
  g.add(rearHead);
  const connector = engine.box(0.16, 0.12, 0.22, engine.matConnector, new THREE.Vector3(-0.22, 0.27, 0.27));
  g.add(connector);

  const pulley = new THREE.Group();
  pulley.name = 'AC_4_Rib_Clutch_Pulley';
  pulley.position.z = -0.45;
  pulley.add(groovedSheave(0.38, 0.12, 4, engine.matSteel));
  const clutch = axialCylinder(0.28, 0.055, engine.matSteel, 36);
  clutch.position.z = -0.10;
  pulley.add(clutch);
  const centerBolt = axialCylinder(0.055, 0.08, engine.matSteel, 6);
  centerBolt.position.z = -0.15;
  pulley.add(centerBolt);
  g.add(pulley);

  return { group: g, body, pulley };
}

function buildTensioner(engine, x, y, z, part, ac) {
  const g = new THREE.Group();
  g.name = `${ac ? 'AC' : 'Main'}_Belt_Tensioner_${part}`;
  g.position.set(x, y, z);
  const body = axialCylinder(0.24, 0.13, engine.matAluminum, 32);
  g.add(body);
  const arm = engine.box(0.16, 0.58, 0.13, engine.matAluminum, new THREE.Vector3(ac ? -0.13 : 0.15, ac ? -0.24 : 0.23, 0));
  arm.rotation.z = (ac ? -28 : 30) * DEG;
  g.add(arm);
  const springBoss = axialCylinder(0.13, 0.16, engine.matSteel, 28);
  g.add(springBoss);

  const pulley = new THREE.Group();
  pulley.name = `${ac ? 'AC' : 'Main'}_Tensioner_Pulley`;
  pulley.position.set(ac ? -0.28 : 0.30, ac ? -0.46 : 0.46, -0.08);
  pulley.add(groovedSheave(ac ? 0.20 : 0.23, 0.10, ac ? 4 : 0, engine.matIron));
  const bolt = axialCylinder(0.055, 0.14, engine.matSteel, 6);
  bolt.position.z = -0.08;
  pulley.add(bolt);
  g.add(pulley);
  return { group: g, body, pulley };
}

function beltTube(points2d, z, radius, material) {
  const pts = points2d.map(([x, y]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.35);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, radius, 8, true), material);
  mesh.castShadow = true;
  return mesh;
}
