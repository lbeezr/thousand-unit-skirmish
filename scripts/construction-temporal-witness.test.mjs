import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import * as movement from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { constructionMovementActive } from '../src/construction-work-intent.mjs';
import { workerPatrolAcquiredMovementActive } from '../src/combat-movement.mjs';
import { createTemporalObserver } from './construction-temporal-observer.mjs';
import { TEMPORAL_WITNESS_POLICY } from './construction-temporal-witness.mjs';

const packed = readFileSync(new URL('../docs/qa-evidence/construction-temporal-2026-10-06/actor75-temporal.json.gz', import.meta.url));
const record = JSON.parse(gunzipSync(packed));
const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const start = server.indexOf('function getMoveVector('), end = server.indexOf('function stationaryWorkerCellsNear(', start);
assert.ok(start >= 0 && end > start);
// Frozen receipts retain the projection contract of their recorded source.
// Current-host clamp behavior is covered in crowd-projected-route-ranking.test.mjs.
const passageArgument = '      passageProjection: unit.pathIndex < unit.path.length - 1 && ordinaryCrowdBodyRadius(unit) > 0,\n';
const currentHost = server.slice(start, end);
assert.equal(currentHost.split(passageArgument).length, 2, 'exactly one current-host passage argument');
const host = currentHost.replace(passageArgument, '');
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);

function frameContext(frame, row, observed) {
  const actors = new Map(), paths = new Map();
  const actorAt = id => { if (!actors.has(id)) actors.set(id,{id}); return actors.get(id); };
  function decode(value) {
    if (!value || typeof value !== 'object') return value;
    if (value.$undefined) return undefined;
    if (value.$number) return Number(value.$number);
    if (value.$actor !== undefined) return actorAt(value.$actor);
    if (value.$path !== undefined) {
      if (!paths.has(value.$path)) paths.set(value.$path,[...value.cells]);
      return paths.get(value.$path);
    }
    if (Array.isArray(value)) return value.map(decode);
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));
  }
  for(const visit of frame.queryVisits) Object.assign(actorAt(visit.actor.id),decode(visit.actor));
  for(const body of frame.bodies??[]) Object.assign(actorAt(body.actor.id),decode(body.actor));
  Object.assign(actorAt(frame.actor.id),decode(frame.actor));
  observed.seedReplayStates((frame.bodies??[]).map(body=>[actorAt(body.actor.id),decode(body.state)]));
  observed.seedReplayPaths(paths);
  const width=record.map.width,height=record.map.height,size=1.2;
  const columns=Math.ceil(width/size),rows=Math.ceil(height/size);
  const units=[],heads=new Int32Array(columns*rows).fill(-1),links=new Int32Array(136).fill(-1);
  for(const [id,actor] of actors) units[id]=actor;
  const buckets=new Map();
  for(const visit of frame.queryVisits) {
    if(!buckets.has(visit.bucket))buckets.set(visit.bucket,[]);
    buckets.get(visit.bucket).push(visit.actor.id);
  }
  for(const [bucket,ids] of buckets) {
    assert.equal(new Set(ids).size,ids.length,'actual bucket chain has no duplicate actor');
    heads[bucket]=ids[0]; for(let i=0;i<ids.length;i++)links[ids[i]]=ids[i+1]??-1;
  }
  const blocked=new Set(row.blockedCells);
  for(const obstacle of record.map.obstacles)for(let z=obstacle.row;z<obstacle.row+obstacle.height;z++)
    for(let x=obstacle.column;x<obstacle.column+obstacle.width;x++)blocked.add(z*width+x);
  const cell=(x,z)=>Math.floor(z+height/2)*width+Math.floor(x+width/2);
  const point=c=>({x:c%width-width/2+.5,z:Math.floor(c/width)-height/2+.5});
  const context=vm.createContext({...movement,...observed,UNIT_DEFINITIONS,constructionMovementActive,
    workerPatrolAcquiredMovementActive,units,STEP_SECONDS:1/30,MAP_WIDTH:width,MAP_HEIGHT:height,
    MAP_HALF_X:width/2,MAP_HALF_Z:height/2,SPATIAL_BUCKET_SIZE:size,
    spatialBucketColumns:columns,spatialBucketRows:rows,spatialBucketHeads:heads,spatialBucketNext:links,
    spatialBucketColumn:x=>Math.max(0,Math.min(columns-1,Math.floor((x+width/2)/size))),
    spatialBucketRow:z=>Math.max(0,Math.min(rows-1,Math.floor((z+height/2)/size))),
    spatialBucketRosterCurrent:true,elevationLevelByCell:new Uint8Array(width*height),
    cellToWorld:point,worldToCell:cell,isWalkable:c=>c>=0&&c<width*height&&!blocked.has(c),
    SEPARATION_DIAGNOSTICS_ENABLED:false,tickNumber:frame.tick,
    navigationRevision:frame.navigationRevision,movePlanningEpoch:frame.epoch});
  vm.runInContext(host,context);
  return {context,unit:actorAt(frame.actor.id),decode,point};
}

test('the one fresh run is source-identified and retains only bounded public actor/query input',()=>{
  assert.equal(createHash('sha256').update(packed).digest('hex'),
    '0ac8d06e7d5c9ed95214c70c9c9cb8fdde2a9372bdb7b30d89ae752683f3f38d');
  assert.equal(record.status,'captured');assert.deepEqual(record.policy,TEMPORAL_WITNESS_POLICY);
  assert.equal(record.source.mainAtLaunch,'7628e8f803404dec5b46c1afc91e4a9836f49fe9');
  assert.equal(record.source.head,'d4d9d7a620f3eb9ef379e174e4af5ecc23195904');
  assert.equal(record.source.trackedDirty,false);
  assert.equal(record.mapSha256,createHash('sha256').update(JSON.stringify(record.map)).digest('hex'));
  assert.deepEqual([record.history[0].tick,record.history.at(-1).tick],[528,708]);
  assert.deepEqual([record.trigger.start,record.trigger.tick,record.trigger.age],[558,678,120]);
  assert.equal(record.lastTick,record.trigger.tick+30);assert.ok(record.lastTick<2700);
  assert.deepEqual(record.commands.map(c=>[c.tick,c.team,c.command.type]),
    [[0,0,'setStance'],[0,1,'setStance'],[0,1,'move'],[0,1,'move'],[15,1,'buildWall']]);
  assert.ok(record.history.every(row=>row.frames.every(f=>f.actor.id===75)
    && row.substeps.every(s=>s.id===75)));
  assert.ok(!/(?:seatSessions|tokenHash|matchId|recoveryToken|checkpointSequence)/.test(JSON.stringify(record)));
});

test('all retained temporal decisions replay through the recorded pre-clamp host contract without another match',async()=>{
  const f=await createTemporalObserver(null,{prepareOnly:true});let calls=0,previousState,continuous=0;
  try {
    for(const row of record.history)for(const frame of row.frames) {
      if(previousState && frame.bodies) {
        assert.deepEqual(frame.bodies[0].state,previousState,`tick${row.tick} continuous observed controller input`);
        continuous++;
      }
      const {context,unit,decode}=frameContext(frame,row,f.observed);
      if(frame.query) {
        const query=context.crowdNeighborsNear(unit);
        assert.equal(query.visits,frame.query.visits,`tick${row.tick} exact actual visits`);
        assert.equal(query.overflow,frame.query.overflow);
        assert.deepEqual(Array.from(query.neighbors,u=>u.id),frame.query.ids);
      }
      f.observed.replayHostStart(unit,frame.tick,frame.navigationRevision,frame.epoch);
      const result=context.getMoveVector(unit,frame.input?.stepDistance);
      f.observed.replayHostEnd(unit,result);
      const [replayed]=f.observed.drainReplayFrames();
      assert.deepEqual(structuredClone(result),decode(frame.result),`tick${row.tick} complete production decision`);
      if(frame.selection) {
        assert.deepEqual(replayed.afterState,frame.afterState,`tick${row.tick} actual controller transition`);
        const events=frame.events.filter(e=>e.type!=='host-oracle');
        assert.deepEqual(replayed.events,events,`tick${row.tick} actual proposal, body-visit, score and priority sequence`);
      }
      if(frame.afterState)previousState=frame.afterState;
      calls++;
    }
    assert.equal(calls,185);
    assert.equal(continuous,182);
  } finally {await f.dispose();}
});

test('the interval distinguishes route repair, real travel and lost admitted progress from a stationary deadlock',()=>{
  const at=tick=>record.history.find(row=>row.tick===tick);
  assert.equal(at(557).after.movePlanningPending,true);
  assert.deepEqual(at(558).after.path.cells.slice(0,3),[3121,3120,3119]);
  assert.equal(at(558).after.movePlanningPending,false);
  const window=record.history.filter(row=>row.tick>=558&&row.tick<=678);
  assert.ok(window.every(row=>row.after.orderRevision===5&&row.after.pathIndex===0
    &&row.after.path.$path===85&&row.after.moveGoalCell===2726
    &&row.after.queuedWaypoints[0].destination===2751));
  assert.ok(Math.abs(window.reduce((sum,row)=>sum+distance(row.before,row.after),0)-1.850681367696689)<1e-12);
  assert.equal(window.filter(row=>row.substeps.length).length,41);
  const row=at(594),frame=row.frames[0],priority=frame.events.find(e=>e.type==='priority');
  assert.equal(priority.yieldingToPeer,true);assert.ok(priority.best);
  const to={x:frame.actor.x+priority.best.x*priority.best.stepDistance,
    z:frame.actor.z+priority.best.z*priority.best.stepDistance};
  const gain=distance(frame.actor,frame.input.progressTarget)-distance(to,frame.input.progressTarget);
  assert.ok(Math.abs(gain-.023663475770982045)<1e-12);
  assert.ok(frame.events.some(e=>e.type==='proposal'&&e.allowed&&distance(e.to,to)<1e-12));
  assert.equal(frame.result.waitingForCrowd,true);assert.equal(row.substeps.length,0);
  const peer=frame.bodies.find(b=>b.actor.id===73);
  assert.equal(peer.actor.path.cells[peer.actor.pathIndex],3120);
  assert.ok(peer.direction.x*priority.routeX+peer.direction.z*priority.routeZ>0);
  assert.ok((peer.target.x-peer.actor.x)*priority.routeX+(peer.target.z-peer.actor.z)*priority.routeZ<0);
  for(const tick of [558,600,678]) {
    const f=at(tick).frames[0];assert.equal(f.queryVisits.length,f.query.visits);
    assert.equal(f.query.overflow,false);assert.equal(f.events.filter(e=>e.type==='proposal').length,f.result.crowdControl.proposals);
  }
  assert.deepEqual([at(678).frames[0].query.visits,at(678).frames[0].query.ids.length,
    at(678).frames[0].result.crowdControl.proposals],[37,23,69]);
});
