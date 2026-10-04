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
with the combat owner. Central tick/command integration needs a concrete shared
interface decision before overlapping edits. Water commands remain with the
Skiff owner; art, rendering and map rules remain with their respective lanes.

## Ranked backlog

| Rank / status | Outcome and next action | Write boundary / dependency | Acceptance |
| --- | --- | --- | --- |
| 1 · complete | Clock-independent service work merged in [PR #193](https://github.com/lbeezr/thousand-unit-skirmish/pull/193), `331df72`; [postmerge checks](qa-crowd-forward-progress-2026-10-03.md#integration-and-remaining-evidence) pass. | Planning constants, queue-slice helper and diagnostics only. | 209 postmerge checks; nine route pairs preserve hashes; native large routes and recovery. Atomic-search overshoot remains explicit. |
| 2 · complete | The parked-formation stall reproduces with a one/two-tick older Move. Bounded repulsion merged in [PR #209](https://github.com/lbeezr/thousand-unit-skirmish/pull/209), `64cc391`; independent review and [postmerge checks](qa-crowd-forward-progress-2026-10-03.md#4-october-postmerge-acceptance) pass. | Only `getMoveVector`'s final force combination and focused tests/tools. Combat-owner targeting/stances remain untouched. | 235 postmerge checks; all eight headings on both seats; four large parked cases twice; nine terrain route pairs; native parked controls and active/idle restarts at the exact merge source. |
| 3 · pending dependency | Move completed path results into an agreed authoritative tick phase if the current asynchronous application contract needs correction. Inspect accepted-tick/result generations before proposing changes. | Shared command/tick pipeline with combat owner. | Same accepted command log gives the same committed outcomes; replacement/Stop cancels old results; FIFO/fair queue service and recovery remain correct. Do not equate fixed slice budgets with a completed tick-pipeline redesign. |
| 4 · pending capture | Complete the corrected rendered 2,000-unit workload through paid economy, combat and restart. | Existing browser workload; identified sandboxed WebGL2/runtime and device/network profile. | Actual rendered run, authoritative goals/positions, paid work and recovery. Native/tool-only checks cannot close the render/deployed acceptance gap. |

## Current inspection

At `4467986`, 42 focused movement checks pass. All seven existing fixed-tick
route cases repeat twice and complete, including the 256-unit one-cell choke
at tick 1,031. Temporary no-progress windows reach 289 ticks there; this is a
completed crowded route, not a stranded-order reproduction.

An initial 128×96, 2,000-roster probe sends 996 Infantry through a one-cell choke.
All reach their assigned goals by tick 2,018 with zero illegal or disconnected
steps. Its initial planning job reports 943 searches and 472,109 expanded cells.
Host timings are observational. A durable mirrored probe is the next baseline;
the initial scene is retained separately rather than silently substituted.

The [planning QA](qa-move-planning-work-2026-10-03.md) now retains the durable
mirrored 128×128 baseline, unchanged candidate traces and native recovery.
Both initial 996-unit routes complete. An additional replacement into a parked
formation leaves two seat-1 Infantry stalled. The [crowd QA](qa-crowd-forward-progress-2026-10-03.md)
preserves its baseline and candidate separately: stacked parked Infantry reverse
the movement vector; a bounded separation force resolves that reproduction.

`processMovePlanningSlice` currently stops work by elapsed milliseconds. A
clock-independent service budget is the first concrete contract correction;
native interleaving remains separately tested and broader tick-pipeline work
is explicitly deferred to the shared boundary above.

## Research invariants

The user-supplied *RTS source patterns for Vaelora* study was read through Library
in full (205 lines, 43,504 bytes). It is source-linked research, not imported
implementation. Use fixed operation/size limits in authoritative code; separate
formation assignment, route planning, steering and actual arrival; keep route
ownership/generation checks; coalesce compatible work only with topology and
movement compatibility; test dense chokepoints separately from distributed armies.
No engine port or third-party source copying is proposed.

The `game-dev` CLI is currently unavailable. Sealed hardware-comparison goals
remain unavailable until the documented tool/evidence path is restored. Current
correctness and operation counts use the repository's real-body/native adapters;
they do not assert comparable CPU/GPU speedup or supported player capacity.

## Next available work and dependencies

The inspected route matrix has no remaining stranded order at `64cc391`. Do not
select another steering rewrite from timing noise. The next read-only tick-phase
investigation should record accepted command ticks and planned-result commit ticks,
then propose a bounded interface if correction is needed. A proposed shared boundary
is to queue generation/navigation-tagged path results and commit them before
`simulateTick`; command intake, Stop/replacement invalidation, applied notices and
checkpoint recovery need an agreed phase with the combat owner before shared edits.
This is a proposed interface, not implemented or accepted behavior.

The full rendered 2,000-unit workload remains blocked by the actual Linux browser
sandbox/profile-storage failure. Resume with a provider runtime supporting that
sandbox, or a parent-coordinated capture environment. Comparable performance goals
also require the unavailable `game-dev` evidence path. Native progress tests do not
close either dependency, and no deployed revision is asserted here.
