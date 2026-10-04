# PvE regroup after a wipeout — 3 October 2026

The deterministic opponent already gathers, replaces Workers, plants paid finite
Farms, repairs/rebuilds producers, recruits counters, scouts and uses Siege
Engines. Its objective army retries stalled routes and answers visible home
raids. This slice changes only its behavior after the entire ordinary combat
army dies: replacements previously advanced individually, regardless of whether
enough troops existed to capture an objective.

## Original Millrace reproduction

Engine baseline: `20c4fcea1c35ac9920f04ecd6f891d55c31b0f56`.
Millrace seeds: Azure `20260925`, Ember `0`. Both ordinary seats connect through
WebSockets, advancing the authored scenario clock at 30 Hz; policy decisions run
once per simulated second. Policy input is only the existing fog-filtered seat
observation. Initial checkpoint, map, prices, troops, resources and opposing
policy are identical; only Azure receives the candidate policy.

Azure's eight opening troops die by 29 seconds. The unchanged policy sends ten
paid replacements individually; all die 13.17–25.83 seconds after their advance
orders. Across all 301 one-second samples from 30–330 seconds it has at most two
military units, owns no objective and makes zero capture progress. Ember wins
at 330.5 seconds.

The candidate first advances five combat replacements at 170 seconds, captures
the South post at 206 seconds and the North post at 259 seconds. At the common
330.5-second boundary, seven of the first ten combat replacements have died,
versus ten before; total military losses are 15 versus 18. The candidate has
four living military units. It reaches at least five military units in 133 of
the same 301 samples and holds two posts concurrently. Ember still wins, at
614.5 seconds. The longer match accumulates 25 Azure military losses, so this
does not establish fewer total losses or improved win rate. Ordinary Azure food
deposits rise from 350 to 760 over these differently sized matches.

Each complete candidate match runs twice from the same initial checkpoint and
compares commands, notices, events, metrics and banks. A separate saved-command
replay reproduces the entire authoritative terminal state. Only disposable seat
credentials are removed from retained checkpoints. The
[comparison record](qa-evidence/pve-regroup-2026-10-03/comparison.json) contains
checkpoint/trace/policy hashes and per-generation replacement deaths.

## Bounded policy and native regression

The [policy](../src/pve-regroup.mjs) rallies replacements until five available
combat troops exist, or 120 seconds have passed since the first available
replacement. It preserves urgent home defense, focused/recent combat, roles,
ownership, generations and ordinary paid recruitment. It uses owned positions
and producer state; it adds no enemy memory or hidden danger map. A fresh policy
after checkpoint restore infers a small-army recovery from its living owned
Barracks/foundation and starts another bounded wait.

[`pve-regroup.test.mjs`](../scripts/pve-regroup.test.mjs) includes both-seat,
three-seed guard matrices and two authoritative recovery cases, each replayed
twice. A controlled loss prelude uses normal Move orders through a public
crossing; eight opposing starting Infantry focus only visible attackers.
Real combat kills the opening army. Normal gathering, paid construction and
recruitment then resume. The test restores a checkpoint with two replacements
rallying and recreates the policy. No units, HP, banks or positions are injected.

On the unchanged policy both native cases fail because their first recovery
advance contains one troop. The candidate advances five and retakes the watch:

| Seat | Opening wiped | Checkpoint restored | Five-unit advance | Watch captured | Workers alive |
| --- | --- | --- | --- | --- | --- |
| Azure | 40 s | 96 s | 153 s | 178 s | 4 |
| Ember | 37 s | 95 s | 152 s | 175 s | 4 |

All 14 tests pass. They also check deadline release with a halted producer,
duplicate observations, bounded retries, resumed paid Worker recruitment,
role/ownership exclusions and combat preservation at both release conditions.
Both complete native replays match exactly. Finite stock, cargo, banks and
spending reconcile for food and wood; each seat spends 320 food and 215 wood.

The existing four-map real-socket production smoke also requires a paid troop to
receive an advance order. Recorded first advances at 134–174 seconds exceed its
former 120-second total budget. Its bounded budget now combines that production
window with one maximum rally interval, and reports the first trained troop and
reinforcement advance times. A separate deadline still requires both seats to
produce a paid troop within 120 seconds. The paid queue, completed producer, opening orders,
and trained-and-ordered assertions are retained.

## Matched current-engine comparisons

Navigation/combat fixes landed after the original reproduction. At engine
`7c6ec842349cab30afde9244c8953fee8ab91599`, the unchanged AI already wins that
Millrace seed pair at 432.3 seconds. That outcome is not attributed to regroup.
The following comparisons use this same engine for both policies, the same
per-map initial checkpoints, and candidate policy on both seats. All six ordered
pairs among `0`, `20260925`, `4294967295` run on both current PvE maps, plus two
swapped pairs on Forked Vale and Woodland Expanse: 32 cases, each run twice.

All 64 complete matches replay exactly. The baseline has two rejected placements;
the candidate has three: two occupied Stable footprints and one blocked
Storehouse site. Both Stable attempts retry successfully at another site five
seconds later; the Storehouse does not retry before victory. Rejected placements
consume no payment. No rally or military advance is rejected. Fifteen
candidate cases end by capture-hold; one Woodland case reaches its authored
900-second deadline and draws at 900.1 seconds. This is a real strategic cost:
the baseline wins that case at 504.1 seconds. The
[full matrix](qa-evidence/pve-regroup-2026-10-03/matrix.csv) records every winner,
time and trace hash. Candidate capture victories range from 151.6–409.1 seconds.
Winner changes and longer/shorter pressure windows demonstrate that regroup
affects play; they do not establish seat balance, competitive strength or fun.

```sh
node --test scripts/pve-regroup.test.mjs
```

The new test is registered in the repository suite. Exact broader CI, independent
review, integration and postmerge results are recorded in the integration PR.
No engine, navigation, unit price/stat, shipped map, provider API, art or
deployment change is included.
