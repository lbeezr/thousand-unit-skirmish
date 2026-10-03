"""Build/check an unbound oak fallback export from existing public source pixels."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageChops, __version__ as PILLOW_VERSION

ROOT = Path(__file__).resolve().parents[1]
PACK = Path("assets/environment/frontier-resource-atlas-v1-candidate")
INTERACTIVE = Path("assets/environment/frontier-interactive-v1")
CONTRACT = "oak-fallback-runtime.json"
STATES = ("full", "worked", "low", "depleted")
PAD = 64
MAX_MIP = 5


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def different(a, b):
    return a.size != b.size or any(c.getbbox() for c in ImageChops.difference(a, b).split())


def zero_transparent(image):
    active = image.getchannel("A").point([0] + [255] * 255)
    return Image.composite(image, Image.new("RGBA", image.size), active)


def source_inputs(root):
    candidate = root / PACK
    manifest = json.loads((candidate / "manifest.json").read_text())
    original = json.loads((root / INTERACTIVE / "manifest.json").read_text())
    oak = next(a for a in manifest["assets"] if a["id"] == "oak")
    source_page = next(f for f in manifest["files"] if f["id"] == "oak-fallback-source")
    page_path = candidate / source_page["path"]
    if source_page["path"] != "pages/oak-fallback.png" or sha(page_path) != source_page["sha256"]:
        raise ValueError("oak fallback source path/hash mismatch")
    with Image.open(page_path) as image:
        if image.format != "PNG":
            raise ValueError("oak fallback source must be PNG")
        page = image.convert("RGBA")
    records, sources = [], []
    for index, state in enumerate(STATES):
        frame = next(f for f in oak["frames"] if f["id"] == state)
        legacy = next(a for a in original["assets"] if a["id"] == f"oak-{state}")
        width, height = frame["canvasPx"]["width"], frame["canvasPx"]["height"]
        if (width, height) != (1226, 1283) or legacy["worldSize"] != {"width": 4.1, "height": 3.75}:
            raise ValueError("oak canvas/world registration changed")
        if legacy["pivot"] != [0.5, 1.0] or frame["groundPivotPx"] != {"x": width / 2, "y": height}:
            raise ValueError("oak ground registration differs from the active source")
        rect = {"x": index * width, "y": 0, "width": width, "height": height}
        if frame["fallbackRectPx"] != {"pageId": "oak-fallback", "rectPx": rect}:
            raise ValueError("oak source fallback rectangles changed")
        source_path = root / INTERACTIVE / f"oak-{state}.png"
        crop = page.crop((rect["x"], 0, rect["x"] + width, height))
        with Image.open(source_path) as image:
            if different(crop, zero_transparent(image.convert("RGBA"))):
                raise ValueError(f"oak-{state} source pixels differ")
        sources.append(crop)
        records.append({"id": state, "sourcePath": str(INTERACTIVE / f"oak-{state}.png"),
                        "sourceSha256": sha(source_path), "canvasPx": frame["canvasPx"],
                        "groundPivotPx": frame["groundPivotPx"], "worldSize": legacy["worldSize"]})
    if page.size != (1226 * 4, 1283):
        raise ValueError("oak source page dimensions changed")
    return sources, records, {"candidateManifestSha256": sha(candidate / "manifest.json"),
                             "sourcePageSha256": source_page["sha256"],
                             "interactiveManifestSha256": sha(root / INTERACTIVE / "manifest.json")}


def layout(records):
    width, height = (records[0]["canvasPx"][key] for key in ("width", "height"))
    cell = [((size + PAD * 2 + 31) // 32) * 32 for size in (width, height)]
    dimensions = [cell[0] * 2, cell[1] * 2]
    frames = []
    for index, record in enumerate(records):
        rect = {"x": index % 2 * cell[0] + PAD, "y": index // 2 * cell[1] + PAD,
                "width": width, "height": height}
        frames.append({**record, "rectPx": rect, "uvRectTopLeft": {
            "min": [(rect["x"] + 0.5) / dimensions[0], (rect["y"] + 0.5) / dimensions[1]],
            "max": [(rect["x"] + width - 0.5) / dimensions[0],
                    (rect["y"] + height - 0.5) / dimensions[1]]}})
    return cell, dimensions, frames


def padded_cell(source, dimensions, pad=PAD):
    # Extend boundary RGB into transparent padding; keep all source samples exact.
    cell = Image.new("RGBA", dimensions)
    x_spans = [(0, pad, 0, 1), (pad, pad + source.width, 0, source.width),
               (pad + source.width, dimensions[0], source.width - 1, source.width)]
    y_spans = [(0, pad, 0, 1), (pad, pad + source.height, 0, source.height),
               (pad + source.height, dimensions[1], source.height - 1, source.height)]
    for left, right, sx, ex in x_spans:
        for top, bottom, sy, ey in y_spans:
            if left == pad and top == pad:
                piece = source
            else:
                piece = source.crop((sx, sy, ex, ey)).resize((right - left, bottom - top), Image.Resampling.NEAREST)
                piece.putalpha(0)
            cell.paste(piece, (left, top))
    return cell


def mip_images(sources, cell):
    cells = [padded_cell(source, cell) for source in sources]
    for level in range(MAX_MIP + 1):
        size = [value // 2 ** level for value in cell]
        page = Image.new("RGBA", (size[0] * 2, size[1] * 2))
        for index, image in enumerate(cells):
            # Pillow's RGBA resize filters premultiplied RGB/alpha. Filter cells
            # independently so no adjacent lifecycle state enters another mip.
            resized = image if level == 0 else image.resize(size, Image.Resampling.BOX)
            page.paste(resized, (index % 2 * size[0], index // 2 * size[1]))
        yield level, page


def contract_base(records, binding):
    cell, dimensions, frames = layout(records)
    return {"schemaVersion": 1, "packId": "environment.frontier-resource-oak-fallback",
            "packVersion": "0.1.0", "status": "runtime-export-unbound", "sourceBindings": binding,
            "registration": {"basis": "inherited-active-frontier-interactive-v1",
                             "pivotConvention": "bottom-center, canvas-local pixels",
                             "geometry": "existing 4.1 x 3.75 cameraFacing plane; translate Y by height/2",
                             "visualReview": "No new pivot or scale chosen; ordinary-game acceptance pending"},
            "page": {"dimensionsPx": dimensions, "cellPx": cell, "layout": [2, 2],
                     "gutterPx": PAD, "gutterRule": "edge-rgb-transparent-alpha",
                     "sampling": {"colorSpace": "srgb", "alphaMode": "straight",
                                  "generateMipmaps": False, "maxMipLevel": MAX_MIP,
                                  "minFilter": "linear-mipmap-linear", "magFilter": "linear",
                                  "wrapMode": "clamp", "anisotropy": 1, "uvInsetPx": 0.5,
                                  "consumerMustCapLod": True}},
            "frames": frames, "direction": "one existing authored view",
            "consumerSelection": {"ordinaryGenericOakStates": ["worked", "low", "depleted"],
                                  "full": "Preserve existing default Meshy directional/full art; this full cutout applies only to meshyResources=0",
                                  "regionalWood": "Preserve existing regional profiles and state art",
                                  "failedExport": "Preserve existing individual interactive WebP fallback"},
            "drawContract": "full cutout, existing alphaTest 0.08 and depthWrite; no HSV layer sorting",
            "remaining": ["Default consumer and release admission", "Ordinary-game zoom/state/depth acceptance"],
            "provenance": {"source": "Existing public project-owned oak candidate full-cutout PNG page",
                           "command": "python3 scripts/prepare-oak-fallback-atlas.py --write",
                           "encoding": "Lossless WebP; exact hidden RGB; independent premultiplied BOX cell mips",
                           "pillowVersion": PILLOW_VERSION}}


def prepare(root=ROOT, write=False, overwrite=False):
    root = Path(root)
    sources, records, bindings = source_inputs(root)
    expected = contract_base(records, bindings)
    pack = root / PACK
    contract_path = pack / CONTRACT
    paths = [pack / f"runtime/oak-fallback-mip-{level}.webp" for level in range(MAX_MIP + 1)]
    if write:
        if not overwrite and any(path.exists() for path in [contract_path, *paths]):
            raise ValueError("export exists; --overwrite is required to replace these six files and contract")
        files = []
        for level, image in mip_images(sources, expected["page"]["cellPx"]):
            path = paths[level]
            path.parent.mkdir(parents=True, exist_ok=True)
            image.save(path, "WEBP", lossless=True, exact=True, method=6)
            files.append({"level": level, "path": str(path.relative_to(pack)), "sha256": sha(path),
                          "dimensionsPx": list(image.size), "bytes": path.stat().st_size})
        contract_path.write_text(json.dumps({**expected, "mipFiles": files}, indent=2) + "\n")
    actual = json.loads(contract_path.read_text())
    # Encoding version is provenance, not a requirement to reencode preserved bytes.
    expected["provenance"]["pillowVersion"] = actual["provenance"]["pillowVersion"]
    if {k: v for k, v in actual.items() if k != "mipFiles"} != expected:
        raise ValueError("oak export registration/layout/source/sampling contract differs")
    if len(actual["mipFiles"]) != MAX_MIP + 1:
        raise ValueError("exactly six authored mip files required")
    for (level, reference), entry in zip(mip_images(sources, expected["page"]["cellPx"]), actual["mipFiles"]):
        path = paths[level]
        if (entry["level"] != level or entry["path"] != str(path.relative_to(pack))
                or path.is_symlink() or sha(path) != entry["sha256"] or path.stat().st_size != entry["bytes"]
                or entry["dimensionsPx"] != list(reference.size)):
            raise ValueError(f"mip {level} path/hash/dimensions mismatch")
        with Image.open(path) as image:
            if image.format != "WEBP" or different(image.convert("RGBA"), reference):
                raise ValueError(f"mip {level} decoded pixels differ from isolated source-cell filtering")
    return {"scope": "oak-fallback-runtime-export", "status": actual["status"],
            "contractSha256": sha(contract_path), "framesVerified": list(STATES),
            "mipLevelsVerified": MAX_MIP + 1, "dimensionsPx": expected["page"]["dimensionsPx"],
            "encodedBytes": sum(f["bytes"] for f in actual["mipFiles"]),
            "registration": "matches active source canvas/pivot/world size", "defaultBound": False,
            "gpuAppearance": "not established by offline pixel/registration verification"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="write only the six oak runtime mips and export contract")
    parser.add_argument("--overwrite", action="store_true", help="replace that existing export; requires --write")
    args = parser.parse_args()
    if args.overwrite and not args.write:
        parser.error("--overwrite requires --write")
    # Reuse the source candidate's committed-page/reconstruction validation first.
    subprocess.run([sys.executable, str(ROOT / "scripts/inspect-resource-atlas-pixels.py")],
                   check=True, stdout=subprocess.DEVNULL)
    print(json.dumps(prepare(write=args.write, overwrite=args.overwrite), indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        raise SystemExit(str(error))
