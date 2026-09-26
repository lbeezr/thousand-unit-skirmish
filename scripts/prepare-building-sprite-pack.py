#!/usr/bin/env python3
"""Normalize building sprite source art to the shared 5×5 world-unit grid."""

from argparse import ArgumentParser
import hashlib
import json
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
    },
    "town-center": {
        "root": ROOT / "assets/buildings/town-center-sprite-v1",
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


def draw_support_grid(draw: ImageDraw.ImageDraw, support_cells: tuple[int, int],
                      x_offset: int = 0) -> None:
    width_cells, depth_cells = support_cells
    if width_cells <= 0 or depth_cells <= 0:
        return
    half_width = width_cells / 2
    half_depth = depth_cells / 2
    x_coords = [-half_width + cell for cell in range(width_cells + 1)]
    z_coords = [-half_depth + cell for cell in range(depth_cells + 1)]
    inside = (242, 237, 194, 120)
    outline = (216, 244, 123, 230)
    for x in x_coords:
        points = [project_ground_point(x, -half_depth, depth_cells),
                  project_ground_point(x, half_depth, depth_cells)]
        draw.line([(round(px + x_offset), round(py)) for px, py in points], fill=inside, width=1)
    for z in z_coords:
        points = [project_ground_point(-half_width, z, depth_cells),
                  project_ground_point(half_width, z, depth_cells)]
        draw.line([(round(px + x_offset), round(py)) for px, py in points], fill=inside, width=1)
    corners = [project_ground_point(-half_width, -half_depth, depth_cells),
               project_ground_point(half_width, -half_depth, depth_cells),
               project_ground_point(half_width, half_depth, depth_cells),
               project_ground_point(-half_width, half_depth, depth_cells)]
    draw.line([(round(px + x_offset), round(py)) for px, py in (*corners, corners[0])],
              fill=outline, width=3)


def build_contact_sheet(root: Path, states: tuple[str, ...], team: str,
                        support_cells: tuple[int, int], guide_label: str) -> None:
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
        draw_support_grid(draw, support_cells, x_offset)
        label = state.replace("-", " ").upper()
        draw.text((x_offset + 12, FRAME_PX + 14), label, fill=(249, 244, 223, 255), font=font)
    try:
        guide_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 12)
    except OSError:
        guide_font = ImageFont.load_default()
    draw.text((12, FRAME_PX + 32), guide_label, fill=(249, 244, 223, 230), font=guide_font)
    preview = root / "preview"
    preview.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(preview / f"{team}-grid.png", optimize=True)


def image_file_record(root: Path, file_id: str, relative_path: str, usage: str) -> dict:
    image_path = root / relative_path
    with Image.open(image_path) as image:
        dimensions = {"width": image.width, "height": image.height}
    return {
        "id": file_id,
        "path": relative_path,
        "usage": usage,
        "format": image_path.suffix.lstrip(".").lower(),
        "sha256": hashlib.sha256(image_path.read_bytes()).hexdigest(),
        "dimensionsPx": dimensions,
    }


def alpha_bounds(image: Image.Image) -> dict:
    visible = image.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
    bounds = visible.getbbox()
    if bounds is None:
        raise ValueError("runtime sprite is fully transparent")
    return {"x": bounds[0], "y": bounds[1],
            "width": bounds[2] - bounds[0], "height": bounds[3] - bounds[1]}


def write_sprite_atlas_manifest(root: Path, grid: dict) -> None:
    asset = grid["asset"]
    states = tuple(grid["runtimeFrames"]["states"])
    teams = tuple(grid["runtimeFrames"]["teams"])
    width_px, height_px = grid["spriteFrame"]["pixels"]
    anchor_x, anchor_y = grid["spriteFrame"]["anchorPixelFromTopLeft"]
    _, world_depth = grid["spriteFrame"]["worldUnits"]
    render_width, render_height = grid["spriteFrame"]["renderBoundsWorldUnits"]
    gameplay_footprint = grid["worldGrid"].get("gameplayFootprintCells")
    if gameplay_footprint:
        support_cells = tuple(gameplay_footprint)
        guide_label = "GAMEPLAY FOOTPRINT HINT"
    else:
        visual_base = grid["worldGrid"].get("visualBaseCells")
        support_cells = tuple(visual_base) if visual_base else (0, 0)
        guide_label = "VISUAL BASE GUIDE · NO GAMEPLAY OCCUPANCY"

    files = []
    for state in states:
        original = f"source/{asset}-{state}.png"
        normalized = f"source/normalized/{asset}-{state}.png"
        files.append(image_file_record(root, f"{state}-source-original", original, "source"))
        files.append(image_file_record(root, f"{state}-source-grid", normalized, "source"))
        for team in teams:
            runtime = f"runtime/{asset}-{state}-{team}.webp"
            files.append(image_file_record(root, f"{state}-{team}-runtime", runtime, "runtime"))

    pages = []
    frames = []
    clips = []
    for state in states:
        for team in teams:
            page_id = f"{state}-{team}-page"
            runtime_id = f"{state}-{team}-runtime"
            frame_id = f"{state}-{team}"
            pages.append({
                "id": page_id,
                "sourceFileId": f"{state}-source-grid",
                "runtimeFileId": runtime_id,
                "dimensionsPx": {"width": width_px, "height": height_px},
                "colorSpace": grid["runtimeFrames"]["textureColorSpace"],
                "pixelFormat": "rgba8",
                "alphaMode": grid["runtimeFrames"]["alphaMode"],
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
            })
            with Image.open(root / f"runtime/{asset}-{state}-{team}.webp") as runtime_image:
                measured_alpha_bounds = alpha_bounds(runtime_image.convert("RGBA"))
            full_rect = {"x": 0, "y": 0, "width": width_px, "height": height_px}
            frames.append({
                "id": frame_id,
                "canvasPx": {"width": width_px, "height": height_px},
                "groundPivotPx": {"x": anchor_x, "y": anchor_y},
                "groundPivotStatus": "unreviewed-estimate",
                "alphaBoundsPx": measured_alpha_bounds,
                "fallbackRectPx": {"pageId": page_id, "rectPx": full_rect},
                "frameRectsPx": [{
                    "layerId": "building",
                    "pageId": page_id,
                    "rectPx": full_rect,
                    "offsetPx": {"x": 0, "y": 0},
                }],
            })
            clips.append({
                "stateId": state,
                "teamId": team,
                "loop": False,
                "sequence": [{"frameId": frame_id, "durationMs": 1000}],
            })

    occupancy_note = grid["worldGrid"].get("occupancy")
    if gameplay_footprint:
        occupancy_note = (
            f"The {gameplay_footprint[0]}×{gameplay_footprint[1]} recommended footprint is only a hint; "
            "map/gameplay data owns occupied cells."
        )
    if not occupancy_note:
        occupancy_note = "No gameplay occupancy footprint is authored in this sprite pack."
    notes = (
        f"{len(states)} static state(s): {', '.join(states)}. {occupancy_note} "
        f"The [{anchor_x}, {anchor_y}] projected ground-center pivot is an unreviewed estimate. "
        f"Fixed {grid['sourceView']['azimuthDegrees']}° azimuth; no per-pixel depth; renderer integration remains pending."
    )
    half_width = render_width / 2
    half_depth = world_depth / 2
    manifest = {
        "schemaVersion": 1,
        "packId": root.name,
        "packVersion": "1.0.0",
        "maturity": "runtime-candidate",
        "provenance": {
            "license": "project-owned; original AI-generated artwork",
            "source": f"Original {asset.replace('-', ' ').title()} source frames and unchanged sprite-grid.json; team runtime variants from the existing pack.",
            "authoringTool": "OpenAI ImageGen; Pillow source normalization and team recolor; WebP packaging.",
            "notes": notes,
        },
        "files": files,
        "pages": pages,
        "assets": [{
            "id": asset,
            "kind": "building",
            **({"recommendedTileFootprint": {
                "widthTiles": gameplay_footprint[0],
                "heightTiles": gameplay_footprint[1],
            }} if gameplay_footprint else {}),
            "artBoundsWorld": {
                "min": [-half_width, 0, -half_depth],
                "max": [half_width, render_height, half_depth],
            },
            "heightWorld": render_height,
            "sortAnchorWorld": [0, 0, 0],
            "layers": [{
                "id": "building",
                "drawLayer": "midground",
                "batchKey": f"building.{asset}",
                "depthBiasWorld": 0,
            }],
            "frames": frames,
            "clips": clips,
        }],
    }
    (root / "sprite-atlas-pack-v1.json").write_text(json.dumps(manifest, indent=2) + "\n")


def prepare_pack(asset: str) -> None:
    pack = PACKS[asset]
    root = pack["root"]
    grid = json.loads((root / "sprite-grid.json").read_text())
    if grid.get("asset") != asset:
        raise ValueError(f"{root / 'sprite-grid.json'} names asset {grid.get('asset')!r}, expected {asset!r}")
    states = tuple(grid["runtimeFrames"]["states"])
    teams = tuple(grid["runtimeFrames"]["teams"])
    gameplay_footprint = grid["worldGrid"].get("gameplayFootprintCells")
    visual_base = grid["worldGrid"].get("visualBaseCells")
    support_cells = tuple(gameplay_footprint or visual_base or (0, 0))
    guide_label = ("GAMEPLAY FOOTPRINT HINT" if gameplay_footprint
                   else "VISUAL BASE GUIDE · NO GAMEPLAY OCCUPANCY")
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
        for team in teams:
            if team == "azure":
                source = original
            elif team == "ember":
                source = recolor_ember(original)
            else:
                raise ValueError(f"unsupported building sprite team variant {team!r}")
            frame = normalized_source if team == "azure" else normalize_frame(source, reference_width)
            target = runtime_dir / f"{asset}-{state}-{team}.webp"
            write_runtime(frame, target)
    for team in teams:
        build_contact_sheet(root, states, team, support_cells, guide_label)
    write_sprite_atlas_manifest(root, grid)
    print(
        f"{asset}: wrote {len(states) * len(teams)} {FRAME_PX}×{FRAME_PX} runtime frames and canonical sprite-atlas-pack-v1.json; "
        f"reference alpha width {reference_width}px; "
        f"{support_cells[0]}×{support_cells[1]} visual support guide; "
        f"anchor y={ground_anchor_y(support_cells[1])}px."
    )


def main() -> None:
    parser = ArgumentParser()
    parser.add_argument("--asset", choices=tuple(PACKS), required=True)
    args = parser.parse_args()
    prepare_pack(args.asset)


if __name__ == "__main__":
    main()
