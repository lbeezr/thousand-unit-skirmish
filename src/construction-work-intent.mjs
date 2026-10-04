import { BUILDING_DEFINITIONS } from './gameplay-definitions.mjs';
import { isPalisade } from './palisade-gate.mjs';

// Construction owns area/site policy; shared factories, generation validation,
// accepted-order cancellation and checkpoint serialization stay economy-owned.
export function constructionWorkArea(sites, map) {
  const bounds = sites.map(site => {
    const half = BUILDING_DEFINITIONS[site.type].footprint / 2;
    return { minX: site.x - half, maxX: site.x + half, minZ: site.z - half, maxZ: site.z + half };
  });
  return { minX: Math.max(-map.width / 2, Math.min(...bounds.map(b => b.minX)) - 2),
    maxX: Math.min(map.width / 2, Math.max(...bounds.map(b => b.maxX)) + 2),
    minZ: Math.max(-map.height / 2, Math.min(...bounds.map(b => b.minZ)) - 2),
    maxZ: Math.min(map.height / 2, Math.max(...bounds.map(b => b.maxZ)) + 2) };
}

function insideArea(site, area) {
  const half = (BUILDING_DEFINITIONS[site.type]?.footprint ?? Infinity) / 2;
  return site.x - half >= area.minX && site.x + half <= area.maxX
    && site.z - half >= area.minZ && site.z + half <= area.maxZ;
}

export function unfinishedConstructionSites(intent, team, buildingsById) {
  if (intent?.kind !== 'construction') return [];
  return intent.siteIds.map(id => buildingsById.get(id)).filter(site => site
    && site.team === team && site.hp > 0 && !site.complete && insideArea(site, intent.area));
}

// This result goes into the agreed createConstructionWorkIntent factory. It
// never pays, creates a site, expands a remembered area or scans for new work.
export function constructionAssignment(currentIntent, sites, team, buildingsById, map) {
  const remembered = unfinishedConstructionSites(currentIntent, team, buildingsById);
  const gate = sites.length === 1 && sites[0].type === 'palisade-gate' ? sites[0] : null;
  if (gate && remembered.length > 0 && remembered.every(site => isPalisade(site.type))
    && insideArea(gate, currentIntent.area)) {
    // A still-remembered completed cell can establish adjacency, but it does
    // not become unfinished work again. Never inspect unassigned site IDs.
    const adjoining = currentIntent.siteIds.map(id => buildingsById.get(id)).some(site => site && site.id !== gate.id
      && site.team === team && site.hp > 0 && isPalisade(site.type) && insideArea(site, currentIntent.area)
      && Math.abs(Math.abs(site.x - gate.x) + Math.abs(site.z - gate.z) - 1) < 1e-9);
    if (adjoining) return { siteIds: [gate.id, ...remembered.map(site => site.id).filter(id => id !== gate.id)],
      area: { ...currentIntent.area } };
  }
  return { siteIds: sites.map(site => site.id), area: constructionWorkArea(sites, map) };
}
