import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { researchAction, researchOptions, emptyTechnologyCompletions } from '../src/rules/research-actions.mjs';
import { GAMEPLAY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { cueForNotice } from '../src/audio-policy.mjs';

for (const team of [0, 1]) test(`seat ${team}: actual research completion does not promise a false attack bonus`, () => {
  const source = readFileSync(process.env.RESEARCH_NOTICE_SOURCE || new URL('../server.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function updateTeamResearch('), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start);
  for (const technology of Object.values(GAMEPLAY_DEFINITIONS.technologies)) {
    const notices = [], building = { id: 11, team, complete: true, x: 0, z: 0 };
    const context = vm.createContext({ teamResearch: [null, null], teamUpgrades: [emptyTechnologyCompletions(), emptyTechnologyCompletions()],
      STEP_SECONDS: .05, dirty: false, buildingsById: new Map([[building.id, building]]),
      researchRulesFor: id => id === technology.id ? technology : null,
      broadcastGameplayNotice: (owner, x, z, notice) => notices.push({ owner, notice }),
    });
    context.teamResearch[team] = { type: technology.id, buildingId: building.id, remaining: .01 };
    vm.runInContext(source.slice(start, end), context); context.updateTeamResearch();
    assert.equal(context.teamUpgrades[team][technology.upgradeKey], true);
    assert.equal(context.teamResearch[team], null);
    assert.equal(notices.length, 1); assert.equal(notices[0].owner, team);
    assert.match(notices[0].notice, /COMPLETE/);
    assert.doesNotMatch(notices[0].notice, /\+20% ATTACK/, technology.id);
    assert.equal(cueForNotice(notices[0].notice, { localTeam: team }), 'research-complete', technology.id);
  }
});

for (const team of [0, 1]) test(`research availability owns economy, completion and prerequisites for seat ${team}`, () => {
  const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
  definitions.technologies['infantry-attack'].requires = ['archer-attack'];
  const building = { id: 7, team, type: 'barracks', complete: true };
  const state = { team, food: 100, wood: 75, upgrades: emptyTechnologyCompletions(definitions), active: null, matchOver: false };
  assert.match(researchAction(building, 'infantry-attack', state, definitions).reason, /REQUIRES/);
  state.upgrades.archerAttack = true;
  const available = researchAction(building, 'infantry-attack', state, definitions);
  assert.equal(available.available, true); assert.deepEqual(available.cost, { food: 100, wood: 75 });
  assert.equal(researchOptions(building, state, definitions).find(option => option.upgrade === 'infantry-attack').available, true);
  state.food = 99.99; assert.equal(researchAction(building, 'infantry-attack', state, definitions).available, false);
  state.food = 100; state.active = { type: 'archer-attack' };
  assert.equal(researchAction(building, 'infantry-attack', state, definitions).reason, 'RESEARCH IN PROGRESS');
  state.active = null; state.upgrades.infantryAttack = true;
  assert.equal(researchAction(building, 'infantry-attack', state, definitions).reason, 'ALREADY COMPLETED');
  assert.equal(researchAction({ ...building, team: 1 - team }, 'infantry-attack', state, definitions).available, false);
  assert.equal(researchAction(building, '__proto__', state, definitions).reason, 'UNKNOWN TECHNOLOGY');
  assert.ok(Object.values(emptyTechnologyCompletions()).every(value => value === false));
});

test('second tier opens armor and mounted weapons while completions reset generically', () => {
  const upgrades = emptyTechnologyCompletions();
  const state = { team: 0, food: 1000, wood: 1000, upgrades, active: null, matchOver: false };
  const barracks = { id: 4, team: 0, type: 'barracks', complete: true };
  const stable = { id: 5, team: 0, type: 'stable', complete: true };
  assert.equal(researchAction(barracks, 'military-armor', state).available, false);
  assert.equal(researchAction(stable, 'mounted-attack', state).available, false);
  upgrades.militaryTier2 = true;
  assert.equal(researchAction(barracks, 'military-armor', state).available, true);
  assert.equal(researchAction(stable, 'mounted-attack', state).available, true);
  upgrades.militaryArmor = true;
  assert.equal(researchAction(barracks, 'military-armor', state).reason, 'ALREADY COMPLETED');
  assert.equal(emptyTechnologyCompletions().militaryArmor, false);
});
