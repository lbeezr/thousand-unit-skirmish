# Direct army Attack continuation — October 3, 2026

[Game bible](game-bible.md#stationary-army-orders) · [Testing](testing.md)

Implementation owner: combat investigation task from source thread
`01a0f784-c5d7-72e0-82e8-1747b4c840c1`. Parent retains staging coordination
and Mac appearance QA; implementation owner retains combat verification.

## Reproduced failure

User: "do the archers work? i dont think they worked when i tried to send them
while htey were in 'attack move' mode". Subsequent reports describe an army
stopping after a kill and needing another target click. The requested behavior
is focused-target priority followed by local visible combat, with explicit
interruption and eventual stance controls.

Reproduced against deployed source `00ff45d9702dfbcf9da6f6ac88e0ca4381e374dc`
(server SHA-256 `89fffa510924030d84695cd3645ac8694623dff494a41fae3f0cf45e8581b384`)
and current-main baseline `7193c4ba74376c592c57804537f072a33d7146aa`
(server SHA-256 `ba64aa9868cabd2231a68e00d4a656cbeb70b758ffedafaa8a2a5aaad48df27d`).
Both revisions produce identical combat traces in the paid single-unit fixture.
This identifies source behavior; it is not a new observation on the hosted game.

Open 64-cell map, 24-unit starting roster, fog enabled; construct and pay for a
Range/Archer, move two enemy Workers into local friendly vision, and issue one
accepted Attack. The clicked target dies, but the second remains at 100 HP for
the rest of 1,200 fixed ticks. Both seats reproduce it. Infantry fails similarly.

| Single attacker | Direct Attack first kill | Next enemy hit | Ground Attack Move next hit / second kill |
| --- | --- | --- | --- |
| Infantry | Tick 278 | None | 305 / 539 |
| Archer | Tick 459 | None | 492 / 926 |

Ticks are measured from accepted order, at 30 ticks/second. Existing archer
range, firing records and authoritative damage work: the reproduced defect is
the absence of local combat intent after a direct target is cleared.

The ordinary `M` key and Attack Move toggle both arm targeting. A battlefield
right-click on bare ground emits `attackMove`; clicking an enemy emits `attack`
and consumes the armed mode. That focused path explains how the report can occur
while Attack Move was displayed. Source-function input checks exercise the actual
keyboard/button/pointer handlers in both seats; native checks verify accepted
payloads and actual worker behavior. A rendered input capture is still pending.

## Fix and bounded acceptance

`clearAttackTarget` now gives an unqueued military focused attack local combat
intent through the existing attack-move scanner, route scheduler, fog checks and
pursuit leash. It starts with an empty route at the unit's current position.
Explicitly clicked targets retain priority until they are invalid. Queued
commands retain precedence; Workers retain their existing focused-attack behavior.

- `node --test scripts/army-attack-continuation.test.mjs`: paid single/three-unit
  Infantry and Archer cases in both seats kill successive visible enemies;
  ground Attack Move resumes its destination. Stone obstruction, Stop/new Move,
  stationary Hold reacquisition, queued/Worker exclusions, fog loss and ordinary
  keyboard/button/right-click payloads are executable regressions.
- The fog-loss case accepts a distant visible focus, withdraws its friendly
  observer by ordinary Move, then engages the nearby visible enemy. Hidden focus
  stays at 100 HP. Both seats reacquire within seven ticks after visibility loss.
- Existing geometry, flow fairness, stationary commands and Worker pursuit tests
  pass, including PR #125's legal-waypoint completion. The pursuit helper itself
  is unchanged. Native target/queue recovery remains covered by existing scenarios.
- Independent review examined server SHA-256
  `75f64e392d80ae64cc18d668d9c23a1692180631393e397ae000806ea3142025`,
  found no simulation blocker, and requested the executable CI wrapper and explicit
  Hold-position assertions now included. Review also supplied the paid fog-loss probe.

Native two-seat worker/checkpoint acceptance is recorded by
`ARMY_ATTACK_NATIVE_RECORD=/tmp/army-native.json node scripts/army-attack-continuation-native-scenario.mjs`.
It trains three paid Archers per seat, focuses a target in separate combat lanes,
restarts during second-target combat, reclaims both seats, finishes without new
attack orders and verifies Stop clears continuation. Exact run result and PR
revision are recorded in the PR.

## Inventory and next incremental stance scope

The inventory below records the pre-stance source at this investigation. The
subsequent [stance slice and exact evidence](qa-military-stances-2026-10-03.md)
implement its approved simulation work; ordinary HUD/deployed acceptance remains open.

There is no Aggressive/Defensive/Stand Ground/No Attack UI or persisted stance
field. Existing behavior: Move/spawned military remains passive while idle;
Stop leaves idle, Hold acquires only within weapon range, and Attack Move/
Patrol/Follow have local combat intent. This fix addresses direct completion;
idle military self-defense remains a concrete missing behavior for the approved
stance work. Smart ground-click defaults remain a separate unapproved change.

Simulation slice: add a validated per-unit stance command and persisted stance
field, preserve generations/seat ownership/queues, and share the bounded visible
target scanner and fair route budget. Explicit focus keeps priority. Automatic
acquisition must remain local, reject hidden/unreachable targets, and obey an
anchor that prevents repeated targets from producing unbounded pursuit. Choose
the initial military stance explicitly; keep Worker economy and ordinary Move
semantics. Proposed stance distinctions:

| Stance | Automatic local combat |
| --- | --- |
| Aggressive | Acquire nearby visible enemies; pursue under a fixed bounded leash. |
| Defensive | Defend a saved position with a shorter leash; return after combat. |
| Stand Ground | Attack/reacquire within weapon range; never chase. |
| No Attack | Suppress automatic acquisition; an explicit focused Attack remains available. |

HUD slice: consume an agreed stance wire field, show the selected units' stance
or mixed state, and offer all four labeled controls usable by keyboard, pointer
and touch. Accessible Move-only/retreat stays visible without requiring a
modifier. Keep simulation contract and HUD edits in separate incremental PRs.

Acceptance: repeated kills and idle defense; passive override; retreat/new Move;
held Archers; fog, bait/leash and return behavior; mixed Worker/military selection;
both-seat ownership, checkpoint/reconnect and rematch; accessible stance controls.

## Remaining user acceptance

This environment's installed Chromium fails its Linux sandbox startup. The
existing browser preflight reports `sandbox-unavailable`; no sandbox bypass was
attempted and no screenshot or GPU appearance is claimed. Parent's staging/Mac
QA must identify the deployed revision and exercise both input controls, ground
and enemy targets, visible arrows/attack poses, HP loss, second-target acquisition,
Stop/Hold and Move retreat in an ordinary match. Deployment and appearance remain
open until that actual revision is observed.
