import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 45000 });
const base = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url)));
const records = []; let token = 600;
try {
  await fixture.start(); let clients = [await fixture.connect(0), await fixture.connect(1)];
  const sessions = clients.map(c => c.welcome.player.sessionToken);
  for (const wall of [false, true]) {
    const map = { ...base, id: `native-worker-queued-${wall ? 'walls' : 'house'}`, startingArmySize: 8,
      startingResources: { food: 1000, wood: 1000 }, triggers: [], scenarioEvents: [] };
    clients[0].send({ type: 'publishMap', map, persist: true });
    await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'queued job map')));
    const workers = clients.map((c, team) => c.latest.units.find(u => u[1] === team && u[5] === 'worker'));
    const ids = workers.map(u => u[0]);
    const before = await fixture.checkpoint(s => s.mapDefinition.id === map.id);
    const untouched = before.state.units.filter(u => !ids.includes(u.id));
    async function order(team, command, expected) {
      const notice = await clients[team].command({ ids: [ids[team]], unitGenerations: [workers[team][8]],
        ...command, clientOrderToken: token++ }, new RegExp(`${expected.source}|REJECTED|FAILED`));
      assert.match(notice.message, expected);
    }
    for (const team of [0, 1]) {
      if (wall) await order(team, { type: 'buildWall', points: [{ column: team ? 44 : 19, row: 23 },
        { column: team ? 46 : 17, row: 23 }] }, /PALISADE LINE PLACED/);
      else await order(team, { type: 'build', buildingType: 'house', x: team ? 12.5 : -12.5, z: -8.5 }, /HOUSE PLACED/);
      await order(team, { type: 'move', x: team ? 18.5 : -18.5, z: 8.5, queue: true }, /WAYPOINT QUEUED/);
      await order(team, { type: 'attackMove', x: team ? 16.5 : -16.5, z: 10.5, queue: true }, /WAYPOINT QUEUED/);
    }
    const queued = await fixture.checkpoint(s => s.mapDefinition.id === map.id
      && ids.every(id => s.state.units[id].buildingTargetId !== null && s.state.units[id].queuedWaypoints.length === 2));
    const goals = ids.map(id => queued.state.units[id].queuedWaypoints[1].destination);
    assert.deepEqual(queued.state.teamWood, wall ? [955, 955] : [925, 925]);
    await fixture.stop();
    const saved = JSON.parse(await readFile(fixture.checkpointPath));
    assert.ok(ids.every(id => saved.state.units[id].queuedWaypoints.length === 2 && saved.state.units[id].workIntent));
    await fixture.start(); clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint));
    let checked = 0;
    const completed = await fixture.checkpoint(s => {
      if (s.mapDefinition.id !== map.id) return false;
      checked++;
      assert.deepEqual(s.state.teamWood, queued.state.teamWood, 'completion never pays twice');
      assert.deepEqual(s.state.units.filter(u => !ids.includes(u.id)), untouched);
      for (const id of ids) if (s.state.units[id].queuedWaypoints.length < 2) {
        assert.ok(s.state.buildings.filter(b => b.team === s.state.units[id].team).every(b => b.complete));
      }
      return ids.every((id, i) => {
        const u = s.state.units[id], point = { x: goals[i] % map.width - map.width / 2 + .5,
          z: Math.floor(goals[i] / map.width) - map.height / 2 + .5 };
        return !u.workIntent && u.buildingTargetId === null && !u.queuedWaypoints.length
          && !u.movePlanningPending && Math.hypot(u.x - point.x, u.z - point.z) < .02;
      });
    });
    records.push({ job: wall ? 'three-wall-sequence' : 'house', teams: [0, 1], completedSites: completed.state.buildings.length,
      waypointsPerWorker: 2, restartedDuringWork: true, unselectedUnitsUnchanged: true,
      wood: completed.state.teamWood, checkpointsChecked: checked, ticks: completed.state.tickNumber - queued.state.tickNumber });
    console.log(JSON.stringify(records.at(-1)));
  }
  if (process.env.WORKER_QUEUED_JOB_RECORD) await writeFile(process.env.WORKER_QUEUED_JOB_RECORD, JSON.stringify({
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
    serverSha256: createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex'),
    records, limits: ['actual local asynchronous server and two WebSocket seats; paid commands and process restart',
      'no injected actor, cargo, progress or economy; no browser, hosted or performance claim'] }, null, 2) + '\n');
} finally { await fixture.dispose(); }
