/** Reuse the public no-fog roster while withholding each seat's private production metadata. */
export function privateProductionView(payload, team) {
  if (team === null) return payload;
  return {
    ...payload,
    ...(Array.isArray(payload.population) ? { population: payload.population.map((record, owner) => owner === team ? record : null) } : {}),
    buildings: payload.buildings.map((building) => building.team === team ? building : {
      ...building, productionQueue: [],
      ...(Array.isArray(building.productionOptions) ? { productionOptions: [] } : {}),
    }),
  };
}
