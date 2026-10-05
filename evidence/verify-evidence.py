#!/usr/bin/env python3
"""Verify and optionally extract the sealed exact-source CPU evidence archive."""
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
    assert len(names) == len(set(names)), 'duplicate archive members'
    assert all(not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts for name in names)
    manifest = json.loads(archive.read('MANIFEST.json'))
    entries = manifest['entries']
    assert set(names) == {'MANIFEST.json', *(entry['path'] for entry in entries)}, 'unlisted members'
    for entry in entries:
        data = archive.read(entry['path'])
        assert len(data) == entry['bytes'], entry['path']
        assert digest(data) == entry['sha256'], entry['path']
    read_json = lambda name: json.loads(archive.read(name))
    qualification = read_json('qualification.json')
    freeze = read_json('freeze.json')
    report = read_json('report.json')
    terminal = read_json('terminal.json')
    tiny_terminal = read_json('tiny-diagnostic-terminal.json')
    source = freeze['source']['revision']
    assert source == manifest['source'] == qualification['source']['revision']
    assert report['source'] == {'revision': source, 'dirty': False}
    assert terminal['source']['revision'] == source and terminal['source']['dirty'] is False
    assert report['passedCount'] == 930 and report['unrunCount'] == 383 and report['selectedCount'] == 1314
    assert report['status'] == 'failed' and report['fullCpuSuitePassed'] is False
    assert report['checks'][-1]['reason'] == 'Check exited unknown (SIGTERM).'
    assert terminal['exitCode'] == 1
    assert qualification['fullAttempt']['classification'] == 'operator interrupted during unbounded native cleanup'
    assert all(floor['status'] == 'unrun' for floor in qualification['coverageFloors'])
    assert len(qualification['coverageFloors']) == 4
    assert all(contract['fullAttemptStatus'] == 'unrun' for contract in qualification['dedicatedContracts'])
    assert tiny_terminal['source'] == {'revision': source, 'dirty': False} and tiny_terminal['exitCode'] == 1
    index = read_json('tiny-evidence-index.json')
    log = archive.read('tiny-diagnostic.log').decode()
    prefix = 'PVE_TINY_FAILURE '
    emitted = [json.loads(line[line.index(prefix) + len(prefix):]) for line in log.splitlines() if prefix in line]
    assert len(emitted) == index['retainedActualFailurePackets'] == 2
    for expected in ['ℹ tests 4', 'ℹ pass 2', 'ℹ fail 2', 'ℹ skipped 0']:
        assert expected in log.splitlines()
    native_modes = set()
    for packet in index['packets']:
        folder = 'tiny-failure-evidence/' + packet['name'] + '/'
        envelope = read_json(folder + 'envelope.json')
        assert envelope in emitted, 'packet absent from actual retained console'
        assert envelope['encoding'] == 'gzip-base64'
        compressed = base64.b64decode(envelope['data'], validate=True)
        raw = gzip.decompress(compressed)
        assert raw == archive.read(folder + 'record.json')
        assert compressed == archive.read(folder + 'record.json.gz')
        assert len(raw) == envelope['bytes'] == 748978 and digest(raw) == envelope['sha256']
        record = json.loads(raw)
        assert record['schemaVersion'] == 1 and record['source'] == {'revision': source, 'dirty': False}
        assert record['seeds'] == [20260925, 0]
        assert record['policyIdentity'] == {'matchModeId': 'skirmish', 'matchModeVersion': 1}
        assert record['final']['state']['tickNumber'] == 108000 and record['final']['state']['matchWinner'] == -1
        assert len(record['trace']) == 876
        assert [view['tick'] for view in record['lastDecisionViews']] == [107970, 107970]
        assert record['initial']['state']['seatSessions'] == record['final']['state']['seatSessions'] == []
        native_modes.add(record['nativeIdentity']['matchModeId'])
        for key in ['initial', 'final', 'trace', 'metrics', 'lastDecisionViews']:
            assert record[key] == read_json(folder + key + '.json'), key
    assert native_modes == {'authored', 'skirmish'}
    successes = [json.loads(line) for line in log.splitlines() if line.startswith('{"seeds":')]
    assert len(successes) == 2
    assert {case['nativeIdentity'] for case in successes} == {'authored@1', 'skirmish@1'}
    assert all(case['seeds'] == [0, 20260925] and case['seconds'] == 2711 and case['winner'] == 1 and case['reason'] == 'elimination' for case in successes)
    if args.extract:
        archive.extractall(args.extract)
print(json.dumps({'verified': True, 'source': source, 'archiveMembers': len(names),
    'fullAttempt': '930 passed / 1 operator-interrupted / 383 unrun; incomplete',
    'tinyDiagnostic': '2 passed / 2 failed; separate from full report',
    'verifiedTerminalPackets': 2}))
