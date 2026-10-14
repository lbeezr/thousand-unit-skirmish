# Map Studio resource diagnostics — 14 October 2026

[Authoring contract](map-authoring.md#resource-budgets-and-access-diagnostics--14-october-2026) ·
[Map tier inventory](map-tier-inventory-2026-10-04.md) · [Testing strategy](testing-strategy.md)

Owner: maps/map-making chat `01a13a87-26dd-70b1-9410-ffa2f8e6932e`.
Source base: `03ef26665cc9a79973cf75ca6d9ab59d9f7f0095`.
Branch: `codex/map-resource-diagnostics`. Final reviewed source, clean release
digest and deployed identity are separate receipts in the attached PR/task.
This slice adds a normal Map Studio tool across the existing catalog. It changes
no map layout, stocks, prices, modes or portable save format.

## Acceptance and observations

Azure → Match Controls → Map Studio → Resource Budget & Access shows starting
banks, finite node totals/shorter-route allocation, both-seat reachability,
forest potential and individual marker routes/frontage. Edits, patch apply/undo,
terrain undo, spawn changes and recovered drafts produce fresh reports. Invalid
inputs remove stale results and show a remedy. The panel is advisory and reads
only the authored draft; validators retain publication authority.

The backing and interaction storyboard are in the authoring contract. Tables
reuse current editor typography/materials and the preserved Vaelora interface
reference; no new terrain art is generated. Rendered narrow-layout and pointer
usability remain separate from DOM/controller evidence.

Static cardinal route allocations at this source expose a useful comparison:

| Map | Finite Food / Wood nodes | Closer to Azure | Closer to Ember | Forest potential / initial edge cells per seat |
| --- | ---: | ---: | ---: | ---: |
| Terraced Vale Tiny | 6,100 / 7,950 | 3,050 / 3,975 | 3,050 / 3,975 | 18,972 / 614 |
| Threefold Basin Small | 9,700 / 11,950 | 4,850 / 5,975 | 4,850 / 5,975 | 24,204 / 710 |
| Riven Escarpment Medium | 12,100 / 14,950 | 5,650 / 6,975 | 6,450 / 7,975 | 38,460 / 1,046 |
| Crownroads Large | 19,700 / 24,150 | 9,350 / 11,475 | 10,350 / 12,675 | 49,356 / 1,294 |

All node stock on these four is initially reachable from both seats; none is
equidistant under this cardinal-marker method. Forest potential after cutting
is reachable from both seats. Medium/Large's allocation difference is not
unequal authored home stock, resource ownership or observed income. Compare
actual contested pockets/trips before changing map balance. The existing
mirrored home/expansion measurements remain historical evidence.

## Checks and boundaries

- `node --test scripts/map-resource-diagnostics.test.mjs`: nine checks covering
  exact bank/node/forest separation and partition conservation; fractional stocks,
  Stone profile, Sheep/fish labels, height/water/TC blockage and remedies; every
  one of the 32 shipped maps; production editor updates, patch/terrain history,
  recovery/export, caching, invalid drafts and text-only handling of unsafe IDs.
  Independent review exposed six-place display rounding of a positive `1e-7`
  stock and floating-point loss when `1e16` was followed by four one-stock nodes.
  Exact decimal accumulation/formatting fixes both; regression cases also cover
  a total larger than the finite Number range. Derived budget strings sum parsed
  stocks without changing gameplay's numeric representation.
  Independent recheck passes all nine checks, verifies a 128-node mixture of
  maximum/subnormal values conserves exactly, and finds no remaining actionable
  issue. Rendered usability remains open.
- Existing editor/terrain/draft/import regression suites: 145/145 pass.
- Map-scale/XL audit regressions: 21/21 pass; current source catalog audit runs
  with the shared forest-stock constant. Dependency regression suite: 66/66 pass;
  graph guard, existing strict type scopes, docs and whitespace checks pass.
- Native `harvestable-woodland-scenario.mjs` passes finite cutting/deposits,
  sparse/fog-filtered state, cleared-cell movement, paid House on depleted ground,
  cold recovery and reset after the unchanged constant moves to its shared rule.
- Packed release scenario passes exact module/rule bytes, MIME/HEAD, recursive
  game imports and malformed/private path denial. Final committed identities
  and independent review outcomes belong to the PR receipt.

These are focused checks, not a full fast/simulation suite. JSDOM executes the
production host/controller functions while rendering, audio and browser pointer
capture are stubbed. Static routes ignore interaction radius, weighted uphill
cost, unit offsets/congestion, live visibility/ownership, new buildings, naval
travel and actual deposits. No browser frame or income/balance acceptance is
claimed by a table or an all-catalog conservation test.

## Retained next action

The map-making owner retains exact merged/package/staging verification and the
ordinary rendered tool check. Supported cloud browser provisioning remains the
recorded [capability blocker](cloud-environment.md#optional-browser-readiness-and-known-provisioning-blocker);
unchanged cloud setup is not retried and stopped Mac tests are not used.

At a containing served release, open a disposable Tiny Terraced Vale room as
Azure. Compare banks/nodes/forest, edit node stock, add a patch, draw and undo a
forest, move a spawn, generate hills, download/recover and Save & Play. Inspect
the report and node list at normal/narrow layouts, keyboard scrolling/focus,
pending/invalid announcements and actual committed-map geometry after reconnect.
Preserve the original room; publication resets only the disposable match.
Then compare Medium/Large's contested pocket access in paid two-seat play before
selecting a balance refinement. Constrained Grove/Orchard presets remain the
next independent authoring slice.
