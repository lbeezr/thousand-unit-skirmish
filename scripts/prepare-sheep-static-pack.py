#!/usr/bin/env python3
"""Build preview-only Sheep pages; source bytes are never modified."""
import argparse
from collections import deque
import hashlib
import json
from pathlib import Path
import shutil
from PIL import Image

PUBLIC_INPUT_SHA = "0ff688101304a7c10e181b3363ce767e8fb0082d0f754817edee81e04a9bf904"
PUBLIC_INPUT_URL = "https://github.com/lbeezr/thousand-unit-skirmish/blob/02e3ac9434ac0970dbe307f44791a40ffd61ba82/docs/art-direction/bellweather-sheep-model-input-v1/bellweather-sheep-model-input-yaw-000-v1.png"
DIRECTIONS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
SIZE = 512

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def remove_reference_matte(image):
    # Remove only border-connected neutral background/shadow. Interior highlights
    # survive. This is a provisional matte, not a newly rendered model rotation.
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    seen = bytearray(width * height)
    queue = deque()
    def add(x, y):
        index = y * width + x
        if seen[index]:
            return
        r, g, b = pixels[x, y]
        if min(r, g, b) >= 120 and (max(r, g, b) - min(r, g, b) <= 30 or min(r, g, b) >= 234):
            seen[index] = 1
            queue.append((x, y))
    for x in range(width):
        add(x, 0)
        add(x, height - 1)
    for y in range(height):
        add(0, y)
        add(width - 1, y)
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
            if 0 <= nx < width and 0 <= ny < height:
                add(nx, ny)
    result = rgb.convert("RGBA")
    result.putalpha(Image.frombytes("L", rgb.size, bytes(0 if value else 255 for value in seen)))
    return result.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

def bleed(image):
    # Same nearest-color propagation as prepare-unit-sprite-atlas.mjs, per frame.
    result = image.copy()
    width, height = image.size
    pixels = result.load()
    seen = bytearray(width * height)
    queue = deque()
    for y in range(height):
        for x in range(width):
            if pixels[x, y][3]:
                seen[y * width + x] = 1
                queue.append((x, y))
    if not queue:
        raise ValueError("Empty frame")
    while queue:
        x, y = queue.popleft()
        color = pixels[x, y][:3]
        for nx, ny in ((x, y-1), (x+1, y), (x, y+1), (x-1, y)):
            if not (0 <= nx < width and 0 <= ny < height):
                continue
            index = ny * width + nx
            if seen[index]:
                continue
            seen[index] = 1
            pixels[nx, ny] = (*color, pixels[nx, ny][3])
            queue.append((nx, ny))
    return result

def bounds(image):
    box = image.getchannel("A").point(lambda a: 255 if a >= 8 else 0).getbbox()
    if not box or min(box[0], box[1], SIZE-box[2], SIZE-box[3]) < 2:
        raise ValueError("Empty or clipped frame")
    return dict(x=box[0], y=box[1], width=box[2]-box[0], height=box[3]-box[1])

def cloud_inputs(directory, contract):
    views = contract["views"]
    if len(views) != 8 or contract["camera"]["resolution"] != [512, 512]:
        raise ValueError("Requires exactly eight 512 px captures")
    if contract["camera"]["root_pixel_from_upper_left"] != [256, 256]:
        raise ValueError("Unexpected ground registration")
    if contract["camera"]["projected_pixels_per_world_unit"] != 256:
        raise ValueError("Unexpected projected world scale")
    if contract["renderSettings"]["floor_in_color_frames"] or contract["renderSettings"]["contact_shadow_layer"]["accepted"]:
        raise ValueError("Only approved no-floor/no-shadow color frames are supported")
    images = []
    for index, view in enumerate(views):
        expected = f"sheep-yaw-{index*45:03d}.png"
        if view["filename"] != expected or view["world_yaw_degrees"] != index*45 or view["clip_key"] != DIRECTIONS[index]:
            raise ValueError("Unexpected nose-yaw sequence")
        path = directory / expected
        if digest(path) != view["sha256"]:
            raise ValueError(f"Source hash mismatch: {expected}")
        with Image.open(path) as source:
            source.load()
            if source.size != (512, 512) or source.mode != "RGBA":
                raise ValueError(f"Requires RGBA8 capture: {expected}")
            image = source.copy()
        if image.getchannel("A").getextrema() != (0, 255):
            raise ValueError(f"Requires transparent/full-opacity pixels: {expected}")
        box = bounds(image)
        exclusive = list(image.getchannel("A").getbbox())
        if exclusive != view["alpha_bbox_exclusive"] or view["pivot_pixel_from_upper_left"] != [256, 256]:
            raise ValueError(f"Source registration mismatch: {expected}")
        images.append((path, image, DIRECTIONS[index], {"x": 256, "y": 256}))
    return images

def build(args):
    destination = args.output.resolve()
    if destination.exists():
        raise ValueError("Output must be a new directory; source packages are immutable")
    if args.public_reference:
        source = args.public_reference.resolve()
        if digest(source) != PUBLIC_INPUT_SHA:
            raise ValueError("Public reference input hash mismatch")
        with Image.open(source) as image:
            image.load()
            if image.size != (1254, 1254) or image.mode != "RGB":
                raise ValueError("Unexpected public reference format")
            cutout = remove_reference_matte(image)
        images = [(source, cutout, "north", {"x": 670*512/1254, "y": 1049*512/1254})]
        pack_id = "bellweather-sheep-public-reference-v1"
        pixels_per_world = 512  # display trial; not measured anatomy/camera calibration
        art_bounds = {"min": [-.5, 0, -.5], "max": [.5, .8, .5]}
        height = .8
        calibrated = False
    else:
        if not args.contract:
            raise ValueError("--contract is required with --cloud-views")
        contract = json.loads(args.contract.read_text())
        images = cloud_inputs(args.cloud_views.resolve(), contract)
        pack_id = "bellweather-sheep-static-v1"
        pixels_per_world = 256
        low, high = contract["measurements"]["full_geometry_bounds_world"]
        art_bounds = {"min": low, "max": high}
        height = high[1]
        calibrated = True
    # All inputs pass before writing anything.
    for _, image, _, _ in images:
        bounds(image)
    destination.mkdir(parents=True)
    source_dir = destination / "source"
    source_dir.mkdir()
    capture_record = None
    if calibrated:
        shutil.copyfile(args.contract, source_dir / "capture-contract.json")
        capture_record = {
            "path": "source/capture-contract.json", "sha256": digest(args.contract),
            "bytes": args.contract.stat().st_size,
            "authority": "Consumed producer contract; not consumer render or pixel evidence",
        }
    records = []
    columns = min(4, len(images))
    rows = (len(images) + columns - 1) // columns
    source_atlas = Image.new("RGBA", (columns*SIZE, rows*SIZE))
    runtime_atlas = source_atlas.copy()
    frames, clips = [], []
    for index, (source, image, direction, pivot) in enumerate(images):
        shutil.copyfile(source, source_dir / source.name)
        records.append({"filename": source.name, "sha256": digest(source), "bytes": source.stat().st_size, "directionId": direction})
        x, y = (index % columns)*SIZE, (index // columns)*SIZE
        source_atlas.paste(image, (x, y))
        runtime_atlas.paste(bleed(image), (x, y))
        rect = {"x": x, "y": y, "width": SIZE, "height": SIZE}
        frame_id = f"idle-{direction}"
        frames.append({
            "id": frame_id, "canvasPx": {"width": SIZE, "height": SIZE},
            "groundPivotPx": pivot, "groundPivotStatus": "unreviewed-estimate",
            "alphaBoundsPx": bounds(image),
            "fallbackRectPx": {"pageId": "sheep-color", "rectPx": rect},
            "frameRectsPx": [{"layerId": "actor", "pageId": "sheep-color", "rectPx": rect, "offsetPx": {"x": 0, "y": 0}}],
        })
        clips.append({"stateId": "idle", "directionId": direction, "loop": False, "sequence": [{"frameId": frame_id, "durationMs": 1000}]})
    source_atlas.save(destination / "sheep-atlas-source.png", compress_level=9)
    runtime_atlas.save(destination / "sheep-atlas-runtime.png", compress_level=9)
    dimensions = {"width": columns*SIZE, "height": rows*SIZE}
    files = [{"id": f"sheep-{usage}", "path": f"sheep-atlas-{usage}.png", "usage": usage, "format": "png",
              "sha256": digest(destination / f"sheep-atlas-{usage}.png"), "dimensionsPx": dimensions} for usage in ("source", "runtime")]
    manifest = {
        "schemaVersion": 1, "packId": pack_id, "packVersion": "0.1.0", "maturity": "runtime-candidate",
        "provenance": {"license": "project-generated reference; no new SPDX license asserted", "source": PUBLIC_INPUT_URL if not calibrated else "Preserved producer color captures; exact hashes in source-records.json",
                       "authoringTool": "Pillow; deterministic packing and RGB bleed", "notes": "Preview only. Static idle clips; no walk/graze/dispatch/carcass/depletion animation. Pivots require runtime review."},
        "files": files,
        "pages": [{"id": "sheep-color", "sourceFileId": "sheep-source", "runtimeFileId": "sheep-runtime",
                   "dimensionsPx": dimensions, "colorSpace": "srgb", "pixelFormat": "rgba8", "alphaMode": "straight",
                   "edgeRule": "bleed-rgb-under-transparent", "gutterPx": 0, "gutterRule": "none", "wrapMode": "clamp",
                   "sampling": {"generateMipmaps": False, "minFilter": "linear", "magFilter": "linear", "uvInsetPx": .5, "maxMipLevel": 0}}],
        "assets": [{"id": "bellweather-sheep", "kind": "prop", "artBoundsWorld": art_bounds, "heightWorld": height,
                    "sortAnchorWorld": [0, 0, 0], "layers": [{"id": "actor", "drawLayer": "actor"}], "frames": frames, "clips": clips}],
    }
    binding = {
        "schemaVersion": 1, "packId": pack_id, "assetId": "bellweather-sheep", "manifest": "sprite-atlas-pack-v1.json",
        "manifestSha256": None, "previewOnly": True, "stateId": "idle", "animations": [],
        "projectedPixelsPerWorldUnit": pixels_per_world, "cameraCalibrated": calibrated,
        "noseYawOnly": calibrated, "headBodyOffsetDegrees": 42.03499984741211 if calibrated else None,
        "directions": [item[2] for item in images],
        "unavailableStates": ["walk", "graze", "dispatch", "carcass", "depleted"],
        "registration": "producer ground-root projection; consumer pivot review pending" if calibrated else "Illustrated reference: estimated hoof-center (670,1049) at original 1254 px; nominal width display trial. No calibrated anatomy or yaw.",
        "source": "source/capture-contract.json" if calibrated else PUBLIC_INPUT_URL,
        "transform": "Unchanged 512 px captures packed 4x2; RGB bleed only, alpha unchanged." if calibrated else "Border-connected neutral matte/shadow removal; 1254 to 512 LANCZOS. Original RGB input preserved unchanged.",
    }
    def write(name, data):
        (destination / name).write_text(json.dumps(data, indent=2) + "\n")
    write("sprite-atlas-pack-v1.json", manifest)
    binding["manifestSha256"] = digest(destination / "sprite-atlas-pack-v1.json")
    write("static-preview-binding.json", binding)
    write("source-records.json", {
        "upstreamIllustration": {"url": PUBLIC_INPUT_URL, "sha256": PUBLIC_INPUT_SHA},
        "captureContract": capture_record,
        "originalViewsPreserved": True, "records": records,
    })
    print(json.dumps({"directory": str(destination), "packId": pack_id, "frames": len(frames), "animations": [], "cameraCalibrated": calibrated}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument("--public-reference", type=Path)
    inputs.add_argument("--cloud-views", type=Path)
    parser.add_argument("--contract", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    build(parser.parse_args())
