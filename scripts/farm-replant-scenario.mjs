import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { farmHarvestNodeId } from '../src/farm-harvest.mjs';
const outputArg=process.argv.slice(2).find(a=>a.startsWith('--output='));
assert.ok(process.argv.slice(2).every(a=>a===outputArg),'Usage: --output=NEW_DIRECTORY');
const output=outputArg?path.resolve(outputArg.slice(9)):null;
if(output) await mkdir(output);
const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceDirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()!=='';
const map={id:'native-farm-renewal',name:'Native paid renewal',width:64,height:64,terrainSeed:19,
  fogOfWar:true,startingArmySize:8,startingResources:{food:0,wood:400},
  spawnPoints:[{team:0,x:-20,z:0},{team:1,x:20,z:0}],obstacles:[],resourceNodes:[],triggers:[],scenarioEvents:[]};
const fixture=await createFortifiedFixture({mapPath:'maps/open-field.json',timeoutMs:90_000});
let clients,tokens,workers;
const records=[];
const plot=(s,t)=>s.state.buildings.find(b=>b.type==='farm'&&b.team===t);
async function command(team,type,extra={},notice) {
  return clients[team].command({type,ids:workers[team].map(u=>u[0]),
    unitGenerations:workers[team].map(u=>u[8]),...extra},notice);
}
function record(stage,snapshot) {
  for(const team of [0,1]) {
    const stock=plot(snapshot,team)?.harvestStock||0;
    const cargo=snapshot.state.units.filter(u=>u.team===team&&u.cargoType==='food').reduce((n,u)=>n+u.cargo,0);
    const supply=stage==='first-delivery'?400:200;
    assert.ok(Math.abs(snapshot.state.teamFood[team]+stock+cargo-supply)<1e-5,stage+' conserves food');
  }
  records.push({stage,tick:snapshot.state.tickNumber,wood:snapshot.state.teamWood,food:snapshot.state.teamFood});
  console.log(JSON.stringify(records.at(-1)));
}
try {
  await fixture.start(); clients=[await fixture.connect(0),await fixture.connect(1)];
  tokens=clients.map(c=>c.welcome.player.sessionToken);
  clients[0].send({type:'publishMap',map});
  await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id)));
  workers=clients.map((c,t)=>c.latest.units.filter(u=>u[1]===t&&u[5]==='worker'));
  for(const team of [0,1]) await command(team,'build',{buildingType:'farm',x:team?16.5:-16.5,z:7.5},/PLACED/);
  const complete=await fixture.checkpoint(s=>s.state.buildings.length===2&&s.state.buildings.every(b=>b.complete));
  for(const team of [0,1]) await command(team,'gather',{nodeId:farmHarvestNodeId(plot(complete,team).id)},/GATHER ORDER/);
  const depleted=await fixture.checkpoint(s=>s.state.buildings.every(b=>b.harvestStock===0)&&s.state.units.every(u=>u.cargo===0));
  record('naturally-exhausted',depleted);
  for(const team of [0,1]) await command(team,'stop',{},/STOP ORDER/);
  const oldIds=[0,1].map(t=>plot(depleted,t).id);
  for(const team of [0,1]) {
    await command(team,'replantFarm',{buildingId:oldIds[team]},/FARM REPLANTED/);
    await command(team,'replantFarm',{buildingId:oldIds[team]},/REPLANT REJECTED/);
  }
  const paid=await fixture.checkpoint(s=>s.state.buildings.every(b=>!b.complete&&b.progress>0));
  assert.deepEqual(paid.state.teamWood,[280,280]);
  assert.ok([0,1].every(t=>plot(paid,t).id!==oldIds[t]));
  record('paid-foundation-exact-once',paid);
  await fixture.stop();
  await fixture.start(); clients=[await fixture.connect(0,tokens[0]),await fixture.connect(1,tokens[1])];
  assert.ok(clients.every(c=>c.welcome.recoveredFromCheckpoint));
  for(const team of [0,1]) await command(team,'replantFarm',{buildingId:oldIds[team]},/REPLANT REJECTED/);
  const delivered=await fixture.checkpoint(s=>s.state.buildings.every(b=>b.complete)&&s.state.teamFood.every((food,team)=>food>paid.state.teamFood[team]+1e-5));
  assert.deepEqual(delivered.state.teamWood,[280,280]);
  for(const team of [0,1]) {
    assert.ok(delivered.state.teamFood[team]>paid.state.teamFood[team]+1e-5,'new crop must materially credit the depot');
    assert.ok(plot(delivered,team).harvestStock<200,'renewed Workers must actually harvest');
  }
  record('first-delivery',delivered);
  const result={sourceRevision,sourceDirty,mapId:map.id,records,scope:'native socket/checkpoint authority; no rendered frames'};
  if(output) await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({stage:'passed',sourceRevision,sourceDirty}));
} finally {await fixture.dispose();}
