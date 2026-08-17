// CAD provenance registry for the 2006 Chevrolet Tahoe GMT800 5.3L engine studio.
//
// RULE: A mesh may only be marked `oemVerified: true` when its geometry was
// obtained from an OEM/supplier CAD source or has been dimensionally verified
// against a traceable physical scan/measurement set. Catalog fitment alone is
// NOT enough to make geometry OEM-verified.
//
// The registry intentionally separates catalog identity from geometry fidelity.

export const CAD_SOURCE_TIERS = Object.freeze({
  OEM_CAD: 'OEM_CAD',
  OEM_SUPPLIER_CAD: 'OEM_SUPPLIER_CAD',
  PHYSICAL_SCAN: 'PHYSICAL_SCAN',
  DIMENSIONALLY_RECONSTRUCTED: 'DIMENSIONALLY_RECONSTRUCTED',
  THIRD_PARTY_CAD: 'THIRD_PARTY_CAD',
  PROCEDURAL_FALLBACK: 'PROCEDURAL_FALLBACK'
});

export const CAD_ASSETS = Object.freeze([
  // --- Cylinder heads / valvetrain -------------------------------------------------
  { id: 'cylinder_head_left', label: 'Driver-side cylinder head', gmPart: '12578925', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12578925-head-left.glb', replace: 'leftHead', oemVerified: false },
  { id: 'cylinder_head_right', label: 'Passenger-side cylinder head', gmPart: '12578925', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12578925-head-right.glb', replace: 'rightHead', oemVerified: false },
  { id: 'valve_cover_left', label: 'Driver-side rocker/valve cover', gmPart: '12570427', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12570427-valve-cover-left.glb', replace: 'leftValveCover', oemVerified: false },
  { id: 'valve_cover_right', label: 'Passenger-side rocker/valve cover', gmPart: '12582224', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12582224-valve-cover-right.glb', replace: 'rightValveCover', oemVerified: false },
  { id: 'pushrod', label: 'Valve pushrod', gmPart: '10238852', quantity: 16, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/10238852-pushrod.glb', oemVerified: false },
  { id: 'lifter', label: 'Hydraulic roller lifter', gmPart: '17122490', quantity: 16, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/17122490-lifter.glb', oemVerified: false },
  { id: 'lifter_guide', label: 'Valve lifter guide/tray', gmPart: '12595365', quantity: 4, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12595365-lifter-guide.glb', oemVerified: false },
  { id: 'rocker_arm', label: 'Valve rocker arm', gmPart: '12681275', quantity: 16, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12681275-rocker-arm.glb', oemVerified: false },
  { id: 'rocker_support', label: 'Rocker pivot support', gmPart: '12552203', quantity: 2, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12552203-rocker-support.glb', oemVerified: false },
  { id: 'intake_valve', label: 'Intake valve', gmPart: '12564494', quantity: 8, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12564494-intake-valve.glb', oemVerified: false },
  { id: 'exhaust_valve', label: 'Exhaust valve', gmPart: '12694167', quantity: 8, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12694167-exhaust-valve.glb', oemVerified: false },

  // --- Intake / exhaust / sensors -------------------------------------------------
  { id: 'exhaust_manifold_left', label: 'Driver-side exhaust manifold', gmPart: '12616285', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12616285-exhaust-manifold-left.glb', replace: 'leftExhaust', oemVerified: false },
  { id: 'exhaust_manifold_right', label: 'Passenger-side exhaust manifold', gmPart: '12616286', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12616286-exhaust-manifold-right.glb', replace: 'rightExhaust', oemVerified: false },
  { id: 'knock_sensor', label: 'Knock sensor', gmPart: '12589867', quantity: 2, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12589867-knock-sensor.glb', oemVerified: false },
  { id: 'ect_sensor', label: 'Engine coolant temperature sensor', gmPart: '12608814', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12608814-ect-sensor.glb', oemVerified: false },
  { id: 'cam_sensor', label: 'Camshaft position sensor', gmPart: '19420911', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/19420911-cam-sensor.glb', oemVerified: false },

  // --- Front cover / cooling -------------------------------------------------------
  { id: 'front_cover', label: 'Engine front cover', gmPart: '12633906', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12633906-front-cover.glb', oemVerified: false },
  { id: 'water_pump', label: 'Water pump assembly', gmPart: '12703898', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12703898-water-pump.glb', oemVerified: false },
  { id: 'water_pump_inlet', label: 'Water pump inlet / thermostat housing', gmPart: '12600172', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12600172-water-pump-inlet.glb', oemVerified: false },
  { id: 'thermostat', label: 'Engine coolant thermostat', gmPart: '12600171', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12600171-thermostat.glb', oemVerified: false },

  // --- GMT800 accessory drive ------------------------------------------------------
  { id: 'generator_ps_bracket', label: 'Generator & power-steering pump bracket', gmPart: '12554030', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12554030-generator-ps-bracket.glb', oemVerified: false },
  { id: 'power_steering_pump', label: 'Power steering pump', gmPart: '19420684', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/19420684-power-steering-pump.glb', oemVerified: false },
  { id: 'main_belt_tensioner', label: 'Main accessory-drive belt tensioner', gmPart: '12609719', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12609719-main-tensioner.glb', oemVerified: false },
  { id: 'main_idler_smooth', label: 'Smooth main-drive idler pulley', gmPart: '12669569', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12669569-idler-smooth.glb', oemVerified: false },
  { id: 'main_idler_grooved', label: '6-groove main-drive idler pulley', gmPart: '12580774', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12580774-idler-grooved.glb', oemVerified: false },
  { id: 'ac_compressor_bracket', label: 'A/C compressor mounting bracket', gmPart: '12643257', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12643257-ac-compressor-bracket.glb', oemVerified: false },
  { id: 'ac_belt_tensioner', label: 'A/C compressor belt tensioner', gmPart: '12580196', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12580196-ac-belt-tensioner.glb', oemVerified: false },
  { id: 'ac_compressor', label: 'A/C compressor', gmPart: '37183465', supersededBy: '19436043', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/37183465-ac-compressor.glb', oemVerified: false },
  { id: 'main_drive_belt', label: 'Main 6-rib fan/water-pump/generator/P/S belt', gmPart: '12637202/12637204', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/main-drive-belt.glb', notes: 'Catalog shows equipment-code dependent 2345 mm or 2365 mm belt variants.', oemVerified: false },
  { id: 'ac_drive_belt', label: 'Separate 4-rib A/C compressor belt', gmPart: '12576447', quantity: 1, sourceTier: CAD_SOURCE_TIERS.PROCEDURAL_FALLBACK, meshPath: '/cad/12576447-ac-belt.glb', notes: '960 mm, 4-rib catalog listing for applicable option codes.', oemVerified: false },

  // --- Exact fastener identities where catalog dimensions are published -----------
  { id: 'head_bolt_short', label: 'Cylinder-head short bolt M8x1.25x45', gmPart: '12558840', quantity: 10, sourceTier: CAD_SOURCE_TIERS.DIMENSIONALLY_RECONSTRUCTED, meshPath: '/cad/12558840-head-bolt-short.glb', oemVerified: false },
  { id: 'head_bolt_long', label: 'Cylinder-head bolt M11x2x100', gmPart: '19258707', quantity: 20, sourceTier: CAD_SOURCE_TIERS.DIMENSIONALLY_RECONSTRUCTED, meshPath: '/cad/19258707-head-bolt-long.glb', oemVerified: false },
  { id: 'exhaust_manifold_bolt', label: 'Exhaust-manifold bolt M8x1.25x30.7', gmPart: '11546600', quantity: 12, sourceTier: CAD_SOURCE_TIERS.DIMENSIONALLY_RECONSTRUCTED, meshPath: '/cad/11546600-exhaust-bolt.glb', oemVerified: false },
  { id: 'rocker_bolt', label: 'Rocker pivot support bolt M8x1.25x52.5', gmPart: '12560961', quantity: 16, sourceTier: CAD_SOURCE_TIERS.DIMENSIONALLY_RECONSTRUCTED, meshPath: '/cad/12560961-rocker-bolt.glb', oemVerified: false },
  { id: 'water_pump_bolt', label: 'Water-pump bolt M8x1.25x83', gmPart: '12551926', quantity: 6, sourceTier: CAD_SOURCE_TIERS.DIMENSIONALLY_RECONSTRUCTED, meshPath: '/cad/12551926-water-pump-bolt.glb', oemVerified: false },
  { id: 'crank_balancer_bolt', label: 'Crankshaft balancer bolt M16x2x103', gmPart: '12557840', quantity: 1, sourceTier: CAD_SOURCE_TIERS.DIMENSIONALLY_RECONSTRUCTED, meshPath: '/cad/12557840-balancer-bolt.glb', oemVerified: false }
]);

export function cadCoverageSummary() {
  const total = CAD_ASSETS.reduce((sum, p) => sum + p.quantity, 0);
  const verified = CAD_ASSETS.filter(p => p.oemVerified).reduce((sum, p) => sum + p.quantity, 0);
  const catalogParts = CAD_ASSETS.length;
  return { catalogParts, totalInstances: total, oemVerifiedInstances: verified, oemVerifiedPercent: total ? (verified / total) * 100 : 0 };
}
