"""Failure-injection checks for decoded mask coverage and provenance."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("pixels", HERE / "verify-building-lifecycle-pixels.py")
pixels = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pixels)


def small_pack(folder):
    order = ["foundation", "frame", "complete", "damaged", "critical"]
    entries = []
    for state_index, state in enumerate(order):
        views = []
        for view_index in range(8):
            color = np.zeros((32, 32, 4), dtype=np.uint8)
            color[8:24, 8:24] = (30 + state_index * 35, 60, 80, 255)
            mask = np.zeros((32, 32, 4), dtype=np.uint8)
            mask[10:14, 10:14] = 255
            color_path = folder / f"{state}-{view_index}.png"
            mask_path = folder / f"{state}-{view_index}-mask.png"
            Image.fromarray(color).save(color_path)
            Image.fromarray(mask).save(mask_path)
            views.append({"index": view_index, "path": color_path.name, "sha256": pixels.digest(color_path),
                          "teamMaskPath": mask_path.name, "teamMaskSha256": pixels.digest(mask_path)})
        entries.append({"state": state, "views": views})
    manifest = {"syntheticFixture": True, "runtimeAdoption": False,
                "camera": {"framePixels": [32, 32]}, "stateOrder": order,
                "completeState": entries[2], "states": [entry for entry in entries if entry["state"] != "complete"]}
    (folder / "renderer-manifest.json").write_text(json.dumps(manifest))
    return manifest


def mutate_mask(folder, manifest, change, update_hash=True):
    view = manifest["completeState"]["views"][0]
    path = folder / view["teamMaskPath"]
    with Image.open(path) as image:
        array = np.array(image.convert("RGBA"))
    change(array)
    Image.fromarray(array).save(path)
    if update_hash:
        view["teamMaskSha256"] = pixels.digest(path)
        (folder / "renderer-manifest.json").write_text(json.dumps(manifest))


class PixelFailures(unittest.TestCase):
    def test_occluded_view_can_have_zero_mask_but_state_must_have_visible_cue(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            manifest = small_pack(folder)
            mutate_mask(folder, manifest, lambda a: a.fill(0))
            report = pixels.inspect(folder)
            self.assertEqual(report["decodedPairs"], 40)
            self.assertEqual(report["fullyOccludedMaskViews"], 1)
            for view in manifest["completeState"]["views"]:
                path = folder / view["teamMaskPath"]
                with Image.open(path) as image:
                    array = np.array(image.convert("RGBA"))
                array[:] = 0
                Image.fromarray(array).save(path)
                view["teamMaskSha256"] = pixels.digest(path)
            (folder / "renderer-manifest.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "every direction"):
                pixels.inspect(folder)

    def test_hash_tampering_is_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            manifest = small_pack(folder)
            mutate_mask(folder, manifest, lambda a: a.__setitem__((10, 10, 0), 120), update_hash=False)
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                pixels.inspect(folder)

    def test_non_grayscale_mask_is_detected_even_with_updated_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            manifest = small_pack(folder)
            mutate_mask(folder, manifest, lambda a: a.__setitem__((10, 10, 0), 120))
            with self.assertRaisesRegex(ValueError, "grayscale"):
                pixels.inspect(folder)

    def test_excess_alpha_and_mask_outside_color_are_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            manifest = small_pack(folder)
            view = manifest["completeState"]["views"][0]
            path = folder / view["path"]
            with Image.open(path) as image:
                color = np.array(image.convert("RGBA"))
            color[10, 10, 3] = 100
            Image.fromarray(color).save(path)
            view["sha256"] = pixels.digest(path)
            (folder / "renderer-manifest.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "coverage mismatch"):
                pixels.inspect(folder)
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            manifest = small_pack(folder)
            mutate_mask(folder, manifest, lambda a: a.__setitem__((0, 0), (255, 255, 255, 255)))
            with self.assertRaisesRegex(ValueError, "coverage mismatch"):
                pixels.inspect(folder)

    def test_rgb_black_neutral_with_building_alpha_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            manifest = small_pack(folder)
            mutate_mask(folder, manifest, lambda a: a.__setitem__((8, 8), (0, 0, 0, 255)))
            with self.assertRaisesRegex(ValueError, "alpha owner coverage"):
                pixels.inspect(folder)

    def test_canvas_alpha_composition_changes_owner_cue_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            manifest = small_pack(folder)
            view = manifest["completeState"]["views"][0]
            color = Image.open(folder / view["path"]).convert("RGBA")
            mask = Image.open(folder / view["teamMaskPath"]).convert("RGBA")
            # Canvas destination-in uses only source alpha, then source-over
            # composites the team overlay at the runtime's globalAlpha .86.
            overlay = Image.new("RGBA", color.size, (220, 40, 20, 255))
            overlay.putalpha(mask.getchannel("A").point(lambda a: round(a * .86)))
            composed = Image.alpha_composite(color, overlay)
            self.assertEqual(composed.getpixel((8, 8)), color.getpixel((8, 8)))
            self.assertNotEqual(composed.getpixel((11, 11)), color.getpixel((11, 11)))
            self.assertEqual(composed.getpixel((0, 0)), color.getpixel((0, 0)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
