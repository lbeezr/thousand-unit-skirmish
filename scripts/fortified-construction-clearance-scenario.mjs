// Native reproduction of the rendered runner's opening; no position/stock injection.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createFortifiedFixture} from './fortified-crossing-fixture.mjs';
import {clearAndBuildFortifiedSite,sendFortifiedCommand} from './fortified-site-clearance.mjs';
const size=Number(process.argv[2]??2000);
assert.ok([250,1000,2000].includes(size));
const legacy=process.argv[3]==='--baseline';
assert.ok(process.argv[3]===undefined||legacy);
const map=JSON.parse(await readFile(new URL('../maps/fortified-crossing.json',import.meta.url)));
map.id=`fortified-clearance-${size}`;map.startingArmySize=size-4;
const fixture=await createFortifiedFixture({diagnostics:true,timeoutMs:120000});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  await fixture.start();const clients=[await fixture.connect(0),await fixture.connect(1)];
  clients[0].send({type:'publishMap',map});
  await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id,'scaled map')));
  const started=performance.now(),startTick=clients[0].latest.tick;let token=1;
  const samples=[],orders=[];
  async function order(team,type,units,extra,label){
    const command={type,ids:units.map(u=>u[0]),unitGenerations:units.map(u=>u[8]),...extra,clientOrderToken:token++};
    const notice=await sendFortifiedCommand(clients[team],command,label);orders.push({team,type,count:units.length,tick:clients[team].latest.tick,message:notice.message});return notice;
  }
  await Promise.all(clients.map(async(c,team)=>{
    await order(team,'move',c.latest.units.filter(u=>u[1]===team&&u[4]>0&&u[5]==='infantry'),{x:team?12.5:-12.5,z:10.5},/MOVE ORDER/);
    await sleep(3000);
  }));
  if(legacy){
    const inSite=(u,team)=>u[1]===team&&u[4]>0&&u[5]!=='worker'
      &&Math.abs(u[2]-(team?18.5:-18.5))<1.5&&Math.abs(u[3]+3.5)<1.5;
    await Promise.all(clients.map(async(c,team)=>{
      const occupants=c.latest.units.filter(u=>inSite(u,team));
      if(occupants.length)await order(team,'move',occupants,{x:team?30.5:-30.5,z:-10.5},/MOVE ORDER/);
    }));
    let cleared=false;
    while(performance.now()-started<120000){
      const occupants=clients.map((c,t)=>c.latest.units.filter(u=>inSite(u,t)).length);
      samples.push({tick:clients[0].latest.tick,occupants});
      if(occupants.every(n=>n===0)){cleared=true;break;}await sleep(500);
    }
    const saved=await fixture.checkpoint(),health=await fixture.health();
    const occupants=saved.state.units.filter(u=>u.hp>0&&u.kind!=='worker'
      &&Math.abs(u.x-(u.team?18.5:-18.5))<1.5&&Math.abs(u.z+3.5)<1.5)
      .map(u=>({id:u.id,team:u.team,x:u.x,z:u.z,goal:u.moveGoalCell,
        pathIndex:u.pathIndex,pathLength:u.path.length,pending:u.movePlanningPending}));
    const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
      mode:'legacy single evacuation',size,cleared,ticks:clients[0].latest.tick-startTick,
      wallSeconds:(performance.now()-started)/1000,orders,samples,occupants,
      tickTiming:health.tickTiming,separationWork:health.separationWork};
    if(process.env.FORTIFIED_CLEARANCE_RECORD)await writeFile(process.env.FORTIFIED_CLEARANCE_RECORD,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({mode:report.mode,size,cleared,ticks:report.ticks,occupants:occupants.length}));
    if(!cleared)process.exitCode=1;
  }else{
  const clearance=await Promise.all(clients.map(async(c,team)=>{
    const workers=c.latest.units.filter(u=>u[1]===team&&u[5]==='worker');
    const cleared=await clearAndBuildFortifiedSite({team,state:async()=>c.latest,
      move:(units,goal)=>order(team,'move',units,goal,/MOVE ORDER/),
      build:()=>order(team,'build',workers.slice(0,2),{buildingType:'barracks',x:team?18.5:-18.5,z:-3.5},/BUILD ORDER|BUILD REJECTED/),
      onSample:sample=>samples.push({team,tick:c.latest.tick,...sample})});
    for(const [index,type] of ['food','wood'].entries()){
      const node=map.resourceNodes.find(n=>n.type===type&&(team?n.x>20:n.x< -20));
      await order(team,'gather',[workers[index+2]],{nodeId:node.id},/GATHER ORDER/);
    }
    return cleared;
  }));
  const acceptedTick=Math.max(...orders.filter(o=>o.type==='build'&&o.message.startsWith('BUILD ORDER')).map(o=>o.tick));
  await Promise.all(clients.map((c,team)=>c.state(s=>s.buildings.some(b=>b.team===team&&b.type==='barracks'&&b.complete),'paid Barracks completion')));
  const saved=await fixture.checkpoint(s=>[0,1].every(t=>s.state.buildings.some(b=>b.team===t&&b.type==='barracks'&&b.complete)));
  for(const building of saved.state.buildings.filter(b=>b.type==='barracks')){
    assert.ok(!saved.state.units.some(u=>u.hp>0&&building.footprint.includes(Math.floor(u.z+map.height/2)*map.width+Math.floor(u.x+map.width/2))),'actual completed footprint stays empty');
  }
  const health=await fixture.health();
  const sourceHashes=Object.fromEntries(await Promise.all([
    '../server.mjs','../maps/fortified-crossing.json','./fortified-site-clearance.mjs',
    './fortified-construction-clearance-scenario.mjs',
  ].map(async name=>[name,createHash('sha256').update(await readFile(new URL(name,import.meta.url))).digest('hex')])));
  const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),size,startingArmySize:map.startingArmySize,
    sourceHashes,
    acceptedTick,clearanceTicks:acceptedTick-startTick,completionTick:clients[0].latest.tick,wallSeconds:(performance.now()-started)/1000,
    clearance,orders,samples,tickTiming:health.tickTiming,separationWork:health.separationWork,movePlanning:health.movePlanning,
    bothSeatPaidBarracksComplete:true,actualFootprintsEmpty:true,
    limits:['server-only construction/gathering opening; no full combat/audio/render/recovery workload','cloud host not isolated; no hardware timing improvement or supported capacity claim']};
  if(process.env.FORTIFIED_CLEARANCE_RECORD)await writeFile(process.env.FORTIFIED_CLEARANCE_RECORD,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({size,clearanceTicks:report.clearanceTicks,completionTick:report.completionTick,
    clearance,bothSeatPaidBarracksComplete:true,actualFootprintsEmpty:true,record:process.env.FORTIFIED_CLEARANCE_RECORD??null}));
  }
}finally{await fixture.dispose();}
