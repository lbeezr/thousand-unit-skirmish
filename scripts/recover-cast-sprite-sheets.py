#!/usr/bin/env python3
"""Recover whole painted poses before packing; never crop at a nominal cell border.
Requires Pillow. Inputs are retained directional PNGs and the original pose layout.
Fails on missing, merged, ambiguous or whole-sheet-cut silhouettes. No generation.
"""
import argparse, hashlib, json, math
from collections import deque
from pathlib import Path
from PIL import Image

THRESHOLD = 8
CELL = 160
MARGIN = 8
COLUMNS = 16
DIRECTIONS = ['north','north-east','east','south-east','south','south-west','west','north-west']

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def alpha_box(image): return image.getchannel('A').point(lambda value:255 if value>=THRESHOLD else 0).getbbox()
def silhouettes(image):
    w,h=image.size
    pixels=bytearray(value>=THRESHOLD for value in image.getchannel('A').tobytes())
    large=[]; small=[]
    for start in range(w*h):
        if not pixels[start]: continue
        queue=deque([start]); pixels[start]=0; points=[]
        while queue:
            index=queue.popleft();x=index%w;y=index//w;points.append((x,y))
            for xx,yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0<=xx<w and 0<=yy<h and pixels[yy*w+xx]:
                    pixels[yy*w+xx]=0;queue.append(yy*w+xx)
        box=[min(x for x,y in points), min(y for x,y in points),
             max(x for x,y in points)+1,max(y for x,y in points)+1]
        (large if len(points)>100 else small).append(box)
    # Include detached fine details near the main silhouette; never merge actors.
    for box in small:
        def distance(other):
            return max(other[0]-box[2],box[0]-other[2],0)**2 + max(other[1]-box[3],box[1]-other[3],0)**2
        if not large: raise ValueError('No primary silhouettes found')
        nearest=min(large,key=distance)
        if distance(nearest)<=16:
            nearest[:]=[min(nearest[0],box[0]),min(nearest[1],box[1]),max(nearest[2],box[2]),max(nearest[3],box[3])]
        else:
            raise ValueError(f'Unassigned detached source detail at {box}; review layout before packing')
    return large

def recover(pack):
    manifest=json.loads((pack/'sprite-atlas-pack-v1.json').read_text())
    asset=manifest['assets'][0]
    layout=json.loads((pack/'source-directional/layout.json').read_text())
    poses={}; inputs={}; measurements=[]
    for batch in layout['batches']:
        direction=batch['direction'];file=pack/'source-directional'/f'{direction}.png'
        image=Image.open(file).convert('RGBA');inputs[direction]={'file':f'source-directional/{direction}.png','sha256':sha(file)}
        boxes=silhouettes(image)
        if len(boxes)!=len(batch['frames']): raise ValueError(f'{file}: expected {len(batch["frames"])} separate poses, got {len(boxes)}')
        by_cell={}
        for box in boxes:
            if min(box[0],box[1],image.width-box[2],image.height-box[3])<=1:
                raise ValueError(f'{file}: silhouette touches source-sheet edge; regenerate this pose')
            center=((box[0]+box[2])/2,(box[1]+box[3])/2)
            cell=(int(center[0]//128),int(center[1]//128))
            if cell in by_cell: raise ValueError(f'{file}: ambiguous silhouettes in nominal cell {cell}')
            by_cell[cell]=box
        for frame in batch['frames']:
            x,y,w,h=frame['batchRect'];box=by_cell.pop((x//128,y//128),None)
            if box is None: raise ValueError(f'{file}: missing pose {frame["id"]}')
            # Two pixels retain the antialiased fringe. Nominal cell boundaries
            # are layout hints only, never a crop limit.
            crop=[box[0]-2,box[1]-2,box[2]+2,box[3]+2]
            if crop[0]<0 or crop[1]<0 or crop[2]>image.width or crop[3]>image.height:
                raise ValueError(f'{file}: insufficient source fringe for {frame["id"]}')
            tile=image.crop(crop)
            key=frame['id']
            poses[key]={'tile':tile,'origin':(crop[0]-x,crop[1]-y),'direction':direction,'sourceBox':box,'cellOrigin':(x,y)}
            measurements.append({'frameId':key,'direction':direction,'sourceAlphaBoxPx':box,
                'nominalCellRectPx':[x,y,w,h],'crossedNominalCell':box[0]<x or box[1]<y or box[2]>x+w or box[3]>y+h})
        if by_cell: raise ValueError(f'{file}: unexpected poses remain')
    if set(poses)!=set(f['id'] for f in asset['frames']): raise ValueError('Recovered pose roster differs from runtime clip roster')
    # Anchor every heading to its complete idle feet. All its action frames keep
    # this root; one fit across every heading/state preserves their relative motion.
    pivots={direction:(64,alpha_box(poses[f'idle-{direction}-0']['tile'])[3]+poses[f'idle-{direction}-0']['origin'][1]) for direction in DIRECTIONS}
    minx=miny=math.inf;maxx=maxy=-math.inf
    for pose in poses.values():
        ox,oy=pose['origin'];px,py=pivots[pose['direction']]
        minx=min(minx,ox-px);miny=min(miny,oy-py)
        maxx=max(maxx,ox+pose['tile'].width-px);maxy=max(maxy,oy+pose['tile'].height-py)
    fit=(CELL-2*MARGIN)/max(maxx-minx,maxy-miny)
    root=(MARGIN-minx*fit,MARGIN-miny*fit)
    atlas=Image.new('RGBA',(COLUMNS*CELL,math.ceil(len(asset['frames'])/COLUMNS)*CELL))
    mask=Image.new('L',atlas.size)
    for index,frame in enumerate(asset['frames']):
        pose=poses[frame['id']];tile=pose['tile'];px,py=pivots[pose['direction']];ox,oy=pose['origin']
        tile=tile.resize((max(1,round(tile.width*fit)),max(1,round(tile.height*fit))),Image.Resampling.LANCZOS)
        cell=Image.new('RGBA',(CELL,CELL))
        position=(round(root[0]+(ox-px)*fit),round(root[1]+(oy-py)*fit))
        cell.paste(tile,position)
        box=alpha_box(cell)
        if box is None or min(box[0],box[1],CELL-box[2],CELL-box[3])<4: raise ValueError(f'{frame["id"]}: final fit clipped')
        rect={'x':index%COLUMNS*CELL,'y':index//COLUMNS*CELL,'width':CELL,'height':CELL}
        frame['canvasPx']={'width':CELL,'height':CELL};frame['groundPivotPx']={'x':root[0],'y':root[1]}
        frame['alphaBoundsPx']={'x':box[0],'y':box[1],'width':box[2]-box[0],'height':box[3]-box[1]}
        frame['fallbackRectPx']['rectPx']=rect
        for layer in frame['frameRectsPx']:layer['rectPx']=rect.copy();layer['offsetPx']={'x':0,'y':0}
        atlas.paste(cell,(rect['x'],rect['y']));mask.paste(cell.getchannel('A'),(rect['x'],rect['y']))
    root=(root[0],max(frame['alphaBoundsPx']['y']+frame['alphaBoundsPx']['height']
                      for frame in asset['frames'] if frame['id'].startswith('idle-')))
    for frame in asset['frames']: frame['groundPivotPx']={'x':root[0],'y':root[1]}
    report={'asset':asset['id'],'technique':'connected-silhouette extraction before shared-root envelope fitting',
        'alphaThreshold':THRESHOLD,'cellPx':CELL,'marginPx':MARGIN,'fitScale':fit,'sharedPivotPx':{'x':root[0],'y':root[1]},
        'sourceEnvelopeRelativeToRootPx':{'min':[minx,miny],'max':[maxx,maxy]},'directionalInputs':inputs,
        'recoveredNominalCellCrossings':sum(f['crossedNominalCell'] for f in measurements),'frameMeasurements':measurements,
        'reviewPoseSubstitutions':{},'runtimeEdgeFrames':[],'frameCount':len(poses)}
    # Match the historical 1.35/128 world units per source pixel; changing packing
    # resolution must not silently change unit size in the game.
    asset['heightWorld']=max(f['alphaBoundsPx']['height'] for f in asset['frames'])*1.35/128/fit
    manifest['packVersion']='0.3.0'
    manifest['provenance']['notes']='Complete original directional silhouettes recovered before cell packing. One shared root and fitted motion envelope; no held or substituted poses. See clipping-review.json for input hashes and extraction bounds. Art identity/motion remains exploratory.'
    dimensions={'width':atlas.width,'height':atlas.height}
    for page in manifest['pages']:page['dimensionsPx']=dimensions.copy()
    return manifest,atlas,mask,report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('packs',nargs='+',type=Path);parser.add_argument('--write',action='store_true');args=parser.parse_args()
    for pack in args.packs:
        manifest,atlas,mask,report=recover(pack)
        if args.write:
            atlas.save(pack/'cast-atlas-source.png');atlas.save(pack/'cast-atlas-runtime.png');mask.save(pack/'team-accent-mask.png')
            for file in manifest['files']:file['dimensionsPx']={'width':atlas.width,'height':atlas.height};file['sha256']=sha(pack/file['path'])
            (pack/'sprite-atlas-pack-v1.json').write_text(json.dumps(manifest,indent=2)+'\n')
            (pack/'clipping-review.json').write_text(json.dumps(report,indent=2)+'\n')
        print(f'{report["asset"]}: {report["frameCount"]} full poses; {report["recoveredNominalCellCrossings"]} nominal-cell crossings recovered; no substitutions; {atlas.width}x{atlas.height}')
