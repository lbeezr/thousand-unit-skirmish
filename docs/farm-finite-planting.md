# Finite Farm planting

[Game rules](game-bible.md) · [Earlier proposal](farm-capability-proposal.md)

Farm is one paid, finite planting in the Frontier roster. It costs **60 wood**,
takes **15 accumulated Worker-seconds**, occupies **3 × 3** cells and has **600 HP**.
Completing construction creates **200 food stock** on that building, once. All
values are provisional and configurable in `src/farm-harvest.mjs` and the shared
gameplay registry; changing them changes the content pin. No host-only multiplier
or hidden regrowth is enabled.

These values start below the 75-wood Mill/House investment and use the existing
15-Worker-second construction baseline. The 200-food pool is four Worker training
prices and takes at least 200 total harvesting Worker-seconds at the unchanged
1-food/second rate, plus trips. This is a bounded wood-and-labour investment in
local supply, not an adopted food/wood exchange rate or a claim of final balance.
The lower 600 HP leaves durability to observe in contested matches. No player
matches were measured to choose this initial prototype tuning.

## Harvesting and ownership

Select Workers, then right-click the completed owned Farm (or use the ordinary
touch Orders target flow). Workers approach its reachable perimeter and carry
food to a friendly completed Mill, Storehouse or Town Center. Farm is not itself
a drop-off. It grants no units, population, passive bank credit or gathering bonus.
The existing per-Worker rate and 10-resource carry capacity apply; multiple
Workers share the same finite stock without a separate reservation/gatherer cap.

Only the planting's owner can harvest it. Authored map nodes remain neutral under
their existing rules. Enemy Farms can be attacked; their stock cannot be harvested
or captured. An unfinished planting supplies nothing. Stop preserves cargo;
Return cargo delivers it through the existing food routing and leaves the Worker
idle. An obstruction replans a Farm approach against its perimeter, rather than
an arbitrary open cell near the footprint's center.

At zero stock the completed plot remains in place. Its selected-building action
offers **Clear exhausted Farm · no refund**. Replanting is a fresh, paid build
with a fresh building/source ID and another finite 200-food pool. No productive
completed Farm can be canceled for a refund. Unfinished cancellation retains the
ordinary proportional refund and creates no food stock. Destruction loses the
remaining crop; already-carried food stays real cargo and routes to a friendly
drop-off. Repair follows the existing paid wood/HP contract and never refills stock.

## Resource and recovery boundary

`harvestStock` on the building is the single persisted crop pool. A `farm:<id>`
food-target adapter exposes it through ordinary Gather and wire observations;
the colon cannot collide with an authored map node ID. Crop stock is never added
to the map definition or its authored-node checkpoint array. The source lifetime
is the paid building's lifetime; IDs are not reused until a match reset, which
also clears old orders and all plantings.

This keeps the shared map/resource boundary compatible with the
[mineral audit](mineral-economy-readiness.md): Farm uses existing food, no new
resource enum, bank, cargo kind, neutral-node schema or ore cost. Map authoring
continues to own authored node admission; a subsequent Stone slice needs typed
bank/debit/refund work before any node type is admitted.

The existing checkpoint schema remains 22. Current content pins require valid
Farm stock, construction state and owned harvest references. The exact preceding
Skiff pin migrates Farm-free paid work, including Gate/Dock/Skiff rows, without changing
banks, crop sources or unit identity. The older Dock pin retains its existing
Gate-free migration. Older content pins cannot claim a Farm or planted stock. Restart
restores unfinished work, remaining crop, cargo and depletion; rematch starts
again from the authored map and initial banks.

## Prototype presentation and checks

The renderer explicitly uses the existing procedural House as a **Farm placeholder**;
the selected-building hint names that status, remaining stock and no regrowth.
No crop artwork or paid model is claimed. Distinct field art can follow the actual
3 × 3 plot and its productive/exhausted stock states. The deterministic harvester
sees and gathers existing owned Farms through the same bounded node policy;
automatic AI planting/replanting is not part of this slice.

```sh
node --test scripts/farm-harvest.test.mjs scripts/farm-client.test.mjs scripts/roster-building-ui.test.mjs
node scripts/farm-scenario.mjs --output=NEW_DIRECTORY
node scripts/mature-settlement-scenario.mjs
node scripts/mature-settlement-scenario.mjs --reverse-seats
```

The Farm command scenario covers both seats, paid construction, prior content-pin
preservation, unfinished recovery, ownership rejection, retained cargo to Mill,
finite depletion, no-refund clearing, proportional unfinished cancellation,
fresh paid planting, destruction/cargo conservation, no duplicate recovery credit
and host reset. Banks, crop stock and cargo are never injected. Destruction uses
declared HP/position fixtures with existing initial Infantry. Numerical budget
checks tolerate accumulated floating-point noise; depleted crop stock is exactly
zero. Automated checks do not establish native visual quality or human balance.
