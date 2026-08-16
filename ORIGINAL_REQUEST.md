# Original User Request

## 2026-08-16T21:13:38Z

Build a production-grade, CAD-accurate 3D procedural simulation of a Twin-Turbo V8 Engine and CoreXY 3D Printer with zero clipping, realistic mechanical components (valve covers, timing belt, intake runners, headers, turbos), and physical layer-by-layer extrusion.

Working directory: C:/Users/baseb/Documents/antigravity/wise-einstein
Integrity mode: development

## Requirements

### R1. CAD-Accurate 3D Engine Architecture
- Build a true 90-degree V8 twin-turbo engine with precise geometric trigonometry (zero component clipping or misaligned axes).
- Sculpted billet valve covers with ignition coils, copper MLS head gasket, distinct cylinder heads, and deep-sump oil pan.
- Mathematically routed serpentine accessory belt that wraps tangentially around 6 precision pulleys (crank damper, water pump, alternator, A/C compressor, tensioners) without intersecting shafts.
- Symmetrical 4-into-1 stainless steel tubular headers with merge collectors feeding directly into twin turbochargers.

### R2. Physical Kinematics & Slider-Crank Simulation
- Reciprocating 8-piston motion with exact slider-crank displacement s(theta) = r*cos(theta) + sqrt(l^2 - r^2*sin^2(theta)) and connecting rod angular swing.
- Synchronized DOHC camshafts rotating at 1/2 crank speed with 32 lifting poppet valves.
- Spooling turbo compressor wheels and rotating front accessory drive pulleys.

### R3. Calibrated CoreXY 3D Printer & Extrusion Layer Physics
- Toolhead nozzle tip calibrated flush with the active print plane.
- Real-time 3D volumetric extruded bead with a 3-stage thermodynamic cooling gradient (incandescent yellow -> warm orange -> cured filament).
- Full CoreXY A/B timing belt loops, triple Z-axis leadscrews, flexible PTFE Bowden tube, and 18-link drag chain inverse kinematics.

## Acceptance Criteria

### Geometric Integrity & Alignment
- [ ] No intersecting or clipping meshes between cylinder heads, block decks, pistons, or counterweights at any crank angle.
- [ ] Serpentine belt wraps along outer pulley circumferences with no straight-line shaft collisions.
- [ ] All 8 pistons stay completely inside their respective cylinder bores across the entire 360-degree rotation cycle.

### Physical Simulation & Web Application
- [ ] WebGL dev server builds and runs cleanly with 60+ FPS on Vite + Three.js.
- [ ] Live HUD features 2D Slicer layer preview, manual CNC jog pad, and Dyno rev mode.
