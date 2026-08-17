import fs from 'node:fs';
import path from 'node:path';
import { CAD_ASSETS, CAD_SOURCE_TIERS, cadCoverageSummary } from '../src/cad/cadAssetRegistry.js';

const errors = [];
const seenIds = new Set();
const seenPaths = new Set();

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

  if (asset.oemVerified && ![CAD_SOURCE_TIERS.OEM_CAD, CAD_SOURCE_TIERS.OEM_SUPPLIER_CAD, CAD_SOURCE_TIERS.PHYSICAL_SCAN].includes(asset.sourceTier)) {
    errors.push(`${asset.id}: oemVerified cannot be true for source tier ${asset.sourceTier}`);
  }
}

const cadDir = path.resolve('public/cad');
const present = [];
const missing = [];
for (const asset of CAD_ASSETS) {
  if (!asset.meshPath) continue;
  const local = path.join(cadDir, asset.meshPath.replace(/^\/cad\//, ''));
  (fs.existsSync(local) ? present : missing).push(asset.id);
}

const summary = cadCoverageSummary();
console.log(JSON.stringify({
  registryEntries: CAD_ASSETS.length,
  ...summary,
  cadFilesPresent: present.length,
  cadFilesMissing: missing.length,
  present,
  missing
}, null, 2));

if (errors.length) {
  console.error('\nCAD provenance audit failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log('\nCAD provenance registry is structurally valid.');
