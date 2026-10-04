import test from 'node:test';
import assert from 'node:assert/strict';
import { constructionTargetingFixture } from './construction-targeting-fixture.mjs';

const units = Array.from({ length: 10 }, (_, id) => ({ id, team: id < 5 ? 0 : 1,
  kind: id % 5 === 3 ? 'infantry' : 'worker', hp: id % 5 === 4 ? 0 : 100,
  generation: id + 20, serverX: 0, serverZ: 0 }));
for (const team of [0, 1]) for (const type of ['palisade-wall', 'palisade-gate']) {
  const base = team * 5;
  const building = { id: 41, team, type, x: .5, z: .5, complete: false, progress: .2 };
  const fixture = selection => constructionTargetingFixture({ team, units, selection,
    buildings: [building], ...(process.env.CONSTRUCTION_TARGETING_SOURCE
      ? { sourcePath: process.env.CONSTRUCTION_TARGETING_SOURCE } : {}) });
  test(`seat ${team} ${type}: full reserved cell remains pickable through thin or missing art`, () => {
    const f = fixture([base]);
    for (const [x, z] of [[.5, .5], [.05, .95], [.95, .05]]) {
      const point = f.screenAt(x, z);
      assert.equal(f.context.pickBuildingAt(point.x, point.y)?.id, building.id);
    }
    const outside = f.screenAt(1.01, .5);
    assert.equal(f.context.pickBuildingAt(outside.x, outside.y), null);
    f.buildingVisuals.get(building.id).group.visible = false;
    const center = f.screenAt(.5, .5);
    assert.equal(f.context.pickBuildingAt(center.x, center.y), null, 'hidden sites remain unpickable');
  });
  test(`seat ${team} ${type}: contextual construction targets the clicked site and selected living owned Workers`, () => {
    const f = fixture([base, base + 1, base + 3, base + 4, (1 - team) * 5]);
    f.clickAt(.5, .5);
    assert.equal(f.payloads[0]?.type, 'build');
    assert.equal(f.payloads[0].buildingId, 41);
    assert.deepEqual(f.payloads[0].ids, [base, base + 1]);
    assert.deepEqual(f.payloads[0].unitGenerations, [base + 20, base + 21]);
    assert.deepEqual([...f.selected], [base, base + 1, base + 3, base + 4, (1 - team) * 5]);
  });
  test(`seat ${team} ${type}: explicit movement modes, queued Move and military selection retain priority`, () => {
    for (const mode of ['move', 'patrol']) {
      const f = fixture([base]); f.context.persistentTargetMode = mode; f.clickAt(.5, .5);
      assert.equal(f.payloads[0]?.type, 'move');
    }
    const attack = fixture([base]); attack.context.attackMoveMode = true; attack.clickAt(.5, .5);
    assert.equal(attack.payloads[0]?.type, 'move', 'context resolves through existing attack-move handler');
    const queued = fixture([base]); queued.clickAt(.5, .5, true);
    assert.equal(queued.payloads[0]?.type, 'move'); assert.equal(queued.payloads[0]?.queue, true);
    for (const selection of [[], [base + 3], [base + 4], [(1 - team) * 5]]) {
      const f = fixture(selection); f.clickAt(.5, .5);
      assert.notEqual(f.payloads[0]?.type, 'build');
    }
  });
  test(`seat ${team} ${type}: completed sites do not resume and disclosed enemy sites retain attack resolution`, () => {
    const f = fixture([base]); building.complete = true; f.clickAt(.5, .5);
    assert.notEqual(f.payloads[0]?.type, 'build'); building.complete = false;
    const enemy = fixture([base + 3]); enemy.context.localTeam = 1 - team;
    enemy.clickAt(.5, .5); assert.equal(enemy.payloads[0]?.type, 'attackBuilding');
  });
}
