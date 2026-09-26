#!/usr/bin/env python3
"""Normalize building sprite source art to the shared 5×5 world-unit grid."""

from argparse import ArgumentParser
from math import cos, radians, sin, sqrt
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FRAME_PX = 640
PIXELS_PER_WORLD_UNIT = 128
FIT_PX = 560
BOTTOM_MARGIN_PX = 4
CAMERA_ELEVATION_DEGREES = 46

PACKS = {
    "archery-range": {
        "root": ROOT / "assets/buildings/archery-range-sprite-v1",
        "states": ("foundation", "frame", "complete", "damaged", "critical"),
        "footprint_cells": 3,
    },
    "town-center": {
        "root": ROOT / "assets/buildings/town-center-sprite-v1",
        "states": ("complete",),
        "footprint_cells": 4,
    },
}


def recolor_ember(source: Image.Image) -> Image.Image:
    """Shift saturated Azure cloth blues to Ember rust, preserving shading."""
    hsv = source.convert("HSV")
    hue, saturation, value = hsv.split()
    blue_hue = hue.point([255 if 126 <= channel <= 190 else 0 for channel in range(256)])
    saturated = saturation.point([255 if channel >= 52 else 0 for channel in range(256)])
    mask = ImageChops.multiply(blue_hue, saturated)
    ember_hue = hue.point([8 if 126 <= channel <= 190 else channel for channel in range(256)])
    shifted_rgb = Image.merge("HSV", (ember_hue, saturation, value)).convert("RGB")
    recolored_rgb = Image.composite(shifted_rgb, source.convert("RGB"), mask)
    result = recolored_rgb.convert("RGBA")
    result.putalpha(source.getchannel("A"))
    return result


def normalize_frame(image: Image.Image, reference_width: int) -> Image.Image:
    """Keep a pack's scale fixed to its finished frame and align all bases."""
    image = image.convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("source sprite is fully transparent")
    cutout = image.crop(bounds)
    scale = FIT_PX / reference_width
    resized = cutout.resize(
        (max(1, round(cutout.width * scale)), max(1, round(cutout.height * scale))),
        Image.Resampling.LANCZOS,
    )
    if resized.width > FRAME_PX - 2 * BOTTOM_MARGIN_PX:
        raise ValueError("fixed-scale sprite exceeds the shared frame width")
    if resized.height > FRAME_PX - 2 * BOTTOM_MARGIN_PX:
        raise ValueError("fixed-scale sprite exceeds the shared frame height")
    frame = Image.new("RGBA", (FRAME_PX, FRAME_PX), (0, 0, 0, 0))
    x = (FRAME_PX - resized.width) // 2
    y = FRAME_PX - BOTTOM_MARGIN_PX - resized.height
    frame.alpha_composite(resized, (x, y))
    return frame


def write_runtime(frame: Image.Image, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    frame.save(target, "WEBP", quality=88, method=6)


def ground_anchor_y(footprint_cells: int) -> int:
    half_depth = round(
        (footprint_cells / 2) * sqrt(2) * sin(radians(CAMERA_ELEVATION_DEGREES))
        * PIXELS_PER_WORLD_UNIT
    )
    return FRAME_PX - BOTTOM_MARGIN_PX - half_depth


def project_ground_point(x: float, z: float, footprint_cells: int) -> tuple[float, float]:
    azimuth = radians(45)
    elevation = radians(CAMERA_ELEVATION_DEGREES)
    anchor_y = ground_anchor_y(footprint_cells)
    right_x, right_z = cos(azimuth), -sin(azimuth)
    up_x, up_z = sin(elevation) * sin(azimuth), sin(elevation) * cos(azimuth)
    screen_x = FRAME_PX / 2 + (x * right_x + z * right_z) * PIXELS_PER_WORLD_UNIT
    screen_y = anchor_y - (x * up_x + z * up_z) * PIXELS_PER_WORLD_UNIT
    return screen_x, screen_y


def draw_footprint(draw: ImageDraw.ImageDraw, footprint_cells: int, x_offset: int = 0) -> None:
    half = footprint_cells / 2
    coords = [-half + cell for cell in range(footprint_cells + 1)]
    inside = (242, 237, 194, 120)
    outline = (216, 244, 123, 230)
    for x in coords:
        points = [project_ground_point(x, -half, footprint_cells),
                  project_ground_point(x, half, footprint_cells)]
        draw.line([(round(px + x_offset), round(py)) for px, py in points], fill=inside, width=1)
    for z in coords:
        points = [project_ground_point(-half, z, footprint_cells),
                  project_ground_point(half, z, footprint_cells)]
        draw.line([(round(px + x_offset), round(py)) for px, py in points], fill=inside, width=1)
    corners = [project_ground_point(-half, -half, footprint_cells),
               project_ground_point(half, -half, footprint_cells),
               project_ground_point(half, half, footprint_cells),
               project_ground_point(-half, half, footprint_cells)]
    draw.line([(round(px + x_offset), round(py)) for px, py in (*corners, corners[0])],
              fill=outline, width=3)


def build_contact_sheet(root: Path, states: tuple[str, ...], team: str,
                        footprint_cells: int) -> None:
    width = FRAME_PX * len(states)
    sheet = Image.new("RGBA", (width, FRAME_PX + 48), (87, 105, 70, 255))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    for index, state in enumerate(states):
        frame_path = root / "runtime" / f"{root.name.removesuffix('-sprite-v1')}-{state}-{team}.webp"
        frame = Image.open(frame_path).convert("RGBA")
        x_offset = index * FRAME_PX
        for cell in range(1, 5):
            coordinate = cell * PIXELS_PER_WORLD_UNIT
            draw.line((x_offset + coordinate, 0, x_offset + coordinate, FRAME_PX),
                      fill=(231, 237, 205, 58), width=1)
            draw.line((x_offset, coordinate, x_offset + FRAME_PX, coordinate),
                      fill=(231, 237, 205, 58), width=1)
        sheet.alpha_composite(frame, (x_offset, 0))
        draw_footprint(draw, footprint_cells, x_offset)
        label = state.replace("-", " ").upper()
        draw.text((x_offset + 12, FRAME_PX + 14), label, fill=(249, 244, 223, 255), font=font)
    preview = root / "preview"
    preview.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(preview / f"{team}-grid.png", optimize=True)


def prepare_pack(asset: str) -> None:
    pack = PACKS[asset]
    root = pack["root"]
    states = pack["states"]
    footprint_cells = pack["footprint_cells"]
    source_dir = root / "source"
    runtime_dir = root / "runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    complete_path = source_dir / f"{asset}-complete.png"
    complete = Image.open(complete_path).convert("RGBA")
    complete_bounds = complete.getchannel("A").getbbox()
    if complete_bounds is None:
        raise ValueError(f"{complete_path} is fully transparent")
    reference_width = complete_bounds[2] - complete_bounds[0]

    for state in states:
        source_path = source_dir / f"{asset}-{state}.png"
        original = Image.open(source_path).convert("RGBA")
        normalized_source = normalize_frame(original, reference_width)
        normalized_source_path = source_dir / "normalized" / f"{asset}-{state}.png"
        normalized_source_path.parent.mkdir(parents=True, exist_ok=True)
        normalized_source.save(normalized_source_path, "PNG", optimize=True)
        for team, source in (("azure", normalized_source), ("ember", recolor_ember(original))):
            frame = source if team == "azure" else normalize_frame(source, reference_width)
            target = runtime_dir / f"{asset}-{state}-{team}.webp"
            write_runtime(frame, target)
    for team in ("azure", "ember"):
        build_contact_sheet(root, states, team, footprint_cells)
    print(
        f"{asset}: wrote {len(states) * 2} {FRAME_PX}×{FRAME_PX} runtime frames; "
        f"reference alpha width {reference_width}px; "
        f"{footprint_cells}×{footprint_cells} anchor y={ground_anchor_y(footprint_cells)}px."
    )


def main() -> None:
    parser = ArgumentParser()
    parser.add_argument("--asset", choices=tuple(PACKS), required=True)
    args = parser.parse_args()
    prepare_pack(args.asset)


if __name__ == "__main__":
    main()
