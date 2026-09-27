# Harvestable woodland

[Documentation index](README.md) · [Map authoring](map-authoring.md)

## Player rule

Woody forest sprites should be usable wood. A worker cuts an accessible tree
cell, carries wood home, and eventually opens that cell for movement and sight.
Forest shapes should create choices about shortcuts, route width, and settlement.

## Implemented contract

- Forest rectangles expand to a cell mask. Each forest cell starts with six wood.
- The cell address is `row * width + column`, separate from ordinary resource IDs.
- `gather` accepts `forestCell`; the worker approaches an adjacent accessible cell.
- Changed stock is sent as `forestStocks`, with `forestEpoch` for state changes.
  Fog filtering withholds unseen changes.
- Exhaustion removes the tree's hard movement/sight block and updates path state.
  Checkpoints preserve clearing; reset restores the original forest.
- Ordinary resource nodes keep their existing 128-node limit. Thousands of trees
  do not need thousands of ordinary nodes.

See `server.mjs`, `src/environment-art.mjs`, and the focused scenario:

```sh
node scripts/harvestable-woodland-scenario.mjs
```

## Follow-up experiments

**Berry brushwood:** after food depletion, a new order could harvest a small wood
reserve. Return food cargo first, keep loads unmixed, and make fruitless versus
fully cut states recognizable. This is not a current resource-node field.

**Forest-opening map:** start both seats in usable clearings with at least two
cuttable directions. Observe whether players cut a shortcut, widen an army route,
or settle elsewhere. Preserve valid starts and essential access.

**Organic outlines:** generate seeded clustered masks with uneven edges and gaps,
then encode them as nonoverlapping row spans inside the 4,096-obstacle limit.
Ground cover, sprites, collision, and sight should agree on the mask.

Regrowth remains a separate [living-land proposal](living-land-experiment.md).
A focused clearing regression supports a code change; density and large-army
measurements support later scale claims.
