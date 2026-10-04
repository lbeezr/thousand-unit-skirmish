import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import vm from 'node:vm';
import {captureCheckpoint, CaptureCheckpointError} from './capture-checkpoint.mjs';

// Tiny test image and injected CDP replies; this suite performs no browser rendering.
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA2kAAAAASUVORK5CYII=';
const revision = '8cdf5285ddb79bc6b9ca9c5e92d40b07b6d43091';
const context = {revision, browserVersion: {product: 'Chrome/test', protocolVersion: '1.3'},
  mapId: 'underbough-rootways', checkpoint: 'ordinary-zoom'};
const view = {width: 1, height: 1, deviceScaleFactor: 1, hostname: '127.0.0.1',
  boot: 'ready', appliedMapId: context.mapId, requestedMapId: context.mapId, connection: 'ROOM LIVE'};
const page = (observation = view, data = png) => ({cdp: {
  evaluate: async () => observation,
  call: async (method, params) => {
    assert.equal(method, 'Page.captureScreenshot');
    assert.deepEqual(params, {format: 'png', captureBeyondViewport: false});
    return {data};
  },
}});
const withOutput = async callback => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'rts-checkpoint-test-'));
  try { await callback(output); } finally { await rm(output, {recursive: true, force: true}); }
};
const hasCode = code => error => error.code === code;

test('capture bundle records observed context, PNG digest, and explicit evidence limits', () => withOutput(async output => {
  const {directory, manifest} = await captureCheckpoint({...context, page: page(), outputDirectory: output});
  const bytes = await readFile(path.join(directory, 'color.png'));
  assert.deepEqual(bytes, Buffer.from(png, 'base64'));
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')), manifest);
  assert.deepEqual(manifest, {schemaVersion: 1, source: {revision, suppliedBy: 'caller'},
    browser: {product: 'Chrome/test', protocolVersion: '1.3'},
    scene: {mapId: context.mapId, mapStateSource: 'client-applied-snapshot',
      checkpoint: context.checkpoint, checkpointSuppliedBy: 'caller'},
    viewport: {width: 1, height: 1, deviceScaleFactor: 1}, image: {file: 'color.png',
      width: 1, height: 1, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')},
    evidence: {kind: 'cdp-screenshot', visualReview: 'not-performed', humanPlaytest: 'not-performed'}});
  assert.deepEqual((await readdir(directory)).sort(), ['color.png', 'manifest.json']);
}));

test('identical replies and context yield identical manifests across output roots', () => withOutput(async output => {
  for (const name of ['first', 'second']) await mkdir(path.join(output, name));
  const results = await Promise.all(['first', 'second'].map(name => captureCheckpoint({...context,
    page: page(), outputDirectory: path.join(output, name)})));
  const manifests = await Promise.all(results.map(r => readFile(path.join(r.directory, 'manifest.json'), 'utf8')));
  assert.equal(manifests[0], manifests[1]);
  assert.doesNotMatch(manifests[0], new RegExp(output));
}));

test('CSS viewport and device scale are retained separately from PNG dimensions', () => withOutput(async output => {
  const {manifest} = await captureCheckpoint({...context, outputDirectory: output,
    page: page({...view, width: 2, height: 2, deviceScaleFactor: 0.5})});
  assert.deepEqual(manifest.viewport, {width: 2, height: 2, deviceScaleFactor: 0.5});
  assert.equal(manifest.image.width, 1); assert.equal(manifest.image.height, 1);
}));

test('missing runtime and invalid metadata fail before creating an artifact directory', () => withOutput(async output => {
  await assert.rejects(captureCheckpoint({...context, outputDirectory: output}), hasCode('capture-runtime-unavailable'));
  for (const change of [{revision: 'unknown'}, {revision: {}}, {browserVersion: {}}, {mapId: ''},
    {checkpoint: 123}, {checkpoint: '../other-owner'}, {checkpoint: 'x'.repeat(65)}, {outputDirectory: 'relative'}]) {
    await assert.rejects(captureCheckpoint({...context, page: page(), outputDirectory: output, ...change}),
      hasCode('capture-invalid-context'));
  }
  assert.deepEqual(await readdir(output), []);
}));

test('unready, wrong-map, remote and invalid viewport observations cannot publish a bundle', () => withOutput(async output => {
  for (const change of [{boot: 'loading'}, {appliedMapId: 'another-map'}, {hostname: 'example.com'},
    {appliedMapId: undefined}, {requestedMapId: 'pending-map'}, {connection: 'RECONNECTING'},
    {connection: 'OFFLINE'}, {connection: 'CONNECTED · SYNCING'},
    {width: 0}, {width: 8193}, {height: 0.5}, {deviceScaleFactor: Infinity}, {deviceScaleFactor: 5}]) {
    const probe = page({...view, ...change});
    probe.cdp.call = () => assert.fail('unready page requested screenshot');
    await assert.rejects(captureCheckpoint({...context, page: probe, outputDirectory: output}),
      hasCode('capture-not-ready'));
    assert.deepEqual(await readdir(output), []);
  }
}));

function appliedStatePage({applied = context.mapId, requested = context.mapId, connection = 'ROOM LIVE'} = {}) {
  const state = {applied, requested, connection};
  const probe = page();
  probe.cdp.evaluate = async expression => vm.runInNewContext(expression, {
    innerWidth: 1, innerHeight: 1, devicePixelRatio: 1, location: {hostname: '127.0.0.1'},
    window: {__rtsEnvironmentStateSnapshot: state.applied ? {mapId: state.applied} : undefined},
    document: {documentElement: {dataset: {boot: 'ready'}}, querySelector: selector =>
      selector === '#map-select' ? {value: state.requested} : {textContent: state.connection}},
  });
  return {state, probe};
}

test('actual observation expression rejects a requested but unapplied map and uncertain connection', () => withOutput(async output => {
  for (const setup of [{applied: 'old-map'}, {applied: null}, {connection: 'RECONNECTING'}]) {
    const {probe} = appliedStatePage(setup);
    probe.cdp.call = () => assert.fail('pending or uncertain map requested screenshot');
    await assert.rejects(captureCheckpoint({...context, page: probe, outputDirectory: output}), hasCode('capture-not-ready'));
    assert.deepEqual(await readdir(output), []);
  }
}));

test('applied-map or connection changes during the screenshot cannot publish a mislabeled bundle', () => withOutput(async output => {
  for (const change of [{applied: 'new-map', requested: 'new-map'}, {applied: null},
    {requested: 'pending-map'}, {connection: 'RECONNECTING'}]) {
    const {state, probe} = appliedStatePage();
    let shots = 0;
    probe.cdp.call = async () => { shots++; Object.assign(state, change); return {data: png}; };
    await assert.rejects(captureCheckpoint({...context, page: probe, outputDirectory: output}), hasCode('capture-not-ready'));
    assert.equal(shots, 1); assert.deepEqual(await readdir(output), []);
  }
}));

test('post-capture observation failure and viewport changes leave no bundle', () => withOutput(async output => {
  for (const mode of ['failed', 'resized']) {
    const probe = page(); let observations = 0;
    probe.cdp.evaluate = async () => {
      if (++observations === 1) return view;
      if (mode === 'failed') throw new Error('private state detail');
      return {...view, width: 2};
    };
    await assert.rejects(captureCheckpoint({...context, page: probe, outputDirectory: output}),
      hasCode(mode === 'failed' ? 'capture-runtime-unavailable' : 'capture-not-ready'));
    assert.deepEqual(await readdir(output), []);
  }
}));

test('bad PNG, truncated framing, noncanonical base64 and viewport mismatch leave no partial bundles', () => withOutput(async output => {
  const badImages = ['not base64!', Buffer.from('not a PNG').toString('base64'),
    Buffer.from(png, 'base64').subarray(0, 33).toString('base64'), png + '\n'];
  for (const data of badImages) {
    await assert.rejects(captureCheckpoint({...context, page: page(view, data), outputDirectory: output}),
      hasCode('capture-invalid-image'));
    assert.deepEqual(await readdir(output), []);
  }
  await assert.rejects(captureCheckpoint({...context, page: page({...view, width: 2}), outputDirectory: output}),
    hasCode('capture-invalid-image'));
  assert.deepEqual(await readdir(output), []);
}));

test('CDP failure has a stable runtime error and removes its new directory', () => withOutput(async output => {
  for (const stage of ['readiness', 'screenshot', 'recheck']) {
    const original = new TypeError('private runtime detail: token=secret');
    const probe = page(); let observations = 0;
    probe.cdp.evaluate = async () => {
      if (stage === 'readiness' || stage === 'recheck' && ++observations === 2) throw original;
      return view;
    };
    if (stage === 'screenshot') probe.cdp.call = async () => { throw original; };
    await assert.rejects(captureCheckpoint({...context, page: probe, outputDirectory: output}), error => {
      assert.ok(error instanceof CaptureCheckpointError);
      assert.equal(error.code, 'capture-runtime-unavailable');
      assert.equal(error.cause, original, 'retain adapter faults for diagnosis');
      assert.match(error.message, /readiness|screenshot|rechecked/);
      assert.doesNotMatch(error.message + JSON.stringify(error), /private|secret/); return true;
    });
    assert.deepEqual(await readdir(output), []);
    const retry = await captureCheckpoint({...context, page: page(), outputDirectory: output});
    assert.deepEqual(await readFile(path.join(retry.directory, 'color.png')), Buffer.from(png, 'base64'));
    await rm(retry.directory, {recursive: true});
  }
}));

test('invalid capture input remains a validation error without an underlying fault', () => withOutput(async output => {
  await assert.rejects(captureCheckpoint({...context, page: page(), revision: 'invalid', outputDirectory: output}), error => {
    assert.ok(error instanceof CaptureCheckpointError);
    assert.equal(error.code, 'capture-invalid-context');
    assert.equal(Object.hasOwn(error, 'cause'), false);
    assert.match(error.message, /revision/); return true;
  });
  assert.deepEqual(await readdir(output), []);
}));

test('directory creation failure retains its filesystem cause without exposing the path', () => withOutput(async output => {
  const probe = page(); probe.cdp.evaluate = () => assert.fail('failed allocation queried CDP');
  await assert.rejects(captureCheckpoint({...context, page: probe, outputDirectory: path.join(output, 'private-missing')}), error => {
    assert.equal(error.code, 'capture-storage-unavailable');
    assert.equal(error.cause.code, 'ENOENT');
    assert.match(error.message, /writable existing output directory/);
    assert.doesNotMatch(error.message + JSON.stringify(error), /private-missing/); return true;
  });
  assert.deepEqual(await readdir(output), []);
}));

test('partial bundle write failure preserves its cause, removes the bundle and permits retry', () => withOutput(async output => {
  const probe = page();
  probe.cdp.call = async () => {
    await mkdir(path.join(output, context.checkpoint, 'manifest.json'));
    return {data: png};
  };
  await assert.rejects(captureCheckpoint({...context, page: probe, outputDirectory: output}), error => {
    assert.equal(error.code, 'capture-storage-unavailable');
    assert.ok(error.cause.code, 'retain the platform filesystem error');
    assert.match(error.message, /bundle files could not be written/);
    assert.doesNotMatch(error.message + JSON.stringify(error), new RegExp(output)); return true;
  });
  assert.deepEqual(await readdir(output), []);
  const retry = await captureCheckpoint({...context, page: page(), outputDirectory: output});
  assert.deepEqual((await readdir(retry.directory)).sort(), ['color.png', 'manifest.json']);
}));

test('cleanup failure retains both failures and refuses to overwrite the unremoved checkpoint', () => withOutput(async output => {
  const original = new Error('private capture detail: token=secret');
  const cleanup = new Error('private cleanup path: token=secret');
  const probe = page(); probe.cdp.call = async () => { throw original; };
  let removals = 0;
  await assert.rejects(captureCheckpoint({...context, page: probe, outputDirectory: output}, {fileSystem: {
    mkdir, writeFile, rm: async (directory, options) => {
      removals++;
      assert.equal(directory, path.join(output, context.checkpoint));
      assert.deepEqual(options, {recursive: true, force: true});
      throw cleanup;
    },
  }}), error => {
    assert.equal(error.code, 'capture-cleanup-failed');
    assert.ok(error.cause instanceof AggregateError);
    assert.equal(error.cause.errors.length, 2);
    assert.equal(error.cause.errors[0].code, 'capture-runtime-unavailable');
    assert.equal(error.cause.errors[0].cause, original);
    assert.equal(error.cause.errors[1], cleanup);
    assert.match(error.message, /cleanup needs attention before another capture/);
    assert.doesNotMatch(error.message + JSON.stringify(error), /private|secret/); return true;
  });
  assert.equal(removals, 1);
  assert.deepEqual(await readdir(output), [context.checkpoint]);
  await assert.rejects(captureCheckpoint({...context, page: page(), outputDirectory: output}), hasCode('capture-output-exists'));
  await rm(path.join(output, context.checkpoint), {recursive: true});
  await captureCheckpoint({...context, page: page(), outputDirectory: output});
}));

test('an internal processing fault is rethrown unchanged after removing the new directory', () => withOutput(async output => {
  const original = new TypeError('unexpected image accessor fault');
  const probe = page(); probe.cdp.call = async () => ({get data() { throw original; }});
  await assert.rejects(captureCheckpoint({...context, page: probe, outputDirectory: output}), error => error === original);
  assert.deepEqual(await readdir(output), []);
}));

test('existing checkpoint belongs to its caller and is never overwritten or removed', () => withOutput(async output => {
  const directory = path.join(output, context.checkpoint);
  await mkdir(directory); await writeFile(path.join(directory, 'sentinel'), 'other capture');
  const probe = page(); probe.cdp.evaluate = () => assert.fail('existing output queried CDP');
  await assert.rejects(captureCheckpoint({...context, page: probe, outputDirectory: output}), hasCode('capture-output-exists'));
  assert.equal(await readFile(path.join(directory, 'sentinel'), 'utf8'), 'other capture');
  assert.deepEqual(await readdir(directory), ['sentinel']);
}));
