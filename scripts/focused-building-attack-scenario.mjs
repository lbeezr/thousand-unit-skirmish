import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const map = { id: 'native-focused-building-attack', name: 'Native Focused Building Attack',
  width: 64, height: 48, terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
  startingResources: { food: 800, wood: 2000 },
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
  obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 30000 });
let clients, token = 1500;
const observations = [];
const row = (team, id) => clients[team].latest.units.find(u => u[0] === id);
async function order(team, command, expected) {
  const notice = await clients[team].command({ ...command, clientOrderToken: token++ },
    /ORDER|QUEUED|REJECTED|FAILED|PLACED|CANCELLED/);
  assert.match(notice.message, expected); return notice.message;
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  const sessions = clients.map(c => c.welcome.player.sessionToken);
  const restart = async () => {
    await fixture.stop(); await fixture.start();
    clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint));
  };
  clients[0].send({ type: 'publishMap', map, persist: true });
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'building Attack map')));
  for (const team of [0, 1]) {
    const units = clients[team].latest.units.filter(u => u[1] === team);
    await order(team, { type: 'stop', ids: units.map(u => u[0]) }, /STOP ORDER/);
    await order(team, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u[5] !== 'worker').map(u => u[0]) }, /STANCE ORDER/);
  }
  for (const team of [0, 1]) {
    const id = clients[team].latest.units.find(u => u[1] === team && u[5] === 'infantry')[0];
    const builderId = clients[1 - team].latest.units.find(u => u[1] !== team && u[5] === 'worker')[0];
    const beforeBuild = await fixture.checkpoint();
    await order(1 - team, { type: 'build', ids: [builderId], buildingType: 'palisade-wall', x: 6.5, z: .5 }, /PLACED|BUILD ORDER/);
    await order(1 - team, { type: 'stop', ids: [builderId] }, /STOP ORDER/);
    const paid = await fixture.checkpoint(s => s.state.buildings.some(b => b.team !== team && b.type === 'palisade-wall'));
    const target = paid.state.buildings.find(b => b.team !== team && b.type === 'palisade-wall');
    assert.equal(target.complete, false);
    assert.ok(paid.state.teamWood[1 - team] < beforeBuild.state.teamWood[1 - team]);
    await order(team, { type: 'move', ids: [id], unitGenerations: [row(team, id)[8]], x: .75, z: .95 }, /MOVE ORDER/);
    await clients[team].state(s => { const u = s.units.find(u => u[0] === id); return Math.hypot(u[2] - .75, u[3] - .95) < .02; }, 'fractional attacker arrival');
    const before = await fixture.checkpoint(s => !s.state.units[id].movePlanningPending);
    const notice = await order(team, { type: 'attackBuilding', ids: [id], unitGenerations: [row(team, id)[8]], buildingId: target.id }, /ATTACK BUILDING ORDER/);
    const active = await fixture.checkpoint(s => s.state.units[id].attackBuildingTargetId === target.id
      && s.state.units[id].pathIndex < s.state.units[id].path.length);
    const goal = active.state.units[id].moveGoalCell, revision = active.state.units[id].orderRevision;
    assert.equal(revision, before.state.units[id].orderRevision + 1);
    assert.equal(active.state.units[id].attackMove, false);
    await order(team, { type: 'move', ids: [id], x: -3.5, z: -3.5, queue: true }, /QUEUED|MOVE ORDER/);
    await fixture.checkpoint(s => s.state.units[id].queuedWaypoints.length === 1);
    await restart();
    const firing = await fixture.checkpoint(s => s.state.buildings.some(b => b.id === target.id && b.hp < target.hp));
    assert.equal(firing.state.units[id].moveGoalCell, goal); assert.equal(firing.state.units[id].orderRevision, revision);
    const hp = firing.state.buildings.find(b => b.id === target.id).hp;
    await restart();
    const resumed = await fixture.checkpoint(s => s.state.buildings.some(b => b.id === target.id && b.hp < hp));
    assert.equal(resumed.state.units[id].combatStance, 'noAttack');
    assert.equal(resumed.state.units[id].attackBuildingTargetId, target.id);
    assert.deepEqual(resumed.state.buildings.find(b => b.id === target.id).footprint, target.footprint);
    await order(1 - team, { type: 'cancelConstruction', buildingId: target.id }, /CONSTRUCTION CANCELLED/);
    const complete = await fixture.checkpoint(s => {
      const u = s.state.units[id]; return !s.state.buildings.some(b => b.id === target.id)
        && u.attackBuildingTargetId < 0 && u.queuedWaypoints.length === 0 && !u.movePlanningPending
        && Math.hypot(u.x + 3.5, u.z + 3.5) < .001;
    });
    assert.equal(complete.state.units[id].hp, before.state.units[id].hp);
    observations.push({ team, id, targetId: target.id, notice, paidUnfinishedFootprint: target.footprint,
      travelAndFiringColdRestarts: true, recoveredBothSeats: true, durableGoal: goal, acceptedRevision: revision,
      hpBefore: target.hp, hpAfterRecovery: resumed.state.buildings.find(b => b.id === target.id).hp,
      ownerCancellation: true, savedQueuedPointCompleted: true, actorHpUnchanged: true });
    const park = { x: team ? 8.5 : -5.5, z: -5.5 };
    await order(team, { type: 'stop', ids: [id] }, /STOP ORDER/);
    await order(team, { type: 'move', ids: [id], ...park }, /MOVE ORDER/);
    await clients[team].state(s => { const u = s.units.find(u => u[0] === id); return Math.hypot(u[2] - park.x, u[3] - park.z) < .02; }, 'park completed attacker');
  }
  const report = { sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', observations,
    limits: ['Actual native authority, both WebSocket seats, four cold restarts, paid unfinished targets and productive Infantry damage.',
      'Completed structures, Archer journeys, full destruction, range/armor and physical substeps use separate traced command checks.',
      'No rendered frames or served deployment acceptance.'] };
  if (process.env.BUILDING_ATTACK_RECORD) await writeFile(process.env.BUILDING_ATTACK_RECORD, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await fixture.dispose(); }
