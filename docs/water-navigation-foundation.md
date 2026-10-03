# Water navigation foundation

[Shore fishing](shore-fishing-foundation.md) · [Water presentation](water-surface-study.md) · [Movement QA](qa-unit-pathing-2026-10-03.md)

3 October 2026; the graph was introduced against baseline `ae88e0f`.
The [Dock shoreline foundation](dock-shoreline-foundation.md) now uses it for
live building placement and water berth clearance. The subsequent
[Skiff slice](skiff-water-movement.md) adds one paid, unarmed water unit and
Move/Stop orders. [Fishing cargo](skiff-fishing.md) now uses finite food and an
owned Dock berth. Transport and naval combat remain separate. Shore fishing
continues to use land Workers and finite food. Mill is now a food-only land
drop-off; fish/skiff/dock art remains separate work.

## Current movement and shore contracts

| System | Current contract | Consequence for a later boat/dock adapter |
| --- | --- | --- |
| Authored water | `waterRaster` reads `water` obstacle rectangles. Terrain paint and cosmetic depth/curves do not change cell collision. Diagonal wet cells remain separate. | Use authored logical water, not rendered shore outlines, to admit routes. |
| Land routes | Server `isWalkable` excludes all obstacles, building footprints and home Town Centers. Components/A* use cardinal cells and elevation rules. | Feeding this land mask into water routing would block every water cell. Keep domain masks separate. |
| Land movement | `canTraverseUnitStep` checks crossed boundaries, including both open sides for diagonal crowd deflection. | Cell-center routes alone do not validate a moving hull's continuous sweep or separation. |
| Buildings | `buildBuilding` requires an open, level footprint without resources, objectives, units or connectivity loss, plus a reachable land Worker approach. Dock adds a dry level-zero foundation and adjacent clear water berth. | The current Dock has only land occupancy. A later pier needs an explicit water reservation and admission validation. |
| Production | `findProductionSpawnCell` searches open land in the owner's spawn component, reserving units/resource cells; queues wait when no room exists. | A boat needs an explicitly reserved water spawn with footprint clearance and a water route. Dock now uses fresh reserved water berth/exit clearance for Skiff production; other producers retain this land contract. |
| Fish | Node `x/z` is a land bank; the position helper derives an adjacent one-cell water visual center. Stock/cargo are food. | Cosmetic schools are neither vessels nor water destinations for Workers. |

The standalone graph remains independent of shared land masks. The Skiff adapter
uses its own tick and planner, excludes water actors from land separation and
construction-route guards, and declares water identity in registry/saved actors.
Land traversal helpers and A* retain their existing contracts.

## Isolated topology API

[`src/water-route-graph.mjs`](../src/water-route-graph.mjs) exports:

- `createWaterRouteGraph(definition, {reservedCells: [], clearanceCells: 0})`.
  It snapshots obstacle/elevation geometry, rejects malformed/overlapping
  obstacle rectangles, and admits only authored level-zero water. Omitted
  obstacle material retains the existing non-water/stone meaning. Geometry
  dimensions are bounded to 1–256 for small fixtures and shipped maps; the
  server's full map validator still requires its usual 16-cell minimum.
- The frozen opaque graph exposes dimensions/counts, `isNavigable(cell)`,
  `componentAt(cell)`, `cellAt(x, z)` and `pointAt(cell)`. Cell IDs use
  `row * width + column`. World positions use the existing centered grid.
  Bounds are half-open and outside positions return `-1`; conversion never
  snaps an invalid land destination into a pond.
- `canTraverseWaterEdge(graph, from, to)` admits exactly one cardinal edge
  between two navigable cells. Dry islands, bank cells, diagonal contacts,
  row wrapping and raised water create no edge.
- `findWaterCellRoute(graph, start, goal, {maxExpandedCells})` returns
  `{status, expandedCells, cells}`. Status is `found`, `invalid-endpoints`,
  `disconnected` or `budget-exhausted`. Found routes include both endpoints;
  same-cell routes contain that one cell and expand none. Breadth-first search
  returns a shortest cardinal path, choosing neighbours in ascending cell-ID
  order. The default expansion budget is the graph cell count; explicit
  budgets range from one to that bound. Exhaustion is not topology failure.
- `isWaterCellRouteValid(graph, cells, {startCell, goalCell})` checks each
  admitted cell and edge plus optional exact endpoints. Rebuild the graph and
  revalidate after reservations or authored geometry change. Its masks are
  private, returned routes are independent arrays, and serializing a graph
  does not produce a recoverable runtime state.

`reservedCells` excludes caller-supplied water occupancy without editing the
map. `clearanceCells` (integer 0–4) requires a fully admitted square around each
route center: zero admits a cell-center topology; one requires a 3 × 3 area;
two requires 5 × 5. Reservations participate in clearance. Off-map space never
counts as clear water. This is a grid clearance test, not a chosen skiff size,
turning radius, shallow-water depth, speed or continuous collision model.
No existing land blocker array is passed as reservations, and the graph never
changes a shared mask or stock. A future caller must supply its own water
reservations and rebuild on relevant occupancy changes.

## Checks and available behavior

```sh
node --test scripts/water-route-graph.test.mjs
node scripts/water-route-map-scenario.mjs
```

Focused tests cover shortest island routes, diagonal ponds, edges, invalid
endpoints, painted/raised water, exact conversion, reservation invalidation,
clearance, bounded searches and immutable snapshots. All 512 local 3 × 3 wet/dry
patterns are compared with existing contour component boundaries. The shipped
map audit checks routes within each basin, refuses routes between basins,
proves water cells remain blocked for land units, checks fish water/land
positions and preserves every map field. Both checks enter the ordinary CI
runner. The two pilot ponds remain disconnected; this graph creates no bridge.

The graph's first live caller was Dock placement. It now also supports the
separate Skiff runtime, proven in a real two-seat WebSocket match with production,
occupancy, movement and recovery. Live shore-fishing and existing land movement
remain integration regressions. Final art and browser appearance are not claimed.

## Current integration and follow-ons

Dock and Skiff now cover land construction, paid production, population,
blocked-berth completion, cardinal hull movement, owner validation and recovery.
The adapter uses one-cell static shore clearance without inflating live hull
reservations a second time; its tick checks hull occupancy before moving.

[Single-Skiff food delivery](skiff-fishing.md) is supported. Multi-boat formations/queued routes, transports,
pier collision and naval combat remain later independent slices. Final art can
replace the explicit placeholder after its dimensions and runtime binding are
verified against the hull contract.
