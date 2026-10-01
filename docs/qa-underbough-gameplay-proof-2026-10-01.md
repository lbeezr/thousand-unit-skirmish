# Underbough Rootways automated gameplay proof — 1 October 2026

This bounded server scenario extends the existing 24-unit regional objective
baseline with paid economy and recovery at a 250-unit opening. It reuses
`createFortifiedFixture` and publishes a disposable copy of the authored Rootways
map with only its ID and starting army size changed. Terrain, objectives,
resources, rewards, fog and spawn points retain the authored rules.

Run both winner routes on Node 24 or newer:

```sh
node scripts/underbough-gameplay-proof.mjs 0
node scripts/underbough-gameplay-proof.mjs 1
```

Each match starts with 125 units per seat, including four workers. Both seats
bank food and wood from home resource nodes before any timed or objective
rewards. Read-only checkpoints confirm resource stock consumption. Workers
complete a house and Barracks; exact bank deductions use the registered building
costs (250 wood combined). Each seat spends 50 food to produce a new infantry
unit. Orders carry unit generations and order tokens. Rejected orders fail the
proof; cost comparisons wait for a fresh snapshot and persisted tick.

Each seat reconnects with its original session while the other accepts an order.
A real worker stop/start restores the saved match and both seats, banks and
126-unit rosters. Eight infantry then follow the authored Supply Grove and outer
clearing routes for the selected winner. Both seats must agree on the
`capture-hold` result. Host reset restores the 250-unit opening, neutral
objectives, initial banks, unfired events and no constructed buildings; new unit
generations accept gathering orders and bank food in the rematch.

No checkpoint is written or modified by the runner. All economy, construction,
production, movement, capture and reset actions use ordinary WebSocket commands.
The generated fixture directory is disposed after each run.

## Evidence boundaries

Baseline checkout: `71a16102fd965a3bf284a7ea1ccab5bbfda1a4f3` plus this runner.
Environment: isolated local authoritative Node `v24.19.0`, Linux, loopback
WebSocket clients. Map seed: authored `93002`. The earlier command
`node scripts/regional-objective-scenario.mjs underbough-rootways` passed both
24-unit winner routes and rematches on that baseline.

Both commands above passed with exit 0 on the final runner. For each winner and
each seat, the emitted JSON recorded 10 food and 10 wood banked from gathering,
250 wood spent on construction, and 50 food spent on production. Both-seat
reconnect, checkpoint restart, reachable objectives, capture-hold result and
clean rematch checks all passed. `node --check` and `git diff --check` passed;
`node scripts/check-docs.mjs` passed all 2,456 local links in 387 Markdown files.
Both winner commands also passed after a clean rebase onto original upstream
`6678440ab2f12c13ee5787f2ef982559e304f252`. The user then selected
`lbeezr/thousand-unit-skirmish` as the integration destination. Only these two
proof files were cherry-picked onto fork main
`71a16102fd965a3bf284a7ea1ccab5bbfda1a4f3`; unrelated upstream history was
excluded. Fixtures, Rootways map and gameplay definitions match both baselines.
Fork validation, repository CI and integration are tracked in the pull request.

Both winner commands passed again on the fork-targeted branch, with the same
per-seat bank/cost evidence. Full local `node scripts/ci.mjs` stopped at
`Grounded starting settlements`: `obstacles: visual paint must not change match
rules`. Running `scripts/settlement-authoring-scenario.mjs` from a disposable
archive of unmodified fork main `71a1610` reproduced the same assertion and exit
1. The map, source modules, historical fixture and settlement test are identical
between that baseline and this PR. This pre-existing map/fixture mismatch is
outside the proof's ownership; no map edits or weakened assertions were made.
At that checkpoint, merge was pending resolution of the baseline blocker.

The reviewed settlement and packaging repairs subsequently merged in fork
[PR #3](https://github.com/lbeezr/thousand-unit-skirmish/pull/3), merge
`56de935f4e75080654b967542ac17e890010edba`. All 502 baseline CI checks passed
(168/167/167 across three shards), including release integration. Clean release
packaging passed at combined repair `d91c1ea`, without deploying anything.
After merging repaired fork main into this proof branch, both winner commands
passed again with the same bank/cost evidence and all six emitted checks.
The revised settlement scenario, new runner syntax, documentation links,
whitespace and CI shard-coverage tests also passed. The proof adds no runtime
changes to the fully checked baseline; its own two live routes run separately.

## Rematch provenance correction

Post-merge review identified a false-positive risk in the original rematch
assertion: a food bank increase alone could be caused by Rootways' timed supply
at 120 seconds, within the fixture's wait budget. That earlier assertion was
insufficient to establish rematch gathering provenance, even though the runs
reported a pass.

The follow-up uses a shared read-only checkpoint check for opening and rematch
gathering. It requires the appropriate bank increase and home-node stock
consumption, elapsed match time before the first authored timed supply, unfired
scenario rewards and neutral objectives. Both rematch workers gather in
parallel, then stop before the fresh persisted evidence is checked. The JSON
result records rematch seconds and both food-bank deltas.

`node --test scripts/underbough-gathering-evidence.test.mjs` covers ordinary
deposits, the actual map's reward-alone case (which passes the old condition),
bank growth without consumption, and supply/objective contamination. Its
synthetic checkpoints are isolated assertion tests, not injected live-game state.
Both live 250-unit winner routes passed on follow-up code `41436b5`, exit 0.
The new rematch checkpoints recorded 18.8 seconds (winner 0) and 18.1 seconds
(winner 1), each with food-bank deltas `[10, 10]`, consumed home-node stocks,
unfired rewards and neutral objectives. All four regression tests passed, as did
syntax, documentation, whitespace and CI shard-coverage checks. Independent
review and integration are tracked in the follow-up PR.

This is automated server evidence. Browser controls/rendering, human
comprehension, unassisted playtests, network impairment and hosted performance
are not established. A 250-unit opening is the scenario workload, not a new
supported capacity claim; this record makes no 2,000-unit claim. The other army
holds at home, so this proves reachable objectives and economy/recovery rather
than contested combat or competitive balance.
