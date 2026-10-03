# Dock shoreline foundation

[Water routing](water-navigation-foundation.md) · [Shore fishing](shore-fishing-foundation.md) · [Game rules](game-bible.md)

Dock is now a placeable Frontier land building beside water. It costs 100 wood,
takes 20 accumulated Worker-seconds and has 1,200 HP. These are provisional
foundation values, not naval balance tuning. It now produces the provisional
[Skiff](skiff-water-movement.md), using the shared paid queue and population rules.
It accepts [Skiff food cargo](skiff-fishing.md) at its water berth. It has no
Worker drop-off, rally, population or resource bonus. The existing procedural
House is an explicit Dock appearance placeholder; no finished pier artwork or
water-side pier collision is present.

## Land footprint and water access

The registry declares a normal 3 × 3 land footprint with
`placement: {kind: 'shoreline', waterClearanceCells: 1}`. All nine land cells must
be dry and level zero. Existing terrain/resource/objective/unit/building
exclusions, Worker reachability, connectivity and active land-route guards still
apply. Workers build and repair from ordinary reachable land access cells. No
water cell is made walkable for them.

[`createDockPlacementContext`](../src/dock-placement.mjs) snapshots authored
water/elevation and the new water graph. `accessAt(centerCell)` tests cardinal
faces in north, east, south, west order. It returns the first valid face or an
explicit rejection. A berth center is three cells from the building center;
its 3 × 3 clear-water square starts immediately beyond that land footprint.
The next center one cell farther outward must also have 3 × 3 clearance and a
legal cardinal water edge. This excludes a three-cell pond with no outward room.
Painted water, raised water, narrow strips, diagonal contact and outside-map
space never satisfy the rule.

The successful result contains `side`, `spawnCell`, `exitCell`,
`spawnFootprint`, `route` and `waterComponent`. The two-cell route is an admitted
outward topology step, not a moving boat. Optional `reservedCells` participates
in berth and exit clearance. Skiff admission and completion build a fresh context
with both seats' live water hull occupancy. A completed paid queue waits without
another debit until the berth clears. The Dock itself reserves only land; no pier
collision exists. Facing and access are derived, not checkpoint fields.

Client placement uses the same context, rebuilt when a map is applied. The
server applies the shore rule before any reservation, cost debit or Worker
order change, then uses the existing construction transaction. Checkpoint
validation independently checks each saved Dock's shore placement. The exact
preceding Mill content pin migrates without replacing its paid match; older
pins cannot claim a Dock. The checkpoint schema remains 22.

## Checks and gameplay availability

```sh
node --test scripts/dock-placement.test.mjs
node scripts/dock-scenario.mjs
```

Unit/contract coverage includes four shore faces, deterministic facing, invalid
sites, berth/exit reservations, stale access, immutable geometry snapshots,
both-seat browser preview, ordinary placement exclusions and compatible content
migration. The live scenario covers both-seat paid construction, no-debit
rejections, owner restrictions, unfinished/completed recovery, Workers staying
on land, unavailable training, food using existing drop-offs, and preservation
of rejected inland/old-content Dock checkpoints. The separate open-field
settlement fixture retains its paid ordinary land roster; Dock has its own
shoreline fixture. Skiff production, movement and blocked recovery have a separate
[`skiff-scenario`](../scripts/skiff-scenario.mjs).

For a small manual match, select **SHORE FISHING**, gather the local 100 wood,
select a Worker and choose Dock in the building menu. A geometry-admitted site
on the inner bank of Azure's pond is world `(-4.5, 8.5)` (one-based column 16,
row 25); Ember's counterpart is `(4.5, 8.5)` (column 25, row 25). Move units out
of the footprint if needed. Check the blocked preview inland, place/build the
foundation, select it and inspect the **Skiff (placeholder)** production option.
Train it when wood and population permit, select one boat, then target water to
move. These coordinates
are a topology handoff; automated DOM/commands do not establish rendered visual
quality or unassisted human usability.

Available gameplay is **place, construct, select, cancel, repair and attack a
shoreline Dock foundation**, train and move one provisional Skiff, and deliver
its finite fish food at the owned water berth. Transport and naval combat remain
subsequent scoped work; the procedural appearances remain placeholders.
