#!/usr/bin/env python3
"""Register three current-roster NW wood keys; append a page strip, preserve old pixels.

Retain the approved-seed generation iteration; no mirroring or per-frame scaling.
The source has one fixed baseline, one shared scale and explicit layout roots.
The original directional/extracted source files stay untouched.
"""
import copy
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/units/cast-human-sprite-v3'
SOURCE = ROOT / 'docs/art-direction/human-roster-v1/generated/worker-wood-north-west-v2/extracted'
EVIDENCE = ROOT / 'docs/qa-evidence/worker-land-art-2026-10-04'
SCALE = 271 / 801
ROOTS_X = [256, 816, 1344]
BASELINES_Y = [900]
FRAME_IDS = [f'gather-wood-north-west-{i}' for i in range(3)]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    manifest = PACK / 'sprite-atlas-pack-v1.json'
    pack = json.loads(manifest.read_text())
    asset = pack['assets'][0]
    clip = next((c for c in asset['clips']
                 if (c['stateId'], c['directionId']) == ('gather-wood', 'north-west')), None)
    if clip is None:
        clip = {'stateId': 'gather-wood', 'directionId': 'north-west', 'loop': True, 'sequence': []}
        asset['clips'].append(clip)
    previous = [f for f in asset['frames'] if f['id'] in FRAME_IDS]
    if previous:
        assert len(previous) == 3, 'Partial admission: inspect before changing'
        positions = [next(f for f in previous if f['id'] == id)['fallbackRectPx']['rectPx']
                     for id in FRAME_IDS]
    else:
        assert not clip['sequence'], \
            'An independently authored NW wood clip already exists; do not replace it'
        # A right-side strip keeps both dimensions within the existing 4096px
        # longest side. Old records/UV pixel rectangles remain untouched.
        left = pack['pages'][0]['dimensionsPx']['width']
        positions = [{'x': left, 'y': i * 320, 'width': 320, 'height': 320} for i in range(3)]
    metadata = json.loads((SOURCE / 'extraction.json').read_text())
    atlas = Image.open(PACK / 'cast-atlas-runtime.png').convert('RGBA')
    mask = Image.open(PACK / 'team-accent-mask.png').convert('L')
    assert atlas.size == mask.size
    required_width = max(r['x'] + 320 for r in positions)
    if required_width > atlas.width:
        width = ((required_width + 255) // 256) * 256
        grown_atlas = Image.new('RGBA', (width, atlas.height))
        grown_atlas.paste(atlas, (0, 0))
        grown_mask = Image.new('L', (width, mask.height))
        grown_mask.paste(mask, (0, 0))
        atlas, mask = grown_atlas, grown_mask
    assert all(r['x'] + 320 <= atlas.width and r['y'] + 320 <= atlas.height for r in positions)
    reference = next(f for f in asset['frames'] if f['id'] == 'walk-south-east-0')
    records, tiles = [], []
    for i, item in enumerate(metadata['frames']):
        source_path = SOURCE / f'{i:02}.png'
        cell = Image.open(source_path).convert('RGBA')
        cell = cell.resize((round(cell.width * SCALE), round(cell.height * SCALE)),
                           Image.Resampling.LANCZOS)
        tile = Image.new('RGBA', (320, 320))
        box = item['sourceBounds']
        offset = (round(160 + (box[0] - ROOTS_X[i % 3]) * SCALE),
                  round(308 + (box[1] - BASELINES_Y[i // 3]) * SCALE))
        assert offset[0] >= 2 and offset[1] >= 2
        assert offset[0] + cell.width <= 318 and offset[1] + cell.height <= 308
        tile.alpha_composite(cell, offset)
        # Same alpha threshold as existing extraction; avoid hidden RGB fringes.
        pixels = tile.load()
        for y in range(320):
            for x in range(320):
                if pixels[x, y][3] < 9:
                    pixels[x, y] = (0, 0, 0, 0)
        bounds = tile.getchannel('A').getbbox()
        assert bounds and bounds[3] <= 308
        rect = positions[i]
        if not previous:
            assert atlas.crop((rect['x'], rect['y'], rect['x'] + 320,
                               rect['y'] + 320)).getbbox() is None, 'Admission must use empty pixels'
            assert mask.crop((rect['x'], rect['y'], rect['x'] + 320,
                              rect['y'] + 320)).getbbox() is None, 'Admission must use empty mask'
        atlas.paste(tile, (rect['x'], rect['y']))
        frame = copy.deepcopy(reference)
        frame.update(id=FRAME_IDS[i], canvasPx={'width': 320, 'height': 320},
                     groundPivotPx={'x': 160, 'y': 308},
                     alphaBoundsPx={'x': bounds[0], 'y': bounds[1],
                                    'width': bounds[2] - bounds[0], 'height': bounds[3] - bounds[1]})
        frame['fallbackRectPx']['rectPx'] = rect
        frame['frameRectsPx'][0].update(rectPx=rect, offsetPx={'x': 0, 'y': 0})
        if previous:
            index = next(j for j, f in enumerate(asset['frames']) if f['id'] == FRAME_IDS[i])
            asset['frames'][index] = frame
        else:
            asset['frames'].append(frame)
        records.append({'id': FRAME_IDS[i], 'source': str(source_path.relative_to(ROOT)),
                        'sourceSha256': digest(source_path), 'sourceBounds': box,
                        'offsetPx': list(offset), 'alphaBoundsPx': frame['alphaBoundsPx'],
                        'rgbaSha256': hashlib.sha256(tile.tobytes()).hexdigest()})
        tiles.append(tile)
    clip.update(loop=True, sequence=[{'frameId': id, 'durationMs': 240} for id in FRAME_IDS])
    if not previous:
        major, minor, _ = map(int, pack['packVersion'].split('.'))
        pack['packVersion'] = f'{major}.{minor + 1}.0'
        pack['provenance']['notes'] += ' NW wood work adds three compact axe windup/strike/recovery keys, preserving world scale and existing frame coordinates; '
        pack['provenance']['notes'] += 'see docs/qa-worker-land-art-2026-10-04.md for registration and remaining coverage.'
    atlas.save(PACK / 'cast-atlas-runtime.png')
    atlas.save(PACK / 'cast-atlas-source.png')
    mask.save(PACK / 'team-accent-mask.png')
    pack['pages'][0]['dimensionsPx'] = {'width': atlas.width, 'height': atlas.height}
    for file in pack['files']:
        file['dimensionsPx'] = {'width': atlas.width, 'height': atlas.height}
        file['sha256'] = digest(PACK / file['path'])
    manifest.write_text(json.dumps(pack, indent=2) + '\n')
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    record = {'schemaVersion': 1, 'action': 'gather-wood', 'worldDirection': 'north-west',
              'screenDirection': 'left', 'source': metadata['source'],
              'sourceSha256': digest(ROOT / metadata['source']),
              'extractionSha256': digest(SOURCE / 'extraction.json'),
              'sharedScale': SCALE, 'columnRootsX': ROOTS_X, 'rowBaselinesY': BASELINES_Y,
              'groundPivotPx': {'x': 160, 'y': 308}, 'durationMs': 720,
              'registrationStatus': 'source-pixel reviewed; native ground/turn acceptance open',
              'frames': records}
    (EVIDENCE / 'wood-north-west-registration.json').write_text(json.dumps(record, indent=2) + '\n')
    # Pixel review at ordinary/strategic scale; this is not a GPU game capture.
    sheet = Image.new('RGBA', (3 * 180, 270), (53, 66, 72, 255))
    draw = ImageDraw.Draw(sheet)
    playback = []
    for i, tile in enumerate(tiles):
        preview = tile.resize((160, 160), Image.Resampling.LANCZOS)
        sheet.alpha_composite(preview, (i * 180 + 11, 24))
        small = tile.resize((60, 60), Image.Resampling.LANCZOS)
        sheet.alpha_composite(small, (i * 180 + 51, 204))
        draw.text((i * 180 + 8, 4), f'NW wood {i + 1}', fill='white')
        draw.line((i * 180 + 8, 178, i * 180 + 172, 178), fill=(157, 170, 169))
        screen = Image.new('RGBA', (160, 160), (53, 66, 72, 255))
        screen.alpha_composite(preview)
        playback.append(screen)
    sheet.save(EVIDENCE / 'wood-north-west-keys.png')
    playback[0].save(EVIDENCE / 'wood-north-west-loop.webp', save_all=True,
                     append_images=playback[1:], duration=240, loop=0, lossless=True)
    print(f'Admitted three compact NW wood work keys into {pack["packId"]} {pack["packVersion"]}')


if __name__ == '__main__':
    main()
