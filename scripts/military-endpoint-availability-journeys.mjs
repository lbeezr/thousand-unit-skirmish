import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrdinaryMilitaryEndpointAvailability, MILITARY_ENDPOINT_QUERY_VISIT_LIMIT }
  from '../src/simulation/movement/military-endpoint-availability.mjs';
import { createMoveGoalPoint, createClearanceMoveGoalPoint, LAND_CLEARANCE_PROFILE }
  from '../src/unit-movement.mjs';

const width = 16, height = 16;
const cell = (x, z, w = width, h = height) => Math.floor(z + h / 2) * w + Math.floor(x + w / 2);
const actor = (id = 0, extra = {}) => ({ id, generation: 7, orderRevision: 3, hp: 100,
  kind: 'infantry', movementDomain: 'land', team: 0, moveGoalCell: cell(.5, .5), moveGoalPoint: null,
  holdingPosition: false, attackMove: false, stanceCombat: false, stanceReturning: false,
  persistentOrder: null, attackTargetId: -1, attackBuildingTargetId: -1,
  gatherNodeId: null, gatherForestCell: -1, gatherPhase: '', buildingTargetId: null, ...extra });
const snapshot = (units, extra = {}) => createOrdinaryMilitaryEndpointAvailability({ units, width, height,
  maxUnits: 2000, ...extra });
const at = (query, x, z, team = 0, radius = .18) => query.check({ team, position: { x, z }, radius });

for (const team of [0, 1]) test(`seat ${team}: fractional accepted and pending endpoints keep authored body clearance`, () => {
  const unit = actor(0, { team, movePlanningPending: true });
  unit.moveGoalPoint = createClearanceMoveGoalPoint(unit, .93, .22, unit.moveGoalCell, width, height, () => true);
  const before = structuredClone(unit), query = snapshot([unit]);
  assert.equal(at(query, .93, .22, team).status, 'blocked');
  assert.equal(at(query, .53, .22, team).status, 'available', 'exact tangent follows existing epsilon');
  assert.equal(at(query, .53000001, .22, team).status, 'blocked');
  assert.equal(at(query, .93, .22, 1 - team).status, 'available', 'same-team intent only');
  assert.deepEqual(unit, before, 'query never changes endpoint, pending order or revision');
  assert.equal(query.diagnostics.censusSlots, 1); assert.equal(query.diagnostics.endpoints, 1);
});

test('formation and historical cell goals remain reserved after physical route exhaustion without reading paths', () => {
  const unit = actor();
  for (const name of ['path', 'pathIndex', 'attackMoveResumePath', 'queuedWaypoints']) {
    Object.defineProperty(unit, name, { get() { throw new Error(`no ${name} scan`); } });
  }
  const query = snapshot([unit]);
  assert.equal(at(query, .5, .5).status, 'blocked');
  assert.equal(at(query, .5, .9).status, 'available');
  assert.equal(query.diagnostics.endpoints, 1);
});

test('projected clearance points reserve the accepted inset, rather than the requested blocked point', () => {
  const unit = actor();
  unit.moveGoalPoint = createClearanceMoveGoalPoint(unit, .99, .99, unit.moveGoalCell, width, height,
    c => c === unit.moveGoalCell);
  assert.equal(unit.moveGoalPoint.arrivalPolicy, 'cell-inset');
  const query = snapshot([unit]);
  assert.equal(at(query, .5, .5).status, 'blocked', 'accepted .78/.78 occupies center within radius sum');
  assert.equal(at(query, .2, .2).status, 'available');
  assert.equal(at(query, .78, .78).status, 'blocked');
});

for (const version of [1, 2]) test(`v${version} stale fractional identity defers without a center fallback`, () => {
  const unit = actor();
  unit.moveGoalPoint = version === 1 ? createMoveGoalPoint(unit, .93, .22, unit.moveGoalCell, width, height)
    : createClearanceMoveGoalPoint(unit, .93, .22, unit.moveGoalCell, width, height, () => true);
  for (const change of [{ orderRevision: 4 }, { generation: 8 }, { moveGoalCell: cell(1.5, .5) }]) {
    const stale = { ...unit, ...change }, query = snapshot([stale]);
    assert.equal(at(query, .5, .5).status, 'deferred');
    assert.equal(at(query, .5, .5, 1).status, 'available', 'invalid friendly metadata does not poison another seat');
  }
  const malformed = { ...unit, moveGoalPoint: { ...unit.moveGoalPoint, x: NaN } };
  assert.equal(at(snapshot([malformed]), .5, .5).status, 'deferred');
});

test('ordinary endpoint ownership excludes Stop, Hold, combat, persistent, Worker and water domains', () => {
  const excluded = [{ moveGoalCell: -1 }, { holdingPosition: true }, { hp: 0 }, { kind: 'worker' },
    { movementDomain: 'water' }, { attackMove: true }, { stanceCombat: true }, { stanceReturning: true },
    { persistentOrder: { kind: 'follow' } }, { attackTargetId: 0 }, { attackBuildingTargetId: 0 },
    { gatherNodeId: 'food' }, { gatherForestCell: 0 }, { gatherPhase: 'gathering' }, { buildingTargetId: 1 }];
  for (const extra of excluded) {
    const query = snapshot([actor(0, extra)]);
    assert.equal(at(query, .5, .5).status, 'available', JSON.stringify(extra));
    assert.equal(query.diagnostics.endpoints, 0);
  }
});

test('every authored military radius governs access around its own center, including scout and siege', () => {
  for (const [kind, radius] of Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind)) {
    if (kind === 'worker') continue;
    const query = snapshot([actor(0, { kind })]), required = radius + .18;
    assert.equal(at(query, .5 + required, .5).status, 'available');
    assert.equal(at(query, .5 + required - 1e-8, .5).status, 'blocked');
  }
});

test('census and local-query overflow fail closed instead of reporting a clear prefix', () => {
  const oversized = snapshot([actor(), actor(1)], { maxUnits: 1 });
  assert.equal(oversized.diagnostics.censusSlots, 0);
  assert.deepEqual(at(oversized, .5, .5), { status: 'deferred', visited: 0 });
  const units = Array.from({ length: MILITARY_ENDPOINT_QUERY_VISIT_LIMIT + 1 }, (_, id) => actor(id));
  const query = snapshot(units);
  assert.deepEqual(at(query, 1.4, .5), { status: 'deferred', visited: 64 });
  assert.equal(query.diagnostics.endpointVisits, 64);
  assert.equal(query.diagnostics.deferredQueries, 1);
  assert.equal(at(query, .5, .5).status, 'blocked', 'an observed collision is still decisive');
  const bounded = snapshot(units.slice(0, 64));
  assert.deepEqual(at(bounded, 1.4, .5), { status: 'available', visited: 64 });
});

test('invalid or incomplete records and query arguments never yield an available result', () => {
  for (const extra of [{ id: 99 }, { generation: -1 }, { orderRevision: -1 }, { kind: 'unknown' },
    { moveGoalCell: 256 }, { moveGoalCell: NaN }]) {
    assert.equal(at(snapshot([actor(0, extra)]), .5, .5).status, 'deferred', JSON.stringify(extra));
  }
  for (const units of [[undefined], [actor(0, { hp: NaN })]]) {
    assert.equal(at(snapshot(units), .5, .5).status, 'deferred');
  }
  for (const extra of [{ units: null }, { width: 0 }, { height: 1.5 }, { maxUnits: 0 }]) {
    assert.equal(at(snapshot([], extra), .5, .5).status, 'deferred');
  }
  const query = snapshot([]);
  for (const input of [null, undefined, { team: 2, position: { x: 0, z: 0 }, radius: .18 },
    { team: 0, position: { x: NaN, z: 0 }, radius: .18 },
    { team: 0, position: { x: 8, z: 0 }, radius: .18 },
    { team: 0, position: { x: 0, z: 0 }, radius: 0 }]) {
    assert.equal(query.check(input).status, 'deferred');
  }
  assert.equal(at(createOrdinaryMilitaryEndpointAvailability(null), .5, .5).status, 'deferred');
});

test('fresh operation and cold reconstruction release cancelled/replaced goals without a nav revision change', () => {
  const unit = actor(), units = [unit], original = snapshot(units);
  assert.equal(at(original, .5, .5).status, 'blocked');
  unit.moveGoalCell = cell(3.5, .5); unit.orderRevision++;
  assert.equal(at(original, .5, .5).status, 'blocked', 'snapshot lives only inside its original operation');
  const fresh = snapshot(units), cold = snapshot(structuredClone(units));
  for (const query of [fresh, cold]) {
    assert.equal(at(query, .5, .5).status, 'available'); assert.equal(at(query, 3.5, .5).status, 'blocked');
  }
  units[0] = actor(0, { generation: 8, moveGoalCell: -1 });
  assert.equal(at(snapshot(units), 3.5, .5).status, 'available');
});

for (const [w, h] of [[16, 17], [160, 160], [256, 256], [320, 160], [160, 320], [320, 320]]) {
  test(`${w}x${h}: map-edge/adjacent-bucket clearance and representative roster remain bounded`, () => {
    const goal = cell(-w / 2 + .5, -h / 2 + .5, w, h);
    const units = Array.from({ length: 2000 }, (_, id) => actor(id, { hp: id === 0 ? 100 : 0, moveGoalCell: goal }));
    const query = snapshot(units, { width: w, height: h });
    assert.equal(query.diagnostics.censusSlots, 2000);
    assert.equal(at(query, -w / 2 + .5, -h / 2 + .5).status, 'blocked');
    assert.equal(at(query, -w / 2 + .95, -h / 2 + .5).status, 'available');
    assert.equal(query.diagnostics.endpointVisits, 2); assert.ok(query.diagnostics.bucketVisits <= 8);
  });
}

test('seeded live 2,000-endpoint rosters agree with a full-circle oracle across all map shapes', () => {
  let seed = 0x20261005;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const kinds = Object.keys(LAND_CLEARANCE_PROFILE.radiusByKind).filter(kind => kind !== 'worker');
  for (const [w, h] of [[16, 17], [160, 160], [256, 256], [320, 160], [160, 320], [320, 320]]) {
    const units = Array.from({ length: 2000 }, (_, id) => {
      const x = (random() * (w - 1)) - w / 2 + .5, z = (random() * (h - 1)) - h / 2 + .5;
      const unit = actor(id, { team: id % 2, kind: kinds[id % kinds.length],
        moveGoalCell: cell(x, z, w, h), movePlanningPending: id % 3 === 0 });
      if (id % 2) unit.moveGoalPoint = createMoveGoalPoint(unit, x, z, unit.moveGoalCell, w, h);
      return unit;
    });
    const query = snapshot(units, { width: w, height: h });
    assert.equal(query.diagnostics.endpoints, 2000);
    for (let sample = 0; sample < 500; sample++) {
      const team = sample % 2, radius = [.05, .18, .35, .5][sample % 4];
      const position = { x: random() * (w - 1) - w / 2 + .5, z: random() * (h - 1) - h / 2 + .5 };
      const blocked = units.some(unit => {
        if (unit.team !== team) return false;
        const point = unit.moveGoalPoint ?? { x: unit.moveGoalCell % w - w / 2 + .5,
          z: Math.floor(unit.moveGoalCell / w) - h / 2 + .5 };
        return Math.hypot(position.x - point.x, position.z - point.z)
          < radius + LAND_CLEARANCE_PROFILE.radiusByKind[unit.kind] - 1e-9;
      });
      const result = query.check({ team, position, radius });
      assert.ok(result.visited <= 64);
      if (result.status === 'deferred') assert.equal(result.visited, 64);
      else assert.equal(result.status, blocked ? 'blocked' : 'available', JSON.stringify({ w, h, sample, team, position }));
    }
    assert.equal(query.diagnostics.censusSlots, 2000);
    assert.ok(query.diagnostics.bucketVisits <= 500 * 9);
  }
});
