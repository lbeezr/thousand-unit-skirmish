# Queued routes after cargo delivery — 3 October 2026

## Reproduced failure and source

At main `bd7e24431c005824a19f64204ee4c4aeca0561dd`, move a selected
Worker to its finite food source, gather all `0.5` food, Stop, Return cargo, and
queue a Shift Move. Both seats accept `WAYPOINT QUEUED`. Each banks the entire
load, but after 600 fixed ticks remains at its drop-off with one queued leg and
`moveGoalCell = -1`. Both baseline traces repeat exactly. The server SHA-256 is
`db6b4e94af4f4eec28424af61ea22416584484e71f452fee51f9d8a5ccfbf03e`.

Three assertions fail on that source before the fix: both real-body delivery
cases, and the queue ownership invariant before deposit. Historical failure
records, candidate replays and asynchronous results are retained in
[checks.json](qa-evidence/queued-cargo-return-2026-10-03/checks.json).

## Transition audit and bounded fix

`assignFormationMove` accepts a waypoint behind a source-free Return cargo route.
`advanceQueuedWaypoints` previously did not exclude `gatherPhase = 'to-base'`.
`stopGathering`, which completes delivery, clears the path and goal; that loses
the anchor required to advance a queued route. The five-line server change waits
for delivery completion and retains the current open cell as the completion
anchor only when queued legs exist. The existing sliced planner starts them.

The audit also traced `clearAttackTarget` on dead, hidden and unreachable unit
targets: direct pursuit ends at the current cell for an existing queue, while
attack-move restores its interrupted route. Active node/forest gather and build
orders remain excluded from ordinary ground-route queuing. A depleted gather
source returns its final load before finishing; source-free Return cargo does
not restore or look up that source. A destroyed/unreachable drop-off keeps cargo
in delivery intent while the existing drop-off helper reroutes or waits. This
slice changes the selected delivery completion transition only.

No target admission, fog filtering, selected-unit scope, navigation algorithm,
checkpoint schema, cargo arithmetic, movement speed or animation timing changes.
Stop/Hold clear delivery and queue while retaining cargo. Other selected-worker
construction and parked-Worker congestion results remain bounded by their own
[evidence and native recipe](qa-stationary-worker-pathing-2026-10-03.md).

## Candidate checks

Candidate `b7d8955bcc25748a492d00f725a3524971c105ab` has server SHA-256
`dc8c9b460ce815a9a875fc80c0a729eb129a62b7aa143585325c2f505174128b`.
The test adapter uses the actual server function bodies; fixed replays drain
planning callbacks between ticks. The asynchronous scenario launches the actual
server and two WebSocket seats, with natural gathering and no runtime cargo,
position or economy injection.

| Load and queued leg | Azure ticks | Ember ticks | Final outcome |
| --- | ---: | ---: | --- |
| `0.5` food, Move | 316 | 315 | Deposited once, queued destination reached |
| `0.004` food, Attack Move | 303 | 303 | Positive fractional cargo preserved and deposited once |
| `7.25` wood, Move | 316 | 315 | Deposited once, queued destination reached |

All six pairs repeat exactly. Twelve new focused tests cover those cases,
Stop/Hold interruption on both seats, premature advancement and lost-cargo /
duplicate-credit negative controls. The broader focused run passes 86 checks,
including return authority, stale generations, incompatible/unreachable/destroyed
drop-offs, stationary intent, selected construction, movement boundaries,
combat scheduling, Farm identity and CI sharding.

The asynchronous runs each use both seats and two queued legs: Move then Attack
Move. Restart during delivery preserves both queued destinations and all carried
cargo; the queue remains intact until deposit. Both Workers reach their final
destinations. A second restart and a rejected empty Return cargo leave the banks
unchanged: `[0.5, 0.5]`, `[0.004, 0.004]`, and `[7.25, 7.25]`. All other units
retain their intent and position; hidden foreign sources and units remain absent
from client snapshots. Foreign selections and stale generations reject.
Conservation is checked at each fixed tick and observed native checkpoint:
remaining authored stock + carried cargo + both banks equals initial stock,
within `1e-12` for floating-point arithmetic.

These figures establish the selected delivery transition on this eight-unit
open-field-derived fixture. They do not establish all target-lifecycle behavior,
universal crowd recovery, general navigation, deployment, rendered usability or
performance. The independent review and final integration/postmerge details are
recorded in the owning PR.

## Reproduction and native QA recipe

Run `node --test scripts/queued-cargo-return.test.mjs`,
`QUEUED_CARGO_RECORD=/tmp/cargo.json node scripts/queued-cargo-return-case.mjs`,
and `QUEUED_CARGO_NATIVE_RECORD=/tmp/native-cargo.json node scripts/queued-cargo-return-native-scenario.mjs`.
`--observe` captures bounded non-arrival when running the replay from the old
source with the new read-only harness; it does not change production behavior.

For an ordinary two-seat browser observation:

1. Import the [authored food fixture](qa-evidence/queued-cargo-return-2026-10-03/food-map.json)
   in Map Studio and publish it. Select one friendly Worker on each seat.
2. Move to the friendly `last-food-0` / `last-food-1` source at `(-12.5, 6.5)` /
   `(12.5, 6.5)`, Gather, and Stop after it empties while the Worker still carries
   the last food. Depleted Gather remains rejected.
3. Choose Return cargo, then Shift right-click a ground destination before the
   short return trip finishes. Observe `WAYPOINT QUEUED`, the delivery, the carry
   cue clearing, and continued movement to the accepted destination.
4. Repeat with Stop or Hold during delivery: the Worker stays where ordered,
   keeps its load and drops the queue. Confirm that other Workers keep their
   positions and hidden enemy sources remain undisclosed.

The native server/checkpoint recipe verifies fractional bank totals; ordinary
resource display rounds balances down to whole units. Browser usability remains
unverified by this server-only work.
