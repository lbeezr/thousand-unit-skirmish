# Paid palisade construction draft

This is a proposal and executable preparation/lifecycle test harness, awaiting
parent review alongside art kit `01a101c3-0d65-730a-9cd1-4a2cca605039`. It does
not enable walls, register a default building, change the server or claim final
balance/art. The previous [line planner](wall-line-planner.md) remains the
geometry foundation. The next runtime outcome is a paid short wall, separately
from gates, team-specific traversal and siege-policy changes.

## Proposed tuning, not final balance

For one new **one-cell wood palisade** segment, propose **15 wood, zero food,
5 Worker-seconds and 300 HP**. The
[explicit draft profile](../src/wall-construction-draft.mjs) requires caller
supplied tuning; its proposal constant is not an active registry default.

| Comparison from the current building registry | Palisade proposal |
| --- | --- |
| House: 75 wood, 15 Worker-seconds, 800 HP, 3×3 footprint | One segment costs 1/5 as much, takes 1/3 as long, and has 3/8 the HP. |
| Five new one-cell wall segments | 75 wood and 25 Worker-seconds; 1,500 total HP distributed across five independent 300-HP breach points. |
| Watchtower: 50 food + 150 wood, 35 Worker-seconds, 1,200 HP, 3×3 footprint | Ten segments use the same wood but 50 Worker-seconds. They provide obstruction, with no ranged attack, products or population. |

These ratios make a short line a visible House-sized wood commitment, with more
total Worker effort than a House. A breach needs removal of one 300-HP segment,
not the line's aggregate HP. That is a starting hypothesis, not a contested-match
balance result. A dedicated barrier has higher HP per wood than a House, but no
economic output. Use only the existing `structure` tag and zero armor; adding a
`defense` tag would silently apply the existing siege damage multiplier and is
a separate decision. There is no stone currency.

Preserve current lifecycle policy: cancellation refunds unbuilt cost once;
combat destruction refunds nothing; construction progress does not heal damage.
The existing minimum full-repair charge is **10 wood**, which overrides 30% of
15 wood. Repairing an entire segment would cost two thirds of its construction
price. Do not quietly change this floor for walls; review that consequence in
the first paid-line proof. The five seconds mean one Worker's accumulated
construction time, not an unconditional wall-clock completion promise.

## Parent-supplied art layout contract

The parent supplied art kit `01a101c3-0d65-730a-9cd1-4a2cca605039`'s provisional
layout: one-cell modules, center pivots, half-arms reaching edge midpoints, and
all 16 cardinal connection combinations. This matches one world unit between
adjacent cell centers and a shared 1×1 logical footprint for straight, end/post,
corner and junction pieces. The focused contract test exercises every combination
against the existing planner and candidate building centers. This validates
layout compatibility, not meshes, pixels or finished runtime art. New artwork is
deferred. Visual height/material/style remain art decisions. Any later repeat
period change needs an explicit planner/occupancy revision; do not stretch its
simulation footprint implicitly. Gate apertures and open/closed states are
outside this slice.

## Authoritative adapter plan

[preparePaidWallLine](../src/wall-construction-draft.mjs) is a draft preparation
boundary. It allocates only candidate records and returns a whole plan; it does
not debit, install occupancy, issue Worker orders or persist a checkpoint.
Tuning, team, balances, counts/limits, next ID and all occupancy facts must come
from authoritative state. Compatible existing cells must be filtered by type
and owner; enemy walls remain ordinary occupied cells. Never accept client costs,
HP, IDs or asserted compatibility.

The server integration must complete these steps synchronously:

1. Validate command team/match, current Worker IDs/generations/build capability,
   prerequisites and current disclosed/authoritative placement facts. Rebuild
   the line from waypoints, not a client-supplied plan.
2. Capture connectivity and previous components. Tentatively block **all** new
   footprint cells together, rebuild components, then use the existing
   `canPlaceBuildingWithoutDisconnectingEntities` and
   `activeMoveRoutesRemainConnected`. Verify each segment has an access cell
   reachable by both the team and at least one selected Worker. Always roll back
   tentative occupancy in `finally` (or assess a copied grid).
3. Before committing, admit the whole line under `MAX_BUILDINGS = 128`, fresh
   food/wood balances and the existing home-ID ceiling. Returned next IDs stay
   below that ceiling. Failures must leave banks, records, occupancy and ID
   counters unchanged. Reused existing segments retain their identity/progress.
4. Install all rows/index entries and occupancy, debit the aggregate new-cell
   cost once, advance the ID counter, increment navigation revision once,
   invalidate vision/flow state and replan blocked paths for the union footprint.
   Do not call ordinary `buildBuilding` once per cell: that permits partial admission.
5. Route selected Workers with an explicit sequential segment target plan. A
   Worker currently has one `buildingTargetId`, so assigning every new segment
   at once would overwrite earlier targets. Stop/Move/Gather/Attack, death,
   cancel/destruction and generation mismatch must clear or repair that sequence.
6. Preserve existing cancellation, proportional repair, damage/destruction and
   footprint release. Recompute surviving neighbor topology after a removal;
   do not store stale topology as a second authoritative occupancy system.
7. Add the approved profile to registry/faction/presentation and ruleset identity
   together. Pin prices within a match so recovery/cancellation uses the same
   cost. Extend checkpoint validation/restore only for real runtime state, including
   any Worker sequence, then prove no second debit/refund after reconnect/restart.

## Focused evidence and remaining runtime proof

Run `node --test scripts/wall-construction-draft.test.mjs`. The harness injects
the proposal only into private test definitions, evaluates existing server
connectivity, cancellation/destruction, construction and checkpoint-building
validation/restore fragments, and uses the existing repair helper. It checks both
seats, full-line cuts, queued routes, per-segment Worker access, caps/IDs/funds,
duplicate reuse, fractional cancellation, corrupted records and no repeat debit
or refund after restoring damaged/partial records. Assessment exceptions restore
the test grid before escaping.

This is preparation/VM contract evidence, not a live paid-wall server proof or
a complete restart test. Before default rollout, parent review must resolve
tuning, and the runtime adapter must demonstrate both-seat paid short
lines, route rejection without debit, actual Worker sequencing/interruption,
segment cancellation/destruction and restart with partial damaged construction.
No broad gate policy or final-art acceptance is implied.
