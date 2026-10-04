import test from 'node:test';
import assert from 'node:assert/strict';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { minimapFixture } from './minimap-client-fixture.mjs';


for (const [team, ids, generations] of [[0, [1, 2], [5, 6]], [1, [3], [7]]]) {
  test(`seat ${team}: one ground move for exactly the living selected owned IDs`, t => {
    const f = minimapFixture(team); t.after(() => f.dom.window.close());
    const selected = [...f.w.selected], fog = [...f.w.latestFogCells];
    const down = f.event('pointerdown', { x: 220, y: 100 });
    f.event('pointermove', { x: 250 });
    f.event('pointerup'); f.event('click'); f.event('contextmenu');
    assert.equal(down.defaultPrevented, true);
    assert.equal(f.sent.length, 1, 'pointer move/up/click/contextmenu must not send again');
    assert.deepEqual(f.sent[0], { type: 'move', ids, unitGenerations: generations, x: 8, z: -12, formation: 'line', clientOrderToken: 1 });
    assert.deepEqual([...f.w.selected], selected);
    assert.deepEqual({ ...f.w.cameraTarget }, { x: 7, z: 9 });
    assert.equal(f.w.mapFitActive, true);
    assert.equal(f.captured.size, 0, 'right-click never captures a camera drag');
    assert.deepEqual([...f.w.latestFogCells], fog, 'unexplored movement does not reveal fog');
  });
}

test('Shift right-click queues a plain move, including when a targeting mode was armed', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  for (const mode of ['attackMove', 'patrol', 'follow']) {
    f.w.attackMoveMode = mode === 'attackMove';
    f.w.persistentTargetMode = mode === 'attackMove' ? null : mode;
    f.w.tapOrderArmed = true;
    f.event('pointerdown', { shiftKey: true });
    assert.equal(f.sent.at(-1).type, 'move'); assert.equal(f.sent.at(-1).queue, true);
    assert.equal(f.w.attackMoveMode, false); assert.equal(f.w.persistentTargetMode, null);
    assert.equal(f.w.tapOrderArmed, false);
  }
});

test('minimap permits selected Skiff Move/Shift queues and refuses mixed domains', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  f.w.units[1].kind = 'skiff'; f.w.selected = new Set([1]);
  f.event('pointerdown'); assert.equal(f.sent.length, 1); assert.equal(f.sent[0].type, 'move');
  f.w.units[2].kind = 'skiff'; f.w.selected.add(2);
  f.event('pointerdown', { shiftKey: true }); assert.equal(f.sent.length, 2);
  assert.equal(f.sent[1].queue, true); assert.deepEqual(f.sent[1].ids, [1, 2]);
  f.w.units[2].kind = 'worker'; f.event('pointerdown'); assert.equal(f.sent.length, 2);
});

test('empty, dead, foreign, spectator, building, placement and finished-match contexts cannot send', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  const states = [
    { selected: new Set() }, { selected: new Set([3, 4, 99]) },
    { localTeam: null }, { selectedBuildingId: 7 }, { buildPlacementActive: true },
    { matchWinner: 0 }, { mapDefinition: null },
  ];
  for (const state of states) {
    Object.assign(f.w, { selected: new Set([1]), localTeam: 0, selectedBuildingId: null,
      buildPlacementActive: false, matchWinner: -1, mapDefinition: {}, ...state });
    assert.equal(f.event('pointerdown').defaultPrevented, false);
    assert.equal(f.event('contextmenu').defaultPrevented, false, 'browser menu stays available outside a valid order context');
  }
  assert.equal(f.sent.length, 0);
});

test('left camera dragging is preserved, ignores other pointers, and never sends units', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  assert.equal(f.event('pointerdown', { button: 0 }).defaultPrevented, true);
  assert.deepEqual({ ...f.w.cameraTarget }, { x: 0, z: 0 });
  assert.equal(f.w.mapFitActive, false); assert.equal(f.captured.has(1), true);
  f.event('pointermove', { id: 2, x: 244, y: 88 });
  assert.deepEqual({ ...f.w.cameraTarget }, { x: 0, z: 0 });
  f.event('pointerdown', { button: 2 });
  assert.equal(f.sent.length, 0, 'a chord during camera drag cannot issue an order');
  f.event('pointermove', { button: 0, x: 244, y: 88 });
  assert.deepEqual({ ...f.w.cameraTarget }, { x: 16, z: -16 });
  f.event('pointercancel', { button: 0 });
  assert.equal(f.captured.size, 0); assert.equal(f.w.minimapPointerId, null);
  f.event('pointerdown', { button: 0 }); f.event('lostpointercapture', { button: 0 });
  assert.equal(f.w.minimapPointerId, null);
  assert.equal(f.event('pointerdown', { button: 1 }).defaultPrevented, false);
  assert.equal(f.sent.length, 0);
});

test('coordinates invert rendering across map aspect, backing size, CSS stretch, zoom and DPR', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  for (const [width, height] of [[64, 64], [160, 96], [96, 160], [256, 256]]) {
    Object.assign(f.w, { MAP_WIDTH: width, MAP_HEIGHT: height, MAP_HALF_X: width / 2, MAP_HALF_Z: height / 2 });
    for (const [cssWidth, cssHeight, backing, dpr, zoom] of [[150, 150, 384, 1, 0.48], [300, 210, 768, 2, 2.3]]) {
      f.bounds({ left: 25, top: 70, width: cssWidth, height: cssHeight });
      f.canvas.width = backing; f.canvas.height = backing;
      f.w.devicePixelRatio = dpr; f.w.zoom = zoom;
      const r = f.w.minimapMapRect(backing, backing);
      const x = width * 0.3, z = -height * 0.2;
      const point = f.w.worldFromMinimap({
        clientX: 25 + (r.left + (x + width / 2) * r.scale) * cssWidth / backing,
        clientY: 70 + (r.top + (z + height / 2) * r.scale) * cssHeight / backing,
      });
      assert.ok(Math.abs(point.x - x) < 1e-9 && Math.abs(point.z - z) < 1e-9);
      const edge = f.w.worldFromMinimap({ clientX: -500, clientY: 1000 });
      assert.deepEqual({ ...edge }, { x: -width / 2, z: height / 2 }, 'padding and out-of-bounds drag clamp to map edges');
    }
  }
  f.bounds({ left: 0, top: 0, width: 0, height: 0 });
  assert.equal(f.w.worldFromMinimap({ clientX: 0, clientY: 0 }), null);
  f.event('pointerdown'); assert.equal(f.sent.length, 0);
});

test('offline sends preserve modes and use the existing transport failure path', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  f.w.socket.readyState = 3; f.w.attackMoveMode = true;
  f.event('pointerdown');
  assert.equal(f.sent.length, 0); assert.equal(f.w.attackMoveMode, true);
});

test('the shipped 1px canvas border is excluded from destination mapping', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  f.canvas.style.border = '1px solid black';
  Object.assign(f.w, { MAP_WIDTH: 256, MAP_HEIGHT: 256, MAP_HALF_X: 128, MAP_HALF_Z: 128 });
  f.bounds({ left: 100, top: 40, width: 150, height: 150 });
  f.event('pointerdown', { x: 101 + 148 * 248 / 256, y: 41 + 148 * 8 / 256 });
  assert.equal(f.sent[0].x, 120); assert.equal(f.sent[0].z, -120);
});

test('battlefield move, attack-move, Patrol and Follow targeting keep their existing semantics', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  f.w.issueMove({ x: 4, z: 6 }); assert.equal(f.sent.at(-1).type, 'move');
  f.w.attackMoveMode = true; f.w.issueMove({ x: 4, z: 6 }); assert.equal(f.sent.at(-1).type, 'attackMove');
  f.w.persistentTargetMode = 'patrol'; f.w.issueMove({ x: 4, z: 6 }, true);
  assert.equal(f.sent.at(-1).type, 'patrol'); assert.equal(f.sent.at(-1).queue, undefined);
  const count = f.sent.length; f.w.persistentTargetMode = 'follow'; f.w.issueMove({ x: 4, z: 6 });
  assert.equal(f.sent.length, count);
});

test('both seats: shipped minimap handlers reach the live server with exact IDs and queued terrain-safe routes', { timeout: 40_000 }, async t => {
  const server = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 15_000 });
  t.after(() => server.dispose());
  await server.start();
  const clients = [await server.connect(0), await server.connect(1)];
  const map = { id: 'minimap-orders-test', name: 'Minimap Orders Test', width: 160, height: 96,
    terrainSeed: 19, fogOfWar: true, startingArmySize: 24,
    startingResources: { food: 1000, wood: 1000 },
    spawnPoints: [{ team: 0, x: -50, z: -10 }, { team: 1, x: 50, z: -10 }],
    obstacles: [{ type: 'stone', column: 29, row: 77, width: 3, height: 3 },
      { type: 'stone', column: 129, row: 77, width: 3, height: 3 }],
    resourceNodes: [], triggers: [], scenarioEvents: [] };
  const beforePublish = clients.map(c => c.messages.length);
  clients[0].send({ type: 'publishMap', map });
  for (const [team, client] of clients.entries()) {
    await client.wait(m => m.type === 'mapChange' && m.state.mapId === map.id, 'map applied', beforePublish[team]);
  }
  const baseline = await server.checkpoint(s => s.mapDefinition.id === map.id);
  const rows = clients.flatMap(c => c.latest.units);
  const selectedByTeam = [];
  const fogAt = (state, cell) => (Buffer.from(state.visibility.data, 'base64')[cell >> 2] >> ((cell & 3) * 2)) & 3;
  for (const [team, client] of clients.entries()) {
    const f = minimapFixture(team); t.after(() => f.dom.window.close());
    const own = client.latest.units.filter(row => row[1] === team && row[4] > 0);
    const ids = [own.find(row => row[5] === 'worker')[0], own.find(row => row[5] !== 'worker')[0]];
    selectedByTeam.push(ids);
    Object.assign(f.w, { MAP_WIDTH: 160, MAP_HEIGHT: 96, MAP_HALF_X: 80, MAP_HALF_Z: 48,
      mapDefinition: map, socket: client.socket, selected: new Set(ids) });
    f.w.units = [];
    for (const row of rows) f.w.units[row[0]] = { id: row[0], team: row[1], hp: row[4], kind: row[5], generation: row[8] };
    // A foreign ID in stale selection still must not be transmitted.
    f.w.selected.add(rows.find(row => row[1] !== team)[0]);
    const minimapPoint = (x, z) => {
      const r = f.w.minimapMapRect(384, 384);
      return { x: 100 + (r.left + (x + 80) * r.scale) / 2, y: 40 + (r.top + (z + 48) * r.scale) / 2 };
    };
    const x = team === 0 ? -50 : 50;
    const point = minimapPoint(x, 30);
    const destinationCell = 78 * 160 + x + 80;
    assert.equal(fogAt(client.latest, destinationCell), 0, 'destination starts unexplored');
    let after = client.messages.length;
    f.event('pointerdown', point);
    await client.wait(m => m.type === 'notice' && m.clientOrderToken === 1 && /^MOVE ORDER/.test(m.message), 'native-handler move applied', after);
    after = client.messages.length;
    f.event('pointerdown', { ...minimapPoint(x, 40), shiftKey: true });
    await client.wait(m => m.type === 'notice' && m.clientOrderToken === 2 && /^WAYPOINT QUEUED/.test(m.message), 'native-handler waypoint queued', after);
    await client.state(s => s.units.some(row => ids.includes(row[0])
      && Math.hypot(row[2] - baseline.state.units[row[0]].x, row[3] - baseline.state.units[row[0]].z) > 0.1), 'selected units move');
    assert.deepEqual({ ...f.w.cameraTarget }, { x: 7, z: 9 });
    assert.equal(client.latest.units.some(row => row[1] !== team), false, 'orders into fog do not expose the far enemy');
    assert.equal(fogAt(client.latest, destinationCell), 0, 'destination remains unexplored until units arrive');
  }
  const allSelected = selectedByTeam.flat();
  const applied = await server.checkpoint(saved => saved.mapDefinition.id === map.id
    && allSelected.every(id => saved.state.units[id].queuedWaypoints.length === 1));
  for (const unit of applied.state.units) {
    const old = baseline.state.units[unit.id];
    if (!allSelected.includes(unit.id)) {
      assert.equal(unit.orderRevision, old.orderRevision, `unselected unit ${unit.id} has no new order`);
      assert.equal(unit.moveGoalCell, old.moveGoalCell);
      assert.equal(unit.queuedWaypoints.length, 0);
    } else {
      const column = unit.moveGoalCell % 160, row = Math.floor(unit.moveGoalCell / 160);
      assert.ok(!map.obstacles.some(o => column >= o.column && column < o.column + o.width
        && row >= o.row && row < o.row + o.height), 'server resolves blocked terrain to an open cell');
      assert.ok(unit.orderRevision > old.orderRevision);
    }
  }
  t.diagnostic('Both Azure and Ember: shipped JSDOM pointer handlers → real WebSocket → authoritative move/queue notices, selected movement, checkpoint exact IDs, terrain fallback and fog masking. This does not prove native browser rendering/input.');
});
