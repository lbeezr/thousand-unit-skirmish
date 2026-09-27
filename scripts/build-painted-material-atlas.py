#!/usr/bin/env python3
"""Build the Frontier painted ground atlas and its deterministic runtime mip chain."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, __version__ as pillow_version


ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "assets/environment/frontier-painted-material-atlas-v1"
PACK_ID = "frontier-painted-material-atlas-v1"
PACK_VERSION = "1.0.0"
MATERIALS = (
    "meadow",
    "short-grass",
    "long-grass",
    "forest-floor",
    "dirt",
    "sand",
    "scree",
    "cinder",
)
MATERIAL_SIZE = 512
GUTTER = 64
SLOT_SIZE = MATERIAL_SIZE + 2 * GUTTER
COLUMNS = 3
ROWS = 3
PAGE_SIZE = SLOT_SIZE * COLUMNS
MAX_MIP_LEVEL = 5
ATLAS_NAME = "frontier-painted-material-atlas"
SOURCE_ATLAS_PATH = f"assets/environment/frontier-painted-material-atlas-v1/{ATLAS_NAME}.png"
PREVIEW_PATH = f"assets/environment/frontier-painted-material-atlas-v1/preview.png"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def webp_bytes(image: Image.Image, level: int) -> bytes:
    output = io.BytesIO()
    if level >= 4:
        # Slot pitches from level 4 onward are not aligned to common lossy
        # compression blocks. Keep these small mips lossless so adjacent
        # materials cannot share a lossy chroma/DCT block.
        image.save(output, format="WEBP", lossless=True, exact=True, method=4, quality=100)
    else:
        image.save(output, format="WEBP", lossless=False, method=4, quality=86)
    return output.getvalue()


def reflected_slot(source: Image.Image) -> Image.Image:
    slot = Image.new("RGB", (SLOT_SIZE, SLOT_SIZE))
    slot.paste(source, (GUTTER, GUTTER))

    left = source.crop((0, 0, GUTTER, MATERIAL_SIZE)).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    right = source.crop((MATERIAL_SIZE - GUTTER, 0, MATERIAL_SIZE, MATERIAL_SIZE)) \
        .transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    top = source.crop((0, 0, MATERIAL_SIZE, GUTTER)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    bottom = source.crop((0, MATERIAL_SIZE - GUTTER, MATERIAL_SIZE, MATERIAL_SIZE)) \
        .transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    slot.paste(left, (0, GUTTER))
    slot.paste(right, (GUTTER + MATERIAL_SIZE, GUTTER))
    slot.paste(top, (GUTTER, 0))
    slot.paste(bottom, (GUTTER, GUTTER + MATERIAL_SIZE))

    corners = (
        (0, 0, GUTTER, GUTTER, 0, 0, Image.Transpose.FLIP_LEFT_RIGHT, Image.Transpose.FLIP_TOP_BOTTOM),
        (MATERIAL_SIZE - GUTTER, 0, MATERIAL_SIZE, GUTTER,
         GUTTER + MATERIAL_SIZE, 0, Image.Transpose.FLIP_LEFT_RIGHT, Image.Transpose.FLIP_TOP_BOTTOM),
        (0, MATERIAL_SIZE - GUTTER, GUTTER, MATERIAL_SIZE,
         0, GUTTER + MATERIAL_SIZE, Image.Transpose.FLIP_LEFT_RIGHT, Image.Transpose.FLIP_TOP_BOTTOM),
        (MATERIAL_SIZE - GUTTER, MATERIAL_SIZE - GUTTER, MATERIAL_SIZE, MATERIAL_SIZE,
         GUTTER + MATERIAL_SIZE, GUTTER + MATERIAL_SIZE,
         Image.Transpose.FLIP_LEFT_RIGHT, Image.Transpose.FLIP_TOP_BOTTOM),
    )
    for x0, y0, x1, y1, dest_x, dest_y, flip_x, flip_y in corners:
        patch = source.crop((x0, y0, x1, y1)).transpose(flip_x).transpose(flip_y)
        slot.paste(patch, (dest_x, dest_y))
    return slot


def preview_bytes(slots: list[Image.Image]) -> bytes:
    width, height = 1900, 1050
    image = Image.new("RGB", (width, height), (245, 242, 233))
    draw = ImageDraw.Draw(image)
    try:
        title_font = ImageFont.truetype("DejaVuSans.ttf", 34)
        label_font = ImageFont.truetype("DejaVuSans.ttf", 22)
        note_font = ImageFont.truetype("DejaVuSans.ttf", 18)
    except OSError:
        title_font = label_font = note_font = ImageFont.load_default()
    draw.text((40, 24), "Frontier painted ground atlas", fill=(45, 47, 41), font=title_font)
    draw.text((42, 73), "Each swatch repeats with mirrored UVs; source crop, before gameplay integration.",
              fill=(87, 88, 79), font=note_font)

    sample_size = 400
    tile_size = sample_size // 2
    for index, (name, slot) in enumerate(zip(MATERIALS, slots)):
        column = index % 4
        row = index // 4
        x = 40 + column * 455
        y = 120 + row * 450
        tile = slot.crop((GUTTER, GUTTER, GUTTER + MATERIAL_SIZE, GUTTER + MATERIAL_SIZE))
        tile = tile.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
        swatch = Image.new("RGB", (sample_size, sample_size))
        swatch.paste(tile, (0, 0))
        swatch.paste(tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (tile_size, 0))
        swatch.paste(tile.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, tile_size))
        swatch.paste(tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                     .transpose(Image.Transpose.FLIP_TOP_BOTTOM), (tile_size, tile_size))
        image.paste(swatch, (x, y))
        draw.rectangle((x, y, x + sample_size - 1, y + sample_size - 1), outline=(111, 107, 95), width=2)
        draw.text((x, y + sample_size + 10), name, fill=(45, 47, 41), font=label_font)
    return png_bytes(image)


def file_entry(file_id: str, relative_path: str, usage: str, format_name: str, data: bytes,
               dimensions: tuple[int, int]) -> dict:
    return {
        "id": file_id,
        "path": relative_path,
        "usage": usage,
        "format": format_name,
        "sha256": sha256(data),
        "dimensionsPx": {"width": dimensions[0], "height": dimensions[1]},
    }


def build_outputs() -> dict[str, bytes]:
    output_bytes: dict[str, bytes] = {}
    source_images: dict[str, Image.Image] = {}
    source_entries: list[dict] = []
    for name in MATERIALS:
        relative = f"assets/environment/frontier-v1/{name}.png"
        source_path = ROOT / relative
        source_data = source_path.read_bytes()
        with Image.open(source_path) as opened:
            source = opened.convert("RGB")
            dimensions = source.size
            source_images[name] = source.resize(
                (MATERIAL_SIZE, MATERIAL_SIZE), Image.Resampling.LANCZOS)
        source_entries.append(file_entry(f"source-{name}", relative, "source", "png",
                                         source_data, dimensions))

    slots = [reflected_slot(source_images[name]) for name in MATERIALS]
    source_atlas = Image.new("RGB", (PAGE_SIZE, PAGE_SIZE), (0, 0, 0))
    for index, slot in enumerate(slots):
        x = (index % COLUMNS) * SLOT_SIZE
        y = (index // COLUMNS) * SLOT_SIZE
        source_atlas.paste(slot, (x, y))
    atlas_path = PACK / f"{ATLAS_NAME}.png"
    atlas_data = png_bytes(source_atlas)
    output_bytes[str(atlas_path.relative_to(ROOT))] = atlas_data
    source_entries.append(file_entry("atlas-source", SOURCE_ATLAS_PATH, "source", "png",
                                     atlas_data, (PAGE_SIZE, PAGE_SIZE)))

    runtime_entries: list[dict] = []
    mip_levels: list[dict] = []
    for level in range(MAX_MIP_LEVEL + 1):
        scale = 1 << level
        cell_size = SLOT_SIZE // scale
        page_size = PAGE_SIZE // scale
        mip_page = Image.new("RGB", (page_size, page_size), (0, 0, 0))
        for index, slot in enumerate(slots):
            mip_slot = slot.resize((cell_size, cell_size), Image.Resampling.LANCZOS)
            x = (index % COLUMNS) * cell_size
            y = (index // COLUMNS) * cell_size
            mip_page.paste(mip_slot, (x, y))
        relative = f"assets/environment/frontier-painted-material-atlas-v1/{ATLAS_NAME}-mip-{level}.webp"
        runtime_data = webp_bytes(mip_page, level)
        output_bytes[relative] = runtime_data
        runtime_entries.append(file_entry(f"atlas-mip-{level}", relative, "runtime", "webp",
                                          runtime_data, (page_size, page_size)))
        mip_levels.append({
            "level": level,
            "fileId": f"atlas-mip-{level}",
            "dimensionsPx": {"width": page_size, "height": page_size},
        })

    preview_data = preview_bytes(slots)
    output_bytes[PREVIEW_PATH] = preview_data
    preview_entry = file_entry("preview-sheet", PREVIEW_PATH, "preview", "png",
                               preview_data, (1900, 1050))

    files = [*source_entries, *runtime_entries, preview_entry]
    materials = []
    for index, name in enumerate(MATERIALS):
        column = index % COLUMNS
        row = index // COLUMNS
        slot_x = column * SLOT_SIZE
        slot_y = row * SLOT_SIZE
        x = slot_x + GUTTER
        y = slot_y + GUTTER
        materials.append({
            "id": name,
            "sourceFileId": f"source-{name}",
            "slotRectPx": {"x": slot_x, "y": slot_y, "width": SLOT_SIZE, "height": SLOT_SIZE},
            "rectPx": {"x": x, "y": y, "width": MATERIAL_SIZE, "height": MATERIAL_SIZE},
            "uvRectTopLeft": {
                "min": {"u": (x + 0.5) / PAGE_SIZE, "v": (y + 0.5) / PAGE_SIZE},
                "max": {"u": (x + MATERIAL_SIZE - 0.5) / PAGE_SIZE,
                        "v": (y + MATERIAL_SIZE - 0.5) / PAGE_SIZE},
            },
            "repeatMode": "mirrored-repeat",
            "worldRepeatUnits": 12,
        })

    manifest = {
        "schemaVersion": 1,
        "packId": PACK_ID,
        "packVersion": PACK_VERSION,
        "provenance": {
            "license": "project-owned",
            "source": "The eight original ground-material source PNGs in assets/environment/frontier-v1; no third-party source imagery.",
            "generator": f"scripts/build-painted-material-atlas.py; Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}; Pillow {pillow_version}; LANCZOS resize; WebP quality 86 mips 0-3, lossless mips 4-5.",
        },
        "files": files,
        "layout": {
            "columns": COLUMNS,
            "rows": ROWS,
            "materialSizePx": MATERIAL_SIZE,
            "gutterPx": GUTTER,
            "gutterRule": "mirrored-repeat",
            "order": list(MATERIALS),
        },
        "page": {
            "id": "frontier-ground-materials",
            "sourceFileId": "atlas-source",
            "dimensionsPx": {"width": PAGE_SIZE, "height": PAGE_SIZE},
            "colorSpace": "srgb",
            "pixelFormat": "rgb8",
            "alphaMode": "opaque",
            "wrapMode": "clamp",
            "gutterPx": GUTTER,
            "gutterRule": "mirrored-repeat",
            "sampling": {
                "generateMipmaps": False,
                "minFilter": "linear-mipmap-linear",
                "magFilter": "linear",
                "uvInsetPx": 0.5,
                "maxMipLevel": MAX_MIP_LEVEL,
            },
            "mipLevels": mip_levels,
        },
        "materials": materials,
    }
    manifest_relative = "assets/environment/frontier-painted-material-atlas-v1/manifest.json"
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    output_bytes[manifest_relative] = manifest_data
    return output_bytes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="regenerate in memory and fail if any committed output differs")
    args = parser.parse_args()
    outputs = build_outputs()
    if args.check:
        differences = []
        expected_paths = set(outputs)
        generated_names = {f"{ATLAS_NAME}.png", "preview.png", "manifest.json"}
        if PACK.exists():
            for existing in PACK.iterdir():
                relative = str(existing.relative_to(ROOT))
                is_mip = existing.name.startswith(f"{ATLAS_NAME}-mip-") and existing.suffix == ".webp"
                if (existing.name in generated_names or is_mip) and relative not in expected_paths:
                    differences.append(f"stale extra {relative}")
        for relative, expected in sorted(outputs.items()):
            path = ROOT / relative
            try:
                actual = path.read_bytes()
            except FileNotFoundError:
                differences.append(f"missing {relative}")
                continue
            if actual != expected:
                differences.append(f"stale {relative}")
        if differences:
            print("Painted-material atlas outputs differ:", file=sys.stderr)
            for difference in differences:
                print(f"- {difference}", file=sys.stderr)
            return 1
        print(f"Painted-material atlas is reproducible: {len(outputs)} outputs match.")
        return 0

    PACK.mkdir(parents=True, exist_ok=True)
    expected_paths = set(outputs)
    generated_names = {f"{ATLAS_NAME}.png", "preview.png", "manifest.json"}
    for existing in PACK.iterdir():
        relative = str(existing.relative_to(ROOT))
        is_mip = existing.name.startswith(f"{ATLAS_NAME}-mip-") and existing.suffix == ".webp"
        if (existing.name in generated_names or is_mip) and relative not in expected_paths:
            if existing.is_file() or existing.is_symlink():
                existing.unlink()
    for relative, data in sorted(outputs.items()):
        destination = ROOT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    print(f"Built {len(outputs)} painted-material atlas outputs in {PACK.relative_to(ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
