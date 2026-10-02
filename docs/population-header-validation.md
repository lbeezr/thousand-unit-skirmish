# Owned population header

The closed header displays `POP` and `used+queued/capacity`, such as `12+3/15`.
This replaces its former Azure/Ember FIELD headcount comparison. Population is
weighted: a Rider consumes two slots and a Siege Engine three. The readout uses
the owned authoritative `state.population` record, not visible unit count or
locally estimated reservations. Simulation accounting and protocol are unchanged.

[The shared presentation projection](../src/population-readout.mjs) also supplies
the expanded Build & train line and the header's accessible status name/hover
description. Available capacity of zero keeps the existing build-a-House hint.
Unassigned/spectator views show join guidance even if their snapshot contains
both records. Missing or malformed owned data shows connecting guidance; it
never falls back to another seat. Repeated unchanged snapshots do not rewrite
the status text or accessible name.

The readout stays visible below 620px and participates in the existing measured,
wrapping header. Objective, camera and panel offsets continue to use that measured
height. This slice does not adopt a new art skin, move commands or restructure
the command deck. Exploratory art previews remain separate and private.

The live paid-Stable check also exposed an existing production-building outline
scope error that interrupted snapshot application. Barracks and Archery Range
visuals now use their local outline points inside their already grounded group,
instead of calling a world-coordinate helper private to map setup. A constructor
regression checks both visual paths and seats with nonzero terrain height.

## Focused checks

Run:

```bash
node --test scripts/population-readout.test.mjs scripts/resource-format.test.mjs \
  scripts/population.test.mjs scripts/snapshot-private-production.test.mjs \
  scripts/hud-layout.test.mjs scripts/client-rematch-recovery.test.mjs \
  scripts/client-build-recovery.test.mjs scripts/ci-sharding.test.mjs \
  scripts/building-sprites.test.mjs
node scripts/population-scenario.mjs
node scripts/client-asset-allowlist-scenario.mjs
npm run docs:check
```

The tests cover both seats, weighted mixed rosters and FIFO/Worker reservations,
House completion/loss, deaths, queue completion/cancellation, restored/reset
records, enemy masking and spectator ownership guards. The actual
`updateEconomyUI` function is exercised for both synchronized readouts; the
authoritative population scenario separately proves real both-seat House,
paid-queue, destruction and server-restart behavior.

## Owner-run browser proof

With an installed Chrome/Chromium, run:

```bash
node scripts/population-hud-browser.mjs --output=/absolute/new/private/evidence-directory
```

The runner uses the repository's isolated browser and authoritative fixture
helpers. `CHROME_PATH` selects an installed executable. The output directory
must not exist, and is optional; without it, the runner saves no PNGs. Output is
sanitized UI evidence, not raw checkpoints, session tokens or logs.

It publishes a minimal no-fog 24-unit map from the default Bellweather catalog
before rendering, then tests Azure, Ember and spectator browsers with at most
two rendered clients alive. Real paid
Worker production/cancellation and Rider production exercise reserve-before-spawn,
weighted use, checkpoint resumption and host reset. Native mouse/Escape checks
cover Production opener focus, selection retention and Map hide/reopen.

Layout checks use 1280×800, 1024×640 and 620×640 at DPR 1. They compare the new
readout against the former FIELD slot in the same DOM to check permanent header
height, then stress a long numeric value and 200% **population text**. Those
stress values are temporary DOM samples, not server population observations.
All text in the app is not enlarged by that check. Accessible status naming is
checked in Chromium's accessibility tree; human screen-reader usability remains
unverified. This is a bounded owner-run UI proof, not a performance benchmark or
acceptance of the private HUD art direction.

Record the tested revision, browser, results and any failed attempts in the PR.
Keep local captured rasters and private fixture data outside the public patch.
