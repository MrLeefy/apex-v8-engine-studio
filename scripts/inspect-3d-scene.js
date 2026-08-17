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
      if (!bridge) return { error: 'ThreeDebugBridge not attached' };
      return {
        state: bridge.capture_scene_state(),
        objects: bridge.list_scene_objects(),
        stats: bridge.get_renderer_stats(),
        collisions: bridge.check_mesh_collisions(),
        engine: {
          name: window.__ENGINE__?.group?.name || null,
          inspectableParts: window.__ENGINE__?.inspectableParts?.length || 0,
          pistons: window.__ENGINE__?.pistons?.length || 0,
          valves: window.__ENGINE__?.valves?.length || 0,
          pushrods: window.__ENGINE__?.pushrods?.length || 0,
          rockerArms: window.__ENGINE__?.rockerArms?.length || 0,
          camshafts: window.__ENGINE__?.camshafts?.length || 0,
          turbos: window.__ENGINE__?.turbos?.length || 0
        }
      };
    });

    if (sceneAudit.error) throw new Error(sceneAudit.error);
    if (!sceneAudit.objects?.length) throw new Error('Scene contains no inspectable/rendered objects');
    if (pageErrors.length) throw new Error(`Browser produced ${pageErrors.length} uncaught page error(s)`);

    console.log(`📊 Scene Objects Count: ${sceneAudit.objects.length}`);
    console.log(`🎨 Draw Calls: ${sceneAudit.stats?.render?.calls ?? 0} | Triangles: ${sceneAudit.stats?.render?.triangles ?? 0}`);
    console.log(`⚠️ Geometry Collision Candidates: ${sceneAudit.collisions?.collisionCount ?? 0}`);
    console.log(`🔩 Engine registry: ${sceneAudit.engine.pistons} pistons • ${sceneAudit.engine.valves} valves • ${sceneAudit.engine.pushrods} pushrods • ${sceneAudit.engine.rockerArms} rockers • ${sceneAudit.engine.camshafts} camshaft(s) • ${sceneAudit.engine.turbos} turbos`);

    // Exercise the engine through a full four-stroke 720° cycle before screenshots.
    await page.evaluate(() => {
      const engine = window.__ENGINE__;
      if (!engine) return;
      engine.setRPM(1200);
      for (let i = 0; i < 240; i++) engine.update((4 * Math.PI / 240) / ((1200 * 2 * Math.PI) / 60));
      engine.setRPM(650);
    });

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
      browser: {
        consoleLogs,
        pageErrors,
        url: page.url()
      }
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
