import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS} from '../src/gameplay-definitions.mjs';
import {validCompletionTrigger} from '../src/scenario-regions.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const render = source.slice(source.indexOf('function renderScenarioEventCountdown('),
  source.indexOf('\nfunction renderObjectiveSummary('));
function fixture(trigger, viewer = 0) {
  const event = {id: 'completion', name: 'Supplies', team: '0', trigger, afterSeconds: 20};
  const visual = {event, card: {dataset: {}}, status: {textContent: ''}};
  const context = vm.createContext({BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS, validCompletionTrigger,
    TEAM_NAMES: ['Azure', 'Ember'], localTeam: viewer, latestScenarioClockStarted: true,
    latestMatchElapsedSeconds: 10, scenarioClockSynchronizedAt: 1000, lastScenarioEventUiUpdateAt: 0,
    matchWinner: -1, latestScenarioEventStates: new Map(), scenarioEventVisuals: new Map([[event.id, visual]]),
    timedVictoryVisual: null, renderObjectiveSummary() {},
    mapDefinition: {triggers: [{id: 'grove', name: 'Supply Grove'}],
      regions: [{id: 'pass', name: 'North Pass'}], scenarioEvents: [{id: 'source', name: 'Opening Supplies'}]},
    scenarioEventSourceIds: value => value.eventIds || (value.eventId ? [value.eventId] : []),
  });
  vm.runInContext(render, context);
  return {context, event, visual, render() {
    context.lastScenarioEventUiUpdateAt = 0;
    context.renderScenarioEventCountdown(1000);
    return visual.status.textContent;
  }};
}

for (const viewer of [0, 1, null]) {
  test(`completion requirements use registry and absolute team names for viewer ${viewer}`, () => {
    for (const [type, field, registry] of [
      ['construction-complete', 'buildingType', BUILDING_DEFINITIONS],
      ['research-complete', 'technologyId', TECHNOLOGY_DEFINITIONS],
    ]) for (const [id, definition] of Object.entries(registry)) {
      for (const [team, label] of [['0', 'AZURE'], ['1', 'EMBER'], ['either', 'EITHER TEAM']]) {
        const f = fixture({type, [field]: id, team}, viewer);
        const serialized = JSON.stringify(f.event);
        assert.equal(f.render(), `WAITING FOR ${definition.label.toUpperCase()} · ${label}`);
        assert.equal(f.visual.card.dataset.state, 'waiting');
        assert.equal(JSON.stringify(f.event), serialized, 'presentation preserves IDs and recipient');
      }
    }
  });
}

test('missing or unknown completion references never invent registry or team names', () => {
  for (const trigger of [
    {type: 'construction-complete', buildingType: 'unknown', team: '0'},
    {type: 'research-complete', technologyId: 'unknown', team: '1'},
    {type: 'construction-complete', team: '0'},
    {type: 'construction-complete', buildingType: null, team: '0'},
    {type: 'research-complete', technologyId: 'infantry-attack'},
    {type: 'construction-complete', buildingType: 'house', team: 'unknown'},
    {type: 'research-complete', technologyId: 'infantry-attack', team: 0},
    {type: 'research-complete', technologyId: '__proto__', team: '0'},
  ]) {
    const f = fixture(trigger);
    assert.equal(f.render(), 'WAITING FOR COMPLETION');
    assert.equal(f.visual.card.dataset.state, 'waiting');
  }
});

test('completion countdown, delivery, ended match and rematch waiting retain their behavior', () => {
  const f = fixture({type: 'research-complete', technologyId: 'infantry-attack', team: '1'});
  f.context.latestScenarioEventStates.set(f.event.id, {activatedAtSeconds: 5});
  assert.equal(f.render(), 'IN 15s');
  f.context.latestScenarioEventStates.set(f.event.id, {fired: true});
  assert.equal(f.render(), 'DELIVERED');
  f.context.latestScenarioEventStates.clear(); f.context.matchWinner = 0;
  assert.equal(f.render(), 'MATCH ENDED');
  f.context.matchWinner = -1; f.context.latestScenarioClockStarted = false;
  assert.equal(f.render(), 'WAITING FOR BOTH TEAMS');
  f.context.latestScenarioClockStarted = true;
  assert.equal(f.render(), 'WAITING FOR INFANTRY FORGING · EMBER');
});

test('capture, named region, source event and no-trigger timer retain existing labels', () => {
  for (const [trigger, expected] of [
    [{type: 'capture', objectiveId: 'grove'}, 'WAITING FOR SUPPLY GROVE'],
    [{type: 'region-entry', regionId: 'pass', team: '0'}, 'WAITING FOR NORTH PASS'],
    [{type: 'event', eventId: 'source'}, 'WAITING FOR OPENING SUPPLIES'],
    [undefined, 'IN 10s'],
  ]) assert.equal(fixture(trigger).render(), expected);
});
