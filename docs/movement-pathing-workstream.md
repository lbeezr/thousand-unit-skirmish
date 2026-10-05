# Movement and pathing workstream

Updated 5 October 2026 against main `f1336896` (caller coverage through PR432). This is the ranked execution backlog for the user-owned
movement lane; the [roadmap](roadmap.md) remains the product priority source.
Each slice owns its regression, review, normal authorized merge and acceptance.
Evidence must name the source/workload and preserve failures.

## Write boundaries

Function/subsection contracts, rather than whole-file locks, keep these lanes independent.
Historical experimental allocations and receipts remain in the dated sections below.

| Owner / active artifact | Exact movement boundary |
| --- | --- |
| Shared movement · merged [PR411](https://github.com/lbeezr/thousand-unit-skirmish/pull/411) | `src/unit-movement.mjs`, `src/unit-obstacle-detour.mjs`, formation/planning helpers, `applyPlannedMoveAssignment`, `processMovePlanningSlice`, `enqueueRouteRepairs`, and the three land position admissions. Own the consumed contracts, private observation and this guide; coordinate changes to caller-owned hooks. |
| Caller adoption · merged [PR432](https://github.com/lbeezr/thousand-unit-skirmish/pull/432) | Construction and military objective/explicit unit/building/acquired Attack, Patrol and Follow predicates plus the existing profile fallback. Only separately allocated publication/repath and Follow queue-capture hooks were changed. Core retains shared algorithms/publication/bounds; crowd retains steering/body pairs. New Worker domains, rally and direct interaction/placement writers require their own measured contract. |
| Ordinary crowd · [PR400](https://github.com/lbeezr/thousand-unit-skirmish/pull/400) | Pure crowd module, bounded current-serial neighbor query, ordinary military `getMoveVector` branch and allocated wait hook. Preserve existing shared pre-write admissions. Workers, combat, water, planner and command admission are excluded; queued topology/counterflow qualification is active. |
| Resource · [PR330](https://github.com/lbeezr/thousand-unit-skirmish/pull/330); forest · [PR341](https://github.com/lbeezr/thousand-unit-skirmish/pull/341) | Selected flow goals, raw drop-off scoring, jobs/frontiers/rates/cargo and dynamic forest masks. PR330 reduction is adopted; core must preserve its raw selected tail and score. No global attack/Sheep flow reduction. |
| Map/XL · merged [PR407](https://github.com/lbeezr/thousand-unit-skirmish/pull/407), [PR414](https://github.com/lbeezr/thousand-unit-skirmish/pull/414) | Checkpoint byte/parser/state/route preflight and all map admission/index sites. Core owns the remaining live publication/search contract. Ordinary 320 stays disabled. |
| Benchmark; cloud capture · [PR323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323); module organization · [architecture](architecture.md) | Existing validity reports, cloud capture interfaces and module relocations respectively. Movement supplies scenarios and retains ordinary-game acceptance; no competing formats/services or relocation patch. |

Naval and wildlife retain their route/execution adapters. Combat acquisition,
range/damage and match-ending work retain their active owners. This reconciliation
changes no runtime, caller hook, checkpoint policy or dimension admission.

## Universal movement contract and rollout

The 4 October user delegation extends this lane to the shared movement architecture.
This section extends the existing backlog and [tick proposal](movement-tick-phase-proposal.md);
it does not replace the roadmap or the failed four-turn qualification. Keep the
grid/Node simulation authoritative and Three as presentation. The objective is
responsive, natural, safe movement through every implemented caller, with
different endpoint, clearance and execution policies where the domain requires them.
Universal completion is open until every row below has command, journey,
interruption, recovery and ordinary rendered evidence.

### Caller coverage reconciled at `f1336896`

The native parent audit at `32b71795` identified two land route families and
additional direct position writers. Its inventory is retained below with current
adoption status; function names remain the ownership boundary. Source adoption,
actual journey coverage and rendered acceptance are separate.

| Caller / intent | Existing route / execution surface | Policy and evidence still required |
| --- | --- | --- |
| Manual Move, queued Move, formation slots | `assignFormationMove`, `advanceQueuedWaypoints`, sliced `findPathAStar` → `applyPlannedMoveAssignment` → `getMoveVector` / `simulateTick` | Fractional endpoints PR364 and single-unit static circles PR385 are merged; shared rejoin PR411 is merged. Group physical avoidance/compression/reform remains PR400 work. [Retained Direct Move checks](qa-direct-open-ground-move-2026-10-04.md) document the historical cell-center milestone. |
| Gather, Farm, shore fish, drop-off, Return, return to work | `routeWorker`, `routeForestWorker`, `routeWorkerToDropoff`, `updateWorkerEconomy`; cached cardinal flow fields → land executor | PR395 is merged: land economy reduction/rejoin, route steps and gathering separation consume the static Worker profile. Selected `path.at(-1)`, original cost/raw `path.length` scoring, ranges and cargo/job remain resource-owned. Broad dynamic/long-soak/rendered coverage stays open; water adapters keep their policy. |
| Forest group / region intent | `assignForestGather`, gather-work-area selection, `updateForestWorkerEconomy` → resource routes | Forest owner `01a1072a-4c42-7791-9dab-77b88425a021` owns the returning-forester/interior-click fix. A clicked interior tree names its selected forest group; choose its nearest reachable frontier. Distinguish exhausted, temporarily obstructed and unreachable. No unrelated global fallback or hidden-resource reveal. |
| Build, repair, palisade sequence, site evacuation | Building access assignment → A* / land executor; construction and wall continuation | PR399's bounded construction travel adopter consumes the shared static Worker profile through existing planner/publication/land admissions. Preserve paid site IDs, revision, legal edge range and actual productive-work receipts. Stationary construction separation and evacuation remain explicit follow-ups; movement completion does not mean work completion. |
| Attack-move and interrupted-route resume | Formation A* plus `prepareAttackMovePaths`, `getUnitAttackPath`, `clearAttackTarget` → land executor | Military objective PR405 and acquired pursuit PR417 are merged, including fractional target-loss resume and fixed bounds. Automatic Aggressive/Defensive acquired unit pursuit PR432 and acquired military Patrol PR421 are merged. Worker objective/pursuit remains excluded; retain original acquisition/range/leash rules. |
| Focused unit/building attack, pursuit, range positioning | `assignAttack`, `assignAttackBuilding`, cached flow / range goals → land executor | Military unit-target PR410 and paid building-target PR424 are merged, with moving-target/rejected-prefix and legal-range productive recovery. PR432 covers automatic unit-target range travel; no automatic building acquisition writer exists in current `simulateTick`. Worker Attack and same-cell endpoint/interaction policy remain separate; combat retains target/range/damage decisions. |
| Patrol and Follow | `assignPatrolOrder`, `assignFollowOrder`, `updatePersistentOrders`, `enqueueRouteRepairs` | Military Patrol travel PR418, acquired Patrol PR421 and Follow/queued catch-up PR429 are merged. Worker Patrol/Follow are implemented but excluded from these profiles; the new actual-command audit below records static contacts and preserves successful continuation/recovery. |
| Stance return | Existing target-loss/death return planning → land executor | Not adopted by PR432. All 24 measured Defensive return controls are safe and reach original anchor cells; no return patch is justified by that sample. Broader characterization and combat-owned policy remain separate. |
| Production rally | `routeProducedUnitToBuildingRally` → cell-only `enqueueRouteRepairs` | This does **not** issue ordinary single-unit Move or publish its clearance point. Source inventory finds no active body profile for target-free rally units; no failing physical witness is claimed yet. Next: paid production plus actual Set Rally, obstacle travel and cold restore using original selected cell. |
| Worker Attack / AttackMove | `assignAttack`, objective/acquired AttackMove resume and existing Worker repath | Existing Worker combat goal/recovery checks pass; military body predicates explicitly exclude Worker. Next: add static .18 substep observation to real Worker unit-target/objective/acquired commands before proposing their own profile/rejoin allocation. Worker building Attack remains a rejection control: Worker lacks `attack-structures`. |
| AI and scenario-issued movement | Existing command dispatch plus mode/AI decision loop; scenario actions / reinforcement placement | Enumerate emitted commands and direct relocations; AI uses the same movement contracts and its disclosed observation. Fixed planning work alone does not make async intake or AI decisions deterministic. |
| Idle/work/combat interaction separation | `spreadInteractingUnits`; same-cell combat closure inside `simulateTick` | Gathering separation is adopted by PR395. Construction separation uses the economy-only selector; the new bounded command probes below find no static failure and do not qualify it generally. Military interaction and same-cell combat remain separately owned adoption gaps. |
| Skiff Move, queued Move, fishing, Dock return | `water-unit-runtime`, `skiff-group-orders`, `skiff-waypoints`, `skiff-fishing` | Adapt route status/identity/diagnostics; preserve cardinal water, static shore clearance, 0.4-cell hull reservations, atomic group admission and retry budgets. Unsupported attack-move/Patrol/Follow remain explicit rejection. |
| Sheep herd, grazing, wildlife motion | Shared `pathFromAttackFlow` supplies `wildlife-herding`; wildlife owns direct stepping/final point | Cardinal route validator and continuous final endpoint are intentional. A global flow-path shortcut would violate this consumer. Audit grazing and topology retry separately. |
| Spawn, checkpoint restore, evacuation / relocation | Spawn rules, `restoreMatchCheckpoint`, construction relocation | These are placement/restore policies, not ordinary travel. Validate clearance and identity, record relocation reason, rebuild transient routes without silently changing job intent. |

### Remaining caller steps after PR432

The [Patrol-only acquired Worker characterization](qa-worker-patrol-acquired-clearance-2026-10-05.md) observes actual pre-write acquired substeps and preserves original policy/recovery controls. The canceled acquired-AttackMove handoff remains untouched; any acquired Patrol adoption stays a distinct measured increment.

Construction travel/approach and the scoped military Move-objective, explicit
unit/building Attack, acquired AttackMove, Patrol travel/pursuit, Follow and
Aggressive/Defensive pursuit adopters are source-integrated. This does not mean
universal movement is complete: excluded Worker/persistent/rally/interaction,
placement, naval and wildlife policies still require their own evidence. All
ordinary rendered acceptance remains OPEN; source, pack and provider receipts
are distinct. Existing staging verifier retains deployment follow-through at
[PR429](https://github.com/lbeezr/thousand-unit-skirmish/pull/429#issuecomment-5987749825)
and [PR424](https://github.com/lbeezr/thousand-unit-skirmish/pull/424#issuecomment-5987357027).

The new [actual-command Worker persistent audit](qa-evidence/worker-persistent-audit-2026-10-05/summary.json)
on clean `f1336896` runs both seats, real callback/tick planner modes 0/1 and
live/separate-cold/queued-before-publication cold continuations. At body-clear
`(.79,.95)` beside stone `(1,1)`, Worker Patrol to `(6.5,.5)` admits 16 unsafe
steps/one new penetration in every measured seat/mode/continuation. Worker
Follow to a friendly Worker at `(6.5,.5)` admits the same 16/one on seat 0; seat 1's
original ID-derived offset is safe in this fixture. No symmetric Follow failure
is inferred. All queued fractional endpoints complete and live Patrol cycles;
this is a static-body adoption gap, not a stranded pending goal. Full production
substeps and hashes are [retained compressed](qa-evidence/worker-persistent-audit-2026-10-05/baseline.json.gz).
Run `node scripts/worker-persistent-caller-audit.mjs`; exit 0 means collection,
not clearance acceptance. No positions, HP, routes, vision or algorithms are patched.

| Remaining domain | Smallest executable next step / owner | Decision against speculative changes |
| --- | --- | --- |
| Worker Follow and its cancelled queued catch-up | Caller: [allocated pure predicate/.18 fallback and existing PR429 queue-capture boundary](https://github.com/lbeezr/thousand-unit-skirmish/pull/434#issuecomment-5988456734); [current strict adoption evidence](qa-worker-follow-clearance-2026-10-05.md). Independent exact-head review, fresh-main/native/package qualification and normal merge are retained by caller. | Baseline 16 unsafe steps on seat 0, safe seat-1 controls and all eight successful queued audit endpoints remain explicit. Preserve leader/deadband/offset, goals, generation/revision, job/cargo and explicit command replacement; Worker Patrol stays separate. |
| Worker Patrol / retained target-free AttackMove objective | Caller: [disjoint pure predicate/.18 fallback boundary](https://github.com/lbeezr/thousand-unit-skirmish/pull/438#issuecomment-5988970802) and [current actual-command qualification](qa-worker-patrol-clearance-2026-10-05.md). Core retains economy publication; no server/controller/queue edit. | Original baseline remains 16 unsafe steps/one new penetration in all12 Patrol cases and all8 successful mixed queued endpoints. Preserve `attackMove:true` on cancelled first legs, original endpoint cells, job/cargo, routes/queues and cold recovery. The same existing target-free state explicitly covers direct Worker AttackMove; acquired combat remains separate. |
| Production rally | Caller diagnostic: pay/build/train, issue Set Rally and trace static body/recovery at the original selected goal. Agree the exact initializer only if a failure is measured. | Cell-only publication is a source gap, not proof of penetration. No duplicate route algorithm or new saved intent marker. |
| Worker combat | Caller/combat owner: extend existing real Worker repath/unit-target/objective/acquired cases with .18 static observations before allocating hooks. | Existing productive native combat/recovery is not static-circle qualification. Do not alter Worker combat capability/range or recruit economy flow. |
| Construction/combat stationary interaction and evacuation | Existing core/combat placement owners: real paid obstruction/recovery reproduction through the particular writer, then exact local agreement. | Retained 12 construction probes execute 54 separation steps with zero new static contacts and productive completion. They do not justify a selector patch or universal clearance claim. |
| Construction access / parked exact military endpoints | Caller [default access/work-pose adopter](qa-construction-access-adoption-2026-10-05.md) consumes merged core PR446 at the agreed host seams. Thirty real-command journeys, 69 registered cases and native both-seat cold process recovery retain paid intent and productive release. | New military-first construction chooses safe access or waits without route repair; actual work poses are admitted before progress/parking, including cooperative completion. Dynamic wait preserves static attempts and rebuilds after cold recovery. Existing parked idle/Stop/Hold builders retain their pose and military exact point/queue waits for independent departure. Crowd steering and core Gather quotas remain separate; deployed/rendered acceptance stays open. |
| Defensive return and same-cell combat | Combat owner: keep 24 safe return controls and productive in-range empty-route firing; separately reproduce PR424's both-seat building endpoint stall before any arrival-policy proposal. | A .22 profile exclusion alone is not a defect. PR424's Archer stall is an independently retained endpoint contract, not authority for forced relocation/range/damage changes. |
| Core retention/search bounds, group steering/body pairs | Core [PR434](https://github.com/lbeezr/thousand-unit-skirmish/pull/434), crowd [PR400](https://github.com/lbeezr/thousand-unit-skirmish/pull/400) retain their current failures and next actions. | No duplicate Return/flow/quota or 64-unit return-liveness patch. Crowd safety does not close unfinished actors/deadlines. |
| Naval/wildlife and spawn/restore/scenario placements | Their domain owners: command/endpoint/topology/cold-recovery inventory at the actual adapter, then domain-specific body/placement acceptance. | Cardinal water/hull reservations and Sheep selected tails are intentional. No global shared attack/Sheep flow pruning. |


### Shared semantics, domain policies

The [automatic-stance pursuit adoption](qa-automatic-stance-pursuit-2026-10-05.md)
in [PR432](https://github.com/lbeezr/thousand-unit-skirmish/pull/432) consumes
shared static-circle clearance and the unchanged selected-route rejoin at
[the two allocated acquisition/repath conditions](https://github.com/lbeezr/thousand-unit-skirmish/pull/425#issuecomment-5987896694).
Its real-command Infantry witness changes four unsafe steps per stance/seat to
zero, while preserving the selected suffix, fixed anchors and legal-range damage.
Both-seat Infantry/paid Archer journeys cover cold recovery, moving targets,
manual/queued priority, paid blockage and rejected prefixes. StandGround/NoAttack,
Worker/water, building/persistent targets, return and same-cell writer remain
excluded. The separate 24-case Defensive return controls stay safe without a
return patch. Same-cell range closure remains a combat endpoint contract.
Exact reviewed source, clean pack and process results are recorded on the PR;
provider identity and rendered acceptance remain OPEN.

The separate **target-free military Follow candidate** consumes core PR422's
durable accepted pending-goal contract at merged building-target source `032eea7d`.
It adds `followTravelMovementActive` and the caller-owned body-profile fallback;
existing shared publication/rejoin/executor do the work. The separately allocated
queue-append subsection below preserves that clearance when Follow converts to
ordinary travel. No persistent controller, checkpoint field, planner, quota or
crowd algorithm changes are included. [Initial disjoint boundary](https://github.com/lbeezr/thousand-unit-skirmish/pull/425#issuecomment-5987365194)
retains PR425's live-publication/retry functions with core.

The [baseline](qa-evidence/follow-travel-2026-10-05/baseline.json) on unchanged
`032eea7d` runtime finds 16/6 unsafe Infantry corner substeps on seats 0/1;
paid/trained Archer controls already have zero. The
[pre-review candidate](qa-evidence/follow-travel-2026-10-05/candidate.json)
reduces Infantry to zero and retains Archer's zero, the original ID-derived
two-cell offset goals and friendly leader identity. Safe Infantry travel changes
the observed stop from `(3.2454,.6505)` / `(3.0942,.0436)` to the selected cell
centers `(4.5,.5)` / `(4.5,-.5)`, and final revision 5→4: the unchanged 30-tick
controller no longer cancels an active path inside the four-cell deadband in
this witness. No timing, exact stop-position or revision-identity claim is made.
The original four-cell deadband, two-cell offset, poll/retry/cap, leader
generation/death, selected goals and cancellation policy remain controller-owned.

The new strict command journeys expose a **remaining coupled transition gap**:
queued Move before the first Follow path publication clears persistent intent
while retaining its accepted cell goal, but leaves `moveGoalPoint:null`.
`ordinaryMoveBodyRadius` then yields zero during recovery's rebuilt first leg.
Both the [unchanged baseline](qa-evidence/follow-travel-2026-10-05/queued-clearance-baseline.json)
and [candidate](qa-evidence/follow-travel-2026-10-05/queued-clearance-candidate.json)
execute that durable leg and reach the queued fractional point, yet retain
16/6 unsafe corner steps. Baseline runtime hashes are verified against the
merged source; archive and dirty-checkout provenance are explicit. The reporter
`follow-queued-clearance-probe.mjs` exits successfully for collection, **not**
physical acceptance. Core PR422 fixed liveness; it did not adopt this cancelled,
cell-only ordinary leg's body policy.

The initial 49 registered candidate checks retained six strict physical failures
for that pending/queued/cold transition; independent review confirmed them and
identified a planning-mode harness gap, which was corrected before the host fix.
The cold cases now set actual callback/tick planner modes before both module
imports and complete the catch-up and queue through their shared hooks, without
draining active legs. Independent state-only projection through the existing API
validated and reduced 16/6 contacts to zero in both modes.

[Core's exact allocation](https://github.com/lbeezr/thousand-unit-skirmish/pull/425#issuecomment-5987591555)
then assigns caller PR429 only the additive accepted queue-append subsection of
`assignFormationMove`. It captures target-free military land Follow with a valid
accepted cell and pending or unconsumed catch-up. After clearing Follow, it
preserves an already-valid ordinary point or creates the selected cell-center
v2 point through `createClearanceMoveGoalPoint` at the same generation/revision.
The selected cell, raw path/reference/index, pending job, incoming waypoint and
accepted intent stay intact. Idle/exhausted Follow, Worker, water, acquired
combat, Patrol and AttackMove policies remain outside this conversion. No new
saved flag or leader revival is introduced. This deliberately activates the
existing ordinary classifier; [crowd's receiving boundary](https://github.com/lbeezr/thousand-unit-skirmish/pull/400#issuecomment-5987594116)
retains its steering and actual branch qualification.

The [adopted queued witness](qa-evidence/follow-travel-2026-10-05/queued-clearance-adopted.json)
records both seats executing the first accepted leg and completing the queued
fractional point with radius .22 and zero unsafe steps; dirty pre-review source
and runtime hashes are explicit. Sixty-three registered journeys include the
six original regression cases plus pending/active queued AttackMove, preservation
of an API-authored existing point after Follow clears, idle/exhausted immediate
replacement and excluded Worker queue controls. Other real-command cases cover
both-seat Infantry and paid/trained Archer, accepted/pending/active recovery,
Stop/Hold/Move, moving leader, actual leader death, validated generation
replacement, close leader deadband, existing bounded monotone legacy escape,
paid obstruction and selection/cycle rejection. Historical candidate measurements remain above. [PR429's merged-source receipt](https://github.com/lbeezr/thousand-unit-skirmish/pull/429#issuecomment-5987749825) establishes its normal merge, exact checks and clean pack. Native active-Follow/active-queued-leg restart evidence is separate
from traced first-pending geometry. Rendered and identified served acceptance
remain open; the historical zero-frame block is retained without retry. Art
backing is N/A.

Focused military **building-target Attack** now consumes the merged selected-route
rejoin at `assignAttackBuilding`'s final accepted publication and `simulateTick`'s
active building repath, after their original target/revision/range-goal decisions.
[Exact hook allocation](https://github.com/lbeezr/thousand-unit-skirmish/pull/416#issuecomment-5987148807)
keeps shared planner/publisher/live bounds and Follow recovery with core, and
ordinary-only steering/body-pair admission with crowd. The pure
`focusedBuildingAttackMovementActive` predicate selects the existing military
circle. No new route algorithm, range truncation, checkpoint field, attack flow
shortcut, target acquisition or damage rule is introduced. Static rejection
keeps the selected durable goal and accepted target, with the existing retry.
Empty in-range routes and unreachable range goals retain their original policy.

The [baseline](qa-evidence/focused-building-attack-2026-10-05/baseline.json)
uses unchanged `172c53f3` runtime with only the new probe present; dirty status is
explicit. Real paid/completed Palisade and House targets and legitimately trained
Archers expose four unsafe fractional-corner steps for both kinds on both seats.
The [pre-review candidate](qa-evidence/focused-building-attack-2026-10-05/candidate.json)
finds zero in all eight cases, preserving the entire selected suffix, range goal,
target footprint and HP after 500 ticks. Safe travel changes Infantry first damage
from 48→55 ticks (Palisade) and 59→67 (House); Archer changes 26→26 and 26→30.
These bounded measurements do not claim timing identity or general crowd safety.

Registered `focused-building-attack-journeys.mjs` checks both-seat accepted/travel/
firing recovery for Infantry and paid/trained Archer against both footprint sizes,
productive original edge-range/armor damage, real destruction, queued continuation,
owner cancellation, Stop/Hold/Move, pending Move supersession, selected-suffix
repath, rejected inherited overlap, empty in-range routes, paid dynamic obstruction
and selection/generation rejection. Native `focused-building-attack-scenario.mjs`
uses both real WebSocket seats, paid unfinished targets, actual Infantry damage,
travel/firing cold restarts and owner cancellation into the saved queued point.
Exact-head review/checks/clean-pack receipts belong to its PR. Core's pending-goal
correction lands in PR422; Follow clearance remains a separate caller slice
requiring the readiness witness below. PR418's observed 30-tick
seat1 reversal shift and the two old seat0 geometry/visibility failures remain
retained. Automatic building attacks, Worker/Sheep, stance return and same-cell
closure are excluded. Art backing is N/A. Deployment verifier owns current
staging follow-through; identified served and real rendered acceptance remain
open, with the historical zero-frame capability block retained without retry.

Caller [PR421](https://github.com/lbeezr/thousand-unit-skirmish/pull/421) consumes the merged PR411
selected-route rejoin contract in the two already caller-owned `simulateTick`
unit-target acquisition/repath hooks. A pure `patrolAcquiredMovementActive`
predicate selects the existing military profile only for persistent Patrol,
`attackMove:true` and an active unit target. The original acquisition anchor,
`boundedAutomaticApproach` range/stance-selected suffix and
`automaticPositionAllowed` plus static prefix sweep remain unchanged. No
shared planner/publisher/rejoin/executor, checkpoint schema, target acquisition,
damage, persistent-order controller or crowd algorithm is rewritten.
[Exact ownership and the Follow dependency](https://github.com/lbeezr/thousand-unit-skirmish/pull/416#issuecomment-5986939658)
retain core's live-publication/XL contract and crowd's ordinary-only admissions.

The [baseline](qa-evidence/patrol-acquired-2026-10-05/baseline.json), using unchanged
`dcb96cef` runtime with only new observation scripts present (dirty checkout
explicitly recorded), finds four unsafe acquired-pursuit substeps for Infantry
and a legitimately trained Archer on **each seat**. The
[pre-review candidate](qa-evidence/patrol-acquired-2026-10-05/candidate.json)
finds zero, while both retain their original leg and kill at the same recorded
263/461 tick offsets. These are bounded witnesses, not universal timing,
capacity or rendered claims. PR418's target-free detour still has the observed
seat1 30-tick reversal shift documented below; this slice does not erase it.

The new registered real-command journeys exercise both-seat melee/ranged
acquisition, complete selected suffixes, productive legal-range damage,
acquired/damage/resumed recovery, continued original endpoint cycles,
Stop/Hold/manual/queued Move/noAttack, target repath/leash loss, empty in-range
Stand Ground routes, static overlap rejection and prefix rejection outside the
unchanged anchor travel bound. Earlier Patrol acquisition expectations now use
this separate acquired profile while still excluding explicit AttackMove's
predicate. Worker, building-target, Follow, automatic stance/return and same-cell
closure remain separate; body-pair steering is not claimed. Exact-head
independent review, source/types/package/native and normal-merge receipts belong
to this incremental PR. Deployment verifier retains staging follow-through;
rendered acceptance remains open with the retained zero-frame capability block.
Art backing is N/A for this movement-contract change.

Follow was audited first because a pure profile could consume its existing
planner/rejoin. Its queue/recovery contract has a genuine readiness dependency:
the retained baseline's first pending catch-up has `moveGoalCell:-1`. Queued Move
cancels leader intent at admission; recovery cannot reconstruct that transient
catch-up, leaving the saved queued point present but unexecuted after 600 ticks
on both seats. [Recorded reproduction](qa-evidence/patrol-acquired-2026-10-05/follow-pending-queue.json)
is produced by `node scripts/follow-pending-queue-probe.mjs`; reporter success
means observations were collected, **not** that recovery passed. Core owns the
pending publication/recovery goal decision. The core correction now records
every accepted `enqueueRouteRepairs` destination in `moveGoalCell` before
publication, including cell-only repair and persistent legs. Fractional goal
projection still preserves its requested point under the accepted revision.
Registered native journeys issue real Follow then queued Move before first
publication on both seats, using callback and tick planner modes. They check
the durable first goal, actual first-leg travel and queued fractional arrival;
cold cases serialize and validate the complete checkpoint, restore it in a
separate native module, then execute both legs within 600 ticks. This fixes the
core recovery dependency without adopting Follow's body profile or pursuit.
Caller adoption remains separately owned; XL live route reservation/retry,
all-writer admission and rendered acceptance remain open. Art backing is N/A.


Caller [PR418](https://github.com/lbeezr/thousand-unit-skirmish/pull/418), after
merged acquired-AttackMove PR417, implements **target-free military Patrol travel**.
The audit confirms its existing
revision-safe planner, selected-route rejoin publisher and executor already
consume `activeLandMovementBodyRadius`: only an additive pure Patrol predicate
and existing profile fallback are needed. There is **no host edit** or duplicate
route/admissibility algorithm. [Core's live-publication boundary](https://github.com/lbeezr/thousand-unit-skirmish/pull/416#issuecomment-5986613546)
and ordinary crowd's active-Move-only classifier remain disjoint. Live XL
reservation/retry, aggregate save bounds and 320 admission stay core/map-owned.

The [real-command baseline](qa-evidence/patrol-travel-2026-10-05/baseline.json)
at `b8028375` admits 17 unsafe static-body substeps per seat from `(.75,.95)`
beside the stone corner. The
[pre-review candidate](qa-evidence/patrol-travel-2026-10-05/candidate.json)
admits zero, using the already shared current-cell prefix and selected tail.
Both continue repeated outbound/return legs with original endpoint cells.
Patrol still returns to the start **cell center** `(.5,.5)`, not the original
fractional pose; leg polling remains unchanged. The safe initial detour misses
one existing polling opportunity in seat 1: first reversal moves from tick 71
to 101, with later recorded reversals shifted by the same 30 ticks. Seat 0's
recorded reversal ticks stay unchanged. These are bounded workload timings,
not universal arrival/capacity or rendered qualification.

The 37 new registered real-command checks exercise both-seat pending/outbound/
return-pending/return-active recovery, repeated cell cycling, Stop/Hold/manual
and queued Move, actual acquisition/legal damage and saved-leg restoration,
live-target leash loss, paid endpoint blockage/cancellation, Follow and Worker
negative controls, plus a validator-accepted saved Patrol with `attackMove:false`
whose persistent travel and unchanged flag survive cycling. Existing recovery
requeues a pending saved goal once under
one new revision, then the unchanged persistent controller resumes its leg;
queued Move cancels persistent intent at **admission** and keeps the existing
queued-route contract. The earlier objective/Patrol control now expects the
new separate Patrol profile while retaining objective exclusion and cycling.
Automatic idle stance/return, acquired Patrol pursuit, Follow, Worker/water,
building targets, same-cell closure and body-pair steering remain separate.
Final independent exact-head source/types/package/native/normal-merge evidence
belongs to this caller increment. The deployment verifier owns current staging
follow-through; actual rendered acceptance stays open under the retained
sandbox/storage capability failure with zero frames and no retry.

After focused Attack PR410 normally merged at `6ced82cb`, the coordinator
allocated explicit military AttackMove **acquired unit-target pursuit** to
caller owner `01a10933-e913-766b-b5de-3aa5a17c7038`. Exact interfaces are recorded
against [core's live publication ownership](https://github.com/lbeezr/thousand-unit-skirmish/pull/411#issuecomment-5986410973)
and [ordinary crowd ownership](https://github.com/lbeezr/thousand-unit-skirmish/pull/400#issuecomment-5986411719).
Only the pure acquired-intent predicate/profile fallback, acquisition publication
after original anchor/target creation, and existing caller-owned unit-target
repath publication change. Core retains the helper/planner/Worker publisher and
live-publication bounds; crowd retains `getMoveVector`, body pairs and its
ordinary-only wait/repair policy. All three executor admissions remain intact.
The implementation is [PR417](https://github.com/lbeezr/thousand-unit-skirmish/pull/417).
Core's [PR416 boundary reconciliation](https://github.com/lbeezr/thousand-unit-skirmish/pull/416#issuecomment-5986530945)
leaves its XL-only live reservation/deferred continuation pending and disjoint;
this adopter does not qualify aggregate live/save bounds or open 320.

The [real-command baseline](qa-evidence/attackmove-acquired-2026-10-05/baseline.json)
at `86bd3506` moves a selected actor to `(.75,.95)`, accepts AttackMove, then
enables Aggressive stance with a real command so acquisition happens before
objective travel conceals the gap. Both-seat Infantry admits four unsafe static
substeps; a legitimately trained Archer admits three. The
[pre-review candidate](qa-evidence/attackmove-acquired-2026-10-05/candidate.json)
reduces each to zero, preserves the complete already range/stance-selected
route behind one current-cell prefix, and kills at the same 263/461 fixed ticks.

Both allocated publications consume actual `rejoinSelectedUnitRoute`.
`acceptPrefix` passes unchanged `automaticPositionAllowed` **and** the shared
actor-to-center static sweep, evaluated after the original anchor exists.
Rejected prefixes publish an empty route for existing repath without discarding
target, anchor, durable objective or saved resume path. Null/unreachable and
in-range empty routes retain existing semantics; no range/stance/anti-reversal
selection, acquisition/damage, checkpoint schema or global flow changes.
The 31 new registered command checks cover both seats, Infantry/trained Archer,
complete selected-route inputs, actual damage, acquired/damage/resumed recovery,
moving-target repath, target-loss resume, Stop/Hold/queue/No Attack, in-range
Stand Ground, static rejection and a body-clear prefix outside the unchanged
Defensive travel circle. Test-only rejoin tracing delegates to the actual API;
it does not substitute a route or admissibility algorithm. Existing objective
and focused checks now expect the acquired body policy while preserving their
original objective resume/range/queue assertions. Final exact-head independent
review, release/native/merge evidence belongs to the caller PR. Automatic idle
stance/return, persistent Patrol/Follow, Worker/building targets, same-cell
closure and steering/body-pair clearance remain separate. The retained
sandbox/storage capability block has zero frames; rendered/served acceptance
stays open, and PR410 staging verification is separately coordinator-owned.

The next coordinator allocation at `bd7f2915` is explicit focused military
unit-target Attack only, recorded on
[PR395](https://github.com/lbeezr/thousand-unit-skirmish/pull/395#issuecomment-5986006185).
Caller owner `01a10933-e913-766b-b5de-3aa5a17c7038` owns the pure active-intent
predicate/profile fallback, `assignAttack`'s path publication after accepted
order revision, and active focused pursuit/repath publication after existing
null/unreachable handling. Core owner `01a107ba-7977-7764-9574-17cb0c3a102e`
supplies the actual kind-radius-aware selected-route **rejoin-only** API.
The Worker publisher is not a generic substitute: keep durable `moveGoalCell`.
Preserve the full route chosen by `getUnitAttackPath`, including an intentional
retained legal waypoint; do not newly truncate focused Attack at weapon range
or shorten its whole route. Preserve in-range `reachable:true/path:[]`, null
budget defer, unreachable results and accepted-order identity. Explicit
Attack under `noAttack` still travels. Exclude Worker, buildings, automatic
stance/return, persistent Patrol/Follow, same-cell closure and AttackMove-acquired
pursuit. The latter needs a later prefix policy that passes unchanged
`automaticPositionAllowed` after anchor creation. No allocated host hook is
edited until core's API exists; actual command regressions are prepared while
waiting only on that dependency. Both-seat Infantry and a legitimately trained
Archer baseline each admit four unsafe static substeps at the authored corner,
despite legal-range damage and successful target kills. The
[retained baseline](qa-evidence/focused-attack-2026-10-05/baseline.json) preserves
the full Archer route to its target cell and physical/damage evidence.

Core [PR411](https://github.com/lbeezr/thousand-unit-skirmish/pull/411) is now
normally merged at `93d45c73`. Caller
[PR410](https://github.com/lbeezr/thousand-unit-skirmish/pull/410) consumes its
actual `rejoinSelectedUnitRoute` at the two allocated focused publications,
after accepted revision and after existing reachable/null handling. Shared
kind radii feed existing static-body execution checks. Prefix acceptance uses
the shared static sweep to the current cell center; rejection publishes an
empty path while preserving the accepted target/revision/goal for existing
repath handling. It never republishes the unsafe original approach. Both-seat
controlled prior-checkpoint overlaps prove rejection/recovery admits no new
unsafe step or out-of-range damage, and unchanged in-range firing still works;
legacy placement/stationary separation remain unqualified by that control.
No `getUnitAttackPath`, selected-route reduction/truncation, global flow,
same-cell closure, saved-goal/schema or automatic acquisition policy changes.

The [pre-review candidate](qa-evidence/focused-attack-2026-10-05/candidate.json)
records zero unsafe steps for both Infantry/Archer seats, with exactly one
current-cell prefix and the complete selected suffix preserved. All four
command workloads still kill at the same baseline ticks (263 Infantry,
461 Archer). The 45 new registered checks compare complete authoritative
selection against publication, require actual productive damage before damage
recovery, and cover moving-target continuation, accepted-order identity,
pending Move supersession, paid navigation changes, exclusions and rejection.
Two broader seat-0 dead-target visibility fixtures reproduce with the old
publisher; preserve those baseline failures separately from adoption checks.
Final exact-head review/types/clean pack/native and author merge evidence
belong to PR410; rendered/served acceptance remains open.

After PR399 merged at `50d2e99e`, the project coordinator allocated a narrow
target-free explicit AttackMove objective increment at main `82a66766` to
caller-adoption owner `01a10933-e913-766b-b5de-3aa5a17c7038`, recorded on
[PR395](https://github.com/lbeezr/thousand-unit-skirmish/pull/395#issuecomment-5985799879).
It owns a pure `src/combat-movement.mjs` predicate, its import and final
kind-radius fallback in `activeLandMovementBodyRadius`, the one simulation
domain registration, and focused command journey regressions. Existing radius
values remain in `unit-movement`; server/planner/attack helper bodies stay with
their owners. The registry entry is disjoint from architecture's three
server import-literal migrations; crowd PR400 remains ordinary Move only.
Pending planning qualifies; explicit `noAttack` stance still travels. Worker,
nonmilitary/dead/water/hold, either active target, automatic stance combat or
return, persistent Patrol/Follow, gathering and construction are excluded.
Acceptance requires both-seat physical commands, acquisition deactivation,
safe finite saved-route resumption from fractional pursuit positions with
bounded existing repair, unchanged range/damage, pending/active interruptions,
queued replacement, checkpoint recovery, and navigation changes. Actual Patrol
is a negative control, not an adopter. Baseline command-only AttackMove and
Patrol each admit 17 unsafe static-circle substeps per seat beside the same
authored corner. Any larger host change needed for resumption is reported
before expanding. Weapon-range pursuit and Patrol/Follow/stance continuation
remain the next separately allocated increments. Cloud rendered acceptance
remains open under the retained capability failure below.

The [retained before/after command record](qa-evidence/attack-move-objective-2026-10-05/baseline-and-candidate.json)
keeps the 17 unsafe steps per seat at baseline and zero after objective adoption;
actual Patrol still has 17 per seat. The
[fractional target-loss probes](qa-evidence/attack-move-objective-2026-10-05/pre-review-resumption.json)
retain eight real-command acquisition/kill/resume journeys with zero unsafe
resumed steps and at most one existing repair. The registered attack-flow suite
imports 39 new objective checks, including saved-route pursuit recovery,
Stop/queued replacement and paid navigation changes during combat. Actual
damage receipts use unchanged weapon range/armor/damage rules. The adjacent
core rejoin regression now asserts route exhaustion rather than exactly two
cells; the new adopter legitimately prefixes the shared current-cell rejoin.
Endpoint, queued intent, one repair and pending-service assertions remain.
The [pre-review native witness](qa-evidence/attack-move-objective-2026-10-05/pre-review-native.json)
names its dirty source honestly: both WebSocket seats complete explicit
`noAttack` objectives after actual process cold restart, retaining HP/intent.
Independent review and normal merge completed in
[PR405](https://github.com/lbeezr/thousand-unit-skirmish/pull/405) at `bd7f2915`.
The PR retains exact-head/merged checks, native cold restart and clean release
evidence. Source adoption is complete; identified served/rendered acceptance is open.

Two baseline failures are distinct from this change: untouched main `82a66766`
fails `wildlife-motion.test.mjs`'s extracted checkpoint-capture test because its
VM lacks the new `preflightXlCheckpointRoutes` binding, reported to the
[XL owner](https://github.com/lbeezr/thousand-unit-skirmish/pull/403#issuecomment-5985876523).
The existing native `live-attack-move-repair-scenario.mjs` fails identically on
untouched main and this candidate during close-spawn army isolation, before
issuing AttackMove: the intended enemy Worker is already dead at tick 408.
Neither failure is claimed green or repaired by caller adoption. The focused
255-check regression selection passes; it does not claim the full CPU suite.

Construction caller adoption owner `01a10933-e913-766b-b5de-3aa5a17c7038`
reserves `constructionMovementActive` in `src/construction-work-intent.mjs`
and the construction journey regressions in the existing registered
`scripts/construction-work-intent.test.mjs`. Its exact shared consumer request is
[PR395 comment 5985577813](https://github.com/lbeezr/thousand-unit-skirmish/pull/395#issuecomment-5985577813):
core retains the shared planner/executor and `src/unit-movement.mjs`; construction
owns only the predicate import/fallback inside `activeLandMovementBodyRadius`
under the core owner's [explicit two-line agreement](https://github.com/lbeezr/thousand-unit-skirmish/pull/399#issuecomment-5985597848).
The implementation is in [PR399](https://github.com/lbeezr/thousand-unit-skirmish/pull/399).
Worker adopter PR395 is merged at `452d043f` and incorporated conflict-free.
Existing route results, planner/body checks, fractional first-leg rejoin,
terminal/steering/fallback admissions and dynamic repairs consume this selector
by default; no server/planner body edits are allocated. Crowd steering/body
pairs and XL save validation remain disjoint active owners.

At clean production source `13b13e82efe19d37ef3972907c8335a460fd041d`, real
Move to `(0.79,0.95)` followed by selected-Worker Build House at `(6.5,0.5)`
beside stone `[1,2]×[1,2]` admits thirteen unsafe static-circle substeps per
seat, starting on its first steering step. Each House still completes and
costs exactly 75 Wood. The [retained baseline](qa-evidence/construction-travel-2026-10-04/baseline.json)
separates paid/productive correctness from the reproduced clearance failure.
Eight both-seat live/pending/active/working-recovery journey regressions fail
at that physical admission before adoption. The two-line consumer makes every
actual selected construction substep body clear while still completing the
same paid House with productive receipts at the unchanged 1.4 edge range.
Two new actual-command paid-footprint/recovery journeys retain the remembered
site/area and finish safely after navigation changes. The thirty construction
checks include the thirteen existing controls, live-intent exclusions and six
both-seat Stop/cancel/queued-replacement cases; 49 adjacent construction/client/
wall checks also pass. The [native both-seat command/restart witness](qa-evidence/construction-travel-2026-10-04/native-selection.json)
at `44c3cc83` retains sole selected builders, cooperative/nearest resume,
unselected Gather/queued orders, foreign/stale rejection and cold recovery to
completion. The existing native base-lifecycle scenario also passes repair
costs, interruption/restart, cancellation/refunds and reservations. These
historical process receipts do not claim a construction clearance fix.
No shared planner, flow algorithm, attack/Sheep path, production receipt or
checkpoint schema is rewritten. The intent predicate uses existing live
Worker build/repair fields, excludes interrupted/economy/combat/water states
and introduces no saved state. Stationary construction interaction separation
still uses the economy-only body selector and is **not** qualified by this
travel/approach slice; site evacuation/legacy overlap and body-pair clearance
remain explicit further work. Independent exact-head review approved
`1bbf9d81`, author normal merge integrated PR399 at `50d2e99e`, and 99
merged-source focused checks/types/imports/docs plus clean pack and startup
smoke pass. Source integration is complete; served/rendered acceptance stays open.

The [one cloud capability attempt](qa-evidence/construction-travel-2026-10-04/renderer-capability.json)
is blocked by `sandbox-unavailable` and `storage-unavailable`, with zero game
frames/screenshots. Construction retains release/deployment and actual rendered
acceptance; no security bypass, Mac dependency or auth/dispatch retry is part
of this lane. After construction is independently reviewed and normally
integrated, sequence weapon-range route adoption, then Patrol/Follow/stance
continuations under U4/U5 below, agreeing their exact combat-owned functions
first. Preserve shared attack and Sheep cardinal/final-point consumers.

Adopt these contracts through existing consumers one vertical change at a time.
Do not install an unused service, parallel state registry or speculative class tree.

| Boundary | Required behavior |
| --- | --- |
| Goal intent | Preserve requested point or target/group/region identity, goal kind, allowed goal set/range, domain, clearance profile and manual/automatic origin. Gameplay chooses the allowed goals; navigation selects a reachable endpoint inside them. Keep the requested goal separate from a projected/reserved arrival point. |
| Route result | Explicit `pending`, `moving`, `temporarily-blocked`, `arrived`, `invalid` or `unreachable` status/reason; source start, selected endpoint, original cost/length, representation, navigation revision, actor generation, order revision and match epoch. Budget exhaustion is pending, occupancy is temporary blockage, and exhausted resources are a job outcome. Empty waypoints alone never prove arrival. |
| Endpoint / cost | Manual single-unit final points retain fractional coordinates after legal projection; groups retain stable slot ownership. Interaction and weapon goals use legal edge/range positions. Record original cost before smoothing or stance/range truncation; preserve current Worker drop-off scoring during adoption. Shortcuts must preserve the selected multi-goal tail and may not erase weighted height costs. |
| Clearance / execution | Planning, smoothing, steering, deflection, detours, arrival and repair use compatible bounds, corner, static-footprint and domain rules. Land currently has point-step terrain guards and soft separation; that is not proof of swept hull clearance. Introduce explicit authoritative land clearance profiles with measured choke compatibility. Art size and `MIN_SEPARATION` do not define occupancy. Naval keeps its existing hull policy. |
| Publication / invalidation | Before applying a route, verify live actor identity/generation, order revision, epoch and navigation compatibility. Gates, paid footprints, destruction and harvested openings revise the relevant graph/cache. Stop/new intent supersedes old results and recoveries. Transient occupancy does not invalidate the whole static graph. |
| Priority / progress | Preserve per-actor accepted command order and existing FIFO intake. Automatic continuation cannot overwrite a newer manual order; Stop does not jump ahead of earlier commands. Local avoidance uses deterministic ties, bounded neighbors and stable side choice; repeated stalls escalate through wait/yield, local repair, replanning and an explicit outcome while retaining intent. A crowded queue waiting its turn is not automatically unreachable. |
| Planning / recovery | Share compatible fields/routes by goal policy, domain/clearance and navigation revision. Count expansions, items, turns and cache bytes; retain atomic overshoot until resumable searches are justified. Clock observations are diagnostic only. Checkpoints save durable goal/job/queue intent and rebuild transient plans; version any added fields and compare continuation hashes. Callback default remains until an all-command/tick and whole-tick qualification passes. |

### Small vertical sequence and exact ownership

Independent owners review their exact heads, resolve fresh-main conflicts, run
proportionate checks and normally merge under standing authorization. The shared
owner owns interfaces and uncovered consumers; it is not a human approval queue.
Changes to another lane's host functions are agreed with that affected owner.

| Slice / owner | Bounded writes and dependency | Acceptance / next action |
| --- | --- | --- |
| U1 · shared movement owner · merged in [PR #332](https://github.com/lbeezr/thousand-unit-skirmish/pull/332) at `062c3603` after independent review | `src/unit-movement.mjs` dimension preconditions, `scripts/unit-movement.test.mjs`, this owning guide. No flow, Worker, map-limit, server-loop or relocation edits. | Malformed grids fail closed before occupancy; 16×17, 160, 256 and planned320 primitive index checks; both-seat cliff/corner rejection across 13 injected land intent policies with intent/queue retained. Exact-head/postmerge source tests and clean release are recorded in the PR. This is a source safety/regression milestone. |
| U2 · shared adoption merged in [PR #362](https://github.com/lbeezr/thousand-unit-skirmish/pull/362) at `20580007` | Worker shortcut [PR #330](https://github.com/lbeezr/thousand-unit-skirmish/pull/330) at `6183693c`, forest-group job [PR #341](https://github.com/lbeezr/thousand-unit-skirmish/pull/341) at `ccb2e86a`; shared owner adopts their final endpoints/costs in `src/unit-movement.mjs`, Worker/planner publication and private diagnostics. | Original drop-off scoring and resource-owned reduction are preserved. Transient results distinguish ready/final approach, actual empty arrival, unreachable and deferred; reject stale actor/generation/order/epoch/nav before publication. Both-seat Worker cycles, forest/Farm selected tails, original cost/length, stale publication and fair deferred turns pass. Exact merged-source 70 checks and clean release/startup evidence are in the PR. Long mixed journeys and identified-release rendered acceptance remain U7. No global `pathFromAttackFlow` edit. |
| U3 first vertical slice · shared movement owner · [PR #364](https://github.com/lbeezr/thousand-unit-skirmish/pull/364) | `applyPlannedMoveAssignment`, goal/queue fields in `assignFormationMove` / `advanceQueuedWaypoints`, matching land checkpoint validation and existing replay fixtures. Dependency: merged U2 endpoint/cost contracts; exact checkpoint subsection recorded with recovery owner. | One selected land unit's ordinary Move/queued Move reaches its legal fractional point. Same-cell final approach, obstacle projection, guarded terminal snaps, Stop/replacement and pending/active/idle recovery pass. Independent re-review approved `ec1a142d`; final integration/release evidence belongs to the PR. Domain endpoint adoption and rendered acceptance remain open. Historical cell-center records are retained. |
| U4 · movement + construction/combat consumers | Movement owns segment/step/arrival helpers and the land execution subsection; construction owns access/paid continuation; combat owns `getUnitAttackPath`, range truncation and same-cell closure. No target acquisition/damage rewrite. | One clearance policy through direct/weighted/flow routes, building/range approaches, interaction separation and dynamic gates/forests. Both-seat range correctness, no illegal crossings, paid work unaffected; no unconsumed helper. |
| U5 · movement; naval and wildlife keep adapters | Movement owns bounded avoidance/detour/progress diagnostics. Naval owns `water-unit-runtime`, Skiff consumers; wildlife owns herd/grazing validators/stepping. Dependency: selected goal and compatible clearance. | Opposing choke traffic, parked workers, mixed speeds, stable formation slots/compress/reform, wait/yield fairness and bounded stall escalation. Preserve water hulls/basins and Sheep cardinal/final-point behavior. Each adapter ships independently. |
| U6 · movement + transport/mode/AI/recovery | Use the existing [all-command phase contract](movement-tick-phase-proposal.md#required-cross-owner-decision): named dispatcher, planner hook, AI decision ticks and checkpoint sections only. | Fixed intake sequence/eligibility and aggregate navigation budget, pending jobs/cache reuse across callers, clock/callback perturbation replay and durable recovery. Retain four-turn failure until new complete tick evidence qualifies a shipping policy. |
| U7 · movement acceptance; benchmark/map/capture owners supply their existing interfaces | Benchmark `01a101bc-9d2a-733a-916f-104264e9102c` owns report validity; map `01a103e8-8bfd-7013-8fee-94450f88501b` owns XL admission/index support; CI `01a10378` owns capture interfaces; organization `01a10711` owns relocations. Movement writes scenarios/acceptance only. | Full caller journey matrix, native/replay and actual ordinary-game rendered sequences at identified source/release. Keep 320 tests experimental until map admission lands. No duplicate report format, map-limit patch, renderer interface or path-only move. |

U2's `createUnitRouteResult` is a publication result, not a parallel live movement
state machine. `ready` means an executable route exists; an empty raw route in an
allowed goal cell becomes a center approach unless the caller's physical arrival
predicate already holds. `arrived` requires both membership and that predicate;
`unreachable` carries no selected endpoint/cost; `deferred` preserves pending
intent and yields its planner turn. The result retains raw length and weighted
grid cost before Worker reduction. Existing validated flat direct A* waypoints
report equivalent cardinal Manhattan cost, separately from physical distance.
Results live on planner assignments or Worker stack frames: no unit/checkpoint
field, schema migration, private target reveal or persisted actor reference.
Worker `moveGoalCell` follows the selected raw tail, including multi-goal access;
interaction arrival still belongs to the existing economy policy. Planner samples
include publication status counts and original cost/waypoint totals while retaining
the historical cell-membership and failure counters.

The [XL audit](map-grid-limit-audit-2026-10-04.md) in
[PR #356](https://github.com/lbeezr/thousand-unit-skirmish/pull/356) records proposed320
Far Marches (89.9% walkable, four crossings, representative route287), possible
102,400-cell atomic searches and a prospective 2.67GiB validation envelope.
**Ordinary XL remains disabled.** Today's eight-item/4,096-expansion turn budget
permits atomic overshoot and does not cap one320 search or checkpoint validation.
U6 must establish bounded search/resume and save-validation allocation contracts
with the map/recovery owners before an admission decision; U2 does not raise limits.
The merged forest-gap characterization below remains cell-gap/replay evidence,
separate from swept physical clearance, ordinary rendered acceptance or capacity.

Visual development backing for U2's internal publication/diagnostic slice is N/A;
it does not change presentation treatment. U4–U7 retain their clearance,
runtime-state and acceptance gaps.

### U3 first vertical slice: ordinary single-unit fractional endpoints

One selected land unit's ordinary Move retains the finite requested coordinates
separately from its legal arrival point/cell. If the requested cell is selected,
arrival uses that point within the existing map bounds; a blocked or disconnected
cell projects to the selected reachable cell center. Group slots, attack-move,
target/interaction range, Worker flow routes and naval hull policies retain their
own semantics. AI/scenario/rally callers that issue an ordinary single-unit Move
consume this same contract; this does not audit every AI decision or relocation.

At the U3 milestone, optional private `moveGoalPoint` and queued `point` payloads have version 1,
actor generation and order revision. Checkpoint schema 29 remains compatible with
old saves lacking these fields, which retain cell-center semantics. Unknown,
malformed, foreign or incoherent payloads reject. Capture/restore detach both
objects. Internal repair preserves requested intent while rebinding identity and
projecting the selected arrival. Stop/replacement invalidates the old point.
Only this unit/queue checkpoint subsection overlaps recovery; the exact boundary
is recorded on [the recovery artifact](https://github.com/lbeezr/thousand-unit-skirmish/pull/361#issuecomment-5983336491).

Route publication checks an assignee's fractional start and final segment.
Unsafe or weighted final approaches retain the last cell center, then finish
inside that cell; original route cost/length and shared arrays remain intact.
Entering the destination cell alone cannot dequeue the next ordinary point.
The existing land step guard still checks actual terrain/corner crossings;
this slice does not establish swept physical clearance.

Independent U3 review exposed a terminal branch that snapped to a nearby point
without that guard after crowd deflection. On both seats, three parked Infantry
beside a stone corner let the mover legally reach cell1503, then illegally snap
to fractional point `(0.001,0.001)` in cell1568 past blocked side1567. The
retained regression fails at the exact reviewed coordinates before correction.
Terminal snaps now use the shared step guard and existing blocked-route repair;
the point/queue remains pending until a legal final approach completes. Both-seat
ordinary/queued cases also restore during the pending repair, reach exact points
within the finite deadline and leave parked actors fixed. Independent re-review
approved exact source `ec1a142d`: the original reproduction finishes legally on
both seats, 268 focused checks and both strict type projects/import/syntax pass,
with 875 exact source blobs consumed. The author retains fresh-main integration,
release, deployed identity and ordinary rendered acceptance as separate records.

The [endpoint correction storyboard](qa-evidence/fractional-move-endpoints-2026-10-04/endpoint-storyboard.svg)
shows click, safe approach, exact arrival and queue handoff. It reuses the current
travel/heading/idle treatment explained by the preserved
[direct-motion study](qa-direct-open-ground-move-2026-10-04.md); no new art,
animation, velocity curve or heading treatment is selected. The schematic is
design backing, not gameplay pixels. Normal/strategic zoom, both seats and fog
remain actual rendered acceptance work with movement owner `01a107ba`, using CI
owner `01a10378`'s existing capture interface. The previously denied hosted
dispatch remains paused; no alternate authentication is attempted.

`scripts/fractional-move-endpoints.test.mjs` executes both-seat Worker/Infantry
commands, same-cell final approach, exact queue handoff, pending/active/idle
checkpoint recovery, Stop/replacement, paid blocked-goal projection, unsafe
fractional corners, a weighted raised goal, map-bound clamping and malformed/
legacy payloads. Its finite journey deadline is 1,800 ticks with zero illegal
cell steps and unchanged health. Normal defensive idle takes ownership only
after exact arrival; the completed Move payload may then retire while the unit
remains at its requested point. Existing direct trajectory records stay
historical; the runner now measures requested-to-arrival projection and repeats
each fixed-tick geometry case twice. The native two-seat queued Move fixture
checks exact fractional arrival after actual process restart against accepted
command coordinates, including that normal idle transition. These are bounded
source/CPU witnesses; U3's remaining domain endpoint adoption and U4–U7's whole
runtime, crowd, clearance, release/deployed identity and rendered matrix stay open.

### U4 first vertical slice: measured land body contracts

This dated milestone is a consumed diagnostic contract, before production radius adoption.
The study helper and real-simulation runner measure swept circles centered on
authoritative x/z; one world unit equals one tile. Authored candidate radii are
Worker 0.18, Infantry/Spearman/Archer 0.22, Scout/Rider 0.28 and Siege Engine 0.35.
At this milestone they are hypotheses, independent of sprite bounds and the 0.56 soft
separation. Later PR385 adopts a separate authoritative profile; production never imports the study profile. Naval hull and
Sheep policies remain with their existing adapters.

The private observer records each admitted waypoint, steering, fallback,
same-cell combat and interaction-separation substep before its unchanged
position assignment. A per-tick chain must start at each actual pre-tick position
and end at its actual post-tick position, including unselected land actors;
an unobserved clamp/placement fails the study. The observer-on/off regression
compares complete live unit records, including generations, without identity
normalization. Short capsule/blocked-tile distance uses exact rectangle geometry;
negative margin below −1e−9 is penetration and tangency is allowed. Pair distance
uses each neighbor's current position in the serial executor, not future motion
or client interpolation. Contact counts count directed substeps, not unique
impacts. Static queries are bounded to at most 25 nearby cells in these cases;
this is diagnostic work, not a production/performance budget.

Six cases use trusted, production-validated initial placements, real ordinary
Move commands and disabled military attack. Both-seat corner cases retain the
exact U3 review reproduction, including its parked actors. Forest cases reuse
the existing one-row gap with opposing Infantry, Infantry/Scout from each seat,
and two 16-Infantry box formations. Workers remain idle; navigation revision
and full walkability hash must stay constant. Every case repeats in a fresh
adapter from the same full checkpoint; raw substeps/contacts, generations,
revisions, commands and input hashes must match. The 1,800-tick deadline retains
unfinished actors, and production center legality, complete observation and
unchanged health are mandatory. Existing forest cell-gap evidence is preserved.

The [summary](qa-evidence/land-body-clearance-2026-10-04/summary.json) and
[compressed raw observations](qa-evidence/land-body-clearance-2026-10-04/substeps.json.gz)
are measured at clean source `5e152a38558da79a29988ed47a21dfb206068a91`.
Both copies of all six cases match exactly; the record retains input checkpoints,
source hashes and unnormalized actor identities. This establishes bounded
geometry/replay integrity, not asynchronous-server determinism.

| Case | Arrived / ticks | Candidate static-contact substeps | Candidate body-contact substeps | Worst measured margin |
| --- | --- | --- | --- | --- |
| Fractional stone corner, each seat | 1 / 234 | 79 | 92 | Static −0.2190; pair −0.1997 |
| Opposing Infantry, one-row forest | 2 / 277 | 0 | 11 | Pair −0.4400 |
| Opposing Infantry/Scout, each Scout seat | 2 / 277 | 0 | 9 | Pair −0.5000 |
| Opposing 16+16 Infantry box formations | 32 / 365 | 0 | 5,183 | Pair −0.4400 |

All measured center substeps remain legal, health is unchanged and every actor
arrives. The two-unit opposing cases nevertheless pass through coincident
centers; the corner mover travels 19.13 world units through repeated repairs
for a sub-unit requested displacement. Completion and cell-gap passability
therefore do not establish natural movement or physical clearance. These are
fixed-tick/source geometry witnesses, with no hardware timing/capacity,
normal-game pixels or deployed acceptance claim. Presentation backing is N/A
for this internal probe; existing travel/heading/idle treatment is unchanged.

Run `node --test scripts/land-body-clearance.test.mjs` for analytic geometry,
observer equivalence, six paired real cases and finite-timeout regressions.
Run `LAND_BODY_RECORD=/tmp/land-body.json.gz LAND_BODY_SUMMARY=/tmp/land-body-summary.json node scripts/land-body-clearance-study.mjs all 1800`
to retain source-qualified raw and summarized observations. `corner`, `forest`
or a named case selects a bounded subset. Radius-zero geometry is a zero-area
control, separate from the production point/cell legality assertion.

The next movement-owned runtime slice must choose an authoritative profile and
a compatible ordinary-Move goal/segment policy together, measured against
these cases; it cannot simply add a rejection guard that strands the accepted
intent. Version-1 `moveGoalPoint` validation derives the exact point whenever
the requested cell is selected. Projecting clearance within that cell therefore
needs an explicit versioned goal policy and checkpoint subsection agreement,
not silently altering v1 coordinates. Construction/combat retain their access/
range semantics and consumer adoption; the resource owner retains dynamic
forest masks/jobs. Gates, bridges, weighted terrain, loaded native recovery,
interaction/range approaches and all-caller adoption remain U4 work. Opposing
yield/side selection, compression/reform and fairness remain U5 work. Benchmark
owner `01a101bc` retains validity reports; map `01a103e8` retains admission; CI
`01a10378` retains capture interfaces. Movement owner `01a107ba` retains runtime
adoption and actual identified-release rendered acceptance. No auth retry or
denied hosted dispatch is attempted.

### U4 bounded runtime adopter: ordinary Move static circles

`land-static-circle-v1` adopts the study's authored radii for static clearance
of ordinary single-land-unit Move and queued Move, including Worker and all
six military kinds. Every radius is below half a tile: legal cardinal cell
centers fit the existing one-row forest throat. The measured blocked corner
motivates positive footprint clearance; sprite scale and soft separation do
not set these values. This profile enforces static blocked-cell/map bounds,
with the existing separate elevation/corner guard. It does not enforce body
pairs, cliff volumes or universal movement clearance.

Private point version 2 adds only `clearanceProfile` and `arrivalPolicy` to
v1's eight fields. Clear requested circles retain the exact derived point.
An overlapping circle chooses `cell-inset`: the nearest point inside the
selected cell's radius-inset rectangle. This deliberately conservative goal
region is explicit; it does not claim the globally nearest free point.
Stop/new intent, identity and queue priority stay unchanged. Version 1 remains
readable with its original derivation; unknown versions/profiles/policies,
foreign identity and incoherent coordinates reject. Saved policy describes
the selected arrival region, not the current occupancy mask. Publication/
repair recompute the policy against live navigation; historical saves with
no point retain their cell-center contract. The exact additive schema-29
subsection is recorded with [recovery ownership](https://github.com/lbeezr/thousand-unit-skirmish/pull/361#issuecomment-5984336691).

Planner shortcuts, fractional rejoin/final legs, steering, fallback and terminal
snaps consume compatible static sweeps. A circle-unsafe center ray falls back
to the existing cardinal/weighted route, preserving its original cost/length.
Long checks visit the crossed cells and their one-cell neighborhoods rather
than a whole-map bounding rectangle; the rectangular planned320 regression
bounds occupancy queries and does not admit XL or claim a hardware budget.
Only a short monotone escape can recover an old overlapped pose: no deeper
existing penetration and no new footprint contact. This is explicit recovery,
with no persistent escape flag or new order replacing the user's intent.

The exact parked-stone-corner input now completes at `(0.22,0.22)` in eight
ticks, traveling 0.67282 units with no repair revisions or static contact,
from the preserved request `(0.001,0.001)`. The diagnostic-only predecessor
took 234 ticks/19.13095 units and admitted 79 static-contact substeps. Opposing
traffic remains unresolved: Infantry/Scout still reach coincident centers,
and the 16+16 formation still records 5,183 candidate pair-contact substeps.
The corner's remaining pair contact can be deeper during its shorter direct
approach; this slice does not claim safe body-pair avoidance or all-natural
movement. U5 retains deterministic yield/side selection, bounded neighbors,
formation compression/reform and fairness.

The [adopter summary](qa-evidence/ordinary-move-static-clearance-2026-10-04/summary.json)
and [raw paired substeps](qa-evidence/ordinary-move-static-clearance-2026-10-04/substeps.json.gz)
are measured at clean `0a320fa55989aeafce5a05cc7cd5d9441031dd4a`; all six complete
records repeat exactly from retained checkpoints. The predecessor's original
records above remain unchanged. Two additional actual-process/socket tests
accept v2 ordinary Move/queued Move on both seats, save a pending projected
waypoint, restart the real server, reclaim seats and observe the exact legal
arrival with its original generation and requested coordinates. Their initial
placement is trusted diagnostic setup, not paid unit-production acceptance.

Existing registered movement/fractional/planner/palisade tests cover analytic
sweeps, monotone recovery, bounded long queries, all seven kinds on both seats,
pending queue checkpoint restore, exact safe points, projected unsafe points,
legacy v1 upgrade during repair, Stop/replacement and a newly paid adjacent
wall that changes the arrival without losing request/queue. Every observed
selected substep must be statically clear; health and generation stay intact.
Both seats also exercise a real Move from an inherited overlapping pose:
short escape never deepens that overlap, reaches the projected point and
preserves the accepted order revision. Those inherited escape substeps are
reported as recovery, not zero-penetration starts.
Independent review at `25ef0606` found an adjacent first-leg liveness failure:
an Infantry reaches `(0.75,0.9)` through a real Move from spawn beside stone
`[1,2]×[1,2]`, then Move to `(1.5,0.5)` freezes at
`(0.8264705882,0.8592156863)` through 599 repairs in 600 ticks. All admitted
substeps remain statically clear. The route's fractional-start sweep needs
the same safe start-center rejoin even when its first cell is adjacent;
distance alone cannot admit that first approach. Eight command-only regressions
cover both seats, ordinary/queued continuation and pending-plan recovery;
two explicit center controls pass before the fix. The fixed traversal must
arrive within 30 ticks, keep every actual substep clear and introduce no
traversal repairs. Pending recovery retains its existing one-time plan rebuild.
The private study consumes production's exact geometry helpers while retaining
its separate authored candidate profile and historical evidence. Study registration
is closed by CI-owned [PR388](https://github.com/lbeezr/thousand-unit-skirmish/pull/388)
at `4f3e5afd`: all fourteen study tests execute once beside unit movement in the
existing fast/full CPU entry. Runtime regressions extend registered test paths.
After Food Tools' independent merge, the replay adapter follows the native
content-migration pipeline for old saves. Validation operates on a copy of
retained study input. A regression loads the exact pre-technology checkpoint
and preserves its input hash, generations, commands and complete motion/contact
record under the new source; it does not normalize identities or rewrite the
historical measured files.

The [preserved endpoint storyboard](qa-evidence/fractional-move-endpoints-2026-10-04/endpoint-storyboard.svg)
and [travel/heading/idle reference](qa-direct-open-ground-move-2026-10-04.md)
support the same visible treatment: accepted click, safe approach, legal arrival
then queue handoff. No art, heading, gait or velocity curve changes. These
sources and CPU trajectories are design backing, not actual gameplay frames.
Independent review and normal merge completed in
[PR385](https://github.com/lbeezr/thousand-unit-skirmish/pull/385) at `08e1df1c`;
281 integration checks and 122 merged checks, types/imports/docs and clean
1,365-file packed startup passed. The movement owner retains identified
served/deployed and ordinary-game rendered acceptance.
The [cloud capability attempt](qa-evidence/ordinary-move-static-clearance-2026-10-04/renderer-capability.json)
at that clean source is blocked: the Linux browser sandbox/profile storage
cannot start, so it produced no WebGL readback, game frame or screenshot.
No sandbox weakening, new provider service, auth retry or hosted dispatch is
attempted. CI `01a10378` retains the provisioned capture interface; movement
retains ordinary-game acceptance through it when available.
Construction/combat/resource-owned access and productive range, interaction
separation, group formation movement, naval/wildlife adapters, dynamic forest
cuts, gates/bridges and native all-caller recovery still need their own adoption.
Denied hosted dispatch and cancelled authentication remain paused.

### U5 intermediate projected-route ranking — 5 October 2026

Crowd `01a10933-c2b0` owns the small ordinary nonterminal selector correction and
[bounded evidence](qa-ordinary-crowd-steering-2026-10-05.md#intermediate-projected-route-ranking-correction).
When a closest passage point follows the actor along its route axis, raw-waypoint
progress ranks ordinary opposed-lane proposals within that specifically gated
context. Swept collision admission, necessary retreats, recovery overrides,
exact endpoints, queues and budgets remain intact; shared writes/repair stay
with core `01a107ba`, endpoints with caller/construction owners.
The unchanged seed881 native prerequisite reaches 64 distinct goals at 990
journey ticks and exits the retained waypoint phase. Variable earlier baseline
passes/failures remain recorded; no full both-seat or rendered/deployed claim is
made. Next action: author-owned reviewed source integration and clean packaging,
then unchanged larger native qualification and deployed/served/rendered proof.
The existing cloud capability/authentication blocks remain with their named
owners; no held dispatch or cancelled login is retried.

### U5 ordinary transverse rejoin — 5 October 2026

Crowd `01a10933-c2b0` owns the pure-selector correction and
[ordinary-source evidence](qa-crowd-transverse-rejoin-2026-10-05.md).
The resident/exit admission experiment is parked as unqualified; its artificial
gate waits are not ordinary-production evidence or correction targets.
Fresh unchanged `bbc8ac54` native traffic passes seat0 and fails seat1 with
0/64 arrivals,31 queues and no pending planning at the retained checkpoint.
An actual cold-replay witness identifies safe transverse raw-waypoint progress
discarded because a parallel peer's distant final goal looks opposed to the
old route axis. The narrow per-claimant correction preserves that progress only
for an intermediate waypoint already passed along the explicit route axis.
The broader exemption regressed forest/bridge/gate groups and is rejected.

All 47 standalone controls and 13 existing physical journeys pass for the narrow
guard; its 160-tick ordinary-input replay preserves 64 inactive actors and admits
6,826 selected writes with zero terrain/body contacts. Group service remains
mixed and large native completion is open. Core `01a107ba` retains shared
writes/repair/Worker economy; caller/construction retain endpoints. Art is N/A.
The delivery PR owns exact-head review, regressions, clean pack and normal source
merge; served/deployed/rendered evidence is separate. The unchanged fixed-tick
wall/gate controls pass 7/8; the remaining queued-wall case reaches 54/64 versus
the original selector's 0/64, still below the unchanged 2,700-tick completion
contract. Retained actor 120 waits at an exact goal occupied by idle Worker 68;
caller/construction `01a10933-e913` owns that endpoint/access dependency and core
`01a107ba` retains shared admission/repair. Preserve the idle pose. The retained
crowd classification now finds eight progressing actors and actor 121
oscillating beside actor 120; the direct projected-target step is body-blocked by
actor 120 in all twenty retained calls. This does not qualify an independent cause.
Caller `01a10933-e913` owns the single queued-first palisade real-command chronology
regression; current endpoint queries deliberately omit future queued goals and
the exact activation chronology remains unknown. Crowd is **waiting on that
dependency or a new independent ordinary witness**, with no runtime increment
ready. Do not expand future claims, replace goals or move parked actors.
Existing capture/authentication
blocks retain their owners and next actions; no held dispatch or login retry.

### U5 crowd owner reservation — 4 October 2026

5 October source qualification: [PR400](https://github.com/lbeezr/thousand-unit-skirmish/pull/400)
consumes the [agreed hooks](https://github.com/lbeezr/thousand-unit-skirmish/pull/400#issuecomment-5986553571).
Clean `1fa2c46d`, containing fresh main `51c3085f`, completes both unchanged
64-unit paid-gate returns at 1,141/2,600 ticks with zero terrain/body contacts
across 141,567 selected substeps. Actor113's fourteen accepted static repairs
were traced to a local detour stranding its route at the closed gate corner.
A bounded terrain-continuation preview fixes that selection: actor113 reaches
its first goal at 2,251 and returns at 2,555 with zero repairs. It leaves the
original static handoffs, shared admissions and accepted goals/queues intact.
The [exact source checkpoint](qa-evidence/ordinary-crowd-steering-2026-10-05/controller-continuation/terrain-detour-checkpoint.json)
and [QA record](qa-ordinary-crowd-steering-2026-10-05.md) retain the historical
failures, retired recovery variants, full inputs/finals and independent review.
All 152 registered movement/body/controller/journey checks, 63 Follow/cold/queue
controls and 49 independent focused controls pass. The clean 1,386-file pack
and local served HTTP scenario pass. PR400 merged at `8c28773c`, whose runtime
hashes match the qualification; its 49 focused checks and clean pack also pass.
The [delivery receipt](qa-evidence/ordinary-crowd-steering-2026-10-05/controller-continuation/source-delivery.json)
records staging terminal SUCCESS at 05:13:04 UTC for that exact source and the distinct served-health block
(cloud outbound CONNECT proxy 403; injected auth absent). Owner remains
`01a10933-c2b0`; next action is served identity and ordinary rendered
verification through CI/capture owner `01a10378`. No open interface
approval or parent merge gate remains. The recorded browser sandbox/storage
failure produced zero frames and stays separate from source qualification.
Worker/combat/naval/wildlife movement remains with its existing owners; this
slice adopts ordinary military Move only. Added preview/query work stays
bounded at eight detour probes and 64 parked-waypoint observations. It never
claims physical clearance from cell joins, point insets or soft separation.

Crowd owner `01a10933-c2b0-70f1-991d-761518eb5010` reserves
`src/unit-crowd-steering.mjs` and its own focused module/ordinary-journey tests.
Core owner `01a107ba` retains [PR395](https://github.com/lbeezr/thousand-unit-skirmish/pull/395)
Worker economy clearance and shared planner/executor contracts; construction
owner `01a10933-e913-766b-b5de-3aa5a17c7038` retains paid construction travel.
The [exact hook proposal](https://github.com/lbeezr/thousand-unit-skirmish/pull/395#issuecomment-5985549187)
requests a bounded ordinary-Move branch in `getMoveVector`, current serial-body
queries and a crowd-wait break. Shared position admissions remain core-owned;
the recorded agreement was resolved before integration. Further shared writer
changes require a concrete allocation with that owner.

Reuse the existing forest-gap maps and retained land-body-clearance inputs.
The first bounded policy proposes only the moving actor's candidate, using the
existing authored static profile and exact swept pair geometry. Fixed heading/
neighbor budgets, a stable right-hand preference and exact inset candidates
address the mixed-circle tangent fit; cell geometry proposes candidates but
never substitutes for terrain/static/body admission. Parked/inactive neighbors,
accepted order priority, Stop and selected final/group goals remain intact.
Crowd waits do not classify a static route as unreachable or generate repair
storms. Finite opposing/group deadlines, repair/progress/fairness records and
actual physical contacts remain explicit acceptance requirements.

The initial reservation passed twelve standalone module checks for sweeps, monotone inherited-overlap
escape, terminal contact, bounded overflow, both serial orders and mixed-circle
throat progress. These analytic controls are not the real-game journey proof.
The 14 existing real land-body study regressions pass before the consumer;
historical penetration records remain unchanged. The qualified integrated
journeys and current verification next step are recorded above. Crowd retains
separate identified-release deployment/ordinary rendered proof;
CI `01a10378` supplies its existing capture interface. No new benchmark,
map-admission change, auth retry, denied dispatch or browser-security change.

### U5 forward-yield continuation — 5 October 2026

Crowd owner `01a10933-c2b0` retains the narrow ordinary-Move correction in
[the forward-yield record](qa-crowd-forward-yield-2026-10-05.md). Its retained
source witnesses prove an admitted safe oblique step was discarded by follower
arbitration and the three original paid-house choke actors can leave that
deadlock within the unchanged 1,000-tick deadline. The exemption requires every
queried body to be an active same-segment follower behind the mover; physical
admission, selected goals/queues and Stop priority stay intact. A broader
variant regressed the 64-unit gate and was retired; the narrower candidate
preserves both 2,700-tick gate controls. Exact-head independent review and checks
belong to its delivery PR, separately from served/rendered proof.

PR442's pending-aware loops are integrated without relaxing arrival assertions;
the full paid-house batch still has runtime failures. The same record identifies
the pending lifecycle and parked-builder endpoint contracts by source location.
Core `01a107ba` and construction `01a10933-e913` retain access/repair coordination;
crowd's next action is a retained remaining-final-approach witness and a bounded
reviewed fix. No neighbor shove, endpoint overlap or silent goal replacement is
an acceptable test fix. CI `01a10378` retains the next fresh full CPU attempt and
supported served/rendered interface. No private archive access or publication.

### U5 native wall seat-1 diagnosis — 5 October 2026

Crowd owner `01a10933-c2b0` retains the separate
[native wall diagnosis](qa-native-wall-seat1-2026-10-05.md) at `252abb29`.
The unchanged public native program completes seat 0 and times out seat 1
under its original 60-second/all-64 physical-arrival contract. At the last
checkpoint, 63 unfinished actors are near the central choke: 28 first-leg
westbound actors and 35 eastbound return actors. No pending planning explains
the stop. A separate live observer records no lease/contour grants or overflow;
the existing parked/single-peer recovery cannot cover that moving-only knot.
A bounded restored-input trace preserves 72 inactive actors and has zero
contacts across 6,496 selected substeps. This does not qualify native completion.

Both a generalized lease and a current-cell lane variant failed the retained
choke; the lane variant also regressed the seat-1 gate. Both are retired and
no runtime correction is claimed. Next crowd scope is a retained source witness
separating no physically admitted step from priority arbitration discarding a
safe candidate, followed by a reviewed bounded correction and unchanged
both-seat/gate/forest/bridge controls. The paid-house final-approach work remains
open alongside this narrow native slice. Construction `01a10933-e913` and core
`01a107ba` separately own Worker 68 occupying actor 120's accepted queued endpoint
`(18.5, 1.5)`; crowd does not duplicate that access contract or shove the builder.
Original deadlines/endpoints, Stop priority, shared admissions and standing
author-owned merge authority remain intact. Source/pack/provider/served/render
proof stays separate, with the existing CI/capture interface and no private
archive access/publication or denied capability/auth retries.

### U5 construction endpoint availability — agreed bounded interface

The [core/caller agreement](https://github.com/lbeezr/thousand-unit-skirmish/pull/443#issuecomment-5989678024)
keeps already parked conflicts as safe waits: preserve the military's exact
point/cell, revision and queue; only the builder's own accepted movement or work
continuation moves it. Core owns
[military-endpoint-availability.mjs](../src/simulation/movement/military-endpoint-availability.mjs);
construction owner `01a10933-e913` consumes it in access selection, actual
work-position admission and a separate dynamic-occupancy retry increment.

`createOrdinaryMilitaryEndpointAvailability({units,width,height,maxUnits})`
takes one bounded roster census per command or synchronous construction phase.
`check({team,position,radius})` returns `{status,visited}`, with `status` equal to
`available`, `blocked` or `deferred`. It reserves current same-team ordinary land
military accepted/pending goals, using the validated fractional point or the
historical/formation cell center and existing authored physical radii. Pending
intent is already durable before route publication. A stale point cannot become
a center; incomplete metadata/census and the 64-endpoint query limit defer.
Queries visit at most nine local buckets, and scalar diagnostics count census,
endpoints, queries, buckets, endpoint visits and deferrals. No route/queue scan,
actor mutation, saved flag, global registry, planner change or navigation search.
The snapshot must be rebuilt after another operation or cold recovery.

The agreed construction consumer must retain the paid target/repair flag,
remembered sites/area and queue
when access is occupied or deferred, including initial admission with no safe
cell. Its extension of existing transient retries must check at most once per
second, consume no static-failure attempts and enqueue the existing guarded
repair service only after a safe candidate exists. Endpoint release must resume
work without a navigation revision change. Actual work poses are admitted before
progress/completion, including completion before approach exhaustion. Stop,
replacement, death, completion and cold recovery invalidate/rebuild transient
state. Core does not implement those construction consumers in this query slice.
The separately reviewed [construction consumer](qa-construction-access-adoption-2026-10-05.md)
now adopts this interface in default host access selection, actual work-pose
admission and bounded transient retries; the query itself remains unchanged.

The registered query regressions cover both seats, fractional/inset/cell goals,
pending intent, authored radii, stale identity, cancellation/cold reconstruction,
no payload reads and fail-closed census/query limits. A full-circle oracle checks
3,000 seeded queries against six live 2,000-endpoint rosters on small/160/256 and
all three planned320 shapes. This proves the local query contract only; it is not
an admitted XL match, whole-route body avoidance, paid-house full-arrival pass,
rendered acceptance or consumer-GPU capacity. Caller [PR444](https://github.com/lbeezr/thousand-unit-skirmish/pull/444)
owns the separate real-command parked-endpoint audit; crowd retains final
approach/yield work and original arrival assertions/deadlines stay intact.

### U5 next queued leg and active construction parking — 5 October 2026

The [default construction consumer](qa-construction-next-leg-adoption-2026-10-05.md) now retains last-site completion/egress intent, selects current/next-clear final parking through the existing planner, and registers the actual queued-first wall regression plus both-seat cold/replacement journeys. Productive work remains independent; core helpers and crowd steering retain their ownership. Exact release/served evidence belongs in its PR; rendered acceptance remains open.

The construction caller measured Worker 68 parked at `(18.5,1.5)` on tick 1571,
631 ticks before actor 120's accepted queued return became current on tick 2202.
The current-only query correctly admitted that future point before activation;
its 18 regressions and the caller's cost, queue, exact-goal and idle-pose controls
passed. This is a separate final-parking policy gap. The caller supplied the
real-command chronology at `6ee1cce4`, with simulation bytes matching `487a54fa31d`;
the primitive tests below do not reproduce that native journey.

Core owns the separate opt-in `createNextQueuedMilitaryEndpointClaims` and
`decideActiveConstructionParking` exports in the same endpoint module, its
[registered primitive regressions](../scripts/military-next-leg-claims-journeys.mjs),
and this subsection. Construction `01a10933-e913` owns default host consumption,
active completion/egress intent, existing escape/retry behavior, the real-command
regression, packaging and rendered acceptance. Crowd `01a10933-c2b0` keeps its
disjoint arbitration/forward-progress work. The existing current-only export
and productive work/cost admission stay unchanged.

```js
const scope = Object.freeze({ tick: tickNumber, navigationRevision, epoch: movePlanningEpoch });
const next = createNextQueuedMilitaryEndpointClaims({
  units, width: MAP_WIDTH, height: MAP_HEIGHT, maxUnits: MAX_UNITS,
  maxQueuedWaypoints: MAX_QUEUED_WAYPOINTS, isWalkable, scope
});
try {
  const nextStatus = next.check({ scope, team: worker.team,
    position: parkingPose, radius: .18 }).status;
  const decision = decideActiveConstructionParking({
    activeConstruction: hasActiveCompletionIntent,
    currentStatus, nextStatus, escapeAvailable: hasIndependentlyAdmittedOwnEscape
  });
  // park: finish/clear intent only after existing physical/current admissions.
  // escape: keep active intent and execute the Worker's own safe continuation.
  // wait: retain active completion/egress intent and existing bounded retry.
  // inactive: preserve the existing pose; this policy grants no displacement.
} finally { next.close(); }
```

One roster census reads only `queuedWaypoints[0]` from eligible living ordinary
land military, never a route or later leg; queue length is bounded by the host's
existing maximum of eight. Same-team claims use authored radii and the existing
activation-time fractional projection at this navigation revision. Older
accepted queued-point revisions are valid; generation, request and original
goal remain unchanged. AttackMove heads and nonordinary current intent are
outside this narrow policy. Statically covered heads increment
`relocationPending` without guessing the host's replacement endpoint. Queries
return `{status,visited}` with `available`, `claimed` or `deferred`, visiting at
most nine buckets and 64 claims. Scalar diagnostics count census/head reads,
claims, static probes, pending relocation, queries, bucket/claim visits and
deferrals. No new order, checkpoint, route grant, global registry or actor write.

The view belongs to one synchronous command/construction operation in which
military intent, roster and navigation stay stable. Pass the identical newly
frozen scope to each query and close in `finally`; rebuild after another command,
phase, queue/intent mutation, navigation revision, reset or cold restore. A
different scope, closed view, roster-length change, incomplete input or changed
encountered actor/head/point defers. These local guards do **not** detect a new
claim outside the queried buckets if a caller incorrectly reuses the old scope;
the view is an operation snapshot, not a live reservation service.

Use the view only to choose an active builder's final parking pose. It must not
veto productive work or traversal across future claims. Prefer a pose admitted
by both current and next-leg queries and all existing physical guards. If all
preferred poses are claimed/deferred, continue work at its normal rate/cost and
keep active completion/egress intent until the Worker can take its own
independently admitted safe escape or existing bounded retry. Do not clear the
last site into a claimed idle pose, relocate the military goal, push an idle or
Stop/Hold actor, or reserve every future goal. `escapeAvailable` is proof supplied
by the caller's existing movement admission; the decision helper cannot grant
motion. A physically sealed site remains an active wait; no unconditional
finite-escape guarantee is claimed.

The 45 primitive regressions plus the unchanged 18 current-query controls cover
both seats, head-only reads, fractional activation, cancellation/rebuild at the
same navigation revision, identity/scope/close deferral, the visit limit and all
small/160/256/planned320 index shapes. An all-preferred-poses-claimed control
keeps productive work admission available and selects active wait/own escape.
This source contract needs independent review before caller adoption. Default
integration must pass the retained construction-queued-first-wall journey,
exact goals/queue/costs, idle-pose immobility, productive completion, both-seat
cold recovery and blocked/released escape controls. Those native, served and
normal rendered outcomes remain with the construction owner; these primitive
checks establish neither admitted320 play nor consumer-GPU capacity.

### Forest cell-gap characterization — 4 October 2026

The bounded experiment measures the current cell-based behavior before U4/U5
physical-clearance work. The [current summary](qa-evidence/forest-gap-2026-10-04/group-summary.json)
and [compressed raw record](qa-evidence/forest-gap-2026-10-04/group-replay.json.gz) retain
42 scenarios, each repeated from the same validated initial checkpoint at clean
source `c4ad43b7e2ac8e810c1a462d085b324e64182183`, including Worker route shortening
and [forest group jobs](qa-forest-group-jobs-2026-10-04.md). All 84 runs match their paired route/motion/harvest records;
this establishes repeatability of the fixed-tick adapter inputs, not the whole
asynchronous server. Actual actor identities remain intact without normalization.
The forest-gap experiment owner retains this fixture/evidence; movement owner
`01a107ba` consumes the measurements for U4/U5 and map owner `01a103e8` retains
map admission. No live collision, map catalog, art or CI-policy change is included.

The authored flat 64×48 map uses seed 881 and forest rectangles at
`(column28,row4,width8,height20)` and `(column28,row24+g,width8,height20−g)`.
Four-cell north/south bypasses remain open. Each seat has 16 Infantry plus four
Workers in the primary cases; box, line and column formations cross separately
from each seat. Additional one/64-Infantry box cases bound traffic. Ordinary Move
stages the army, and reserved exit goals lie at least four columns beyond the
belt. Enemy homes/idle rosters are outside the route region; unchanged unit health
rules out combat as the cause of missing arrivals. The table ranges over both
seats and three formations, using logical ticks from the crossing order.

| Gap rows | Forest cells / Wood (change from closed) | Mean planned distance range | First / last completed belt crossing | All at unique assigned goals |
| --- | --- | --- | --- | --- |
| 0 | 320 / 1,920 (0) | 63.50–65.25 | 387–399 / 453–470 | 797–849 ticks |
| 1 | 312 / 1,872 (−48) | 25.76–28.26 | 168–179 / 228–246 | 347–387 ticks |
| 2 | 304 / 1,824 (−96) | 25.52–27.65 | 168–179 / 226–240 | 325–385 ticks |
| 4 | 288 / 1,728 (−192) | 25.52–27.18 | 168–181 / 214–240 | 325–385 ticks |

Every closed-belt route uses a north/south bypass; every open-gap route uses the
gap. All actors arrive and reform at unique, unchanged goals before the finite
1,800-tick deadline, with zero illegal cell steps or unfinished actors. The
one/64-Infantry controls also complete (289–751 / 403–825 ticks respectively).
No-progress is a 0.05-world-unit remaining-route improvement observation; a
published replacement route starts a new window, and an empty pending route
cannot masquerade as arrival. Maximum no-progress within these windows is one
tick. Cumulative ticks without that improvement before belt crossing reach
0/10/16 for the one/16/64-Infantry groups; these are queue observations, not
physical throughput or hardware timings. Raw records retain per-actor distance,
crossing, route-publication and pending/timeout fields.

For both seats, a single added plug at `(column31,row24)` blocks the one-row gap.
Normal Gather anchors the authored group: the Worker first selects the tied
northern frontier cell 1502/1504 (column30/32,row23), then the plug cell 1567.
Those two cuts change navigation revision 0→2 and reduce the 16-Infantry mean
planned route from 64 to 27 world units. The after-route measures both cleared
cells, not an isolated plug removal. A checkpoint with two Wood carried is
validated and restored into a fresh fixed-tick adapter.
Original/restored units and forest stocks match while harvesting; bank balances
match through depletion and the same Stop/Return orders. At plug clearance each
branch has banked ten and carries two Wood. Both ultimately deliver exactly
12 Wood (500→512), finish with zero cargo, and retain unit health. The exact
cleared set and unchanged stock elsewhere are checked in both branches; stock
draw equals banked plus carried Wood at every compared tick. The plug map starts
with 313 cells/1,878 Wood and ends with 311 live cells/1,866 remaining Wood.
This proves adapter checkpoint conservation, not a native process/socket restart.

The earlier [summary](qa-evidence/forest-gap-2026-10-04/summary.json) and
[raw record](qa-evidence/forest-gap-2026-10-04/replay.json.gz) at clean `d914317f`
remain historical: before group jobs, the same Gather cleared only the plug,
revision 0→1, and banked six Wood. Its primary/control route aggregates match the
current record. The old six-Wood witness failed against group jobs as expected;
the fixture was updated to observe actual selection, without changing live rules.

Run `node --test scripts/forest-gap.test.mjs` for the 15 focused regressions, or
`FOREST_GAP_RECORD=/tmp/forest-gap.json.gz node scripts/forest-gap-characterization.mjs all 2 1800`
for the full bounded record (`small` selects six scenarios). The runner checks
source identity at both ends and retains failures; the experiment is opt-in.
Ninety-three focused forest, final-approach, replay, arrival, movement, segment and
Worker route tests pass at the measured code head. Pilot data with fresh random actor identities,
combat near enemy homes or the superseded pending-route observation is excluded
from this table; no performance optimization is inferred from those comparisons.

Current forests occupy whole blocked cells with six Wood per cell. Unit-center
occupancy and 0.56 soft separation do not define a body radius or swept hull.
Canopy density, species and visual scale do not change navigation. One open row
does not establish a one-unit physical throat or a cavalry clearance. Proposed
permeable/tight/dense forest treatments still need explicit swept clearance,
opposing/mixed-speed traffic, actual ordinary-game appearance and their own
resource-quantity controls. Forest-job/frontier fixes and their ordinary-game
acceptance remain with the [forest owner](qa-forest-group-jobs-2026-10-04.md);
2,000-unit hardware/rendered capacity remains U7 work.
Tree-variety owner
`01a107c8-d1d5-7113-8371-57b914ac502d` retains model/appearance work. Building-rotation
owner `01a107c9-6a7d-7534-b592-ef8d18cd0001` retains orientation/ghost preview;
any doorway/egress goal region must use the same authoritative access policy,
with its exact footprint/consumer boundary agreed before movement adoption.

### Measurable acceptance and evidence limits

For every caller, run both seats, accepted/rejected endpoints, empty routes,
dynamic obstruction, Stop/replacement, queue continuation and pending/active/idle
restart. Assert zero illegal terrain/corner/hull crossings, wrong-target work,
stale route commits and silent intent loss. Exact final-point tolerance is 0.02
world units where the policy promises a point; target arrival must also satisfy
its actual edge/range predicate. Open flat unobstructed single-unit travel should
be within 1% of its valid straight segment, separately retaining original weighted
cost. Crowded/weighted routes use their own baseline, not that straight-line gate.

Repeat fixed-seed command/tick inputs twice; compare committed goal, route and
motion hashes including interruptions/recovery. Explicitly retain callback-intake
differences until U6; do not label today's whole runtime deterministic. Record
first/last route availability, queue age, p50/p95/p99/max navigation and whole-tick
time, expansions/overshoot, cache hit/bytes, distance/turns, no-progress windows,
repair attempts and choke throughput. A 30-tick no-progress window is an observation
threshold, not a universal failure deadline; the retained completed 996-unit
chokes have long queues. Every eventual-arrival fixture names its finite deadline
and keeps timed-out actors/goals visible. Existing 30 Hz / 33.333 ms qualification
and retained failures remain separate from diagnostic harness limits.

Use 16×17/lab and representative Tiny160, Large256, then experimental planned320;
exercise 100/500/1,000/2,000 total actors with distributed armies, opposing narrow
streams, mixed-speed formations and long economy/combat/naval soaks. A primitive
320 index test does not admit a map or validate 2,000 actors on it. Benchmark
comparisons require the benchmark owner's exact source/workload/resource-validity
record. Software-render measurements do not establish consumer GPU capacity.

[PR #323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323) and hosted
[run 37215311854](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37215311854)
at `52e19ec0` establish bounded packed-game cloud capture, replacing the earlier
blanket sandbox blocker for that supported path. They do not establish all-feature
movement acceptance. U7 needs actual before/after normal-game movement sequences
with map, viewport, camera, applied orders/goals/positions, PNG/replay identity,
backend and errors, including economy, combat, crowded routes and water.
Source CPU, clean release digest/inclusion, exact deployed identity and actual
ordinary-game pixels are four separate records. Movement retains missing gameplay
acceptance; CI retains capture interfaces. No Mac dependency, new services,
credentials, security/branch-policy change, paid generation or release of art holds.

### Research used to choose the boundary

The parent supplied a primary-source audit alongside the native caller findings.
[AoE IV's GDC session](https://www.gdcvault.com/play/1027659/Pathing-in-Age-of-Empires)
describes layered flow fields, hierarchical A* and steering. The developer's
[Battle Aces discussion](https://www.reddit.com/r/BattleAces/comments/1fjdhyq/pathing_in_battle_aces_part_2_by_senior_gameplay/)
describes individual routing and local push rules, including the complexities of
mixed-speed formations. These support the inference that consistent contracts
matter more than adopting one algorithm everywhere. The parent also identified
0 A.D. range-shaped goals, OpenRA wait/replan and delivery policies, Recoil route
sharing/invalidation and the Supreme Commander 2 flow-tile chapter as useful
follow-up references. Inspect and pin their mutable implementation links before
using them for a later patch. No licensed implementation is copied. Hierarchy,
navmesh, ORCA, GPU and neural routing remain evidence-driven options, not prerequisites.

### U4 bounded Worker economy adopter

The resource owner [confirmed the exact interface](https://github.com/lbeezr/thousand-unit-skirmish/pull/330#issuecomment-5985107521)
after ordinary Move merged at `08e1df1c`. Command-only spawn Move to `(0.79,0.95)`
beside stone `[1,2]×[1,2]`, then Gather Food at `(4.5,0.5)`, exposes the remaining
consumer gap: each seat admits thirteen candidate static-contact substeps,
worst margin −0.10508, while depositing the correct ten Food. The start is
body-clear. Six registered live/approach-recovery/carrying-recovery journeys
fail at the first unsafe steering substep before adoption.

Movement owns only `workerFlowPath` / `applyWorkerFlowRoute` geometry,
the existing land admissions and Worker gathering separation. Economy retains
selected goals, raw drop-off scoring, jobs/frontiers/visibility, rates/receipts,
typed cargo/deposit/resumption and forest masks. Cardinal/global flow, Sheep,
construction reach, weapon range and naval movement stay outside this slice.
The existing static profile supplies radius 0.18. Live Worker activation derives
from existing to-node/to-base/gathering intent, including node-free positive-cargo
Return; interrupted, dead, water, construction and combat states do not activate
the economy policy. No persisted flag, checkpoint version or entropy change.

The future economy footprint checks route selection even when Return is planned
on a stopped clone. Body-unsafe flat reduction keeps the existing cardinal path;
an unsafe fractional first leg rejoins its start center, including adjacent legs.
The selected raw tail, original route length/cost and candidate scoring stay
upstream of execution reduction/rejoin. Planner repair, terminal/steering/fallback
and productive gathering separation use the same static predicate with the
existing short monotone legacy escape. Interaction ranges stay unchanged.

Both seats require zero new static penetration on every actual observed substep,
bounded approach/return, exactly one ten-Food credit and fresh productive
resumption. Untouched saves recover approach and carrying states exactly.
Food/Wood/Stone partial cargo survives Stop, manual/queued replacement,
foreign/stale rejection and node-free Return through queued recovery; stock,
bank and typed cargo conserve. Actual multi-Worker gathering separation must
move safely and retain positive work receipts. Weighted/nonflat routes, paid
wall/Farm access and dynamically cut forest controls check physical steps.
Legacy overlapped poses are explicitly trusted fixtures: only monotone escape
is accepted, with no new contact, teleport or repair loop. Existing native
typed/sub-cent delivery scenarios remain separate process witnesses.

This is static land economy adoption, not body-pair avoidance, physical spawn/
evacuation policy, every interaction domain or universal movement completion.
Presentation reuses the preserved travel/heading/idle reference; no art/gait or
velocity treatment changes. Identified release/deployment and actual ordinary-game
pixels retain movement ownership through the existing capture interface. The
blocked browser capability and denied hosted dispatch stay paused.

Independent review of PR395 at `72ac6397` also exercises the registered extracted
Return/Storehouse/Mill policy fixtures. Fourteen tests fail because their shared
`workerFlowRouteBindings` omitted the new production clearance dependencies;
its positive cell centers also disagree with the centered physical grid. Reuse
the real movement exports supplied by the separately merged construction-fixture
[PR397](https://github.com/lbeezr/thousand-unit-skirmish/pull/397), then center the
shared 16×16 geometry and retain every existing economy assertion. An additional
real-helper control checks all cell centers, rejects the stone-grazing shortcut,
preserves its raw path and still reduces the open route. No runtime predicate is
weakened to satisfy a fixture. Re-review approved `dcc0d766`; fresh-main
integration merged PR395 at `452d043f`. Exact merged source passed 365 focused
checks, three native journeys, types/imports/docs, clean packaging and startup
smoke. The clean 1,371-file digest is
`sha256:4938e2be3e2d3d4e1e24fd0b6b40bcfd3ff88a2d0bfcd32ba072234bc2222388`.
Those receipts are source/process/package evidence, with served/pixels still open.

### Shared selected-route start rejoin — 5 October 2026

At `bd7f2915`, ordinary Move has an inline fractional-start rejoin and Worker
economy has its radius-specific reduction/publication. Neither is a generic
post-selection combat adapter. Shared owner `01a107ba` supplies only
`rejoinSelectedUnitRoute` in `src/unit-movement.mjs` and consumes it in ordinary
Move's existing `applyPlannedMoveAssignment` subsection. The
[caller API](https://github.com/lbeezr/thousand-unit-skirmish/pull/405#issuecomment-5986027786)
is allocated to combat caller `01a10933-e913` after its unchanged weapon-range,
stance-travel and retained-waypoint policy selects/truncates an approach.

The pure helper accepts the selected route, actual position, explicit radius,
start cell, first physical point, dimensions/occupancy/center conversion, a
caller-supplied terrain-rejoin decision and optional `acceptPrefix(center, cell)`.
It returns the original route with `unchanged`, a shallow route copy with only
`[startCell, ...path]` and `prefixed`, or the untouched route with `rejected` if
geometry is malformed or the caller rejects the synthesized prefix. Those
rejoin outcomes are transient and separate from route status. Empty/null paths
and explicit non-ready route outcomes remain unchanged; they do not become
arrival. Metadata, selected tail, original cost/length, identity, and every
retained leading/anti-reversal waypoint survive. No whole-route reduction,
target/order/objective publication or persisted field.

Ordinary Move keeps its existing distant-leg terrain rule, adjacent body rule,
fractional final-center handling and executor/recovery guards. Registered tests
cover all explicit profile radii, immutable metadata/path, policy rejection,
null/empty/failure distinctions and malformed geometry. Retained real-command
corner/adjacent-leg liveness, queue/restart, weighted routes, Worker/construction
and target-free AttackMove regressions establish the bounded consumer parity.
Combat acquisition, weapon range/damage, `getUnitAttackPath`/
`boundedAutomaticApproach`, global attack/Sheep flows and crowd-owned steering/
wait hooks remain outside this slice. Existing endpoint/travel storyboards are
unchanged design backing. Source/release/deployment/rendered acceptance stay
separate. Independent review approved `4dcfb968`; fresh-main integration at
`a6b74cd0` was byte-identical for the five owned non-server files and publisher.
Normal merge [PR411](https://github.com/lbeezr/thousand-unit-skirmish/pull/411)
at `93d45c73` passed 393 focused checks, types/imports/docs, native both-seat
cold restart and clean packed startup. The 1,381-file package digest is
`sha256:2c9acd9801b20a6769ea11cb568be15845268b229df8131c7b74c38752f71fc3`.
The [merged API handoff](https://github.com/lbeezr/thousand-unit-skirmish/pull/410#issuecomment-5986257931)
serves PR410; source adoption does not close deployed or ordinary rendered acceptance.

### Bounded live publication increment

The map owner handed off this dependency after checkpoint PR407/414 reached
clean `f2931a41`: XL-only saves have a 32 MiB file/parser/state envelope and
1,048,576 route entries across active/resume/herd arrays, each at most `cellCount`.
Legacy ≤256 saves remain compatible; ordinary 320 is still closed. The
[accounting agreement](https://github.com/lbeezr/thousand-unit-skirmish/pull/407#issuecomment-5986579976)
counts every saved field at its full length, including aliases and exhausted
routes, while physically distinct in-flight arrays have a separate staging bound.

The read-only [publisher characterization](qa-evidence/live-publication-2026-10-05/publication.json)
executes the actual publisher and actual checkpoint path leaf at clean
`f2931a41`. At 16×17, 64×48, 160², 256² and both rectangular/square planned320
dimensions, a synthetic `cellCount−1` selected array gains one rejoin and fits;
a `cellCount` array gains one and exceeds the saved path leaf. All fourteen
preserve the selected tail, raw length/cost, revision, goal and site ID. Repeated
cells deliberately exercise the leaf envelope; they are not legitimate planner
paths, full checkpoints, admitted 320 maps or a gameplay/capacity failure witness.
Repeat from the repository root with
`node docs/qa-evidence/live-publication-2026-10-05/publication.mjs /tmp/publication.json`.

The first consumed runtime slice stays in `applyPlannedMoveAssignment`, shared
rejoin and the existing planner service. For dimensions above 256, one synchronous
goal group takes a metadata-only census bounded by 2,000 actors and 128 nodes:
at most 4,128 saved path-field visits, without indexing stored route cells.
Replacement credits only the replaced active field; its resume/other aliases
remain charged. Base route length and predicted final-center/rejoin growth are
checked together before execution copies or projected endpoint publication.
Selected tails, original weighted costs/raw lengths and accepted goals/jobs
remain intact. The ledger is discarded with the synchronous group; there is no
global mutable quota registry or saved ledger field.

Per selected publication, physically distinct raw, optional final-center and
optional rejoin arrays total at most `3*cellCount` entries, separately from live
saved fields. The existing resident search workspace has nine 32-bit and one
16-bit grid arrays (`38*cellCount` bytes); direct search can stage two candidates
of at most `cellCount−1` entries, and A* reverses its one selected array in place.
These are source slot/workspace bounds, not GC, total heap/RSS or capacity
measurements. Prior assignees' published arrays become live fields and are
charged in the same ledger; no queued assignment retains a selected payload
after an attempt. Single-search latency and resumability remain separate U6 work.

Refused assignments retain only existing actor/goal/revision references and
bounded scalar outcomes. The job reports `WAITING` once for explicit commands,
rotates behind other ready work, and retries no earlier than the next authoritative
tick. A blocked goal rotates behind later goals and original start groups; actual
poses, current navigation and original requested points are recomputed at retry.
The scheduler scans at most eight queued job records per selection and keeps
callback retries out of a busy loop. Stop/replacement, actor/generation and epoch
guards cancel stale work. Completed private planning samples disclose deferrals
and maximum staged entries; silent internal jobs retain their counters without
sending player notices. Pending saves rebuild through the existing durable goal
and repair intake, consuming the pending-goal correction in PR422. No transient
budget state is added to units or the checkpoint schema.

Registered controls cover quota−1/quota/quota+1, alias/resume/herd accounting,
per-path growth, no selected payload read on base refusal/no execution copy on
growth refusal, preserved points/jobs, fair release/retry, cancellation and the
actual restore continuation tail. The pressure arrays are metadata-only synthetic
envelopes; they do not qualify a legitimate XL match or full save/recovery through
the unchanged dimension gate. Six new native both-seat queued fractional Move
journeys validate full serialized checkpoints and restore separate modules at
16×17, 160² and 256²; existing 64/256-unit planner journeys retain crowd coverage
on their disclosed 96×64 fixtures. These are CPU/source compatibility witnesses,
not complete match/crowd/playability qualification at each grid size.
The adapted characterization reporter exposes XL
deferrals and leaves its retained `f2931a41` baseline unchanged.

Independent review approved `fe19c8b9`; fresh-main integration and normal
[PR425](https://github.com/lbeezr/thousand-unit-skirmish/pull/425) merge at
`f08ceb91` passed 359 focused checks, types/imports/docs, 4,032 complete publisher
parity cases and the boundary reporter. Exact integration also passed actual
persistent process restarts and packed-host checks. The fresh clean merged
1,383-file release digest is
`sha256:ef5fd1c1d578b5dbfae66893d428a5656e86c80a6686608ede664328ca99565b`.

This covers the sliced A* publisher family only. Worker economy, direct combat,
resume transfers, naval and wildlife retention writers still need vertical
adopters before any all-writer aggregate claim. Exhausted route retirement must
preserve resume/queue references and durable endpoints; this slice relies on
actual replacement/Stop/caller release rather than inventing retirement.
Map owns final 320 admission/performance/playability; caller pursuit, crowd PR400,
checkpoint and match-ending hooks remain disjoint. Source/native/package,
served identity and real rendered acceptance stay separate. Art backing N/A.

### Local-detour retention adopter

The next shared owner slice consumes the same ledger around the existing land
physical phase's sole retained-route growth: the legacy stationary-Worker local
detour splice. One synchronous XL census charges full active/resume/herd saved
fields; the predicted splice length includes consumed prefixes and is reserved
before the full execution copy/spread. A published copy retains the selected
suffix, tail, path index, accepted goal/point, revision and queue, and leaves shared
assignees and the parked blocker untouched. A refused proposal stops that actor's
remaining movement for this tick with its existing path/reference/pose/intent;
the existing next tick retries from current state. Stop/Hold still cancel normally.
No saved retry flag, planner job, queue or new tick hook is introduced.

The phase only grows paths at that splice. Its other route clears and resume
transfers reduce retained entries; the scalar ledger can conservatively retain
their old charge until the next phase census. This explicitly permits a one-tick
delay in reusing a same-phase release. No asynchronous work runs inside the phase.
The local search remains at most 25 cells with at most 24 detour waypoints and two
replaced entries. New execution, proposal and discarded splice arrays stage at
most `cellCount+26` logical entries separately from retained fields. This is a
source slot bound, not backing-store/GC/RSS or device capacity evidence.

Existing opt-in whole-tick diagnostics expose only bounded scalar attempts,
publications, refusal reasons, census visits and maximum retained/staged entries;
staging includes the bounded proposal even when execution copying is refused.
The separate census diagnostic correction initializes visits and retained-entry
high water from the ledger's already-computed scalar census, including phases
with no proposal or live actors. It performs no second scan and changes no
reservation or movement decision. No-detour quota edges on three XL shapes,
active/resume/herd aliases, diagnostic opt-out parity and real whole-tick reset
are registered controls; synthetic pressure is not admitted XL gameplay.
legacy grids omit these fields and never read the census. Registered controls
cover quota−1/quota/quota+1, rectangular/square per-path growth, consumed prefixes,
aliases/resume/herd fields, shared assignees, no copy on refusal, release/retry,
same-phase conservative release, unchanged intents, actual Stop/Hold and diagnostic
reset/opt-out parity. Six both-seat native 16×17/160²/256² accepted Move/queued
fractional journeys exercise the actual parked-Worker detour, complete serialized
checkpoint validation and separate-module recovery, including legal substeps.
XL pressure remains synthetic; ordinary320/full XL recovery stays closed.

Core owns the phase census/splice admission and this subsection only; crowd
[PR400](https://github.com/lbeezr/thousand-unit-skirmish/pull/400) owns its ordinary
steering/wait controller, and caller [PR429](https://github.com/lbeezr/thousand-unit-skirmish/pull/429)
owns the accepted Follow-to-queued-travel point transition allocated in the
[shared decision](https://github.com/lbeezr/thousand-unit-skirmish/pull/425#issuecomment-5987591555).
Worker flow/Return clone adoption, direct combat/acquisition, naval and wildlife
writers remain separate positive-growth adopters. This is an internal source
milestone (art N/A). The shared owner retains exact-head review, integration,
packaging and existing deployment/capture follow-through; no source test closes
served identity or actual normal-game pixels.

### Worker retention preparation and live land Return admission

The next writer is justified by the read-only
[Worker characterization](qa-evidence/worker-retention-2026-10-05/publication.mjs),
not by missing coverage alone. The clean `66595754`
[historical baseline](qa-evidence/worker-retention-2026-10-05/publication.json)
consumed unchanged `workerFlowPath`,
`applyWorkerFlowRoute`, `routeWorkerToDropoff` and land `assignReturnCargo`
bodies with controlled flat/weighted selectors and synthetic saved-field pressure.
Of 27 rectangular/square/legacy cases, 12 exceed the aggregate envelope after
publication, including all three two-Worker explicit Return cases. The actual
checkpoint route leaf refuses those overshoots. Three replacement controls fit;
all cases preserve the selected raw tail (distinct from `field.goal`), original
weighted cost, raw drop-off length scoring and cargo. This is not a full XL save,
admitted match or gameplay/capacity failure witness.

Explicit land Return is the first bounded adopter: its existing
selection publishes onto temporary clones, then the command copies their paths
into live actors. A guard treating those clones as saved units is incorrect, and
the existing deliveries array can retain a selected route for every recipient.
Core owns only live command publication/retained-field reservation and
bounded per-recipient staging at the land branch of `assignReturnCargo`;
resource retains drop-off selection, raw scoring, original reduction, cargo,
rates and work continuation. Water Return and the Worker flow helper stay separate.
The implementation must credit each actually replaced/cleared saved field,
including any active/resume aliases, preserve unreachable rejection, retain an
accepted selected goal/drop-off under capacity deferral and use guarded existing
service/recovery rather than execute the old work leg. No saved ledger flag.

Acceptance for that separate slice includes quota boundaries and alias credit,
pre-copy admission/finite staging, selected-tail/raw-score controls, pending
Return cancellation/replacement and real both-seat cargo delivery/queued
continuation/cold recovery on existing admitted grids. General Worker flow and
topology retries remain further adopters; no all-writer completion is implied.
The live implementation streams XL recipients, reserving against the actual
Worker before linking its selected route. An explicit ledger `clearResume`
option credits both fields that this accepted command clears; default callers
keep active-field-only credit. Other active/resume/herd aliases stay charged.
Refusal accepts Return at normal command priority, clears previous work/route,
retains cargo and the chosen drop-off/goal, and enqueues an empty guarded repair
assignment through the existing service. It never reports arrival, loses the
job or executes the old work leg. Retry replans toward that same selected
endpoint with current A* policy; full raw route payloads are released rather
than stored per waiting recipient. No new saved state or scheduling hook.
The <=256 branch retains its previous select-all-then-publish behavior. Water
Return, resource helper reduction/selection, cargo rates and jobs are unchanged.

The registered [land Return journeys](../scripts/land-return-admission-journeys.mjs)
consume the actual command, selection/reduction, queue/service/publication,
checkpoint recovery tail, physical phase and deposit bodies. Synthetic XL
quota edges, path-length refusal, active/resume alias credit and 24-recipient
streaming retain raw selected tails/cost/scoring. Both seats and both scheduler
modes preserve pending cargo/queued travel through refusal, cold metadata
recovery and field release, then deposit once before later travel. Stop/Hold,
death, recycled actors, replaced matches and unreachable rejection are controls.
Two genuine 160-map both-seat journeys separately harvest finite Food, accept
Return, cold-load a complete checkpoint in a new module, deposit and finish a
queued fractional Move with actual static-body substeps. They do not establish
native XL save admission. Per-recipient source staging is bounded by existing
cell-count flow loops plus one reduction/prefix copy (conservatively <=3N
logical route entries); no M-recipient route payload list on XL. This is not
a measured heap/RSS bound, resumable-search proof or CPU/crowd capacity result.

The repeat reporter now observes capacity-repair requests at the service
boundary. Its unchanged historical baseline still contains three explicit
Return overshoots; current Return has zero. Nine general Worker flow overshoots
remain visible, so shared flow/topology retry adoption is still open. The
no-detour physical diagnostic census correction is a separate small slice.
Core retains exact-head review, fresh-main integration, clean packaging and
identified-release normal-game acceptance. Existing deployment verifier and
CI capture owners supply their interfaces; a source merge does not close
served identity or pixels. Ordinary320 remains closed. Art backing N/A for
this internal retention change; rejected art holds remain intact.

### Worker economy operation publication

The [clean-source navigation retry witnesses](qa-evidence/worker-retention-2026-10-05/navigation-retry.json)
and reporter additionally consume the actual `workerAtDropoff` stale-navigation
branch at `231d5e00`. Six synthetic flat/weighted quota cases on 320×160,
160×320 and 320² preserve live cargo, phase, raw selected tail/score/cost, but
increase saved entries beyond quota after reselecting a drop-off. The checkpoint
leaf refuses those overshoots. These are source writer witnesses with controlled
drop-off/flow selectors and policy, not paid-building lifecycle, native XL
checkpoint/admission, timing or rendered acceptance.

The resource owner [approved the exact allocation](https://github.com/lbeezr/thousand-unit-skirmish/pull/330#issuecomment-5988874272):
core owns reservation at the live `applyWorkerFlowRoute` publication slot and
a bounded operation-local ledger/repair handoff. Real actors are distinct from
Return's temporary clones; Return remains charged by its merged command adopter.
Selection, raw scoring, chosen tail, reduction, cargo, rates, depletion and
continuation stay resource-owned. The actual consumed writes are that
subsection of `applyWorkerFlowRoute`, a private synchronous wrapper at the
existing `simulateTick` call to unchanged `updateWorkerEconomy`, and only the
path/index/goal publication triplet in `updateForestWorkerEconomy`'s existing
access-cell center approach. No scope argument forwarding or helper-signature
change is needed. Resource retains every surrounding selection, validity,
visibility, harvest and continuation condition. The lazy operation census
begins at its first positive publication and ends before returning to the tick;
legacy grids bypass it and Return clones remain outside its live charging.
The wrapper unwinds in `finally`, before handing empty assignments to existing
guarded service, which takes its own current reservation. No saved scope/ledger
flag or new asynchronous planner is introduced.

The read-only [forest center publication witness](qa-evidence/worker-retention-2026-10-05/forest-center-publication.mjs)
and [clean-source report](qa-evidence/worker-retention-2026-10-05/forest-center-publication.json)
consume the actual access-cell and economy bodies. At synthetic saved-route
quota on each of the three XL shapes, this direct one-cell publication grows
Q to Q+1 without invoking a flow helper, while preserving the active job,
partial Wood cargo, stock, pose, queue, generation and order revision. The
existing selected access center is within unchanged harvesting range, while
the initial fractional pose is outside it. This establishes the missing writer
in the operation; it is not execution, productive harvesting, full
checkpoint, native XL or rendered acceptance. A small legacy case bypasses
the XL checkpoint leaf unchanged.
The default tick adopter charges every positive Worker route write within its
scope, including automatic drop-off/resumption and navigation reselection.
Reusing one phase ledger while leaving other growing Worker writers uncharged
would undercount; independently rescanning all actors per recipient instead
would add repeated census work. Both flow publication and the one-entry center
approach consume one lazy ledger; idle operations never materialize it.

The operation is unchanged `updateWorkerEconomy` and its actual forest/drop-off
helper calls. Manual Gather/forest command groups and paid-footprint repair
callers remain explicit next adopters; the historical reporters invoke helpers
outside this tick scope and retain their overshoot controls. The ledger ends
with the operation. Clears can conservatively delay credit until a fresh scope
but cannot create optimistic reuse. Refusal keeps the selected goal/resource
job, cargo and queue, releases refused arrays and explicitly hands off to the
existing silent `worker-economy-capacity` repair. Drop-off navigation is already
refreshed before publication, so the next work tick cannot be relied on to
reselect/retry. A waiting forest Worker retains that accepted flow/center goal,
including when outside all access cells. An empty pending route cannot be
classified as a failed arrival or enter frontier continuation, which would
reselect every tick or cancel a remembered job while its tree is out of sight.
A completed nonpending route keeps the original continuation and queue policy. Actual
interaction range still controls deposits/harvesting; refusal never supplies
arrival or executes the old leg. Actor identity/generation/revision/epoch guard
the handoff; existing planner navigation checks guard retry. Stop/new manual
intent, depletion and continuation retain their existing priority and policy.

The registered [economy admission journeys](../scripts/worker-economy-route-admission-journeys.mjs)
consume the actual economy, both publication slots, forest target/continuation
bodies, repair/service, physical phase and recovery tail with synthetic XL
pressure and controlled flow/A*/visibility.
Quota/weighted/raw-score controls, mixed flow/center ordering, active/resume alias
accounting, one pending center repair, both-seat field-release/deposit-once,
safe physical displacements, productive forest recovery, stale actors/orders,
navigation/epoch changes and legacy bypass are source contracts. Off-access
post-deposit waits cover both seats, visible/out-of-sight remembered trees,
no-pressure controls and safe productive recovery after release. The optional
queued-plus-forest-job fixture is an accepted-state control, not a normal Shift
Move journey: that command clears the work intent. Metadata cold
recovery is separate from a complete native XL checkpoint. Existing real-command
Food/Wood/Stone, forest, paid Farm, depletion/continuation and untouched-checkpoint
journeys remain compatibility acceptance on admitted grids. Water/wildlife keep
separate adapters. Return and census diagnostics remain separate merged slices;
independent exact-head review, release/native qualification and normal merge
belong to this economy increment. Source, package, deployed identity and real
normal-game pixels remain distinct. Ordinary320 and universal completion stay open.

### Bounded manual Gather publication adopter

The clean `16047ce2` read-only command witness found twelve XL quota overshoots:
four selected Workers add four flat or twenty weighted entries at quota on both
seats and all three planned320 shapes; eight160/256 controls retain their bypass.
This is synthetic route pressure, not native XL admission. The registered
[Gather admission journeys](../scripts/worker-gather-route-admission-journeys.mjs)
consume the actual production dispatch, command resolver, unchanged neutral/Farm
Gather and forest delegation, selectors, publication, service, physical economy
and recovery bodies. Their old-dispatch control fails all24 neutral/forest
shape/seat/weight quota cases; the scoped dispatcher keeps the accepted envelope.

Core reuses the economy operation's existing lazy ledger and finally-unwound
guarded metadata handoff through `withWorkerRouteAdmission`. The sole Gather
callee in `handleCommand` becomes `assignGatherWithRouteAdmission`; resource
selectors/assignment, cargo, raw drop-off rank/tail/cost, reduction, rates,
continuation, auth/resolver and planner bodies remain unchanged. One census
serves all live recipients; refusals release arrays while retaining each newly
accepted goal/job/cargo. New manual Gather still clears old Shift waypoints as
before. Later retries use current metadata and fresh capacity through existing
service. Cleared resume fields can conservatively retain charge until that
fresh reservation; aliases remain charged per saved field. Legacy maps bypass
the scope; rejected/stale commands and naval delegation are census-free.

Callback and one/two-turn controls retain selected goals while waiting, conserve
once-only finite Food deposits, recover productive forest work from cold metadata
and preserve other typed cargo/new remembered work. These source controls do not
close complete native XL saves, all remaining retention writers, renderer/GPU
capacity or ordinary320. Paid-footprint/farm-destruction writers remain separate
adopters; construction endpoint consumption stays with its agreed caller owner.
Core retains exact-head review, normal merge, native/release and identified
served/rendered follow-through for this command increment.

### Stationary construction characterization

Stationary construction is another uncovered core consumer, with no runtime
patch selected. Twelve real-command probes at the same clean source stage two
or four Workers from each seat, pay 75 Wood for a House and observe actual work.
Approach cases never execute separation; legal access/corner-access cases
execute 54 separation substeps altogether with zero new static contacts/illegal
centers, productive completion and unchanged unselected actors. The
[full inputs, commands and substeps](qa-evidence/live-publication-2026-10-05/construction-probes.json.gz)
and [repeat driver](qa-evidence/live-publication-2026-10-05/construction.mjs)
retain those bounded outcomes. No repeated-run determinism or general construction
separation/evacuation/body-pair acceptance is claimed. The smallest further step
is a real-command obstruction/recovery reproduction; the earlier unexercised
travel probes are not grounds for a speculative selector change.

## Ranked backlog

| Rank / status | Outcome and next action | Write boundary / dependency | Acceptance |
| --- | --- | --- | --- |
| U4/U6 · bounded runtime increment | XL sliced-planner publication reserves saved-field replacement and rejoin/final-center growth, releases staged payloads after refusal and retries from accepted goals through existing service. PR422 supplies durable pending goals; checkpoint PR407/414 supplies the quota. | Core publisher/rejoin/planner service; map owns save quota/admission. Other direct retention writers adopt separately. | Quota/growth/alias controls, fair release/retry/cancellation and restore-tail checks; real ≤256 compatibility. All-writer bounds, complete XL recovery, search resumability and ordinary 320 remain open. |
| U4 · bounded caller adoption | Construction PR399 and scoped military objective PR405, unit Attack PR410, acquired AttackMove PR417, Patrol PR418/421, building Attack PR424, Follow/queued catch-up PR429 and automatic stance pursuit PR432 are merged. Next measured Worker Follow boundary is allocated above; Worker Patrol/objective, rally and direct interaction/placement remain separately scoped. Safe return/same-cell controls do not justify speculative patches. | [Caller adoption owner](https://github.com/lbeezr/thousand-unit-skirmish/pull/432) retains adoption; agree future overlapping functions without duplicating merged hooks. | Both-seat accepted commands, original endpoint cycling, retained selected route, productive legal-range damage, interruption/recovery and zero new static contact in the adopted domain. Old visibility fixture failures remain separate. |
| U5 · source merged; verification retained | PR400 ordinary military Move groups, opposing traffic and queued topology are source-qualified and merged at `8c28773c`; retain identified staging/served/rendered verification. | [Crowd owner](https://github.com/lbeezr/thousand-unit-skirmish/pull/400); allocated query/steering/wait only. | Retain failures/timeouts, safe sweeps, immovable parked actors, stable slots and finite forward progress; no combat/Worker adoption claim. |
| 1 · complete | Clock-independent service work merged in [PR #193](https://github.com/lbeezr/thousand-unit-skirmish/pull/193), `331df72`; [postmerge checks](qa-crowd-forward-progress-2026-10-03.md#integration-and-remaining-evidence) pass. | Planning constants, queue-slice helper and diagnostics only. | 209 postmerge checks; nine route pairs preserve hashes; native large routes and recovery. Atomic-search overshoot remains explicit. |
| 2 · complete | The parked-formation stall reproduces with a one/two-tick older Move. Bounded repulsion merged in [PR #209](https://github.com/lbeezr/thousand-unit-skirmish/pull/209), `64cc391`; independent review and [postmerge checks](qa-crowd-forward-progress-2026-10-03.md#4-october-postmerge-acceptance) pass. | Only `getMoveVector`'s final force combination and focused tests/tools. Combat-owner targeting/stances remain untouched. | 235 postmerge checks; all eight headings on both seats; four large parked cases twice; nine terrain route pairs; native parked controls and active/idle restarts at the exact merge source. |
| 3 · qualification complete | The [1/4/8 comparison](qa-move-planning-tick-budget-2026-10-04.md) recommended four turns, but [paid whole-tick qualification](qa-paid-battle-tick-budget-2026-10-04.md) failed the 33.333 ms maximum at 2,000 units. Retain callback default; 1/4/8 remain reproduction controls. This decision is complete. | Movement planner plus the single allocated outer-tick hook; inner combat/Worker/wildlife/mode bodies stay with their owners. Any later default proposal first needs evidence addressing the recorded non-planning tail. | Four native paid battle/economy/recovery runs pass functionally. Four's two budget overruns have zero planning turns. Repeated candidate traces, Stop/replacement, FIFO fairness, topology and recovery remain covered. This does not complete the all-command pipeline. |
| 4 · pending cloud capture | Complete the corrected rendered 2,000-unit workload through paid economy, combat and restart. The testing/capture lane must first provide a working sandboxed cloud WebGL2 runtime. | Existing browser workload; source-qualified runtime and device/network profile. No stopped Mac dependency or browser security bypass. | Actual rendered run, authoritative goals/positions, paid work and recovery. Native/tool-only checks cannot close the render/deployed acceptance gap. |
| 5 · allocation validated | [Snapshot allocation comparison](qa-snapshot-row-allocation-2026-10-04.md) validates the one-line base-row construction change in [PR #259](https://github.com/lbeezr/thousand-unit-skirmish/pull/259). Retain callback default and open deployed/rendered acceptance. | Only base-row literal plus focused regression/probe and QA; no visibility change. | Exact sparse rows/private frame bytes and recovery checks; three fixed allocation pairs reduce estimates 44.9–46.5%, both ordinary process profiles confirm direction, all twelve paid process runs pass. Every timing distribution is retained; no uniform speedup, capacity or maximum-budget-pass claim. |
| 6 · investigation complete; no optimization selected | [Remaining tail analysis](qa-remaining-tick-tail-2026-10-04.md) locates the plain callback maximum in broadcast and diagnostic maximum in simulation. A read-only zero-separation `hypot` guard probe has inconsistent allocation results and is not shipped. | No runtime write. Future proposals require source-qualified child timings and actual branch/call counts; keep rendered backlog at rank 4. | Six fixed probe processes retain hashes, exact vector checks and the adverse repeat. No uniform hotspot cause, scheduler switch or whole-game gain asserted. |
| 7 · source validated; deployed/pixels open | [Direct open-ground Move](qa-direct-open-ground-move-2026-10-04.md), merged [PR #285](https://github.com/lbeezr/thousand-unit-skirmish/pull/285) at `89fc71f6bc6733f3461b2596ba92e0b0d562a984`, fixes the reproduced Manhattan fast-path turns with a safe, uniform-level straight waypoint. | Planner/application helpers and construction segment intersection; existing physical collision, Worker/combat flow fields, renderer and timing unchanged. | 148 focused author checks and independent review; 58 postmerge movement/presentation/clock checks pass. Twelve twice-repeated trajectories remove 26–41% excess distance for non-axis orders; nine terrain/crowd pairs complete including both 996-unit chokes, with exact retained hashes. Actual both-seat cold restart/resume reaches both queued goals at tick 330. Clean 1,184-file pack digest: `sha256:991d358b9ffb34088b274680d8652428fe8d320784509d9ca4bae004d3ab82f9`; packed startup passes. Deployed/pixel acceptance remains open. |

## Formation helper boundary

Movement owns `src/simulation/movement/formation-assignment.mjs`, the canonical
formation-ordering implementation allocated in [architecture step 4](architecture.md#first-eight-migration-pr-candidates).
Its implementation is byte-identical to `src/formation-assignment.mjs` at
`a93c8175`; the old path explicitly forwards only `orderUnitsForFormation` with
the same function binding. Both paths remain private to authoritative consumers.
This relocation changes no pathing algorithm, planner budget, command queue,
force combination or server import.

At the original relocation, the two tracked old-path importers were `server.mjs`
and `scripts/formation-assignment-scenario.mjs`. Architecture PR404 merged at
`1309e588` moved the server to the canonical path with value identity preserved;
the scenario still uses the shim. New consumers use the canonical path. Shim
retirement still needs all tracked runtime/tool/test/doc references and any
supported external imports/commands inventoried. Retire only after that is clear, the affected owner
confirms compatibility, and formation/replay, source admission and actual packed
GET/HEAD privacy checks pass without it. Both paths must remain packaged and
HTTP-private while the shim exists.

## Baseline inspection and resolved findings

At `4467986`, 42 focused movement checks pass. All seven existing fixed-tick
route cases repeat twice and complete, including the 256-unit one-cell choke
at tick 1,031. Temporary no-progress windows reach 289 ticks there; this is a
completed crowded route, not a stranded-order reproduction.

An initial 128×96, 2,000-roster probe sends 996 Infantry through a one-cell choke.
All reach their assigned goals by tick 2,018 with zero illegal or disconnected
steps. Its initial planning job reports 943 searches and 472,109 expanded cells.
Host timings are observational. The durable mirrored probe uses a 128×128 scene;
the initial 128×96 scene is retained separately rather than silently substituted.

The [planning QA](qa-move-planning-work-2026-10-03.md) now retains the durable
mirrored 128×128 baseline, unchanged candidate traces and native recovery.
Both initial 996-unit routes complete. An additional replacement into a parked
formation leaves two seat-1 Infantry stalled. The [crowd QA](qa-crowd-forward-progress-2026-10-03.md)
preserves its baseline and candidate separately: stacked parked Infantry reverse
the movement vector; a bounded separation force resolves that reproduction.

At baseline `4467986`, `processMovePlanningSlice` stops work by elapsed milliseconds.
Merged PR #193 replaces that policy with eight work items and a 4,096-expanded-cell
threshold, preserving whole-search overshoot. Native interleaving is separately
tested; broader tick-pipeline work remains deferred to the shared boundary above.

## Research invariants

The user-supplied *RTS source patterns for Vaelora* study was read through Library
in full (205 lines, 43,504 bytes). It is source-linked research, not imported
implementation. Use fixed operation/size limits in authoritative code; separate
formation assignment, route planning, steering and actual arrival; keep route
ownership/generation checks; coalesce compatible work only with topology and
movement compatibility; test dense chokepoints separately from distributed armies.
No engine port or third-party source copying is proposed.

The `game-dev` CLI is unavailable, but the existing real-body/native and browser
harnesses suffice for the proposed bounded comparisons. Record source, workload,
runtime/device profile and limitations with those tools. Correctness and operation
counts do not assert comparable CPU/GPU speedup or supported player capacity.

## Next available work and dependencies

The inspected route matrix has no remaining stranded order at `64cc391`. Do not
select another steering rewrite from timing noise. At `aa662141`, identical natural
Move state accepted at tick 0 begins movement at tick 1 or tick 4 depending on
callback service. The [proposal](movement-tick-phase-proposal.md) names the exact
planner functions, outer-tick hook, generation/topology guards, FIFO and recovery
rules, and the subsequent mode/AI/transport/Worker/wildlife command contract.
Buffering asynchronous results alone would not make their readiness reproducible.
The [allocated experiment](qa-move-planning-tick-budget-2026-10-04.md) services fixed
planning work at the tick boundary; one current queue turn per tick substantially
delays a 996-unit order. The subsequent
[paid whole-tick decision](qa-paid-battle-tick-budget-2026-10-04.md) retains callback
scheduling: four turns do not qualify at 2,000 units. The zero-planning overruns
identify broadcast/vision and a scenario timing outlier. The subsequent
[read-only attribution](qa-tick-cost-attribution-2026-10-04.md) retains callback's
32 and four's six overruns across repeated 1,860-tick observations, quantifies
payload/compression and vision-cache work, and proposes a narrow `snapshotUnits`
array-construction experiment. The subsequent [bounded allocation comparison](qa-snapshot-row-allocation-2026-10-04.md)
preserves exact private rows/bytes and measures a single eleven-element literal.
Three fixed probe pairs reduce inclusive allocation estimates by 44.9–46.5%;
ordinary process profiles show approximate normalized reductions of 56.3% and
51.2%. The twelve functional runs retain all 11,160 ticks, including candidate
overruns. Reduced allocation does not qualify a scheduler switch or supported
capacity. This evidence does not justify changing another
owner's inner simulation or the mode owner's immediate visibility refresh.
The proposal retains its original allocation scope.

The full rendered 2,000-unit workload remains owned by movement. Read-only Railway
state confirms staging successfully deployed `64cc391` (both #193 and #209), but
HTTP health and in-game use could not be verified here. A private TMP/XDG retry
resolved storage and still failed the Linux browser sandbox. The concrete capture
resource and source-qualified local/staging recipes are in the
[proposal's acceptance record](movement-tick-phase-proposal.md#deployed-and-rendered-acceptance-retained).
The existing harness is sufficient once that runtime is available. Native progress
tests and platform deployment status do not close the rendered acceptance gap.
