# Parked Worker route recovery — 3 October 2026

[Queued wall/gate baseline](qa-queued-wall-pathing-2026-10-03.md) ·
[Gate contract](palisade-gates.md) · [Checks](testing.md)

## Reproduction and diagnosis

Fork main `cec4c892df6dfbee2c4be9bb0dc2f0b654005029`, Linux cloud,
Node 24.19.0, server SHA-256
`4e38cfffe73fa3d637e0427994f86f509c3e10c17a9d3ebad164089c00a2c527`.
Use the declared 96 × 64 choke map, 64 Infantry per seat and 500 starting
food/wood. One selected Worker pays for a Gate at `(16.5, 0.5)` and completes it
naturally. Open it, leave the builder nearby, move the Infantry to `(-8.5, 0.5)`
and queue `(16.5, 0.5)`. Close the clear Gate while they walk the first leg.
Repeat with an idle builder, explicit Stop, and explicit Hold Position. No
positions, balances, routes or completion flags are injected in these cases.

All 64 assigned final destinations are distinct and reachable. Nevertheless,
Ember reaches only 63/64 within 2,700 canonical ticks in all three variants.
Unit 127 oscillates near `(17.399, 1.5)` beside the parked Worker at `(17.5, 1.5)`.
Its next intermediate waypoint is inside the Worker's cell, before its final
goal `(18.5, 3.5)`. `getMoveVector` keeps pulling toward that cell center while
radial crowd separation pushes it back. `lastMoveTick` continues advancing and
does not establish route progress. The terrain planner ignores soft unit
occupancy, so rebuilding the same global route would not remove this conflict.

## Bounded moving-unit correction

When a moving military unit is within the existing separation radius of a
stationary friendly Worker, the local helper can replace one or two nearby path
cells with a cardinal detour and rejoin the original route. The search uses a
5 × 5 window and the same terrain/elevation edge guard. A bounded spatial query
visits at most 64 nearby candidates and excludes stationary friendly Worker
cells together, so adjacent Workers cannot redirect the unit into each other.
An incomplete occupancy query declines a detour. A small projection tolerance
avoids classifying perpendicular floating-point jitter as a blocked approach.

At most one successful replacement applies per unit per tick. It copies the
path before splicing because the planner may share identical routes among
assignments. Final goals, queued orders, attack-move flags and order revisions
stay intact; the moving unit alone changes route. The correction does not move
or recruit parked Workers, change their Stop/Hold intent, change the global
walkable mask, or add command/checkpoint fields. No movement speed, client
animation timing, ownership or fog change is introduced.

If the final destination itself is occupied, the local rejoin is occupied, the
window has no legal detour, or the query budget is exceeded, the original route
and soft separation remain. Friendly units are not made into hard terrain walls:
the narrow one-cell-passage regression reaches its original goal through the
existing soft separation while the held Worker stays fixed. No terrain corner
or cliff is crossed. This is a local route correction, not general hard-body
collision avoidance, unlimited routing around Worker walls or universal crowd
deadlock recovery.

## Repeated cases and native commands

Every row repeats twice and hashes exact selected-unit positions, paths,
destinations, revisions and queued records. The parked Worker's position and
command fields are compared after every tick. Remaining-route progress counts
an improvement of more than 0.05 world units and resets when the goal changes.

| Seat / builder intent | Baseline ticks / arrivals | Fixed ticks / arrivals | Maximum no-progress ticks, baseline → fixed |
| --- | --- | --- | --- |
| Azure / idle | 682 / 64 | 670 / 64 | 449 → 439 |
| Azure / Stop | 682 / 64 | 670 / 64 | 449 → 439 |
| Azure / Hold | 682 / 64 | 670 / 64 | 449 → 439 |
| Ember / idle | 2,700 / 63 | 1,219 / 64 | 1,902 → 404 |
| Ember / Stop | 2,700 / 63 | 1,219 / 64 | 1,902 → 404 |
| Ember / Hold | 2,700 / 63 | 1,219 / 64 | 1,902 → 404 |

All six trace pairs repeat exactly. All fixed groups arrive at 64 distinct goals
with zero illegal steps or unreachable goals. Worker's position and intent stay
fixed, only the named builder receives construction, and surviving requested
destinations stay fixed. Maximum path length is 33 for Azure and 69 for Ember.
The first-leg choke still produces temporary congestion; arrival does not claim
that every unit makes progress on every tick.

The twelve prior paid-wall cases and two returned-builder gate controls also
repeat twice and all arrive with distinct reachable goals and preserved intent.
Their trajectories and arrival ticks change where they encounter stationary
Workers; unchanged trace hashes are not claimed. The returned-builder controls
have maximum path lengths 33/68, avoiding the reproduced adjacent-Worker loop.
Focused tests also cover shared path ownership, adjacent blockers, final-target
preservation, map edges, cliffs/corners, query exhaustion and narrow passage.

The actual asynchronous server uses real WebSocket commands on both seats:
Azure's builder receives Stop and Ember's builder receives Hold. Both groups
arrive 64/64 with 64 distinct destinations after paying for and naturally
completing the Gate, opening it, queuing the route and closing it. The builder
stays fixed across all sampled checkpoints (Azure 660 and Ember 1,290 relative
ticks). Closure changes navigation once and retains future destination records.

## Provenance and limits

Reviewed candidate `83f69ba6c108dc674eddc464855874dded86f2d8` has server SHA-256
`d714c57cdd5a9b3804461db4d7e05e71d2aec427e2ca5e411e3b848fc0bc73a7`
and local-helper SHA-256
`067a8e6d0cb2fd625f5d094dd120c7a8ad8fc02e1e98380bf00735a638a82106`.
[Retained checks](qa-evidence/stationary-worker-pathing-2026-10-03/checks.json)
include baseline failures, both trace hashes, source hashes, path/progress bounds,
prior obstruction controls and the native command results. All 66 focused tests,
syntax and diff checks pass. Independent review reports both identified path
ownership/adjacent-blocker issues resolved and no remaining findings.

The retained rejected candidate `50b29bd` reproduces the review's returned-builder
regression: Ember unit 94 retains its first-leg queue after 2,700 ticks, path
index zero and path length 2,763. Two adjacent Workers redirected its detours
into each other. The fixed control arrives 64/64 with maximum path length 68;
the old failure and both exact failing trace hashes remain in the retained record.

After integrating main `2bcb358` (Farms and separate Skiff movement), the server
SHA-256 is `db6b4e94af4f4eec28424af61ea22416584484e71f452fee51f9d8a5ccfbf03e`.
The local helper is unchanged. All 93 focused checks pass, including Farm,
Skiff/water movement and villager facing. The two older source fixtures now load
the actual Farm harvest lookup. All twenty replay trace pairs match the reviewed
candidate. Fresh native Stop/Hold commands reach 64/64 for each seat (660/1,260
relative ticks), preserving builder intent and Gate closure invariants.

The fixed-tick adapter drains planning between ticks and excludes wall-clock
scheduling/listening. Native results use the asynchronous server independently
of that adapter. Cloud timings are not isolated; no speedup, capacity or broad
performance claim is made. No deployed or rendered result is claimed for this
slice. The earlier selected-only construction Mac proof applies to its recorded
revision; this server-side recovery has its own tests and native command proof.
