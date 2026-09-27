#!/usr/bin/env python3
"""Build a source-only Archery Range construction and silhouette checkpoint."""

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


PACK_ID = "frontier-archery-range-construction"
VERSION = "1.0.0"
LICENSE = "LicenseRef-Thousand-Unit-Skirmish-Internal-Review"
TEAM_COLORS = {"azure": "#5AA7D7", "ember": "#E67A5E"}
PACK_REL = Path("assets/units-buildings/frontier-archery-range-construction-v1")
SOURCE_PACK_REL = Path("assets/units-buildings/frontier-glb-sample-v2")
STAGE_SAMPLES = [
    {
        "id": "archery-range-00-foundation", "state": "foundation", "progress": 0.0,
        "visibleNodes": ["archery-range.foundation"],
        "notes": "A raised stone footprint anchors the construction site.",
    },
    {
        "id": "archery-range-25-frame", "state": "frame", "progress": 0.25,
        "visibleNodes": ["archery-range.foundation", "archery-range.construction.frame"],
        "notes": "Four open corner posts and cross-braces establish the covered practice bay.",
    },
    {
        "id": "archery-range-50-rails", "state": "rails", "progress": 0.5,
        "visibleNodes": ["archery-range.foundation", "archery-range.construction.frame",
                         "archery-range.construction.rails"],
        "notes": "Low side rails and a rear rack shape the practice lane while it stays open.",
    },
    {
        "id": "archery-range-75-canopy", "state": "canopy", "progress": 0.75,
        "visibleNodes": ["archery-range.foundation", "archery-range.construction.frame",
                         "archery-range.construction.rails", "archery-range.construction.roof-frame"],
        "notes": "Exposed rafters and one partial canopy plane distinguish the unfinished roof from completion.",
    },
    {
        "id": "archery-range-100-complete", "state": "complete", "progress": 1.0,
        "visibleNodes": ["archery-range.foundation", "archery-range.construction.frame",
                         "archery-range.construction.rails", "archery-range.complete.canopy",
                         "archery-range.complete.target", "archery-range.standard.azure"],
        "notes": "A single sloped canopy, front bullseye, and one owner-selected standard finish the Range.",
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


def add_sloped_panel(builder, x_min, x_max, back_y, front_y, thickness, color):
    """Add a thin roof panel that falls from the back (-Z) toward the open front (+Z)."""
    back_z, front_z = -1.56, 1.56
    top = [
        (x_min, back_y, back_z), (x_max, back_y, back_z),
        (x_max, front_y, front_z), (x_min, front_y, front_z),
    ]
    bottom = [(x, y - thickness, z) for x, y, z in top]
    builder.face(top, color)
    builder.face(list(reversed(bottom)), color)
    for i in range(4):
        j = (i + 1) % 4
        builder.face([top[i], top[j], bottom[j], bottom[i]], color)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def create_building(base):
    root = bpy.data.objects.new("archery-range.artRoot", None)
    bpy.context.collection.objects.link(root)
    root.empty_display_type = "CUBE"
    root["assetId"] = PACK_ID
    root["renderMode"] = "source-review-state-groups"
    root["groundPivot"] = "archery-range.anchor.ground"

    state_roots = {}
    for name in ("frame", "rails", "roof-frame", "complete"):
        key = name.replace("-", ".")
        state_roots[name] = base.empty_node(f"archery-range.state.{key}", root, (0, 0, 0), "construction-state")

    parts = {}
    foundation = base.MeshBuilder(pivot=(0, 0, 0))
    foundation.box((0, 0.12, 0), (3.20, 0.24, 3.20), base.BUILDING_PALETTE["stone"])
    foundation.box((0, 0.265, 0), (3.03, 0.07, 3.03), base.BUILDING_PALETTE["stoneLight"])
    for x in (-1.32, 1.32):
        for z in (-1.32, 1.32):
            foundation.box((x, 0.32, z), (0.34, 0.12, 0.34), base.BUILDING_PALETTE["stone"])
    parts["archery-range.foundation"] = foundation.mesh_object(
        "archery-range.foundation", root, material=base.BARRACKS_NEUTRAL,
        batch_key="building.archery-range.foundation",
    )

    frame = base.MeshBuilder(pivot=(0, 0, 0))
    # The open front and four exposed corner posts keep the Range distinct from a shed.
    for x in (-1.22, 1.22):
        for z, height in ((-1.22, 2.55), (1.22, 2.18)):
            frame.box((x, height / 2 + 0.35, z), (0.23, height, 0.23), base.BUILDING_PALETTE["timber"])
    frame.box((0, 2.90, -1.22), (2.66, 0.18, 0.23), base.BUILDING_PALETTE["timberLight"])
    frame.box((-1.22, 2.68, 0), (0.23, 0.18, 2.66), base.BUILDING_PALETTE["timberLight"])
    frame.box((1.22, 2.68, 0), (0.23, 0.18, 2.66), base.BUILDING_PALETTE["timberLight"])
    frame.box((0, 2.48, 1.22), (2.66, 0.18, 0.23), base.BUILDING_PALETTE["timberLight"])
    for side in (-1, 1):
        frame.box((side * 0.78, 1.40, -1.22), (0.11, 1.10, 0.11),
                  base.BUILDING_PALETTE["scaffold"], math.radians(side * 33))
        frame.box((side * 1.22, 1.38, -0.80), (0.11, 1.10, 0.11),
                  base.BUILDING_PALETTE["scaffold"], math.radians(-side * 33))
    parts["archery-range.construction.frame"] = frame.mesh_object(
        "archery-range.construction.frame", state_roots["frame"], material=base.BARRACKS_NEUTRAL,
        batch_key="building.archery-range.construction-frame",
    )

    rails = base.MeshBuilder(pivot=(0, 0, 0))
    for side in (-1, 1):
        rails.box((side * 1.16, 0.92, -0.02), (0.16, 0.18, 2.22), base.BUILDING_PALETTE["timberLight"])
        rails.box((side * 1.16, 0.52, -0.02), (0.12, 0.14, 2.22), base.BUILDING_PALETTE["timber"])
    rails.box((0, 0.78, -1.16), (2.22, 0.16, 0.14), base.BUILDING_PALETTE["timberLight"])
    # A broad practice rack at the back reads as equipment, not a closed wall.
    for x in (-0.72, -0.36, 0.0, 0.36, 0.72):
        rails.box((x, 1.18, -1.02), (0.09, 0.72, 0.10), base.BUILDING_PALETTE["timber"])
    parts["archery-range.construction.rails"] = rails.mesh_object(
        "archery-range.construction.rails", state_roots["rails"], material=base.BARRACKS_NEUTRAL,
        batch_key="building.archery-range.practice-rails",
    )

    roof_frame = base.MeshBuilder(pivot=(0, 0, 0))
    for x in (-0.86, -0.43, 0, 0.43, 0.86):
        add_sloped_panel(roof_frame, x - 0.07, x + 0.07, 2.94, 2.44, 0.14,
                         base.BUILDING_PALETTE["timber"])
    roof_frame.box((0, 2.91, -1.46), (2.95, 0.15, 0.15), base.BUILDING_PALETTE["timberLight"])
    roof_frame.box((0, 2.42, 1.46), (2.95, 0.15, 0.15), base.BUILDING_PALETTE["timberLight"])
    # The partial plane covers one half while leaving the other rafters exposed.
    add_sloped_panel(roof_frame, -1.55, -0.05, 2.94, 2.44, 0.16,
                     base.BUILDING_PALETTE["slate"])
    parts["archery-range.construction.roof-frame"] = roof_frame.mesh_object(
        "archery-range.construction.roof-frame", state_roots["roof-frame"], material=base.BARRACKS_NEUTRAL,
        batch_key="building.archery-range.roof-frame",
    )

    canopy = base.MeshBuilder(pivot=(0, 0, 0))
    add_sloped_panel(canopy, -1.58, 1.58, 2.98, 2.45, 0.18, base.BUILDING_PALETTE["slate"])
    # Wide front fascia emphasizes the single lean-to roofline at game zoom.
    canopy.box((0, 2.39, 1.48), (3.16, 0.22, 0.16), base.BUILDING_PALETTE["slateLight"])
    parts["archery-range.complete.canopy"] = canopy.mesh_object(
        "archery-range.complete.canopy", state_roots["complete"], material=base.BARRACKS_NEUTRAL,
        batch_key="building.archery-range.complete-canopy",
    )

    target = base.MeshBuilder(pivot=(0, 0, 0))
    target.box((0.64, 1.34, 1.29), (0.92, 1.05, 0.16), base.BUILDING_PALETTE["timber"])
    for radius, color in ((0.43, "#E2DED1"), (0.32, "#3D3C31"),
                          (0.20, "#AAA28A"), (0.075, "#716D5E")):
        points = [(0.64 + radius * math.cos(i * 2 * math.pi / 12),
                   1.48 + radius * math.sin(i * 2 * math.pi / 12)) for i in range(12)]
        target.prism_xy(points, 1.385 + (0.018 if radius < 0.4 else 0), 0.035, color)
    parts["archery-range.complete.target"] = target.mesh_object(
        "archery-range.complete.target", state_roots["complete"], material=base.BARRACKS_NEUTRAL,
        batch_key="building.archery-range.complete-target",
    )

    standards = {}
    for team in ("azure", "ember"):
        standard = base.MeshBuilder(pivot=(0, 0, 0))
        pole_x, pole_z = -0.98, 1.00
        standard.cylinder_y((pole_x, 2.75, pole_z), 0.035, 0.86, 6, base.BUILDING_PALETTE["timber"])
        left, right, top, bottom = -0.96, -0.43, 3.12, 2.72
        if team == "azure":
            standard.prism_xy([(left, top), (right, top), (right, bottom), (left, bottom)], pole_z + 0.06, 0.05, "#FFFFFF")
            standard.prism_xy([(-0.88, 2.89), (-0.51, 2.89), (-0.51, 2.95), (-0.88, 2.95)], pole_z + 0.09, 0.015, "#3D3C31")
        else:
            standard.prism_xy([(left, top), (right, top), (right - 0.14, 2.91),
                               (right, bottom), (left, bottom)], pole_z + 0.06, 0.05, "#FFFFFF")
            standard.prism_xy([(-0.88, 2.89), (-0.71, 2.89), (-0.71, 2.95), (-0.88, 2.95)], pole_z + 0.09, 0.015, "#3D3C31")
            standard.prism_xy([(-0.65, 2.89), (-0.48, 2.89), (-0.54, 2.95), (-0.65, 2.95)], pole_z + 0.09, 0.015, "#3D3C31")
        node = f"archery-range.standard.{team}"
        obj = standard.mesh_object(node, state_roots["complete"], material=base.BARRACKS_TEAM,
                                   batch_key=f"building.archery-range.standard.{team}")
        obj["teamVariant"] = team
        obj["shape"] = "straight-cut-pennant" if team == "azure" else "forked-tail-pennant"
        standards[team] = obj
        parts[node] = obj

    base.empty_node("archery-range.anchor.ground", root, (0, 0, 0), "ground-center")
    base.empty_node("archery-range.anchor.gate", root, (0, 0, 1.52), "front-entry")
    base.empty_node("archery-range.anchor.standard", root, (-0.98, 3.18, 1.00), "building-standard")
    base.empty_node("archery-range.anchor.productionCue", root, (0, 1.40, 1.55), "renderer-signal")
    base.empty_node("archery-range.anchor.rallyPoint", root, (0, 0, 2.35), "rally-point")
    return root, state_roots, parts, standards


def create_build_materials(base, atlas_path, atlas_helpers):
    atlas = bpy.data.images.load(str(atlas_path), check_existing=False)
    atlas.colorspace_settings.name = "sRGB"
    atlas.pack()
    base.BARRACKS_NEUTRAL.name = "neutral-archery-range-vertex-color"
    base.BARRACKS_TEAM.name = "team-accent-archery-range-instance-color"
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
        # The shared v0.2 preview clone helper still looks up this material prefix.
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

        preview_root = base.root_for_preview("preview.archery-range.azure", (0, 0, 0))
        visible = set(sample["visibleNodes"])
        for source in base.descendants(root):
            if source.type == "MESH":
                # Hide the complete editable model so only this sample's cloned parts render.
                source.hide_render = True
                if source.name in visible:
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
            "generator": "source/build_archery_range_construction_v1.py",
            "provider": "none; locally authored in Blender",
            "externalDependencies": external_dependencies,
        },
        "asset": {
            "id": "archery-range",
            "modelFile": "models/archery-range-construction-v1.glb",
            "boundsWorld": bounds,
            "footprintWorld": {"width": 3.2, "depth": 3.2},
            "origin": "ground-center",
            "parts": [
                {"id": name, "node": name, "batchKey": obj.get("batchKey"),
                 "teamVariant": obj.get("teamVariant"), "notes": obj.get("shape")}
                for name, obj in parts.items()
            ],
            "anchors": [
                {"id": "ground", "node": "archery-range.anchor.ground", "position": [0, 0, 0]},
                {"id": "gate", "node": "archery-range.anchor.gate", "position": [0, 0, 1.52]},
                {"id": "standard", "node": "archery-range.anchor.standard", "position": [-0.98, 3.18, 1.00]},
                {"id": "productionCue", "node": "archery-range.anchor.productionCue", "position": [0, 1.40, 1.55]},
                {"id": "rallyPoint", "node": "archery-range.anchor.rallyPoint", "position": [0, 0, 2.35]},
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
    shutil.copy2(Path(__file__).resolve(), out / "source/build_archery_range_construction_v1.py")

    base = load_module(BASE_AUTHORING_PATH, "archery_range_base_authoring")
    atlas_helpers = load_module(ATLAS_AUTHORING_PATH, "archery_range_atlas_helpers")
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
    base.select_and_export(root, out / "models/archery-range-construction-v1.glb")

    # Keep a useful editable scene open on the completed Azure Range.
    for name, state_root in state_roots.items():
        # Keep the permanent frame and practice rails visible; hide only the
        # intermediate roof frame while the completed canopy is shown.
        state_root.hide_set(name not in {"frame", "rails", "complete"})
    standards["ember"].hide_set(True)
    root.hide_set(False)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "source/archery-range-construction-v1.blend"))

    # Rendering works from the same model, camera, and environment as v0.2, but omits its cyan queue-cue placeholder.
    frames = render_frames(base, atlas_helpers, out, root, parts, STAGE_SAMPLES)
    package_readme = """# Archery Range construction GLB sample

**Status:** source-review package; no gameplay GLB loader adopts it.
[Asset guide](../../../docs/assets.md) · [Provenance](PROVENANCE.md)

## Contents

Four corner posts, low rails, rear target rack, sloped canopy, and front target. The 75% stage leaves rafters and half the roof exposed.
One GLB retains stable named parts for five construction stages. Five previews
share camera, footprint, origin, and Meadow background at zoom 0.91.
The editable scene opens with the completed Azure building.

The generator reuses mesh and atlas/UV helpers from the v0.2 sample; their hashes
are recorded in `source/authoring-manifest.json`. This authoring manifest is not
a renderer-v1 runtime manifest and must not be passed to its validator.

## Inspect

Run from this package directory with the optional game-dev CLI:

```sh
game-dev asset inspect models/archery-range-construction-v1.glb --json
game-dev asset validate models/archery-range-construction-v1.glb --request source/game-dev-package-archery-range.json --json
```

`SHA256SUMS.txt` covers package files except itself.

## Limits

Source previews show Azure on Meadow. Ember, Cinder, runtime loading, compatible
manifest conversion, in-game appearance, and authored-GLB performance remain
separate work. Source images establish the sample's construction sequence, not
live gameplay adoption.
"""
    (out / "README.md").write_text(package_readme)
    provenance = """# Provenance

All Archery Range geometry, standards, construction states, and review renders in this checkpoint were authored locally in Blender. No paid provider or third-party game art was used. The project-owned low-frequency atlas and Meadow/tree/rock preview inputs are copied from the merged v0.2 source pack. The precise external authoring-source revisions and hashes are recorded in `source/authoring-manifest.json`.

The package is licensed for internal review under `LicenseRef-Thousand-Unit-Skirmish-Internal-Review`. `SHA256SUMS.txt` records every file in this pack other than itself.
"""
    (out / "PROVENANCE.md").write_text(provenance)
    policy = {
        "requireUVs": True, "requireNormals": True, "requireTangentsWithNormalMap": True,
        "requireBaseColorTexture": True, "maxTriangles": 1200, "maxMaterials": 3,
        "minTextureSize": 512, "requirePowerOfTwoTextures": False,
        "maxDimensionMeters": 4.0, "minDimensionMeters": 0.1,
    }
    (out / "source/game-dev-package-archery-range.json").write_text(json.dumps(policy, indent=2) + "\n")
    write_package_metadata(out, root, parts, standards, frames, base)
    if target.exists() or target.is_symlink():
        raise FileExistsError(f"Refusing to replace output created during build: {target}")
    out.rename(target)
    print(f"Built {PACK_ID} {VERSION} at {target} with {len(frames)} fixed-camera stage frames")


if __name__ == "__main__":
    main()
