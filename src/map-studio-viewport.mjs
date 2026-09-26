export const MIN_MAP_STUDIO_ZOOM = 1;
export const MAX_MAP_STUDIO_ZOOM = 4;

export function clampMapStudioZoom(zoom) {
  if (!Number.isFinite(zoom)) return MIN_MAP_STUDIO_ZOOM;
  return Math.max(MIN_MAP_STUDIO_ZOOM, Math.min(MAX_MAP_STUDIO_ZOOM, zoom));
}

export function mapStudioCanvasSize({
  mapWidth, mapHeight, viewportWidth, viewportHeight, zoom = MIN_MAP_STUDIO_ZOOM,
}) {
  if (![mapWidth, mapHeight, viewportWidth, viewportHeight].every(Number.isFinite)
    || mapWidth <= 0 || mapHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return null;
  }
  const cellSize = Math.min(viewportWidth / mapWidth, viewportHeight / mapHeight)
    * clampMapStudioZoom(zoom);
  return {
    cellSize,
    width: mapWidth * cellSize,
    height: mapHeight * cellSize,
  };
}

export function mapStudioCellAtPointer({ clientX, clientY, rect, mapWidth, mapHeight }) {
  if (![clientX, clientY, mapWidth, mapHeight, rect?.left, rect?.top, rect?.width, rect?.height]
    .every(Number.isFinite) || rect.width <= 0 || rect.height <= 0
    || mapWidth <= 0 || mapHeight <= 0) return null;
  return {
    column: Math.max(0, Math.min(mapWidth - 1, Math.floor((clientX - rect.left) / rect.width * mapWidth))),
    row: Math.max(0, Math.min(mapHeight - 1, Math.floor((clientY - rect.top) / rect.height * mapHeight))),
  };
}

export function mapStudioScrollAtZoom({
  scrollLeft, scrollTop, anchorX, anchorY, fromZoom, toZoom,
}) {
  if (![scrollLeft, scrollTop, anchorX, anchorY, fromZoom, toZoom].every(Number.isFinite)
    || fromZoom <= 0 || toZoom <= 0) return null;
  const ratio = toZoom / fromZoom;
  return {
    left: Math.max(0, (scrollLeft + anchorX) * ratio - anchorX),
    top: Math.max(0, (scrollTop + anchorY) * ratio - anchorY),
  };
}

export function mapStudioScrollAtPan({
  scrollLeft, scrollTop, startX, startY, clientX, clientY,
}) {
  if (![scrollLeft, scrollTop, startX, startY, clientX, clientY].every(Number.isFinite)) return null;
  return {
    left: Math.max(0, scrollLeft - (clientX - startX)),
    top: Math.max(0, scrollTop - (clientY - startY)),
  };
}
