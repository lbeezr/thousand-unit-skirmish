"""Read-only pixel checks for the public Frontier resource source candidate."""
import hashlib
import json
from pathlib import Path
import sys

from PIL import Image, ImageChops

REPO_ROOT = Path(__file__).resolve().parents[1]
PACK_PATH = Path("assets/environment/frontier-resource-atlas-v1-candidate")
SOURCE_PATH = Path("assets/environment/frontier-interactive-v1")
STATES = ("full", "worked", "low", "depleted")
LAYERS = {"oak": ("foliage-back", "wood-structure"),
          "berries": ("foliage-back", "wood-structure", "fruit-front")}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def zero_transparent_rgb(image):
    active = image.getchannel("A").point([0] + [255] * 255)
    return Image.composite(image, Image.new("RGBA", image.size), active)


def any_difference(first, second):
    # RGBA.getbbox() considers alpha by default: an RGB-only difference with
    # unchanged alpha would be hidden. Check all four channels independently.
    return any(channel.getbbox() for channel in ImageChops.difference(first, second).split())


def exact(first, second, label):
    if first.size != second.size or any_difference(first, second):
        raise ValueError(f"{label}: decoded RGBA differs")


def rect_crop(image, rect, label):
    values = [rect[key] for key in ("x", "y", "width", "height")]
    if any(type(value) is not int for value in values):
        raise ValueError(f"{label}: integer crop required")
    x, y, width, height = values
    if x < 0 or y < 0 or width <= 0 or height <= 0 or x + width > image.width or y + height > image.height:
        raise ValueError(f"{label}: crop outside page")
    return image.crop((x, y, x + width, y + height))


def decoded(path, entry):
    if path.is_symlink() or digest(path) != entry["sha256"]:
        raise ValueError(f"{path.name}: source hash mismatch or symlink")
    with Image.open(path) as image:
        if image.format != "PNG" or image.size != (entry["dimensionsPx"]["width"], entry["dimensionsPx"]["height"]):
            raise ValueError(f"{path.name}: PNG dimensions disagree")
        return image.convert("RGBA")


def inspect(repo_root=REPO_ROOT):
    repo_root = Path(repo_root)
    pack = repo_root / PACK_PATH
    manifest_path, lineage_path = pack / "manifest.json", pack / "build-report.json"
    manifest = json.loads(manifest_path.read_text())
    lineage = json.loads(lineage_path.read_text())
    if manifest["packId"] != "environment.frontier-resource-atlas-candidate" or manifest["maturity"] != "source-only":
        raise ValueError("expected the source-only Frontier resource candidate")
    files = {file["id"]: file for file in manifest["files"]}
    expected_pages = {f"{family}-{layer}" for family, layers in LAYERS.items() for layer in ("fallback", *layers)}
    if (len(files) != 7 or len(manifest["files"]) != 7 or len(manifest["pages"]) != 7
            or {page["id"] for page in manifest["pages"]} != expected_pages):
        raise ValueError("expected seven declared source pages")
    pages = {}
    for page in manifest["pages"]:
        file = files[page["sourceFileId"]]
        expected_path = f"pages/{page['id']}.png"
        if file["usage"] != "source" or file["format"] != "png" or file["path"] != expected_path:
            raise ValueError("unexpected resource source page path/usage")
        image = decoded(pack / expected_path, file)
        exact(image, zero_transparent_rgb(image), f"{page['id']} transparent RGB")
        pages[page["id"]] = image
    if len(manifest["assets"]) != 2 or {asset["id"] for asset in manifest["assets"]} != set(LAYERS):
        raise ValueError("expected oak and berries assets")
    rows, unreviewed = [], []
    for asset in manifest["assets"]:
        family = asset["id"]
        if len(asset["frames"]) != 4 or {frame["id"] for frame in asset["frames"]} != set(STATES):
            raise ValueError(f"{family}: expected four resource states")
        for frame in asset["frames"]:
            key = f"{family}-{frame['id']}"
            source_record = lineage["sourceLineage"][key]
            expected_source = str(SOURCE_PATH / f"{key}.png")
            if source_record["path"] != expected_source:
                raise ValueError(f"{key}: source lineage path disagrees")
            source = decoded(repo_root / expected_source, source_record)
            if source.size != (frame["canvasPx"]["width"], frame["canvasPx"]["height"]):
                raise ValueError(f"{key}: source/canvas dimensions disagree")
            fallback = frame["fallbackRectPx"]
            full = rect_crop(pages[fallback["pageId"]], fallback["rectPx"], key)
            exact(full, zero_transparent_rgb(source), f"{key} fallback/source")
            reconstructed = Image.new("RGBA", source.size)
            covered = Image.new("L", source.size)
            seen = set()
            for layer in frame["frameRectsPx"]:
                layer_id = layer["layerId"]
                if layer_id not in LAYERS[family] or layer_id in seen or layer["pageId"] != f"{family}-{layer_id}":
                    raise ValueError(f"{key}: duplicate/unknown layer")
                seen.add(layer_id)
                crop = rect_crop(pages[layer["pageId"]], layer["rectPx"], key)
                x, y = layer["offsetPx"]["x"], layer["offsetPx"]["y"]
                if type(x) is not int or type(y) is not int or x < 0 or y < 0 or x + crop.width > source.width or y + crop.height > source.height:
                    raise ValueError(f"{key}: layer offset outside canvas")
                canvas = Image.new("RGBA", source.size)
                canvas.paste(crop, (x, y))
                active = canvas.getchannel("A").point([0] + [255] * 255)
                if ImageChops.multiply(covered, active).getbbox():
                    raise ValueError(f"{key}: layer alpha overlaps")
                covered = ImageChops.lighter(covered, active)
                reconstructed = Image.alpha_composite(reconstructed, canvas)
            exact(reconstructed, full, f"{key} layer reconstruction")
            alpha_bounds = source.getchannel("A").point([0] * 96 + [255] * 160).getbbox()
            x, y, right, bottom = alpha_bounds
            actual_bounds = {"x": x, "y": y, "width": right - x, "height": bottom - y}
            if frame["alphaBoundsPx"] != actual_bounds or lineage["frames"][key]["alphaBoundsPxThreshold96"] != actual_bounds:
                raise ValueError(f"{key}: recorded alpha bounds disagree")
            if frame.get("groundPivotStatus") != "reviewed":
                unreviewed.append(key)
            rows.append({"frame": key, "sourceSha256": source_record["sha256"],
                         "fallbackMatchesSource": True, "layersReconstructFallback": True,
                         "layers": sorted(seen), "alphaBoundsThreshold": 96})
    return {"schemaVersion": 1, "scope": "resource-candidate-source-pixels",
            "packId": manifest["packId"], "packVersion": manifest["packVersion"],
            "manifestSha256": digest(manifest_path), "lineageSha256": digest(lineage_path),
            "sourcePagesVerified": len(pages), "framesVerified": rows,
            "unreviewedPivots": unreviewed, "runtimeReady": False,
            "remaining": ["Runtime exports/hashes absent", "Ground-pivot visual registration required",
                          "HSV layers are color partitions, not reviewed semantic depth mattes"],
            "gpuAppearance": "not established by this source pixel check"}


if __name__ == "__main__":
    if len(sys.argv) != 1:
        raise SystemExit("Usage: python3 scripts/inspect-resource-atlas-pixels.py")
    try:
        print(json.dumps(inspect(), indent=2))
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f"Resource candidate pixel check failed: {error}", file=sys.stderr)
        raise SystemExit(1) from None
