import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseUnitStep, canTraverseStaticBodySegment, workerEconomyBodyRadius, activeLandMovementBodyRadius } from '../src/unit-movement.mjs';
import { STONE_ECONOMY_PROFILE_ID } from '../src/economy-profile.mjs';
import { canTraverseFlatUnitSegment, shortcutFlatUnitPath } from '../src/unit-path-line.mjs';

process.env.RTS_MAP='maps/open-field.json';process.env.RTS_GAME_MODE='pvp';process.env.RTS_PREGAME='0';
delete process.env.RTS_MATCH_STATE_PATH;

const map = { id:'worker-flat-flow', name:'WORKER FLAT FLOW', width:160, height:160,
  fogOfWar:false, startingArmySize:8, startingResources:{ food:100, wood:100 },
  spawnPoints:[{team:0,x:-32,z:-24},{team:1,x:32,z:24}],
  resourceNodes:[{id:'food',type:'food',x:13.5,z:11.5,stock:24}],
  obstacles:[],triggers:[],scenarioEvents:[] };
function command(r,u,extra) {
  const notices = r.order(u.team,{ids:[u.id],unitGenerations:[u.generation],...extra});
  r.drain(); assert.ok(notices.some(n=>/ORDER|WAYPOINT QUEUED/.test(n.message)),JSON.stringify(notices));
}
function until(r,predicate,label,limit=5000) {
  for(let tick=0;tick<limit;tick++){if(predicate())return;stepWorkers(r);}
  assert.fail(`Timeout: ${label}`);
}
function checkWorkerSteps(r,id) {
  for(const s of r.landSteps.filter(s=>s.id===id))
    assert.ok(canTraverseStaticBodySegment(s.from,s.to,.18,160,160,r.isWalkable,{allowEscape:true}),
      `actual ${s.reason} step has compatible Worker clearance`);
}
function stepWorkers(r) {
  const active=new Set(r.units.filter(u=>u.kind==='worker'&&activeLandMovementBodyRadius(u)).map(u=>u.id));
  r.step();
  for(const u of r.units)if(u.kind==='worker'&&activeLandMovementBodyRadius(u))active.add(u.id);
  for(const s of r.landSteps.filter(s=>active.has(s.id)))
    assert.ok(canTraverseStaticBodySegment(s.from,s.to,.18,160,160,r.isWalkable,{allowEscape:true}));
}
function trackLeg(r,u,finish) {
  const start={x:u.x,z:u.z},goal=r.point(u.path.at(-1)); let samples=0;
  const dx=goal.x-start.x,dz=goal.z-start.z,length=Math.hypot(dx,dz);
  for(let tick=0;tick<5000&&!finish();tick++) {
    const before={x:u.x,z:u.z,cell:r.cell(u.x,u.z)};r.step();checkWorkerSteps(r,u.id);samples++;
    assert.ok(canTraverseUnitStep(before.cell,r.cell(u.x,u.z),map.width,r.levels,r.isWalkable),'legal authoritative step');
    // Deposit/resumption may switch targets and move in the same authoritative tick.
    if(!finish())assert.ok(Math.abs((u.x-start.x)*dz-(u.z-start.z)*dx)/length<1e-7,JSON.stringify({ label:'work trajectory follows its direct selected leg', start,goal,before,after:{x:u.x,z:u.z,phase:u.gatherPhase,cargo:u.cargo,path:u.path},bank:r.food[u.team],tick,cross:Math.abs((u.x-start.x)*dz-(u.z-start.z)*dx)/length }));
  }
  assert.ok(finish(),'direct work leg finishes');
  assert.ok(samples>3);
}
for(const team of [0,1])test(`seat ${team}: manual, gather, drop-off, Return and resumed work use direct flat legs with recovery`,async()=>{
  const f=await createPathingReplayFixture(map,{traceLandSteps:true}),r=f.replay;
  try {
    let u=r.units.find(u=>u.team===team&&u.kind==='worker');
    // Explicit initial-position geometry fixture; stock/cargo/banks are never injected.
    Object.assign(u,{x:-8.27,z:-9.19});r.step();
    const initial=r.checkpoint(),id=u.id;
    command(r,u,{type:'move',x:13.5,z:11.5});assert.equal(u.path.length,1,'manual direct control');
    r.restore(initial);u=r.units[id];
    command(r,u,{type:'gather',nodeId:'food'});
    assert.equal(u.path.length,1,'Gather must match the direct manual route on identical geometry');
    assert.equal(u.gatherNodeId,'food');
    trackLeg(r,u,()=>u.gatherPhase==='gathering');
    assert.ok(Math.hypot(u.x-13.5,u.z-11.5)<=1.5,'existing interaction radius stops the approach');
    until(r,()=>u.cargo>=10&&u.gatherPhase==='to-base','real full cargo starts automatic drop-off');
    assert.equal(u.path.length,1,'automatic cargo drop-off keeps the chosen reachable endpoint');
    const carrying=r.checkpoint(),views=[r.snapshot(0),r.snapshot(1)];
    assert.ok(r.validate(carrying));r.restore(carrying);u=r.units[id];
    assert.deepEqual(r.checkpoint().state.units[id],carrying.state.units[id],'all durable work/cargo/path fields recover');
    for(const seat of [0,1]) {
      const actual=r.snapshot(seat),expected=structuredClone(views[seat]);
      for(const row of expected.units)if(row[5]==='worker'&&Object.hasOwn(row,17))row[17]=null;
      assert.deepEqual(actual,expected,'seat disclosure only clears transient work receipts on restore');
    }
    trackLeg(r,u,()=>r.food[team]===110);
    assert.equal(u.gatherPhase,'to-node');assert.equal(u.path.length,1,'automatic resumption is direct');
    trackLeg(r,u,()=>u.gatherPhase==='gathering');
    until(r,()=>u.cargo>.5,'real partial Food');command(r,u,{type:'stop'});
    const stopped=r.checkpoint(),cargo=u.cargo;
    command(r,u,{type:'returnCargo'});assert.equal(u.path.length,1,'explicit Return is direct');
    const returnGoal=u.path.at(-1);
    r.restore(stopped);u=r.units[id];command(r,u,{type:'move',...r.point(returnGoal)});
    assert.equal(u.path.length,1);assert.equal(u.path.at(-1),returnGoal,'same legal endpoint as manual control');
    r.restore(stopped);u=r.units[id];command(r,u,{type:'returnCargo'});
    trackLeg(r,u,()=>u.cargo===0);
    assert.ok(Math.abs(r.food[team]-110-cargo)<1e-8);assert.equal(u.gatherNodeId,null);
    const stock=r.resources.get('food').stock;
    assert.ok(Math.abs(stock+r.food.reduce((sum,v)=>sum+v-100,0)-24)<1e-7,'finite stock and deposits conserved');
  } finally {await f.dispose();}
});

test('flat reduction keeps the selected multi-goal endpoint, fractional safety, weighted detours and input identity',()=>{
  const width=8,levels=new Uint8Array(64),path=[17,25,33,41,49,57,58,59,60];
  const before=path.slice();
  assert.deepEqual(shortcutFlatUnitPath(path,1.5,1.5,width,levels,()=>true,.15),[60]);
  assert.deepEqual(path,before,'shared flow path is not mutated');
  assert.equal(shortcutFlatUnitPath(path,1.95,1.05,width,levels,c=>c!==10,.15),path,'real fractional segment cannot borrow cell-center clearance');
  levels[26]=1;
  assert.equal(shortcutFlatUnitPath(path,1.5,1.5,width,levels,()=>true,.15),path,'nonflat route and its weighted choice are preserved');
  for(const short of [[],[60]])assert.equal(shortcutFlatUnitPath(short,1,1,width,levels,()=>true),short);
});

test('1,000 assignees add only bounded segment checks without changing the shared flow path',t=>{
  const width=128,levels=new Uint8Array(width*width),goal=90*width+100;
  const path=[...Array.from({length:80},(_,i)=>(11+i)*width+20),
    ...Array.from({length:80},(_,i)=>90*width+21+i)];
  const before=path.slice();let visits=0;
  for(let index=0;index<1000;index++) {
    assert.deepEqual(shortcutFlatUnitPath(path,20.1+index%8/10,10.1+index%7/10,width,levels,
      ()=>{visits++;return true;},.15),[goal]);
  }
  assert.deepEqual(path,before);
  assert.ok(visits<1000*3*(width+width),'bounded supercover work rather than a per-assignee map search');
  t.diagnostic(JSON.stringify({assignees:1000,supercoverVisits:visits,originalWaypoints:path.length,reducedWaypoints:1}));
});

for(const team of [0,1])test(`seat ${team}: Gather follows eight direct headings from a fractional position`,async()=>{
  const f=await createPathingReplayFixture(map),r=f.replay;
  try {
    for(const [x,z] of [[11.5,8.5],[-12.5,-8.5],[8.5,11.5],[-8.5,-12.5],
      [11.5,-12.5],[-12.5,11.5],[11.5,-.5],[-.5,11.5]]) {
      const scene={...map,resourceNodes:[{...map.resourceNodes[0],x,z}]};r.prepare(scene);
      const u=r.units.find(u=>u.team===team&&u.kind==='worker');
      Object.assign(u,{x:-.27,z:-.19});r.step();command(r,u,{type:'gather',nodeId:'food'});
      assert.equal(u.path.length,1);trackLeg(r,u,()=>u.gatherPhase==='gathering');
      assert.equal(u.gatherNodeId,'food');assert.ok(Math.hypot(u.x-x,u.z-z)<=1.5);
    }
  } finally {await f.dispose();}
});

for(const terrain of ['stone','forest','slope','cliff','fractional-corner'])
test(`${terrain}: a Worker keeps its flow detour and all authoritative steps legal`,async()=>{
  const fractional=terrain==='fractional-corner';
  const scene={...map,resourceNodes:[{...map.resourceNodes[0],x:3.5,z:fractional?7.5:3.5}],
    ...(['slope','cliff'].includes(terrain)
      ?{elevationPatches:[{column:80,row:79,width:1,height:1,level:terrain==='slope'?1:2}]}
      :{obstacles:[{column:80,row:79,width:1,height:1,material:terrain==='forest'?'forest':'stone'}]})};
  const f=await createPathingReplayFixture(scene,{traceLandSteps:true}),r=f.replay;
  try {
    const u=r.units.find(u=>u.team===0&&u.kind==='worker');
    Object.assign(u,{x:fractional?-.05:-.5,z:fractional?-.95:-.5});r.step();
    command(r,u,{type:'gather',nodeId:'food'});assert.ok(u.path.length>1,'unsafe direct segment retains the original flow path');
    const revision=u.orderRevision;
    for(let tick=0;tick<1000&&u.gatherPhase!=='gathering';tick++) {
      const before=r.cell(u.x,u.z);r.step();checkWorkerSteps(r,u.id);
      assert.ok(canTraverseUnitStep(before,r.cell(u.x,u.z),scene.width,r.levels,r.isWalkable));
    }
    assert.equal(u.gatherPhase,'gathering');assert.equal(u.orderRevision,revision+1,'only the existing arrival transition advances the revision');
  } finally {await f.dispose();}
});

test('paid wall admission repairs an active Worker shortcut while keeping its resource job',async()=>{
  const f=await createPathingReplayFixture(map,{traceLandSteps:true}),r=f.replay;
  try {
    const [u,builder]=r.units.filter(u=>u.team===0&&u.kind==='worker');
    Object.assign(u,{x:-8.27,z:-9.19});r.step();command(r,u,{type:'gather',nodeId:'food'});
    assert.equal(u.path.length,1);const intent=structuredClone(u.workIntent);
    command(r,builder,{type:'build',buildingType:'palisade-wall',x:.5,z:-.5});
    assert.ok(u.path.length>1,'new paid footprint across the segment reroutes the Worker');
    assert.deepEqual(u.workIntent,intent);assert.equal(u.gatherNodeId,'food');
    for(let tick=0;tick<1500&&u.gatherPhase!=='gathering';tick++) {
      const before=r.cell(u.x,u.z);r.step();checkWorkerSteps(r,u.id);
      assert.ok(canTraverseUnitStep(before,r.cell(u.x,u.z),map.width,r.levels,r.isWalkable));
    }
    assert.equal(u.gatherPhase,'gathering');until(r,()=>u.cargo>0,'productive harvest after reroute');
    assert.deepEqual(u.workIntent,intent);
  } finally {await f.dispose();}
});

for(const team of [0,1])test(`seat ${team}: forest access keeps the actual selected endpoint rather than the first field goal`,async()=>{
  const scene={...map,resourceNodes:[],obstacles:[{column:93,row:91,width:2,height:1,material:'forest'}]};
  const f=await createPathingReplayFixture(scene,{traceLandSteps:true}),r=f.replay;
  try {
    const u=r.units.find(u=>u.team===team&&u.kind==='worker');
    Object.assign(u,{x:25.27,z:24.19});r.step();const cell=91*160+93,target=cell+1;
    command(r,u,{type:'gather',forestCell:cell});
    assert.equal(u.path.length,1);assert.equal(u.path.at(-1),u.moveGoalCell,'recorded goal follows the selected multi-goal tail');
    assert.notEqual(u.moveGoalCell,90*160+93,'selected endpoint differs from the first forest access goal');
    const endpoint=u.path.at(-1),intent=structuredClone(u.workIntent);
    trackLeg(r,u,()=>u.gatherPhase==='gathering');
    assert.equal(u.gatherForestCell,target,'closest reachable group tree is the execution target');assert.deepEqual(u.workIntent,intent);
    assert.ok(Math.abs(endpoint%160-94)<=1&&Math.abs(Math.floor(endpoint/160)-91)<=1);
    until(r,()=>u.cargo>=10&&u.gatherPhase==='to-base','actual forest cargo starts return');
    assert.equal(u.cargoType,'wood');
    const homeGoal=r.point(u.path.at(-1));
    const straightHome=canTraverseFlatUnitSegment(u.x+80,u.z+80,homeGoal.x+80,homeGoal.z+80,
      160,r.levels,r.isWalkable,2.6/30);
    if(straightHome)assert.equal(u.path.length,1);
    else assert.ok(u.path.length>1,'remaining tree blocks a straight home leg; retain safe cardinal route');
    until(r,()=>r.wood[team]===110,'actual forest cargo deposits');
    assert.equal(u.gatherForestCell,cell,'group continuation returns to the remaining tree');assert.equal(u.gatherPhase,'to-node');
    assert.equal(u.path.length,1);assert.deepEqual(u.workIntent,intent);
  } finally {await f.dispose();}
});

for(const team of [0,1])test(`seat ${team}: paid Farm perimeter routing preserves building interaction and food`,async()=>{
  const scene={...map,resourceNodes:[]},f=await createPathingReplayFixture(scene,{traceLandSteps:true}),r=f.replay;
  try {
    const u=r.units.find(u=>u.team===team&&u.kind==='worker');
    command(r,u,{type:'build',buildingType:'farm',x:13.5,z:11.5});
    until(r,()=>r.buildings.some(b=>b.type==='farm'&&b.complete),'paid Farm completes');
    const farm=r.buildings.find(b=>b.type==='farm'&&b.complete),wood=r.wood[team];
    Object.assign(u,{x:25.27,z:24.19});r.step();
    command(r,u,{type:'gather',nodeId:`farm:${farm.id}`});
    assert.equal(u.path.length,1);assert.equal(u.path.at(-1),u.moveGoalCell,'selected perimeter endpoint is recorded');
    trackLeg(r,u,()=>u.gatherPhase==='gathering');
    until(r,()=>r.food[team]===110,'real paid Farm harvest and deposit');
    assert.equal(r.wood[team],wood,'routing never changes the paid build cost');
    assert.equal(u.gatherNodeId,`farm:${farm.id}`);assert.equal(u.gatherPhase,'to-node');
  } finally {await f.dispose();}
});

const clearanceMap = { id:'worker-economy-clearance',name:'WORKER ECONOMY CLEARANCE',width:64,height:48,
  terrainSeed:881,fogOfWar:false,startingArmySize:16,startingResources:{food:500,wood:500},
  spawnPoints:[{team:0,x:-20,z:-16},{team:1,x:20,z:16}],
  resourceNodes:[{id:'food',type:'food',x:4.5,z:.5,stock:24}],
  obstacles:[{column:33,row:25,width:1,height:1,material:'stone'}],triggers:[],scenarioEvents:[] };
function quietEconomy(r) {
  for(const team of [0,1]) {
    const actors=r.units.filter(u=>u.team===team);
    r.order(team,{type:'stop',ids:actors.map(u=>u.id)});
    r.order(team,{type:'setStance',stance:'noAttack',ids:actors.filter(u=>u.kind!=='worker').map(u=>u.id)});
  }
}
function physicalEconomyJourney(r,scene,id) {
  const initial=r.units[id],generation=initial.generation,hp=initial.hp;
  const parked=r.units.filter(u=>u.kind==='worker'&&u.id!==id).map(u=>({id:u.id,x:u.x,z:u.z,cargo:u.cargo}));
  let observed=0;
  const step=()=>{
    r.step();
    for(const s of r.landSteps.filter(s=>s.id===id)) {
      observed++;
      assert.ok(canTraverseUnitStep(r.cell(s.from.x,s.from.z),r.cell(s.to.x,s.to.z),scene.width,r.levels,r.isWalkable));
      assert.ok(canTraverseStaticBodySegment(s.from,s.to,.18,scene.width,scene.height,r.isWalkable),
        `Worker ${s.reason} footprint: ${JSON.stringify(s.from)} -> ${JSON.stringify(s.to)}`);
    }
    assert.equal(r.units[id].generation,generation);assert.equal(r.units[id].hp,hp);
    for(const saved of parked) {
      const u=r.units[saved.id];assert.deepEqual({id:u.id,x:u.x,z:u.z,cargo:u.cargo},saved,'unselected Workers remain unchanged');
    }
  };
  const until=(predicate,label,limit=1800)=>{
    for(let tick=0;tick<=limit;tick++) {
      if(predicate(r.units[id]))return tick;
      if(tick<limit)step();
    }
    assert.fail(`${label}: ${JSON.stringify({x:r.units[id].x,z:r.units[id].z,phase:r.units[id].gatherPhase,revision:r.units[id].orderRevision})}`);
  };
  return {step,until,get observed(){return observed;}};
}
for(const team of [0,1])for(const recovery of ['live','approaching','carrying'])
test(`seat ${team}: actual economy footprint survives ${recovery} Gather, full drop-off and resumption`,async(t)=>{
  const f=await createPathingReplayFixture(clearanceMap,{traceLandSteps:true}),r=f.replay;
  try {
    quietEconomy(r);let u=r.units.find(u=>u.team===team&&u.kind==='worker');const id=u.id;
    const journey=physicalEconomyJourney(r,clearanceMap,id);
    command(r,u,{type:'move',x:.79,z:.95});journey.until(u=>u.x===.79&&u.z===.95,'command-only fractional setup');
    command(r,u,{type:'gather',nodeId:'food'});const revision=u.orderRevision,selected=u.moveGoalCell;
    assert.equal(selected,r.cell(4.5,.5));assert.equal(u.path.at(-1),selected);
    const recover=()=>{
      const saved=r.checkpoint(),bytes=JSON.stringify(saved),record=structuredClone(saved.state.units[id]);
      assert.ok(r.validate(structuredClone(saved)));r.restore(saved);u=r.units[id];
      assert.equal(JSON.stringify(saved),bytes,'recovery does not edit its supplied checkpoint');
      assert.deepEqual(u,record,'durable Worker fields recover exactly');
    };
    if(recovery==='approaching'){for(let tick=0;tick<4;tick++)journey.step();recover();}
    const approachTicks=journey.until(u=>u.gatherPhase==='gathering','safe Gather approach',90);
    assert.equal(u.orderRevision,revision+1,'the approach has only its normal productive-arrival transition');
    journey.until(u=>u.cargo===10&&u.gatherPhase==='to-base','real full cargo',600);
    if(recovery==='carrying')recover();
    const returnTicks=journey.until(()=>r.food[team]===510,'one full-load credit');
    assert.equal(u.cargo,0);assert.equal(u.gatherPhase,'to-node');assert.equal(u.gatherNodeId,'food');
    journey.until(u=>u.gatherPhase==='gathering'&&u.cargo>0,'fresh productive resumption');
    assert.equal(r.food[team],510,'the first deposit is credited once');
    assert.ok(Math.abs(r.resources.get('food').stock+r.food.reduce((sum,bank)=>sum+bank-500,0)
      +r.units.reduce((sum,u)=>sum+(u.cargoType==='food'?u.cargo:0),0)-24)<1e-7);
    assert.ok(journey.observed>20);t.diagnostic(`safe approach ${approachTicks} ticks; full return ${returnTicks} ticks; observed substeps ${journey.observed}`);
  } finally {await f.dispose();}
});

for(const team of [0,1])for(const type of ['food','wood','stone'])
test(`seat ${team} ${type}: real typed cargo survives Stop/replacement and node-free Return with queued recovery`,async()=>{
  const scene={...clearanceMap,id:`typed-worker-clearance-${type}`,
    ...(type==='stone'?{economyProfileId:STONE_ECONOMY_PROFILE_ID}:{}),
    resourceNodes:[{id:type,type,x:4.5,z:.5,stock:24}]};
  const f=await createPathingReplayFixture(scene,{traceLandSteps:true}),r=f.replay;
  try {
    quietEconomy(r);let u=r.units.find(u=>u.team===team&&u.kind==='worker');const id=u.id;
    const journey=physicalEconomyJourney(r,scene,id);
    const bank=()=>type==='food'?r.food[team]:type==='wood'?r.wood[team]:r.checkpoint().state.teamStone[team];
    const initialBank=bank();
    command(r,u,{type:'move',x:.79,z:.95});journey.until(u=>u.x===.79&&u.z===.95,'fractional command setup');
    command(r,u,{type:'gather',nodeId:type});journey.until(u=>u.cargo>=1.2,'real typed harvest',120);
    const cargo=u.cargo;assert.equal(u.cargoType,type);assert.equal(workerEconomyBodyRadius(u),.18);
    command(r,u,{type:'stop'});assert.equal(workerEconomyBodyRadius(u),0);assert.equal(u.cargo,cargo);
    command(r,u,{type:'move',x:6.31,z:-.77});command(r,u,{type:'move',x:7.31,z:-.77,queue:true});
    assert.equal(workerEconomyBodyRadius(u),0);for(let tick=0;tick<4;tick++)journey.step();
    assert.equal(u.gatherPhase,'');assert.equal(u.gatherNodeId,null);assert.equal(u.cargo,cargo);
    const before=structuredClone(u);
    r.order(1-team,{type:'returnCargo',ids:[id],unitGenerations:[u.generation]});
    r.order(team,{type:'gather',ids:[id],unitGenerations:[u.generation+1],nodeId:type});
    assert.deepEqual(u,before,'foreign/stale commands preserve the current movement and cargo');
    command(r,u,{type:'returnCargo'});
    assert.equal(workerEconomyBodyRadius(u),.18);assert.equal(u.gatherNodeId,null);assert.equal(u.workIntent,null);
    assert.equal(u.queuedWaypoints.length,0,'Return supersedes the replaced manual queue');
    const selected=u.moveGoalCell;assert.equal(u.path.at(-1),selected);
    command(r,u,{type:'move',x:7.31,z:-.77,queue:true});
    const saved=r.checkpoint(),bytes=JSON.stringify(saved),record=structuredClone(saved.state.units[id]);
    assert.ok(r.validate(structuredClone(saved)));r.restore(saved);u=r.units[id];
    assert.equal(JSON.stringify(saved),bytes);assert.deepEqual(u,record);
    journey.until(()=>Math.abs(bank()-initialBank-cargo)<1e-9,'explicit Return credit');
    assert.equal(u.cargo,0);assert.equal(u.gatherPhase,'');assert.equal(workerEconomyBodyRadius(u),0);
    journey.until(u=>u.x===7.31&&u.z===-.77&&!u.queuedWaypoints.length,'queued Move after deposit');
    for(let tick=0;tick<60;tick++)journey.step();
    assert.equal(bank(),initialBank+cargo);assert.equal(u.gatherPhase,'');assert.equal(u.gatherNodeId,null);
    assert.ok(Math.abs(r.resources.get(type).stock+bank()-initialBank
      +r.units.reduce((sum,u)=>sum+(u.cargoType===type?u.cargo:0),0)-24)<1e-7,'typed stock, bank and cargo conserve');
  } finally {await f.dispose();}
});

for(const team of [0,1])test(`seat ${team}: productive gathering separation beside stone keeps every Worker footprint clear`,async()=>{
  const scene={...clearanceMap,id:'productive-worker-separation',resourceNodes:[{id:'food',type:'food',x:.5,z:1.5,stock:96}]};
  const f=await createPathingReplayFixture(scene,{traceLandSteps:true}),r=f.replay;
  try {
    quietEconomy(r);const actors=r.units.filter(u=>u.team===team&&u.kind==='worker'),ids=new Set(actors.map(u=>u.id));
    const points=[[.65,1.5],[.25,1.5],[.35,1.4],[.4,1.6]];
    const step=()=>{
      r.step();for(const s of r.landSteps.filter(s=>ids.has(s.id)))
        assert.ok(canTraverseStaticBodySegment(s.from,s.to,.18,scene.width,scene.height,r.isWalkable),
          `${s.reason}: ${JSON.stringify(s.from)} -> ${JSON.stringify(s.to)}`);
    };
    for(const [i,u] of actors.entries())command(r,u,{type:'move',x:points[i][0],z:points[i][1]});
    for(let tick=0;tick<1800&&!actors.every((u,i)=>u.x===points[i][0]&&u.z===points[i][1]);tick++)step();
    assert.ok(actors.every((u,i)=>u.x===points[i][0]&&u.z===points[i][1]),'actual setup commands finish');
    for(const u of actors)command(r,u,{type:'gather',nodeId:'food'});
    let separations=0;
    for(let tick=0;tick<60;tick++) {
      step();separations+=r.landSteps.filter(s=>ids.has(s.id)&&s.reason==='interaction-separation').length;
    }
    assert.ok(separations>0,'stationary productive separation is actually observed');
    assert.ok(actors.every(u=>u.gatherPhase==='gathering'&&u.cargo>0&&workerEconomyBodyRadius(u)===.18));
    assert.ok(r.snapshot(team).units.filter(row=>ids.has(row[0])).every(row=>row[17]==='gather-food'),
      'only real positive productive receipts remain visible');
    assert.ok(Math.abs(r.resources.get('food').stock+actors.reduce((sum,u)=>sum+u.cargo,0)-96)<1e-7);
  } finally {await f.dispose();}
});

for(const team of [0,1])test(`seat ${team}: inherited Worker overlap escapes monotonically without replacing the resource intent`,async()=>{
  const f=await createPathingReplayFixture(clearanceMap,{traceLandSteps:true}),r=f.replay;
  try {
    quietEconomy(r);let u=r.units.find(u=>u.team===team&&u.kind==='worker');const id=u.id;
    // Explicit legacy-pose fixture, not a command-only placement witness.
    const saved=r.checkpoint();Object.assign(saved.state.units[id],{x:.9,z:1.5});
    assert.ok(r.validate(saved));r.restore(saved);u=r.units[id];
    command(r,u,{type:'gather',nodeId:'food'});const revision=u.orderRevision;let escapes=0;
    for(let tick=0;tick<90&&u.gatherPhase!=='gathering';tick++) {
      r.step();for(const s of r.landSteps.filter(s=>s.id===id)) {
        assert.ok(canTraverseStaticBodySegment(s.from,s.to,.18,64,48,r.isWalkable,{allowEscape:true}));
        if(!canTraverseStaticBodySegment(s.from,s.to,.18,64,48,r.isWalkable))escapes++;
      }
    }
    assert.ok(escapes>0);assert.equal(u.gatherPhase,'gathering');assert.equal(u.gatherNodeId,'food');
    assert.equal(u.orderRevision,revision+1,'only the productive-arrival transition changes the revision');
    assert.ok(canTraverseStaticBodySegment(u,u,.18,64,48,r.isWalkable));
  } finally {await f.dispose();}
});
