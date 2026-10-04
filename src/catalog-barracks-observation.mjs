// Read-only, owned-seat observations for the isolated catalog/Barracks scenario.
// No selectors, commands, camera mutations or art loading live here.
export function catalogBarracksObservation({ frame, time, mapId, team, zoom, viewport, dpr,
  food, wood, selectedIds, selectedBuildingId, units, buildings, buildingVisuals, project }) {
  return {
    frame, renderedAt: time, mapId, team, zoom, viewport, dpr,
    bank: { food, wood }, selectedIds: [...selectedIds], selectedBuildingId,
    workers: units.filter(unit => unit?.team === team && unit.kind === 'worker' && unit.hp > 0)
      .map(unit => ({ id: unit.id, x: unit.renderX, z: unit.renderZ,
        serverX: unit.serverX, serverZ: unit.serverZ, task: unit.task,
        screen: project({ x: unit.renderX, z: unit.renderZ, height: 0.65 }) })),
    buildings: buildings.filter(building => building.team === team).map(building => {
      const visual = buildingVisuals.get(building.id), entry = visual?.frontierCaptureEntry;
      const sprite = entry?.sprite, art = sprite?.userData.capturedBuildingArt;
      const index = Number(art?.requestKey?.split(':')[1]);
      const view = art?.manifest?.completeState?.views?.find(view => view.index === index);
      return { id: building.id, team: building.team, type: building.type,
        x: building.x, z: building.z, hp: building.hp, maxHp: building.maxHp,
        progress: building.progress, complete: building.complete,
        screen: project({ x: building.x, z: building.z, height: 1 }),
        groupVisible: Boolean(visual?.group.visible), fallbackVisible: Boolean(entry?.fallbackRoot.visible),
        capture: { manifestPath: art ? new URL(art.manifestUrl).pathname : null,
          requestKey: art?.requestKey ?? null, spriteVisible: Boolean(sprite?.visible && sprite.material.map),
          bodyDepthVisible: Boolean(art?.bodyDepth.visible && art.bodyDepth.material.map),
          view: view ? { path: view.path, sha256: view.sha256 } : null,
          texturePixels: sprite?.material.map?.image ? [sprite.material.map.image.width, sprite.material.map.image.height] : null,
          scale: sprite ? [sprite.scale.x, sprite.scale.y] : null,
          pivot: sprite ? [sprite.center.x, sprite.center.y] : null } };
    }),
  };
}
