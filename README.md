# Apex-V8 Engine Studio

Interactive Three.js V8 engine visualization with component inspection, exploded and X-ray views, and a dyno-style interface with synthesized audio. Vite serves and builds the browser application.

## Local development

Install Node.js and npm compatible with the dependencies in [package.json](package.json), then:

```sh
npm ci
npm run dev
```

The development script uses port 5173 and binds to all interfaces. Use it only on a trusted development network. Open `http://localhost:5173/` in a WebGL-capable browser.

- `npm run build`: create the production build.
- `npm run preview`: preview built output locally.
- `npm run audit:3d`: inspect a separately running development server with Puppeteer.

The audit does not start Vite. Start `npm run dev` in another terminal first. It writes screenshots and a scene report under `artifacts/`; inspect those results rather than assuming the script establishes engineering accuracy or zero collisions. The audit launches Chromium with sandbox-disabling flags, so review the script and use an isolated development environment.

## Source map

- [src/main.js](src/main.js): scene, camera, controls and application loop.
- [src/engineModel.js](src/engineModel.js): engine geometry and moving parts.
- [src/uiController.js](src/uiController.js): interface and view controls.
- [src/soundEngine.js](src/soundEngine.js): synthesized audio.
- [src/textures.js](src/textures.js): procedural texture helpers.
- [src/threeDebugBridge.js](src/threeDebugBridge.js): runtime inspection helpers.
- [scripts/inspect-3d-scene.js](scripts/inspect-3d-scene.js): browser audit implementation.

[AGENT.md](AGENT.md) retains engineering context and performance targets; [ORIGINAL_REQUEST.md](ORIGINAL_REQUEST.md) preserves the original brief. Targets are not measured results. No standalone unit-test script is defined, and browser rendering, audio, performance and physical accuracy require separate verification.
