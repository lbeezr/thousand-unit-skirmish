#!/usr/bin/env python3
"""Use the public actual NW axe swing for one-shot attack; no new pixels."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/units/cast-human-sprite-v3/sprite-atlas-pack-v1.json'


def main():
    pack = json.loads(PACK.read_text())
    asset = pack['assets'][0]
    wood = next(c for c in asset['clips']
                if (c['stateId'], c['directionId']) == ('gather-wood', 'north-west'))
    ids = [f'gather-wood-north-west-{i}' for i in range(3)]
    assert [key['frameId'] for key in wood['sequence']] == ids, 'Approved NW axe source is required'
    assert all(any(f['id'] == id for f in asset['frames']) for id in ids)
    clip = next(c for c in asset['clips']
                if (c['stateId'], c['directionId']) == ('attack', 'north-west'))
    sequence = [{'frameId': id, 'durationMs': 280} for id in ids]
    if clip['sequence'] != sequence or clip['loop']:
        assert clip['sequence'] == [{'frameId': 'idle-north-west-0', 'durationMs': 1000}], \
            'An independently authored NW attack exists; inspect before replacing'
        clip.update(loop=False, sequence=sequence)
        major, minor, _ = map(int, pack['packVersion'].split('.'))
        pack['packVersion'] = f'{major}.{minor + 1}.0'
        pack['provenance']['notes'] += \
            ' NW attack faithfully reuses the public NW axe windup/strike/recovery pixels, 3x280ms one-shot; '
        pack['provenance']['notes'] += 'see docs/qa-worker-land-art-2026-10-04.md; six other attack headings remain absent.'
    PACK.write_text(json.dumps(pack, indent=2) + '\n')
    print(f'Registered public NW axe reuse as 840ms one-shot attack in {pack["packVersion"]}')


if __name__ == '__main__':
    main()
