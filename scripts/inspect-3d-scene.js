import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function run3DInspection() {
  console.log('🚀 Starting Three.js Automated 3D Scene Inspection & Vision Audit...');

  const artifactsDir = path.resolve('artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[Browser ${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[Browser PageError]: ${err.toString()}`));

  try {
    console.log('📡 Navigating to live application at http://localhost:5173/...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });

    // Wait for canvas to render
    await page.waitForSelector('#canvas-container canvas', { timeout: 8000 });
    await new Promise(r => setTimeout(r, 1500));

    console.log('🔍 Querying live ThreeDebugBridge API...');
    const sceneAudit = await page.evaluate(() => {
      if (!window.__DEBUG_BRIDGE__) return { error: 'ThreeDebugBridge not attached' };
      return {
        state: window.__DEBUG_BRIDGE__.capture_scene_state(),
        objects: window.__DEBUG_BRIDGE__.list_scene_objects(),
        stats: window.__DEBUG_BRIDGE__.get_renderer_stats(),
        collisions: window.__DEBUG_BRIDGE__.check_mesh_collisions()
      };
    });

    console.log(`📊 Scene Objects Count: ${sceneAudit.objects ? sceneAudit.objects.length : 0}`);
    console.log(`🎨 Draw Calls: ${sceneAudit.stats ? sceneAudit.stats.render.calls : 0} | Triangles: ${sceneAudit.stats ? sceneAudit.stats.render.triangles : 0}`);
    console.log(`⚠️ Geometry Collisions: ${sceneAudit.collisions ? sceneAudit.collisions.collisionCount : 0}`);

    // Capture 1: Studio Isometric View
    const studioShotPath = path.join(artifactsDir, 'studio_view.png');
    await page.screenshot({ path: studioShotPath });
    console.log(`📸 Studio View captured -> ${studioShotPath}`);

    // Capture 2: Exploded X-Ray View
    await page.evaluate(() => {
      const xrayBtn = document.getElementById('btn-xray-toggle');
      if (xrayBtn) xrayBtn.click();
      const slider = document.getElementById('exploded-slider');
      if (slider) {
        slider.value = 50;
        slider.dispatchEvent(new Event('input'));
      }
    });
    await new Promise(r => setTimeout(r, 600));
    const xrayShotPath = path.join(artifactsDir, 'xray_view.png');
    await page.screenshot({ path: xrayShotPath });
    console.log(`📸 Exploded X-Ray View captured -> ${xrayShotPath}`);

    // Capture 3: Dyno Rev Mode View
    await page.evaluate(() => {
      const dynoTab = document.getElementById('tab-dyno');
      if (dynoTab) dynoTab.click();
    });
    await new Promise(r => setTimeout(r, 800));
    const dynoShotPath = path.join(artifactsDir, 'dyno_view.png');
    await page.screenshot({ path: dynoShotPath });
    console.log(`📸 Dyno Rev View captured -> ${dynoShotPath}`);

    // Save JSON report
    const reportPath = path.join(artifactsDir, '3d_scene_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(sceneAudit, null, 2));
    console.log(`📝 Comprehensive 3D Audit Report saved -> ${reportPath}`);

    console.log('✅ Visual and Numerical Three.js Verification Complete!');
  } catch (err) {
    console.error('❌ Inspection error:', err);
  } finally {
    await browser.close();
  }
}

run3DInspection();
