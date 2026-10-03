# Depleted resource construction sites — 3 October 2026

At build `ae88e0ff0c93deddfd7f7e08433293e531f39fe7`, the open-field-derived
`depleted-sheep-site-proof` map reproduced an invisible construction exclusion
for both seats. Eight starting units, no fog, zero starting food and 100 wood
per seat; each side's Sheep at `(-12.5, 6.5)` / `(12.5, 6.5)` held `0.5` food.
After gathering and delivery, both nodes were `depleted` with zero stock and
each seat banked `0.5` food. Building a Storehouse on either cleared cell still
rejected `RESOURCE NODE IN FOOTPRINT`, preserving `[100, 100]` wood banks.

`node scripts/depleted-resource-construction-scenario.mjs --reproduce-only`
preserves that authored fixture and reports actual placement notices on the
selected build. The ordinary scenario adds finite timber and untouched Sheep
to test fixed construction and the guards together.

The server now uses current stock when checking resource-cell occupancy and
capturing resource access points for proposed-building connectivity. Only
exact-zero stock releases them; unknown/positive stock remains protected. The
checkpoint validates the complete saved resource table before checking building
overlap, using validated remaining stock and authored positions for that check.
actual browser build preview likewise ignores only disclosed zero stock, with
authored blocking restored during map/rematch initialization. Remaining terrain,
units, objectives, buildings and active-route protections stay in force. This
rule applies to finite ordinary food/wood and Sheep, with no resource deletion,
new currency, stock regeneration, checkpoint shape or moving-animal change.

Validation commands:

- `node --test scripts/depleted-resource-construction.test.mjs scripts/building-placement-forest.test.mjs`
- `node scripts/depleted-resource-construction-scenario.mjs`
- `node scripts/interrupted-cargo-return-scenario.mjs`

Focused tests execute the actual server occupancy/connectivity and client build
preview functions. Sheep, ordinary food, timber and fish use the same stock
rule; unknown, partial, malformed and restored stock keeps its exclusion. Live
entities and terrain retain their guards. A fish bank's adjacent water remains
a terrain restriction even after exhaustion.

The real-server scenario rejects living resource sites without spending wood,
gathers both Sheep and timber pools, restarts depleted state, and builds a paid
Storehouse and House on each side's exhausted cells. A restart during construction
preserves progress and the single debit; all four buildings finish normally.
Food/wood stock plus both banks, carried resources and paid construction equals
the authored budget at every boundary. A duplicate-debit negative control fails
the assertion. Occupied footprints and untouched Sheep still reject construction;
empty Gather remains rejected. Post-completion recovery preserves the result,
and rematch restores authored stock and its construction exclusion.
Corrupted checkpoints with a positive resource under a building, a duplicate
resource ID or a missing row reject and are preserved before a fresh match.

The unchanged Return cargo/drop-off helpers filter completed owned reachable
buildings by `dropoff.includes(cargoType)`. A food-only Mill uses that existing
contract; its profile, costs, footprint and compatible save migration belong to
the Mill author. This slice does not add its gameplay definition or modify its
delivery rules. Native browser appearance is not established by these checks.
