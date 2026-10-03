# Movement and pathing workstream

Updated 3 October 2026. This is the ranked execution backlog for the user-owned
movement lane; the [roadmap](roadmap.md) remains the product priority source.
Each slice owns its regression, review, normal authorized merge and acceptance.
Evidence must name the source/workload and preserve failures.

## Write boundaries

This lane owns `src/unit-movement.mjs`, `src/unit-obstacle-detour.mjs`, formation
assignment and path-planning helpers, and their focused diagnostics/tests.
The current slice touches only `processMovePlanningSlice`, its constants and
diagnostic record in `server.mjs`, plus pathing tests/tools. Target acquisition,
`getUnitAttackPath`, attack completion, stances, damage and `simulateTick` remain
with the combat owner. Central tick/command integration needs a concrete shared
interface decision before overlapping edits. Water commands remain with the
Skiff owner; art, rendering and map rules remain with their respective lanes.

## Ranked backlog

| Rank / status | Outcome and next action | Write boundary / dependency | Acceptance |
| --- | --- | --- | --- |
| 1 · active | Replace timer-selected planning work with deterministic destination/node budgets. Reproduce fast/delayed-clock service differences, then make one bounded correction. | `processMovePlanningSlice`, its work limits and diagnostics; pathing tests. No combat-loop edit. | Identical service work under changed clock observations; bounded destination attempts; whole-search node budget with documented atomic-search overshoot; stale Stop/replacement guards and waiting-order fairness; both-seat large-route traces, native planning/restart, focused review and postmerge checks. |
| 2 · next | Reduce the preserved parked-formation replacement stall to a repeatable case, comparing current and baseline source before selecting a steering correction. Both-seat 2,000-roster route completion is already measured. | Movement test adapter and crowd scenarios first; `getMoveVector`/local-detour edits require exact shared boundary if combat also edits them. | Reproduce the two-unit stall independently, then prove selected replacements arrive while idle/Stop/Hold actors retain intent and position; zero illegal steps, both-seat repeat hashes and operation counts. No hardware speedup claim from an unisolated host. |
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
formation leaves two seat-1 Infantry stalled; this remains the next narrow
correctness investigation, separate from the deterministic planning correction.

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
