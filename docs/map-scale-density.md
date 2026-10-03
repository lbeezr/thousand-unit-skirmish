# Map scale and density

[Documentation index](README.md) · [Map catalog](maps.md) · [Map authoring](map-authoring.md)

## Purpose

Larger maps should create recognizable regions, exploration, expansion, and
flanking choices. Extra walking distance alone is not a useful outcome.

Frontier Reach and Woodland Expanse provide 160 × 160 layouts. Highland Grove
is a separate 129 × 97 elevation experiment. A 224 × 224 probe remains a candidate
until observed matches show what another scale should test.

## Authoring targets

- Start with roughly 12–20% forest in shaped regions, gaps, and clear edges.
- Keep at least two broad army routes plus smaller flanks and buildable clearings.
- Group food/wood into protected starts, expansions, and contested pockets.
- Give the map three or four recognizable regions using ground, water, rocks,
  landmarks, resources, and objectives.
- Check both seats' access and useful building space. Preserve essential routes
  while forest cutting offers additional choices.
- Tune deadlines from actual travel and contact times instead of copying compact-map timers.

These are layout hypotheses. [Forest gathering](harvestable-woodland-pilot.md)
uses a separate cell model; the 128 ordinary-resource limit does not cap trees.
Map dimensions remain 16–256, with 4,096 rectangles per obstacle/paint/elevation field.

## Art bounds and occupancy

Map data owns walkability and building footprints. A sprite's visible base,
transparent padding, or recommended tile footprint is an art hint. Keep
`groundPivotPx`, world bounds, selection/click bounds, and gameplay occupancy
separate when sizing an asset or authoring a dense region.

## What to measure while building

| Category | Measurements |
| --- | --- |
| Geometry | Resource stock by region, shortest routes, alternate routes, approach width, building space. |
| Play | First contact/expansion, map explored, regions actually used, route choice, player explanation. |
| Editor | Zoom/pan usability, brush responsiveness, export/import and legacy/elevation round trips. |
| Server | Long-order acknowledgement, A* work, tick/start-lag p95/max, vision cost, snapshots. |
| Browser | Frame time, forest readability, minimap readability, memory on named hardware. |

Fog uses two bits per cell before base64: 1,024 bytes for 64 × 64, 6,400 for
160 × 160, and 12,544 for 224 × 224. Increasing area affects network cost even
when the unit count stays fixed.

## Tools

The [dated scale audit](qa-map-scale-2026-10-03.md) measures all shipped files,
separates the ordinary roster from Lab/quick fixtures, and reports Worker,
Infantry and Scout travel using shared simulation rules. Its
[ranked backlog](map-scale-playability-backlog.md) owns larger-map proposals and
acceptance; those dimensions are candidates, not changed defaults.

```sh
node scripts/map-scale-audit.mjs --summary-jsonl
node --test scripts/map-scale-audit.test.mjs
```

```sh
node scripts/frontier-160-layout.mjs
node scripts/frontier-160-map-studio-roundtrip.mjs
```

The round trip requires Chrome. `scripts/generate-frontier-160.mjs` writes the
map; `scripts/map-balance-audit.mjs` reports static geometry. Read the script's
arguments before running an authoring tool. A static audit cannot establish
observed route viability, human pacing, or hosted capacity.
