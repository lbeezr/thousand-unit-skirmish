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
| Manual Move, queued Move, formation slots | `assignFormationMove`, `advanceQueuedWaypoints`, sliced `findPathAStar` → `applyPlannedMoveAssignment` → `getMoveVector` / `simulateTick` | Preserve distinct slots, causal queues and reachable-component projection; exact fractional arrival is a later change. [Direct Move checks](qa-direct-open-ground-move-2026-10-04.md) retain current cell-center semantics. |
| Gather, Farm, shore fish, drop-off, Return, return to work | `routeWorker`, `routeForestWorker`, `routeWorkerToDropoff`, `updateWorkerEconomy`; cached cardinal flow fields → land executor | Select a legal interaction endpoint and preserve cargo/job. Resource owner `01a101f7-5683-70da-8e3b-b87022e5a008` owns the urgent Worker-only direct-route patch. Retain selected `path.at(-1)`, never substitute `field.goal`; drop-off scoring uses original `path.length` before reduction. |
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
| U1 · shared movement owner · implemented in [PR #332](https://github.com/lbeezr/thousand-unit-skirmish/pull/332), review open | `src/unit-movement.mjs` dimension preconditions, `scripts/unit-movement.test.mjs`, this owning guide. No flow, Worker, map-limit, server-loop or relocation edits. | Malformed grids fail closed before occupancy; 16×17, 160, 256 and planned320 primitive index checks; both-seat cliff/corner rejection across 13 injected land intent policies with intent/queue retained. Exact-head tests/release and the unavailable native review executor are recorded in the PR. This is a source safety/regression milestone. |
| U2 · resource / forest owners, then shared adoption | Resource owner: Worker route functions only; forest owner: selected group/job reacquisition only. Shared owner subsequently adopts their endpoint/cost outcomes in the existing route publication/diagnostic boundary. | Long gather→deposit→return soak, interior-tree/group frontier, multiple drop-offs/Farm/shore goals, depleted/blocked target, both seats and checkpoint; compare original scoring and selected tail. Their urgent fixes ship independently. No global `pathFromAttackFlow` edit. |
| U3 · shared movement owner | `applyPlannedMoveAssignment`, goal/queue fields in `assignFormationMove` / `advanceQueuedWaypoints`, matching land checkpoint validation and existing replay fixtures. Dependency: U2 endpoint/cost contracts; exact checkpoint subsection agreed with recovery owner. | Real commands distinguish empty-success/failure, move within a goal cell, exact fractional final points and obstacle-edge projection; Stop/replacement, stale epoch/nav/actor and queued/active/idle restart. Migrate existing cell-centered historical fixtures honestly. |
| U4 · movement + construction/combat consumers | Movement owns segment/step/arrival helpers and the land execution subsection; construction owns access/paid continuation; combat owns `getUnitAttackPath`, range truncation and same-cell closure. No target acquisition/damage rewrite. | One clearance policy through direct/weighted/flow routes, building/range approaches, interaction separation and dynamic gates/forests. Both-seat range correctness, no illegal crossings, paid work unaffected; no unconsumed helper. |
| U5 · movement; naval and wildlife keep adapters | Movement owns bounded avoidance/detour/progress diagnostics. Naval owns `water-unit-runtime`, Skiff consumers; wildlife owns herd/grazing validators/stepping. Dependency: selected goal and compatible clearance. | Opposing choke traffic, parked workers, mixed speeds, stable formation slots/compress/reform, wait/yield fairness and bounded stall escalation. Preserve water hulls/basins and Sheep cardinal/final-point behavior. Each adapter ships independently. |
| U6 · movement + transport/mode/AI/recovery | Use the existing [all-command phase contract](movement-tick-phase-proposal.md#required-cross-owner-decision): named dispatcher, planner hook, AI decision ticks and checkpoint sections only. | Fixed intake sequence/eligibility and aggregate navigation budget, pending jobs/cache reuse across callers, clock/callback perturbation replay and durable recovery. Retain four-turn failure until new complete tick evidence qualifies a shipping policy. |
| U7 · movement acceptance; benchmark/map/capture owners supply their existing interfaces | Benchmark `01a101bc-9d2a-733a-916f-104264e9102c` owns report validity; map `01a103e8-8bfd-7013-8fee-94450f88501b` owns XL admission/index support; CI `01a10378` owns capture interfaces; organization `01a10711` owns relocations. Movement writes scenarios/acceptance only. | Full caller journey matrix, native/replay and actual ordinary-game rendered sequences at identified source/release. Keep 320 tests experimental until map admission lands. No duplicate report format, map-limit patch, renderer interface or path-only move. |

The user's sparse/permeable, narrow-pass and dense/impassable forest exploration
is a future U4/U5 fixture experiment after explicit land footprint/clearance.
Current forests occupy whole blocked cells with six wood per cell; canopy density,
species and visual scale do not change navigation. Compare actual swept clearance
and group filtering/reforming through proposed one/two-unit passages before naming
their physical capacity. Preserve resource quantities and keep this experiment
separate from the urgent forest-stall fix. Tree-variety owner
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
