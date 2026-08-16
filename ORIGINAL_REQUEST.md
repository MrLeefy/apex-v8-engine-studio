# Project Request History

## CURRENT TARGET — 2026-08-16

Rebuild the engine studio as an accurate procedural representation of the **5.3L Vortec 5300 used in a 2006 Chevrolet Tahoe GMT800**, specifically the owner's Tahoe Z71 target. Do not cut corners by reusing the former generic/racing V8 architecture.

The 2006 Tahoe service application data includes both:
- **L59 / VIN Z** — FlexFuel 5.3L; default identity for this project until the owner's VIN is supplied.
- **LM7 / VIN T** — gasoline 5.3L.

Both use the Gen III 5.3L iron-block OHV physical architecture represented by the model. See `src/tahoe53Specs.js`, `AGENT.md`, and `PARTS_MANIFEST_2006_TAHOE_53.md`.

Required direction:
- factory-correct 90° Gen III pushrod V8 architecture
- 96 mm bore / 92 mm stroke / 5,328 cc
- one in-block camshaft
- 16 valves, hydraulic roller lifters, pushrods and rockers
- stock composite truck intake / 78 mm electronic throttle
- sequential port injection
- coil-near-plug ignition
- stock cast exhaust manifolds
- truck water pump / accessory drive / A/C / power steering / alternator
- crank-driven gerotor oil pump and pickup
- starter, flexplate, oil filter, pan, sensors, PCV, harness and plumbing
- no turbochargers, no DOHC, no 32-valve race heads, no race-engine telemetry
- use published dimensions as actual modeling inputs instead of labels
- maintain a part-by-part manifest so missing assemblies are explicit

## SUPERSEDED REQUEST — 2026-08-16T21:13:38Z

The repository was originally generated from a request for a production-grade **Twin-Turbo 5.0L DOHC V8** with 32 valves, symmetrical turbochargers, race headers, 1,150 HP telemetry and other racing-engine features. That target is now obsolete for the engine portion of this project.

The previous request also included a CoreXY 3D printer simulation. Printer files may remain in the repository, but **they must not influence or contaminate the Chevrolet engine architecture**.
