# Automatic stance pursuit: shared clearance adoption

[PR432](https://github.com/lbeezr/thousand-unit-skirmish/pull/432) adopts the
existing land circle and selected-route rejoin for automatically acquired
Aggressive/Defensive military unit-target pursuit. It adds a pure intent predicate,
its existing body-profile fallback, and exactly two additive `simulateTick`
conditions. It adds no planner, steering, checkpoint, range or damage algorithm.
Art backing is N/A: this is an internal movement correction.

## Measured actual-command improvement

Run `node scripts/automatic-stance-pursuit-probe.mjs`. On a trusted 64×48 map,
real single-unit Move puts Infantry at `(.75,.95)` and an enemy Worker at
`(2.5,.5)`, beside the stone tile `(1,1)`. Real `setStance` initiates acquisition.
The existing adapter executes production functions and observes admitted
substeps without patching position, HP, vision, intent, ranges or algorithms.

The [baseline](qa-evidence/automatic-stance-pursuit-2026-10-05/automatic-baseline.json)
at unchanged main `a0bd77617dd23f2c6ea7387bb6307c6c653d26a9` records four unsafe
substeps, including one new penetration, per stance on each seat. The first
penetration is `(.75,.95)` → `(.8243160535617539,.9054103678629477)`; the
original firing suffix is `[1569]` and anchors remain `(.75,.95)`.
The [pre-review candidate](qa-evidence/automatic-stance-pursuit-2026-10-05/automatic-candidate.json)
records **zero unsafe/new contacts in all four cases**. Its source is audit
head `62c1dc4a` plus uncommitted runtime changes, honestly retained as dirty;
the exact reviewed/merged source and clean pack belong to the PR receipt.

In this bounded witness, first damage remains tick 29, ten HP every 26 ticks,
and target death tick 263. All damage retains the original Infantry range 1.25.
This sample does not promise universal first-hit timing identity after safer travel.
StandGround/NoAttack out-of-range controls remain passive and stationary.

## Contract and recovery verification

`node --test scripts/military-stance.test.mjs` includes 89 new checks from
`automatic-stance-pursuit-journeys.mjs`: actual Infantry and paid/trained Archer
on both seats, real fog/vision, accepted/acquired/first-damage recovery,
separate cold modules in planner modes 0/1, moving-target repaths, fixed leash
loss, Stop/Hold/manual/queued Move and stance supersession, paid-wall topology
repair, original range/cooldown and unselected-unit preservation. Selected
suffixes, goals, revisions and anchors are asserted through actual rejoin calls.

Negative legacy-checkpoint controls separately cover an overlapped start and a
body-clear center outside Defensive's unchanged three-cell travel bound. They
retain rejected-prefix retry without moving or inventing damage. These two
controlled recovery setups are labelled explicitly; they are not actual-command
positive witnesses. In-range StandGround retains productive stationary fire.
Same-cell automatic Infantry starts from the original empty route and fires
through cold recovery; existing interaction separation/repath is permitted.
No same-cell closure writer or combat endpoint policy is changed.

`node scripts/automatic-stance-pursuit-native.mjs` exercises actual WebSocket
orders on both human seats, both stances, corner pursuit, active process stop,
saved fixed anchors/target, session resumption, target death and Defensive return.
It records checkpoints and broadcasts, not every substep or rendered frames.

## Return, ownership and remaining acceptance

The [24-case return baseline](qa-evidence/automatic-stance-pursuit-2026-10-05/return-audit.json)
and [candidate controls](qa-evidence/automatic-stance-pursuit-2026-10-05/return-candidate.json)
retain zero unsafe/new return steps, original anchor-cell completion and the
existing three-cell bound. This limited sample does not establish universal
return-circle adoption. Return remains a separate core lane; it is excluded
from this predicate. The PR424 same-cell building range-goal stall remains an
independently retained combat endpoint contract, without speculative changes.

[Core's precise allocation](https://github.com/lbeezr/thousand-unit-skirmish/pull/425#issuecomment-5987896694)
is [received on PR432](https://github.com/lbeezr/thousand-unit-skirmish/pull/432#issuecomment-5987897375).
Only initial automatic acquisition and active unit-target repath conditions are
extended. Original range selection and anchors precede the unchanged rejoin;
`automaticPositionAllowed` and static prefix sweep both still govern admission.
Acquisition, visibility, travel/leash, cooldown/damage, manual priority and saved
intent stay combat-owned. Worker/water, building targets, Patrol/Follow,
StandGround/NoAttack, stance return and same-cell writer stay outside this adoption.
Shared planner/publication and Worker economy remain core-owned; steering/body
pairs remain crowd-owned. Core PR430's physical-phase census/detour splice is
separate and integrated before final review. No global attack/Sheep pruning occurs.

Provider/served identity and real ordinary rendered acceptance remain **OPEN**.
The existing staging deployment verifier retains provider follow-through through
the prior caller PR receipts. The historical cloud sandbox/storage blocker
produced zero frames and is retained without retry. CPU, native process and
pack identity observations do not close rendered acceptance.
