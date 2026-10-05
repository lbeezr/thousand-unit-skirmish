# Automatic stance pursuit: caller audit

The smallest measured next caller gap is automatic Aggressive/Defensive military
unit-target pursuit. This is a **baseline audit and exact ownership request**,
with no runtime change or adoption/merge-readiness claim. Source is unchanged
main `a0bd77617dd23f2c6ea7387bb6307c6c653d26a9`, following merged Follow PR429.
The collectors' dirty status denotes the added diagnostic files; server and both
movement-module hashes are verified against the source git objects.

## Actual command witness

Run `node scripts/automatic-stance-pursuit-probe.mjs`. Its existing replay adapter
executes intact production functions and observes admitted substeps; it does not
patch position, HP, vision, order state, ranges or algorithms. On a trusted
64×48 map, real single-unit Move puts selected Infantry at `(.75,.95)`, an enemy
Worker at `(2.5,.5)`, and a stone tile occupies `(1,1)`. The initial .22 military
circle is clear. Real `setStance` initiates automatic acquisition.

The [retained baseline](qa-evidence/automatic-stance-pursuit-2026-10-05/automatic-baseline.json)
finds four unsafe substeps for each Aggressive/Defensive case on each seat. The
first new penetration goes from `(.75,.95)` to
`(.8243160535617539,.9054103678629477)` by ordinary production steering. The
original selected firing suffix is `[1569]`; stance/acquisition anchors stay
`(.75,.95)`. The real Worker loses ten HP every 26 ticks and dies; observed damage
is at distance 1.23749 within the existing Infantry range 1.25. This records the
current damage/cooldown policy; safer travel may change the tick of first damage,
so the proposed adopter must not claim first-hit timing identity.

Both-seat StandGround and NoAttack negative controls stay at the original point,
produce zero damage and have zero contacts. These are out-of-range controls,
not proof of in-range StandGround firing. Both-seat recovery, moving-target,
range/visibility, prefix rejection outside the original travel bounds, generation
replacement and Stop/Hold/manual supersession still need the implementation
journeys and independent exact-head review.

## Why return and same-cell closure are separate

Run `node scripts/stance-return-audit.mjs`. The
[24-case return characterization](qa-evidence/automatic-stance-pursuit-2026-10-05/return-audit.json)
uses real Defensive acquisition plus enemy Move, actual target death or bounded
target loss, then original return planning. All 12 cases on each seat show zero
unsafe and zero newly unsafe return substeps and finish at the original selected
anchor cell center under the existing three-cell travel bound. This limited
geometry sample does **not** establish universal return-circle adoption; it does
not justify changing return policy just because its profile is not yet adopted.

The independently retained same-cell building range-goal stall from PR424 is a
combat endpoint/arrival contract, separate from this unsafe automatic pursuit.
A range reduction, damage change, forced relocation or new endpoint algorithm
would need combat/product ownership. None is proposed here.

## Exact dependency and proposed write boundary

The [core ownership request](https://github.com/lbeezr/thousand-unit-skirmish/pull/425#issuecomment-5987805820)
asks for only two existing `simulateTick` conditional extensions: automatic
acquisition publication beside `attackMoveAcquiredMovementActive` /
`patrolAcquiredMovementActive`, and active unit-target repath beside
`focusedUnitAttackMovementActive` / the other acquired predicates. Caller would
add a pure automatic Aggressive/Defensive acquired predicate and its already
owned `activeLandMovementBodyRadius` fallback. The unchanged selected-route
rejoin must run after original range truncation and original stance/acquisition
anchor publication, using the existing `automaticPositionAllowed` plus static
prefix guard and rejected-prefix retry.

Selected suffix/target, acquisition/travel/leash, visibility, cooldown/damage,
manual priority and checkpoint intent remain combat-owned. StandGround,
NoAttack, stance return, Worker/water, building targets, Patrol/Follow and the
same-cell writer remain excluded. Shared planner/publisher/checkpoint and crowd
steering/body pairs retain their current owners; this does not activate ordinary
crowd classification. No shared host edit is made without the exact allocation.
A concrete witness is available; **that shared contract is the current blocker**.

Provider/served identity and real ordinary rendered acceptance remain OPEN.
The historical zero-frame sandbox/storage block is retained without retry;
these collected CPU observations are not a visual pass. Art backing is N/A.
