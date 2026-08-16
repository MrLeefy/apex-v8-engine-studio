# Apex-V8 Twin-Turbo 3D Engine Studio | Agent Engineering Guide

## 1. Project Architecture
- **Core 3D Engine**: Vanilla Three.js (`three@^0.160.0`) with Vite build toolchain.
- **Root Files**:
  - `src/main.js`: Three.js scene bootstrap, OrbitControls, studio lighting, turntable stand, raycasting event handlers.
  - `src/engineModel.js`: Parametric CAD model of the Twin-Turbo 5.0L 90° V8 engine with slider-crank kinematics, DOHC 32V valvetrain, symmetrical twin turbos, 4-into-1 headers, and tangential serpentine belt.
  - `src/textures.js`: In-memory procedural PBR textures (casting grain, 2x2 twill carbon fiber, brushed stainless steel, micro-V rubber belt, billet valve cover texturing).
  - `src/threeDebugBridge.js`: Runtime 3D scene inspection, measurement, collision detection, and performance diagnostic bridge.
  - `src/soundEngine.js`: Web Audio acoustic engine synthesizing V8 exhaust pulses, turbo spool whine, and BOV flutter.
  - `src/uiController.js`: Interactive HUD controller managing viewports, exploded view slider, ghost X-Ray mode, and dyno bench.

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
