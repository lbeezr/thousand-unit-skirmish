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
