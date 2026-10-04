import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapVictoryRule, mapScenarioSummary, objectiveSummary, rememberNotice } from '../src/client/hud/objective-summary.mjs';
import { readFileSync } from 'node:fs';
import { effectiveMapForMatchMode } from '../src/match-modes.mjs';
test('objective compatibility preserves only the existing named bindings', async () => {
  const legacy = await import('../src/objective-summary.mjs');
  const current = await import('../src/client/hud/objective-summary.mjs');
  const names = ['mapScenarioSummary', 'mapVictoryRule', 'objectiveSummary', 'rememberNotice'];
  assert.deepEqual(Object.keys(legacy), names);
  assert.deepEqual(Object.keys(current), names);
  for (const name of names) assert.equal(legacy[name], current[name], name);
});
const map = { victoryMode: 'all', victoryHoldSeconds: 30, triggers: [
  { id: 'gate', name: 'North gate', requiredUnits: 2 },
  { id: 'keep', name: 'Keep', requiredUnits: 3, requiresAll: ['gate'], victory: true },
] };
test('next action follows missing prerequisites and advances after capture', () => {
  assert.match(objectiveSummary(map, [], { team: 0 }).action, /North gate/);
  assert.match(objectiveSummary(map, [{ id: 'gate', owner: 0 }], { team: 0 }).action, /Keep/);
  assert.match(objectiveSummary(map, [{ id: 'gate', owner: 0 }, { id: 'keep', owner: 0 }], { team: 0 }).action, /Defend/);
});
test('both teams hold countdowns and deadline stay visible with closed details', () => {
  const result = objectiveSummary({ ...map, timedVictory: { afterSeconds: 90, objectiveId: 'keep' } }, [], {
    team: 0, started: true, elapsed: 70, hold: { activeTeams: [true, true], progressSeconds: [10, 20] },
  });
  assert.equal(result.urgent, 'Azure wins in 20s · Ember wins in 10s · Deadline 20s · Keep');
  assert.equal(objectiveSummary(map, [], { started: false, hold: { activeTeams: [true] } }).urgent, '');
});
test('any-zone victory defends existing control and spectator receives no invented order', () => {
  const any = { ...map, victoryMode: 'any', triggers: [...map.triggers, { id: 'other', name: 'Other', victory: true }] };
  assert.match(objectiveSummary(any, [{ id: 'other', owner: 0 }], { team: 0 }).action, /Defend/);
  assert.match(objectiveSummary(map).action, /Spectating/);
  assert.equal(objectiveSummary(map, [], { winner: 2 }).action, 'Match drawn');
});
test('cyclic prerequisites cannot stall the UI', () => {
  const cyclic = { triggers: [{ id: 'a', name: 'A', requires: 'b', victory: true }, { id: 'b', name: 'B', requires: 'a' }] };
  assert.ok(objectiveSummary(cyclic, [], { team: 0 }).action);
});
test('ordinary authored modes have explicit labels without changing their timers', () => {
  for (const id of ['bellweather-millrace', 'underbough-rootways']) {
    const definition = JSON.parse(readFileSync(new URL(`../maps/${id}.json`, import.meta.url)));
    const before = JSON.stringify(definition);
    const rule = mapVictoryRule(definition);
    assert.equal(rule.label, 'Objective Control');
    assert.match(rule.description, /Leaving a zone keeps ownership/);
    assert.match(rule.description, /Army or Town Center loss does not end this mode/);
    assert.match(rule.description, /15:00/);
    assert.equal(definition.startingArmySize, 24);
    assert.equal(definition.victoryMode, 'all');
    assert.equal(definition.victoryHoldSeconds, id === 'underbough-rootways' ? 30 : 20);
    assert.deepEqual(definition.timedVictory, { afterSeconds: 900, objectiveId: 'post-2' });
    assert.deepEqual(definition.triggers.map(t => [t.requiredUnits, t.captureSeconds, t.victory]),
      id === 'underbough-rootways'
        ? [[5, 9, true], [5, 9, true], [4, 12, false]]
        : [[5, 9, true], [5, 9, true], [8, 12, true]]);
    assert.match(objectiveSummary(definition, [], { team: 0 }).action, /^Objective Control · Capture/);
    assert.equal(JSON.stringify(definition), before);
  }
});
test('elimination explains recoverable production and Town Center loss', () => {
  const rule = mapVictoryRule({ triggers: [{ id: 'supply', name: 'Supply', requiredUnits: 2 }] });
  assert.equal(rule.label, 'Elimination');
  assert.match(rule.description, /no living land units, no paid land-unit queues/);
  assert.match(rule.description, /afford and legally spawn/);
  assert.match(rule.description, /Workers count; Skiffs alone do not/);
  assert.match(rule.description, /Losing a Town Center alone is not defeat/);
  assert.equal(objectiveSummary({}, [], { team: 0 }).action,
    'Elimination · Eliminate land units and usable production');
});
test('a non-victory deadline coexists with elimination and remains an explicit rule', () => {
  const definition = { triggers: [{ id: 'supply', name: 'Supply', requiredUnits: 2 }],
    timedVictory: { objectiveId: 'supply', afterSeconds: 90 } };
  const rule = mapVictoryRule(definition);
  assert.equal(rule.label, 'Elimination + Deadline');
  assert.match(rule.description, /no living land units/);
  assert.match(rule.description, /At 1:30, the current owner of Supply wins; unclaimed is a draw/);
});
const bannerfall = effectiveMapForMatchMode(
  JSON.parse(readFileSync(new URL('../maps/bannerfall-arena.json', import.meta.url))),
  { matchModeId: 'bannerfall', matchModeVersion: 1 });
test('Bannerfall explains designated strongholds, bounded waves and kill evolution without capture or elimination instructions', () => {
  assert.match(mapScenarioSummary(bannerfall), /original Town Center.*enemy stronghold.*Free waves.*kills unlock Riders/);
  assert.doesNotMatch(mapScenarioSummary(bannerfall), /capture|objective/i);
  const rule = mapVictoryRule(bannerfall);
  assert.equal(rule.label, 'Bannerfall');
  assert.match(rule.description, /Destroy the enemy original Town Center to win/);
  assert.match(rule.description, /both on the same combat tick is a draw/);
  assert.match(rule.description, /waves of up to two troops.*every 15 seconds.*12 supply per side/i);
  assert.match(rule.description, /Six enemy troop kills unlock Rider reinforcements/);
  assert.match(rule.description, /Blocked or capped waves are skipped/);
  assert.match(rule.description, /Other buildings cannot replace the stronghold/);
  assert.doesNotMatch(rule.description, /capture|eliminat|deadline/i);
  for (const team of [0, 1]) {
    for (const started of [false, true]) {
      const summary = objectiveSummary(bannerfall, [], { team, started, elapsed: 901,
        hold: { activeTeams: [true, true], progressSeconds: [10, 10] } });
      assert.match(summary.action, /^Bannerfall · Destroy the enemy original Town Center/);
      assert.match(summary.action, /Waves 15s.*Riders at 6 kills/);
      assert.doesNotMatch(summary.action, /capture|eliminat|deadline/i);
      assert.equal(summary.urgent, '', 'an inherited hold/deadline cannot promise a Bannerfall capture win');
    }
  }
});
test('Bannerfall terminal text replaces ongoing reinforcement instructions', () => {
  for (const [winner, action] of [[0, 'Azure wins'], [1, 'Ember wins'], [2, 'Match drawn']]) {
    assert.deepEqual(objectiveSummary(bannerfall, [], { team: 0, winner, started: true, elapsed: 30 }),
      { action, urgent: '' });
  }
});
test('recent repeated feedback is grouped without discarding different rejections', () => {
  let history = rememberNotice([], 'NEED WOOD', 0);
  history = rememberNotice(history, 'QUEUE FULL', 1);
  history = rememberNotice(history, 'NEED WOOD', 2);
  assert.deepEqual(history.map(({ text, count }) => [text, count]), [['NEED WOOD', 2], ['QUEUE FULL', 1]]);
  for (let i = 0; i < 20; i++) history = rememberNotice(history, `Notice ${i}`, 100 + i);
  assert.equal(history.length, 12);
});
