import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from PIL import Image

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("production", Path(__file__).with_name("build-oak-depletion-atlas.py"))
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class ProductionPixels(unittest.TestCase):
    def fixture(self):
        temporary = tempfile.TemporaryDirectory(); self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        paths = [build.source.PACK / "manifest.json", build.source.PACK / "pages/oak-fallback.png",
                 build.source.INTERACTIVE / "manifest.json", build.PACK / "manifest.json"]
        paths += [build.source.INTERACTIVE / f"oak-{state}.png" for state in build.source.STATES]
        paths += [build.PACK / f"oak-depletion-mip-{level}.webp" for level in range(6)]
        for relative in paths:
            destination = root / relative; destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(build.ROOT / relative, destination)
        return root

    def test_actual_source_alpha_and_runtime_cost(self):
        report = build.prepare()
        self.assertTrue(report["alphaUnchanged"])
        self.assertEqual(report["encodedBytes"], 1191760)
        self.assertEqual(report["decodedRgbaBytes"], 28877940)

    def test_updated_digest_cannot_hide_changed_alpha(self):
        root = self.fixture(); path = root / build.PACK / "oak-depletion-mip-5.webp"
        with Image.open(path) as source:
            image = source.convert("RGBA")
        image.putpixel((2, 2), (255, 0, 0, 255)); image.save(path, "WEBP", lossless=True, exact=True)
        manifest_path = root / build.PACK / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["files"][5].update(sha256=build.source.sha(path), bytes=path.stat().st_size)
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, "alpha differ"):
            build.prepare(root)

    def test_layout_and_missing_levels_are_rejected(self):
        root = self.fixture(); path = root / build.PACK / "manifest.json"
        original = json.loads(path.read_text())
        for mutation in [lambda manifest: manifest["page"].update(gutterPx=0),
                         lambda manifest: manifest["files"].pop()]:
            manifest = json.loads(json.dumps(original)); mutation(manifest); path.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "contract differs"):
                build.prepare(root)


if __name__ == "__main__":
    unittest.main()
