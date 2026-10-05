import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),load=name=>import(pathToFileURL(resolve(root,name)));
const {createPathingReplayFixture}=await load('scripts/pathing-replay-fixture.mjs');
const {canTraverseStaticBodySegment,canTraverseUnitStep}=await load('src/unit-movement.mjs');
const {sweptStaticBodyContacts}=await load('scripts/land-body-clearance.mjs');
process.env.RTS_MAP='maps/open-field.json';process.env.RTS_GAME_MODE='pvp';process.env.RTS_PREGAME='0';
process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK='0';delete process.env.RTS_MATCH_STATE_PATH;
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
const result={sourceRevision:git('rev-parse','HEAD'),sourceDirty:git('status','--porcelain')!=='',cases:[]};
// Real commands only; initial parked Worker body-pair overlap is not qualified.
const scenes=[
 {id:'approach',poses:[{x:.79,z:.95},{x:.65,z:.9},{x:.5,z:.7},{x:.3,z:.6}],site:{x:3.5,z:.5}},
 {id:'access',poses:[{x:1.5,z:.5},{x:1.45,z:.5},{x:1.55,z:.5},{x:1.5,z:.45}],site:{x:3.5,z:.5}},
 {id:'corner-access',poses:Array.from({length:4},()=>({x:.5,z:.5})),site:{x:2.5,z:-.5}},
];
for(const scene of scenes)for(const team of [0,1])for(const crew of [2,4]){
 const map={id:'stationary-construction-gap',name:'Stationary Construction Gap',width:64,height:48,terrainSeed:881,
  fogOfWar:false,startingArmySize:16,startingResources:{food:500,wood:1000},
  spawnPoints:[{team:0,x:-20,z:-16},{team:1,x:20,z:16}],resourceNodes:[],triggers:[],scenarioEvents:[],
  obstacles:[{column:33,row:25,width:1,height:1,material:'stone'}]};
 const f=await createPathingReplayFixture(map,{traceLandSteps:true}),r=f.replay;
 try{
  for(const seat of [0,1]){const us=r.units.filter(u=>u.team===seat);r.order(seat,{type:'stop',ids:us.map(u=>u.id)});
   r.order(seat,{type:'setStance',stance:'noAttack',ids:us.filter(u=>u.kind!=='worker').map(u=>u.id)});}
  const workers=r.units.filter(u=>u.team===team&&u.kind==='worker').slice(0,crew);assert.equal(workers.length,crew);
  const commands=[],poses=scene.poses;
  for(const [i,u] of workers.entries()){
   const command={type:'move',ids:[u.id],unitGenerations:[u.generation],...poses[i]},notices=r.order(team,command);r.drain();
   commands.push({team,command,notices});assert.ok(notices.some(n=>/MOVE ORDER/.test(n.message)));
   for(let t=0;t<700&&u.pathIndex<u.path.length;t++)r.step();assert.deepEqual({x:u.x,z:u.z},poses[i]);
   assert.ok(canTraverseStaticBodySegment(u,u,.18,64,48,r.isWalkable));
  }
  const ids=new Set(workers.map(u=>u.id)),untouched=r.units.filter(u=>!ids.has(u.id)).map(u=>({id:u.id,x:u.x,z:u.z,hp:u.hp,generation:u.generation,revision:u.orderRevision,buildingTargetId:u.buildingTargetId}));
  const input=r.checkpoint(),command={type:'build',ids:[...ids],unitGenerations:workers.map(u=>u.generation),buildingType:'house',...scene.site};
  const notices=r.order(team,command);commands.push({team,command,notices});assert.ok(notices.some(n=>/PLANNING BUILD/.test(n.message)),JSON.stringify(notices));r.drain();
  const site=r.buildings.find(b=>b.team===team&&b.type==='house');assert.ok(site);assert.equal(r.wood[team],925);
  const steps=[],contacts=[];let ticks=0,productiveTicks=0,separationSteps=0,illegalCenters=0,newUnsafe=0;
  for(;ticks<700&&!site.complete;ticks++){
   const progress=site.progress;r.step();if(site.progress>progress)productiveTicks++;
   for(const s of r.landSteps.filter(s=>ids.has(s.id))){steps.push(s);if(s.reason==='interaction-separation')separationSteps++;
    if(!canTraverseUnitStep(r.cell(s.from.x,s.from.z),r.cell(s.to.x,s.to.z),64,r.levels,r.isWalkable))illegalCenters++;
    if(!canTraverseStaticBodySegment(s.from,s.to,.18,64,48,r.isWalkable,{allowEscape:true}))newUnsafe++;
    const hits=sweptStaticBodyContacts(s.from,s.to,.18,64,48,r.isWalkable);if(hits.contacts.length)contacts.push({...s,contacts:hits.contacts});
   }
  }
  assert.ok(site.complete);assert.ok(productiveTicks>0);assert.equal(r.wood[team],925);
  assert.deepEqual(r.units.filter(u=>!ids.has(u.id)).map(u=>({id:u.id,x:u.x,z:u.z,hp:u.hp,generation:u.generation,revision:u.orderRevision,buildingTargetId:u.buildingTargetId})),untouched);
  const row={scenario:scene.id,team,crew,sourceSha256:f.sourceSha256,map,commands,input,siteId:site.id,ticks,productiveTicks,separationSteps,
   observedSteps:steps.length,illegalCenters,newUnsafe,contactSteps:contacts.length,firstContact:contacts[0]??null,paidWood:75,completed:site.complete,steps,contacts};
  result.cases.push(row);const{map:_,commands:__,input:___,steps:____,contacts:_____,...summary}=row;console.log(JSON.stringify(summary));
 }finally{await f.dispose();}
}
assert.equal(git('rev-parse','HEAD'),result.sourceRevision);
assert.equal(git('status','--porcelain')!=='',result.sourceDirty);
const target=process.argv[2];assert.ok(target,'Supply an output .json.gz path');
await writeFile(target,gzipSync(JSON.stringify(result)));

