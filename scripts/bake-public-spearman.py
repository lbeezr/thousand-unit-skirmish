"""Local CPU sprite bake from retained public rigid geometry; no provider jobs.

blender -b --threads 4 --python scripts/bake-public-spearman.py -- --probe
blender -b --threads 4 --python scripts/bake-public-spearman.py
Original GLB/Blender/source files are never modified. New authored rigid poses
are deliberately coarse; this is functional directional coverage before polish.
"""
import bpy
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view
from pathlib import Path
import math, json, hashlib, sys

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'assets/units-buildings/frontier-glb-sample-v2/models/unit-art-v2.glb'
OUT=ROOT/'assets/units/spearman-sprite-v2/source'
OUT.mkdir(parents=True,exist_ok=True)
PROBE='--probe' in sys.argv
DIRECTIONS=['north','north-east','east','south-east','south','south-west','west','north-west']
POSES=[('idle',0),*[('walk',i) for i in range(4)],*[('attack',i) for i in range(3)],*[('defeat',i) for i in range(4)]]

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
keep={'unit.humanoid-core','unit.infantry.spear','unit.team-accent'}
for obj in list(bpy.data.objects):
    if obj.type=='MESH' and obj.name not in keep:
        bpy.data.objects.remove(obj,do_unlink=True)
# Retain the source helmet that shares the spear bin, omit the separate shield,
# backpack/bow/quiver/tool. World-coordinate vertex articulation keeps palette/UVs.
bpy.context.view_layer.update()
models=[bpy.data.objects[n] for n in sorted(keep)]
for o in models:
    for material in o.data.materials:
        for node in material.node_tree.nodes:
            if node.type=='VERTEX_COLOR':
                # COLOR_0 is white; the public authored palette is COLOR_1.
                node.layer_name='Color.001'
base={o.name:[o.matrix_world@v.co for v in o.data.vertices] for o in models}
for o in models:
    o.parent=None;o.matrix_world=Matrix.Identity(4)
    for v,p in zip(o.data.vertices,base[o.name]):v.co=p

def groups(obj):
    # glTF duplicates corners at UV/normal seams. Weld exact positions only for
    # component classification; exported geometry/UV/colours remain untouched.
    keys={};vid=[];adj={}
    for v in obj.data.vertices:
        k=tuple(round(x,5) for x in v.co)
        i=keys.setdefault(k,len(keys));vid.append(i);adj.setdefault(i,set())
    for p in obj.data.polygons:
        ids=[vid[i] for i in p.vertices]
        for i in ids:adj[i].update(ids)
    unseen=set(adj);result=[]
    while unseen:
        seed=unseen.pop();q=[seed];c={seed}
        while q:
            for j in adj[q.pop()]:
                if j in unseen:unseen.remove(j);c.add(j);q.append(j)
        indices=[i for i,p in enumerate(vid) if p in c]
        center=sum((base[obj.name][i] for i in indices),Vector())/len(indices)
        result.append((indices,center))
    return result

core=bpy.data.objects['unit.humanoid-core'];limbs={}
for indices,center in groups(core):
    limb=None
    if center.z<.29 and abs(center.x)>.045:limb='leg-right' if center.x>0 else 'leg-left'
    elif .30<center.z<.54 and abs(center.x)>.18:limb='arm-right' if center.x>0 else 'arm-left'
    if limb:
        for i in indices:limbs[i]=limb
if not all(name in limbs.values() for name in ['leg-right','leg-left','arm-right','arm-left']):
    raise ValueError('Source limb classification failed; do not fake a whole-body walk')

def turn(point,pivot,axis,angle):
    return pivot+Matrix.Rotation(angle,4,axis)@(point-pivot)

def pose(state,key,heading):
    result={name:[p.copy() for p in values] for name,values in base.items()}
    phase=key*math.pi/2
    for i,limb in limbs.items():
        p=result[core.name][i];side=1 if limb.endswith('right') else -1
        if state=='walk':
            if limb.startswith('leg'):
                p=turn(p,Vector((side*.105,0,.30)),'X',side*.32*math.sin(phase))
                p.z+=max(0,side*math.sin(phase))*.018
            else:p=turn(p,Vector((side*.215,-.015,.52)),'X',side*.25*math.cos(phase))
        elif state=='attack':
            if limb=='arm-right':p=turn(p,Vector((.215,-.015,.52)),'X',[.35,.75,.45][key])
            elif limb.startswith('leg'):p.y+=-.06 if side>0 else .045
        result[core.name][i]=p
    if state=='attack':
        # Only weapon vertices rotate; the public helmet shares this mesh bin.
        for i,p in enumerate(result['unit.infantry.spear']):
            if p.x>.18:
                p=turn(p,Vector((.29,-.02,.42)),'X',[.85,1.48,1.1][key])
                p.y+=[.04,-.15,-.02][key]
                result['unit.infantry.spear'][i]=p
        lean=[.035,.11,.055][key]
        for name,values in result.items():
            result[name]=[turn(p,Vector((0,0,.30)),'X',lean) if p.z>.30 else p for p in values]
    if state=='defeat':
        angle=[-.18,-.72,-1.22,-math.pi/2][key]
        for name,values in result.items():result[name]=[turn(p,Vector((0,0,.07)),'X',angle) for p in values]
    # Ground contact is geometric. Remove only penetration, not locomotion or
    # directional offsets. A fixed camera/root spans every state and heading.
    floor=min(p.z for values in result.values() for p in values)
    lift=max(0,-floor)
    yaw=Matrix.Rotation(heading*math.pi/4,4,'Z')
    for o in models:
        for v,p in zip(o.data.vertices,result[o.name]):v.co=yaw@(p+Vector((0,0,lift)))
        o.data.update()
    bpy.context.view_layer.update()

scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8
scene.cycles.use_denoising=False
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=256;scene.render.resolution_y=256;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.view_settings.view_transform='Standard'
world=bpy.data.worlds.new('Spearman fixed studio');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.65,.65,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
camera_data=bpy.data.cameras.new('Fixed game camera');camera=bpy.data.objects.new('Fixed game camera',camera_data);scene.collection.objects.link(camera)
target=Vector((0,0,.40));camera.location=target+Vector((.78,-.78,1.12)).normalized()*8
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=2.80;scene.camera=camera
light_data=bpy.data.lights.new('Fixed soft key','AREA');light=bpy.data.objects.new('Fixed soft key',light_data);scene.collection.objects.link(light)
light.location=(-3,-4,6);light.rotation_euler=(Vector((0,0,.4))-light.location).to_track_quat('-Z','Y').to_euler();light_data.energy=250;light_data.size=5
# A bounded neutral blue sash gives a deterministic derived hue-mask, matching
# the original mesh's team-accent identity rather than recolouring the whole man.
sash=bpy.data.objects['unit.team-accent'];mat=bpy.data.materials.new('Public sash blue');mat.use_nodes=True
shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.06,.25,.65,1);shader.inputs['Roughness'].default_value=.8
sash.data.materials.clear();sash.data.materials.append(mat)

bpy.context.view_layer.update()
root=world_to_camera_view(scene,camera,Vector((0,0,0)))
root_px=[root.x*256,(1-root.y)*256]
measurements=[]
for row,(state,key) in enumerate(POSES):
    for heading,direction in enumerate(DIRECTIONS):
        if PROBE and heading!=3:continue
        pose(state,key,heading)
        frame=f'{state}-{direction}-{key}'
        scene.render.filepath=str(OUT/(frame+'.png'))
        bpy.ops.render.render(write_still=True)
        measurements.append({'frameId':frame,'state':state,'key':key,'heading':direction,'yawRadians':heading*math.pi/4})
report={'role':'spearman','sourcePath':str(SOURCE.relative_to(ROOT)),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'sourceGeometry':'public shared humanoid core, spear/helmet and team sash; no shield',
    'providerJobs':0,'charges':0,'reusedSpriteFrames':0,'newlyAuthoredPoseSamples':len(POSES),
    'newlyRenderedFrames':len(measurements),'mirroredFrames':0,'rootPx':root_px,
    'cameraGameVector':[.78,1.12,.78],'orthographicScale':camera_data.ortho_scale,'canvasPx':[256,256],
    'sourceBodyHeight':.8,'limbVertexCounts':{name:list(limbs.values()).count(name) for name in sorted(set(limbs.values()))},
    'poseTechnique':'public rigid geometry with explicit separate leg/arm articulation, spear windup/thrust/recovery and backward fall; fixed root/camera/scale',
    'samples':measurements}
(OUT/('probe.json' if PROBE else 'capture.json')).write_text(json.dumps(report,indent=2)+'\n')
if not PROBE:
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'spearman-authored-poses.blend'))
print('SPEARMAN_CAPTURE',json.dumps({k:report[k] for k in ['newlyRenderedFrames','rootPx','limbVertexCounts']}))
