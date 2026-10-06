# Moving-crowd entitlement contract

Owner: shared movement `01a107ba-7977-7764-9574-17cb0c3a102e`. This implements
the design task in the [movement workstream](movement-pathing-workstream.md#queued-wall-temporal-movement-witness--6-october-2026).
The [executable reference model](../scripts/crowd-entitlement-model.mjs) and
[bounded acceptance cases](../scripts/crowd-entitlement-model.test.mjs) specify
the contract; production does not import them. Base: main `1509805c`.
Art backing, release/deployment and normal-game pixels are N/A for this design
milestone. Default runtime adoption and unchanged crowd qualification are later gates.

## Decision

Reserve one named, nonterminal, positive next-tick movement step for the ahead
claimant before permitting a lateral entrant to override that claimant's single
priority veto. Preserve the **entire swept capsule** of that named step through
ingress and every later relevant land write. Consume the exact step before
tangent reranking on the claimant's next eligible call, after fresh physical and
existing priority checks. Never wait for acknowledgement; cancel and return to
ordinary arbitration/recovery if acknowledgement or fresh admission fails.

This addresses the missing promise in the rejected one-step clearance-envelope
proposal. Merely leaving body clearance or reading `lastProgressTick` cannot
preserve the peer's selected progress when ingress changes its tangent candidates.
The contract protects a named quantum, rather than guessing the peer's next choice.

## State and timing

Use a tagged extension at the existing transient steering `offer`/`lease` boundary,
with existing `lastGrantTick` kept separate from real historical progress credit.
The model's WeakMap is an executable specification, not an additional proposed
production registry. Never serialize these records or change saved order intent.

| Record | Bounded contents and lifetime |
| --- | --- |
| Request in entrant's offer slot | One exact physically admitted inward proposal, owner/claimant objects, from/to, route axis, both route stamps and request tick. Only the previous tick's request is eligible. Recording it does not stop the claimant. |
| Reservation in claimant's offer slot | One exact from/to step, body radius, owner stamp, issue tick, selected request/recipient object references, one attempt flag. Live only on issue tick and next tick while identity/origin remain exact. |
| Offer scheduling metadata | One last-issued tick and rotating requester-ID cursor per claimant. Advance the cursor for every probed allocation, including failed admission or later missing acknowledgement. One publication attempt per claimant/tick. |
| Safety obligation in entrant's tagged lease slot | Exact reservation object, recipient birth generation, pending flag and original ingress from/to. Survives the entrant's own route, waypoint, revision, Stop/Hold or profile change until owner promise is serviced, cancelled, invalidated or expired. |

A route stamp includes actor birth generation, kind/body radius, order revision, path object identity,
path index, final goal cell, fixed raw waypoint coordinates, navigation revision
and cold/restore epoch. A reservation additionally binds the exact finalized owner
pose. The recipient's acknowledgement binds the exact reservation object: an old
acknowledgement never attaches to a new promise at the same pose. Death/replacement
retires that recipient's acknowledgement. Epoch/restore retires the whole protocol
atomically; backward-clock contexts cannot take old grants. No saved-state additions.

1. An ordinary, nonterminal entrant with a shared three-distinct-cell directed
   continuation and a sole lower-ID claimant may request its existing admitted
   outside-lane inward proposal. Inside-lane following, opposite/unrelated routes,
   other claimant vetoes and active legacy detour/contour/passage lease stay excluded.
2. The claimant first makes ordinary progress. Only the host's receipt **after all
   fixed-tick writes and budget finalization**, with unchanged pre/post route stamp
   and positive gain on the same fixed raw waypoint, can publish a next-tick step.
   Preview that future step against `nextBudgetOf(owner)`, even when the finalized
   current tick has no remaining travel. That step must itself make positive
   raw-waypoint gain, remain nonterminal, pass
   all original physical guards and have **zero remaining original priority vetoes**.
   Active legacy maneuvers, overflow and exhausted shared work refuse publication.
3. Probe eligible previous-tick requests in ascending ID order cyclically after the
   claimant's cursor. Choose at most one. Recheck the exact proposal and require
   its full swept segment to avoid the expanded named-step capsule. Current-tick
   late requests cannot seize a publication. Failed allocations still rotate.
4. The selected recipient rechecks identity, geometry, original physical guards,
   other priority vetoes and all live reservations. Capture the safety obligation
   **before** writing. Current request/ingress/fallback/service admissions use fresh
   `remainingBudgetOf(actor)` after every authoritative displacement; a future full
   allowance never pays another current write. Waive only this exact claimant's one veto for this exact
   requested proposal. Actual finalized ingress consumes permission and updates
   `lastGrantTick`; selection or failed execution does not earn progress/grant credit.
   A guarded partial/fallback write retains safety without claiming ingress success.
5. Lane entry ends ingress permission, while safety survives. Every subsequent
   relevant authoritative land write must avoid the reserved capsule, including
   terminal, fallback, clamp, separation, combat or a new command's step. An actor
   serving a follower while owing an older reservation must guard both publication
   and consumption against its own older obligation too.
6. On the claimant's first eligible call next tick, read acknowledgement independently
   of the recipient's route/profile. If the exact promise, origin, stamp, remaining
   budget, physical guards, original priority and controller status remain valid,
   admit the **exact named step** before tangent reranking. Finish after authoritative
   execution and clear the promise even on failure. Missing acknowledgement or any
   invalidation clears it and permits ordinary selection/recovery immediately.
   A skipped next tick expires it. Ingress must finalize on its issue tick and service
   on its next tick; delayed receipts receive no grant/service success credit.
   A missing service finalizer cannot keep throwing after promise expiry/invalidation.
   A new tick or unchanged pose is no progress receipt.

## Guarantees and work bounds

Conditional on fresh admission remaining valid and the host actually executing its
admitted write, successful ingress preserves one named positive fixed-waypoint peer
quantum against recipient obstruction and tangent reranking. New third-body motion,
navigation changes, peer commands, controller changes or budget exhaustion can still
cancel service. A one-tick handshake adds no indefinite wait for acknowledgement.
This does **not** establish route completion, deadlock freedom, the original 150-tick
fairness deadline or productive construction. Cancellation may return to an already
stalled ordinary controller; no success is inferred from that fallback.

For a stable owner identity/cursor lifetime, a stable visible set of K eligible
requesters and positive residual work/service opportunities, cyclic probing visits
each within K allocation probes. This is a bound
on **probe opportunities**, not successful grants, ticks or arrival time. Churning
eligibility, query truncation and budget starvation defeat any stronger guarantee.
Unit IDs are existing deterministic identities; no randomness, clock or global queue.

Keep the existing 64-neighbor limit and **share the remaining 128 proposals** across
ordinary selection, request checks, publication, ingress and service; no offer hook
gets a fresh budget. Every modeled authoritative write uses the public budgeted
`admit` entrypoint; the capsule oracle is private. Reject nonfinite/nonpositive
movement budgets and work counters outside integer `[0,128]`. Every physical
admission consumes one proposal. At most 64 queried reservations plus one captured
obligation are checked per admission, so at most `128 × 65` existing-reservation
comparisons plus at most 64 explicit request/new-capsule pairing comparisons per
publication (`pairingVisits`). Physical
body admission and each original priority scan remain bounded by the same 64 bodies;
candidate eligibility can scan up to 64 requests and perform up to 64 priority scans.
Sorting at most 64 IDs and one bounded probe loop suffice. Overflow fails closed.
These are source work bounds, not wall-time or consumer-GPU capacity claims.

The host supplies actual fixed raw waypoints, authoritative **current remaining**
travel budgets separately from full next-tick offer-preview budgets, current
legacy-maneuver status, **remaining step-specific existing priority
vetoes**, and real bounds/cell/static/body admissions. The reference model never writes
actors, routes, queues, jobs, targets or historical progress clocks. Its progress
receipt is a host-owned assertion after execution; it is not inferred from a selector
result, state timestamp or public snapshot. Pre-write admissions still own safety.

## Acceptance and the retained receipts

Run `node --test scripts/crowd-entitlement-model.test.mjs`; the normal registered
Unit separation check imports these cases. Acceptance includes successful one-use
service and a legal three-actor chain; capsule crossing despite clear endpoints;
inherited obligations outside the current neighbor query; reciprocal claims;
other/new priority vetoes; failed commits/fallbacks; recipient route/index/Hold
changes, death/replacement; peer route/index/generation/origin/nav/epoch/controller
changes; missing/expired acknowledgements; current travel exhaustion versus future
preview, including actual displacement accounting in the three-actor chain;
same-pose different promise identity;
unchanged-pose renewal refusal; partial host receipts; failed-winner rotation and
the shared-budget/overflow limits. Controlled chain/identity cases isolate those
oracles; they do not represent captured production paths or a game qualification.

| Retained input | Executable outcome and limit |
| --- | --- |
| [forest142](qa-crowd-first-decision-2026-10-06.md), packed SHA256 `74ede1895682f64b9f1d512f9fe9fb200e542c77ad1568165aaf8ea38e18b11a` | Request denied: actor28 is following claimant24 inside the body-width lane. No offer or permission is invented. This preserves the rejected PR529 first-branch boundary without explaining the later 239-tick gap. |
| [wall594](qa-construction-temporal-witness-2026-10-06.md), packed SHA256 `0ac8d06e7d5c9ed95214c70c9c9cb8fdde2a9372bdb7b30d89ae752683f3f38d` | Actor75's original proposal can record a lateral request, but no named peer73 offer is retained, so ingress remains denied. Peer73's direct next step fails the real body sweep against body110. A supported alternative would require actual current guards and finalized host progress; no alternative or fix is claimed. |

Both artifacts are hash-pinned and evaluated without a match rerun. The wall receipt
does not prove a legal publication exists; the contract intentionally permits a
request-only outcome. Stationary/expired peers issue no authority. Safety and progress
thresholds, original gates/deadlines and the rejected PR529 head remain unchanged.

## Later adoption boundaries

Core retains the executable model, tagged lease/offer semantics, independent review
and the host-finalization/pre-write safety adapter. Crowd owner `01a10933-c2b0` retains
production ordinary-steering adoption and the original journey/fairness qualification
after an explicit supported-candidate handoff. Runtime write allocation must be agreed
between those two boundaries before overlapping edits. Existing caller owners retain
combat/Worker/interaction policy; nobody silently broadens ordinary eligibility.

The first runtime gate must bind all relevant pre-write admissions, carry safety-only
obligations across `steeringState` resets, and add a birth-only acknowledgement reader
alongside the existing route-filtered `readState`. `getMoveVector` proposals cannot
publish progress: the host must finalize movement receipts after the land executor's
terminal/steering/fallback and clamp/budget writes. Enumerate additional relevant land
writers rather than assuming these three admissions cover them. Prove every reservation
affecting a nearby swept step is queried using the existing bounded broad phase; retain
the recipient's own obligation even if its peer leaves that query. If query completeness
or a shared pre-write seam is unavailable, that binding is the precise integration
blocker; do not enable a partial protocol or a silent feature gate.

Next gate: independent runtime-candidate review and focused host/state tests. Only then
does crowd run its unchanged small/large crowd qualification. Packaging, identified
deployment and actual normal-game screenshots/replays remain separate acceptance.
This design merge does not ship the protocol, reopen PR529 or close universal movement.


## Production adapter candidate — 6 October 2026

The next delegated slice assigns core `01a107ba-7977` the complete candidate,
including the existing steering/lease boundaries and host adapters; crowd
`01a10933-c2b0` retains unchanged qualification. This supersedes the proposed
runtime file allocation above for this candidate. It remains draft and unmerged
until that qualification passes. PR529 remains rejected.

`src/crowd-moving-entitlement.mjs` is now the single protocol implementation.
The reference test host subclasses it; production consumes it through the existing
steering WeakMap. `offer.moving` stores request/reservation/cursor/issue metadata,
while legacy `offer.passage` and the tagged `lease` keep their distinct meanings.
Recipient route, index, Hold and profile resets preserve a live birth-bound safety
lease and its actual grant history. Peer route/command/nav/epoch/pose changes retire
authority. Passive neighbor reads neither initialize records nor refresh history.

| Live writer | Candidate admission / finalization |
| --- | --- |
| Terminal waypoint, including fractional endpoints | Original cell/static/Worker/automatic checks, then capsule admission. A zero-position arrival consumes its waypoint without travel or proposal cost. |
| Ordinary steering | Original physical checks, then fresh capsule admission and authoritative travel accounting. |
| Terrain fallback | Its original guards plus the same admission; a moved fallback retains safety and earns no ingress credit. |
| Final map clamp | Raw segment and clamp segment are admitted together before either write; both lengths count. |
| Same-cell combat closure | Existing combat policy plus supplemental capsule admission. |
| Post-executor interaction separation | Existing combat/economy/build/repair policy plus supplemental capsule admission. |
| Restore relocation | Replacement actor objects and changed planning epoch retire transient authority; no protocol enters a checkpoint. |

The host finalizes receipts after each actor's complete executor writes/clamp.
Only an unchanged nonterminal ordinary actor with no queued route repair can
publish. It cannot participate in later interaction separation or queued advance
that tick, because both require a finished path. Publication continues the actual
heading once and requires positive fixed raw-waypoint gain. The next projected
controller must remain nonzero ordinary steering: arrival, static repair,
parked-endpoint wait, a new parked-body detour, and active detour/contour/passage
lease all retain their original gates. Service bypasses only tangent ranking.
Its admitted endpoint is carried explicitly through `getMoveVector` to the actual
write; normalization is only steering metadata and never reconstructs that point.
A due promise also retires after a first executor call preempted by arrival,
repair or parked-endpoint wait, even when no named admission was attempted.

A single fixed-tick work record shares 128 segment admissions across selection,
request, publication, ingress/service and actual writes. Selection leaves three
admissions available for request/write/publication; exhaustion cancels or waits.
Reservation comparisons retain the model bound of 128×65+64. Production also has
explicit additional controller work: each adapter context caches at most65 actor
contexts (publication's owner-next preview and up to64 current requesters), each
projection uses at most22 point probes and20×64 body checks, plus at most64 parked
endpoint checks,64 direct-blocker classifications,64 direct body sweeps and64
arrival body checks. Priority calls
visit at most128 bodies each. The host records `controllerActors`,
`controllerPoints`, `controllerBodyVisits`, `priorityCalls` and `priorityVisits`
separately; these are additional work, not included in the reservation bound.
The existing spatial query remains capped at128 roster visits/64 neighbors.

Ordinary actors share their actual fixed-tick travel budget; publication previews
the next full budget, and priority age advances to tick+1 using the original .02
observation reset. Other callers retain their original separate travel policies.
During a protected tick every supplemental nonzero write must remain within .25
tiles for query completeness; longer writes and query overflow fail closed. A
remote promise does not combine combat closure and interaction travel into one
ordinary-Move budget.

Broad-phase proof: the ordinary owner moves at most4.5/30=.15 tiles, its named
capsule is at most.15 and land radii are at most.35. Any protected segment of length
≤.25 can intersect only owners within .25+.15+.35+.35=1.10 of its live origin;
start-of-tick owner drift adds .15, below the2.25 bucket radius and2.1 live retention.
For donor-query recipient probes, the original near-claim bound is at most
.35+.35+.15+.1=.95. Recipient travel≤.15 plus capsule/body reach1.0 gives donor
reach≤1.95, below2.1; removing the recipient and including the donor keeps the
physical peer set at64. The actor's captured obligation is also checked outside
the query. These numeric bounds depend on the existing ordinary speed/radius rules.

Focused acceptance executes the real selector and extracted actual land executor
without starting a match/server. It verifies publication/ingress/exact service,
command/profile safety, zero arrival, invalidation/current-budget/overflow/ack
cancellation, fresh original priority, passive reads and nonordinary travel policy.
The host fixture starts with the donor's current budget exhausted to record a
passive request before its next real progress; it does not fabricate a finalized
receipt or a peer step. Both historical first decisions and all185 wall decisions
retain their exact original results/state fields; only newly added protocol/work
namespaces are excluded from historical state comparison. Packed artifact hashes,
deadlines, safety thresholds and original crowd qualification remain unchanged.

This candidate does not qualify gate completion, fairness, large crowds, rendered
matches, packaging or deployment. Next: independent exact-head review and bounded
checks, then the crowd owner's original eight journey cases without altered gates
or deadlines. Release/deployed identity and normal-game screenshots/replays remain
separate downstream evidence; universal movement liveness remains open.

## Following continuation proposal — 6 October 2026

PR541 failed unchanged arrival qualification. Its exact head `30a2d709` remains
draft/unmerged. The separately merged PR544 repairs observation compatibility,
not arrival behavior. Core owns this **source-only** refinement at the priority
boundary; [the executable hypothesis](../scripts/crowd-following-continuation-contract.mjs)
has no production importer. It does not alter the candidate or enable a runtime
exception. Art, packaging, deployment and game pixels are N/A for this proposal.

Projected-target ranking and following priority are separate contracts. This
proposal addresses following priority only. Qualifier-local diagnostic records
and their detailed findings stay outside this public proposal; the new controls
use fabricated actors/geometry and the two previously public rejection frames.

The smallest proposed priority correction is: a sole
ahead claimant's distant final goal should not cancel already admitted forward
queue-following progress when its current waypoint direction closely matches the
actual selected step. Required conditions are all of:

- Complete original claimant enumeration returns exactly one claimant. A
  first-claimant-only selector result is insufficient; query overflow refuses.
  Admission/completeness assertions must be Boolean`true`, not truthy placeholders.
- Both actors have current ordinary eligibility and fresh generation, command,
  path identity/index, navigation, epoch and observation state, with no detour,
  passage/contour maneuver or live safety obligation.
- The current directed three-distinct-cell continuation matches at the peer's
  current index or one preceding index, as in existing entitlement eligibility.
- The exact already admitted step remains within body-width queue-following
  geometry, has positive accepted-axis and fixed raw-waypoint gain, and its unit
  direction has cosine strictly greater than the existing `.9` threshold with
  the claimant's actual current raw-waypoint direction.
- All existing bounds/cell/static/body, work/travel-budget and reservation
  admissions still succeed. This predicate supplies no admission or grant itself.

The contract neither renews `lastProgressTick` from a selection nor changes route,
waypoint, queue, offer or lease state. A successful selected step still needs the
existing authoritative write and normal historical net-progress observation.
It does not extend ingress permission, issue another named entitlement or infer
peer execution from its desired waypoint vector. A future peer tangent, wait or
downstream obstruction remains a fairness/liveness counterexample to qualify.
For any later runtime adoption, reuse existing directed-continuation semantics,
enumerate all claimants within the existing bound, and remove this separate
source-only predicate once its qualified rule lives at the shared priority seam.
The predicate receives the exact admitted endpoint directly; normalization is
used only for the direction comparison and never reconstructs that endpoint.
Unknown/noninteger actor identities, births, commands, observation ticks or route
indexes refuse permission.

Bounded controls use fabricated actors/geometry to exercise this proposed rule.
The two prior public, hash-pinned rejection frames supply their **actual direction
vectors only**: forest142 cosine`.5317950594532269` and wall594
cosine`-.8253633325477777` both remain ineligible. Existing full frozen-frame
controls still retain their original waits. This is not a replay of a private
diagnostic decision and does not prove that the later rejected PR529 fairness/gate
regression cannot recur. Run only
`node --test scripts/crowd-following-continuation-contract.test.mjs scripts/crowd-queue-geometry.test.mjs`
for these semantic and preceding public-frame checks; no match or journey starts.

Next dependency: qualifier `01a10933-c2b0` independently checks the proposed rule
against its retained actual proposal/endpoint, peer waypoint cosine,
complete claimant set, current controller identities/maneuvers and all remaining
admissions. The supplied diagnosis does not contain that cosine, so activation
is unverified. Qualifier also retains original forest142/wall594 rejection and
the mixed-claimant refusal boundary. Only a supported result justifies a separate
runtime candidate and later unchanged qualification; no broader rerun or PR541
merge is authorized by this proposal. Projected-target ranking remains separate.

The newly reached CI move-planning-tick arrival failures (run37441169171,
job112194995556, repeated in R6 run37442534373) are a separate core arrival item.
Four footprint/queue controls fail their existing1000/1800-tick completion
assertions after reaching planning idle and repaired goals. Registry reshuffling
made them newly reached; production/tests/maps and their used observer-off adapter
are unchanged. Their introduction date and mechanism are unproven. No extra run
or expansion of this continuation contract follows from that CI evidence.

## Following continuation runtime candidate — 6 October 2026

This separate, unmerged child of frozen PR546 adopts its exact-endpoint predicate
in [ordinary steering](../src/unit-crowd-steering.mjs). The previous script is now
a re-export, so its unchanged semantic controls exercise the production function.
The directed three-cell test shares the existing entitlement implementation.
PR541 and PR546 remain frozen and unmerged; this candidate inherits their source
without authorizing either merge. The already merged PR544 observer repair is
adopted explicitly, with its isolated VM host adapted to the entitlement executor
start/budget/finalizer hooks. Art production backing is N/A for this simulation
policy slice; normal-game movement acceptance remains open.

The original priority predicate is unchanged for selection, publication and
next-tick entitlement service. A first claimant still suffices to refuse an
ordinary proposal. Only an exact step aligned with that claimant's raw-waypoint
direction pays for another bounded enumeration: a second claimant rejects;
zero/one implies the complete neighbor set was examined. Only the complete
result reaches `soleFollowingContinuation`. Existing rejection witnesses retain
their full selector result, controller and observed decision events.

The accepted ordinary proposal carries its original `crowdFollowingPoint` through
[the serial land executor](../server.mjs). Immediately before writing, a fresh
bounded context repeats bounds, automatic policy, cell/elevation, static sweep,
current body sweep, live reservations and remaining travel/work admission, then
complete original claims and current eligibility/controller stamps. The original
Worker guard and supplemental land-write/capsule accounting still execute.
A later cell/static rejection ends this attempt: its waiver cannot be reused on
another fallback endpoint. The 64-neighbor and shared 128-proposal limits do not
increase; exhausted work refuses, including exhaustion after the fresh admission.
The replay observer labels fresh continuation refusal `following-rejected` and
the later cell/static refusal `following-static-rejected`. Both branches retain
identical calls, actor/controller state and repairs with observation on or off;
missing/duplicate guard shapes refuse instrumentation. Prior entrypoints without
either following guard remain supported. No new diagnostic records are published.
No route/index/queue rewrite, new registry, checkpoint field, grant, offer,
obligation, historical progress renewal or deadline/fairness relaxation is added.

[Bounded host controls](../scripts/crowd-following-host.test.mjs) exercise the real
selector and actual executor on a fabricated open 8×8 map, successful exact
consumption, stale own/peer stamps and maneuvers, changed policy/terrain/body,
multiple original claims, reservations and both budget exhaustion points. A
separate isolated-consumption control admits a synthetic endpoint whose normalized
vector cannot reconstruct it exactly; it does not claim that the selector chose
that point. These controls establish local contract behavior only. They neither
run retained private decisions nor qualify arrivals, fairness, large maps,
rendering, release packaging or deployed identity.

Next dependency remains the qualifier's unchanged crowd acceptance at this
candidate's exact reviewed head, preserving frozen baseline/PR541 evidence and
original case gates. The shared movement owner retains conflicts and integration
after that result. Projected-target oscillation is a separate slice. No merge of
the held stack or broader rerun is implied by bounded source/host checks.
