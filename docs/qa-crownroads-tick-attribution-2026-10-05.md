# Unique Crownroads tick attribution — 5 October 2026

[Rolling overrun baseline](qa-performance-window-overruns-2026-10-05.md) · [Measurement guide](testing.md#performance-measurements) · [Existing disposable profiler](qa-tick-cost-attribution-2026-10-04.md)

The retained **38.411 ms tick** has a 31-tick-window p95 of 4.157 ms and p50 of
0.311 ms. Its outer diagnostic records **31.282 ms simulation, 7.051 ms broadcast,
0.079 ms vision, zero scenario and 0.001 ms checkpoint**. Simulation is the
largest recorded component; this does not identify an inner function, allocation,
GC or host scheduling cause. The earlier report cannot supply the window mean
from its slowest-only rows. A timing outlier is insufficient reason to change
crowd, path-planning or simulation policy.

This slice fixes the measurement gap: the existing Crownroads capacity consumer
now retains identified unique tick rows, their outer-phase means/quantiles, and
every observed overrun. Existing budgets and production gameplay policy remain
unchanged. Art backing is N/A for internal telemetry.

## Identity, deduplication and validation

Opt-in `tickSamples=1` diagnostics now include match ID, map ID, the exact unrounded
tick budget and an `overBudget` flag calculated before duration display rounding.
The consumer adds the worker lifetime ordinal and keys each row by worker,
match, map and tick. Repeated rolling windows retain one copy; different workers
remain distinct after cold recovery even when match/tick identities overlap.
Map changes stay explicit rather than relabeling old ring rows as current-map work.

The existing report-check module is the real analysis consumer. It rejects missing
identity/phase fields, conflicting duplicate rows, changed budgets, impossible
phase totals and flags contradicting unambiguous rounded durations. Its 0.004 ms
phase-total tolerance accounts for the independently rounded total and five
components; this is serialization validation, not a performance budget increase.
Within the half-unit rounding interval the exact producer flag is authoritative.
Historical reports retain their original diagnostic-envelope result, with raw
attribution explicitly unavailable.

Reported coverage describes observed ranges. It distinguishes known other-map
ticks from uncaptured ticks; it cannot prove capture before the first or after
the last observation. The original candidate summary has one missing requested-map
tick in its map-only range: tick5 is actually retained as the boundary-probe map.
The refined checker reports one known interruption and zero uncaptured ticks.
The original raw report and its old summary remain unchanged.

Dominant-phase counts choose the largest outer component, with ties resolved in
the listed phase order. They describe where wall time was recorded. Process CPU
and in-tick planning are not additional disjoint phases; callback planning occurs
outside whole-tick timing. There is no GC/function/root-cause claim.

## Bounded observations and source limits

[Hashes and controls](qa-evidence/crownroads-tick-attribution-2026-10-05/summary.json),
[baseline raw report](qa-evidence/crownroads-tick-attribution-2026-10-05/baseline.json.gz),
[candidate raw report](qa-evidence/crownroads-tick-attribution-2026-10-05/candidate.json.gz)
and [refined check](qa-evidence/crownroads-tick-attribution-2026-10-05/refined-check.json)
preserve the actual executed and subsequent analysis identities.

| Observation | Clean measured source | Retained-window p95 peak / max | Max callback planning slice | Peak sampled server RSS |
| --- | --- | --- | --- | --- |
| Baseline | `c42a9b4b251bbb7edb2dcd9e60397e9c0df63217` | 14.487 /19.978 ms | 4.385 ms |157.340 MiB|
| Candidate | `fbea145520ac576b8317f297de4b7603470d68f9` | 17.376 /17.376 ms | 2.676 ms |130.496 MiB|

The source-qualified runs execute serially on the same non-isolated cloud
environment: Node v24.19.0/Linux x64, OS-reported AMD EPYC 9V74/five visible CPUs.
Neither CPU name nor reported host memory establishes reserved hardware or a
consumer-device result. Both use the same Crownroads256 bytes, 24 opening units,
two localhost seats, unchanged callback scheduling, north-pass/high-flank/causeway
orders, fog, three full tick windows, checkpoints and cold recovery. Neither is
a paid economy/combat/full-route match or identical accepted-command-tick replay.

The candidate captures **1,084 unique rows**: 1,083 Crownroads and one boundary
probe. Requested-map whole-tick mean/p50/p95/p99/max are
**1.565/1.148/3.114/4.573/17.376 ms**, with zero observed overruns. Simulation
mean/p95/max are 1.130/1.999/15.360 ms; broadcast 0.353/1.264/4.275 ms.
The maximum is cold-worker tick1083, with 15.360 ms in simulation. Startup,
preparation, movement and recovery remain in the same retained data, rather than
selecting only fast final windows. All figures describe observed rows, not
timing of every tick over the worker's entire lifetime.

The fresh runs did not reproduce the historical38.411 ms overrun. That earlier
failure and skipped slot remain in [the original record](qa-performance-window-overruns-2026-10-05.md).
Its p95 is a percentile, not an average. The candidate supplies an actual mean
and independent tail percentiles, but its instrumentation changes observation
overhead. **No timing speedup, RSS reduction, controlled hardware comparison or
inner-cause improvement is established.** Allocations/GC, cgroup pressure, peaks
between RSS samples, target GPU and hosted-network behavior remain unmeasured.
Sealed telemetry tooling and `.agents` skills were unavailable; no performance
skill requiring sealed telemetry was applied.

## Validation and delivery

```sh
node --test scripts/tick-samples.test.mjs scripts/map-capacity-report-check.test.mjs scripts/tick-attribution.test.mjs scripts/performance-order-window.test.mjs
node scripts/map-capacity-scenario.mjs --map veyrholds-crownroads --loads 24 --seconds 10 --output /tmp/crownroads-attribution --rss-stop-mib 512
node scripts/map-capacity-report-check.mjs /tmp/crownroads-attribution/report.json
```

Thirty-seven focused tests pass, covering rare spikes with passing p95/p99,
deduplication, map/worker/match changes, known interruptions versus missing rows,
phase corruption, contradictory flags and exact-before-rounding producer values.
The new production identity test fails against unchanged baseline source while
its four existing timing controls pass; [negative evidence](qa-evidence/crownroads-tick-attribution-2026-10-05/baseline-negative.txt)
is retained. Both native probes and the standalone report checker pass. The
post-measurement refinement changes only derived coverage and a validation
message; executed source/hash, original summaries and raw bytes remain separate.

Independent exact-head review, required checks, clean package and local served
verification are recorded on the owning PR. Source workers' build identity is
unknown; packaging/local HTTP identity must not be inferred from their source
SHA. Deployment and rendered acceptance remain separate, unverified states.
Ordinary256 capacity is unverified; planned320 stays closed and no 2,000-unit
readiness is asserted.

## Ownership and next action

This lane owns the report consumer and diagnostic-only metadata. Current owner
reservations and open PRs were inspected before changes. CPU/full-qualification
`01a10378` retains full matches and capture/dispatch interfaces; crowd
`01a10933-c2b0` retains steering/choke/liveness policy. No expensive full-match
duplicate, inner simulation rewrite, hosted dispatch or renderer retry ran here.
The [single ranked queue](qa-performance-window-overruns-2026-10-05.md#ranked-queue-within-this-lane)
retains the next bounded function/GC/resource measurement before optimization;
existing disposable profiler/resource observers are the candidate consumers.
