// Private checkpoint preflight only. Ordinary XL admission and live route
// publication are separate contracts; this never alters a path or durable goal.
export const XL_CHECKPOINT_ROUTE_LEGACY_SIDE = 256;
export const XL_CHECKPOINT_ROUTE_MAX_SIDE = 320;
export const XL_CHECKPOINT_ROUTE_MAX_ENTRIES = 1024 * 1024;
// Conservative slot accounting, not a measured JS heap/RSS or JSON byte limit.
export const XL_CHECKPOINT_ROUTE_SLOT_BYTES = 8;

function reject(message) {
  throw new Error(`Invalid match checkpoint: XL route budget ${message}`);
}

// Existing <=256 saves use their unchanged full validator, including its error
// ordering. Invalid/out-of-scope dimensions remain the map validator's job.
// Capture supplies its bounded live Map; parsed checkpoints supply an array.
export function preflightXlCheckpointRoutes(definition, state, { maxUnits, maxResourceNodes }) {
  const width = definition?.width, height = definition?.height;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 1 || height < 1 || width > XL_CHECKPOINT_ROUTE_MAX_SIDE
    || height > XL_CHECKPOINT_ROUTE_MAX_SIDE
    || (width <= XL_CHECKPOINT_ROUTE_LEGACY_SIDE && height <= XL_CHECKPOINT_ROUTE_LEGACY_SIDE)) return null;
  if (!Number.isSafeInteger(maxUnits) || maxUnits < 0
    || !Number.isSafeInteger(maxResourceNodes) || maxResourceNodes < 0) reject('invalid record limits');
  const units = state?.units, nodes = state?.resourceNodes, cellCount = width * height;
  if (!Array.isArray(units) || units.length > maxUnits) reject('invalid unit table');
  if (!(Array.isArray(nodes) || nodes instanceof Map)
    || (Array.isArray(nodes) ? nodes.length : nodes.size) > maxResourceNodes) reject('invalid resource table');

  // Count before reading any cells. At most 2*maxUnits+maxResourceNodes path
  // references are allocated; oversized arrays never incur an index scan/copy.
  const paths = [];
  let routeEntries = 0;
  function count(path) {
    if (!Array.isArray(path) || path.length > cellCount) reject('invalid path length');
    routeEntries += path.length;
    if (routeEntries > XL_CHECKPOINT_ROUTE_MAX_ENTRIES) reject('exceeds aggregate cell entries');
    paths.push(path);
  }
  for (let index = 0; index < units.length; index++) {
    const unit = units[index];
    if (!unit || typeof unit !== 'object' || Array.isArray(unit)) reject('invalid unit record');
    count(unit.path);
    if (unit.attackMoveResumePath !== null) count(unit.attackMoveResumePath);
  }
  for (const node of nodes instanceof Map ? nodes.values() : nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) reject('invalid resource record');
    if (node.wildlifeHerd !== null && node.wildlifeHerd !== undefined) {
      if (typeof node.wildlifeHerd !== 'object' || Array.isArray(node.wildlifeHerd)) reject('invalid wildlife herd');
      count(node.wildlifeHerd.path);
    }
  }
  let validatedEntries = 0;
  for (const path of paths) for (let index = 0; index < path.length; index++) {
    const cell = path[index];
    // Indexed iteration also rejects sparse holes; JSON nulls never qualify.
    if (!Number.isInteger(cell) || cell < 0 || cell >= cellCount) reject('invalid cell index');
    validatedEntries++;
  }
  return { width, height, cellCount, routeArrays: paths.length, routeEntries, validatedEntries,
    routeSlotPayloadBytesUpper: routeEntries * XL_CHECKPOINT_ROUTE_SLOT_BYTES,
    auxiliaryPathReferences: paths.length };
}
