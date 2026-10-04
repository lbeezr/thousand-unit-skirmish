# Movement and pathing workstream

Updated 4 October 2026. This is the ranked execution backlog for the user-owned
movement lane; the [roadmap](roadmap.md) remains the product priority source.
Each slice owns its regression, review, normal authorized merge and acceptance.
Evidence must name the source/workload and preserve failures.

## Write boundaries

This lane owns `src/unit-movement.mjs`, `src/unit-obstacle-detour.mjs`, formation
assignment and path-planning helpers, and their focused diagnostics/tests.
The planning slice touched only `processMovePlanningSlice`, its constants and
diagnostic record in `server.mjs`. The crowd slice touches only `getMoveVector`'s
force combination, plus pathing tests/tools. Target acquisition,
`getUnitAttackPath`, attack completion, stances, damage and `simulateTick` remain
with the combat owner. The parent allocated planner service helpers and one
pre-`simulateTick` call in `runSimulationTick` for the bounded tick-budget
experiment. Broader command-intake integration still needs its shared contract.
Water commands remain with the Skiff owner; art, rendering and map rules remain
with their respective lanes.
U3's corrective review owns only the terminal-step guard before
`simulateTick`'s `reachedWaypoint` assignment; it reuses existing route repair
and combat invalidation without changing acquisition, range or damage policy.
U4's first physical study owns only `scripts/land-body-clearance*`, the opt-in
private substep observer in `scripts/pathing-replay-fixture.mjs`, its new QA
records and this guide. It consumes the forest owner's gap map without editing
forest jobs/frontiers, the existing 42-case cell-gap records or their fixture.
Production movement, map admission, benchmark/report formats and renderer/CI
interfaces remain outside this diagnostic slice.
The following U4 runtime slice owns only static geometry/profile and ordinary
Move points in `src/unit-movement.mjs`, the matching planner/publication/queue/
repair sections and three existing land position admissions in `server.mjs`.
It adapts existing registered fixtures. Combat acquisition/range/damage,
Worker job/rate/scoring, group slots, interaction separation, map admission,
wire tuples, benchmark formats and renderer/CI interfaces remain with their
existing owners. Food Tools' productive-food grant/migration is disjoint, as
recorded on [PR377](https://github.com/lbeezr/thousand-unit-skirmish/pull/377#issuecomment-5984362722).
The parent allocated only `snapshotUnits`' base-row literal for the measured
allocation experiment; its private fields, filters and visibility contract stay
unchanged.

## Universal movement contract and rollout

The 4 October user delegation extends this lane to the shared movement architecture.
This section extends the existing backlog and [tick proposal](movement-tick-phase-proposal.md);
it does not replace the roadmap or the failed four-turn qualification. Keep the
grid/Node simulation authoritative and Three as presentation. The objective is
responsive, natural, safe movement through every implemented caller, with
different endpoint, clearance and execution policies where the domain requires them.
Universal completion is open until every row below has command, journey,
interruption, recovery and ordinary rendered evidence.

### Caller coverage at inspection source `32b71795`

The native parent audit identifies two land route families and additional direct
position writers. Function names are the ownership boundary; line numbers drift.
The first regression slice exercises injected accepted state in the production
land executor, not command admission or whole journeys.

| Caller / intent | Existing route / execution surface | Policy and evidence still required |
| --- | --- | --- |
| Manual Move, queued Move, formation slots | `assignFormationMove`, `advanceQueuedWaypoints`, sliced `findPathAStar` → `applyPlannedMoveAssignment` → `getMoveVector` / `simulateTick` | U3 adds legal fractional points; U4's bounded ordinary single-unit adopter adds explicit static-circle projection/sweeps. Groups keep distinct slots and reachable-component projection; physical group adoption remains open. [Retained Direct Move checks](qa-direct-open-ground-move-2026-10-04.md) document the historical cell-center milestone. |
| Gather, Farm, shore fish, drop-off, Return, return to work | `routeWorker`, `routeForestWorker`, `routeWorkerToDropoff`, `updateWorkerEconomy`; cached cardinal flow fields → land executor | The bounded land-Worker economy adopter shares the static profile through reduction/rejoin, route steps and gathering separation. Interaction ranges, selected `path.at(-1)`, original cost/raw `path.length` scoring and cargo/job remain resource-owned. Dynamic masks and actual journey/recovery/rendered coverage remain explicit below; water adapters keep their policy. |
| Forest group / region intent | `assignForestGather`, gather-work-area selection, `updateForestWorkerEconomy` → resource routes | Forest owner `01a1072a-4c42-7791-9dab-77b88425a021` owns the returning-forester/interior-click fix. A clicked interior tree names its selected forest group; choose its nearest reachable frontier. Distinguish exhausted, temporarily obstructed and unreachable. No unrelated global fallback or hidden-resource reveal. |
| Build, repair, palisade sequence, site evacuation | Building access assignment → A* / land executor; construction and wall continuation | Preserve paid site IDs, revision, legal edge range and actual productive-work receipts. Completion of movement does not mean completion of work. |
| Attack-move and interrupted-route resume | Formation A* plus `prepareAttackMovePaths`, `getUnitAttackPath`, `clearAttackTarget` → land executor | Preserve manual objective, acquisition/stance rules and resume. Normalize only after weapon-range and stance-travel selection. |
| Focused unit/building attack, pursuit, range positioning | `assignAttack`, `assignAttackBuilding`, cached flow / range goals → land executor | Range and target validity are independent of route exhaustion. Moving-target continuity and unreachable firing positions need both-seat journeys. Combat retains targeting/damage ownership. |
| Patrol, Follow, stance return, production rally | `assignPatrolOrder`, `assignFollowOrder`, `updatePersistentOrders`, `enqueueRouteRepairs`; rally reuses Move | Preserve endpoint cycling, catch-up/leash and manual replacement; test active and pending continuations. |
| AI and scenario-issued movement | Existing command dispatch plus mode/AI decision loop; scenario actions / reinforcement placement | Enumerate emitted commands and direct relocations; AI uses the same movement contracts and its disclosed observation. Fixed planning work alone does not make async intake or AI decisions deterministic. |
| Idle/work/combat interaction separation | `spreadInteractingUnits`; same-cell combat closure inside `simulateTick` | These write positions outside ordinary route following. Retain range, terrain, speed and stationary-order protections; keep them explicitly covered during integrator adoption. |
| Skiff Move, queued Move, fishing, Dock return | `water-unit-runtime`, `skiff-group-orders`, `skiff-waypoints`, `skiff-fishing` | Adapt route status/identity/diagnostics; preserve cardinal water, static shore clearance, 0.4-cell hull reservations, atomic group admission and retry budgets. Unsupported attack-move/Patrol/Follow remain explicit rejection. |
| Sheep herd, grazing, wildlife motion | Shared `pathFromAttackFlow` supplies `wildlife-herding`; wildlife owns direct stepping/final point | Cardinal route validator and continuous final endpoint are intentional. A global flow-path shortcut would violate this consumer. Audit grazing and topology retry separately. |
| Spawn, checkpoint restore, evacuation / relocation | Spawn rules, `restoreMatchCheckpoint`, construction relocation | These are placement/restore policies, not ordinary travel. Validate clearance and identity, record relocation reason, rebuild transient routes without silently changing job intent. |

### Shared semantics, domain policies

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

This is a consumed diagnostic contract, before production radius adoption.
The study helper and real-simulation runner measure swept circles centered on
authoritative x/z; one world unit equals one tile. Authored candidate radii are
Worker 0.18, Infantry/Spearman/Archer 0.22, Scout/Rider 0.28 and Siege Engine 0.35.
They are hypotheses, independent of sprite bounds and the current 0.56 soft
separation. No production caller imports the study profile. Naval hull and
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
Movement owner `01a107ba` retains independent review, normal merge, clean
packaging, identified deployment and ordinary-game rendered acceptance.
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

## Ranked backlog

| Rank / status | Outcome and next action | Write boundary / dependency | Acceptance |
| --- | --- | --- | --- |
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

The two tracked old-path importers are `server.mjs` and
`scripts/formation-assignment-scenario.mjs`. Keep them on the compatibility path
for this slice; new consumers use the canonical path. A later movement-owned
consumer migration must list all tracked runtime/tool/test/doc references and
confirm whether any supported external imports or commands still use the old
path. Retire the shim only after that inventory is clear, the affected owner
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
