# Snapshot base-row allocation — 4 October 2026

The bounded experiment changes only `snapshotUnits`' initial array construction:
the existing task and focus fields occupy their original slots in the literal,
instead of being appended immediately with `push`. It creates a fresh row for
every actor/view as before. Field order, evaluations, sparse optional slots,
rounding, private filtering, checkpoint state and the callback scheduler default
are unchanged. No pooling, persistent cache or shared mutable tuple is introduced.

Movement owns this experiment following the
[attribution comparison](qa-tick-cost-attribution-2026-10-04.md).
Acceptance covers source integration and measured process behavior. Deployed
revision and rendered 2,000-unit acceptance remain open in the
[movement proposal](movement-tick-phase-proposal.md#deployed-and-rendered-acceptance-retained).

## Frozen sources and workload

The [run manifest](qa-evidence/snapshot-row-allocation-2026-10-04/run-manifest.json)
retains the fixed order, UTC boundaries and source identities. Baseline is
`b464199855a23b8f20503b46baba9f9705e350bb`; candidate is
`140115496470a119cba2252e9d9de9275d65e59a`. Their production servers differ only
in the base-row literal and immediate append. Both import `src` tree
`da951c91d5be97d6fd36f0b23326a15055510923`; their unchanged paid-battle harness
and disposable observer hashes match. Later documentation and integration heads
do not redefine these historical measurements.

Runs are serial on Node v24.19.0/Linux on the shared cloud worker. Baseline and
candidate order reverses across the two uninstrumented repeats of each policy.
Four separate process profiles follow those eight runs. Reviewer tests and
other author simulation loads remain stopped during measurement; unrelated
shared-host activity is still possible.

Each ordinary process run uses the existing 160×160 fog map padded from
Fortified Crossing, two compression-enabled private seats, 1,998 seeded actors
and two paid Infantry. Each seat spends 150 food/325 wood on House, Barracks,
Infantry and research. Both seats continue food/wood harvesting and deposits
through three attack/withdraw/attack phases. This is not an entirely paid army
or an identical command-tick replay. Accepted order ticks, casualties and
dynamic private snapshots differ between runs. All reports retain every tick
and overrun; process acceptance does not mean the tick-budget gate passes.

## Exact snapshot regression

The [new tests](../scripts/snapshot-row-allocation.test.mjs) compare the current
production function against the preserved baseline body. The oracle hash is
`4815ed55d734594e9883d68d10d5b0ac7a940f2923086f4ea49605411bb3154e`, verified
against the actual baseline source before review. Helpers and frame encoding
use real production bodies/imports. For both seats, spectator and no-fog views,
tests compare own keys, lengths and entries, JSON strings and actual plain and
compressed frame buffers. This catches sparse holes, field order, negative
zero and values that JSON alone could collapse.

Fixtures cover focus ownership, hidden/visible enemies, positive sub-cent
cargo, berry/wood gathering, real shore-fishing site presentation, build,
repair, return, hold, patrol, attack fields and Worker action receipts. Death,
reused generation, a new tick, cleared receipts and checkpoint-shaped JSON
restoration preserve optional fields. Snapshot calls leave actor state
unchanged. The small and 2,000-actor fixed fixtures are wire/allocation
regressions; they are not ordinary gameplay or rendered acceptance. Frames
contain a representative state envelope around the compared units; unchanged
non-unit room fields are covered by existing production tests.

## Controlled allocation probe

Six fresh probe processes alternate baseline/candidate in a balanced order.
Each warms 50 calls, then measures 500 real-function calls over fixed VM actors
and the three views. All runs construct 888,611 rows and consume the same
1,888,111 checksum. Actor hashes and all three view JSON hashes match before
and after capture. The baseline body is frozen from `b4641998`; both probe
variants execute from candidate `14011549` with the same helpers and fixture.
These are distinct from ordinary paid battles.

| Pair | Baseline / candidate inclusive estimated bytes per row | Reduction |
| --- | --- | ---: |
| 1 | 562.391 / 309.792 | 44.915% |
| 2 | 557.900 / 302.985 | 45.692% |
| 3 | 559.939 / 299.578 | 46.498% |

Every pair exceeds the predeclared 20% fixed-probe allocation threshold.
`snapshotUnits` self estimates fall 53.77–54.89%. Heap sampling uses a
65,536-byte interval and includes sampled collected objects; estimates omit
some native/external allocation. Net heap occupancy is not allocated bytes.
Sampler elapsed times do not establish whole-tick speedup or capacity.

## Whole ticks and ordinary process allocation

All twelve paid economy/combat/recovery runs pass and preserve 11,160 unique
whole-tick records. Eight uninstrumented distributions follow:

| Variant / policy / repeat | p50 / p95 / p99 / max, ms | Above 33.333 ms | Casualties |
| --- | --- | ---: | ---: |
| baseline / callback / 1 | 5.991 / 19.899 / 33.079 / 109.820 | 9 / 930 | 560 |
| candidate / callback / 1 | 4.904 / 14.967 / 24.112 / 47.347 | 2 / 930 | 570 |
| candidate / callback / 2 | 4.675 / 14.280 / 25.286 / 61.900 | 2 / 930 | 552 |
| baseline / callback / 2 | 5.117 / 14.197 / 25.686 / 55.182 | 4 / 930 | 556 |
| candidate / four / 1 | 4.669 / 13.010 / 19.540 / 44.676 | 1 / 930 | 378 |
| baseline / four / 1 | 4.591 / 14.587 / 26.541 / 35.034 | 3 / 930 | 383 |
| baseline / four / 2 | 4.666 / 14.359 / 26.242 / 96.560 | 3 / 930 | 381 |
| candidate / four / 2 | 4.944 / 14.933 / 25.567 / 58.200 | 1 / 930 | 396 |

Candidate callback observes 4/1,860 overruns versus baseline 13/1,860; candidate
four observes 2/1,860 versus baseline 6/1,860. These are observations on a shared
host, not causal speedup estimates. Candidate callback repeat 2 p95 (14.280 ms)
is slightly above baseline repeat 2 (14.197 ms); candidate four repeat 2 p95
(14.933 ms) is also above baseline (14.359 ms). There is no uniform timing
improvement, and every run still exceeds the maximum tick-budget gate. The
justified benefit is reduced sampled allocation with exact snapshot semantics,
not supported actor/device capacity or a new scheduler default.

Four separate diagnostic runs follow; their overhead means they do not enter
the table above:

| Variant / policy / repeat | p50 / p95 / p99 / max, ms | Above 33.333 ms | Casualties |
| --- | --- | ---: | ---: |
| baseline / callback / 1 | 5.306 / 15.492 / 23.042 / 56.266 | 3 / 930 | 563 |
| candidate / callback / 1 | 5.354 / 15.475 / 33.909 / 154.990 | 10 / 930 | 569 |
| candidate / four / 1 | 4.937 / 15.598 / 22.604 / 36.786 | 2 / 930 | 403 |
| baseline / four / 1 | 4.798 / 14.981 / 26.381 / 90.664 | 6 / 930 | 397 |

Candidate callback's diagnostic maximum is 154.990 ms at tick 2,067, of which
143.217 ms is recorded in simulation and 5.765 ms in broadcast. Its ten overruns
exceed diagnostic baseline's three. The report is retained; sampled allocation
reduction does not eliminate these tails or establish what caused them. No
observed GC entries overlap observer tick spans in any diagnostic run.

| Profile policy | Baseline / candidate inclusive estimated bytes | Baseline / candidate captured unit rows | Approximate reduction per row |
| --- | --- | --- | ---: |
| Callback | 419,539,184 / 181,550,656 | 874,666 / 866,130 | 56.300% |
| Four | 373,680,520 / 182,037,224 | 797,921 / 796,813 | 51.218% |

Both ordinary process profiles confirm the allocation direction. Callback
self estimates fall 416,847,824 → 173,536,424 bytes; four self estimates fall
370,333,224 → 174,422,400 bytes. Approximately normalized self reductions are
57.959% / 52.836%. These process estimates are separate from the VM probe's
controlled per-row estimates and remain sampled rather than exact saved bytes.

Diagnostic row captures contain 931–932 rows and 928–929 witness intersections,
with complete native witnesses of 930 ticks each. The summary retains each
actual first/last tick, row/window count and constructed-frame counter rather
than assuming identical profile boundaries.


Process profiles have distinct start/stop request/completion boundaries from
captured tick rows. Approximate per-row normalization uses all captured
`stateUnitRows`; it does not make the profile and row windows identical.
Raw allocation totals, witness/captured counts and every boundary are retained
in the [derived summary](qa-evidence/snapshot-row-allocation-2026-10-04/summary.json).
CPU interval weights include idle and observer/runtime work. Timed parent and
child wrappers are inclusive and overlap. GC overlap refers to observer tick
spans including setup/post-duration sampling and cannot prove overrun causality.
Constructed state frames/rows differ from per-peer traffic health counters.

## Review, integration and remaining acceptance

The change meets the predeclared allocation criteria: all three fixed pairs
exceed 20%, both process profiles confirm the direction, and exact snapshot
wire/privacy/recovery regressions pass. Retain the one-line construction change;
keep callback scheduling and the failed maximum-budget decision unchanged.

Independent source review at `14011549` has no findings. Analysis review
identifies no blocking issues; its suggested probe input/hash assertions are
implemented. Author checks at that frozen head pass 44 focused tests, both
checked-JavaScript boundaries, docs, syntax and import architecture. Current
main `c347a774` merges cleanly at `aff7b161`; its production server is identical
to the frozen baseline, so the only server difference remains this literal.
Integrated checks and final measurement review are recorded in
[verification](qa-evidence/snapshot-row-allocation-2026-10-04/verification.json).
Final independent review at `6a32ecbc` reproduces the summary exactly and verifies
all eighteen raw/probe hashes, source identities, tick sequences, allocation
and timing/window arithmetic. Its 89 focused tests, docs/imports/syntax checks
pass. The full PR whitespace check reports one intentional trailing blank line
in the frozen oracle; excluding that exact-byte fixture passes. Preserve its
separator newline and hash. [PR #259](https://github.com/lbeezr/thousand-unit-skirmish/pull/259)
records the subsequent exact merge, release and postmerge receipts.

Source merge does not identify the revision serving the user's environment.
Actual deployed revision and rendered workload acceptance remain open, owned
by movement in the linked proposal. No deployment or security bypass occurs.

## Reproduce

```sh
node --test scripts/snapshot-row-allocation.test.mjs
SNAPSHOT_ROW_ALLOC_RECORD=/tmp/probe-baseline.json \
  node scripts/snapshot-row-allocation-probe.mjs baseline 500
SNAPSHOT_ROW_ALLOC_RECORD=/tmp/probe-candidate.json \
  node scripts/snapshot-row-allocation-probe.mjs candidate 500
PAID_BATTLE_ATTRIBUTION=0 PAID_BATTLE_TICK_RECORD=/tmp/plain.json \
  node scripts/paid-battle-tick-budget.mjs 0 2000
PAID_BATTLE_ATTRIBUTION=1 PAID_BATTLE_TICK_RECORD=/tmp/observed.json \
  node scripts/paid-battle-tick-budget.mjs 4 2000
node docs/qa-evidence/snapshot-row-allocation-2026-10-04/analyze.mjs \
  docs/qa-evidence/snapshot-row-allocation-2026-10-04
```

The [retained runner](qa-evidence/snapshot-row-allocation-2026-10-04/historical-runner.mjs) records its historical worktree/output paths and exact
case order. Repeating the process comparison requires separate baseline and
candidate checkouts with the named matching source/dependencies and serial
execution. The probe can use the vendored oracle without Git history.
Functional success and allocation reduction do not qualify a scheduler switch,
guarantee the 33.333 ms maximum budget, or close deployed/rendered acceptance.
