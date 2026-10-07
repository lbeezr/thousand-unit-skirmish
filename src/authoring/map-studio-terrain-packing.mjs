// Pack editable terrain cells for draft capture, export and brush reads.
// Validation and the host's over-limit error remain with their callers.
export function packGroundPaint(width, height, groundMaterials, terrainMaterials) {
  const visited = new Uint8Array(width * height);
  const patches = [];
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const index = row * width + column;
      const material = groundMaterials[index];
      if (material < 0 || visited[index]) continue;
      let rectangleWidth = 1;
      while (column + rectangleWidth < width
        && groundMaterials[row * width + column + rectangleWidth] === material
        && !visited[row * width + column + rectangleWidth]) rectangleWidth++;
      let rectangleHeight = 1;
      while (row + rectangleHeight < height) {
        let same = true;
        for (let dx = 0; dx < rectangleWidth; dx++) {
          const next = (row + rectangleHeight) * width + column + dx;
          if (groundMaterials[next] !== material || visited[next]) { same = false; break; }
        }
        if (!same) break;
        rectangleHeight++;
      }
      for (let dy = 0; dy < rectangleHeight; dy++) {
        for (let dx = 0; dx < rectangleWidth; dx++) visited[(row + dy) * width + column + dx] = 1;
      }
      patches.push({ column, row, width: rectangleWidth, height: rectangleHeight,
        material: terrainMaterials[material] });
    }
  }
  return patches;
}

export function packGroundElevation(width, height, groundLevels, maxElevationPatches) {
  const visited = new Uint8Array(width * height);
  const patches = [];
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const index = row * width + column;
      const level = groundLevels[index];
      if (level === 0 || visited[index]) continue;
      let rectangleWidth = 1;
      while (column + rectangleWidth < width
        && groundLevels[row * width + column + rectangleWidth] === level
        && !visited[row * width + column + rectangleWidth]) rectangleWidth++;
      let rectangleHeight = 1;
      while (row + rectangleHeight < height) {
        let same = true;
        for (let dx = 0; dx < rectangleWidth; dx++) {
          const next = (row + rectangleHeight) * width + column + dx;
          if (groundLevels[next] !== level || visited[next]) { same = false; break; }
        }
        if (!same) break;
        rectangleHeight++;
      }
      for (let dy = 0; dy < rectangleHeight; dy++) {
        for (let dx = 0; dx < rectangleWidth; dx++) visited[(row + dy) * width + column + dx] = 1;
      }
      patches.push({ column, row, width: rectangleWidth, height: rectangleHeight, level });
      if (patches.length > maxElevationPatches) return patches;
    }
  }
  return patches;
}

export function packTerrainObstacles(width, height, cellMaterials, cellElevations, obstacleMaterials) {
  const visited = new Uint8Array(width * height);
  const obstacles = [];
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const index = row * width + column;
      const material = cellMaterials[index];
      if (material < 0 || visited[index]) continue;
      const elevation = cellElevations[index];
      let rectangleWidth = 1;
      while (column + rectangleWidth < width) {
        const next = row * width + column + rectangleWidth;
        if (cellMaterials[next] !== material || cellElevations[next] !== elevation || visited[next]) break;
        rectangleWidth++;
      }
      let rectangleHeight = 1;
      while (row + rectangleHeight < height) {
        let sameMaterial = true;
        for (let dx = 0; dx < rectangleWidth; dx++) {
          const next = (row + rectangleHeight) * width + column + dx;
          if (cellMaterials[next] !== material || cellElevations[next] !== elevation || visited[next]) {
            sameMaterial = false;
            break;
          }
        }
        if (!sameMaterial) break;
        rectangleHeight++;
      }
      for (let dy = 0; dy < rectangleHeight; dy++) {
        for (let dx = 0; dx < rectangleWidth; dx++) visited[(row + dy) * width + column + dx] = 1;
      }
      const obstacle = {
        column, row, width: rectangleWidth, height: rectangleHeight,
        material: obstacleMaterials[material],
      };
      if (elevation !== 1.12) obstacle.elevation = elevation;
      obstacles.push(obstacle);
    }
  }
  return obstacles;
}
