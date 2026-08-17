import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAD_ASSETS, CAD_SOURCE_TIERS, cadCoverageSummary } from './cadAssetRegistry.js';

/**
 * Loads CAD-derived GLB parts when they are explicitly listed in
 * /public/cad/cad-assets.json.
 *
 * IMPORTANT:
 * - Missing assets are NOT errors; the mechanically grounded fallback remains.
 * - Unverified transforms never replace procedural/reference geometry.
 * - OEM verification is deliberately strict and provenance-driven.
 * - The manifest prevents a browser run from generating dozens of meaningless
 *   404 requests for CAD files that have not actually been sourced yet.
 */
export class CadAssetOverlay {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.loader = new GLTFLoader();
    this.group = new THREE.Group();
    this.group.name = 'CAD_Derived_Engine_Assets';
    this.engine.group.add(this.group);

    this.loaded = new Map();
    this.failures = new Map();
    this.report = {
      startedAt: null,
      completedAt: null,
      registry: cadCoverageSummary(),
      availableManifestIds: [],
      loaded: [],
      missing: [],
      rejected: []
    };

    window.__CAD_OVERLAY__ = this;
  }

  async loadAvailable() {
    this.report.startedAt = new Date().toISOString();

    const availableIds = await this.readAvailableManifest();
    this.report.availableManifestIds = [...availableIds];

    const registryById = new Map(CAD_ASSETS.map(asset => [asset.id, asset]));
    for (const id of availableIds) {
      const asset = registryById.get(id);
      if (!asset) {
        this.report.rejected.push({ id, reason: 'asset id is not present in CAD registry' });
        continue;
      }
      await this.tryLoad(asset);
    }

    // Registry entries that have not yet been sourced are reported as pending,
    // without making network requests for imaginary files.
    for (const asset of CAD_ASSETS) {
      if (!availableIds.has(asset.id)) {
        this.report.missing.push({ id: asset.id, path: asset.meshPath, reason: 'not yet listed in cad-assets.json' });
      }
    }

    this.report.completedAt = new Date().toISOString();
    this.report.loadedCount = this.report.loaded.length;
    this.report.missingCount = this.report.missing.length;
    this.report.rejectedCount = this.report.rejected.length;

    const verifiedLoaded = this.report.loaded.filter(x => x.oemVerified).length;
    console.info(
      `[CAD] ${this.report.loadedCount}/${CAD_ASSETS.length} registered CAD assets loaded; ` +
      `${verifiedLoaded} are OEM/supplier/scan verified. Reference fallback remains for pending assets.`
    );
    return this.report;
  }

  async readAvailableManifest() {
    try {
      const response = await fetch('/cad/cad-assets.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (!Array.isArray(json.assets)) throw new Error('manifest.assets must be an array');
      return new Set(json.assets.map(String));
    } catch (error) {
      this.failures.set('cad-assets.json', error);
      this.report.rejected.push({ id: 'cad-assets.json', reason: `CAD availability manifest could not be read: ${error.message}` });
      return new Set();
    }
  }

  async tryLoad(asset) {
    if (!asset.meshPath) return;

    try {
      const gltf = await this.loader.loadAsync(asset.meshPath);
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) throw new Error('GLB contains no scene');

      const provenance = root.userData?.cadProvenance || gltf.userData?.cadProvenance || null;
      const verdict = this.validateProvenance(asset, provenance);
      if (!verdict.accepted) {
        this.report.rejected.push({ id: asset.id, path: asset.meshPath, reason: verdict.reason });
        return;
      }

      this.normalizeRoot(root, asset, provenance);
      this.group.add(root);
      this.loaded.set(asset.id, { asset, root, provenance, verdict });
      this.report.loaded.push({
        id: asset.id,
        path: asset.meshPath,
        gmPart: asset.gmPart,
        sourceTier: provenance.sourceTier,
        oemVerified: verdict.oemVerified
      });

      // Suppress a fallback only when geometry AND its engine assembly transform
      // are both positively verified from an allowed exact source tier.
      if (asset.replace && verdict.oemVerified && provenance.assemblyTransformVerified === true) {
        const fallback = this.engine.subassemblies?.[asset.replace];
        if (fallback) fallback.visible = false;
      }
    } catch (error) {
      this.failures.set(asset.id, error);
      this.report.missing.push({ id: asset.id, path: asset.meshPath, reason: error.message });
    }
  }

  validateProvenance(asset, provenance) {
    if (!provenance || typeof provenance !== 'object') {
      return { accepted: false, oemVerified: false, reason: 'missing embedded cadProvenance metadata' };
    }

    if (String(provenance.gmPart || '') !== String(asset.gmPart || '')) {
      return { accepted: false, oemVerified: false, reason: `GM part mismatch: expected ${asset.gmPart}, got ${provenance.gmPart}` };
    }

    const validTiers = new Set(Object.values(CAD_SOURCE_TIERS));
    if (!validTiers.has(provenance.sourceTier)) {
      return { accepted: false, oemVerified: false, reason: `invalid source tier: ${provenance.sourceTier}` };
    }

    if (!['mm', 'inch', 'meter'].includes(provenance.units)) {
      return { accepted: false, oemVerified: false, reason: `unsupported units: ${provenance.units}` };
    }

    const oemVerified = Boolean(
      provenance.geometryVerified === true &&
      provenance.assemblyTransformVerified === true &&
      [CAD_SOURCE_TIERS.OEM_CAD, CAD_SOURCE_TIERS.OEM_SUPPLIER_CAD, CAD_SOURCE_TIERS.PHYSICAL_SCAN].includes(provenance.sourceTier) &&
      provenance.sourceReference
    );

    return { accepted: true, oemVerified, reason: null };
  }

  normalizeRoot(root, asset, provenance) {
    root.name = `CAD_${asset.id}_${asset.gmPart}`;
    root.userData = {
      ...root.userData,
      assetId: asset.id,
      gmPart: asset.gmPart,
      cadProvenance: provenance
    };

    // Three.js engine coordinates use 1 scene unit = 4 inches = 101.6 mm.
    // Convert CAD-native units deterministically. Never eyeball a scale.
    const sceneUnitsPerSourceUnit = provenance.units === 'mm'
      ? 1 / 101.6
      : provenance.units === 'inch'
        ? 1 / 4
        : 1000 / 101.6;
    root.scale.multiplyScalar(sceneUnitsPerSourceUnit);

    const t = provenance.assemblyTransform;
    if (t) {
      if (Array.isArray(t.position) && t.position.length === 3) {
        root.position.set(...t.position.map(v => Number(v) || 0));
      }
      if (Array.isArray(t.rotationDeg) && t.rotationDeg.length === 3) {
        root.rotation.set(...t.rotationDeg.map(v => THREE.MathUtils.degToRad(Number(v) || 0)));
      }
    }

    root.traverse(obj => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.userData = {
        ...obj.userData,
        name: asset.label,
        category: 'CAD-derived component',
        specs: `GM/OE part ${asset.gmPart} • ${provenance.sourceTier}`,
        description: `External CAD-derived geometry. Source: ${provenance.sourceReference || 'unverified'}`
      };
      this.engine.inspectableParts.push(obj);
    });
  }

  getReport() {
    return structuredClone(this.report);
  }
}
