import { shoreFishSitePositions } from './shore-fishing-placement.mjs';

const EMPTY = Object.freeze({ resourceNodes: [], visibleResourceIds: [], visibleWaterCells: [] });

// Only current wire state is authority. Remembered UI stocks and authored
// starting stocks never enter this binding. Call once per accepted state packet.
export function createWaterStudyFishBinding(definition, surface) {
  const apply = snapshot => surface?.userData?.updateWaterStudyFish?.(snapshot) || [];
  const clear = () => apply(EMPTY);
  const { width, height } = definition;
  const sites = shoreFishSitePositions(definition).map(site => ({
    id: site.nodeId,
    bank: Math.floor(site.land.z + height / 2) * width + Math.floor(site.land.x + width / 2),
    water: site.water.row * width + site.water.column,
  }));
  clear();
  return { clear, update(state, { spectator = false } = {}) {
    if (!state || state.mapId !== definition.id || !Array.isArray(state.resourceNodes)
      || state.fogOfWar !== definition.fogOfWar) return clear();
    let visible;
    if (state.visibility === null && (state.fogOfWar === false || spectator === true)) {
      // The server supplies unrestricted snapshots for no-fog maps/spectators.
      visible = () => true;
    } else {
      const fog = state.visibility;
      if (state.fogOfWar !== true || !fog || fog.columns !== width || fog.rows !== height
        || typeof fog.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(fog.data)) return clear();
      let packed;
      try { packed = atob(fog.data); } catch { return clear(); }
      if (packed.length !== Math.ceil(width * height / 4)) return clear();
      visible = cell => ((packed.charCodeAt(cell >> 2) >> ((cell & 3) * 2)) & 3) === 2;
    }
    return apply({ resourceNodes: state.resourceNodes,
      visibleResourceIds: sites.filter(site => visible(site.bank)).map(site => site.id),
      visibleWaterCells: sites.filter(site => visible(site.water)).map(site => site.water),
    });
  } };
}
