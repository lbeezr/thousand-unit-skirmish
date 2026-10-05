# Native wall seat-1 timeout diagnosis — 5 October 2026

Crowd owner `01a10933-c2b0` retains this separate source diagnosis and the
remaining runtime correction. Art N/A. Construction owner `01a10933-e913`
and core owner `01a107ba` retain parked-builder/exact-destination semantics.
No construction access, accepted endpoint, shared position writer or runtime
policy changes are included. This is a diagnostic milestone; native wall
completion and ordinary served/rendered acceptance remain open.

## Public-source reproduction

The [earlier public failure](https://github.com/lbeezr/thousand-unit-skirmish/pull/400#issuecomment-5989366549)
identifies `7cbe59765c0d10bb8fb3820403c8b6e37c7e13f4` and the completion
checkpoint in [dynamic-wall-native-scenario.mjs](../scripts/dynamic-wall-native-scenario.mjs).
A fresh run of that unchanged program at clean
`252abb29cc0a8638ec7a68844f4f631bc01123dc`, Node 24.19.0, completes seat 0
with 64 arrivals and 64 distinct goals in 1,320 ticks. Seat 1 times out at the
same checkpoint with the original 60,000 ms deadline and final predicate.
The test still requires empty queues, no pending planning, a consumed route,
and physical arrival within `.02` of every accepted goal-cell center.

The existing public baseline map, natural 64-Infantry roster, two accepted
Moves and seven paid wall pieces are reused. No actor placement, new benchmark,
deadline extension, endpoint replacement or fixture assertion waiver is used.
Read-only copies of this fresh run's checkpoints were retained before its own
fixture teardown. No CPU archive was accessed, transferred or published.
Diagnostic scripts, packets and disposable experiments stay outside git;
this record publishes only scoped source findings and measurements.

## Where the units stop

The last retained seat-1 checkpoint is absolute tick 3,120. Map changes do not
reset the native tick counter; this is not a claim of 3,120 seat-1 elapsed ticks.
One actor, 89, has arrived. All 63 unfinished actors remain within four world
units of the original choke center `(.5, .5)`, far from their accepted goals.
Twenty-eight still have the queued return and are on their first westbound
Move; 35 have consumed that queue and are on the eastbound return. None has
pending planning, all have 100 HP, and no combat target explains the stop.

Representative values from that checkpoint:

| Actor | Pose `(x, z)` | Current accepted goal | Queued accepted goal | Route index/length | Revision |
| --- | --- | --- | --- | --- | --- |
| 88 | `(.029, .780)` | `(16.5, -1.5)` | empty | `11/29` | 3 |
| 93 | `(.961, .302)` | `(-11.5, -.5)` | `(13.5, -.5)` | `46/59` | 2 |
| 94 | `(.924, .743)` | `(-11.5, .5)` | `(13.5, .5)` | `48/61` | 2 |
| 110 | `(.526, .220)` | `(-7.5, .5)` | `(17.5, .5)` | `45/53` | 2 |
| 115 | `(.102, .346)` | `(-10.5, .5)` | `(14.5, .5)` | `53/63` | 2 |
| 120 | `(1.344, 1.335)` | `(-6.5, 1.5)` | `(18.5, 1.5)` | `0/10` | 80 |
| 130 | `(.468, .738)` | `(19.5, 2.5)` | empty | `8/29` | 2 |

Between absolute ticks 2,790 and 3,120, actors 88, 115 and 130 have exactly the
same pose and route index. Actor 93 moves only `.003542` world units, 94 only
`.043268`, and 110 only `.000104`, without advancing their route indices.
Actor 120 moves `.238548`, but its revision rises from 45 to 80 and it remains
at route index zero. Static repair acceptance does not establish route progress.
The mixed first-leg/return traffic is a moving-body choke stall, independently
of the far-away destination occupancy described below.

## Grant, proposal and repair observations

[unit-crowd-steering.mjs](../src/unit-crowd-steering.mjs) explicitly clears a
lease with more than one active queried peer. Its
[crowd-wait-lease.mjs](../src/crowd-wait-lease.mjs) controller also requires a
nearby parked seed; [crowd-parked-contour.mjs](../src/crowd-parked-contour.mjs)
is parked-body recovery. The central moving-only knot satisfies neither
recovery contract. Cell insets and soft separation do not prove physical room.

A second native run uses a disposable read-only vector observer, with production
function bodies, commands, final predicate and 60-second deadline preserved.
Seat 0 arrives in 1,260 ticks; seat 1 again times out. Native planning timing
changes which actors stall: 64 central actors are observed at absolute tick
3,120, including 26 with the first leg still queued. Every retained vector
observation has zero lease/contour age and no neighbor overflow. For example,
actor 73 reports 1,179 no-progress ticks, 31 queried bodies and 69 proposals;
actor 115 reports 956 no-progress ticks and actor 130 reports 1,039. This is
live grant observation, separately from cold replay controller state.

Restoring the first run's exact last checkpoint into the existing fixed-tick
replay recreates the stall without actor injection. It resets transient
WeakMap steering state, so it cannot establish the original grant history.
Across 160 subsequent ticks, all 72 inactive actors retain pose and command
intent. The observer sees 6,496 selected position substeps with zero static or
body-pair contacts. That bounded restored-input observation does not claim
whole-native-journey safety or eventual arrival.

A read-only candidate audit on the cold replay records 103 central stalled
actor samples: 45 have no admitted forward/lateral candidate; 13 have an
admitted candidate before priority yield discards it. Those two cases need
separate retained witnesses. An admitted short step alone does not prove that
removing arbitration will resolve a multi-actor dependency safely or fairly.

## Separate occupied destination

Worker 68 is parked at `(18.5, 1.5)`, route index `1/1`, without a construction
work target. Actor 120's accepted queued destination is cell 3,234, the exact
same point. Infantry/Worker radii `.22/.18` require `.4` body clearance;
distinct military cell reservations do not reserve a physical endpoint against
a parked Worker. With both intents preserved, this independently prevents all
64 exact endpoint arrivals. It does not explain the 63 mid-route choke stops.

Caller `01a10933-e913` is auditing this access/destination contract with core
`01a107ba`. Crowd does not duplicate that implementation, move the parked
builder, accept overlap or silently change actor 120's destination.

## Retired experiments and next bounded slice

A disposable generalization of the existing lease removes the parked seed and
single-active-peer guard. After 2,700 additional cold replay ticks, arrivals
remain `1/64` and all 28 first-leg actors still have their return queued, despite
multiple transient grants. The variant is retired.

A second disposable variant retains the passage lane while the current body is
in a narrow cell and its next waypoint is open. The restored choke still ends
at `1/64` with 28 first-leg actors. It also regresses the unchanged paid-gate
seat-1 control to `0/64` at 2,700 ticks; seat 0 remains `64/64` at 992 ticks.
That variant is retired. Neither experiment is a qualified runtime fix.

Crowd's next action is a small retained public-source witness distinguishing
physically unavailable movement from an admitted step lost to priority yield.
A candidate must demonstrate a specific fresh blocking dependency, bounded
progress/repair/fairness, finite duration **and displacement** for any retreat,
unchanged-dependency renewal suppression, and reset on eligibility/order/route
changes. Every own step must pass fresh terrain/body admission. Retain the
original native deadline and full endpoint predicate, plus both seats and
existing gate/forest/bridge/Stop controls. Endpoint resolution remains a
separate caller/core dependency; it cannot substitute for choke progress.

The diagnosis delivery incorporates main `16047ce2`, including the separate
Worker-retention PR438. Its retained unchanged paid-gate controls complete
64/64 on both seats at 992/2,615 ticks. Across 141,624 observed selected
substeps there are zero static/body contacts, zero missing control records,
and 72 preserved inactive actors per seat. These passing gate controls do not
replace the failed native wall endpoint assertion.

Independent review and exact-head documentation/module/pack checks belong to
the delivery PR. Source records, clean packs, provider deployment, served identity
and rendered proof remain separate. Existing CI/capture owner `01a10378`
retains the supported served/rendered interface; recorded capability/auth
blocks are not retried by this diagnostic slice.
