# Rootways Scout retreat — 1 October 2026

On fork baseline `8cdf5285ddb79bc6b9ca9c5e92d40b07b6d43091`, a paid
Scout exploring Rootways alternated between retreat and exploration once per
second around a stationary visible threat's nine-cell boundary. It failed to
finish retreat within 45 seconds. A reduced fixture reproduced the interruption
for both seats and seeds `0`, `20260925`, and `4294967295`.

The policy now retains a retreat until its destination is reached. It approaches
the nearest edge outside the completed friendly Town Center's registered
footprint instead of its blocked center. The existing one-cell arrival tolerance,
nine-cell threat test, nearest-home preference, ten-second stall retry, unit
generation handling, prices and combat values retain their existing values.

```sh
node --test scripts/pve-reconnaissance.test.mjs
node scripts/underbough-scout-scenario.mjs
```

All 11 policy tests pass, including six seat/seed boundary cases, arrival and
exploration resumption, stalled retreat, lost home and replacement generation.

The authoritative scenario reuses `createFortifiedFixture` on the unchanged
24-unit Rootways map. Both seats pay 200 wood for a Stable and 40 food/30 wood
for a Scout. Army units hold their opening positions. Each Scout explores with
the existing policy, then a scripted opponent approaches the temporarily stopped
Scout so a visible threat can be tested deterministically. The opponent stops;
the policy retreats outside the authoritative home footprint, arrives within
one cell, and emits a new exploration order. An ordinary reset separates seats.
Seat 0 discovers 157 new fog cells; seat 1 discovers 213. Both finish with three
policy orders: explore, retreat and resume.

Checkpoints are read-only: cost checks and a persisted clock for coalesced idle
snapshots. All tactical inputs come from the filtered observation. No economy,
units, buildings, map geometry or checkpoints are injected. This is a bounded
automated role test, not a contested human match, browser evidence or scale claim.
