#!/usr/bin/env python3
"""Package the five-frame Archery Range construction sprite pilot."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "assets/buildings/archery-range-construction-v1"
SOURCE = PACK / "source/generated"
REVISION_SOURCE = PACK / "source/generated-v2"
NORMALIZED = PACK / "source/frames"
RUNTIME = PACK / "runtime"
PREVIEW = PACK / "previews"
STATES = ("foundation", "frame", "rails", "canopy", "complete")
PLAYZOOM_STATES = ("frame", "rails", "complete")
TEAM_PENNANT_REGIONS = {
    "frame": (650, 700, 850, 980),
    "rails": (650, 700, 850, 980),
    "canopy": (650, 700, 850, 980),
    "complete": (470, 300, 650, 530),
}
FRAME_PX = 640
FIT_PX = 560
FOOTPRINT_CELLS = 3
CAMERA_ELEVATION_DEGREES = 46
BOTTOM_MARGIN_PX = 4
GROUND_PIVOT = {"x": 320, "y": 441}
ATLAS_WIDTH = FRAME_PX * len(STATES)


def source_path(state: str) -> Path:
    revision = REVISION_SOURCE / f"archery-range-{state}.png"
    if revision.exists():
        return revision
    return SOURCE / f"archery-range-{state}.png"


def alpha_bounds(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int]:
    alpha = image.convert("RGBA").getchannel("A")
    return alpha.point(lambda value: 255 if value >= threshold else 0).getbbox()


def normalize(image: Image.Image, reference_width: int) -> tuple[Image.Image, tuple[int, int, int, int], tuple[int, int, int, int]]:
    image = image.convert("RGBA")
    bounds = alpha_bounds(image)
    if bounds is None:
        raise ValueError("source sprite is fully transparent")
    cropped = image.crop(bounds)
    scale = FIT_PX / reference_width
    size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    if size[0] > FRAME_PX - 2 * BOTTOM_MARGIN_PX or size[1] > FRAME_PX - 2 * BOTTOM_MARGIN_PX:
        raise ValueError("normalized sprite exceeds its shared 640×640 frame")
    x = (FRAME_PX - size[0]) // 2
    y = FRAME_PX - BOTTOM_MARGIN_PX - size[1]
    frame = Image.new("RGBA", (FRAME_PX, FRAME_PX), (0, 0, 0, 0))
    frame.alpha_composite(resized, (x, y))
    return frame, bounds, (x, y, size[0], size[1])


def banner_mask(source: Image.Image, region_box: tuple[int, int, int, int]) -> Image.Image:
    """Mask the blue cloth pennant, leaving target, arrows, and other details alone."""
    source = source.convert("RGBA")
    hsv = source.convert("RGB").convert("HSV")
    hue, saturation, value = hsv.split()
    blue = hue.point([255 if 126 <= channel <= 190 else 0 for channel in range(256)])
    saturated = saturation.point([255 if channel >= 52 else 0 for channel in range(256)])
    visible = source.getchannel("A").point([0] + [255] * 255)
    region_mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(region_mask).rectangle(region_box, fill=255)
    result = ImageChops.multiply(ImageChops.multiply(blue, saturated), region_mask)
    return ImageChops.multiply(result, visible)


def normalize_mask(mask: Image.Image, source_bounds: tuple[int, int, int, int], transform: tuple[int, int, int, int], reference_width: int) -> Image.Image:
    x, y, width, height = transform
    source_width = source_bounds[2] - source_bounds[0]
    scale = FIT_PX / reference_width
    expected = (max(1, round(source_width * scale)), max(1, round((source_bounds[3] - source_bounds[1]) * scale)))
    if expected != (width, height):
        raise ValueError("team mask transform does not match its color frame")
    resized = mask.crop(source_bounds).resize((width, height), Image.Resampling.LANCZOS)
    frame = Image.new("L", (FRAME_PX, FRAME_PX), 0)
    frame.paste(resized, (x, y))
    return frame


def build_contact_sheet(frames: dict[str, Image.Image]) -> None:
    sheet = Image.new("RGBA", (ATLAS_WIDTH, FRAME_PX + 48), (87, 105, 70, 255))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    half = FOOTPRINT_CELLS / 2
    elevation = math.radians(CAMERA_ELEVATION_DEGREES)

    def project(x: float, z: float) -> tuple[float, float]:
        azimuth = math.radians(45)
        screen_x = FRAME_PX / 2 + (x * math.cos(azimuth) - z * math.sin(azimuth)) * 128
        screen_y = GROUND_PIVOT["y"] - (x + z) * math.sin(elevation) / math.sqrt(2) * 128
        return screen_x, screen_y

    corners = [project(-half, -half), project(half, -half), project(half, half), project(-half, half)]
    outline = (216, 244, 123, 230)
    for index, state in enumerate(STATES):
        x_offset = index * FRAME_PX
        for cell in range(1, 5):
            coordinate = cell * 128
            draw.line((x_offset + coordinate, 0, x_offset + coordinate, FRAME_PX), fill=(231, 237, 205, 52), width=1)
            draw.line((x_offset, coordinate, x_offset + FRAME_PX, coordinate), fill=(231, 237, 205, 52), width=1)
        sheet.alpha_composite(frames[state], (x_offset, 0))
        points = [(round(x + x_offset), round(y)) for x, y in (*corners, corners[0])]
        draw.line(points, fill=outline, width=3)
        draw.text((x_offset + 12, FRAME_PX + 14), state.upper(), fill=(249, 244, 223, 255), font=font)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(PREVIEW / "archery-range-construction-grid.png", optimize=True)


def tint_for_preview(frame: Image.Image, mask: Image.Image, team: str) -> Image.Image:
    if team == "azure":
        return frame.copy()
    hue, saturation, value = frame.convert("HSV").split()
    shifted_hue = hue.point([8 if 126 <= channel <= 190 else channel for channel in range(256)])
    shifted = Image.merge("HSV", (shifted_hue, saturation, value)).convert("RGBA")
    shifted.putalpha(frame.getchannel("A"))
    return Image.composite(shifted, frame, mask)


def build_map_preview(frame: Image.Image, mask: Image.Image, zoom: str, team: str, anchor: tuple[int, int], canvas_width: int) -> None:
    capture = Image.open(PACK / f"source/map-captures/meadow-zoom-{zoom}.png").convert("RGBA")
    variant = tint_for_preview(frame, mask, team)
    canvas_height = round(FRAME_PX * canvas_width / FRAME_PX)
    scaled = variant.resize((canvas_width, canvas_height), Image.Resampling.LANCZOS)
    x = round(anchor[0] - canvas_width / 2)
    y = round(anchor[1] - GROUND_PIVOT["y"] * canvas_height / FRAME_PX)
    capture.alpha_composite(scaled, (x, y))
    PREVIEW.mkdir(parents=True, exist_ok=True)
    preview_label = "azure" if team == "azure" else "ember-pennant-azure-hud"
    capture.save(PREVIEW / f"archery-range-meadow-zoom-{zoom}-{preview_label}.png", optimize=True)


def build_playzoom_comparison(frames: dict[str, Image.Image], masks: dict[str, Image.Image]) -> None:
    """Place unlabeled stages on one captured Meadow view at the 0.91 play zoom."""
    capture = Image.open(PACK / "source/map-captures/meadow-zoom-091.png").convert("RGBA")
    canvas_width = 56
    baseline_y = 355
    anchors = (515, 610, 705)
    for state, center_x in zip(PLAYZOOM_STATES, anchors):
        variant = tint_for_preview(frames[state], masks[state], "azure")
        scaled = variant.resize((canvas_width, canvas_width), Image.Resampling.LANCZOS)
        x = round(center_x - canvas_width / 2)
        y = round(baseline_y - GROUND_PIVOT["y"] * canvas_width / FRAME_PX)
        capture.alpha_composite(scaled, (x, y))
    PREVIEW.mkdir(parents=True, exist_ok=True)
    crop = capture.crop((460, 250, 770, 425))
    crop.save(PREVIEW / "archery-range-identity-playzoom-unlabeled.png", optimize=True)


def image_record(file_id: str, relative_path: str, usage: str) -> dict:
    path = PACK / relative_path
    with Image.open(path) as image:
        width, height = image.size
    return {
        "id": file_id,
        "path": relative_path,
        "usage": usage,
        "format": path.suffix.lstrip(".").lower(),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "dimensionsPx": {"width": width, "height": height},
    }


def build_manifest(frames: dict[str, Image.Image]) -> None:
    file_specs = []
    for state in STATES:
        active_path = source_path(state).relative_to(PACK).as_posix()
        file_specs.append((f"source-{state}", active_path, "source"))
        original_path = f"source/generated/archery-range-{state}.png"
        if active_path != original_path:
            file_specs.append((f"source-{state}-original", original_path, "source"))
        file_specs.append((f"frame-{state}", f"source/frames/archery-range-{state}.png", "source"))
    file_specs.extend([
        ("color-source", "source/archery-range-construction-atlas.png", "source"),
        ("color-runtime", "runtime/archery-range-construction-atlas.webp", "runtime"),
        ("team-mask", "source/archery-range-team-mask.png", "team-mask"),
    ])
    files = [image_record(*spec) for spec in file_specs]
    rects = []
    frame_records = []
    clips = []
    for index, state in enumerate(STATES):
        rect = {"x": index * FRAME_PX, "y": 0, "width": FRAME_PX, "height": FRAME_PX}
        rects.append({"layerId": "actor", "pageId": "archery-range-construction-color", "rectPx": rect, "offsetPx": {"x": 0, "y": 0}})
        alpha = frames[state].getchannel("A").point(lambda value: 255 if value >= 96 else 0)
        bounds = alpha.getbbox()
        if bounds is None:
            raise ValueError(f"normalized {state} frame has no visible alpha")
        frame_records.append({
            "id": state,
            "canvasPx": {"width": FRAME_PX, "height": FRAME_PX},
            "groundPivotPx": GROUND_PIVOT,
            "groundPivotStatus": "unreviewed-estimate",
            "alphaBoundsPx": {"x": bounds[0], "y": bounds[1], "width": bounds[2] - bounds[0], "height": bounds[3] - bounds[1]},
            "fallbackRectPx": {"pageId": "archery-range-construction-color", "rectPx": rect},
            "frameRectsPx": [rects[-1]],
        })
        clips.append({"stateId": state, "loop": False, "sequence": [{"frameId": state, "durationMs": 1000}]})
    manifest = {
        "schemaVersion": 1,
        "packId": "archery-range-construction-v1",
        "packVersion": "1.0.0",
        "maturity": "runtime-candidate",
        "provenance": {
            "license": "project-owned; original AI-generated artwork",
            "source": "OpenAI ImageGen edits of the project's original Archery Range complete sprite; no third-party or Age of Empires II sprite pixels used",
            "authoringTool": "OpenAI ImageGen; Pillow atlas and mask packaging",
            "notes": "Five static construction stages. 3×3 occupancy remains owned by map/gameplay data. Ground pivot is an unreviewed camera-space estimate. Team tint mask selects only the complete-state pennant.",
        },
        "files": files,
        "pages": [{
            "id": "archery-range-construction-color",
            "sourceFileId": "color-source",
            "runtimeFileId": "color-runtime",
            "maskFileId": "team-mask",
            "dimensionsPx": {"width": ATLAS_WIDTH, "height": FRAME_PX},
            "colorSpace": "srgb",
            "pixelFormat": "rgba8",
            "alphaMode": "straight",
            "edgeRule": "zero-rgb-under-transparent",
            "gutterPx": 0,
            "gutterRule": "none",
            "wrapMode": "clamp",
            "sampling": {"generateMipmaps": False, "minFilter": "linear", "magFilter": "linear", "uvInsetPx": 0.5, "maxMipLevel": 0},
        }],
        "assets": [{
            "id": "archery-range-construction",
            "kind": "building",
            "recommendedTileFootprint": {"widthTiles": 3, "heightTiles": 3},
            "artBoundsWorld": {"min": [-2.5, 0, -2.5], "max": [2.5, 4.5, 2.5]},
            "heightWorld": 4.5,
            "sortAnchorWorld": [0, 0, 0],
            "layers": [{"id": "actor", "drawLayer": "actor", "batchKey": "building.archery-range-construction"}],
            "frames": frame_records,
            "clips": clips,
        }],
    }
    (PACK / "sprite-atlas-pack-v1.json").write_text(json.dumps(manifest, indent=2) + "\n")


def write_checksums() -> None:
    files = sorted(path for path in PACK.rglob("*") if path.is_file() and path.name != "SHA256SUMS.txt")
    lines = [f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(PACK).as_posix()}" for path in files]
    (PACK / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n")


def main() -> None:
    NORMALIZED.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    originals = {state: Image.open(source_path(state)).convert("RGBA") for state in STATES}
    complete_bounds = alpha_bounds(originals["complete"])
    reference_width = complete_bounds[2] - complete_bounds[0]
    frames: dict[str, Image.Image] = {}
    transforms = {}
    bounds_map = {}
    for state in STATES:
        frame, bounds, transform = normalize(originals[state], reference_width)
        frames[state] = frame
        transforms[state] = transform
        bounds_map[state] = bounds
        frame.save(NORMALIZED / f"archery-range-{state}.png", optimize=True)

    mask = Image.new("L", (ATLAS_WIDTH, FRAME_PX), 0)
    masks: dict[str, Image.Image] = {}
    for index, state in enumerate(STATES):
        frame = frames[state]
        if state in TEAM_PENNANT_REGIONS:
            raw_mask = banner_mask(originals[state], TEAM_PENNANT_REGIONS[state])
            mask_frame = normalize_mask(raw_mask, bounds_map[state], transforms[state], reference_width)
        else:
            mask_frame = Image.new("L", (FRAME_PX, FRAME_PX), 0)
        masks[state] = mask_frame
        mask.paste(mask_frame, (index * FRAME_PX, 0))

    atlas = Image.new("RGBA", (ATLAS_WIDTH, FRAME_PX), (0, 0, 0, 0))
    for index, state in enumerate(STATES):
        atlas.alpha_composite(frames[state], (index * FRAME_PX, 0))
    atlas.save(PACK / "source/archery-range-construction-atlas.png", optimize=True)
    atlas.save(RUNTIME / "archery-range-construction-atlas.webp", "WEBP", quality=90, method=6)
    mask.save(PACK / "source/archery-range-team-mask.png", optimize=True)

    build_contact_sheet(frames)
    build_map_preview(frames["complete"], mask.crop((4 * FRAME_PX, 0, 5 * FRAME_PX, FRAME_PX)), "091", "azure", (540, 355), 56)
    build_map_preview(frames["complete"], mask.crop((4 * FRAME_PX, 0, 5 * FRAME_PX, FRAME_PX)), "048", "ember", (590, 348), 30)
    build_playzoom_comparison(frames, masks)
    build_manifest(frames)
    write_checksums()
    print(f"Packaged {len(STATES)} frames into {PACK.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
