import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(await readFile(path.join(root, 'maps/forked-vale.json'), 'utf8'));
const { width, height } = map;
const blocked = new Uint8Array(width * height);
const material = new Array(width * height).fill('');
for (const obstacle of map.obstacles) {
  for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
    for (let column = obstacle.column; column < obstacle.column + obstacle.width; column++) {
      const index = row * width + column;
      assert.equal(blocked[index], 0, 'terrain blocks must not overlap');
      blocked[index] = 1;
      material[index] = obstacle.material;
    }
  }
}
for (let row = 0; row < height; row++) {
  for (let column = 0; column < width; column++) {
    assert.equal(material[row * width + column], material[row * width + width - column - 1],
      `terrain must mirror across the team axis at ${column},${row}`);
  }
}

const [azure, ember] = map.spawnPoints.sort((a, b) => a.team - b.team);
assert.equal(azure.x, -ember.x);
assert.equal(azure.z, ember.z);
for (const resource of map.resourceNodes) {
  assert.ok(map.resourceNodes.some(other => other !== resource && other.type === resource.type
    && other.stock === resource.stock && other.x === -resource.x && other.z === resource.z),
  `resource ${resource.id} needs a mirrored counterpart`);
}
for (const trigger of map.triggers) {
  assert.equal(trigger.zone.column, width - trigger.zone.column - trigger.zone.width,
    `${trigger.name} must be equally reachable from left and right`);
}
const [north, south, watch] = map.triggers;
assert.equal(north.zone.row, height - south.zone.row - south.zone.height);
assert.equal(north.zone.height, south.zone.height);
assert.equal(watch.zone.row, height - watch.zone.row - watch.zone.height);
assert.deepEqual(watch.requiresAll, [north.id, south.id]);

function cell(x, z) {
  return [Math.floor(x + width / 2), Math.floor(z + height / 2)];
}
function distanceToZone(spawn, zone) {
  const [column, row] = cell(spawn.x, spawn.z);
  const distance = new Int32Array(width * height).fill(-1);
  const queue = [row * width + column];
  distance[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x >= zone.column && x < zone.column + zone.width
      && y >= zone.row && y < zone.row + zone.height) return distance[index];
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const next = ny * width + nx;
      if (blocked[next] || distance[next] !== -1) continue;
      distance[next] = distance[index] + 1;
      queue.push(next);
    }
  }
  return Infinity;
}
const distances = map.triggers.map(trigger => [
  distanceToZone(azure, trigger.zone), distanceToZone(ember, trigger.zone),
]);
for (const [index, [left, right]] of distances.entries()) {
  assert.ok(Number.isFinite(left), `${map.triggers[index].name} must be reachable`);
  assert.equal(left, right, `${map.triggers[index].name} must have equal path distance`);
}
const crossingRows = [10, 22, 28, 35, 42, 53];
for (const row of crossingRows) {
  for (let column = 38; column <= 41; column++) {
    assert.equal(blocked[row * width + column], 0,
      `crossing cell ${column},${row} must support a wide army route`);
  }
}
const columns = Math.ceil(Math.sqrt(1000 * 1.3));
const rows = Math.ceil(1000 / columns);
const halfArmyWidth = (columns - 1) * 0.68 / 2;
const halfArmyHeight = (rows - 1) * 0.68 / 2;
for (const spawn of map.spawnPoints) {
  assert.ok(Math.abs(spawn.x) + halfArmyWidth < width / 2,
    `team ${spawn.team} 1,000-unit starting formation must fit inside the map`);
  assert.ok(Math.abs(spawn.z) + halfArmyHeight < height / 2,
    `team ${spawn.team} 1,000-unit starting formation must fit inside the map`);
}
console.log(JSON.stringify({ status: 'passed', map: map.id,
  mirroredTerrainCells: width * height, resources: map.resourceNodes.length,
  objectiveDistances: distances, crossingRows, armyFootprint: { columns, rows } }, null, 2));
