// Bounded ordinary-game listening cases. No game state or browser is created here.
import assert from 'node:assert/strict';
import { UNIT_DEFINITIONS as U, BUILDING_DEFINITIONS as B, TECHNOLOGY_DEFINITIONS as T } from '../src/gameplay-definitions.mjs';
import { matureSettlementPlan } from './mature-settlement-scenario.mjs';

export const STAGING_ORIGIN = 'https://game-staging-21f9.up.railway.app';
export const SUBSET_TIMEOUT_MS = 300000;
export const buildingGroups = Object.freeze({
  home: ['town-center', 'house', 'storehouse', 'mill'],
  training: ['barracks', 'archery-range', 'stable'],
  defense: ['watchtower', 'palisade-wall', 'palisade-gate'],
  special: ['farm', 'dock', 'workshop'],
});
export const rosterSubsets = Object.freeze([
  ...Object.keys(U).map(kind => `unit-${kind}`),
  ...Object.keys(buildingGroups).map(group => `buildings-${group}`),
  'worker-jobs',
]);
export function validateStagingOrigin(value) {
  assert.equal(value, STAGING_ORIGIN, 'only the reviewed public staging origin is admitted');
  return value;
}
export function rosterPlan(subset) {
  assert.ok(rosterSubsets.includes(subset), 'unknown audio subset');
  const kind = subset.startsWith('unit-') ? subset.slice(5) : null;
  const workerJobs = subset === 'worker-jobs';
  const buildings = kind || workerJobs ? [] : buildingGroups[subset.slice(10)];
  const actions = kind === 'skiff' ? ['ready', 'select', 'move', 'stop', 'hold', 'gather.food', 'return-cargo']
    : kind ? ['ready', 'select', 'move', 'stop', 'hold', 'patrol', 'follow', 'attack', ...(kind === 'worker' ? ['gather.wood'] : [])] : [];
  return { subset, kind, buildings, workerJobs, keys: workerJobs
    ? ['build', 'gather.food', 'return-cargo', 'gather.farm', 'gather.fish', 'gather.stone', 'gather.sheep-carcass'].map(action => `unit.worker.${action}`)
    : kind ? actions.map(action => `unit.${kind}.${action}`)
    : buildings.map(type => `building.${type}.select`), timeoutMs: SUBSET_TIMEOUT_MS };
}
export function rosterMap(subset) {
  const plan = rosterPlan(subset);
  const map = structuredClone(matureSettlementPlan.map);
  map.id = `audio-${subset}`; map.name = `Audio ${subset}`;
  map.terrainBase = 'meadow';
  // Existing finite Skiff fishing proof's shoreline and paid Dock coordinates.
  if (plan.kind === 'skiff' || plan.buildings.includes('dock') || plan.workerJobs) {
    map.obstacles = [18, 43].map(column => ({ column, row: 42, width: 6, height: 8, material: 'water' }));
    map.resourceNodes.push({ id: 'audio-fish', type: 'food', resourceVariant: 'shore-fish', x: -9.5, z: 9.5, stock: 200 });
  }
  if (plan.workerJobs) {
    map.economyProfileId = 'stone-defense-v1';
    map.resourceNodes.push({ id: 'audio-stone', type: 'stone', x: -17.5, z: 15.5, stock: 200 },
      { id: 'audio-sheep', type: 'food', wildlifeSpecies: 'bellweather-sheep', x: -23.5, z: 8.5, stock: 200 });
  }
  return map;
}
export function buildingPad(type) {
  if (type === 'dock') return { x: -12.5, z: 8.5 };
  const pad = matureSettlementPlan.pads.find(row => row[0] === type);
  assert.ok(pad, 'a reviewed paid-building pad is required');
  return { x: pad[1], z: pad[2] };
}
// Resolve actual paid prerequisites; no scenario rewards, spawn commands or
// saved-state editing stand in for construction, research or unit production.
export function paidUnitPlan(kind) {
  assert.ok(U[kind]);
  const producer = Object.values(B).find(building => building.products.includes(kind));
  assert.ok(producer);
  return [
    { build: 'house' },
    ...(producer.requires ?? []).map(research => ({ research, at: T[research].building })),
    ...(producer.id === 'town-center' ? [] : [{ build: producer.id }]),
    ...(U[kind].requires ?? []).map(research => ({ research, at: T[research].building })),
    { train: kind, at: producer.id },
  ];
}
export function recordingCoverage(allKeys, plannedKeys, recordings) {
  const captured = recordings.filter(row => row.validated === true && row.ordinaryActionObserved === true).map(row => row.key);
  assert.equal(new Set(captured).size, captured.length, 'duplicate recording receipt');
  assert.ok(captured.every(key => plannedKeys.includes(key)), 'recording outside this subset');
  return { plannedKeys: [...plannedKeys], capturedKeys: captured,
    missingPlannedKeys: plannedKeys.filter(key => !captured.includes(key)),
    missingRuntimeKeys: allKeys.filter(key => !captured.includes(key)),
    listeningReview: 'pending', humanPlaytest: 'not-performed' };
}
