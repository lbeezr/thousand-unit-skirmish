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
| Terrain levels 0 / 1 / 2 | 11,768 / 37,454 / 16,314 |
| Flat home campuses | 53×53 each at level1 |
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

The public-root paid driver is being measured at its clean committed source.
Its intended proof is both-seat actual Worker/Infantry/paid Scout arrival,
naturally deposited finite food/wood, paid Stable/expansion TC/House, explicit
bounded TC damage, strict resource conservation, exact cold stocks/banks/cargo/
buildings, reset and one-human movement. No injected bank, position or stock is
allowed. The scenario asserts Authored Practice and does not weaken the separate
Tiny/Small driver's required Skirmish admission.

Static checks and process tests do not establish rendered appearance, a full
human match, browser/hosting performance or large-army support. Runtime mode
owner task `01a103cc` retains registry admission; entry owner branch
`codex/match-mode-entry-ui-v1` retains ordinary menu integration, and staging
owner task `01a10227-2c6d` retains identified deployment/browser acceptance.
The current runtime limit remains256; XL is a separate implementation proposal.
