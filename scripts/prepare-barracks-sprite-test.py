#!/usr/bin/env python3
"""Normalize the bounded Barracks sprite study into shared grid frames."""

from math import cos, radians, sin, sqrt
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1] / "assets/buildings/barracks-sprite-test-v1"
SOURCE = ROOT / "source"
RUNTIME = ROOT / "runtime"
PREVIEW = ROOT / "preview"

STATES = (
    ("foundation", "Barracks foundation"),
    ("frame", "Rising frame"),
    ("complete", "Complete"),
    ("damaged", "Damaged"),
    ("critical", "Critical damage"),
)
FRAME_CELLS = 5
FOOTPRINT_CELLS = 3
FRAME_PX = 640
PIXELS_PER_WORLD_UNIT = 128
FRAME_WORLD_UNITS = FRAME_PX / PIXELS_PER_WORLD_UNIT
FIT_PX = 560
BOTTOM_MARGIN_PX = 4
CAMERA_ELEVATION_DEGREES = 46
GROUND_HALF_DEPTH_PX = round(
    (FOOTPRINT_CELLS / 2) * sqrt(2) * sin(radians(CAMERA_ELEVATION_DEGREES))
    * PIXELS_PER_WORLD_UNIT
)
GROUND_ANCHOR_Y = FRAME_PX - BOTTOM_MARGIN_PX - GROUND_HALF_DEPTH_PX


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


def normalize_frame(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    alpha_bounds = image.getchannel("A").getbbox()
    if alpha_bounds is None:
        raise ValueError("source sprite is fully transparent")
    cutout = image.crop(alpha_bounds)
    scale = min(FIT_PX / cutout.width, FIT_PX / cutout.height)
    resized = cutout.resize(
        (max(1, round(cutout.width * scale)), max(1, round(cutout.height * scale))),
        Image.Resampling.LANCZOS,
    )
    frame = Image.new("RGBA", (FRAME_PX, FRAME_PX), (0, 0, 0, 0))
    x = (FRAME_PX - resized.width) // 2
    y = FRAME_PX - BOTTOM_MARGIN_PX - resized.height
    frame.alpha_composite(resized, (x, y))
    return frame


def write_runtime(frame: Image.Image, name: str) -> None:
    target = RUNTIME / f"barracks-{name}.webp"
    frame.save(target, "WEBP", quality=88, method=6)


def project_ground_point(x: float, z: float) -> tuple[float, float]:
    azimuth = radians(45)
    elevation = radians(CAMERA_ELEVATION_DEGREES)
    right_x, right_z = cos(azimuth), -sin(azimuth)
    up_x, up_z = sin(elevation) * sin(azimuth), sin(elevation) * cos(azimuth)
    screen_x = FRAME_PX / 2 + (x * right_x + z * right_z) * PIXELS_PER_WORLD_UNIT
    screen_y = GROUND_ANCHOR_Y - (x * up_x + z * up_z) * PIXELS_PER_WORLD_UNIT
    return screen_x, screen_y


def draw_frame_grid(draw: ImageDraw.ImageDraw, x_offset: int) -> None:
    grid_color = (231, 237, 205, 58)
    for cell in range(1, FRAME_CELLS):
        coordinate = cell * PIXELS_PER_WORLD_UNIT
        draw.line((x_offset + coordinate, 0, x_offset + coordinate, FRAME_PX), fill=grid_color, width=1)
        draw.line((x_offset, coordinate, x_offset + FRAME_PX, coordinate), fill=grid_color, width=1)


def draw_ground_footprint(draw: ImageDraw.ImageDraw, x_offset: int) -> None:
    half = FOOTPRINT_CELLS / 2
    bounds = [-half + cell for cell in range(FOOTPRINT_CELLS + 1)]
    internal_color = (242, 237, 194, 120)
    outline_color = (216, 244, 123, 230)
    for x in bounds:
        points = [project_ground_point(x, -half), project_ground_point(x, half)]
        draw.line([(round(x_offset + px), round(py)) for px, py in points], fill=internal_color, width=1)
    for z in bounds:
        points = [project_ground_point(-half, z), project_ground_point(half, z)]
        draw.line([(round(x_offset + px), round(py)) for px, py in points], fill=internal_color, width=1)
    corners = [project_ground_point(-half, -half), project_ground_point(half, -half),
               project_ground_point(half, half), project_ground_point(-half, half)]
    draw.line([(round(x_offset + px), round(py)) for px, py in (*corners, corners[0])], fill=outline_color, width=3)


def build_contact_sheet(team: str) -> None:
    names = [f"barracks-{state}-{team}.webp" for state, _ in STATES]
    background = Image.new("RGBA", (FRAME_PX * len(names), FRAME_PX + 64), (87, 105, 70, 255))
    draw = ImageDraw.Draw(background)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 19)
    except OSError:
        font = ImageFont.load_default()
    for index, ((state, label), name) in enumerate(zip(STATES, names)):
        frame = Image.open(RUNTIME / name).convert("RGBA")
        x0 = index * FRAME_PX
        draw_frame_grid(draw, x0)
        background.alpha_composite(frame, (x0, 0))
        draw_ground_footprint(draw, x0)
        draw.text((x0 + 12, FRAME_PX + 18), label, fill=(249, 244, 223, 255), font=font)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    background.convert("RGB").save(PREVIEW / f"barracks-{team}-grid.png", optimize=True)


def main() -> None:
    SOURCE.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for state, _ in STATES:
        source_path = SOURCE / f"barracks-{state}.png"
        if not source_path.exists():
            raise FileNotFoundError(f"missing generated source: {source_path}")
        original = Image.open(source_path).convert("RGBA")
        azure_frame = normalize_frame(original)
        ember_frame = normalize_frame(recolor_ember(original))
        write_runtime(azure_frame, f"{state}-azure")
        write_runtime(ember_frame, f"{state}-ember")
    build_contact_sheet("azure")
    build_contact_sheet("ember")
    print(
        f"Wrote 10 team/state frames at {FRAME_PX}x{FRAME_PX}; "
        f"{PIXELS_PER_WORLD_UNIT} px/world unit; {FRAME_WORLD_UNITS:g}x{FRAME_WORLD_UNITS:g} world-unit art frame; "
        f"ground anchor at y={GROUND_ANCHOR_Y}px from the top."
    )


if __name__ == "__main__":
    main()
