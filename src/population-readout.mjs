// Present only an assigned seat's authoritative population; never infer it from headcount.
export function ownedPopulationReadout(records, team) {
  const assigned = team === 0 || team === 1;
  const population = assigned && Array.isArray(records) ? records[team] : null;
  if (!population || !['used', 'reserved', 'capacity', 'available']
    .every(key => Number.isSafeInteger(population[key]) && population[key] >= 0)) {
    return {
      compact: '—',
      detail: assigned ? 'POPULATION · CONNECTING' : 'POPULATION · JOIN A TEAM',
      description: assigned ? 'Population: connecting.' : 'Population: join a team.',
    };
  }
  const { used, reserved, capacity, available } = population;
  const full = available === 0;
  return {
    compact: `${used}+${reserved}/${capacity}`,
    detail: `POPULATION · ${used} USED + ${reserved} QUEUED / ${capacity}${full ? ' · BUILD A HOUSE' : ''}`,
    description: `Population: ${used} used, ${reserved} queued, capacity ${capacity}.${full ? ' No capacity available; build a House.' : ''}`,
  };
}
