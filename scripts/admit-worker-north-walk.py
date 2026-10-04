#!/usr/bin/env python3
"""Register approved current-roster North keys without repacking existing frames.

Retain the approved-seed generation iteration; no mirroring or per-frame scaling.
The source's two rows have separate layout baselines, one shared scale and
column roots. The original directional/extracted source files stay untouched.
"""
import copy
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/units/cast-human-sprite-v3'
SOURCE = ROOT / 'docs/art-direction/human-roster-v1/generated/worker-walk-north-v1/extracted'
EVIDENCE = ROOT / 'docs/qa-evidence/worker-land-art-2026-10-04'
SCALE = 232 / 438
ROOTS_X = [192, 576, 960, 1344]
BASELINES_Y = [478, 960]
FRAME_IDS = [f'walk-north-{i}' for i in range(8)]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    manifest = PACK / 'sprite-atlas-pack-v1.json'
    pack = json.loads(manifest.read_text())
    asset = pack['assets'][0]
    clip = next(c for c in asset['clips']
                if (c['stateId'], c['directionId']) == ('walk', 'north'))
    previous = [f for f in asset['frames'] if f['id'] in FRAME_IDS]
    if previous:
        assert len(previous) == 8, 'Partial admission: inspect before changing'
        positions = [next(f for f in previous if f['id'] == id)['fallbackRectPx']['rectPx']
                     for id in FRAME_IDS]
    else:
        assert all(k['frameId'].startswith('idle-north-') for k in clip['sequence']), \
            'An independently authored North walk already exists; do not replace it'
        bottom = max(f['fallbackRectPx']['rectPx']['y'] + f['fallbackRectPx']['rectPx']['height']
                     for f in asset['frames'])
        top = ((bottom + 255) // 256) * 256
        positions = [{'x': i * 256, 'y': top, 'width': 256, 'height': 256} for i in range(8)]
    metadata = json.loads((SOURCE / 'extraction.json').read_text())
    atlas = Image.open(PACK / 'cast-atlas-runtime.png').convert('RGBA')
    mask = Image.open(PACK / 'team-accent-mask.png').convert('L')
    assert atlas.size == mask.size
    assert all(r['x'] + 256 <= atlas.width and r['y'] + 256 <= atlas.height for r in positions), \
        'No spare atlas row: decide a new layout explicitly'
    reference = next(f for f in asset['frames'] if f['id'] == 'walk-south-east-0')
    records, tiles = [], []
    for i, item in enumerate(metadata['frames']):
        source_path = SOURCE / f'{i:02}.png'
        cell = Image.open(source_path).convert('RGBA')
        cell = cell.resize((round(cell.width * SCALE), round(cell.height * SCALE)),
                           Image.Resampling.LANCZOS)
        tile = Image.new('RGBA', (256, 256))
        box = item['sourceBounds']
        offset = (round(128 + (box[0] - ROOTS_X[i % 4]) * SCALE),
                  round(244 + (box[1] - BASELINES_Y[i // 4]) * SCALE))
        assert offset[0] >= 2 and offset[1] >= 2
        assert offset[0] + cell.width <= 254 and offset[1] + cell.height <= 244
        tile.alpha_composite(cell, offset)
        # Same alpha threshold as existing extraction; avoid hidden RGB fringes.
        pixels = tile.load()
        for y in range(256):
            for x in range(256):
                if pixels[x, y][3] < 9:
                    pixels[x, y] = (0, 0, 0, 0)
        bounds = tile.getchannel('A').getbbox()
        assert bounds and bounds[3] <= 244
        rect = positions[i]
        if not previous:
            assert atlas.crop((rect['x'], rect['y'], rect['x'] + 256,
                               rect['y'] + 256)).getbbox() is None, 'Admission must use empty pixels'
            assert mask.crop((rect['x'], rect['y'], rect['x'] + 256,
                              rect['y'] + 256)).getbbox() is None, 'Admission must use empty mask'
        atlas.paste(tile, (rect['x'], rect['y']))
        frame = copy.deepcopy(reference)
        frame.update(id=FRAME_IDS[i], canvasPx={'width': 256, 'height': 256},
                     groundPivotPx={'x': 128, 'y': 244},
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
    clip.update(loop=True, sequence=[{'frameId': id, 'durationMs': 100} for id in FRAME_IDS])
    if not previous:
        major, minor, _ = map(int, pack['packVersion'].split('.'))
        pack['packVersion'] = f'{major}.{minor + 1}.0'
        pack['provenance']['notes'] += ' North walk reuses eight approved-seed current-roster keys; '
        pack['provenance']['notes'] += 'see docs/qa-worker-land-art-2026-10-04.md for registration and remaining coverage.'
    atlas.save(PACK / 'cast-atlas-runtime.png')
    atlas.save(PACK / 'cast-atlas-source.png')
    for file in pack['files']:
        file['sha256'] = digest(PACK / file['path'])
    manifest.write_text(json.dumps(pack, indent=2) + '\n')
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    record = {'schemaVersion': 1, 'action': 'walk', 'worldDirection': 'north',
              'screenDirection': 'down-left', 'source': metadata['source'],
              'sourceSha256': digest(ROOT / metadata['source']),
              'extractionSha256': digest(SOURCE / 'extraction.json'),
              'sharedScale': SCALE, 'columnRootsX': ROOTS_X, 'rowBaselinesY': BASELINES_Y,
              'groundPivotPx': {'x': 128, 'y': 244}, 'durationMs': 800,
              'registrationStatus': 'source-pixel reviewed; native ground/turn acceptance open',
              'frames': records}
    (EVIDENCE / 'north-walk-registration.json').write_text(json.dumps(record, indent=2) + '\n')
    # Pixel review at ordinary/strategic scale; this is not a GPU game capture.
    sheet = Image.new('RGBA', (8 * 150, 235), (53, 66, 72, 255))
    draw = ImageDraw.Draw(sheet)
    playback = []
    for i, tile in enumerate(tiles):
        preview = tile.resize((128, 128), Image.Resampling.LANCZOS)
        sheet.alpha_composite(preview, (i * 150 + 11, 24))
        small = tile.resize((48, 48), Image.Resampling.LANCZOS)
        sheet.alpha_composite(small, (i * 150 + 51, 169))
        draw.text((i * 150 + 8, 4), f'North walk {i + 1}', fill='white')
        draw.line((i * 150 + 8, 146, i * 150 + 142, 146), fill=(157, 170, 169))
        screen = Image.new('RGBA', (128, 128), (53, 66, 72, 255))
        screen.alpha_composite(preview)
        playback.append(screen)
    sheet.save(EVIDENCE / 'north-walk-keys.png')
    playback[0].save(EVIDENCE / 'north-walk-loop.webp', save_all=True,
                     append_images=playback[1:], duration=100, loop=0, lossless=True)
    print(f'Admitted eight approved-seed North walk keys into {pack["packId"]} {pack["packVersion"]}')


if __name__ == '__main__':
    main()
