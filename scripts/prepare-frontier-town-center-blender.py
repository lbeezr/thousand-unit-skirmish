"""Prepare an empty authoring scene; never import or derive source geometry."""

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:])


def main():
    args = arguments()
    if not args.output.is_absolute() or args.output.suffix != ".blend":
        raise ValueError("Use an absolute private .blend destination")
    if not args.report.is_absolute() or args.report.suffix != ".json":
        raise ValueError("Use an absolute private JSON report destination")
    if args.output.exists() or args.report.exists():
        raise FileExistsError("Preserve existing iterations; choose new output paths")

    repo = Path(__file__).resolve().parent.parent
    if args.output.resolve().is_relative_to(repo):
        raise ValueError("Keep editable .blend files outside the public repository")
    pack = repo / "assets/buildings/frontier-civilization-scale-pilot-v1"
    measurement = json.loads((pack / "town-center-measurement.json").read_text())
    records = [json.loads((pack / "captures" / f"town-center-complete-view-{i:02d}.json").read_text())
               for i in range(8)]
    reference = records[0]
    fixed_fields = ("uniformScale", "groundingTranslationNative", "targetBaseWidthWorldUnits")
    for i, record in enumerate(records):
        if record["viewIndex"] != i or record["camera"]["azimuthDegrees"] != i * 45:
            raise ValueError("Published direction mapping changed")
        for field in fixed_fields:
            if record[field] != reference[field]:
                raise ValueError(f"Published calibration drift: {field}")
        for field in ("projection", "elevationDegrees", "canvasPixels", "canvasWorldUnits", "pixelsPerWorldUnit"):
            if record["camera"][field] != reference["camera"][field]:
                raise ValueError(f"Published camera drift: {field}")
        image = pack / "captures" / record["file"]
        if hashlib.sha256(image.read_bytes()).hexdigest() != record["sha256"]:
            raise ValueError(f"Published capture hash differs: view {i}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "Frontier Town Center — authoring preparation"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.resolution_x, scene.render.resolution_y = reference["camera"]["canvasPixels"]
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene["status"] = "preparation-only; no source geometry, lighting parity, masks or state art"
    scene["expected_source_sha256"] = measurement["sha256"]
    scene["expected_source_bytes"] = measurement["bytes"]

    def collection(name, parent):
        result = bpy.data.collections.new(name)
        parent.children.link(result)
        return result

    master = collection("TC_Master_Architecture", scene.collection)
    parts = ("Foundation_and_Steps", "Structural_Timber", "Wall_Envelope",
             "Roof_Planes", "Bell_Tower", "Owner_Standards", "Civic_Props")
    for name in parts:
        collection(name, master)["status"] = "empty semantic authoring target; not an inspected mesh partition"
    calibration = bpy.data.objects.new("Calibrated_Model_Root", None)
    master.objects.link(calibration)
    scale = reference["uniformScale"]
    tx, ty, tz = reference["groundingTranslationNative"]
    calibration.scale = (scale,) * 3
    # glTF/Three Y-up -> Blender Z-up: (x, y, z) -> (x, -z, y).
    calibration.location = (tx * scale, -tz * scale, ty * scale)
    calibration["instruction"] = "Parent inspected Blender glTF roots here with identity parent inverse; do not apply calibration twice"

    states = ("foundation", "frame", "complete", "damaged", "critical")
    state_root = collection("TC_Lifecycle_States", scene.collection)
    for name in states:
        state = collection(f"TC_{name.title()}", state_root)
        state["status"] = "unproduced; use linked unchanged parts and independently edited geometry"
    masks = collection("TC_Team_Mask_Only", scene.collection)
    masks["status"] = "empty; explicit authored standard selection required, no automatic hue extraction"
    rig = collection("TC_Shared_Cameras", scene.collection)

    receipts = []
    for record in records:
        spec = record["camera"]
        span = spec["canvasWorldUnits"]
        azimuth = math.radians(spec["azimuthDegrees"])
        elevation = math.radians(spec["elevationDegrees"])
        # Matches scripts/building-scale-review.html aim = (0, span * .19, 0).
        target = Vector((0, 0, span * .19))
        offset = Vector((math.sin(azimuth) * 20 * math.cos(elevation),
                         -math.cos(azimuth) * 20 * math.cos(elevation),
                         20 * math.sin(elevation)))
        data = bpy.data.cameras.new(f"Camera_View_{record['viewIndex']:02d}")
        data.type = "ORTHO"
        data.ortho_scale = span
        data.clip_start, data.clip_end = .01, 100
        camera = bpy.data.objects.new(data.name, data)
        rig.objects.link(camera)
        camera.location = target + offset
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        camera["azimuthDegrees"] = spec["azimuthDegrees"]
        bpy.context.view_layer.update()
        projected = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
        pixels = [projected.x * scene.render.resolution_x,
                  (1 - projected.y) * scene.render.resolution_y]
        error = max(abs(a - b) for a, b in zip(pixels, spec["groundOriginPixelFromTopLeft"]))
        if error > .001:
            raise ValueError(f"Ground-anchor projection drift in view {record['viewIndex']}: {error} pixels")
        receipts.append({"viewIndex": record["viewIndex"], "azimuthDegrees": spec["azimuthDegrees"],
                         "projectedGroundOriginPixels": pixels, "maximumAnchorErrorPixels": error,
                         "publishedCaptureSha256Verified": record["sha256"]})
        if record["viewIndex"] == 1:
            scene.camera = camera

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output))
    report = {"schema": "thousand-unit-skirmish.frontier-town-center-authoring-preparation.v1",
              "status": "preparation-only", "blenderVersion": bpy.app.version_string,
              "sourceGeometryImported": False, "lifecycleArtProduced": False,
              "lightingParityVerified": False, "teamMasksProduced": False,
              "expectedSource": {"bytes": measurement["bytes"], "sha256": measurement["sha256"]},
              "canvasPixels": reference["camera"]["canvasPixels"],
              "pixelsPerWorldUnit": reference["camera"]["pixelsPerWorldUnit"],
              "states": list(states), "semanticPartTargets": list(parts), "cameras": receipts,
              "blendSha256": hashlib.sha256(args.output.read_bytes()).hexdigest()}
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "sourceGeometryImported": False,
                      "verifiedCameraCount": len(receipts),
                      "maximumAnchorErrorPixels": max(x["maximumAnchorErrorPixels"] for x in receipts)}))


if __name__ == "__main__":
    main()
