#!/usr/bin/env python3
"""Verify a sealed exact-source full CPU evidence archive using the standard library."""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import PurePosixPath
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive')
parser.add_argument('--extract')
args = parser.parse_args()
digest = lambda data: hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(args.archive) as archive:
    names = archive.namelist()
    assert len(names) == len(set(names)), 'duplicate members'
    assert all(not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts for name in names)
    manifest = json.loads(archive.read('MANIFEST.json'))
    assert set(names) == {'MANIFEST.json', *(entry['path'] for entry in manifest['entries'])}
    for entry in manifest['entries']:
        data = archive.read(entry['path'])
        assert len(data) == entry['bytes'] and digest(data) == entry['sha256'], entry['path']
    read_json = lambda name: json.loads(archive.read(name))
    freeze, report, terminal = [read_json(name + '.json') for name in ['freeze', 'report', 'terminal']]
    qualification = read_json('qualification.json')
    source = freeze['source']['revision']
    assert manifest['source'] == source == qualification['source']['revision']
    assert report['source'] == {'revision': source, 'dirty': False}
    assert terminal['source']['revision'] == source and terminal['source']['dirty'] is False
    assert report['lane'] == 'full' and report['shard'] == {'index': 1, 'count': 1}
    registry = read_json('registry.json')
    assert report['selectedCount'] == len(registry) == 1323
    assert [check['label'] for check in report['checks']] == [check['label'] for check in registry[:len(report['checks'])]]
    failures = sum(check['status'] == 'failed' for check in report['checks'])
    assert report['passedCount'] + failures + report['unrunCount'] == len(registry)
    assert report['fullCpuSuitePassed'] == (report['status'] == 'passed' and report['passedCount'] == len(registry))
    assert terminal['exitCode'] == (0 if report['fullCpuSuitePassed'] else 1)
    log = archive.read('suite.log').decode()
    ci_lines = [line for line in log.splitlines() if line.startswith('CI_RESULT ')]
    assert len(ci_lines) == 1 and json.loads(ci_lines[0][10:]) == report
    assert qualification['result']['passedCount'] == report['passedCount']
    assert qualification['result']['unrunCount'] == report['unrunCount']
    assert qualification['result']['fullCpuSuitePassed'] == report['fullCpuSuitePassed']
    assert qualification['independentReview']['status'] == 'passed'
    assert len(freeze['scope']['coverageFloors']) == len(qualification['coverageFloors']) == 4
    outcomes = {check['label']: check['status'] for check in report['checks']}
    for floor in qualification['coverageFloors']:
        assert floor['status'] == outcomes.get(floor['label'], 'unrun')
        assert all(flag in floor['args'] for flag in ['--test-coverage-lines=100', '--test-coverage-branches=100', '--test-coverage-functions=100'])
    index = read_json('tiny-evidence-index.json')
    prefix = 'PVE_TINY_FAILURE '
    packet_lines = [json.loads(line[line.index(prefix) + len(prefix):]) for line in log.splitlines() if prefix in line]
    assert len(packet_lines) == index['retainedActualFailurePackets']
    for packet in index['packets']:
        folder = 'tiny-failure-evidence/' + packet['name'] + '/'
        envelope = read_json(folder + 'envelope.json')
        assert envelope in packet_lines and envelope['encoding'] == 'gzip-base64'
        compressed = base64.b64decode(envelope['data'], validate=True)
        raw = gzip.decompress(compressed)
        assert raw == archive.read(folder + 'record.json')
        assert compressed == archive.read(folder + 'record.json.gz')
        assert len(raw) == envelope['bytes'] and digest(raw) == envelope['sha256']
        record = json.loads(raw)
        assert record['schemaVersion'] == 1 and record['source'] == {'revision': source, 'dirty': False}
        assert record['final']['state']['matchWinner'] == -1
        for key in ['initial', 'final', 'trace', 'metrics', 'lastDecisionViews']:
            assert record[key] == read_json(folder + key + '.json')
    if args.extract:
        archive.extractall(args.extract)
print(json.dumps({'verified': True, 'source': source, 'members': len(names),
    'passed': report['passedCount'], 'failed': failures, 'unrun': report['unrunCount'],
    'fullCpuSuitePassed': report['fullCpuSuitePassed'], 'verifiedFailurePackets': len(packet_lines)}))
