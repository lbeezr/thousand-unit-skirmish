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

## Ranked backlog

| Rank / status | Outcome and next action | Write boundary / dependency | Acceptance |
| --- | --- | --- | --- |
| 1 · complete | Clock-independent service work merged in [PR #193](https://github.com/lbeezr/thousand-unit-skirmish/pull/193), `331df72`; [postmerge checks](qa-crowd-forward-progress-2026-10-03.md#integration-and-remaining-evidence) pass. | Planning constants, queue-slice helper and diagnostics only. | 209 postmerge checks; nine route pairs preserve hashes; native large routes and recovery. Atomic-search overshoot remains explicit. |
| 2 · complete | The parked-formation stall reproduces with a one/two-tick older Move. Bounded repulsion merged in [PR #209](https://github.com/lbeezr/thousand-unit-skirmish/pull/209), `64cc391`; independent review and [postmerge checks](qa-crowd-forward-progress-2026-10-03.md#4-october-postmerge-acceptance) pass. | Only `getMoveVector`'s final force combination and focused tests/tools. Combat-owner targeting/stances remain untouched. | 235 postmerge checks; all eight headings on both seats; four large parked cases twice; nine terrain route pairs; native parked controls and active/idle restarts at the exact merge source. |
| 3 · qualification complete | The [1/4/8 comparison](qa-move-planning-tick-budget-2026-10-04.md) recommended four turns, but [paid whole-tick qualification](qa-paid-battle-tick-budget-2026-10-04.md) failed the 33.333 ms maximum at 2,000 units. Retain callback default; 1/4/8 remain reproduction controls. This decision is complete. | Movement planner plus the single allocated outer-tick hook; inner combat/Worker/wildlife/mode bodies stay with their owners. Any later default proposal first needs evidence addressing the recorded non-planning tail. | Four native paid battle/economy/recovery runs pass functionally. Four's two budget overruns have zero planning turns. Repeated candidate traces, Stop/replacement, FIFO fairness, topology and recovery remain covered. This does not complete the all-command pipeline. |
| 4 · pending capture | Complete the corrected rendered 2,000-unit workload through paid economy, combat and restart. | Existing browser workload; identified sandboxed WebGL2/runtime and device/network profile. | Actual rendered run, authoritative goals/positions, paid work and recovery. Native/tool-only checks cannot close the render/deployed acceptance gap. |
| 5 · allocation validated | [Snapshot allocation comparison](qa-snapshot-row-allocation-2026-10-04.md) validates the one-line base-row construction change in [PR #259](https://github.com/lbeezr/thousand-unit-skirmish/pull/259). Retain callback default and open deployed/rendered acceptance. | Only base-row literal plus focused regression/probe and QA; no visibility change. | Exact sparse rows/private frame bytes and recovery checks; three fixed allocation pairs reduce estimates 44.9–46.5%, both ordinary process profiles confirm direction, all twelve paid process runs pass. Every timing distribution is retained; no uniform speedup, capacity or maximum-budget-pass claim. |
| 6 · investigation complete; no optimization selected | [Remaining tail analysis](qa-remaining-tick-tail-2026-10-04.md) locates the plain callback maximum in broadcast and diagnostic maximum in simulation. A read-only zero-separation `hypot` guard probe has inconsistent allocation results and is not shipped. | No runtime write. Future proposals require source-qualified child timings and actual branch/call counts; keep rendered backlog at rank 4. | Six fixed probe processes retain hashes, exact vector checks and the adverse repeat. No uniform hotspot cause, scheduler switch or whole-game gain asserted. |
| 7 · source validation in progress | [Direct open-ground Move](qa-direct-open-ground-move-2026-10-04.md) fixes the reproduced Manhattan fast-path turns with a safe, uniform-level straight waypoint. | Planner/application helpers and construction segment intersection; existing physical collision, Worker/combat flow fields, renderer and timing unchanged. | Twelve twice-repeated trajectories remove 26–41% excess distance for non-axis orders. Focused corner, fractional-start, group, queue and recovery regressions; retain independent review, release/native checks and separate deployed/pixel acceptance. |

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
