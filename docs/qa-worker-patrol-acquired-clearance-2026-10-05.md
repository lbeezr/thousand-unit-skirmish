# Acquired Worker Patrol static-clearance characterization

Caller owner `01a10933-e913`; current runtime baseline
`6c5dde0feeaa3b2f026825fe401a06676fc462d9`. This continues the documented
Worker Patrol acquired-pursuit characterization. It does not restart the canceled
acquired-AttackMove handoff. Core owns planner, publication/rejoin and economy
quotas; crowd owns steering/body pairs and the original queued-wall deadline;
architecture owns checkpoint-envelope import/prefix and XL audit bindings.

The only initial edits are a test-only opt-in pre-write Patrol observation in
`pathing-replay-fixture.mjs`, a small actual-command probe/regression and this
receipt. No production host, attack/Sheep flow or target policy is changed by
characterization. Actual substeps carry the acquired Patrol state at the write,
avoiding classification from the later target-free tick state.

The [exact-source baseline receipt](qa-evidence/worker-patrol-acquired-2026-10-05/baseline.json)
is captured at clean observation head `e75a887577f9f37f70b3c1d7360d90f1b4493c15`;
production server SHA-256 is `b9e0a1426aa08815d309f5a1152f1ea26f8610f62840b6c4a46e7040dcf65a56`.
Eight public-source command journeys cover both seats, open-ground and
near-stone starts, and acquired target kill/loss through fresh-server replay
recovery. No actor pose, HP, route, target, checkpoint or body admission is
injected. Stance, original Patrol cells/leg, acquired anchor, saved continuation,
range/damage and unaffected actors remain checked. The near-stone start is
`(.79,.95)` beside stone `(1,1)`, reached by ordinary Move; the independently
commanded enemy Worker settles at `(5.5,.5)` before Patrol is accepted.

Seat 0's near-stone kill/loss cases each execute 3 **strict-clearance failures** (`allowEscape:false`) and
one new static contact. Both still meet their original policy/recovery outcomes.
Two of those three steps also fail physical admission with the existing
`allowEscape:true` rule; the third is a permitted monotone escape from the prior
overlap. The baseline field `unsafeSteps` counts strict-clearance failures,
not physical rejection counts. The observer now records both measures.
Seat 1's corresponding cases and all four open-ground controls have zero unsafe
substeps/contacts. This is an asymmetric, attributed sample; no general or
symmetric acquired-pursuit failure is inferred. The existing four Patrol policy
controls previously passed while explicitly excluding acquired substeps from
static acceptance. The new strict four-case regression must become green before
default registration. Diagnostic exit 0 means collection, not clearance.

```sh
node scripts/worker-patrol-acquired-clearance.mjs OUTPUT.json
node --test scripts/worker-patrol-acquired-clearance.test.mjs
```

The proposed smallest consumer is a separate acquired Worker Patrol predicate
and existing `.18` fallback. First test whether those existing physical guards
suffice without changing a host hook. If selected-route rejoin consumption is
needed, allocate only the two existing acquired publication/repath guards in
`simulateTick` with the current affected core/crowd owner before edits. Preserve
original selected tails/leading waypoints, range/leash, targets and orders. No
broad flow rewrite, global pruning, invented planner or economy/crowd changes.

Source/reviewed-head receipts belong in the associated PR. Recovery here means
fresh server-module fixed-tick replay, **not native cold-process/WebSocket
recovery**. Native, full-suite, release/deployed identity and rendered acceptance
remain OPEN. The exact main source tree is represented with two explicitly
omitted unavailable >1 MiB Spearman PNG bodies; complete packaging is OPEN.
Art backing N/A: internal movement characterization, no presentation change.

A rejected profile-only candidate was tested separately: the strict near-stone
regression remained 2/4, with seat0 kill failing original 1,600-tick productive
completion and seat0 loss admitting no acquired movement. It was reverted;
no runtime change is retained. This distinguishes clearance from liveness.
The concrete proposed host scope is only the `simulateTick` acquired-unit
repath and initial acquired-publication rejoin condition guards (baseline
lines 8877 and 8978), plus the import of a separate Worker Patrol acquired
predicate. Both already call `rejoinSelectedUnitRoute` with the active body
radius and original automatic/static prefix guard. Preserve `getUnitAttackPath`,
`boundedAutomaticApproach`, selected tails/leading waypoints and original policy.
Current crowd/core hook coordination is pending before that host implementation;
the diagnostic remains independently usable and the strict red regression
stays outside default CI. No stalled candidate is promoted as an improvement.
