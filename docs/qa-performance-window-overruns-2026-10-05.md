# Rolling tick overrun telemetry — 5 October 2026

[Measurement guide](testing.md#performance-measurements) · [Paid battle qualification](qa-paid-battle-tick-budget-2026-10-04.md) · [Ordinary map inventory](map-tier-inventory-2026-10-04.md)

The performance-budget lane adds **p99 and a rolling over-budget tick count** to
the existing `/health` timing report. The motivating paid-battle record has two
of 930 ticks over the 33.333 ms period despite a passing p95. This change measures
that tail; it changes no orders, planner policy, simulation rules, map admission,
or existing acceptance budgets. Art backing is N/A for internal telemetry.

## Contract and real consumer

`p99Ms` uses nearest rank, like existing p50/p95, rounded to three decimals.
`overBudgetTickCount` counts stored durations strictly greater than `1000 / TICK_RATE`
in the same up-to-300-tick ring. Equality is within budget. The duration ring now
uses Float64 so storing a JavaScript timer duration does not round a just-over-budget
value below the threshold. This adds exactly 1,200 array-buffer bytes per worker;
it is not an explanation for changes in sampled RSS. Displayed `budgetMs` and
`maxMs` may round equal even when the exact duration exceeds the period.

Both fields are available without opt-in diagnostic rows. An empty ring has null
p99 and count zero; inactive/expired slots are excluded. Counts describe one
rolling window. **Never sum overlapping window counts**, or interpret zero in a
late window as erasing preparation spikes or scheduler skipped slots.

The existing [map-capacity consumer](../scripts/map-capacity-scenario.mjs) validates
the fields, retains them in raw health reports, and prints both after each wave.
Its p95/max/lag/planning envelope remains unchanged. Passing that envelope does
not mean every tick meets the scheduler period. Focused tests exercise passing
timings, two rare spikes with passing p95/p99, exact threshold, the old Float32
boundary loss, chronological wrap, expired slots and empty windows.

## Bounded baseline and candidate

[Machine summary and hashes](qa-evidence/performance-window-overruns-2026-10-05/summary.json)
identify all three retained runs. Raw reports:
[baseline](qa-evidence/performance-window-overruns-2026-10-05/baseline.json.gz),
[pre-review candidate](qa-evidence/performance-window-overruns-2026-10-05/candidate-pre-review.json.gz),
[precision-corrected candidate](qa-evidence/performance-window-overruns-2026-10-05/candidate.json.gz).

| Run | Measured source | Peak retained-window p95 / max | Maximum planning slice | Peak sampled server RSS |
| --- | --- | --- | --- | --- |
| Baseline | `b5b4dd49139b86dbe6ad0d299469f6b193df81b1` | 13.914 / 15.024 ms | 4.582 ms | 129.000 MiB |
| Pre-review | `9392d05803e56a480f61e7a6db7b2acaf9986f76` | 14.889 / 38.411 ms | 5.554 ms | 135.027 MiB |
| Corrected candidate | `4d7e37b39fa5f9e07d95abb4e7270d315c8dab9f` | 18.245 / 18.245 ms | 3.820 ms | 150.840 MiB |

The same public Crownroads map bytes, terrain seed, 24-unit opening, default
callback planner and two localhost seats exercise north pass, high flank and
causeway movement, private fog, three at-least-300-tick waves, checkpoints and
cold recovery. All actors moved in each wave; this is not full-route arrival,
paid economy, combat, human entry or a full match. Callback planning slice time
is measured separately from outer simulation ticks. Exact command-application
ticks are not replayed deterministically; do not treat these timing samples as
a fixed-command replay comparison.

The pre-review candidate provides a real negative witness: tick31 took
38.411 ms in a 31-tick preparation window with p95 4.157 ms, count1 and one skipped
slot. Eleven overlapping observations retain that one count; they do not prove
eleven different overrun ticks. Its three final full windows show count0.
The corrected candidate's final waves have p99 3.780/3.610/3.552 ms, count0 and
zero skipped-slot deltas. The earlier spike remains a failure of an all-ticks
under-period qualification, not waived by either later windows or another run.

The baseline/pre-review checkouts were clean. The corrected candidate honestly
retains `sourceDirty: true`: only this evidence directory was untracked, with
no runtime modifications. The summary records that path and exact committed
213-file runtime-content hashes. These are source-qualified observations, not
sealed telemetry or clean controlled-comparison acceptance. `.agents` was empty;
`game-dev` was unavailable, so no sealed-telemetry performance skill was applied.

Node v24.19.0/Linux x64 reported AMD EPYC 9V74 and five visible CPUs. Host memory
and CPU model are OS observations, not reserved resources or consumer hardware.
Runs were serial on a non-isolated cloud worker; dependency provisioning overlapped
part of the baseline. There is no statistical/causal speedup conclusion. Source
workers' health build identity remains unknown. Allocation/GC, inter-sample RSS
peaks, warmup/JIT equivalence and scoped cgroup pressure are unmeasured. The 512 MiB
RSS stop is the existing diagnostic stop, not a new supported-memory budget.

## Reproduce and delivery scope

```sh
node --test scripts/tick-samples.test.mjs scripts/map-capacity-report-check.test.mjs scripts/performance-order-window.test.mjs
node scripts/map-capacity-scenario.mjs --map veyrholds-crownroads --loads 24 --seconds 10 --output /tmp/crownroads-timing --rss-stop-mib 512
node scripts/map-capacity-report-check.mjs /tmp/crownroads-timing/report.json
```

Twenty-six focused tests, both strict type projects and runtime import boundaries
pass. Independent review identified the Float32 boundary issue; the corrected
test uses the actual production storage declaration. Final exact-head documentary
review and clean packaging are recorded on the owning PR. Source, release/package,
deployment and rendered acceptance remain separate identities; a source merge
does not identify deployed bytes.

## Ranked queue within this lane

1. Consume this metric in the next already-owned complete-tick qualification,
   retaining every sampled window, raw unique tick boundaries and skipped slots.
   The [bounded Crownroads consumer follow-up](qa-crownroads-tick-attribution-2026-10-05.md)
   now retains identified unique rows and separates mean/tail outer phases; this
   source observation does not close complete-match qualification.
   CPU/full-qualification owner `01a10378` retains expensive full matches; this
   lane does not launch duplicates or change that owner's scheduling interface.
2. Preserve the original checkpoint and first recovery tick-start clocks when
   the already-owned qualification next fails; no additional match is scheduled.
   The [historical attribution limit](qa-crownroads-profiler-startup-2026-10-05.md#historical-failure-attribution-limit)
   places 37.275 ms of profiler startup inside the failed tick-start gap, but the
   original input is missing. Fresh-input production/observer controls cannot
   distinguish the cause of that 36.237 ms lag failure, so no further control ran
   and the unconditional overhead experiment is deferred. The retained matched
   forks use another input/anchor; observer-only still has instrumentation cost.
   Evidence is insufficient for gameplay optimization. Keep the failed repeat,
   first cold-tick cause, wrapper/memory/GC overhead and scoped pressure/RSS peaks
   open; never subtract profiler startup from qualification lag. Finer subcost
   work retains movement/crowd ownership and the rejected zero-force result.
3. Establish ordinary256 rendered timing and device/viewport/backend identity
   through the existing cloud renderer owner. Retained hosted sandboxed SwiftShader
   Open Field frames prove selected pixels, not Crownroads GPU performance.
   The existing local browser block is retained without a security bypass/retry.

Crowd owner `01a10933-c2b0` retains choke/liveness policy work. Ordinary Large256
is admitted but its supported unit capacity is unverified. **Planned XL320 stays
closed**: both retained probes reject 320×320 and 257-edge grids, accepting256×256.
The 32-bit visibility prerequisite does not admit320. No 2,000-unit readiness,
Mac testing, deployment, provider dispatch, purchase, access change or held-art
publication is part of this delivery.
