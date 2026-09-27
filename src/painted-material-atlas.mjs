function intervalSegments(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new RangeError('Atlas UV intervals must have finite, increasing bounds');
  }
  const segments = [];
  let cursor = start;
  let tile = Math.floor(cursor);
  while (cursor < end) {
    const next = Math.min(end, tile + 1);
    if (next <= cursor) {
      tile += 1;
      continue;
    }
    segments.push({ start: cursor, end: next, tile });
    cursor = next;
    tile += 1;
  }
  return segments;
}

export function mirrorRepeatCoordinate(value) {
  if (!Number.isFinite(value)) throw new TypeError('Mirrored-repeat coordinates must be finite');
  const tile = Math.floor(value);
  const fraction = value - tile;
  return tile % 2 === 0 ? fraction : 1 - fraction;
}

export function mapMirroredAtlasUv(worldU, worldV, uvRectTopLeft) {
  const { min, max } = uvRectTopLeft || {};
  if (![min?.u, min?.v, max?.u, max?.v].every(Number.isFinite)
    || max.u <= min.u || max.v <= min.v) {
    throw new TypeError('Atlas UV rectangle must have increasing normalized top-left bounds');
  }
  const u = mirrorRepeatCoordinate(worldU);
  const v = mirrorRepeatCoordinate(worldV);
  return [
    min.u + (max.u - min.u) * u,
    1 - (max.v + (min.v - max.v) * v),
  ];
}

function bilinear(alpha, tx, tz) {
  const top = alpha[0] + (alpha[1] - alpha[0]) * tx;
  const bottom = alpha[2] + (alpha[3] - alpha[2]) * tx;
  return top + (bottom - top) * tz;
}

export function appendMirroredAtlasQuad(buffer, {
  x0, z0, x1, z1, y,
  u0, v0, u1, v1,
  uvRectTopLeft,
  alpha = [1, 1, 1, 1],
}) {
  if (![x0, z0, x1, z1, y, u0, v0, u1, v1].every(Number.isFinite)
    || x1 <= x0 || z1 <= z0 || u1 <= u0 || v1 <= v0
    || !Array.isArray(alpha) || alpha.length !== 4 || !alpha.every(Number.isFinite)) {
    throw new RangeError('Atlas quad bounds and four corner alpha values must be finite and increasing');
  }
  const uSegments = intervalSegments(u0, u1);
  const vSegments = intervalSegments(v0, v1);
  let quadCount = 0;
  for (const vSegment of vSegments) {
    for (const uSegment of uSegments) {
      const first = buffer.vertices.length / 3;
      for (const [u, v] of [
        [uSegment.start, vSegment.start], [uSegment.end, vSegment.start],
        [uSegment.start, vSegment.end], [uSegment.end, vSegment.end],
      ]) {
        const tx = (u - u0) / (u1 - u0);
        const tz = (v - v0) / (v1 - v0);
        const opacity = bilinear(alpha, tx, tz);
        buffer.vertices.push(x0 + (x1 - x0) * tx, y, z0 + (z1 - z0) * tz);
        buffer.uvs.push(...mapMirroredAtlasUv(u, v, uvRectTopLeft));
        buffer.colors.push(1, 1, 1, opacity);
      }
      buffer.indices.push(first, first + 3, first + 1, first, first + 2, first + 3);
      quadCount += 1;
    }
  }
  return quadCount;
}

export function tessellateMirroredAtlasQuad(options) {
  const buffer = { vertices: [], uvs: [], colors: [], indices: [] };
  const quadCount = appendMirroredAtlasQuad(buffer, options);
  return { ...buffer, quadCount };
}
