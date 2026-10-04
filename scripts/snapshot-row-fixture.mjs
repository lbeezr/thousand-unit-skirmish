// Fixed actor fixtures for wire regressions/allocation probes, not gameplay acceptance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { headingToTarget } from '../src/unit-heading.mjs';
import { farmHarvestNode, farmBuildingId } from '../src/farm-harvest.mjs';
import { workerFishingPresentation } from '../src/worker-fishing-presentation.mjs';
import { shoreFishSitePositions } from '../src/shore-fishing-placement.mjs';
import { createWorkerPerformingActions } from '../src/worker-performing-action.mjs';
import { deflateRawSync, constants } from 'node:zlib';
import { encodeWebSocketFrame } from '../src/networking/websocket-frame.mjs';
export const snapshotSource = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
export const baselineSnapshot = readFileSync(new URL('./fixtures/snapshot-units-b4641998.txt', import.meta.url), 'utf8');
export function productionBody(name) {
  const start = snapshotSource.indexOf(`function ${name}(`), end = snapshotSource.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, name); return snapshotSource.slice(start, end);
}
export function createSnapshotRowFixture({ baseline = false, count = 32, workerSlots = 8, fog = true } = {}) {
  const map = JSON.parse(readFileSync(new URL('../maps/shore-fishing.json', import.meta.url), 'utf8'));
  map.fogOfWar = fog;
  const site = shoreFishSitePositions(map)[0];
  const nodes = new Map(map.resourceNodes.map(node => [node.id, { ...node }]));
  nodes.set('berries', { id: 'berries', type: 'food', x: -1, z: 1, stock: 100 });
  const buildings = new Map([[1, { id: 1, type: 'farm', complete: true, hp: 100, x: 0, z: 0 }],
    [2, { id: 2, type: 'farm', complete: false, hp: 100, x: 0, z: 0 }]]);
  const units = Array.from({ length: count }, (_, id) => {
    const team = id < count / 2 ? 0 : 1, slot = id % (count / 2);
    const unit = { id, team, kind: slot < workerSlots ? 'worker' : 'infantry', generation: 1, orderRevision: 0,
      hp: 100, x: (id % 23) - 11.005, z: (id % 19) - 9.005, cargo: 0, cargoType: null,
      gatherPhase: '', gatherNodeId: null, gatherForestCell: -1, buildingTargetId: null, repairing: false,
      attackTargetId: -1, attackBuildingTargetId: -1, lastAttackTick: -1,
      holdingPosition: false, path: [], pathIndex: 0, movePlanningPending: false, attackMove: false,
      queuedWaypoints: [], persistentOrder: null };
    if (unit.kind === 'worker') {
      if (slot === 0) Object.assign(unit, { gatherPhase: 'gathering', gatherNodeId: 'berries', cargoType: 'food', cargo: .0001 });
      if (slot === 1) Object.assign(unit, { gatherPhase: 'gathering', gatherNodeId: site.nodeId, x: site.land.x, z: site.land.z, cargoType: 'food' });
      if (slot === 2) Object.assign(unit, { gatherPhase: 'gathering', gatherForestCell: 7, cargoType: 'wood', cargo: .125 });
      if (slot === 3) Object.assign(unit, { buildingTargetId: 1, repairing: true, x: 0, z: 0 });
      if (slot === 4) Object.assign(unit, { buildingTargetId: 2, x: 0, z: 0 });
      if (slot === 5) Object.assign(unit, { gatherPhase: 'to-base', gatherNodeId: 'berries', cargoType: 'food', cargo: 10 });
      if (slot === 6) unit.holdingPosition = true;
      if (slot === 7) unit.persistentOrder = { type: 'patrol' };
    }
    return unit;
  });
  const journal = createWorkerPerformingActions(); journal.beginStep(50);
  for (const unit of units.filter(unit => unit.kind === 'worker')) {
    if (unit.gatherPhase === 'gathering') journal.record(unit, unit.gatherForestCell >= 0 ? 'gather-wood' : 'gather-food',
      unit.gatherForestCell >= 0 ? unit.gatherForestCell : unit.gatherNodeId);
    if (unit.buildingTargetId !== null) journal.record(unit, unit.repairing ? 'repair' : 'build', unit.buildingTargetId);
  }
  const context = vm.createContext({ units, mapDefinition: map, resourceNodeStates: nodes, buildingsById: buildings,
    BUILDING_DEFINITIONS, workerPerformingActions: journal, forestWoodRemaining: { 7: 100 },
    workerFishingPresentation, headingToTarget, farmHarvestNode, farmBuildingId, teamWood: [100, 100],
    tickNumber: 50, STATE_EVERY_TICKS: 3, BUILDER_INTERACTION_RANGE: 1.4,
    cellToWorld: cell => ({ x: cell % map.width - map.width / 2 + .5, z: Math.floor(cell / map.width) - map.height / 2 + .5 }),
    worldToCell: (x, z) => Math.floor(z + map.height / 2) * map.width + Math.floor(x + map.width / 2),
    cellVisibleToTeam: (team, cell) => (cell + team) % 3 !== 0,
    Buffer, JSON, deflateRawSync, encodeWebSocketFrame, MIN_COMPRESS_FRAME_BYTES: 512,
    PERMESSAGE_DEFLATE_TRAILER: Buffer.from([0,0,255,255]), zlibConstants: constants });
  const helpers = ['workerTaskStatus','workerAudioExecution','workerGatherHeading','workerPerformingAction',
    'compatibleWorkerPerformingAction','harvestNodeById','prepareJsonFrame'];
  vm.runInContext(helpers.map(productionBody).join('\n') + '\n'
    + (baseline ? baselineSnapshot : productionBody('snapshotUnits')), context, { filename: baseline ? 'snapshot-baseline.js' : 'snapshot-candidate.js' });
  return { context, units, journal, nodes, buildings,
    rows: team => context.snapshotUnits(team),
    frame: (team, compressed) => context.prepareJsonFrame({ type: 'state', tick: context.tickNumber,
      workerPerformingActionVersion: 1, units: context.snapshotUnits(team) }, compressed) };
}
