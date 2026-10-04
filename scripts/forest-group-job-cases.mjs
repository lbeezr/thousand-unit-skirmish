import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { forestGatherGroups, visibleForestCandidates } from '../src/forest-gather-group.mjs';
import { createForestGatherWorkIntent, createGatherWorkIntent, validWorkIntent } from '../src/work-intent.mjs';
const stateOf = r => r.checkpoint().state;
const fog = (s,c) => Buffer.from(s.visibility.data,'base64')[c>>2] >> ((c&3)*2) & 3;
const world = (c,m) => ({ x:c%m.width-m.width/2+.5, z:Math.floor(c/m.width)-m.height/2+.5 });
function forestMask(m) {
  const mask = new Uint8Array(m.width*m.height);
  for(const o of m.obstacles) if(o.material==='forest') for(let z=o.row;z<o.row+o.height;z++) for(let x=o.column;x<o.column+o.width;x++) mask[z*m.width+x]=1;
  return mask;
}
async function order(r,team,command,pattern=/GATHER ORDER/) {
  const notices=await r.order(team,command);r.drain();assert.ok(notices.some(n=>pattern.test(n.message)),JSON.stringify(notices));
}
function conserved(s,m,initialWood=0) {
  const drawn=s.forestStocks.reduce((n,[,stock])=>n+6-stock,0);
  const credited=s.teamWood.reduce((n,bank)=>n+bank-m.startingResources.wood,0);
  const cargo=s.units.filter(u=>u.cargoType==='wood').reduce((n,u)=>n+u.cargo,0);
  assert.ok(Math.abs(drawn+initialWood-credited-cargo)<1e-3,'forest stock = both banks + typed cargo');
}
function advance(r,m,predicate,label,limit=6000,initialWood=0) {
  for(let t=0;t<limit;t++) {const s=stateOf(r); if(t%30===0)conserved(s,m,initialWood);if(predicate(s))return s;r.step();}
  assert.fail(`Timed out ${label}: ${JSON.stringify(stateOf(r).units.filter(u=>u.workIntent).map(u=>({id:u.id,phase:u.gatherPhase,target:u.gatherForestCell,cargo:u.cargo,x:u.x,z:u.z,path:u.path})))}`);
}
const groupMap = () => ({ id:'forest-group-jobs',name:'Forest group jobs',width:64,height:64,
  startingArmySize:8,startingResources:{wood:0,food:0},fogOfWar:true,
  spawnPoints:[{team:0,x:-22,z:0},{team:1,x:22,z:0}],
  obstacles:[{column:23,row:24,width:3,height:18,material:'forest'},
    {column:38,row:24,width:3,height:18,material:'forest'},
    {column:23,row:45,width:3,height:2,material:'forest'}],
  resourceNodes:[{id:'ordinary-wood',type:'wood',x:-18.5,z:5.5,stock:30}],triggers:[],scenarioEvents:[] });

test('authored forest grouping is bounded at map edges, excludes diagonal-only neighbors, and ignores live clearing',()=>{
  const mask=Uint8Array.from([1,0,0,1, 1,0,1,1, 0,1,0,0]);
  const g=forestGatherGroups(mask,4);
  assert.equal(g.byCell[0],g.byCell[4]);assert.equal(g.byCell[3],g.byCell[7]);assert.equal(g.byCell[6],g.byCell[7]);
  assert.notEqual(g.byCell[4],g.byCell[9],'diagonal-only authored trees remain separate');
  assert.notEqual(g.byCell[3],g.byCell[4],'forest cells at opposite row edges never wrap');
  assert.equal(g.groups.flat().length,6);mask.fill(0);assert.equal(g.groups.flat().length,6,'derived membership owns its cells');
});
test('candidate ordering never reads hidden stock and soft reservations retain a finite deterministic nearest choice',()=>{
  const seen=[];
  const candidates=visibleForestCandidates([0,1,2],{x:0,z:0},{visible:c=>c!==1,
    remaining:c=>{assert.notEqual(c,1);seen.push(c);return 6;},point:c=>({x:c,z:0}),reservations:new Map([[0,2]])});
  assert.deepEqual(candidates,[2,0]);assert.deepEqual(seen,[0,2]);
});
test('forest discriminator validates exact authored anchors; plain Wood retains the legacy radius policy',()=>{
  const m=groupMap(),u={kind:'worker',movementDomain:'land',hp:100,generation:3};
  const intent=createForestGatherWorkIntent(3,world(24*64+23,m));assert.ok(validWorkIntent(intent,u,m));
  for(const patch of [{resource:'food'},{resource:'stone'},{sourceKind:'future-forest'},{generation:4},
    {anchor:{x:0,z:0}},{anchor:{x:-8.5,z:20.5}},{radius:100}]) assert.equal(validWorkIntent({...intent,...patch},u,m),false);
  assert.ok(validWorkIntent(createGatherWorkIntent(3,{x:0,z:0}),u,m));
});
for(const team of [0,1]) test(`seat ${team}: deep forest click scopes reachable frontier, returns from depot, survives restore and cancels`,async()=>{
  const m=groupMap(),f=await createPveHeadlessFixture(m,{matchModeId:'authored',matchModeVersion:1}),r=f.replay;
  const ids=[team*4,team*4+1],anchor=32*64+(team?39:24),g=forestGatherGroups(forestMask(m),m.width);
  try {
    const untouched=stateOf(r).units.filter(u=>!ids.includes(u.id));
    assert.notEqual(fog(r.observe(team),anchor),2,'deep clicked tree is not live disclosed');
    await order(r,team,{type:'move',ids,x:team?10.5:-10.5,z:.5},/MOVE ORDER/);
    advance(r,m,s=>ids.every(id=>s.units[id].pathIndex>=s.units[id].path.length),'group approach');
    const before=r.observe(team);await order(r,team,{type:'gather',ids,forestCell:anchor});
    let s=stateOf(r);
    assert.ok(ids.every(id=>s.units[id].gatherForestCell!==anchor&&fog(before,s.units[id].gatherForestCell)===2));
    assert.equal(new Set(ids.map(id=>s.units[id].gatherForestCell)).size,2,'selected Workers spread across nearby frontiers');
    const intents=ids.map(id=>structuredClone(s.units[id].workIntent));
    advance(r,m,s=>ids.every(id=>s.units[id].cargo>0),'initial work');
    const saved=r.checkpoint(),views=[r.observe(0),r.observe(1)];r.restore(saved);
    for(const seat of [0,1])assertRecoveredWorkerObservation(r.observe(seat),views[seat]);
    s=advance(r,m,s=>s.teamWood[team]>=60,'at least six full deliveries',12000);
    for(const id of ids) {assert.deepEqual(s.units[id].workIntent,intents[id-ids[0]]);assert.equal(g.byCell[s.units[id].gatherForestCell],g.byCell[anchor]);}
    assert.equal(s.resourceNodes.find(n=>n.id==='ordinary-wood').stock,30,'forest intent excludes ordinary nodes');
    assert.ok(s.forestStocks.every(([c])=>g.byCell[c]===g.byCell[anchor]),'other groves remain untouched');
    assert.deepEqual(s.units.filter(u=>!ids.includes(u.id)),untouched,'unselected actors keep their whole state');
    const owned=structuredClone(s.units[ids[0]]);
    await order(r,1-team,{type:'stop',ids:[ids[0]]},/NO UNITS|REJECTED|NO VALID/);
    assert.deepEqual(stateOf(r).units[ids[0]],owned,'foreign cancellation does not steal jobs');
    await order(r,team,{type:'stop',ids},/STOP ORDER/);const stopped=stateOf(r);
    for(let t=0;t<90;t++)r.step();assert.deepEqual(stateOf(r).forestStocks,stopped.forestStocks);
    assert.ok(ids.every(id=>stateOf(r).units[id].workIntent===null));conserved(stateOf(r),m);
  }finally{await f.dispose();}
});
for(const count of [1,2,4]) test(`canonical Terraced Vale Tiny: both seats ${count} selected Workers sustain repeated natural forest cycles`,async()=>{
  const m=JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json',import.meta.url),'utf8'));
  const f=await createPveHeadlessFixture(m,{matchModeId:'skirmish',matchModeVersion:1}),r=f.replay;
  const mask=forestMask(m),g=forestGatherGroups(mask,m.width),cells=Array.from(mask.keys()).filter(c=>mask[c]);
  const ids=[0,1].map(team=>r.observe(team).units.filter(u=>u[1]===team&&u[5]==='worker').slice(0,count).map(u=>u[0]));
  try {
    const untouched=stateOf(r).units.filter(u=>u.kind==='worker'&&!ids.flat().includes(u.id));
    for(const team of [0,1]) {
      const w=stateOf(r).units[ids[team][0]];
      const edge=cells.flatMap(cell=>[-m.width,-1,1,m.width].map(d=>cell+d).filter(c=>c>=0&&c<mask.length&&!mask[c]).map(access=>({cell,point:world(access,m)})))
        .sort((a,b)=>Math.hypot(a.point.x-w.x,a.point.z-w.z)-Math.hypot(b.point.x-w.x,b.point.z-w.z)||a.cell-b.cell)[0];
      await order(r,team,{type:'move',ids:ids[team],...edge.point},/MOVE ORDER/);
    }
    for(let t=0;t<1800;t++)r.step();
    const anchors=[];
    for(const team of [0,1]) {
      const view=r.observe(team),w=stateOf(r).units[ids[team][0]],candidates=cells.filter(c=>fog(view,c)===2)
        .sort((a,b)=>Math.hypot(world(a,m).x-w.x,world(a,m).z-w.z)-Math.hypot(world(b,m).x-w.x,world(b,m).z-w.z)||a-b);
      assert.ok(candidates.length);anchors[team]=candidates[0];
      await order(r,team,{type:'gather',ids:ids[team],forestCell:anchors[team]});
    }
    const deliveries=new Map(ids.flat().map(id=>[id,0])),lastCargo=new Map(deliveries);
    for(let t=0;t<15000;t++) {
      r.step();if(t%30)continue;const s=stateOf(r);conserved(s,m);
      for(const team of [0,1])for(const id of ids[team]) {
        const u=s.units[id];if(u.cargo===0&&(lastCargo.get(id)??0)>0)deliveries.set(id,deliveries.get(id)+1);lastCargo.set(id,u.cargo);
        assert.equal(u.workIntent?.sourceKind,'forest-group',`Worker ${id} retains its job at tick ${s.tickNumber}: ${JSON.stringify(u)}`);
        assert.equal(g.byCell[u.gatherForestCell],g.byCell[anchors[team]],'never leaves the ordered forest');
      }
    }
    const final=stateOf(r);assert.ok([...deliveries.values()].every(n=>n>=3),JSON.stringify([...deliveries]));
    assert.deepEqual(final.units.filter(u=>u.kind==='worker'&&!ids.flat().includes(u.id)),untouched);
    assert.ok(final.forestStocks.filter(([,s])=>s===0).length>10);
    console.log(JSON.stringify({scope:'canonical-source-simulation',mapId:m.id,count,bothSeats:true,deliveries:[...deliveries],wood:final.teamWood,screenshots:0}));
  }finally{await f.dispose();}
});

for(const team of [0,1]) test(`seat ${team}: finite group returns partial cargo once without reviving or crossing to nearby Wood`,async()=>{
  const m=groupMap();m.fogOfWar=false;
  const col=team?39:24,cell=32*64+col;m.obstacles=[{column:col,row:32,width:1,height:1,material:'forest'},
    {column:col,row:34,width:1,height:1,material:'forest'}];
  m.resourceNodes=[{id:'near-other-wood',type:'wood',...world(cell+1,m),stock:20}];
  const f=await createPveHeadlessFixture(m,{matchModeId:'authored',matchModeVersion:1}),r=f.replay,id=team*4;
  try {
    await order(r,team,{type:'gather',ids:[id],forestCell:cell});
    const done=advance(r,m,s=>s.units[id].cargo===0&&s.units[id].gatherPhase===''&&s.teamWood[team]>0,'single partial final deposit');
    assert.equal(done.teamWood[team],6);assert.equal(done.units[id].workIntent,null);
    assert.equal(done.resourceNodes[0].stock,20);assert.deepEqual(done.forestStocks,[[cell,0]]);
    const revision=done.units[id].orderRevision;for(let t=0;t<300;t++)r.step();
    assert.equal(stateOf(r).units[id].orderRevision,revision);assert.equal(stateOf(r).units[id].workIntent,null);conserved(stateOf(r),m);
  }finally{await f.dispose();}
});

test('hidden forest stocks do not alter selection or rejection; corrupt group targets reject restore atomically',async()=>{
  const m=groupMap(),f=await createPveHeadlessFixture(m,{matchModeId:'authored',matchModeVersion:1}),r=f.replay;
  try {
    await order(r,0,{type:'move',ids:[0],x:-10.5,z:.5},/MOVE ORDER/);
    advance(r,m,s=>s.units[0].pathIndex>=s.units[0].path.length,'visible group approach');
    const anchor=32*64+24,hidden=40*64+24,unknownGroup=45*64+24,seed=r.checkpoint();
    assert.notEqual(fog(r.observe(0),hidden),2);
    const outcomes=[];
    for(const cleared of [false,true]) {
      const cp=structuredClone(seed);if(cleared)cp.state.forestStocks=[[hidden,0],[unknownGroup,0]];r.restore(cp);
      const before=stateOf(r);
      const notices=await r.order(0,{type:'gather',ids:[0],forestCell:unknownGroup});r.drain();
      assert.ok(notices.some(n=>/GATHER REJECTED · NO REACHABLE VISIBLE FOREST TREES/.test(n.message)));
      assert.deepEqual(stateOf(r).units,before.units,'failed group order is atomic');
      await order(r,0,{type:'gather',ids:[0],forestCell:anchor});
      outcomes.push({target:stateOf(r).units[0].gatherForestCell,notices});
      assert.equal(r.observe(0).forestStocks.some(([c])=>c===hidden||c===unknownGroup),false);
      assert.equal(r.observe(0).units.some(u=>u[1]===1),false);
      assert.equal(r.observe(0).wood[1],null);
    }
    assert.deepEqual(outcomes[0],outcomes[1]);
    const good=r.checkpoint();
    for(const mutate of [u=>{u.gatherForestCell=unknownGroup;},u=>{u.gatherNodeId='ordinary-wood';u.gatherForestCell=-1;},
      u=>{u.workIntent.anchor={x:0,z:0};},u=>{u.workIntent.generation++;}]) {
      const bad=structuredClone(good),before=stateOf(r);mutate(bad.state.units[0]);
      assert.throws(()=>r.restore(bad),/forest target leaves|forest intent conflicts|invalid unit work state/);assert.deepEqual(stateOf(r),before);
    }
    await order(r,0,{type:'move',ids:[0],x:-15.5,z:-2.5},/MOVE ORDER/);
    assert.equal(stateOf(r).units[0].workIntent,null);
    await order(r,0,{type:'gather',ids:[0],forestCell:anchor});
    await order(r,0,{type:'gather',ids:[0],nodeId:'ordinary-wood'});assert.equal(stateOf(r).units[0].workIntent.sourceKind,undefined);
  }finally{await f.dispose();}
});

test('ordinary forest picker admits remembered crowns, rejects unknown/depleted crowns and spectators',async()=>{
 const vm=await import('node:vm'),main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const start=main.indexOf('function pickForestCellAt('),end=main.indexOf('\nfunction ',start+1);
 const c=vm.createContext({localTeam:0,forestTreeSlots:new Map([[1,{x:0,z:0}]]),latestForestStocks:new Map(),
  latestFogCells:[0,1],mapDefinition:{fogOfWar:true},renderer:{domElement:{getBoundingClientRect:()=>({width:100,height:100})}},
  groundHeight:()=>0,camera:{},screenPoint:{set(){return this;},project(){this.x=0;this.y=0;this.z=0;return this;}}});
 vm.runInContext(main.slice(start,end),c);assert.equal(c.pickForestCellAt(50,50),1);
 c.latestFogCells[1]=2;assert.equal(c.pickForestCellAt(50,50),1);
 c.latestFogCells[1]=0;assert.equal(c.pickForestCellAt(50,50),null);
 c.latestFogCells[1]=1;c.latestForestStocks.set(1,0);assert.equal(c.pickForestCellAt(50,50),null);
 c.latestForestStocks.clear();c.localTeam=null;assert.equal(c.pickForestCellAt(50,50),null);
});

for(const cargoType of ['wood','food']) test(`forest group preserves ${cargoType} cargo through initial delivery and cold restore`,async()=>{
 const m=groupMap();m.fogOfWar=false;m.obstacles=[{column:24,row:32,width:1,height:1,material:'forest'}];m.resourceNodes=[];
 const f=await createPveHeadlessFixture(m,{matchModeId:'authored',matchModeVersion:1}),r=f.replay;
 try {
  // Explicit trusted carried-stock setup isolates full/incompatible delivery.
  const seed=r.checkpoint(),initial=cargoType==='wood'?10:3;
  Object.assign(seed.state.units[0],{cargo:initial,cargoType});r.restore(seed);
  await order(r,0,{type:'gather',ids:[0],forestCell:32*64+24});assert.equal(stateOf(r).units[0].gatherPhase,'to-base');
  const cp=r.checkpoint(),intent=structuredClone(cp.state.units[0].workIntent);r.restore(cp);
  assert.deepEqual(stateOf(r).units[0].workIntent,intent);
  advance(r,m,s=>s.units[0].cargoType==='wood'&&s.units[0].cargo>0,'resume after carried cargo',2000,cargoType==='wood'?initial:0);
  const done=advance(r,m,s=>s.units[0].gatherPhase===''&&s.units[0].cargo===0,'finite group completes',2000,cargoType==='wood'?initial:0);
  assert.ok(Math.abs(done.teamWood[0]-(6+(cargoType==='wood'?initial:0)))<1e-5);
  assert.equal(done.teamFood[0],cargoType==='food'?initial:0);assert.equal(done.units[0].workIntent,null);
 }finally{await f.dispose();}
});
