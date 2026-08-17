import fs from 'node:fs';
import path from 'path';
import { CAD_ASSETS, CAD_SOURCE_TIERS, cadCoverageSummary } from '../src/cad/cadAssetRegistry.js';

const errors = [];
const seenIds = new Set();
const seenPaths = new Set();
const cadDir = path.resolve('public/cad');
const exactSourceTiers = new Set([
  CAD_SOURCE_TIERS.OEM_CAD,
  CAD_SOURCE_TIERS.OEM_SUPPLIER_CAD,
  CAD_SOURCE_TIERS.PHYSICAL_SCAN
]);

function glbSceneProvenance(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('not a GLB 2.0 file');
  }
  const version = buffer.readUInt32LE(4);
  if (version !== 2) throw new Error(`unsupported GLB version ${version}`);
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4E4F534A) throw new Error('first GLB chunk is not JSON');
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).replace(/[\u0000\s]+$/g, ''));
  const sceneIndex = Number.isInteger(json.scene) ? json.scene : 0;
  return json.scenes?.[sceneIndex]?.extras?.cadProvenance || null;
}

for (const asset of CAD_ASSETS) {
  if (!asset.id) errors.push('asset missing id');
  if (seenIds.has(asset.id)) errors.push(`duplicate asset id: ${asset.id}`);
  seenIds.add(asset.id);

  if (!asset.gmPart) errors.push(`${asset.id}: missing GM/OE part identity`);
  if (!Number.isInteger(asset.quantity) || asset.quantity < 1) errors.push(`${asset.id}: invalid quantity`);
  if (!Object.values(CAD_SOURCE_TIERS).includes(asset.sourceTier)) errors.push(`${asset.id}: invalid source tier ${asset.sourceTier}`);

  if (asset.meshPath) {
    if (seenPaths.has(asset.meshPath)) errors.push(`duplicate mesh path: ${asset.meshPath}`);
    seenPaths.add(asset.meshPath);
  }

  if (asset.oemVerified && !exactSourceTiers.has(asset.sourceTier)) {
    errors.push(`${asset.id}: oemVerified cannot be true for source tier ${asset.sourceTier}`);
  }
}

const present = [];
const missing = [];
const generatedCad = [];

for (const asset of CAD_ASSETS) {
  if (!asset.meshPath) continue;
  const relativeGlb = asset.meshPath.replace(/^\/cad\//, '');
  const glbPath = path.join(cadDir, relativeGlb);
  const exists = fs.existsSync(glbPath);
  (exists ? present : missing).push(asset.id);

  if (asset.sourceTier === CAD_SOURCE_TIERS.DIMENSIONALLY_RECONSTRUCTED) {
    const stepPath = glbPath.replace(/\.glb$/i, '.step');
    if (!exists) {
      errors.push(`${asset.id}: generated dimensioned GLB is missing (${relativeGlb})`);
      continue;
    }
    if (!fs.existsSync(stepPath)) {
      errors.push(`${asset.id}: generated STEP B-rep is missing (${path.basename(stepPath)})`);
      continue;
    }
    if (fs.statSync(stepPath).size < 1000) errors.push(`${asset.id}: STEP B-rep is suspiciously small`);
    if (fs.statSync(glbPath).size < 1000) errors.push(`${asset.id}: GLB tessellation is suspiciously small`);

    try {
      const p = glbSceneProvenance(glbPath);
      if (!p) throw new Error('missing scene.extras.cadProvenance');
      if (String(p.gmPart) !== String(asset.gmPart)) throw new Error(`GM part mismatch ${p.gmPart} != ${asset.gmPart}`);
      if (p.sourceTier !== CAD_SOURCE_TIERS.DIMENSIONALLY_RECONSTRUCTED) throw new Error(`wrong source tier ${p.sourceTier}`);
      if (p.units !== 'mm') throw new Error(`expected mm source units, got ${p.units}`);
      if (!p.nominal?.diameterMm || !p.nominal?.pitchMm) throw new Error('missing nominal diameter/pitch metadata');

      const isBolt = Number.isFinite(p.nominal?.underHeadLengthMm);
      const isStud = Number.isFinite(p.nominal?.totalLengthMm) && Number.isFinite(p.nominal?.threadLengthAMm) && Number.isFinite(p.nominal?.threadLengthBMm);
      if (!isBolt && !isStud) throw new Error('missing bolt under-head length or double-ended stud length metadata');
      if (isStud && p.nominal.threadLengthAMm + p.nominal.threadLengthBMm > p.nominal.totalLengthMm) throw new Error('stud thread spans exceed overall length');

      if (p.geometryVerified === true) throw new Error('dimensionally reconstructed part must not claim OEM geometryVerified=true');
      if (p.assemblyTransformVerified === true) throw new Error('generated loose fastener must not claim verified assembly transform');
      generatedCad.push({
        id: asset.id,
        gmPart: asset.gmPart,
        form: isStud ? 'double-ended stud' : 'bolt/plug',
        stepBytes: fs.statSync(stepPath).size,
        glbBytes: fs.statSync(glbPath).size,
        nominal: p.nominal
      });
    } catch (error) {
      errors.push(`${asset.id}: invalid generated GLB provenance: ${error.message}`);
    }
  }
}

const manifestPath = path.join(cadDir, 'cad-assets.json');
if (!fs.existsSync(manifestPath)) {
  errors.push('public/cad/cad-assets.json is missing');
} else {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) errors.push('cad-assets.json has an invalid schema');
    for (const id of manifest.assets || []) {
      if (!seenIds.has(String(id))) errors.push(`cad-assets.json references unknown asset id ${id}`);
    }
  } catch (error) {
    errors.push(`cad-assets.json cannot be parsed: ${error.message}`);
  }
}

const summary = cadCoverageSummary();
console.log(JSON.stringify({
  registryEntries: CAD_ASSETS.length,
  ...summary,
  cadFilesPresent: present.length,
  cadFilesMissing: missing.length,
  dimensionallyReconstructedBrepFamilies: generatedCad.length,
  generatedCad,
  present,
  missing
}, null, 2));

if (errors.length) {
  console.error('\nCAD provenance audit failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log(`\nCAD provenance audit passed: ${generatedCad.length} published-dimension fastener/stud families have STEP B-reps + validated GLBs.`);
