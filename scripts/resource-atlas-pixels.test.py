"""Failure injection for the committed source-page pixel audit, not art generation."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

from PIL import Image

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location("resource_pixels", Path(__file__).with_name("inspect-resource-atlas-pixels.py"))
pixels = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pixels)


def fixture(root):
    pack, sources = root / pixels.PACK_PATH, root / pixels.SOURCE_PATH
    (pack / "pages").mkdir(parents=True)
    sources.mkdir(parents=True)
    manifest = {"packId": "environment.frontier-resource-atlas-candidate", "packVersion": "test-fixture",
                "maturity": "source-only", "files": [], "pages": [], "assets": []}
    lineage = {"sourceLineage": {}, "frames": {}}
    for family, layer_names in pixels.LAYERS.items():
        pages = {name: Image.new("RGBA", (16, 4)) for name in ("fallback", *layer_names)}
        frames = []
        for index, state in enumerate(pixels.STATES):
            source = Image.new("RGBA", (4, 4))
            colors = [("wood-structure", (0, 0), (30, 50, 20, 128)),
                      ("foliage-back", (1, 1), (20, 90, 30, 255))]
            if family == "berries" and state != "depleted":
                colors.append(("fruit-front", (2, 2), (180, 20, 30, 255)))
            rects = []
            for layer, (x, y), color in colors:
                source.putpixel((x, y), color)
                pages[layer].putpixel((index * 4 + x, y), color)
                rects.append({"layerId": layer, "pageId": f"{family}-{layer}",
                              "rectPx": {"x": index * 4 + x, "y": y, "width": 1, "height": 1},
                              "offsetPx": {"x": x, "y": y}})
            pages["fallback"].paste(source, (index * 4, 0))
            key = f"{family}-{state}"
            source_path = sources / f"{key}.png"
            source.save(source_path)
            lineage["sourceLineage"][key] = {"path": str(pixels.SOURCE_PATH / source_path.name),
                "sha256": pixels.digest(source_path), "dimensionsPx": {"width": 4, "height": 4}}
            alpha_bounds = {"x": 0, "y": 0, "width": 3 if len(colors) == 3 else 2,
                            "height": 3 if len(colors) == 3 else 2}
            lineage["frames"][key] = {"alphaBoundsPxThreshold96": alpha_bounds}
            frames.append({"id": state, "canvasPx": {"width": 4, "height": 4},
                           "groundPivotStatus": "unreviewed-estimate", "alphaBoundsPx": alpha_bounds,
                           "fallbackRectPx": {"pageId": f"{family}-fallback",
                               "rectPx": {"x": index * 4, "y": 0, "width": 4, "height": 4}},
                           "frameRectsPx": rects})
        manifest["assets"].append({"id": family, "frames": frames})
        for name, image in pages.items():
            page_id = f"{family}-{name}"
            path = pack / f"pages/{page_id}.png"
            image.save(path)
            manifest["files"].append({"id": page_id, "path": f"pages/{page_id}.png",
                "usage": "source", "format": "png", "sha256": pixels.digest(path),
                "dimensionsPx": {"width": 16, "height": 4}})
            manifest["pages"].append({"id": page_id, "sourceFileId": page_id})
    (pack / "manifest.json").write_text(json.dumps(manifest))
    (pack / "build-report.json").write_text(json.dumps(lineage))
    return manifest


def mutate_page(root, manifest, page_id, pixel, rgba, update_digest=True):
    path = root / pixels.PACK_PATH / f"pages/{page_id}.png"
    with Image.open(path) as image:
        changed = image.convert("RGBA")
    changed.putpixel(pixel, rgba)
    changed.save(path)
    if update_digest:
        next(file for file in manifest["files"] if file["id"] == page_id)["sha256"] = pixels.digest(path)
        (root / pixels.PACK_PATH / "manifest.json").write_text(json.dumps(manifest))


class ResourcePixelChecks(unittest.TestCase):
    def test_small_fixture_retains_straight_alpha_samples(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); fixture(root)
            self.assertEqual(len(pixels.inspect(root)["framesVerified"]), 8)

    def test_real_candidate_is_exact_but_still_not_runtime_ready(self):
        report = pixels.inspect()
        self.assertEqual(len(report["framesVerified"]), 8)
        self.assertEqual(report["sourcePagesVerified"], 7)
        self.assertEqual(len(report["unreviewedPivots"]), 8)
        self.assertFalse(report["runtimeReady"])

    def test_rgb_only_layer_edit_fails_even_with_updated_file_hash(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); manifest = fixture(root)
            mutate_page(root, manifest, "oak-wood-structure", (0, 0), (80, 50, 20, 128))
            with self.assertRaisesRegex(ValueError, "layer reconstruction.*RGBA differs"):
                pixels.inspect(root)

    def test_rgb_only_fallback_edit_cannot_replace_original_lineage(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); manifest = fixture(root)
            mutate_page(root, manifest, "berries-fallback", (0, 0), (80, 50, 20, 128))
            with self.assertRaisesRegex(ValueError, "fallback/source.*RGBA differs"):
                pixels.inspect(root)

    def test_missing_crop_offset_and_duplicate_layer_are_detected(self):
        for mutation in (lambda frame: frame["frameRectsPx"][0]["offsetPx"].update(x=1),
                         lambda frame: frame["frameRectsPx"].pop(),
                         lambda frame: frame["frameRectsPx"].append(frame["frameRectsPx"][0])):
            with tempfile.TemporaryDirectory() as temp:
                root = Path(temp); manifest = fixture(root)
                mutation(manifest["assets"][0]["frames"][0])
                (root / pixels.PACK_PATH / "manifest.json").write_text(json.dumps(manifest))
                with self.assertRaises(ValueError): pixels.inspect(root)

    def test_stale_hash_transparent_rgb_and_alpha_bounds_are_detected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); manifest = fixture(root)
            mutate_page(root, manifest, "oak-wood-structure", (0, 0), (80, 50, 20, 128), False)
            with self.assertRaisesRegex(ValueError, "hash mismatch"): pixels.inspect(root)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); manifest = fixture(root)
            mutate_page(root, manifest, "oak-fallback", (3, 3), (80, 50, 20, 0))
            with self.assertRaisesRegex(ValueError, "transparent RGB"): pixels.inspect(root)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); manifest = fixture(root)
            manifest["assets"][0]["frames"][0]["alphaBoundsPx"]["width"] = 3
            (root / pixels.PACK_PATH / "manifest.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "alpha bounds disagree"): pixels.inspect(root)

    def test_fractional_crop_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "integer crop"):
            pixels.rect_crop(Image.new("RGBA", (4, 4)), {"x": 0.5, "y": 0, "width": 1, "height": 1}, "fixture")


if __name__ == "__main__":
    unittest.main()
