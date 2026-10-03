# Fishing before the next Skiff Move

[Water waypoints](skiff-water-waypoints.md) · [Fishing](skiff-fishing.md) · [Selected groups](skiff-selected-groups.md)

Select owned Skiffs that are fishing and Shift-right-click water, including on
the minimap. Their next Move waits for **one cargo delivery**, rather than
waiting for the entire school to deplete. Each boat fills its current hold to
the existing 10-food capacity, delivers once at a live completed owned Dock,
then starts its own queued water route. It does not return to the source after
that delivery, even when stock remains. A boat already returning proceeds after
that current delivery. Empty boats in an explicit Return selection follow their
ordinary idle/moving queue rules.

Ordinary fishing still cycles until finite stock depletes, just as ordinary
land gathering keeps its resource task. The queued transition uses the land
Return cargo rule: actual deposit must happen before the next movement leg.
The explicit next Move bounds this boat's fishing task to one current load.
It introduces no timed job, regrowth or second inventory.

| Change while fishing | Result before the next Move |
| --- | --- |
| Stock empties, including harvesting by shore Workers | Deliver any partial load; an empty boat proceeds immediately. |
| An outbound route is blocked | Reconsider the source route once per second; if no source approach route is available, deliver the partial load or finish empty. |
| Owned Dock is missing or its access is blocked | Retain cargo and queued intent, retry delivery; never credit remotely or depart with undelivered fishing cargo. |
| Stop/Hold or an ordinary replacement Move | Cancel the selected boats' fishing and queued legs, retaining their cargo. |

Deferred Move destinations do not reserve cargo-delivery berths. Delivery still
respects current hull occupancy, active destinations and transit. This prevents
future waypoint claims from withholding access needed to unload real food.
Physical obstructions can still pause routes or retain a blocked queue head;
this is no general water traffic solver.

The same existing eight-pending-waypoint list stores the next Moves. Admission
preflights the selected group without changing fishing, cargo or stock. Its
first working leg uses the accepted current water endpoint or current water
cell; later legs use each boat's queued tail. After delivery, the common water
queue activation code plans to the exact accepted destination from the Dock.
It retains the existing 16-attempt/16,384-expansion activation budget. No land
planner, new schema field or separate fishing order engine is added.

Schema 23 validates fishing and water waypoints together. Restart retains
source, cargo, delivery phase and accepted destinations; Stop clears the queue
only for its supplied living owned boats and preserves their carried food.
Queued Gather, transport, weapons and new art remain outside this slice. Boat,
Dock and fish visuals remain explicit placeholders.

```sh
node --test scripts/skiff-fishing-next-move.test.mjs scripts/skiff-waypoints.test.mjs
node scripts/skiff-waypoints-scenario.mjs
```

The native two-seat minimap proof buys three Skiffs per seat and controls exactly
two. It recovers fishing with pending Moves, banks 20 food while leaving 11 stock,
then proves one-boat Stop leaves the other's fishing queue intact. The remainder
depletes into partial cargo, which returns before movement across another restart.
The stopped cargo later uses explicit Return followed by a queued minimap Move;
each seat ends with exactly 31 banked food and zero source stock or cargo. The
third boats remain unchanged. This is DOM/server evidence, not a claim of native
browser rendering or physical mouse usability.
