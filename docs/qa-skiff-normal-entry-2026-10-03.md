# Normal-game Dock / Skiff acceptance

[Dock](dock-shoreline-foundation.md) · [Fishing before Move](skiff-fishing-next-move.md) · [Shore pilot](shore-fishing-foundation.md)

## Delivery remains open

Gameplay owner: fishing owner `/root`, retaining
[PR131](https://github.com/lbeezr/thousand-unit-skirmish/pull/131) through ordinary
in-game acceptance. Its merge is `00f79a0d8771e4909b5b8dd1498f6528c40b5862`.
At 22:45 UTC on 3 October, read-only Railway status/deployment metadata confirms
successful active staging deployment `29d74cac-b078-4a88-8f2a-e3141a2f9465`,
source `32f11d58018404835fd47489441f9cdfef7c403b`. Git ancestry confirms it
contains PR131, PR143's paid pilot correction and PR155's Practice entry.
The earlier parent-reported `19cae81` remains historical evidence. The parent /
Railway delivery owner coordinates environment operation; this gameplay owner
does not start an independent deployment. Received game bytes and actual
ordinary-user acceptance remain unverified.

Before acceptance, recheck the actual deployed source/release revision and verify
it contains PR131, the pilot-budget correction and Practice entry. A merge,
local release boot, `/ready` response or task handoff does not close delivery.
Keep the deployed revision, room, map, observations and screenshot links here
when the coordinated refresh is verified. Until then this outcome is incomplete.

## Ordinary route and bounded correction

Root **Practice** creates an immediate one-player room, without an AI commander.
Open **Match Controls → Battlefield → SHORE FISHING**; its eight authored
units and ordinary economy run with one connected Azure player. A second seat
is not required. **New Game** uses a seeded AI map and locks map changes;
use Practice for this lab. Root **Create Room** opens the normal PvP pregame lobby. The host's **Map**
selector lists **SHORE FISHING**; selecting it retains its authored eight
total starting units. Both connected seats ready, then the host launches.
Select owned Workers, open **Build** or **Commands → Build & train**, and choose
**Build Dock · 100 WOOD**. Selecting a completed owned Dock exposes
**Train Skiff (placeholder) · 0 food / 75 wood** directly in the contextual bar;
Build & train also has the ordinary roster production catalog. These choices
come from the shared default building/unit registry, without a feature flag.

The current regional audio reference also puts this map in the ordinary regional
catalog group, named **SHORE FISHING** without the old **Lab ·** prefix. This
changes the title used by the recipe, not map identity or naval authority.

The previous pilot started with zero wood and offered only 100 local wood per
seat. Its documented Dock route spent all local wood, leaving the 75-wood Skiff
unaffordable without taking the other seat's tree. The correction makes each
finite tree 175 wood and preserves the zero starting bank, 60 fish per seat,
map geometry and production prices. The retained authoring source has the same
explicit budget; seeded authoring still preserves source stock. This supports
one paid boat per seat and is not a naval balance or larger-water map change.

## Compact coordinated-staging recipe

1. Record the deployed revision containing all three changes. At its normal root,
   **Practice → Match Controls → Battlefield → SHORE FISHING**. Keep eight
   starting units; spend no wood on other buildings. For a later two-seat check,
   use Create Room, select the same map, join its invite in a second browser
   profile, ready both and launch.
2. Select Azure Workers and right-click the local tree. Let all 175 wood
   reach the Town Center; stop the Workers. Select them, choose **Build Dock**,
   and place on the inner bank: Azure world `(-4.5, 8.5)`, Ember `(4.5, 8.5)`.
   The footprint preview must accept that shore and reject inland placement.
3. After construction, select the Dock and click **Train Skiff (placeholder)**.
   Expect one paid water boat, zero remaining wood and no population refusal.
   Workers must remain on dry land. Boat and Dock appearances are placeholders.
4. Select the boat and right-click its local fish. Once it carries food,
   Shift-right-click two distinct cells in the upper half of its pond, including
   on the minimap. Example centers at `z=7.5`: Azure `x=-7.5`, then `-8.5`;
   Ember `x=7.5`, then `8.5`. Queue feedback must appear. Refresh/rejoin during
   this task to check retained intent. Expect exactly 10 banked food, zero cargo,
   50 fish remaining and the boat at the second destination after one delivery.
5. Order fishing again; with positive cargo queue another water Move, then use
   **Stop / S**. Expect that boat's queue/task to clear, its cargo to remain and
   its bank not to increase. **Return cargo**, followed by a Shift water Move,
   must credit that retained load at its owned Dock before moving. Record the
   HUD/cargo/queue observations and screenshots; repeat on Ember in the two-seat
   check. Avoid Workers harvesting
   fish during the exact-stock checks.

## Local evidence and its limits

At `aaf3e4b`, the shipped-pilot native proof below and existing shore-worker
authoring/recovery proof pass. After clean integration with main `1757064`,
`f5dcbb9` passes 105 focused map, menu/lobby, authoring, building/training,
Skiff/minimap and HUD checks, plus documentation links. Its clean 1,113-file
release has digest `sha256:532090e2d13afe46aaaa60912b474ffd6e10c16f74167102b3dfeb638975ffad`.
The packaged supervisor serves the pilot byte-for-byte, with map SHA-256
`84f64b57ab7e04f9ebc237656106c00ae246033d124e195d8d0d380a93aa1992`;
its ordinary root menu → Create Room → two-seat pregame map/ready/launch path
passes and uses the authored eight units. These are local checks, not staging.

`node scripts/shore-fishing-adoption-scenario.mjs` selects the shipped catalog
map, gathers its actual local wood, clicks the real HTML/DOM Dock and Skiff
choices, executes shipped Shift-minimap handlers and restarts the authoritative
worker with positive cargo and two pending Moves. Both seats spend 175 wood,
bank 10 food and leave 50 fish. Canvas placement is a documented-coordinate
server command in this fixture; it does not prove physical mouse placement.
The existing PR131 unit/native proofs cover partial food, selected-only Stop,
missing delivery access and recovery beyond this small pilot.

`node scripts/shore-fishing-adoption-scenario.mjs --practice` extends the same
paid fixture through the real root Practice DOM handler and isolated supervisor
room. It uses one player, no injected resources and no runtime debug/preview
entry; the mode argument selects the test path only. Both the original two-seat
and Practice tool proofs are registered in CI. Their result must be recorded
against the checked source; a tool pass does not close native browser acceptance.

On the branch based on production runtime `4467986`, all 33 authored-source,
menu and production checks and 43 lifecycle/launch checks pass. Both paid
native modes and the shore-worker authoring/recovery scenario pass. The actual
one-player root Practice path spends 175 wood, banks `[10, 0]` before movement,
then stops and recovers an observed 1.6-food load and returns it, ending food
`[11.6, 0]` within existing fractional precision. The inactive seat retains
its full 60 fish and 175 wood. The integrating PR records exact reviewed and
postmerge source heads; this is local DOM/server tool acceptance only.

The staging root was checked without credentials at 22:46 UTC: the network
proxy denied its CONNECT tunnel with HTTP 403 before application access. An
owner-run Chrome attempt in this workspace failed before page boot: its SUID
sandbox helper was not configured correctly (`setuid_sandbox_host.cc:166`). No
sandbox bypass was used. Native browser screenshots, ordinary-player usability,
received release bytes and actual staging use remain unverified. The
[ranked naval backlog](naval-workstream.md) retains the execution dependency.
Final fish,
boat and Dock art remains the separate art stream's outcome.
