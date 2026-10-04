# Paid battle whole-tick qualification — 4 October 2026

**Retain callback scheduling as the default.** Four planning turns did not meet
the parent's complete 33.333 ms tick budget at 2,000 units: two of 930 measured
ticks exceeded it, with a 40.461 ms maximum. Both overruns had zero planning
turns. This closes the default-policy decision for this qualification; it is
not waiting for another parent decision. The earlier
[four-turn recommendation](qa-move-planning-tick-budget-2026-10-04.md) remains
historical planning/route evidence, not a whole-battle budget approval.

Movement owns this diagnostic outcome and the retained
[workstream](movement-pathing-workstream.md). The 1/4/8 flags remain bounded
reproduction controls for the existing experiment. Ordinary runs keep them
unset. A later default proposal needs new complete-tick evidence after the
non-planning tail is understood; reducing planning turns cannot remove the
two zero-turn overruns recorded here. No wall-clock scheduling is introduced.

## Workload, source and qualification

[Summary and artifact hashes](qa-evidence/paid-battle-tick-budget-2026-10-04/summary.json)
retain four serial, fresh two-seat native runs at
`61156a1c21d56380445c756fdee826db122ae498`, after incorporating fork main
`be656c47`. The measured `server.mjs` SHA-256 is
`21ab61c572395ce8730c98ea115fce853de0276d1322ce109d42704432ab03d8`.
Node v24.19.0 runs on the shared Linux cloud worker. Full raw tick rows, workload,
source identities, commands and functional witnesses are compressed separately
for [callback/250](qa-evidence/paid-battle-tick-budget-2026-10-04/qualified-0-250.json.gz),
[four/250](qa-evidence/paid-battle-tick-budget-2026-10-04/qualified-4-250.json.gz),
[callback/2,000](qa-evidence/paid-battle-tick-budget-2026-10-04/qualified-0-2000.json.gz)
and [four/2,000](qa-evidence/paid-battle-tick-budget-2026-10-04/qualified-4-2000.json.gz).

The [native harness](../scripts/paid-battle-tick-budget.mjs) pads Fortified
Crossing to 160×160, shifts obstacle indices to preserve their world positions,
and retains fog, resources and mirrored starting bases. Authored rules seed
248/1,998 actors; each seat trains one paid Infantry to reach 250/2,000 total
living actors. This does not claim that the whole seeded roster was produced
through a paid economy. No actor/checkpoint injection, scripted relief units,
free resource rewards or victory deadline participates.

Both seats use ordinary commands to complete a House, Barracks, Infantry and
Infantry Attack research, spending 150 food/325 wood each. One Worker per seat
gathers food and another gathers wood. The ready checkpoint requires paid
completion, the exact living roster and stock depletion for each seat/resource.
Three order phases attack inward, withdraw and attack inward again. Each phase
targets at least 300 simulation ticks; polling overshoot and the checkpoint tail
are retained as actual endpoints. This is a bounded battle observation, not an
all-army arrival assertion or an identical-command-tick performance comparison.

The measurement starts at the ready checkpoint's authoritative tick and ends at
the complete checkpoint's tick. Every intervening tick appears once, without
gaps: 930 per run, 3,720 total. Per-seat/per-resource harvesting **and bank
deposits** continue between these exact witnesses; all four deposits are 20 in
every run. Bank/stock/cargo conservation, paid completion, actual casualties and
same-seat checkpoint recovery pass in all four runs. Final casualty counts are
127/125 at 250 and 546/371 at 2,000 for callback/four respectively.

The conservative decision rule requires both candidate loads to pass functional
witnesses and have no observed complete outer tick exceed 1000/30 ms. Percentiles
provide context; a passing p95 alone does not satisfy this rule. These finite
diagnostic runs cannot establish a real-time guarantee or supported capacity.

## Complete tick costs

| Policy | Total actors | Whole tick p95 / p99 / max, ms | Ticks above 33.333 ms | Active planning p95 / max, ms |
| --- | ---: | --- | ---: | --- |
| Callback | 250 | 4.380 / 6.240 / 13.418 | 0 / 930 | Outside tick |
| Four turns | 250 | 3.621 / 5.679 / 14.099 | 0 / 930 | 3.156 / 6.756 |
| Callback | 2,000 | 16.103 / 29.976 / 357.981 | 9 / 930 | Outside tick |
| Four turns | 2,000 | 14.458 / 24.146 / 40.461 | 2 / 930 | 0.826 / 4.221 |

`durationMs` covers the outer tick: candidate planning, movement/combat/economy,
Worker receipts, fog, scenario, broadcast and synchronous checkpoint work.
Planning is included in `simulationMs`; do not add it a second time. Asynchronous
checkpoint file writes and callback-control planning occur outside this
duration. Thus the callback row is not the complete callback planner CPU cost.
Rolling start-lag/scheduler observations retain their own sample tick bounds;
their counter differences are not exact checkpoint-window skip counts. The
callback/2,000 observation extends four ticks past its end witness and includes
a later overload. The four/250 preparation window also records 109.218 ms
maximum lag before battle. These costs are retained, not silently excluded from
the evidence record.

The decisive same-tick breakdowns are:

| Four-turn 2,000 tick | Whole ms | Simulation including planning ms | Planning ms / turns | Vision ms | Scenario ms | Broadcast ms | Checkpoint ms |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 2,232 | 40.461 | 9.211 | 0.001 / 0 | 7.851 | 0.294 | 23.104 | 0.001 |
| 2,274 | 35.260 | 7.826 | 0.000 / 0 | 2.771 | 15.754 | 8.908 | 0.001 |

The first maximum is dominated by broadcast plus vision; the second has a
scenario timing outlier. This is component attribution, not proof of which
subroutine, garbage-collection pause or shared-host interference caused those
costs. The callback control also has a 357.981 ms tick at 2,598, with 342.766 ms
in simulation. Retaining callback scheduling therefore does not claim that the
existing policy satisfies a 33.333 ms maximum. The measured gate has failed,
and neither policy has demonstrated full-budget reliability at this load.

Tick/separation diagnostics and 200 ms health polling add observer work. The
host is shared, command receipt phases differ, and casualty counts differ.
Serial execution alone does not establish comparable hardware, a causal policy
speedup, client rendering cost or deployed acceptance. Standard `game-dev`
sealed-run tooling is unavailable; these are source-qualified native reports.

## Checks, review and integration

The read-only runtime addition exposes chronological raw samples only when
existing tick diagnostics are enabled and `/health?tickSamples=1` is requested.
Ordinary health payloads retain their prior shape. The wrapped-ring regression
verifies real whole-tick values, chronological ordering and the disabled/normal
cases. The default policy, operation-count limits, FIFO rotation, generation and
epoch guards, fog/ownership, animation timing and inner simulation are unchanged.

38 focused tests pass, including sample chronology, CI shard coverage, planning
clock independence/overshoot/FIFO fairness, all 1/4/8 Stop/replacement/paid
footprint/recovery/queued-turn cases, arrival negative controls and paid
obstruction replays. Scheduler injected-stall checks, changed-file syntax,
browser/Node strict checked boundaries and whitespace checks pass.
[Repeated route evidence](qa-evidence/paid-battle-tick-budget-2026-10-04/replay.json.gz)
contains callback/four × mirrored 996-unit choke/S-bend cases, two repeats each.
All six pairs match exactly and preserve the earlier comparison's movement
traces, publication ticks and arrival ticks. The
[default callback phase probe](qa-evidence/paid-battle-tick-budget-2026-10-04/default-phase.json.gz)
retains three matching pairs and Stop cancellation. These checks use the same
`61156a1c` source; [verification](qa-evidence/paid-battle-tick-budget-2026-10-04/verification.json)
records identities and artifact hashes. Replay cost observations are not used
to override the failed native whole-tick qualification.

Integration against fork main `384ac60c` resolves the shared fixture conflict by
keeping both its new `logs` getter and the optional raw-sample health argument.
52 focused tests (including Bannerfall rules), both checked boundaries and docs
pass at `fef8bbc9`. Seven planner/outer-tick bodies and the diagnostic payload
body match the qualified source; inner `simulateTick` matches current main.
Current main adds Bannerfall guards to that inner body, so the historical native
timings remain attributed to `61156a1c`, not the later integration source.

Independent read-only review at `abcdc23e` and `61156a1c` resolves both original
measurement findings: both seats/resources must keep depositing, and casualty/
economy witnesses must align with the exact captured end tick. The legacy
token-free research notice is matched only after a serial order on its issuing
seat, then verified by paid completion. No outstanding review finding remains.

Two failed pilots and one successful pilot on the previous source are retained
with hashes in the summary and excluded from the qualified matrix. The failed
pilots exposed invalid null `timedVictory` admission and an assumed research
order token; neither produced a qualified battle timing result.

## Reproduce

```sh
PAID_BATTLE_TICK_RECORD=/tmp/paid-battle-4-2000.json \
  node scripts/paid-battle-tick-budget.mjs 4 2000
```

Repeat serially with policies 0/4 and sizes 250/2,000. The harness exits on
functional failure and always retains a requested failure record; budget success
must be evaluated from every raw complete-tick duration, not its exit status.
No credentials, security flags, paid art or explicit deployment are needed.
Movement retains the separate [rendered/deployed acceptance gap](movement-tick-phase-proposal.md#deployed-and-rendered-acceptance-retained):
the available Chromium path fails sandbox startup, and no rendered battle is
claimed by these native runs.
