export function pathingBaselineMap({ group = 64, kind = 'single-choke' } = {}) {
  const width = 96, height = 64;
  const gap = kind === 's-bend' ? 2 : 1;
  const obstacles = [
    { id: 'north-wall', column: 48, row: 0, width: 1, height: 32, material: 'stone' },
    { id: 'south-wall', column: 48, row: 32 + gap, width: 1, height: height - 32 - gap, material: 'stone' },
  ];
  if (kind === 's-bend') obstacles.push(
    { id: 'bend-north', column: 54, row: 0, width: 1, height: 28, material: 'stone' },
    { id: 'bend-south', column: 54, row: 30, width: 1, height: 34, material: 'stone' });
  return { id: `pathing-${kind}-${group}`, name: 'PATHING BASELINE', width, height,
    terrainSeed: 881, fogOfWar: false, spawnPoints: [{ team: 0, x: -28, z: 0 }, { team: 1, x: 28, z: 22 }],
    startingArmySize: (group + 4) * 2, startingResources: { food: 500, wood: 500 },
    resourceNodes: [], triggers: [], scenarioEvents: [], obstacles };
}
export const PATHING_BASELINE_CASES = [
  { group: 16, kind: 'single-choke' }, { group: 64, kind: 'single-choke' },
  { group: 256, kind: 'single-choke' }, { group: 64, kind: 's-bend' },
  { group: 64, kind: 'dynamic-route' }, { group: 64, kind: 'dynamic-goal' },
  { group: 16, kind: 'disconnect-rejection' },
];
