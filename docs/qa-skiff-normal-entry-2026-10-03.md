# Normal-game Dock / Skiff acceptance

[Dock](dock-shoreline-foundation.md) · [Fishing before Move](skiff-fishing-next-move.md) · [Shore pilot](shore-fishing-foundation.md)

## Delivery remains open

Gameplay owner: fishing owner `/root`, retaining
[PR131](https://github.com/lbeezr/thousand-unit-skirmish/pull/131) through ordinary
in-game acceptance. Its merge is `00f79a0d8771e4909b5b8dd1498f6528c40b5862`.
The latest staging source revision reported verified by the parent is
`19cae81f7636ebfe426911695a423d93a81e59ed`; PR131 is not confirmed deployed.
The parent / Railway delivery owner coordinates the next staging refresh;
this gameplay owner does not start an independent deployment.

Before acceptance, record the actual deployed source/release revision and verify
it contains PR131 plus the pilot-budget correction described below. A merge,
local release boot, `/ready` response or task handoff does not close delivery.
Keep the deployed revision, room, map, observations and screenshot links here
when the coordinated refresh is verified. Until then this outcome is incomplete.

## Ordinary route and bounded correction

Root **Create Room** opens the normal PvP pregame lobby. The host's **Map**
selector lists **Lab · SHORE FISHING**; selecting it retains its authored eight
total starting units. Both connected seats ready, then the host launches.
Select owned Workers, open **Build** or **Commands → Build & train**, and choose
**Build Dock · 100 WOOD**. Selecting a completed owned Dock exposes
**Train Skiff (placeholder) · 0 food / 75 wood** directly in the contextual bar;
Build & train also has the ordinary roster production catalog. These choices
come from the shared default building/unit registry, without a feature flag.

The previous pilot started with zero wood and offered only 100 local wood per
seat. Its documented Dock route spent all local wood, leaving the 75-wood Skiff
unaffordable without taking the other seat's tree. The correction makes each
finite tree 175 wood and preserves the zero starting bank, 60 fish per seat,
map geometry and production prices. The retained authoring source has the same
explicit budget; seeded authoring still preserves source stock. This supports
one paid boat per seat and is not a naval balance or larger-water map change.

## Compact coordinated-staging recipe

1. Record the deployed revision containing both changes. At its normal root,
   **Create Room**, join its invite in a second browser profile, select
   **Lab · SHORE FISHING**, ready both seats and **Launch match**. Keep eight
   starting units; spend no wood on other buildings.
2. On each seat select Workers and right-click the local tree. Let all 175 wood
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
   must credit that retained load at its owned Dock before moving. Record both
   seats' HUD/cargo/queue observations and screenshots; avoid Workers harvesting
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

An owner-run Chrome attempt in this workspace failed before page boot: its SUID
sandbox helper was not configured correctly (`setuid_sandbox_host.cc:166`). No
sandbox bypass was used. Native browser screenshots, ordinary-player usability,
the deployed revision and actual staging use remain unverified. Final fish,
boat and Dock art remains the separate art stream's outcome.
