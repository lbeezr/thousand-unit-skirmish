#!/usr/bin/env python3
"""Admit exactly the independently reviewed public-seed NE cutout keys.

Authoring studies stay private. This accepts only the four reviewed decoded
poses, preserves the complete prior atlas/mask prefix and all prior frames,
and replaces only the NE walk clip. No generator, network or provider operation.
"""
from pathlib import Path
from PIL import Image
import argparse, copy, hashlib, json

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = [
    '8d45ed53c63c3f4a73947922618a974c672426c3a5c185785eb6ed3fe0d4539a',
    '70e51ca39a8b8841b82d207e81ba2d7ec6b1e84fe403e0411821d3901819aa78',
    '7f79c72085fd447c78208bf758befc54be63d5a1a11513b115ee9410775f325d',
    'fa4b048925abaf44853db3d80639cd60d1ba7b47a6a2ef62ee9f7946c4de2bed',
]
sha = lambda data: hashlib.sha256(data).hexdigest()
canonical = lambda value: json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()
parser = argparse.ArgumentParser()
parser.add_argument('--reviewed-directory', type=Path, required=True)
args = parser.parse_args()
folder = ROOT / 'assets/units/infantry-sprite-v3'
manifest = folder / 'sprite-atlas-pack-v1.json'
pack = json.loads(manifest.read_text())
asset = pack['assets'][0]
if sha((ROOT/'docs/art-direction/human-roster-v1/source/infantry-idle-facings.png').read_bytes()) != '0a94a11f2dffd4b722d3a732aa4d3117283d3fa41c89aac6f03487d7a7930b38':
    raise ValueError('Approved Infantry identity source changed')
images = [Image.open(args.reviewed_directory / f'trial-{i}.png').convert('RGBA') for i in range(4)]
if any(image.size != (256, 256) or sha(image.tobytes()) != EXPECTED[i] for i, image in enumerate(images)):
    raise ValueError('Source is not the four independently reviewed NE poses; review a new revision explicitly')
if pack['packVersion'] != '0.5.0' or len(asset['frames']) != 32:
    raise ValueError('Expected the retained 32-pose Infantry 0.5.0 baseline')
for filename, expected in [('infantry-atlas-runtime.png','8579fbba5e13f439a208295416c38947bc094dfe0bbe52ac5f9a300aec094978'),
                           ('team-accent-mask.png','454f752f9eabe65b6365ea208069fbd2a897bd77612865865fe08ab6ee5f808e')]:
    if sha((folder/filename).read_bytes()) != expected:
        raise ValueError('Pinned original runtime/mask changed before reviewed admission')
atlas = Image.open(folder / 'infantry-atlas-runtime.png').convert('RGBA')
mask = Image.open(folder / 'team-accent-mask.png')
if atlas.size != (2048, 1024) or mask.size != atlas.size or mask.mode != 'L':
    raise ValueError('Unexpected baseline page/mask')
prior_frames = copy.deepcopy(asset['frames'])
prior_clips = copy.deepcopy(asset['clips'])
prior_height = asset['heightWorld']
pixel_scale = prior_height / max(frame['alphaBoundsPx']['height'] for frame in prior_frames)
grown = Image.new('RGBA', (2048, 1280)); grown.paste(atlas, (0, 0))
grown_mask = Image.new('L', grown.size, 0); grown_mask.paste(mask, (0, 0))
for i, image in enumerate(images):
    x, y = i * 256, 1024
    bounds = image.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
    if not bounds or min(bounds[0], bounds[1], 256-bounds[2], 256-bounds[3]) < 4:
        raise ValueError('Reviewed pose lacks equipment/foot clearance')
    grown.paste(image, (x, y))
    rect = {'x': x, 'y': y, 'width': 256, 'height': 256}
    frame = copy.deepcopy(prior_frames[0])
    frame.update(id=f'walk-north-east-{i}', canvasPx={'width': 256, 'height': 256},
                 groundPivotPx={'x': 128, 'y': 246},
                 alphaBoundsPx={'x': bounds[0], 'y': bounds[1], 'width': bounds[2]-bounds[0], 'height': bounds[3]-bounds[1]})
    frame['fallbackRectPx']['rectPx'] = rect
    frame['frameRectsPx'][0]['rectPx'] = rect
    frame['frameRectsPx'][0]['offsetPx'] = {'x': 0, 'y': 0}
    asset['frames'].append(frame)
# The existing loader derives pixel scale from maximum alpha height. A new
# pose's faint edge increases that maximum234->236; preserving the ratio
# requires a bounds-height change, never fitting/resizing any body pixels.
asset['heightWorld'] = pixel_scale * max(f['alphaBoundsPx']['height'] for f in asset['frames'])
if abs(asset['heightWorld'] / max(f['alphaBoundsPx']['height'] for f in asset['frames']) - pixel_scale) > 1e-12:
    raise ValueError('Source pose changed body/world-pixel calibration')
clip = next(c for c in asset['clips'] if c['stateId'] == 'walk' and c['directionId'] == 'north-east')
clip['sequence'] = [{'frameId': f'walk-north-east-{i}', 'durationMs': 200} for i in range(4)]
assert grown.crop((0, 0, 2048, 1024)).tobytes() == atlas.tobytes()
assert grown_mask.crop((0, 0, 2048, 1024)).tobytes() == mask.tobytes()
assert asset['frames'][:32] == prior_frames
assert [c for c in asset['clips'] if c is not clip] == [c for c in prior_clips if not (c['stateId']=='walk' and c['directionId']=='north-east')]
receipt = {
    'schemaVersion': 1, 'assetId': 'infantry', 'heading': 'north-east', 'packVersion': '0.6.0',
    'sourceKind': 'reviewed-public-seed-local-2d-cutout',
    'sourceRevision': '6ee1cce46d0ac4f4fcc4610a0d2b1a2bee928690',
    'sourceFrameId': 'idle-north-east-0', 'sourceSheet': 'docs/art-direction/human-roster-v1/source/infantry-idle-facings.png',
    'sourceSheetSHA256': sha((ROOT/'docs/art-direction/human-roster-v1/source/infantry-idle-facings.png').read_bytes()),
    'priorAtlasRgbaSHA256': sha(atlas.tobytes()), 'priorFramesSHA256': sha(canonical(prior_frames)),
    'priorOtherClipsSHA256': sha(canonical([c for c in prior_clips if not (c['stateId']=='walk' and c['directionId']=='north-east')])),
    'priorRegisteredFramesSHA256': '99855c4234be473cc93172d3b9109d62414d11debb91c179bd349720447dec70',
    'priorRuntimeFiles': [{'path': str(path.relative_to(ROOT)), 'sha256': sha(path.read_bytes())} for path in [folder/'infantry-atlas-runtime.png',folder/'team-accent-mask.png']],
    'canvasPx': {'width': 256, 'height': 256}, 'groundPivotPx': {'x': 128, 'y': 246}, 'worldPerPixel': pixel_scale,
    'priorBoundsHeightWorld': prior_height, 'boundsHeightWorld': asset['heightWorld'],
    'durationsMs': [200]*4, 'reviewedRgbaSHA256': EXPECTED,
    'sourceReview': 'Independent actual-pixel source/half-size review: alternating anatomical support/passing, coherent cuffs, frozen spear/shield; rough source slice approved. Source-size contact contours within one pixel. No rendered-game acceptance.',
    'authoring': {'tool': 'Pillow CPU source-UV cutout', 'sourceOwnership': {'body':15442,'anatomicalRightLeg':1960,'anatomicalLeftLeg':1905},
                  'restRecompositionExact': True, 'paintedDonorPixels': 0, 'equipmentMirrored': False, 'perFrameFitting': False,
                  'process': 'Private retained masks, explicit anatomical knee/ankle/toe controls and iterations; no provider operation.'},
    'acceptance': {'default': 'wired', 'packaging': 'pending', 'deployment': 'unverified', 'rendered': 'pending',
                   'owner': 'delegated default Infantry lane', 'captureOwner': '01a10378'},
}
for filename in ['infantry-atlas-source.png', 'infantry-atlas-runtime.png']:
    grown.save(folder / filename)
grown_mask.save(folder / 'team-accent-mask.png')
pack['packVersion'] = '0.6.0'
pack['pages'][0]['dimensionsPx'] = {'width': 2048, 'height': 1280}
pack['provenance']['authoringTool'] += '; reviewed CPU public-seed NE cutout articulation'
pack['provenance']['notes'] += ' Four reviewed NE contact/passing keys reuse the exact public Infantry NE identity. All32 original poses and31 other clips remain. SE timing/poses unchanged; six walk headings remain idle. Source review does not establish rendered gait/planting or deployed acceptance.'
for file in pack['files']:
    path = folder / file['path']; file['sha256'] = sha(path.read_bytes())
    file['dimensionsPx'] = {'width': 2048, 'height': 1280}
manifest.write_text(json.dumps(pack, indent=2)+'\n')
(ROOT/'docs/art-direction/human-roster-v1/infantry-ne-walk-registration.json').write_text(json.dumps(receipt, indent=2)+'\n')
print('Admitted4 reviewed NE keys; old32 poses/31 clips and full page/mask prefix preserved; pack0.6.0')
