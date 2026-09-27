#!/usr/bin/env python3
"""Build the source-only sprite-atlas candidate from approved v1 resource PNGs."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, __version__ as PILLOW_VERSION

PACK_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PACK_ROOT.parents[2]
SOURCE_ROOT = REPO_ROOT / "assets/environment/frontier-interactive-v1"
PAGE_ROOT = PACK_ROOT / "pages"
STATES = ("full", "worked", "low", "depleted")
ALPHA_BOUNDS_THRESHOLD = 96


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def binary_range(channel: Image.Image, low: int, high: int) -> Image.Image:
    lookup = [255 if low <= value <= high else 0 for value in range(256)]
    return channel.point(lookup)


def binary_alpha(alpha: Image.Image) -> Image.Image:
    return alpha.point([0] + [255] * 255)


def source_layers(source: Image.Image, family: str, state: str) -> dict[str, Image.Image]:
    alpha = source.getchannel("A")
    visible = binary_alpha(alpha)
    hue, saturation, _value = source.convert("RGB").convert("HSV").split()

    # These color mattes assign existing RGBA pixels to broad draw groups.
    # They do not repaint or synthesize the art. The full cutout remains the
    # fallback, and reconstruction checks guarantee that visible pixels match.
    foliage_hue = binary_range(hue, 20, 120)
    foliage_sat = binary_range(saturation, 18, 255)
    foliage = ImageChops.multiply(visible, ImageChops.multiply(foliage_hue, foliage_sat))

    fruit = Image.new("L", source.size, 0)
    if family == "berries" and state != "depleted":
        red_hue = ImageChops.lighter(binary_range(hue, 0, 12), binary_range(hue, 246, 255))
        fruit_sat = binary_range(saturation, 64, 255)
        fruit = ImageChops.multiply(visible, ImageChops.multiply(red_hue, fruit_sat))

    # Fruit is a foreground group and wins if a color falls on both thresholds.
    foliage = ImageChops.subtract(foliage, fruit)
    occupied = ImageChops.lighter(foliage, fruit)
    structure = ImageChops.subtract(visible, occupied)

    if family == "oak" and state == "depleted":
        # The depleted oak is a stump/root silhouette; retain all its pixels in
        # the structure layer even when moss has foliage-like colors.
        foliage = Image.new("L", source.size, 0)
        structure = visible

    masks = {"foliage-back": foliage, "wood-structure": structure}
    if family == "berries":
        masks["fruit-front"] = fruit

    union = Image.new("L", source.size, 0)
    for mask in masks.values():
        if ImageChops.multiply(union, mask).getbbox():
            raise ValueError(f"overlapping semantic masks for {family}-{state}")
        union = ImageChops.lighter(union, mask)
    if ImageChops.difference(union, visible).getbbox():
        raise ValueError(f"semantic masks do not cover source alpha for {family}-{state}")

    transparent = Image.new("RGBA", source.size, (0, 0, 0, 0))
    return {layer_id: Image.composite(source, transparent, mask) for layer_id, mask in masks.items()}


def zero_rgb_where_alpha_is_zero(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    active = alpha.point([0] + [255] * 255)
    black = Image.new("L", image.size, 0)
    red, green, blue, _ = rgba.split()
    red = Image.composite(red, black, active)
    green = Image.composite(green, black, active)
    blue = Image.composite(blue, black, active)
    return Image.merge("RGBA", (red, green, blue, alpha))


def rect_dict(box: tuple[int, int, int, int]) -> dict[str, int]:
    left, top, right, bottom = box
    return {"x": left, "y": top, "width": right - left, "height": bottom - top}


def vector_add(a: tuple[float, float, float], b: tuple[float, float, float]):
    return tuple(x + y for x, y in zip(a, b))


def vector_cross(a: tuple[float, float, float], b: tuple[float, float, float]):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def rotate_camera_facing(vector: tuple[float, float, float]):
    # Match environment-art.mjs: rotate PlaneGeometry's +Z normal toward
    # normalized (0.78, 1.12, 0.78) using the shortest unit-vector rotation.
    magnitude = math.sqrt(0.78 ** 2 + 1.12 ** 2 + 0.78 ** 2)
    target = (0.78 / magnitude, 1.12 / magnitude, 0.78 / magnitude)
    source = (0.0, 0.0, 1.0)
    axis_raw = vector_cross(source, target)
    sine = math.sqrt(sum(value * value for value in axis_raw))
    axis = tuple(value / sine for value in axis_raw)
    cosine = target[2]
    cross = vector_cross(axis, vector)
    dot = sum(axis[i] * vector[i] for i in range(3))
    return vector_add(
        vector_add(tuple(cosine * value for value in vector), tuple(sine * value for value in cross)),
        tuple((1 - cosine) * dot * value for value in axis),
    )


def world_bounds(width: float, height: float):
    right = rotate_camera_facing((1.0, 0.0, 0.0))
    up = rotate_camera_facing((0.0, 1.0, 0.0))
    half_width = width / 2
    minimum = []
    maximum = []
    for horizontal, vertical in zip(right, up):
        side = abs(horizontal) * half_width
        rise = vertical * height
        minimum.append(-side + min(0.0, rise))
        maximum.append(side + max(0.0, rise))
    return {"min": minimum, "max": maximum}, maximum[1] - minimum[1]


def write_page(image: Image.Image, relative_path: str) -> tuple[str, dict[str, int]]:
    destination = PACK_ROOT / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    zero_rgb_where_alpha_is_zero(image).save(destination, format="PNG", compress_level=6, optimize=False)
    return sha256(destination), {"width": image.width, "height": image.height}


def page_record(page_id: str, file_id: str, dimensions: dict[str, int]) -> dict:
    return {
        "id": page_id,
        "sourceFileId": file_id,
        "dimensionsPx": dimensions,
        "colorSpace": "srgb",
        "pixelFormat": "rgba8",
        "alphaMode": "straight",
        "edgeRule": "zero-rgb-under-transparent",
        "gutterPx": 0,
        "gutterRule": "none",
        "wrapMode": "clamp",
        "sampling": {
            "generateMipmaps": False,
            "minFilter": "linear",
            "magFilter": "linear",
            "uvInsetPx": 0.5,
            "maxMipLevel": 0,
        },
    }


def main() -> None:
    PAGE_ROOT.mkdir(parents=True, exist_ok=True)
    pack_files: list[dict] = []
    pages: list[dict] = []
    assets: list[dict] = []
    source_lineage: list[str] = []
    report = {"sourceLineage": {}, "frames": {}}

    for family in ("oak", "berries"):
        sources = []
        layers_by_state = {}
        dimensions = None
        world_size = None
        for state in STATES:
            source_path = SOURCE_ROOT / f"{family}-{state}.png"
            image = Image.open(source_path).convert("RGBA")
            row = next(item for item in json.loads((SOURCE_ROOT / "manifest.json").read_text())["assets"]
                       if item["id"] == f"{family}-{state}")
            if dimensions is None:
                dimensions = image.size
                world_size = row["worldSize"]
            if image.size != dimensions or row["worldSize"] != world_size or row["pivot"] != [0.5, 1.0]:
                raise ValueError(f"{family} state canvas, world size, or source pivot is inconsistent")
            sources.append(image)
            layers_by_state[state] = source_layers(image, family, state)
            source_hash = sha256(source_path)
            source_lineage.append(f"{source_path.relative_to(REPO_ROOT)}={source_hash}")
            report["sourceLineage"][f"{family}-{state}"] = {
                "path": str(source_path.relative_to(REPO_ROOT)),
                "sha256": source_hash,
                "dimensionsPx": {"width": image.width, "height": image.height},
            }

            # A source-only layer frame must reconstruct every visible RGBA
            # source sample from its cropped semantic layer pixels.
            visible = binary_alpha(image.getchannel("A"))
            reconstructed = Image.new("RGBA", image.size, (0, 0, 0, 0))
            for layer_image in layers_by_state[state].values():
                reconstructed = Image.alpha_composite(reconstructed, layer_image)
            alpha_difference = ImageChops.difference(reconstructed.getchannel("A"), image.getchannel("A"))
            rgba_difference = ImageChops.difference(reconstructed, image)
            rgba_difference = Image.composite(rgba_difference, Image.new("RGBA", image.size, (0, 0, 0, 0)), visible)
            if alpha_difference.getbbox() or rgba_difference.getbbox():
                raise ValueError(f"layer reconstruction differs from source for {family}-{state}")

            alpha_bounds = image.getchannel("A").point(
                [255 if value >= ALPHA_BOUNDS_THRESHOLD else 0 for value in range(256)]
            ).getbbox()
            report["frames"][f"{family}-{state}"] = {
                "alphaBoundsPxThreshold96": rect_dict(alpha_bounds),
                "layerBoundsPx": {
                    layer_id: rect_dict(layer_image.getchannel("A").getbbox())
                    for layer_id, layer_image in layers_by_state[state].items()
                    if layer_image.getchannel("A").getbbox()
                },
                "visibleRgbaReconstruction": "exact",
            }

        width, height = dimensions
        state_index = {state: index for index, state in enumerate(STATES)}
        atlas_width = width * len(STATES)

        fallback_file_id = f"{family}-fallback-source"
        fallback_page_id = f"{family}-fallback"
        fallback_atlas = Image.new("RGBA", (atlas_width, height), (0, 0, 0, 0))
        for index, image in enumerate(sources):
            fallback_atlas.paste(image, (index * width, 0))
        digest, page_dims = write_page(fallback_atlas, f"pages/{family}-fallback.png")
        pack_files.append({
            "id": fallback_file_id,
            "path": f"pages/{family}-fallback.png",
            "usage": "source",
            "format": "png",
            "sha256": digest,
            "dimensionsPx": page_dims,
        })
        pages.append(page_record(fallback_page_id, fallback_file_id, page_dims))

        layer_specs = (
            [
                {"id": "foliage-back", "drawLayer": "background", "batchKey": f"environment.resource.{family}.foliage"},
                {"id": "wood-structure", "drawLayer": "actor", "batchKey": f"environment.resource.{family}.structure"},
            ]
            + ([{"id": "fruit-front", "drawLayer": "foreground", "batchKey": "environment.resource.berries.fruit"}]
               if family == "berries" else [])
        )
        layer_page_ids = {}
        layer_file_ids = {}
        layer_atlases = {}
        for layer in layer_specs:
            layer_id = layer["id"]
            page_id = f"{family}-{layer_id}"
            file_id = f"{family}-{layer_id}-source"
            atlas = Image.new("RGBA", (atlas_width, height), (0, 0, 0, 0))
            layer_atlases[layer_id] = atlas
            layer_page_ids[layer_id] = page_id
            layer_file_ids[layer_id] = file_id

        frames = []
        clips = []
        alpha_bounds_by_state = {}
        for state in STATES:
            index = state_index[state]
            source = sources[index]
            pivot = {"x": width / 2, "y": height}
            alpha_box = source.getchannel("A").point(
                [255 if value >= ALPHA_BOUNDS_THRESHOLD else 0 for value in range(256)]
            ).getbbox()
            alpha_bounds_by_state[state] = rect_dict(alpha_box)
            frame_id = state
            frame_rects = []
            for layer in layer_specs:
                layer_id = layer["id"]
                layer_image = layers_by_state[state][layer_id]
                box = layer_image.getchannel("A").getbbox()
                if not box:
                    continue
                crop = layer_image.crop(box)
                left, top, right, bottom = box
                layer_atlases[layer_id].paste(crop, (index * width + left, top))
                frame_rects.append({
                    "layerId": layer_id,
                    "pageId": layer_page_ids[layer_id],
                    "rectPx": {
                        "x": index * width + left,
                        "y": top,
                        "width": right - left,
                        "height": bottom - top,
                    },
                    "offsetPx": {"x": left, "y": top},
                })
            frames.append({
                "id": frame_id,
                "canvasPx": {"width": width, "height": height},
                "groundPivotPx": pivot,
                "groundPivotStatus": "unreviewed-estimate",
                "alphaBoundsPx": alpha_bounds_by_state[state],
                "fallbackRectPx": {
                    "pageId": fallback_page_id,
                    "rectPx": {"x": index * width, "y": 0, "width": width, "height": height},
                },
                "frameRectsPx": frame_rects,
            })
            clips.append({
                "stateId": state,
                "loop": False,
                "sequence": [{"frameId": frame_id, "durationMs": 1000}],
            })

        for layer in layer_specs:
            layer_id = layer["id"]
            relative_path = f"pages/{family}-{layer_id}.png"
            digest, page_dims = write_page(layer_atlases[layer_id], relative_path)
            file_id = layer_file_ids[layer_id]
            pack_files.append({
                "id": file_id,
                "path": relative_path,
                "usage": "source",
                "format": "png",
                "sha256": digest,
                "dimensionsPx": page_dims,
            })
            pages.append(page_record(layer_page_ids[layer_id], file_id, page_dims))

        bounds, height_world = world_bounds(float(world_size["width"]), float(world_size["height"]))
        assets.append({
            "id": family,
            "kind": "resource",
            "recommendedTileFootprint": {"widthTiles": 1, "heightTiles": 1},
            "artBoundsWorld": bounds,
            "heightWorld": height_world,
            "sortAnchorWorld": [0, 0, 0],
            "layers": layer_specs,
            "frames": frames,
            "clips": clips,
        })

    manifest = {
        "schemaVersion": 1,
        "packId": "environment.frontier-resource-atlas-candidate",
        "packVersion": "0.1.0",
        "maturity": "source-only",
        "provenance": {
            "license": "Project-owned derivative of original Thousand Unit Skirmish art; no third-party source imagery.",
            "source": "Lossless color-matte layer extraction from the approved frontier-interactive-v1 oak and berries source PNGs.",
            "authoringTool": f"Pillow {PILLOW_VERSION}; PNG atlas packing with source-pixel-preserving layer masks.",
            "notes": "Original source paths and SHA-256 values: " + "; ".join(source_lineage),
        },
        "files": pack_files,
        "pages": pages,
        "assets": assets,
    }
    (PACK_ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (PACK_ROOT / "build-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({
        "manifest": str((PACK_ROOT / "manifest.json").relative_to(REPO_ROOT)),
        "sourcePages": len(pack_files),
        "assets": [asset["id"] for asset in assets],
        "frames": sum(len(asset["frames"]) for asset in assets),
        "clips": [clip["stateId"] for clip in assets[0]["clips"]],
        "allVisibleSourcePixelsReconstructed": all(
            frame["visibleRgbaReconstruction"] == "exact"
            for frame in report["frames"].values()
        ),
    }, indent=2))


if __name__ == "__main__":
    main()
