// 2006 Chevrolet Tahoe GMT800 5.3L Vortec 5300 reference data.
// Default: L59 (VIN Z, FlexFuel), the 5.3L configuration commonly fitted to 2006 Tahoe Z71.
// LM7 (VIN T) uses the same Gen III iron-block 5.3L physical architecture for this model.
// Dimensions are stored in inches unless otherwise noted.

export const TAHOE_53 = Object.freeze({
  family: 'GM Gen III Small-Block / Vortec 5300',
  application: '2006 Chevrolet Tahoe GMT800',
  defaultRpo: 'L59',
  variants: Object.freeze({
    L59: Object.freeze({ vin8: 'Z', fuel: 'Gasoline / E85 FlexFuel', induction: 'Naturally aspirated', powerHp: 295, powerRpm: 5200, torqueLbFt: 335, torqueRpm: 4000 }),
    LM7: Object.freeze({ vin8: 'T', fuel: 'Gasoline', induction: 'Naturally aspirated', powerHp: 295, powerRpm: 5200, torqueLbFt: 335, torqueRpm: 4000 })
  }),

  architecture: Object.freeze({
    cylinders: 8,
    bankIncludedAngleDeg: 90,
    valvesPerCylinder: 2,
    totalValves: 16,
    valvetrain: 'OHV pushrod, single in-block camshaft, hydraulic roller lifters',
    rockerRatio: 1.7,
    firingOrder: Object.freeze([1, 8, 7, 2, 6, 5, 4, 3]),
    cylinderNumbering: Object.freeze({ leftDriver: [1, 3, 5, 7], rightPassenger: [2, 4, 6, 8] }),
    crankReluctor: '24X',
    camReluctor: '1X',
    throttleBodyMm: 78,
    blockMaterial: 'cast iron',
    headMaterial: '356-T6 cast aluminum',
    intakeMaterial: 'composite nylon',
    exhaustManifoldMaterial: 'cast nodular iron'
  }),

  geometry: Object.freeze({
    displacementCc: 5328,
    displacementCid: 325,
    boreIn: 3.78,
    boreMinMm: 96.0,
    boreMaxMm: 96.018,
    strokeIn: 3.622,
    strokeMm: 92.0,
    crankRadiusIn: 1.811,
    rodLengthIn: 6.098,
    boreSpacingIn: 4.4,
    deckHeightMinIn: 9.235,
    deckHeightMaxIn: 9.245,
    deckHeightNominalIn: 9.24,
    cylinderBankOffsetIn: 0.9488,
    mainJournalDiameterIn: 2.559,
    rodJournalDiameterIn: 2.0995,
    mainHousingBoreIn: 2.751,
    lifterDiameterIn: 0.842,
    compressionRatio: 9.5,
    sparkPlugGapIn: 0.04
  }),

  // Three.js scene scale: 1 scene unit = 4 real inches.
  scene: Object.freeze({ inchesPerUnit: 4.0, frontZ: -1 })
});

export const inch = (value) => value / TAHOE_53.scene.inchesPerUnit;
export const mm = (value) => inch(value / 25.4);
