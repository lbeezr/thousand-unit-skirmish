import assert from 'node:assert/strict';
import test from 'node:test';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { farmHarvestNodeId, eligibleFarmReplantWorker } from '../src/farm-harvest.mjs';
import { validWorkIntent } from '../src/work-intent.mjs';
process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'manual-farm-renewal', name: 'Manual Farm renewal', width: 80, height: 64,
  terrainSeed: 19, fogOfWar: true, startingArmySize: 8, startingResources: { food: 0, wood: 400 },
  spawnPoints: [{ team: 0, x: -28, z: 0 }, { team: 1, x: 28, z: 0 }],
  obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
const state = r => r.checkpoint().state;
function until(r, predicate, limit = 12000) {
  for (let i = 0; i < limit; i++) { if (predicate(state(r))) return; r.step(); }
  assert.fail(`simulation condition timed out at ${r.observe(0).tick}`);
}
const order = (r, team, type, workers, extra = {}) => r.order(team, { type,
  ids: workers.map(w => w.id), unitGenerations: workers.map(w => w.generation), ...extra });
let exhausted;
async function fixture() {
  const f = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  if (exhausted) f.replay.restore(structuredClone(exhausted));
  return f;
}
test('both seats naturally pay, deplete, renew once, recover and deliver first food with retained cargo', async () => {
  const f = await fixture(), r = f.replay;
  try {
    for (const team of [0, 1]) {
      const workers = state(r).units.filter(u => u.team === team && u.kind === 'worker');
      const notices = await order(r, team, 'build', workers.slice(0, 2),
        { buildingType: 'farm', x: team ? 24.5 : -24.5, z: 7.5 });
      assert.ok(notices.some(n => n.message.includes('PLACED')), JSON.stringify(notices));
    }
    until(r, s => s.buildings.length === 2 && s.buildings.every(b => b.complete));
    for (const team of [0, 1]) {
      const workers = state(r).units.filter(u => u.team === team && u.kind === 'worker');
      await order(r, team, 'gather', workers.slice(0, 2),
        { nodeId: farmHarvestNodeId(state(r).buildings.find(b => b.team === team).id) });
    }
    until(r, s => s.buildings.every(b => b.harvestStock === 0));
    for (const team of [0, 1]) await order(r, team, 'stop', state(r).units.filter(u => u.team === team && u.kind === 'worker'));
    exhausted = r.checkpoint(); // Untouched, naturally exhausted paid plots.
    for (const team of [0, 1]) {
      const before = state(r), old = before.buildings.find(b => b.team === team);
      const workers = before.units.filter(u => u.team === team && u.kind === 'worker').slice(0, 2);
      const payload = { type: 'replantFarm', buildingId: old.id, ids: workers.map(w => w.id),
        unitGenerations: workers.map(w => w.generation), clientOrderToken: 77 };
      const notices = await r.order(team, payload);
      assert.ok(notices.some(n => /FARM REPLANTED/.test(n.message) && n.clientOrderToken === 77), JSON.stringify(notices));
      const after = state(r), fresh = after.buildings.find(b => b.team === team);
      assert.notEqual(fresh.id, old.id); assert.equal(fresh.harvestStock, 0); assert.equal(fresh.progress, 0);
      assert.equal(before.teamWood[team] - after.teamWood[team], 60);
      assert.deepEqual(after.units.filter(u => workers.some(w => w.id === u.id)).map(u => u.cargo), workers.map(u => u.cargo));
      assert.ok(after.units.filter(u => workers.some(w => w.id === u.id)).every(u => u.workIntent.resumeFarmHarvest));
      assert.ok((await r.order(team, payload)).some(n => /REJECTED/.test(n.message)));
      assert.deepEqual(state(r).teamWood, after.teamWood, 'double click cannot pay twice');
    }
    r.step(); const paidSave = r.checkpoint(); r.restore(paidSave);
    assert.deepEqual(state(r).teamWood, paidSave.state.teamWood);
    for (const team of [0, 1]) {
      const old = exhausted.state.buildings.find(b => b.team === team);
      assert.ok((await order(r, team, 'replantFarm', exhausted.state.units.filter(u => u.team === team && u.kind === 'worker'),
        { buildingId: old.id })).some(n => /REJECTED/.test(n.message)), 'replayed old identity fails after recovery');
    }
    const baseline = [...state(r).teamFood];
    until(r, s => s.buildings.every(b => b.complete) && s.teamFood.every((food, team) => food > baseline[team]));
    for (const team of [0, 1]) {
      const s = state(r), plot = s.buildings.find(b => b.team === team);
      assert.ok(s.units.some(u => u.team === team && u.gatherNodeId === farmHarvestNodeId(plot.id)), 'selected builders resume harvest');
      const cargo = s.units.filter(u => u.team === team && u.cargoType === 'food').reduce((n,u) => n+u.cargo,0);
      assert.ok(Math.abs(s.teamFood[team] + plot.harvestStock + cargo - 400) < 1e-5, 'two paid finite supplies conserved');
      assert.equal(s.teamWood[team], 280, 'exactly two paid crops, no passive spending');
    }
  } finally { await f.dispose(); }
});
for (const team of [0, 1]) test(`seat ${team} refuses invalid plots, funds, stale/busy Workers without mutation`, async () => {
  const f = await fixture(), r = f.replay;
  try {
    assert.ok(exhausted);
    const plot = state(r).buildings.find(b => b.team === team);
    const workers = state(r).units.filter(u => u.team === team && u.kind === 'worker');
    for (const [label, edit, overrides] of [
      ['enemy', s => { s.state.buildings.find(b=>b.id===plot.id).team=1-team; }, {}],
      ['productive', s => { s.state.buildings.find(b=>b.id===plot.id).harvestStock=1; }, {}],
      ['unfinished', s => { const b=s.state.buildings.find(b=>b.id===plot.id); b.complete=false; b.progress=.5; }, {}],
      ['unexplored', s => { s.state.explored[team]=Buffer.alloc(80*64).toString('base64'); }, {}],
      ['insufficient', s => { s.state.teamWood[team]=59; }, {}],
      ['none selected', () => {}, { ids: [], unitGenerations: [] }],
      ['missing generations', () => {}, { unitGenerations: undefined }],
      ['stale generations', () => {}, { unitGenerations: workers.map(w=>w.generation+1) }],
      ['busy Hold', s => { for(const w of s.state.units.filter(u=>u.team===team&&u.kind==='worker')) w.holdingPosition=true; }, {}],
    ]) {
      const changed=structuredClone(exhausted); edit(changed); r.restore(changed);
      const before = state(r);
      const result=await order(r, team, 'replantFarm', workers, { buildingId: plot.id, ...overrides });
      assert.ok(result.some(n=>/REPLANT REJECTED/.test(n.message)), label+JSON.stringify(result));
      if (label === 'insufficient') assert.equal(result.find(n=>/REPLANT REJECTED/.test(n.message)).message,
        'REPLANT REJECTED · NEED 60 WOOD', 'affordability feedback names the existing paid renewal cost');
      assert.deepEqual(state(r), before, `${label}: failed admission changes no authority`);
    }
  } finally { await f.dispose(); }
});
test('Stop interrupts renewal continuation; destruction and replacement do not transfer it', async () => {
  const f=await fixture(), r=f.replay;
  try {
    const workers=state(r).units.filter(u=>u.team===0&&u.kind==='worker');
    const old=state(r).buildings.find(b=>b.team===0);
    await order(r,0,'replantFarm',workers.slice(0,2),{buildingId:old.id});
    const fresh=state(r).buildings.find(b=>b.team===0);
    await order(r,0,'stop',workers.slice(0,1));
    assert.equal(state(r).units[workers[0].id].workIntent,null);
    const save=r.checkpoint(); r.restore(save);
    until(r,s=>s.buildings.find(b=>b.id===fresh.id).complete);
    assert.equal(state(r).units[workers[0].id].gatherNodeId,null,'stopped Worker never resumes');
    assert.equal(state(r).units[workers[1].id].gatherNodeId,farmHarvestNodeId(fresh.id));
    // Declared cancellation/destruction control: unfinished replacement is
    // removed by the real lifecycle command; retained historical intent cannot
    // bind a later paid Farm at the same coordinates.
    r.restore(structuredClone(exhausted));
    await order(r,0,'replantFarm',workers.slice(0,1),{buildingId:old.id});
    const doomed=state(r).buildings.find(b=>b.team===0);
    await r.order(0,{type:'cancelConstruction',buildingId:doomed.id});
    await order(r,0,'build',workers.slice(2,3),{buildingType:'farm',x:doomed.x,z:doomed.z});
    const later=state(r).buildings.find(b=>b.team===0);
    assert.notEqual(later.id,doomed.id);
    until(r,s=>s.buildings.find(b=>b.id===later.id).complete);
    assert.equal(state(r).units[workers[0].id].gatherNodeId,null);
    assert.equal(state(r).buildings.find(b=>b.id===later.id).harvestStock,200);
  } finally {await f.dispose();}
});
test('eligibility and persisted continuation reject busy intent and malformed identities', () => {
  const u={id:1,generation:3,team:0,kind:'worker',hp:100,cargo:8,cargoType:'wood',gatherForestCell:-1};
  assert.ok(eligibleFarmReplantWorker(u,0,7));
  for(const extra of [{workIntent:{kind:'gather'}},{gatherPhase:'to-base'}, {queuedWaypoints:[1]},
    {buildingTargetId:8},{persistentOrder:{type:'follow'}},{movePlanningPending:true},{hp:0},{team:1}]) {
    assert.equal(eligibleFarmReplantWorker({...u,...extra},0,7),false);
  }
  const intent={version:1,kind:'construction',generation:3,siteIds:[7],
    area:{minX:0,maxX:3,minZ:0,maxZ:3},resumeFarmHarvest:true};
  const options={buildings:[{id:7,type:'farm',team:0}],nextBuildingId:9};
  assert.ok(validWorkIntent(intent,u,map,options));
  for(const bad of [{resumeFarmHarvest:false},{siteIds:[7,8]},{generation:4},{extra:true}])
    assert.equal(validWorkIntent({...intent,...bad},u,map,options),false);
  assert.equal(validWorkIntent(intent,u,map,{...options,buildings:[{id:7,type:'mill',team:0}]}),false);
});
for (const team of [0, 1]) test(`seat ${team} natural wood cargo survives renewal while busy and unselected orders stay exact`, async () => {
  // Real gathering supplies retained cargo. No checkpoint bank/cargo/stock edits.
  const timberMap={...map,id:`manual-farm-mixed-${team}`,resourceNodes:[{
    id:'renewal-timber',type:'wood',x:team?24.5:-24.5,z:3.5,stock:100}]};
  const f=await createPveHeadlessFixture(timberMap,{matchModeId:'authored',matchModeVersion:1}),r=f.replay;
  try {
    const workers=state(r).units.filter(u=>u.team===team&&u.kind==='worker');
    await order(r,team,'build',workers,{buildingType:'farm',x:team?24.5:-24.5,z:7.5});
    until(r,s=>s.buildings.length===1&&s.buildings[0].complete);
    const old=state(r).buildings[0];
    await order(r,team,'gather',workers.slice(0,2),{nodeId:farmHarvestNodeId(old.id)});
    until(r,s=>s.buildings[0].harvestStock===0&&s.units.filter(u=>u.team===team).every(u=>u.cargo===0));
    await order(r,team,'gather',workers.slice(0,1),{nodeId:'renewal-timber'});
    until(r,s=>s.units[workers[0].id].cargo>2&&s.units[workers[0].id].cargoType==='wood');
    await order(r,team,'stop',workers.slice(0,1));
    await order(r,team,'holdPosition',workers.slice(1,2));
    const before=state(r),carrying=before.units[workers[0].id];
    assert.ok(carrying.cargo>0&&carrying.cargoType==='wood');
    assert.ok(before.units[workers[1].id].holdingPosition);
    const selected=workers.slice(0,2);
    assert.ok((await order(r,team,'replantFarm',selected,{buildingId:old.id})).some(n=>/1 WORKERS/.test(n.message)));
    const paid=state(r),fresh=paid.buildings[0];
    for(const worker of workers.slice(1)) assert.deepEqual(paid.units[worker.id],before.units[worker.id],
      'selected busy and unselected Workers keep exact authority fields before simulation advances');
    assert.equal(paid.units[workers[0].id].cargo,carrying.cargo);
    assert.equal(before.teamWood[team]-paid.teamWood[team],60);
    r.restore(r.checkpoint());
    until(r,s=>s.buildings[0].complete);
    const completed=state(r);
    assert.equal(completed.units[workers[0].id].cargoType,'wood','construction keeps incompatible real cargo');
    until(r,s=>s.teamWood[team]>paid.teamWood[team]+1e-5);
    const returned=state(r);
    assert.equal(returned.teamFood[team],paid.teamFood[team],'wood delivers before renewed food');
    assert.ok(Math.abs(returned.teamWood[team]-paid.teamWood[team]-carrying.cargo)<1e-5);
    assert.ok(returned.units[workers[1].id].holdingPosition,'busy selected Worker keeps Hold through recovery and completion');
    until(r,s=>s.teamFood[team]>paid.teamFood[team]+1e-5);
    const delivered=state(r),crop=delivered.buildings.find(b=>b.id===fresh.id);
    const foodCargo=delivered.units.filter(u=>u.team===team&&u.cargoType==='food').reduce((n,u)=>n+u.cargo,0);
    assert.ok(Math.abs(delivered.teamFood[team]+crop.harvestStock+foodCargo-400)<1e-5);
    assert.ok(Math.abs(delivered.teamWood[team]-paid.teamWood[team]-carrying.cargo)<1e-5,'one charge and one real wood return');
  } finally {await f.dispose();}
});
