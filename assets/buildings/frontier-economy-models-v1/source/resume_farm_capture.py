"""Finish interrupted runtime-v1 Farm capture from its preserved calibrated master.

Existing pixels are decoded and hashed, never overwritten. This uses the exact
state recipe/camera in capture_economy.py and records this recovery separately.
"""
import importlib.util
import json
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
module_path = Path(__file__).with_name('capture_economy.py')
spec = importlib.util.spec_from_file_location('economy', module_path)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
provenance = json.loads((m.SOURCE_DIR / 'provenance.json').read_text())
record = next(row for row in provenance['jobs'] if row['role'] == 'farm')
source = m.REPO / record['model']['path']
assert m.sha(source) == record['model']['sha256']
master = m.REPO / 'meshy_output/frontier-economy-authoring/runtime-v1/farm-master.blend'
master_hash = m.sha(master)
bpy.ops.wm.open_mainfile(filepath=str(master))
scene = bpy.context.scene
camera = scene.camera
meshes = [obj for obj in scene.objects if obj.type == 'MESH']
height = max((obj.matrix_world @ Vector(corner)).z for obj in meshes for corner in obj.bound_box)
measurement = json.loads((m.SOURCE_DIR / 'farm-measurement.json').read_text())
base = measurement['lowerGeometryBands'][1]
width = max(base['size'][0], base['size'][2]); scale = 2.8 / width
capture_dir = m.PACK / 'captures/runtime-v1'
rows = []
for state_name in (*m.STATES, 'exhausted', 'exhausted-damaged', 'exhausted-critical'):
    depleted = state_name.startswith('exhausted')
    state = state_name.removeprefix('exhausted-') if '-' in state_name else ('complete' if depleted else state_name)
    for obj in meshes:
        obj.modifiers.clear()
        m.state_modifier(obj, 'farm', state, depleted, height)
    extra = m.construction_frame('farm', height) if state == 'frame' else []
    for index in range(8):
        m.set_view(camera, index)
        projected = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
        output = capture_dir / f'farm-{state_name}-view-{index:02}.png'
        if output.exists():
            image = bpy.data.images.load(str(output))
            assert tuple(image.size) == (1024, 1024)
            bpy.data.images.remove(image)
        else:
            scene.render.filepath = str(output)
            bpy.ops.render.render(write_still=True)
        rows.append({'asset': 'farm', 'state': state_name, 'viewIndex': index,
                     'file': output.relative_to(m.PACK).as_posix(), 'sha256': m.sha(output), 'bytes': output.stat().st_size,
                     'sourceSHA256': m.sha(source), 'uniformScale': scale, 'measuredNativeBaseWidth': width,
                     'targetBaseWidthWorldUnits': 2.8, 'yawDegrees': 0,
                     'camera': {'projection': 'orthographic', 'elevationDegrees': 46, 'azimuthDegrees': index * 45,
                                'canvasPixels': [1024, 1024], 'canvasWorldUnits': 8, 'pixelsPerWorldUnit': 128,
                                'groundOriginPixelFromTopLeft': [projected.x * 1024, (1 - projected.y) * 1024]},
                     'renderer': 'Blender Cycles CPU', 'samples': 16, 'blendSHA256': master_hash})
    for obj in extra:
        bpy.data.objects.remove(obj, do_unlink=True)
assert m.sha(source) == record['model']['sha256']
receipt = {'asset': 'farm', 'sourceSHA256': m.sha(source), 'scriptSHA256': m.sha(module_path),
           'blenderVersion': bpy.app.version_string, 'recoveryScriptSHA256': m.sha(Path(__file__)),
           'recovery': 'Disk-full render stopped before receipt. Existing valid frames retained; missing frames rendered from the same calibrated master and recipe.',
           'stateRecipe': 'explicit 3D face cuts and authored matched oak frame; unchanged Complete source', 'spend': 0, 'records': rows}
(capture_dir / 'farm-capture-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('CAPTURE_RECEIPT ' + json.dumps({'asset': 'farm', 'frames': len(rows), 'sourceUnchanged': True}))
