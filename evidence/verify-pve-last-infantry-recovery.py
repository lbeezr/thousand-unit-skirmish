import hashlib
import json
import pathlib
import sys
import zipfile

archive = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(archive) as packet:
    names = packet.namelist()
    assert len(names) == len(set(names)), 'duplicate archive member'
    assert all(not pathlib.PurePosixPath(name).is_absolute()
               and '..' not in pathlib.PurePosixPath(name).parts for name in names)
    manifest = json.loads(packet.read('manifest.json'))
    expected = {row['path']: row for row in manifest['files']}
    assert set(names) == set(expected) | {'manifest.json'}
    for name, row in expected.items():
        data = packet.read(name)
        assert len(data) == row['bytes'], name
        assert hashlib.sha256(data).hexdigest() == row['sha256'], name
    outcome = json.loads(packet.read('outcome.json'))
    assert outcome['fullTinyCompletionEstablished'] is False
    assert outcome['deploymentEstablished'] is False
    assert outcome['postmerge']['exit'] == 0
    print(json.dumps({'verified': True, 'members': len(names),
                      'archiveBytes': archive.stat().st_size,
                      'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                      'reviewedHead': outcome['reviewedHead'],
                      'merge': outcome['merge'],
                      'postmerge': outcome['postmerge']}))
