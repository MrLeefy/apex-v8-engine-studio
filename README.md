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

## AI work and handoffs

This repository owns the Three.js visualization. Follow [AGENT.md](AGENT.md): [src/engineModel.js](src/engineModel.js) owns geometry/kinematics, [src/uiController.js](src/uiController.js) owns controls, and [src/threeDebugBridge.js](src/threeDebugBridge.js) supplies inspection hooks used by [the audit](scripts/inspect-3d-scene.js). Coordinate changes to hook names and report fields between those files before parallel edits. No external companion-repository contract is established by the reviewed guide or package manifest.

Acceptance: `npm run build`; for scene changes, run `npm run audit:3d` against a separately running local server only in a reviewed isolated environment. Return screenshots and the scene report with the tested commit, browser and measured results. Performance/clipping targets in the guide are acceptance targets, not evidence of success.

For each handoff, record:
- Task ID, sender, intended recipient and next owner.
- Repository, branch, base SHA and current head SHA; owned paths and explicit out-of-scope work.
- Changed contract or dependency, with source links and both revisions for any cross-repository change; unresolved assumptions are blockers.
- Acceptance commands/checks and actual outcomes (`passed`, `failed`, `not run`), including environment and limitations.
- PR/commit and permitted artifact references, remaining blockers, and acknowledgment state (`pending`, `accepted`, `blocked`, `completed`).

The recipient should acknowledge scope and ownership before overlapping edits and report completion against the acceptance checks. A saved document is not a sent message or acknowledgment. Use only an authorized communication channel and preserve repository visibility; share the minimum source/contract context, never secrets or personal state.
