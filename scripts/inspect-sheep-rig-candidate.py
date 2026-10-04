"""Blender-only inspection. Never saves, normalizes, rigs or renders a model."""
import argparse
import hashlib
import importlib
import importlib.util
import json
import math
from pathlib import Path
import pkgutil
import sys

import bpy


def digest(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def capabilities():
    rigify = importlib.util.find_spec("rigify") is not None
    animals = []
    if rigify:
        module = importlib.import_module("rigify.metarigs.Animals")
        animals = sorted(item.name for item in pkgutil.iter_modules(module.__path__))
    # A disposable diagnostic bone verifies the actual installed core API.
    armature = bpy.data.armatures.new("inspection-diagnostic")
    obj = bpy.data.objects.new("inspection-diagnostic", armature)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bone = armature.edit_bones.new("inspection-diagnostic")
    bone.head, bone.tail = (0, 0, 0), (0, 0, 1)
    bpy.ops.object.mode_set(mode="POSE")
    constraint = obj.pose.bones[0].constraints.new("IK")
    props = {name: hasattr(constraint, name) for name in ["target", "pole_target", "chain_count", "use_stretch"]}
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.armatures.remove(armature)
    return {"blender": bpy.app.version_string, "background": bpy.app.background,
            "rigifyModule": rigify, "animalMetarigs": animals, "coreIkProperties": props}


def inspect_model(model, contract):
    expected = contract["sourceModel"]
    source_sha = digest(model)
    if source_sha != expected["reportedSha256"] or model.stat().st_size != expected["reportedBytes"]:
        raise ValueError("Source does not match the preserved Sheep capture contract")
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=str(model))
    bpy.context.view_layer.update()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    normalization = contract["normalization"]
    source_root = normalization["source_root"]
    scale = normalization["scale"]
    angle = math.radians(normalization["yaw_alignment_degrees"])
    cosine, sine = math.cos(angle), math.sin(angle)
    centers = contract["measurements"]["hoof_centers_world"]
    contacts = [{"producerHoofIndex": i, "center": center, "vertexCountWithin6cm": 0,
                 "minimumY": None, "maximumY": None} for i, center in enumerate(centers)]
    lower, upper = [float("inf")] * 3, [float("-inf")] * 3
    objects = []
    for obj in meshes:
        mesh = obj.data
        mesh.calc_loop_triangles()
        objects.append({"name": obj.name, "vertices": len(mesh.vertices), "triangles": len(mesh.loop_triangles),
                        "vertexGroups": [group.name for group in obj.vertex_groups],
                        "armatureModifiers": sum(mod.type == "ARMATURE" for mod in obj.modifiers),
                        "uvLayers": len(mesh.uv_layers), "shapeKeys": len(mesh.shape_keys.key_blocks) if mesh.shape_keys else 0})
        for vertex in mesh.vertices:
            point = obj.matrix_world @ vertex.co
            # Inverse of the producer's glTF +Y-up -> Blender +Z-up rotation.
            source = [point.x, point.z, -point.y]
            x, y, z = [(source[i] - source_root[i]) * scale for i in range(3)]
            normalized = [cosine * x + sine * z, y, -sine * x + cosine * z]
            for i, value in enumerate(normalized):
                lower[i], upper[i] = min(lower[i], value), max(upper[i], value)
            if normalized[1] > .01:
                continue
            for contact in contacts:
                cx, _, cz = contact["center"]
                if (normalized[0] - cx) ** 2 + (normalized[2] - cz) ** 2 <= .06 ** 2:
                    contact["vertexCountWithin6cm"] += 1
                    height = normalized[1]
                    contact["minimumY"] = height if contact["minimumY"] is None else min(contact["minimumY"], height)
                    contact["maximumY"] = height if contact["maximumY"] is None else max(contact["maximumY"], height)
    if not meshes:
        raise ValueError("No imported Sheep mesh")
    source_unchanged = digest(model) == source_sha
    if not source_unchanged:
        raise ValueError("Source changed during inspection")
    return {"source": {"filename": model.name, "bytes": model.stat().st_size, "sha256": source_sha,
                       "sourceUnchanged": source_unchanged},
            "meshObjects": objects, "armatures": [{"name": obj.name, "bones": len(obj.data.bones)} for obj in armatures],
            "actions": len(bpy.data.actions), "normalizedGeometryBounds": {"min": lower, "max": upper},
            "hoofContactRegions": contacts,
            "geometryEvidence": "Imported original geometry; hoof regions are measured samples, not joint positions or skinning acceptance",
            "jointPlacementReviewed": False, "deformationReviewed": False, "walkingFeasible": None,
            "renderReviewCompleted": False}


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capabilities-only", action="store_true")
    parser.add_argument("--model", type=Path)
    parser.add_argument("--contract", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args(args)
    if options.output.exists():
        raise ValueError("Receipt exists; choose a new destination")
    if not options.capabilities_only and (options.model is None or options.contract is None):
        parser.error("geometry inspection requires --model and --contract")
    if options.model and options.model.resolve() == options.output.resolve():
        raise ValueError("Receipt must not overwrite the source")
    report = {"schemaVersion": 1, "scope": "sheep-local-rig-inspection", "capabilities": capabilities(),
              "paidProviderCalls": 0, "assetWrites": [], "modelBytesInspected": False}
    if not options.capabilities_only:
        report["geometry"] = inspect_model(options.model, json.loads(options.contract.read_text()))
        report["modelBytesInspected"] = True
    with options.output.open("x") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    print(json.dumps({"status": "inspection-completed", "modelBytesInspected": report["modelBytesInspected"]}))


if __name__ == "__main__":
    main()
