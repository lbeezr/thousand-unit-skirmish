#!/usr/bin/env python3
"""Append registered fishing keys to a COPY of the shipped Human atlas.

Usage: build-worker-fishing-pilot.py BASE_PACK FRAME_CONFIG OUTPUT_DIRECTORY
FRAME_CONFIG supplies heading, frames (PNG paths/durationMs), canvasPx and
groundPivotPx. Source keys must already share anatomical scale and ground root.
Never fits individual crouches to upright height or replaces existing actions.
"""
import copy
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image, ImageChops


def build(base, config_path, destination):
    base, config_path, destination = map(Path, (base, config_path, destination))
    if destination.exists():
        raise ValueError('Output directory must be new; shipped assets are preserved')
    config = json.loads(config_path.read_text())
    directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
    if config['heading'] not in directions or not config['frames']:
        raise ValueError('Requires one real heading and registered source keys')
    pack = json.loads((base / 'sprite-atlas-pack-v1.json').read_text())
    asset = next(a for a in pack['assets'] if a['id'] == 'human')
    runtime = next(f for f in pack['files'] if f['usage'] == 'runtime')
    original = Image.open(base / runtime['path']).convert('RGBA')
    original_scale = asset['heightWorld'] / max(f['alphaBoundsPx']['height'] for f in asset['frames'])
    canvas = config['canvasPx']; pivot = config['groundPivotPx']
    width, height = canvas['width'], canvas['height']
    columns = original.width // width
    if columns < 1 or not (0 <= pivot['x'] <= width and 0 <= pivot['y'] <= height):
        raise ValueError('Canvas/root exceeds atlas constraints')
    if any(c['stateId'] == 'gather-fish' and c['directionId'] == config['heading'] for c in asset['clips']):
        raise ValueError('Fishing heading already exists; do not overwrite source iterations')
    tiles = []
    for key in config['frames']:
        tile = Image.open(config_path.parent / key['path']).convert('RGBA')
        if tile.size != (width, height) or key['durationMs'] <= 0:
            raise ValueError('Keys need identical canvases and positive durations')
        bounds = tile.getchannel('A').getbbox()
        if not bounds or bounds[0] == 0 or bounds[1] == 0 or bounds[2] == width or bounds[3] == height:
            raise ValueError('Empty or clipped key')
        tiles.append((tile, bounds, key['durationMs']))
    new_height = 1
    required = original.height + ((len(tiles) + columns - 1) // columns) * height
    while new_height < required:
        new_height *= 2
    if new_height > 4096:
        raise ValueError('Pilot exceeds the 4096px texture budget')
    atlas = Image.new('RGBA', (original.width, new_height)); atlas.paste(original, (0, 0))
    sequence = []
    template = asset['frames'][0]
    for index, (tile, bounds, duration) in enumerate(tiles):
        x, y = index % columns * width, original.height + index // columns * height
        atlas.paste(tile, (x, y))
        frame = copy.deepcopy(template); frame['id'] = f"gather-fish-{config['heading']}-{index}"
        frame['canvasPx'] = canvas; frame['groundPivotPx'] = pivot
        frame['alphaBoundsPx'] = dict(zip(['x', 'y', 'width', 'height'], [bounds[0], bounds[1], bounds[2]-bounds[0], bounds[3]-bounds[1]]))
        rect = {'x': x, 'y': y, 'width': width, 'height': height}
        frame['fallbackRectPx']['rectPx'] = rect; frame['frameRectsPx'][0]['rectPx'] = rect
        frame['frameRectsPx'][0]['offsetPx'] = {'x': 0, 'y': 0}
        frame['groundPivotStatus'] = 'unreviewed-estimate'
        asset['frames'].append(frame); sequence.append({'frameId': frame['id'], 'durationMs': duration})
    if any(c.getbbox() for c in ImageChops.difference(original, atlas.crop((0, 0, original.width, original.height))).split()):
        raise ValueError('Existing atlas pixels changed')
    asset['clips'].append({'stateId': 'gather-fish', 'directionId': config['heading'], 'loop': True, 'sequence': sequence})
    asset['heightWorld'] = original_scale * max(f['alphaBoundsPx']['height'] for f in asset['frames'])
    pack['packVersion'] = config['packVersion']
    pack['provenance']['notes'] += ' Private four-key fishing pilot; one actual heading only. Root/loop/creative acceptance pending.'
    destination.mkdir(parents=True)
    for file in pack['files']:
        if file['usage'] == 'team-mask':
            mask = Image.open(base / file['path'])
            new_mask = Image.new(mask.mode, atlas.size); new_mask.paste(mask, (0, 0)); new_mask.save(destination / file['path'])
        else:
            atlas.save(destination / file['path'])
        file['dimensionsPx'] = {'width': atlas.width, 'height': atlas.height}
        file['sha256'] = hashlib.sha256((destination / file['path']).read_bytes()).hexdigest()
    pack['pages'][0]['dimensionsPx'] = {'width': atlas.width, 'height': atlas.height}
    (destination / 'sprite-atlas-pack-v1.json').write_text(json.dumps(pack, indent=2) + '\n')
    print(f"Appended {len(tiles)} {config['heading']} keys; preserved old pixels and {original_scale:.12f} world units/pixel")


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    build(*sys.argv[1:])
