# 2006 Tahoe 5.3 — CAD Fidelity & Provenance Matrix

## Definition of “100% CAD accurate”

For this project, **100% CAD accurate does not mean visually similar**. A component only qualifies as OEM-CAD-accurate when:

1. its geometry comes from actual OEM CAD, exact production-supplier CAD, or a dimensionally registered physical scan;
2. units are known and preserved;
3. the GM/OE part identity is traceable;
4. its assembly transform is verified against engine datums / mounting interfaces;
5. no aesthetic scaling or eyeballed positioning is used;
6. the runtime provenance metadata passes `npm run audit:cad`.

A model reconstructed from photographs, community CAD, catalog illustrations, or published dimensions can be excellent engineering reference, but it is **not allowed to call itself OEM surface geometry**.

## Current state

The engine's architecture, motion, bore/stroke/spacing and many catalog identities are grounded in published references, but the visible engine remains largely procedural Three.js geometry. Therefore the project currently claims **0% OEM-derived surface mesh coverage**. This is deliberate and honest.

The repository now contains a CAD-first loading path in `src/cad/` so true CAD/scan assets can replace the procedural fallback one verified component at a time.

## OE catalog identities already locked into the CAD registry

| System | GM/OE part | Qty | Description / catalog evidence |
|---|---:|---:|---|
| Cylinder head | 12578925 | 2 | 2006 Tahoe 5.3 cylinder head assembly |
| Driver valve cover | 12570427 | 1 | rocker arm cover assembly |
| Passenger valve cover | 12582224 | 1 | rocker arm cover assembly for LM7/L59 listing |
| Pushrod | 10238852 | 16 | valve push rod |
| Hydraulic lifter | 17122490 | 16 | hydraulic roller, non-AFM |
| Lifter guide | 12595365 | 4 | accommodates four lifters each |
| Rocker arm | 12681275 | 16 | valve rocker arm |
| Rocker support | 12552203 | 2 | valve rocker arm pivot support |
| Intake valve | 12564494 | 8 | standard intake valve |
| Exhaust valve | 12694167 | 8 | exhaust valve |
| Driver exhaust manifold | 12616285 | 1 | stock exhaust manifold |
| Passenger exhaust manifold | 12616286 | 1 | stock exhaust manifold |
| Exhaust manifold bolt | 11546600 | 12 | M8 x 1.25 x 30.7 |
| Knock sensor | 12589867 | 2 | valley knock sensors |
| ECT sensor | 12608814 | 1 | engine coolant temperature sensor |
| Cam sensor | 19420911 | 1 | camshaft position sensor |
| Front cover | 12633906 | 1 | engine front cover |
| Water pump | 12703898 | 1 | water pump kit listed for LM7/L59 |
| Water pump inlet | 12600172 | 1 | inlet + seal + thermostat housing |
| Thermostat | 12600171 | 1 | engine coolant thermostat |
| Water pump bolt | 12551926 | 6 | M8 x 1.25 x 83 |
| Generator/P.S. bracket | 12554030 | 1 | generator & power steering pump bracket |
| Power steering pump | 19420684 | 1 | 1500-series pump listing |
| Main belt tensioner | 12609719 | 1 | accessory drive tensioner |
| Smooth idler | 12669569 | 1 | smooth belt idler |
| Grooved idler | 12580774 | 1 | 6-groove idler |
| A/C bracket | 12643257 | 1 | A/C compressor mounting bracket |
| A/C belt tensioner | 12580196 | 1 | separate A/C compressor belt tensioner |
| A/C compressor | 37183465 | 1 | compressor kit; superseded service part exists |
| Main accessory belt | 12637202 / 12637204 | 1 | 6-rib fan/water-pump/generator/P.S. belt; length depends on equipment code |
| A/C belt | 12576447 | 1 | separate 960 mm 4-rib A/C compressor belt for applicable option codes |
| Short head bolt | 12558840 | 10 | M8 x 1.25 x 45 |
| Long head bolt | 19258707 | 20 | M11 x 2 x 100 |
| Rocker bolt | 12560961 | 16 | M8 x 1.25 x 52.5 |
| Crank balancer bolt | 12557840 | 1 | M16 x 2 x 103 |

## Important accessory-drive correction

The current procedural model originally routed one serpentine loop through the A/C compressor. The 2006 Tahoe catalog shows the main **6-rib fan / water pump / generator / P/S pump belt** separately from the **4-rib A/C compressor belt**, and also lists a dedicated A/C belt tensioner. The CAD target must reproduce the two-drive arrangement rather than a generic single-loop V8 layout.

## Source references used for part identity / counts

- GMPartsGiant — 2006 Tahoe engine cylinder head & related parts catalog
- GMPartsGiant — 2006 Tahoe manifolds & fuel related parts catalog
- GMPartsGiant — 2006 Tahoe front cover & cooling related parts catalog
- GMPartsGiant — 2006 Tahoe pulleys & accessory drive catalog
- GMPartsGiant — 2006 Tahoe A/C compressor mounting / compressor assembly catalog
- GMPartsGiant — 2006 Tahoe alternator / power-steering mounting catalog
- PartSouq — 2006 Tahoe/Yukon/Escalade L59 exploded engine catalog groups

These catalogs establish **part identity, quantity, fitment and some published dimensions**. They do not by themselves provide manufacturing CAD surfaces.

## External CAD source policy

Community sources such as GrabCAD or generic 3D ContentCentral LS models may be used only as visual/reference aids unless their geometry can be independently registered and verified. They must stay `THIRD_PARTY_CAD` in metadata and may not automatically replace the project source-of-truth mesh.

## Acceptance target

A future “100% CAD” release should report:

- 100% of externally visible engine/accessory assemblies loaded from OEM/supplier CAD or registered scan data;
- critical internal geometry loaded or reconstructed from traceable manufacturing data;
- 100% verified assembly transforms;
- fastener identity/count audit passing;
- separate main and A/C belt systems verified;
- no `PROCEDURAL_FALLBACK` entries remaining for claimed CAD-complete scope.
