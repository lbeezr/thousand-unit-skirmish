# Acquired Worker Patrol shared body admission — 6 October 2026

Owner: caller adoption `01a10933-e913`. Shared helper/selector implementation
and construction liveness remain core-owned. Art backing: N/A.

## Scope and current result

The candidate is based on PR519 merge
`7c031a05b2fadd1c20af93e64a00980f886d8d3b`, after PR517's static correction.
It adds only the existing `workerPatrolAcquiredMovementActive(unit)` term to
`workerLocalBodyRadius(unit)`, per the [single-seam agreement](https://github.com/lbeezr/thousand-unit-skirmish/pull/513#issuecomment-6006885891).
The existing `.18` radius now couples shared selection, bounded fresh-roster
waits, final steering/fallback clamping and the four existing admissions.
Construction activation, work poses, rejoin guards and same-cell combat are
unchanged. Four extracted source fixtures bind the actual newly referenced
predicate; no runtime policy is stubbed or duplicated.

**Draft only; productive kill acceptance fails.** Eight original both-seat,
warm/fresh-module kill/loss cases now have zero rejected executed body sweeps,
zero new contacts and zero strict static failures. All four kill cases fail the
original 1,600-tick bound, with zero hits and target HP100. All four target-loss
cases retain the original continuation/recovery bounds. No bound is enlarged.
Existing static Patrol controls independently reproduce eight kill failures;
replacement and target-loss controls pass. Candidate runtime SHA256:
`ee60143d83d81bd3e672d93667d43ce2572788df75c143dc5038a3e632e14f2f`.

The original PR508 runtime admitted six unsafe sweeps and one new pair contact
per case despite productive kills. Safety and liveness are separate acceptance
conditions; this candidate is not a completed fix.

## Real commands and observations

`node scripts/worker-patrol-acquired-body-pairs.mjs REPORT.json` retains the
original Move/Stop/Patrol witness, parked friendly Infantry, public target-loss
Move, unchanged production function bodies and actual serial pre-write neighbor
poses. It checks aggregate and individual body admission, legal range/damage,
unchanged parked/unaffected actors, original anchors/orders/routes and cold
checkpoint identity. Registered persistent-command tests consume all eight
cases. Failures retain final authority state and bounded actual selector traces.

Initial measurements end seat0 at `(4.001,.9536390482584135)` and seat1 at
`(4.001,.999)`, with the acquired target at `(5.5,.5)`, selected route still active,
resume route and Patrol intent intact. The final selected waypoint is the
occupied target cell; the existing selector rejects a stationary body at its
endpoint before generating approach proposals. Core owns this selection/input
contract. Caller must not remove the target from the physical body oracle or
invent a second steering policy. A concrete shared decision is needed before
further runtime edits or promotion.

No observed acquired substep in these eight cases uses `same-cell-combat`.
That separately identified writer remains an explicit uncovered phase, with its
existing behavior preserved; routed admission does not qualify every combat write.
The original construction/crowd wall suite is not duplicated.

## Validation and remaining acceptance

Author candidate adjacent movement/body/forward/Return checks: 295/295 pass.
Exact-head independent integration review, eight-case evidence, bounded native
both-seat recovery and required types/imports/docs/pack results are recorded on
the owning PR. Keep native authority/recovery separate from the failed productive
body workload. Do not merge while original kill bounds fail.

Two previously unavailable Spearman runtime/source atlas bodies remain omitted
from this local checkout with their exact expected Git references. This is not
a complete package; packaging, served/deployed identity and ordinary rendered
acceptance remain OPEN. No denied download/authentication retry, private source,
Mac or credits are used. Construction liveness remains a separate core failure.
