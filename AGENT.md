# 2006 Chevrolet Tahoe 5.3L Vortec 5300 3D Engine Studio — Agent Engineering Guide

## 1. Project target

This repository now targets the **2006 Chevrolet Tahoe GMT800 5.3L Vortec 5300**, not the former fictional 5.0L DOHC twin-turbo racing engine.

Default identity: **L59 / VIN 8th digit Z / FlexFuel** because that configuration was used in the 2006 Tahoe family and is the default target for the owner's Z71. GM also listed the **LM7 / VIN T** for 2006 Tahoe applications. The L59 and LM7 share the same core Gen III 5.3L iron-block physical architecture modeled here; do not invent different long-block geometry merely to change the fuel identity.

If the owner supplies the vehicle VIN, use the 8th VIN character to lock the displayed RPO:
- `Z` = L59 FlexFuel
- `T` = LM7 gasoline

## 2. Non-negotiable engine architecture

- GM Gen III small-block / Vortec 5300
- 90-degree V8
- 5,328 cc / 325 CID
- cast-iron deep-skirt block
- aluminum cathedral-port cylinder heads
- OHV / pushrod valvetrain
- **one** in-block camshaft
- hydraulic roller lifters
- **16 total valves / two valves per cylinder**
- coil-near-plug ignition
- sequential port fuel injection
- 78 mm electronic throttle body
- composite truck intake manifold
- cast nodular-iron stock exhaust manifolds
- naturally aspirated
- front crank-driven gerotor oil pump
- single timing chain
- GMT800 truck accessory drive

### Forbidden regressions

Do **not** add any of the following unless the user explicitly changes the project target:
- DOHC heads
- four camshafts
- 32 valves
- turbochargers
- wastegates
- blow-off valves
- turbo oil feed lines
- tubular racing headers
- carbon-fiber racing plenum
- 8,500 RPM race-engine telemetry
- 1,150 HP / boost telemetry
- billet racing-engine branding

## 3. Dimensional blueprint

`src/tahoe53Specs.js` is the single source of truth. Scene scale is **1 Three.js unit = 4 real inches**.

Published/service dimensions encoded in the model:
- bore: 3.780 in nominal / 96.0–96.018 mm service specification
- stroke: 3.622 in / 92.0 mm
- crank throw radius: 1.811 in
- bore spacing: 4.400 in
- deck height: 9.235–9.245 in / 9.240 nominal
- cylinder bank longitudinal offset: 0.9488 in, driver/left bank forward
- connecting rod length: 6.098 in center-to-center
- main journal diameter: 2.559 in nominal
- rod journal diameter: 2.0995 in nominal
- main housing bore: 2.751 in
- hydraulic roller lifter diameter: 0.842 in
- rocker ratio: 1.7:1
- compression ratio: 9.5:1
- firing order: 1-8-7-2-6-5-4-3
- cylinder numbering: driver/left 1-3-5-7; passenger/right 2-4-6-8, front-to-rear
- Gen III 24X crank reluctor

Do not replace a published dimension with an arbitrary aesthetic value. If a casting contour or tiny hardware dimension is not publicly documented, preserve mechanical location/proportion and state that it is procedural rather than claiming OEM scan accuracy.

## 4. Code architecture

- `src/tahoe53Specs.js` — dimensional and identity source of truth
- `src/engineModel.js` — complete procedural Tahoe engine model and kinematics
- `PARTS_MANIFEST_2006_TAHOE_53.md` — modeled assembly checklist
- `src/main.js` — Three.js studio bootstrap / cameras / lights / raycast
- `src/uiController.js` — inspector, exploded view and stock engine-speed telemetry
- `src/soundEngine.js` — naturally aspirated cross-plane V8 synthesis; no turbo audio
- `src/textures.js` — procedural material textures
- `src/threeDebugBridge.js` — runtime geometry / scene diagnostics

## 5. Kinematic rules

Coordinate system:
- Z = crankshaft longitudinal axis
- X = transverse axis
- Y = vertical axis
- crankshaft center = model origin
- left/driver bank cylinder axis = 135 degrees in XY
- right/passenger bank cylinder axis = 45 degrees in XY

Piston position is solved from the slider-crank equation using the published 1.811-in crank radius and 6.098-in rod length. Connecting rods are reoriented every frame between the physical crankpin and wrist-pin positions.

The four physical rod-journal phases are cross-plane phased. Cylinder firing is synchronized to `1-8-7-2-6-5-4-3` across a 720-degree four-stroke cycle.

Camshaft speed must remain exactly one-half crankshaft speed. Intake/exhaust valve motion must be routed through lifter -> pushrod -> rocker -> valve. Never animate the valves as if there are overhead camshafts.

## 6. Visual/modeling scope

The parts manifest deliberately includes the block, rotating assembly, timing drive, gerotor pump/pickup, heads, complete OHV valvetrain, composite intake, throttle, rails/injectors, coils/plugs/wires, stock exhaust manifolds, water pump, front accessories, belt, starter, oil filter, dipstick, key sensors, PCV/plumbing and harness representation.

A checked manifest item must exist as a mesh or mechanically meaningful grouped representation. Do not claim that microscopic supplier markings, every wire crimp, production sealant bead or proprietary GM casting surface is OEM CAD unless actual scan/CAD data has been supplied.

## 7. Validation

Run:
```bash
npm install
npm run build
npm run dev
npm run audit:3d
```

Use `window.__DEBUG_BRIDGE__` for scene inspection. Inspect complete-engine, front-drive, top, side, rear, x-ray and exploded states. Verify that:
- there are exactly 8 pistons
- there is exactly 1 camshaft
- there are exactly 16 valve objects
- there are 0 turbocharger objects
- pistons remain within their cylinder paths throughout 720 degrees
- crank, rods and piston pins remain connected visually
- exploded groups return to exact base transforms at 0%
- accessory drive remains in the correct front plane
- the truck oil pan clears the display stand

Avoid blanket 'zero collision' assertions: real engines intentionally contain nested/contacting parts. Collision tests must distinguish intended mechanical nesting/contact from accidental mesh clipping.
