import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { SHEEP_HEAD_BODY_OFFSET_DEGREES, SHEEP_HEAD_BODY_OFFSET_RADIANS,
  authoredWildlifeBodyHeading, authoredWildlifeNoseHeading, bodyHeadingFromLegacyNose,
  legacyNoseHeadingFromBody, migrateWildlifeHeadingCheckpoint, normalizeWildlifeHeading,
  wildlifeDirection } from '../src/wildlife-heading.mjs';
import { createResourceNodeState } from '../src/wildlife-state.mjs';
import { createWildlifeMotion, stepWildlifeMotion } from '../src/wildlife-motion.mjs';
import { createNeutralWildlifeRenderer } from '../src/neutral-wildlife-renderer.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

const TAU = Math.PI * 2, SECTOR = Math.PI / 4;
const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const definition = { id: 'heading-sheep', type: 'food', stock: 130, x: .5, z: .5, wildlifeSpecies: 'bellweather-sheep' };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('authored legacy nose and omitted nose zero initialize canonical body yaw with the exact admitted offset', () => {
  const binding = JSON.parse(readFileSync(new URL('../assets/wildlife/bellweather-sheep-static-v1/static-preview-binding.json', import.meta.url)));
  assert.equal(SHEEP_HEAD_BODY_OFFSET_DEGREES, binding.headBodyOffsetDegrees);
  assert.equal(SHEEP_HEAD_BODY_OFFSET_RADIANS, 42.03499984741211 * Math.PI / 180);
  assert.equal(normalizeWildlifeHeading(-Number.MIN_VALUE), 0, 'roundoff near zero cannot produce invalid yaw 2π');
  assert.equal(normalizeWildlifeHeading(-Number.EPSILON / 2), 0);
  for (const nose of [undefined, 0, ...directions.map((_, index) => index * 45), 359.999]) {
    const authored = { ...definition, ...(nose === undefined ? {} : { wildlifeNoseYawDegrees: nose }) };
    const heading = createWildlifeMotion(authored).heading;
    near(heading, normalizeWildlifeHeading((nose ?? 0) * Math.PI / 180 - SHEEP_HEAD_BODY_OFFSET_RADIANS));
    assert.equal(heading, authoredWildlifeBodyHeading(authored));
    near(legacyNoseHeadingFromBody(heading), authoredWildlifeNoseHeading(authored));
  }
  const bodyForward = { ...definition, wildlifeNoseYawDegrees: SHEEP_HEAD_BODY_OFFSET_DEGREES };
  assert.equal(createWildlifeMotion(bodyForward).heading, 0);
  const node = createResourceNodeState(definition);
  Object.assign(node.wildlifeMotion, { waitTicks: 0, targetX: node.x + .2, targetZ: node.z });
  stepWildlifeMotion(node, definition, { canStep: () => true });
  assert.equal(node.wildlifeMotion.heading, Math.PI / 2, 'actual +X movement is canonical body yaw +90°, with no art offset');
});

test('all eight world sectors and exact halfway ties are stable across wrapping and legacy conversion', () => {
  for (let index = 0; index < 8; index++) {
    const center = index * SECTOR, tie = (index + .5) * SECTOR, next = directions[(index + 1) % 8];
    for (const turns of [-1, 0, 1]) {
      assert.equal(wildlifeDirection(center + turns * TAU), directions[index]);
      assert.equal(wildlifeDirection(tie + turns * TAU), next, `tie ${index}, turns ${turns}`);
      assert.equal(wildlifeDirection(tie - 1e-10 + turns * TAU), directions[index]);
      assert.equal(wildlifeDirection(tie + 1e-10 + turns * TAU), next);
    }
    assert.equal(wildlifeDirection(legacyNoseHeadingFromBody(bodyHeadingFromLegacyNose(tie))), next);
    assert.equal(wildlifeDirection(legacyNoseHeadingFromBody(bodyHeadingFromLegacyNose(tie - 1e-10))), directions[index]);
  }
});

test('canonical snapshots and authored fallback select identical existing stills at every sector/tie and camera quarter rotation', async () => {
  const scene = new THREE.Scene(), poses = [];
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  const template = { mesh, supports: () => true, update: pose => { poses.push(pose); return true; }, dispose: () => {} };
  const renderer = createNeutralWildlifeRenderer({ THREE, scene, groundHeight: () => .2, loadArt: () => template });
  const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 100);
  try {
    for (const angle of [undefined, ...directions.flatMap((_, index) => [index * SECTOR, (index + .5) * SECTOR])]) {
      const authored = { ...definition, ...(angle === undefined ? {} : { wildlifeNoseYawDegrees: angle * 180 / Math.PI }) };
      renderer.reset([authored]); await renderer.ready();
      const row = { id: authored.id, type: 'food', stock: authored.stock, wildlifeSpecies: authored.wildlifeSpecies, wildlifeState: 'alive' };
      const expected = wildlifeDirection(angle ?? 0);
      for (let quarter = 0; quarter < 4; quarter++) {
        const yaw = Math.PI / 4 + quarter * Math.PI / 2;
        camera.position.set(Math.sin(yaw) * 10, 10, Math.cos(yaw) * 10);
        camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
        renderer.reconcile([row], () => true); renderer.update(camera);
        assert.equal(poses.at(-1).directionId, expected, 'authored fallback remains nose-labelled');
        renderer.reconcile([{ ...row, wildlifeHeading: authoredWildlifeBodyHeading(authored) }], () => true);
        renderer.update(camera);
        assert.equal(poses.at(-1).directionId, expected, 'body snapshot receives exactly one still-only offset, independent of billboard camera');
        assert.equal(poses.at(-1).moving, false);
      }
    }
  } finally { renderer.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); }
});

function legacyCheckpoint() {
  const definitions = ['alive', 'carcass', 'depleted'].map((state, index) => ({ ...definition, id: state, x: index + .5 }));
  const resourceNodes = definitions.map((authored, index) => {
    const node = createResourceNodeState(authored), state = ['alive', 'carcass', 'depleted'][index];
    Object.assign(node, { x: authored.x + .1, z: authored.z - .05, stock: [130, 42.5, 0][index], wildlifeState: state, wildlifeTeam: index === 0 ? 1 : 0,
      wildlifeGrazeAnchor: { x: authored.x + .08, z: authored.z },
      wildlifeHerd: index === 0 ? { team: 1, goalX: 5.5, goalZ: 3.5, goalCell: 45, path: [12, 13, 21], pathIndex: 1 } : null });
    Object.assign(node.wildlifeMotion, { sequence: 17, waitTicks: index === 0 ? 0 : 90,
      targetX: authored.x + .2, targetZ: authored.z, heading: index * SECTOR,
      activity: index === 0 ? 'wandering' : 'idle' });
    return node;
  });
  return { schemaVersion: 28, mapDefinition: { resourceNodes: definitions }, state: { resourceNodes,
    units: [{ cargo: 1.25, cargoType: 'food', path: [2, 3] }], teamFood: [151, 152], teamWood: [201, 202], teamStone: [0, 0] } };
}

test('exact schema28 migration changes only every saved Sheep heading and schema, once, including frozen and herded states', () => {
  const checkpoint = legacyCheckpoint(), expected = structuredClone(checkpoint);
  for (const node of expected.state.resourceNodes) node.wildlifeMotion.heading = bodyHeadingFromLegacyNose(node.wildlifeMotion.heading);
  expected.schemaVersion = 29;
  assert.equal(migrateWildlifeHeadingCheckpoint(checkpoint), true);
  assert.deepEqual(checkpoint, expected, 'stock, claim, actual pose, anchors, path/progress, sequence/wait/activity, cargo and banks remain exact');
  assert.equal(migrateWildlifeHeadingCheckpoint(checkpoint), false);
  assert.deepEqual(checkpoint, expected, 'schema29 cannot subtract the offset again');
});

test('malformed legacy headings or ambiguous identity cannot be repaired or partially converted', () => {
  for (const change of [
    value => { value.schemaVersion = 27; }, value => { value.schemaVersion = '28'; },
    value => { delete value.state.resourceNodes; }, value => { delete value.mapDefinition.resourceNodes; },
    value => { delete value.state.resourceNodes[1].wildlifeMotion; },
    value => { value.state.resourceNodes[1].wildlifeMotion = []; },
    ...[undefined, NaN, Infinity, -1, TAU, '0'].map(heading => value => { value.state.resourceNodes[1].wildlifeMotion.heading = heading; }),
    value => { value.state.resourceNodes[1].wildlifeSpecies = 'deer'; },
    value => { value.state.resourceNodes[1].id = 'unknown'; },
    value => { value.state.resourceNodes[1].id = value.state.resourceNodes[0].id; },
    value => { value.mapDefinition.resourceNodes.push(value.mapDefinition.resourceNodes[0]); },
  ]) {
    const checkpoint = legacyCheckpoint(); change(checkpoint); const before = structuredClone(checkpoint);
    assert.equal(migrateWildlifeHeadingCheckpoint(checkpoint), false); assert.deepEqual(checkpoint, before);
  }
});

test('real server schema23→29 chain converts authored nose once and schema28 recovery retains in-flight Herd', async t => {
  const base = JSON.parse(readFileSync(new URL('../maps/open-field.json', import.meta.url)));
  const map = { ...base, id: 'sheep-heading-replay', name: 'SHEEP HEADING REPLAY', width: 32, height: 24,
    terrainBase: 'meadow', startingArmySize: 8, fogOfWar: true, startingResources: { food: 150, wood: 250 },
    spawnPoints: [{ team: 0, x: -10.5, z: -4.5 }, { team: 1, x: 10.5, z: -4.5 }],
    obstacles: [], scenarioEvents: [], triggers: [], resourceNodes: [
      { ...definition, x: -8.5, z: -4.5, wildlifeNoseYawDegrees: 225 },
      { ...definition, id: 'implicit-nose', x: 8.5, z: -4.5 },
    ] };
  const fixture = await createPathingReplayFixture(map), r = fixture.replay;
  t.after(() => fixture.dispose());
  const original = r.checkpoint(), legacy = structuredClone(original); legacy.schemaVersion = 23;
  for (const team of [0, 1]) {
    const publicNode = r.snapshot(team).resourceNodes.find(node => node.id === map.resourceNodes[team].id);
    assert.equal(publicNode.wildlifeHeading, authoredWildlifeBodyHeading(map.resourceNodes[team]));
    assert.equal(Object.hasOwn(publicNode, 'wildlifeMotion'), false, 'the public heading does not disclose private motion');
  }
  delete legacy.matchModeId; delete legacy.matchModeVersion;
  for (const node of legacy.state.resourceNodes) {
    delete node.wildlifeMotion; delete node.wildlifeTeam; delete node.wildlifeHerd; delete node.wildlifeGrazeAnchor;
  }
  for (const unit of legacy.state.units) for (const field of ['combatStance', 'stanceAnchorX', 'stanceAnchorZ', 'stanceCombat', 'stanceReturning']) delete unit[field];
  r.restore(legacy);
  const migrated = r.checkpoint(); assert.equal(migrated.schemaVersion, 29);
  for (const authored of map.resourceNodes) {
    const node = migrated.state.resourceNodes.find(value => value.id === authored.id);
    assert.equal(node.wildlifeMotion.heading, authoredWildlifeBodyHeading(authored));
    assert.equal(node.wildlifeMotion.sequence, 0); assert.equal(node.wildlifeTeam, null);
    assert.equal(node.stock, authored.stock); assert.equal(node.x, authored.x); assert.equal(node.z, authored.z);
  }
  for (const field of ['teamFood', 'teamWood', 'teamStone']) assert.deepEqual(migrated.state[field], original.state[field]);
  r.restore(structuredClone(migrated)); assert.deepEqual(r.checkpoint().state.resourceNodes, migrated.state.resourceNodes);
  for (let tick = 0; tick < 4; tick++) r.step();
  assert.equal(r.resources.get(definition.id).wildlifeTeam, 0);
  const notices = r.order(0, { type: 'herd', nodeId: definition.id, x: -5.5, z: -4.5, resourceEpoch: r.checkpoint().state.forestEpoch });
  assert.ok(notices.some(value => /^HERD ORDER/.test(value.message)), JSON.stringify(notices));
  for (let tick = 0; tick < 20; tick++) r.step();
  const inFlight = r.checkpoint(), old = structuredClone(inFlight); old.schemaVersion = 28;
  for (const node of old.state.resourceNodes) node.wildlifeMotion.heading = legacyNoseHeadingFromBody(node.wildlifeMotion.heading);
  const expected = structuredClone(old); migrateWildlifeHeadingCheckpoint(expected);
  r.restore(old);
  assert.deepEqual(r.checkpoint().state, expected.state, 'real 28→29 restore keeps every field except the prescribed heading conversion');
  r.validate(structuredClone(r.checkpoint()));
  const current = r.checkpoint(); r.restore(structuredClone(current));
  assert.deepEqual(r.checkpoint().state, current.state, 'current restore is stable');
  for (let tick = 0; tick < 90; tick++) r.step();
  const replayed = r.checkpoint().state;
  r.restore(structuredClone(current)); for (let tick = 0; tick < 90; tick++) r.step();
  assert.deepEqual(r.checkpoint().state, replayed, 'checkpoint recovery resumes the exact accepted path and motion');
});
