# Skiff fishing cargo

[Shore source](shore-fishing-foundation.md) · [Water movement](skiff-water-movement.md) · [Dock placement](dock-shoreline-foundation.md)

Select **Skiffs (placeholder)** and target an authored shore-fish bank marker.
The boat sails to a reachable water approach beside that source's school visual,
gathers existing food, delivers it at a completed live owned Dock, and resumes
while stock remains. Provisional tuning is **10 food capacity and 1 food per
second**. The registry includes that tuning in the gameplay ruleset revision.

The node's `x/z` remains the land bank for Workers. Its existing position helper
derives one adjacent water visual cell; the boat approach is that cell or one
of its eight neighbors admitted by the existing hull-clearance graph. This
one-cell casting margin admits the shipped pilot's pond corners; it never adds
diagonal movement edges. A source may
support land fishing without having enough clear water for a Skiff. Disconnected,
occupied or unrouteable approaches reject before replacing orders.
[Group commands](skiff-selected-groups.md) require a distinct approach per selected boat.
Initial fishing also requires a reachable owned Dock. No land snapping or new
resource variant is introduced.

Workers and boats subtract from **the same finite `food` stock**. Depletion is
authoritative, with no default regrowth. Workers retain Town Center, Storehouse
and Mill delivery. Dock is a boat-food drop-off through its water berth; it does
not join the land Worker drop-off registry. No second fish inventory or currency
exists. A blocked berth or destroyed Dock retains cargo and waits for an owned
reachable Dock, retrying once per second. Food credits only on actual arrival.

**Stop**, Move and Hold Position retain cargo and cancel fishing. **Return
cargo** delivers an owned Skiff's food to its reachable owned Dock and finishes
without resuming the source. Reissuing fishing resumes using the existing cargo;
a full hold delivers first. [Groups of up to 16 Skiffs](skiff-selected-groups.md)
use distinct approaches and Dock berth cells. Mixed land/water selections and
queued fishing remain unavailable. Boats remain unarmed
and carry no passengers. The procedural boat and Dock appearances remain explicit
placeholders; this change makes no finished-art or rendered usability claim.

## Recovery and evidence

Schema 22 reuses the existing cargo, gather phase, source, drop-off and water
route fields. Stop, outbound travel, partial gathering and automatic return
retain intent and stock across restart. Validation rejects wrong cargo, foreign
Dock references, unknown or disconnected sources and harvesting away from the
admitted water approach. Rejected saves remain preserved. Exact preceding
movement-only revisions can migrate bare boats and paid queues, but cannot
claim cargo or fishing intent that those definitions never admitted. Existing
land and Farm migration rules retain their content boundaries.

```sh
node --test scripts/skiff-fishing.test.mjs scripts/skiff-contracts.test.mjs scripts/contextual-hud.test.mjs
node scripts/skiff-fishing-scenario.mjs
node scripts/skiff-scenario.mjs
```

The deterministic tests check approach derivation, fractional cargo, repeated
delivery, finite depletion, occupied/missing/foreign drop-offs and conservation.
The real WebSocket scenario buys one Dock and Skiff for each seat, saves and
recovers Stop cargo and automatic return, then gathers the same stock with a
land Worker and boat concurrently. Each seat's 31 authored food becomes exactly
31 banked food, with no remaining stock or cargo; restart keeps it depleted.
Movement-only bare boat/paid queue migration and preserved invalid saves are
also exercised. The DOM check verifies that carrying boats expose Return cargo
while Worker build controls remain hidden. These checks enter ordinary CI.
