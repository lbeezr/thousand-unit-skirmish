# Paid battle tick cost attribution — 4 October 2026

**Keep callback scheduling as the default.** Repeated native battles exceed
the whole-tick budget with both policies. Four's six overruns across two runs
all execute zero planner turns inside the tick; callback also has broadcast
and vision outliers. The observations do not establish equal overrun rates,
a causal policy improvement, or a supported device/actor capacity.

Movement owns this bounded read-only comparison, following the
[complete tick qualification](qa-paid-battle-tick-budget-2026-10-04.md).
The production server and planner policy are unchanged. The new observer runs
only in disposable loopback server copies selected explicitly by the existing
paid-battle harness. Source-only tooling acceptance applies here; deployed and
rendered battle acceptance remains in the
[movement proposal](movement-tick-phase-proposal.md#deployed-and-rendered-acceptance-retained).

## Fixed source and workload

[Raw reports, derived statistics and analysis](qa-evidence/tick-cost-attribution-2026-10-04/summary.json)
retain every measured tick and every overrun. The
[source manifest](qa-evidence/tick-cost-attribution-2026-10-04/source-manifest.json)
records server SHA-256
`bba377a6af627f30cc2acd88fb52e2cbec3c7491add5ebb56394975c39e0bdc0`
and `src` tree `22f2d0a3a53377084312bd54b4b099d7d7e6e9cf`.
The first callback run uses `7094b81b`; subsequent runs use `2aba1ccf`.
Those heads differ only in the inactive observer and its regression test;
backend, harness, fixture, map and dependencies are identical. These timings
belong to that fixed source, not automatically to later main merges.

Runs execute serially on Node v24.19.0/Linux on the shared cloud worker.
Four uninstrumented runs alternate callback/four/callback/four; two separate
diagnostic runs use CPU and heap sampling. No reviewer starts competing test
or simulation loads. Serial execution does not exclude unrelated host activity.

The existing native harness uses two compression-enabled private seats,
a 160×160 fog map padded from Fortified Crossing, and 1,998 seeded actors plus
two paid Infantry. Both seats pay 150 food/325 wood for House, Barracks,
Infantry and research; food and wood harvesting/deposits continue throughout
three attack/withdraw/attack phases. Each run retains 930 unique gap-free
whole ticks between the authoritative ready/end checkpoint witnesses. Paid
ledger, four positive deposits, casualties and same-seat recovery assertions
pass. This is neither an entirely paid army nor identical command-tick replay.
Accepted order ticks, combat losses and resulting payloads differ between runs.

## Whole-tick comparison without profiles

| Policy / repeat | p50 / p95 / p99 / max, ms | Above 33.333 ms | Casualties |
| --- | --- | ---: | ---: |
| Callback / 1 | 5.742 / 23.151 / 55.134 / 158.994 | 22 / 930 | 549 |
| Four / 1 | 4.963 / 14.725 / 22.561 / 63.121 | 4 / 930 | 414 |
| Callback / 2 | 5.648 / 17.419 / 34.699 / 176.385 | 10 / 930 | 542 |
| Four / 2 | 4.606 / 13.809 / 21.906 / 46.999 | 2 / 930 | 380 |

Callback has 32/1,860 observed overruns and four has 6/1,860. These are the
observed frequencies, not evidence that the policies have equal rates or that
the policy alone caused their difference. Callback planning occurs outside
outer-tick timing, so zero *tick* planning does not mean the process performs
no planning. Four's overruns explicitly report zero turns; its active planner
p95/max are 0.874/12.991 ms in repeat 1 and 0.724/2.484 ms in repeat 2.

By largest measured outer component, callback overruns comprise 22 simulation,
nine broadcast and one vision ticks; four comprises four simulation and two
broadcast ticks. This classification describes where the elapsed time was
recorded, not which allocation, GC or unrelated host event caused it.
Callback tick 2,544 records 158.994 ms total with 135.505 ms vision and
12.755 ms broadcast. Four tick 2,562 records 40.379 ms total with 33.679 ms
broadcast and zero planner turns. Four repeat 2's vision maximum of 20.388 ms
occurs on a 32.995 ms tick with four planner turns and does not overrun.
The raw reports retain simulation and checkpoint outliers as well.

Existing per-peer transport counters also show substantial payload volume:

| Policy / repeat | Health tick bounds | JSON payload / framed wire bytes sent |
| --- | --- | --- |
| Callback / 1 | 1,771 → 2,706 | 78,036,535 / 10,267,372 |
| Callback / 2 | 1,771 → 2,702 | 78,171,129 / 10,281,491 |
| Four / 1 | 1,832 → 2,761 | 74,472,028 / 9,547,608 |
| Four / 2 | 1,831 → 2,763 | 74,665,546 / 9,568,730 |

Both peers negotiate compression in every run. Counter deltas use the named
health endpoints, which differ from the checkpoint witness interval. Peak
queued bytes, coalesced snapshots and outbound queue-limit disconnects remain
zero in these loopback observations; they do not establish remote-network capacity.

## Diagnostic capture and qualifications

The [observer](../scripts/tick-attribution-observer.mjs) times the actual
production functions and counts private payload/frame construction,
serialization, synchronous deflate, framing, visibility cache reuse and
refresh causes. The [adapter](../scripts/tick-attribution-adapter.mjs) changes
only a disposable source copy; the gameplay, fog, payload, framing and tick
function bodies remain byte-identical to production. No production HTTP route,
protocol, planner work limit, animation timing or disclosure rule changes.

CPU profiles use a 1,000 µs sampling interval. V8 allocation sampling uses
65,536-byte sampling with collected-object inclusion. These are estimates:
allocation tree sizes include sampled collected objects and cannot measure
all native/external Buffer allocation. Heap deltas and external/arrayBuffer
snapshots measure net change or retained occupancy, not bytes allocated.
Constructed payload/frame lengths are distinct from peer traffic, whose
existing health counters include per-peer sends and have their own tick bounds.

Rows freeze before any awaited profiler shutdown. CPU and allocation profiles
record their own start/stop request/completion boundaries, which can include
work outside the row window and outside simulation ticks. GC entries are
drained only when their start is inside the frozen row window; their durations
may extend beyond it. GC overlap is an observation, not proof that GC caused
an overrun. Timed wrappers are inclusive and overlap; do not sum parent and
child costs. CPU `timeDeltas` describe sampled interval weights, including
idle, rather than exact processor time for a function. Observer, profiles and
memory snapshots add overhead; these runs do not enter the table above.

Both diagnostic runs pass the paid economy/combat/recovery witnesses. Their
native windows still contain all 930 ticks, but profiling starts two ticks
after the ready witness. Each attribution window contains 931 rows, of which
928 intersect the witness: callback 1,773–2,700 and four 1,833–2,760.
The three trailing rows and all raw profiles remain archived. Instrumented
whole-tick p95/max are 16.299/139.277 ms for callback and 16.515/52.408 ms for
four; these describe the diagnostic runs, not overhead estimates or policy
qualification. Their casualties are 566 and 384.

The following timings sum calls within each attributed witness tick, then
take percentiles only over ticks that execute that function. Parent/child
timings overlap. A broadcast commonly builds two private state frames.

| Function | Callback active-tick p95 / max, ms | Four active-tick p95 / max, ms |
| --- | --- | --- |
| Private `roomPayload` | 3.500 / 7.591 | 3.344 / 7.908 |
| `prepareJsonFrame` | 5.493 / 16.742 | 5.846 / 32.438 |
| Frame JSON stringify | 2.946 / 12.081 | 3.113 / 30.093 |
| Synchronous deflate | 2.679 / 5.120 | 2.716 / 19.483 |
| WebSocket framing | 0.055 / 0.471 | 0.058 / 0.254 |
| `updateVisionMasks` | 3.426 / 9.494 | 3.286 / 6.518 |
| Checkpoint capture | 5.997 / 7.362 | 10.420 / 12.377 |

Callback constructs 638 private state frames containing 854,299 unit rows,
77,779,423 payload bytes and 10,153,787 framed bytes inside attributed witness
ticks. Four constructs 638 frames, 812,088 rows, 75,588,157 payload bytes and
9,668,330 framed bytes. This excludes outside-tick construction and peer fanout.

Each attributed run executes 319 explicit vision updates, costing 657.223 ms
and 663.831 ms inclusively in total. `ensureVisionMasks` has 669 hits and zero
misses in each: the outer tick explicitly refreshes after its post-simulation
invalidation before broadcasting/checkpointing. Zero ensure misses therefore
does **not** mean invalidation or refresh disappeared. Callback applies 446,164
unique sources, skips 195,880 duplicate sources and records 443,251 cached
coverage hits / 2,913 misses. Four applies 467,495 sources, skips 187,296
duplicates and records 464,577 hits / 2,918 misses. Coverage reuse exceeds
99.3% in both; coverage-reference misses are zero within observed tick calls.
This workload does not qualify a geometry-invalidation optimization or its
effects between simulation ticks.

Over their separately bounded allocation profiles, V8 tree estimates total
2,421,895,632 bytes for callback and 2,179,293,920 for four. Nearest classified
ancestor partitions estimate private payload construction at 511,100,088 and
487,327,296 bytes, with `snapshotUnits` self estimates of 399,695,776 and
373,057,192. Simulation is also large (1,565,159,536 / 1,361,509,304 estimated
bytes); `getMoveVector` self estimates are 407,110,720 / 401,207,848. These
remain sampled estimates, not precise allocation accounting or saved bytes.
Allocation sample-size sums differ slightly from tree totals; both are retained.

Net live-heap change per observed tick has p95 5,609,448 / 5,376,720 bytes;
external occupancy peaks at 46,342,575 / 24,142,289 bytes. These values cannot
be substituted for allocated bytes. GC observation records 57 / 65 events,
172.459 / 143.898 ms total observed duration, with zero overlaps against the
observer tick spans (including row setup and post-duration memory sampling).
This offers no evidence that those GC events caused the tick overruns.
The full CPU profiles retain idle, checkpoint serialization outside ticks,
callback planner and observer/runtime samples; they are not isolated tick CPU.

## Checks and next seam

Five focused observer tests pass: production bodies unchanged, exact private
compressed/plain frame bytes, visibility cache invalidation classification,
and a real queued tick served during asynchronous stop that remains outside
the returned row window. Independent read review at `2aba1ccf` clears the
capture-boundary and byte-qualification findings. Final independent review at
`3cdd0768` reproduces all six archived reports, summary/hashes, allocation and
CPU category weights, boundary/counter partitions and documentary numbers with
no remaining findings. Its eight focused checks and docs/syntax checks pass.
Author validation at that head passes 70 observer/framing/deflate/private
production/fog-checkpoint/forest/reinforcement checks, browser/Node checked
boundaries, docs, syntax and import architecture. The merge of current main
`f8237601` is clean; production `server.mjs` and `src` match that main exactly.
The historical native measurements retain their earlier source identities.

The proposed next experiment is limited to `snapshotUnits`' base-row literal
in `server.mjs:1922`: put its existing `task` and focus-count fields directly
into the initial eleven-element array instead of constructing nine elements
and immediately calling `row.push(task, focus)`. This targets the measured
payload allocation path with no persistent cache, pooled rows, arithmetic,
view filtering, vision invalidation or authoritative state change. Avoiding
base-row growth is a hypothesis to measure; this PR implements no optimization.

Acceptance for that separate experiment requires exact JSON and compressed/
plain frame-byte comparisons across team 0/1, spectator and no-fog views,
including focus privacy, Workers, sparse optional attack/audio/gather/fishing/
performing-action fields and dead/reused actors. Preserve replay/checkpoint
semantics and repeat same-source allocation and whole-tick observations. A
smaller allocation estimate alone cannot qualify a new planner default or
promise the existing budget will pass.

Visibility optimization must first coordinate the mode owner's
[immediate-read invalidation contract](qa-pve-fog-restart-phase-2026-10-04.md).
The post-simulation invalidation covers forest clears and newly produced or
reinforced actors after an earlier mask refresh. This comparison neither
removes that refresh nor treats cache hit rate as permission to relax it.

## Reproduce

```sh
PAID_BATTLE_ATTRIBUTION=0 PAID_BATTLE_TICK_RECORD=/tmp/plain-0.json \
  node scripts/paid-battle-tick-budget.mjs 0 2000
PAID_BATTLE_ATTRIBUTION=1 PAID_BATTLE_TICK_RECORD=/tmp/observed-4.json \
  node scripts/paid-battle-tick-budget.mjs 4 2000
node docs/qa-evidence/tick-cost-attribution-2026-10-04/analyze.mjs \
  docs/qa-evidence/tick-cost-attribution-2026-10-04/*.json.gz
```

Repeat the first command serially for policy 0/4, two repeats each, then run
one diagnostic per policy. Functional success is not a budget-pass claim.
No deployment, credentials, security flags or paid art is required.
