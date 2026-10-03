# Worker-combat pursuit reversal — 3 October 2026

## Exact baseline and failure

The [Stone lane's recorded timeout](qa-stone-ledger-recovery-2026-10-03.md)
names `node scripts/worker-combat-scenario.mjs`, CI's “Worker combat across both
seats”. The unchanged fixture SHA-256 is
`f9f8bd2fb45ab82f5a5030af7c3ba51a17e0b8ea3b8836ae23d161e1f013e0fc`.
The content owner reproduced it on clean `1850b3b`; this investigation repeats
it on `20c4fcea1c35ac9920f04ecd6f891d55c31b0f56`, Node 24.19.0, server SHA
`e1a2f15b19446559cf66c30e43a9a3a22cd8105b579075d3716a8924f1193b5f`.

The first duel is Azure Worker 0 versus Ember Infantry 9 on the published
fog-off 64×64 Open Field variant, starting army 10 and spawns `(-8,0)/(8,0)`.
Both direct attacks are accepted. At the unchanged 35-second deadline, tick
1,050, both are still at 100 HP near `(-6.5,.15)/(7.5,-.99)`. The second duel
never begins. The server ticks, positions change and pursuit paths remain
active, ruling out an unlaunched pregame gate for this reproduction.

The fixed-tick adapter uses the actual authoritative function bodies and drains
ordinary planning callbacks. No actors, positions or HP are injected. In a
16-case matrix (two Worker seats × four spawn directions × Direct/Attack Move),
two direct cases fail after 1,200 ticks without damage: Azure/east-facing spawn
and Ember/west-facing spawn. Fourteen controls pass. All pairs repeat twice.
The separate second-duel pairing passes even before correction.

## Root cause and bounded correction

`getUnitAttackPath` rebuilds pursuit from the mover's continuous current cell.
While both opponents move across row boundaries, each target-cell change
replaces the current vertical waypoint with a step in the opposite direction.
The first duel repeats that reversal before either attacker can make lateral
progress. This is a real route-replanning failure, not a slow harness or a Stone
payment/regeneration issue.

Existing pursuit now finishes one current legal waypoint and computes the new
flow path from that waypoint. `canTraverseUnitStep` rejects blocked, cliff or
nonadjacent retained steps. Only continued direct/Attack Move pursuit opts in;
new orders and initial target admission still replace the old route immediately.
The range check still fires immediately in range, and unreachable geometry
still releases pursuit. No changes to the 0.6-second repath timer, weapon stats,
flow-build cap, cache budget, fog knowledge, Stop/Hold, ownership or AI policy.

Candidate `1f4b7799c1f1976174f16003f3058d9b5a8653bb` has server SHA-256
`ce165999686db6087f012c7e79068ade2c95619fde4901a3a888083e750d36a6`.
[Retained evidence](qa-evidence/worker-combat-repath-2026-10-03/checks.json)
preserves exact provenance, baseline timeout samples, reversal samples and both
matrix runs' trace hashes. The [map](qa-evidence/worker-combat-repath-2026-10-03/map.json)
is the same authored duel variant.

## Candidate checks and limits

All 16 matrix cases resolve in 349–403 ticks, repeat exactly, and leave Infantry
at 60 HP after killing the Worker. Both formerly failing cases resolve in 402
ticks with first damage at tick 168. The untouched idle roster retains its
positions and order revisions.

The unchanged native Worker-combat script passes both duels with its original
35-second timeout, both winners at 60 HP. New independent native two-seat runs
use the ordinary starting roster and attack commands, restart during pursuit,
and restart after combat. Both seats resolve with Infantry at 60 HP; recovery
keeps the result, cleared target and idle roster. No checkpoint actor/position/HP
injection. These native records were captured on clean committed `1f4b779`.

The focused run passes 154 checks, including the 16 matrix cases, three waypoint
guards, combat/flow budgets, terrain movement, selected construction, cargo,
stationary commands and parked-Worker detours. All twelve prior death/fog/
unreachable queue pairs repeat with traces identical to merged PR 121. Existing
native direct/Attack Move cliff pursuit scenarios also pass; those older fixtures
retain their declared checkpoint setup and do not share the no-injection claim.

The owning PR records independent review, final integration and postmerge checks.
Independent review of `1f4b779` reports no findings: 130 focused tests and all
16 replay pairs pass. Additional probes preserve flow budgets/cache use and
discard nonadjacent, completed or corner-blocked waypoints. Syntax, docs and
diff checks pass; the native harness was inspected and live runs remain author
evidence.
These are bounded checks, not a green full-suite, renderer, deployment, general
combat parity or performance claim. The native Worker proof uses fog-off terrain;
fog authority remains covered by the existing attack-loss controls.

## Reproduction

Run the commands in the [testing guide](testing.md). The matrix's `--observe`
mode records bounded failure on the historical source using the read-only
adapter; it does not change production rules.

For an ordinary two-seat browser observation, import the authored duel map in
Map Studio and publish it. Select Azure's first Worker and Ember's only Infantry,
then give each a direct attack on the other. They should reach combat and the
Infantry should win. Reset and repeat with Azure Infantry versus Ember Worker.
Restart during pursuit and after combat to observe persistence. This recipe does
not establish browser usability or a rendered capture.
