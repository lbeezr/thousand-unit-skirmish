export function resizeWorldMarkers(markers, oldWidth, oldHeight, newWidth, newHeight) {
  if (!Array.isArray(markers)
    || ![oldWidth, oldHeight, newWidth, newHeight].every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error('Map marker resizing requires a marker array and positive integer dimensions.');
  }
  let clippedCount = 0;
  const resizedMarkers = markers.map((marker) => {
    if (!marker || !Number.isFinite(marker.x) || !Number.isFinite(marker.z)) {
      throw new Error('Map marker resizing requires finite world coordinates.');
    }
    const oldColumn = Math.floor(marker.x + oldWidth / 2);
    const oldRow = Math.floor(marker.z + oldHeight / 2);
    const column = Math.max(0, Math.min(newWidth - 1, oldColumn));
    const row = Math.max(0, Math.min(newHeight - 1, oldRow));
    if (column !== oldColumn || row !== oldRow) clippedCount++;
    return {
      ...marker,
      x: column - newWidth / 2 + 0.5,
      z: row - newHeight / 2 + 0.5,
    };
  });
  return { markers: resizedMarkers, clippedCount };
}
