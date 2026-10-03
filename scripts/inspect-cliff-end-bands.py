"""Read-only geometry evidence for the existing public straight-cliff pilot."""
import hashlib
import json
from pathlib import Path
import struct

PACK = Path(__file__).resolve().parents[1] / "assets/environment/frontier-cliff-pilot-v1"


def inspect():
    manifest_path = PACK / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    data = (PACK / manifest["model"]).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != manifest["modelSha256"] or data[:4] != b"glTF":
        raise ValueError("cliff GLB source/hash disagrees")
    length, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A:
        raise ValueError("GLB JSON chunk required")
    gltf = json.loads(data[20:20 + length])
    binary_length, kind = struct.unpack_from("<II", data, 20 + length)
    if kind != 0x004E4942 or len(gltf["meshes"]) != 1 or len(gltf["nodes"]) != 1:
        raise ValueError("expected the original single-mesh GLB")
    if gltf["nodes"][0].get("matrix") != [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]:
        raise ValueError("node transform changed; inspect normalization before measuring")
    primitive = gltf["meshes"][0]["primitives"][0]
    accessor = gltf["accessors"][primitive["attributes"]["POSITION"]]
    view = gltf["bufferViews"][accessor["bufferView"]]
    if accessor["componentType"] != 5126 or accessor["type"] != "VEC3" or view.get("byteStride", 12) != 12:
        raise ValueError("expected tightly packed float32 positions")
    start = 28 + length + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    vertices = list(struct.iter_unpack("<fff", data[start:start + accessor["count"] * 12]))
    if len(vertices) != accessor["count"] or binary_length < accessor["count"] * 12:
        raise ValueError("position buffer length disagrees")
    low = [min(vertex[axis] for vertex in vertices) for axis in range(3)]
    high = [max(vertex[axis] for vertex in vertices) for axis in range(3)]
    if low != accessor["min"] or high != accessor["max"]:
        raise ValueError("position accessor bounds disagree with actual geometry")
    scale = manifest["normalization"]["effectiveScale"]
    origin = [(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2]
    normalized = [tuple((vertex[axis] - origin[axis]) * scale for axis in range(3)) for vertex in vertices]
    size = [(high[axis] - low[axis]) * scale for axis in range(3)]
    if any(abs(a - b) > 1e-9 for a, b in zip(size, manifest["normalization"]["normalizedSize"])):
        raise ValueError("normalization disagrees with the captured contract")
    bands = {}
    width = .05
    for side, sign in [("left", -1), ("right", 1)]:
        points = [vertex for vertex in normalized if sign * vertex[0] >= size[0] / 2 - width]
        minimum = [min(vertex[axis] for vertex in points) for axis in range(3)]
        maximum = [max(vertex[axis] for vertex in points) for axis in range(3)]
        bands[side] = {"vertices": len(points), "min": minimum, "max": maximum,
                       "heightSpan": maximum[1] - minimum[1], "depthSpan": maximum[2] - minimum[2]}
    return {"scope": "existing-cliff-source-end-bands", "modelSha256": digest,
            "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
            "vertexCount": len(vertices), "normalizedSize": size, "endBandWidthWorld": width,
            "endBands": bands,
            "limits": "Vertex slab bounds, not surface-distance/join/cap proof; no mesh or runtime files changed"}


if __name__ == "__main__":
    print(json.dumps(inspect(), indent=2))
