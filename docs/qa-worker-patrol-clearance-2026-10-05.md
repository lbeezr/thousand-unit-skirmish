# Worker Patrol and target-free objective clearance

Owner: caller adoption, continuing the [movement caller plan](movement-pathing-workstream.md#remaining-caller-steps-after-pr432)
after [Worker Follow PR440](https://github.com/lbeezr/thousand-unit-skirmish/pull/440#issuecomment-5988860467).
This bounded outcome is target-free Worker Patrol and its retained objective leg.
General Worker economy/publication remains core-owned, and crowd owns steering/body pairs.

## Contract and exact scope

The [disjoint predicate/profile boundary](https://github.com/lbeezr/thousand-unit-skirmish/pull/438#issuecomment-5988970802)
is `workerPatrolObjectiveMovementActive` in `src/combat-movement.mjs` and its
existing `.18` Worker fallback in `activeLandMovementBodyRadius` only. The
existing controller, original endpoint cells, route planner/results, queue,
target policy, generation/revision and checkpoint rules remain authoritative.

Patrol cancellation by queued Move retains `attackMove:true`. That target-free
state is indistinguishable from direct Worker AttackMove without adding a saved
marker. The explicit contract therefore covers both persistent Worker Patrol and
target-free Worker AttackMove with no persistent order. It preserves that flag
and the accepted pending/active route/job rather than forcing ordinary-point
semantics. Queued Move subsequently promotes through its existing precise point;
queued AttackMove retains its original cell objective. No host/queue or schema
change is intended. Legacy validator-accepted Patrol with `attackMove:false`
continues to derive travel from its persistent intent.

The profile excludes acquired unit/building targets, stance combat/return,
Follow, productive gather/build, water, dead or held actors. Worker acquired
combat and military/Sheep policies retain their separate contracts. Carried
cargo alone does not hide an explicitly accepted order. Explicit replacements
clear prior work rather than reviving cancelled jobs; paid sites remain paid.

## Retained decisive baseline

The clean merged PR440 collector at `c79b0edf833fec68effe426a113deb540e069e81`
records both seats, callback/tick planning modes 0/1, live, separate cold restore
and queued-before-publication continuation. Worker Patrol from `(.79,.95)` next
to stone `(1,1)` towards `(6.5,.5)` admits 16 unsafe static-circle steps and one
new penetration in each of all 12 Patrol cases. Each successful Patrol queue
control still reaches `(-3.5,-3.5)`; all eight mixed Follow/Patrol controls
complete. Follow's 12 cases remain safe. This is a measured clearance correction,
not a claim to repair queue liveness or replace historical evidence.

The initial 45-check author baseline has 10 passes and 35 expected failures;
independent preparation with the added saved-flag controls has 49 checks,
10 passes and 39 expected failures against the unchanged baseline runtime.
These scoped baseline checks are separate from the clean 24-case collector.
The expanded final controls include acquired-target recovery and are qualified
at the frozen source in the PR receipts.

## Actual-command qualification

`scripts/worker-patrol-journeys.mjs` observes production substeps through actual
commands and complete validated checkpoints. It exercises both seats/modes,
accepted/pending/active cold continuation, original endpoint cycling, preserved
queued route objects/indices/jobs/revisions, cancelled objective and fractional
queued completion, explicit Stop/Hold/Move, the exhausted AttackMove queue window,
paid obstruction and paid unfinished construction, naturally gathered cargo and
one real Return credit, rejected foreign/invalid replacements, and direct/queued
Worker AttackMove. The legacy flag control changes only that validator-accepted
saved flag and is identified separately.

Both-seat acquired-target kill/loss and cold-resume controls preserve saved
objective/Patrol endpoints, acquisition anchors and original legal-range damage.
Loss verifies the first real restored objective boundary and a separate cold
restore; a still-visible fleeing enemy may be acquired again under the unchanged
policy, so peaceful endpoint arrival is not asserted for that control. Kill
controls additionally reach the objective or resume original endpoint cycling.
Acquired pursuit stays outside the new profile and outside the static-contact
acceptance claim. No pose, HP, route, acquisition or job patch is used.

`scripts/worker-patrol-scenario.mjs` supplies native commands through both real
WebSocket seats and four process restarts during active Patrol and its cancelled
queued objective. Native timing uses the longer `(20.5,.5)` endpoint to keep
that leg active across restart; CPU contact/cycle witnesses retain `(6.5,.5)`.
Exact reviewed/merged source, tests/types, runtime hashes and package identity
belong in the final PR receipts; preparation is not a test or visual pass.

## Delivery and remaining acceptance

This is a default runtime profile, with no preview switch or duplicate planner.
Art backing is N/A for this internal movement policy correction. Release COPY
already includes both runtime modules; clean package inventory/startup must
verify their actual merged bytes. Source, package digest, local served identity
and deployed identity remain separately recorded.

Full docs validation stays incomplete while the upstream compressed crowd blob
`88bd40aac0e05890250ee0cdcf8ad43d9d62d70a` is unavailable through the connected
transport. The clean sparse checkout excludes exactly that docs-only path;
runtime completeness is independently verifiable. No fabricated file or full
docs pass is claimed. Ordinary rendered/identified deployed acceptance remains
OPEN with the [existing verifier/capture follow-through](https://github.com/lbeezr/thousand-unit-skirmish/pull/432#issuecomment-5988158549).
The historic sandbox/storage block produced zero frames; no auth, dispatch,
provider or renderer retry or metadata-only visual pass is part of this slice.
