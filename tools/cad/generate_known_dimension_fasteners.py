#!/usr/bin/env python3
"""
Generate real CAD B-rep fastener solids for 2006 Tahoe GM catalog fasteners whose
nominal metric dimensions are published.

This uses CadQuery/OpenCascade and exports:
  - STEP neutral CAD solids
  - GLB tessellations with embedded cadProvenance scene extras

Accuracy policy:
  * published diameter / pitch / axial lengths are source-of-truth inputs;
  * helical threads are modeled geometrically, not texture-mapped;
  * exact GM head/flange tooling, root radii and coatings are not inferred when
    the catalog does not publish them;
  * therefore generated parts are DIMENSIONALLY_RECONSTRUCTED, never OEM_CAD.
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
    kind: str = "bolt"               # bolt | stud
    thread_b_mm: float | None = None  # only for double-ended stud
    total_length_mm: float | None = None


SPECS = [
    FastenerSpec("head_bolt_short", "12558840", "12558840-head-bolt-short", 8.0, 1.25, 45.0, 13.0, 5.3, 17.0, 1.4, "Cylinder-head short bolt M8x1.25x45"),
    FastenerSpec("head_bolt_long", "19258707", "19258707-head-bolt-long", 11.0, 2.0, 100.0, 17.0, 7.0, 22.0, 1.8, "Cylinder-head long bolt M11x2x100"),
    FastenerSpec("exhaust_manifold_bolt", "11546600", "11546600-exhaust-bolt", 8.0, 1.25, 30.7, 13.0, 5.3, 17.0, 1.4, "Exhaust-manifold bolt M8x1.25x30.7"),
    FastenerSpec("rocker_bolt", "12560961", "12560961-rocker-bolt", 8.0, 1.25, 52.5, 13.0, 5.3, 17.0, 1.4, "Rocker pivot-support bolt M8x1.25x52.5"),
    FastenerSpec("water_pump_bolt", "12551926", "12551926-water-pump-bolt", 8.0, 1.25, 83.0, 13.0, 5.3, 17.0, 1.4, "Water-pump bolt M8x1.25x83"),
    FastenerSpec("crank_balancer_bolt", "12557840", "12557840-balancer-bolt", 16.0, 2.0, 103.0, 24.0, 10.0, 30.0, 2.2, "Crankshaft balancer bolt M16x2x103"),

    # Additional 2006 catalog-published dimensions.
    FastenerSpec("valley_cover_bolt", "11515758", "11515758-valley-cover-bolt", 8.0, 1.25, 30.0, 13.0, 5.3, 18.0, 1.5, "Valley cover bolt M8x1.25x30 with 18 mm flange OD"),
    FastenerSpec("water_pump_inlet_bolt", "11516480", "11516480-water-pump-inlet-bolt", 6.0, 1.0, 25.0, 10.0, 4.0, 14.0, 1.2, "Water-pump inlet / thermostat housing bolt M6x1x25"),
    FastenerSpec("coolant_bleed_pipe_bolt", "11514008", "11514008-coolant-bleed-bolt", 6.0, 1.0, 30.0, 10.0, 4.0, 14.0, 1.2, "Coolant air-bleed pipe bolt M6x1x30"),
    FastenerSpec("block_coolant_drain_plug", "11588949", "11588949-block-drain-plug", 16.0, 1.5, 14.0, 24.0, 7.0, 24.0, 1.8, "Block coolant drain plug M16x1.5x14 with 24 mm outside flange diameter"),

    # Catalog gives thread lengths at both ends and overall length.
    FastenerSpec("throttle_body_stud", "89017691", "89017691-throttle-body-stud", 6.0, 1.0, 26.5, 0.0, 0.0, 0.0, 0.0, "Double-ended throttle-body stud M6x1; 26.5 mm + 10 mm threaded ends; 46 mm total", kind="stud", thread_b_mm=10.0, total_length_mm=46.0),
    FastenerSpec("exhaust_pipe_stud", "11589264", "11589264-exhaust-pipe-stud", 10.0, 1.5, 30.0, 0.0, 0.0, 0.0, 0.0, "Double-ended exhaust pipe stud M10x1.5; 30 mm + 16 mm threaded ends; 57 mm total", kind="stud", thread_b_mm=16.0, total_length_mm=57.0),
]


def thread_dimensions(diameter_mm: float, pitch_mm: float) -> tuple[float, float]:
    """Return conservative reconstructed thread depth and minor diameter."""
    depth = 0.54 * pitch_mm
    minor_d = max(0.1, diameter_mm - 2.0 * depth)
    return depth, minor_d


def external_thread_ridge(diameter_mm: float, pitch_mm: float, length_mm: float, z0: float = 0.0) -> cq.Workplane:
    """Create a genuine helical external thread ridge over the supplied axial span."""
    depth, minor_d = thread_dimensions(diameter_mm, pitch_mm)
    helix_radius = minor_d / 2.0 + depth * 0.45
    helix = cq.Wire.makeHelix(pitch_mm, length_mm, helix_radius)
    profile = (
        cq.Workplane("XZ")
        .center(helix_radius, 0)
        .moveTo(-depth * 0.42, -pitch_mm * 0.22)
        .lineTo(depth * 0.58, 0)
        .lineTo(-depth * 0.42, pitch_mm * 0.22)
        .close()
    )
    ridge = profile.sweep(helix, isFrenet=True)
    if z0:
        ridge = ridge.translate((0, 0, z0))
    return ridge


def make_threaded_flange_bolt(s: FastenerSpec) -> cq.Workplane:
    """Build a B-rep flange/hex bolt with a real helical thread ridge."""
    _, minor_d = thread_dimensions(s.diameter_mm, s.pitch_mm)
    runout = min(max(1.2 * s.pitch_mm, 1.5), s.length_mm * 0.10)
    thread_length = max(s.pitch_mm * 2.0, s.length_mm - runout)

    shank = cq.Workplane("XY").circle(minor_d / 2.0).extrude(s.length_mm)
    body = shank.union(external_thread_ridge(s.diameter_mm, s.pitch_mm, thread_length))

    try:
        body = body.faces("<Z").chamfer(min(0.35 * s.pitch_mm, 0.8))
    except Exception:
        pass

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


def make_double_ended_stud(s: FastenerSpec) -> cq.Workplane:
    if not s.thread_b_mm or not s.total_length_mm:
        raise ValueError(f"{s.asset_id}: stud requires thread_b_mm and total_length_mm")
    central = s.total_length_mm - s.length_mm - s.thread_b_mm
    if central < 0:
        raise ValueError(f"{s.asset_id}: threaded lengths exceed total stud length")

    _, minor_d = thread_dimensions(s.diameter_mm, s.pitch_mm)
    core = cq.Workplane("XY").circle(minor_d / 2.0).extrude(s.total_length_mm)

    ridge_a = external_thread_ridge(s.diameter_mm, s.pitch_mm, s.length_mm, 0.0)
    # Put the second thread at the opposite end. Thread handedness is not used as
    # an OE claim; pitch, major diameter, axial spans and total length are exact inputs.
    ridge_b = external_thread_ridge(
        s.diameter_mm,
        s.pitch_mm,
        s.thread_b_mm,
        s.total_length_mm - s.thread_b_mm,
    )
    solid = core.union(ridge_a).union(ridge_b)
    try:
        solid = solid.faces("<Z or >Z").chamfer(min(0.35 * s.pitch_mm, 0.7))
    except Exception:
        pass
    return solid


def patch_glb_scene_extras(glb: bytes, extras: dict) -> bytes:
    magic, version, _total_len = struct.unpack_from("<4sII", glb, 0)
    if magic != b"glTF" or version != 2:
        raise ValueError("Unexpected GLB header")

    offset = 12
    json_len, json_type = struct.unpack_from("<II", glb, offset)
    offset += 8
    if json_type != 0x4E4F534A:
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


def provenance_for(s: FastenerSpec) -> dict:
    if s.kind == "stud":
        source = (
            f"GM catalog nominal M{s.diameter_mm:g}x{s.pitch_mm:g}; threaded spans "
            f"{s.length_mm:g} mm and {s.thread_b_mm:g} mm; total length {s.total_length_mm:g} mm; "
            "helical threads modeled; exact production thread-root radii/coating not claimed"
        )
        nominal = {
            "diameterMm": s.diameter_mm,
            "pitchMm": s.pitch_mm,
            "threadLengthAMm": s.length_mm,
            "threadLengthBMm": s.thread_b_mm,
            "totalLengthMm": s.total_length_mm,
        }
    else:
        source = (
            f"GM catalog nominal {s.diameter_mm:g} mm x {s.pitch_mm:g} mm pitch x "
            f"{s.length_mm:g} mm under-head length; helical thread modeled; "
            "head/flange envelope standardized except any specifically published flange OD"
        )
        nominal = {
            "diameterMm": s.diameter_mm,
            "pitchMm": s.pitch_mm,
            "underHeadLengthMm": s.length_mm,
            "flangeDiameterMm": s.flange_diameter_mm,
        }

    return {
        "cadProvenance": {
            "gmPart": s.gm_part,
            "sourceTier": "DIMENSIONALLY_RECONSTRUCTED",
            "sourceReference": source,
            "units": "mm",
            "geometryVerified": False,
            "assemblyTransformVerified": False,
            "assemblyTransform": {"position": [0, 0, 0], "rotationDeg": [0, 0, 0]},
            "nominal": nominal,
        }
    }


def export_fastener(s: FastenerSpec) -> None:
    solid = make_double_ended_stud(s) if s.kind == "stud" else make_threaded_flange_bolt(s)
    step_path = OUT / f"{s.filename_stem}.step"
    stl_path = OUT / f".{s.filename_stem}.tmp.stl"
    glb_path = OUT / f"{s.filename_stem}.glb"

    exporters.export(solid, str(step_path))
    exporters.export(solid, str(stl_path), tolerance=0.045, angularTolerance=0.08)

    mesh = trimesh.load_mesh(stl_path, force="mesh")
    mesh.metadata["units"] = "mm"
    scene = trimesh.Scene(mesh)
    raw_glb = trimesh.exchange.gltf.export_glb(scene, include_normals=True)
    glb_path.write_bytes(patch_glb_scene_extras(raw_glb, provenance_for(s)))
    stl_path.unlink(missing_ok=True)

    print(f"{s.gm_part}: {step_path.name} + {glb_path.name}")


def main() -> None:
    for spec in SPECS:
        export_fastener(spec)


if __name__ == "__main__":
    main()
