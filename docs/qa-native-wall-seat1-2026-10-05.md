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

Caller `01a10933-e913` and core `01a107ba` retain the
[agreed access/destination contract](qa-construction-endpoint-contract-2026-10-05.md#existing-semantics-and-the-next-interface),
merged as the source audit in [PR444](https://github.com/lbeezr/thousand-unit-skirmish/pull/444).
It preserves already parked conflicts as waits; the operation-local endpoint
query and construction consumer are separate next increments. Crowd does not
duplicate that implementation, move the parked builder, accept overlap or
silently change actor 120's destination.

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
Worker-retention PR438; the delivery also incorporates caller audit PR444
without runtime changes. Its retained unchanged paid-gate controls complete
64/64 on both seats at 992/2,615 ticks. Across 141,624 observed selected
substeps there are zero static/body contacts, zero missing control records,
and 72 preserved inactive actors per seat. These passing gate controls do not
replace the failed native wall endpoint assertion.

Independent review and exact-head documentation/module/pack checks belong to
the delivery PR. Source records, clean packs, provider deployment, served identity
and rendered proof remain separate. Existing CI/capture owner `01a10378`
retains the supported served/rendered interface; recorded capability/auth
blocks are not retried by this diagnostic slice.

## Grant eligibility continuation at `5f2c82f1`

The following observations extend the preceding diagnosis without enacting
another heuristic. A disposable source copy of
`5f2c82f1745ba9351701dd7773a75ddb328acfec`, Node 24.19.0, adds read-only
observations around selector calls, transient state transitions and accepted
`enqueueRouteRepairs` revisions. The native scenario's source, natural roster,
commands, 60-second deadline and final predicate are unchanged. Extra diagnostic
queries do not consume controller proposal budgets or publish actor/order
state. Observer timing is not a throughput or capacity measurement. Fresh
packets remain private and outside git; no private CPU archive is used.

This instrumented native run completes seat 0 at 1,320 ticks, then times out
on seat 1. The final retained checkpoint, absolute tick 3,161, has one completed
actor, 24 actors retaining the first leg's queued return, 39 active return-leg
actors, no pending planning and 100 HP for every selected Infantry. Worker68's
parked endpoint conflict remains with caller/core. These values identify this
run separately from the earlier `252abb29` run's 28/35 split.

### Eligibility and ownership are separate from lifetime

The last complete sampled selector tick is 3,120. All 63 central actors reach
the lease/priority arbitration section, each with 5–37 ordinary active queried
peers. Every actor therefore fails the existing `activePeers <= 1` lease guard.
None has a parked seed within the lease controller's `1.2` activation radius.
Sixty have at least 120 no-progress ticks; 37 have a fresh stalled body blocker
at the direct short capsule. Nine have both a fresh stalled blocking peer and
an admitted short escape with a clear full `.75` retreat corridor. Those
geometric observations do not override either eligibility guard or prove that
a grant would provide useful passage.

Transition observation records **zero pair-lease creations and zero contour
creations** throughout seat 1. There is no native grant owner, held grant,
expiry or canceled grant to explain this failure. A grant age of zero alone
would not distinguish a new grant from absence; the before/after creation
observations make that distinction here. The immutable parked endpoint is far
from the knot and is not a recovery seed for its central actors.

The source pair controller retains a 60-tick expiry, peer identity/order/path
validation, observed-progress release, fresh own-step admission and failed
unchanged-dependency suppression. Those lifecycle rules are not exercised by
these excluded central actors. Priority yielding remains a per-call lower-ID
choice; it does not create a lease owner or an expiring room reservation.

### Conflict observations and revision resets

The sampled direct-capsule body graph contains seven cyclic components,
including `{72,90}`, `{79,131}`, `{88,102}` and `{100,107,128}`. Only actor131
among the 15 vertices in those components has one of the tested full `.75`
escape corridors. Across all 63 actors, 25 have such a corridor, 24 have no
body blocking their direct proposal at that call, and 19 have an admitted
candidate discarded by priority yield. Candidate admission alone does not
establish forward usefulness or eventual multi-actor progress.

These are **serial per-call observations**, not a simultaneous global-pose
snapshot. A blocking edge records the real capsule/body test at its owner's
turn. After that actor admits a deflected step, another actor can observe a
different body dependency in the same tick. In particular, actor79's recorded
proposal initially meets actors101/131; after actor79's own admitted deflection,
the current pose observed at actor131's turn has a different blocker set for
that observed target. A graph made by combining earlier calls cannot substitute
for revalidating a peer's proposal at the prospective grant owner's live pose.
This is a diagnostic limitation, not a claim that production caches those
blocker lists.

The repair observer records 237 accepted seat-1 `blocked-route-repair`
revisions. Selector transition records include 277 revision/path resets,
alongside ordinary waypoint transitions and the wall's navigation change.
During sampled ticks 2,790–3,120, revision resets concentrate on actors104
(27), 102 (6), 90 (3), 110 (3) and 94 (1). Fifty-seven central actors have
at least 120 no-progress ticks and no revision reset in that interval. Repair
churn resets some local progress state, but cannot explain why that stable
majority never receives a grant. No grant is lost to those resets in this run.

### What the passing gate controls actually cover

The same observer on the existing paid-gate cases retains 64/64 arrivals at
992/2,615 ticks, 141,624 selected substeps with zero static/body contacts, and
72 unchanged inactive actors per seat. Controller maxima remain 77 short
proposals and 114 arbitration visits, with no missing control records. These
are fixed-tick planning-drain controls, separately from native scheduling.

Both gate seats create **zero pair leases**. Seat 0 creates no contours;
seat 1 creates 101 contours owned by nine moving actors. Every contour observes
parked Workers68/71 at the army's spawn, rather than the central choke. Recorded
lifetimes are 1–33 ticks, without order/path reset cancellation or expiry at the
90-tick deadline. No lease ownership/lifetime bug is validated by those passing
controls, and their contours do not establish recovery for moving-only choke
traffic.

Among the 60-tick samples, seat-1 gate traffic peaks at 42 central actors and
19 actors with at least 120 no-progress ticks; native traffic peaks at 63 and
60 respectively. The gate's central conflict components and discarded
candidates also occur before it eventually clears. Consequently a cycle,
priority discard, or a crowd wait is not by itself a sufficient diagnosis of
permanent failure. The missing coverage is recovery under a saturated,
moving-only multi-body dependency, with no nearby parked seed. The data do not
prove that density alone causes it or justify removing both lease guards.

### Smallest next observation before a runtime correction

At one retained stable dependency, record a fresh peer's projected desired
short segment and **all** its terrain/body blockers at the prospective grant
owner's current serial pose. For each already admitted, fully clear self-retreat
corridor, counterfactually test that peer segment with only the owner's pose
changed, without executing either move. Record whether the retreat actually
creates a traversable peer step, then retain the corresponding identity,
revision/path/waypoint and reset/progress observations over a short window.
Do the same for one priority-discarded admitted candidate. Peer eligibility or
a safe self-retreat alone does not establish usable room for the claimant.

That observation distinguishes an excluded useful dependency from a retreat
that leaves a third-body/static blocker or merely shifts the knot. It should
precede another policy variant. No new benchmark, full-suite rerun, deadline
change, parked shove or endpoint consumer patch is needed for this observation.
Any resulting correction still needs independently reviewed exact-head checks
and the unchanged native, gate/forest/bridge/Stop controls.

## Fresh public hosted failures at the same source

[Full hosted run37276714965](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37276714965)
checks exact source `5f2c82f1` with Node 24.21.0. Read-only public job logs confirm
these retained failures; no artifact bundle download or new full run is needed:

| Shard / public job | Passed / failed / unrun checks | Failure inside the selected check |
| --- | --- | --- |
| [1/3, job111655305551](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37276714965/job/111655305551) | `345 / 1 / 105` | Native seat 0 arrives 64/64 at 1,260 ticks; seat 1 times out at the original completion checkpoint, native script line36. |
| [2/3, job111655305371](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37276714965/job/111655305371) | `342 / 1 / 107` | Paid-house replay: seat-0 arrival `51/52`; seat-1 physical-point assertion; consecutive seat-0 footprints `45/46`. |
| [3/3, job111655305531](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37276714965/job/111655305531) | `344 / 1 / 105` | Dynamic wall: seat-0 queued-removal `58/64`; seat-1 queued-target `12/64`; seat-1 queued-removal `25/64`. Both paid-gate tests pass. |

Each shard stops after one registered check fails; a failing registered check
can contain multiple failed subtests. Unrun checks are not passes. All original
1,000-tick paid-house, 2,700-tick dynamic-wall and 60-second native deadlines
and physical arrival assertions stay intact. Hosted arrival deficits do not
identify every actor's cause. Keep the independently witnessed parked-endpoint
contract with caller/core and the demonstrated central crowd knot with crowd;
do not attribute all three workloads to one unobserved defect.

The user requests no new full rerun until a substantive fix. The repository
workflow runs the full suite on a new PR or main push, so this diagnosis update
can be retained on its non-main branch and in PR445's existing record without
creating another full-run event. It changes no workflow, access or protection.
Source-only observations do not close runtime, provider/served identity or
ordinary rendered verification.
