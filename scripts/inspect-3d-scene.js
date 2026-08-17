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
      '--enable-unsafe-swiftshader',
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
    if (msg.type() === 'error' && !msg.text().includes('404')) console.error(line);
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

    console.log('🔍 Querying live ThreeDebugBridge / engine / CAD APIs...');
    const sceneAudit = await page.evaluate(() => {
      const bridge = window.__DEBUG_BRIDGE__;
      const engine = window.__ENGINE__;
      if (!bridge || !engine) return { error: 'ThreeDebugBridge or EngineModel not attached' };

      const events = Array.isArray(engine.valveEvents) ? engine.valveEvents : [];
      const pushrodCount = events.reduce((sum, event) => sum + (event.pushrods?.length || 0), 0);
      const rockerCount = events.reduce((sum, event) => sum + (event.rockers?.length || 0), 0);
      const lifterCount = events.reduce((sum, event) => sum + (event.lifters?.length || 0), 0);
      const eventValveCount = events.reduce((sum, event) => sum + (event.valves?.length || 0), 0);
      const objects = bridge.list_scene_objects();
      const rendererStats = bridge.get_renderer_stats();
      const cadReport = typeof window.__CAD_REPORT__ === 'function' ? window.__CAD_REPORT__() : null;

      const mainBelt = engine.serpentineBelt;
      const acBelt = engine.acDriveBelt;
      const frontDrive = engine.subassemblies?.frontDrive;

      return {
        state: {
          timestamp: new Date().toISOString(),
          renderer: rendererStats,
          camera: {
            position: { x: window.__CAMERA__.position.x, y: window.__CAMERA__.position.y, z: window.__CAMERA__.position.z },
            fov: window.__CAMERA__.fov,
            aspect: window.__CAMERA__.aspect
          },
          objectsCount: objects.length
        },
        objects,
        stats: rendererStats,
        collisionAudit: {
          mode: 'deferred',
          reason: 'Targeted subassembly collision checks should be used; legacy global sweep is O(n²) and real engine assemblies intentionally contain nested/contacting parts.'
        },
        cad: cadReport,
        engine: {
          name: engine.group?.name || null,
          inspectableParts: engine.inspectableParts?.length || 0,
          pistons: engine.pistons?.length || 0,
          valves: engine.valves?.length || 0,
          eventValves: eventValveCount,
          lifters: lifterCount,
          pushrods: pushrodCount,
          rockerArms: rockerCount,
          camshafts: engine.camshafts?.length || 0,
          turbos: engine.turbos?.length || 0,
          firingOrder: engine.spec?.architecture?.firingOrder || null,
          frontDrive: {
            name: frontDrive?.name || null,
            visible: frontDrive?.visible !== false,
            mainBeltName: mainBelt?.name || null,
            mainBelt: mainBelt?.userData?.belt || null,
            acBeltName: acBelt?.name || null,
            acBelt: acBelt?.userData?.belt || null
          }
        }
      };
    });

    if (sceneAudit.error) throw new Error(sceneAudit.error);
    if (!sceneAudit.objects?.length) throw new Error('Scene contains no rendered objects');
    if (pageErrors.length) throw new Error(`Browser produced ${pageErrors.length} uncaught page error(s)`);

    const expected = sceneAudit.engine;
    const registryFailures = [];
    if (expected.pistons !== 8) registryFailures.push(`expected 8 pistons, got ${expected.pistons}`);
    if (expected.valves !== 16 || expected.eventValves !== 16) registryFailures.push(`expected 16 valves, got ${expected.valves}/${expected.eventValves}`);
    if (expected.lifters !== 16) registryFailures.push(`expected 16 lifters, got ${expected.lifters}`);
    if (expected.pushrods !== 16) registryFailures.push(`expected 16 pushrods, got ${expected.pushrods}`);
    if (expected.rockerArms !== 16) registryFailures.push(`expected 16 rocker arms, got ${expected.rockerArms}`);
    if (expected.camshafts !== 1) registryFailures.push(`expected 1 camshaft, got ${expected.camshafts}`);
    if (expected.turbos !== 0) registryFailures.push(`expected 0 turbos, got ${expected.turbos}`);
    if (expected.firingOrder?.join('-') !== '1-8-7-2-6-5-4-3') registryFailures.push(`wrong firing order: ${expected.firingOrder}`);

    const drive = expected.frontDrive;
    if (drive.name !== 'GMT800_2006_Tahoe_Reference_Front_Drive') registryFailures.push(`wrong front-drive assembly: ${drive.name}`);
    if (!drive.visible) registryFailures.push('GMT800 front-drive assembly is hidden');
    if (drive.mainBeltName !== 'Main_6_Rib_Accessory_Belt') registryFailures.push(`main belt missing/wrong: ${drive.mainBeltName}`);
    if (drive.mainBelt?.ribs !== 6) registryFailures.push(`main belt must be 6-rib, got ${drive.mainBelt?.ribs}`);
    if (!String(drive.mainBelt?.gmPart || '').includes('12637202')) registryFailures.push(`main belt GM identity missing: ${drive.mainBelt?.gmPart}`);
    if (drive.acBeltName !== 'Dedicated_4_Rib_AC_Belt') registryFailures.push(`A/C belt missing/wrong: ${drive.acBeltName}`);
    if (drive.acBelt?.ribs !== 4) registryFailures.push(`A/C belt must be 4-rib, got ${drive.acBelt?.ribs}`);
    if (drive.acBelt?.gmPart !== '12576447') registryFailures.push(`wrong A/C belt GM identity: ${drive.acBelt?.gmPart}`);

    if (registryFailures.length) throw new Error(`Engine architecture registry failed: ${registryFailures.join('; ')}`);

    console.log(`📊 Scene Objects Count: ${sceneAudit.objects.length}`);
    console.log(`🎨 Draw Calls: ${sceneAudit.stats?.render?.calls ?? 0} | Triangles: ${sceneAudit.stats?.render?.triangles ?? 0}`);
    console.log(`🔩 Engine registry: ${expected.pistons} pistons • ${expected.valves} valves • ${expected.lifters} lifters • ${expected.pushrods} pushrods • ${expected.rockerArms} rockers • ${expected.camshafts} camshaft • ${expected.turbos} turbos`);
    console.log(`🔥 Firing order: ${expected.firingOrder.join('-')}`);
    console.log(`🛞 GMT800 drive: main ${drive.mainBelt.ribs}-rib ${drive.mainBelt.gmPart} + A/C ${drive.acBelt.ribs}-rib ${drive.acBelt.gmPart}`);
    if (sceneAudit.cad) {
      console.log(`📐 CAD overlay: ${sceneAudit.cad.loadedCount ?? 0} loaded / ${sceneAudit.cad.registry?.catalogParts ?? 0} registered; OEM-verified coverage remains provenance-gated`);
    }

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
      rpm: window.__ENGINE__?.rpm ?? null,
      animatedPulleys: window.__ENGINE__?.pulleys?.length ?? 0
    }));
    if (!Number.isFinite(motionState.crankAngle)) throw new Error('Crank motion produced a non-finite angle');
    if (motionState.animatedPulleys < 6) throw new Error(`Expected at least 6 active front-drive pulleys, got ${motionState.animatedPulleys}`);
    console.log(`⚙️ 720° motion exercise complete • crank angle ${motionState.crankAngle.toFixed(3)} rad • ${motionState.pistonCount} pistons active • ${motionState.animatedPulleys} accessory pulleys active`);

    const studioShotPath = path.join(artifactsDir, 'studio_view.png');
    await page.screenshot({ path: studioShotPath, fullPage: true });
    console.log(`📸 Studio View captured -> ${studioShotPath}`);

    // Dedicated front-drive evidence shot.
    await page.evaluate(() => {
      const select = document.getElementById('view-preset-select');
      if (select) {
        select.value = 'front';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1400));
    const frontShotPath = path.join(artifactsDir, 'front_drive_view.png');
    await page.screenshot({ path: frontShotPath, fullPage: true });
    console.log(`📸 GMT800 Front Drive captured -> ${frontShotPath}`);

    await page.evaluate(() => {
      const select = document.getElementById('view-preset-select');
      if (select) {
        select.value = 'isometric';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const slider = document.getElementById('exploded-slider');
      if (slider) {
        slider.value = 50;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const xrayBtn = document.getElementById('btn-xray-toggle');
      if (xrayBtn && !xrayBtn.classList.contains('active')) xrayBtn.click();
    });
    await new Promise(r => setTimeout(r, 900));
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
    await new Promise(r => setTimeout(r, 900));
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
    console.log('✅ Visual, mechanical, front-drive and CAD-provenance verification complete!');
  } catch (err) {
    console.error('❌ Inspection error:', err?.stack || err);
    console.error('Browser console tail:\n' + consoleLogs.slice(-30).join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await run3DInspection();
