#!/usr/bin/env python3
"""Register complete public painted silhouettes; no generation or pose synthesis.

The old floor-divided sheets cut feet/weapons and use screen-compass labels.
Recover connected actors first, then translate their foot roots into padded cells.
Run with infantry or archer. Original packs and all authored keys remain intact.
"""
import argparse
from collections import deque
import copy
import hashlib
import json
from pathlib import Path
from statistics import median
from PIL import Image, ImageDraw
from foot_sprite_world_bounds import placed_sprite_bounds

ROOT = Path(__file__).resolve().parent.parent
DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
# Camera +X/+Z: N projects down-left, NE down, E down-right, SE right,
# S up-right, SW up, W up-left, NW left. These are separate original views.
SOURCE_COLUMNS = [5, 4, 3, 2, 1, 0, 7, 6]
CELL = 320
PIVOT = (160, 308)
VERSIONS = {'infantry': ('v3', 'v4'), 'archer': ('v2', 'v3')}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def actors(image):
    """Label silhouettes, preserving nearby fringe without adjacent-row pixels."""
    w, h = image.size
    alpha = image.getchannel('A').tobytes()
    unseen = bytearray(a >= 8 for a in alpha)
    components = []
    for start in range(w * h):
        if not unseen[start]:
            continue
        q = deque([start]); unseen[start] = 0; pixels = []
        while q:
            i = q.popleft(); pixels.append(i); x, y = i % w, i // w
            for xx, yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0 <= xx < w and 0 <= yy < h and unseen[yy*w+xx]:
                    unseen[yy*w+xx] = 0; q.append(yy*w+xx)
        box = [min(i % w for i in pixels), min(i // w for i in pixels),
               max(i % w for i in pixels)+1, max(i // w for i in pixels)+1]
        components.append({'box': box, 'pixels': pixels})
    large = [c for c in components if len(c['pixels']) > 100]
    if len(large) != 48:
        raise ValueError(f'Expected 48 distinct complete actors, found {len(large)}')
    for c in components:
        if len(c['pixels']) > 100:
            continue
        b = c['box']
        def distance(other):
            a = other['box']
            return max(a[0]-b[2],b[0]-a[2],0)**2 + max(a[1]-b[3],b[1]-a[3],0)**2
        parent = min(large, key=distance)
        if distance(parent) > 16:
            raise ValueError(f'Unassigned visible detail: {b}')
        parent['pixels'].extend(c['pixels'])
        a = parent['box']; parent['box'] = [min(a[0],b[0]),min(a[1],b[1]),max(a[2],b[2]),max(a[3],b[3])]
    # Pixel ownership avoids copying a neighbour whose bounding rectangle overlaps.
    labels = [0] * (w*h)
    q = deque()
    for label, c in enumerate(large, 1):
        for i in c['pixels']:
            labels[i] = label; q.append((i, 0))
    while q:
        i, depth = q.popleft()
        if depth == 2:
            continue
        x, y = i % w, i // w
        for xx, yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            j = yy*w+xx
            if 0 <= xx < w and 0 <= yy < h and alpha[j] and not labels[j]:
                labels[j] = labels[i]; q.append((j, depth+1))
    rgba = image.tobytes(); result = {}
    for label, c in enumerate(large, 1):
        b = c['box']; column = int(((b[0]+b[2])/2) * 8 / w); row = int(((b[1]+b[3])/2) * 6 / h)
        if (row,column) in result:
            raise ValueError(f'Ambiguous source slot: {row}/{column}')
        box = [max(0,b[0]-2),max(0,b[1]-2),min(w,b[2]+2),min(h,b[3]+2)]
        tw, th = box[2]-box[0], box[3]-box[1]; data = bytearray(tw*th*4)
        for yy in range(th):
            for xx in range(tw):
                i = (box[1]+yy)*w+box[0]+xx
                if labels[i] == label:
                    data[(yy*tw+xx)*4:(yy*tw+xx)*4+4] = rgba[i*4:i*4+4]
        result[row,column] = (Image.frombytes('RGBA',(tw,th),bytes(data)), box)
    return result

def root(tile):
    # Full silhouette recovery fixes the old chopped foot-band estimates.
    # Align the lower opaque footprint, with one scale for all states/headings.
    alpha = tile.getchannel('A'); b = alpha.point(lambda a: 255 if a >= 96 else 0).getbbox()
    band = [(x,y) for y in range(max(b[1], b[3]-20),b[3]) for x in range(b[0],b[2]) if alpha.getpixel((x,y)) >= 96]
    visible = alpha.point(lambda a:255 if a>=8 else 0).getbbox()
    return (round(sum(x for x,y in band)/len(band)), visible[3])

def register(role):
    previous, version = VERSIONS[role]
    original = ROOT/'assets/units'/f'{role}-sprite-v1'
    out = ROOT/'assets/units'/f'{role}-sprite-{version}'; out.mkdir(parents=True,exist_ok=True)
    source = original/f'{role}-atlas-source.png'
    manifest = json.loads((original/'sprite-atlas-pack-v1.json').read_text())
    asset = manifest['assets'][0]; source_actors = actors(Image.open(source).convert('RGBA'))
    idle_roots = {column: box[0] + root(tile)[0] for (row,column),(tile,box) in source_actors.items() if row == 0}
    atlas = Image.new('RGBA',(CELL*8,CELL*6)); mask = Image.new('L',atlas.size)
    legacy_mask = Image.open(original/'team-accent-mask.png').convert('L')
    frames = []; measurements = []
    rows = [('idle',0),('walk',0),('walk',1),('attack',0),('attack',1),('defeat',0)]
    for row, (state,key) in enumerate(rows):
        for heading, column in zip(DIRECTIONS,SOURCE_COLUMNS):
            tile, box = source_actors[row,column]
            anchor = (idle_roots[column]-box[0],root(tile)[1]) if state != 'defeat' else root(tile)
            origin = (PIVOT[0]-anchor[0],PIVOT[1]-anchor[1])
            cell = Image.new('RGBA',(CELL,CELL)); cell.paste(tile,origin)
            a = cell.getchannel('A').point(lambda a:255 if a>=8 else 0).getbbox()
            if min(a[0],a[1],CELL-a[2],CELL-a[3]) < 4:
                raise ValueError(f'{state}/{heading}: complete silhouette cannot fit')
            ci = DIRECTIONS.index(heading); rect = {'x':ci*CELL,'y':row*CELL,'width':CELL,'height':CELL}
            frame_id = f'{state}-{heading}-{key}'
            frames.append({'id':frame_id,'canvasPx':{'width':CELL,'height':CELL},
                'groundPivotPx':{'x':PIVOT[0],'y':PIVOT[1]},'groundPivotStatus':'unreviewed-estimate',
                'alphaBoundsPx':{'x':a[0],'y':a[1],'width':a[2]-a[0],'height':a[3]-a[1]},
                'fallbackRectPx':{'pageId':f'{role}-color','rectPx':rect},
                'frameRectsPx':[{'layerId':'actor','pageId':f'{role}-color',
                    'rectPx':{'x':rect['x']+a[0]-4,'y':rect['y']+a[1]-4,'width':a[2]-a[0]+8,'height':a[3]-a[1]+8},
                    'offsetPx':{'x':a[0]-4,'y':a[1]-4}}]})
            atlas.paste(cell,(rect['x'],rect['y']))
            tile_mask = legacy_mask.crop(box)
            # Existing hue mask only, clipped to this actor's owned pixels.
            tile_mask = Image.composite(tile_mask,Image.new('L',tile.size),tile.getchannel('A').point(lambda a:255 if a else 0))
            mask.paste(tile_mask,(rect['x']+origin[0],rect['y']+origin[1]))
            measurements.append({'frameId':frame_id,'sourceRow':row,'sourceColumn':column,'sourceBoxPx':box,'sourceRootPx':list(anchor),'translationPx':list(origin)})
    asset['frames'] = frames; asset['clips'] = []
    attack_ms = 850 if role == 'infantry' else 1000
    for direction in DIRECTIONS:
        for state, timing in [('idle',[1000]),('walk',[400,400]),('attack',[attack_ms//2,attack_ms-attack_ms//2]),('defeat',[120,730])]:
            sequence = ([{'frameId':f'idle-{direction}-0','durationMs':timing[0]},
                         {'frameId':f'defeat-{direction}-0','durationMs':timing[1]}] if state == 'defeat' else
                        [{'frameId':f'{state}-{direction}-{i}','durationMs':ms} for i,ms in enumerate(timing)])
            asset['clips'].append({'stateId':state,'directionId':direction,'loop':state in ['idle','walk'],'sequence':sequence})
    # Match the current approved Human body baseline, excluding the long spear.
    body_px = 166 if role == 'infantry' else 175
    world_per_pixel = 1.2161865234375 / body_px
    asset['heightWorld'] = max(f['alphaBoundsPx']['height'] for f in frames)*world_per_pixel
    asset['artBoundsWorld'] = placed_sprite_bounds(frames, world_per_pixel)
    asset['cullingBoundsWorld'] = copy.deepcopy(asset['artBoundsWorld'])
    manifest['packId'] = f'{role}-registered-legacy'; manifest['packVersion'] = '0.1.0'
    manifest['provenance']['authoringTool'] = 'Retained public ImageGen sheet; deterministic connected-actor registration with Pillow'
    manifest['provenance']['notes'] = '48 original poses reused, zero new poses. Complete actors recovered before fixed-root translation; one shared scale, eight physical source columns. Two-key walk/attack and idle-to-terminal defeat. Original packs retained. See registration.json and README.md.'
    dimensions = {'width':atlas.width,'height':atlas.height}
    for page in manifest['pages']:
        page['dimensionsPx'] = dimensions; page['edgeRule'] = 'zero-rgb-under-transparent'; page['gutterRule'] = 'none'; page['gutterPx'] = 0
    atlas.save(out/f'{role}-atlas-source.png'); atlas.save(out/f'{role}-atlas-runtime.png'); mask.save(out/'team-accent-mask.png')
    for f in manifest['files']:
        f['dimensionsPx'] = dimensions; f['sha256'] = sha(out/f['path'])
    (out/'sprite-atlas-pack-v1.json').write_text(json.dumps(manifest,indent=2)+'\n')
    report = {'role':role,'sourceRevision':'9351320d68b3b9c949166b7d5991973004b7553d',
        'sourcePath':str(source.relative_to(ROOT)),'sourceSha256':sha(source),
        'previousDefault':f'{role}-sprite-{previous}','sourceColumnsInRuntimeOrder':SOURCE_COLUMNS,
        'pivotPx':list(PIVOT),'sharedScale':1,'worldPerPixel':world_per_pixel,'bodyReferencePx':body_px,
        'reusedUniquePoses':48,'newlyAuthoredPoses':0,'interpolatedPoses':0,'mirroredPoses':0,
        'motionKeysPerHeading':{'idle':1,'walk':2,'attack':2,'defeat':2},
        'defeatTransition':'existing directional idle 120 ms then existing terminal 730 ms; no collapse interpolation',
        'missingActionHeadingCells':[], 'measurements':measurements}
    (out/'registration.json').write_text(json.dumps(report,indent=2)+'\n')
    preview = Image.new('RGB',(8*160,6*185),(48,52,56)); draw = ImageDraw.Draw(preview)
    for f in frames:
        r=f['fallbackRectPx']['rectPx']; tile=atlas.crop((r['x'],r['y'],r['x']+CELL,r['y']+CELL)); tile.thumbnail((160,160))
        x=r['x']//CELL*160; y=r['y']//CELL*185
        preview.paste(tile,(x,y+20),tile); draw.text((x+2,y+2),f['id'],fill='white')
    preview.save(out/'review.png')
    print(f'{role}: 48 complete public poses; zero new/mirrored/interpolated poses; {out.relative_to(ROOT)}')

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('role',choices=VERSIONS); args=parser.parse_args()
    register(args.role)
