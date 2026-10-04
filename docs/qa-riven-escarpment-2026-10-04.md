# Medium Riven Escarpment — 4 October 2026

[Map](../maps/veyrholds-riven-escarpment.json) · [Generator](../scripts/generate-riven-escarpment.mjs) · [Elevation capabilities](map-elevation-capabilities.md) · [Continuing stream](map-scale-playability-backlog.md)

Owner: map scale/playability workstream. This authored 224×224 source candidate
adds useful rift, escarpment and settlement space beyond Small, with ordinary
24 total units, 150 food/250 wood per seat, existing prices/audio and fog.
It uses Authored elimination fallback, with no triggers, deadlines or supplies.
It does not change the default, simulation cell/speeds, economy profiles or the
256 limit. Skirmish/PvE registry admission remains separate mode-owner work.

## Measured layout

| Measurement | Current source |
| --- | --- |
| Dimensions | 224×224 cells/world units; 50,176 gross cells; 44.8 constructed-TC widths per side |
| Usable ground | 43,734 cells (87.2%); every usable cell reachable from either home |
| Static construction ground | 43,716 cells (87.1%); 37,328 flat legal 3×3 centers and 31,468 flat legal 5×5 centers |
| Base route | 207 units / cost 20,715; 79.615 Worker/Infantry seconds, 46 Scout seconds; forest clearing preserves 207 |
| Complete forced routes | Two 18-row low passes: 207 each; 18-row southern causeway: 301; 14-row high northern route: 319 |
| Settlements | Two flat 49×49 home campuses; both fit the static 30-building template with circulation rings, adding 96 House population each |
| Expansion space | Three pockets per seat; each has a flat 19×19 pad, resource-free 11×11 inner ring and 23×23 forest clearance |
| Home resource access | 12 route cells for food and wood |
| Paired expansion food/wood access | Shelf 71/87 cells; rift 81/97; crown 113/129; reflected between seats |
| Finite stock | 12,100 food / 14,950 ordinary wood; 38,460 additional forest wood potential at six per initial forest cell |
| Elevation | Level 0: 9,518 cells; level 1: 23,592; level 2: 17,066 |
| Fog | 12,544 packed bytes per seat, before base64/compression |

Legal centers overlap and are not building capacity. The city fit is a constructive
static geometry example, not paid runtime or maximum capacity. Shared added-building
and population limits stay unchanged. Stock is authored per site, not multiplied
by map area; the home stock/access remain Small's while later pockets gain stock.
The crown pad is level 2, shelf level 1 and rift level 0, all with reachable access.

The center column lies in the open low rift and therefore appears fully open in
the generic audit. It is not the bottleneck. The focused tests mask both actual
ridge columns outside each named strip and verify a complete alternative through
that strip. This is a geometry test, not a minimum cut, measured army throughput
or proof that players use each lane. The outer ridge ramps also connect ridge-top
ground; no inaccessible high islands or decorative unusable padding are counted.

## Repeat and evidence scope

```sh
node scripts/generate-riven-escarpment.mjs
node --test scripts/riven-escarpment.test.mjs scripts/map-scale-audit.test.mjs scripts/map-size-policy.test.mjs scripts/map-grid-cost-audit.test.mjs scripts/threefold-basin.test.mjs
node scripts/map-scale-audit.mjs --summary-jsonl
node scripts/map-grid-cost-audit.mjs
node scripts/riven-escarpment-practice-scenario.mjs --output /tmp/medium-practice-NEW.json
node scripts/map-capacity-scenario.mjs --map veyrholds-riven-escarpment --loads 24 --seconds 10 --output /tmp/medium-NEW-evidence
```

The source checks cover deterministic authoring, all-ground connectivity, four
forced routes, flat settlement/resource pads, symmetric access and finite stock.
The existing bounded native collector now accepts this map and sends three waves
towards its actual low pass, high route and causeway. Its short order windows do
not establish full army arrival, lane choice, paid city growth or supported scale.
Any process telemetry is a shared-host diagnostic, separately identified from
static accounting and rendered browser testing.

Packaging, exact native receipt and independent review are recorded with their
actual source identities as they complete. Delivery owner task `01a10227-2c6d`
retains identified staging/browser follow-through; mode owner task `01a103cc`
retains explicit Skirmish/PvE admission. Human balance, paid full-match acceptance,
larger load comparisons and browser capacity remain open. Large 256 remains the
next authored tier. XL requires the separate index/cache implementation, not a
validator change in map authoring.
