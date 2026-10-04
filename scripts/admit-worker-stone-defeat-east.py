#!/usr/bin/env python3
"""Admit current-roster East pick/defeat; preserve old art and one page."""
import copy
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/units/cast-human-sprite-v3'
SOURCE = ROOT / 'docs/art-direction/human-roster-v1/generated/worker-east-stone-defeat-v1/extracted'
EVIDENCE = ROOT / 'docs/qa-evidence/worker-land-art-2026-10-04'
SCALE = 232 / 427
ROOTS_X = [256, 768, 1280]
GROUPS = [
    dict(state='gather-stone', alias=None, indexes=[0, 1, 2], canvas=(320, 320), pivot=(160, 308),
         baselines=[519, 519, 519], positions=[(2560, 0), (2560, 320), (2560, 640)], loop=True, duration=240),
    dict(state='defeat', alias=None, indexes=[3, 4, 5], canvas=(512, 256), pivot=(256, 244),
         baselines=[916, 927, 961], positions=[(2560, 960), (2560, 1216), (2560, 1472)], loop=False, duration=280),
]


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
    assert atlas.size == mask.size and atlas.height == 4096
    if atlas.width == 2560:
        grown = Image.new('RGBA', (3072, 4096)); grown.paste(atlas, (0, 0)); atlas = grown
        grown_mask = Image.new('L', (3072, 4096)); grown_mask.paste(mask, (0, 0)); mask = grown_mask
    assert atlas.size == mask.size == (3072, 4096), 'Use the dedicated East final strip'
    metadata = json.loads((SOURCE / 'extraction.json').read_text())
    assert len(metadata['frames']) == 6
    reference = next(f for f in asset['frames'] if f['id'] == 'walk-south-east-0')
    added, all_records = False, []
    for group in GROUPS:
        state = group['state']
        ids = [f'{state}-east-{i}' for i in range(3)]
        existing = [f for f in asset['frames'] if f['id'] in ids]
        assert len(existing) in [0, 3], 'Partial group admission: inspect first'
        if not existing:
            for action in [state, group['alias']]:
                clip = next((c for c in asset['clips'] if (c['stateId'], c['directionId'])
                             == (action, 'east')), None)
                assert not clip or clip['sequence'] == [{'frameId': 'idle-east-0', 'durationMs': 1000}], \
                    f'Independently authored {action} East clip exists; do not replace'
        w, h = group['canvas']
        px, py = group['pivot']
        tiles, records = [], []
        for i, source_index in enumerate(group['indexes']):
            item = metadata['frames'][source_index]
            box = item['sourceBounds']
            source = SOURCE / f'{source_index:02}.png'
            cell = Image.open(source).convert('RGBA')
            cell = cell.resize((round(cell.width * SCALE), round(cell.height * SCALE)), Image.Resampling.LANCZOS)
            offset = (round(px + (box[0] - ROOTS_X[i]) * SCALE),
                      round(py + (box[1] - group['baselines'][i]) * SCALE))
            assert min(offset) >= 2 and offset[0] + cell.width <= w - 2 and offset[1] + cell.height <= py
            tile = Image.new('RGBA', (w, h))
            tile.alpha_composite(cell, offset)
            pixels = tile.load()
            for y in range(h):
                for x in range(w):
                    if pixels[x, y][3] < 9:
                        pixels[x, y] = (0, 0, 0, 0)
            bounds = tile.getchannel('A').getbbox()
            assert bounds and bounds[3] <= py and bounds[3] - bounds[1] <= 272
            x, y = group['positions'][i]
            rect = {'x': x, 'y': y, 'width': w, 'height': h}
            assert x + w <= atlas.width and y + h <= atlas.height
            if existing:
                assert next(f for f in existing if f['id'] == ids[i])['fallbackRectPx']['rectPx'] == rect
            else:
                assert all(not overlaps(rect, f['fallbackRectPx']['rectPx']) for f in asset['frames']), \
                    'Respect every reserved previous rectangle, including transparent pixels'
                assert atlas.crop((x, y, x + w, y + h)).getbbox() is None
                assert mask.crop((x, y, x + w, y + h)).getbbox() is None
            atlas.paste(tile, (x, y))
            frame = copy.deepcopy(reference)
            frame.update(id=ids[i], canvasPx={'width': w, 'height': h}, groundPivotPx={'x': px, 'y': py},
                         alphaBoundsPx={'x': bounds[0], 'y': bounds[1],
                                        'width': bounds[2] - bounds[0], 'height': bounds[3] - bounds[1]})
            frame['fallbackRectPx']['rectPx'] = rect
            frame['frameRectsPx'][0].update(rectPx=rect, offsetPx={'x': 0, 'y': 0})
            if existing:
                asset['frames'][next(j for j, f in enumerate(asset['frames']) if f['id'] == ids[i])] = frame
            else:
                asset['frames'].append(frame)
                added = True
            records.append({'id': ids[i], 'sourceIndex': source_index, 'source': str(source.relative_to(ROOT)),
                            'sourceSha256': digest(source), 'sourceBounds': box,
                            'sourceGroundRootPx': [ROOTS_X[i], group['baselines'][i]],
                            'offsetPx': list(offset), 'alphaBoundsPx': frame['alphaBoundsPx'],
                            'rgbaSha256': hashlib.sha256(tile.tobytes()).hexdigest()})
            tiles.append(tile)
        for action in filter(None, [state, group['alias']]):
            clip = next((c for c in asset['clips'] if (c['stateId'], c['directionId'])
                         == (action, 'east')), None)
            if clip is None:
                clip = {'stateId': action, 'directionId': 'east'}
                asset['clips'].append(clip)
            clip.update(loop=group['loop'], sequence=[{'frameId': id, 'durationMs': group['duration']} for id in ids])
        all_records.append({'state': state, 'alias': group['alias'], 'loop': group['loop'],
                            'durationMs': group['duration'] * 3, 'canvasPx': {'width': w, 'height': h},
                            'groundPivotPx': {'x': px, 'y': py}, 'frames': records})
        # Aspect-correct ordinary/strategic previews; not native game captures.
        preview_w, preview_h = round(w / 2), round(h / 2)
        stride = preview_w + 20
        sheet = Image.new('RGBA', (stride * 3, preview_h + 110), (53, 66, 72, 255))
        draw, playback = ImageDraw.Draw(sheet), []
        for i, tile in enumerate(tiles):
            preview = tile.resize((preview_w, preview_h), Image.Resampling.LANCZOS)
            sheet.alpha_composite(preview, (i * stride + 10, 22))
            sheet.alpha_composite(tile.resize((round(w * .1875), round(h * .1875)), Image.Resampling.LANCZOS),
                                  (i * stride + 45, preview_h + 42))
            draw.text((i * stride + 5, 4), f'{state} East {i + 1}', fill='white')
            draw.line((i * stride + 8, 22 + py / 2, i * stride + stride - 8, 22 + py / 2), fill=(157, 170, 169))
            screen = Image.new('RGBA', (preview_w, preview_h), (53, 66, 72, 255))
            screen.alpha_composite(preview)
            playback.append(screen)
        sheet.save(EVIDENCE / f'{state}-east-keys.png')
        playback[0].save(EVIDENCE / f'{state}-east-loop.webp', save_all=True,
                         append_images=playback[1:], duration=group['duration'],
                         loop=0 if group['loop'] else 1, lossless=True)
    if added:
        major, minor, _ = map(int, pack['packVersion'].split('.'))
        pack['packVersion'] = f'{major}.{minor + 1}.0'
        pack['provenance']['notes'] += ' East dedicated pick mining and terminal prone defeat add six real front-three-quarter keys; '
        pack['provenance']['notes'] += 'Existing exact Stone default binding consumes the new East clip; target-bearing/native acceptance remain open; see docs/qa-worker-land-art-2026-10-04.md.'
    atlas.save(PACK / 'cast-atlas-runtime.png')
    atlas.save(PACK / 'cast-atlas-source.png')
    mask.save(PACK / 'team-accent-mask.png')
    pack['pages'][0]['dimensionsPx'] = {'width': atlas.width, 'height': atlas.height}
    for file in pack['files']:
        file['dimensionsPx'] = {'width': atlas.width, 'height': atlas.height}
        file['sha256'] = digest(PACK / file['path'])
    path.write_text(json.dumps(pack, indent=2) + '\n')
    record = {'schemaVersion': 1, 'worldDirection': 'east', 'screenDirection': 'down-right front-three-quarter',
              'sharedScale': SCALE, 'columnRootsX': ROOTS_X, 'source': metadata['source'],
              'sourceSha256': digest(ROOT / metadata['source']),
              'contactNote': 'Live work uses row ground baselines; fallen poses use reviewed source contact lines, not bounding-box recentering. Runtime pivots remain fixed per clip; native contact/relative body scale open.',
              'groups': all_records}
    (EVIDENCE / 'stone-defeat-east-registration.json').write_text(json.dumps(record, indent=2) + '\n')
    print(f'Admitted six actual East pick/defeat keys in {pack["packVersion"]}; aligned right-side strip; earlier pixels preserved')


if __name__ == '__main__':
    main()
