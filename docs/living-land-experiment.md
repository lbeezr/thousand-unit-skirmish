# Living-land experiment

[Documentation index](README.md) · [Map catalog](maps.md) · [Roadmap](roadmap.md)

## Question

Can elevation, a valuable regional site, and eventual regrowth give players
meaningful reasons to settle, defend, revisit, or bypass land?

This is a bounded experiment alongside the core skirmish. Its independent
slices can ship without changing the first-slice milestone requirements.

## Implemented: elevation and Highland Grove

[Highland Grove](../maps/highland-grove.json) is a 129 × 97 map with a level-2
terrace, two level-1 ramps, ordinary starting resources, and two separate route
signals. Holding both signals wins. The terrace is optional to victory and
currently contains a **60-stock food node** named `highland-coffee-placeholder`.
It is not a trade resource.

Ground levels come from optional nonoverlapping `elevationPatches` with levels
0–2. Missing data stays flat; obstacle `elevation` still describes obstacle height.
One-level edges are slopes, two-level edges are cliffs. Uphill routes cost 115
versus 100 normally. Sources on levels 1–2 gain one cell of sight radius.
Combat damage is unchanged and building footprints must be level.

```sh
node scripts/elevation-scenario.mjs
node scripts/generate-highland-grove.mjs --check
node scripts/frontier-160-map-studio-roundtrip.mjs
```

The final command needs Chrome. Check actual rendering and path choices in a
match in addition to schema, fog, and persistence checks.

## Proposed: one specialty crop

A future `species` field could distinguish a coffee grove from the economic
resource type. Workers would gather bounded `trade` stock and exchange it at the
Town Center for food or wood. The UI must show source, stock, exchange, and cooldown.
Replace the placeholder only after this runtime/schema contract exists.

Initial hypotheses, not accepted balance values:

| Setting | Trial value |
| --- | --- |
| Site capacity | 60 trade |
| Renewal | 12 trade/minute after 60 seconds without harvesting |
| Exchange | 20 trade for 40 food or 30 wood |
| Exchange cooldown | 30 seconds |

Compare grove control with ordinary-resource and objective openings. Record
first control, harvest/exchange totals, protection, routes, and whether first
control snowballs. Add more species only if the first site changes choices.

## Proposed: fixed-site regrowth

Start with existing authored node IDs. A depleted site could bud and refill
above its initial stock toward a declared capacity. Use simulation ticks and
persist stock, eligibility time, and stage. Active harvesting or a building on
the site should interrupt recovery; passing troops should not.

This requires new server/checkpoint rules. Current resources are finite and
ordinary stock validation is bounded by starting stock. Visual stages alone do
not implement renewal. Hidden growth must follow the same fog rules as stock.

Expansion into neighboring cells and wildlife migration are later experiments.
Never introduce a hard blocker under units or across the only usable route.

## Decision after play

Keep the experiment if players explain a meaningful choice caused by the site
and can read elevation without coaching. If the grove is ignored, change its
location, reward, or approaches before adding species. If renewal encourages
passive camping, revise its exposure or rate. If slopes confuse orders, improve
terrain/editor cues before adding elevation combat bonuses.
