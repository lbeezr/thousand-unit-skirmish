import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

export async function queuedCargoMap({ type = 'food', stock = .5 } = {}) {
  const map = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url)));
  return { ...map, id: `queued-${type}-cargo`, startingArmySize: 8,
    startingResources: { food: 0, wood: 0 }, triggers: [], scenarioEvents: [],
    resourceNodes: [0, 1].map(team => ({ id: `last-${type}-${team}`, type,
      x: team ? 12.5 : -12.5, z: 6.5, stock })) };
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const records=[];
  for(const [type,stock,queuedType] of [['food',.5,'move'],['food',.004,'attackMove'],['wood',7.25,'move']])for(const team of [0,1]) {
    const runs=[];for(let i=0;i<2;i++)runs.push(await runQueuedCargoReturn({team,type,stock,queuedType,
      observe:process.argv.includes('--observe')}));
    assert.equal(runs[0].traceSha256,runs[1].traceSha256);records.push({team,type,stock,queuedType,runs});
    console.log(JSON.stringify({team,type,stock,queuedType,ticks:runs[0].ticks,arrived:runs[0].arrived,repeatExact:true}));
  }
  if(process.env.QUEUED_CARGO_RECORD)await writeFile(process.env.QUEUED_CARGO_RECORD,JSON.stringify({
    head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),records,
    limits:['production bodies with fixed ticks and planning callbacks drained between ticks; no native scheduling or renderer claim']},null,2)+'\n');
}

export function assertCargoConserved({ stock, bank, cargo }, initial) {
  assert.ok(Math.abs(stock + bank + cargo - initial) < 1e-12,
    'authored stock equals remaining stock, carried cargo and both banks');
}

export async function runQueuedCargoReturn({ team = 0, type = 'food', stock = .5, queuedType = 'move',
  interrupt = null, observe = false } = {}) {
  const map = await queuedCargoMap({ type, stock }), fixture = await createPathingReplayFixture(map), r = fixture.replay;
  try {
    const worker = r.units.find(u => u.team === team && u.kind === 'worker'), ids = [worker.id];
    const untouched = r.units.filter(u => u !== worker).map(u => structuredClone(u));
    const node = r.resources.get(`last-${type}-${team}`), bank = () => type === 'food' ? r.food : r.wood;
    const conserve = () => assertCargoConserved({stock:[...r.resources.values()].reduce((n,v)=>n+v.stock,0),
      bank:bank().reduce((n,v)=>n+v,0),cargo:r.units.filter(u=>u.cargoType===type).reduce((n,v)=>n+v.cargo,0)},stock*2);
    r.order(team, { type: 'move', ids, x: node.x, z: node.z }); r.drain();
    while (worker.pathIndex < worker.path.length && r.tick < 600) r.step();
    assert.match(r.order(team, { type: 'gather', ids, nodeId: node.id }).at(-1).message, /^GATHER ORDER/);
    while (node.stock > 0 && r.tick < 900) { r.step(); conserve(); }
    assert.equal(node.stock, 0); assert.ok(Math.abs(worker.cargo-stock)<1e-12);
    r.order(team, { type: 'stop', ids });
    assert.match(r.order(team, { type: 'returnCargo', ids }).at(-1).message, /^RETURN CARGO ORDER/);
    const beforeQueue = worker.orderRevision;
    const notice = r.order(team, { type: queuedType, ids, x: team ? 15.5 : -15.5, z: -8.5, queue: true }).at(-1);
    assert.match(notice.message, /^WAYPOINT QUEUED/);
    assert.equal(worker.orderRevision, beforeQueue, 'queue admission preserves the delivery order');
    const destination = worker.queuedWaypoints[0].destination, startTick = r.tick, trace = createHash('sha256');
    if (interrupt) {
      r.order(team, { type: interrupt, ids });
      const intent = ({ attackMoveScanTick, attackMoveBucketScanOffset, ...fields }) => fields;
      const stopped = structuredClone(intent(worker));
      for(let i=0;i<90;i++){r.step();conserve();assert.deepEqual(intent(worker),stopped);}
      assert.equal(worker.queuedWaypoints.length,0);assert.equal(worker.holdingPosition,interrupt==='holdPosition');
      assert.equal(bank()[team],0);assert.ok(Math.abs(worker.cargo-stock)<1e-12);
      assert.deepEqual(r.units.filter(u=>u!==worker),untouched);
      return {team,type,stock,queuedType,interrupt,sourceSha256:fixture.sourceSha256,cargo:worker.cargo,
        deposited:bank()[team],stationaryIntentPreserved:true,unselectedUnitsUnchanged:true};
    }
    const done = () => worker.cargo === 0 && worker.gatherPhase === '' && worker.queuedWaypoints.length === 0
      && !worker.movePlanningPending && worker.pathIndex === worker.path.length && worker.moveGoalCell === destination
      && Math.hypot(worker.x - r.point(destination).x, worker.z - r.point(destination).z) < .02;
    while (!done() && r.tick - startTick < 600) {
      r.step(); conserve(); trace.update(JSON.stringify([worker.x,worker.z,worker.cargo,worker.gatherPhase,
        worker.path,worker.pathIndex,worker.moveGoalCell,worker.queuedWaypoints,worker.orderRevision,bank()])+'\n');
    }
    const result = { team,type,stock,queuedType,sourceSha256:fixture.sourceSha256,ticks:r.tick-startTick,arrived:done(),
      deposited:bank()[team],cargo:worker.cargo,gatherPhase:worker.gatherPhase,queued:worker.queuedWaypoints.length,
      destination,moveGoalCell:worker.moveGoalCell,position:{x:worker.x,z:worker.z},traceSha256:trace.digest('hex') };
    if (!observe) assert.equal(result.arrived, true, JSON.stringify(result));
    assert.ok(Math.abs(bank()[team]-stock)<1e-12);assert.equal(worker.cargo,0);
    assert.deepEqual(r.units.filter(u=>u!==worker),untouched);result.unselectedUnitsUnchanged=true;
    assert.equal(worker.attackMove,queuedType==='attackMove');
    for(let i=0;i<60;i++){r.step();conserve();assert.ok(Math.abs(bank()[team]-stock)<1e-12);}
    return result;
  } finally { await fixture.dispose(); }
}
