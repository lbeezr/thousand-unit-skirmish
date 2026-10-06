# Queue following and lateral rejoin geometry — 6 October 2026

[Movement workstream](movement-pathing-workstream.md) ·
[Forest first decision](qa-crowd-first-decision-2026-10-06.md) ·
[Wall temporal witness](qa-construction-temporal-witness-2026-10-06.md) ·
[Rejected PR529](qa-crowd-directed-join-rejection-2026-10-06.md)

This source-only slice defines a conservative geometric distinction before any
new priority exception. It changes no production movement. Common future route
cells and positive current waypoint alignment describe both retained witnesses;
they cannot by themselves justify waiving ordinary following priority.

The [test-only classifier](../scripts/crowd-queue-geometry.mjs) uses the actor's
accepted route axis, normalized in world coordinates. A claimant ahead whose
transverse body supports overlap the actor's supports is **queue-following**;
ordinary priority must survive an oblique proposal or positive waypoint gain.
The lane boundary uses the sum of actual circle radii, including tangency with
the existing numerical clearance tolerance. A claimant ahead outside this lane
is **lateral-rejoin** geometry only if the proposed step advances along the axis,
reduces absolute transverse error to the fixed raw waypoint, and reduces its
distance. Other geometry is undetermined. Neither label grants admission or
priority relief. This is an instantaneous conservative description, not proof
that two accepted routes share a lane over time.

| Retained production decision | Forest journey142 / production143 | Wall production594 |
| --- | --- | --- |
| Actor / claimant | 28 / 24 | 75 / 73 |
| Claimant ahead along accepted north axis | .5256241011 | .3848135956 |
| Absolute initial transverse offset | .0020173754 | .4546618834 |
| Combined Infantry circle radii | .44 | .44 |
| Geometry | queue-following | lateral-rejoin |
| Same admitted proposal's raw-waypoint gain | .0415814734 | .0236634758 |
| Unchanged production decision | wait; claimant keeps priority | wait; claimant keeps priority |

The wall proposal would reduce transverse separation to .4128050976, inside
the .44 following lane if its peer were held fixed. That projected geometry is
not an observed continuation: the original baseline waits, and the paired
forest capture stops at its first changed write. The wall claimant's current
direction also opposes the selected eastward proposal despite positive alignment
with the actor's north axis. A lane test does not establish compatible motion,
next-tick progress, productive release, fairness or immunity to oscillation.

Portable tests read the original compressed receipts with pinned SHA256 hashes,
reconstruct just these two calls through current production host/query/body
oracles, and reproduce complete decisions, proposal/scoring sequences and
controller transitions. They establish both actors' ordinary eligibility,
fresh generation/order/navigation/epoch/path-object/index/tick identities,
inactive maneuvers, shared future triples and strict physical admission of the
discarded proposals. Classification leaves all actors, selected routes, target
intent and queues unchanged. Both proposals remain above the unchanged .02
progress-credit bound; no progress timestamp is reset. Terrain/body denials and
query overflow stay independent of geometry. Boundary/radius, oblique following,
backward/outward/overshoot/stationary, invalid-input, rotation, reflection,
translation and axis-scaling controls exercise the distinguishing predicate.

Run `node --test scripts/crowd-queue-geometry.test.mjs`; the existing crowd test
entry imports it for normal CPU registration. No new fixture, journey, stored
checkpoint, renderer capture or qualification batch is started. The original
185-decision wall replay remains registered and unchanged. Test files under
`scripts` have no production binding; art, release packaging, deployment and
rendered acceptance are N/A for this slice.

Core `01a107ba-7977-7764-9574-17cb0c3a102e` owns this semantic boundary and any
later justified refinement. Crowd retains the original physical, journey and
fairness qualification at [PR529](https://github.com/lbeezr/thousand-unit-skirmish/pull/529).
Any runtime candidate still needs fresh eligibility/controller/route identity,
all original physical admissions and budgets, per-claimant arbitration, and a
supported continuation policy with independent counterexample review followed
by an explicit qualification handoff. PR529 remains rejected, draft and
unmerged at `2882498c`; PR525 remains retired. This record neither explains the
later239-tick fairness gap nor qualifies universal movement.
