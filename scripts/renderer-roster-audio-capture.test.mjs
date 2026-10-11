import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { UNIT_DEFINITIONS as U, BUILDING_DEFINITIONS as B, TECHNOLOGY_DEFINITIONS as T } from '../src/gameplay-definitions.mjs';
import { createMapImportValidator } from '../src/authoring/map-import-validator.mjs';
import { buildingPad, buildingGroups, paidUnitPlan, recordingCoverage, rosterMap, rosterPlan, rosterSubsets, STAGING_ORIGIN, validateStagingOrigin } from './renderer-roster-audio-plan.mjs';
import { identifyPublicAudioSource, persistRosterRecording, rosterControlPoint, validateRosterFrame } from './renderer-roster-audio-capture.mjs';
import { observeRosterBrowser, rosterMatrix, runRosterStaging, validateRosterCapability } from './renderer-roster-audio-staging.mjs';
import { captureWorkerRepair, repairBuildingPoint, validateRepairHealth } from './renderer-roster-audio-repair.mjs';

const revision = 'a'.repeat(40), sourceHash = 'b'.repeat(64);
const manifest = JSON.parse(await readFile(new URL('../assets/audio/runtime/frontier-feedback/v3/manifest.json', import.meta.url)));
const bindings = manifest.pack.profiles.find(p => p.id === 'interactions').bindings;
const validator = createMapImportValidator({ maxPerTeam: 1000, maxResourceNodes: 128, maxTriggers: 32, maxScenarioEvents: 32,
  maxScenarioEventRepeats: 20, minScenarioEventRepeatSeconds: 5, maxObjectiveFoodReward: 10000, maxTriggerUnitReward: 25,
  obstacleMaterials: ['stone', 'forest', 'water'] });
const capability = () => ({ status: 'ready', webglReadbackPassed: true, sandbox: 'enabled', launchAttempts: 1, source: { revision, dirty: false } });

test('bounded matrix includes every current selection and ordinary supported role orders', () => {
  const planned = rosterSubsets.flatMap(subset => rosterPlan(subset).keys);
  assert.equal(new Set(planned).size, planned.length);
  for (const kind of Object.keys(U)) for (const cue of ['select', 'move', 'stop', 'hold', 'ready']) assert.ok(planned.includes(`unit.${kind}.${cue}`));
  for (const type of Object.keys(B)) assert.ok(planned.includes(`building.${type}.select`));
  assert.deepEqual(Object.values(buildingGroups).flat().sort(), Object.keys(B).sort());
  assert.ok(planned.every(key => Object.hasOwn(bindings, key)));
  assert.deepEqual(Object.keys(bindings).filter(key => !planned.includes(key)), []);
  assert.ok(!rosterPlan('unit-skiff').keys.some(key => /patrol|follow|attack/.test(key)));
  assert.deepEqual(rosterMatrix('unit-worker'), ['unit-worker']); assert.deepEqual(rosterMatrix('all'), rosterSubsets);
  for (const value of ['../unit-worker', 'all,unit-worker', 'unit-villager', 'buildings-castle']) assert.throws(() => rosterMatrix(value));
});
test('all fixture maps pass actual portable import rules without authoring runtime states', () => {
  for (const subset of rosterSubsets) {
    const map = rosterMap(subset), before = JSON.stringify(map), normalized = validator(map);
    assert.equal(JSON.stringify(map), before); assert.equal(normalized.id, map.id);
    assert.equal(map.width, 64); assert.equal(map.height, 64); assert.equal(map.startingArmySize, 24);
    assert.deepEqual(map.scenarioEvents, []); assert.deepEqual(map.triggers, []);
    assert.ok(!map.buildings && !map.units);
    assert.ok(map.resourceNodes.every(node => node.wildlifeState === undefined));
    assert.equal(rosterPlan(subset).timeoutMs, 300000);
  }
});
test('paid production includes real technology dependencies, population headroom and sufficient opening bank', () => {
  for (const kind of Object.keys(U)) {
    const steps = paidUnitPlan(kind), research = new Set(), buildings = new Set(['town-center']);
    const cost = { food: 0, wood: 0 }; let capacity = 15;
    for (const step of steps) {
      const rule = step.build ? B[step.build] : step.research ? T[step.research] : U[step.train];
      assert.ok((rule.requires ?? []).every(id => research.has(id)), 'requirements completed before paid action');
      if (step.build) { buildings.add(step.build); capacity += B[step.build].populationCapacity ?? 0; }
      if (step.research) { assert.ok(buildings.has(step.at)); research.add(step.research); }
      if (step.train) { assert.ok(buildings.has(step.at)); assert.ok(B[step.at].products.includes(kind)); }
      for (const resource of ['food', 'wood']) cost[resource] += rule.cost[resource];
    }
    assert.ok(cost.food <= 2000 && cost.wood <= 3000); assert.ok(12 + U[kind].population <= capacity);
    assert.deepEqual(steps.at(-1), { train: kind, at: Object.values(B).find(b => b.products.includes(kind)).id });
  }
  assert.deepEqual(buildingPad('dock'), { x: -12.5, z: 8.5 });
});
test('public origin and cloud capability reject authority expansion or stale source', () => {
  assert.equal(validateStagingOrigin(STAGING_ORIGIN), STAGING_ORIGIN);
  for (const value of [STAGING_ORIGIN + '/', STAGING_ORIGIN + '?secret=x', 'http://127.0.0.1', 'https://user:pass@game-staging-21f9.up.railway.app']) assert.throws(() => validateStagingOrigin(value));
  validateRosterCapability(capability(), revision, 'linux');
  for (const change of [{ status: 'blocked' }, { sandbox: 'disabled' }, { launchAttempts: 2 }, { webglReadbackPassed: false }, { source: { revision, dirty: true } }]) {
    assert.throws(() => validateRosterCapability({ ...capability(), ...change }, revision, 'linux'));
  }
  assert.throws(() => validateRosterCapability(capability(), revision, 'darwin'));
  assert.throws(() => validateRosterCapability(capability(), 'c'.repeat(40), 'linux'));
});
test('public content qualification checks actual selected files and all 119 sources with at most four fetches', async () => {
  let active = 0, maximum = 0; const requests = [];
  const fetcher = async (url, options) => {
    active++; maximum = Math.max(maximum, active);
    requests.push(url); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
    assert.equal(options.headers, undefined);
    const file = new URL(url).pathname.slice(1);
    const bytes = await readFile(new URL(`../${file}`, import.meta.url));
    await new Promise(resolve => setImmediate(resolve)); active--; return new Response(bytes);
  };
  const result = await identifyPublicAudioSource(STAGING_ORIGIN, revision, { fetcher });
  assert.equal(maximum, 4); assert.equal(result.identity.deployedRevision, null); assert.equal(result.identity.releaseDigest, null);
  assert.equal(result.identity.files.filter(row => row.path.endsWith('.mp3')).length, 119);
  assert.ok(requests.every(url => !url.includes('/health') && !url.includes('?')));
  await assert.rejects(identifyPublicAudioSource(STAGING_ORIGIN, revision, { fetcher: async () => new Response('wrong release') }), /differs/);
});
test('visible control lookup rejects hidden, covered and aria-disabled duplicates', () => {
  const dom = new JSDOM('<button data-test disabled>first</button><div hidden><button data-test>hidden</button></div><button data-test aria-disabled="true">unavailable</button><button data-test>visible</button>');
  const document = dom.window.document, elements = [...document.querySelectorAll('button')];
  for (const element of elements) { element.getBoundingClientRect = () => ({ x: 20, y: 30, width: 80, height: 40 }); element.scrollIntoView = () => {}; }
  document.elementFromPoint = () => elements.at(-1);
  const find = runInNewContext(`(${rosterControlPoint.toString()})`, { document });
  assert.deepEqual(JSON.parse(JSON.stringify(find('[data-test]'))), { x: 60, y: 50 });
  document.elementFromPoint = () => document.body; assert.equal(find('[data-test]'), null);
  dom.window.close();
});
function output() {
  const bytes = Buffer.alloc(2048); Buffer.from('1a45dfa3', 'hex').copy(bytes);
  return { base64: bytes.toString('base64'), mimeType: 'audio/webm;codecs=opus', faults: [],
    peak: .2, rms: .02, armedAt: 0, beganAt: 0, endedAt: 3500, elapsedMs: 3500, meteredSamples: 4096,
    starts: [{ sha256: sourceHash, time: 500, duration: 1.3 }] };
}
test('partial native media survives failed source validation and is never counted as completed', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'roster-audio-receipt-'));
  try {
    const report = { recordings: [] }, saves = [];
    await assert.rejects(persistRosterRecording({ report, directory, key: 'unit.worker.select', output: output(),
      allowedHashes: ['c'.repeat(64)], persist: async () => saves.push(structuredClone(report)) }));
    assert.equal(report.recordings.length, 0); assert.ok(report.lastOutput.file);
    assert.deepEqual(await readdir(directory), ['unit.worker.select.webm']);
    assert.ok(saves.length >= 2 && saves.every(row => !JSON.stringify(row).includes('base64')));
    const coverage = recordingCoverage(Object.keys(bindings), ['unit.worker.select'], report.recordings);
    assert.deepEqual(coverage.missingPlannedKeys, ['unit.worker.select']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('validated native output needs the observed ordinary action before it satisfies coverage', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'roster-audio-complete-'));
  try {
    const report = { recordings: [] }, keys = ['unit.worker.select'];
    await persistRosterRecording({ report, directory, key: keys[0], output: output(), allowedHashes: [sourceHash], persist: async () => {} });
    assert.deepEqual(recordingCoverage(Object.keys(bindings), keys, report.recordings).missingPlannedKeys, keys);
    report.recordings[0].ordinaryActionObserved = true;
    const covered = recordingCoverage(Object.keys(bindings), keys, report.recordings);
    assert.deepEqual(covered.missingPlannedKeys, []); assert.equal(covered.missingRuntimeKeys.length, 84);
    assert.equal(covered.listeningReview, 'pending'); assert.equal(covered.humanPlaytest, 'not-performed');
    assert.throws(() => recordingCoverage(Object.keys(bindings), keys, [...report.recordings, ...report.recordings]));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('browser diagnostic keeps failed room requests fatal while removing all private URL material', () => {
  const listeners = new Map(), page = { cdp: { on: (name, handler) => listeners.set(name, handler) } };
  const observer = observeRosterBrowser(page, STAGING_ORIGIN, ['src/main.js']);
  listeners.get('Network.requestWillBeSent')({ requestId: 'opaque', request: { url: `${STAGING_ORIGIN}/api/rooms/private-code?token=private` }, type: 'Fetch' });
  listeners.get('Network.loadingFailed')({ requestId: 'opaque', canceled: true, errorText: 'private' });
  const result = observer.finish();
  assert.equal(result.passed, false); assert.deepEqual(result.events[0], { kind: 'request-failed', path: null, scheme: 'https', route: 'room-api', resourceType: 'Fetch', canceled: true });
  assert.ok(!JSON.stringify(result).includes('private'));
  listeners.get('Runtime.exceptionThrown')({}); assert.equal(result.events.length, 1, 'cleanup produces no case errors');
});
test('only the absent optional favicon admits anonymous staging 401; gameplay and server failures remain fatal', () => {
  for (const [file, status, expected] of [['favicon.ico', 401, true], ['favicon.ico', 404, true],
    ['favicon.ico', 502, false], ['src/main.js', 401, false], ['src/main.js', 404, false]]) {
    const listeners = new Map(), page = { cdp: { on: (name, handler) => listeners.set(name, handler) } };
    const observer = observeRosterBrowser(page, STAGING_ORIGIN, ['src/main.js']);
    listeners.get('Network.responseReceived')({ response: { status, url: `${STAGING_ORIGIN}/${file}` }, type: 'Other' });
    const result = observer.finish();
    assert.equal(result.passed, expected); assert.equal(result.events.length, 1, 'exception remains in the evidence');
  }
});
test('staging runner retains failed capture receipt and disposes only its owned browser', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'roster-audio-runner-'));
  try {
    const preflightFile = path.join(temporary, 'preflight.json'); await writeFile(preflightFile, JSON.stringify(capability()));
    let disposed = 0;
    const result = await runRosterStaging({ subset: 'unit-worker', revision, directory: path.join(temporary, 'evidence'), preflightFile }, {
      platform: 'linux', source: () => ({ revision, dirty: false }),
      identify: async () => ({ manifest, identity: { files: [] } }),
      openBrowser: async () => ({ version: { product: 'test-contract' }, dispose: async () => { disposed++; },
        page: async () => ({ cdp: { on: () => {} }, dispose: async () => {} }) }),
      capture: async ({ directory }) => { await writeFile(path.join(directory, 'partial.webm'), Buffer.alloc(1)); return { status: 'failed' }; },
    });
    assert.equal(result.status, 'failed'); assert.equal(disposed, 1);
    assert.ok((await readdir(path.join(temporary, 'evidence'))).includes('partial.webm'));
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
function png() {
  const chunk = (kind, bytes) => { const row = Buffer.alloc(bytes.length + 12); row.writeUInt32BE(bytes.length); row.write(kind, 4); bytes.copy(row, 8); return row; };
  const header = Buffer.alloc(13); header.writeUInt32BE(1280); header.writeUInt32BE(720, 4);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', Buffer.alloc(1100)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
test('ordinary frame receipt cannot pass a stale map, reconnect overlay, wrong origin or truncated PNG', () => {
  const view = { origin: STAGING_ORIGIN, width: 1280, height: 720, scale: 1, boot: 'ready', entry: 'game', mapId: 'audio-unit-worker', requestedMapId: 'audio-unit-worker', connection: 'ROOM LIVE' };
  assert.ok(validateRosterFrame(view, view.mapId, png()).length > 1000);
  for (const change of [{ origin: 'https://example.com' }, { boot: 'loading' }, { entry: 'menu' }, { connection: 'SYNCING CURRENT STATE' }, { requestedMapId: 'another-map' }, { width: 800 }]) {
    assert.throws(() => validateRosterFrame({ ...view, ...change }, view.mapId, png()));
  }
  assert.throws(() => validateRosterFrame(view, view.mapId, png().slice(0, -16)));
});

test('Repair target observation requires the exact building and never mutates the scene', () => {
  let pick = { kind: 'unit', id: 42 };
  const window = { __rtsInteractionAudioProject: () => ({ x: 100, y: 200 }), __rtsInteractionAudioPick: () => pick };
  const find = runInNewContext(`(${repairBuildingPoint.toString()})`, { window });
  assert.equal(find(42, -26.5, 12.5), null);
  pick = { kind: 'building', id: 43 }; assert.equal(find(42, -26.5, 12.5), null);
  pick = { kind: 'building', id: 42 };
  assert.deepEqual(JSON.parse(JSON.stringify(find(42, -26.5, 12.5))), { x: 100, y: 200 });
  assert.deepEqual(pick, { kind: 'building', id: 42 });
  assert.equal(find(42, Infinity, 0), null); assert.equal(find(-1, 0, 0), null);
});
const repairHouse = hp => ({ id: 42, team: 0, type: 'house', x: -26.5, z: 12.5, complete: true, hp, maxHp: 800 });
test('Repair acceptance requires prior real damage and increased health of the same owned complete House', () => {
  assert.deepEqual(validateRepairHealth(repairHouse(789), repairHouse(795), 42), { buildingId: 42, beforeHp: 789, afterHp: 795, maxHp: 800 });
  for (const before of [repairHouse(800), repairHouse(0), { ...repairHouse(789), complete: false }, { ...repairHouse(789), team: 1 }]) {
    assert.throws(() => validateRepairHealth(before, repairHouse(795), 42));
  }
  for (const after of [repairHouse(788), repairHouse(789), repairHouse(801), { ...repairHouse(795), id: 43 }, { ...repairHouse(795), maxHp: 900 }]) {
    assert.throws(() => validateRepairHealth(repairHouse(789), after, 42));
  }
});
function repairFixture({ failAt = null } = {}) {
  const calls = [], evidence = [], controls = [], privateRoom = 'owned-room'.padEnd(32, 'x');
  let hp = 800, attacked = false, stopped = false, repairing = false, disposed = 0;
  const makePage = side => ({
    cdp: {
      evaluate: async expression => {
        if (expression.includes('searchParams.get("room")')) return privateRoom;
        if (expression === 'location.href') return 'about:blank';
        if (expression.includes('__rtsEnvironmentStateSnapshot')) return repairHouse(hp);
        if (expression === 'window.__rtsInteractionAudioSnapshot()') return { units: [{ id: side === 'host' ? 1 : 2,
          kind: side === 'host' ? 'worker' : 'infantry', point: { x: 100, y: 100 } }] };
        throw Error('unexpected evaluation');
      },
      call: async (method, args) => {
        calls.push({ side, method, args });
        if (side === 'guest' && method === 'Input.dispatchMouseEvent' && args.type === 'mouseReleased' && args.button === 'right') attacked = true;
        if (side === 'guest' && method === 'Input.dispatchKeyEvent' && args.type === 'keyDown' && args.key === 's') { assert.ok(attacked); stopped = true; }
        if (side === 'host' && method === 'Input.dispatchMouseEvent' && args.type === 'mouseReleased' && args.button === 'left' && repairing) {
          assert.ok(attacked && stopped && hp < 800); hp = 795;
        }
      },
    },
    wait: async (_expression, description) => {
      // CDP compiles every expression even when fixture state supplies the
      // result. This catches interpolation of negative world coordinates.
      new Function(`return (${_expression});`);
      if (description === failAt) throw Error('bounded fixture failure');
      if (description === 'actual enemy hits damage paid House') { assert.ok(attacked); hp = 789; return repairHouse(hp); }
      if (description === 'paid Repair increases health') return repairHouse(hp);
      if (/pixel|parking point/.test(description)) return { x: 100, y: 100 };
      return true;
    },
    dispose: async () => { disposed++; },
  });
  const page = makePage('host'), guest = makePage('guest');
  return { calls, evidence, controls, privateRoom, disposed: () => disposed,
    run: () => captureWorkerRepair({ page, openGuest: async () => guest, origin: STAGING_ORIGIN,
      mapId: 'audio-worker-repair', build: async type => { assert.equal(type, 'house'); return { id: 42 }; },
      record: async (cue, action) => { assert.equal(cue, 'unit.worker.repair'); assert.ok(stopped); await action(); },
      control: async (controlled, selector) => { controls.push(selector); if (selector === '[data-worker-action="repair"]') { assert.equal(controlled, page); repairing = true; } },
      evidence: async value => evidence.push(structuredClone(value)), signal: new AbortController().signal,
    }),
  };
}
test('ordinary Repair sequence joins second seat, attacks, stops, repairs, proves health and disposes guest', async () => {
  const f = repairFixture(), result = await f.run();
  assert.equal(result.status, 'repaired'); assert.equal(result.guestDisposed, true); assert.equal(f.disposed(), 1);
  assert.deepEqual(result.health, { buildingId: 42, beforeHp: 789, afterHp: 795, maxHp: 800 });
  assert.ok(f.controls.includes('#menu-join') && f.controls.includes('#menu-join-dialog input')
    && f.controls.includes('#menu-join-dialog button[type="submit"]'));
  const typed = f.calls.filter(call => call.method === 'Input.insertText');
  assert.equal(typed.length, 1); assert.equal(typed[0].args.text, f.privateRoom);
  assert.ok(!JSON.stringify(f.evidence).includes(f.privateRoom));
  assert.ok(f.calls.every(call => ['Page.bringToFront', 'Page.addScriptToEvaluateOnNewDocument', 'Page.navigate',
    'Input.dispatchKeyEvent', 'Input.dispatchMouseEvent', 'Input.insertText'].includes(call.method)));
  assert.ok(f.evidence.some(row => row.status === 'damaged' && row.damagedHp === 789));
});
test('failed guest join still disposes the owned guest and never publishes its room code', async () => {
  const f = repairFixture({ failAt: 'fresh guest owns only the second seat' });
  await assert.rejects(f.run()); assert.equal(f.disposed(), 1);
  assert.equal(f.evidence.at(-1).guestDisposed, true);
  assert.ok(!f.evidence.some(row => row.status === 'repaired'));
  assert.ok(!JSON.stringify(f.evidence).includes(f.privateRoom));
});
test('Repair runner admits one isolated guest and keeps guest browser errors fatal', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'roster-repair-runner-'));
  try {
    const preflightFile = path.join(temporary, 'preflight.json'); await writeFile(preflightFile, JSON.stringify(capability()));
    let pages = 0, guestDisposed = 0; const guestListeners = new Map();
    const result = await runRosterStaging({ subset: 'worker-repair', revision, directory: path.join(temporary, 'evidence'), preflightFile }, {
      platform: 'linux', source: () => ({ revision, dirty: false }), identify: async () => ({ manifest, identity: { files: [] } }),
      openBrowser: async () => ({ version: { product: 'test-contract' }, dispose: async () => {}, page: async () => {
        const guest = ++pages === 2;
        return { cdp: { on: (name, callback) => { if (guest) guestListeners.set(name, callback); } },
          dispose: async () => { if (guest) guestDisposed++; } };
      } }),
      capture: async ({ openGuest }) => {
        const guest = await openGuest(); await assert.rejects(openGuest(), /one owned guest/);
        guestListeners.get('Runtime.exceptionThrown')({ exceptionDetails: { text: 'private error' } });
        await guest.dispose(); await guest.dispose(); return { status: 'captured-needs-listening' };
      },
    });
    assert.equal(pages, 2); assert.equal(guestDisposed, 1); assert.equal(result.status, 'failed');
    assert.equal(result.guestObservations[0].passed, false); assert.ok(!JSON.stringify(result).includes('private error'));
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
