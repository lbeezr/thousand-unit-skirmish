# Rejected directed-join arbitration — 6 October 2026

[Movement workstream](movement-pathing-workstream.md) ·
[Failed PR529](https://github.com/lbeezr/thousand-unit-skirmish/pull/529) ·
[Preserved candidate design and controls](https://github.com/lbeezr/thousand-unit-skirmish/blob/2882498c096e33549d5f4c52e7a176e5aacd2ed5/docs/qa-crowd-directed-join-2026-10-06.md) ·
[Original temporal witness](qa-construction-temporal-witness-2026-10-06.md)

**Independent journey/fairness qualification rejected PR529. Do not merge it.**
Its exact source `2882498c096e33549d5f4c52e7a176e5aacd2ed5` remains unchanged,
draft and unmerged. Core retains implementation ownership. The verdict below
was relayed by the parent from the existing crowd qualification owner; it was
not rerun by core. Art backing is N/A, internal source evidence.

Baseline is `31af0275698d369e83705771fdfa6983358a1742`. Candidate selector SHA256
is `a9f35048d541c308a85034ab8a3ea94e41f9a8ab042be2c368596afc64803312`.
The original seeds, commands, safety assertions, 2700-tick arrival ceiling and
150-tick fairness limit are unchanged.

## Reported independent qualification

All arrival counts are out of 64 actors; both sources pass 5/8 journeys, with
different failures. The improved seat 0 queued wall does not establish overall
success or compensate for the formerly passing seat 1 gate regression.

| Original journey | Baseline | Candidate |
| --- | --- | --- |
| Seat 0 active wall |64|64|
| Seat 0 queued wall |57|64, complete at tick 1307|
| Seat 0 wall removal |64|64|
| Seat 0 gate |64|64|
| Seat 1 active wall |64|64|
| Seat 1 queued wall |0|14|
| Seat 1 wall removal |4|7|
| Seat 1 gate |64, complete at tick 2610|1 at tick 2700|

Matched-input forest/bridge/paid-gate fairness reports a 35→239-tick gap, exceeding
the unchanged 150-tick limit. All 32 actors arrive with zero contacts. Comparable
registered checks regress 104/106→101/106; two forest staging failures are shared.
Qualification reports 635,096 military substeps with zero static-contact,
new-body-contact or illegal-escape failures. Worker contact failures persist on
both sources and remain a separate unresolved domain.

The 59 temporal source controls pass. The public PR527 record is unchanged: 185
historical decisions and 182 controller continuity comparisons remain reproducible.
Candidate replay preserves 176 decisions and changes nine to retain an already
admitted forward waypoint improvement. This establishes bounded decision behavior;
it does not prove counterfactual whole-match liveness or fairness. The tick 594
.0236635 gain alone does not reset progress credit.

## Causal diagnosis boundary and next evidence

No retained gate/fairness actor-level trace is available to core yet, either in
the current cloud workspace or on PR529. The parent is coordinating the original
qualification owner's retained artifact. Aggregate arrival/fairness counts identify
the regression but do not identify its earliest actor, tick or controller handoff.
The queued-wall tick 594 witness is a different case and must not substitute for
the newly failing gate or fairness sequence.

The next bounded analysis compares retained baseline/candidate inputs at their
first divergence: actor identity and pose, current/queued route and revision,
actual serial neighbor query, manoeuvre/progress state, admitted best proposal,
claimant directions/directed joins, veto decision and committed substep. This
must distinguish a changed arbitration from later consequences of already
different geometry before proposing any smaller condition.

Until that causal evidence supports a safe narrowing, no runtime refinement or
repeated broad trial-and-error journey run is justified. No assertion, deadline,
radius, safety predicate or fairness contract is weakened. Retire the exception
if it cannot be safely narrowed. PR525 remains retired, closed and unmerged.
This documentation change ships no candidate code; release/deployment and actual
normal-game rendered movement acceptance remain open.
