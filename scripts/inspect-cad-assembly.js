import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_INSTANCES = 92;
const EXPECTED_FAMILIES = 17;
const EXPECTED_COUNTS = {
  '19258707': 20,
  '12558840': 10,
  '12560961': 16,
  '11546600': 12,
  '12551926': 6,
  '12557840': 1,
  '11515758': 10,
  '11516480': 2,
  '11514008': 4,
  '11588949': 2,
  '89017691': 3,
  '11589264': 6
};

const outDir = path.resolve('artifacts');
fs.mkdirSync(outDir, { recursive: true });

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
page.setDefaultTimeout(90000);
page.setDefaultNavigationTimeout(30000);

const consoleLogs = [];
const pageErrors = [];
page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => pageErrors.push(err?.stack || String(err)));

const fail = message => { throw new Error(message); };
const near = (a, b, eps = 0.03) => Math.abs(a - b) <= eps;

try {
  console.log('📡 Opening Tahoe 5.3 CAD assembly...');
  const response = await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) fail(`Vite returned HTTP ${response?.status?.() ?? 'unknown'}`);

  await page.waitForSelector('#canvas-container canvas', { visible: true });
  await page.waitForFunction(() => Boolean(window.__ENGINE__ && window.__DEBUG_BRIDGE__));
  await page.waitForFunction(() => window.__FASTENER_CAD_REPORT__?.().ready === true, { timeout: 90000 });
  await new Promise(resolve => setTimeout(resolve, 800));

  const audit = await page.evaluate(() => {
    const e = window.__ENGINE__;
    const f = window.__FASTENER_CAD_REPORT__?.();
    const c = window.__CAD_REPORT__?.();
    const events = e.valveEvents || [];
    const sum = (key) => events.reduce((n, evt) => n + (evt[key]?.length || 0), 0);
    const parentMap = Object.fromEntries((f?.families || []).map(x => [x.id, x.parent]));
    const countMap = {};
    for (const x of f?.families || []) countMap[x.gmPart] = (countMap[x.gmPart] || 0) + x.count;

    return {
      engine: {
        name: e.group?.name,
        pistons: e.pistons?.length || 0,
        valves: e.valves?.length || 0,
        lifters: sum('lifters'),
        pushrods: sum('pushrods'),
        rockers: sum('rockers'),
        camshafts: e.camshafts?.length || 0,
        turbos: e.turbos?.length || 0,
        firingOrder: e.spec?.architecture?.firingOrder,
        frontDriveName: e.subassemblies?.frontDrive?.name,
        mainBelt: e.serpentineBelt?.userData?.belt,
        acBelt: e.acDriveBelt?.userData?.belt,
        pulleyCount: e.pulleys?.length || 0
      },
      fasteners: f,
      cadOverlay: c,
      parentMap,
      countMap,
      sceneObjects: window.__DEBUG_BRIDGE__.list_scene_objects().length,
      renderer: window.__DEBUG_BRIDGE__.get_renderer_stats()
    };
  });

  if (pageErrors.length) fail(`Browser produced ${pageErrors.length} page error(s): ${pageErrors.join(' | ')}`);

  const e = audit.engine;
  const failures = [];
  if (e.pistons !== 8) failures.push(`pistons ${e.pistons}/8`);
  if (e.valves !== 16) failures.push(`valves ${e.valves}/16`);
  if (e.lifters !== 16) failures.push(`lifters ${e.lifters}/16`);
  if (e.pushrods !== 16) failures.push(`pushrods ${e.pushrods}/16`);
  if (e.rockers !== 16) failures.push(`rockers ${e.rockers}/16`);
  if (e.camshafts !== 1) failures.push(`camshafts ${e.camshafts}/1`);
  if (e.turbos !== 0) failures.push(`turbos ${e.turbos}/0`);
  if (e.firingOrder?.join('-') !== '1-8-7-2-6-5-4-3') failures.push(`firing order ${e.firingOrder}`);
  if (e.frontDriveName !== 'GMT800_2006_Tahoe_Reference_Front_Drive') failures.push(`front drive ${e.frontDriveName}`);
  if (e.mainBelt?.ribs !== 6 || !String(e.mainBelt?.gmPart).includes('12637202')) failures.push('main 6-rib drive identity');
  if (e.acBelt?.ribs !== 4 || e.acBelt?.gmPart !== '12576447') failures.push('dedicated 4-rib A/C drive identity');

  const f = audit.fasteners;
  if (!f?.ready) failures.push('fastener layer not ready');
  if (f?.errors?.length) failures.push(`${f.errors.length} fastener load errors`);
  if (f?.instanceCount !== EXPECTED_INSTANCES) failures.push(`STEP instances ${f?.instanceCount}/${EXPECTED_INSTANCES}`);
  if (f?.familyCount !== EXPECTED_FAMILIES) failures.push(`instanced families ${f?.familyCount}/${EXPECTED_FAMILIES}`);
  if (f?.geometryTier !== 'DIMENSIONALLY_RECONSTRUCTED') failures.push(`geometry tier ${f?.geometryTier}`);
  if (f?.transformTier !== 'REFERENCE_POSITIONED') failures.push(`transform tier ${f?.transformTier}`);

  for (const [part, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = audit.countMap[part] || 0;
    if (actual !== expected) failures.push(`GM ${part}: ${actual}/${expected}`);
  }

  const expectedParents = {
    head_bolt_long_L: 'Driver_CathedralPort_AluminumHead',
    head_bolt_long_R: 'Passenger_CathedralPort_AluminumHead',
    head_bolt_short_L: 'Driver_CathedralPort_AluminumHead',
    head_bolt_short_R: 'Passenger_CathedralPort_AluminumHead',
    rocker_bolt_L: 'Driver_CathedralPort_AluminumHead',
    rocker_bolt_R: 'Passenger_CathedralPort_AluminumHead',
    exhaust_manifold_bolt_L: 'L_Stock_Cast_Exhaust_Manifold',
    exhaust_manifold_bolt_R: 'R_Stock_Cast_Exhaust_Manifold',
    exhaust_pipe_stud_L: 'L_Stock_Cast_Exhaust_Manifold',
    exhaust_pipe_stud_R: 'R_Stock_Cast_Exhaust_Manifold',
    water_pump_bolt: 'GMT800_2006_Tahoe_Reference_Front_Drive',
    crank_balancer_bolt: 'GMT800_2006_Tahoe_Reference_Front_Drive',
    water_pump_inlet_bolt: 'GMT800_2006_Tahoe_Reference_Front_Drive',
    valley_cover_bolt: 'GenIII_5.3_CastIron_Block',
    block_coolant_drain_plug: 'GenIII_5.3_CastIron_Block',
    throttle_body_stud: 'Composite_Truck_Intake_Manifold'
  };
  for (const [family, parent] of Object.entries(expectedParents)) {
    if (audit.parentMap[family] !== parent) failures.push(`${family} parent=${audit.parentMap[family]} expected=${parent}`);
  }

  if (failures.length) fail(`CAD assembly audit failed: ${failures.join('; ')}`);

  console.log(`✅ Architecture: 8 pistons • 16-valve OHV • 1 cam • 0 turbos • ${e.firingOrder.join('-')}`);
  console.log(`✅ GMT800 belts: main 6-rib ${e.mainBelt.gmPart} + A/C 4-rib ${e.acBelt.gmPart}`);
  console.log(`✅ CAD hardware: ${f.instanceCount} threaded instances across ${f.familyCount} hierarchy-attached InstancedMesh families`);
  console.log(`📐 OEM/supplier/scan overlay currently ${audit.cadOverlay?.loadedCount || 0}; unverified community meshes are not counted as OEM CAD.`);

  // Exercise a complete four-stroke cycle.
  await page.evaluate(() => {
    const e = window.__ENGINE__;
    e.setRPM(1200);
    const radPerSec = 1200 * Math.PI * 2 / 60;
    const steps = 240;
    const dt = (4 * Math.PI / steps) / radPerSec;
    for (let i = 0; i < steps; i++) e.update(dt);
    e.setRPM(650);
  });

  // Studio evidence.
  await page.screenshot({ path: path.join(outDir, 'studio_view.png') });

  // Verify front camera lands EXACTLY on the prescribed inspection view.
  await page.evaluate(() => {
    const select = document.getElementById('view-preset-select');
    select.value = 'front';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise(resolve => setTimeout(resolve, 900));
  const frontCamera = await page.evaluate(() => ({
    p: [window.__CAMERA__.position.x, window.__CAMERA__.position.y, window.__CAMERA__.position.z],
    t: [window.__CONTROLS__?.target?.x, window.__CONTROLS__?.target?.y, window.__CONTROLS__?.target?.z]
  }));
  if (!(near(frontCamera.p[0], 0) && near(frontCamera.p[1], 1.05) && near(frontCamera.p[2], -7.6))) {
    fail(`Front camera failed to land on exact preset: ${frontCamera.p.join(', ')}`);
  }
  await page.screenshot({ path: path.join(outDir, 'front_drive_view.png') });

  // Exploded hierarchy check: head-attached bolts must follow the head exactly.
  const before = await page.evaluate(() => {
    const e = window.__ENGINE__;
    const head = e.subassemblies.leftHead;
    const fastener = head.getObjectByName('CAD_Fasteners_head_bolt_long_L_19258707');
    const hp = new window.__THREE__.Vector3();
    const fp = new window.__THREE__.Vector3();
    head.getWorldPosition(hp);
    fastener.getWorldPosition(fp);
    return { head: hp.toArray(), fastener: fp.toArray() };
  });
  await page.evaluate(() => {
    const select = document.getElementById('view-preset-select');
    select.value = 'isometric';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const slider = document.getElementById('exploded-slider');
    slider.value = 50;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    const xray = document.getElementById('btn-xray-toggle');
    if (!xray.classList.contains('active')) xray.click();
  });
  await new Promise(resolve => setTimeout(resolve, 900));
  const after = await page.evaluate(() => {
    const e = window.__ENGINE__;
    const head = e.subassemblies.leftHead;
    const fastener = head.getObjectByName('CAD_Fasteners_head_bolt_long_L_19258707');
    const hp = new window.__THREE__.Vector3();
    const fp = new window.__THREE__.Vector3();
    head.getWorldPosition(hp);
    fastener.getWorldPosition(fp);
    return { head: hp.toArray(), fastener: fp.toArray() };
  });
  const headDelta = after.head.map((x, i) => x - before.head[i]);
  const fastenerDelta = after.fastener.map((x, i) => x - before.fastener[i]);
  if (!headDelta.every((x, i) => near(x, fastenerDelta[i], 0.005))) {
    fail(`Exploded hierarchy mismatch: head Δ=${headDelta}, fastener Δ=${fastenerDelta}`);
  }
  await page.screenshot({ path: path.join(outDir, 'xray_view.png') });

  // Running/front-drive evidence.
  await page.evaluate(() => {
    const slider = document.getElementById('exploded-slider');
    slider.value = 0;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('tab-dyno').click();
  });
  await new Promise(resolve => setTimeout(resolve, 900));
  await page.screenshot({ path: path.join(outDir, 'dyno_view.png') });

  const finalReport = {
    ...audit,
    cameraVerification: { frontCamera },
    explodedHierarchyVerification: { before, after, headDelta, fastenerDelta },
    browser: { pageErrors, consoleTail: consoleLogs.slice(-100) }
  };
  fs.writeFileSync(path.join(outDir, '3d_scene_report.json'), JSON.stringify(finalReport, null, 2));
  console.log('✅ Hierarchy-aware CAD browser audit complete.');
} catch (error) {
  console.error(error.stack || error);
  console.error(consoleLogs.slice(-40).join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
