"""Recapture observed Mill ruin/Farm depletion artifacts from unchanged masters."""
import importlib.util
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
asset = sys.argv[sys.argv.index('--') + 1]
assert asset in ('mill', 'farm')
script = Path(__file__).with_name('capture_economy.py')
spec = importlib.util.spec_from_file_location('economy', script)
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
script_hash = m.sha(script)
master = m.REPO / f'meshy_output/frontier-economy-authoring/runtime-v1/{asset}-master.blend'
master_hash = m.sha(master)
receipt_path = m.PACK / f'captures/runtime-v1/{asset}-capture-receipt.json'
original = json.loads(receipt_path.read_text())
source_record = next(j for j in json.loads((m.SOURCE_DIR / 'provenance.json').read_text())['jobs'] if j['role'] == asset)
source = m.REPO / source_record['model']['path']
assert m.sha(source) == original['sourceSHA256']
bpy.ops.wm.open_mainfile(filepath=str(master))
if '--retire-master' in sys.argv:
    # This task-created calibrated cache is reproducible from unchanged GLB + recipe.
    # Original models and captures are never removed.
    master.unlink()
scene = bpy.context.scene; camera = scene.camera
meshes = [obj for obj in scene.objects if obj.type == 'MESH']
height = max((obj.matrix_world @ Vector(corner)).z for obj in meshes for corner in obj.bound_box)
folder = m.PACK / 'captures/state-fix-v1'; folder.mkdir(exist_ok=True)
states = ['critical'] if asset == 'mill' else ['exhausted', 'exhausted-damaged', 'exhausted-critical']
rows = []
for name in states:
    depleted = name.startswith('exhausted')
    state = name.removeprefix('exhausted-') if '-' in name else 'complete' if depleted else name
    for obj in meshes:
        obj.modifiers.clear(); m.state_modifier(obj, asset, state, depleted, height)
    extras = m.harvested_soil() if depleted else []
    for index in range(8):
        m.set_view(camera, index)
        projected = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
        output = folder / f'{asset}-{name}-view-{index:02}.png'
        if output.exists():
            assert '--resume' in sys.argv, 'Prior state refinement must be preserved'
            image = bpy.data.images.load(str(output))
            assert tuple(image.size) == (1024, 1024)
            bpy.data.images.remove(image)
        else:
            scene.render.filepath = str(output); bpy.ops.render.render(write_still=True)
        row = next(r.copy() for r in original['records'] if r['state'] == name and r['viewIndex'] == index)
        row.update(file=output.relative_to(m.PACK).as_posix(), sha256=m.sha(output), bytes=output.stat().st_size,
                   scriptSHA256=script_hash, blendSHA256=master_hash)
        row['camera']['groundOriginPixelFromTopLeft'] = [projected.x * 1024, (1 - projected.y) * 1024]
        rows.append(row)
    for obj in extras:
        bpy.data.objects.remove(obj, do_unlink=True)
assert m.sha(source) == original['sourceSHA256']
refined = dict(original)
refined['priorScriptSHA256'] = original['scriptSHA256']
refined['scriptSHA256'] = script_hash
refined['refinementScriptSHA256'] = m.sha(Path(__file__))
refined['refinement'] = 'Observed detached Mill roof removed; harvested Farm soil caps the open crop-cut seam. Complete sources remain unchanged.'
refined['records'] = [next((r for r in rows if r['state'] == old['state'] and r['viewIndex'] == old['viewIndex']),
                           dict(old, scriptSHA256=original['scriptSHA256'])) for old in original['records']]
(folder / f'{asset}-capture-receipt.json').write_text(json.dumps(refined, indent=2) + '\n')
print('REFINED_RECEIPT ' + json.dumps({'asset': asset, 'refinedFrames': len(rows), 'sourceUnchanged': True}))
