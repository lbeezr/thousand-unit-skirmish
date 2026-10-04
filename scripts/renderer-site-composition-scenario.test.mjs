import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { id, contextVersion, regressionMap, run } from './renderer-site-composition-scenario.mjs';
import { validateElevationPatches } from '../src/map-utils.mjs';

// CPU orchestration controls only. These pages deliberately produce no pixels.
function pages() {
  const state = { mapId: 'initial', buildings: [], workers: [0, 1].flatMap(team =>
    Array.from({ length: 4 }, (_, i) => ({ id: team * 10 + i, team, task: 'idle', x: team ? 12 : -12, z: 0 }))),
    constructionDraws: [], palisadeGroundDraws: [] };
  const commands = [], reads = []; let nextId = 1;
  const render = () => ({ mapId: state.mapId, unitSpritesReady: true, buildings: [
    { id: -1, team: 0, type: 'town-center', groundY: state.mapId.endsWith('-raised') ? 1.6 : 0 },
    ...state.buildings.map(b => ({ ...b, groundY: state.mapId.endsWith('-raised') ? 1.6 : 0,
      capturedVisible: b.complete && ['watchtower', 'house'].includes(b.type), fallbackVisible: !b.complete }))] });
  const make = team => {
    const win = { get __rtsEnvironmentStateSnapshot() { return { ...state, team }; },
      get __rtsSiteCompositionSnapshot() { return render(); },
      __rtsEnvironmentCaptureCommand(value) {
        commands.push(value);
        if (value.type === 'publishMap') { state.mapId = value.map.id; state.fogOfWar = value.map.fogOfWar; state.buildings = []; }
        if (value.type === 'build') state.buildings.push({ id: nextId++, team, type: value.buildingType,
          x: value.x, z: value.z, progress: .1, complete: false });
        if (value.type === 'buildWall') {
          const [a, b, c] = value.points;
          const xs = Array.from({ length: 6 }, (_, k) => a.column + Math.sign(b.column - a.column) * k);
          for (const column of xs) state.buildings.push({ id: nextId++, team, type: 'palisade-wall',
            x: column - 31.5, z: 6.5, progress: .1, complete: false });
          for (const row of [39, 40]) state.buildings.push({ id: nextId++, team, type: 'palisade-wall',
            x: c.column - 31.5, z: row - 31.5, progress: .1, complete: false });
        }
        if (value.type === 'cancelConstruction') state.buildings = state.buildings.filter(b => b.id !== value.buildingId);
        if (value.type === 'move') Object.assign(state.workers.find(w => w.id === value.ids[0]), { x: value.x, z: value.z });
        return true;
      } };
    const context = vm.createContext({ window: win, Event: class {}, location: { href: 'http://127.0.0.1:4321/?room=' + 'c'.repeat(32) },
      document: { documentElement: { dataset: { entry: 'menu' } }, querySelector: () => ({ disabled: false, click() {}, dispatchEvent() {} }) } });
    return { cdp: { call: async (name, value) => { assert.equal(name, 'Page.navigate'); assert.ok(!/Preview/.test(value.url)); },
      evaluate: async expression => vm.runInContext(expression, context) },
    wait: async (expression, description) => {
      if (description === 'productive palisade foundation') state.buildings.find(b => b.team === team && b.type === 'palisade-wall').progress = .5;
      if (description === 'natural paid construction completion') for (const b of state.buildings.filter(b => b.team === team)) { b.progress = 1; b.complete = true; }
      if (description === 'real raised House completion') for (const b of state.buildings) { b.progress = 1; b.complete = true; }
      const value = vm.runInContext(expression, context); assert.ok(value, description); reads.push(description); return value;
    } };
  };
  return { first: make(0), second: make(1), commands, reads };
}
test('adapter import has the proposed owned identity and a bounded declared authored scene', () => {
  assert.equal(id, 'site-composition'); assert.equal(typeof run, 'function');
  assert.equal(contextVersion, 1);
  assert.equal(regressionMap.id, 'site-composition-regression'); assert.equal(regressionMap.width, 64);
  assert.equal(regressionMap.startingArmySize, 20); assert.equal(regressionMap.fogOfWar, false);
  assert.equal(validateElevationPatches(64, 64, regressionMap.elevationPatches), null);
});
test('even successful screenshot acquisition/state metadata cannot pass uninspected appearance', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'site-adapter-test-'));
  try {
    const p = pages(), captures = [];
    const result = await run({ version: 1, page: p.first, openPage: async () => p.second, origin: 'http://127.0.0.1:4321',
      source: Object.freeze({ revision: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}` }),
      capture: async ({ checkpoint, mapId }) => {
        assert.ok(mapId.startsWith(regressionMap.id)); assert.ok(!captures.includes(checkpoint)); captures.push(checkpoint);
        const child = path.join(directory, checkpoint); await mkdir(child); return { directory: child };
      } });
    assert.equal(captures.length, 14); assert.equal(result.status, 'blocked');
    assert.ok(result.checks.filter(c => !c.passed).every(c => /visual/.test(c.id)));
    assert.equal(p.commands.filter(c => c.type === 'publishMap').length, 2);
    assert.equal(p.commands.filter(c => c.type === 'cancelConstruction').length, 2);
    assert.ok(p.commands.every(c => ['publishMap', 'build', 'buildWall', 'move', 'cancelConstruction'].includes(c.type)));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('capture failures propagate and remote/missing-source contexts fail before game work', async () => {
  const source = Object.freeze({ revision: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}` });
  for (const context of [{ origin: 'https://example.invalid', source }, { origin: 'http://127.0.0.1:4321', source: { ...source, revision: 'unknown' } }]) {
    await assert.rejects(run(context));
  }
  const p = pages(), fault = new Error('capture failed');
  await assert.rejects(run({ version: 1, page: p.first, openPage: async () => p.second, origin: 'http://127.0.0.1:4321', source,
    capture: async () => { throw fault; } }), error => error === fault);
});
