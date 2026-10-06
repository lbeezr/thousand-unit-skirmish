#!/usr/bin/env python3
"""Register a reviewed own-seed defeat stage; preserve preceding production keys."""
from pathlib import Path
from PIL import Image
import copy, hashlib, io, json, subprocess, sys
from foot_sprite_world_bounds import placed_sprite_bounds

if len(sys.argv) > 2 or (len(sys.argv) == 2 and sys.argv[1] not in ['north']):
    raise ValueError('Expected a reviewed north defeat stage')
direction = sys.argv[1] if len(sys.argv) == 2 else 'north'
root = Path(__file__).resolve().parents[1]
source = root / f'docs/art-direction/human-roster-v1/extracted/spearman/defeat/{direction}-local-v1'
out = root / 'assets/units/spearman-sprite-v1'
receipt = json.loads((source / 'registration.json').read_text())
manifest_path = out / 'sprite-atlas-pack-v1.json'
pack = json.loads(manifest_path.read_text())
asset = pack['assets'][0]
own_ids = [f'defeat-{direction}-{i}' for i in range(2)]
width, height = receipt['canvasPx']['width'], receipt['canvasPx']['height']
expected_sequence = [
    {'frameId': f'idle-{direction}-0', 'durationMs': 120},
    {'frameId': f'defeat-{direction}-0', 'durationMs': 300},
    {'frameId': f'defeat-{direction}-1', 'durationMs': 660},
]
idle = next(f for f in asset['frames'] if f['id'] == f'idle-{direction}-0')
if (width, height) != (416, 416) or receipt['stateId'] != 'defeat' or receipt['sequence'] != expected_sequence:
    raise ValueError('Reviewed defeat canvas or one-shot cadence changed')
if receipt['groundPivotPx'] != {'x': 208, 'y': idle['groundPivotPx']['y'] + 80}:
    raise ValueError('Reviewed defeat root changed')
slots = {'north': [[2564, 1084], [2564, 1516]]}
if receipt['atlasSlotsPx'] != slots[direction]:
    raise ValueError('Reviewed disjoint action slots changed')
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
    if image.size != (width, height):
        raise ValueError('Reviewed source canvas/scale changed')
    images.append(image)
if len(images) != 2 or len(receipt['atlasSlotsPx']) != 2:
    raise ValueError('Expected two complete source keys and slots')
verify = r'''
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {decodeRgba8} from './scripts/sprite-pixel-bounds.mjs';
import {decodeRegisteredUnitFrames} from './scripts/unit-art-production-contract.mjs';
const p=JSON.parse(fs.readFileSync(process.argv[1])),a=p.assets[0],direction=process.argv[2];
const cells=decodeRegisteredUnitFrames(a,p.pages[0],decodeRgba8(fs.readFileSync('assets/units/spearman-sprite-v1/spearman-atlas-runtime.png')));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const {frames,clips,...metadata}=a;
const ownIds=new Set(Array.from({length:2},(_,i)=>`defeat-${direction}-${i}`));
console.log(JSON.stringify({poses:sha(frames.filter(f=>!ownIds.has(f.id)).map(f=>({frame:f,rgba:cells[f.id].rgba,alpha:cells[f.id].alpha}))),
clips:sha(clips.filter(c=>!(c.stateId==='defeat'&&c.directionId===direction))),metadata:sha(metadata),page:sha(p.pages[0])}));
'''
actual = json.loads(subprocess.run(['node', '--input-type=module', '-e', verify, str(manifest_path), direction], cwd=root, capture_output=True, text=True, check=True).stdout)
metadata_key = 'registeredAssetMetadataSHA256' if already else 'baselineAssetMetadataSHA256'
for key, expected in [('poses', 'baselineRegisteredPoseSHA256'), ('clips', 'baselineUnchangedClipsSHA256'), ('metadata', metadata_key)]:
    if actual[key] != receipt[expected]:
        raise ValueError('Prior registered identity/geometry/pixels/clips/calibration changed: ' + key)
expected_page = receipt.get('registeredPageMetadataSHA256', receipt['baselinePageMetadataSHA256']) if already else receipt['baselinePageMetadataSHA256']
if actual['page'] != expected_page:
    raise ValueError('Reviewed page metadata changed')
atlas = Image.open(out / 'spearman-atlas-runtime.png').convert('RGBA')
if atlas.size != (expected_dimensions['width'], expected_dimensions['height']):
    raise ValueError('Expected retained atlas dimensions')
if already and (sha(out / 'spearman-atlas-source.png') != sha(out / 'spearman-atlas-runtime.png') or hashlib.sha256(atlas.tobytes()).hexdigest() != receipt['registeredDecodedAtlasSHA256']):
    raise ValueError('Reviewed complete registered page changed')
if 'baselineDecodedAtlasSHA256' in receipt:
    prefix = atlas.crop((0, 0, baseline_dimensions['width'], baseline_dimensions['height']))
    # Later stages occupy formerly empty slots within the existing page. Remove
    # only this stage's declared slots to recover every byte of its old page.
    if already:
        for x, y in receipt['atlasSlotsPx']:
            left, top = max(0, x), max(0, y)
            right, bottom = min(prefix.width, x + width), min(prefix.height, y + height)
            if right > left and bottom > top:
                prefix.paste((0, 0, 0, 0), (left, top, right, bottom))
    if hashlib.sha256(prefix.tobytes()).hexdigest() != receipt['baselineDecodedAtlasSHA256']:
        raise ValueError('Reviewed entire prior atlas prefix changed')

def registered_frame(index, image):
    x, y = receipt['atlasSlotsPx'][index]
    b = image.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
    if not b or min(b[0], b[1], width - b[2], height - b[3]) < 4:
        raise ValueError('Source pose lacks complete padded clearance')
    frame = copy.deepcopy(asset['frames'][0])
    frame['id'] = own_ids[index]
    frame['canvasPx'] = receipt['canvasPx']
    frame['groundPivotPx'] = receipt['groundPivotPx']
    frame['alphaBoundsPx'] = {'x': b[0], 'y': b[1], 'width': b[2] - b[0], 'height': b[3] - b[1]}
    rect = {'x': x, 'y': y, 'width': width, 'height': height}
    frame['fallbackRectPx']['rectPx'] = rect
    frame['frameRectsPx'][0]['rectPx'] = rect
    frame['frameRectsPx'][0]['offsetPx'] = {'x': 0, 'y': 0}
    return frame

if already:
    if len(already) != 2 or pack['packVersion'] != receipt['packVersion']:
        raise ValueError('Unexpected production revision; run the full builder')
    clip = next(c for c in asset['clips'] if c['stateId'] == 'defeat' and c['directionId'] == direction)
    expected_keys = receipt['sequence']
    if clip['sequence'] != expected_keys or clip['loop'] is not False:
        raise ValueError('Registered own-direction timing changed')
    for index, image in enumerate(images):
        frame = next(f for f in already if f['id'] == f'defeat-{direction}-{index}')
        if frame != registered_frame(index, image):
            raise ValueError('Registered own-direction frame metadata changed')
        r = frame['frameRectsPx'][0]['rectPx']
        if atlas.crop((r['x'], r['y'], r['x'] + width, r['y'] + height)).tobytes() != image.tobytes():
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
        if new_size[0] < atlas.width or new_size[1] < atlas.height or max(new_size) > 4096:
            raise ValueError('Only reviewed transparent page extension within 4096 pixels is supported')
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
    # No-growth stages must validate their final declarations before any write,
    # just as an extended page does. A valid baseline alone is insufficient.
    final_mask_sha = hashlib.sha256(mask_bytes).hexdigest() if mask_bytes is not None else sha(out / 'team-accent-mask.png')
    if final_mask_sha != receipt.get('registeredMaskSHA256', receipt['baselineMaskSHA256']):
        raise ValueError('Final team mask differs from reviewed registration receipt')
    final_page_sha = hashlib.sha256(json.dumps(pack['pages'][0], separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    if final_page_sha != receipt.get('registeredPageMetadataSHA256', receipt['baselinePageMetadataSHA256']):
        raise ValueError('Final page differs from reviewed registration receipt')
    for index, image in enumerate(images):
        x, y = receipt['atlasSlotsPx'][index]
        if x < 0 or y < 0 or x + width > atlas.width or y + height > atlas.height or atlas.crop((x, y, x + width, y + height)).tobytes() != bytes(width * height * 4):
            raise ValueError('New slot is outside the atlas or overlaps existing pixels')
        atlas.alpha_composite(image, (x, y))
        asset['frames'].append(registered_frame(index, image))
    if hashlib.sha256(atlas.tobytes()).hexdigest() != receipt['registeredDecodedAtlasSHA256']:
        raise ValueError('Complete appended page differs from reviewed source')
    for frame in asset['frames'][:prior]:
        r = frame['frameRectsPx'][0]['rectPx']; box = (r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height'])
        if atlas.crop(box).tobytes() != old_pixels.crop(box).tobytes():
            raise ValueError('Prior registered pixels changed')
    if asset['heightWorld'] / max(f['alphaBoundsPx']['height'] for f in asset['frames']) != receipt['worldPerPixel']:
        raise ValueError('Pose changed global body calibration')
    placed = placed_sprite_bounds(asset['frames'], receipt['worldPerPixel'])
    for key in ['artBoundsWorld', 'cullingBoundsWorld']:
        old = asset[key]
        asset[key] = {
            'min': [min(old['min'][i], placed['min'][i]) for i in range(3)],
            'max': [max(old['max'][i], placed['max'][i]) for i in range(3)],
        }
    metadata = {k: v for k, v in asset.items() if k not in ['frames', 'clips']}
    if hashlib.sha256(json.dumps(metadata, separators=(',', ':')).encode()).hexdigest() != receipt['registeredAssetMetadataSHA256']:
        raise ValueError('Reviewed rooted weapon bounds or retained metadata changed')
    clip = next(c for c in asset['clips'] if c['stateId'] == 'defeat' and c['directionId'] == direction)
    clip['sequence'] = copy.deepcopy(receipt['sequence'])
    clip['loop'] = False
    pack['packVersion'] = receipt['packVersion']
    pack['provenance']['authoringTool'] += f'; Blender CPU 2D source-UV {direction} rigid body and no-stretch arm/straight spear defeat articulation'
    pack['provenance']['notes'] += ' ' + receipt['packProvenanceNote']
    for filename in ['spearman-atlas-source.png', 'spearman-atlas-runtime.png']:
        atlas.save(out / filename)
    if mask_bytes is not None:
        (out / 'team-accent-mask.png').write_bytes(mask_bytes)
    for file in pack['files']:
        file['sha256'] = sha(out / file['path'])
    manifest_path.write_text(json.dumps(pack, indent=2) + '\n')
    (out / 'README.md').write_text(receipt['packReadme'])
    print(f'Appended two {direction} keys; preserved {prior} prior poses/mask pixels/calibration; page {atlas.width}x{atlas.height}')
