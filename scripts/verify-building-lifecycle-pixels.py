"""Decode and validate capture pixels, then produce labeled fixture review sheets."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect(folder, write_sheets=False):
    folder = Path(folder)
    manifest = json.loads((folder / "renderer-manifest.json").read_text())
    synthetic = manifest.get("syntheticFixture", False)
    if manifest.get("runtimeAdoption") is not False:
        raise ValueError("Pilot must not claim runtime adoption")
    entries = {entry["state"]: entry for entry in [manifest["completeState"], *manifest["states"]]}
    dimensions = tuple(manifest["camera"]["framePixels"])
    checks = []
    previews = []
    selected = []
    for state in manifest["stateOrder"]:
        for view in entries[state]["views"]:
            color_path = folder / view["path"]
            mask_path = folder / view["teamMaskPath"]
            if digest(color_path) != view["sha256"] or digest(mask_path) != view["teamMaskSha256"]:
                raise ValueError("Capture hash mismatch")
            with Image.open(color_path) as im:
                im.load()
                color = np.array(im.convert("RGBA"))
                if im.size != dimensions:
                    raise ValueError("Color dimensions differ")
                alpha_bounds = im.getchannel("A").getbbox()
            with Image.open(mask_path) as im:
                im.load()
                mask = np.array(im.convert("RGBA"))
                if im.size != dimensions:
                    raise ValueError("Mask dimensions differ")
            if not alpha_bounds:
                raise ValueError("Empty color frame")
            x0, y0, x1, y1 = alpha_bounds
            if min(x0, y0, dimensions[0] - x1, dimensions[1] - y1) < 4:
                raise ValueError("Clipped or insufficiently padded fixture")
            if np.any(mask[:, :, 0] != mask[:, :, 1]) or np.any(mask[:, :, 1] != mask[:, :, 2]):
                raise ValueError("Mask is not grayscale")
            if np.any((mask[:, :, 3] > 2) & (mask[:, :, 0] < 253)):
                raise ValueError("Runtime mask must use white RGB and alpha owner coverage")
            alpha_excess = int(np.maximum(mask[:, :, 3].astype(int) - color[:, :, 3].astype(int), 0).max())
            outside = int(np.sum((mask[:, :, 3] > 2) & (color[:, :, 3] == 0)))
            if alpha_excess > 2 or outside:
                raise ValueError(f"Color/mask coverage mismatch: excess={alpha_excess}, outside={outside}")
            mask_pixels = int(np.sum(mask[:, :, 3] > 2))
            checks.append({"state": state, "view": view["index"], "alphaBounds": list(alpha_bounds),
                           "maximumMaskAlphaExcess": alpha_excess, "maskOutsideColorPixels": outside,
                           "maskNonzeroPixels": mask_pixels})
            if view["index"] == 1:
                previews.append(Image.fromarray(color))
                selected.append((state, Image.fromarray(color), Image.fromarray(mask)))
    if len(checks) != 40:
        raise ValueError("Expected forty decoded color/mask pairs")
    for state in manifest["stateOrder"]:
        if not any(c["maskNonzeroPixels"] for c in checks if c["state"] == state):
            raise ValueError("Owner cue is absent in every direction of a state")
    if len({entry["views"][1]["sha256"] for entry in entries.values()}) != 5:
        raise ValueError("Lifecycle views did not change")
    if write_sheets:
        header = "SYNTHETIC FIXTURE — pipeline test, not approved Town Center" if synthetic else "AUTHORED CANDIDATE — requires art review"
        width, height = 320, 400
        sheet = Image.new("RGB", (width * 5, height), (234, 231, 220))
        draw = ImageDraw.Draw(sheet)
        draw.text((18, 12), header, fill=(110, 24, 24))
        for i, (state, color, mask) in enumerate(selected):
            cell = color.resize((width, width), Image.Resampling.LANCZOS)
            sheet.paste(cell, (i * width, 48), cell)
            draw.text((i * width + 16, 374), state.upper(), fill=(30, 36, 30))
        sheet.save(folder / "synthetic-five-state-comparison.png" if synthetic else folder / "candidate-five-state-comparison.png")
        contact = Image.new("RGB", (256 * 8, 256 * 5 + 42), (234, 231, 220))
        d = ImageDraw.Draw(contact)
        d.text((16, 12), header + " | eight views per state", fill=(110, 24, 24))
        for row, state in enumerate(manifest["stateOrder"]):
            for view in entries[state]["views"]:
                with Image.open(folder / view["path"]) as im:
                    im = im.convert("RGBA").resize((256, 256), Image.Resampling.LANCZOS)
                    xy = (view["index"] * 256, row * 256 + 42)
                    contact.paste(im, xy, im)
                    d.text((xy[0] + 8, xy[1] + 232), f"{state} / {view['index'] * 45} deg", fill=(30, 36, 30))
        contact.save(folder / "synthetic-eight-view-contact-sheet.png" if synthetic else folder / "candidate-eight-view-contact-sheet.png")
    result = {"schema": "thousand-unit-skirmish.lifecycle-pixel-validation.v2",
              "syntheticFixture": synthetic, "runtimeAdoption": False, "decodedPairs": len(checks),
              "teamMaskEncoding": "rgba-white-owner-alpha-coverage",
              "maximumMaskAlphaExcess": max(c["maximumMaskAlphaExcess"] for c in checks),
              "fullyOccludedMaskViews": sum(c["maskNonzeroPixels"] == 0 for c in checks),
              "checks": checks, "artAccepted": False}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--write-sheets", action="store_true")
    args = parser.parse_args()
    path = args.folder / "pixel-validation.json"
    if path.exists():
        raise FileExistsError("Preserve the prior validation receipt")
    report = inspect(args.folder, args.write_sheets)
    path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: report[k] for k in ("syntheticFixture", "decodedPairs", "maximumMaskAlphaExcess", "artAccepted")}))


if __name__ == "__main__":
    main()
