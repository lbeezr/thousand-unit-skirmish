"""Behavioral checks for authoring; run in Blender without rendering."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

import bpy

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("authoring", HERE / "author-frontier-town-center-lifecycle.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AuthoringBehavior(unittest.TestCase):
    def test_recipe_rejects_missing_and_unknown_parts(self):
        recipe = {state: {"include": ["base"]} for state in module.STATES}
        missing = dict(recipe)
        del missing["frame"]
        with self.assertRaisesRegex(ValueError, "all five"):
            module.validate_recipe(missing, ["base"])
        recipe["frame"] = {"include": ["unknown"]}
        with self.assertRaisesRegex(ValueError, "unknown"):
            module.validate_recipe(recipe, ["base"])

    def test_complete_and_edits_are_constrained(self):
        recipe = {state: {"include": ["base"]} for state in module.STATES}
        recipe["complete"]["edits"] = {"base": {"mesh_scale": [1, 1, .5]}}
        with self.assertRaisesRegex(ValueError, "preserve"):
            module.validate_recipe(recipe, ["base"])
        recipe["complete"].pop("edits")
        recipe["damaged"]["edits"] = {"other": {"mesh_scale": [1, 1, .5]}}
        with self.assertRaisesRegex(ValueError, "included"):
            module.validate_recipe(recipe, ["base"])

    def test_paths_preserve_existing_and_public_outputs(self):
        with tempfile.TemporaryDirectory() as folder:
            sentinel = Path(folder) / "keep.txt"
            sentinel.write_text("unchanged")
            with self.assertRaises(FileExistsError):
                module.new_output(Path(folder))
            self.assertEqual(sentinel.read_text(), "unchanged")
        with self.assertRaisesRegex(ValueError, "public"):
            module.new_output(HERE.parent / "synthetic-pilot-output")
        with self.assertRaisesRegex(ValueError, "absolute"):
            module.new_output(Path("relative-output"))

    def test_wrong_source_fails_before_any_output(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            source = folder / "wrong.glb"
            source.write_bytes(b"not the approved source")
            blend = folder / "authored.blend"
            blend.write_bytes(b"not a Blender scene")
            recipe = folder / "recipe.json"
            recipe.write_text("{}")
            output = folder / "must-not-exist"
            prior = sys.argv[:]
            try:
                sys.argv = ["test", "--", "--output-dir", str(output), "--authored-blend", str(blend),
                            "--source-glb", str(source), "--recipe", str(recipe)]
                with self.assertRaisesRegex(ValueError, "hash mismatch"):
                    module.main()
            finally:
                sys.argv = prior
            self.assertFalse(output.exists())
            self.assertEqual(blend.read_bytes(), b"not a Blender scene")

    def test_derived_states_share_only_intact_meshes_and_keep_registration(self):
        with tempfile.TemporaryDirectory() as folder:
            module.prepare_scaffold(Path(folder))
            objects, recipe = module.fixture()
            roof = objects["Roof_West_Back"]
            before = [tuple(v.co) for v in roof.data.vertices]
            derived = module.derive_states(objects, recipe)
            self.assertEqual(before, [tuple(v.co) for v in roof.data.vertices])
            self.assertIs(derived["complete"]["Foundation_Slab"].data, derived["frame"]["Foundation_Slab"].data)
            self.assertIs(derived["complete"]["Roof_West_Back"].data, roof.data)
            self.assertIsNot(derived["damaged"]["Roof_West_Back"].data, roof.data)
            self.assertNotEqual(before, [tuple(v.co) for v in derived["damaged"]["Roof_West_Back"].data.vertices])
            anchor = derived["complete"]["Foundation_Slab"].matrix_world
            for state in module.STATES:
                current = derived[state]["Foundation_Slab"].matrix_world
                self.assertLess(max(abs(anchor[i][j] - current[i][j]) for i in range(4) for j in range(4)), 1e-6)
            module.select_state("critical")
            included = set(bpy.context.view_layer.objects.keys())
            self.assertIn(derived["critical"]["Foundation_Slab"].name, included)
            self.assertNotIn(derived["complete"]["Foundation_Slab"].name, included)
            self.assertNotIn(objects["Foundation_Slab"].name, included)
            module.select_state("complete")
            self.assertIn(derived["complete"]["Roof_East_Back"].name, bpy.context.view_layer.objects)

    def test_glb_import_keeps_original_and_applies_calibration_once(self):
        from mathutils import Vector
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, .5))
            bpy.context.object.name = "Synthetic_Native_Cube"
            source = folder / "synthetic-native-cube.glb"
            bpy.ops.export_scene.gltf(filepath=str(source), export_format="GLB", use_selection=True)
            before = source.read_bytes()
            expected = module.sha256(source)
            module.prepare_scaffold(folder)
            inventory = module.import_verified_source(source, expected_hash=expected)
            self.assertEqual(len(inventory), 1)
            self.assertFalse(inventory[0]["semanticPartAssigned"])
            obj = bpy.data.objects["Synthetic_Native_Cube"]
            root = bpy.data.objects["Calibrated_Model_Root"]
            self.assertIs(obj.parent, root)
            expected_center = root.matrix_world @ Vector((0, 0, .5))
            self.assertLess((obj.matrix_world.translation - expected_center).length, 1e-5)
            self.assertEqual(source.read_bytes(), before)
            self.assertEqual(bpy.context.scene["verified_source_sha256"], expected)

    def test_scene_rejects_resolution_and_camera_registration_drift(self):
        with tempfile.TemporaryDirectory() as folder:
            module.prepare_scaffold(Path(folder))
            self.assertLess(max(module.validate_capture_scene()), .001)
            bpy.context.scene.render.resolution_percentage = 50
            with self.assertRaisesRegex(ValueError, "resolution"):
                module.validate_capture_scene()
            bpy.context.scene.render.resolution_percentage = 100
            bpy.data.objects["Camera_View_03"].location.z += .1
            with self.assertRaisesRegex(ValueError, "registration"):
                module.validate_capture_scene()
            bpy.data.objects["Camera_View_03"].location.z -= .1
            camera = bpy.data.objects["Camera_View_03"]
            original = camera.matrix_world.copy()
            camera.matrix_world = bpy.data.objects["Camera_View_04"].matrix_world.copy()
            # A different azimuth still projects the ground to the same anchor.
            # The camera label cannot substitute for the actual view transform.
            with self.assertRaisesRegex(ValueError, "Camera transform registration"):
                module.validate_capture_scene()
            camera.matrix_world = original
            bpy.data.objects["Calibrated_Model_Root"].location.x += .1
            with self.assertRaisesRegex(ValueError, "root registration"):
                module.validate_capture_scene()

    def test_masks_use_semantic_selection_not_ochre(self):
        with tempfile.TemporaryDirectory() as folder:
            module.prepare_scaffold(Path(folder))
            objects, recipe = module.fixture()
            derived = module.derive_states(objects, recipe)
            for state in module.STATES:
                self.assertEqual(tuple(derived[state]["Banner_Cloth"].color), (1, 1, 1, 1))
            self.assertEqual(tuple(derived["complete"]["Neutral_Ochre_Prop"].color), (0, 0, 0, 1))
            self.assertFalse(derived["complete"]["Neutral_Ochre_Prop"]["team_mask"])

    def test_runtime_mask_uses_owner_alpha_and_keeps_neutral_transparent(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "mask.png"
            image = bpy.data.images.new("Synthetic_Mask_Protocol", width=3, height=1, alpha=True)
            image.colorspace_settings.name = "Non-Color"
            image.alpha_mode = "STRAIGHT"
            image.pixels[:] = [0, 0, 0, 1, 1, 1, 1, 1, .5, .5, .5, .4]
            image.filepath_raw = str(path)
            image.file_format = "PNG"
            image.save()
            bpy.data.images.remove(image)
            module.encode_runtime_mask(path)
            result = bpy.data.images.load(str(path), check_existing=False)
            result.colorspace_settings.name = "Non-Color"
            result.alpha_mode = "STRAIGHT"
            values = list(result.pixels)
            bpy.data.images.remove(result)
            self.assertAlmostEqual(values[3], 0, delta=2 / 255)
            self.assertAlmostEqual(values[7], 1, delta=2 / 255)
            self.assertAlmostEqual(values[11], .2, delta=2 / 255)
            self.assertEqual(values[4:7], [1, 1, 1])
            self.assertEqual(values[8:11], [1, 1, 1])


suite = unittest.defaultTestLoader.loadTestsFromTestCase(AuthoringBehavior)
result = unittest.TextTestRunner(verbosity=2).run(suite)
if not result.wasSuccessful():
    raise RuntimeError("Lifecycle authoring checks failed")
print(json.dumps({"testsRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors)}))
