# Worker performing-action contract proposal

**Historical proposal, superseded by the [agreed v1 contract](worker-performing-action-contract.md)
and [consumer binding](qa-worker-performing-action-consumer-2026-10-04.md).** The
dated probe below describes its pre-producer source, not current behavior.

At the proposal checkpoint, animation integration owner requested the
parent to align this exact producer/consumer boundary with the assigned economy/
content gameplay producer. The producer owns the actual-progress receipt in shared
snapshot/work loops and will supply the exact schema, enum, tick/version and
defaults through the parent. Assignment does not mean this proposal is accepted.
The animation owner retains the consumer, integration and native acceptance.
Combat stance/reacquisition remains with its existing owner and is excluded.

User outcome: a Worker waiting on a route, queued assignment, resource, build
site or repair wood shows idle/walk rather than harvesting/hammering. Positive
authoritative work plays existing appropriate frames. No economy, path/order,
combat, paid generation or missing-art changes are proposed.

## Current signals cannot establish all performing Workers

The [13-case current-wire probe](qa-evidence/worker-performing-action-2026-10-03/current-wire-probe.json)
exercises the actual server snapshot, economy and construction/repair functions
at reviewed source `5e4d54c92ef2da6632028f35f77995c67d4bdf1d`, based on main
`14590fb2189f76c3babb3a5e43e9a2c5edcac76b`. This is deterministic CPU
evidence, not a live-server or game appearance claim.

| Existing signal | What it establishes | Why it cannot drive all work animation |
| --- | --- | --- |
| Row 9 `task` | Order intent: gathering/building/repairing persists while assigned. | Blocked approach and queued planning remain gathering; distant builder/repairer remain building/repairing even with zero progress. |
| Position / interpolation | Travel and the local presentation's settling movement. | Stationary can mean waiting; position cannot identify an assigned target not present in the row. |
| Row 14 work-audio execution | Gather phase/resource and repair reach/wood/damage predicate. | No build action; gather reports food even with retained `gathering` phase outside interaction range and zero cargo change. It does not check gather stock/capacity/reach. |
| Row 15 / 16 | Gather target bearing and cosmetic shore-fish identity. | These are not positive-progress receipts; neither covers build/repair execution. |
| Cargo differences | Net carried resource observed across snapshots. | Deposit/return/coalesced updates can hide work; rounding and a zero delta cannot safely identify a per-step pause. |
| Shared building progress / HP | Work or damage contributed to a building. | Does not identify the contributing Worker. Two overlapping Workers can swap near/far assignments with identical unit rows and identical resulting building progress, while the actual performer changes. |
| Worker target, phase and reach predicates | Available inside authoritative work code. | Not all are transported; duplicating them client-side would infer authority and drift from actual grant branches. |

Arrival and simulated reassignment at arrival increase cargo; blocked approach, queued task and
retained gather phase outside reach do not. Depleted/full-cargo work switches
to returning. Simulated target clearing produces idle and no work. These two
fixture cases do not exercise actual Stop/resume commands, order-revision
invalidation or real routes; those remain implementation acceptance checks. Build arrival
advances progress; distant build wait does not. Repair arrival advances HP;
distant repair and zero-wood repair do not. Current sprites still choose work in
several of the zero-progress cases. The probe records actual deltas, task, row 14
and sprite state for each case; it also proves the construction ambiguity above.
After a repair consumes the last available wood, three subsequent fixture ticks
retain `repairing` intent with zero progress and `dirty=false`. A receipt clear
must request a broadcast to avoid leaving the previous work frame active.

Reproduce at the recorded pre-producer source with
`node scripts/worker-performing-action-probe.mjs REPORT.json`.
This dated diagnostic is not a permanent CI assertion that incorrect presentation
must remain. Normal syntax checks include it; future regression tests must assert
the corrected producer/consumer behavior instead.

## Proposed smallest wire addition

Keep every existing row index and meaning. Add index **17**, `performingAction`,
for disclosed own/shared Workers:

| Value | Authoritative condition to record |
| --- | --- |
| `gather-food`, `gather-wood`, `gather-stone` | That Worker actually receives a positive harvested amount in the current simulation step. Include forest and Farm/node grant paths. |
| `build` | That Worker actually increases unfinished building progress in the current simulation step. |
| `repair` | That Worker actually contributes positive repaired HP in the current simulation step. |
| `null` | No matching productive work in the current step, including waiting/queued/travel/Stop/return/full/depleted/no-wood/dead/completed target. |

Emit an explicit null for a disclosed Worker with no work, so current clients
can clear state on each snapshot. Omit/withhold enemy activity under fog using
the same ownership rule as existing work fields. Non-Workers never receive an
activity. This field reports presentation evidence; it never grants resources,
changes build rate, navigation, task intent or checkpoint authority.

Producer implementation should record a transient receipt beside the **existing
positive mutation**, rather than recompute eligibility from intent. A bounded
per-step map keyed by the Worker object is sufficient. Record action, tick,
generation and order revision; reset it at simulation-step entry. Snapshot read
must require the same tick/generation/order revision, living Worker, and a still
compatible work task/target. Thus commands between ticks, Stop/resume, generation
reuse, completion, depletion/return and rematch cannot expose a stale receipt.
Do not persist receipts in checkpoints. Following recovery, idle remains valid
until the first positive grant reconstructs actual activity.

Activity transitions must also make the authoritative state **dirty**, including
positive action → null when the order remains assigned but no productive mutation
occurs. The current tick broadcaster sends only dirty state. Clearing a transient
receipt without a broadcast can leave the last positive repair visible after wood
runs out. Compare action identity against the preceding step/published state and
request delivery through the existing bounded snapshot cadence; continuous positive
work need not add an extra broadcast. A positive→null transition must be delivered
even when task, position, cargo, building progress and HP all remain unchanged.

Actual current productive branches are `updateForestWorkerEconomy`,
`updateWorkerEconomy`, and the Worker loop in `updateBuildingAndProduction`.
These additions and `snapshotUnits` emission are the producer's bounded scope.
No changes to combat tick/cooldown, target selection, stance or weapon authority.

The supplied OpenRA/EA study informed three original invariants for this slice:
authority supplies productive action identity, final presentation precedence is
explicit, and cosmetic choices never consume gameplay RNG. The inspected pinned
[attack notification consumer](https://github.com/OpenRA/OpenRA/blob/b6fc03fcfaef1277592bbd4cbc7d44dd85219902/OpenRA.Mods.Common/Traits/Render/WithAttackAnimation.cs#L62-L79)
and [infantry update ordering](https://github.com/OpenRA/OpenRA/blob/b6fc03fcfaef1277592bbd4cbc7d44dd85219902/OpenRA.Mods.Common/Traits/Render/WithInfantryBody.cs#L148-L178)
are research references, not imported implementation. Worker work is continuous
positive-progress evidence; it does not require a new combat windup or weapon
phase protocol. Existing attack tick deduplication remains independent. Required
tests vary presentation cadence, visibility and missing clips while asserting
unchanged authoritative resource/progress deltas. No engine transplant or combat
policy change belongs in this contract.

## Animation consumer and acceptance

The animation owner consumes row 17 on every snapshot, including null/legacy/
unknown values, and clears it on generation reuse. Known positive activity gates
work independently from task intent. A paused assignment uses idle while stationary
and walk while moving. Preserve defeat/movement/attack event precedence and
existing action clocks; repeated positive snapshots must not restart a loop.
Existing attack tick/event handling remains independent of this continuous-work
field. No random seed, cosmetic event or animation clock enters simulation rules.

Use performing-action resource identity rather than carried `cargoType` to choose
food/wood work clips. Keep logical gather state and exact-facing rules; direct
`gather-food` state must not accidentally enter approximate direction fallback.
Shore fish remains `gather-food` authority with row 16's cosmetic variant. Stone
has no admitted dedicated work artwork; use an honest idle fallback instead of
calling reused wood pixels a Stone animation. Build/repair retain their existing
authored clip coverage; this proposal adds no facing or new pose art.

Keep row 9 unchanged for HUD/task controls. Apply the same activity gate to the
sprite path, procedural work pose and work-phase update scheduling. A stale task
must not keep hammer/axe animation running after positive activity disappears.
Receipt changes must refresh the unit transform/dirty sprite buffers even when
task and position are unchanged; otherwise a null could leave the last work frame
drawn until unrelated input or motion occurs.
An absent/unknown field fails closed to idle/walk; do not use row 9 or a guessed
target to invent activity during mixed/legacy snapshot delivery.

Required producer/client/runtime checks cover arrival, blocked approach, queued
planning/task, Stop/resume in the same tick, retained phase outside reach, finite
resource depletion, full capacity, Farm/forest/node grants, build completion and
wait, repair out of reach/no wood/complete target, generation reuse, fog, recovery
and rematch. Check food/wood selection with empty/previous cargo type, both default
civilizations, selected/unselected Workers, interruption/resumption and continuous
clock behavior. Include real WebSocket snapshot checks and actual instanced frame
selection with shipped manifests; never infer new animation from missing artwork.
Include a positive repair snapshot followed by no-wood wait with all other fields
stable: a new null snapshot must arrive and update the actual frame without input.

The [client presentation fixture](../scripts/unit-presentation-client-fixture.mjs)
already runs the actual `appendUnitFromState`, `applyState` and unit frame-scheduling
source slices with real Three instanced buffers and default Human/Boughward Worker
manifests. Its baseline tests cover current positive-work presentation, task
interruption, attack deduplication, movement, slot reuse, fog and LOD. It assumes
no new receipt format. Extend its row builder and cases only after producer
alignment; it does not establish real commands, WebSocket delivery, GPU pixels,
procedural fallback or producer validity by itself.

Native acceptance uses the [ordinary-game animation recipe](qa-unit-animation-audit-2026-10-03.md#visual-gap-and-exact-ordinary-game-recipe)
on an identified served revision containing producer and consumer. Add blocked
approach/queued assignment and zero-wood repair clips: stationary waits must hold
idle, moving waits walk, and resumed positive work plays the existing keys. Local
browser sandbox startup remains unsupported; the parent-owned Mac QA route is
the receiving visual owner. Animation owner retains delivery and appearance
acceptance; this proposal/probe is not an implementation milestone or completion.
