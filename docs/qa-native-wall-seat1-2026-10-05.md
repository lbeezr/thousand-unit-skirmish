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

## Fresh peer-step room observation — 5 October continuation

Crowd's next bounded observation uses the retained public-source `5f2c82f1`
native samples at ticks 2,880–3,120, rather than repeating the native journey.
A disposable adapter restores the matching, locally captured checkpoint only
for the unchanged terrain/elevation oracle and full paths. It overlays the
owner and queried peers' recorded serial poses and path indices, checks
identity/revision/path length, matching navigation revision and the raw waypoint
heading, then recomputes
`crowdPassagePoint` from that pose. All 108 admitted owner reconstructions match
the recorded owner projection; four records with a path/identity mismatch are
excluded. The two principal peers below also retain the raw-route direction
observed at their own turn. These are fresh source-derived diagnostics, outside
git; no private CPU archive or artifact bundle is accessed or published.

Only strict terrain/body-clear `.75` self-retreat corridors already observed
in the original trace are considered. For the relevant close peers, their
first desired segment and every possible contacting body lie inside the
owner's recorded `2.1` neighborhood. The restored full roster supplies additional
physical checks; no unrecorded far actor can establish the positive short-step
witness. The owner corridor uses the full swept capsule, not endpoint cells or
soft separation. Terrain checks retain map bounds, elevation/corner traversal
and static clearance. Peer checks use its freshly projected desired target and
an ordinary first-step budget (`2.6 / 30` for Infantry), not its distant final
goal or another actor's earlier blocker list.
A positive peer opening and every horizon step require strict swept static
clearance and nonnegative body margins within `1e-9`; admission through an
inherited-contact escape does not qualify as zero-contact room.

The counterfactual changes only the prospective yielding actor's pose, first
by its admitted short retreat and then by the full `.75` corridor. It executes
neither move, modifies no controller state, creates no lease/contour and never
publishes a route/order/position. The peer's next execution must still revalidate
its own budget, priority, route and all current bodies. In particular, a
lower-ID peer may already have consumed its real movement budget that tick.

### Concrete useful room and counterexamples

At the owner's retained tick-3,120 serial pose:

| Owner / peer | Fresh desired segment before retreat | Result after legal owner retreat | Progress and safety limit |
| --- | --- | --- | --- |
| 131 / 79 | Strict terrain-clear; actor131 is its only body blocker. | The owner's first `.086667` retreat already clears the peer's first segment. A full `.75` retreat also clears it, with peer body margin `+.017131`. | The first peer step advances `.081377` toward its raw waypoint. The next projected same-waypoint step is blocked by actor101. Full owner retreat loses `.749211` of raw-waypoint progress; corridor body margin is `+.003914`. |
| 91 / 119 | Strict terrain-clear; blocked by actors91 and121. Actor91 has an admitted candidate discarded by priority. | Both clear owner corridors (90°/105°) leave actor121 blocking the peer, after either the short or full retreat. | No peer step becomes legal; residual body margin is `-.015030`. Owner corridor margins are positive (`+.005025` / `+.057424`), so self-clearance alone is insufficient. |
| 110 / 87 | Strict terrain-clear; actor110 is the only blocker. | The first owner retreat leaves the peer blocked. Either full corridor clears it, with peer body margin `+.006173`. | At tick3,120, nine counterfactual same-waypoint projections cover `.78` without contact. At tick3,060 the same identity/revision/path-index pair reaches only `.26` before actor81 blocks it. A one-call opening does not promise a persistent corridor. |

These positive peer segments have zero static/body contacts in the tested
counterfactual. The negative margin in the second row is a rejected diagnostic
proposal, never an executed contact. The same-waypoint horizon freezes every
other actor and does not consume a waypoint, run priority selection or service
planning. It bounds the room observation; it is not a multi-tick execution,
route-completion guarantee or fairness result.

Actor131's revision2/path-index14 is stable from ticks3,000–3,120; its recorded
wait grows from121 to241. Actor79 keeps revision3/path-index13 across ticks2,880–3,120, with wait584→824. Actor91's revision4/path-index6 is stable across
the observed window, with wait666→906; peer119 keeps revision1/path-index48
across that window, with wait557→797. Actor110/87 keep revisions15/4 and path indices0/0 between the two compared
samples. Their waits grow153→213 and483→543 while the available body corridor
changes. These observations retain actor/route progress separately from a
changing dependency and do not claim a persistent pair from one blocker edge.

Across the selected 108 owner observations, 15 fresh stalled peer segments are
blocked by the owner. Ten become clear after at least one full retreat, and
seven after at least one admitted short retreat. Counts describe this bounded
sample and overlapping candidate trials, not success rates for the native
roster. No executed native recovery or all-64 completion is claimed.

### Unchanged passing controls

The same read-only projection/retreat observation runs in the existing paid
gate controls, with original commands and the 2,700-tick completion limit:

| Seat | Completion / ticks | Selected substeps | Static / body contact steps | Inactive actors preserved | Sampled owner-blocked peer segments / cleared after full retreat |
| --- | --- | --- | --- | --- | --- |
| 0 | `64/64`, `992` | `43,208` | `0 / 0` | `72` | `3 / 1` |
| 1 | `64/64`, `2,615` | `98,416` | `0 / 0` | `72` | `19 / 11` |

All 25/155 recorded owner projections match the live control projection;
controller maxima remain77 proposals/114 arbitration visits with zero missing
control records. Gate seat1 also exhibits a one-step opening followed by a
third-body blocker (owner98/peer118, then actor97), yet eventually completes
under the existing controller. Therefore such a local witness alone cannot
explain permanent native failure or select a safe recovery rule. Regenerated
identity-dependent capsule hashes are not compared as byte-stable packets.

### Precise remaining correction contract

This observation establishes physically useful local room and equally concrete
insufficient-room counterexamples. It does **not** qualify removal of the
multi-peer guard, a new lease, a priority exemption or a parked shove. Runtime,
Stop/order priority, accepted endpoints and original native deadlines remain
unchanged. Worker68/actor120 endpoint occupancy remains caller/core-owned.

A correction needs an agreed pure executor projection/admission contract at the
current serial pose: peer identity, order/navigation/epoch/path/index guards,
actual available first-substep budget, projected target and every static/body
blocker. Reading a final goal or invoking the mutating selector as a preview
cannot satisfy it. Crowd owns the bounded recovery rule; core owns agreement
on any host adapter before shared `getMoveVector` or position-write edits.

The recovery rule must then show **executed** peer route progress within finite
owner time and displacement bounds, with fresh admission of every owner and
peer step, release/reset on observed progress or changed eligibility, and
suppression of repeated failed unchanged dependencies. Actor131/79 is the
specific counterexample to treating one freed step as that proof; actor91/119
is the counterexample to granting solely because the owner's escape is clear.
The changing110/87 corridor requires revalidation rather than a room promise.
Deterministic fairness and preservation of inactive/parked actors must be
measured in the unchanged both-seat native and gate/forest/bridge/Stop controls
before claiming a runtime correction. No full-suite retry, new PR/main push or
served/rendered proof accompanies this source-only diagnosis continuation.

## Executed finite-retreat diagnostic — current-main continuation

The next executable slice incorporates main `80999c54`, including the separate
core-owned endpoint query, without adopting or changing that endpoint consumer.
[The narrow interface request](https://github.com/lbeezr/thousand-unit-skirmish/pull/400#issuecomment-5990685776)
asks core to agree a pure own-call projection/admission seam before shared
executor edits. No reply or production integration agreement is claimed here.

The disjoint [projection helper](../scripts/crowd-executor-projection.mjs) is
**test tooling**, not a production steering adapter. An own-call frame carries
actual `remainingStep`, actor identity, generation, order revision, path reference
and index, pose, tick, navigation revision and epoch. A stale guard refuses before
reading the query. A future-turn bound is explicitly unspendable. Missing,
incomplete or overflowing query metadata refuses a positive witness; host query
completeness remains part of the interface contract. Strict short-segment static
and body blockers remain separate from inherited-contact escape. A clear desired segment is physical evidence only: actual selector priority
and parked-target waits can still refuse it. The helper never invokes the
selector or publishes state.

[The finite diagnostic](../scripts/crowd-finite-retreat-diagnostic.mjs) adapts
copies of the existing fixed-tick fixture, server and crowd module. It observes
the real own-call budget and runs the original selector, existing multi-peer
lease guard, planner and pre-write branches. Its explicitly experimental
intervention replaces only one active owner's chosen short heading with a
strictly admitted self-retreat. It grants no peer priority, moves no peer,
creates no lease/contour and refuses to interrupt an existing grant or parked-target wait. Every step
rechecks route/pose/phase guards and full current static/body clearance. The
maneuver ends at `.75` total retreat length, after at most12 ticks, on a changed
guard, eligibility loss, query refusal, an unobserved own-turn gap or a new blocker.
A canceled attempt cannot resume or restart when that condition clears. The normal controller resumes immediately; there is
no hold, renewal, new order, changed goal or queue publication.

### Retained input and repeatability

For each owner91/110/131, the original tick3,120 samples reconstruct the
consistent physical world at that owner's serial call: earlier actors use their
post-move checkpoint poses, and later actors use their recorded pre-call poses.
All63 selected actors' observed final proposals exactly predict their final
checkpoint positions; identities, revisions, path lengths and raw headings
match. Full paths, accepted goals/queues, health and parked actors come from the
matching locally captured checkpoint. The resulting checkpoint passes the
existing validator. No actor is invented, no parked unit is moved and no endpoint
is shifted. Inputs and fresh diagnostic packets remain outside git; no private
CPU archive is read or published.

Cold replay deliberately rebuilds transient selector state and drains planning
between ticks. It is a causal comparison from a retained physical call state,
not an exact continuation of warm native scheduling/controller state. This
matters: actor87 already makes progress in the cold baseline. Its improvement
below therefore cannot claim that the original native knot is fixed.

Each baseline and retreat runs48 ticks, twice from the same input. Each pair's
full-unit trajectory hash matches exactly, without normalizing identities.
Across all12 runs,24,754 selected substeps have zero static/body contacts.
All72 inactive actors retain position, health and accepted movement/work intent;
normal aggressive-stance scan clocks can change and are not falsely described
as immutable full state. Own-call projections match the original projected
target with zero mismatches.

| Owner / observed peer | Finite maneuver | Peer fixed-waypoint progress at tick48: baseline → retreat | Limitation |
| --- | --- | --- | --- |
| 110 / 87 | Completes `.75` in9 ticks. | `1.626825 → 2.213696` | Peer87 advances another `1.670103` after the retreat completes. Peer81 instead loses `.101418` progress relative to baseline, so a chosen peer's gain is not fairness. |
| 131 / 79, chain through101/108/109 | Completes `.75` in9 ticks. | `.094339 → .128139` | Peer79 remains below `.15` sustained progress; another completed self-retreat does not clear the chain. |
| 91 / 119, also blocked by121 | Aborts at tick3 after2 steps / `.173333`, when a body closes the corridor. | `.588823 → .517808` | Fresh admission prevents contact, but peer119 loses `.071015` relative to baseline. |

The primary peers keep their original revisions and path indices across these
48-tick comparisons. Progress is measured toward the same retained raw waypoint;
distance travelled or a repaired/new route does not substitute for it.

The three immutable input hashes are respectively
`cfd1082efd5e12d7d621195780a96fb44331e6d13dbb56a301a9510d24305333`,
`aa16070737e1563c65bfb91d13a023c2fa3a338122648acf92e425031b00586b`, and
`4305540bc7f64fef6a74cb17807458432697b6d2086466468ffd48ef62b5bec9`.
They identify these locally retained source-derived inputs, not a public packet
bundle or private archive entitlement.

### Existing gate controls and bounded work

The same own-call observer, with **no retreat intervention**, retains the
existing paid-gate controls:64/64 at992/2,615 ticks,43,208/98,416 selected
substeps, zero static/body contacts and72 unchanged inactive actors per seat.
Across47,512/109,025 observed own calls, there are zero target mismatches.
Observed maxima are63 query visits,48 direct body checks,16 short-segment
static-cell observations,22 passage-point observations and828 passage body
visits across native comparisons; gate maxima remain within these bounds.
The contract refuses beyond128 query visits/64 retained bodies and caps short
static-cell work at25. The finite probe considers at most4 explicitly named
future peer bounds when it starts. Diagnostic overhead does not consume the
production controller's proposal budget and is not a throughput/capacity claim.

Focused regressions cover actual/future budgets, stale route/pose guards,
incomplete/overflowing queries, all body blockers, strict inherited-contact
classification, static contacts, Stop/pending/parked eligibility, nonmutation,
finite displacement, expiration, changed orders, fresh-body aborts and permanent
cancellation after eligibility/query/observation gaps. These
checks and the original steering/lease regressions pass together (69 tests).
The CI change only registers those focused tests; workflow triggers and access
remain unchanged. A new PR/main push would still start the full suite, so this
unqualified diagnostic remains on the diagnosis branch.

Run the existing public-source gate controls with:

```sh
node scripts/crowd-finite-retreat-diagnostic.mjs --gate-controls=true
```

For an authorized locally retained input, the smallest actual-progress comparison
is four48-tick runs (baseline/retreat, each repeated):

```sh
node scripts/crowd-finite-retreat-diagnostic.mjs --input=LOCAL_CHECKPOINT --owner=110 --peers=87,81 --angle=-90 --ticks=48
```

The tool reads the supplied checkpoint and performs no archive download. Do not
publish its raw input/report packets to close a source-summary milestone.

### Decision and smallest next experiment

Executed local progress after a finite own retreat is now witnessed, together
with repeatability and strict contact checks. A deterministic, fair ordinary-game
recovery policy is **not** established: the successful pair already progresses
in its cold baseline, another neighbor loses progress, and both multi-body cases
fail to justify the single-owner remedy. No production correction, guard bypass,
new lease, deadline relaxation, parked shove or endpoint patch ships.

A justified next experiment should test a **bounded dependency frontier**, rather
than repeat a single-peer lease exemption: at most4 active actors, at most2 finite
owner maneuvers, one at a time, each independently admitted at its real own call.
Measure whether clearing both current blockers enables sustained executed route
progress for the shared peer, and retain effects on every frontier actor plus
unchanged-dependency abort/retry suppression. The tradeoff is extra local query
work and potential return-to-gap interference; neither permits a room promise,
neighbor movement, hold or endpoint change. Deterministic selection and bounded
loss/fairness need a separately reviewed rule before runtime adoption. Core's
pure executor seam, unchanged native deadlines and both-seat gate/forest/bridge/
Stop controls remain dependencies; source/pack/provider/served/render proofs stay
separate. Art backing is N/A for this internal diagnostic slice.

## Bounded dependency-frontier comparison — construction-containing boundary

The core-owned pure diagnostic interface is now agreed through the delegated
decision: host-owned live guards, actual own-call remaining budget and fresh
serial-pose neighbors; future previews spend nothing and promise no passage.
The [original narrow proposal](https://github.com/lbeezr/thousand-unit-skirmish/pull/400#issuecomment-5990685776)
identifies the seam. This slice uses disposable adapters; it neither requires a
production executor edit nor introduces a global approval dependency. Core keeps
budget, position admission and publication/repair. Crowd owns the disjoint
[frontier coordinator](../scripts/crowd-dependency-frontier-probe.mjs),
[comparison runner](../scripts/crowd-dependency-frontier-diagnostic.mjs) and tests.

The integration boundary is explicit: preliminary comparisons use main
`51e3d038`; the retained comparisons below incorporate construction consumer
`c8aa92c8`/PR448 and core endpoint query PR446. The consumer owns safe construction
access/work-pose admission and retained paid jobs during dynamic endpoint waits.
The crowd adapter leaves that consumer intact. Both sources reproduce the same
full-unit trajectory hashes for these comparisons. Worker68's inherited parked
pose and the other inactive actors remain preserved; construction's separate
paid-house/endpoint acceptance is not inferred from choke progress or failure.

### Scope, deterministic selection and bounded work

The retained actor110 input and physical serial reconstruction from the previous
section are reused; no new benchmark, archive or packet publication is introduced.
Fresh own-call observations identify actor77 as actor81's remaining desired-step
blocker. The intervention frontier is exactly **77/81/87/110**, four actors total.
Three comparisons run from the same input: unchanged baseline, original actor110
retreat, and that retreat followed by at most one additional actor's finite retreat.

After actor110 finishes, currently body-blocked frontier peers are ranked by least
executed progress toward their original fixed raw waypoint, with actor identity
breaking exact ties. Every body blocker counts. Seven fixed retreat angles are
considered for eligible frontier blockers that have not already yielded. A
candidate must have a strict full static/body corridor and clear the chosen
peer's entire current desired segment at the previewed far pose. Other currently
clear frontier desired segments must remain clear **at that far pose**; this does
not promise uninterrupted clearance while the owner retreats or returns.

Selection is revalidated at the chosen actor's own serial call. Future frames
remain unspendable. Each step uses actual remaining budget and the existing
executor's admissions; no peer moves, no priority/grant changes, and no endpoint,
accepted goal, queue, deadline or Stop/order override is introduced. Each maneuver
is bounded to `.75`/12 ticks. They never overlap. A failed selection or changed
dependency is not retried within this episode. Any route/identity/phase,
eligibility, query or observation failure permanently cancels the attempt,
including cancellation before activation. There is no room hold or renewal.

There is one second-maneuver planning decision plus at most one own-call
revalidation. With four actors and one already attempted owner, the worst case is
126 angle trials and378 counterfactual projections. Every query retains the
128-visit/64-body limits and overflow refusal. In this case, only4 angle trials,
6 counterfactual projections/50 direct body visits,36 corridor body visits and3
additional future queries are observed; frontier-query maxima are43 visits/23
retained bodies. The first retreat's separate bounded previews and the original
controller's work remain visible in their own reports. This is bounded diagnostic
work, not a capacity or production throughput result.

### Executed result and longer comparison

Each mode repeats twice at48 ticks and again twice at96 ticks:12 runs total.
Full-unit trajectory hashes and coordinator reports repeat exactly, without
normalizing identities. Across37,078 selected substeps there are zero static/body
contacts, and actual cell/elevation admission passes. All72 inactive actors retain
position, health and accepted movement/work intent; normal scan clocks can change.

Actor110 finishes `.75` in9 ticks. At tick10, the deterministic rule selects
actor77 to help actor81. Actor77 advances through8 admitted retreat steps,
`.693333` total, then aborts before step9 at tick18: returning actor110 closes the
corridor, with proposed swept margin `-.045250`. The existing admission prevents
contact. Both owners immediately resume ordinary steering.

| Frontier actor | Baseline progress at48 | Frontier progress at48 | Difference | Frontier progress during ticks24–48 |
| --- | --- | --- | --- | --- |
| 77 | `.708403` | `.913345` | `+.204942` | `+.165958` |
| 81 | `.911273` | `1.303164` | `+.391891` | `+.194003` |
| 87 | `1.626825` | `1.834769` | `+.207943` | `+.492798` |
| 110 | `1.608361` | `1.914949` | `+.306588` | `+.805369` |

All four retain their original route/order/index/goal/queue at48, and all four
exceed `.15` executed progress during the last24 ticks. This is a finite local
gain, not fairness. The conservative affected-neighbor set unions neighbors of
the owners' admitted steps over the whole window and includes all64 selected
military actors. At48,21 of those actors lose more than `.01` fixed-waypoint
progress relative to baseline; the original single retreat disadvantages26.
Actor119's loss is `.431832` in both interventions. Changed routes are excluded
from positive fairness qualification using full path hashes as well as accepted
generation/revision/index/goal/queue. These measurements do not attribute those
losses to construction endpoint occupancy.

The96-tick holdout rejects sustained recovery even inside the four-actor frontier:
actor81 is `.453568` behind baseline and moves `-.705883` toward its retained
waypoint during ticks72–96. Actors77 and87 also move backward during that interval,
by `.018832` and `.301175`. At tick89 the frontier guard observes actor110's
advanced route index and cancels the already exhausted episode; its later progress cannot be credited as
an unchanged-route fairness witness. Twenty-seven affected actors lose more than
`.01` at96. Both48- and96-tick whole-neighbor comparisons fail the declared `.15`
sustained-progress/`.01` loss test. Cold replay and fixed planning drain still do
not reproduce warm native scheduling or close original native completion.

The construction-containing observer-only paid-gate controls remain64/64 at
992/2,615 ticks, zero contacts across141,624 selected substeps,72 unchanged
inactive actors per seat and zero projected-target mismatches. No full suite,
native wall rerun or deployment/render claim follows from this focused control.

Focused controls pass together:78 tests, including deterministic progress ranking
and exact ties, preservation of clear far-pose peer segments, every blocker,
pre-start cancellation, peer order/Stop/path/phase changes, query/observation loss,
no unchanged retry, own-call budget spending and transferred-loss/route-replacement
rejection. Runtime imports pass at216 modules/395 local edges with zero cycles.
The CI registry adds only this focused test; workflow triggers remain unchanged.

Run the local comparison without fetching evidence:

```sh
node scripts/crowd-dependency-frontier-diagnostic.mjs --input=LOCAL_CHECKPOINT --ticks=48
node scripts/crowd-dependency-frontier-diagnostic.mjs --input=LOCAL_CHECKPOINT --ticks=96
```

### Decision and next bounded experiment

The deterministic ranking and two finite maneuvers are executable and reviewed
as diagnostic tooling. They **do not qualify a production fairness policy**:
short-window gains transfer loss to neighbors and disappear at the longer bound.
The returning first owner is an executed third-body counterexample to far-pose
room predictions. Increasing the frontier or extending a room promise is not
justified by this result.

Crowd's next smallest experiment is admission that accounts for the first owner's
actual return-to-gap progress and affected-neighbor service debt, still within
four actors/two finite maneuvers. It must use executed own-call receipts and a
fresh accepted guard set, never a counterfactual baseline oracle, held owner or
future space reservation. Retain the96-tick transferred-loss counterexample and
original both-seat gate/forest/bridge/Stop controls before any runtime adoption.
Core's pure diagnostic boundary is agreed; only a concrete overlapping production
interface decision would require further coordination. Endpoint occupancy remains
construction owned. Fresh source-derived inputs/results stay outside git; the
separately denied drafts and pending private bundle are neither accessed nor
published. No new PR/main event or full-suite rerun until a substantive qualified
fix. Source/pack/provider/served/render proofs stay separate; art backing N/A.


## Return admission and executed service accounting — diagnostic rejection

This continuation reuses the preceding actor110 serial-pose input and the exact
`c719377c`48/96-tick controls, including their21 harmed-neighbor controls. It adds
only disposable diagnostic admission hooks and a read-only receipt ledger;
production steering, position writes, Stop/order priority, endpoint publication,
repair and construction consumer `c8aa92c8` remain unchanged. The input SHA-256 is
`cfd1082efd5e12d7d621195780a96fb44331e6d13dbb56a301a9510d24305333`.
These are cold source reconstructions with the same planning drain, not a warm
native continuation or a new benchmark.

### Assessment before another motion heuristic

Twenty of the original21 harmed actors already lose more than `.01` with only
actor110's first retreat. Fourteen have exactly the same loss with one or two
retreats. None of those21 show that seed-only loss at sampled ticks0–15; four do
at24 and20 at48. Thus the apparent early gain conceals later transferred loss,
and repairing only the second retreat cannot account for most of it. Desired-step
blockers outside the declared77/81/87/110 frontier are75/76/83/93/103. This is
specific evidence that this four-actor episode omits relevant dependencies; it
does not prove a particular global coordinator is necessary or establish a
64-body causal component from proximity alone.

The [receipt ledger](../scripts/crowd-service-ledger.mjs) accounts for at most64
original moving actors and128 admitted substeps per consecutive tick. It validates
identity, accepted goal/queue/revision, full original path fingerprint, serial
receipt chain and current live endpoint before crediting any substep. Publication,
phase change, missing receipts, overflow or unreceipted movement refuses credit.
The retained input declares1,839 route cells, bounding fingerprint work per frame;
the workload has at most52 receipts per frame and no rejected frames. Individual
route changes still invalidate their records. Its service clock starts at retained
tick3120; no earlier native service history is imported. A new `.15` executed
high-water gain pays service once; returning to an old peak cannot pay again.
Each admitted substep peak is retained, including a peak lost within the same tick.
This is observed route service, not a predictor of counterfactual opportunity loss.

### Three admission variants and retained controls

The [admission wrapper](../scripts/crowd-service-admission-probe.mjs) adds no heading,
priority, hold, grant, peer write or room promise. The intervention remains four
actors/two nonoverlapping finite maneuvers, with the original128-visit/64-neighbor
queries and actual own-call movement budgets.

* **Return:** after110's nine-tick retreat, ordinary movement continues while the
  second planning attempt waits up to12 ticks for `.15` actual seed recovery. At
  tick14 that condition and the previous executed return-leg capsule pass: margin
  `+.219646`. Actor77 still retreats toward81;87 closes its corridor after two
  admitted steps totaling `.173333`. The next proposed margin is `-.029954`, so
  the original body guard aborts before contact. The gate changes the closing
  body from110 to87 without producing fair recovery.
* **Return plus debt:** the same selected own call also checks current queried
  active bodies for valid receipts, service age at most12 and backslide at most
  `.15`. Twelve boundary records veto the second maneuver at tick14, including
  only four of the original21 harmed controls. The full trajectory exactly
  reproduces seed-only retreat at both windows; it cannot undo that first
  maneuver's transferred losses.
* **Entry:** at110's first own call, active neighbors75/76/83 are outside the
  declared intervention frontier, so it refuses the episode once. No retreat
  executes, and the full trajectory exactly matches baseline at both windows.
  This conservative seed-entry coverage check is not continuing closure or a
  recovery witness: the baseline still stalls.

| Diagnostic mode | Affected actors losing >`.01` at48 | Original21 losing >`.01` at48 | Affected actors losing >`.01` at96 | Original21 losing >`.01` at96 |
| --- | ---: | ---: | ---: | ---: |
| Seed only |26|20|25|13|
| Original frontier |21|21|27|12|
| Return |22|14|26|13|
| Return plus debt |26|20|25|13|
| Entry refusal |0|0|0|0|

All comparisons remain unqualified under the original `.15` sustained-progress
and `.01` transferred-loss test. At96 the return variant's last24-tick gains are
`-.028861`, `+.032035`, `-.077442`, `+.000748` for77/81/87/110 respectively;
none reaches `.15`. At48,16 of18 still-valid original harmed frontier records
have service age greater than12, but a recently served actor still loses `.431832`
against baseline. Receipt age therefore exposes starvation without perfectly
identifying transferred loss. Invalid route records are never counted as valid
fairness witnesses.

The six modes each repeat exactly at48 and96, including the complete unit
trajectory and coordinator/ledger reports. The original baseline, seed-only and
frontier traces exactly match `c719377c`, confirming observation does not change
movement. Across24 runs,74,220 selected admitted substeps have zero static/body
contacts with original terrain/elevation admissions;72 inactive actors retain
position, health and accepted intent in every run. Entry's zero added losses are
zero-intervention equality, not an improvement. Focused controls total92 tests;
the two new suites cover receipt gaps/overflow/phase and route mutation, within-tick
peaks/revisits, return capsule geometry, stale admission and boundary debt/coverage.
They are registered in the existing CI lane without changing workflow triggers.
Art backing is N/A for this internal diagnostic.

Run only against authorized local source inputs and retained controls:

```sh
node scripts/crowd-service-admission-diagnostic.mjs --input=LOCAL_CHECKPOINT --control-48=LOCAL_CONTROL_48 --control-96=LOCAL_CONTROL_96 --ticks=48
node scripts/crowd-service-admission-diagnostic.mjs --input=LOCAL_CHECKPOINT --control-48=LOCAL_CONTROL_48 --control-96=LOCAL_CONTROL_96 --ticks=96
```

### Different bounded coordination contract remains open

Crowd rejects this retreat-ranking/admission family as a production candidate;
adding another angle or stacking these vetoes has no qualified fairness result.
The next smallest investigation is a **bounded passage/cohort admission and
service handoff**, using executed boundary receipts before starting the first
maneuver, not merely waiting for one owner to return. Specify a disposable
four-actor episode with at most two finite maneuvers, a finite expiration and a
single current service recipient. Require actual boundary service/handoff before
switching recipients; an uncovered or invalid boundary cancels the episode and
normal accepted orders continue. First establish whether any such episode can be
admitted at the retained knot without excluding a relevant neighbor. If none can,
record that scope failure rather than expanding a production controller or
inventing a future-space promise. This contract is unimplemented and unqualified;
the cold case motivates testing it but does not prove its sufficiency.

Crowd owns this disjoint diagnostic and the same48/96 windows/all21 controls.
Core retains the host receipts, original executor budgets/admissions/position
writes and repair; caller/construction retain accepted endpoint publication.
Only a concrete overlapping interface decision requires further coordination.
Original both-seat gate/forest/bridge/Stop/native acceptance remains open for any
future production candidate. No new PR/main event or full-suite rerun occurs for
this rejection; raw source-derived inputs/results stay outside git and separately
denied drafts/private bundles remain untouched. Exact source, clean pack,
provider/served identity and rendered/deployed proof are separate obligations.


## Bounded passage admission and executed service handoff — scope feasibility

Crowd's next source-only investigation incorporates main `b5b4dd49`/PR449,
whose delta from construction consumer `c8aa92c8` changes only the Worker receipt
test. The retained runtime and physical serial input therefore remain the same.
This continues the finding that20/21 neighbor losses arise under the first
retreat; it adds no second-retreat heuristic or production controller. Art N/A.
The [passage witness](../scripts/crowd-passage-service-probe.mjs),
[whole-set runner](../scripts/crowd-passage-service-diagnostic.mjs) and
[focused controls](../scripts/crowd-passage-service-probe.test.mjs) establish a
finite executable admission/service contract **before any new motion policy**.
Every returned vector is the original normal executor vector, by reference.
There is no hold, retreat, grant, peer write or reservation, including after
refusal. The result is admission-scope feasibility, not an ordinary-game fix.

### Finite admission and service contract

The declared cohort remains77/81/87/110, at most four actors. At the lowest-ID
actor's actual serial call, one census per tick queries each cohort actor against
the same current world, under the original128-visit/64-body query bounds. Current
strict desired-step terrain/body checks distinguish legal projections from
blocked steps; cell gaps, soft separation and inherited-contact escape do not
establish physical clearance. The conservative boundary includes every queried
active ordinary body. An uncovered body, query refusal, changed original actor/
path reference, identity, accepted order/queue/route/point endpoint or phase
prevents admission. Parked bodies remain physical obstacles and are never moved.
Other caller policies stay ineligible and retain their normal executor handling.

The sole admission attempt occurs after the first consecutive executed receipt
frame, at tick3122 in this reconstruction; a missing first captain call terminates
the armed witness at that receipt deadline. All64 conservatively affected actors
must have valid unchanged-route receipts, observed service age at most12 and
backslide at most `.15`. Deterministic candidate ranking uses oldest observed
service, then least executed high-water progress, then ID. A strict current
step is required. The selected actor must revalidate the whole current boundary
at its own call; other actors' future-turn projections spend no budget.

An admitted witness expires after at most24 ticks and admits at most two service
windows of at most12 ticks each, with one current recipient. A recipient must
produce a new `.15` executed high-water gain **and** retain `.15` net progress
since that window began, with a matching increase in receipt-earned service.
Every declared cohort actor must also earn new `.15` high-water and retained net
service since episode entry before a handoff. Selected handoff previews and
actual selected own-call transitions are counted separately. The first recipient
keeps normal movement while others are unserved; there is no held gap. Unserved
boundary, expired deadline, missing selected call or changed fresh coverage
cancels finitely without renewal. The ongoing64-actor receipt floor rejects
route/point changes, invalid chains, phase discontinuity, excessive observed debt
or loss greater than `.15` from either the episode entry or a recorded peak.

These are diagnostic acceptance bounds, **not a guarantee that normal movement
cannot incur a loss**. The observer cancels after a failing receipt; it does not
undo, teleport or suppress normal orders. Service clocks start at retained
3120, without warm native history. Local completion remains historical evidence
only: final qualification additionally requires valid receipts for every actor,
no ledger failure, recorded maximum service age/backslide within the bounds,
and the unchanged48/96 whole-set `.15` sustained-progress/
`.01` relative-loss test. Post-completion endpoint/reference/receipt/phase changes
cannot leave a witness qualified. Two passing local windows alone never qualify
fairness, native liveness or production adoption.

### Retained scope fails at both windows

The existing local input and `c719377c` controls are reused unchanged; all21
original harmed-neighbor controls remain explicit. The comparison always measures
**all64** originally selected actors, including actors outside every cohort query.
No counterfactual baseline is available to the admission mechanism; relative
opportunity loss is assessed offline against the retained control.

| Same retained input |48 ticks|96 ticks|
| --- | ---: | ---: |
| Read-only census rounds |48|96|
| Fully covered rounds |0|0|
| Outside active IDs per round |13–20|13–21|
| Distinct outside IDs over window |21|22|
| Selected admitted substeps per repeat |2,059|4,050|
| Whole-set sustained-progress failures |55/64|59/64|
| Changed/invalid original routes at end |5|7|
| Valid records with service age >12 |52/59|55/57|
| Valid records with current backslide >`.15` |9/59|25/57|
| Added losses >`.01` against baseline |0|0|

At the first serial census,77/81/110 have strict-clear current desired steps,
while87 is blocked by110. Thirteen queried active actors are outside the declared
cohort. At the sole admission call on3122, the outside set has15 actors, so the
episode refuses before any service window. Subsequent censuses are read-only
observations, not repeated admission attempts. Later physical desired-step
blockers include outside75 and76. Thus initial short-step legality does not
establish a continuing service boundary, but query proximity alone also does not
prove a minimum physical dependency component of17 or require global coordination.
The coverage rule is deliberately conservative; its rejection is specific to
this contract and cohort, not a proof that every bounded method must fail.

Each48/96 run repeats with exact whole-unit trajectory and full contract/ledger
reports. The four runs total12,218 admitted selected substeps, zero static/body
contacts and original cell/elevation admission, with72 inactive position/health/
accepted intents preserved per run. All traces exactly match their retained
baseline. Zero added losses is **zero-intervention equality**; original service
failure remains. No admission, handoff, successful cohort witness or recovery
qualifies. Positive source controls show two genuine service windows and handoff
in a covered small fixture; they test the contract and do not replace this native
scope failure. Negative controls cover missing boundary service, serial selected
call changes, overflow, actual loss, unreceipted poses, endpoint/path/reference/
Stop changes and later receipt invalidation or accumulated service debt. The focused set totals107 tests;
the new suite is registered without changing workflow triggers.

Run against authorized local source inputs only:

```sh
node scripts/crowd-passage-service-diagnostic.mjs --input=LOCAL_CHECKPOINT --control-48=LOCAL_CONTROL_48 --control-96=LOCAL_CONTROL_96 --ticks=48
node scripts/crowd-passage-service-diagnostic.mjs --input=LOCAL_CHECKPOINT --control-48=LOCAL_CONTROL_48 --control-96=LOCAL_CONTROL_96 --ticks=96
```

### Decision and next unresolved boundary

The finite admission/service **witness contract is implemented**; a passage motion
policy remains unimplemented and unqualified. This conservative four-actor scope
admits no episode at the retained knot. Do not grow the cohort, waive outside-body
accounting or stack another retreat guard on that result. Crowd's next useful
question is whether a physically justified, bounded influence boundary can
separate incidental queried proximity from actual serial dependencies while
retaining whole-set receipt/service/loss accounting. It needs an executable
current-body witness plus a finite cancellation rule for an entering dependency;
a short clear segment or future route preview cannot promise a whole passage.
Without that witness there is no justified new intervention at this scope.

Crowd `01a10933-c2b0` retains this diagnostic and the48/96/all21 controls. Core
retains host receipt trust, original budgets/admissions/position writes/repair;
caller/construction retain accepted endpoint publication. The source-copy seam
is already agreed; no shared executor integration or global gate is added.
Existing both-seat gate/forest/bridge/Stop/native requirements remain intact.
The earlier exact-head observer-only gate successes at `d885aa98` are reused as
unchanged-runtime controls, not rerun or converted into recovery evidence.
No production adoption, new PR/main event or full-suite retry follows this
scope failure. Raw authorized local inputs/results remain outside git; denied
drafts and pending private bundles remain untouched. Source/clean pack, provider/
served identity and rendered/deployed proof remain separate and incomplete where
not observed.


## Physical influence boundary — derivation before retained measurements

This read-only investigation keeps the64 affected actors/21 original harmed
controls and the four-actor intervention cap. It does not execute another retreat
or authorize a production motion policy. Before testing, the candidate boundary
has three separate layers: direct finite-horizon physical reach, ordinary steering
input dependencies, and complete query coverage. None alone proves fair service.

For a fixed center corridor `C` of length at most `.75`, body `j` cannot physically
intersect its swept body within `H` ticks if
`distance(j, C) > radius(owner) + radius(j) + H * speed(j) / 30`.
This triangle-inequality exclusion ignores terrain, so the included set is a
necessary overapproximation, not proof that each body can reach through obstacles.
A labelled nominal earliest-contact view splits the corridor into at most12
own-call segments assuming full early budgets, using both radii plus
`k * speed(j) / 30` at segment `k`. This view cannot exclude a body when the
owner may wait or receive less own-call budget; safe inclusion uses the whole
horizon. Nominal nine-tick completion cannot promise those budgets. Frozen bodies have zero reach only under an explicit
unchanged-position/intent guard. Unknown movement/radius or lost completeness
refuses the boundary. Tangency is included conservatively.

Maximum query reach from the owner's initial center is
`min(.75, H * speed(owner) / 30) + radius(owner) + max_j(radius(j) + H * speed(j) / 30)`.
For this infantry-only mover population, that is `.613333/.96/1.48/1.97/2.23`
at1/3/6/9/12 ticks. Generic land peers give `.736667/1.21/1.92/2.60/3.05` for an
infantry owner. Existing2.1 retention therefore cannot certify a generic9/12-tick
horizon, or even the conservative infantry12-tick horizon. Wider2.25 bucket
collection is not wider2.1 retained membership. No future budget or held end pose
is assumed. A one-tick witness is recomputed at each own call and never promoted
to a whole-passage clearance guarantee.

Physical exclusion does not establish executor independence: ordinary
`selectCrowdStep` reads opposing goals within2 tiles, separation within both
radii plus `.3`, and other queried bodies for passage-point/admission/priority
choices. A conservative current dependency graph therefore retains2.1-tile input
edges. Current graph connectivity is only potential influence, not an observed
causal claim, and cannot certify later edge stability. The finite horizon can
admit new edges. Fairness still measures all64 actors, including harmed actors
outside any direct collision envelope.

### Preflight work bounds and alternative

With≤4 roots,≤64 returned bodies and≤12 segments, the collision audit costs at
most3,072 point/segment distance evaluations, plus256 whole-corridor evaluations.
Early segment classification uses earliest full budgets only as a labelled
nominal lower-bound view; the safe all-horizon envelope does not assume timely
owner progress. Receipt accounting remains64 actors/128 receipts per frame with
1,839 declared route cells. A64-node graph costs2,016 unordered pair distances;
query-based closure instead costs at most64 queries/8,192 bucket visits/4,096
neighbor entries and refuses overflow or a65th node. No recursive uncontrolled
expansion or actor-cap increase is permitted. The offline oracle scans the136
retained bodies to expose query omissions, charging that separate work; it is
not a production128-visit query or executable admission adapter.

A coarser alternative would track the existing authored throat (column48,row32),
its two portal planes and a bounded entrance registry, then hand off direction
only after actual body exit/empty occupancy receipts. A64-entry registry needs
one bounded complete region query and linear per-frame accounting, rather than
recursive local closure. It must still refuse incomplete collection, unknown
entrant/phase, parked occupation or lost exit capacity; unchanged accepted goals,
Stop and body/static admissions remain mandatory. The terrain cell alone is not
a single-lane proof: two radius`.22` infantry bodies geometrically fit across
one tile at centers`.22/.78`, with pair gap`.12`. A conservative single-file
scheduler is a coordination choice requiring evidence, not a terrain fact.

For an unobstructed full body transit across the one-tile throat, the minimum
center travel is `1 + 2 * .22 = 1.44`, at least17 infantry ticks. A single-file
four-unit tangent batch has continuous center spacing`.44`: the optimistic
exit ticks are17/22/27/32, so its last body needs at least32 ticks. Two geometric
lanes reduce this optimistic lower bound to22 ticks, without proving valid
approaches. Rounding each headway separately would overstate these minima; it
would describe an extra scheduling restriction, not a physical lower bound. Thus the existing12-tick service
window cannot be claimed as full throat clearance. If a coordinator serializes nonoverlapping four-actor `.15`
service batches, those batches alone need at least32 ticks to cover64 actors; strict12-tick service
for every actor is not justified by merely alternating direction. These lower
bounds precede measurement and are not throughput guarantees.

The smallest assessment now measures the retained fixed110 corridor, bounded
root reach envelopes, current input-dependency components and actual throat
occupancy/crossings under unchanged normal movement at48/96 ticks. It reports
all64/all21 service controls, query omissions and work maxima. This source-only
assessment will select the next read-only experiment; no no-intervention success
qualifies production recovery. Art N/A; private inputs/results remain outside git.


### Retained measurements and bounded refusal

The [influence oracle](../scripts/crowd-influence-boundary.mjs),
[serial observer](../scripts/crowd-influence-boundary-probe.mjs),
[48/96 runner](../scripts/crowd-influence-boundary-diagnostic.mjs) and
[negative controls](../scripts/crowd-influence-boundary.test.mjs) reuse the same
cold reconstructed physical serial source input at tick3120. This is not a warm
native continuation or a new benchmark. The136 live land bodies keep their full
registry speed/radius bounds, including inactive actors; the observer returns
each normal vector unchanged. The existing four intervention IDs77/81/87/110
remain fixed;64 movers and all21 historical harmed controls are measured.

| Horizon, ticks | Fixed110 corridor bodies,48 /96 | Four-root radial envelope,48 /96 | Selected-mover current / potential input component |
| --- | --- | --- | --- |
| 1 | 2–5 /2–5 | 5–8 /5–8 | 63 /63 |
| 3 | 3–6 /3–6 | 6–11 /6–11 | 63 /63 |
| 6 | 4–9 /4–10 | 7–17 /7–17 | 63 /63 |
| 9 | 4–12 /4–13 | 12–22 /12–23 | 63 /63 |
| 12 | 5–16 /5–16 | 21–26 /21–26 | 63 /63 |

At the first110 call the physical sets are81/87 at one tick,81/83/87 at three,
77/81/83/87 at six and nine, and76/77/81/83/87 at twelve. Thus even three ticks
include an outside actor. Over the unchanged baseline trajectory, the twelve-tick
fixed corridor includes only5 of the21 original harmed controls (75/76/113/115/118).
This does not explain away the other16: an executed changed retreat would alter
these envelopes, and losses can propagate through steering dependencies. The
four-root radial set is an overapproximation of any short heading, not authority
to recruit up to26 actors. The63-node graph is potential input dependence within
the selected64, not measured causality, a minimal control set or proof that a
global controller is required.

A focused source counterfactual supplies the distinction: an opposed peer at
`(0,1.95)` is outside the infantry twelve-tick fixed east corridor's physical
reach, but removing that peer changes `selectCrowdStep` from straight east to an
eastward lane with positive-z motion. Both candidates remain physically clear.
Collision-only membership therefore cannot establish mechanical independence.

The bounded diagnostic rule refuses incomplete/overflow queries, insufficient
certified radius, a physically included outside body or a potential input
component outside the fixed cohort. All retained decisions refuse at every
horizon. No physically included body happens to be missing from the current2.1
query in these observations; this does not certify collection of unknown omitted
bodies at9/12 ticks. A hypothetical passing rule yields only a candidate witness,
not clearance/admission: the host must still certify current serial query coverage,
accepted identity/order/phase, actual remaining budget, static/body admission,
receipt continuity and finite cancellation. The controller cannot use a frozen
parked assumption or shunt an outside actor. No unchanged-boundary retry is added.

### Coarse chokepoint comparison and measured work

At twelve ticks the diagnostic current-position region query returns43–56
bodies, visits56–63 bucket entries across the96-tick window and never overflows;
29–35 selected movers are potential entrants, with both accepted goal directions
present every round. The worst rectangle spans36 bucket heads. A complete bounded
portal registry could avoid recursive64-query closure, but this separately built
136-body current index is not the production start-of-tick index. Production
would need certified incremental membership or a bounded conservative stale-index
adapter, and entry coordination would be a new admission scope involving actors
outside the four existing intervention IDs. These observations authorize neither.

Every tick-end snapshot is occupied (48/48 and96/96), with up to8 circle footprints
intersecting the throat, rather than8 fully contained centers. Tick-end snapshots
do not prove uninterrupted occupancy between writes. The six actual plane events
are all actor95 entering/backing out at the left portal:3125→3126,3145→3150 and
3151→3157. Every corresponding post-step occupancy still has7 or8 bodies. There
is no opposite-portal full transit or empty post-exit receipt. Portal candidates
carry ledger validity; transit matching requires continuous admitted chains,
original identity/route and phase. Gap, duplicate, epoch, unmatched-chain and
generation negatives cannot earn transit; same-side backout is never a transit.
Thus an empty-gate direction token alone cannot drain this already occupied knot.

| Diagnostic work, separately charged | 48 ticks | 96 ticks |
| --- | ---: | ---: |
| Full body oracle visits, own call plus tick-end | 13,056 | 26,112 |
| Current index rebuild visits, five horizons | 32,640 | 65,280 |
| Fixed corridor distances, five horizons | 32,400 | 64,800 |
| Nominal early-segment distances | 8,196 | 18,663 |
| Four-root distances, five horizons | 129,600 | 259,200 |
| Input graph pair distances, current plus five horizons | 580,608 | 1,161,216 |
| Input graph edge visits | 769,784 | 1,529,598 |
| Receipt body visits at six plane events | 810 | 810 |

These are deterministic work counts, not timing or production-capacity evidence.
Two identical repeats per window retain exact trajectory/report hashes; together
there are12,218 original selected substeps, zero new static/body contacts and72
unchanged inactive actors. All64/21 comparisons exactly equal stalled baseline;
55/59 actors fail sustained progress at48/96. Original normal repairs invalidate
some accepted-route service records, which cannot be credited as valid service.
No recovered actor, fair schedule or qualified motion policy is claimed.

### Smallest viable next experiment and ownership

First observe resident exit capacity, before proposing directional entry tokens:
one resident's original accepted own-call exit proposal, its actual budget and
swept static/body blockers, and a matched post-exit occupancy receipt. Preserve
Stop, goals, queues, parked bodies and all64/21 service/loss controls. At most four
observed leaders remain a diagnostic scope; no resident is moved or recruited.
Refuse unknown/overflow coverage, changed order/phase, missing receipts, unavailable
exit capacity or the unchanged occupied boundary. If no resident can leave safely
under its accepted order, record the blocking chain rather than fabricate a new
heading, grow the actor cap or extend the12-tick service deadline until it passes.
Only a real empty/exit handoff witness can justify evaluating entry scheduling.
The17-tick full-transit lower bound remains distinct from the existing12-tick
partial-service requirement.

Crowd owner `01a10933-c2b0` retains this next read-only resident-exit oracle. Core
retains host query/receipt trust, budgets/admissions/position writes/repair;
caller/construction retain endpoint publication. The pure copied-fixture seam is
agreed; a future host admission/index change needs an exact owner decision before
shared edits. Existing both-seat forest/gate/bridge/Stop/native requirements and
observer-only runtime controls at `d885aa98` remain in force. Independent review
corrected portal chain validation and the four-unit transit minima (32/22 ticks).
Exact source/check/clean-pack receipts are appended to existing PR445 after the
source seal. No production adoption, new PR/main event, full-suite rerun or
served/rendered proof is claimed. Private inputs/results remain outside git.


Exact diagnostic seal: `810cbed4ca615d7822d021bc42b5b13e231e8cdd`, remote-verified
on `codex/crowd-native-grant-trace`, with135/135 focused tests (15 new controls),
independent46/46 review and identical48/96 repeats. The
[sanitized verification receipt](qa-evidence/crowd-influence-boundary-2026-10-05/verification.json)
retains counts/hashes and clean1,387-file pack digest
`sha256:e7f3d8e167df56207b714c01193dda43bd9659f60a833d3f510798abdb3b39c1`.
This focused invocation also exercised existing crowd journey controls; it was
not the full suite. The existing PR445 metadata append returned a connector
error; read-back confirms its body remains unchanged. The detailed reason was
not retained, so no automatic-review rejection reason is inferred. No retry or
alternate external write was attempted. Source and sanitized evidence are on
the non-main branch; updating the external record remains blocked. The source
milestone does not qualify production recovery or deployed/rendered acceptance.

Final bounded-work review also found that finite but non-safe-integer bucket
coordinates could prevent loop increments from advancing. Region collection now
refuses those bounds before iteration; large finite offset/rectangle negatives
cover this case. The retained `(48,32)` offset and all measurements are unaffected.
