import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { GAMEPLAY_DEFINITIONS, TECHNOLOGY_DEFINITIONS, GAMEPLAY_RULESET_REVISION, validateGameplayDefinitions } from '../src/gameplay-definitions.mjs';
import { emptyTechnologyCompletions, researchAction } from '../src/research-actions.mjs';
import { combatDamage } from '../src/combat-rules.mjs';
import { economyRulesetRevision } from '../src/economy-profile.mjs';
import { workerFoodGatherMultiplier, migrateFoodToolsCheckpoint, PRE_FOOD_TOOLS_RULESETS } from '../src/server/worker-food-tools.mjs';
const rules = TECHNOLOGY_DEFINITIONS['food-tools'];
const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('function researchUpgrade('), b = source.indexOf('\nfunction ', a + 1);
assert.ok(a >= 0 && b > a);

test('Mill research changes productive Worker food labor, excluding other resources/boats/combat', () => {
  assert.equal(rules.building, 'mill'); assert.deepEqual(rules.cost, { food:100, wood:75 });
  assert.equal(rules.durationSeconds,25); assert.deepEqual(rules.requires ?? [],[]);
  assert.equal(workerFoodGatherMultiplier({kind:'worker'},'food',{}),1);
  assert.equal(workerFoodGatherMultiplier({kind:'worker'},'food',{foodTools:true}),1.2);
  for(const [kind,resource] of [['worker','wood'],['worker','stone'],['skiff','food'],['infantry','food']])
    assert.equal(workerFoodGatherMultiplier({kind},resource,{foodTools:true}),1);
  const {units}=GAMEPLAY_DEFINITIONS;
  assert.equal(combatDamage(units.worker,units.infantry,{foodTools:true},{}),combatDamage(units.worker,units.infantry,{},{}));
});
test('unsupported food-work declarations fail instead of becoming decorative effects', () => {
  for(const mutate of [e=>{e.value=0;},e=>{e.value=NaN;},e=>{e.targetTags=['mounted'];},
    e=>{e.targetTags=['worker','infantry'];},e=>{e.stat='wood-gather-multiplier';},e=>{e.carryCapacity=20;}]) {
    const d=structuredClone(GAMEPLAY_DEFINITIONS);mutate(d.technologies['food-tools'].effects[0]);
    assert.throws(()=>validateGameplayDefinitions(d));
  }
});
for(const team of [0,1]) test(`seat ${team} actual research validates dependency/ownership/cost/one project/payment`, () => {
  const mill={id:11,team,type:'mill',complete:true},home={id:1,team,type:'town-center',complete:true};
  const notices=[],player={team,sendJson:n=>notices.push(n.message)};
  const c=vm.createContext({buildingsById:new Map([[mill.id,mill],[home.id,home]]),researchAction,
    researchRulesFor:id=>id===rules.id?{...rules,foodCost:100,woodCost:75}:null,
    teamUpgrades:[emptyTechnologyCompletions(),emptyTechnologyCompletions()],teamResearch:[null,null],
    teamFood:[500,500],teamWood:[500,500],matchWinner:-1,dirty:false});
  vm.runInContext(source.slice(a,b),c);const issue=id=>c.researchUpgrade(player,{buildingId:id,upgrade:rules.id});
  issue(home.id);assert.match(notices.at(-1),/FRIENDLY RESEARCH BUILDING/);
  mill.team=1-team;issue(mill.id);assert.match(notices.at(-1),/FRIENDLY RESEARCH BUILDING/);mill.team=team;
  mill.complete=false;issue(mill.id);assert.match(notices.at(-1),/COMPLETE BUILDING/);mill.complete=true;
  c.teamFood[team]=99;issue(mill.id);assert.match(notices.at(-1),/NEED 100 FOOD \+ 75 WOOD/);
  c.teamFood[team]=500;c.teamWood[team]=74;issue(mill.id);assert.match(notices.at(-1),/NEED 100 FOOD \+ 75 WOOD/);
  c.teamWood[team]=500;assert.equal(c.dirty,false);issue(mill.id);assert.match(notices.at(-1),/FOOD TOOLS STARTED/);
  assert.equal(c.teamFood[team],400);assert.equal(c.teamWood[team],425);assert.equal(c.teamFood[1-team],500);
  assert.equal(c.teamResearch[team].buildingId,11);issue(mill.id);assert.match(notices.at(-1),/RESEARCH IN PROGRESS/);
  assert.equal(c.teamFood[team],400);assert.equal(c.teamWood[team],425);
  c.teamResearch[team]=null;c.teamUpgrades[team].foodTools=true;issue(mill.id);
  assert.match(notices.at(-1),/ALREADY COMPLETED/);assert.equal(c.teamFood[team],400);
  const start=source.indexOf('function updateTeamResearch('),end=source.indexOf('\nfunction ',start+1);
  c.teamUpgrades[team].foodTools=false;c.teamResearch[team]={type:rules.id,buildingId:11,remaining:10};
  c.buildingsById.delete(11);c.STEP_SECONDS=1/30;c.broadcastGameplayNotice=()=>{};
  vm.runInContext(source.slice(start,end),c);c.updateTeamResearch();
  assert.equal(c.teamResearch[team],null);assert.equal(c.teamUpgrades[team].foodTools,false);
  assert.equal(c.teamFood[team],400);assert.equal(c.teamWood[team],425,'destroyed research has no refund or free effect');
});
function prior(profile) {
  const upgrades=emptyTechnologyCompletions();delete upgrades.foodTools;upgrades.infantryAttack=true;
  return {schemaVersion:29,economyProfileId:profile,rulesetRevision:PRE_FOOD_TOOLS_RULESETS[profile],
    mapDefinition:{economyProfileId:profile},state:{teamUpgrades:[structuredClone(upgrades),structuredClone(upgrades)],
      teamResearch:[null,null],teamFood:[103.5,90],teamWood:[18,71],teamStone:[0,0],
      units:[{kind:'worker',cargo:3.5,cargoType:'food'}],buildings:[{type:'farm',harvestStock:196.5}]}};
}
for(const profile of Object.keys(PRE_FOOD_TOOLS_RULESETS)) test(`prior ${profile} recovery preserves work/banks without granting research`, () => {
  const s=prior(profile),before=structuredClone(s.state);migrateFoodToolsCheckpoint(s);
  assert.equal(s.rulesetRevision,economyRulesetRevision(profile));
  for(const upgrades of s.state.teamUpgrades){assert.equal(upgrades.foodTools,false);delete upgrades.foodTools;}
  assert.deepEqual(s.state,before);
});
test('unknown/current pins, forged flags and incompatible profiles remain invalid', () => {
  for(const mutate of [s=>{s.rulesetRevision='v1:unknown';},s=>{s.rulesetRevision=GAMEPLAY_RULESET_REVISION;},
    s=>{s.state.teamUpgrades[0].foodTools=true;},s=>{s.state.teamUpgrades[0].infantryAttack='true';},
    s=>{s.mapDefinition.economyProfileId='stone-defense-v1';},s=>{s.state.teamResearch[0]={type:'food-tools'};}]) {
    const s=prior('food-wood-v1');mutate(s);const before=structuredClone(s);migrateFoodToolsCheckpoint(s);assert.deepEqual(s,before);
  }
});
