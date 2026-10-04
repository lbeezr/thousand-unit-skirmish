import { STONE_ECONOMY_PROFILE_ID } from '../src/economy-profile.mjs';

// Small authored stocks bound audit duration; these are not shipped balance.
export function foodStoneJobMap(resource) {
  if (!['food', 'stone'].includes(resource)) throw new Error('Audit expects Food or Stone');
  const other = resource === 'food' ? 'wood' : 'food';
  return { id: `finite-${resource}-job-audit`, name: `Finite ${resource} job audit`,
    width: 160, height: 160, startingArmySize: 8, fogOfWar: false,
    ...(resource === 'stone' ? { economyProfileId: STONE_ECONOMY_PROFILE_ID } : {}),
    startingResources: { food: 100, wood: 100 },
    spawnPoints: [{ team: 0, x: -14, z: 0 }, { team: 1, x: 14, z: 0 }],
    obstacles: [], triggers: [], scenarioEvents: [],
    resourceNodes: [0, 1].flatMap(team => {
      const sign = team ? 1 : -1;
      return [{ id: `seat-${team}-first`, type: resource, x: sign * 11.5, z: 5.5, stock: 6 },
        { id: `seat-${team}-next`, type: resource, x: sign * 10.5, z: 5.5, stock: 6 },
        { id: `seat-${team}-other`, type: other, x: sign * 12.5, z: 6.5, stock: 6 },
        { id: `seat-${team}-far`, type: resource, x: sign * 2.5, z: 5.5, stock: 6 }];
    }) };
}

export const auditWorkerId = team => team * 4;
export const resourceBank = (state, resource, team) => state[`team${resource[0].toUpperCase()}${resource.slice(1)}`][team];
export const typedDraw = (state, map, resource) => state.resourceNodes.filter(node => node.type === resource)
  .reduce((sum, node) => sum + map.resourceNodes.find(source => source.id === node.id).stock - node.stock, 0);

export function resourceJobObservation(state, resource, team) {
  const worker = state.units.find(unit => unit.id === auditWorkerId(team));
  return { team, bank: resourceBank(state, resource, team), cargo: worker.cargo,
    cargoType: worker.cargoType, gatherNodeId: worker.gatherNodeId,
    phase: worker.gatherPhase, workIntent: worker.workIntent,
    nextStock: state.resourceNodes.find(node => node.id === `seat-${team}-next`).stock };
}
