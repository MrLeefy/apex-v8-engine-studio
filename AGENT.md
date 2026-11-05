# Apex-V8 Twin-Turbo 3D Engine Studio | Agent Engineering Guide

## 1. Project Architecture
- **Core 3D Engine**: Vanilla Three.js (`three@^0.160.0`) with Vite build toolchain.
- **Root Files**:
  - `src/main.js`: Three.js scene bootstrap, OrbitControls, studio lighting, turntable stand, raycasting event handlers.
  - `src/engineModel.js`: Parametric CAD model of the Twin-Turbo 5.0L 90° V8 engine with slider-crank kinematics, DOHC 32V valvetrain, symmetrical twin turbos, 4-into-1 headers, and tangential serpentine belt.
  - `src/textures.js`: In-memory procedural PBR textures (casting grain, 2x2 twill carbon fiber, brushed stainless steel, micro-V rubber belt, billet valve cover texturing).
  - `src/threeDebugBridge.js`: Runtime 3D scene inspection, measurement, collision detection, and performance diagnostic bridge.
  - `src/engineTiming.js`: Single source of truth for timing — cross-plane firing angles derived from the crank geometry (firing order 1-4-2-3-6-7-5-8, bank pattern L-R-L-L-R-L-R-R), slider-crank helpers, street/race cam events (EVO/EVC/IVO/IVC).
  - `src/enginePhysics.js`: Real-time engine + dyno model integrated in 1 ms sub-steps: crank inertia, friction/pumping/compression torque, electronic throttle, filling/emptying manifold (MAP), twin-turbo shaft lag + wastegate + BOV, starter/fuel-prime/ECU sync/start flare/stall, idle air + idle spark control, rev limiter, 2-step, nitrous, overrun pops map, water-brake absorber (hold + automated sweep), EGT/coolant/oil thermal model. Emits `pop`, `bov`, `starter`, `stall`, `sweep`, `state` events.
  - `src/audio/engineWorklet.js`: AudioWorklet synthesiser. Runs its own sample-accurate crank clock phase-locked to the physics and generates sound from per-cylinder events: exhaust blowdown at EVO per bank -> header waveguide -> turbine -> muffler waveguide, induction pulses, valve-seat ticks, cut/pop decisions from the ECU model, starter gear whine with compression-stroke speed modulation, twin turbo whistle (detuned pair), spool, BOV, wastegate, chain whine, fuel pump.
  - `src/soundEngine.js`: Web Audio graph (worklet -> dry + dyno-cell convolution reverb -> limiter), mic positions (tailpipe / engine bay / control room).
  - `src/uiController.js`: HUD: ignition, throttle (slider + keyboard), dyno pull/hold, 2-step, nitrous, cam, sim speed, live ECU telemetry, firing-order strip, dyno sheet chart, viewports, exploded view, X-Ray.

### Driving the engine (keyboard)
| Key | Action |
|---|---|
| `S` | Start (fuel prime -> crank -> catch) / stop |
| `Space` / `W` / `↑` (hold) | Wide-open throttle |
| `E` (hold) | 35 % throttle |
| `D` | Automated dyno pull 2,500 -> 8,300 RPM |
| `H` | Water brake holds the current RPM (load the engine, hear boost build) |
| `L` | Arm 2-step launch limiter (4,500 RPM) |
| `N` (hold) | Nitrous (>3,000 RPM, >85 % throttle) |

Run `npm run verify:engine` for headless realism checks (physics calibration + rendered-audio order analysis: firing order 4 dominant at every RPM, cross-plane half-order burble, turbo whistle, limiter stutter, BOV).

Performance: `EngineModel.optimizeScene()` rebuilds over-tessellated primitives and merges static meshes per rigid body/material -> ~236 draw calls, ~32.5k triangles.

Calibration (street cam, warm): idle ~820 RPM, full 2.5 bar boost by ~3,500 RPM with ~1.1 s turbo lag under load, idle -> 7,000 RPM free-rev in ~0.9 s, dyno pull ~1,100 HP / ~870 lb-ft.

---

## 2. 3D Inspection & Development Toolchain

### A. Live Browser Inspection & Automated Vision Audit
Run the automated headless vision audit at any time:
```bash
npm run audit:3d
```
This script:
1. Launches Puppeteer and navigates to the live application (`http://localhost:5173/`).
2. Interrogates `window.__DEBUG_BRIDGE__` for scene hierarchy, draw calls, triangle counts, and geometry bounds.
3. Performs mathematical collision detection across all meshes to ensure **0 clipping violations**.
4. Captures 3 high-resolution viewport screenshots in `artifacts/`:
   - `studio_view.png` (Isometric 3D Engine render)
   - `xray_view.png` (Ghost X-Ray cutaway render)
   - `dyno_view.png` (High-RPM Dyno revving with glowing headers)
5. Writes a comprehensive diagnostic JSON report to `artifacts/3d_scene_report.json`.

### B. Global Runtime Three.js Bridge Hooks
When the app is running in the browser, the following hooks are available on `window`:
- `window.__THREE__`: Three.js module.
- `window.__SCENE__`: Active Three.js scene.
- `window.__CAMERA__`: Active perspective camera.
- `window.__RENDERER__`: WebGLRenderer with tone mapping.
- `window.__ENGINE__`: EngineModel instance.
- `window.__PHYSICS__`: EnginePhysics instance (rpm, map, turboSpeed, egt, crankAngle, state...).
- `window.__DEBUG_BRIDGE__`: ThreeDebugBridge instance with helper methods:
  - `list_scene_objects()`
  - `inspect_object(name)`
  - `get_bounding_box(name)`
  - `check_mesh_collisions()`
  - `get_renderer_stats()`
  - `set_debug_helpers({ axes: true, boundingBoxes: true })`
  - `capture_scene_state()`

### C. Active MCP Servers Configured
In `~/.gemini/antigravity/mcp_config.json` and `~/.gemini/config/mcp_config.json`:
- `threejs-devtools`: `npx -y threejs-devtools-mcp`
- `chrome-devtools`: `npx -y chrome-devtools-mcp@latest`
- `playwright`: `npx -y @modelcontextprotocol/server-playwright`

---

## 3. Coordinate System & Kinematic Blueprint
- **Origin \((0, 0, 0)\)**: Crankshaft center rotational axis (\(Z\) is longitudinal, \(X\) is transverse, \(Y\) is vertical).
- **90° V-Angle**: Left bank is at \(+45^\circ\) (\(+\pi/4\)), Right bank is at \(-45^\circ\) (\(-\pi/4\)).
- **Slider-Crank Kinematics**:
  \[
  s(\theta) = r\cos\theta + \sqrt{l^2 - r^2\sin^2\theta}
  \]
  where stroke radius \(r = 0.35\) and connecting rod length \(l = 1.35\).
- **Deck Height**: Block deck face is at normal distance \(2.05\) from crankshaft center.
- **Cylinder Heads**: Thickness \(0.72\), mounted at normal distance \(2.08\) with copper MLS head gasket.
- **Billet Valve Covers**: Mounted at normal distance \(2.80\).

---

## 4. Performance & Validation Guardrails
- **FPS Target**: 60 FPS on standard desktop WebGL.
- **Draw Calls**: \(\le 300\).
- **Triangle Count**: \(\le 35,000\) for ultra-smooth interaction.
- **Clipping Violations**: Exactly **0** permitted.
