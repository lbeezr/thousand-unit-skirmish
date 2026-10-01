# AI Scout affordability — 1 October 2026

Baseline: fork `main` at `6493b0d1373ee8385ee9c9c2dddd4530280a5a04`.
An existing completed Stable could not recruit a Scout at 90–99 food because
the production policy applied the Infantry's 50-food cost plus 50-food reserve
before considering any military producer. The registered Scout costs 40 food
and 30 wood, so 90 food and 55 wood already preserve both policy reserves.

The policy now applies the Infantry threshold at its Barracks fallback. The
existing Scout, Rider and Siege Engine checks still use their own registered
costs. Prices, reserves, counter priorities, queue limits and retry timing retain
their existing values.

## Deterministic reproduction and checks

`scripts/population-ai.test.mjs` derives producer availability through the shared
authoritative `productionAction` helper. Both seats and seeds `0`, `20260925`
and `4294967295` failed the exact Scout-reserve case before the change; the 14
existing tests passed. After the change, all 20 tests pass, including 66 new
boundary/guard cases: exact reserves, 99/100 food, insufficient food or wood,
blocked/queued Stable, full population, observed mounted-counter priority,
Infantry fallback reserves and backoff after an unconfirmed purchase.

```sh
node --test scripts/population-ai.test.mjs scripts/siege-ai.test.mjs \
  scripts/production-queue.test.mjs scripts/snapshot-private-production.test.mjs \
  scripts/roster-production-ui.test.mjs
node scripts/pve-production-scenario.mjs
node scripts/pve-opponent-scenario.mjs
node scripts/pve-production-runtime-scenario.mjs underbough-rootways
```

All 38 tests in the combined unit command pass. Production budgets/retries and
the opponent lifecycle/WebSocket scenarios pass. The authoritative Rootways
regression completes paid Barracks construction, paid Infantry/Spearman
production and reinforcement orders for both seats, seeds `20260925` and
`4294967295`.

The low-food Scout case uses synthetic team-visible observations; the live
Rootways run verifies normal AI production rather than that exact bank boundary.
These are automated checks, not human playtest evidence or a new scale claim.
