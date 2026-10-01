# Cleared-forest building placement — 1 October 2026

Baseline: main `dfca7f66b9fccf41511a86b9ced4b3bfbed5b09d`.
After disclosed depletion, client building placement still tested the original
forest rectangles and reported `TERRAIN BLOCKS THIS SITE`. The server already
clears depleted cells in its current blocking array, so the client could reject
a site before sending an otherwise viable paid build command.

`buildPlacementAt` now checks the intersecting cells of each forest rectangle
against the client's disclosed stock. Every intersecting cell must be exactly
zero. Implicit, unknown and positive-stock cells remain blocked. Previously
disclosed zero stock remains known until the existing forest epoch/map reset
clears it; forests do not regrow during a match. No unseen state is requested
or inferred, and no server building rule, authored map or visual art changes.
Non-forest terrain, resource nodes, objectives, units and buildings keep their
existing placement checks.

```sh
node --test scripts/building-placement-forest.test.mjs
node scripts/harvestable-woodland-scenario.mjs
```

Six source-function regressions fail on baseline and pass with the client fix.
They execute the actual placement and forest-receipt code with synthetic
contexts for both seats: fully disclosed clearing, implicit/partial stock,
retained knowledge, epoch/reset, multiple overlapping rectangles, unrelated
forest and the other placement blockers. These tests are not browser evidence.

The existing authoritative woodland scenario retains its original forest layout
and movement/recovery/fog checks. Its disposable opening now supplies the
registered House cost. A Worker harvests the original tree and an endpoint tree,
depositing exactly six wood each. The 3x3 House footprint overlaps only the
depleted endpoint. Ordinary generation/token-checked commands pay the registered
cost and complete construction; recovery preserves the House and clearing, and
reset restores opening banks/forest while removing construction. No checkpoint
is written or modified by the runner. This is a small server scenario, not a
human match, rendered appearance, scale or balance acceptance.
