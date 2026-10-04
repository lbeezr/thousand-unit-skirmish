"""Decode committed atlas cells; hashes are source pixel evidence, never renders."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
result = {}
for directory in ['cast-human-sprite-v3', 'spearman-sprite-v1']:
    base = root / 'assets' / 'units' / directory
    pack = json.loads((base / 'sprite-atlas-pack-v1.json').read_text())
    page = pack['pages'][0]
    file = next(f for f in pack['files'] if f['id'] == page['runtimeFileId'])
    atlas_path = base / file['path']
    raw = atlas_path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == file['sha256'], directory
    atlas = Image.open(atlas_path).convert('RGBA')
    assert atlas.size == (page['dimensionsPx']['width'], page['dimensionsPx']['height'])
    asset = pack['assets'][0]
    wanted = {s['frameId'] for c in asset['clips'] if c['stateId'] in ['walk', 'idle'] for s in c['sequence']}
    cells = {}
    for frame in asset['frames']:
        if frame['id'] not in wanted:
            continue
        crop = next(c for c in frame['frameRectsPx'] if c['pageId'] == page['id'] and c['layerId'] == 'actor')
        r, offset, pivot = crop['rectPx'], crop.get('offsetPx', {'x': 0, 'y': 0}), frame['groundPivotPx']
        cell = atlas.crop((r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height']))
        # Anchor the ground pivot and clear invisible RGB. Different atlas
        # coordinates, transparent padding or hidden RGB cannot fake motion.
        aligned = Image.new('RGBA', (1024, 1024))
        x, y = 512 + offset['x'] - pivot['x'], 768 + offset['y'] - pivot['y']
        assert 0 <= x and 0 <= y and x + cell.width <= 1024 and y + cell.height <= 1024
        data = bytearray(cell.tobytes())
        for i in range(0, len(data), 4):
            if data[i + 3] == 0:
                data[i:i + 3] = b'\0\0\0'
        cell = Image.frombytes('RGBA', cell.size, bytes(data))
        aligned.paste(cell, (x, y))
        cells[frame['id']] = {'rgbaSha256': hashlib.sha256(aligned.tobytes()).hexdigest(),
                              'alphaSha256': hashlib.sha256(aligned.getchannel('A').tobytes()).hexdigest()}
    result[asset['id']] = {'packVersion': pack['packVersion'], 'atlasSha256': file['sha256'], 'cells': cells}
json.dump(result, sys.stdout)
