# Bounded Crownroads inner-tick attribution — 5 October 2026

[Unique outer ticks](qa-crownroads-tick-attribution-2026-10-05.md) · [Existing disposable observer](qa-tick-cost-attribution-2026-10-04.md) · [Ranked queue](qa-performance-window-overruns-2026-10-05.md#ranked-queue-within-this-lane)

Two diagnostic repeats identify **`getMoveVector` as a recurring inclusive cost
inside simulation** for the 24-unit Crownroads256 movement workload. This slice
connects the existing disposable observer to the existing capacity driver;
production `server.mjs`, all `src` files, gameplay, scheduling and budgets are
unchanged. It implements measurement only. Art backing is N/A.

The historical **38.411 ms** tick remains an unattributed inner-cause failure.
Neither the previous **17.376 ms** maximum nor these profiled repeats establishes
an improvement over it: no matched optimization comparison was performed.

## Capture and consumer contract

`--attribution on` is explicitly restricted to Crownroads, 24 units and three
ten-second waves. Ordinary runs default to `off`. The adapter times the actual
`simulateTick`, `rebuildSpatialBuckets`, `getMoveVector` and
`spreadInteractingUnits` bindings only in its disposable loopback copy. Original
function bodies, arguments, receiver, results and thrown errors remain intact.
Existing paid-battle adapter defaults retain their prior function selection.

Rows now retain production match/map/tick metadata and exact budget/overrun flags;
the driver adds the worker ordinal. The real report checker joins inner and
rolling-health rows by worker/match/map/tick and rejects disagreement in duration,
budget, overrun, CPU or any outer phase. It also rejects duplicate identities,
invalid spans/function fields/GC windows and any dropped rows. The observer's
existing 2,000-row bound now reports its drop count rather than hiding truncation.
The driver retains derived diagnostics even when an existing budget assertion
fails; raw executed reports from before that retention refinement remain intact.

Function timings are inclusive wall times accumulated per tick. Parent/child
values overlap; **do not sum them**. Function quantiles cover only ticks calling
that function. GC overlap uses the broader observer span, from wrapper entry
through diagnostic/memory capture, rather than only the production duration.
An overlap does not establish that GC caused a tail. Heap changes are net live
occupancy changes, not allocated bytes; sampled RSS misses inter-sample peaks.

The reused observer retains CPU profiles at a 1,000 μs sampling interval and V8
allocation samples at 65,536 bytes, including collected objects. Each profile
has independent start/stop request/completion witnesses. Samples include idle,
callback planning and work outside tick rows, and cannot assign an allocation
estimate or CPU weight to one tick. Profiler/wrapper overhead is not subtracted.
No cgroup pressure or reserved hardware measurement is claimed.

## Repeated observations and retained failure

[Summary/hashes](qa-evidence/crownroads-inner-attribution-2026-10-05/summary.json),
[source manifest](qa-evidence/crownroads-inner-attribution-2026-10-05/source-manifest.json),
[repeat 1 raw](qa-evidence/crownroads-inner-attribution-2026-10-05/repeat-1.json.gz)
and [repeat 2 raw](qa-evidence/crownroads-inner-attribution-2026-10-05/repeat-2.json.gz)
retain full rows, profiles, GC entries and failing assertions. The standalone
[repeat 1 check](qa-evidence/crownroads-inner-attribution-2026-10-05/repeat-1-check.json)
and [repeat 2 check](qa-evidence/crownroads-inner-attribution-2026-10-05/repeat-2-check.json)
are actual consumer output, including the negative budget result.

Clean baseline source is `f182892ddd37b09c4c50b1b5462db4c61ea7dec9`;
both measurements use clean candidate `ebcd7bf98093cb2fe81ad36955d99436697036a7`.
The subsequent failure-retention refinement is `a711f048c6e7b38c504bc30840d5b4a5b9807ccd`.
Baseline and candidate production runtime bytes are identical. The manifest
retains exact server/map/driver/checker/observer/adapter hashes and a 215-file
runtime digest; later source integration is separate from these measurements.

| Diagnostic observation | Repeat 1 | Repeat 2 |
| --- | ---: | ---: |
| Unique Crownroads inner ticks | 1,080 | 1,078 |
| `getMoveVector` active ticks / calls | 993 / 25,843 | 989 / 25,754 |
| `getMoveVector` active-tick mean / p95 / max, ms | 1.514 / 3.113 / 15.845 | 1.468 / 2.841 / 15.970 |
| `simulateTick` mean / max, ms | 1.565 / 16.669 | 1.525 / 16.229 |
| Inner whole-tick mean / max, ms | 2.105 / 18.381 | 2.047 / 16.328 |
| Observed GC events / observer-span overlaps | 224 / 27 | 241 / 42 |
| Existing diagnostic envelope | Pass | **Fail: cold-recovery start-lag p95 36.237 ms** |

Repeat 1's largest simulation row is worker 1/tick32: total18.381 ms,
`simulateTick`16.669 ms and 24 `getMoveVector` calls totaling15.845 ms.
Repeat 2's largest is worker 1/tick659: total16.328 ms,
`simulateTick`16.229 ms and 24 calls totaling15.970 ms. This localizes the
recorded inclusive cost, not separation, detour, allocation, JIT or scheduling
as its cause. The prior rejected zero-force arithmetic probe remains rejected.

All inner rows validate; neither captured duration set contains an overrun.
Both observed ranges have zero uncaptured internal ticks and one known map-probe
interruption. Startup and recovery ticks before profiling are outside the inner
window. Repeat 1 joins all1,080 Crownroads rows to independent health rows;
repeat 2 joins1,077 and explicitly retains one trailing inner-only tick.

Repeat 2 remains **failed**, without waiver, budget change or rerun to erase it.
Cold worker 2's two-row health window reports start-lag p95/max36.237 ms and one
skipped slot at tick1084. The unchanged lag-p95 limit is1000/30 ms. Its CPU
profile startup request/completion spans37.275 ms before inner capture begins
at tick1083. That temporal observation motivates isolating profiler startup
from recovery lag; it does not prove startup caused the failure.

Runs were serial on non-isolated Node v24.19.0/Linux x64, with OS-reported AMD
EPYC 9V74/five visible CPUs. These are host observations, not reserved resources
or consumer-device qualification. Same public map bytes, 24 opening units, two
loopback seats, fog, north-pass/high-flank/causeway orders, checkpoints and cold
restore are exercised. Each seat's 12 actors moved in each wave. Commands are
not identical accepted-tick replay, and this is not full-route arrival, paid
combat/economy, fullmatch or hardware comparison. Evidence is source-qualified,
not sealed; `.agents` is empty and no sealed-telemetry skill was applied.

## Checks, delivery and next bounded action

Forty-one focused tests pass, including exact bodies/wire bytes, wrapper behavior,
identity/phase corruption, capture freeze, truncation/reset and GC boundaries.
The new observer controls fail against the exact baseline observer: six prior
controls pass and two new identity/drop controls fail; the executed
[negative receipt](qa-evidence/crownroads-inner-attribution-2026-10-05/baseline-negative.txt)
is retained. Types, docs, import boundaries, independent final-head review and
clean package/local health identity are recorded on the owning PR. This is a
source-tooling outcome; deployment and rendered acceptance remain unverified.

```sh
node --test scripts/tick-attribution.test.mjs scripts/map-capacity-report-check.test.mjs scripts/tick-samples.test.mjs scripts/performance-order-window.test.mjs
node scripts/map-capacity-scenario.mjs --map veyrholds-crownroads --loads 24 --seconds 10 --rss-stop-mib 512 --attribution on --output /tmp/crownroads-inner
node scripts/map-capacity-report-check.mjs /tmp/crownroads-inner/report.json
```

Next: isolate profiler startup/recovery lag using existing recorded boundaries
in a bounded 24-unit diagnostic, before proposing any budget enforcement or
optimization. Any finer `getMoveVector` subcost/call experiment must respect
movement/crowd ownership and the rejected arithmetic probe. CPU qualification
owner `01a10378` retains full runs; crowd owner `01a10933-c2b0` retains choke and
steering policy. No duplicate full CPU/crowd match ran. Ordinary256 supported
capacity is unverified, planned320 stays closed, and no2,000-unit claim is made.
