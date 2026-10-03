# Military combat stances

Simulation owner: combat task `01a0f784-c5d7-72e0-82e8-1747b4c840c1`.
HUD owner is coordinated by that parent. The simulation owner retains combat
acceptance and supports identified staging/native verification after integration.

## HUD / command contract

Send `{ type: 'setStance', ids, unitGenerations, stance }`. Stance is exactly
`aggressive`, `defensive`, `standGround`, or `noAttack`. Normal unit-generation
and seat ownership validation applies. Mixed selections affect only live military
units with attack capability; Workers and unarmed units keep their existing rules.
An all-ineligible or malformed command is rejected with an order notice.

Every ordinary state exposes `unitStances: [[id, generation, stance], ...]` for
the receiving seat's live eligible units; spectator views expose both seats.
Enemy stance is private even when the enemy is visible. Existing positional unit
rows are unchanged. A mixed selection should display mixed stance; absent entries
are ineligible, not an implicit default.

New military defaults to Aggressive. Ordinary Move has priority until its route
and queued waypoints finish, then the saved stance applies. Explicit focused
Attack has target priority; No Attack still permits it but finishes passively.
Stand Ground never chases, including explicit targets outside weapon range.
Stance changes preserve explicit movement/queues and focused targets where legal.
They interrupt automatic pursuit so the selected behavior takes effect promptly.

| Stance | Automatic visible local combat |
| --- | --- |
| Aggressive | Acquire within 4.8 cells; pursue within an 8-cell anchor that does not slide across successive idle targets. |
| Defensive | Acquire within 3 cells or weapon range; travel at most 3 cells from the saved anchor, then return. |
| Stand Ground | Acquire only in weapon range; never chase. |
| No Attack | No automatic acquisition; an explicit focused Attack remains available. |

If a new obstruction makes Defensive return unreachable within its travel bound,
it stops that return and defends from its current legal position under the original
anchor. It never expands the leash or retries a failed return indefinitely.

Hold Position sets military Stand Ground and retains its existing stationary
order. Stop sets military No Attack and abandons current/queued work, preserving
its existing indefinitely passive result. Worker Hold/Stop are unchanged.
A subsequent stance choice releases military Hold, but does not create a ground
destination. A new Move never silently becomes Attack Move.

Checkpoint state persists stance, fixed anchor and automatic combat/return intent.
Schema-23 idle military migrates to No Attack to preserve legacy passive Stop;
legacy held military becomes Stand Ground and combat-active military Aggressive.
Fresh matches/production use the new default. Rematch clears per-unit choices.

## Acceptance and delivery

Write scope: authoritative server, stance policy module, focused paid/native
reproducers and gameplay/testing documentation. No renderer or HUD edits here.
Required checks cover both seats, paid Archers and Infantry, repeated target
loss, fog/obstacles, leash/return, Stop/Hold/new Move, mixed Workers, malformed or
stale commands and checkpoint recovery. Native accepted commands and damage
must establish combat behavior; UI and deployment identity remain explicit
until the HUD owner's normal controls and identified user build are exercised.

Known unrelated baseline checks: `shore-fishing-placement.test.mjs:30,126`
expects the shipped Vaelora siltmouths landscape-v2 audio reference, which the
generator omits; `shore-fishing-authoring-scenario.mjs:90` expects a catalog name
matching `/Lab.*SHORE FISHING/`. Both were reproduced on pristine `d503d90`.
Parent coordinates the shore/audio owner; these failures are not waived.
