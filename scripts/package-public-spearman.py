#!/usr/bin/env python3
"""Package the local public-model bake under the existing unit sprite contract."""
import colorsys, copy, hashlib, json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets/units/spearman-sprite-v2'
DIRECTIONS=['north','north-east','east','south-east','south','south-west','west','north-west']
POSES=[('idle',0),*[('walk',i) for i in range(4)],*[('attack',i) for i in range(3)],*[('defeat',i) for i in range(4)]]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
capture=json.loads((OUT/'source/capture.json').read_text())
if capture['newlyRenderedFrames']!=96:raise ValueError('Full eight-heading capture required')
manifest=json.loads((ROOT/'assets/units/spearman-sprite-v1/sprite-atlas-pack-v1.json').read_text())
asset=manifest['assets'][0];asset['frames']=[];asset['clips']=[]
atlas=Image.new('RGBA',(256*8,256*len(POSES)));mask=Image.new('L',atlas.size)
measurements=[]
for row,(state,key) in enumerate(POSES):
    for col,heading in enumerate(DIRECTIONS):
        frame=f'{state}-{heading}-{key}';path=OUT/'source'/(frame+'.png');tile=Image.open(path).convert('RGBA')
        if tile.size!=(256,256):raise ValueError('Shared capture canvas changed')
        box=tile.getchannel('A').point(lambda a:255 if a>=8 else 0).getbbox()
        if not box or min(box[0],box[1],256-box[2],256-box[3])<4:raise ValueError(f'{frame}: empty/edge-cut render')
        x=col*256;y=row*256;atlas.paste(tile,(x,y))
        values=[]
        for r,g,b,a in tile.getdata():
            hue,saturation,value=colorsys.rgb_to_hsv(r/255,g/255,b/255)
            values.append(a if 180<=hue*360<=250 and saturation>.32 and value>.12 else 0)
        tm=Image.new('L',tile.size);tm.putdata(values);mask.paste(tm,(x,y))
        r={'x':x,'y':y,'width':256,'height':256}
        asset['frames'].append({'id':frame,'canvasPx':{'width':256,'height':256},
            'groundPivotPx':{'x':capture['rootPx'][0],'y':capture['rootPx'][1]},'groundPivotStatus':'unreviewed-estimate',
            'alphaBoundsPx':{'x':box[0],'y':box[1],'width':box[2]-box[0],'height':box[3]-box[1]},
            'fallbackRectPx':{'pageId':'spearman-color','rectPx':r},
            'frameRectsPx':[{'layerId':'actor','pageId':'spearman-color','rectPx':{'x':x+box[0]-4,'y':y+box[1]-4,'width':box[2]-box[0]+8,'height':box[3]-box[1]+8},'offsetPx':{'x':box[0]-4,'y':box[1]-4}}]})
        measurements.append({'frameId':frame,'file':'source/'+frame+'.png','sha256':sha(path),'alphaBoundsPx':list(box),'maskPixels':sum(v>0 for v in values)})
for heading in DIRECTIONS:
    for state,timing in [('idle',[1000]),('walk',[200]*4),('attack',[180,360,340]),('defeat',[120,240,360,360])]:
        asset['clips'].append({'stateId':state,'directionId':heading,'loop':state in ['idle','walk'],
            'sequence':[{'frameId':f'{state}-{heading}-{key}','durationMs':ms} for key,ms in enumerate(timing)]})
# One world/pixel scale across every heading/pose; source body 0.8 projects
# through the actual camera's vertical component, then matches the Human baseline.
camera_up=math.hypot(.78,.78)/math.sqrt(.78**2+1.12**2+.78**2)
body_px=capture['sourceBodyHeight']*camera_up*256/capture['orthographicScale']
world_per_pixel=1.2161865234375/body_px
asset['heightWorld']=max(f['alphaBoundsPx']['height'] for f in asset['frames'])*world_per_pixel
radius=max(f['alphaBoundsPx']['width'] for f in asset['frames'])*world_per_pixel/2
asset['artBoundsWorld']={'min':[-radius,0,-radius],'max':[radius,asset['heightWorld'],radius]};asset['cullingBoundsWorld']=copy.deepcopy(asset['artBoundsWorld'])
manifest['packId']='spearman-public-model-bake';manifest['packVersion']='0.1.0'
manifest['provenance']={'license':'LicenseRef-Thousand-Unit-Skirmish-Internal-Review',
    'source':'Already-public frontier-glb-sample-v2/models/unit-art-v2.glb; original project geometry and palette; no private or third-party source',
    'authoringTool':'Blender 4.3.2 Cycles CPU, explicit rigid-limb poses and eight fixed-camera rotations; Pillow atlas packaging',
    'notes':'96 newly rendered directional frames from 12 locally authored pose samples. Zero reused sprite frames, zero provider jobs/charges. Public geometry/palette retained; separate leg/arm keys, spear thrust and backward fall. Shared geometric root/camera/pixel scale. Original v1 and rejected probe retained. See capture.json and README.md.'}
dimensions={'width':atlas.width,'height':atlas.height}
for p in manifest['pages']:p['dimensionsPx']=dimensions
atlas.save(OUT/'spearman-atlas-source.png');atlas.save(OUT/'spearman-atlas-runtime.png');mask.save(OUT/'team-accent-mask.png')
for file in manifest['files']:file['dimensionsPx']=dimensions;file['sha256']=sha(OUT/file['path'])
(OUT/'sprite-atlas-pack-v1.json').write_text(json.dumps(manifest,indent=2)+'\n')
capture.update({'sharedWorldPerPixel':world_per_pixel,'bodyReferenceWorld':1.2161865234375,'bodyReferenceProjectedPx':body_px,
    'missingActionHeadingCells':[],'measurements':measurements,
    'groundContact':'geometric source origin; projected depth can put feet below pivot, handled by existing spriteGroundDepthBias',
    'blenderSourceSha256':sha(OUT/'source/spearman-authored-poses.blend')})
(OUT/'capture.json').write_text(json.dumps(capture,indent=2)+'\n')
preview=Image.new('RGB',(8*160,len(POSES)*150),(48,52,56));draw=ImageDraw.Draw(preview)
for f in asset['frames']:
    r=f['fallbackRectPx']['rectPx'];tile=atlas.crop((r['x'],r['y'],r['x']+256,r['y']+256));tile.thumbnail((150,128))
    x=r['x']//256*160;y=r['y']//256*150;preview.paste(tile,(x,y+20),tile);draw.text((x+1,y+2),f['id'],fill='white')
preview.save(OUT/'review.png')
print(f'Spearman: 96 new local render frames from 12 authored poses; public geometry; zero provider jobs/charges; body baseline {body_px:.3f}px')
