# Authoritative AI mode activation and canonical recovery

[AI backlog](pve-policy-backlog.md) · [Mode contract](match-mode-contract.md) · [Target policy](qa-pve-skirmish-targets-2026-10-03.md)

Owner: Opponent AI. Runtime [PR200](https://github.com/lbeezr/thousand-unit-skirmish/pull/200)
merged at `dc6e5ac7` and supplies the saved effective identity to the internal AI
factory. The ordinary socket adapter still constructed the authored capture policy.
Against source `154e5198`, all eight new socket activation/reset regressions fail:
an owned bonus post prevents an assault on an observed enemy Barracks.

The adapter now consumes the authoritative pair from welcome, map-change and
state. Missing legacy fields at a fresh setup preserve authored rules. An unchanged
state pair preserves private rally/attack watches; winner-clear and confirmed host
reset recreate the selected strategy. Partial/unsupported identities report an
error and stop orders. A valid fresh setup resumes the adapter. Order tokens remain
unique through resets. No server authority, registry capability or default changes.
[PR212](https://github.com/lbeezr/thousand-unit-skirmish/pull/212) merged at `c27c34a4`:
122 focused checks and independent ten-check review pass; ten postmerge checks and
the local release scenario pass. Its clean Docker release contains 1,162 files,
digest `sha256:54982456f6e64749e9b3a07e7346533b406a6fc97db207e370d60e6a2a38262d`.
This is source inclusion; no deployment is inferred.

Eight socket checks cover both seats, repeated snapshots, bounded retry, restored
identity, explicit authored replacement, legacy omission, map change, winner-clear,
pristine host reset and malformed identities. Two fixed-tick checks use unchanged
canonical Millrace/Rootways maps with the actual mode identity. Their schema-27
checkpoints retain canonical victory flags/hash while restored observations expose
bonus-only posts. Both seats retain complete authority across restore; only the
documented transient Worker activity display clears.

## Full shipped-map replay

Source engine `154e5198` with this AI adapter/fixture follow-up; canonical maps,
ordinary starting rosters/resources and legal orders. Azure policy seed 20260925,
Ember seed 0. Each match runs twice from the same complete initial checkpoint,
with a real checkpoint restore and cold policies at 600 simulation seconds.
Every command, notice and complete final checkpoint matches its repeat. The map
guard remains intact; this closes the projected-map restore blocker recorded in
the earlier source receipt.

| Map | Result | Simulation seconds | Orders | Rejected/failed/unreachable |
| --- | --- | --- | --- | --- |
| Millrace | Ember elimination | 2,518 | 1,192 | 0 |
| Rootways | Ember elimination | 1,935 | 811 | 0 |

After merge, source engine `c27c34a4` includes the navigation owner's crowd-forward
progress correction. Reversing the seeds (Azure 0, Ember 20260925) also completes
both matches twice with the same 600-second cold restart and exact commands,
notices and final checkpoints: Millrace Azure elimination at 3,132 seconds,
982 orders; Rootways Azure elimination at 1,789 seconds, 676 orders; zero
rejected/failed/unreachable orders. The two engine revisions prevent attributing
duration differences solely to seeds. This is four map/seed cases, each repeated.

Both initial 1,200-second caps were ongoing. Extending the bounded run to 3,600
seconds observed completion; a timeout was never relabeled a draw. Both policies
gather, buy producers/recruits, assault observed recovery sources, repair and
replant Farms. Losers finish with no living units or surviving land producers.
These are one seed assignment per map, not balance, pacing or win-rate evidence.
The fixture has no connected WebSocket seats and its authored scenario clock is
stopped. Fixed ticks do not establish ordinary-entry deadline timing or rendered play.

Local raw checkpoints, traces, harness and baseline failure are retained in
`/workspace/pve-mode-adapter-evidence-2026-10-04`. The short canonical restore and
socket tests are registered in CI. Ordinary authored socket/rematch scenarios and
the Skirmish/capture/regroup regressions remain the integration floor.

## Paid loss recovery

At source engine `c27c34a4`, `scripts/pve-skirmish-loss.test.mjs` exercises both
seats on both unchanged canonical maps. A human-controlled legal prelude buys a
175-wood Barracks, moves the opening Infantry through ordinary opposing guards,
and loses all eight in actual combat. The opposing seat then approaches and
attacks the Barracks only after observing it. Four Workers leave the target and
survive. The opposing army retreats; the configured policy takes over with the
actual losses and remaining finite economy. No checkpoint/HP/position edits,
free resources/troops or active path overrides occur.

The policy gathers the missing wood, pays for a replacement Barracks, resumes
construction after a native checkpoint restore with a fresh policy during its foundation, buys four
Infantry plus a Spearman, and advances a five-unit group. All four Workers survive;
all posts remain neutral and no capture resource grants fund recovery. Across both
seats and maps, the replacement purchase occurs 109–113 simulation seconds after
recovery begins, completion at 130–138 seconds, and group advance at 215–223 seconds.
Total paid spending is 260 food and 370 wood, including the first and replacement
Barracks and five recruits. Complete finite stock, cargo, both banks and spending
reconcile within `1e-5`. Every prelude/recovery command, notice and complete final
checkpoint matches a second run from the same initial checkpoint.

The recoverable side remains alive. This checks casualty recovery and an accepted
five-unit advance order; the separate full matches above establish actual movement, observed-target
assaults and final elimination. It does not establish rendered casualty feedback
or reconnect timing. Four physical regressions are registered in CI.

## Remaining PvE capability acceptance

Keep `skirmish@1.pveSupported: false` and the authored default. Opponent AI retains:

1. Identified served revision and ordinary New Game, legal fog-limited targets,
   rematch, reconnect/restart and recovery-aware defeat. Coordinated delivery and
   an available browser session remain with existing staging/QA owners; AI retains
   policy interpretation and fixes. No independent deployment is part of this slice.
2. In that ordinary session, repeat paid army/producer loss, fresh recruitment,
   Worker/Farm depletion recovery and defense/reform. The source fixtures and full
   matches above are completed proof; entry timing, actual fog disclosure and
   player-visible recovery remain observations to collect. Report long or stalled
   matches directly; the current matrix does not establish enjoyable pacing.

Enablement needs agreement with the mode/entry owners after those receipts exist.
The ordinary default is a separate product decision and remains unchanged.
