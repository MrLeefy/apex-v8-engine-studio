import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function run3DInspection() {
  console.log('🚀 Starting Three.js Automated 3D Scene Inspection & Vision Audit...');

  const artifactsDir = path.resolve('artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);

  const consoleLogs = [];
  const pageErrors = [];
  page.on('console', msg => {
    const line = `[Browser ${msg.type()}]: ${msg.text()}`;
    consoleLogs.push(line);
    if (msg.type() === 'error') console.error(line);
  });
  page.on('pageerror', err => {
    const line = err?.stack || err?.toString() || String(err);
    pageErrors.push(line);
    console.error(`[Browser PageError]: ${line}`);
  });

  try {
    console.log('📡 Navigating to live application at http://127.0.0.1:5173/...');
    const response = await page.goto('http://127.0.0.1:5173/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    if (!response || !response.ok()) {
      throw new Error(`Application navigation failed with HTTP ${response?.status?.() ?? 'unknown'}`);
    }

    await page.waitForSelector('#canvas-container canvas', { visible: true, timeout: 20000 });
    await page.waitForFunction(() => Boolean(window.__DEBUG_BRIDGE__ && window.__ENGINE__), { timeout: 20000 });
    await new Promise(r => setTimeout(r, 1800));

    console.log('🔍 Querying live ThreeDebugBridge API...');
    const sceneAudit = await page.evaluate(() => {
      const bridge = window.__DEBUG_BRIDGE__;
      const engine = window.__ENGINE__;
      if (!bridge || !engine) return { error: 'ThreeDebugBridge or EngineModel not attached' };

      // Keep the CI smoke/visual audit responsive. The debug bridge's legacy
      // check_mesh_collisions() is intentionally NOT called here because it does
      // an O(n²) all-scene pairwise sweep and can stall on this much denser engine.
      return {
        state: bridge.capture_scene_state(),
        objects: bridge.list_scene_objects(),
        stats: bridge.get_renderer_stats(),
        collisionAudit: {
          mode: 'deferred',
          reason: 'Run targeted subassembly collision checks separately; legacy global sweep is quadratic.'
        },
        engine: {
          name: engine.group?.name || null,
          inspectableParts: engine.inspectableParts?.length || 0,
          pistons: engine.pistons?.length || 0,
          valves: engine.valves?.length || 0,
          pushrods: engine.pushrods?.length || 0,
          rockerArms: engine.rockerArms?.length || 0,
          camshafts: engine.camshafts?.length || 0,
          turbos: engine.turbos?.length || 0,
          firingOrder: engine.specs?.firingOrder || null
        }
      };
    });

    if (sceneAudit.error) throw new Error(sceneAudit.error);
    if (!sceneAudit.objects?.length) throw new Error('Scene contains no rendered objects');
    if (pageErrors.length) throw new Error(`Browser produced ${pageErrors.length} uncaught page error(s)`);

    const expected = sceneAudit.engine;
    const registryFailures = [];
    if (expected.pistons !== 8) registryFailures.push(`expected 8 pistons, got ${expected.pistons}`);
    if (expected.valves !== 16) registryFailures.push(`expected 16 valves, got ${expected.valves}`);
    if (expected.pushrods !== 16) registryFailures.push(`expected 16 pushrods, got ${expected.pushrods}`);
    if (expected.rockerArms !== 16) registryFailures.push(`expected 16 rocker arms, got ${expected.rockerArms}`);
    if (expected.camshafts !== 1) registryFailures.push(`expected 1 camshaft, got ${expected.camshafts}`);
    if (expected.turbos !== 0) registryFailures.push(`expected 0 turbos, got ${expected.turbos}`);
    if (registryFailures.length) throw new Error(`Engine architecture registry failed: ${registryFailures.join('; ')}`);

    console.log(`📊 Scene Objects Count: ${sceneAudit.objects.length}`);
    console.log(`🎨 Draw Calls: ${sceneAudit.stats?.render?.calls ?? 0} | Triangles: ${sceneAudit.stats?.render?.triangles ?? 0}`);
    console.log(`🔩 Engine registry: ${expected.pistons} pistons • ${expected.valves} valves • ${expected.pushrods} pushrods • ${expected.rockerArms} rockers • ${expected.camshafts} camshaft • ${expected.turbos} turbos`);

    // Exercise exactly 720 crank degrees using deterministic update steps.
    await page.evaluate(() => {
      const engine = window.__ENGINE__;
      const rpm = 1200;
      const radPerSec = (rpm * Math.PI * 2) / 60;
      engine.setRPM(rpm);
      const steps = 240;
      const dt = (4 * Math.PI / steps) / radPerSec;
      for (let i = 0; i < steps; i++) engine.update(dt);
      engine.setRPM(650);
    });

    const motionState = await page.evaluate(() => ({
      crankAngle: window.__ENGINE__?.crankAngle ?? null,
      pistonCount: window.__ENGINE__?.pistons?.length ?? 0,
      rpm: window.__ENGINE__?.rpm ?? null
    }));
    if (!Number.isFinite(motionState.crankAngle)) throw new Error('Crank motion produced a non-finite angle');
    console.log(`⚙️ 720° motion exercise complete • crank angle ${motionState.crankAngle.toFixed(3)} rad • ${motionState.pistonCount} pistons active`);

    const studioShotPath = path.join(artifactsDir, 'studio_view.png');
    await page.screenshot({ path: studioShotPath, fullPage: true });
    console.log(`📸 Studio View captured -> ${studioShotPath}`);

    await page.evaluate(() => {
      const slider = document.getElementById('exploded-slider');
      if (slider) {
        slider.value = 50;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const xrayBtn = document.getElementById('btn-xray-toggle');
      if (xrayBtn && !xrayBtn.classList.contains('active')) xrayBtn.click();
    });
    await new Promise(r => setTimeout(r, 700));
    const xrayShotPath = path.join(artifactsDir, 'xray_view.png');
    await page.screenshot({ path: xrayShotPath, fullPage: true });
    console.log(`📸 Exploded X-Ray View captured -> ${xrayShotPath}`);

    await page.evaluate(() => {
      const slider = document.getElementById('exploded-slider');
      if (slider) {
        slider.value = 0;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const dynoTab = document.getElementById('tab-dyno');
      if (dynoTab) dynoTab.click();
    });
    await new Promise(r => setTimeout(r, 800));
    const dynoShotPath = path.join(artifactsDir, 'dyno_view.png');
    await page.screenshot({ path: dynoShotPath, fullPage: true });
    console.log(`📸 Running View captured -> ${dynoShotPath}`);

    const report = {
      ...sceneAudit,
      motionState,
      browser: { consoleLogs, pageErrors, url: page.url() }
    };
    const reportPath = path.join(artifactsDir, '3d_scene_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📝 Comprehensive 3D Audit Report saved -> ${reportPath}`);
    console.log('✅ Visual and Numerical Three.js Verification Complete!');
  } catch (err) {
    console.error('❌ Inspection error:', err?.stack || err);
    console.error('Browser console tail:\n' + consoleLogs.slice(-30).join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await run3DInspection();
