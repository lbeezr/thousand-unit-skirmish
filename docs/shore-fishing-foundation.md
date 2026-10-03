# Shore fishing foundation

[Map authoring](map-authoring.md#resources-and-forests) · [Testing](testing.md)

An authored shore-fishing site uses the existing finite food pool. Workers
gather at its land-side bank marker, carry `food`, and deposit it at existing
completed Town Centers or Storehouses. Depletion exhausts that node's stock;
restart does not refill it. Host rematch restores the authored starting stock,
as it does for ordinary food and wood nodes.

## Authoring contract

```json
{
  "id": "bank-fish",
  "type": "food",
  "resourceVariant": "shore-fish",
  "x": -0.5,
  "z": -0.5,
  "stock": 22.5
}
```

The `x`/`z` point is a bank access marker on an open level 0 land cell. One of
its four cardinal neighbours must be an authored `water` obstacle cell at level
0. For this example on a 16 × 16 map, water at column 7 / row 8 satisfies the
contract. Diagonal water, water painted only as a terrain texture, raised banks,
blocked markers and inland nodes do not. Both team spawns must reach the marker
using the existing land/elevation connectivity contract. Runtime Worker orders
also check team ownership, land connectivity and fish visibility.

`resourceVariant` is optional on existing nodes. Only `shore-fish` is currently
registered, it requires `type: "food"`, and it cannot also have wildlife species
or carcass lifecycle. Sheep remain `wildlifeSpecies: "bellweather-sheep"`. Fish
adds no currency, cargo type, gathering rate or second food pool.

Import authored JSON into Map Studio. Stock changes, selection, removal,
undo/redo and export preserve the variant; a bank marker appears as `F` in the
Studio. Export/publish validation checks the same shoreline rule as the server.
There is no dedicated fish placement brush. The selectable **Lab · SHORE FISHING**
map supplies two seeded, mirrored sites using this contract.

## Seeded authoring and pilot

[`maps/shore-fishing.json`](../maps/shore-fishing.json) is a 40 × 32 laboratory
map with eight starting units, fog, no starting food/wood, two 60-food fish sites
and two untouched 100-wood sites. Select it through the ordinary match map
picker. It is a gathering/recovery fixture, not a balanced regional skirmish or
finished landscape.

Generate a new portable copy from the retained source and explicit settings:

```sh
node scripts/seed-shore-fish.mjs scripts/fixtures/shore-fishing-authoring-source.json scripts/fixtures/shore-fishing-placement-settings.json /tmp/shore-fishing-authored.json
```

The command requires a new output path and will not overwrite the input or an
existing destination. Import the result into Map Studio and validate before
publishing. To author another map, export a validated map and supply settings
containing a safe-integer `seed`, integer `radius` from 0–8 (default 3), integer
`spawnClearance` from 0–16 (default 6), and one to sixteen
`sites: [{nodeId, x, z}]` with explicit in-bounds search anchors. Each ID must
already belong to a positive finite ordinary food or shore-fish node, without
wildlife lifecycle. The helper relocates those existing nodes onto open level 0
banks. It preserves their IDs, stock and other fields, all unrelated nodes, and
every non-resource map field. It adds neither resource stock nor currency.

[`seedShoreFishSites(map, settings)`](../src/shore-fishing-placement.mjs) returns
a complete copied node array. Candidate cells must stay within the requested
radius, avoid dirt and nearby resource nodes, clear both spawns and Town Center
footprints, and remain reachable from both seats. Existing fish reserve their
land approach and visual water cell. The seed ranks bounded candidates; failure
throws without mutating either input. Like the existing cluster authoring
helper, this accepts the ordinary validated map contract and does not replace
full map validation. Brush integration can use the returned array as one
atomic resource edit; no changes to generic brush history or checkpoint schema
are required.

## Separate land and water positions

`shoreFishSitePositions(map)` returns each fish site's `nodeId`, authoritative
`land: {x, z}`, derived `water: {x, z, column, row}`, and
`visualEnvelope: {width: 1, depth: 1}`. The water point is the center of the
nearest cardinally adjacent level 0 water cell; ties choose the lowest cell
index. The school occupies one water-cell envelope. Worker orders and the
selectable resource marker retain the land point. This helper is available as
a served client module for the water-rendering and authoring lanes.

No second position is persisted. Given the same authored map, the helper
reconstructs the same water point after checkpoints and resets. The pilot's
land markers are `(-10.5, 9.5)` and `(10.5, 9.5)`; their water centers are
`(-9.5, 9.5)` and `(9.5, 9.5)`. This is an integration contract: the current
primitive still sits on the land ring, and the water lane owns cosmetic school
rendering and its appearance checks.

## Runtime and recovery

The optional variant survives `createResourceNodeState`, seat-filtered resource
snapshots, host reset and checkpoint restore. Checkpoint schema 21 records that
identity alongside existing stock/cargo/worker intent. Schema 20 ordinary food,
wood and sheep saves migrate without changing their economy. A schema 20 save
that claims a newly authored fish variant cannot invent previously unrecorded
identity. Current saves reject a runtime variant that differs from its authored
definition. Match rules remain version 6.

## Presentation boundary

The current fish symbol is an explicit primitive placeholder attached to the
resource ring. It bypasses berry sprites and uses the existing full/worked/low/
depleted stock cues. The crowded-resource callout reads `FISH · FOOD`. This does
not establish finished fish artwork, fishing animation or creative acceptance.
The separate art lane owns fish and boat visuals.

Water continues to block land Workers. This slice introduces no naval movement,
docks, fishing vessels, transports or combat boats. There is no regrowth policy.

## Checks — 3 October 2026

Run the focused contract/placeholder tests with
`node --test scripts/shore-fishing.test.mjs scripts/shore-fishing-placeholder.test.mjs`.
`node scripts/shore-fishing-scenario.mjs` publishes an authored map through the
real server, rejects invalid shores and disconnected access, exercises both
seats' gathering, conserves stock/cargo/banked food, restarts with carried food,
verifies depletion through another restart, resets the match, and rejects
contradictory saved fish identity. These checks run in the ordinary CI runner.
They establish simulation and recovery behavior; they are not a fresh browser
appearance review or an unassisted player observation.

`node --test scripts/shore-fishing-placement.test.mjs` checks reproducible
stock-preserving authoring, one-cell land/water positions, reserved approaches,
invalid placement, atomic failure and safe portable output.
`node scripts/shore-fishing-authoring-scenario.mjs` selects the shipped pilot
through the real host catalog, verifies the served handoff module, banks 60 food
for each seat, conserves all 120 food and 200 wood, keeps Workers off water,
recovers positive cargo and depleted stocks, and restores authored stock on
rematch. Both checks run in the ordinary CI runner.
