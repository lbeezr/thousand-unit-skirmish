# Unit movement and terrain boundaries — 3 October 2026

[QA evidence](qa-vertical-slice.md) · [Movement contract](gameplay-command-observation-contract.md#terrain-boundaries-during-movement)

## Reproduced problem

Baseline fork main `90ad32009861a32fbada5e579606db3fe293731c` includes
shore fishing and the PR #36 villager-facing fix. Path planning checks the
one-level elevation rule. Physical crowd deflection in `simulateTick` and
stationary working/striking displacement in `spreadInteractingUnits` checked only
whether the endpoint cell was walkable.

`scripts/unit-movement.test.mjs` runs those real server functions in a deterministic
8 × 8 fixture. Rows 0–3 are level 0; rows 4–7 are level 2. A soldier at
`(-0.5, -0.01)` follows the legal waypoint at `(0.5, -0.5)`. Three friendly
neighbors above it produce separation toward the cliff. The baseline moves it to
approximately `(-0.4428, 0.0551)` in one tick, crossing from cell 27/level 0 to
cell 35/level 2. Stationary gathering beside left/right berries also crosses that
cliff. A separate fixture enters open diagonal cell 36 past blocked side cell 35.
Stationary melee separation also crosses the cliff. Four of the nine regression
tests fail on the baseline; those nine pass with the boundary guard.

These are actual simulation position errors, independent of sprite headings or
art coverage. The fixtures deliberately arrange the crowd; the ordinary live
choke below did not reproduce the bug on the baseline.

## Scoped change and validation

`src/unit-movement.mjs` shares the existing elevation rule and checks both sides
of diagonal crossings. Three authoritative movement checks use it. The existing
route fallback, separation forces, movement speeds, planner, orders, checkpoint
shape and animation clocks retain their contracts.

Eleven focused regressions cover walking and stationary gathering/striking, berries
on either side, blocked corners, all eight adjacent directions and uphill/downhill
limits, one-level slopes, open ground, bounds and multi-cell jumps, and repair
after a waypoint becomes blocked. Independent review reproduced a reachable-route
stall after a legal crowd deflection left its old next waypoint across a cliff or
blocked corner. The simulation now requests the existing bounded repair when both
physical steps are rejected, or invalidates a combat pursuit for its normal
planner. Additional regressions run the real repair queue and planned-assignment
application: one queued repair during 300 waiting ticks, retained queued intent,
arrival after a known legal cardinal rejoin, and combat-target retention. Rejected
steps do not update the movement timestamp. PR #36's seven facing regressions pass.

Owner-run native WebSocket scenarios pass queued move/attack and checkpoint
recovery, fog-private queue/focus metadata, a 1,000-unit queued-order sample,
construction route repair during combat, both-seat weighted A*/flow/elevation
and fog checks, and forest harvesting with exact six-wood deposits on both seats.
Further native checks pass both-seat Patrol/Follow retargeting, leader death,
restart and live obstruction/removal; attack-move recovery from unreachable cliff
targets; construction connectivity rejection without debit; and both-seat shore
fishing with land access, cargo/depletion checkpoint recovery and stock conservation.

An exploratory published 64 × 64 map uses a rock wall ending beside a level-2
cliff, leaving a one-cell crossing. A 32-unit selection crosses on the baseline
and candidate without entering level-2 terrain. This is a bounded route-progress
smoke, not the failing proof or a capacity benchmark. No checkpoint positions
were injected for that live smoke.

## Remaining limits

This slice does not prove arbitrary crowd deadlock recovery or fix the recorded
2,000-unit construction-site clearance failure. It adds no artwork and does not
change sprite facing. GPU appearance and hosted load budgets were not measured.
