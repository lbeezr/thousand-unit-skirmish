"""Read-only source/output measurement. Run from repository root with NumPy and FFmpeg."""

import argparse
import hashlib
import json
import pathlib
import subprocess

import numpy as np

SAMPLE_RATE = 8000


def decode(path, ffmpeg):
    pcm = subprocess.check_output([
        ffmpeg, '-v', 'error', '-i', str(path), '-f', 'f32le',
        '-ac', '1', '-ar', str(SAMPLE_RATE), 'pipe:1',
    ])
    return np.frombuffer(pcm, dtype='<f4').astype(float)


def compare(source, output):
    source = source - source.mean()
    n, m = len(source), len(output)
    source_energy = np.dot(source, source)
    assert m >= n and source_energy > 0
    size = 1 << (n + m - 2).bit_length()
    dots = np.fft.irfft(
        np.fft.rfft(output, size) * np.fft.rfft(source[::-1], size), size
    )[n - 1:m]
    sums = np.r_[0., np.cumsum(output)]
    squares = np.r_[0., np.cumsum(output * output)]
    energy = squares[n:] - squares[:-n] - (sums[n:] - sums[:-n]) ** 2 / n
    norms = np.sqrt(np.maximum(energy, 0) * source_energy)
    correlations = np.divide(dots, norms, out=np.zeros_like(dots), where=norms > 0)
    offset = int(np.argmax(correlations))
    return {
        'correlation': float(correlations[offset]),
        'offsetSeconds': offset / SAMPLE_RATE,
        'fittedGain': float(dots[offset] / source_energy),
    }


def measurement_check():
    # Known delay/gain with independent noise, rather than a self-comparison.
    random = np.random.default_rng(7)
    source = random.normal(size=1000)
    output = random.normal(scale=.01, size=2500)
    output[120:1120] += .3 * source
    result = compare(source, output)
    assert result['offsetSeconds'] == .015
    assert result['correlation'] > .99 and abs(result['fittedGain'] - .3) < .003


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('evidence_directory')
    parser.add_argument('--ffmpeg', default='ffmpeg')
    args = parser.parse_args()
    root = pathlib.Path(args.evidence_directory)
    audit = json.loads((root / 'native-audit.json').read_text())
    manifest = json.loads(pathlib.Path('assets/audio/runtime/frontier-feedback/v3/manifest.json').read_text())
    sources = {row['sha256']: row['path'].lstrip('/') for row in manifest['downloads'].values()}
    measurement_check()
    rows = []
    for row in audit['recordings']:
        source = pathlib.Path(sources[row['sourceSha256']])
        capture = root / row['file']
        assert hashlib.sha256(source.read_bytes()).hexdigest() == row['sourceSha256']
        assert hashlib.sha256(capture.read_bytes()).hexdigest() == row['sha256']
        identity = {key: row[key] for key in ['key', 'file', 'sha256', 'sourceSha256', 'qualification']}
        rows.append(identity | compare(decode(source, args.ffmpeg), decode(capture, args.ffmpeg)))
    print(json.dumps({
        'schemaVersion': 1,
        'method': '8 kHz mono decoded PCM, full-source zero-mean normalized cross-correlation against native final-mix output; fitted gain at best finite lag',
        'scope': 'signal presence and source similarity, not direct listening, intelligibility or perceived mix',
        'measurementCheck': 'known delay/gain/noise passed',
        'numpyVersion': np.__version__,
        'ffmpegVersion': subprocess.check_output([args.ffmpeg, '-version'], text=True).splitlines()[0],
        'recordings': rows,
    }, indent=2))


if __name__ == '__main__':
    main()
