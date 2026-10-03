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
There is no dedicated fish placement brush, and no shipped map places fish yet.

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
