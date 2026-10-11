import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { readFile, writeFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { JSDOM } from 'jsdom';
import { UNIT_DEFINITIONS as U, BUILDING_DEFINITIONS as B, TECHNOLOGY_DEFINITIONS as T } from '../src/gameplay-definitions.mjs';
import { createMapImportValidator } from '../src/authoring/map-import-validator.mjs';
import { createMapDefinitionValidator } from '../src/server/map-definition-validator.mjs';
import { mapSizeIdentity } from '../src/map-size-policy.mjs';
import { assertMatchModeCompatibility } from '../src/match-modes.mjs';
import { buildingPad, buildingGroups, paidUnitPlan, recordingCoverage, rosterMap, rosterPlan, rosterSubsets, STAGING_ORIGIN, validateStagingOrigin } from './renderer-roster-audio-plan.mjs';
import { captureRosterStudioFailure, enterRosterRoom, frameRosterArea, identifyPublicAudioSource, persistRosterRecording, rosterCaptureFailureCode, rosterControlPoint, rosterPublishReady, rosterStudioFailureCode, rosterStudioFailureView, validateReviewRoom, validateRosterFrame } from './renderer-roster-audio-capture.mjs';
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
    assert.equal(map.width, 160); assert.equal(map.height, 160); assert.equal(map.startingArmySize, 24);
    assert.equal(mapSizeIdentity(map).ordinarySelectable, true);
    assert.deepEqual(map.scenarioEvents, []); assert.deepEqual(map.triggers, []);
    assert.ok(!map.buildings && !map.units);
    assert.ok(map.resourceNodes.every(node => node.wildlifeState === undefined));
    assert.equal(rosterPlan(subset).timeoutMs, 300000);
  }
});
test('actual ordinary publishMap admits every roster map and rejects the former compact fixture', async () => {
  const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const declaration = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body
    .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'publishMap');
  assert.ok(declaration);
  const validateMapDefinition = createMapDefinitionValidator({ maxUnits: 2000, maxMapObstacles: 4096,
    maxResourceNodes: 128, maxObjectiveFoodReward: 10000, maxMapScenarioEvents: 32,
    maxScenarioEventRepeats: 20, minScenarioEventRepeatSeconds: 5, researchRulesFor: id => T[id] });
  for (const subset of rosterSubsets) {
    const messages = [], saved = [], activated = [], context = {
      pveLaunchOptions: false, soloPractice: false, internalFixture: false,
      validateMapDefinition, mapSizeIdentity, assertMatchModeCompatibility,
      matchMode: { matchModeId: 'authored', matchModeVersion: 1 },
      shippedMapIds: new Set(), mapCatalog: new Map(), runtimeMapIds: new Set(), persistedMapIds: new Set(),
      MAX_RUNTIME_MAPS: 64, DEFAULT_STARTING_ARMY_SIZE: 24,
      persistCustomMap: async map => saved.push(map.id),
      activateMap: map => { context.mapDefinition = map; activated.push(map.id); },
      resetArmy: count => assert.equal(count, 24), returnToPregame() {}, broadcastMapChange() {}, broadcast() {},
      dirty: false,
    };
    const publish = runInNewContext(`(${source.slice(declaration.start, declaration.end)})`, context);
    const player = { team: 0, sendJson: message => messages.push(message) };
    await publish(player, rosterMap(subset), true);
    assert.equal(messages.at(-1).type, 'mapPublished', messages.at(-1).message);
    assert.deepEqual(saved, [rosterMap(subset).id]); assert.deepEqual(activated, saved);
    // The old 64-cell land fixture passes portable validation, but the real
    // ordinary server gate must reject it before saving or changing the map.
    const small = rosterMap('unit-worker'); small.width = 64; small.height = 64;
    await publish(player, small, true);
    assert.equal(messages.at(-1).type, 'mapRejected'); assert.match(messages.at(-1).message, /160 × 160/);
    assert.equal(saved.length, 1); assert.equal(activated.length, 1);
  }
});
test('larger map keeps both shorelines, Dock and authored resources at the same compact world positions', () => {
  for (const subset of ['unit-skiff', 'buildings-special', 'worker-jobs']) {
    const map = rosterMap(subset);
    assert.deepEqual(map.obstacles.map(block => ({ x: block.column - map.width / 2,
      z: block.row - map.height / 2, width: block.width, height: block.height })), [
      { x: -14, z: 10, width: 6, height: 8 }, { x: 11, z: 10, width: 6, height: 8 },
    ]);
    assert.deepEqual(map.spawnPoints.map(point => [point.x, point.z]), [[-20.5, 0], [20.5, 0]]);
    assert.deepEqual(buildingPad('dock'), { x: -12.5, z: 8.5 });
    assert.ok(map.resourceNodes.some(node => node.id === 'audio-fish' && node.x === -9.5 && node.z === 9.5));
    assert.equal(map.elevation, undefined, 'no elevation added outside the compact play area');
  }
});
test('central framing dispatches native wheel input through the actual game handler without camera writes', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const listener = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(node =>
    node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression'
    && node.expression.arguments[0]?.value === 'wheel'
    && source.slice(node.expression.callee.start, node.expression.callee.end) === 'renderer.domElement.addEventListener');
  assert.ok(listener);
  const callback = listener.expression.arguments[1];
  const context = { zoom: .2, cameraMinZoom: .2, mapFitActive: true, lastUnitPickState: null,
    camera: { zoom: .2, updateProjectionMatrix() {} }, cameraTarget: { x: 0, z: 0 },
    THREE: { MathUtils: { clamp: (n, min, max) => Math.max(min, Math.min(max, n)) } },
    worldAt: () => ({ x: 0, z: 0 }), setCamera() {},
    cameraTargetForZoomAnchor: target => target, resizeResourceCallouts() {}, updateResourceNodeCallouts() {}, drawMinimap() {},
    performance: { now: () => 1 },
  };
  const onWheel = runInNewContext(`(${source.slice(callback.start, callback.end)})`, context);
  const calls = [], point = { x: 500, y: 300 };
  const page = { wait: async (expression, description) => {
    if (description === 'visible enabled public control') return { x: 100, y: 50 };
    if (description === 'uncovered central world point') return point;
    return runInNewContext(expression, { window: { __rtsBrowserRecoverySnapshot: () => ({ camera: { zoom: context.zoom } }) } });
  }, cdp: { call: async (method, args) => {
    calls.push({ method, args });
    if (args?.type === 'mouseWheel') onWheel({ ...args, clientX: args.x, clientY: args.y, preventDefault() {} });
  } } };
  await frameRosterArea(page);
  assert.equal(context.zoom, .5); assert.equal(context.mapFitActive, false);
  const wheel = calls.find(call => call.args?.type === 'mouseWheel');
  assert.deepEqual({ x: wheel.args.x, y: wheel.args.y }, point); assert.equal(wheel.args.deltaX, 0);
  assert.ok(calls.every(call => ['Input.dispatchMouseEvent', 'Page.bringToFront'].includes(call.method)));
});
test('studio classification retains fixed failure codes and discards private message content', () => {
  for (const [message, code] of [
    ['Map rejected · Ordinary maps require at least 160 × 160. Use Practice for internal lab maps.', 'map-rejected-size'],
    ['Map rejected · That map ID is already in the room. Choose another ID.', 'map-rejected-id-conflict'],
    ['Map rejected · The custom map could not be saved. Check server storage permissions.', 'map-rejected-storage'],
    ['Map rejected · Custom map limit reached.', 'map-rejected-catalog-limit'],
    ['Map rejected · Play vs AI uses the map selected by its launch seed.', 'map-rejected-mode'],
    ['Map rejected · private-code?token=private', 'map-rejected-other'],
    ['Map not published. Wait for current server state, then retry. Draft edits remain here.', 'publish-waiting-for-state'],
    ['Map not published. Reconnect, then retry. Draft edits remain here.', 'publish-offline'],
    ['Server disconnected. Draft edits stay here until you reconnect.', 'studio-disconnected'],
    ['Connection restored. Review your draft and publish again if needed.', 'studio-reconnected-retry-needed'],
  ]) assert.equal(rosterStudioFailureCode(message), code);
  assert.equal(rosterStudioFailureCode('private draft', true), 'studio-draft-recovery');
  assert.equal(rosterStudioFailureCode('Loaded private-file.json'), null);
  assert.equal(rosterStudioFailureCode('Validating, saving to the custom map library, and syncing it to both players…'), null);
});
test('publication readiness matches actual sendCommand admission, including welcome before first frame', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const declaration = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body
    .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'sendCommand');
  assert.ok(declaration);
  for (const recovering of [false, true]) for (const socketState of [0, 1, 3])
    for (const status of [null, 'AWAITING SERVER RESPONSE', 'SERVER NOT ADVANCING']) {
      let sent = 0;
      const send = runInNewContext(`(${source.slice(declaration.start, declaration.end)})`, {
        browserStateRecovery: { recovering, status: () => status }, performance: { now: () => 1 },
        socket: { readyState: socketState, send() { sent++; } }, WebSocket: { OPEN: 1 },
        ui: { studioMessage: {} }, showToast() {}, audio: { playEvent() {} }, TextEncoder,
      });
      const accepted = send({ type: 'publishMap', map: {} });
      assert.equal(rosterPublishReady({ recovering, socketState, status, applied: 0 }), accepted);
      assert.equal(sent, accepted ? 1 : 0);
    }
  assert.equal(rosterPublishReady(undefined), false);
});
test('capture failure codes distinguish stalled CDP from unsatisfied state without retaining private error text', () => {
  assert.equal(rosterCaptureFailureCode(new Error('Runtime.evaluate timeout')), 'cdp-evaluation-timeout');
  assert.equal(rosterCaptureFailureCode(new Error('ordinary publication timeout; private room')), 'state-wait-timeout');
  assert.equal(rosterCaptureFailureCode(new Error('private room')), 'capture-contract-failed');
});
test('optional private review room validation accepts only the exact code and never quotes rejected values', () => {
  const room = 'private-review'.padEnd(32, 'x');
  assert.equal(validateReviewRoom(room), room);
  for (const empty of [undefined, null, '']) assert.equal(validateReviewRoom(empty), null);
  for (const value of [room + 'x', room.slice(1), ` ${room}`, `${STAGING_ORIGIN}/?room=${room}`, 32, {}]) {
    assert.throws(() => validateReviewRoom(value), error => error.message === 'Invalid private review room code.');
  }
});
function reviewRoomEntryFixture({ observedRoom, origin = STAGING_ORIGIN, team = 0, observer = true } = {}) {
  const room = 'private-review'.padEnd(32, 'x'), calls = [], selectors = [], stages = [];
  const map = rosterMap('unit-worker'), bytes = Buffer.from(JSON.stringify(map));
  const page = { cdp: {
    evaluate: async expression => { assert.equal(expression, 'location.href'); return 'about:blank'; },
    call: async (method, args) => {
      calls.push({ method, args });
      if (method === 'DOM.getDocument') return { root: { nodeId: 1 } };
      if (method === 'DOM.querySelector') return { nodeId: 2 };
      return {};
    },
  }, wait: async (expression, description) => {
    new Function(`return (${expression});`);
    if (description === 'visible enabled public control') {
      selectors.push(JSON.parse(expression.slice(expression.lastIndexOf(')(') + 2, -1)));
      return { x: 100, y: 50 };
    }
    if (description === 'same owned review room admits host seat') {
      const result = await runInNewContext(expression, { URL, crypto: globalThis.crypto, TextEncoder, Uint8Array,
        location: { href: `${origin}/?room=${observedRoom ?? room}` },
        document: { documentElement: { dataset: { entry: 'game' } } },
        window: observer ? { __rtsInteractionAudioSnapshot: () => ({ team }) } : {} });
      if (!result) throw new Error('same owned review room admission timeout');
      return result;
    }
    if (description === 'ordinary authored map import') return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    if (description === 'ordinary Save & Play applies map') return { applied: true };
    if (description === 'ordinary fitted camera zoom') return .2;
    if (description === 'uncovered central world point') return { x: 500, y: 300 };
    return true;
  } };
  return { room, calls, selectors, stages,
    run: () => enterRosterRoom(page, STAGING_ORIGIN, map, '/tmp/owned-map.json', bytes, async stage => stages.push(stage), false, room) };
}
test('private review room joins through native input, verifies the exact host room and uses ordinary Studio controls', async () => {
  const f = reviewRoomEntryFixture(), entry = await f.run();
  assert.equal(entry.method, 'joined-owned-review-room'); assert.equal(entry.room, 'joined-owned-review-room');
  assert.equal(entry.credentialsRetained, false);
  assert.deepEqual(f.selectors.slice(0, 5), ['#menu-join', '#menu-join-dialog input',
    '#menu-join-dialog button[type="submit"]', '#match-menu-toggle', '#map-studio-open']);
  assert.ok(!f.selectors.includes('#menu-studio'));
  assert.deepEqual(f.calls.filter(call => call.method === 'Input.insertText').map(call => call.args.text), [f.room]);
  assert.deepEqual(f.calls.filter(call => call.method === 'Page.navigate').map(call => call.args.url), [`${STAGING_ORIGIN}/`]);
  assert.ok(!JSON.stringify({ entry, stages: f.stages, calls: f.calls.filter(call => call.method !== 'Input.insertText') }).includes(f.room));
});
test('wrong review room, origin or seat never falls back to creating a new room', async () => {
  for (const options of [{ observedRoom: 'wrong'.padEnd(32, 'x') }, { origin: 'https://other.test' }, { team: 1 }, { team: null }, { observer: false }]) {
    const f = reviewRoomEntryFixture(options);
    await assert.rejects(f.run(), /admission timeout/);
    assert.ok(!f.selectors.includes('#menu-studio') && !f.selectors.includes('#map-studio-open'));
    assert.equal(f.stages.at(-1), 'join-owned-review-room');
    assert.equal(f.calls.filter(call => call.method === 'Page.navigate').length, 1);
  }
});
test('ordinary Save & Play reports a server rejection immediately and never proceeds to gameplay framing', async () => {
  const map = rosterMap('unit-worker'), bytes = Buffer.from(JSON.stringify(map));
  const dom = new JSDOM('<dialog id="map-studio" open><p id="studio-message">Map rejected · Ordinary maps require at least 160 × 160. Use Practice for internal lab maps.</p></dialog>');
  const stages = [], page = { cdp: {
    evaluate: async expression => { assert.equal(expression, 'location.href'); return 'about:blank'; },
    call: async method => method === 'DOM.getDocument' ? { root: { nodeId: 1 } } : method === 'DOM.querySelector' ? { nodeId: 2 } : {},
  }, wait: async (expression, description) => {
    new Function(`return (${expression});`);
    if (description === 'visible enabled public control') return { x: 100, y: 50 };
    if (description === 'ordinary authored map import') return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    if (description === 'ordinary Save & Play applies map') return runInNewContext(expression, { document: dom.window.document });
    return true;
  } };
  try {
    await assert.rejects(enterRosterRoom(page, STAGING_ORIGIN, map, '/tmp/owned-authored-map.json', bytes,
      async stage => stages.push(stage)), error => error.studioFailureCode === 'map-rejected-size');
    assert.equal(stages.at(-1), 'publish-result'); assert.ok(!stages.includes('frame-play-area'));
  } finally { dom.window.close(); }
});
test('reuse reloads only the same owned Studio room and waits for a new document', async () => {
  const room = 'private'.padEnd(32, 'x'), calls = [], sentinel = new Error('stop before import');
  const context = { URL, location: { href: `${STAGING_ORIGIN}/?room=${room}` },
    performance: { timeOrigin: 10 }, window: { __rtsInteractionAudioSnapshot: () => ({ team: 0 }) },
    document: { documentElement: { dataset: { entry: 'game' } }, querySelector: () => ({ open: true }) } };
  const page = { cdp: {
    evaluate: async expression => runInNewContext(expression, context),
    call: async (method, args) => { calls.push({ method, args }); if (method === 'DOM.getDocument') throw sentinel; },
  }, wait: async (expression, description) => {
    if (description === 'same owned room reopens Studio') return true;
    assert.equal(runInNewContext(expression, context), false, 'old document cannot satisfy reload');
    context.performance.timeOrigin = 20;
    const observer = context.window.__rtsInteractionAudioSnapshot;
    delete context.window.__rtsInteractionAudioSnapshot;
    assert.equal(runInNewContext(expression, context), false, 'new document waits for Main observer without throwing');
    context.window.__rtsInteractionAudioSnapshot = observer;
    assert.equal(runInNewContext(expression, context), true);
    return true;
  } };
  const stages = [];
  await assert.rejects(enterRosterRoom(page, STAGING_ORIGIN, rosterMap('unit-worker'), '/tmp/owned.json',
    Buffer.from('{}'), async stage => stages.push(stage), true), error => error === sentinel);
  assert.deepEqual(stages, ['owned-room-reload', 'import-map']);
  assert.deepEqual(calls.map(call => call.method), ['Page.reload', 'DOM.getDocument']);
  assert.ok(!JSON.stringify(calls).includes(room), 'private room stays inside the browser');
});
test('reuse refuses an unrelated origin, malformed room or different seat', async () => {
  for (const [origin, room, studio, team] of [
    ['https://other.test', 'x'.repeat(32), '1', 0],
    [STAGING_ORIGIN, 'invalid', '1', 0], [STAGING_ORIGIN, 'x'.repeat(32), '1', 1],
  ]) {
    let calls = 0;
    const page = { cdp: { evaluate: async expression => runInNewContext(expression, {
      URL, location: { href: `${origin}/?room=${room}&studio=${studio}` },
      window: { __rtsInteractionAudioSnapshot: () => ({ team }) },
    }), call: async () => { calls++; } } };
    await assert.rejects(enterRosterRoom(page, STAGING_ORIGIN, rosterMap('unit-worker'), '/tmp/owned.json',
      Buffer.from('{}'), undefined, true));
    assert.equal(calls, 0);
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
  assert.equal(result.identity.files.filter(row => /\.(?:mjs|js)$/.test(row.path)).length, 8);
  assert.ok(result.identity.files.some(row => row.path === '/src/game-entry.mjs'));
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
test('failure screenshot view excludes Join Room, wrong origin, preboot and hidden Studio', () => {
  const dom = new JSDOM('<dialog id="map-studio" open></dialog><dialog id="menu-join-dialog"><input value="private-code"></dialog>');
  const document = dom.window.document, studio = document.querySelector('#map-studio');
  document.documentElement.dataset.boot = 'ready'; document.documentElement.dataset.entry = 'game';
  studio.getBoundingClientRect = () => ({ x: 80, y: 40, width: 1120, height: 660 });
  const context = { document, location: { origin: STAGING_ORIGIN }, innerWidth: 1280, innerHeight: 720, performance: { timeOrigin: 10 } };
  const observe = () => runInNewContext(`(${rosterStudioFailureView.toString()})(${JSON.stringify(STAGING_ORIGIN)})`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(observe())), { timeOrigin: 10, clip: { x: 80, y: 40, width: 1120, height: 660, scale: 1 } });
  const join = document.querySelector('#menu-join-dialog'); join.open = true; assert.equal(observe(), null); join.open = false;
  context.location.origin = 'https://other.test'; assert.equal(observe(), null); context.location.origin = STAGING_ORIGIN;
  document.documentElement.dataset.boot = 'loading'; assert.equal(observe(), null); document.documentElement.dataset.boot = 'ready';
  document.documentElement.dataset.entry = 'menu'; assert.equal(observe(), null); document.documentElement.dataset.entry = 'game';
  studio.open = false; assert.equal(observe(), null); dom.window.close();
});
test('failure screenshot captures only guarded bounds and discards a document change', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'roster-studio-failure-'));
  const view = { timeOrigin: 10, clip: { x: 80, y: 40, width: 1120, height: 660, scale: 1 } };
  const bytes = Buffer.from('89504e470d0a1a0a', 'hex'), calls = [];
  let read = 0, changed = true, admitted = true;
  const page = { cdp: { evaluate: async () => !admitted ? null : ++read % 2 === 0 && changed ? { ...view, timeOrigin: 20 } : view,
    call: async (method, args) => { calls.push({ method, args }); return { data: bytes.toString('base64') }; } } };
  try {
    assert.equal(await captureRosterStudioFailure(page, STAGING_ORIGIN, directory), null);
    assert.deepEqual(await readdir(directory), []);
    changed = false; const receipt = await captureRosterStudioFailure(page, STAGING_ORIGIN, directory);
    assert.equal(receipt.acceptance, false); assert.equal(receipt.scope, 'studio-dialog-only');
    assert.deepEqual(await readFile(path.join(directory, receipt.file)), bytes);
    assert.ok(calls.every(call => call.method === 'Page.captureScreenshot' && JSON.stringify(call.args.clip) === JSON.stringify(view.clip)));
    admitted = false; const count = calls.length;
    assert.equal(await captureRosterStudioFailure(page, STAGING_ORIGIN, directory), null); assert.equal(calls.length, count);
  } finally { await rm(directory, { recursive: true, force: true }); }
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
  assert.equal(result.passed, false); assert.deepEqual(result.events[0], { kind: 'request-failed', path: null, scheme: 'https', route: 'room-api', resourceType: 'Fetch', purpose: 'other', canceled: true });
  assert.ok(!JSON.stringify(result).includes('private'));
  listeners.get('Runtime.exceptionThrown')({}); assert.equal(result.events.length, 1, 'cleanup produces no case errors');
});
test('failed room lookup retains only fixed purpose, response status and elapsed time', () => {
  const listeners = new Map(), page = { cdp: { on: (name, handler) => listeners.set(name, handler) } };
  const observer = observeRosterBrowser(page, STAGING_ORIGIN, []);
  listeners.get('Network.requestWillBeSent')({ requestId: 'opaque', timestamp: 12,
    request: { url: `${STAGING_ORIGIN}/api/rooms/${'private'.padEnd(32, 'x')}?token=private` }, type: 'Fetch' });
  listeners.get('Network.responseReceived')({ requestId: 'opaque', response: { status: 200 } });
  listeners.get('Network.loadingFailed')({ requestId: 'opaque', timestamp: 22.5, canceled: true });
  const result = observer.finish(), event = result.events[0];
  assert.equal(result.passed, false); assert.equal(event.purpose, 'room-lookup');
  assert.equal(event.responseStatus, 200); assert.equal(event.elapsedMs, 10500);
  assert.ok(!JSON.stringify(result).includes('private'));
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
