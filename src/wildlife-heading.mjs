// Canonical Sheep body yaw: zero points +Z; positive angles turn toward +X.
// The admitted standing captures use the older nose yaw, measured from the same
// world axes. Keep that source convention at the authored/still boundary only.
export const SHEEP_HEAD_BODY_OFFSET_DEGREES = 42.03499984741211;
export const SHEEP_HEAD_BODY_OFFSET_RADIANS = SHEEP_HEAD_BODY_OFFSET_DEGREES * Math.PI / 180;
const TAU = Math.PI * 2;
const DIRECTIONS = Object.freeze([
  'north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west',
]);

export function normalizeWildlifeHeading(heading) {
  const wrapped = heading % TAU;
  return wrapped < 0 ? (wrapped + TAU) % TAU : wrapped === 0 ? 0 : wrapped;
}

export function authoredWildlifeNoseHeading(definition) {
  return (definition.wildlifeNoseYawDegrees ?? 0) * Math.PI / 180;
}

export function bodyHeadingFromLegacyNose(heading) {
  return normalizeWildlifeHeading(heading - SHEEP_HEAD_BODY_OFFSET_RADIANS);
}

export function legacyNoseHeadingFromBody(heading) {
  return normalizeWildlifeHeading(heading + SHEEP_HEAD_BODY_OFFSET_RADIANS);
}

export function authoredWildlifeBodyHeading(definition) {
  return bodyHeadingFromLegacyNose(authoredWildlifeNoseHeading(definition));
}

export function wildlifeDirection(heading) {
  // Nearest 45-degree world sector. Exact halfway ties choose increasing yaw,
  // including 337.5 degrees wrapping to north. The allowance absorbs only
  // arithmetic roundoff at a tie, including the legacy offset round trip.
  const sector = normalizeWildlifeHeading(heading) / (Math.PI / 4);
  return DIRECTIONS[Math.floor(sector + .5 + 16 * Number.EPSILON) % DIRECTIONS.length];
}

// Schema28 stored legacy nose headings. Change only that scalar after the Herd
// migration; schema29 is never converted again. Validation still owns all saved
// position, motion, path, anchor, claim, stock, cargo and economy fields.
export function migrateWildlifeHeadingCheckpoint(snapshot) {
  if (snapshot?.schemaVersion !== 28 || !Array.isArray(snapshot.state?.resourceNodes)
    || !Array.isArray(snapshot.mapDefinition?.resourceNodes)) return false;
  const definitions = new Map(snapshot.mapDefinition.resourceNodes.map(node => [node?.id, node]));
  const nodes = snapshot.state.resourceNodes;
  if (definitions.size !== snapshot.mapDefinition.resourceNodes.length
    || new Set(nodes.map(node => node?.id)).size !== nodes.length) return false;
  for (const node of nodes) {
    const definition = definitions.get(node?.id);
    if (!node || !definition || node.wildlifeSpecies !== definition.wildlifeSpecies) return false;
    if (definition.wildlifeSpecies !== 'bellweather-sheep') continue;
    const motion = node.wildlifeMotion;
    if (!motion || typeof motion !== 'object' || Array.isArray(motion)
      || !Number.isFinite(motion.heading) || motion.heading < 0 || motion.heading >= TAU) return false;
  }
  for (const node of nodes) if (node.wildlifeSpecies === 'bellweather-sheep') {
    node.wildlifeMotion.heading = bodyHeadingFromLegacyNose(node.wildlifeMotion.heading);
  }
  snapshot.schemaVersion = 29;
  return true;
}
