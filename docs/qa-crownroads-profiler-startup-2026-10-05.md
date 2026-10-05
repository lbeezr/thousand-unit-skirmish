# Matched Crownroads profiler startup controls — 5 October 2026

[Prior inner attribution and failed repeat](qa-crownroads-inner-attribution-2026-10-05.md) · [Ranked queue](qa-performance-window-overruns-2026-10-05.md#ranked-queue-within-this-lane)

Four matched cold forks isolate **CPU/allocation profiler startup from the same
observer without those profiles**. Profiled startup occupies 37.149/38.123 ms;
observer-only startup occupies 0.008/0.008 ms. The next-tick lag is 12.618/15.601 ms
with profiles and 0.156/1.530 ms in controls. This identifies instrumentation
elapsed time in the recorded tick-start gap, not an optimization or hardware
result. The historical **36.237 ms lag-p95 failure remains unresolved** and its
[raw failed repeat](qa-evidence/crownroads-inner-attribution-2026-10-05/repeat-2.json.gz)
is unchanged. Neither earlier 38.411 ms nor 17.376 ms maxima are speedup baselines.

## Fixed input and bounded method

The existing capacity driver adds explicit `--recovery-profile-control on`,
requiring the existing opt-in inner observer and its Crownroads256/24-unit/
three-ten-second-wave scope. Defaults and paid-battle profiler selection are
unchanged. This is internal measurement; art backing is N/A. Production server,
all `src` bytes, game rules, scheduler and budgets remain unchanged.

One observer-only preparation exercises the same two seats, fog and
north-pass/high-flank/causeway movement, with 12 actors per seat moving in each
wave. After closing both seats and stopping that worker, the driver freezes
one actual checkpoint and restores its identical bytes for four serial forks:
**profile / observer / observer / profile**. The SHA-256 is
`69028ec16db7df5bc213a03a570400c4620b5ec53bbcfe1bf52fb572e2ad43b1`.
[Exact generated input](qa-evidence/crownroads-profiler-startup-2026-10-05/recovery-input.json.gz)
contains synthetic loopback state and seat token hashes, without plaintext
resume tokens. No new gameplay commands are sent after restoration.

All forks recover the same match at tick 1082, start the observer at tick 1085
and retain the identical fixed tick range 1083–1142. Each has **60 unique native
ticks and 57 consecutive production start clocks at 1086–1142**. Restore uses
normal production code; host wall time, seat connection receipts, phase within
the third tick's interval and session expiry are not clock-replayed. The
reproduction command generates a fresh common input, not the same old wall-time
or accepted-command history. This is not paid combat/economy, route completion,
rendered play, a full match or a 2,000-unit workload.

Both modes retain the same timed function bindings, memory observations and GC
observer. Only CPU/allocation profiling differs. **Observer-only is not zero
instrumentation**: no overhead is subtracted from function or tick timings.
In profiled forks, `Profiler.start` alone spans 36.452/37.430 ms inside the total
startup interval; CPU/heap sampling have separately recorded endpoints. Profiles
include outside-tick work and idle; do not assign sampled weights or allocation
estimates to a particular delay. Inclusive function costs overlap and the earlier
`getMoveVector` observations do not identify steering/allocation as their cause.

## Consumer and observed boundaries

The existing observer records total startup request/completion, queued startup
rows, exact production tick-start and predecessor times, and pre-rounding
start lag. Active and startup arrays retain separate explicit drop counts under
the existing 2,000-row bound. The production tick body remains intact.

The existing report checker is the real consumer. It validates shared input,
profile order/absence, exact third-tick anchor, all 60 native rows, all 57 clocks
and predecessor continuity. It joins every clock to independent health rows by
worker/match/map/tick and compares budget, overrun, duration, CPU and all five
outer phases. Missing middle/adjacent clocks, shifted clocks, wrong anchors,
changed inputs and profiler leakage fail validation. It reports startup-adjacent
rows separately from averages; no transient spike is erased by a final window.

[Full raw report](qa-evidence/crownroads-profiler-startup-2026-10-05/matched.json.gz),
[summary/hashes](qa-evidence/crownroads-profiler-startup-2026-10-05/summary.json),
[source manifest](qa-evidence/crownroads-profiler-startup-2026-10-05/source-manifest.json),
[original checker output](qa-evidence/crownroads-profiler-startup-2026-10-05/original-check.json.gz)
and [refined checker output](qa-evidence/crownroads-profiler-startup-2026-10-05/refined-check.json.gz)
retain actual results. The analysis-only coverage refinement adds the 57-clock
requirement; raw evidence and its original summary are unchanged. Original and
refined output bytes match for this complete capture.

| Cold fork / worker | Profiles | Total startup, ms | Next tick 1086 lag, ms | Tick1086 duration, ms | Lag p95 over57 clocks, ms |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 / 2 | CPU + allocation |37.149|12.618|5.322|1.847|
| 2 / 3 | Observer only |0.008|0.156|7.440|1.210|
| 3 / 4 | Observer only |0.008|1.530|6.903|1.319|
| 4 / 5 | CPU + allocation |38.123|15.601|6.026|1.422|

Profiled startup fits within the interval between the prior production tick
start and tick 1086. The profiled start-to-start gaps are 45.952/48.934 ms; controls
are 33.489/34.864 ms. The derived lag subtracts the unchanged 1000/30 ms period.
Other elapsed work and host scheduling also occupy those intervals. These two
repeats per mode are bounded observations, not a statistical hardware comparison
or proof that profiling explains the different historical 36.237 ms failure.

The new full retained-window envelope **passes**: p95/max tick peaks 16.112 ms,
lag p95/max peaks 15.601 ms, maximum callback planning slice 3.704 ms; no captured
duration overrun or skipped slot. That does not waive the earlier failed
qualification or establish capacity. All four first recovery ticks occur before
profiler startup and take 15.341/16.112/15.906/15.867 ms. Their inner cold-simulation
cause is not captured by the later observer window.

## Historical failure attribution limit

Read-only analysis of the unchanged failed repeat places a concrete measurement
cost inside its tick-start gap. Worker 2's first cold health window contains only
ticks 1083/1084, hence one start-lag sample: 36.237 ms and one skipped slot. Adding
the unchanged 1000/30 ms period gives an approximately 69.570 ms start-to-start gap.
At measured source `ebcd7bf98093cb2fe81ad36955d99436697036a7`, the observer's
first active row is tick 1084: wrapper entry 350.629782 ms, exit 356.378531 ms and
production duration 5.600160 ms. Entry precedes production start; exit follows
production end. Thus tick 1084 started in [350.629782,350.778371] ms. Accounting
conservatively for Float32 lag storage and three-decimal rounding (±0.000502 ms),
the previous tick started in [281.058946,281.208540] ms, rounded outward.
These are inferred bounds, not retained production start clocks.

The historical `Profiler.start` request at 312.384510 ms and completion at
349.659242 ms lie entirely within that gap: **37.274732 ms of off-production
measurement elapsed time**. This is actionable when interpreting profiler runs:
retain startup boundaries, keep profiles opt-in and outside production timing
qualification, and never subtract this elapsed time from lag or relax the budget.
It does not prove how much historical lag profiling caused; other recovery work
and host scheduling also occupy the gap. No instrumentation was optimized to
make the failure disappear.

The original failed recovery checkpoint was not retained: its report contains
clock/army aggregates, not the input state, and the driver deletes its temporary
checkpoint directory. The matched control above uses a different match/input and
starts at tick 1085; the historical profile request occurred at tick 1083. A new
production-server fork cannot replay that missing input or distinguish the cause
of this particular 36.237 ms failure. **No further control was run.** Evidence is
insufficient for a gameplay optimization or a causal partition of that failure;
the failed repeat remains a failed qualification. No new benchmark document,
measurement framework, runtime change or budget change follows from this limit.

## Identity, checks and next action

Baseline source is `4102741d9463a89a48d52255824daf16e442ef6a`; clean measured
source is `864113624d7edaab05439914d8059533e7b19dea`; derived-analysis source is
`01af05cb573e47aeda0a4aa86c2fb13eafc30180`. Server/map/driver/observer/adapter
hashes and the 215-file runtime digest are retained. Source workers have unknown
build identity; a source SHA does not prove package/deployment bytes.
Measurements run serially on non-isolated Node v24.19.0/Linux x64, OS-reported
AMD EPYC 9V74/five visible CPUs. These are not reserved resources or device claims.
Evidence is unsealed, `.agents` is empty, and no sealed-telemetry skill is applied.

Forty-four focused tests pass, including a real queued tick during asynchronous
mock-profiler startup, exact timing/wire-body preservation, absent profiles in
observer mode, continuous clocks and negative identity/coverage cases. An
[executed source control](qa-evidence/crownroads-profiler-startup-2026-10-05/startup-control.mjs)
fails against the exact baseline observer's missing startup boundaries and
passes against the candidate; both
[baseline](qa-evidence/crownroads-profiler-startup-2026-10-05/baseline-control.txt)
and [candidate](qa-evidence/crownroads-profiler-startup-2026-10-05/candidate-control.txt)
receipts/hashes are retained. Required checks, independent exact-head review and
separate clean package/local serving identities are recorded on the owning PR.
Deployment and rendered acceptance remain unverified.

```sh
node --test scripts/tick-attribution.test.mjs scripts/map-capacity-report-check.test.mjs scripts/tick-samples.test.mjs scripts/performance-order-window.test.mjs
node scripts/map-capacity-scenario.mjs --map veyrholds-crownroads --loads 24 --seconds 10 --rss-stop-mib 512 --attribution on --recovery-profile-control on --output /tmp/crownroads-startup
node scripts/map-capacity-report-check.mjs /tmp/crownroads-startup/report.json
```

Next evidence must come from an actual failure with its original checkpoint
and first recovery tick-start clocks retained in the already-owned qualification.
Only then can a same-input production/observer/profile control distinguish that
failure. Another fresh-input control would not resolve this one, so the previous
unconditional wrapper/memory/GC experiment is deferred. Inner cold-tick causes,
wrapper/memory/GC overhead and scoped pressure/RSS peaks remain unmeasured.
CPU owner 01a10378 retains full qualification, crowd owner 01a10933-c2b0 retains
steering/choke policy, and no full CPU/crowd match was duplicated. Planned320
stays closed; ordinary256 supported capacity and 2,000-unit readiness are unproven.
