# Small Threefold Basin — 4 October 2026

[Map](../maps/veyrholds-threefold-basin.json) · [Generator](../scripts/generate-threefold-basin.mjs) · [Grid/XL audit](map-grid-limit-audit-2026-10-04.md) · [Continuing stream](map-scale-playability-backlog.md)

One authored 192×192 Small map adds useful playable area to Tiny rather than
stretching its terrain or adding an empty border. It retains ordinary 24 total
units,150 food/250 wood per seat, existing Veyrholds audio, fog and canonical
elimination. Three capture posts are bonuses; no ownership/deadline can win.
No defaults, selectors, registry, prices, cell sizes, speeds or validator limits
are edited by this slice. Those bindings remain with mode/entry owners.

The 32,798 initially walkable cells are all connected for both seats (89.0% of
the grid). Base travel is 157 world units:60.385 Worker/Infantry seconds,
34.889 Scout seconds. Clearing every forest leaves that route unchanged.
Two 16-row valley crossings provide 157-unit alternatives, the 15-row raised
southern causeway 239, and the 10-row high northern flank 245. These are verified
complete forced alternatives, not a global minimum-cut or proof that armies
use every lane. Levels 0/1/2 remain one walkable layer. Home campuses are 45×45;
each seat fits the static 30-building template with circulation space.

Each seat has three 9×9 flat expansion rings, at shelf, basin and southern
causeway sites. Resource markers sit outside those rings. Home food/wood
access remains 12 cells. Expansion food/wood routes progress 55/67,80/92,
114/126 cells. Finite map stock is 9,700 food/11,950 wood, plus 24,204 forest
wood potential; Tiny has 6,100/7,950 finite stock. This is explicit economic-site
authoring, not an area multiplier or maximum city/capacity claim.

## Evidence scope and repeat

Static tests check deterministic generation, ordinary rules/audio, whole-map
connectivity, forest-clear pacing, four forced routes, mirrored resource access,
developed-city geometry and six expansion rings. The existing paid driver now
accepts a Tiny/Small map ID; its default preserves Tiny's established reproduction.
Small uses its actual base/campus/resource locations without economy injection.

The separate capacity harness starts a fresh disposable two-seat server per
load, uses existing army-size diagnostics above 24, and sends three target-region
order waves. Each lasts at least 300 game ticks after a conservative post-acceptance
checkpoint. It records final-notice receipt,
first observed movement receipt, own-seat movement, computed paths/route failures,
tick/start lag/skips, checkpoint clocks/costs, server versus collector RSS,
compressed payload/wire deltas and same-seat cold recovery. It preserves full
raw health samples and failures, stops at a configured RSS ceiling and cleans
only its own temporary workers/files. Loads do not silently become paid armies.

These windows replace unfinished routes. They do not establish full army
arrival, particular crossing use, mass combat, paid city growth, browser costs,
human decisions or supported capacity. The host is shared and not isolated;
performance samples are diagnostic, not admitted hardware comparisons. Full
paid 24-unit movement/economy/combat/recovery is a separate source-qualified
receipt. Deployment and rendered acceptance remain open in this executor.

```sh
node scripts/generate-threefold-basin.mjs
node --test scripts/threefold-basin.test.mjs scripts/terraced-vale.test.mjs scripts/map-size-policy.test.mjs scripts/map-scale-audit.test.mjs scripts/map-grid-cost-audit.test.mjs
node scripts/vaelora-map-layout-scenario.mjs --check-only
node scripts/terraced-vale-native-scenario.mjs veyrholds-threefold-basin
node scripts/map-capacity-scenario.mjs --loads 24,250,500,1000,2000 --output /tmp/small-capacity
```

Exact accepted native/capacity/release sources and remaining receiving-owner
work are recorded below when those checks complete. Source/layout tests alone
do not mark the playable outcome complete.
