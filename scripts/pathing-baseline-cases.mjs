export function pathingBaselineMap({ group = 64, kind = 'single-choke', team = 0 } = {}) {
  const large = kind === 'large-single-choke';
  const width = large ? 128 : 96, height = large ? 128 : 64;
  const column = width / 2, row = height / 2;
  const gap = kind === 's-bend' ? 2 : 1;
  const obstacles = [
    { id: 'north-wall', column, row: 0, width: 1, height: row, material: 'stone' },
    { id: 'south-wall', column, row: row + gap, width: 1, height: height - row - gap, material: 'stone' },
  ];
  if (kind === 's-bend') obstacles.push(
    { id: 'bend-north', column: 54, row: 0, width: 1, height: 28, material: 'stone' },
    { id: 'bend-south', column: 54, row: 30, width: 1, height: 34, material: 'stone' });
  return { id: `pathing-${kind}-${group}${large ? `-seat-${team}` : ''}`, name: 'PATHING BASELINE', width, height,
    terrainSeed: 881, fogOfWar: false, spawnPoints: large
      ? [{ team: 0, x: -36, z: team ? -44 : 0 }, { team: 1, x: 36, z: team ? 0 : 44 }]
      : [{ team: 0, x: -28, z: 0 }, { team: 1, x: 28, z: 22 }],
    startingArmySize: (group + 4) * 2, startingResources: { food: 500, wood: 500 },
    resourceNodes: [], triggers: [], scenarioEvents: [], obstacles };
}
export const PATHING_BASELINE_CASES = [
  { group: 16, kind: 'single-choke' }, { group: 64, kind: 'single-choke' },
  { group: 256, kind: 'single-choke' }, { group: 64, kind: 's-bend' },
  { group: 64, kind: 'dynamic-route' }, { group: 64, kind: 'dynamic-goal' },
  { group: 16, kind: 'disconnect-rejection' },
  { group: 996, kind: 'large-single-choke', team: 0 },
  { group: 996, kind: 'large-single-choke', team: 1 },
];
