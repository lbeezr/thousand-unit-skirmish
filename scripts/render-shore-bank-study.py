"""Render an explicitly labelled study, using exported game geometry and textures."""
import json
import pathlib
import sys

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

args = sys.argv[sys.argv.index('--') + 1:]
directory = pathlib.Path(args[0]).resolve()
root = pathlib.Path(__file__).resolve().parent.parent
record = json.loads((directory / 'scene.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.cycles.seed = 13
scene.cycles.use_denoising = False
scene.cycles.transparent_max_bounces = 32
scene.render.threads_mode = 'FIXED'
scene.render.threads = 2
scene.render.resolution_x, scene.render.resolution_y = record['resolution']
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.world = bpy.data.worlds.new('Study background')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = [*record['background'], 1]

def point(p):
    return (p[0], -p[2], p[1])  # Three +Y up to Blender +Z up, right-handed.

def image(spec, nodes, links, uv):
    node = nodes.new('ShaderNodeTexImage')
    if spec['source']:
        node.image = bpy.data.images.load(str(root / spec['source']), check_existing=True)
    else:
        node.image = bpy.data.images.new('Exported ground coverage', spec['width'], spec['height'])
        node.image.colorspace_settings.name = 'Non-Color'
        node.image.pixels.foreach_set([v / 255 for v in spec['data']])
    node.extension = 'EXTEND' if spec['data'] else 'REPEAT'
    coordinate = uv
    if spec['repeat'] != [1, 1] or spec['mirrored']:
        separate = nodes.new('ShaderNodeSeparateXYZ')
        links.new(uv, separate.inputs[0])
        combine = nodes.new('ShaderNodeCombineXYZ')
        for i in range(2):
            scale = nodes.new('ShaderNodeMath'); scale.operation = 'MULTIPLY'
            scale.inputs[1].default_value = spec['repeat'][i]
            links.new(separate.outputs[i], scale.inputs[0])
            value = scale.outputs[0]
            if spec['mirrored']:
                mirror = nodes.new('ShaderNodeMath'); mirror.operation = 'PINGPONG'
                mirror.inputs[1].default_value = 1
                links.new(value, mirror.inputs[0]); value = mirror.outputs[0]
            links.new(value, combine.inputs[i])
        coordinate = combine.outputs[0]
    links.new(coordinate, node.inputs['Vector'])
    return node

def multiply(nodes, links, a, b):
    node = nodes.new('ShaderNodeMixRGB'); node.blend_type = 'MULTIPLY'
    node.inputs[0].default_value = 1
    for value, socket in [(a, node.inputs[1]), (b, node.inputs[2])]:
        if isinstance(value, (list, tuple)): socket.default_value = value
        else: links.new(value, socket)
    return node.outputs[0]

bank = None
for i, source in enumerate(record['meshes']):
    vertices = [point(source['positions'][j:j+3]) for j in range(0, len(source['positions']), 3)]
    faces = [source['indices'][j:j+3] for j in range(0, len(source['indices']), 3)]
    mesh = bpy.data.meshes.new(source['role']); mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(source['role'], mesh); scene.collection.objects.link(obj)
    colors = mesh.color_attributes.new(name='GameColor', type='FLOAT_COLOR', domain='POINT')
    stride = source['colorSize']
    for j, color in enumerate(colors.data):
        rgba = source['colors'][j*stride:(j+1)*stride]
        color.color = [*rgba, 1] if stride == 3 else rgba
    if source['uv']:
        uv = mesh.uv_layers.new()
        for loop in mesh.loops:
            j = loop.vertex_index * 2; uv.data[loop.index].uv = source['uv'][j:j+2]
    material = bpy.data.materials.new(source['role']); material.use_nodes = True
    nodes = material.node_tree.nodes; nodes.clear(); links = material.node_tree.links
    vertex = nodes.new('ShaderNodeVertexColor'); vertex.layer_name = 'GameColor'
    spec = source['material']
    color = multiply(nodes, links, vertex.outputs['Color'], [*spec['color'], 1])
    alpha = nodes.new('ShaderNodeMath'); alpha.operation = 'MULTIPLY'
    alpha.inputs[1].default_value = spec['opacity']; links.new(vertex.outputs['Alpha'], alpha.inputs[0])
    coverage = alpha.outputs[0]
    uv = nodes.new('ShaderNodeTexCoord').outputs['UV']
    if spec['map']:
        texture = image(spec['map'], nodes, links, uv)
        color = multiply(nodes, links, color, texture.outputs['Color'])
    if spec['alphaMap']:
        texture = image(spec['alphaMap'], nodes, links, uv)
        channels = nodes.new('ShaderNodeSeparateColor'); links.new(texture.outputs['Color'], channels.inputs[0])
        mask = nodes.new('ShaderNodeMath'); mask.operation = 'MULTIPLY'
        links.new(coverage, mask.inputs[0]); links.new(channels.outputs['Green'], mask.inputs[1]); coverage = mask.outputs[0]
    emission = nodes.new('ShaderNodeEmission'); links.new(color, emission.inputs[0])
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    blend = nodes.new('ShaderNodeMixShader')
    links.new(coverage, blend.inputs[0]); links.new(transparent.outputs[0], blend.inputs[1]); links.new(emission.outputs[0], blend.inputs[2])
    output = nodes.new('ShaderNodeOutputMaterial'); links.new(blend.outputs[0], output.inputs[0])
    obj.data.materials.append(material)
    if source['role'] == 'bank-shade': bank = obj

camera = bpy.data.objects.new('Fixed game camera', bpy.data.cameras.new('Fixed game camera'))
scene.collection.objects.link(camera); scene.camera = camera
camera.data.type = 'ORTHO'; camera.data.sensor_fit = 'VERTICAL'
measurements = []
for view in record['views']:
    camera.location = point(view['cameraPosition'])
    camera.rotation_euler = (Vector(point(view['target'])) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = view['orthoHeight']
    bpy.context.view_layer.update()
    projection = []
    for sample in view['projectedPoints']:
        p = world_to_camera_view(scene, camera, Vector(point(sample['point'])))
        screen = [p.x * 1280, (1 - p.y) * 720]
        assert max(abs(a-b) for a,b in zip(screen, sample['screen'])) < .001, (screen, sample['screen'])
        projection.append(screen)
    for version in ['before', 'after']:
        bank.hide_render = version == 'before'
        destination = directory / f"{version}-zoom-{view['zoom']:.2f}.png"
        scene.render.filepath = str(destination)
        bpy.ops.render.render(write_still=True)
        measurements.append({'file': destination.name, 'zoom': view['zoom'], 'version': version, 'projectedPoints': projection})
(directory / 'render.json').write_text(json.dumps({'renderer': 'Blender '+bpy.app.version_string+' / Cycles CPU', 'samples': 8, 'seed': 13, 'notWebGL': True, 'views': measurements}, indent=2)+'\n')
