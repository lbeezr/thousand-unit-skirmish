import assert from 'node:assert/strict';
import test from 'node:test';
import { ownedPopulationReadout } from '../src/client/hud/population-readout.mjs';
import { teamPopulation } from '../src/population.mjs';
import { privateProductionView } from '../src/snapshot-private-production.mjs';

test('population compatibility preserves only the existing named binding', async () => {
  const legacy = await import('../src/population-readout.mjs');
  const current = await import('../src/client/hud/population-readout.mjs');
  assert.deepEqual(Object.keys(legacy), ['ownedPopulationReadout']);
  assert.deepEqual(Object.keys(current), ['ownedPopulationReadout']);
  assert.equal(legacy.ownedPopulationReadout, current.ownedPopulationReadout);
});

function fixture(team) {
  return {
    openingArmySize: 24,
    units: [
      { team, kind: 'worker', hp: 100 }, { team, kind: 'rider', hp: 100 },
      { team, kind: 'siege-engine', hp: 100 }, { team, kind: 'infantry', hp: 0 },
      { team: 1 - team, kind: 'siege-engine', hp: 100 },
    ],
    buildings: [
      { team, type: 'stable', complete: true, productionQueue: ['rider'] },
      { team, type: 'workshop', complete: true, productionQueue: ['siege-engine'] },
      { team, type: 'house', complete: false, productionQueue: [] },
    ],
    workerProduction: [{ queue: 0 }, { queue: 0 }],
  };
}

for (const team of [0, 1]) {
  test(`seat ${team} presents weighted population and reserves every paid queue`, () => {
    const state = fixture(team);
    state.workerProduction[team].queue = 2;
    const record = teamPopulation(state, team);
    assert.deepEqual(record, { used: 6, reserved: 7, capacity: 15, available: 2 });
    assert.equal(state.units.filter(unit => unit.team === team && unit.hp > 0).length, 3);
    const records = [null, null]; records[team] = Object.freeze(record);
    const view = ownedPopulationReadout(records, team);
    assert.equal(view.compact, '6+7/15');
    assert.equal(view.detail, 'POPULATION · 6 USED + 7 QUEUED / 15');
    assert.equal(view.description, 'Population: 6 used, 7 queued, capacity 15.');
    assert.deepEqual(record, teamPopulation(state, team), 'presentation cannot mutate authoritative accounting');
  });

  test(`seat ${team} remains private in no-fog and spectator payloads`, () => {
    const records = [{ used: 12, reserved: 3, capacity: 15, available: 0 },
      { used: 23, reserved: 6, capacity: 44, available: 15 }];
    const payload = { units: [], buildings: [], population: records };
    const masked = privateProductionView(payload, team);
    assert.equal(masked.population[1 - team], null);
    assert.equal(ownedPopulationReadout(masked.population, team).compact,
      team === 0 ? '12+3/15' : '23+6/44');
    assert.equal(ownedPopulationReadout(privateProductionView(payload, null).population, null).compact, '—');
    const privateSlots = [];
    privateSlots[team] = records[team];
    Object.defineProperty(privateSlots, 1 - team, { get() { throw Error('enemy population was accessed'); } });
    assert.equal(ownedPopulationReadout(privateSlots, team).compact, team === 0 ? '12+3/15' : '23+6/44');
  });

  test(`seat ${team} updates through queue, House, death, checkpoint and reset lifecycle`, () => {
    let state = fixture(team);
    const compact = () => {
      const records = [null, null]; records[team] = teamPopulation(state, team);
      return ownedPopulationReadout(records, team).compact;
    };
    assert.equal(compact(), '6+5/15');
    state.workerProduction[team].queue = 2;
    assert.equal(compact(), '6+7/15', 'reservation appears before spawn');
    state.buildings[2].complete = true;
    assert.equal(compact(), '6+7/23');
    state.buildings[0].productionQueue.shift(); state.units.push({ team, kind: 'rider', hp: 100 });
    assert.equal(compact(), '8+5/23', 'spawn moves two slots from reserved to used');
    state.workerProduction[team].queue = 0;
    assert.equal(compact(), '8+3/23', 'canceling Worker production releases reservations');
    state.units[0].hp = 0;
    assert.equal(compact(), '7+3/23', 'death releases used population');
    state.buildings.pop();
    assert.equal(compact(), '7+3/15', 'House loss changes capacity without erasing paid queues');
    state = JSON.parse(JSON.stringify(state));
    assert.equal(compact(), '7+3/15', 'checkpoint restoration projects the same record');
    state = fixture(team);
    assert.equal(compact(), '6+5/15', 'reset has no previous queue or House capacity');
  });
}

test('unassigned and invalid seats never inspect available private records', () => {
  const records = new Proxy([], { get() { throw Error('unassigned seat accessed private data'); } });
  for (const team of [null, undefined, -1, 2, '0', NaN]) {
    assert.deepEqual(ownedPopulationReadout(records, team), {
      compact: '—', detail: 'POPULATION · JOIN A TEAM', description: 'Population: join a team.',
    });
  }
});

test('missing or malformed owned data clears to connecting, with no inferred value', () => {
  const valid = { used: 12, reserved: 3, capacity: 15, available: 0 };
  for (const record of [null, {}, { ...valid, used: -1 }, { ...valid, reserved: '3' },
    { ...valid, capacity: NaN }, { ...valid, available: 0.5 }]) {
    assert.deepEqual(ownedPopulationReadout([record, valid], 0), {
      compact: '—', detail: 'POPULATION · CONNECTING', description: 'Population: connecting.',
    });
  }
  assert.equal(ownedPopulationReadout(undefined, 1).compact, '—');
});

test('a full or over-capacity snapshot keeps the authoritative counts and House guidance', () => {
  for (const used of [12, 19, 1000]) {
    const record = { used, reserved: 3, capacity: 15, available: 0 };
    const view = ownedPopulationReadout([record, null], 0);
    assert.equal(view.compact, `${used}+3/15`);
    assert.match(view.detail, /BUILD A HOUSE$/);
    assert.match(view.description, /No capacity available; build a House\.$/);
  }
});
