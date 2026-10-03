# PvE paid Farm starvation recovery — 3 October 2026

Baseline: `main` at `ad236c88ccf6892684a3e06476ffc954eded1346`, including
the [merged finite Farm contract](farm-finite-planting.md). The observation
adapter already exposes owned completed crop nodes and the gathering policy
can harvest them. Production never plants one: with four Workers, an owned
Town Center, zero food, 400 wood and no natural resource nodes, the unmodified
policy spends on a Barracks at tick 300 and supplies no food.
The baseline authoritative run remains at zero food through tick 9,000, with
225 wood left, no planted crop and no food deposit.

The bounded policy adds one living owned recovery plot. It plants only below
the existing 100-food recruitment budget, with no observed productive food
node, an observed completed owned food drop-off, an eligible empty-cargo
Worker, visible candidate footprint and at least 60 + 25 wood. When available
population is at or below the military slot demand, it also preserves the
75-wood House price. Existing Worker replacement and urgent House decisions
run first. A paid unfinished Farm can resume without a second debit.

A completed plot is cleared only when its own observed crop node has exactly
zero stock and replacement is affordable. The policy sends the normal
`cancelConstruction`, waits for observed removal, rechecks resources, then
sends a fresh `build` with the Worker's current generation. It never refills
or cancels a productive or foreign crop. Multiple existing owned Farms suppress
new Farm decisions. Existing opening delay and 150/300/600/900-tick rejection
backoff bound repeated unconfirmed orders.

## Authoritative fixed-tick evidence

[`pve-farm-policy.test.mjs`](../scripts/pve-farm-policy.test.mjs) uses the existing
[headless adapter](../scripts/pve-headless-fixture.mjs) with intact authoritative
command, simulation, observation and checkpoint functions. Its test-only 80 × 64
fogged map starts four Workers on each seat with ordinary Town Centers, zero
food and 400 wood. The other seat remains passive. No stock, cargo or bank is
injected. No shipped map or engine function changes.

Every case plants at tick 300. The first crop is exhausted, cleared with no
refund, and replaced by a new paid building/source identity. Real gathering,
movement, cargo return and deposit deliver more than the first crop's finite
200 food. At every decision, tests account for bank, cargo, remaining crop,
actual command debits and exactly 200 supplied food per completed Farm.
There is never more than one living owned plot.

| Seat | Policy seed | First food deposit | Exhausted plot cleared | Fresh Farm placed | Food from replacement deposited |
| --- | --- | --- | --- | --- | --- |
| Azure | 0 | 1,090 | 4,410 | 4,560 | 5,444 |
| Azure | 20260925 | 1,138 | 3,000 | 3,150 | 3,952 |
| Azure | 4294967295 | 1,166 | 4,560 | 4,710 | 5,662 |
| Ember | 0 | 1,153 | 2,970 | 3,120 | 3,936 |
| Ember | 20260925 | 1,106 | 3,840 | 3,990 | 4,771 |
| Ember | 4294967295 | 1,237 | 3,660 | 3,810 | 4,616 |

Each case restores validated checkpoints during construction, while carrying
food from a partially harvested crop, and after exhaustion; it recreates the
policy at each restart. Observations remain identical across restore. Each
complete restarted match runs twice from the same initial checkpoint, preserving
random server generation identities, and compares every command, restart,
event tick and final bank. Shadow policies also compare every decision.

The food trigger follows the existing recruitment budget because one Infantry
and one Spearman spend 110 of the first 200 food, leaving a real 90-food stall.
A trigger at the 50-food reserve alone would never replant that depleted crop.

## Checks and limits

The 12 tests include six authoritative replay cases and six seat/seed guard
matrices. Guards cover exact ordinary and near-full housing budgets, food
thresholds, healthy natural/owned food, unknown crop stock, multiple plots,
missing/foreign/unfinished/destroyed drop-offs, absent/busy/carrying Workers,
fogged footprints, the population ceiling, paid foundation resumption, Worker
and House priority, duplicate observations, retry backoff, foreign plots and
budget changes between clearing and fresh construction.

```sh
node --test scripts/pve-farm-policy.test.mjs
```

All 84 focused tests pass across Farm, Worker recovery, population, siege,
reconnaissance and gameplay definitions. The five existing production, Barracks
recovery, decision fairness, tactical retry and reinforcement recovery scenarios
pass. The real two-client fogged finite Farm scenario passes all 12 conservation
records, including paid replanting, cargo restart and destruction. The shipped
Forked Vale production runtime passes for both seats. Documentation links and
whitespace checks pass.

The regression is registered in the repository suite. Additional checks and
exact revision results are recorded in the integration PR. This fixture demonstrates
paid food recovery against a passive seat; it does not establish competitive
strength or human enjoyment. Active gather assignments are preserved, so this
slice does not rebalance Workers already gathering wood or hunt unseen resources.
There is no new map, art, provider API, deployment or security change.
