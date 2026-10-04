export function woodJobMap(kind) {
  return { id: `wood-job-${kind}`, name: 'Wood job regression', width: 160, height: 160,
    startingArmySize: 8, startingResources: { wood: 100, food: 100 }, fogOfWar: false,
    spawnPoints: [{ team: 0, x: -14, z: 0 }, { team: 1, x: 14, z: 0 }],
    obstacles: kind === 'forest' ? [{ column: 68, row: 79, width: 1, height: 3, material: 'forest' }] : [],
    resourceNodes: kind === 'node' ? [{ id: 'first-tree', type: 'wood', x: -11.5, z: 5.5, stock: 6 },
      { id: 'next-tree', type: 'wood', x: -10.5, z: 5.5, stock: 6 },
      { id: 'near-food', type: 'food', x: -10.5, z: 6.5, stock: 6 },
      { id: 'far-tree', type: 'wood', x: 0.5, z: 5.5, stock: 6 }] : [], triggers: [], scenarioEvents: [] };
}
export const woodJobTarget = kind => kind === 'forest' ? { forestCell: 80 * 160 + 68 } : { nodeId: 'first-tree' };
export function woodDraw(state, map) {
  return state.forestStocks.reduce((sum, [, stock]) => sum + 6 - stock, 0)
    + state.resourceNodes.filter(node => node.type === 'wood')
      .reduce((sum, node) => sum + map.resourceNodes.find(source => source.id === node.id).stock - node.stock, 0);
}
