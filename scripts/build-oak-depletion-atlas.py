"""Build/check the normal three-state oak atlas from existing public source art."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

from PIL import Image, ImageChops, __version__ as PILLOW_VERSION

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("oak_sources", Path(__file__).with_name("prepare-oak-fallback-atlas.py"))
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
ROOT = source.ROOT
PACK = Path("assets/environment/frontier-oak-depletion-atlas-v1")
STATES = ("worked", "low", "depleted")
CELL = (1312, 1376)
SIZE = (3936, 1376)


def metrics(reference, decoded):
    if reference.size != decoded.size or ImageChops.difference(reference.getchannel("A"), decoded.getchannel("A")).getbbox():
        raise ValueError("decoded dimensions/alpha differ from isolated source filtering")
    error = weight = 0
    pixels = lambda image: image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
    for a, b in zip(pixels(reference), pixels(decoded)):
        w = a[3] ** 2
        error += sum((a[c] - b[c]) ** 2 for c in range(3)) * w
        weight += w * 3
    return round(math.sqrt(error / weight), 6)


def inputs(root):
    sources, records, binding = source.source_inputs(root)
    frames = []
    for i, record in enumerate(records[1:]):
        x, y, w, h = i * CELL[0] + 32, 32, 1226, 1283
        frames.append({**record, "rectPx": {"x": x, "y": y, "width": w, "height": h},
                       "uvRectTopLeft": {"min": {"u": (x + .5) / SIZE[0], "v": (y + .5) / SIZE[1]},
                                         "max": {"u": (x + w - .5) / SIZE[0], "v": (y + h - .5) / SIZE[1]}}})
    base = {"schemaVersion": 1, "packId": "frontier-oak-depletion-atlas-v1", "packVersion": "1.0.0",
            "sourceBindings": binding, "frames": frames,
            "page": {"dimensionsPx": {"width": SIZE[0], "height": SIZE[1]},
                     "cellPx": {"width": CELL[0], "height": CELL[1]}, "layout": [3, 1],
                     "gutterPx": 32, "gutterRule": "edge-rgb-transparent-alpha", "colorSpace": "srgb",
                     "alphaMode": "straight", "wrapMode": "clamp",
                     "sampling": {"generateMipmaps": False, "maxMipLevel": 5, "uvInsetPx": .5,
                                  "minFilter": "linear-mipmap-linear", "magFilter": "linear", "anisotropy": 1}},
            "provenance": {"source": "Existing public oak candidate/interactive full-cutout source PNG pixels",
                           "encoding": "WebP quality 86, method 6; alpha unchanged; independent premultiplied BOX cell mips",
                           "pillowVersion": PILLOW_VERSION}}
    return sources[1:], base


def images(sources):
    cells = [source.padded_cell(image, CELL, pad=32) for image in sources]
    for level in range(6):
        size = tuple(value // 2 ** level for value in CELL)
        page = Image.new("RGBA", (size[0] * 3, size[1]))
        for i, cell in enumerate(cells):
            part = cell if level == 0 else cell.resize(size, Image.Resampling.BOX)
            page.paste(part, (i * size[0], 0))
        yield level, page


def prepare(root=ROOT, write=False, overwrite=False):
    root = Path(root)
    sources, expected = inputs(root)
    pack = root / PACK
    manifest_path = pack / "manifest.json"
    paths = [pack / f"oak-depletion-mip-{level}.webp" for level in range(6)]
    if write:
        if not overwrite and any(p.exists() for p in [manifest_path, *paths]):
            raise ValueError("production export exists; use --overwrite to replace only its manifest/six mips")
        pack.mkdir(parents=True, exist_ok=True)
        files = []
        for level, image in images(sources):
            path = paths[level]
            image.save(path, "WEBP", quality=86, method=6, exact=True)
            with Image.open(path) as encoded:
                rmse = metrics(image, encoded.convert("RGBA"))
            files.append({"level": level, "path": path.name, "usage": "runtime", "format": "webp",
                          "sha256": source.sha(path), "dimensionsPx": {"width": image.width, "height": image.height},
                          "bytes": path.stat().st_size, "alphaWeightedRgbRmse": rmse})
        manifest_path.write_text(json.dumps({**expected, "files": files}, indent=2) + "\n")
    actual = json.loads(manifest_path.read_text())
    expected["provenance"]["pillowVersion"] = actual["provenance"]["pillowVersion"]
    if {k: v for k, v in actual.items() if k != "files"} != expected or len(actual["files"]) != 6:
        raise ValueError("production source/registration/layout/sampling contract differs")
    decoded_bytes = 0
    for (level, reference), entry in zip(images(sources), actual["files"]):
        path = paths[level]
        if (entry["level"] != level or entry["path"] != path.name or entry["usage"] != "runtime"
                or entry["format"] != "webp" or path.is_symlink() or source.sha(path) != entry["sha256"]
                or entry["bytes"] != path.stat().st_size
                or entry["dimensionsPx"] != {"width": reference.width, "height": reference.height}):
            raise ValueError(f"mip {level} runtime identity/hash/dimensions differ")
        with Image.open(path) as encoded:
            if encoded.format != "WEBP":
                raise ValueError("WebP runtime required")
            rmse = metrics(reference, encoded.convert("RGBA"))
        if rmse != entry["alphaWeightedRgbRmse"] or rmse > 10:
            raise ValueError(f"mip {level} decoded RGB error differs from recorded source comparison")
        decoded_bytes += reference.width * reference.height * 4
    return {"manifestSha256": source.sha(manifest_path), "framesVerified": list(STATES), "mipsVerified": 6,
            "alphaUnchanged": True, "encodedBytes": sum(f["bytes"] for f in actual["files"]),
            "decodedRgbaBytes": decoded_bytes, "decodedMiB": decoded_bytes / 1048576,
            "gpuAppearance": "not established by offline validation"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if args.overwrite and not args.write:
        parser.error("--overwrite requires --write")
    print(json.dumps(prepare(write=args.write, overwrite=args.overwrite), indent=2))
