#!/usr/bin/env python3
"""Register one reviewed own-seed walk stage; the full builder replays stages."""
from pathlib import Path
from PIL import Image
import copy, hashlib, io, json, subprocess, sys

if len(sys.argv) != 2 or sys.argv[1] not in ['north', 'south', 'south-west', 'west', 'north-west']:
    raise ValueError('Expected one reviewed Spearman walk direction')
direction = sys.argv[1]
root = Path(__file__).resolve().parents[1]
source = root / f'docs/art-direction/human-roster-v1/extracted/spearman/walk/{direction}-local-v1'
out = root / 'assets/units/spearman-sprite-v1'
receipt = json.loads((source / 'registration.json').read_text())
manifest_path = out / 'sprite-atlas-pack-v1.json'
pack = json.loads(manifest_path.read_text())
asset = pack['assets'][0]
own_ids = [f'walk-{direction}-{i}' for i in range(4)]
already = [f for f in asset['frames'] if f['id'] in own_ids]
baseline_dimensions = receipt.get('baselineDimensionsPx', {'width': 2048, 'height': 2048})
registered_dimensions = receipt.get('registeredDimensionsPx', baseline_dimensions)
expected_dimensions = registered_dimensions if already else baseline_dimensions
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if receipt['directionId'] != direction or sha(root / receipt['identitySource']['path']) != receipt['identitySource']['sha256']:
    raise ValueError('Approved own-direction identity source changed')
expected_mask = receipt.get('registeredMaskSHA256', receipt['baselineMaskSHA256']) if already else receipt['baselineMaskSHA256']
if sha(out / 'team-accent-mask.png') != expected_mask:
    raise ValueError('Retained team mask changed')
if not already and (sha(out / 'spearman-atlas-runtime.png') != receipt['baselineRuntimeSHA256'] or sha(out / 'spearman-atlas-source.png') != receipt['baselineRuntimeSHA256']):
    raise ValueError('Reviewed prior atlas bytes changed')
images = []
for pose in receipt['poses']:
    path = source / pose['file']
    if sha(path) != pose['sha256']:
        raise ValueError('Reviewed source key changed: ' + pose['file'])
    image = Image.open(path).convert('RGBA')
    if image.size != (320, 352):
        raise ValueError('Reviewed source canvas/scale changed')
    images.append(image)
if len(images) != 4 or len(receipt['atlasSlotsPx']) != 4:
    raise ValueError('Expected four complete source keys and slots')
verify = r'''
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {decodeRgba8} from './scripts/sprite-pixel-bounds.mjs';
import {decodeRegisteredUnitFrames} from './scripts/unit-art-production-contract.mjs';
const p=JSON.parse(fs.readFileSync(process.argv[1])),a=p.assets[0],direction=process.argv[2];
const cells=decodeRegisteredUnitFrames(a,p.pages[0],decodeRgba8(fs.readFileSync('assets/units/spearman-sprite-v1/spearman-atlas-runtime.png')));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const {frames,clips,...metadata}=a;
const ownIds=new Set(Array.from({length:4},(_,i)=>`walk-${direction}-${i}`));
console.log(JSON.stringify({poses:sha(frames.filter(f=>!ownIds.has(f.id)).map(f=>({frame:f,rgba:cells[f.id].rgba,alpha:cells[f.id].alpha}))),
clips:sha(clips.filter(c=>!(c.stateId==='walk'&&c.directionId===direction))),metadata:sha(metadata),page:sha(p.pages[0])}));
'''
actual = json.loads(subprocess.run(['node', '--input-type=module', '-e', verify, str(manifest_path), direction], cwd=root, capture_output=True, text=True, check=True).stdout)
for key, expected in [('poses', 'baselineRegisteredPoseSHA256'), ('clips', 'baselineUnchangedClipsSHA256'), ('metadata', 'baselineAssetMetadataSHA256')]:
    if actual[key] != receipt[expected]:
        raise ValueError('Prior registered identity/geometry/pixels/clips/calibration changed: ' + key)
expected_page = receipt.get('registeredPageMetadataSHA256', receipt['baselinePageMetadataSHA256']) if already else receipt['baselinePageMetadataSHA256']
if actual['page'] != expected_page:
    raise ValueError('Reviewed page metadata changed')
atlas = Image.open(out / 'spearman-atlas-runtime.png').convert('RGBA')
if atlas.size != (expected_dimensions['width'], expected_dimensions['height']):
    raise ValueError('Expected retained atlas dimensions')
if 'baselineDecodedAtlasSHA256' in receipt:
    prefix = atlas.crop((0, 0, baseline_dimensions['width'], baseline_dimensions['height']))
    # Later stages occupy formerly empty slots within the existing page. Remove
    # only this stage's declared slots to recover every byte of its old page.
    if already:
        for x, y in receipt['atlasSlotsPx']:
            left, top = max(0, x), max(0, y)
            right, bottom = min(prefix.width, x + 320), min(prefix.height, y + 352)
            if right > left and bottom > top:
                prefix.paste((0, 0, 0, 0), (left, top, right, bottom))
    if hashlib.sha256(prefix.tobytes()).hexdigest() != receipt['baselineDecodedAtlasSHA256']:
        raise ValueError('Reviewed entire prior atlas prefix changed')

def registered_frame(index, image):
    x, y = receipt['atlasSlotsPx'][index]
    b = image.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
    if not b or min(b[0], b[1], 320 - b[2], 352 - b[3]) < 4:
        raise ValueError('Source pose lacks complete padded clearance')
    frame = copy.deepcopy(asset['frames'][0])
    frame['id'] = own_ids[index]
    frame['canvasPx'] = receipt['canvasPx']
    frame['groundPivotPx'] = receipt['groundPivotPx']
    frame['alphaBoundsPx'] = {'x': b[0], 'y': b[1], 'width': b[2] - b[0], 'height': b[3] - b[1]}
    rect = {'x': x, 'y': y, 'width': 320, 'height': 352}
    frame['fallbackRectPx']['rectPx'] = rect
    frame['frameRectsPx'][0]['rectPx'] = rect
    frame['frameRectsPx'][0]['offsetPx'] = {'x': 0, 'y': 0}
    return frame

if already:
    if len(already) != 4 or pack['packVersion'] != receipt['packVersion']:
        raise ValueError('Unexpected production revision; run the full builder')
    clip = next(c for c in asset['clips'] if c['stateId'] == 'walk' and c['directionId'] == direction)
    expected_keys = [{'frameId': f'walk-{direction}-{i}', 'durationMs': pose['durationMs']} for i, pose in enumerate(receipt['poses'])]
    if clip['sequence'] != expected_keys or clip['loop'] is not True:
        raise ValueError('Registered own-direction timing changed')
    for index, image in enumerate(images):
        frame = next(f for f in already if f['id'] == f'walk-{direction}-{index}')
        if frame != registered_frame(index, image):
            raise ValueError('Registered own-direction frame metadata changed')
        r = frame['frameRectsPx'][0]['rectPx']
        if atlas.crop((r['x'], r['y'], r['x'] + 320, r['y'] + 352)).tobytes() != image.tobytes():
            raise ValueError('Registered pixels differ from reviewed source')
    print(f'Spearman {direction} keys already registered; no files changed')
else:
    prior = receipt['reusedPriorRegisteredPoses']
    if pack['packVersion'] != receipt['baselinePackVersion'] or len(asset['frames']) != prior or max(f['alphaBoundsPx']['height'] for f in asset['frames']) != 319:
        raise ValueError('Expected the reviewed prior pose/calibration baseline')
    old_pixels = atlas.copy()
    mask_bytes = None
    new_size = (registered_dimensions['width'], registered_dimensions['height'])
    if new_size != atlas.size:
        if new_size[0] != atlas.width or new_size[1] <= atlas.height:
            raise ValueError('Only reviewed downward transparent page extension is supported')
        grown = Image.new('RGBA', new_size)
        grown.paste(atlas, (0, 0))
        if grown.crop((0, 0, atlas.width, atlas.height)).tobytes() != atlas.tobytes():
            raise ValueError('Page extension changed retained atlas pixels')
        old_mask = Image.open(out / 'team-accent-mask.png')
        if old_mask.mode != 'L' or old_mask.size != atlas.size:
            raise ValueError('Expected the reviewed grayscale mask dimensions')
        grown_mask = Image.new('L', new_size, 0)
        grown_mask.paste(old_mask, (0, 0))
        if grown_mask.crop((0, 0, atlas.width, atlas.height)).tobytes() != old_mask.tobytes():
            raise ValueError('Page extension changed retained mask pixels')
        encoded = io.BytesIO(); grown_mask.save(encoded, format='PNG'); mask_bytes = encoded.getvalue()
        if hashlib.sha256(mask_bytes).hexdigest() != receipt['registeredMaskSHA256']:
            raise ValueError('Extended mask differs from reviewed zero-padding receipt')
        atlas = grown
        pack['pages'][0]['dimensionsPx'] = registered_dimensions
        for file in pack['files']:
            file['dimensionsPx'] = registered_dimensions
        page_sha = hashlib.sha256(json.dumps(pack['pages'][0], separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
        if page_sha != receipt['registeredPageMetadataSHA256']:
            raise ValueError('Extended page differs from reviewed metadata receipt')
    for index, image in enumerate(images):
        x, y = receipt['atlasSlotsPx'][index]
        if x < 0 or y < 0 or x + 320 > atlas.width or y + 352 > atlas.height or atlas.crop((x, y, x + 320, y + 352)).tobytes() != bytes(320 * 352 * 4):
            raise ValueError('New slot is outside the atlas or overlaps existing pixels')
        atlas.alpha_composite(image, (x, y))
        asset['frames'].append(registered_frame(index, image))
    for frame in asset['frames'][:prior]:
        r = frame['frameRectsPx'][0]['rectPx']; box = (r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height'])
        if atlas.crop(box).tobytes() != old_pixels.crop(box).tobytes():
            raise ValueError('Prior registered pixels changed')
    if asset['heightWorld'] / max(f['alphaBoundsPx']['height'] for f in asset['frames']) != receipt['worldPerPixel']:
        raise ValueError('Pose changed global body calibration')
    clip = next(c for c in asset['clips'] if c['stateId'] == 'walk' and c['directionId'] == direction)
    clip['sequence'] = [{'frameId': f'walk-{direction}-{i}', 'durationMs': pose['durationMs']} for i, pose in enumerate(receipt['poses'])]
    pack['packVersion'] = receipt['packVersion']
    pack['provenance']['authoringTool'] += f'; Blender CPU 2D source-UV {direction} leg articulation'
    pack['provenance']['notes'] += ' ' + receipt['packProvenanceNote']
    for filename in ['spearman-atlas-source.png', 'spearman-atlas-runtime.png']:
        atlas.save(out / filename)
    if mask_bytes is not None:
        (out / 'team-accent-mask.png').write_bytes(mask_bytes)
    for file in pack['files']:
        file['sha256'] = sha(out / file['path'])
    manifest_path.write_text(json.dumps(pack, indent=2) + '\n')
    (out / 'README.md').write_text(receipt['packReadme'])
    print(f'Appended four {direction} keys; preserved {prior} prior poses/mask pixels/calibration; page {atlas.width}x{atlas.height}')
