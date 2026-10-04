# Player guide

[Documentation index](README.md) · [Local setup](getting-started.md)

## Start a match

The ordinary game URL opens the [main menu](game-entry.md). Choose **New Game**
for a fresh Play vs AI match, or **Create Room** and share the invite for 1v1.
For lab maps or solo map testing, choose **Practice**, then use **Match Controls →
Battlefield**. Practice starts with one player and has no AI commander; normal
unit combat, economy and scenario rules still run. New Game's seeded AI match
keeps its selected map fixed.
**Join Room** accepts an invite/code; **Resume** appears for a server-validated
saved session. Root entry never automatically loads an old battlefield.
**Map Studio** opens a separate fresh host workspace; **Settings** works before
entering a match. Azure is the host and controls map changes and rematches.
Ember is the second player. Further connections watch as spectators.

New invite rooms open a [pregame lobby](room-lobby.md). The host selects the map
and starting army, both players ready, then the host launches. Settings changes
or disconnects clear readiness. Reset/rematch returns to this lobby; old rooms
and Play vs AI retain their existing entry flow.
Both connected seats can use **Room chat** before launch; spectators can read.
Recent messages survive a seat reconnect and rematch, but clear when the room
server restarts. Chat does not change readiness.

When you take a player seat, the camera starts at your Town Center. Use **Fit
map** for an overview. Reconnecting to the same seat keeps your current view.

The default PvP scenario is [Bellweather · Millrace](maps.md). Each team
starts with four workers, eight infantry, 150 food, and 250 wood. Own both
Fords to unlock Crossing Watch, then hold all three objectives for 20 seconds.
At 15 minutes, the Watch owner wins; an unclaimed Watch means a draw.

For the Stone resource test, choose **Create Room → Map → Lab · STONE DEFENSE
FIELD**, ready both players, then launch. Select Workers and right-click its gray
Stone markers; they return Stone to the Town Center. Bank 50 Stone, then select
a Worker and build a Watchtower for 50 food + 150 wood + 50 Stone. The map starts
with zero Stone and 200 finite stock per seat. See the [Stone lab](maps.md#stone-defense-lab)
for its opening and exact map file. Other maps keep their existing prices.

Select workers and send them to food or wood. Build a Barracks or Archery Range,
train reinforcements, and choose which route to contest. Sending workers to an
objective can help capture it, but leaves fewer gathering and exposes them to combat.

## Select and organize

| Action | Input |
| --- | --- |
| Select a friendly unit or building | Left-click. |
| Add/remove a friendly unit | Shift-click. |
| Select units inside a box | Drag left to right. |
| Select units whose visible footprint crosses a box | Drag right to left. |
| Add a box selection | Hold Shift while dragging. |
| Select visible friendlies of one kind | Double-click one; hold Shift to add. |
| Cycle overlapping units | Pause after a click, then click the same point again within 1.2 seconds. |
| Select all units | `A` or the selection control. |
| Select workers, infantry, archers, military, or idle workers | Use the labeled quick-select controls. Military excludes workers. |
| Assign a control group | Ctrl/⌘ + `1`–`0`. |
| Add selection to a group | Shift + `1`–`0`. |
| Recall / center a group | Press its number / double-tap its number. |
| Cancel an interaction or clear selection | Escape; close the active panel/targeting mode first. |

Groups retain living friendly units and are cleared when the map, army size, or
assigned team changes, or a rematch starts.

## Issue orders

| Order | Input |
| --- | --- |
| Move | Right-click ground with units selected. |
| Queue a waypoint | Shift + right-click ground; up to eight per unit. |
| Attack move | Press `M` or choose Attack move, then right-click ground. The mode resets after the order. |
| Attack a unit | Right-click a visible enemy. Repeated clicks can cycle overlapping targets. |
| Attack a production building | Right-click it with military selected; workers cannot attack structures. |
| Gather | Right-click a food/wood node, Stone node on the Stone lab, or harvestable forest cell with workers selected. |
| Return cargo | Select carrying workers and choose **Return cargo** in the selection bar. |
| Construct | Select the workers to assign, choose a building, then left-click a valid site. Only the selected living friendly workers receive the order. |
| Build a Palisade line | Select the workers, choose Palisade in Build, then drag/release across clear cells. Shift changes the elbow. A tap places one cell; Escape or right-click cancels. |
| Place a wall with the keyboard | While the battlefield is focused in Palisade mode, arrows move the endpoint; Enter anchors, then Enter places. |
| Resume construction | Select the workers to help and use Resume construction; they go to the nearest unfinished friendly site. Other workers keep their orders. |
| Set a rally | Select a friendly Barracks or Range, then right-click ground. |

Choose Box, Line, or Column before a move or attack-move order. Line and Column
face the destination. A plain ground order replaces queued waypoints. The order
feedback reports sending, planning, applied, rejected, or interrupted state.

Palisade placement shows the whole line's new segments and total cost. Existing
friendly segments are reused free. Invalid or unaffordable lines place nothing;
the server also rejects lines that cut a route or lack Worker access. The current
15-wood price per new segment is provisional. Workers construct paid segments
in sequence until another order interrupts them.

Attack move can engage a visible enemy already within weapon range across a
cliff or gap. Pursuit continues while a firing position remains reachable. If
the enemy retreats beyond all reachable firing positions, direct attacks end;
attack move resumes its route and can acquire another enemy.

## Economy and production

Workers gather finite resources, carry up to 10, return to base, and repeat.
Stop and other orders retain carried resources. **Return cargo** sends selected
carrying workers to a reachable completed owned drop-off for their resource,
then leaves them idle. This also delivers the final food from an exhausted sheep;
it needs no new Gather order. An unavailable drop-off preserves the cargo.
Forest cells currently yield six wood each; exhaustion clears their movement
and sight block. Berry brushwood and regrowth are future experiments.
After a tree or Wood node runs out, its Worker seeks visible reachable Wood
within eight world units of the originally assigned source. The work area stays
fixed across deliveries and replacements. When that area is exhausted, remaining
cargo is delivered and the Worker idles. Explicit replacement orders, including
Stop, Move and Return cargo, end the job; they preserve carried resources.
An exhausted finite resource node also releases its construction site. Living
sheep, partial carcasses and other positive-stock nodes still protect their
cells. Buildings, units, terrain and route checks continue to apply.

| Action | Cost | Time / condition |
| --- | --- | --- |
| Train Worker at Town Center | 50 food | 25 seconds. |
| Build Barracks | 175 wood | Workers construct a valid level 3 × 3 site. |
| Build Archery Range | 150 wood | Workers construct a valid level 3 × 3 site. |
| Build Mill | 75 wood | 15 seconds; completed friendly food-only drop-off, 1,000 HP and a 3 × 3 site. Provisional balance values. |
| Train Infantry at Barracks | 50 food | 12 seconds. |
| Train Archer at Range | 25 food + 45 wood | 7 seconds. |
| Infantry Forging | 100 food + 75 wood | 25 seconds at a completed Barracks. |
| Archer Fletching | 125 food + 125 wood | 25 seconds at a completed Range. |

Production queues hold five units and reserve population. Blocked exits pause
spawning until space opens. Each attack upgrade adds 20% damage to its unit type;
only one research job runs per team at a time. Destroying a production building
loses its queue and active research.

Choose Mill from the building menu with Workers selected to shorten a food trip.
Workers choose the nearest reachable completed friendly depot that accepts their
cargo. Mill accepts food; Storehouse (100 wood) and Town Center accept food and
wood. Unfinished and enemy depots accept nothing. A destroyed depot makes the
Worker choose another without losing cargo. Mill's House appearance is a temporary
procedural placeholder; select it to see its Mill name and food-only function.
Return cargo uses the same routing: stopped food can return to Mill, while stopped
wood needs a compatible Storehouse or Town Center. If only Mills are reachable,
returning wood is rejected and the Worker keeps its cargo.

## Camera, HUD, and sound

Scroll to zoom. Pan at a battlefield edge, with middle-drag, or with Space + drag.
Use the tactical map to move the camera; its focused arrow-key controls also pan.
Camera settings and help expose the available navigation controls.
Mouse edge scrolling starts within 80 CSS pixels of any battlefield-canvas edge
(previously 40); saved speed and enabled/disabled preferences still apply.

The compact objective summary keeps active victory/deadline countdowns visible.
Open Objectives for prerequisites, rewards, live cards, and recent notices.
Selection controls expose the relevant production or unit actions. Hints can be
hidden and reopened; placement and targeting still show cancellation guidance.
Select one Worker to see its portrait and live HP. Open its portrait for role
notes in the Selection drawer: abilities, live health, base stats and training
requirements. World notes are optional and initially collapsed, with a source
link; they do not change gameplay. Escape or the close button dismisses the drawer.
Multiple selections keep their group composition summary.
Select an owned Barracks to see its construction/damage thumbnail; open it for
the existing structure details. Its art follows the battlefield's current state.

Audio settings control effects, ambience, volume, and optional critical captions.
The Audio check lets you audition and identify cues. Settings persist locally.

## Winning and reconnecting

Capture rules depend on the map: any marked zone, all marked zones, an optional
continuous hold, or a deadline. Without marked victory zones, elimination checks
living units, queues, and affordable production reserves. Results freeze the
match until Azure starts another match or changes maps.

A lost connection retries automatically. Return through the same tab/session to
reclaim your seat within the configured grace window. See [local setup](getting-started.md)
if you join as a spectator or cannot connect.
The match menu's **Main Menu** link and lobby's **Leave room** return to the
root menu without resetting the match or removing saved session tokens.

If the connection drops while a building request is waiting for confirmation,
the placement preview closes. After reconnecting, check whether the building
appeared before placing another: the server may already have accepted the request.
