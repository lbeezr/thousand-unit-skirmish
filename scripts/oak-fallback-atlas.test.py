"""Check actual exports and reject byte-correct contract/pixel corruption."""
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

from PIL import Image

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("oak_export", Path(__file__).with_name("prepare-oak-fallback-atlas.py"))
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)


class OakExportTests(unittest.TestCase):
    def fixture(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        paths = [export.PACK / "manifest.json", export.PACK / "pages/oak-fallback.png",
                 export.PACK / export.CONTRACT, export.INTERACTIVE / "manifest.json"]
        paths += [export.INTERACTIVE / f"oak-{state}.png" for state in export.STATES]
        paths += [export.PACK / f"runtime/oak-fallback-mip-{level}.webp" for level in range(6)]
        for relative in paths:
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(export.ROOT / relative, destination)
        return root

    def test_actual_export_keeps_four_states_and_unbound_status(self):
        report = export.prepare()
        self.assertEqual(report["framesVerified"], list(export.STATES))
        self.assertEqual(report["mipLevelsVerified"], 6)
        self.assertEqual(report["dimensionsPx"], [2752, 2880])
        self.assertFalse(report["defaultBound"])

    def test_updated_digest_cannot_hide_rgb_only_mip_corruption(self):
        root = self.fixture()
        path = root / export.PACK / "runtime/oak-fallback-mip-5.webp"
        with Image.open(path) as source:
            image = source.convert("RGBA")
        # A visible sample, changing RGB while preserving alpha.
        pixel = next((x, y) for y in range(image.height) for x in range(image.width)
                     if image.getpixel((x, y))[3] > 100)
        red, green, blue, alpha = image.getpixel(pixel)
        image.putpixel(pixel, ((red + 37) % 256, green, blue, alpha))
        image.save(path, "WEBP", lossless=True, exact=True)
        contract_path = root / export.PACK / export.CONTRACT
        contract = json.loads(contract_path.read_text())
        contract["mipFiles"][5].update(sha256=export.sha(path), bytes=path.stat().st_size)
        contract_path.write_text(json.dumps(contract))
        with self.assertRaisesRegex(ValueError, "decoded pixels differ"):
            export.prepare(root)

    def test_registration_uv_and_lod_contract_drift_is_rejected(self):
        root = self.fixture()
        path = root / export.PACK / export.CONTRACT
        original = path.read_text()
        for mutate in (
            lambda data: data["frames"][0]["groundPivotPx"].update(y=1282),
            lambda data: data["frames"][1]["worldSize"].update(height=3.74),
            lambda data: data["frames"][2]["uvRectTopLeft"]["min"].__setitem__(0, 0),
            lambda data: data["page"]["sampling"].update(consumerMustCapLod=False),
        ):
            with self.subTest(mutate=mutate):
                data = json.loads(original)
                mutate(data)
                path.write_text(json.dumps(data))
                with self.assertRaisesRegex(ValueError, "contract differs"):
                    export.prepare(root)

    def test_missing_mip_and_accidental_overwrite_are_rejected(self):
        root = self.fixture()
        with self.assertRaisesRegex(ValueError, "export exists"):
            export.prepare(root, write=True)
        path = root / export.PACK / export.CONTRACT
        data = json.loads(path.read_text())
        data["mipFiles"].pop()
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "six authored mip"):
            export.prepare(root)


if __name__ == "__main__":
    unittest.main()
