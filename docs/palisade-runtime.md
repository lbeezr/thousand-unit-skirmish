# Paid palisade runtime

This scoped runtime follows the reviewed [line planner](wall-line-planner.md)
and [paid preparation draft](palisade-construction-draft.md). The shared registry
now explicitly selects the configurable **provisional test profile**: 15 wood,
zero food, five accumulated Worker-seconds, 300 HP and a one-cell footprint.
These values are not final balance. Changing the profile changes the gameplay
ruleset identity. The existing ten-wood full-repair floor remains unchanged.

## Commands and atomic admission

`buildWall` accepts ordinary `ids`/`unitGenerations`, optional `clientOrderToken`,
1–256 grid `points: [{column,row}, ...]`, and the planner's `axisOrder`.
The existing `build` command with `buildingType: 'palisade-wall'` delegates a
single snapped cell to this same transaction. The normal registry building menu
now exposes drag-line placement: press to anchor, drag to an endpoint, release
to submit one `buildWall`. Shift switches the cardinal elbow; a tap places one
cell. On the focused battlefield, arrows move the endpoint and Enter anchors
then submits. Escape/RMB, lost capture and blur cancel an unsent gesture.

The client uses the shared planner and registry price for the whole connected
preview, aggregate exact-bank affordability and free friendly reuse. Known
terrain/resources/objectives, visible units and building footprints block the
whole preview. Off-map endpoints are never clamped. Release over HUD/outside
the canvas sends nothing. Pending input suppresses repeat submission and retains
the sent preview until its matching terminal notice, including no-charge reuse;
unrelated building snapshots cannot acknowledge a wall request. A rejection
releases input for retry. The preview has only disclosed occupancy, so fresh
server connectivity/access or hidden-occupancy rejection can still occur.

Palisade mode remains available at zero bank for free reuse, while the full
preview/submission still rejects unaffordable new cells. Ordinary building
entry retains its existing upfront price checks.

The server derives all prices, identities, occupancy and team ownership from
fresh authoritative state. Terrain, resources, objectives, live units, Town
Centers, other buildings and enemy walls block admission. Friendly palisades may
be reused without charge or recreation. A fully reused request is a no-op: it
does not reset progress or interrupt the current Worker order. Resuming stopped
existing segments uses ordinary `build` with `buildingId`.

All new cells are blocked together for the existing entity-connectivity and
active-route guards. Every segment needs access from the team's spawn component
and a common component of selected living Workers. Previously separate islands
need not become connected. Tentative occupancy is restored in `finally`.
Insufficient balances, illegal geometry, missing access, full building/ID limits,
or any collective route cut reject the whole line without payment, records,
ID consumption or a navigation revision.

After admission, one synchronous commit installs all ordinary building rows and
footprints, debits the aggregate cost once, advances the building counter, bumps
navigation once, invalidates vision/flows and repairs paths against the union
footprint. Per-cell dispatch cannot partially spend/admit a line.

## Worker sequence and lifecycle

Every admitted Worker receives an independent canonical row-major list of new
building IDs, tied to its unit generation and order revision. Workers route and
construct through the existing formation/interaction/build-time mechanisms.
Completion advances to the next unfinished segment; no extra payment occurs.
Internal route repair carries the sequence to its new revision. A new player
Move, Gather, Attack, Stop/Hold, Patrol/Follow, repair or construction order
invalidates the previous sequence, including a queued Move accepted during a
segment-completion window. A rejected full waypoint queue retains the work. Death and recycled unit generations cannot
resume it. Interrupted construction stays paid and unfinished until resumed or
cancelled through ordinary building controls.

Removing a current or pending segment prunes it from all active sequences;
current removal clears the old route and routes the remaining work only after
occupancy/components have been rebuilt. Existing cancellation refunds only the
unbuilt fraction once, combat destruction gives no refund, and construction
completion does not heal damaged HP. Repair uses the existing policy.

The optional `wallBuildOrder` lives in the unit checkpoint record, with copied
ID arrays and full validation of bounds, unique IDs, generation/revision,
ownership/type and current target. Older records restore no sequence. No schema
number change is needed for this additive field; lobby phase migrations retain
their schema authority. Only the exact pre-palisade ruleset
`v1:d85f5a09decc0d0ade81803ab289b52ec5a08e84ff5a1771e85401d4c3611eab`
is recognized as compatible, and only when it contains no palisades/sequences.
Unrecognized rulesets and corrupt sequences remain rejected/preserved.

## Layout and evidence

Connections are derived from visible same-team palisades per snapshot; they are
not duplicated occupancy/checkpoint state. Removed neighbors disappear on the
next snapshot. The procedural post/half-arm geometry is a layout placeholder
with center pivots and edge-midpoint seams for all sixteen cardinal masks.
Authored wall art, gate ownership/traversal, new siege rules and stone currency
are separate outcomes.

`palisade-runtime.test.mjs` checks sequence generation/revision/death invalidation
and actual placeholder geometry across all sixteen connection masks.
`paid-palisade-scenario.mjs` runs real two-seat commands and naturally progressing
Workers with token-preserving full worker restarts. It checks aggregate
bank/ID/navigation commits, malformed/off-map/occupied/insufficient/stale-generation
rejections, completion/reuse without repeat debit, pending/current cancellation
and sequence pruning/recovery, Stop persistence, a collective corridor route cut,
exact prior-ruleset migration and rejection/preservation of corrupt sequence
recovery. Existing draft tests still execute the real cancellation/destruction,
damaged construction and checkpoint-building fragments.

These prove bounded runtime behavior; contested-match balance and finished art
are unclaimed. [Drag UI checks and the native Mac recipe](qa-palisade-drag-ui-2026-10-03.md)
cover the next client slice; cloud native-browser startup is unavailable, so
DOM checks do not establish rendered/native usability. Hosted large-match
capacity is not established by these checks.
