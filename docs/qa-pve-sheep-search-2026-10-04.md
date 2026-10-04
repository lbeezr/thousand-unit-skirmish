# Tiny Sheep-map Skirmish search recovery

[AI backlog](pve-policy-backlog.md) · [Paid process recovery](qa-pve-tiny-process-recovery-2026-10-04.md)

Owner: Opponent AI. Source baseline is main `f62978b7`, after mode admission
PR250, Sheep-map PR249 and paid process recovery PR247. The canonical Terraced
Vale file SHA256 is `2e352328e0b6795c04a11505672d17971231cc2e7ad34a858ff6418423d5d1f6`.
Map, simulation, production, defeat rules and checkpoint schema are unchanged
by this policy slice. Ordinary Tiny development availability is already enabled;
this is a gameplay fix, not another admission change.

## Reproduced weakness

The prior full-match matrix passes only 2/4 cases on the Sheep map. Configured
Skirmish seeds `[20260925, 0]` remain ongoing at 3,600 seconds under both native
Authored and Skirmish identities. The opposite assignment exactly repeats an
Ember elimination at 2,236 seconds under both identities.

An evidence-only copy of the unchanged native runner retains its terminal state
at the same cap instead of throwing its two result assertions. From the same
initial checkpoint, the native Skirmish timeout repeats exactly, including every
order, notice, final checkpoint and reset. Azure has no living units but retains
its recovery buildings; Ember has 12 soldiers and four Workers. Its search keeps
issuing new nearby goals around the northern perimeter. Nearby goals that arrive
before their deadline can repeatedly take precedence over the global grid;
when the cursor runs, consecutive cells keep its early turns on one map edge.
This diagnostic does not alter the engine, grant resources or weaken repository
tests. The real full-match test still fails the baseline timeout.

## Bounded policy change

Current visible enemy recovery sources and living land units retain priority.
With no visible target, the existing bounded coarse grid gets first choice;
nearby probes remain a fallback. A deterministic coprime stride distributes
successive cells across rows while visiting every coarse cell before repeating.
The search still derives only from friendly positions, map dimensions and the
seat's fog. It retains the existing 64-candidate cap, 60-second goal deadline,
arrival/forward-sight behavior, generation checks, per-unit retry backoff and
protection for soldiers in combat or reserved for defense, scouting or regroup.

Native Skirmish pilot games exactly repeat elimination at 2,705 seconds (Ember,
seeds `[20260925, 0]`) and 1,564 seconds (Azure, opposite seeds). Both sides buy
and complete paid producers and recruits; native orders remain legal and the
existing checkpoint/reset assertions pass. Winner and pacing change; these
results do not establish balance, fairness, capacity or fun.

An earlier four-local-probe budget and a budget plus distributed cursor each
fixed the first assignment but timed out the opposite one. Those pilots are
retained as rejected experiments; neither is the submitted policy. The focused
23-check suite covers stable target priority, hidden-state equivalence, arrived
and expired goal progression, combat/generation safety and full coarse-grid
coverage on 80×64, 80×88 and 160×160. The rectangular case catches a stride that
shares a divisor with the grid's cell count.

```sh
node --test scripts/pve-skirmish-targets.test.mjs
node --test scripts/pve-tiny-search.test.mjs scripts/pve-fog-restart.test.mjs
node scripts/pve-tiny-process-recovery-scenario.mjs
```

The full native matrix, both-seat paid loss recovery, matched initial-checkpoint
comparison, independent review and postmerge qualification are receiving checks
for this slice; their final receipts retain exact source qualification. The
dated PR247 page preserves its measured failure and process result. Actual
rendered/deployed play and defeat/result rematch remain open with their existing
mode, entry and staging owners; no deployment or browser capture is claimed.
