# Skiff water waypoints

[Selected groups](skiff-selected-groups.md) · [Water movement](skiff-water-movement.md) · [Fishing](skiff-fishing.md)

Select up to 16 owned Skiffs. Right-click water to move immediately, or
Shift-right-click water to add a destination after each boat's current route.
The minimap uses the same plain Move command and Shift behavior, including
unexplored water. Each boat keeps its own destinations, cargo and generation.
Nearby unselected boats are never recruited.

## Admission and execution

The existing per-unit waypoint queue holds at most eight pending destinations.
Shift on an idle boat starts its first route immediately. Shift on a moving
boat appends a destination without replacing its current path. Boats with
different route/queue lengths append from their own accepted tails.
An idle member starts against the moving members' live hulls and retained
transit paths, so it cannot park across a selected boat's current route.

Every command preflights the entire controlled selection on the water graph,
assigning distinct destinations near the clicked navigable center with the
existing 16,384-cell budget and at most 4,096 expansions per route, capped to
the map's cell count. Land targets,
disconnected basins, mixed selections, unavailable room or any full queue reject
without changing the group's orders or cargo. A single boat retains the exact
clicked destination. Repeated destinations for the same boat remain valid.

Active and queued destinations remain reserved against other boats. At each
leg's end, a new water route is planned to that boat's exact queued destination.
Only a found route consumes the queue head. A blocked destination stays queued
and retries once per second, preserving cargo and intent across checkpoint
recovery. Activation is bounded to 16 attempts and 16,384 expansions per tick.
It does not use land fallback destinations or the land navigation planner.
Physical hull occupancy can still pause an active route; this is no general
water traffic solver.

## Cancellation, cargo and scope

Stop/Hold clear the path and queue for the supplied living owned IDs and retain
their cargo. An ordinary Move replaces their queued route. Unselected boats'
paths and queues remain intact. Existing owner-only waypoint counts update the
selected-unit HUD without exposing other teams' queues.

Shift Move during fishing waits for [one current cargo delivery](skiff-fishing-next-move.md)
before movement, leaving any remaining stock. Shift during Return cargo waits
for that delivery. Depleted/unavailable sources return partial loads; an empty
boat proceeds. Missing delivery access retains cargo and queued intent. After
Stop, boats may explore or flee with their retained food, then receive an
explicit Return cargo order. Queued Gather remains unavailable.

Schema 23 reuses the existing `{destination, attackMove:false}` queue records.
Validation requires navigable connected water destinations and rejects attack
waypoints, excess length and held/queue intent; fishing queues retain the normal
source/cargo/Dock validation. Earlier
movement-only content pins cannot invent water queues. No new currency,
passengers, weapons or boat/Dock artwork is introduced.

```sh
node --test scripts/skiff-waypoints.test.mjs scripts/minimap-orders.test.mjs
node scripts/skiff-waypoints-scenario.mjs
```

The native two-seat proof buys three boats per seat and controls exactly two.
It uses the shipped minimap pointer handlers through real WebSockets, preserves
partial fish cargo through individual FIFO completion and restart, proves
one-boat Stop leaves the other's queue intact, checks the eight-pending cap,
and delivers the cargo once afterward. The third boat's identity, position,
cargo and orders remain unchanged. Invalid water queues are preserved exactly
when recovery rejects them. DOM/server evidence does not establish native
browser rendering or physical mouse usability.
