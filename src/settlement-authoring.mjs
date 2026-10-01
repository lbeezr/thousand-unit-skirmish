import { townCenterSpawnPosition } from './town-center-spawn.mjs';
import { landscapeRectangles } from './landscape-authoring.mjs';

// Authored visual wear follows the real starting hall and home gathering sites.
// This compiles to ordinary ground paint; buildings and movement stay unchanged.
export function settlementGround(definition) {
  const { width, height } = definition;
  const blocked = new Uint8Array(width * height);
  const paint = new Array(width * height).fill(null);
  for (const rect of definition.obstacles) for (let y = rect.row; y < rect.row + rect.height; y++) {
    blocked.fill(1, y * width + rect.column, y * width + rect.column + rect.width);
  }
  for (const rect of definition.terrainPatches) for (let y = rect.row; y < rect.row + rect.height; y++) {
    paint.fill(rect.material, y * width + rect.column, y * width + rect.column + rect.width);
  }
  const pads = [], tracks = [];
  for (const spawn of definition.spawnPoints) {
    const hall = townCenterSpawnPosition(definition.spawnPoints, spawn.team, width, height);
    const direction = spawn.x >= hall.x ? 1 : -1;
    pads.push({ x: hall.x, z: hall.z });
    for (const node of definition.resourceNodes) {
      if (Math.hypot(node.x - spawn.x, node.z - spawn.z) > 10) continue;
      // Bow the two working tracks gently around the hall's approach apron.
      for (let step = 0; step <= 24; step++) {
        const t = step / 24, bow = Math.sin(t * Math.PI) * 0.65;
        tracks.push({ x: hall.x + direction * 2.5 + (node.x - hall.x - direction * 2.5) * t,
          z: hall.z + (node.z - hall.z) * t + Math.sign(node.z - hall.z) * bow });
      }
    }
  }
  const phase = (definition.terrainSeed || 0) * 0.017;
  return landscapeRectangles(width, height, (column, row) => {
    const cell = Math.floor(row) * width + Math.floor(column);
    if (blocked[cell]) return paint[cell];
    const x = column - width / 2, z = row - height / 2;
    const wornPad = pads.some(pad => {
      const nx = (x - pad.x) * (pad.x < 0 ? -1 : 1) / 4.4, nz = (z - pad.z) / 3.6;
      const angle = Math.atan2(nz, nx);
      return Math.hypot(nx, nz) < 0.94 + Math.sin(angle * 3 + phase) * 0.06;
    });
    if (wornPad || tracks.some(point => Math.hypot(x - point.x, z - point.z) < 0.9)) return 'dirt';
    return paint[cell];
  });
}
