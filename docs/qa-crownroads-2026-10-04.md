# Crownroads Large source candidate — 4 October 2026

[Map](../maps/veyrholds-crownroads.json) · [Deterministic author](../scripts/generate-crownroads.mjs) · [Focused checks](../scripts/crownroads.test.mjs) · [Paid scenario](../scripts/crownroads-paid-scenario.mjs)

Owner: Map scale/playability workstream. This slice adds one authored 256² Large
regional map using the existing three ground levels, current prices and ordinary
24-unit / 150-food / 250-wood opening. It changes no default, cell size, speed,
simulation limit or runtime hot spot. Authored elimination applies without posts,
free supplies or a deadline. Skirmish/PvE admission, identified deployment,
rendered appearance, human balance and supported army capacity remain separate.

## Authored geometry and economy

Two ridges flank a low central basin. Two 20-row low passes provide independent
251-unit routes. A 20-row southern causeway gives 369 units and a 16-row northern
raised route 379 when each is forced across both ridge columns. These are grid
routes with terrain/building occupancy, not visual impressions or formation
capacity. Outer ramps reach the ridge tops without opening a direct base shortcut.
Clearing every forest preserves the shortest 251-unit route.

The minimum-cost route is 25,115 (cardinal 100 / uphill 115). At actual definition
speeds this gives nominal Worker/Infantry 96.538 game-seconds and Scout 55.778;
continuous simulation arrivals can differ with spawn spread, formation, diagonal
smoothing, obstacles, collisions and snapshot resolution.

| Measurement | Initial map |
| --- | ---: |
| Gross cells/world area | 65,536 / 256×256 |
| Walkable after initial home TCs | 57,278 (87.4%) |
| Reachable from each seat | 57,278 |
| Initially eligible construction ground | 57,256 (87.4%) |
| Legal / flat 3-cell centers | 54,258 / 49,932 |
| Legal / flat 5-cell centers | 51,028 / 42,932 |
| Terrain levels 0 / 1 / 2 | 11,768 / 37,454 / 16,314 |
| Flat home campuses | 53×53 each at level 1 |
| Static 30-building city template | fits each seat, 96 added House population |
| Ordinary finite node stocks | 19,700 food / 24,150 wood |
| Forest cells / initial wood potential | 8,226 / 49,356 |
| Raw packed fog per seat | 16,384 bytes |

Each seat has four distinct sites, flat 19² pads and resource-free 11² inner
rings, with 23² forest clearance. These are authored opportunities, not measured
economic balance or four constructed cities. Stocks are chosen individually,
not multiplied by map area. Each site's two nodes share its pad elevation.

| Site per seat | Level | Own food/wood path | Food/wood stock |
| --- | ---: | --- | --- |
| Home | 1 | 12 / 12 | 650 / 975 |
| Near shelf | 1 | 72 / 88 | 1,400 / 1,800 |
| Northern crown | 2 | 140 / 156 | 2,500 / 3,000 |
| Southern basin | 0 | 99 / 115 | 2,200 / 2,500 |
| Causeway | 1 | 134 / 144 | 2,600 / 3,200 |

Both terrain and paired stocks/access mirror. One central food and wood marker
have a one-cell seat offset; each is contested. Home access stays short while
the crown's elevation, basin's lower approach and causeway's alternate route
provide different expansion decisions. Level1 and2 grant the existing same
one-cell sight bonus, not a new damage bonus. See [current elevation](map-elevation-capabilities.md).

## Native acceptance and delivery

Clean source **`36f6f9a949de208aeb77612f59600acaa1f33fd3`** passed the
public-root paid driver from 04:13:50–04:19:18UTC. It clicked normal Practice in
the actual root DOM, selected canonical Crownroads from the ordinary catalog,
and connected both seats. It asserted **Authored Practice@1**, not Skirmish.
Both opening packed fog masks had16,384 bytes and zero visible enemy units.
The [sealed bundle](qa-evidence/crownroads-2026-10-04/README.md) retains the full
report, all 12 conserved economic phases and 754 frozen input hashes.

| Actual cross-base arrival | Seat 0 game / wall seconds | Seat 1 game / wall seconds |
| --- | --- | --- |
| Worker outward | 97.267 / 96.286 | 96.467 / 95.487 |
| Worker return | 95.900 / 95.899 | 95.900 / 95.899 |
| Infantry | 96.467 / 95.487 | 95.767 / 94.787 |
| Paid Scout | 53.700 / 53.660 | 52.800 / 52.751 |

Each receipt includes actual starting/target/final position and final notice
latency. Arrival means a later public snapshot within 0.8 world units of the
commanded point. The starting snapshot can predate the wall timer, so these
intervals and their ratios are observations rather than exact application or
clock-speed measurements. Snapshot rounding, unit spawn spread, continuous
movement and collision also differ from the cardinal static route.

Both seats spent **140 food / 705 wood** on one Stable, paid Scout, expansion
Town Center and House each. Food reached 120 after the 40-food Scout purchase,
proving an actual 10-food deposit; wood naturally reached 480/510 before expansion.
Town Centers completed at 305.967 game-seconds and Houses at 313.967. Both cross-base
Infantry caused bounded explicit damage to the opposing home TC and then stopped.
All 12 recorded stages conserve remaining finite node stock + banks + cargo +
paid costs. No resource, bank or position injection was used.

A stopped-state cold restart exactly retained map hash, match ID, all three
banks, full resource nodes, all six paid buildings and each unit's cargo. Both
sessions resumed. Reset restored 24 opening units, banks and all authored stocks,
removed paid buildings, and one-human Practice clock/movement passed afterward.
The six buildings and 26 paid-run units do not establish a developed city's
traffic performance or a human match's balance.

A separate clean-source 24-unit diagnostic ran three waves of at least 300 ticks,
all 12 units moving per seat and six successful plans. The pure offline checker
agrees with the stored envelope across **all 66 retained rolling health windows,
including cold recovery**: peak tick p95 **4.231 ms**, maximum **4.739 ms**; start-lag
p95 **2.768 ms**, maximum **23.120 ms**; maximum planning slice **4.174 ms**. Each wave
had zero skipped slots. Checkpoint save-time clocks gave game/wall factors
**0.999818–0.999909**; a longer paid checkpoint observation gave 0.999903. Peak
captured server RSS was 119.027 MiB on the recorded shared host. These bounded
windows observe movement/planning/clock costs, not forced route use, full army
arrival or supported capacity. No 250/500/1,000/2,000 army run occurred in this slice.

Reproduce from the checkout with Node24 and locked dependencies:

```sh
node scripts/generate-crownroads.mjs
node --test scripts/crownroads.test.mjs scripts/map-scale-audit.test.mjs scripts/map-size-policy.test.mjs scripts/map-grid-cost-audit.test.mjs scripts/riven-escarpment.test.mjs scripts/confluence-grounds.test.mjs scripts/map-capacity-report-check.test.mjs
node scripts/crownroads-paid-scenario.mjs --output=/tmp/NEW-crownroads-paid
node scripts/map-capacity-scenario.mjs --map veyrholds-crownroads --loads 24 --seconds 10 --output /tmp/NEW-crownroads-diagnostic --rss-stop-mib 512
node scripts/map-capacity-report-check.mjs /tmp/NEW-crownroads-diagnostic/report.json
node scripts/crownroads-practice-scenario.mjs --output /tmp/NEW-crownroads-smoke.json
node scripts/map-scale-audit.mjs --summary-jsonl
```

Independent preliminary review confirmed the geometry with its own BFS and
checked all eight settlement pads/resource rings. 32 focused tests, types,
imports and documentation links passed. The existing
`node scripts/vaelora-map-layout-scenario.mjs` fails its visible-home-food rule
on unchanged Confluence. The earlier explanation that the check ignored Sheep
was incorrect: it includes every food node, but the nearest Sheep is 9.487 units
from spawn, outside its nine-unit rule. Home timber is 12.806 units away. The
[later diagnosis](map-tier-inventory-2026-10-04.md#confluence-invariant-and-compatibility)
also measures actual initial fog. That map and check have zero diff from this
slice's base 5bd23914; this is retained baseline
failure, not a Large validation pass. Final exact-head review/merge/package
receipts belong in the PR ledger.

Read-only Railway metadata recorded 4 October still reports SUCCESS deployment
`e541d903-178b-47cb-8d1b-4358c93c5a8a`, source
`64cc391e6d9c4164dca7bd45696cf3862fe19729`, created 00:04UTC. That source predates
this map. This is metadata evidence, not verification of the served game.

Static checks and process tests do not establish rendered appearance, a full
human match, browser/hosting performance or large-army support. Runtime mode
owner task `01a103cc` retains registry admission; entry owner branch
`codex/match-mode-entry-ui-v1` retains ordinary menu integration, and staging
owner task `01a10227-2c6d` retains identified deployment/browser acceptance.
The current runtime limit remains 256; XL is a separate implementation proposal.
