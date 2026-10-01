import assert from 'node:assert/strict';

// Read-only authoritative checkpoint evidence for this Rootways proof.
export function assertGatheringBeforeRewards(state, map, teams = [0, 1], types = ['food', 'wood']) {
  const firstSupply = Math.min(...map.scenarioEvents.filter(e => e.type === 'timed-supply').map(e => e.afterSeconds));
  assert.ok(state.matchElapsedSeconds < firstSupply, 'gathering must bank before the first timed supply');
  assert.ok(state.scenarioEventStates.every(e => !e.fired), 'supply rewards cannot prove gathering');
  assert.ok(state.triggerStates.every(o => o.owner === -1), 'objective rewards cannot prove gathering');
  for (const team of teams) for (const type of types) {
    assert.ok(['food', 'wood'].includes(type));
    const bank = type === 'food' ? state.teamFood : state.teamWood;
    assert.ok(bank[team] > map.startingResources[type], `team ${team} banked ${type}`);
    const id = `s${team}-${type === 'food' ? 0 : 1}`;
    const node = state.resourceNodes.find(n => n.id === id);
    assert.ok(node?.stock < map.resourceNodes.find(n => n.id === id)?.stock,
      `team ${team} consumed real ${type} stock`);
  }
}
