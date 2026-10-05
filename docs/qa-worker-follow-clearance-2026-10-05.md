# Worker Follow static-clearance adoption

Owner: caller adoption. This is a bounded continuation of [the movement plan](movement-pathing-workstream.md#remaining-caller-steps-after-pr432)
and [PR436's independently reproduced audit](https://github.com/lbeezr/thousand-unit-skirmish/pull/436).
It does not close universal movement or ordinary rendered acceptance.

## Contract and allocation

Core [allocated the exact boundary](https://github.com/lbeezr/thousand-unit-skirmish/pull/434#issuecomment-5988456734):
`workerFollowTravelMovementActive` in `src/combat-movement.mjs`, its existing
`.18` Worker fallback in `activeLandMovementBodyRadius`, and only the existing
`assignFormationMove` queue-append `retainFollowCatchUp` condition. The predicate
is captured before persistent cancellation; ordinary-point validity and existing
point creation remain after cancellation.

The original controller still selects the friendly leader/generation, ID-derived
offset cell and four-cell deadband. The shared planner, durable goal, route result,
publication ledger, rejoin guards and land executor consume the body profile.
No movement algorithm, saved activation marker or productive Worker policy is added.
Idle/exhausted Follow is not promoted into an extra queued catch-up leg.
Worker Patrol and Worker AttackMove remain separate policies; core owns general
Worker flow/Return/bounds and crowd owns steering/body pairs and liveness.

## Actual-command evidence

The retained clean `f1336896` baseline covers both seats, real callback/tick modes
0/1, live, separate cold restore and queued-before-publication cold continuation.
At `(.79,.95)` beside stone `(1,1)`, Worker Follow to a friendly Worker at
`(6.5,.5)` admits 16 unsafe static-circle steps and one new penetration in all
six seat-0 cases. The six seat-1 cases are safe under the original ID offset.
All eight queued audit endpoints already finish, including the four separately
excluded Patrol cases. This is clearance adoption rather than a pending-goal
liveness fix; no symmetric Follow failure is inferred.

The initial candidate collector (working tree based on `51c3085f`, honestly
dirty) observes zero unsafe steps/new penetrations in all 12 Follow cases and
keeps original goals 1576/1640. Worker Patrol still records 16/one in each of its
12 cases; all eight queued endpoints still finish. The collector's exit 0 means
collection, not a physical pass. The final PR receipts retain clean exact-head
repeats and runtime hashes separately from this initial observation.

`scripts/worker-follow-journeys.mjs` supplies strict actual-command checks:

- Both-seat, both-mode contact and arrival through accepted, pending and active
  separate-module cold recovery; original leader/generation/goal and settled
  deadband remain unchanged.
- Pending/active queued Move keeps the accepted route object/index, planning job,
  goal and revision; the existing point conversion allows the cleared first leg
  to use the Worker body. The queued fractional endpoint promotes once.
- Stop, Hold and direct Move explicitly replace Follow across cold recovery.
  Foreign/stale leader and cycle rejection leave the selected intent intact.
- Idle/exhausted queued replacement adds no catch-up; an API-authored valid point
  survives conversion. Queued Worker AttackMove retains its separate policy.
- A real paid palisade obstruction and a moving leader exercise the unchanged
  repair/replan path. No positions, HP, routes or job fields are patched.
- Naturally gathered Food survives explicit Follow/Move replacement and cold
  recovery, then credits once on real Return. Follow clears the replaced gather
  intent; it does not resurrect that job or harvest during travel. A real paid
  House remains paid and present when Follow replaces its construction intent.

The valid-point boundary test alone assigns an API-authored same-revision point;
it changes no position, route or job. All other journeys use actual commands and
complete validated checkpoints. Static observation records admitted production
substeps rather than a tick chord. This does not measure body-pair clearance.

The initial 39-check baseline run has 13 passes and 26 expected failures: absent
new predicate/profile/queue conversion, plus real seat-0 unsafe movement. This
is distinct from the original measured 16-step baseline. The candidate's expanded
51 checks plus four adjacent palisade controls pass; exact-head review, broader
checks and native/package results belong in the final PR receipts.

## Delivery and remaining acceptance

This predicate/profile is the default path for accepted land Worker Follow; no
preview switch or alternative planner is introduced. Art backing is N/A for this
internal policy correction. Release packaging must include the three changed
runtime modules. Source SHA, clean package digest, native process receipt and
served/deployed identity remain separately recorded.

`scripts/worker-follow-scenario.mjs` uses real WebSocket seats and four active
process restarts across Follow and queued catch-up. CPU substep observations and
natural cargo/site controls remain separate from that native transport evidence.
Neither establishes rendered frames. The caller retains identified-release
ordinary-game acceptance with the existing staging verifier/capture owners linked
from [PR432](https://github.com/lbeezr/thousand-unit-skirmish/pull/432#issuecomment-5988158549).
The historic sandbox/storage zero-frame renderer block remains open; no auth,
dispatch, provider or renderer retry and no metadata-only visual pass is authorized.
