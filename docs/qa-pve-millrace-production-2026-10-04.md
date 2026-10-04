# Millrace production timeout investigation — 2026-10-04

[AI backlog](pve-policy-backlog.md) · [CI fixture triage PR296](https://github.com/lbeezr/thousand-unit-skirmish/pull/296)

Owner: Opponent AI `01a10297`, coordinating the full-suite result with CI owner
`01a10378`. The reported original clean shard at
`d8f10423f0feda3c219201401c08ee772a7fa0fc` passed 354 checks and left 13 unrun
after `pve-production-runtime-scenario.mjs:81` timed out. That failure's complete
commands/notices/final tick are requested on PR296; its original local log files
are absent from this execution environment. The cause and full-suite repair
remain open. No load attribution or gameplay regression is established yet.

## Unchanged reproduction and native traces

The exact existing live command is:

```sh
node scripts/pve-production-runtime-scenario.mjs bellweather-millrace
```

It passes unchanged at both reported source `d8f10423` and inspected current main
`cade7c8b351f2f8cf69ea83b2bcb1149d6a5ec74`. Both ordinary seats use the original
seeds Azure `20260925`, Ember `4294967295`. Production, regroup, opponent and
live scenario sources are identical between those revisions.

| Existing live scenario | First paid recruit, simulation seconds | First reinforcement attack-move, simulation seconds |
| --- | --- | --- |
| Azure, both inspected sources | 58.1 | 169.1 |
| Ember, both inspected sources | 54.1 | 54.1 |

Both accepted a single paid Barracks, bought recruits and ordered replacements
under the existing assertions. These isolated passes do not close the failing
full shard or prove why it failed.

An observation-only fixed-tick probe uses the existing native fixture with
`authored@1`, unmodified Millrace, original starting banks/rosters and those same
seeds. It retains commands, notices, selected fields from every one-second
observation (resources, production, population, units, buildings and objectives),
thirty-second checkpoints and final state through 240 simulation seconds. No unit, HP, bank,
terrain or fog edits occur. Restoring each retained initial checkpoint into a
fresh fixture repeats the entire result by strict equality at both sources.

Both native traces produce Azure/Ember's first recruits at 56/54 seconds. Azure's
opening military dies by 30 seconds; its first replacement receives an ordinary
Move to rally at 56 seconds, then five living recruits advance together at 153
seconds. Ember's first reinforcement advances at 54 seconds. No order is
rejected or unreachable. This demonstrates successful paid recovery and bounded
regroup for these native starts; it is not a full-match completion or cold-midgame
qualification claim. Existing cold-recovery regressions remain the floor.

## Scope of this update

The live fixture's two existing budgets remain unchanged: both seats must buy
their first paid recruit within the original 120-second wall window; an ordered
reinforcement has that window plus `PVE_REGROUP_LIMITS.maxWaitTicks / 30` seconds.
Regroup's bound is still 3600 simulation ticks. The timeout now retains elapsed
wall seconds, observed simulation tick, first recruit/order ticks, observed
recruit IDs, living generation-bound military and current producer state beside
the existing command/notice trace. This makes a future failure diagnosable; it
does not turn the existing timeout into a pass. No policy, production rule,
retry, server, map, fog, checkpoint or admission change is included.

The AI backlog now records merged PR255/277/281, their source-specific results
and the parent's staging receipt: deployment `c487990a` succeeded at 14:50:50 UTC
on 4 October, serving `1acaf9a46fd4d6ed71e1aa32a3f3543ea4a56ad3`, with 1/1
service online and production unchanged. This supersedes earlier `53a47ee`.
Ancestry contains PR255 and PR281; no AI deployment call or rendered behavior
is inferred from that infrastructure receipt.
Actual rendered Tiny acceptance remains open. Medium remains human-only, with
one final paired game still unfinished at 3600 seconds. Those source changes
do not repair or explain this historical authored Millrace timeout.

The owned PR and sealed receipt retain exact candidate/postmerge checks,
independent review, raw traces, replay scripts and source provenance. The next
CI action is to supply the original failure payload or rerun the same full shard
with these unchanged-budget diagnostics, then route the demonstrated cause to
the AI or execution owner. No full-suite success is claimed. Deployment is
paused; no Mac, deployment or external-agent calls are part of this work.
