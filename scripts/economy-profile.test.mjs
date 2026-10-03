import assert from 'node:assert/strict';
import test from 'node:test';
import { GAMEPLAY_DEFINITIONS, GAMEPLAY_RULESET_REVISION, BUILDING_DEFINITIONS, validateGameplayDefinitions } from '../src/gameplay-definitions.mjs';
import { DEFAULT_ECONOMY_PROFILE_ID as BASE, STONE_ECONOMY_PROFILE_ID as STONE,
  resolveEconomyProfileId, economyResources, economyRulesetRevision, constructionCostForProfile,
  acceptsProfileDropoff, validateEconomyCost, debitEconomyCost, proportionalEconomyRefund,
  creditEconomyRefund } from '../src/economy-profile.mjs';

test('Stone is explicit and preserves every baseline price and canonical pin', () => {
  assert.equal(resolveEconomyProfileId(), BASE);
  for (const value of [null, '', 'stone', 'gold-v1', {}, []]) assert.throws(() => resolveEconomyProfileId(value));
  assert.deepEqual(economyResources(), ['food', 'wood']);
  assert.deepEqual(economyResources(STONE), ['food', 'wood', 'stone']);
  assert.equal(economyRulesetRevision(BASE), GAMEPLAY_RULESET_REVISION);
  assert.notEqual(economyRulesetRevision(STONE), GAMEPLAY_RULESET_REVISION);
  for (const type of Object.keys(BUILDING_DEFINITIONS)) {
    assert.deepEqual(constructionCostForProfile(type), BUILDING_DEFINITIONS[type].cost);
    assert.deepEqual(constructionCostForProfile(type, STONE), type === 'watchtower'
      ? { food: 50, wood: 150, stone: 50 } : BUILDING_DEFINITIONS[type].cost);
  }
  assert.deepEqual(BUILDING_DEFINITIONS.watchtower.cost, { food: 50, wood: 150 });
  for (const type of Object.keys(BUILDING_DEFINITIONS)) {
    assert.equal(acceptsProfileDropoff(type, 'stone'), false);
    assert.equal(acceptsProfileDropoff(type, 'stone', STONE), ['town-center', 'storehouse'].includes(type));
    for (const resource of ['food', 'wood']) assert.equal(acceptsProfileDropoff(type, resource, STONE),
      BUILDING_DEFINITIONS[type].dropoff?.includes(resource) === true);
  }
});

test('missing price/bank keys and unsupported mineral keys cannot produce ignored payments', () => {
  for (const cost of [null, [], { wood: 1 }, { food: 1 }, { food: NaN, wood: 1 }, { food: 0, wood: -1 }]) {
    assert.throws(() => validateEconomyCost(cost, STONE));
  }
  for (const resource of ['stone', 'gold', 'copper', 'stnoe']) for (const amount of [0, 100]) {
    const cost = { food: 0, wood: 0, [resource]: amount };
    assert.throws(() => validateEconomyCost(cost, BASE));
    if (resource !== 'stone') assert.throws(() => validateEconomyCost(cost, STONE));
    for (const category of ['buildings', 'units', 'technologies']) {
      const copy = structuredClone(GAMEPLAY_DEFINITIONS);
      Object.values(copy[category])[0].cost = cost;
      assert.throws(() => validateGameplayDefinitions(copy), /Unsupported cost resource/);
    }
  }
  const cost = constructionCostForProfile('watchtower', STONE);
  for (const balance of [{ food: 100, wood: 300 }, { food: 100, wood: 300, stone: undefined },
    { food: 100, wood: 300, stone: NaN }, { food: 100, wood: 300, stone: 50, gold: 0 }]) {
    assert.throws(() => debitEconomyCost(balance, cost, STONE), /missing resource bank/);
  }
});

test('paid Stone defense rejects fractional shortfalls atomically and refunds only unbuilt stock', () => {
  const cost = constructionCostForProfile('watchtower', STONE);
  const shortage = { food: 100.25, wood: 300.5, stone: 49.9999 };
  assert.equal(debitEconomyCost(shortage, cost, STONE), null);
  assert.deepEqual(shortage, { food: 100.25, wood: 300.5, stone: 49.9999 });
  const balance = { food: 100.25, wood: 300.5, stone: 50 + 10 / 3 };
  const original = structuredClone(balance);
  const paid = debitEconomyCost(balance, cost, STONE);
  assert.deepEqual(balance, original, 'debit never partially mutates the input bank');
  const refund = proportionalEconomyRefund(cost, 14, 35, STONE);
  assert.deepEqual(refund, { food: 20, wood: 60, stone: 20 });
  const cancelled = creditEconomyRefund(paid, refund, STONE);
  for (const resource of economyResources(STONE)) {
    assert.ok(Math.abs(cancelled[resource] + cost[resource] - refund[resource] - original[resource]) < 1e-12);
  }
  assert.equal(proportionalEconomyRefund(cost, 0, 35, STONE).stone, 0);
  assert.equal(proportionalEconomyRefund(cost, 35, 35, STONE).stone, 50);
  assert.equal(creditEconomyRefund(paid, { food: 0, wood: 75 }, STONE).stone, paid.stone,
    'ordinary training refund cannot invent Stone');
  assert.throws(() => proportionalEconomyRefund(cost, 10, 0, STONE));
});
