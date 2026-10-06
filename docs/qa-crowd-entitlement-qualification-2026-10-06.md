# Independent PR541 original-contract qualification — 6 October 2026

[Candidate PR541](https://github.com/lbeezr/thousand-unit-skirmish/pull/541) ·
[Candidate contract](https://github.com/lbeezr/thousand-unit-skirmish/blob/30a2d7099527fef17d60f53cd87456f1b54883fb/docs/crowd-moving-entitlement-contract.md#production-adapter-candidate--6-october-2026) ·
[Full public-safe receipt](qa-evidence/crowd-entitlement-qualification-2026-10-06/receipt.json.gz) ·
[Public evidence seal](qa-evidence/crowd-entitlement-qualification-2026-10-06/public-evidence-seal.json)

**The full original-contract qualification remains failed: candidate and baseline
both pass5/8 original journeys and26/28 registered controls.** No baseline-passing
journey or matched fairness case regresses. The candidate actually publishes and
consumes five named steps in the original wall cases; passing results are not a
global no-op. The three existing wall arrival failures remain. No merge or fix is
made by the qualifier. Core retains the candidate and the next policy decision;
PR529 remains rejected.

Exact baseline is `a71fcb46acb767c60cc26b46d2f1d04c7ab1d77a`; candidate is
`30a2d7099527fef17d60f53cd87456f1b54883fb`. Both worktrees remain clean.
Original helper bodies, seed881, commands, actor-generation handling, physical
oracles, progress/repair assertions and deadlines are unchanged. Fixed journeys
preserve their separate actual fresh generations; only matched fairness cases
claim identical complete checkpoints. No identity normalization is used.

## Original eight journeys

All arrivals are out of64. Wall clocks are absolute simulation ticks; gate clocks
are relative to gate close. The unchanged ceiling is2700.

| Original journey | Baseline arrivals / tick | Candidate arrivals / tick | Candidate published / consumed / cancelled |
| --- | --- | --- | --- |
| Seat0 active wall |64 /1095|64 /1059|1 /1 /0|
| Seat0 queued wall |57 /2700, failed|57 /2700, failed|0 /0 /0|
| Seat0 wall removal |64 /1070|64 /1089|2 /2 /0|
| Seat1 active wall |64 /1195|64 /1195|0 /0 /0|
| Seat1 queued wall |0 /2700, failed|0 /2700, failed|2 /2 /0|
| Seat1 wall removal |4 /2700, failed|4 /2700, failed|0 /0 /0|
| Seat0 closing gate |64 /1112|64 /1112|0 /0 /0|
| Seat1 closing gate |64 /2610|64 /2610|0 /0 /0|

The receipt preserves per-actor arrivals, queue handoffs, remaining queue/pending
state, assigned-goal distinctness, repair records and observed wait/work maxima.
For unfinished journeys these measurements do not establish finite liveness.

Across608,155 baseline and597,258 candidate military substeps, both have zero
static-contact writes, zero **new** body-pair contacts and zero illegal inherited
escapes. Inherited contacts exist and are reported separately. All64 inactive
military actors retain observed pose/intent per fixed case. Candidate maximum
actual shared admissions is78, below128; maximum returned neighbors is45, below64.
Controller projection/priority work is recorded separately. These are workload
observations, not CPU performance or capacity claims.

Worker writes remain a distinct caller diagnosis: both sources have zero static
contacts, eight new body-contact writes and23 writes rejected by the generic body
sweep. These prevent a universal/full-scene caller-body-clearance claim. The
military results do not conceal these Worker contacts or attribute a new failure
class to PR541.

## Matched fairness and original registered controls

The original forest-opposing box16, bridge16 and paid-gate16 checkpoints are
identical between sources, including actual generations and input hashes.
Each case reaches all32 assigned goals at last-seat ticks`[410,445]`, gap35
against the unchanged150 limit, within900 ticks. Static/body contact counts are
zero; existing progress and repair bounds pass. **No named grant publishes,
consumes or cancels in these matched fairness cases.** They qualify preservation
of the tested journeys, not active grant service in opposing traffic.

Original registered command:

```sh
node --test scripts/crowd-body-journeys.test.mjs scripts/forest-gap.test.mjs
```

Both exact heads pass26/28. The two shared failures are seat0/seat1 bounded64
forest staging: `ordinary staging Move completes before the bounded diagnostic`.
The retained forest, both mirrored bridge/gate repetitions, Stop/replacement,
checkpoint continuation, parked endpoint/departure, paid-obstruction and smaller
forest controls otherwise pass. This run does not repeat the core's separately
reported124 source controls or its reviewer's67 tests and does not claim those
results as qualifier execution.

## Actual entitlement activation

Read-only wrappers observe the exported live protocol instance used by production
selection and the real host finalizer. They pass original arguments/results
unchanged and do not modify actors, state, policy, timing, proposals or receipts.
Successful publication counts only non-null `publish` results; consumption counts
only true `finish` results after the host's real finalized movement receipt.
Refused requests/publications are not issued grants or grant cancellations.

Candidate totals in the eight cases:

- 4,764 request calls,2,738 accepted requests;
- 2,735 publication attempts, five successful publications;
- five prepared/committed ingress steps and five admitted/consumed named services;
- zero cancellations and zero outstanding reservations.

The event chain records owner30/recipient54 at591→592, owner60/recipient63 at
599→600 and617→618, and owner119/recipient120 at784→785 and808→809. Five real
services establish activation; two services in the still-failed seat1 queued wall
do not establish arrival. Zero cancellations means this workload does not newly
exercise or qualify the cancellation path.

## Preserved observer incompatibility

The canonical candidate replay adapter's `observeMovement:true` path fails before
creating a gate fixture: its exact string matcher still expects the old standalone
Worker steering/fallback guard. PR541 combines those two guards with capsule
admission. The failure and its exact candidate source are retained in the
[tooling receipt](qa-evidence/crowd-entitlement-qualification-2026-10-06/candidate-gate-observer-incompatibility.json.gz).

Only the private observation adapter was made compatible: its two match strings
and observational rejection insertion now surround the existing combined Boolean
guards, preserving operand/call order and the same break. Combined rejection is
truthfully tagged `body-or-capsule-wait`; terminal Worker matching stays unchanged.
Production, canonical test source, case actions/assertions/deadlines and grant
semantics are untouched. The six completed wall cases are not repeated; only the
two previously unstarted candidate gate cases run with this observer. Core retains
the canonical-tooling correction. The public provenance and adapter snapshot make
this qualification distinction inspectable.

The full local107-file qualification seal preserves raw checkpoints and detailed
failed evidence; all92 original PR529 seal entries also remain unchanged. The
public subset excludes raw room checkpoints, session/match identifiers, credentials
and private state. Its receipt, canonical source hashes, observer source, import
provenance, compatibility source and original test logs have a separate public seal.

Crowd retains independent original-contract qualification. Core
`01a107ba-7977-7764-9574-17cb0c3a102e` owns PR541, its remaining arrival and tooling
failures and any next change. Art backing is N/A. These are fixed-tick CPU fixtures
with canonical planning drains, not native process scheduling. Packaging,
identified deployment and ordinary-game rendered proof remain separate and open;
no release, deployed identity or visual result is claimed.
