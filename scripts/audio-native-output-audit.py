"""Read-only source-bound native audio audit. Run from repository root with FFmpeg."""

import argparse
import hashlib
import json
import math
import pathlib
import struct
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('evidence_directory')
    parser.add_argument('--ffmpeg', default='ffmpeg')
    args = parser.parse_args()
    root = pathlib.Path(args.evidence_directory).resolve()
    manifest = json.loads(pathlib.Path('assets/audio/runtime/frontier-feedback/v3/manifest.json').read_text())
    bindings = next(p for p in manifest['pack']['profiles'] if p['id'] == 'interactions')['bindings']
    subsets, recordings, qualified = [], [], []
    for file in sorted(root.rglob('roster-audio.json')):
        report = json.loads(file.read_text())
        qualification = json.loads(file.with_name('qualification.json').read_text())
        subsets.append({
            'subset': report['subset'], 'status': report['status'],
            'qualification': qualification['status'], 'issues': report['issues'],
            'browserPassed': qualification.get('browserObservation', {}).get('passed'),
            'sourceCheck': qualification.get('sourceCheck'),
        })
        for row in report['recordings']:
            cue = row['key']
            assert cue in bindings
            allowed = [manifest['downloads'][v['sourceId']]['sha256'] for v in bindings[cue]['variants']]
            assert row['sourceSha256'] in allowed
            name = row['file']
            assert pathlib.Path(name).name == name
            media = file.parent / name
            sha = hashlib.sha256(media.read_bytes()).hexdigest()
            assert sha == row['sha256']
            pcm = subprocess.check_output([
                args.ffmpeg, '-v', 'error', '-i', str(media), '-f', 's16le',
                '-ac', '1', '-ar', '16000', 'pipe:1',
            ])
            samples = struct.unpack('<' + 'h' * (len(pcm) // 2), pcm)
            assert samples
            peak = max(abs(value) for value in samples) / 32768
            rms = math.sqrt(sum((value / 32768) ** 2 for value in samples) / len(samples))
            native = {
                'key': cue, 'subset': report['subset'], 'file': str(media.relative_to(root)),
                'sha256': sha, 'sourceSha256': row['sourceSha256'],
                'durationSeconds': len(samples) / 16000,
                'peakDbfs': 20 * math.log10(peak) if peak else None,
                'rmsDbfs': 20 * math.log10(rms) if rms else None,
                'nearFullScaleSamples': sum(abs(value) >= 32700 for value in samples),
                'validated': row.get('validated') is True,
                'ordinaryActionObserved': row.get('ordinaryActionObserved') is True,
                'qualification': qualification['status'],
                'stopObservation': row.get('stopObservation', 'unavailable'),
            }
            recordings.append(native)
            if native['validated'] and native['ordinaryActionObserved'] and qualification['status'] == 'captured-needs-listening':
                qualified.append(cue)
    assert len({row['key'] for row in recordings}) == len(recordings)
    print(json.dumps({
        'schemaVersion': 1,
        'scope': 'decoded native playback and source identity; no direct hearing claim',
        'expectedBindings': len(bindings), 'recordings': recordings, 'qualifiedKeys': qualified,
        'missingQualifiedKeys': [key for key in bindings if key not in qualified],
        'subsets': subsets, 'listeningReview': 'pending',
    }, indent=2))


if __name__ == '__main__':
    main()
