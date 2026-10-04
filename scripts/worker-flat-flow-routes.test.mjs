import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { shortcutFlatUnitPath } from '../src/unit-path-line.mjs';

process.env.RTS_MAP='maps/open-field.json';process.env.RTS_GAME_MODE='pvp';process.env.RTS_PREGAME='0';
delete process.env.RTS_MATCH_STATE_PATH;

const map = { id:'worker-flat-flow', name:'WORKER FLAT FLOW', width:160, height:160,
  fogOfWar:false, startingArmySize:8, startingResources:{ food:100, wood:100 },
  spawnPoints:[{team:0,x:-32,z:-24},{team:1,x:32,z:24}],
  resourceNodes:[{id:'food',type:'food',x:13.5,z:11.5,stock:24}],
  obstacles:[],triggers:[],scenarioEvents:[] };
function command(r,u,extra) {
  const notices = r.order(u.team,{ids:[u.id],unitGenerations:[u.generation],...extra});
  r.drain(); assert.ok(notices.some(n=>/ORDER/.test(n.message)),JSON.stringify(notices));
}
function until(r,predicate,label,limit=5000) {
  for(let tick=0;tick<limit;tick++){if(predicate())return;r.step();}
  assert.fail(`Timeout: ${label}`);
}
function trackLeg(r,u,finish) {
  const start={x:u.x,z:u.z},goal=r.point(u.path.at(-1)); let samples=0;
  const dx=goal.x-start.x,dz=goal.z-start.z,length=Math.hypot(dx,dz);
  for(let tick=0;tick<5000&&!finish();tick++) {
    const before={x:u.x,z:u.z,cell:r.cell(u.x,u.z)};r.step();samples++;
    assert.ok(canTraverseUnitStep(before.cell,r.cell(u.x,u.z),map.width,r.levels,r.isWalkable),'legal authoritative step');
    // Deposit/resumption may switch targets and move in the same authoritative tick.
    if(!finish())assert.ok(Math.abs((u.x-start.x)*dz-(u.z-start.z)*dx)/length<1e-7,JSON.stringify({ label:'work trajectory follows its direct selected leg', start,goal,before,after:{x:u.x,z:u.z,phase:u.gatherPhase,cargo:u.cargo,path:u.path},bank:r.food[u.team],tick,cross:Math.abs((u.x-start.x)*dz-(u.z-start.z)*dx)/length }));
  }
  assert.ok(finish(),'direct work leg finishes');
  assert.ok(samples>3);
}
for(const team of [0,1])test(`seat ${team}: manual, gather, drop-off, Return and resumed work use direct flat legs with recovery`,async()=>{
  const f=await createPathingReplayFixture(map),r=f.replay;
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

test('1,000 assignees add only bounded segment checks without changing the shared flow path',()=>{
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
  const f=await createPathingReplayFixture(scene),r=f.replay;
  try {
    const u=r.units.find(u=>u.team===0&&u.kind==='worker');
    Object.assign(u,{x:fractional?-.05:-.5,z:fractional?-.95:-.5});r.step();
    command(r,u,{type:'gather',nodeId:'food'});assert.ok(u.path.length>1,'unsafe direct segment retains the original flow path');
    const revision=u.orderRevision;
    for(let tick=0;tick<1000&&u.gatherPhase!=='gathering';tick++) {
      const before=r.cell(u.x,u.z);r.step();
      assert.ok(canTraverseUnitStep(before,r.cell(u.x,u.z),scene.width,r.levels,r.isWalkable));
    }
    assert.equal(u.gatherPhase,'gathering');assert.equal(u.orderRevision,revision+1,'only the existing arrival transition advances the revision');
  } finally {await f.dispose();}
});

for(const team of [0,1])test(`seat ${team}: forest access keeps the actual selected endpoint rather than the first field goal`,async()=>{
  const scene={...map,resourceNodes:[],obstacles:[{column:93,row:91,width:2,height:1,material:'forest'}]};
  const f=await createPathingReplayFixture(scene),r=f.replay;
  try {
    const u=r.units.find(u=>u.team===team&&u.kind==='worker');
    Object.assign(u,{x:25.27,z:24.19});r.step();const cell=91*160+93;
    command(r,u,{type:'gather',forestCell:cell});
    assert.equal(u.path.length,1);assert.notEqual(u.path.at(-1),u.moveGoalCell,'flow reaches a different member of the goal set');
    const endpoint=u.path.at(-1),intent=structuredClone(u.workIntent);
    trackLeg(r,u,()=>u.gatherPhase==='gathering');
    assert.equal(u.gatherForestCell,cell);assert.deepEqual(u.workIntent,intent);
    assert.ok(Math.abs(endpoint%160-93)<=1&&Math.abs(Math.floor(endpoint/160)-91)<=1);
    until(r,()=>u.cargo>=10&&u.gatherPhase==='to-base','actual forest cargo starts return');
    assert.equal(u.cargoType,'wood');assert.equal(u.path.length,1);
    until(r,()=>r.wood[team]===110,'actual forest cargo deposits');
    assert.equal(u.gatherForestCell,cell+1,'the existing finite-stock continuation selects the remaining tree');assert.equal(u.gatherPhase,'to-node');
    assert.equal(u.path.length,1);assert.deepEqual(u.workIntent,intent);
  } finally {await f.dispose();}
});

for(const team of [0,1])test(`seat ${team}: paid Farm perimeter routing preserves building interaction and food`,async()=>{
  const scene={...map,resourceNodes:[]},f=await createPathingReplayFixture(scene),r=f.replay;
  try {
    const u=r.units.find(u=>u.team===team&&u.kind==='worker');
    command(r,u,{type:'build',buildingType:'farm',x:13.5,z:11.5});
    until(r,()=>r.buildings.some(b=>b.type==='farm'&&b.complete),'paid Farm completes');
    const farm=r.buildings.find(b=>b.type==='farm'&&b.complete),wood=r.wood[team];
    Object.assign(u,{x:25.27,z:24.19});r.step();
    command(r,u,{type:'gather',nodeId:`farm:${farm.id}`});
    assert.equal(u.path.length,1);assert.notEqual(u.path.at(-1),u.moveGoalCell,'selected perimeter endpoint is preserved');
    trackLeg(r,u,()=>u.gatherPhase==='gathering');
    until(r,()=>r.food[team]===110,'real paid Farm harvest and deposit');
    assert.equal(r.wood[team],wood,'routing never changes the paid build cost');
    assert.equal(u.gatherNodeId,`farm:${farm.id}`);assert.equal(u.gatherPhase,'to-node');
  } finally {await f.dispose();}
});
