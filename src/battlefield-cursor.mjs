// Pure presentation resolver. Hover callers must never advance overlap selection.
export function battlefieldCursor(s) {
  if (s.panning) return 'panning';
  if (s.panReady) return 'pan';
  if (s.dragging) return s.crossing ? 'box-crossing' : 'box-select';
  if (!s.canOrder) return 'select';
  if (s.building) return s.buildValid ? 'build-valid' : 'build-blocked';
  if (s.selectedBuilding) return s.rallySupported ? 'rally' : 'unavailable';
  if (!s.count) return s.friendly && s.shift ? (s.alreadySelected ? 'select-remove' : 'select-add') : 'select';
  if (s.farmTargetMode === 'patrol') return 'move';
  if (s.farmTargetMode === 'follow') return s.farmFollowTarget ? 'move' : 'unavailable';
  if (s.enemy) return 'attack';
  if (s.enemyBuilding) return s.military ? 'attack' : 'unavailable';
  if (s.exhaustedFarm) return 'unavailable';
  if (s.farmConstruction) return s.workers ? 'build-valid' : 'unavailable';
  if (s.resource || s.forest) {
    if (!s.workers) return 'unavailable';
    return s.forest || s.resource === 'wood' ? 'gather-wood' : 'gather';
  }
  if (s.friendly && s.shift && !s.armed && !s.attackMove) {
    return s.alreadySelected ? 'select-remove' : 'select-add';
  }
  if (s.attackMove) return s.shift ? 'attack-move-queued' : 'attack-move';
  return s.shift ? 'move-queued' : 'move';
}
