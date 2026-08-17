import * as THREE from 'three';

const DEG = Math.PI / 180;
const FRONT_Z = -2.58;

/**
 * Second-stage GMT800 reference refinement.
 *
 * Grounds the visible fallback against:
 * - GM bracket 12554030 (generator + P/S pump share one cast bracket; 10 holes)
 * - real 2000-2006 Tahoe front-engine belt/accessory photographs
 * - OE catalog two-belt architecture
 *
 * This remains DIMENSIONALLY_RECONSTRUCTED/reference-derived rather than OEM
 * surface CAD. It exists to prevent a visually polished but mechanically wrong
 * fallback while exact CAD/scan assets are being sourced.
 */
export function refineGmt800FrontDrive(engine) {
  const drive = engine.subassemblies?.frontDrive;
  if (!drive) return null;

  // -------------------------------------------------------------------------
  // Correct shared generator / power-steering side.
  // The first reference build accidentally mirrored the P/S pump.
  // -------------------------------------------------------------------------
  const alternator = drive.getObjectByName('GMT800_Alternator');
  const powerSteering = drive.getObjectByName('GMT800_Power_Steering_Pump');
  const bracket = drive.getObjectByName('GM_12554030_Generator_PS_Bracket');
  const mainTensioner = drive.getObjectByName('Main_Belt_Tensioner_12609719');

  if (alternator) alternator.position.set(1.10, 1.55, FRONT_Z - 0.34);
  if (powerSteering) powerSteering.position.set(1.22, 0.26, FRONT_Z - 0.32);
  if (bracket) bracket.position.set(0.76, 0.66, FRONT_Z + 0.02);
  if (mainTensioner) mainTensioner.position.set(-0.58, 0.20, FRONT_Z - 0.40);

  // -------------------------------------------------------------------------
  // Add a much closer bracket face/web structure from the genuine 12554030
  // casting photographs. Exact surface curvature is not claimed; the 10-hole
  // count and shared accessory architecture are OE-grounded.
  // -------------------------------------------------------------------------
  const casting = new THREE.Group();
  casting.name = 'GM_12554030_Reference_Casting_Detail';
  casting.userData = {
    sourceTier: 'DIMENSIONALLY_RECONSTRUCTED',
    gmPart: '12554030',
    boltHoleQuantity: 10,
    sourceReference: 'GM Genuine Parts product imagery + OE product specification'
  };

  const shape = new THREE.Shape();
  shape.moveTo(-0.62, -0.76);
  shape.lineTo(0.42, -0.76);
  shape.quadraticCurveTo(0.66, -0.70, 0.70, -0.48);
  shape.lineTo(0.52, -0.20);
  shape.quadraticCurveTo(0.38, 0.02, 0.49, 0.20);
  shape.lineTo(0.66, 0.42);
  shape.lineTo(0.61, 1.30);
  shape.quadraticCurveTo(0.54, 1.52, 0.30, 1.56);
  shape.lineTo(0.14, 1.50);
  shape.lineTo(0.02, 1.05);
  shape.quadraticCurveTo(-0.08, 0.76, -0.32, 0.58);
  shape.lineTo(-0.56, 0.45);
  shape.lineTo(-0.66, 0.08);
  shape.closePath();

  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    bevelSegments: 2
  }), engine.matAluminum);
  plate.position.set(0.80, 0.62, FRONT_Z - 0.13);
  plate.castShadow = true;
  plate.receiveShadow = true;
  casting.add(plate);

  // Ten visible machined hole/boss cues matching the OE bracket's published
  // bolt-hole quantity. Positions are registered from product-photo topology,
  // not claimed as manufacturing-coordinate data.
  const holeStations = [
    [-0.48, -0.63, 0.105], [-0.08, -0.69, 0.105], [0.39, -0.56, 0.110],
    [-0.48, -0.10, 0.100], [-0.10, 0.03, 0.115], [0.36, -0.02, 0.105],
    [-0.32, 0.47, 0.105], [0.25, 0.56, 0.115], [0.43, 1.04, 0.105],
    [0.31, 1.39, 0.105]
  ];

  for (let i = 0; i < holeStations.length; i++) {
    const [x, y, r] = holeStations[i];
    const boss = axialCylinder(r + 0.050, 0.22, engine.matAluminum, 30);
    boss.position.set(0.80 + x, 0.62 + y, FRONT_Z - 0.23);
    casting.add(boss);
    const bore = axialCylinder(r, 0.25, engine.matIron, 28);
    bore.position.set(0.80 + x, 0.62 + y, FRONT_Z - 0.25);
    casting.add(bore);
  }

  // Strong triangular casting webs visible in the genuine bracket.
  const ribDefs = [
    [[0.40, 0.14], [0.82, 0.62]],
    [[0.48, 0.02], [1.04, -0.02]],
    [[0.72, 0.24], [1.16, 0.74]],
    [[0.66, 0.56], [0.94, 1.16]],
    [[0.34, 0.54], [0.65, 1.28]],
    [[0.30, 0.15], [0.34, 0.92]]
  ];
  for (const [[x1, y1], [x2, y2]] of ribDefs) {
    const rib = beamBetween(
      new THREE.Vector3(x1, y1, FRONT_Z - 0.37),
      new THREE.Vector3(x2, y2, FRONT_Z - 0.37),
      0.055,
      0.055,
      engine.matAluminum
    );
    casting.add(rib);
  }

  drive.add(casting);
  engine.registerPart(plate, engine.meta(
    'Generator & Power-Steering Pump Bracket — reference casting',
    'Front Drive',
    'GM 12554030 • aluminum • 10 published bolt holes',
    'Reference reconstruction from genuine GM product imagery. Alternator and power-steering pump are now on the same OE bracket side; exact OEM surface CAD remains provenance-gated.'
  ));

  // -------------------------------------------------------------------------
  // Replace the first reference main belt with a path matching the real
  // front-engine photograph after the P/S correction. Keep the dedicated A/C
  // circuit physically separate.
  // -------------------------------------------------------------------------
  if (engine.serpentineBelt) engine.serpentineBelt.visible = false;

  const mainBeltZ = FRONT_Z - 0.58;
  const mainBelt = beltTube([
    [-0.48, -0.91],
    [-0.93, -0.34],
    [-0.88, 0.18],
    [-0.50, 0.58],
    [-0.26, 1.18],
    [0.63, 1.82],
    [1.19, 1.85],
    [1.47, 1.49],
    [1.50, 0.70],
    [1.46, 0.20],
    [1.12, -0.05],
    [0.50, -0.91]
  ], mainBeltZ, 0.050, engine.matRubber);
  mainBelt.name = 'Main_6_Rib_Accessory_Belt';
  mainBelt.userData.belt = {
    ribs: 6,
    gmPart: '12637202/12637204',
    catalogLengthMm: '2345 or 2365 depending equipment code',
    drives: ['crank', 'water pump/fan pulley', 'generator', 'power steering', 'idler', 'main tensioner'],
    reference: '2000-2006 Tahoe front-engine service photograph + OE catalog'
  };
  drive.add(mainBelt);
  engine.serpentineBelt = mainBelt;
  engine.registerPart(mainBelt, engine.meta(
    'Main 6-Rib Accessory Drive Belt',
    'Front Drive',
    'GM 12637202 / 12637204 equipment-dependent service belt',
    'Reference-routed around the GMT800 crank, water-pump/fan pulley, alternator, power-steering pump, idler and main tensioner. A/C remains on its own four-rib belt.'
  ));
  // registerPart currently owns inspector userData, so restore engineering data.
  mainBelt.userData.belt = {
    ribs: 6,
    gmPart: '12637202/12637204',
    catalogLengthMm: '2345 or 2365 depending equipment code',
    drives: ['crank', 'water pump/fan pulley', 'generator', 'power steering', 'idler', 'main tensioner'],
    reference: '2000-2006 Tahoe front-engine service photograph + OE catalog'
  };

  // Keep explicit source trace on the whole reference drive.
  drive.userData.referenceSources = [
    { gmPart: '12554030', evidence: 'GM Genuine Parts generator/P.S. bracket image and 10-hole specification' },
    { gmPart: '12637202/12637204', evidence: 'OE main 6-rib drive belt catalog' },
    { gmPart: '12576447', evidence: 'OE separate 4-rib A/C belt catalog' }
  ];
  drive.userData.referenceStatus = 'REFERENCE_RECONSTRUCTED_NOT_OEM_SURFACE_CAD';

  return drive;
}

function axialCylinder(radius, depth, material, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function beamBetween(a, b, width, depth, material) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const length = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, depth), material);
  mesh.position.copy(mid);
  mesh.rotation.z = -Math.atan2(b.x - a.x, b.y - a.y);
  mesh.castShadow = true;
  return mesh;
}

function beltTube(points2d, z, radius, material) {
  const pts = points2d.map(([x, y]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.35);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 180, radius, 8, true), material);
  mesh.castShadow = true;
  return mesh;
}
