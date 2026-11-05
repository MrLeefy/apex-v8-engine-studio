/**
 * Shared engine timing for the Apex-V8 (single source of truth for kinematics,
 * valve events, ignition events and the acoustic model).
 *
 * Cylinder index convention (matches EngineModel.pistons order):
 *   0..3  = left bank, front -> rear
 *   4..7  = right bank, front -> rear
 * Display numbering follows the common V8 convention: left bank odd (1,3,5,7),
 * right bank even (2,4,6,8), cylinder 1 at the front of the left bank.
 *
 * Angles:
 *   crankRad  - cumulative crankshaft angle (radians), rotating +Z (CCW).
 *   cycleDeg  - position inside the 720° four-stroke cycle, 0..720.
 * A cylinder's FIRING angle is the cycle angle at which its piston reaches TDC on
 * the compression stroke. Everything else (spark, valve events, exhaust pulse) is
 * expressed relative to that.
 */

export const CYL_COUNT = 8;
export const CRANK_RADIUS = 0.35;
export const ROD_LENGTH = 1.35;

/** Cross-plane crank: four throws at 90° spacing. */
export const PIN_PHASES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

export const BANK_ANGLES = [
  Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4,
  -Math.PI / 4, -Math.PI / 4, -Math.PI / 4, -Math.PI / 4
];

/** Crank-pin phase used by each cylinder (both rods of a throw share one pin). */
export const PISTON_PHASES = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
  i < 4 ? PIN_PHASES[i] : PIN_PHASES[i - 4] + Math.PI / 2
);

export const BANK_OF = [0, 0, 0, 0, 1, 1, 1, 1];
export const CYL_NUMBER = [1, 3, 5, 7, 2, 4, 6, 8];

const TWO_PI = Math.PI * 2;
const DEG = 180 / Math.PI;

export function wrap(v, m) {
  return ((v % m) + m) % m;
}

/**
 * Slider-crank angle of a cylinder measured from its own bore axis.
 * theta = 0 is TDC. Derived from the actual crank-pin world angle so the rods
 * track the rotating pins exactly.
 */
export function cylinderTheta(i, crankRad) {
  return Math.PI / 2 + BANK_ANGLES[i] - crankRad - PISTON_PHASES[i];
}

/** Piston pin height above crank centre along the bore axis (scene units). */
export function pistonTravel(theta, r = CRANK_RADIUS, l = ROD_LENGTH) {
  const s = Math.sin(theta);
  return r * Math.cos(theta) + Math.sqrt(l * l - r * r * s * s);
}

/** TDC of each cylinder modulo one revolution, from the geometry. */
const TDC_360 = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
  wrap((Math.PI / 2 + BANK_ANGLES[i] - PISTON_PHASES[i]) * DEG, 360)
);

/**
 * Companion cylinders (same throw position, 360° apart) — one fires while the
 * other is at overlap TDC. Choosing which of each pair fires first gives the
 * classic cross-plane bank pattern L-R-L-L-R-L-R-R, i.e. uneven per-bank pulse
 * spacing (the source of the V8 "burble").
 */
const CYCLE_OFFSET = [360, 0, 0, 0, 360, 360, 0, 360];

export const FIRING_DEG = TDC_360.map((d, i) => wrap(Math.round(d) + CYCLE_OFFSET[i], 720));

/** Cylinder indices sorted by when they fire. */
export const FIRING_SEQUENCE = [0, 1, 2, 3, 4, 5, 6, 7].sort((a, b) => FIRING_DEG[a] - FIRING_DEG[b]);

/** Firing order in display numbering, rotated to start at cylinder 1. */
export const FIRING_ORDER_LABEL = (() => {
  const nums = FIRING_SEQUENCE.map((i) => CYL_NUMBER[i]);
  const k = nums.indexOf(1);
  return nums.slice(k).concat(nums.slice(0, k));
})();

/**
 * Cam timing (crank degrees relative to firing TDC = 0).
 * Power 0-180, exhaust 180-360, intake 360-540, compression 540-720.
 */
export const CAM_PROFILES = {
  street: {
    label: 'Street (236°/240° @ .050")',
    evo: 122, evc: 372,   // exhaust opens 58° BBDC, closes 12° ATDC
    ivo: 348, ivc: 592,   // intake opens 12° BTDC, closes 52° ABDC
    idleRpm: 820,
    roughness: 0.035,     // cycle-to-cycle combustion variation at idle
    veShift: 0,
    lift: 0.09
  },
  race: {
    label: 'Race (262°/268° high-overlap)',
    evo: 98, evc: 398,
    ivo: 322, ivc: 618,
    idleRpm: 1050,
    roughness: 0.16,
    veShift: 900,         // torque peak moves up the rev range
    lift: 0.105
  }
};

/** Smooth valve lift 0..1 for a window [open, close] at relative cycle angle rel. */
export function valveLift(rel, open, close) {
  const dur = wrap(close - open, 720);
  const d = wrap(rel - open, 720);
  if (d >= dur) return 0;
  const s = Math.sin((Math.PI * d) / dur);
  return s * s;
}

/** Cycle angle (0..720) from cumulative crank radians. */
export function cycleDegFromCrank(crankRad) {
  return wrap(crankRad * DEG, 720);
}

export function crankRadFromCycleDeg(deg) {
  return (deg / DEG) % (TWO_PI * 2);
}
