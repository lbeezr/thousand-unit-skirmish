import { createMapImportValidator } from '../src/authoring/map-import-validator.mjs';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import * as mapUtils from '../src/map-utils.mjs';
import * as scenarioRegions from '../src/scenario-regions.mjs';
import { validateMapRegion } from '../src/regions.mjs';
import { validateMapAudioReference } from '../src/audio-event-profile.mjs';
import { findInvalidResourceVariant } from '../src/shore-fishing.mjs';
import { TERRAIN_MATERIALS } from '../src/terrain-materials.mjs';
import { economyResources } from '../src/economy-profile.mjs';
import { GAMEPLAY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { validWildlifeNodeDefinition } from '../src/wildlife-state.mjs';

const map = JSON.parse(await readFile(new URL('../maps/stone-defense-field.json', import.meta.url), 'utf8'));
const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const importer = source.slice(source.indexOf('const mapImportValidator ='), source.indexOf('\nasync function importEditorMap('));
const constants = Object.fromEntries([...source.matchAll(/^const (MAX_[A-Z_]+|MIN_[A-Z_]+) = (\d+);/gm)].map(match => [match[1], Number(match[2])]));
const context = vm.createContext({ createMapImportValidator, ...mapUtils, ...scenarioRegions, ...constants, MAX_PER_TEAM: 1000,
  validateMapRegion, validateMapAudioReference, findInvalidResourceVariant, validWildlifeNodeDefinition, TERRAIN_MATERIALS,
  economyResources, EDITOR_MATERIALS: ['stone', 'forest', 'water'],
  UNIT_DEFINITIONS: GAMEPLAY_DEFINITIONS.units, TECHNOLOGY_DEFINITIONS: GAMEPLAY_DEFINITIONS.technologies });
vm.runInContext(importer, context);

const invalid = [
  { label: 'Wood cannot carry Sheep identity', type: 'wood', fields: { wildlifeSpecies: 'bellweather-sheep' } },
  { label: 'unknown species', fields: { wildlifeSpecies: 'deer' } },
  { label: 'null species', fields: { wildlifeSpecies: null } },
  { label: 'runtime life state', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeState: 'alive' } },
  { label: 'runtime neutral team', fields: { wildlifeTeam: null } },
  { label: 'runtime owned team', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeTeam: 0 } },
  { label: 'runtime motion', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeMotion: {} } },
  { label: 'runtime activity', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeActivity: 'graze' } },
  { label: 'runtime heading', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeHeading: 0 } },
  { label: 'runtime Herd', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeHerd: {} } },
  { label: 'runtime grazing anchor', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeGrazeAnchor: { x: -14, z: 5 } } },
  { label: 'pose requires Sheep identity', fields: { wildlifeNoseYawDegrees: 0 } },
  { label: 'negative authored pose', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeNoseYawDegrees: -1 } },
  { label: 'authored pose outside full turn', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeNoseYawDegrees: 360 } },
  { label: 'string authored pose', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeNoseYawDegrees: '90' } },
  { label: 'null authored pose', fields: { wildlifeSpecies: 'bellweather-sheep', wildlifeNoseYawDegrees: null } },
];
function candidate(spec, index) {
  const value = structuredClone(map); value.id = `wildlife-parity-invalid-${index}`;
  const node = value.resourceNodes.find(node => node.type === (spec.type || 'food'));
  Object.assign(node, spec.fields); return value;
}

for (const [index, spec] of invalid.entries()) test(`actual importer rejects ${spec.label} without mutating input`, () => {
  const value = candidate(spec, index), before = JSON.stringify(value);
  assert.throws(() => context.validateImportedMap(value), /unsupported resource node/);
  assert.equal(JSON.stringify(value), before);
});

test('legacy and valid authored food Sheep keep the exact resource bytes', () => {
  const authored = [{}, { wildlifeSpecies: 'bellweather-sheep' },
    ...[0, 90, 359.99].map(wildlifeNoseYawDegrees => ({ wildlifeSpecies: 'bellweather-sheep', wildlifeNoseYawDegrees }))];
  for (const fields of authored) {
    const value = structuredClone(map);
    delete value.economyProfileId;
    value.resourceNodes = value.resourceNodes.filter(node => node.type !== 'stone');
    Object.assign(value.resourceNodes[0], fields);
    const bytes = JSON.stringify(value.resourceNodes), before = JSON.stringify(value);
    const imported = context.validateImportedMap(value);
    assert.equal(JSON.stringify(imported.resourceNodes), bytes);
    assert.equal(Object.hasOwn(imported, 'economyProfileId'), false, 'legacy omission retains checksum identity');
    assert.equal(JSON.stringify(value), before);
  }
});

test('native publication rejects the same metadata atomically and admits existing authored Sheep', async t => {
  const room = await createFortifiedFixture({ mapPath: 'maps/stone-defense-field.json', timeoutMs: 15_000 });
  t.after(() => room.dispose()); await room.start();
  const host = await room.connect(0), peer = await room.connect(1), before = await room.checkpoint();
  for (const [index, spec] of invalid.entries()) {
    const value = candidate(spec, index), after = host.messages.length;
    host.send({ type: 'publishMap', map: value, persist: true });
    const result = await host.wait(message => ['mapRejected', 'mapPublished'].includes(message.type), spec.label, after);
    assert.equal(result.type, 'mapRejected', spec.label); assert.match(result.message, /invalid or duplicate resource node/);
    assert.equal(host.latest.mapId, map.id); assert.equal(peer.latest.mapId, map.id);
  }
  const afterRejections = await room.checkpoint();
  const retained = await room.checkpoint(snapshot => snapshot.sequence > afterRejections.sequence);
  assert.equal(retained.matchId, before.matchId); assert.equal(retained.mapHash, before.mapHash);
  assert.deepEqual(retained.mapDefinition.resourceNodes, before.mapDefinition.resourceNodes);
  for (const field of ['teamFood', 'teamWood', 'teamStone', 'buildings', 'resourceNodes']) assert.deepEqual(retained.state[field], before.state[field], field);
  const files = await readdir(path.join(room.directory, 'custom')).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  assert.ok(files.every(file => !file.startsWith('wildlife-parity-invalid-')), 'rejected maps are never persisted');
  for (const module of ['wildlife-state.mjs', 'wildlife-motion.mjs', 'wildlife-herding.mjs']) {
    assert.equal((await fetch(`http://127.0.0.1:${room.port}/src/${module}`)).status, 200, 'existing validator dependencies are served');
  }
  const valid = structuredClone(map); valid.id = 'wildlife-parity-valid';
  Object.assign(valid.resourceNodes[0], { wildlifeSpecies: 'bellweather-sheep', wildlifeNoseYawDegrees: 90 });
  const imported = context.validateImportedMap(valid), after = host.messages.length;
  host.send({ type: 'publishMap', map: imported, persist: true });
  const result = await host.wait(message => ['mapRejected', 'mapPublished'].includes(message.type), 'existing authored Sheep admission', after);
  assert.equal(result.type, 'mapPublished', result.message);
  const published = await room.checkpoint(snapshot => snapshot.mapDefinition.id === valid.id);
  assert.deepEqual(published.mapDefinition.resourceNodes, valid.resourceNodes);
  assert.deepEqual(published.state.teamFood, before.state.teamFood); assert.deepEqual(published.state.teamWood, before.state.teamWood);
});
