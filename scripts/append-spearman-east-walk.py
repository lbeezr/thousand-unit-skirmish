#!/usr/bin/env python3
"""Append reviewed public-seed East keys without changing any prior registered pose."""
from pathlib import Path
from PIL import Image
import copy, hashlib, json, subprocess

root = Path(__file__).resolve().parents[1]
source = root / 'docs/art-direction/human-roster-v1/extracted/spearman/walk/east-local-v1'
out = root / 'assets/units/spearman-sprite-v1'
receipt = json.loads((source / 'registration.json').read_text())
manifest_path = out / 'sprite-atlas-pack-v1.json'
pack = json.loads(manifest_path.read_text())
asset = pack['assets'][0]
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if sha(root / receipt['identitySource']['path']) != receipt['identitySource']['sha256']:
    raise ValueError('Approved painted East identity source changed; explicit reviewed revision required')
images = []
for pose in receipt['poses']:
    path = source / pose['file']
    if sha(path) != pose['sha256']:
        raise ValueError('Reviewed East source key changed: ' + pose['file'])
    image = Image.open(path).convert('RGBA')
    if image.size != (320, 352):
        raise ValueError('East source canvas/scale changed')
    images.append(image)
verify = r'''
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {decodeRgba8} from './scripts/sprite-pixel-bounds.mjs';
import {decodeRegisteredUnitFrames} from './scripts/unit-art-production-contract.mjs';
const p=JSON.parse(fs.readFileSync(process.argv[1])),a=p.assets[0];
const cells=decodeRegisteredUnitFrames(a,p.pages[0],decodeRgba8(fs.readFileSync('assets/units/spearman-sprite-v1/spearman-atlas-runtime.png')));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
console.log(JSON.stringify({poses:sha(a.frames.filter(f=>!f.id.startsWith('walk-east-')).map(f=>({frame:f,rgba:cells[f.id].rgba,alpha:cells[f.id].alpha}))),
clips:sha(a.clips.filter(c=>!(c.stateId==='walk'&&c.directionId==='east')))}));
'''
actual = json.loads(subprocess.run(['node','--input-type=module','-e',verify,str(manifest_path)],cwd=root,capture_output=True,text=True,check=True).stdout)
if actual['poses'] != receipt['baselineRegisteredPoseSHA256'] or actual['clips'] != receipt['baselineUnchangedClipsSHA256']:
    raise ValueError('Prior registered identity/geometry/pixels/clips changed; explicit reviewed revision required')
already = [f for f in asset['frames'] if f['id'].startswith('walk-east-')]
if already:
    if len(already) != 4 or pack['packVersion'] != '0.5.0':
        raise ValueError('Unexpected East production revision')
    atlas = Image.open(out / 'spearman-atlas-runtime.png').convert('RGBA')
    for index, image in enumerate(images):
        frame = next(f for f in already if f['id']==f'walk-east-{index}')
        r = frame['frameRectsPx'][0]['rectPx']
        if atlas.crop((r['x'],r['y'],r['x']+320,r['y']+352)).tobytes() != image.tobytes():
            raise ValueError('Registered East pixels differ from reviewed source')
    print('Spearman East keys already registered; no files changed')
else:
    if len(asset['frames']) != 36 or max(f['alphaBoundsPx']['height'] for f in asset['frames']) != 319:
        raise ValueError('Expected the retained 36-pose baseline calibration')
    atlas = Image.open(out / 'spearman-atlas-runtime.png').convert('RGBA')
    old_pixels = atlas.copy()
    if atlas.size != (2048, 2048):
        raise ValueError('Expected retained compact atlas dimensions')
    template = copy.deepcopy(asset['frames'][0])
    for index, image in enumerate(images):
        x, y = 4 + 328 * index, 1600
        if atlas.crop((x, y, x + 320, y + 352)).getbbox():
            raise ValueError('East slots overlap existing pixels')
        atlas.alpha_composite(image, (x, y))
        # Match the existing production alpha-bounds threshold; retain every
        # original RGBA pixel in the full padded crop, including soft edges.
        b = image.getchannel('A').point(lambda a:255 if a>=8 else 0).getbbox()
        if not b or min(b[0], b[1], 320-b[2], 352-b[3]) < 4:
            raise ValueError('East pose lacks complete padded clearance')
        frame = copy.deepcopy(template)
        frame['id'] = f'walk-east-{index}'
        frame['canvasPx'] = receipt['canvasPx']
        frame['groundPivotPx'] = receipt['groundPivotPx']
        frame['alphaBoundsPx'] = {'x':b[0], 'y':b[1], 'width':b[2]-b[0], 'height':b[3]-b[1]}
        rect = {'x':x, 'y':y, 'width':320, 'height':352}
        frame['fallbackRectPx']['rectPx'] = rect
        frame['frameRectsPx'][0]['rectPx'] = rect
        frame['frameRectsPx'][0]['offsetPx'] = {'x':0, 'y':0}
        asset['frames'].append(frame)
    for frame in asset['frames'][:36]:
        r = frame['frameRectsPx'][0]['rectPx']; box = (r['x'],r['y'],r['x']+r['width'],r['y']+r['height'])
        if atlas.crop(box).tobytes() != old_pixels.crop(box).tobytes():
            raise ValueError('Prior registered pixels changed')
    if asset['heightWorld'] / max(f['alphaBoundsPx']['height'] for f in asset['frames']) != receipt['worldPerPixel']:
        raise ValueError('Equipment or pose changed global body calibration')
    clip = next(c for c in asset['clips'] if c['stateId']=='walk' and c['directionId']=='east')
    clip['sequence'] = [{'frameId':f'walk-east-{i}', 'durationMs':pose['durationMs']} for i,pose in enumerate(receipt['poses'])]
    pack['packVersion'] = '0.5.0'
    pack['provenance']['authoringTool'] += '; Blender CPU 2D source-UV East leg articulation'
    pack['provenance']['notes'] += ' Four new locally authored East walk poses retain the established public painted identity; all 36 prior registered poses are unchanged. Five walk headings, seven attack and seven defeat headings remain missing. Source review is separate from pending ordinary rendered gait/contact acceptance.'
    for filename in ['spearman-atlas-source.png','spearman-atlas-runtime.png']:
        atlas.save(out / filename)
    for file in pack['files']:
        file['sha256'] = sha(out / file['path'])
    manifest_path.write_text(json.dumps(pack,indent=2)+'\n')
    (out / 'README.md').write_text('# Human Spearman partial animation pack\n\nPack 0.5.0 preserves all 36 existing registered poses and adds four locally authored East walk keys from the already-public painted East seed. SE/NE walk, SE attack/defeat and all eight idle facings are retained unchanged. East uses four 200ms contact/passing keys, one 800ms loop, the existing body calibration and padded original pivot. Five walk headings, seven attack and seven defeat headings remain missing (19 cells). The zero team mask is unchanged in pixels. No matching 3D master, provider job, held v2 art or state/simulation change is involved.\n\nSelected sources and provenance: `docs/art-direction/human-roster-v1/extracted/spearman/walk/east-local-v1/registration.json`. Independent East source review and exact integration evidence are retained in the owning East slice guide. Ordinary GPU gait, support-foot speed, normal/strategic/crowded appearance and deployed acceptance remain pending. The private process and all iterations are retained by the Human foot art owner.\n')
    print('Appended 4 East keys; preserved 36 prior poses and world-per-pixel')
