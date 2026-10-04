"""Render preserved Meshy sources with one registered camera and explicit state recipes.

Original GLBs are read-only. Private authoring scenes live under meshy_output;
only registered PNGs/receipts/manifests are runtime candidates.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

REPO = Path(__file__).resolve().parents[4]
PACK = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO / 'docs/art-direction/frontier-economy-meshy-v1'
STATES = ('foundation', 'frame', 'complete', 'damaged', 'critical')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .82
    return m


def beam(name, a, b, width, mat):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    obj.scale = (width, width, (b - a).length)
    obj.data.materials.append(mat)
    return obj


def state_modifier(obj, asset, state, depleted, height):
    """Author geometry cuts; no image-space erasure or scaling of the frame."""
    if state == 'complete' and not depleted:
        return
    tree = bpy.data.node_groups.new(asset + '-' + state, 'GeometryNodeTree')
    tree.interface.new_socket(name='Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    tree.interface.new_socket(name='Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    nodes, links = tree.nodes, tree.links
    inp, out = nodes.new('NodeGroupInput'), nodes.new('NodeGroupOutput')
    pos = nodes.new('GeometryNodeInputPosition')
    xyz = nodes.new('ShaderNodeSeparateXYZ')
    links.new(pos.outputs['Position'], xyz.inputs[0])

    def compare(axis, operation, number):
        node = nodes.new('ShaderNodeMath')
        node.operation = operation
        links.new(xyz.outputs[axis], node.inputs[0])
        node.inputs[1].default_value = number
        return node.outputs[0]

    def combine(a, b, operation='AND'):
        node = nodes.new('FunctionNodeBooleanMath')
        node.operation = operation
        links.new(a, node.inputs[0])
        links.new(b, node.inputs[1])
        return node.outputs[0]

    selections = []
    if state in ('foundation', 'frame'):
        # Ground-contact slab/soil remains from the actual source; the frame
        # receives separately authored oak members at matched occupancy.
        selections.append(compare('Z', 'GREATER_THAN', (.40 if asset == 'dock' else .16) if asset != 'farm' else .11))
    elif state == 'damaged':
        selections.append(combine(combine(compare('X', 'GREATER_THAN', .1),
                                          compare('Y', 'GREATER_THAN', .1)),
                                  compare('Z', 'GREATER_THAN', height * .61)))
    elif state == 'critical' and asset == 'mill':
        # The original high cut left detached roof/sail fragments. Collapse the
        # tower to connected lower masonry; retain the low annex and base.
        selections.append(compare('Z', 'GREATER_THAN', height * .34))
    elif state == 'critical':
        selections.append(compare('Z', 'GREATER_THAN', height * .72))
        selections.append(combine(combine(compare('X', 'GREATER_THAN', -.1),
                                          compare('Y', 'GREATER_THAN', -.25)),
                                  compare('Z', 'GREATER_THAN', height * .34)))
    if depleted:
        crop = combine(compare('X', 'GREATER_THAN', -1.10), compare('X', 'LESS_THAN', 1.10))
        crop = combine(crop, compare('Y', 'GREATER_THAN', -1.10))
        crop = combine(crop, compare('Y', 'LESS_THAN', .40))
        crop = combine(crop, compare('Z', 'GREATER_THAN', .105))
        selections.append(crop)
    if not selections:
        return
    selection = selections[0]
    for extra in selections[1:]:
        selection = combine(selection, extra, 'OR')
    delete = nodes.new('GeometryNodeDeleteGeometry')
    delete.domain = 'FACE'
    links.new(inp.outputs['Geometry'], delete.inputs['Geometry'])
    links.new(selection, delete.inputs['Selection'])
    links.new(delete.outputs['Geometry'], out.inputs['Geometry'])
    mod = obj.modifiers.new('authored-state-geometry', 'NODES')
    mod.node_group = tree


def construction_frame(asset, height):
    oak = material('construction honey oak', (.38, .20, .075))
    objects = []
    roof = min(height * .76, 1.8)
    # Tower and low annex are deliberately distinct from the cottage fallback.
    if asset == 'mill':
        for x, y in ((-.4, -.15), (.4, -.15), (.4, .65), (-.4, .65)):
            objects.append(beam('mill-tower-frame-post', (x, y, .14), (x, y, height * .68), .10, oak))
        for z in (.9, height * .65):
            for a, b in (((-.4, -.15, z), (.4, -.15, z)),
                         ((-.4, .65, z), (.4, .65, z)),
                         ((-.4, -.15, z), (-.4, .65, z)),
                         ((.4, -.15, z), (.4, .65, z))):
                objects.append(beam('mill-tower-frame-beam', a, b, .09, oak))
        xs, ys, roof = (-1.1, -.35), (-1.0, .15), .85
    elif asset == 'dock':
        xs, ys = (-.82, .82), (-.05, .85)
    else:
        xs, ys, roof = (-1.1, 1.1), (.55, 1.1), .65
    for x in xs:
        for y in ys:
            objects.append(beam(asset + '-work-bay-post', (x, y, .12), (x, y, roof), .08, oak))
    for y in ys:
        objects.append(beam(asset + '-work-bay-beam', (xs[0], y, roof), (xs[1], y, roof), .08, oak))
        mid = (sum(xs) / 2, y, roof + .24)
        for x in xs:
            objects.append(beam(asset + '-roof-rafter', (x, y, roof), mid, .065, oak))
    for x in xs:
        objects.append(beam(asset + '-work-bay-crossbeam', (x, ys[0], roof), (x, ys[1], roof), .08, oak))
    return objects



def harvested_soil():
    # Cap the crop cut in geometry so it cannot expose a black/open mesh seam.
    soil = material('harvested warm earth', (.36, .255, .135))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -.3425, .102))
    obj = bpy.context.object
    obj.name = 'harvested-plot-soil-cap'
    obj.scale = (2.20, 1.515, .008)
    obj.data.materials.append(soil)
    return [obj]


def setup_camera(samples):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.render.resolution_x = scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'Medium High Contrast'
    world = bpy.data.worlds.new('Frontier daylight')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.78, .81, .73, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .65
    for name, position, power, color, size in (
        ('warm key', (-4, -5, 8), 650, (1, .92, .79), 5),
        ('cool fill', (5, 4, 6), 100, (.76, .85, 1), 6),
    ):
        light = bpy.data.lights.new(name, 'AREA')
        light.energy, light.color, light.size = power, color, size
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (Vector((0, 0, 1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    data = bpy.data.cameras.new('registered orthographic')
    camera = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    data.type, data.ortho_scale, data.clip_start, data.clip_end = 'ORTHO', 8, .01, 100
    return camera


def set_view(camera, index):
    az, el = math.radians(index * 45), math.radians(46)
    aim = Vector((0, 0, 1.52))
    camera.location = aim + Vector((math.sin(az) * 20 * math.cos(el),
                                   -math.cos(az) * 20 * math.cos(el), 20 * math.sin(el)))
    camera.rotation_euler = (aim - camera.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--asset', choices=('mill', 'farm', 'dock'), required=True)
    parser.add_argument('--views', default='1')
    parser.add_argument('--states', default='complete')
    parser.add_argument('--samples', type=int, default=16)
    parser.add_argument('--iteration', default='v1')
    parser.add_argument('--yaw', type=float, default=0)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    states = args.states.split(',')
    allowed = set(STATES) | ({'exhausted', 'exhausted-damaged', 'exhausted-critical'} if args.asset == 'farm' else set())
    if not set(states) <= allowed:
        raise ValueError('Unsupported source state')
    provenance = json.loads((SOURCE_DIR / 'provenance.json').read_text())
    source_record = next(j for j in provenance['jobs'] if j['role'] == args.asset)
    # Stored absolute delivery path is historical; derive a portable checkout-relative path.
    source = REPO / 'meshy_output' / Path(source_record['project_path']).name / (args.asset + '.glb')
    if sha(source) != source_record['model']['sha256']:
        raise ValueError('Preserved source hash mismatch')
    private = REPO / 'meshy_output/frontier-economy-authoring' / args.iteration
    capture_dir = PACK / 'captures' / args.iteration
    private.mkdir(parents=True, exist_ok=True)
    capture_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    base = json.loads((SOURCE_DIR / (args.asset + '-measurement.json')).read_text())['lowerGeometryBands'][1]
    width = max(base['size'][0], base['size'][2])
    scale = 2.8 / width
    center = ((base['min'][0] + base['max'][0]) / 2, -(base['min'][2] + base['max'][2]) / 2)
    for obj in meshes:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for v in obj.data.vertices:
            v.co = Vector(((v.co.x - center[0]) * scale,
                           (v.co.y - center[1]) * scale, (v.co.z - lo[2]) * scale))
        obj.select_set(False)
        obj.data.update()
    height = (hi[2] - lo[2]) * scale
    if args.yaw:
        rotation = Matrix.Rotation(math.radians(args.yaw), 4, 'Z')
        for obj in meshes:
            for v in obj.data.vertices:
                v.co = rotation @ v.co
            obj.data.update()
    camera = setup_camera(args.samples)
    script_hash = sha(Path(__file__))
    blend = private / (args.asset + '-master.blend')
    if blend.exists():
        raise FileExistsError('Choose a new iteration; preserve authoring history')
    set_view(camera, 1)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    blend_hash = sha(blend)
    records = []
    for state_name in states:
        depleted = state_name.startswith('exhausted')
        state = state_name.removeprefix('exhausted-') if '-' in state_name else ('complete' if depleted else state_name)
        for obj in meshes:
            obj.modifiers.clear()
            state_modifier(obj, args.asset, state, depleted, height)
        extra = construction_frame(args.asset, height) if state == 'frame' else harvested_soil() if depleted else []
        # The master plus this deterministic recipe reproduces each state.
        for index in map(int, args.views.split(',')):
            set_view(camera, index)
            projected = world_to_camera_view(bpy.context.scene, camera, Vector((0, 0, 0)))
            path = capture_dir / f'{args.asset}-{state_name}-view-{index:02}.png'
            if path.exists():
                raise FileExistsError('Preserve captures; select a new iteration')
            bpy.context.scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            records.append({'asset': args.asset, 'state': state_name, 'viewIndex': index,
                            'file': path.relative_to(PACK).as_posix(), 'sha256': sha(path),
                            'bytes': path.stat().st_size, 'sourceSHA256': source_record['model']['sha256'],
                            'uniformScale': scale, 'measuredNativeBaseWidth': width,
                            'targetBaseWidthWorldUnits': 2.8, 'groundNativeZ': lo[2], 'yawDegrees': args.yaw,
                            'camera': {'projection': 'orthographic', 'elevationDegrees': 46,
                                       'azimuthDegrees': index * 45, 'canvasPixels': [1024, 1024],
                                       'canvasWorldUnits': 8, 'pixelsPerWorldUnit': 128,
                                       'groundOriginPixelFromTopLeft': [projected.x * 1024, (1 - projected.y) * 1024]},
                            'renderer': 'Blender Cycles CPU', 'samples': args.samples,
                            'blendSHA256': blend_hash})
        for obj in extra:
            bpy.data.objects.remove(obj, do_unlink=True)
    receipt = {'asset': args.asset, 'sourceSHA256': sha(source), 'scriptSHA256': script_hash,
               'blenderVersion': bpy.app.version_string, 'stateRecipe': 'explicit 3D face cuts and authored matched oak frame; unchanged Complete source',
               'spend': 0, 'records': records}
    (capture_dir / (args.asset + '-capture-receipt.json')).write_text(json.dumps(receipt, indent=2) + '\n')
    if sha(source) != source_record['model']['sha256']:
        raise ValueError('Source changed during authoring')
    print('CAPTURE_RECEIPT ' + json.dumps({'asset': args.asset, 'frames': len(records), 'sourceUnchanged': True}))


if __name__ == '__main__':
    main()
