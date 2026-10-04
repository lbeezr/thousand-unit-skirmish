import { isPalisade } from './palisade-gate.mjs';
import { planWallLine } from './wall-line-planner.mjs';
import { formatResourceRequirement } from './client/hud/resource-format.mjs';

export function wallCellAt(point, width, height) {
  return point ? { column: Math.floor(point.x + width / 2), row: Math.floor(point.z + height / 2) } : null;
}

// Live battlefield input only. A pointer cancellation never returns a command.
export class WallPlacementGesture {
  anchor = null;
  end = null;
  owner = null;
  begin(owner, cell) {
    if (this.anchor || !cell) return false;
    this.owner = owner; this.anchor = { ...cell }; this.end = { ...cell };
    return true;
  }
  move(owner, cell) {
    if (!this.anchor || owner !== this.owner) return false;
    this.end = cell && { ...cell };
    return true;
  }
  points(cell = this.end) { return cell ? this.anchor ? [{ ...this.anchor }, { ...cell }] : [{ ...cell }] : null; }
  finish(owner, cell, commit) {
    if (!this.anchor || owner !== this.owner) return null;
    const points = commit ? this.points(cell) : null;
    this.cancel(); return points;
  }
  cancel() { this.anchor = null; this.end = null; this.owner = null; }
}

// Uses disclosed occupancy only; admission and connectivity remain authoritative.
export function previewWallPlacement({ width, height, points, axisOrder = 'column-first',
  segmentCost, balance, team, workers = 0, obstacles = [], forestStocks = new Map(),
  resourceNodes = [], resourceStocks = new Map(), triggers = [], units = [], buildings = [] }) {
  const existingWallCells = new Set();
  const occupiedCells = new Set();
  const reasons = new Map();
  const cellOf = point => wallCellAt(point, width, height);
  const inMap = ({ column, row }) => column >= 0 && column < width && row >= 0 && row < height;
  const occupy = (point, reason) => {
    if (inMap(point)) { const cell = point.row * width + point.column; occupiedCells.add(cell); reasons.set(cell, reason); }
  };
  for (const building of buildings) {
    const center = cellOf(building), radius = Math.floor(building.footprint / 2);
    if (isPalisade(building.type) && building.team === team) {
      if (inMap(center)) existingWallCells.add(center.row * width + center.column);
    } else for (let row = center.row - radius; row <= center.row + radius; row++) {
      for (let column = center.column - radius; column <= center.column + radius; column++) {
        occupy({ column, row }, 'ANOTHER BUILDING IN THIS LINE');
      }
    }
  }
  for (const unit of units) if (unit.hp > 0 && unit.visible !== false) occupy(cellOf(unit), 'MOVE UNITS OUT OF THIS LINE');
  for (const node of resourceNodes) if (resourceStocks.get(node.id) !== 0) occupy(cellOf(node), 'RESOURCE IN THIS LINE');
  const geometry = planWallLine({ width, height, points, axisOrder, existingWallCells, segmentCost, balance });
  if (!geometry.preview) return { ...geometry, valid: false, blockedReason: 'OUTSIDE THE MAP' };
  const blockedCells = new Set();
  for (const piece of [...geometry.preview.pieces, ...geometry.preview.updated]) {
    const { cell, column, row } = piece;
    for (const obstacle of obstacles) if (column >= obstacle.column && column < obstacle.column + obstacle.width
      && row >= obstacle.row && row < obstacle.row + obstacle.height
      && (obstacle.material !== 'forest' || forestStocks.get(cell) !== 0)) {
      blockedCells.add(cell); reasons.set(cell, 'TERRAIN BLOCKS THIS LINE');
    }
    for (const { zone } of triggers) if (zone && column >= zone.column && column < zone.column + zone.width
      && row >= zone.row && row < zone.row + zone.height) {
      blockedCells.add(cell); reasons.set(cell, 'CAPTURE ZONE IN THIS LINE');
    }
  }
  const result = planWallLine({ width, height, points, axisOrder, existingWallCells, blockedCells,
    occupiedCells, segmentCost, balance });
  const cost = result.preview.cost;
  const blockedReason = result.errors.length ? reasons.get(result.errors[0].cell) || 'SPACE BLOCKED'
    : team === null || workers === 0 ? 'SELECT WORKERS'
      : result.status === 'insufficient-resources' ? [
        balance.wood < cost.wood ? `NEED ${formatResourceRequirement(cost.wood)} WOOD` : '',
        balance.food < cost.food ? `NEED ${formatResourceRequirement(cost.food)} FOOD` : '',
      ].filter(Boolean).join(' · ') : '';
  return { ...result, valid: result.status === 'ready' && !blockedReason, blockedReason };
}

export function wallPlacementFeedback(result, { pending = false, dragging = false, keyboard = false } = {}) {
  if (pending && !result) return 'PALISADE REQUEST SENT · WAITING FOR CONFIRMATION';
  if (!result) return 'CHOOSE A LINE ON THE BATTLEFIELD';
  const preview = result.preview;
  const cost = preview ? `${preview.newCount} NEW · ${formatResourceRequirement(preview.cost.wood)} WOOD`
    + (preview.cost.food ? ` · ${formatResourceRequirement(preview.cost.food)} FOOD` : '')
    + (preview.reusedCount ? ` · ${preview.reusedCount} REUSED FREE` : '') : '';
  const action = pending ? 'PALISADE REQUEST SENT · WAITING FOR CONFIRMATION'
    : result.valid ? dragging ? keyboard ? 'ENTER TO PLACE' : 'RELEASE TO PLACE'
    : 'DRAG A LINE / ENTER TO START' : `BLOCKED · ${result.blockedReason}`;
  return [action, cost].filter(Boolean).join(' · ');
}
