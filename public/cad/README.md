# CAD asset drop zone

This directory is for **CAD-derived GLB assets**, not hand-modeled lookalikes.

The runtime loader in `src/cad/CadAssetOverlay.js` refuses to silently treat a mesh as OEM geometry. Every GLB must include `scene.userData.cadProvenance` metadata matching the registry entry.

Required metadata shape:

```json
{
  "cadProvenance": {
    "gmPart": "12554030",
    "sourceTier": "OEM_CAD",
    "sourceReference": "traceable source / drawing / scan reference",
    "units": "mm",
    "geometryVerified": true,
    "assemblyTransformVerified": true,
    "assemblyTransform": {
      "position": [0, 0, 0],
      "rotationDeg": [0, 0, 0]
    }
  }
}
```

Allowed source tiers:

- `OEM_CAD` — actual manufacturer CAD geometry
- `OEM_SUPPLIER_CAD` — exact supplier CAD for the production component
- `PHYSICAL_SCAN` — high-resolution scan tied to measured datums
- `DIMENSIONALLY_RECONSTRUCTED` — recreated from published dimensions/drawings; useful but **not OEM surface geometry**
- `THIRD_PARTY_CAD` — community/commercial model whose exactness is not independently established
- `PROCEDURAL_FALLBACK` — current Three.js fallback geometry

Only OEM CAD, supplier CAD, or a verified physical scan can automatically suppress the procedural fallback, and only after the part's assembly transform has also been verified.

## Units / coordinate contract

The existing engine scene uses **1 Three.js unit = 4 real inches = 101.6 mm**. Do not manually eyeball a scale. The loader converts `mm`, `inch`, or `meter` source units deterministically.

Assembly transform must be measured from the project engine datum:

- origin = crankshaft centerline at the modeled longitudinal datum
- Z = crankshaft longitudinal axis
- X = vehicle transverse axis
- Y = vertical axis

## Do not do this

Do not rename a GrabCAD/CGTrader/3DContentCentral model to an OEM part number and mark it verified. Catalog fitment proves **identity**, not geometric fidelity.
