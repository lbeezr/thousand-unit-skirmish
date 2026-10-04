import { planWallLine } from './wall-line-planner.mjs';

export { PALISADE_TUNING_PROPOSAL, palisadeDraftDefinition } from './palisade-profile.mjs';
import { palisadeDraftDefinition } from './palisade-profile.mjs';

/**
 * Pure preparation boundary; the server owns the live transaction. All facts/tuning must be
 * authoritative. assessPlacement(cells) must assess the whole tentative line,
 * preserve entity/active-route connectivity, and return a reachable access cell
 * for every new segment. Use copied occupancy, or restore it in a finally block.
 * The live adapter still owns synchronous commit, builder orders and checkpoints.
 */
export function preparePaidWallLine({ tuning, team, balance, buildingCount, buildingLimit,
  nextBuildingId, idCeiling, assessPlacement, passableExistingWallCells = [], ...geometry } = {}) {
  const definition = palisadeDraftDefinition(tuning);
  if (![0, 1].includes(team) || !balance
    || ![buildingCount, buildingLimit, nextBuildingId, idCeiling].every(Number.isSafeInteger)
    || buildingCount < 0 || buildingLimit < 1 || buildingCount > buildingLimit
    || nextBuildingId < 1 || nextBuildingId >= idCeiling
    || typeof assessPlacement !== 'function') throw new TypeError('Authoritative wall preparation context is required.');
  const result = planWallLine({ ...geometry, segmentCost: definition.cost, balance });
  const reject = status => ({ status, preview: result.preview, errors: result.errors, plan: null });
  if (!result.plan) return reject(result.status);
  const passable = passableExistingWallCells;
  if (!(Array.isArray(passable) || passable instanceof Set)
    || (Array.isArray(passable) ? passable.length : passable.size) > geometry.width * geometry.height) {
    throw new TypeError('Invalid passable existing wall cells.');
  }
  const existing = new Set(geometry.existingWallCells ?? []);
  for (const cell of passable) if (!existing.has(cell)) {
    throw new TypeError('Passable cells must be existing wall topology.');
  }
  const added = result.plan.added;
  if (buildingCount + added.length > buildingLimit) return reject('building-limit');
  if (nextBuildingId + added.length >= idCeiling) return reject('id-limit');

  let access = [];
  if (added.length) {
    const cells = Object.freeze(added.map(p => p.cell));
    const wallCells = new Set([...result.preview.cells, ...(geometry.existingWallCells ?? [])]);
    // A reserved open gate is part of topology, but is a legal Worker approach.
    for (const cell of passable) wallCells.delete(cell);
    const assessment = assessPlacement(cells);
    if (!assessment || typeof assessment.entitiesConnected !== 'boolean'
      || typeof assessment.activeRoutesConnected !== 'boolean' || !Array.isArray(assessment.access)
      || assessment.access.length > added.length) throw new TypeError('Invalid whole-line placement assessment.');
    if (!assessment.entitiesConnected || !assessment.activeRoutesConnected) return reject('would-block-route');
    const byCell = new Map();
    for (const entry of assessment.access) {
      if (!entry || !cells.includes(entry.cell) || byCell.has(entry.cell)
        || !Number.isInteger(entry.accessCell) || entry.accessCell < 0
        || entry.accessCell >= geometry.width * geometry.height
        || wallCells.has(entry.accessCell)
        || Math.abs(entry.cell % geometry.width - entry.accessCell % geometry.width) > 1
        || Math.abs(Math.floor(entry.cell / geometry.width) - Math.floor(entry.accessCell / geometry.width)) > 1) {
        throw new TypeError('Invalid per-segment Worker access.');
      }
      byCell.set(entry.cell, entry.accessCell);
    }
    if (byCell.size !== added.length) return reject('no-reachable-workers');
    access = cells.map(cell => ({ cell, accessCell: byCell.get(cell) }));
  }
  const buildings = added.map((p, i) => ({ id: nextBuildingId + i, team,
    type: definition.id, x: p.column - geometry.width / 2 + 0.5,
    z: p.row - geometry.height / 2 + 0.5, footprint: [p.cell], hp: definition.maxHp,
    progress: 0, complete: false, queue: 0, productionQueue: [], trainingRemaining: 0,
    productionBlocked: false, rallyCell: -1 }));
  return { status: 'ready', preview: result.preview, errors: [],
    plan: { buildings, cost: { ...result.plan.cost }, nextBuildingId: nextBuildingId + added.length,
      access, topologyUpdates: result.plan.updated } };
}
