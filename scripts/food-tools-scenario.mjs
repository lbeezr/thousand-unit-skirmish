import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS, GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { economyRulesetRevision } from '../src/economy-profile.mjs';
import { PRE_FOOD_TOOLS_RULESETS } from '../src/server/worker-food-tools.mjs';
import { farmHarvestNodeId } from '../src/farm-harvest.mjs';

const args = process.argv.slice(2), outputArg = args.find(arg => arg.startsWith('--output='));
assert.ok(args.every(arg => arg === '--stone' || arg === outputArg));
const profile = args.includes('--stone') ? 'stone-defense-v1' : 'food-wood-v1';
const output = outputArg ? path.resolve(outputArg.slice(9)) : null;
if (output) await mkdir(output); // Never overwrite an earlier acceptance record.
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const sourceDirty = execFileSync('git', ['status','--porcelain'], {encoding:'utf8'}).trim() !== '';
const map = { id:'mill-food-tools-proof', name:'Paid Mill food progression', width:64, height:64,
  terrainSeed:19, fogOfWar:true, startingArmySize:24, economyProfileId:profile,
  startingResources:{food:500,wood:600}, spawnPoints:[{team:0,x:-20,z:0},{team:1,x:20,z:0}],
  obstacles:[], resourceNodes:[], triggers:[], scenarioEvents:[] };
const fixture = await createFortifiedFixture({mapPath:'maps/open-field.json',timeoutMs:120000});
let clients, tokens, workers, sequence = 1;
const records = [], cancellationLoss = {food:0,wood:0};
async function command(team, value, notice) {
  // These existing handlers publish uncorrelated notices. Bound the match to
  // newly received messages instead of requiring an order token they omit.
  if (['researchUpgrade', 'trainWorker', 'reset'].includes(value.type)) {
    const client = clients[team], after = client.messages.length;
    client.send(value);
    return client.wait(message => message.type === 'notice' && notice.test(message.message),
      `${value.type} notice`, after);
  }
  return clients[team].command({...value,clientOrderToken:sequence++},notice);
}
const find = (s,team,type) => s.state.buildings.find(b=>b.team===team&&b.type===type);
const saved = async () => JSON.parse(await readFile(fixture.checkpointPath,'utf8'));
const worker = (s,team) => s.state.units[workers[team][0]];
function conserved(s) {
  for(const team of [0,1]) {
    const farm=find(s,team,'farm'), cargo=s.state.units.filter(u=>u.team===team&&u.cargoType==='food').reduce((n,u)=>n+u.cargo,0);
    const price = s.state.teamUpgrades[team].foodTools || s.state.teamResearch[team]?.type === 'food-tools' ? 100 : 0;
    const newWorkerCost = s.state.units.some(u=>u.team===team&&u.kind==='worker'&&!workers[team].includes(u.id)) ? 50 : 0;
    const reservedWorkerCost = s.state.workerProduction[team].queue ? 50 : 0;
    const expected=500 + 200 - price - (team===0?cancellationLoss.food:0) - newWorkerCost - reservedWorkerCost;
    assert.ok(Math.abs(s.state.teamFood[team]+cargo+farm.harvestStock-expected)<1e-5,'bank + real cargo + finite plot conserve paid food');
    const woodExpected=600-75-60-(price?75:0)-(team===0?cancellationLoss.wood:0);
    assert.ok(Math.abs(s.state.teamWood[team]-woodExpected)<1e-5,'wood matches paid Mill/Farm/research/refund');
  }
}
function record(stage,s,extra={}) {
  conserved(s);records.push({stage,tick:s.state.tickNumber,food:[...s.state.teamFood],wood:[...s.state.teamWood],
    foodTools:s.state.teamUpgrades.map(u=>u.foodTools),stock:[0,1].map(t=>find(s,t,'farm').harvestStock),...extra});
  console.log(JSON.stringify({stage,conserved:true}));
}
async function restart() {
  await fixture.start();clients=[await fixture.connect(0,tokens[0]),await fixture.connect(1,tokens[1])];
  assert.ok(clients.every(c=>c.welcome.recoveredFromCheckpoint));
}

try {
  await fixture.start();clients=[await fixture.connect(0),await fixture.connect(1)];tokens=clients.map(c=>c.welcome.player.sessionToken);
  clients[0].send({type:'publishMap',map});
  await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id)));
  workers=clients.map((c,t)=>c.latest.units.filter(u=>u[1]===t&&u[5]==='worker').map(u=>u[0]));
  for(const team of [0,1]) await command(team,{type:'build',buildingType:'mill',ids:workers[team],x:team?16.5:-16.5,z:8.5},/MILL PLACED/);
  const foundations=await fixture.checkpoint(s=>s.state.buildings.filter(b=>b.type==='mill').length===2);
  for(const team of [0,1]) await command(team,{type:'researchUpgrade',buildingId:find(foundations,team,'mill').id,upgrade:'food-tools'},/COMPLETE BUILDING/);
  await fixture.checkpoint(s=>s.state.buildings.filter(b=>b.type==='mill').every(b=>b.complete));
  for(const team of [0,1]) await command(team,{type:'build',buildingType:'farm',ids:workers[team],x:team?10.5:-10.5,z:8.5},/FARM PLACED/);
  let s=await fixture.checkpoint(s=>[0,1].every(t=>find(s,t,'farm')?.complete));
  record('paid-Mill-and-plot',s);
  // Genuine six-technology predecessor format only; banks/crop/cargo/work stay exact.
  await fixture.stop();const prior=await saved();prior.rulesetRevision=PRE_FOOD_TOOLS_RULESETS[profile];
  for(const flags of prior.state.teamUpgrades) delete flags.foodTools;
  const priorState=structuredClone(prior.state);await writeFile(fixture.checkpointPath,JSON.stringify(prior));await restart();
  s=await fixture.checkpoint(s=>s.rulesetRevision===economyRulesetRevision(profile));
  assert.deepEqual(s.state.teamFood,priorState.teamFood);assert.deepEqual(s.state.teamWood,priorState.teamWood);
  assert.ok(s.state.teamUpgrades.every(u=>u.foodTools===false));
  assert.equal(find(s,0,'farm').harvestStock,200);record('prior-six-tech-recovered-unpurchased',s);
  const mills=[0,1].map(t=>find(s,t,'mill').id),farms=[0,1].map(t=>find(s,t,'farm').id);
  await command(0,{type:'researchUpgrade',buildingId:mills[1],upgrade:'food-tools'},/FRIENDLY RESEARCH BUILDING/);
  await command(0,{type:'researchUpgrade',buildingId:farms[0],upgrade:'food-tools'},/FRIENDLY RESEARCH BUILDING/);
  await command(0,{type:'researchUpgrade',buildingId:mills[0],upgrade:'food-tools'},/FOOD TOOLS STARTED/);
  await command(0,{type:'researchUpgrade',buildingId:mills[0],upgrade:'food-tools'},/RESEARCH IN PROGRESS/);
  await fixture.checkpoint(s=>s.state.teamResearch[0]?.remaining<23);await fixture.stop();const active=await saved();await restart();
  assert.equal(clients[0].latest.teamResearch[0].active.type,'food-tools');assert.equal(clients[1].latest.teamResearch[0],null);
  assert.deepEqual((await saved()).state.teamFood,active.state.teamFood);
  await command(1,{type:'cancelResearch',buildingId:mills[0]},/SELECT YOUR ACTIVE RESEARCH BUILDING/);
  await command(0,{type:'cancelResearch',buildingId:mills[0]},/RESEARCH CANCELLED/);
  s=await fixture.checkpoint(s=>s.state.teamResearch[0]===null);
  cancellationLoss.food=500-s.state.teamFood[0];cancellationLoss.wood=465-s.state.teamWood[0];
  assert.ok(cancellationLoss.food>0&&cancellationLoss.food<100);
  assert.ok(Math.abs(cancellationLoss.food/100-cancellationLoss.wood/75)<1e-7);record('active-cold-recovery-proportional-cancel',s);
  await command(0,{type:'researchUpgrade',buildingId:mills[0],upgrade:'food-tools'},/FOOD TOOLS STARTED/);
  s=await fixture.checkpoint(s=>s.state.teamUpgrades[0].foodTools);record('paid-completion-one-seat',s);
  await command(0,{type:'researchUpgrade',buildingId:mills[0],upgrade:'food-tools'},/ALREADY COMPLETED/);
  for(const team of [0,1]) await command(team,{type:'gather',ids:[workers[team][0]],nodeId:farmHarvestNodeId(farms[team])},/GATHER ORDER/);
  const before=await fixture.checkpoint(s=>[0,1].every(t=>worker(s,t).gatherPhase==='gathering'&&worker(s,t).cargo>0&&worker(s,t).cargo<4));
  const after=await fixture.checkpoint(s=>s.state.tickNumber>=before.state.tickNumber+6&&[0,1].every(t=>worker(s,t).gatherPhase==='gathering'&&worker(s,t).cargo<9));
  const seconds=(after.state.tickNumber-before.state.tickNumber)/30;
  const gains=[0,1].map(t=>worker(after,t).cargo-worker(before,t).cargo);
  assert.ok(Math.abs(gains[0]-seconds*1.2)<1e-5);assert.ok(Math.abs(gains[1]-seconds)<1e-5);
  record('actual-food-labor-1.2-versus-1.0',after,{seconds,cargoGains:gains});
  for(const team of [0,1]) await command(team,{type:'stop',ids:workers[team]},/STOP ORDER/);
  await command(1,{type:'researchUpgrade',buildingId:mills[1],upgrade:'food-tools'},/FOOD TOOLS STARTED/);
  const home=clients[0].latest.homeTownCenters.find(b=>b.team===0);
  await command(0,{type:'trainWorker',buildingId:home.id},/WORKER QUEUED/);
  s=await fixture.checkpoint(s=>s.state.teamUpgrades.every(u=>u.foodTools)&&s.state.units.some(u=>u.team===0&&u.kind==='worker'&&!workers[0].includes(u.id)));
  record('future-Worker-and-both-seat-completions',s);
  const newWorker=s.state.units.find(u=>u.team===0&&u.kind==='worker'&&!workers[0].includes(u.id));
  await command(0,{type:'gather',ids:[newWorker.id],nodeId:farmHarvestNodeId(farms[0])},/GATHER ORDER/);
  await fixture.checkpoint(s=>s.state.units[newWorker.id].cargo>0);
  for(const team of [0,1]) await command(team,{type:'gather',ids:team?workers[team]:[...workers[team],newWorker.id],nodeId:farmHarvestNodeId(farms[team])},/GATHER ORDER/);
  s=await fixture.checkpoint(s=>[0,1].every(t=>find(s,t,'farm').harvestStock===0)&&s.state.units.every(u=>u.cargo===0));
  record('finite-200-food-depleted-and-deposited',s);
  await fixture.stop();const complete=await saved();await restart();
  s=await fixture.checkpoint(s=>s.state.teamUpgrades.every(u=>u.foodTools));
  assert.deepEqual(s.state.teamFood,complete.state.teamFood);assert.deepEqual(s.state.teamWood,complete.state.teamWood);
  record('completed-cold-recovery-no-duplicate-credit',s);
  await command(0,{type:'reset'},/BATTLEFIELD RESET/);
  s=await fixture.checkpoint(s=>s.state.buildings.length===0&&s.state.teamUpgrades.every(u=>!u.foodTools));
  assert.deepEqual(s.state.teamFood,[500,500]);assert.deepEqual(s.state.teamWood,[600,600]);
  const result={evidenceType:'authoritative-websocket-scenario',sourceRevision,sourceDirty,profile,
    rulesetRevision:GAMEPLAY_RULESET_REVISION,technology:TECHNOLOGY_DEFINITIONS['food-tools'],records,
    selectedOwnerValidation:true,activeAndCompletedColdRecovery:true,exactPriorContentRecovery:true,
    actualGatherRates:true,finiteCropConservation:true,proportionalRefund:true,futureWorkers:true,
    opponentResearchPrivate:true,rematchReset:true,banksCropCargoInjected:false,ordinaryGameFrames:0};
  if(output) await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({stage:'passed',sourceRevision,sourceDirty,profile,records:records.length}));
} finally { await fixture.dispose(); }
