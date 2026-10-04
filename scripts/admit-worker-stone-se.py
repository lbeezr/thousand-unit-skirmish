#!/usr/bin/env python3
"""Register approved current-roster Stone SE keys without repacking existing frames.

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
SOURCE = ROOT / 'docs/art-direction/human-roster-v1/generated/worker-stone-eight-v1/extracted'
EVIDENCE = ROOT / 'docs/qa-evidence/worker-land-art-2026-10-04'
SCALE = 232 / 183
ROOTS_X = [156, 412, 668, 924]
BASELINES_Y = [779]
FRAME_IDS = [f'gather-stone-south-east-{i}' for i in range(4)]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    manifest = PACK / 'sprite-atlas-pack-v1.json'
    pack = json.loads(manifest.read_text())
    asset = pack['assets'][0]
    clip = next((c for c in asset['clips']
                 if (c['stateId'], c['directionId']) == ('gather-stone', 'south-east')), None)
    if clip is None:
        clip = {'stateId': 'gather-stone', 'directionId': 'south-east', 'loop': True, 'sequence': []}
        asset['clips'].append(clip)
    previous = [f for f in asset['frames'] if f['id'] in FRAME_IDS]
    if previous:
        assert len(previous) == 4, 'Partial admission: inspect before changing'
        positions = [next(f for f in previous if f['id'] == id)['fallbackRectPx']['rectPx']
                     for id in FRAME_IDS]
    else:
        assert not clip['sequence'], \
            'An independently authored Stone SE walk already exists; do not replace it'
        bottom = max(f['fallbackRectPx']['rectPx']['y'] + f['fallbackRectPx']['rectPx']['height']
                     for f in asset['frames'])
        top = ((bottom + 255) // 256) * 256
        positions = [{'x': i * 320, 'y': top, 'width': 320, 'height': 256} for i in range(4)]
    metadata = json.loads((SOURCE / 'extraction.json').read_text())
    atlas = Image.open(PACK / 'cast-atlas-runtime.png').convert('RGBA')
    mask = Image.open(PACK / 'team-accent-mask.png').convert('L')
    assert atlas.size == mask.size
    assert all(r['x'] + 320 <= atlas.width and r['y'] + 256 <= atlas.height for r in positions), \
        'No spare atlas row: decide a new layout explicitly'
    reference = next(f for f in asset['frames'] if f['id'] == 'walk-south-east-0')
    records, tiles = [], []
    for i, item in enumerate(metadata['frames'][12:16]):
        source_path = SOURCE / f'{i + 12:02}.png'
        cell = Image.open(source_path).convert('RGBA')
        cell = cell.resize((round(cell.width * SCALE), round(cell.height * SCALE)),
                           Image.Resampling.LANCZOS)
        tile = Image.new('RGBA', (320, 256))
        box = item['sourceBounds']
        offset = (round(160 + (box[0] - ROOTS_X[i % 4]) * SCALE),
                  round(244 + (box[1] - BASELINES_Y[i // 4]) * SCALE))
        assert offset[0] >= 2 and offset[1] >= 2
        assert offset[0] + cell.width <= 318 and offset[1] + cell.height <= 244
        tile.alpha_composite(cell, offset)
        # Same alpha threshold as existing extraction; avoid hidden RGB fringes.
        pixels = tile.load()
        for y in range(256):
            for x in range(320):
                if pixels[x, y][3] < 9:
                    pixels[x, y] = (0, 0, 0, 0)
        bounds = tile.getchannel('A').getbbox()
        assert bounds and bounds[3] <= 244
        rect = positions[i]
        if not previous:
            assert atlas.crop((rect['x'], rect['y'], rect['x'] + 320,
                               rect['y'] + 256)).getbbox() is None, 'Admission must use empty pixels'
            assert mask.crop((rect['x'], rect['y'], rect['x'] + 320,
                              rect['y'] + 256)).getbbox() is None, 'Admission must use empty mask'
        atlas.paste(tile, (rect['x'], rect['y']))
        frame = copy.deepcopy(reference)
        frame.update(id=FRAME_IDS[i], canvasPx={'width': 320, 'height': 256},
                     groundPivotPx={'x': 160, 'y': 244},
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
    clip.update(loop=True, sequence=[{'frameId': id, 'durationMs': 210} for id in FRAME_IDS])
    if not previous:
        major, minor, _ = map(int, pack['packVersion'].split('.'))
        pack['packVersion'] = f'{major}.{minor + 1}.0'
        pack['provenance']['notes'] += ' Stone SE walk reuses four dedicated pick-windup/strike/recovery keys; default selector adoption owned by animation owner; '
        pack['provenance']['notes'] += 'see docs/qa-worker-land-art-2026-10-04.md for registration and remaining coverage.'
    atlas.save(PACK / 'cast-atlas-runtime.png')
    atlas.save(PACK / 'cast-atlas-source.png')
    for file in pack['files']:
        file['sha256'] = digest(PACK / file['path'])
    manifest.write_text(json.dumps(pack, indent=2) + '\n')
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    record = {'schemaVersion': 1, 'action': 'gather-stone', 'worldDirection': 'south-east',
              'screenDirection': 'right', 'source': metadata['source'],
              'sourceSha256': digest(ROOT / metadata['source']),
              'extractionSha256': digest(SOURCE / 'extraction.json'),
              'sharedScale': SCALE, 'columnRootsX': ROOTS_X, 'rowBaselinesY': BASELINES_Y,
              'groundPivotPx': {'x': 160, 'y': 244}, 'durationMs': 840,
              'registrationStatus': 'source-pixel reviewed; native ground/turn acceptance open',
              'frames': records}
    (EVIDENCE / 'stone-se-registration.json').write_text(json.dumps(record, indent=2) + '\n')
    # Pixel review at ordinary/strategic scale; this is not a GPU game capture.
    sheet = Image.new('RGBA', (4 * 180, 235), (53, 66, 72, 255))
    draw = ImageDraw.Draw(sheet)
    playback = []
    for i, tile in enumerate(tiles):
        preview = tile.resize((160, 128), Image.Resampling.LANCZOS)
        sheet.alpha_composite(preview, (i * 180 + 11, 24))
        small = tile.resize((60, 48), Image.Resampling.LANCZOS)
        sheet.alpha_composite(small, (i * 180 + 51, 169))
        draw.text((i * 180 + 8, 4), f'Stone SE {i + 1}', fill='white')
        draw.line((i * 180 + 8, 146, i * 180 + 172, 146), fill=(157, 170, 169))
        screen = Image.new('RGBA', (160, 128), (53, 66, 72, 255))
        screen.alpha_composite(preview)
        playback.append(screen)
    sheet.save(EVIDENCE / 'stone-se-keys.png')
    playback[0].save(EVIDENCE / 'stone-se-loop.webp', save_all=True,
                     append_images=playback[1:], duration=210, loop=0, lossless=True)
    print(f'Admitted four dedicated Stone SE work keys into {pack["packId"]} {pack["packVersion"]}')


if __name__ == '__main__':
    main()
