# Explicit Skirmish AI target source slice

[Mode contract](match-mode-contract.md) · [Ranked AI work](pve-policy-backlog.md) · [Testing](testing.md)

Owner: Opponent AI workstream. This is a configured policy source milestone.
Ordinary socket entry remains authored; Skirmish's registry still declares
`pveSupported: false`. No server victory/checkpoint change or deployment is part
of this slice. The receiving runtime owner is playable-modes task `01a103cc`.

## Reproduced gap and resulting behavior

Current capture-post policy stops its ordinary army once it owns every post,
including reward-only posts. A visible completed enemy Barracks receives no
assault. Explicit `createDeterministicPolicy(seed, {matchModeId:'skirmish',
matchModeVersion:1})` now selects registry strategy `base-elimination`.
Missing fields and Objective Control keep the capture policy; partial/unknown
identities reject through the shared registry.

The separate helper ranks current visible completed land producers, living land
units including Workers, producer foundations, then other land structures.
Products and movement domains come from public definitions; enemy affordability,
queues, spawns and hidden terrain are not inputs. Generation-bound ordinary
attacks preserve engaged/recent fighters and exclude reserved defense, rally and
reconnaissance units. A disappeared target cannot receive another entity attack.
Unknown-target search uses own positions, dimensions and filtered sight: sixteen
frontier probes, at most sixty-four cursor probes, and a sixty-second search
deadline. Per-unit no-progress retries grow from ten to sixty seconds. This is
bounded exploration, not a terrain planner or guaranteed rapid elimination.

## Paid deterministic regression

`scripts/pve-skirmish-replay.test.mjs` uses a distinct authored test map with
reward-only rules, both ordinary 24-unit rosters and finite home food/wood.
The opposing seat legally pays 175 wood for a Barracks and 50 food for a recruit,
then returns its Workers/army home. The tested army legally captures the bonus
post and observes the Barracks. No positions, HP, units or banks are injected.

| Seat | First assault | First damage | Producer destroyed | Restart during damage | Legacy control |
| --- | --- | --- | --- | --- | --- |
| Azure | 1 second | 6 seconds | 121 seconds | 6 seconds | No assault/damage in 240 seconds |
| Ember | 1 second | 5 seconds | 121 seconds | 5 seconds | No assault/damage in 240 seconds |

Times are simulation ticks / 30 from the common paid checkpoint. Every resumed
command, notice and final producer state matches a second run exactly, including
a restore and cold configured policy. Support stock+cargo+bank+spending reconcile;
the opponent retains the correctly debited 100 food/75 wood. Both matches remain
ongoing when this producer proof stops: a destroyed producer is not a defeat.
The fixture replaces I/O scheduling only; authoritative function bodies are
unchanged. It has no connected WebSocket seats and its scenario clock is stopped,
so it does not prove ordinary-entry timing or a runtime mode identity migration.

Fourteen pure tests cover both seats × three seeds, reward ownership, unchanged
legacy/Objective Control traces, invalid mode pairs, priorities, water/friendly/
dead exclusions, sight loss, reused generations, reinforcements, combat, bounded
retries/search and hidden-state metamorphism. Existing mode, population, Worker,
Farm, defense and regroup checks pass: 88 tests. The new two paid replay tests
and fourteen pure checks are registered in CI.

## Full-map observations and open acceptance

On source engine `eae3fb1342944b3f9573a7a244835778070900c5`, unchanged shipped
Millrace/Rootways maps were projected with the owner's `effectiveMapForMatchMode`
and both policies configured with Skirmish. Azure seed 20260925 / Ember seed 0:

- Rootways reached server elimination, Azure winner, at 1,142 simulation seconds:
  397 orders, zero rejected/failed/unreachable orders.
- Millrace reached the 1,200-second test cap with no winner: 764 orders, zero
  rejected/failed/unreachable orders. Both sides had visible producer assaults
  and surviving recovery sources. This is a timeout, not a draw or AI readiness.

These are single fixed-tick runs with no connected seats. Their full-map restore
proof is **blocked**: the current server rejects a projected shipped map as
changed since checkpoint. The mode owner's next runtime slice must persist the
canonical map and effective versioned identity. The guard remains intact.
The authored scenario clock was stopped; elapsed tick time alone does not prove
ordinary deadline behavior. Pure mode projection tests prove rule removal.

Retained local artifacts are in `/workspace/pve-skirmish-evidence-2026-10-03`:
paid checkpoints/traces, full-map probe/checkpoints/traces and focused output.
These observations do not establish win rate, balance or fun.

2026-10-04 follow-up: runtime PR200 and the AI fixture's canonical mode activation
close the projected-map restore blocker. [New full-map receipt](qa-pve-mode-adapter-2026-10-04.md)
records actual schema-27 restart, both-match elimination and exact replay, while
retaining mode-specific loss recovery and ordinary acceptance. The observations
above remain historical source evidence.

Next: integrate the restored authoritative pair at the socket-policy boundary,
repeat full shipped-map checkpoint matches for both seats, exercise producer/
Worker recovery through army loss, then coordinate PvE capability enablement and
ordinary New Game/rematch/restart acceptance. Opponent AI retains policy fixes
and acceptance interpretation; mode owner retains server/default/capabilities.
