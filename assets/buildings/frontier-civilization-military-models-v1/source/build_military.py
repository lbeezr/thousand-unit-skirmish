"""Original, repeatable concept-derived architecture. Blender 4.3, no providers.

Game coordinates are +Y up and +Z front. Blender uses (x,-z,y).
Complete runtime frames are published; editable models and historical review sheets are retained privately.
"""
import bpy, math, json, hashlib, argparse, sys, random
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]
RNG = random.Random(31670)
MAT = {}
GEOMETRY = {}

def coord(p):
    return (p[0], -p[2], p[1])

class Builder:
    def __init__(self, name, material):
        self.name, self.material = name, material
        self.vertices, self.faces, self.uv = [], [], []
    def face(self, points, uv=None):
        start = len(self.vertices)
        self.vertices += [coord(p) for p in points]
        self.faces.append(tuple(range(start, start + len(points))))
        if uv is None:
            if len(points) == 4:
                a, b = (Vector(points[1])-Vector(points[0])).length, (Vector(points[2])-Vector(points[1])).length
                uv = [(0,0),(0,1),(1,1),(1,0)] if a>b else [(0,0),(1,0),(1,1),(0,1)]
            else:
                uv = [(p[0] % 1, p[1] % 1) for p in points]
        self.uv.append(uv)
    def box(self, center, size, rotation=None):
        corners = []
        for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
            p=Vector((x*size[0]/2,y*size[1]/2,z*size[2]/2))
            if rotation: p=rotation @ p
            corners.append(tuple(p+Vector(center)))
        for ids in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)]:
            self.face([corners[i] for i in ids])
    def finish(self, parent):
        mesh=bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices,[],self.faces); mesh.update()
        layer=mesh.uv_layers.new(name='UVMap')
        for poly, uv in zip(mesh.polygons,self.uv):
            for loop, point in zip(poly.loop_indices,uv): layer.data[loop].uv=point
        obj=bpy.data.objects.new(self.name,mesh); bpy.context.collection.objects.link(obj)
        obj.parent=parent; mesh.materials.append(MAT[self.material])
        bevel=obj.modifiers.new('small-crafted-edge','BEVEL')
        bevel.width=.003 if self.material in ['sage','iron','copper'] else .006
        bevel.segments=2; bevel.limit_method='ANGLE'
        normal=obj.modifiers.new('weighted-surface-normals','WEIGHTED_NORMAL'); normal.keep_sharp=True
        return obj

def group(name, material):
    if name not in GEOMETRY: GEOMETRY[name]=Builder(name,material)
    return GEOMETRY[name]

def box(name, material, center, size):
    group(name,material).box(center,size)

def beam(name, material, a, b, width=.06, depth=None):
    direction=Vector(b)-Vector(a)
    rotation=Vector((0,1,0)).rotation_difference(direction.normalized()).to_matrix()
    group(name,material).box(tuple((Vector(a)+Vector(b))/2),(width,direction.length,depth or width),rotation)

def cylinder(name, material, center, radius, height, axis='y', sides=16, top_radius=None):
    top_radius=radius if top_radius is None else top_radius
    def p(r,angle,h):
        a,b=r*math.cos(angle),r*math.sin(angle)
        v=(a,h,b) if axis=='y' else (a,b,h) if axis=='z' else (h,a,b)
        return tuple(Vector(center)+Vector(v))
    g=group(name,material)
    lo=[p(radius,2*math.pi*i/sides,-height/2) for i in range(sides)]
    hi=[p(top_radius,2*math.pi*i/sides,height/2) for i in range(sides)]
    g.face(list(reversed(lo)));g.face(hi)
    for i in range(sides):
        j=(i+1)%sides
        g.face([lo[i],lo[j],hi[j],hi[i]],[(i/sides,0),(j/sides,0),(j/sides,1),(i/sides,1)])

def arch_panel(name, material, x, z, bottom, spring, radius, thickness):
    points=[(x-radius,bottom),(x+radius,bottom)]
    points += [(x+radius*math.cos(a), spring+radius*math.sin(a)) for a in [i*math.pi/16 for i in range(17)]]
    g=group(name,material)
    front=[(a,b,z+thickness/2) for a,b in points];back=[(a,b,z-thickness/2) for a,b in points]
    g.face(front);g.face(list(reversed(back)))
    for i in range(len(points)):
        j=(i+1)%len(points);g.face([front[i],back[i],back[j],front[j]])

def arch_stones(x,z,bottom,spring,radius,width=.09):
    for side in [-1,1]:
        height=spring-bottom
        for i in range(7):
            box('dressed-gate-stone','stone',(x+side*(radius+width/2),bottom+(i+.5)*height/7,z),(width,height/7-.004,.11))
    g=group('dressed-gate-stone','stone')
    for i in range(13):
        a0=i*math.pi/13+.009;a1=(i+1)*math.pi/13-.009
        pts=[(x+r*math.cos(a),spring+r*math.sin(a),z-.055) for r,a in [(radius,a0),(radius,a1),(radius+width,a1),(radius+width,a0)]]
        q=[(a,b,z+.055) for a,b,_ in pts]
        g.face(pts);g.face(list(reversed(q)))
        for j in range(4):g.face([pts[j],q[j],q[(j+1)%4],pts[(j+1)%4]])

def gable(name, material, cx, cz, halfwidth, eave, peak, depth):
    g=group(name,material)
    for side in [-1,1]:
        g.face([(cx-halfwidth,eave,cz+side*depth/2),(cx+halfwidth,eave,cz+side*depth/2),(cx,peak,cz+side*depth/2)])

def roof(cx,cz,halfwidth,length,eave,peak,axis='z',label='main'):
    g=group('sage-shingles','sage');trim=group('ochre-ridge-caps','ochre')
    def point(u,v,y):return (cx+u,y,cz+v) if axis=='z' else (cx+v,y,cz+u)
    rows=max(4,round(halfwidth/.095)); cols=max(3,round(length/.15))
    for side in [-1,1]:
        for row in range(rows):
            u0=row*halfwidth/rows;u1=min(halfwidth,(row+1.2)*halfwidth/rows)
            for col in range(cols):
                shade=(row*11+col*17+(1 if side>0 else 0))%5
                g=group('sage-shingles-'+str(shade),'sage_'+str(shade))
                v0=-length/2+col*length/cols+.002;v1=v0+length/cols-.004
                y0=peak-(peak-eave)*u0/halfwidth+.012+(rows-row)*.0004
                y1=peak-(peak-eave)*u1/halfwidth+.012
                points=[point(side*u0,v0,y0),point(side*u1,v0,y1),point(side*u1,v1,y1),point(side*u0,v1,y0)]
                g.face(points)
                low=[(x,y-.024,z) for x,y,z in points]
                g.face(list(reversed(low)))
                for i in range(4):g.face([points[i],low[i],low[(i+1)%4],points[(i+1)%4]])
        for v in [-length/2,length/2]:beam('roof-bargeboards','oak',point(0,v,peak),point(side*halfwidth,v,eave),.07)
        beam('roof-eave-fascia','oak',point(side*halfwidth,-length/2,eave),point(side*halfwidth,length/2,eave),.075)
    for col in range(cols):
        center=point(0,-length/2+(col+.5)*length/cols,peak+.038)
        box('ochre-ridge-caps','ochre',center,(.083,.047,length/cols-.006) if axis=='z' else (length/cols-.006,.047,.083))

def lean_roof(side, inner, outer, zcenter, length, high, low):
    g=group('sage-shingles','sage')
    rows=5;cols=round(length/.15)
    for i in range(rows):
        u0=inner+(outer-inner)*i/rows;u1=inner+(outer-inner)*min(rows,i+1.18)/rows
        y0=high+(low-high)*(u0-inner)/(outer-inner);y1=high+(low-high)*(u1-inner)/(outer-inner)
        for j in range(cols):
            shade=(i*11+j*17+(1 if side>0 else 0))%5
            g=group('sage-shingles-'+str(shade),'sage_'+str(shade))
            z0=zcenter-length/2+j*length/cols+.003;z1=z0+length/cols-.006
            pts=[(side*u0,y0,z0),(side*u1,y1,z0),(side*u1,y1,z1),(side*u0,y0,z1)]
            g.face(pts)
            lower=[(x,y-.025,z) for x,y,z in pts];g.face(list(reversed(lower)))
            for k in range(4):g.face([pts[k],lower[k],lower[(k+1)%4],pts[(k+1)%4]])
    for z in [zcenter-length/2,zcenter+length/2]:beam('shelter-fascia','oak',(side*inner,high,z),(side*outer,low,z),.08)
    beam('shelter-fascia','oak',(side*outer,low,zcenter-length/2),(side*outer,low,zcenter+length/2),.08)

def foundation():
    box('ground-base','stone',(0,.055,0),(2.8,.11,2.8))
    for x in range(12):
        for z in range(12):
            box('paving-stones','stone',(-1.4+(x+.5)*2.8/12,.112,-1.4+(z+.5)*2.8/12),(2.8/12-.008,.024,2.8/12-.008))
    for side in [-1,1]:
        for i in range(11):
            for y in [.155,.245]:
                p=-1.3+(i+.5)*2.6/11
                box('foundation-masonry','stone',(side*1.28,y,p),(.16,.085,.228))
    for i in range(11):
        for y in [.155,.245]:
            p=-1.3+(i+.5)*2.6/11
            box('foundation-masonry','stone',(p,y,-1.16),(.228,.085,.16))

def post(x,z,bottom,top,width=.10):
    box('oak-structure','oak',(x,(bottom+top)/2,z),(width,top-bottom,width))
    box('stone-post-shoes','stone',(x,bottom+.09,z),(width+.09,.18,width+.09))
    box('oak-joinery','oak',(x,top-.055,z),(width+.05,.12,width+.05))

def barrel(x,z,y=.125,r=.12,h=.29):
    cylinder('barrel-staves','oak_dark',(x,y+h/2,z),r,h,sides=18)
    for yy in [y+.06,y+h-.06]:cylinder('barrel-hoops','iron',(x,yy,z),r+.008,.025,sides=18)
    cylinder('barrel-heads','oak',(x,y+h+.008,z),r*.91,.018,sides=18)

def crate(x,z,y=.125,size=.19):
    box('supplies-crates','oak',(x,y+size/2,z),(size,size,size))
    for yy in [y+.022,y+size-.022]:box('supplies-crate-bands','oak_dark',(x,yy,z+size/2+.008),(size,.025,.013))
    beam('supplies-crate-bands','oak_dark',(x-size*.43,y+.035,z+size/2+.01),(x+size*.43,y+size-.035,z+size/2+.01),.028,.012)

def lantern(x,z,y):
    beam('lantern-brackets','iron',(x,y+.14,z-.10),(x,y+.14,z+.02),.018)
    cylinder('lantern-light','lantern',(x,y,z),.045,.115,sides=6)
    for yy in [y-.067,y+.067]:cylinder('lantern-frame','iron',(x,yy,z),.056,.025,sides=6)
    for a in range(6):
        t=a*math.pi/3
        beam('lantern-frame','iron',(x+.047*math.cos(t),y-.06,z+.047*math.sin(t)),(x+.047*math.cos(t),y+.06,z+.047*math.sin(t)),.009)
    cylinder('lantern-hood','copper',(x,y+.091,z),.063,.05,sides=6,top_radius=.017)

def spears(x,z,count=5):
    box('weapon-rack','oak_dark',(x,.38,z),(.29,.055,.09))
    for side in [-1,1]:beam('weapon-rack','oak_dark',(x+side*.145,.13,z-.02),(x+side*.145,.56,z+.03),.04)
    for i in range(count):
        xx=x+(i-(count-1)/2)*.05;top=.87+(i%2)*.05
        beam('spear-shafts','oak',(xx,.15,z+.055),(xx,top,z-.04),.014)
        g=group('spear-heads','iron');g.face([(xx-.025,top,z-.04),(xx,top+.11,z-.04),(xx+.025,top,z-.04),(xx,top-.035,z-.04)])

def shield(x,z):
    g=group('shield-boards','oak_dark')
    pts=[(x-.09,.23,z),(x-.09,.47,z),(x-.055,.52,z),(x+.055,.52,z),(x+.09,.47,z),(x+.09,.23,z),(x,.16,z)]
    g.face(pts);g.face([(a,b,c-.035) for a,b,c in reversed(pts)])
    for i in range(len(pts)):beam('shield-rims','iron',pts[i],pts[(i+1)%len(pts)],.014)
    box('shield-ochre','ochre',(x,.355,z+.004),(.035,.25,.008))

def window(x,z,bottom=.95,spring=1.21,radius=.095):
    arch_panel('window-glass','glass',x,z,bottom,spring,radius,.015)
    for side in [-1,1]:beam('window-oak','oak_dark',(x+side*radius,bottom,z+.018),(x+side*radius,spring,z+.018),.025)
    for i in range(12):
        a=i*math.pi/12;b=(i+1)*math.pi/12
        beam('window-oak','oak_dark',(x+radius*math.cos(a),spring+radius*math.sin(a),z+.018),(x+radius*math.cos(b),spring+radius*math.sin(b),z+.018),.024)
    beam('window-lead','iron',(x,bottom,z+.021),(x,spring+radius,z+.021),.012)
    beam('window-lead','iron',(x-radius,spring-.10,z+.021),(x+radius,spring-.10,z+.021),.012)

def barracks():
    foundation()
    box('cream-main-hall','plaster',(0,1.185,-.06),(1.77,1.91,1.88))
    gable('cream-gables','plaster',0,-.06,.885,2.14,2.89,1.88)
    for x in [-.89,.89]:
        for z in [-1.0,-.36,.32,.90]:post(x,z,.22,2.16,.09)
        beam('oak-wall-rails','oak',(x,.53,-1),(x,.53,.9),.09)
        beam('oak-wall-rails','oak',(x,1.46,-1),(x,1.46,.9),.07)
    for z in [-1.02,.91]:
        beam('oak-gable-frame','oak',(-.94,2.16,z),(0,2.91,z),.11)
        beam('oak-gable-frame','oak',(0,2.91,z),(.94,2.16,z),.11)
        beam('oak-gable-frame','oak',(-.93,2.16,z),(.93,2.16,z),.10)
        post(0,z,2.11,2.89,.095)
        for side in [-1,1]:beam('oak-gable-frame','oak',(side*.65,2.19,z),(side*.20,2.68,z),.075)
    roof(0,-.06,1.00,2.11,2.17,2.92)
    # Gate, individual clipped planks, voussoirs, hinges and paired handles.
    radius=.40;spring=1.61;bottom=.21
    arch_panel('gate-shadow','iron',0,.963,bottom,spring,radius+.018,.02)
    g=group('gate-planks','oak_dark')
    for i in range(12):
        left=-radius+i*2*radius/12+.002;right=left+2*radius/12-.004
        top_left=spring+math.sqrt(max(0,radius*radius-left*left));top_right=spring+math.sqrt(max(0,radius*radius-right*right))
        g.face([(left,bottom,.988),(right,bottom,.988),(right,top_right,.988),(left,top_left,.988)])
    arch_stones(0,.995,bottom,spring,radius,.095)
    for yy in [.53,1.03]:
        for side in [-1,1]:
            box('gate-hinges','iron',(side*.18,yy,1.009),(.28,.035,.018))
            for xx in [.07,.18,.27]:cylinder('gate-rivets','iron',(side*xx,yy,1.022),.010,.010,'z',8)
    for side in [-1,1]:
        cx=side*.07;cy=.79
        for i in range(16):
            a=i*math.pi/8;b=(i+1)*math.pi/8
            beam('gate-handles','iron',(cx+.032*math.cos(a),cy+.045*math.sin(a),1.033),(cx+.032*math.cos(b),cy+.045*math.sin(b),1.033),.012)
    for x in [-.62,.62]:
        window(x,.957,1.55,1.74,.095);lantern(x,1.06,.88)
        window(x,-1.022,.95,1.26,.105)
    box('cultural-banner','ochre',(0,2.39,.983),(.16,.30,.018))
    beam('banner-rod','iron',(-.13,2.57,1.00),(.13,2.57,1.00),.024)
    # Sheltered military stores flank the main hall.
    for side in [-1,1]:
        lean_roof(side,.81,1.34,-.06,2.16,1.75,1.41)
        for z in [-1.08,-.33,.39,1.01]:
            post(side*1.24,z,.125,1.43,.095)
            beam('shelter-braces','oak',(side*1.24,.99,z),(side*.91,1.47,z),.055)
        beam('shelter-rear-rail','oak',(side*1.24,.58,-1.08),(side*1.24,.58,-.39),.055)
        barrel(side*1.05,-.69,r=.105,h=.27);barrel(side*1.07,-.39,r=.10,h=.23)
        crate(side*1.08,.30,size=.19);crate(side*1.07,.54,y=.13,size=.17)
        spears(side*.62,1.13,5);shield(side*.80,1.17)
    for side in [-1,1]:
        for z in [-.54,.40]:
            x=side*.55
            box('dormer-cream','plaster',(x,2.50,z),(.30,.32,.33))
            g=group('dormer-cream','plaster')
            g.face([(x+side*.15,2.66,z-.165),(x+side*.15,2.66,z+.165),(x+side*.15,2.84,z)])
            roof(x,z,.20,.39,2.66,2.86,axis='x')
            box('dormer-glass','glass',(x+side*.159,2.51,z),(.02,.16,.16))
            beam('dormer-oak','oak',(x+side*.176,2.40,z-.1),(x+side*.176,2.62,z-.1),.025)
            beam('dormer-oak','oak',(x+side*.176,2.40,z),(x+side*.176,2.62,z),.019)
            beam('dormer-oak','oak',(x+side*.176,2.51,z-.1),(x+side*.176,2.51,z+.1),.019)
            for zz in [-.18,.18]:beam('dormer-oak','oak',(x+side*.176,2.66,z+zz),(x+side*.176,2.85,z),.028)
            beam('dormer-oak','oak',(x+side*.176,2.40,z+.1),(x+side*.176,2.62,z+.1),.025)
    # Stone chimney, coursed masonry and a shaped aged-copper vent cap.
    for row in range(5):
        for xx in [-1,1]:
            for zz in [-1,1]:box('chimney-stone','stone',(-.32+xx*.061,2.83+row*.095,-.70+zz*.061),(.117,.09,.117))
    cylinder('chimney-copper','copper',(-.32,3.32,-.70),.14,.12,sides=16,top_radius=.095)
    cylinder('chimney-copper','copper',(-.32,3.415,-.70),.19,.08,sides=16,top_radius=.035)
    # Low frontage fence leaves the central exit clear.
    for side in [-1,1]:
        for x in [.55,1.20]:post(side*x,1.30,.125,.47,.055)
        for yy in [.27,.44]:beam('frontage-fence','oak',(side*.55,yy,1.30),(side*1.20,yy,1.30),.04)
    box('front-step','stone',(0,.14,1.23),(.88,.06,.30))

def materials():
    for path in sorted((ROOT/'textures').glob('*.png')):
        name=path.stem;mat=bpy.data.materials.new(name);mat.use_nodes=True
        bsdf=mat.node_tree.nodes.get('Principled BSDF')
        image=bpy.data.images.load(str(path));image.pack()
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value=.88 if name not in ['iron','copper','glass'] else .50
        if name in ['iron','copper']:bsdf.inputs['Metallic'].default_value=.35
        noise=mat.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=80
        bump=mat.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=.012
        mat.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);mat.node_tree.links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
        MAT[name]=mat

def setup_camera():
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=1024;scene.render.resolution_y=1024;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
    scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0;scene.view_settings.gamma=1
    world=bpy.data.worlds.new('warm-daylight');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.81,.73,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65
    light=bpy.data.lights.new('key-warm','AREA');light.energy=650;light.color=(1,.92,.79);light.shape='DISK';light.size=5
    obj=bpy.data.objects.new('key-warm',light);scene.collection.objects.link(obj);obj.location=coord((-4,8,5));obj.rotation_euler=(Vector(coord((0,1,0)))-obj.location).to_track_quat('-Z','Y').to_euler()
    fill=bpy.data.lights.new('soft-cool-fill','AREA');fill.energy=100;fill.color=(.76,.85,1);fill.size=6
    obj=bpy.data.objects.new('soft-cool-fill',fill);scene.collection.objects.link(obj);obj.location=coord((5,6,-4));obj.rotation_euler=(Vector(coord((0,1,0)))-obj.location).to_track_quat('-Z','Y').to_euler()
    cam_data=bpy.data.cameras.new('registered-orthographic');cam=bpy.data.objects.new('registered-orthographic',cam_data);scene.collection.objects.link(cam);scene.camera=cam
    cam_data.type='ORTHO';cam_data.ortho_scale=8;cam_data.clip_start=.01;cam_data.clip_end=100
    return cam

def set_view(cam,index):
    az=math.radians(index*45);el=math.radians(46);aim=Vector(coord((0,1.52,0)))
    cam.location=aim+Vector(coord((math.sin(az)*20*math.cos(el),20*math.sin(el),math.cos(az)*20*math.cos(el))))
    cam.rotation_euler=(aim-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--asset',default='barracks');parser.add_argument('--views',default='1');parser.add_argument('--samples',type=int,default=24)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for folder in ['models','captures']:(ROOT/folder).mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    materials()
    if args.asset != 'barracks':raise ValueError('Range authoring follows validated Barracks slice')
    barracks()
    parent=bpy.data.objects.new(args.asset+'.complete',None);bpy.context.collection.objects.link(parent)
    objects=[g.finish(parent) for g in GEOMETRY.values()]
    cam=setup_camera();bpy.context.scene.cycles.samples=args.samples
    set_view(cam,1)
    model_path=ROOT/'models'/(args.asset+'-complete.blend');bpy.ops.wm.save_as_mainfile(filepath=str(model_path))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    parent.select_set(True)
    glb=ROOT/'models'/(args.asset+'-complete.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT')
    points=[obj.matrix_world@Vector(corner) for obj in objects for corner in obj.bound_box]
    bounds={'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]}
    records=[]
    for index in [int(x) for x in args.views.split(',')]:
        set_view(cam,index)
        projected=world_to_camera_view(bpy.context.scene,cam,Vector((0,0,0)))
        path=ROOT/'captures'/f'{args.asset}-complete-view-{index:02}.png'
        bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        records.append({'asset':args.asset,'state':'complete','viewIndex':index,'file':path.name,'sha256':sha(path),'bytes':path.stat().st_size,'camera':{'projection':'orthographic','elevationDegrees':46,'azimuthDegrees':index*45,'canvasPixels':[1024,1024],'canvasWorldUnits':8,'pixelsPerWorldUnit':128,'groundOriginPixelFromTopLeft':[projected.x*1024,(1-projected.y)*1024]},'renderer':'Blender Cycles CPU','samples':args.samples,'lighting':{'keyPositionGame':[-4,8,5],'keyWatts':650,'keySize':5,'worldStrength':.65,'fillWatts':100,'note':'Physical Blender lighting; not declared equivalent to Three intensity units'}})
    concept=REPO/'assets/buildings/frontier-civilization-concepts-v1'/f'{args.asset}.png'
    receipt={'schema':'thousand-unit-skirmish.private-building-authoring.v1','asset':args.asset,'status':'private-source-iteration; runtime and visual acceptance pending','sourceConcept':str(concept.relative_to(REPO)),'sourceConceptSHA256':sha(concept),'authoring':'original deterministic Blender modeling; no provider or generated concept pixels copied','scriptSHA256':sha(Path(__file__)),'blenderVersion':bpy.app.version_string,'spend':0,'occupancyCells':[3,3],'authoredBaseWorld':[2.8,2.8],'origin':'center of ground footprint, ground y=0','boundsBlender':bounds,'door':{'bottomWorld':.21,'springWorld':1.61,'archRadiusWorld':.40,'heightWorld':1.80,'widthWorld':.80,'clearanceStatus':'actual Worker comparison pending'},'model':{'blendSHA256':sha(model_path),'glbSHA256':sha(glb),'glbBytes':glb.stat().st_size},'records':records,'limits':['Complete only','No live team-standard geometry in captures; runtime ownership treatment pending','No lifecycle states, runtime binding, release or deployed-game claim','Captures contain authored model geometry; no painted concept pixels']}
    (ROOT/'captures'/f'{args.asset}-capture-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('AUTHORING_RECEIPT '+json.dumps({'asset':args.asset,'glbBytes':glb.stat().st_size,'views':len(records),'spend':0}))

if __name__=='__main__':main()
