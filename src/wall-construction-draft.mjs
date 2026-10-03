import { planWallLine } from './wall-line-planner.mjs';

// Proposed tuning for review only. Nothing imports this into the active registry.
export const PALISADE_TUNING_PROPOSAL = Object.freeze({
  cost: Object.freeze({ food: 0, wood: 15 }), buildSeconds: 5, maxHp: 300, footprint: 1,
});

export function palisadeDraftDefinition(tuning) {
  if (!tuning || Object.keys(tuning).some(k => !['cost', 'buildSeconds', 'maxHp', 'footprint'].includes(k))
    || !tuning.cost || Object.keys(tuning.cost).some(k => !['food', 'wood'].includes(k))
    || tuning.cost.food !== 0 || !Number.isFinite(tuning.cost.wood) || tuning.cost.wood < 0
    || ![tuning.buildSeconds, tuning.maxHp].every(n => Number.isFinite(n) && n > 0)
    || tuning.footprint !== 1) throw new TypeError('Explicit wood-only, one-cell palisade tuning is required.');
  return { id: 'palisade-wall', label: 'Palisade', tags: ['structure'],
    armor: { melee: 0, pierce: 0, siege: 0 }, cost: { ...tuning.cost },
    buildSeconds: tuning.buildSeconds, maxHp: tuning.maxHp, footprint: 1,
    products: [], presentation: 'building.palisade' };
}

/**
 * Draft preparation boundary, never a live transaction. All facts/tuning must be
 * authoritative. assessPlacement(cells) must assess the whole tentative line,
 * preserve entity/active-route connectivity, and return a reachable access cell
 * for every new segment. Use copied occupancy, or restore it in a finally block.
 * The live adapter still owns synchronous commit, builder orders and checkpoints.
 */
export function preparePaidWallLine({ tuning, team, balance, buildingCount, buildingLimit,
  nextBuildingId, idCeiling, assessPlacement, ...geometry } = {}) {
  const definition = palisadeDraftDefinition(tuning);
  if (![0, 1].includes(team) || !balance
    || ![buildingCount, buildingLimit, nextBuildingId, idCeiling].every(Number.isSafeInteger)
    || buildingCount < 0 || buildingLimit < 1 || buildingCount > buildingLimit
    || nextBuildingId < 1 || nextBuildingId >= idCeiling
    || typeof assessPlacement !== 'function') throw new TypeError('Authoritative wall preparation context is required.');
  const result = planWallLine({ ...geometry, segmentCost: definition.cost, balance });
  const reject = status => ({ status, preview: result.preview, errors: result.errors, plan: null });
  if (!result.plan) return reject(result.status);
  const added = result.plan.added;
  if (buildingCount + added.length > buildingLimit) return reject('building-limit');
  if (nextBuildingId + added.length >= idCeiling) return reject('id-limit');

  let access = [];
  if (added.length) {
    const cells = Object.freeze(added.map(p => p.cell));
    const wallCells = new Set([...result.preview.cells, ...(geometry.existingWallCells ?? [])]);
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
