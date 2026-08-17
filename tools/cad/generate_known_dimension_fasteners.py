#!/usr/bin/env python3
"""
Generate real CAD B-rep fastener solids for GM catalog fasteners whose nominal
metric diameter, thread pitch, and under-head length are published.

This uses CadQuery/OpenCascade and exports:
  - STEP AP214-ish neutral CAD solids
  - GLB tessellations with embedded cadProvenance scene extras

Accuracy policy:
  * diameter / pitch / under-head length come from the GM catalog identities
    encoded below and are treated as dimensional source-of-truth inputs;
  * helical thread pitch and nominal major diameter are modeled geometrically;
  * exact GM flange/head/washer tooling dimensions are NOT published in the
    catalog used here, so head envelopes are standardized reconstruction values;
  * therefore generated parts are DIMENSIONALLY_RECONSTRUCTED, never OEM_CAD.

Run from repository root:
    python tools/cad/generate_known_dimension_fasteners.py
"""

from __future__ import annotations

import json
import math
import struct
from dataclasses import dataclass
from pathlib import Path

import cadquery as cq
from cadquery import exporters
import trimesh

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "cad"
OUT.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class FastenerSpec:
    asset_id: str
    gm_part: str
    filename_stem: str
    diameter_mm: float
    pitch_mm: float
    length_mm: float
    across_flats_mm: float
    head_height_mm: float
    flange_diameter_mm: float
    flange_thickness_mm: float
    description: str


SPECS = [
    FastenerSpec("head_bolt_short", "12558840", "12558840-head-bolt-short", 8.0, 1.25, 45.0, 13.0, 5.3, 17.0, 1.4, "Cylinder-head short bolt M8x1.25x45"),
    FastenerSpec("head_bolt_long", "19258707", "19258707-head-bolt-long", 11.0, 2.0, 100.0, 17.0, 7.0, 22.0, 1.8, "Cylinder-head long bolt M11x2x100"),
    FastenerSpec("exhaust_manifold_bolt", "11546600", "11546600-exhaust-bolt", 8.0, 1.25, 30.7, 13.0, 5.3, 17.0, 1.4, "Exhaust-manifold bolt M8x1.25x30.7"),
    FastenerSpec("rocker_bolt", "12560961", "12560961-rocker-bolt", 8.0, 1.25, 52.5, 13.0, 5.3, 17.0, 1.4, "Rocker pivot-support bolt M8x1.25x52.5"),
    FastenerSpec("water_pump_bolt", "12551926", "12551926-water-pump-bolt", 8.0, 1.25, 83.0, 13.0, 5.3, 17.0, 1.4, "Water-pump bolt M8x1.25x83"),
    FastenerSpec("crank_balancer_bolt", "12557840", "12557840-balancer-bolt", 16.0, 2.0, 103.0, 24.0, 10.0, 30.0, 2.2, "Crankshaft balancer bolt M16x2x103"),
]


def make_threaded_flange_bolt(s: FastenerSpec) -> cq.Workplane:
    """Build a B-rep bolt with a real helical thread ridge."""
    # Metric coarse-ish external thread depth reconstruction. Pitch and major
    # diameter are exact inputs; root form is intentionally conservative because
    # production GM thread-root radii/tooling are not available from the catalog.
    thread_depth = 0.54 * s.pitch_mm
    minor_d = max(0.1, s.diameter_mm - 2.0 * thread_depth)

    # Keep a short unthreaded runout beneath the flange and a tiny lead-in at tip.
    runout = min(max(1.2 * s.pitch_mm, 1.5), s.length_mm * 0.10)
    thread_length = max(s.pitch_mm * 2.0, s.length_mm - runout)

    shank = cq.Workplane("XY").circle(minor_d / 2.0).extrude(s.length_mm)

    # Add the external thread as a triangular helical ridge. Using a true helical
    # sweep makes the STEP solid materially different from a visual texture.
    helix_radius = minor_d / 2.0 + thread_depth * 0.45
    helix = cq.Wire.makeHelix(s.pitch_mm, thread_length, helix_radius)
    profile = (
        cq.Workplane("XZ")
        .center(helix_radius, 0)
        .moveTo(-thread_depth * 0.42, -s.pitch_mm * 0.22)
        .lineTo(thread_depth * 0.58, 0)
        .lineTo(-thread_depth * 0.42, s.pitch_mm * 0.22)
        .close()
    )
    thread = profile.sweep(helix, isFrenet=True)
    body = shank.union(thread)

    # Tip lead-in chamfer where possible.
    try:
        body = body.faces("<Z").chamfer(min(0.35 * s.pitch_mm, 0.8))
    except Exception:
        pass

    # Flange and hex head. These dimensions are standardized reconstruction
    # envelopes, explicitly not claimed to be GM tooling dimensions.
    flange = (
        cq.Workplane("XY")
        .circle(s.flange_diameter_mm / 2.0)
        .extrude(s.flange_thickness_mm)
        .translate((0, 0, s.length_mm))
    )
    circ_d_for_hex = s.across_flats_mm / math.cos(math.radians(30))
    head = (
        cq.Workplane("XY")
        .polygon(6, circ_d_for_hex)
        .extrude(s.head_height_mm)
        .translate((0, 0, s.length_mm + s.flange_thickness_mm))
    )

    solid = body.union(flange).union(head)
    try:
        solid = solid.edges("|Z").fillet(min(0.35, s.diameter_mm * 0.025))
    except Exception:
        pass
    return solid


def patch_glb_scene_extras(glb: bytes, extras: dict) -> bytes:
    """Inject scene.extras into a GLB without requiring pygltflib."""
    magic, version, total_len = struct.unpack_from("<4sII", glb, 0)
    if magic != b"glTF" or version != 2:
        raise ValueError("Unexpected GLB header")

    offset = 12
    json_len, json_type = struct.unpack_from("<II", glb, offset)
    offset += 8
    if json_type != 0x4E4F534A:  # JSON
        raise ValueError("First GLB chunk is not JSON")
    json_bytes = glb[offset:offset + json_len]
    offset += json_len
    doc = json.loads(json_bytes.rstrip(b" \t\r\n\x00").decode("utf-8"))

    scene_index = doc.get("scene", 0)
    scenes = doc.setdefault("scenes", [{"nodes": []}])
    while len(scenes) <= scene_index:
        scenes.append({"nodes": []})
    scenes[scene_index].setdefault("extras", {}).update(extras)

    new_json = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    new_json += b" " * ((4 - len(new_json) % 4) % 4)

    remaining = glb[offset:]
    new_total = 12 + 8 + len(new_json) + len(remaining)
    out = bytearray(struct.pack("<4sII", b"glTF", 2, new_total))
    out += struct.pack("<II", len(new_json), 0x4E4F534A)
    out += new_json
    out += remaining
    return bytes(out)


def export_fastener(s: FastenerSpec) -> None:
    solid = make_threaded_flange_bolt(s)
    step_path = OUT / f"{s.filename_stem}.step"
    stl_path = OUT / f".{s.filename_stem}.tmp.stl"
    glb_path = OUT / f"{s.filename_stem}.glb"

    exporters.export(solid, str(step_path))
    exporters.export(solid, str(stl_path), tolerance=0.045, angularTolerance=0.08)

    mesh = trimesh.load_mesh(stl_path, force="mesh")
    mesh.metadata["units"] = "mm"
    scene = trimesh.Scene(mesh)
    raw_glb = trimesh.exchange.gltf.export_glb(scene, include_normals=True)

    provenance = {
        "cadProvenance": {
            "gmPart": s.gm_part,
            "sourceTier": "DIMENSIONALLY_RECONSTRUCTED",
            "sourceReference": (
                f"GM catalog nominal {s.diameter_mm:g} mm x {s.pitch_mm:g} mm pitch x "
                f"{s.length_mm:g} mm under-head length; helical thread modeled; "
                "head/flange envelope standardized because GM tooling dimensions were not published"
            ),
            "units": "mm",
            "geometryVerified": False,
            "assemblyTransformVerified": False,
            "assemblyTransform": {"position": [0, 0, 0], "rotationDeg": [0, 0, 0]},
            "nominal": {
                "diameterMm": s.diameter_mm,
                "pitchMm": s.pitch_mm,
                "underHeadLengthMm": s.length_mm,
            },
        }
    }
    glb_path.write_bytes(patch_glb_scene_extras(raw_glb, provenance))
    stl_path.unlink(missing_ok=True)

    print(f"{s.gm_part}: {step_path.name} + {glb_path.name}")


def main() -> None:
    for spec in SPECS:
        export_fastener(spec)


if __name__ == "__main__":
    main()
