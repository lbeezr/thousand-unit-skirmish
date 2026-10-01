# Rootways woodland shortcut — 1 October 2026

Base: fork main `f37fff3a910c610a323ac14b5f2de9163499a050`.
The [authored Rootways map](../maps/underbough-rootways.json) describes harvesting
shortcuts, but the existing objective proof reaches Supply Grove by the open
detour. This [bounded scenario](../scripts/underbough-woodland-shortcut-scenario.mjs)
tests real harvesting and traversal without changing the map or writing checkpoints.
It reuses the [authoritative fixture](../scripts/fortified-crossing-fixture.mjs).

Both seats start on the unchanged 24-unit map. Each pays 50 food to produce a new
Worker and 100 wood to construct a Storehouse near its forest belt. The Worker
cuts row 36 columns 40–43 for seat 0 and 55–52 for seat 1 using ordinary,
generation-checked gather orders. Each target is currently visible before the
order. Each tree reaches zero stock and deposits exactly six wood; each seat
banks 24 wood. Harvesting finished at 67.97 match seconds, before the 120-second
supplies, with all events unfired and objectives neutral.

The shortest orthogonal geometry route from each spawn to any Supply Grove cell
requires 41 moves before harvesting and 30 after. Counting the starting cell gives
42 and 31 cells. The calculation includes authored elevation traversal, home
footprints and the actual Storehouses, and opens only forest cells whose stock is
observed depleted. These lengths describe geometry, not elapsed travel time.

Runtime evidence is separate: each paid Worker returns to its spawn, then receives
one move order to the near Supply Grove edge. Fresh server unit positions record
the same living identity/generation crossing all four harvested cells in order
and arriving at the grove, at tick 2664 in the initial run. This is observed
authoritative movement, not screenshot inspection. Ordinary reset restores the
24-unit opening, banks, neutral objectives and full forest, removes construction,
and restores the 41-move geometry route.

```sh
node scripts/underbough-woodland-shortcut-scenario.mjs
node scripts/harvestable-woodland-scenario.mjs
node --test scripts/ci-sharding.test.mjs
```

The scenario is registered once in the normal CI inventory. A disposable server
mutation keeps the final depleted cell of each belt blocked while allowing normal
harvesting and deposits; the scenario must reject that mutation at the live
four-cell traversal assertion. Keeping every cell blocked also prevented the next
tree from being gathered, so the final-cell mutation isolates the movement check.
The mutations are kept outside the repository.

This is automated server evidence on the small authored map. It does not establish
human playtest, browser appearance, faster travel, balance or 2,000-unit support.
