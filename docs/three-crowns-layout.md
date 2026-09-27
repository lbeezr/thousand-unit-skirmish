# Three Crowns

[Documentation index](README.md) · [Map catalog](maps.md)

Three Crowns is a 64 × 64 scenario with a 1,000-total-unit opening, two outer
crowns, a prerequisite-gated Heartland Keep, and contested central resources.
Both seats start on mirrored grid columns 11 and 52 (x = ±20.5).

## Route checks

| Route | Azure | Ember |
| --- | ---: | ---: |
| North Crown | 32 cells | 32 cells |
| South Crown | 31 cells | 31 cells |
| Heartland Keep | 17 cells | 17 cells |
| Home food / wood | 9 each | 9 each |
| Both neutral markets combined | 69 cells | 69 cells |

Each 350-stock home node occupies a mirrored cell. Neutral-market routes differ
by one cell individually and balance in combination. The layout check covers
formation envelopes as well as marker positions.

## Author and validate

```sh
node scripts/three-crowns-layout.mjs
node scripts/three-crowns-scenario.mjs 0
node scripts/three-crowns-scenario.mjs 1
```

`node scripts/improve-three-crowns.mjs` is the Map Studio authoring/export tool;
it rewrites the map. Use the layout/scenario commands for validation.

The 25 September record reported successful editor export and both winner-seat
scenarios, including locked Keep, victory hold, and synchronized reset. Those
local correctness runs did not measure internet performance or player comprehension.
The current definition is [maps/three-crowns.json](../maps/three-crowns.json).
