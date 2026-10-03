import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

export async function workerCombatMap(rotation = 0) {
  const map = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url), 'utf8'));
  const point = [{ x: 8, z: 0 }, { x: 0, z: 8 }, { x: -8, z: 0 }, { x: 0, z: -8 }][rotation];
  return { ...map, id: 'worker-duel', name: 'WORKER DUEL', fogOfWar: false, startingArmySize: 10,
    spawnPoints: [{ team: 0, x: -point.x, z: -point.z }, { team: 1, ...point }] };
}

export async function runWorkerCombatRepathCase({ workerTeam = 0, rotation = 0, orderType = 'attack', observe = false } = {}) {
  const fixture = await createPathingReplayFixture(await workerCombatMap(rotation));
  const replay = fixture.replay, workerId = workerTeam ? 5 : 0, infantryId = workerTeam ? 4 : 9;
  const actors = [workerId, infantryId], parked = replay.units.filter(unit => !actors.includes(unit.id));
  const parkedBefore = parked.map(unit => ({ id: unit.id, x: unit.x, z: unit.z, orderRevision: unit.orderRevision }));
  const trace = createHash('sha256');
  let firstDamageTick = null;
  try {
    for (const [team, id, targetId] of [[workerTeam, workerId, infantryId], [1-workerTeam, infantryId, workerId]]) {
      const target = replay.units[targetId];
      const command = orderType === 'attack' ? { type: 'attack', ids: [id], targetId }
        : { type: 'attackMove', ids: [id], x: target.x, z: target.z };
      const notices = replay.order(team, command);
      assert.ok(notices.every(notice => !/REJECTED|FAILED/.test(notice.message)), JSON.stringify(notices));
    }
    for (let ticks = 0; ticks < 1200 && actors.every(id => replay.units[id].hp > 0); ticks++) {
      replay.step();
      const positions = actors.map(id => { const u = replay.units[id]; return [u.x,u.z,u.hp,u.attackTargetId,u.pathIndex]; });
      trace.update(JSON.stringify(positions)+'\n');
      if (firstDamageTick === null && actors.some(id => replay.units[id].hp < 100)) firstDamageTick = replay.tick;
    }
    const worker = replay.units[workerId], infantry = replay.units[infantryId];
    const result = { workerTeam, rotation, orderType, sourceSha256: fixture.sourceSha256, ticks: replay.tick,
      firstDamageTick, workerHp: worker.hp, infantryHp: infantry.hp,
      workerPosition: { x:worker.x,z:worker.z }, infantryPosition: { x:infantry.x,z:infantry.z },
      traceSha256: trace.digest('hex') };
    assert.deepEqual(parked.map(unit => ({ id:unit.id,x:unit.x,z:unit.z,orderRevision:unit.orderRevision })), parkedBefore,
      'pursuit does not move or change the idle roster');
    if (!observe) {
      assert.equal(worker.hp, 0, `accepted pursuit must resolve within 1200 fixed ticks: ${JSON.stringify(result)}`);
      assert.ok(infantry.hp > 0 && infantry.hp < 100, 'Infantry wins and takes real Worker damage');
    }
    return result;
  } finally { await fixture.dispose(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const records = [];
  for (const workerTeam of [0,1]) for (const rotation of [0,1,2,3]) for (const orderType of ['attack','attackMove']) {
    const runs = [];
    for (let n=0;n<2;n++) runs.push(await runWorkerCombatRepathCase({ workerTeam,rotation,orderType,observe:process.argv.includes('--observe') }));
    assert.equal(runs[0].traceSha256,runs[1].traceSha256);
    records.push({ workerTeam,rotation,orderType,runs });
    console.log(JSON.stringify({workerTeam,rotation,orderType,ticks:runs[0].ticks,firstDamageTick:runs[0].firstDamageTick,workerHp:runs[0].workerHp,repeatExact:true}));
  }
  if (process.env.WORKER_COMBAT_RECORD) await writeFile(process.env.WORKER_COMBAT_RECORD,JSON.stringify({
    head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),records },null,2)+'\n');
}
