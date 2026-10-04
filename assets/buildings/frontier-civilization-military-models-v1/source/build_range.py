"""Original new-design Range using the same measured private material/camera kit."""
import sys, argparse, math, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_military as c
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

def target(x,z,center_y=.97,radius=.26):
    c.cylinder('straw-targets','target',(x,center_y,z),radius,.065,'z',36)
    for material,r,front in [('target_blue',radius*.79,.039),('target',radius*.57,.045),('target_red',radius*.34,.051),('target',radius*.14,.057)]:
        c.cylinder('target-rings-'+material,material,(x,center_y,z+front),r,.012,'z',36)
    for side in [-1,1]:
        c.beam('target-stands','oak_dark',(x+side*.16,.13,z+.19),(x+side*.055,center_y-.16,z-.028),.041)
    c.beam('target-stands','oak_dark',(x,.13,z-.25),(x,center_y-.11,z-.025),.036)
    # A few actual arrows keep the target readable without cluttering its center.
    for offset in [-.07,.035]:
        c.beam('target-arrows','oak_dark',(x+offset,center_y+.02,z+.11),(x+offset-.10,center_y+.065,z+.32),.007)

def bow(x,z,y=.60):
    points=[(x+.072*math.sin(i*math.pi/12),y+.37*math.cos(i*math.pi/12),z) for i in range(13)]
    for i in range(12):c.beam('bow-staves','oak_dark',points[i],points[i+1],.014)
    c.beam('bow-strings','linen',points[0],points[-1],.003)

def side_window(x,z):
    before={key:len(g.vertices) for key,g in c.GEOMETRY.items()}
    c.window(0,0,1.08,1.40,.105)
    for key,g in c.GEOMETRY.items():
        for index in range(before.get(key,0),len(g.vertices)):
            gx, minus_gz, gy=g.vertices[index]
            g.vertices[index]=c.coord((x-minus_gz,gy,z-gx))

def range_asset():
    c.foundation()
    # Broad open frontage and cream/oak rear storage, with the enclosed annex on the right.
    c.box('range-rear-limewash','plaster',(-.30,1.00,-.96),(1.94,1.75,.09))
    c.box('range-annex-limewash','plaster',(.95,1.08,-.04),(.55,1.91,1.89))
    c.box('range-annex-stone','stone',(.95,.32,-.04),(.58,.38,1.94))
    for x in [-1.23,-.32,.67,1.23]:
        for z in [-1.01,1.01]:c.post(x,z,.125,2.13,.10)
        c.beam('range-cross-beams','oak',(x,2.13,-1.11),(x,2.13,1.11),.095)
    for z in [-1.06,1.05]:
        c.beam('range-long-beams','oak',(-1.32,2.14,z),(1.32,2.14,z),.13)
        for x in [-1.23,-.32,.67]:
            for side in [-1,1]:c.beam('range-knee-braces','oak',(x,1.70,z),(x+side*.22,2.12,z),.07)
    c.roof(0,-.02,1.16,2.68,2.17,2.70,axis='x')
    # Gabled annex end and visibly structural end rafters.
    g=c.group('annex-gable','plaster')
    for x in [.66,1.23]:g.face([(x,2.13,-1.02),(x,2.13,.98),(x,2.69,-.02)])
    for x in [-1.32,1.32]:
        for z in [-1.17,1.13]:c.beam('range-gable-rafters','oak',(x,2.71,-.02),(x,2.16,z),.10)
    for x in [-1.19,-.62,.04,.67]:
        c.post(x,-1.02,.125,2.13,.085)
        c.beam('rear-wall-rails','oak',(x,.60,-1.02),(min(.68,x+.6),.60,-1.02),.07)
    for x in [-.91,-.31,.29]:target(x,.79)
    for z in [-.96,-.32,.32,.95]:c.post(1.243,z,.22,2.13,.075)
    for y in [.56,1.60]:c.beam('annex-side-rails','oak',(1.247,y,-.98),(1.247,y,.96),.07)
    side_window(1.242,-.62);side_window(1.242,.47)
    # Readable bowed staves, shelf and quiver at the front-right post.
    c.box('bow-rack','oak_dark',(.46,.46,.91),(.37,.055,.07))
    c.box('bow-rack','oak_dark',(.46,.98,.91),(.37,.04,.065))
    for x in [.31,.43,.55]:bow(x,.985,.62)
    c.cylinder('arrow-quiver','oak_dark',(.62,.30,.96),.063,.34,sides=12)
    for i in range(6):
        xx=.62+(i%3-1)*.024;zz=.96+(i//3-.5)*.023
        top=.76+(i%2)*.05
        c.beam('quiver-arrows','oak',(xx,.27,zz),(xx,top,zz),.007)
        c.box('arrow-fletching','linen',(xx,top-.025,zz),(.025,.047,.004))
    # Annex door, dressed threshold and small linen shelter.
    c.arch_panel('annex-door','oak_dark',.97,.941,.22,1.60,.20,.05)
    c.arch_stones(.97,.965,.22,1.60,.20,.06)
    for yy in [.57,1.18]:c.box('annex-door-hinges','iron',(.97,yy,1.001),(.31,.025,.018))
    c.cylinder('annex-door-handle','iron',(.99,.87,1.025),.021,.015,'z',12)
    awning=c.group('annex-linen-awning','linen')
    awning.face([(.66,1.99,.99),(1.25,1.99,.99),(1.25,1.70,1.30),(.66,1.70,1.30)])
    for x in [.69,1.23]:
        c.beam('awning-brackets','oak',(x,1.97,1.00),(x,1.70,1.31),.04)
        c.beam('awning-brackets','oak',(x,1.44,1.00),(x,1.70,1.31),.035)
    c.lantern(-1.25,1.10,1.68);c.lantern(.70,1.14,1.56)
    # Rear window, supplies and the copper chimney keep rear views authored too.
    c.window(.98,-1.036,1.14,1.45,.09)
    c.barrel(1.15,1.13,r=.095,h=.24);c.crate(-1.10,-.77,size=.20);c.crate(-.89,-.78,size=.18)
    c.box('hay-bales','target',(-.50,.31,-.55),(.37,.37,.31))
    c.box('hay-bales','target',(-.85,.25,-.52),(.28,.24,.26))
    for side in [-1,1]:
        for x in [-1.23,-.42,.38]:
            if side<0:continue
            c.post(x,1.31,.125,.50,.055)
        if side>0:
            for yy in [.29,.46]:c.beam('practice-front-rails','oak',(-1.23,yy,1.31),(.38,yy,1.31),.04)
    # A single front dormer is subordinate to the main training roof.
    c.box('range-dormer','plaster',(-.16,2.50,.63),(.33,.30,.27))
    c.gable('range-dormer','plaster',-.16,.63,.165,2.65,2.84,.27)
    c.roof(-.16,.63,.21,.34,2.65,2.85)
    c.window(-.16,.779,2.39,2.53,.067)
    for row in range(5):
        for x in [-1,1]:
            for z in [-1,1]:c.box('range-chimney-stone','stone',(.96+x*.056,2.71+row*.082,-.55+z*.056),(.105,.078,.105))
    c.cylinder('range-chimney-copper','copper',(.96,3.13,-.55),.125,.10,sides=16,top_radius=.08)
    c.cylinder('range-chimney-copper','copper',(.96,3.205,-.55),.165,.065,sides=16,top_radius=.026)
    c.box('annex-flower-box','oak',(1.29,.99,.47),(.085,.085,.30))
    for i in range(6):
        z=.35+i*.047
        c.cylinder('small-ochre-flowers','ochre',(1.30,1.055,z),.017,.025,sides=6)

def main():
    p=argparse.ArgumentParser();p.add_argument('--views',default='1');p.add_argument('--samples',type=int,default=48)
    args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for folder in ['models','captures']:(c.ROOT/folder).mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    c.materials();range_asset()
    root=bpy.data.objects.new('archery-range.complete',None);bpy.context.collection.objects.link(root)
    objects=[g.finish(root) for g in c.GEOMETRY.values()]
    cam=c.setup_camera();bpy.context.scene.cycles.samples=args.samples;c.set_view(cam,1)
    blend=c.ROOT/'models/archery-range-complete.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    root.select_set(True)
    glb=c.ROOT/'models/archery-range-complete.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT')
    records=[]
    for index in [int(x) for x in args.views.split(',')]:
        c.set_view(cam,index);projected=world_to_camera_view(bpy.context.scene,cam,Vector((0,0,0)))
        path=c.ROOT/'captures'/f'archery-range-complete-view-{index:02}.png'
        bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        records.append({'asset':'archery-range','state':'complete','viewIndex':index,'file':path.name,'sha256':c.sha(path),'bytes':path.stat().st_size,'camera':{'projection':'orthographic','elevationDegrees':46,'azimuthDegrees':index*45,'canvasPixels':[1024,1024],'canvasWorldUnits':8,'pixelsPerWorldUnit':128,'groundOriginPixelFromTopLeft':[projected.x*1024,(1-projected.y)*1024]},'renderer':'Blender Cycles CPU','samples':args.samples})
    concept=c.REPO/'assets/buildings/frontier-civilization-concepts-v1/archery-range.png'
    receipt={'schema':'thousand-unit-skirmish.private-building-authoring.v1','asset':'archery-range','status':'private-source-iteration; runtime and visual acceptance pending','sourceConcept':str(concept.relative_to(c.REPO)),'sourceConceptSHA256':c.sha(concept),'authoring':'original deterministic Blender modeling; no provider or copied concept pixels','scriptSHA256':c.sha(Path(__file__)),'sharedHelperSHA256':c.sha(Path(c.__file__)),'blenderVersion':bpy.app.version_string,'spend':0,'occupancyCells':[3,3],'authoredBaseWorld':[2.8,2.8],'origin':'center of ground footprint, ground y=0','clearance':{'openFrontEaveWorld':2.13,'floorWorld':.125,'annexDoorHeightWorld':1.58,'status':'static sprite and native overlap review pending'},'model':{'blendSHA256':c.sha(blend),'glbSHA256':c.sha(glb),'glbBytes':glb.stat().st_size},'records':records,'limits':['Complete only','No live team standards in captures','No lifecycle, binding, release or deployed-game acceptance','Physical Blender lighting shares orientation but does not equate Three intensity units']}
    (c.ROOT/'captures/archery-range-capture-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('AUTHORING_RECEIPT '+json.dumps({'asset':'archery-range','views':len(records),'glbBytes':glb.stat().st_size,'spend':0}))

if __name__=='__main__':main()
