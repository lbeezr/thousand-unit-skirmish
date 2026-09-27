#!/usr/bin/env python3
"""Build a source-only Barracks construction and silhouette checkpoint."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


PACK_ID = "frontier-barracks-construction"
VERSION = "1.0.0"
LICENSE = "LicenseRef-Thousand-Unit-Skirmish-Internal-Review"
TEAM_COLORS = {"azure": "#5AA7D7", "ember": "#E67A5E"}
PACK_REL = Path("assets/units-buildings/frontier-barracks-construction-v1")
SOURCE_PACK_REL = Path("assets/units-buildings/frontier-glb-sample-v2")
STAGE_SAMPLES = [
    {
        "id": "barracks-00-foundation", "state": "foundation", "progress": 0.0,
        "visibleNodes": ["barracks.foundation"],
        "notes": "A raised stone footprint anchors the construction site.",
    },
    {
        "id": "barracks-25-frame", "state": "frame", "progress": 0.25,
        "visibleNodes": ["barracks.foundation", "barracks.construction.frame"],
        "notes": "Tall posts and cross-braces give the early frame a distinct open silhouette.",
    },
    {
        "id": "barracks-50-walls", "state": "walls", "progress": 0.5,
        "visibleNodes": ["barracks.foundation", "barracks.construction.walls"],
        "notes": "Enclosed timber walls rise while the roof and finished gate remain absent.",
    },
    {
        "id": "barracks-75-roof", "state": "roof", "progress": 0.75,
        "visibleNodes": ["barracks.foundation", "barracks.construction.walls",
                         "barracks.construction.roof-frame"],
        "notes": "Exposed rafters and one covered slope distinguish the unfinished roof from completion.",
    },
    {
        "id": "barracks-100-complete", "state": "complete", "progress": 1.0,
        "visibleNodes": ["barracks.foundation", "barracks.construction.walls",
                         "barracks.complete.roof", "barracks.complete.gate",
                         "barracks.standard.azure", "barracks.standard.ember"],
        "notes": "Both slate slopes, the pale framed gate, and one owner-selected standard finish the Barracks.",
    },
]


def find_repo_root(script_path: Path) -> Path:
    for parent in script_path.resolve().parents:
        if (parent / "AGENTS.md").is_file() and (parent / ".git").exists():
            return parent
    raise RuntimeError("Could not locate the Thousand Unit Skirmish repository root")


REPO_ROOT = find_repo_root(Path(__file__))
SOURCE_PACK = REPO_ROOT / SOURCE_PACK_REL
BASE_AUTHORING_PATH = SOURCE_PACK / "source/base_build_sample_v0_1_2.py"
ATLAS_AUTHORING_PATH = SOURCE_PACK / "source/build_frontier_character_pack_v2.py"


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load authoring source: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def create_building(base):
    root = bpy.data.objects.new("barracks.artRoot", None)
    bpy.context.collection.objects.link(root)
    root.empty_display_type = "CUBE"
    root["assetId"] = PACK_ID
    root["renderMode"] = "source-review-state-groups"
    root["groundPivot"] = "barracks.anchor.ground"

    state_roots = {}
    for name in ("frame", "walls", "roof-frame", "complete"):
        key = name.replace("-", ".")
        state_roots[name] = base.empty_node(f"barracks.state.{key}", root, (0, 0, 0), "construction-state")

    parts = {}
    foundation = base.MeshBuilder(pivot=(0, 0, 0))
    foundation.box((0, 0.12, 0), (3.20, 0.24, 3.20), base.BUILDING_PALETTE["stone"])
    foundation.box((0, 0.265, 0), (3.03, 0.07, 3.03), base.BUILDING_PALETTE["stoneLight"])
    for x in (-1.32, 1.32):
        for z in (-1.32, 1.32):
            foundation.box((x, 0.32, z), (0.34, 0.12, 0.34), base.BUILDING_PALETTE["stone"])
    parts["barracks.foundation"] = foundation.mesh_object(
        "barracks.foundation", root, material=base.BARRACKS_NEUTRAL,
        batch_key="building.barracks.foundation",
    )

    frame = base.MeshBuilder(pivot=(0, 0, 0))
    for x in (-1.20, 1.20):
        for z in (-1.20, 1.20):
            frame.box((x, 0.95, z), (0.22, 1.50, 0.22), base.BUILDING_PALETTE["timber"])
    frame.box((0, 1.60, -1.18), (2.55, 0.18, 0.22), base.BUILDING_PALETTE["timberLight"])
    frame.box((-1.18, 1.60, 0), (0.22, 0.18, 2.50), base.BUILDING_PALETTE["timberLight"])
    frame.box((1.18, 1.60, 0), (0.22, 0.18, 2.50), base.BUILDING_PALETTE["timberLight"])
    frame.box((-0.82, 1.60, 1.18), (0.78, 0.18, 0.22), base.BUILDING_PALETTE["timberLight"])
    frame.box((0.82, 1.60, 1.18), (0.78, 0.18, 0.22), base.BUILDING_PALETTE["timberLight"])
    frame.box((0, 0.92, 1.23), (0.10, 0.92, 0.10), base.BUILDING_PALETTE["scaffold"], math.radians(34))
    frame.box((0, 0.92, -1.23), (0.10, 0.92, 0.10), base.BUILDING_PALETTE["scaffold"], math.radians(-34))
    parts["barracks.construction.frame"] = frame.mesh_object(
        "barracks.construction.frame", state_roots["frame"], material=base.BARRACKS_NEUTRAL,
        batch_key="building.barracks.construction-frame",
    )

    walls = base.MeshBuilder(pivot=(0, 0, 0))
    walls.box((0, 0.81, -1.18), (2.40, 1.10, 0.20), base.BUILDING_PALETTE["timber"])
    walls.box((-1.14, 0.81, 0), (0.20, 1.10, 2.43), base.BUILDING_PALETTE["timber"])
    walls.box((1.14, 0.81, 0), (0.20, 1.10, 2.43), base.BUILDING_PALETTE["timber"])
    walls.box((-0.86, 0.81, 1.18), (0.72, 1.10, 0.20), base.BUILDING_PALETTE["timber"])
    walls.box((0.86, 0.81, 1.18), (0.72, 1.10, 0.20), base.BUILDING_PALETTE["timber"])
    for x in (-1.04, -0.70, -0.36, 0.36, 0.70, 1.04):
        if abs(x) < 0.5:
            continue
        walls.box((x, 0.82, 1.295), (0.09, 1.02, 0.035), base.BUILDING_PALETTE["timberLight"])
    for x in (-1.16, 1.16):
        for z in (-1.16, 1.16):
            walls.box((x, 0.84, z), (0.23, 1.16, 0.23), base.BUILDING_PALETTE["timberLight"])
    parts["barracks.construction.walls"] = walls.mesh_object(
        "barracks.construction.walls", state_roots["walls"], material=base.BARRACKS_NEUTRAL,
        batch_key="building.barracks.walls",
    )
    # The shared wall mesh is used by the 75% and complete states.
    parts["barracks.construction.walls"].parent = state_roots["walls"]

    roof_frame = base.MeshBuilder(pivot=(0, 0, 0))
    roof_frame.box((0, 2.16, 0), (0.16, 0.16, 3.34), base.BUILDING_PALETTE["timberLight"])
    for z in (-1.35, -0.68, 0, 0.68, 1.35):
        roof_frame.box((-0.65, 1.86, z), (1.62, 0.12, 0.11), base.BUILDING_PALETTE["timber"] , math.radians(30))
        roof_frame.box((0.65, 1.86, z), (1.62, 0.12, 0.11), base.BUILDING_PALETTE["timber"], math.radians(-30))
    roof_frame.box((-0.67, 1.86, 0), (1.78, 0.12, 3.34), base.BUILDING_PALETTE["slate"], math.radians(30))
    parts["barracks.construction.roof-frame"] = roof_frame.mesh_object(
        "barracks.construction.roof-frame", state_roots["roof-frame"], material=base.BARRACKS_NEUTRAL,
        batch_key="building.barracks.roof-frame",
    )

    completed_roof = base.MeshBuilder(pivot=(0, 0, 0))
    completed_roof.box((-0.67, 1.86, 0), (1.78, 0.14, 3.38), base.BUILDING_PALETTE["slate"], math.radians(30))
    completed_roof.box((0.67, 1.86, 0), (1.78, 0.14, 3.38), base.BUILDING_PALETTE["slate"], math.radians(-30))
    completed_roof.box((0, 2.20, 0), (0.19, 0.17, 3.46), base.BUILDING_PALETTE["slateLight"])
    completed_roof.box((0, 1.12, 1.34), (2.55, 0.10, 0.12), base.BUILDING_PALETTE["timberLight"])
    parts["barracks.complete.roof"] = completed_roof.mesh_object(
        "barracks.complete.roof", state_roots["complete"], material=base.BARRACKS_NEUTRAL,
        batch_key="building.barracks.complete-roof",
    )

    gate = base.MeshBuilder(pivot=(0, 0, 0))
    gate.box((0, 0.64, 1.31), (0.78, 0.88, 0.08), base.BUILDING_PALETTE["door"])
    for x in (-0.54, 0.54):
        gate.box((x, 0.82, 1.36), (0.18, 1.22, 0.24), base.BUILDING_PALETTE["stoneLight"])
        gate.box((x, 0.82, 1.49), (0.08, 0.86, 0.045), base.BUILDING_PALETTE["iron"])
    gate.box((0, 1.47, 1.36), (1.28, 0.19, 0.24), base.BUILDING_PALETTE["stoneLight"])
    gate.box((0, 1.34, 1.51), (0.84, 0.09, 0.08), base.BUILDING_PALETTE["timberLight"])
    parts["barracks.complete.gate"] = gate.mesh_object(
        "barracks.complete.gate", state_roots["complete"], material=base.BARRACKS_NEUTRAL,
        batch_key="building.barracks.complete-gate",
    )

    standards = {}
    for team in ("azure", "ember"):
        standard = base.MeshBuilder(pivot=(0, 0, 0))
        pole_x, pole_z = 0.82, 0.92
        standard.cylinder_y((pole_x, 2.46, pole_z), 0.035, 0.82, 6, base.BUILDING_PALETTE["timber"])
        left, right, top, bottom = 0.84, 1.40, 2.78, 2.36
        if team == "azure":
            standard.prism_xy([(left, top), (right, top), (right, bottom), (left, bottom)], pole_z + 0.06, 0.05, "#FFFFFF")
            standard.prism_xy([(0.94, 2.53), (1.31, 2.53), (1.31, 2.59), (0.94, 2.59)], pole_z + 0.09, 0.015, "#3D3C31")
        else:
            standard.prism_xy([(left, top), (right, top), (right - 0.13, 2.57),
                               (right, bottom), (left, bottom)], pole_z + 0.06, 0.05, "#FFFFFF")
            standard.prism_xy([(0.94, 2.53), (1.12, 2.53), (1.12, 2.59), (0.94, 2.59)], pole_z + 0.09, 0.015, "#3D3C31")
            standard.prism_xy([(1.19, 2.53), (1.36, 2.53), (1.30, 2.59), (1.19, 2.59)], pole_z + 0.09, 0.015, "#3D3C31")
        node = f"barracks.standard.{team}"
        obj = standard.mesh_object(node, state_roots["complete"], material=base.BARRACKS_TEAM,
                                   batch_key=f"building.barracks.standard.{team}")
        obj["teamVariant"] = team
        obj["shape"] = "straight-cut-pennant" if team == "azure" else "forked-tail-pennant"
        standards[team] = obj
        parts[node] = obj

    base.empty_node("barracks.anchor.ground", root, (0, 0, 0), "ground-center")
    base.empty_node("barracks.anchor.gate", root, (0, 0, 1.45), "front-gate")
    base.empty_node("barracks.anchor.banner", root, (0.82, 2.84, 0.92), "building-standard")
    base.empty_node("barracks.anchor.productionCue", root, (0, 1.30, 1.22), "renderer-signal")
    base.empty_node("barracks.anchor.rallyPoint", root, (0, 0, 2.20), "rally-point")
    return root, state_roots, parts, standards


def create_build_materials(base, atlas_path, atlas_helpers):
    atlas = bpy.data.images.load(str(atlas_path), check_existing=False)
    atlas.colorspace_settings.name = "sRGB"
    atlas.pack()
    atlas_helpers.configure_atlas_material(base.BARRACKS_NEUTRAL, atlas)


def bounds_in_game_space(base, root):
    bpy.context.view_layer.update()
    points = []
    for obj in base.descendants(root):
        if obj.type != "MESH":
            continue
        for vertex in obj.data.vertices:
            world = obj.matrix_world @ vertex.co
            points.append((world.x, world.z, -world.y))
    mins = [min(p[i] for p in points) for i in range(3)]
    maxs = [max(p[i] for p in points) for i in range(3)]
    return {"min": [round(v, 4) for v in mins], "max": [round(v, 4) for v in maxs],
            "size": [round(maxs[i] - mins[i], 4) for i in range(3)]}


def clear_previews(base):
    for obj in list(bpy.context.scene.objects):
        if obj.get("previewOwned") or obj.name.startswith(("ground.", "sun", "preview.camera")):
            bpy.data.objects.remove(obj, do_unlink=True)


def render_frames(base, atlas_helpers, out: Path, root, parts, samples):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    base.make_preview_unlit_material("preview-neutral-unlit", vertex_colors=True)
    atlas_helpers.configure_preview_atlas_material(
        bpy.data.materials["preview-neutral-unlit"],
        bpy.data.images["frontier-material-atlas.png"],
    )
    for team, color in TEAM_COLORS.items():
        base.make_preview_unlit_material(f"preview-team-barracks-{team}", vertex_colors=True, tint=color)
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.38, 0.42, 0.33, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.82

    world_height = 43.0 / 0.91
    world_width = world_height * 1280.0 / 720.0
    outputs = []
    for sample in samples:
        clear_previews(base)
        ground_mat = base.add_ground_material("ground.meadow", base.MEADOW_SOURCE)
        base.create_ground("ground.meadow", base.MEADOW_SOURCE, ground_mat, span=420.0)
        base.add_preview_environment_sprites()

        camera_data = bpy.data.cameras.new("preview.camera")
        camera = bpy.data.objects.new("preview.camera", camera_data)
        scene.collection.objects.link(camera)
        scene.camera = camera
        offset = Vector((0.78, 1.12, 0.78)).normalized() * 120.0
        camera.location = base.game_to_blender(tuple(offset))
        camera.rotation_euler = (Vector(base.game_to_blender((0, 0, 0))) - camera.location).to_track_quat("-Z", "Y").to_euler()
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = world_width / 0.91
        camera.data.clip_start = 0.1
        camera.data.clip_end = 400

        light_data = bpy.data.lights.new("sun", "SUN")
        light_data.energy = 1.5
        light_data.angle = math.radians(15)
        light = bpy.data.objects.new("sun", light_data)
        scene.collection.objects.link(light)
        light_position = Vector(base.game_to_blender((-24, 38, 20)))
        light.location = light_position
        light.rotation_euler = (-light_position).to_track_quat("-Z", "Y").to_euler()

        preview_root = base.root_for_preview("preview.barracks.azure", (0, 0, 0))
        visible = set(sample["visibleNodes"])
        for source in base.descendants(root):
            if source.type == "MESH" and source.name in visible:
                base.clone_mesh_for_preview(source, preview_root, team_color="azure")
        filename = f"{sample['id']}-meadow-zoom-0.91-1280x720.png"
        destination = out / "previews" / filename
        scene.render.filepath = str(destination)
        bpy.ops.render.render(write_still=True)
        outputs.append(("previews/" + filename, sample["id"], sample["progress"]))
    clear_previews(base)
    return outputs


def build_pose_samples():
    return {
        "schemaVersion": 1,
        "assetId": PACK_ID,
        "origin": "ground-center",
        "samples": [
            {"id": sample["id"], "state": sample["state"],
             "buildingProgress": sample["progress"],
             "visibleNodes": sample["visibleNodes"],
             "notes": sample["notes"]}
            for sample in STAGE_SAMPLES
        ],
    }


def write_package_metadata(out: Path, root, parts, standards, frames, base):
    bounds = bounds_in_game_space(base, root)
    state_records = []
    for sample, frame in zip(STAGE_SAMPLES, frames):
        state_records.append({
            "id": sample["id"], "state": sample["state"],
            "buildingProgress": sample["progress"],
            "visibleNodes": sample["visibleNodes"],
            "reviewFile": frame[0], "reviewStatus": "rendered-source-review",
            "notes": sample["notes"],
        })
    files = []
    for path in sorted(p for p in out.rglob("*") if p.is_file()
                       and p.name not in {"authoring-manifest.json", "SHA256SUMS.txt"}):
        files.append({"path": path.relative_to(out).as_posix(),
                      "role": "source-review-file", "sha256": sha256(path)})
    external_dependencies = []
    for path in (BASE_AUTHORING_PATH, ATLAS_AUTHORING_PATH):
        external_dependencies.append({
            "path": path.relative_to(REPO_ROOT).as_posix(), "sha256": sha256(path),
        })
    manifest = {
        "packId": PACK_ID,
        "packVersion": VERSION,
        "manifestKind": "source-review-only",
        "runtimeReady": False,
        "license": LICENSE,
        "coordinateSystem": {"units": "world-unit", "up": "+Y", "forward": "+Z", "right": "+X"},
        "source": {
            "authoringTool": bpy.app.version_string,
            "generator": "source/build_barracks_construction_v1.py",
            "provider": "none; locally authored in Blender",
            "externalDependencies": external_dependencies,
        },
        "asset": {
            "id": "barracks",
            "modelFile": "models/barracks-construction-v1.glb",
            "boundsWorld": bounds,
            "footprintWorld": {"width": 3.2, "depth": 3.2},
            "origin": "ground-center",
            "parts": [
                {"id": name, "node": name, "batchKey": obj.get("batchKey"),
                 "teamVariant": obj.get("teamVariant"), "notes": obj.get("shape")}
                for name, obj in parts.items()
            ],
            "anchors": [
                {"id": "ground", "node": "barracks.anchor.ground", "position": [0, 0, 0]},
                {"id": "gate", "node": "barracks.anchor.gate", "position": [0, 0, 1.45]},
                {"id": "standard", "node": "barracks.anchor.banner", "position": [0.82, 2.84, 0.92]},
                {"id": "productionCue", "node": "barracks.anchor.productionCue", "position": [0, 1.30, 1.22]},
                {"id": "rallyPoint", "node": "barracks.anchor.rallyPoint", "position": [0, 0, 2.20]},
            ],
            "stateSamples": state_records,
            "stateSelection": "Renderer-owned: clamp progress to [0,1], select one of five ordered stateSamples; exactly one matching team standard is visible at completion.",
            "teamVariants": [
                {"team": "azure", "node": standards["azure"].name,
                 "shape": "straight-cut pennant with one centered bar", "color": TEAM_COLORS["azure"]},
                {"team": "ember", "node": standards["ember"].name,
                 "shape": "forked pennant with split bar", "color": TEAM_COLORS["ember"]},
            ],
        },
        "review": {
            "camera": {"ground": "meadow", "zoom": 0.91, "resolution": [1280, 720]},
            "scope": "Five individually rendered construction states at a common game camera, footprint, and origin.",
            "knownLimits": [
                "Source render only; renderer still uses procedural buildings and does not load this GLB.",
                "No authored-GLB 2,000-unit performance result is claimed.",
                "Only Azure Meadow construction views are rendered; Ember and Cinder visual review remains open.",
            ],
        },
        "files": files,
    }
    (out / "source/pose-samples.json").write_text(json.dumps(build_pose_samples(), indent=2) + "\n")
    manifest["files"] = [
        {"path": path.relative_to(out).as_posix(), "role": "source-review-file", "sha256": sha256(path)}
        for path in sorted(p for p in out.rglob("*") if p.is_file()
                           and p.name not in {"authoring-manifest.json", "SHA256SUMS.txt"})
    ]
    (out / "source/authoring-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    checksum_lines = [
        f"{sha256(path)}  {path.relative_to(out).as_posix()}"
        for path in sorted(p for p in out.rglob("*") if p.is_file() and p.name != "SHA256SUMS.txt")
    ]
    (out / "SHA256SUMS.txt").write_text("\n".join(checksum_lines) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True,
                        help="new package path inside this repository; existing paths are refused")
    blender_args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(blender_args)
    target = Path(args.output_dir)
    if not target.is_absolute():
        target = REPO_ROOT / target
    target = target.resolve()
    target.relative_to(REPO_ROOT)
    staging = target.with_name(target.name + ".building")
    if target.exists() or target.is_symlink() or staging.exists() or staging.is_symlink():
        raise FileExistsError(f"Refusing to overwrite {target} or {staging}")
    if not target.parent.is_dir():
        raise FileNotFoundError(f"Output parent does not exist: {target.parent}")
    if not BASE_AUTHORING_PATH.is_file() or not ATLAS_AUTHORING_PATH.is_file():
        raise FileNotFoundError("The merged v0.2 authoring dependencies are missing")

    out = staging
    for directory in ("models", "previews", "source/environment", "source/terrain"):
        (out / directory).mkdir(parents=True, exist_ok=True)
    base_pack_source = SOURCE_PACK / "source"
    for name in ("frontier-material-atlas.png",):
        shutil.copy2(base_pack_source / name, out / "source" / name)
    for name in ("pine.webp", "oak.webp", "rock-outcrop.webp"):
        shutil.copy2(base_pack_source / "environment" / name, out / "source/environment" / name)
    shutil.copy2(base_pack_source / "terrain/meadow.png", out / "source/terrain/meadow.png")
    shutil.copy2(Path(__file__).resolve(), out / "source/build_barracks_construction_v1.py")

    base = load_module(BASE_AUTHORING_PATH, "barracks_base_authoring")
    atlas_helpers = load_module(ATLAS_AUTHORING_PATH, "barracks_atlas_helpers")
    base.PACK_ROOT = out
    base.MODELS = out / "models"
    base.PREVIEWS = out / "previews"
    base.SOURCE = out / "source"
    base.MEADOW_SOURCE = out / "source/terrain/meadow.png"
    base.ENVIRONMENT_SOURCE = out / "source/environment"
    atlas_helpers.install_atlas_uv_mapping(base)
    base.clear_scene()
    atlas_path = out / "source/frontier-material-atlas.png"
    create_build_materials(base, atlas_path, atlas_helpers)
    root, state_roots, parts, standards = create_building(base)
    base.select_and_export(root, out / "models/barracks-construction-v1.glb")

    # Keep a useful editable scene open on the completed Azure Barracks.
    for name, state_root in state_roots.items():
        # Walls remain visible in the editable completed scene; only their
        # roof-frame and early timber-frame alternatives are hidden.
        state_root.hide_set(name not in {"walls", "complete"})
    standards["ember"].hide_set(True)
    root.hide_set(False)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "source/barracks-construction-v1.blend"))

    # Rendering works from the same model, camera, and environment as v0.2, but omits its cyan queue-cue placeholder.
    frames = render_frames(base, atlas_helpers, out, root, parts, STAGE_SAMPLES)
    package_readme = """# Barracks construction sample v1.0.0

This building-only checkpoint revises the Barracks silhouette and construction sequence. It contains one GLB with the raised foundation, open timber frame, wall shell, unfinished rafters with one covered slope, and completed slate roof, gate, and team standards. Five separate preview images use the same camera, footprint, origin, and Meadow backdrop at zoom 0.91.

**Scope:** source-review only. `source/authoring-manifest.json` is an authoring record outside runtime `manifest.json` discovery. This pack is not runtime-ready and must not be loaded by the game. The renderer still draws procedural buildings; a GLB loader, runtime manifest conversion, in-game appearance, and an authored-GLB 2,000-unit measurement remain separate work.

The completed roof and pale framed gate are broad silhouette cues. The 75% state retains exposed rafters and leaves one slope open so it differs from completion. The source frames show Azure on Meadow only; Ember and Cinder review remain open.

The source scene opens with the completed Azure Barracks. The generator imports the stable base mesh and atlas UV helpers from the merged v0.2 sample, whose hashes are recorded in `source/authoring-manifest.json`.

Useful read-only commands:

```sh
game-dev asset inspect models/barracks-construction-v1.glb --json
game-dev asset validate models/barracks-construction-v1.glb --request source/game-dev-package-barracks.json --json
```

`SHA256SUMS.txt` covers every package file except itself.
"""
    (out / "README.md").write_text(package_readme)
    provenance = """# Provenance

All Barracks geometry, standards, construction states, and review renders in this checkpoint were authored locally in Blender. No paid provider or third-party game art was used. The project-owned low-frequency atlas and Meadow/tree/rock preview inputs are copied from the merged v0.2 source pack. The precise external authoring-source revisions and hashes are recorded in `source/authoring-manifest.json`.

The package is licensed for internal review under `LicenseRef-Thousand-Unit-Skirmish-Internal-Review`. `SHA256SUMS.txt` records every file in this pack other than itself.
"""
    (out / "PROVENANCE.md").write_text(provenance)
    policy = {
        "requireUVs": True, "requireNormals": True, "requireTangentsWithNormalMap": True,
        "requireBaseColorTexture": True, "maxTriangles": 1200, "maxMaterials": 3,
        "minTextureSize": 512, "requirePowerOfTwoTextures": False,
        "maxDimensionMeters": 4.0, "minDimensionMeters": 0.1,
    }
    (out / "source/game-dev-package-barracks.json").write_text(json.dumps(policy, indent=2) + "\n")
    write_package_metadata(out, root, parts, standards, frames, base)
    if target.exists() or target.is_symlink():
        raise FileExistsError(f"Refusing to replace output created during build: {target}")
    out.rename(target)
    print(f"Built {PACK_ID} {VERSION} at {target} with {len(frames)} fixed-camera stage frames")


if __name__ == "__main__":
    main()
