# Skiff water movement

[Dock placement](dock-shoreline-foundation.md) · [Water graph](water-navigation-foundation.md) · [Game rules](game-bible.md)

Dock now trains **Skiff (placeholder)** through the existing paid production
queue: provisional 75 wood, zero food, ten seconds and one population. It has
120 HP, moves at 2.4 cells/second and cannot attack.
[Skiff fishing](skiff-fishing.md) adds finite food cargo and owned Dock delivery.
Both seats can select [owned boat groups](skiff-selected-groups.md) and issue Move or Stop. Hold Position
also stops it without attacking. Boats consume ordinary roster/population
capacity but cannot alone keep an elimination match open. Existing land attacks
can damage them when in range; this slice adds no naval combat weapons.

The full-detail appearance is an explicit team-colored procedural 0.6 × 0.2 ×
0.45-cell box, contained by its 0.8-cell square reservation even while turning
and at the existing maximum unit scale. Zoomed-out views reuse the existing siege marker. Neither is final
Skiff artwork. Dock still uses the procedural House placeholder. No boat sprite,
pier collision, finished visuals or rendered usability proof is claimed here.

## Orders and movement

[`water-unit-runtime.mjs`](../src/water-unit-runtime.mjs) snapshots the authored
level-zero water graph with one-cell static shore clearance. Movement follows
cardinal cell centers; there is no bank snapping, diagonal shore cutting or
cross-basin route. The registry and saved actor both declare `movementDomain:
'water'`; stable wire ID 7 identifies the kind in compact snapshots. Existing
land A*, elevation traversal, crowd separation and construction connectivity
retain their land domain. Scenario reinforcement rewards remain land-only.

Each hull conservatively reserves the cells touched by a 0.4-cell square radius.
Planning combines the static shore mask and both seats' current live hull cells.
It expands at most 4,096 cells per command. Invalid endpoints, disconnected water
and budget exhaustion reject before replacing an order. Two independent routes
can converge; the tick checks hull occupancy before moving, pauses safely while
retaining the route, and resumes when the other boat leaves. No automatic dynamic
reroute is promised. Adjacent arrivals can receive new routes away from each other.

Select up to 16 Skiffs for Move, using distinct nearby water destinations.
Mixed land/water, queued waypoints, attack-move, patrol and follow reject without
mutating orders. [Group admission](skiff-selected-groups.md) defines bounded
planning, exact controlled IDs and atomic capacity rejection.
Attack-move, patrol, follow and formation controls are disabled for a Skiff
selection. Dock rally targeting is unavailable; move the boat after spawning.
Fishing and Return cargo also accept selected groups through their [cargo contract](skiff-fishing.md).
Transport, naval combat and specialized multi-boat formations remain follow-on work. Shore
Workers and boats consume one finite food stock with no new currency or regrowth.

## Production and restart

Admission and completion derive a fresh Dock berth/exit with live water hull
reservations. Admission requires room; two entries admitted before the first
spawn can later leave a completed paid head blocked. The queue retains that
entry and its population reservation, then spawns without another debit when
the berth clears. Cancellation follows the shared ledger: an unstarted tail
refunds all 75 wood; the head refunds only its unconsumed training fraction.
Destroyed Docks use the ordinary production destruction rules.

Schema 22 remains additive. The exact preceding Gate/Dock content revision
`v1:525ab43cd600206d5c6cfab131c9d1fe193a59d9160ab219dc96a0dfb181605b`
migrates its paid land match, gates and Docks to the current revision. The prior
gate-free Dock revision `v1:561c62ccc67ac78cc067e8e639942a83fc6d6b1f89633e5b1c73aedc20f4a3a6`
and existing older land migrations remain compatible. Older pins cannot
claim Skiffs or paid Skiff queues. The exact movement-only Skiff and Farm
revisions migrate bare boats and paid queues; they cannot claim fishing state.
Recovery validates water positions, cardinal
routes and exact goals, centerline Stop positions, explicit domains, nonoverlapping
live hull reservations, supported [food cargo and fishing intent](skiff-fishing.md),
and absence of combat targets, land planning or unsupported orders. Rejected saves are preserved exactly. Static route validation
allows another boat to occupy a future segment; the movement tick waits safely.

## Evidence and manual use

```sh
node --test scripts/water-unit-runtime.test.mjs scripts/skiff-contracts.test.mjs
node scripts/skiff-scenario.mjs
node scripts/dock-scenario.mjs
```

The unit tests cover bounded water movement, speed, occupancy, adjacent arrival
escape, interrupted routes, paid refunds/population, elimination and actual
placeholder/command-control functions. The real WebSocket scenario covers both
seats' paid production, owner/stale-generation/domain rejections, occupied-berth
completion, paid/blocked/moving/Stop restart, prior-Dock/Gate migration, unchanged
banks and retained invalid checkpoints. These checks run through ordinary CI.

In **SHORE FISHING**, gather enough wood for a Dock and Skiff (175 total), build
a shoreline Dock as described in its guide, select it, and choose **Skiff
(placeholder)**. Select the spawned boat and right-click water in its pond, or
use Target battlefield then click water. Move it away from the berth before
training another. Build a House if ordinary population is full. These are
available commands, not a claim of final art, human-pair usability or ship-scale
performance measurements.
