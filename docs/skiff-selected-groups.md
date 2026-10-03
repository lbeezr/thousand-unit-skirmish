# Selected Skiff groups

[Fishing cargo](skiff-fishing.md) · [Water movement](skiff-water-movement.md) · [Game rules](game-bible.md)

Select up to **16 owned Skiffs** and target water or a shore-fish marker. Move,
fishing, Stop, Hold Position and Return cargo now operate on the controlled
selection. Only supplied living owned IDs with matching generations are admitted;
duplicates are deduplicated and foreign/stale IDs do not recruit other boats.
Mixed land/water groups reject. Boats remain unarmed and carry no passengers.

## Distinct destinations and admission

Group Move assigns distinct reachable water centers within four cells of the
clicked navigable water center, ordered deterministically by boat ID and distance
to that center. A single boat retains its exact destination. Every boat must be
in the target water component. The group shares a 16,384-cell search budget;
each route expands at most 4,096 cells. Missing room, a disconnected member or
budget exhaustion rejects the entire controlled group before changing orders.

Group fishing assigns distinct admitted casting approaches to the same source.
Fishing trips are admitted by shortest immediate route first, with boat ID
breaking ties, so boats can leave adjacent berths without trapping one another.
The stock remains one finite existing food pool shared with Workers. A source
with only one safe approach, including each shipped pilot pond corner, admits
one boat at a time; a larger selection rejects without replacing prior orders.
This is physical capacity, not a reason to silently discard selected IDs. Rates
and cargo remain provisional 1 food/second and 10 food per boat.

Dock delivery now admits distinct navigable centers within its existing 3 × 3
water berth. A group Return cargo order assigns a reachable owned completed live
Dock berth to each carrying boat. Selected empty boats retain their current
orders. Routes are admitted by shortest owned-Dock route first, with boat ID
breaking ties, so a farther boat does not trap a nearer boat behind its route.
Insufficient free berth routes rejects before cargo or orders change.
The primary production berth remains preferred when available. Workers retain
their land drop-offs. Food credits only at the assigned berth, never while
passing another berth on the way.

Planners reserve other boats' persisted route goals and avoid parking on active
transit routes. Within a batch, later destinations cannot occupy earlier transit
paths. Actual hull occupancy still controls movement; a transient obstruction
pauses a route safely. Fishing and cargo routes also reserve active transit
cells, taking a disjoint route or waiting and retrying until the traffic clears.
This prevents outgoing and returning boats meeting head-on. No general water
traffic solver is promised. Move boats away from occupied fishing/berth cells or use another
source/Dock if there is insufficient room.

## Stop, restart and boundaries

Each boat owns its existing path, exact goal, source, gather phase, cargo and
drop-off ID. Stop/Hold preserve cargo and cancel fishing. Return cargo delivers
once without resuming the source. Reissuing fishing retains cargo and returns
a full hold first. No fleet object, shared inventory, checkpoint schema or new
currency is added; reservations are rebuilt from existing saved paths/goals.
Existing single-boat saves remain valid.

[Water waypoints](skiff-water-waypoints.md) now accept Shift destinations on
moving/idle Skiffs, with up to eight pending goals per boat. Shift during
fishing/Return and queued fishing remain unavailable. This slice adds no
naval weapons, passengers, transport, final boat/Dock art or rendered usability
claim. All existing procedural placeholders remain explicit.

```sh
node --test scripts/skiff-group-orders.test.mjs scripts/skiff-fishing.test.mjs
node scripts/skiff-groups-scenario.mjs
node scripts/skiff-fishing-scenario.mjs
node scripts/skiff-scenario.mjs
```

The deterministic checks cover distinct movement/fish/berth goals, whole-group
rejection without mutation, fractional food, Stop/Return/restart conservation,
exact selected client IDs and active-route reservations. The real two-seat
scenario buys three Skiffs per seat, commands exactly two, and verifies that
the third boat's identity, location, cargo and order never change. It recovers
group movement and individual destinations, Stop cargo, manual Return and
automatic fishing; each seat's 31 stock ends as 31 banked food with no cargo or
stock remaining. These checks enter ordinary CI.
