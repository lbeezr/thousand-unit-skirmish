import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaterStudyFishBinding } from '../src/water-study-fish-binding.mjs';
import { createWaterSurfaceStudy } from '../src/water-surface-study.mjs';
import { selectWaterStudyFish } from '../src/water-study-state.mjs';
import { shoreFishSitePositions } from '../src/shore-fishing-placement.mjs';

const node = { id: 'bank-fish', type: 'food', resourceVariant: 'shore-fish', x: -1.5, z: -.5, stock: 60 };
const map = () => ({ id: 'fish-test', width: 8, height: 8, terrainSeed: 17, terrainBase: 'meadow', fogOfWar: true,
  obstacles: [{ column: 3, row: 1, width: 4, height: 6, material: 'water' }], resourceNodes: [{ ...node }] });
const wire = stock => ({ id: node.id, type: 'food', resourceVariant: 'shore-fish', stock });
function visibility(entries = [[26, 2], [27, 2]]) {
  const bytes = Buffer.alloc(16);
  for (const [cell, state] of entries) bytes[cell >> 2] |= state << ((cell & 3) * 2);
  return { columns: 8, rows: 8, data: bytes.toString('base64') };
}
const state = () => ({ type: 'state', mapId: 'fish-test', fogOfWar: true, resourceNodes: [wire(22.5)], visibility: visibility() });
function fixture(definition = map()) {
  let schools = [];
  const surface = { userData: { updateWaterStudyFish(snapshot) { schools = selectWaterStudyFish(definition, snapshot); return schools; } } };
  const binding = createWaterStudyFishBinding(definition, surface);
  return { binding, schools: () => schools };
}
function dispose(mesh) {
  mesh.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
  for (const texture of mesh.userData.ownedGroundTextures || []) texture.dispose();
}

test('wire nodes have no position: current stock joins the shared authored bank/water sites', () => {
  const definition = map(), before = structuredClone(definition), f = fixture(definition), packet = state();
  assert.deepEqual(f.schools(), []);
  const [school] = f.binding.update(packet);
  const [site] = shoreFishSitePositions(definition);
  assert.deepEqual({ x: school.x, z: school.z }, { x: site.water.x, z: site.water.z });
  assert.deepEqual({ x: school.approachX, z: school.approachZ }, site.land);
  assert.deepEqual(definition, before);
  assert.equal(packet.resourceNodes[0].x, undefined);
  assert.equal(f.binding.update({ ...packet, resourceNodes: [wire(.001)] }).length, 1, 'fractional positive stock remains active');
});

test('current bank and fixed water cell must both be visible, including packed byte boundaries', () => {
  const f = fixture();
  for (const bank of [0, 1, 3]) for (const water of [0, 1, 2, 3]) {
    f.binding.update(state());
    assert.deepEqual(f.binding.update({ ...state(), visibility: visibility([[26, bank], [27, water]]) }), []);
  }
  for (const water of [0, 1, 3]) {
    assert.deepEqual(f.binding.update({ ...state(), visibility: visibility([[26, 2], [27, water]]) }), []);
  }
  const corner = map();
  corner.resourceNodes[0].x = -1.1; corner.resourceNodes[0].z = -.9;
  corner.obstacles.push({ column: 2, row: 2, width: 1, height: 1, material: 'water' });
  const c = fixture(corner);
  // Above (18) and right (27) are valid; above is nearer. Visible right cannot relocate the school.
  assert.deepEqual(c.binding.update({ ...state(), visibility: visibility([[26, 2], [27, 2]]) }), []);
  assert.equal(c.binding.update({ ...state(), visibility: visibility([[26, 2], [18, 2]]) })[0].waterCell, 18);
  corner.resourceNodes[0].x = -1.5; corner.resourceNodes[0].z = -.5;
  assert.equal(shoreFishSitePositions(corner)[0].water.row, 2, 'equal distances use stable lower cell index');
});

test('missing, stale, malformed and contradictory packets immediately clear prior activity', () => {
  const f = fixture();
  const packet = state();
  for (const bad of [null, {}, { ...packet, mapId: 'other-map' }, { ...packet, fogOfWar: false },
    { ...packet, resourceNodes: null }, { ...packet, resourceNodes: [] }, { ...packet, visibility: undefined },
    { ...packet, visibility: null }, { ...packet, visibility: { ...visibility(), columns: 9 } },
    { ...packet, visibility: { ...visibility(), rows: 9 } }, { ...packet, visibility: { ...visibility(), data: '!' } },
    { ...packet, visibility: { ...visibility(), data: 'AA==' } },
    { ...packet, visibility: { ...visibility(), data: null } }]) {
    assert.equal(f.binding.update(packet).length, 1);
    assert.deepEqual(f.binding.update(bad), []);
    assert.deepEqual(f.schools(), []);
  }
  for (const stock of [0, -1, NaN, Infinity, undefined]) {
    assert.deepEqual(f.binding.update({ ...packet, resourceNodes: [wire(stock)] }), []);
  }
  for (const live of [null, { ...wire(1), type: 'wood' }, { ...wire(1), resourceVariant: undefined },
    { ...wire(1), wildlifeSpecies: 'bellweather-sheep' }, { ...wire(1), wildlifeState: 'alive' }]) {
    assert.deepEqual(f.binding.update({ ...packet, resourceNodes: [live] }), []);
  }
});

test('unrestricted visibility requires explicit no-fog map or the current spectator seat', () => {
  const noFog = map(); noFog.fogOfWar = false;
  const n = fixture(noFog), packet = { ...state(), fogOfWar: false, visibility: null };
  assert.equal(n.binding.update(packet).length, 1);
  assert.deepEqual(n.binding.update({ ...packet, visibility: undefined }), []);
  const f = fixture();
  assert.equal(f.binding.update({ ...state(), visibility: null }, { spectator: true }).length, 1);
  assert.deepEqual(f.binding.update({ ...state(), visibility: null }, { spectator: false }), []);
  assert.deepEqual(f.binding.update({ ...state(), visibility: undefined }, { spectator: true }), []);
  assert.deepEqual(f.binding.update({ ...state(), visibility: visibility([]) }, { spectator: true }), [], 'supplied fog still restricts spectators');
});

test('live rendering clears, recovers and preserves low-quality/reduced-motion gates', () => {
  const definition = map(), mesh = createWaterSurfaceStudy(definition), ripples = mesh.children[0];
  const binding = createWaterStudyFishBinding(definition, mesh);
  binding.update(state()); assert.equal(ripples.count, 1); assert.equal(ripples.visible, true);
  binding.clear(); assert.equal(ripples.count, 0); assert.equal(ripples.visible, false);
  binding.update(state()); assert.equal(ripples.visible, true, 'fresh recovery snapshot enables activity');
  const otherMap = { ...definition, id: 'new-map' };
  const other = createWaterStudyFishBinding(otherMap, mesh);
  assert.equal(ripples.count, 0, 'map rebinding begins empty');
  assert.deepEqual(other.update(state()), []);
  other.update({ ...state(), mapId: otherMap.id }); assert.equal(ripples.count, 1);
  mesh.userData.setWaterStudyMotion(true);
  other.update({ ...state(), mapId: otherMap.id }); assert.equal(ripples.visible, false);
  const low = createWaterSurfaceStudy(definition, { quality: 'low' });
  assert.deepEqual(createWaterStudyFishBinding(definition, low).update(state()), []);
  assert.equal(low.children.length, 0);
  dispose(mesh); dispose(low);
});

test('32-school budget survives current wire order and invalid rows without admitting wildlife', () => {
  const definition = map();
  definition.resourceNodes = Array.from({ length: 40 }, (_, i) => ({ ...node, id: `fish-${String(i).padStart(2, '0')}` }));
  const f = fixture(definition), rows = definition.resourceNodes.map(({ id }) => ({ ...wire(1), id }));
  const first = f.binding.update({ ...state(), resourceNodes: [null, ...rows] });
  assert.equal(first.length, 32);
  assert.deepEqual(f.binding.update({ ...state(), resourceNodes: [...rows].reverse() }), first);
});
