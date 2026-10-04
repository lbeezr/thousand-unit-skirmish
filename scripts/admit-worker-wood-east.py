#!/usr/bin/env python3
"""Admit actual East axe work/attack; retain source iterations and previous art."""
import copy
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/units/cast-human-sprite-v3'
SOURCE = ROOT / 'docs/art-direction/human-roster-v1/generated/worker-east-actions-v1/extracted'
EVIDENCE = ROOT / 'docs/qa-evidence/worker-land-art-2026-10-04'
SCALE = 232 / 307
ROOTS_X = [384, 784, 1184]
BASELINE = 349
POSITIONS = [(2304, 1920), (2304, 2240), (2048, 3456)]
FRAME_IDS = [f'gather-wood-east-{i}' for i in range(3)]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def overlaps(a, b):
    return (a['x'] < b['x'] + b['width'] and b['x'] < a['x'] + a['width']
            and a['y'] < b['y'] + b['height'] and b['y'] < a['y'] + a['height'])


def main():
    path = PACK / 'sprite-atlas-pack-v1.json'
    pack = json.loads(path.read_text())
    asset = pack['assets'][0]
    atlas = Image.open(PACK / 'cast-atlas-runtime.png').convert('RGBA')
    mask = Image.open(PACK / 'team-accent-mask.png').convert('L')
    assert atlas.size == mask.size == (2560, 4096)
    metadata = json.loads((SOURCE / 'extraction.json').read_text())
    assert len(metadata['frames']) == 9, 'Preserve the complete source iteration'
    previous = [f for f in asset['frames'] if f['id'] in FRAME_IDS]
    assert len(previous) in [0, 3], 'Inspect partial admission before changing'
    wood = next((c for c in asset['clips'] if (c['stateId'], c['directionId']) == ('gather-wood', 'east')), None)
    attack = next(c for c in asset['clips'] if (c['stateId'], c['directionId']) == ('attack', 'east'))
    if not previous:
        assert wood is None, 'Do not replace independently authored East work'
        assert attack['sequence'] == [{'frameId': 'idle-east-0', 'durationMs': 1000}], 'Do not replace independently authored attack'
    reference = next(f for f in asset['frames'] if f['id'] == 'walk-east-0')
    tiles, records = [], []
    for i in range(3):
        item = metadata['frames'][i]
        box = item['sourceBounds']
        source = SOURCE / f'{i:02}.png'
        cell = Image.open(source).convert('RGBA')
        cell = cell.resize((round(cell.width * SCALE), round(cell.height * SCALE)), Image.Resampling.LANCZOS)
        offset = (round(128 + (box[0] - ROOTS_X[i]) * SCALE), round(308 + (box[1] - BASELINE) * SCALE))
        assert min(offset) >= 2 and offset[0] + cell.width <= 254 and offset[1] + cell.height <= 308
        tile = Image.new('RGBA', (256, 320))
        tile.alpha_composite(cell, offset)
        pixels = tile.load()
        for y in range(320):
            for x in range(256):
                if pixels[x, y][3] < 9:
                    pixels[x, y] = (0, 0, 0, 0)
        bounds = tile.getchannel('A').getbbox()
        assert bounds and bounds[3] <= 308 and bounds[3] - bounds[1] <= 272
        x, y = POSITIONS[i]
        rect = {'x': x, 'y': y, 'width': 256, 'height': 320}
        if previous:
            assert next(f for f in previous if f['id'] == FRAME_IDS[i])['fallbackRectPx']['rectPx'] == rect
        else:
            assert all(not overlaps(rect, f['fallbackRectPx']['rectPx']) for f in asset['frames'])
            assert atlas.crop((x, y, x + 256, y + 320)).getbbox() is None
            assert mask.crop((x, y, x + 256, y + 320)).getbbox() is None
        atlas.paste(tile, (x, y))
        frame = copy.deepcopy(reference)
        frame.update(id=FRAME_IDS[i], canvasPx={'width': 256, 'height': 320}, groundPivotPx={'x': 128, 'y': 308},
                     alphaBoundsPx={'x': bounds[0], 'y': bounds[1], 'width': bounds[2] - bounds[0], 'height': bounds[3] - bounds[1]})
        frame['fallbackRectPx']['rectPx'] = rect
        frame['frameRectsPx'][0].update(rectPx=rect, offsetPx={'x': 0, 'y': 0})
        if previous:
            asset['frames'][next(j for j, f in enumerate(asset['frames']) if f['id'] == FRAME_IDS[i])] = frame
        else:
            asset['frames'].append(frame)
        records.append({'id': FRAME_IDS[i], 'source': str(source.relative_to(ROOT)), 'sourceSha256': digest(source),
                        'sourceBounds': box, 'sourceGroundRootPx': [ROOTS_X[i], BASELINE], 'offsetPx': list(offset),
                        'alphaBoundsPx': frame['alphaBoundsPx'], 'rgbaSha256': hashlib.sha256(tile.tobytes()).hexdigest()})
        tiles.append(tile)
    if wood is None:
        wood = {'stateId': 'gather-wood', 'directionId': 'east'}
        asset['clips'].append(wood)
    wood.update(loop=True, sequence=[{'frameId': id, 'durationMs': 240} for id in FRAME_IDS])
    attack.update(loop=False, sequence=[{'frameId': id, 'durationMs': 280} for id in FRAME_IDS])
    if not previous:
        major, minor, _ = map(int, pack['packVersion'].split('.'))
        pack['packVersion'] = f'{major}.{minor + 1}.0'
        pack['provenance']['notes'] += ' East adds three actual down-right front-three-quarter axe keys, with independent wood loop and attack one-shot timing; previous art/world scale preserved. See docs/qa-worker-land-art-2026-10-04.md.'
    atlas.save(PACK / 'cast-atlas-runtime.png')
    atlas.save(PACK / 'cast-atlas-source.png')
    for file in pack['files']:
        file['sha256'] = digest(PACK / file['path'])
    path.write_text(json.dumps(pack, indent=2) + '\n')
    record = {'schemaVersion': 1, 'action': 'gather-wood', 'worldDirection': 'east',
              'screenDirection': 'down-right/front three-quarter', 'source': metadata['source'],
              'sourceSha256': digest(ROOT / metadata['source']), 'sharedScale': SCALE, 'columnRootsX': ROOTS_X,
              'rowBaselineY': BASELINE, 'canvasPx': {'width': 256, 'height': 320}, 'groundPivotPx': {'x': 128, 'y': 308},
              'durationMs': 720, 'attackDurationMs': 840, 'registrationStatus': 'source-pixel reviewed; native root/body/target acceptance open',
              'retainedUnadmittedSourceKeys': list(range(3, 9)), 'frames': records}
    (EVIDENCE / 'wood-east-registration.json').write_text(json.dumps(record, indent=2) + '\n')
    sheet = Image.new('RGBA', (444, 270), (53, 66, 72, 255))
    draw, playback = ImageDraw.Draw(sheet), []
    for i, tile in enumerate(tiles):
        preview = tile.resize((128, 160), Image.Resampling.LANCZOS)
        sheet.alpha_composite(preview, (i * 148 + 10, 24))
        sheet.alpha_composite(tile.resize((48, 60), Image.Resampling.LANCZOS), (i * 148 + 45, 202))
        draw.text((i * 148 + 5, 4), f'E wood/attack {i + 1}', fill='white')
        draw.line((i * 148 + 8, 178, i * 148 + 140, 178), fill=(157, 170, 169))
        screen = Image.new('RGBA', (128, 160), (53, 66, 72, 255))
        screen.alpha_composite(preview)
        playback.append(screen)
    sheet.save(EVIDENCE / 'wood-east-keys.png')
    playback[0].save(EVIDENCE / 'wood-east-loop.webp', save_all=True, append_images=playback[1:], duration=240, loop=0, lossless=True)
    print(f'Admitted three actual East axe keys in {pack["packVersion"]}; wood720ms loop/attack840ms one-shot; no allocation change')


if __name__ == '__main__':
    main()
