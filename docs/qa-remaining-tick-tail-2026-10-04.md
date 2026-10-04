# Remaining maximum-tick tail — 4 October 2026

No next production optimization is selected. The retained maximum occurs in
broadcast without profiling and in simulation with profiling. Aggregate
profiles identify `getMoveVector` as a substantial simulation hotspot, but do
not establish which child operation caused either maximum. A single low-risk
zero-separation guard was investigated in a read-only function-body probe and
does not show consistent allocation improvement. Preserve that negative result;
keep callback scheduling and deployed/rendered acceptance open.

This follows the merged [snapshot allocation experiment](qa-snapshot-row-allocation-2026-10-04.md).
Movement owns the investigation and the
[remaining capture backlog](movement-tick-phase-proposal.md#deployed-and-rendered-acceptance-retained).
Production `server.mjs` remains SHA-256
`269ba44cda8dc64434af811d06dbcd5ae81f9a1bb2bbf56ac8907c0687af409c`;
the guard is not installed in it. Current main `cba504cc` has the same server as
the probe execution head `5bd23914`. Fog/ownership fields, exact wire semantics,
animation timing and scheduler defaults are untouched.

## Retained maximum and frequency

The [derived report](qa-evidence/remaining-tick-tail-2026-10-04/summary.json)
reads the immutable raw reports from the earlier experiment, binding their
decoded/stored hashes before deriving profile weights. These measurements
remain attributed to candidate `140115496470a119cba2252e9d9de9275d65e59a`,
not to later main merges.

| Candidate run | Maximum tick | Total, ms | Largest measured outer component |
| --- | ---: | ---: | --- |
| Callback, plain repeat 1 | 2,580 | 47.347 | Simulation 26.418 ms |
| Callback, plain repeat 2 | 2,661 | 61.900 | Broadcast 52.928 ms |
| Four, plain repeat 1 | 2,598 | 44.676 | Vision 17.099 ms (broadcast 17.096 ms) |
| Four, plain repeat 2 | 2,519 | 58.200 | Simulation 58.141 ms; zero planning turns |
| Callback, diagnostic | 2,067 | 154.990 | Simulation 143.217 ms |
| Four, diagnostic | 2,550 | 36.786 | Simulation 17.105 ms; zero planning turns |

The retained callback default has four plain overruns across 1,860 ticks:
two simulation-dominant and two broadcast-dominant. Its diagnostic run has ten
overruns, six broadcast-dominant and four simulation-dominant, despite the
largest being in simulation. Four's two plain overruns are split between vision
and simulation. Classifying an outer elapsed interval does not prove its cause.
The plain broadcast maximum has no matching child-function timing capture.
The diagnostic maximum does not have exact simulation-child timings. Profiles
include idle and work outside simulation ticks; their own request/completion
boundaries differ from tick windows. Do not assign aggregate sample weights or
allocation sizes to a particular overrun. No observed GC entries overlap the
diagnostic observer tick spans; this does not explain the tail.

## Aggregate hotspot and one bounded candidate

`getMoveVector` has sampled interval self weights of 836.622 ms / 750.894 ms
over the callback/four diagnostic profiles. Its self allocation estimates are
419,839,784 / 402,260,416 bytes; inclusive estimates are 453,598,840 /
431,889,448 bytes. These full-profile sampled estimates are substantial and
motivate inspection; they are neither exact function CPU nor evidence that
movement caused the 154.990 ms maximum.

The inspected function combines route direction and bounded separation, then
normalizes the vector. Its existing separation scale always evaluates
`Math.hypot(separationX, separationZ)`, even when both accumulated components
are zero. One local candidate expression replaces that call with:

```js
separationX === 0 && separationZ === 0 ? 0 : Math.hypot(separationX, separationZ)
```

The branch keeps the built-in zero result; it does not replace nonzero norms
with a different floating-point formula, change neighbor ordering, forces,
detours or returned fields. The actual candidate body exists only in the VM
probe. No persistent geometry/result cache, pooling, visibility relaxation or
compression change is proposed.

## Read-only probe and negative result

The [historical probe](qa-evidence/remaining-tick-tail-2026-10-04/historical-probe.mjs)
extracts the actual production function and performs exactly one expression
replacement locally. Six fresh processes run serially in balanced order:
baseline 1, candidate 1, candidate 2, baseline 2, baseline 3, candidate 3.
Node is v24.19.0/Linux on the shared cloud worker. Each process warms 10,000
calls, then samples 200,000 calls over the same fixed 2,000 actors/1,000 movers.
The artificial mix uses 70% zero-separation and 30% crowded movers. Those
fractions are chosen to expose the branch, not measured from ordinary battles.
The fixed fixture includes both teams, four kinds and eight headings; it does
not exhaust their Cartesian combinations or movement/recovery cases.

Outside sampling, each process compares all 1,000 vector results with deep
value/shape equality and verifies matching actor/result hashes and consumed
checksum. Counting through a temporary realm intrinsic wrapper outside
sampling observes 3,000 → 2,300 `hypot` calls, with 700 → 0 zero calls. The
original intrinsic is restored before warmup/capture. Source/function hashes,
raw profiles and logs are retained in the
[source manifest](qa-evidence/remaining-tick-tail-2026-10-04/source-manifest.json).
Command start/stop timestamps and elapsed timing targets were not recorded.

| Pair | Baseline / candidate inclusive estimated bytes per call | Candidate reduction |
| --- | --- | ---: |
| 1 | 457.602 / 444.819 | 2.793% |
| 2 | 477.602 / 457.612 | 4.185% |
| 3 | 450.386 / 459.568 | −2.039% |

The third pair reverses direction even in this favourable artificial mix.
Sampling uses a 65,536-byte interval and includes collected objects. These
estimates omit some native/external allocation and cannot establish exact
saved bytes, speedup or statistical significance. The probe does not justify
shipping the guard or spending an ordinary paid-battle comparison on it.
The fixed vector checks are not full movement, private-frame, recovery or
rendered acceptance.

## Decision and next action

The bounded investigation is complete with no runtime change. Do not convert
aggregate `getMoveVector` weight into an arithmetic/steering rewrite or change
compression, broadcast timing, fog refresh or the scheduler to chase a maximum.
A future optimization proposal needs a source-qualified child-cost capture
that separates movement/targeting work within the simulation tail and private
payload/stringify/deflate work within the broadcast tail. Record actual call
and zero-force counts before using this artificial branch mix as a proxy.
That diagnostic proposal remains unimplemented, with movement as owner.

The existing rendered 2,000-actor paid economy/combat/restart workload and actual
deployed revision remain unverified. The linked proposal retains the concrete
sandboxed capture path and owner; native processes and VM probes do not close it.
No new paid workload, credentials, deployment or sandbox override was used here.

## Reproduce retained arithmetic

```sh
node docs/qa-evidence/remaining-tick-tail-2026-10-04/analyze.mjs \
  docs/qa-evidence/remaining-tick-tail-2026-10-04
```

The historical probe records absolute workspace import/output paths. To repeat
it, use its named frozen source at those paths or explicitly adjust the paths;
retain new run identities rather than overwriting the archived inputs. This
investigation does not claim a whole-game performance improvement.
