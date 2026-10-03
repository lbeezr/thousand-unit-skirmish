"""Extend PR #40's scaffold with explicit part recipes and synthetic capture checks.

All fixture output is synthetic, private, and unsuitable for runtime adoption.
Real capture requires an authored scene, semantic part recipe, and verified source.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

STATES = ("foundation", "frame", "complete", "damaged", "critical")
EXPECTED_SHA256 = "c86e1e55223df8b26c8060622ea3bbd2fb49e78ae576417734bd8eb6a30c6faa"
HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SCAFFOLD_SHA256 = "528402734af46f2041959ea91e9e966cf38b0e9cf2f270bef0c0473763d380e2"


def sha256(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            result.update(chunk)
    return result.hexdigest()


def validate_recipe(recipe, names):
    if set(recipe) != set(STATES):
        raise ValueError("Recipe must contain exactly all five lifecycle states")
    known = set(names)
    for state, spec in recipe.items():
        include = spec.get("include", [])
        edits = spec.get("edits", {})
        if not include or len(include) != len(set(include)):
            raise ValueError(f"{state}: parts must be nonempty and unique")
        if not set(include).issubset(known):
            raise ValueError(f"{state}: unknown semantic parts")
        if not set(edits).issubset(include):
            raise ValueError(f"{state}: edited parts must be included")
        for edit in edits.values():
            if set(edit) - {"mesh_scale", "offset_world", "rotate_world_z_degrees"}:
                raise ValueError("Unsupported edit: author geometry explicitly")
            for key in ("mesh_scale", "offset_world"):
                if key in edit:
                    values = edit[key]
                    if len(values) != 3 or not all(isinstance(x, (float, int)) and math.isfinite(x) for x in values):
                        raise ValueError(f"Invalid {key}")
            if "mesh_scale" in edit and not all(x > 0 for x in edit["mesh_scale"]):
                raise ValueError("Mesh scale must be positive")
            angle = edit.get("rotate_world_z_degrees", 0)
            if not isinstance(angle, (float, int)) or not math.isfinite(angle):
                raise ValueError("Invalid rotation")
    if recipe["complete"].get("edits"):
        raise ValueError("Complete must preserve the authored master")
    return recipe


def new_output(path):
    path = Path(path)
    if not path.is_absolute():
        raise ValueError("Use an absolute private output directory")
    if path.resolve().is_relative_to(REPO):
        raise ValueError("Keep pilot artifacts outside the public checkout")
    if path.exists():
        raise FileExistsError("Preserve iterations; output directory must be new")
    return path


def prepare_scaffold(output):
    script = HERE / "prepare-frontier-town-center-blender.py"
    if sha256(script) != SCAFFOLD_SHA256:
        raise ValueError("Pinned PR #40 scaffold changed")
    module_spec = importlib.util.spec_from_file_location("pr40_scaffold", script)
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    prior = sys.argv[:]
    try:
        sys.argv = [str(script), "--", "--output", str(output / "scaffold.blend"),
                    "--report", str(output / "scaffold.json")]
        module.main()
    finally:
        sys.argv = prior


def fixture():
    import bpy
    from mathutils import Matrix

    scene = bpy.context.scene
    root = bpy.data.objects["Calibrated_Model_Root"]
    bpy.context.view_layer.update()
    objects = {}
    materials = {}
    colors = {"stone": (.38, .43, .46, 1), "wood": (.25, .12, .055, 1),
              "wall": (.77, .70, .53, 1), "roof": (.34, .19, .08, 1),
              "ochre": (.72, .42, .04, 1), "owner": (.035, .22, .68, 1)}
    for name, color in colors.items():
        material = bpy.data.materials.new("Fixture_" + name)
        material.diffuse_color = color
        material.use_nodes = True
        material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = color
        material.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .8
        materials[name] = material

    def install(obj, name, group, material, team=False):
        obj.name = name
        obj.data.materials.append(materials[material])
        world = obj.matrix_world.copy()
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        bpy.data.collections[group].objects.link(obj)
        obj.parent = root
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_world = world
        obj["semantic_part"] = name
        obj["team_mask"] = team
        obj.color = (1, 1, 1, 1) if team else (0, 0, 0, 1)
        objects[name] = obj
        return obj

    def box(name, group, location, size, material, angle=0, team=False):
        bpy.ops.mesh.primitive_cube_add(size=1, location=location)
        obj = bpy.context.object
        obj.scale = size
        obj.rotation_euler.y = math.radians(angle)
        bpy.context.view_layer.update()
        return install(obj, name, group, material, team)

    box("Foundation_Slab", "Foundation_and_Steps", (0, 0, .12), (4.4, 4.24, .24), "stone")
    box("Foundation_Step", "Foundation_and_Steps", (0, -1.87, .29), (1.3, .50, .12), "stone")
    for x in (-1.4, 1.4):
        for y in (-1.35, 1.35):
            box(f"Post_{x}_{y}", "Structural_Timber", (x, y, 1.26), (.17, .17, 2.04), "wood")
    box("Beam_Front", "Structural_Timber", (0, -1.35, 2.21), (3, .18, .18), "wood")
    box("Beam_Back", "Structural_Timber", (0, 1.35, 2.21), (3, .18, .18), "wood")
    box("Wall_Left", "Wall_Envelope", (-1.4, 0, 1.17), (.12, 2.65, 1.80), "wall")
    box("Wall_Right", "Wall_Envelope", (1.4, 0, 1.17), (.12, 2.65, 1.80), "wall")
    box("Wall_Back", "Wall_Envelope", (0, 1.35, 1.17), (2.7, .12, 1.80), "wall")
    box("Door_Left", "Wall_Envelope", (-1.03, -1.35, 1.17), (.60, .12, 1.80), "wall")
    box("Door_Right", "Wall_Envelope", (1.03, -1.35, 1.17), (.60, .12, 1.80), "wall")
    for side, x, angle in (("West", -.78, -27), ("East", .78, 27)):
        box("Rafter_" + side, "Structural_Timber", (x, 0, 2.58), (1.90, .15, .15), "wood", angle)
        for section, y in (("Front", -.83), ("Back", .83)):
            box("Roof_" + side + "_" + section, "Roof_Planes",
                (x, y, 2.58), (1.90, 1.76, .12), "roof", angle)
    box("Tower_Base", "Bell_Tower", (0, .65, 2.99), (.68, .68, .60), "wood")
    box("Tower_Cap", "Bell_Tower", (0, .65, 3.37), (.95, .95, .16), "roof")
    box("Banner_Pole", "Owner_Standards", (1.82, -1.64, .95), (.075, .075, 1.42), "wood")
    box("Banner_Cloth", "Owner_Standards", (1.63, -1.64, 1.43), (.42, .035, .39), "owner", team=True)
    # Neutral ochre is deliberately present to test explicit mask selection.
    box("Neutral_Ochre_Prop", "Civic_Props", (-1.75, -1.65, .43), (.35, .35, .38), "ochre")
    box("Construction_Planks", "Civic_Props", (-1.70, .20, .31), (.25, 1.4, .12), "wood")
    all_names = list(objects)
    common = ["Foundation_Slab", "Foundation_Step", "Banner_Pole", "Banner_Cloth"]
    timber = [n for n in all_names if n.startswith(("Post_", "Beam_", "Rafter_"))]
    recipe = {
        "foundation": {"include": common + ["Construction_Planks"]},
        "frame": {"include": common + timber + ["Construction_Planks"]},
        "complete": {"include": all_names},
        "damaged": {"include": [n for n in all_names if n not in ("Roof_East_Back", "Wall_Back")],
                    "edits": {"Roof_West_Back": {"mesh_scale": [1, 1, .65], "offset_world": [0, 0, -.18]}}},
        "critical": {"include": common + timber + ["Wall_Left", "Tower_Base", "Neutral_Ochre_Prop", "Roof_West_Front"],
                     "edits": {"Roof_West_Front": {"mesh_scale": [1, 1, .65], "offset_world": [0, 0, -.65],
                                                       "rotate_world_z_degrees": 12}}},
    }
    scene["synthetic_fixture"] = True
    scene["status"] = "SYNTHETIC FIXTURE; not the approved Town Center"
    return objects, validate_recipe(recipe, objects)


def import_verified_source(source, expected_hash=EXPECTED_SHA256):
    import bpy
    from mathutils import Matrix

    if sha256(source) != expected_hash:
        raise ValueError("Approved original source hash mismatch")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = set(bpy.data.objects) - before
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise ValueError("Source contains no imported meshes")
    root = bpy.data.objects["Calibrated_Model_Root"]
    collection = bpy.data.collections.new("TC_Source_Unpartitioned")
    bpy.data.collections["TC_Master_Architecture"].children.link(collection)
    for obj in imported:
        for previous in list(obj.users_collection):
            previous.objects.unlink(obj)
        collection.objects.link(obj)
        if obj.parent not in imported:
            # The importer already converted glTF Y-up to Blender Z-up.
            # Preserve the imported local basis; apply the calibrated root once.
            local_basis = obj.matrix_basis.copy()
            obj.parent = root
            obj.matrix_parent_inverse = Matrix.Identity(4)
            obj.matrix_basis = local_basis
    bpy.context.view_layer.update()
    bpy.context.scene["verified_source_sha256"] = expected_hash
    bpy.context.scene["status"] = "private source imported; semantic partitioning and state art pending"
    inventory = [{"object": obj.name, "vertices": len(obj.data.vertices),
                  "polygons": len(obj.data.polygons), "materials": [material.name if material else None for material in obj.data.materials],
                  "semanticPartAssigned": False} for obj in sorted(meshes, key=lambda obj: obj.name)]
    if sha256(source) != expected_hash:
        raise ValueError("Original source changed during import")
    return inventory



def mesh_digest(mesh):
    coordinates = [tuple(round(v, 8) for v in vertex.co) for vertex in mesh.vertices]
    return hashlib.sha256(json.dumps(coordinates).encode()).hexdigest()


def derive_states(objects, recipe):
    import bpy
    from mathutils import Matrix, Vector

    validate_recipe(recipe, objects)
    originals = {name: mesh_digest(obj.data) for name, obj in objects.items()}
    derived = {}
    for state in STATES:
        collection = bpy.data.collections["TC_" + state.title()]
        if collection.objects:
            raise ValueError("State collections must be empty for a new derivation")
        state_objects = {}
        for name in recipe[state]["include"]:
            source = objects[name]
            obj = source.copy()
            obj.name = "TC_" + state + "__" + name
            obj.animation_data_clear()
            collection.objects.link(obj)
            edit = recipe[state].get("edits", {}).get(name)
            if edit:
                obj.data = source.data.copy()
                if "mesh_scale" in edit:
                    for vertex in obj.data.vertices:
                        vertex.co = Vector([vertex.co[i] * edit["mesh_scale"][i] for i in range(3)])
                matrix = Matrix.Rotation(math.radians(edit.get("rotate_world_z_degrees", 0)), 4, "Z") @ source.matrix_world
                matrix.translation = source.matrix_world.translation + Vector(edit.get("offset_world", [0, 0, 0]))
                obj.matrix_world = matrix
            state_objects[name] = obj
        collection["status"] = "derived from explicit semantic part recipe"
        derived[state] = state_objects
    bpy.context.view_layer.update()
    if originals != {name: mesh_digest(obj.data) for name, obj in objects.items()}:
        raise ValueError("Derivation mutated master mesh data")
    return derived


def select_state(state):
    import bpy

    def walk(layer):
        yield layer
        for child in layer.children:
            yield from walk(child)
    for layer in walk(bpy.context.view_layer.layer_collection):
        name = layer.collection.name
        if name in ("TC_Master_Architecture", "TC_Team_Mask_Only"):
            layer.exclude = True
        if name.startswith("TC_") and name[3:].lower() in STATES:
            layer.exclude = name != "TC_" + state.title()
    bpy.context.view_layer.update()


def light_fixture():
    import bpy
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Synthetic_Fixture_World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.65, .71, .78, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .7
    scene.world = world
    data = bpy.data.lights.new("Synthetic_Fixture_Key", "AREA")
    data.energy = 950
    data.shape = "DISK"
    data.size = 5
    obj = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(obj)
    obj.location = (-4, -5, 8)
    obj.rotation_euler = (-obj.location).to_track_quat("-Z", "Y").to_euler()


def mask_material():
    import bpy
    material = bpy.data.materials.new("Semantic_Owner_Mask_Linear")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    info = nodes.new("ShaderNodeObjectInfo")
    emission = nodes.new("ShaderNodeEmission")
    output = nodes.new("ShaderNodeOutputMaterial")
    material.node_tree.links.new(info.outputs["Color"], emission.inputs["Color"])
    material.node_tree.links.new(emission.outputs[0], output.inputs["Surface"])
    return material


def encode_runtime_mask(path):
    """Convert the occlusion-preserving grayscale pass to alpha owner coverage.

    captured-building-art.mjs uses Canvas destination-in, which reads alpha,
    not RGB luminance. Keep neutral geometry opaque during the render so it
    occludes hidden owner cues, then make that neutral coverage transparent.
    """
    import array
    import bpy

    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        image.colorspace_settings.name = "Non-Color"
        image.alpha_mode = "STRAIGHT"
        pixels = array.array("f", [0]) * (len(image.pixels))
        image.pixels.foreach_get(pixels)
        for index in range(0, len(pixels), 4):
            coverage = max(0, min(1, pixels[index] * pixels[index + 3]))
            value = 1 if coverage > 0 else 0
            pixels[index] = pixels[index + 1] = pixels[index + 2] = value
            pixels[index + 3] = coverage
        image.pixels.foreach_set(pixels)
        image.filepath_raw = str(path)
        image.file_format = "PNG"
        image.save()
    finally:
        bpy.data.images.remove(image)


def validate_capture_scene():
    import bpy
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Matrix, Vector

    scene = bpy.context.scene
    if (scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage) != (1024, 1024, 100):
        raise ValueError("Scene resolution differs from the capture contract")
    root = bpy.data.objects.get("Calibrated_Model_Root")
    scale = 2.3568558172774785
    expected_root = Matrix.Translation(Vector((.018453001976013184 * scale,
                                               -.0013000071048736572 * scale,
                                               .8103489875793457 * scale))) @ Matrix.Diagonal((scale, scale, scale, 1))
    bpy.context.view_layer.update()
    if root is None or max(abs(root.matrix_world[i][j] - expected_root[i][j]) for i in range(4) for j in range(4)) > 1e-5:
        raise ValueError("Model root registration changed")
    errors = []
    for index in range(8):
        camera = bpy.data.objects.get(f"Camera_View_{index:02d}")
        if camera is None or camera.type != "CAMERA":
            raise ValueError("All eight scaffold cameras are required")
        if camera.data.type != "ORTHO" or abs(camera.data.ortho_scale - 8) > 1e-6:
            raise ValueError("Orthographic camera span changed")
        if camera.get("azimuthDegrees") != index * 45:
            raise ValueError("Camera direction mapping changed")
        bpy.context.view_layer.update()
        azimuth, elevation = math.radians(index * 45), math.radians(46)
        target = Vector((0, 0, 8 * .19))
        position = target + Vector((math.sin(azimuth) * 20 * math.cos(elevation),
                                    -math.cos(azimuth) * 20 * math.cos(elevation),
                                    20 * math.sin(elevation)))
        expected_camera = (target - position).to_track_quat("-Z", "Y").to_matrix().to_4x4()
        expected_camera.translation = position
        if max(abs(camera.matrix_world[i][j] - expected_camera[i][j]) for i in range(4) for j in range(4)) > 1e-5:
            raise ValueError("Camera transform registration changed")
        projected = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
        error = max(abs(projected.x * 1024 - 512), abs((1 - projected.y) * 1024 - 647.1527325565025))
        if error > .001:
            raise ValueError("Camera ground-anchor registration changed")
        errors.append(error)
    for state in STATES:
        if bpy.data.collections.get("TC_" + state.title()) is None:
            raise ValueError("All five scaffold state collections are required")
    return errors



def render(output, derived, synthetic):
    import bpy
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = False
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.seed = 42
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 8
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    mask = mask_material()
    entries = []
    prefix = "synthetic" if synthetic else "authored"
    for state in STATES:
        select_state(state)
        views = []
        for index in range(8):
            scene.camera = bpy.data.objects[f"Camera_View_{index:02d}"]
            color_path = output / f"{prefix}-{state}-view-{index:02d}.png"
            mask_path = output / f"{prefix}-{state}-mask-{index:02d}.png"
            bpy.context.view_layer.material_override = None
            scene.view_settings.view_transform = "Standard"
            scene.render.filepath = str(color_path)
            bpy.ops.render.render(write_still=True)
            bpy.context.view_layer.material_override = mask
            scene.view_settings.view_transform = "Raw"
            scene.render.filepath = str(mask_path)
            bpy.ops.render.render(write_still=True)
            encode_runtime_mask(mask_path)
            views.append({"index": index, "azimuthDegrees": index * 45,
                          "path": color_path.name, "sha256": sha256(color_path),
                          "teamMaskPath": mask_path.name, "teamMaskSha256": sha256(mask_path)})
        entries.append({"state": state, "views": views})
    bpy.context.view_layer.material_override = None
    scene.view_settings.view_transform = "Standard"
    select_state("complete")
    scene.camera = bpy.data.objects["Camera_View_01"]
    manifest = {
        "schema": "thousand-unit-skirmish.building-lifecycle-reference.v1",
        "asset": "synthetic-town-center-fixture" if synthetic else "frontier-town-center-authoring-candidate",
        "status": "SYNTHETIC TEST FIXTURE; not runtime art" if synthetic else "authored candidate; art review required",
        "syntheticFixture": synthetic, "runtimeAdoption": False,
        "teamMaskEncoding": "rgba-white-owner-alpha-coverage",
        "camera": {"projection": "orthographic", "framePixels": [1024, 1024],
                   "pixelsPerWorldUnit": 128, "elevationDegrees": 46,
                   "azimuthDegrees": [i * 45 for i in range(8)],
                   "anchorPixelFromTopLeft": [512, 647.1527325565025]},
        "stateOrder": list(STATES),
        "completeState": next(e for e in entries if e["state"] == "complete"),
        "states": [e for e in entries if e["state"] != "complete"],
        "mapping": {"construction": {"foundationAtOrBelow": .275},
                    "health": {"criticalAtOrBelow": .3, "damagedAtOrBelow": .6}},
    }
    (output / "renderer-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main():
    import bpy

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--fixture", action="store_true")
    mode.add_argument("--import-source", type=Path)
    mode.add_argument("--authored-blend", type=Path)
    parser.add_argument("--source-glb", type=Path)
    parser.add_argument("--recipe", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    output = new_output(args.output_dir)
    if args.import_source:
        if args.source_glb or args.recipe:
            raise ValueError("Import mode does not derive lifecycle states")
        if sha256(args.import_source) != EXPECTED_SHA256:
            raise ValueError("Approved original source hash mismatch")
    elif args.authored_blend:
        if not args.source_glb or not args.recipe:
            raise ValueError("Real capture requires source GLB and semantic recipe")
        if sha256(args.source_glb) != EXPECTED_SHA256:
            raise ValueError("Approved original source hash mismatch")
        if not args.authored_blend.is_file():
            raise FileNotFoundError("Authored master .blend missing")
    elif args.source_glb or args.recipe:
        raise ValueError("Fixture mode cannot claim a real source")
    output.mkdir(parents=True)
    if args.import_source:
        prepare_scaffold(output)
        inventory = import_verified_source(args.import_source)
        camera_errors = validate_capture_scene()
        bpy.ops.wm.save_as_mainfile(filepath=str(output / "imported-source.blend"))
        report = {"status": "private source imported; semantic partitioning and state art pending",
                  "sourceGeometryImported": True, "sourceSha256Verified": EXPECTED_SHA256,
                  "sourceBytes": args.import_source.stat().st_size, "sourceOriginalUnchanged": True,
                  "lifecycleArtProduced": False, "teamMasksProduced": False,
                  "lightingParityVerified": False, "runtimeAdoption": False,
                  "maximumAnchorErrorPixels": max(camera_errors), "meshInventory": inventory,
                  "blendSha256": sha256(output / "imported-source.blend"),
                  "automationSha256": sha256(__file__), "additionalMeshyCredits": 0}
        (output / "import-report.json").write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps({"status": report["status"], "meshCount": len(inventory)}))
        return
    if args.fixture:
        prepare_scaffold(output)
        objects, recipe = fixture()
        light_fixture()
        source_evidence = {"kind": "synthetic procedural fixture", "realSourceImported": False}
    else:
        bpy.ops.wm.open_mainfile(filepath=str(args.authored_blend))
        if bpy.context.scene.get("verified_source_sha256") != EXPECTED_SHA256:
            raise ValueError("Authored scene must record verified source provenance")
        objects = {obj["semantic_part"]: obj for obj in bpy.data.collections["TC_Master_Architecture"].all_objects
                   if obj.type == "MESH" and obj.get("semantic_part")}
        if len(objects) != len([obj for obj in bpy.data.collections["TC_Master_Architecture"].all_objects
                               if obj.type == "MESH" and obj.get("semantic_part")]):
            raise ValueError("Semantic part IDs must be unique")
        recipe = validate_recipe(json.loads(args.recipe.read_text()), objects)
        for obj in objects.values():
            obj.color = (1, 1, 1, 1) if obj.get("team_mask", False) else (0, 0, 0, 1)
        source_evidence = {"kind": "authored candidate", "sourceSha256Verified": EXPECTED_SHA256,
                           "masterSha256": sha256(args.authored_blend), "artAccepted": False}
    camera_errors = validate_capture_scene()
    derived = derive_states(objects, recipe)
    (output / "recipe.json").write_text(json.dumps(recipe, indent=2) + "\n")
    manifest = render(output, derived, args.fixture)
    bpy.context.scene["status"] = manifest["status"]
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "editable-master.blend"))
    report = {"schema": "thousand-unit-skirmish.lifecycle-authoring-run.v1",
              "status": manifest["status"], "blenderVersion": bpy.app.version_string,
              "source": source_evidence,
              "upstreamScaffold": {"originPR": 40, "script": "scripts/prepare-frontier-town-center-blender.py", "sha256": SCAFFOLD_SHA256},
              "logicalColorFrames": 40, "logicalMaskFrames": 40,
              "masterMeshUnchangedDuringDerivation": True,
              "maximumAnchorErrorPixels": max(camera_errors),
              "automationSha256": sha256(__file__),
              "derivedPartCounts": {state: len(derived[state]) for state in STATES},
              "stateMembership": {state: list(derived[state]) for state in STATES},
              "blendSha256": sha256(output / "editable-master.blend"),
              "rendererManifestSha256": sha256(output / "renderer-manifest.json"),
              "runtimeAdoption": False, "additionalMeshyCredits": 0}
    (output / "run-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "colorFrames": 40, "maskFrames": 40}))


if __name__ == "__main__":
    main()
