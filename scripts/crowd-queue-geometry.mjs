// Source-only geometry vocabulary. This never grants movement or waives priority.
// A caller must separately establish identity, route, controller and admission
// validity. In particular, lateral-rejoin does not establish continued progress.
const EPSILON = 1e-9;
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);

export function classifyQueueGeometry({ from, to, peer, routeDirection, progressTarget, radius, peerRadius }) {
  if (![from, peer, routeDirection].every(finitePoint)
    || !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(peerRadius) || peerRadius <= 0)
    return 'undetermined';
  const length = Math.hypot(routeDirection.x, routeDirection.z);
  if (length <= EPSILON) return 'undetermined';
  const x = routeDirection.x / length, z = routeDirection.z / length;
  const ahead = (peer.x - from.x) * x + (peer.z - from.z) * z;
  const across = (peer.x - from.x) * z - (peer.z - from.z) * x;
  if (ahead <= EPSILON) return 'undetermined';
  // Overlapping transverse body supports retain ordinary queue priority even
  // when the proposed step itself is oblique or improves the raw waypoint.
  if (Math.abs(across) <= radius + peerRadius + EPSILON) return 'queue-following';
  if (![to, progressTarget].every(finitePoint)
    || (to.x - from.x) * x + (to.z - from.z) * z <= EPSILON) return 'undetermined';
  const beforeCross = (progressTarget.x - from.x) * z - (progressTarget.z - from.z) * x;
  const afterCross = (progressTarget.x - to.x) * z - (progressTarget.z - to.z) * x;
  return Math.abs(afterCross) < Math.abs(beforeCross) - EPSILON
    && Math.hypot(progressTarget.x - to.x, progressTarget.z - to.z)
      < Math.hypot(progressTarget.x - from.x, progressTarget.z - from.z) - EPSILON
    ? 'lateral-rejoin' : 'undetermined';
}
