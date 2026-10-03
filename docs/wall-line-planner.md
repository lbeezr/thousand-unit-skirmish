# Modular wall-line authoring foundation

The pure [wall-line planner](../src/wall-line-planner.mjs) compiles grid waypoints
into connected one-cell pieces and one atomic creation/update plan. It is a
foundation module, not a playable wall feature. The
[focused tests](../scripts/wall-line-planner.test.mjs) run with
`node --test scripts/wall-line-planner.test.mjs`.

## Existing foundation inspected

At fork main `abcc2a4`, the [building registry](../src/gameplay-definitions.mjs)
has eight types with configurable `cost: {food, wood}` and square footprints.
There is no wall/gate building type or stone currency. The Barracks gate and
building walls in [the renderer](../src/main.js) are presentation parts, not
independent fortifications. Environment stone obstacles are terrain.

The [server](../server.mjs) uses separate terrain, building and home Town Center
occupancy masks. `buildBuilding` checks resources, objectives, live units,
prerequisites and reachable Workers; tentative occupancy must preserve existing
entity/active-route connectivity before payment. Construction/destruction
replans routes through the existing components and A* pathfinder. These rules
need a deliberate wall integration: calling the ordinary build command once per
cell would allow partial payment/placement and would not establish an atomic line.
No pathfinder or gameplay definition is changed by this foundation.

## Input and output contract

`planWallLine({width, height, points, axisOrder, blockedCells, occupiedCells,
existingWallCells, segmentCost, balance})` accepts integer grid coordinates,
not world coordinates. A cell index is `row * width + column`. Dimensions are
1–256; there are 1–256 waypoints. These bounds limit authoring work and do not
change the server's building limit. Off-map points reject without clamping.

Each leg first follows columns, then rows; `axisOrder: 'row-first'` reverses
that order. Diagonal drags therefore have a predictable cardinal elbow.
Reversing a diagonal drag can choose the other elbow; use explicit elbow
waypoints when direction-independent geometry is required. Repeated cells are
deduplicated. Output is sorted by cell index; connections always follow
`north, east, south, west`. Pieces are `post`, `end`, `straight`, `corner`, or
`junction`, with connections distinguishing T and four-way joins.

Supply arrays or Sets of cell **indices**, not occupancy masks:

- `blockedCells`: terrain, reserved cells, resource nodes and capture zones;
  retained forest stays blocked until depletion is known in the caller's snapshot.
- `occupiedCells`: other buildings, home Town Centers, live units and incompatible
  walls. Include complete and unfinished building footprints.
- `existingWallCells`: explicitly compatible walls allowed to connect or be
  reused. Ownership/permissions are the caller's responsibility. Other occupancy
  or blocking still rejects these cells when included in the line or an update.

The preview includes all requested pieces, new/reused counts, affected existing
updates, total cost and affordability. Adjacent existing walls outside the drag
are updated only if their connections change. Existing cells and corners are
charged once per new cell; joins/retraces do not incur an additional price.
The planner never mutates inputs, allocates entity IDs, debits resources or
places a subset of a rejected line.

| Status | Usable plan |
| --- | --- |
| `invalid` | None; errors identify illegal cells or off-map waypoints. |
| `cost-required` | None; geometry is previewed and price remains `null`. |
| `insufficient-resources` | None; the full requested cost is still previewed. |
| `ready` | One `{added, updated, cost}` plan. Omitted balance means unknown affordability. |

There is intentionally no default wall price. Pass an explicitly decided
`segmentCost: {food, wood}` using the registry convention. Zero is valid only
when explicitly supplied. Tests use synthetic prices and a House-cost shape
example; neither establishes balance or adopts the House price for walls.
Additional currency fields are rejected.

## Next integration boundary

The caller must build these facts from a validated map/current disclosed or
authoritative snapshot, then revalidate the whole plan against fresh state
before atomic placement/payment. Per-cell legality is not a navigation proof.
Worker access, connectivity, prerequisites, building limits, ownership,
checkpoint identity and authoritative transaction handling remain integration
work. Coordinate shared `src/main.js`, `server.mjs`, registry and UI edits with
their owners before that slice. Gate permissions, siege/nav rules and final
wall art remain separate decisions; this module makes no final-art claim.
