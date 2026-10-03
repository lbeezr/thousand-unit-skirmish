import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';

const observe=process.argv.includes('--observe'),kind=process.argv[2]??'dynamic-goal';
assert.ok(['single-choke','dynamic-route','dynamic-goal'].includes(kind));
const map=pathingBaselineMap({group:64,kind});
const fixture=await createFortifiedFixture({mapPath:'maps/open-field.json',diagnostics:true,timeoutMs:60000});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sourceSha256=createHash('sha256').update(await readFile(new URL('../server.mjs',import.meta.url))).digest('hex');
let token=1;
try {
  await fixture.start();const clients=[await fixture.connect(0),await fixture.connect(1)],client=clients[0];
  client.send({type:'publishMap',map});
  await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id,'pathing map')));
  const army=client.latest.units.filter(u=>u[1]===0&&u[5]==='infantry'),ids=new Set(army.map(u=>u[0]));
  assert.equal(army.length,64);
  const orders=[],samples=[];
  async function order(command,expected) {
    command.clientOrderToken=token++;
    const notice=await client.command(command,new RegExp(`(?:${expected.source})|REJECTED|FAILED`));
    assert.ok(expected.test(notice.message),notice.message);
    orders.push({tick:client.latest.tick,command,notice:notice.message});
  }
  const started=performance.now(),startTick=client.latest.tick;
  await order({type:'move',ids:army.map(u=>u[0]),unitGenerations:army.map(u=>u[8]),x:16.5,z:.5},/MOVE ORDER/);
  if(kind.startsWith('dynamic-')) {
    await client.state(s=>s.tick>=startTick+15,'obstruction tick');
    const worker=client.latest.units.find(u=>u[1]===0&&u[5]==='worker');
    await order({type:'build',ids:[worker[0]],unitGenerations:[worker[8]],buildingType:'house',
      x:kind==='dynamic-goal'?16.5:-10.5,z:.5},/BUILD ORDER/);
  }
  let saved,arrived=0;
  while(performance.now()-started<50000) {
    saved=await fixture.checkpoint(s=>s.mapDefinition.id===map.id);
    const units=saved.state.units.filter(u=>ids.has(u.id));
    const done=u=>!u.movePlanningPending&&u.pathIndex===u.path.length
      &&Math.hypot(u.x-(u.moveGoalCell%map.width-map.width/2+.5),u.z-(Math.floor(u.moveGoalCell/map.width)-map.height/2+.5))<.02;
    arrived=units.filter(done).length;
    samples.push({tick:saved.state.tickNumber,arrived,pending:units.filter(u=>u.movePlanningPending).length,
      activePaths:units.filter(u=>u.pathIndex<u.path.length).length});
    if(arrived===64||saved.state.tickNumber-startTick>=1350)break;
    await sleep(1000);
  }
  const units=saved.state.units.filter(u=>ids.has(u.id)),goals=new Map();
  for(const u of units){const list=goals.get(u.moveGoalCell)||[];list.push(u.id);goals.set(u.moveGoalCell,list);}
  const stalled=units.filter(u=>u.movePlanningPending||u.pathIndex<u.path.length)
    .map(u=>({id:u.id,x:u.x,z:u.z,goal:u.moveGoalCell,pathIndex:u.pathIndex,pathLength:u.path.length,
      pending:u.movePlanningPending,revision:u.orderRevision,lastMoveTick:u.lastMoveTick,
      sharedGoalUnits:goals.get(u.moveGoalCell)}));
  const health=await fixture.health();
  const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256,kind,group:64,
    map,orders,samples,ticks:saved.state.tickNumber-startTick,wallSeconds:(performance.now()-started)/1000,
    arrived,stalled,sharedGoals:[...goals].filter(([,ids])=>ids.length>1),
    tickTiming:health.tickTiming,planning:health.movePlanning,separation:health.separationWork,
    limits:['native two-seat loopback, no renderer or hosted capacity proof','cloud host not isolated; no hardware speedup comparison']};
  if(process.env.PATHING_NATIVE_RECORD)await writeFile(process.env.PATHING_NATIVE_RECORD,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({kind,ticks:report.ticks,arrived,stalled:stalled.length,sharedGoals:report.sharedGoals,observe}));
  if(!observe)assert.equal(arrived,64,'all native soldiers reach their assigned goals');
} finally {await fixture.dispose();}
