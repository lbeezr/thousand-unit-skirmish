# CPU displacement-to-animation integration — 2026-10-04

Production source `53a47ee3` contains selector PR #284, direct-ground trajectory
PR #285, and the Infantry default restoration #286. A bounded cloud CPU run
passes 64 cases: Worker/Spearman × eight bearings × both teams × full/low
detail. This adds the missing client update-loop and decoded source-cell links
to the existing selector/clock tests; it does not repeat the 47-check suite.

The runner executes the committed `src/main.js` displacement interpolation,
heading easing and transform-update scheduling, calls the real sprite runtime,
and maps its Three instance UV buffer back to committed frame keys. It checks
clock/timeline phase, actual interpolated velocity, exact facing after turn
settling, continuous clocks through turns, Stop-equivalent held snapshots,
idle and resumed first frames. Snapshot displacement is deterministic input;
server path generation, paid production and Stop-command handling are separate.

The two approved manifests are Worker v0.33 (`cast-human-sprite-v3`) and
Spearman v0.3 (`spearman-sprite-v1`). Runtime PNG hashes are verified against
their manifests; the existing Node RGBA decoder reads their actual actor cells. Pixel hashes anchor
the ground pivot and clear RGB under transparent pixels, preventing atlas
offsets or invisible bytes from faking advancement. Named walk keys aliasing
identical visible cells fail. Exact pixel differences establish source change,
not anatomical gait quality or rendered appearance.

| Pack | Authored walk directions | Distinct frame keys / visible cells / silhouettes |
| --- | --- | --- |
| Worker v0.33 | All eight | 8 / 8 / 8 in every direction |
| Spearman v0.3 | SE | 8 / 8 / 8 |
| Spearman v0.3 | N, NE, E, S, SW, W, NW | 1 / 1 / 1; exact-facing idle fallbacks, missing gait art |

Negative controls prove the checks reject a frozen clock (64 failures), forced
SE UV selection (56 non-SE failures), and identical cell hashes beneath
different authored walk keys (36 authored-walk failures). The cell control
injects identical fingerprints into the comparison; it does not alter PNGs.
The positive run exits 0 with `passed-with-art-gaps`; each negative run exits 1.
Syntax, architecture and checked-JavaScript/Node boundaries also pass.

Run from the repository with the locked Node dependencies installed:

```sh
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-proof
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-frozen --negative=frozen-clock
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-facing --negative=wrong-heading
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-static --negative=duplicate-cells
```

Each run writes `checks.json` with source revision/dirty flag, pack/PNG hashes,
per-case UV/frame/heading/displacement samples, missing art and failures. This
is an owner-run diagnostic and requires no browser, Python or new dependency.
The extraction fails if the committed client loop/constants move, rather than
silently testing a copied implementation. Texture loading uses a CPU stub.

No GL context, browser frame, screenshot, live staging or ordinary server
command acceptance is claimed. These checks cannot prove that the atlas is
uploaded to a GPU, that a browser draws it, or that the live client reaches the
same state. The initial cloud Chromium sandbox/Firefox download blocker is
separate. The parent cloud browser owner retains native temporal acceptance;
the path owner retains PR #285 trajectory evidence. No new art or runtime
behavior changes are included here.

## Gameplay diagnostics lane — 5 October 2026

The audit at `b5b4dd49` found a reproducible reporting gap: Spearman v1
resolves all eight walk clip keys, but seven keys reference exact-facing idle
frames. The existing post-render `worker-animations` probe exposed clocks and
UVs without the action/direction selection provenance. Fourteen of sixteen
both-seat heading cases therefore need an explicit idle-placeholder signal;
the two SE cases have eight distinct frame IDs. This is source/CPU evidence.

The existing runtime now offers read-only `observeAction(unit, now, localTeam)`.
It reports role/version, requested and selected action/direction, frame counts,
independent fallback flags and a reason (`exact`, `idle-placeholder`,
`direction-fallback`, `action-fallback`, `missing-clip`). Typed Food/Wood gather
is treated as its requested resource action. A static authored action or ordinary
idle is not labelled an idle placeholder. Distinct IDs do not certify distinct
pixels, anatomical motion or GPU drawing; the existing decoded-cell/UV checks
remain authoritative for their own scope.

The existing post-render probe calls it only for local, visible Worker/Spearman
records, retaining at most eight explicitly targeted provenance observations
or 32 opening observations per frame. Existing samples remain capped at 180.
The new method has no history and does no work during ordinary rendering;
clock, state selector, sprite update, artwork, matrices, geometry, admission and
server/public session contracts are unchanged. Enemy and retained fog records
are rejected before role lookup. No coordinates, unit identities, targets or
session fields are added to the provenance value.

`identifyUnitFrame` consumes the captured provenance, checks it against the
retained manifest/selector alongside actual UV/clock checks, and retains it in
heading/Stop evidence. CPU tests drive the real runtime through the actual
serialized post-render observer, verify unchanged units/matrices, reject false
completeness/borrowed-heading/missing signals, and test opening/target limits,
privacy and the existing sample cap. The tests run through existing registered
`unit-animation-runtime` and `registered-foot-sprites` checks; no new framework
or standalone unused utility is introduced.

Owner: gameplay diagnostics lane. Foot-art owner `01a10469` retains default art
coverage/held PR230/241; shadow-renderer owner `01a10c3c` retains geometry and
render work. Read-only ownership inspection found clean main and only held art
PR25/230/241 open. This slice changes no art/default/version/selector/update or
shadow hook, and introduces only the additive observation method and existing
animation-domain adapter evidence. Their implementation scopes remain separate.

The one normal-sandbox cloud capability attempt in this executor returned
`sandbox-unavailable` and `storage-unavailable`, zero WebGL readbacks, game
frames or screenshots. Do not retry that launch or any denied hosted dispatch.
The diagnostics owner retains ordinary packed/staging observation through the
existing shared capture adapter on a capable authorized cloud runtime; no Mac
work, access changes or new diagnostic platform are requested. Source/package,
served/deployed identity and actual rendered acceptance remain separate.

### Ranked next diagnostics slices

| Rank | Measured risk / next action | Owned scope and acceptance |
| --- | --- | --- |
| 1 — current slice; rendered use open | Clip labels conceal seven Spearman idle walk placeholders. Integrate and retain provenance in existing animation capture evidence. | Read-only runtime observation and animation-domain adapter/tests. Both-seat 14 placeholder / 2 exact controls; false provenance rejected; no selector/art changes. Identified deployed/GPU consumer use still requires the existing capable capture owner. |
| 2 — implemented; review/integration and rendered use tracked in its PR | Pending and seven representative loader failure paths originally produced the same null action observation. The existing animation probe now retains bounded aggregate load state and finite failure provenance, including failure before any capture. | Read-only `observeLoad()` and existing adapter/report only; no roles, URLs, error payloads, identifiers, counts or timestamps. Promise outcomes, warning identity/count, all-or-nothing admission and late sibling controls remain unchanged. Shadow no-overlap confirmation and precise foot-art supported-version-only patch inspection cover the allocated loader boundary. |
| 3 — finite replay observation implemented; exact review/integration tracked in PR464 | On both seats, a production crowd wait, Hold and planning-pending state produce identical ordinary unit rows. Finite observations are consumed in the existing private queued-gate report; do not infer a deadlock from missing motion. | Requested owned actors only, at most eight current-step observations; no paths, targets, neighbors or public/session transport changes. Crowd/core approved the finite replay observer; repair instrumentation remains unchanged. Rich native instrumentation and movement policy stay with their owners. |
| 4 — finite final admission implemented; exact review/integration tracked in PR468 | A positive vector can be rejected, admitted with changed position, or admitted at a zero-distance waypoint. The finite report now distinguishes these outcomes. | Reuse the same at-most-eight owned-actor observer and queued-gate report. Core agreed the precise fixture hook; original predicates, calls, policy, deadlines and assertions stay intact. Admission is separate from last-evaluation physical position change. Core/crowd retain executor policy. |
| 5 — fixed motion window implemented; exact review/integration tracked in PR473 | Two unfinished actors in the controlled parked-Hold consumer moved on their last admitted evaluation but traveled about 1.3 sampled units with near-zero net displacement over the final 30 ticks. | Same private finite report; at most eight bindings × 31 own poses, full 30 consecutive tick intervals. Report net displacement and sampled tick-chord travel separately from admission, goal progress and success. No executor hook or movement-policy experiment. |

### Pending versus failed loader provenance — 5 October 2026

The bounded CPU audit at `c42a9b4b` reproduces HTTP, fetch rejection, JSON
rejection, missing unit asset, missing page files and both color/mask texture
failures. Every failure has the same null action observation as pending loading,
false ready result, one warning and zero meshes. Success makes one manifest/two
texture attempts and admits two meshes. A successfully loaded late sibling
cannot admit the group after another role failed. These are controlled CPU
inputs to the existing loader, not rendered or provider-deployment evidence.

The additive `observeLoad()` returns a fresh, fixed-size `{state, stage, cause}`.
Pending is `pending/loading/null`; aggregate success is `ready/complete/null`.
Failure uses finite stages (`manifest-request`, `manifest-decode`,
`manifest-shape`, `texture-load`, `color-texture`, `mask-texture`, `pack-setup`,
`batch-admission`) and causes (`http`, `rejected`, `invalid`, `exception`).
`rejected` identifies a promise rejection at that stage, not an inferred
network/parser/provider reason from free-form text. No roles, URLs, HTTP status
codes, error messages/stacks, entity data, identifiers, counts or timestamps are
exported. The first recorded failure remains terminal despite late siblings.

Failure observers attach to the actual existing promise outcomes. Returned
promises/rejection objects, load order, role/texture Promise.all admission,
warning and retry policy remain intact. A synchronous fetch throw still aborts
the factory before a runtime exists; this interface cannot report that case.
A texture callback that synchronously resolves before an executor exception
retains its original success. Aggregate diagnostic readiness follows completed
batch setup and setVisible; even a failure after the internal ready flag changed
is reported as failed. Existing partial side effects in that exceptional case
are preserved rather than silently changing renderer policy.

The existing post-render animation probe reads once per frame outside its unit
loop, retaining the existing 180-snapshot cap and action-observation limits.
No new entity census/history, normal-render callback, retries or textures are
added. The domain adapter checks readiness before animation acceptance, accepts
a loader failure in the existing startup wait, and always writes its existing
`unit-animation-acceptance.json` under the shared case evidence directory.
Pending timeout and early failure therefore retain truthful loader status even
with zero screenshots. Invalid/extra-field snapshots are discarded before
retention, keeping arbitrary payloads out of the report.

Boundary coordination: the parent relayed shadow owner `01a10c3c`'s no-overlap
confirmation at merged `2b4a5246`. At `231a5de6`, the actual loader/probe files
are unchanged since the audit. Read-only inspection of held PR230/241's exact
`src/unit-sprite-runtime.mjs` patches shows only supported-version additions in
`spriteDirectory`, which this increment leaves unchanged. The parent explicitly
authorized proceeding after this precise non-overlap check while foot-art review
remains pending. No foot-art approval or held art release is inferred. Diagnostics
owns this implementation; art owners retain artwork and visual acceptance.

Existing registered tests cover the real runtime-to-serialized-probe-to-report
path, pending/success/failure, malformed shape and setup errors, sync promise
outcomes, first failure/late siblings, fresh immutable observations, original
warning objects and admission counts, one read per frame, and missing/false
readiness or private extra-field rejection. The adapter's early-failure and
pending-timeout report test is a CPU mock with no GPU or screenshot acceptance.
The previously recorded cloud sandbox/storage failure remains blocked; no
browser or denied hosted dispatch was retried. Source, clean release/local
packed HTTP and actual deployed/rendered states remain separately recorded in
the increment's PR. Art backing N/A for this internal diagnostic change.

### Disclosed-local pause audit — 5 October 2026

At source `e839f59d`, the existing production movement/snapshot bodies reproduce
three distinct pause states on both seats with identical ordinary unit rows:
`waitingForCrowd`, Hold, and `movePlanningPending`. The controlled inherited
static-escape/body-admission fixture in `scripts/unit-movement.test.mjs` provides
the crowd wait: its vector returns `waitingForCrowd`, actor state does not change,
and no repair is queued. Hold also leaves the actor unchanged; pending planning
has the same transmitted row. Opposing-seat hidden rows remain absent. This is
a bounded CPU contract audit, not a new choke algorithm study, native scheduling
result, actual player session or rendered observation.

The existing animation probe sees position, walking, task and productive work,
but receives neither the authoritative pending flag nor vector/repair outcomes.
It therefore cannot truthfully derive a body wait or accepted repair from that
row. A finite cause must come from the actual observation boundary; a timeout or
missing animation alone must not become a stuck-unit claim.

The smallest current consumer identified is `runQueuedGateCase()` in
`scripts/queued-gate-pathing.mjs`. Its current report retains controller maxima,
missing controller records and unfinished actors, but no finite pause observation
for a selected owned actor. The proposed shared boundary is the existing
`recordReplayCrowdStep` and repair-entry hooks in
`scripts/pathing-replay-fixture.mjs`. The parent relayed crowd `01a10933-c2b0` and core `01a107ba` approval of
this boundary at audited `5ec7394e`; both confirmed no additional ownership gate.
The increment uses the vector hook only; the repair hook and algorithms stay
unchanged. No repair-attempt or accepted-repair value is invented.

Any implementation should opt in a valid team and at most eight requested owned
actors before reading their movement fields, retain one current-step observation
per actor, and return fresh finite projections in request order. It must not
enable `traceActorIds` merely to obtain this projection: that richer existing
trace records paths, goals, queues and neighbors. It must clear observations on
step/reset/restore and reject stale generation/order revisions. A vector wait
means the last observed vector evaluation waited, not that the whole tick had
zero motion. A positive vector is a proposal, not admitted movement. The repair
hook observes an attempt before validity/admission checks, so it cannot label
repair accepted. Missing observations stay unobserved. Hold/work/planning controls
must not be marked as unexplained stalls.

This proposed increment is private replay/report tooling. It adds no normal
player unit-row fields, public health/session data or browser cause claim, and
does not expose enemy movement internals even when an enemy actor is visible.
Source/tool consumption, packaged runtime, identified deployment and actual
rendered acceptance remain distinct. Art backing N/A.


The implemented opt-in `observeMovement` mode configures an explicit team and
at most eight distinct requested IDs through `replay.observeMovement(team, ids)`.
`movementObservations()` returns fresh fixed-size rows containing `id`, `holding`,
`planningPending`, `performingAction`, `routeActive`, and `decision`. Existing
productive-work receipts supply the optional action; Hold/planning/work/route
flags remain separate from the last vector observation. Decisions are finite:
`vector-wait`, `vector-proposal`, `static-proposal-rejected`,
`no-vector-proposal`, or `unobserved`. They describe an evaluated proposal,
not an admitted move, accepted repair or deadlock. Identity/generation/order,
current step and navigation revision qualify the recorded decision. Requests
and decisions clear on reset/restore; decisions clear before each step.

Finite-only mode skips legacy result cloning and global crowd records, without
enabling the rich actor trace. The original vector call executes exactly once
and returns its unchanged result. The existing queued-gate consumer opts in with
`observePauses` (CLI `--observe-pauses`) and retains at most eight terminal rows
in its existing report. Its default requests name seven own Infantry and the
own builder; `pauseActorIds` can select a smaller explicit set. Requests for
opponents/unknown/dead/replaced actors produce no rows. Original commands,
Stop priority, simulation, repair, 2700-tick deadlines and arrival assertions
remain intact. This projection is private source replay evidence, not normal
browser or deployment acceptance.


### Final-admission observation audit — 5 October 2026

At merged source `1e3245c6`, the controlled production vector/executor bodies
reproduce the following four controls. Every control calls the existing vector
function exactly once; no shared hook or movement policy has changed.

| Control | Last vector | Position changed | Waypoint advanced | Repair attempts |
| --- | --- | --- | --- | --- |
| Inherited static escape blocked by the existing body admission | wait | no | no | 0 |
| Newly blocked route waypoint | proposal | no | no | 1 |
| Existing accepted fallback at an elevation edge | proposal | yes | no | 0 |
| Existing admitted zero-distance waypoint | proposal | no | yes | 0 |

The first three reuse the existing `scripts/unit-movement.test.mjs` controls;
the zero-distance control places the current waypoint at the actor's existing
legal center with inactive neighbors. This is a bounded CPU contract audit,
not new crowd algorithm research, native scheduling, player-session or rendered
evidence. A repair attempt is not an accepted repair. Advancing a zero-distance
waypoint is an executor admission without physical position change. Neither a
positive vector nor a movement-tick marker alone establishes physical progress.

The prior private queued-gate report at reviewed `60fb23da` retained four
unfinished own actors at the unchanged 2700-tick deadline and 60/64 arrivals:
two last observed vector proposals and two vector waits. Held/completed controls
remain distinct. Proposal provenance cannot tell which final executor branch
was taken; it must not infer a rejected admission or an algorithmic deadlock.

The precise proposed shared boundary is the existing `observeMovement` copy
instrumentation in `scripts/pathing-replay-fixture.mjs`: read-only callbacks at
the original land executor's waypoint/steering/fallback assignments and existing
static-target/automatic/fallback rejection or detour-deferral branch exits.
The original predicates, vector calls and writes must execute once in their
original order; no predicate re-evaluation, cloned result, global crowd record
or rich trace is needed. Capture the selected owned actor's preceding position
privately after the existing vector evaluation, and compare only after the
actual executor branch. Waypoint observation follows its path-index advance;
steering/fallback position comparison follows the existing coordinate clamping.
Same-cell combat, water and later separation remain outside this interval.
Export a finite admission outcome and changed/unchanged position status for that same last evaluation; no coordinates or whole-tick/net
progress claim. Missing/stale outcome stays unobserved and position change
stays null, never a false no-progress claim. Multiple evaluations in one tick
reset the stored outcome and preceding pose for each new evaluation.

Reuse the existing explicit team, at-most-eight requests, ownership-before-
movement-read boundary, identity/generation/order/step/navigation freshness and
reset/restore clearing. Keep Hold, productive work and planning flags separate.
No normal player rows, public health/session data, paths, targets, neighbor or
enemy internals may be exposed. The existing queued-gate report remains the
actual consumer and retains its commands, deadlines and arrival assertions.
Exact core `01a107ba` / crowd `01a10933-c2b0` hook coordination was requested
through parent relay because cloud-thread messaging is unavailable here;
response was pending at audit head `84d53bc9`. That audit did not implement or release the new hook.
Art backing N/A; source/tool, package, deployment and rendered states remain
separate. Prior baseline-matched movement failures remain open.

### Final-admission consumer integration — 5 October 2026

Core subsequently agreed the precise fixture hook at audit `84d53bc9` through
parent relay, with no further approval gate. The existing private replay copy
now observes executed land executor branches. It captures preceding pose only
after an evaluation belongs to one of at most eight bound living owned actors.
It never exports pose, targets, paths or neighboring/enemy internals. The vector
and each original predicate execute once in their original order; production
`server.mjs`, policy, guard, budget and write order remain unchanged.

The same `movementObservations()` rows and existing queued-gate consumer append
`admission` and `positionChanged`. Finite admission outcomes are `no-proposal`,
`crowd-wait`, `detour-deferred`, `static-rejected`, `automatic-rejected`,
`fallback-rejected`, `waypoint-admitted`, `steering-admitted`, `fallback-admitted`
and `unobserved`. Waypoint admission follows the existing path-index advance;
steering/fallback comparison follows coordinate clamping. Missing or stale
observation is `unobserved` with `positionChanged: null`. An admitted
zero-distance waypoint is `waypoint-admitted` with `positionChanged: false`.
Each vector evaluation replaces the private pose/outcome, so a final wait after
an earlier moving waypoint reports no position change in that final evaluation.
Same-cell combat, water, later separation and whole-tick/net journey progress
remain outside this observation interval.

The existing team-0 parked-Hold queued-gate case was run with observation off
and on. Both retained 60/64 arrivals at the original 2700-tick deadline and
trace SHA-256 `dabffbe8cde26eae2335b789a39ed749e3dad386a84c8dc1fdb0db0cfe6f1899`.
Commands, requested/goals, legality counters, path-length maximum and trace
match. The six explicitly requested owned actors show:

| Controlled actor role | Last decision | Admission | Position changed |
| --- | --- | --- | --- |
| Two unfinished actors with proposals | vector-proposal | steering-admitted | true |
| Two unfinished actors waiting | vector-wait | crowd-wait | false |
| Held builder and completed actor | unobserved | unobserved | null |

This resolves proposal/admission ambiguity in the actual existing consumer;
it does not fix the baseline arrival shortfall or establish an algorithmic
deadlock. Both-seat controls compare real executor state and predicate/vector
call counts with observation off/on for waits, static/fallback rejection,
fallback/steering progress and zero-distance admission. A controlled XL ledger
envelope exercises real detour deferral; separate executor-boundary controls
cover automatic rejection, final clamping and repeated evaluations. Existing
enemy getter traps now include pose, and stale navigation/order, replacement,
generation, reset/restore, Hold and productive-work controls remain in place.
Both-seat actual replay/snapshot parity and unchanged rich land/actor/crowd
traces are checked independently. The existing paid queued-gate completion
tests consume the extended finite rows on both seats.

The initial broader unit/imported-contract run reported 185/186 pass, with the
existing whole-tick fixture `ReferenceError: matchId is not defined`. That was
independently reproduced from unchanged production/test bodies. Main then
integrated PR469's fixture correction; after rebasing onto `4957b8bf`, the
broader unit/imported-contract run passes 188/188. That fixture correction
belongs to its original owner. No full-suite or native-scheduling acceptance
is claimed. This hook is private
source replay tooling, excluded from the game package; package identity,
deployment and rendered acceptance remain separate. No renderer retry or art
change is part of this slice.

### Fixed-window net displacement audit and consumer — 5 October 2026

At source `90cbae99`, the existing team-0 parked-Hold queued-gate consumer still
fails its arrival condition: 60/64 at 2700 ticks, with unchanged trace
`dabffbe8cde26eae2335b789a39ed749e3dad386a84c8dc1fdb0db0cfe6f1899`.
A read-only audit of its final 30 whole-tick intervals measures:

| Controlled owned actor | Net displacement | Sum of sampled tick-chord lengths | Opposing consecutive chords |
| --- | --- | --- | --- |
| Unfinished actor 14 | 0.004506799457089979 | 1.2999999999999987 | 29 |
| Unfinished actor 15 | 4.125895361409781e-8 | 1.299999999999998 | 29 |
| Waiting actors 20/35; held builder 0; completed actor 4 | 0 | 0 | 0 |

Both unfinished moving actors still report admitted steering and a changed
position on their last evaluation. The consecutive-chord audit shows repeated
reversal in this controlled window. The former one-evaluation observation
cannot show this. Sampled travel exceeding net displacement alone does not
classify oscillation: ordinary curved movement can have that relationship too.
Neither metric reads a destination or establishes goal progress or success.

The existing opted-in replay observation now appends a pose-free `motionWindow`
to the same rows and queued-gate report. A complete window reports
`{ticks: 30, netDisplacement, sampledTravelDistance}` in simulation world units;
an incomplete or stale window is null, never a false zero-displacement claim.
It samples whole-tick end positions plus its initial pose, so travel is the sum
of 30 sampled chords, not an exact substep trajectory. Whole-tick samples include
separation and other tick effects independently of the land-admission outcome.
No target-distance, arrival, stall/deadlock or success classification is added.

Storage stays inside the existing at-most-eight actor bindings and retains at
most 31 private poses each (248 total). Each opted-in replay step samples only
current living requested owned actors after the unchanged simulation tick;
ownership, reference and generation checks precede pose reads. Order or
navigation changes, nonconsecutive ticks, invalid pose, death or replacement
drop continuous coverage. Repeated calls at one tick do not advance a window.
Report reads check current tick/order/navigation and final sampled pose.
Subscription replacement, prepare and restore clear all window state with the
existing bindings. No public/session fields, enemy/neighbor data, coordinates,
targets, new executor anchors or crowd policy are changed. Observation off
does not sample windows. Current-main/open-PR inspection found no overlapping
fixture/report change; the shared executor hook remains the previously agreed
PR468 hook.

Positive/negative controls cover straight versus reversing samples, incomplete
coverage, a rolling window beyond 30 ticks, all eight bindings/248-pose cap,
duplicate/gapped/backwards ticks, order/navigation, stale pose, generation,
replacement, subscription reset and invalid pose. Existing enemy/dead/unbound
getter traps protect sampling too. Both-seat actual replay independently
recomputes metrics from 31 own tick-end poses while comparing complete actor
state and filtered snapshots with observation off. Existing rich traces retain
parity. The actual failed consumer keeps identical arrival, deadlines, trace,
goals, legality/path bounds and existing no-progress measurements off/on; its
arrival failure is not diagnostic success evidence.

The ordinary opt-in selects the first seven own army actors and builder. That
selection need not include the unfinished actors. Use the existing private
consumer's `unfinished` IDs in a bounded repeat; no new selector is required:

```js
const options = {team: 0, observe: true, returnBuilder: false, parkOrder: 'holdPosition'};
const failed = await runQueuedGateCase(options);
const requested = failed.unfinished.slice(0, 8).map(actor => actor.id);
const observed = await runQueuedGateCase({...options, observePauses: true, pauseActorIds: requested});
assert.equal(observed.traceSha256, failed.traceSha256);
assert.equal(observed.arrived, failed.arrived); // still a failure when below 64
```

This closes the measured fixed-window observation gap in the existing consumer.
The ranked remaining work is actual rendered consumption of the earlier
animation/load signals when capability becomes available, and new finite
diagnostics only for another reproduced consumer gap. Movement/transit policy
and the 60/64 failure remain with core/crowd. Source tooling is excluded from
the game package; package, deployed identity and rendered acceptance remain
separate. No failed renderer/dispatch retry, held art or private archive action
is part of this slice. Art backing N/A.
