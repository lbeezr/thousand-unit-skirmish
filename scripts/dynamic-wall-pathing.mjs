import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

process.env.RTS_MAP='maps/open-field.json';process.env.RTS_GAME_MODE='pvp';process.env.RTS_PREGAME='0';
process.env.RTS_TICK_DIAGNOSTICS='1';process.env.RTS_SEPARATION_DIAGNOSTICS='1';
delete process.env.RTS_MATCH_STATE_PATH;
export async function runDynamicWallCase({team=0,group=64,mode='queued-target',maxTicks=2700}={}) {
  const map=pathingBaselineMap({group}),fixture=await createPathingReplayFixture(map),r=fixture.replay;
  try {
    const army=r.units.filter(u=>u.team===team&&u.kind==='infantry'),ids=army.map(u=>u.id);
    const queued=mode!=='active-route',goalX=queued?16.5:team?-16.5:16.5;
    r.order(team,{type:'move',ids,x:queued?-8.5:goalX,z:.5});r.drain();
    const firstGoals=army.map(u=>u.moveGoalCell);
    if(queued){r.order(team,{type:'move',ids,x:goalX,z:.5,queue:true});r.drain();}
    const requested=army.map(u=>queued?u.queuedWaypoints[0]?.destination:u.moveGoalCell);
    assert.equal(new Set(requested).size,group,'initial formation destinations are distinct');
    for(let i=0;i<15;i++)r.step();
    const points=queued?[{column:61,row:32},{column:67,row:32}]
      :[{column:team?60:40,row:28},{column:team?60:40,row:36}];
    const wallCells=new Set(queued?Array.from({length:7},(_,i)=>32*map.width+61+i)
      :Array.from({length:9},(_,i)=>(28+i)*map.width+(team?60:40)));
    const intercepted=queued?requested.filter(c=>wallCells.has(c)).length
      :army.filter(u=>u.path.slice(u.pathIndex).some(c=>wallCells.has(c))).length;
    assert.ok(intercepted>0,'paid wall intersects actual assigned goals or paths');
    const worker=r.units.find(u=>u.team===team&&u.kind==='worker'),beforeWood=r.wood[team],beforeNav=r.navigationRevision;
    const notice=r.order(team,{type:'buildWall',ids:[worker.id],unitGenerations:[worker.generation],points});r.drain();
    assert.ok(notice.some(n=>n.message.startsWith('PALISADE LINE PLACED')),JSON.stringify(notice));
    assert.equal(r.buildings.length,wallCells.size);assert.equal(r.navigationRevision,beforeNav+1);
    assert.equal(r.wood[team],beforeWood-wallCells.size*BUILDING_DEFINITIONS['palisade-wall'].cost.wood);
    assert.deepEqual(r.units.filter(u=>u.buildingTargetId!==null).map(u=>u.id),[worker.id],'only the named builder changes work');
    assert.deepEqual(army.map(u=>u.moveGoalCell),firstGoals,'wall admission preserves unblocked current goals');
    if(queued)assert.deepEqual(army.map(u=>u.queuedWaypoints[0].destination),requested,'queue intent survives admission');
    const trace=createHash('sha256'),tickMs=[];let invalidSteps=0,unreachableGoals=0,removed=false;
    const progress=new Map(army.map(u=>[u.id,{goal:u.moveGoalCell,remaining:Infinity,tick:r.tick,max:0}]));
    const done=u=>u.queuedWaypoints.length===0&&!u.movePlanningPending&&u.pathIndex===u.path.length
      &&Math.hypot(u.x-r.point(u.moveGoalCell).x,u.z-r.point(u.moveGoalCell).z)<.02;
    while(r.tick<maxTicks&&!army.every(done)) {
      if(mode==='queued-removal'&&r.tick===40) {
        for(const b of r.buildings.slice()) {
          const notices=r.order(team,{type:'cancelConstruction',buildingId:b.id});
          assert.ok(notices.some(n=>n.message.startsWith('CONSTRUCTION CANCELLED')));
        }
        assert.equal(r.buildings.length,0);removed=true;r.drain();
      }
      const previous=army.map(u=>r.cell(u.x,u.z));r.step();tickMs.push(r.diagnostic.durationMs);
      for(let i=0;i<army.length;i++) {
        const u=army[i],c=r.cell(u.x,u.z),p=progress.get(u.id);
        if(!canTraverseUnitStep(previous[i],c,map.width,r.levels,r.isWalkable))invalidSteps++;
        if(r.components[c]!==r.components[u.moveGoalCell])unreachableGoals++;
        let x=u.x,z=u.z,remaining=0;
        for(const cell of u.path.slice(u.pathIndex)) {const q=r.point(cell);remaining+=Math.hypot(x-q.x,z-q.z);x=q.x;z=q.z;}
        if(p.goal!==u.moveGoalCell||remaining<p.remaining-.05){p.goal=u.moveGoalCell;p.remaining=remaining;p.tick=r.tick;}
        if(!done(u))p.max=Math.max(p.max,r.tick-p.tick);
      }
      trace.update(JSON.stringify(army.map(u=>[u.id,u.x,u.z,u.moveGoalCell,u.pathIndex,u.path,u.orderRevision,u.movePlanningPending,u.queuedWaypoints]))+'\n');
    }
    const goals=army.map(u=>u.moveGoalCell),arrived=army.filter(done).length;
    const validRequestedPreserved=army.every((u,i)=>!r.isWalkable(requested[i])||u.moveGoalCell===requested[i]);
    assert.equal(invalidSteps,0);assert.equal(unreachableGoals,0);assert.equal(arrived,group);
    assert.equal(validRequestedPreserved,true);
    if(mode==='queued-removal'){assert.equal(removed,true);assert.deepEqual(goals,requested);}
    return {team,group,mode,sourceSha256:fixture.sourceSha256,ticks:r.tick,arrived,
      distinctGoals:new Set(goals).size,initialDistinctGoals:new Set(requested).size,intercepted,
      requested,goals,validRequestedPreserved,invalidSteps,unreachableGoals,
      maxNoProgressTicks:Math.max(...[...progress.values()].map(p=>p.max)),traceSha256:trace.digest('hex'),
      tickMs:{p95:tickMs.toSorted((a,b)=>a-b)[Math.ceil(tickMs.length*.95)-1],max:Math.max(...tickMs)},
      repairSamples:r.planning.filter(p=>p.mode==='blocked-route-repair')};
  } finally {await fixture.dispose();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const repeats=Number(process.argv[2]??2);assert.ok(Number.isInteger(repeats)&&repeats>=1&&repeats<=3);
  const records=[];
  for(const team of [0,1])for(const group of [16,64])for(const mode of ['active-route','queued-target','queued-removal']) {
    const runs=[];for(let i=0;i<repeats;i++)runs.push(await runDynamicWallCase({team,group,mode}));
    assert.ok(runs.every(r=>r.traceSha256===runs[0].traceSha256),'canonical replay must repeat exactly');
    records.push({team,group,mode,runs});
    console.log(JSON.stringify({team,group,mode,ticks:runs[0].ticks,arrived:runs[0].arrived,distinctGoals:runs[0].distinctGoals,repeatExact:repeats>1}));
  }
  const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,records,
    limits:['real server bodies; canonical planning drains between ticks; native scheduling/rendering excluded','cloud host not isolated; tick timings observational, no speedup or capacity claim']};
  if(process.env.DYNAMIC_WALL_RECORD)await writeFile(process.env.DYNAMIC_WALL_RECORD,JSON.stringify(report,null,2)+'\n');
}
