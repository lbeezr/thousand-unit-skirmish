import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assertGatheringBeforeRewards } from './underbough-gathering-evidence.mjs';

const map = JSON.parse(readFileSync(new URL('../maps/underbough-rootways.json', import.meta.url)));
const state = () => ({ matchElapsedSeconds: 30,
  teamFood: [map.startingResources.food, map.startingResources.food],
  teamWood: [map.startingResources.wood, map.startingResources.wood],
  resourceNodes: structuredClone(map.resourceNodes),
  scenarioEventStates: map.scenarioEvents.map(e => ({ id: e.id, fired: false })),
  triggerStates: map.triggers.map(o => ({ id: o.id, owner: -1 })) });
function bankFood(s) {
  for (const team of [0, 1]) {
    s.teamFood[team] += 10;
    s.resourceNodes.find(n => n.id === `s${team}-0`).stock -= 10;
  }
}

test('ordinary pre-reward banked food and consumed stock prove both seats', () => {
  const s = state(); bankFood(s);
  assert.doesNotThrow(() => assertGatheringBeforeRewards(s, map, [0, 1], ['food']));
});
test('Rootways timed reward alone passes the old bank check but fails gathering evidence', () => {
  const s = state(), reward = map.scenarioEvents.find(e => e.type === 'timed-supply');
  s.matchElapsedSeconds = reward.afterSeconds;
  s.scenarioEventStates.find(e => e.id === reward.id).fired = true;
  for (const team of [0, 1]) s.teamFood[team] += reward.foodReward;
  assert.ok(s.teamFood.every(n => n > map.startingResources.food), 'old rematch condition accepts reward alone');
  assert.throws(() => assertGatheringBeforeRewards(s, map, [0, 1], ['food']), /before the first timed supply/);
});
test('bank growth without stock consumption cannot prove a deposit', () => {
  const s = state(); s.teamFood = s.teamFood.map(n => n + 10);
  assert.throws(() => assertGatheringBeforeRewards(s, map, [0, 1], ['food']), /consumed real food stock/);
});
test('stock consumption does not excuse a supply or objective reward', () => {
  const s = state(); bankFood(s); s.scenarioEventStates[0].fired = true;
  assert.throws(() => assertGatheringBeforeRewards(s, map, [0, 1], ['food']), /supply rewards/);
  s.scenarioEventStates[0].fired = false; s.triggerStates[0].owner = 0;
  assert.throws(() => assertGatheringBeforeRewards(s, map, [0, 1], ['food']), /objective rewards/);
});
