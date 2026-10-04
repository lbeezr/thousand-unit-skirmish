# Foundation fog restart: native observation phase

[Tiny AI evidence](qa-pve-tiny-search-2026-10-04.md) · [AI backlog](pve-policy-backlog.md) · [Testing](testing.md)

Owner: Opponent AI. This correction changes the headless acceptance adapter and
paid loss case only. Server simulation, visibility, checkpoint schema, mode
registry and wildlife state are unchanged. Shared-boundary reasoning was
[recorded with the runtime owner](https://github.com/lbeezr/thousand-unit-skirmish/pull/200#issuecomment-5975289224)
before selecting this owned adapter boundary. No shared restore edit is needed.

## Exact reproduction and what the player can learn

At source `5200ffdf85717c8a29a31d719fa4389130f192d8`, canonical Terraced
Vale has terrain seed 93025, unchanged SHA256
`1d91efb4f377f5c382f5a18e31e30d70efae17fb7434f133b878a2802c309dbd`,
and the ordinary 24-unit opening with 150 food/250 wood per seat. Azure's
configured Skirmish policy seed is 20260925; native identity remains authored@1
while actual Tiny Skirmish admission is pending.

The legal prelude loses eight Infantry and a paid Barracks, preserves four
Workers and buys its replacement. The historical foundation checkpoint is at
tick **14,129**, Node JSON SHA256
`0f74040b8cf21a7e465fc6409fa1c93799b1bbef9ff283d5c435771595e04ccb`.
Restoring that exact checkpoint reproduces its recorded post-restore wire view.
A new legal prelude reproduces the physical state at the same tick; fresh
server instances have random generation identities, so those two fields are
excluded only from that historical physical-state comparison. The new prelude
then exactly repeats from its own unedited initial checkpoint, including all
identities, both views and later checkpoints. No checkpoint data is injected or
modified in simulation.

Native `runSimulationTick` updates fog every `STATE_EVERY_TICKS = 3`. At the
off-phase foundation, the live snapshot's unit positions are from tick 14,129
but its cached fog was last updated at **14,127**. Restore correctly derives
sight from the saved positions at **14,129**. The diagnostic compared these two
different observation phases. All fifteen cells change only between current
sight (2) and explored (1): four 2→1 and eleven 1→2. No unknown cell (0), enemy
unit, building, resource row, bank, queue or objective differs in this case.

The packed mask is a real wire field, not private diagnostic data: the client
uses states 1/2 for fog/minimap shading (alpha 154/0). If either off-phase view
is delivered in a reconnect welcome, those cells have different current-sight
labels. The headless observation is not evidence that a regular pre-restart
state frame was emitted at that tick. This exact case adds no previously
unknown terrain or entity knowledge; restored labels reflect saved positions.
It does not establish that every possible off-phase scene has the same outcome.

At the next native publication phase, **14,130**, live and restored simulations
produce fully equal both-seat snapshots after one tick. A separate fresh fixture
restoring the aligned checkpoint also has identical fog and full observations,
apart from the already documented transient Worker receipt reset. These results
exactly repeat. The server's normal periodic checkpoint interval is 30 ticks,
already aligned with that state cadence. Shutdown/manual checkpoint timing may
be off-phase; its derived current-sight rebuild is retained.

## Small correction and strict recovery proof

`replay.advanceToStateBoundary()` runs zero to two ordinary simulation ticks
using the native cadence constant. It does not alter any authoritative function
body, force a special vision update, persist a cached mask or remove fields from
the equality assertion. The paid loss case invokes it at the replacement
foundation before taking its snapshot/checkpoint.

The case now restores in a **fresh server fixture**, compares both seats with
the unchanged full-observation helper, then continues with a fresh configured
policy. The prior in-place fixture is disposed. An explicit test-only native
identity option allows unchanged canonical authored elimination to exercise
the configured policy while Tiny's registry admission remains pending; default
legacy cases still use actual native Skirmish identity. No map relabeling or
compatibility guard bypass occurs.

Seven checks pass: the phase adapter at all three phases, both Tiny seats and
four legacy map/seat loss cases. Each loss case repeats every order/notice and
full final checkpoint from the same initial state. Both Tiny seats retain four
Workers, buy/complete replacement production, recruit and issue an accepted
five-unit advance. Finite stock+cargo+both banks+spending reconcile; no capture
grant funds this recovery. The new regression is registered in CI.

```sh
node --test scripts/pve-fog-restart.test.mjs scripts/pve-skirmish-loss.test.mjs
```

Raw phase proof, the historical checkpoint, repeated new prelude and check output
are in `/workspace/pve-fog-evidence-2026-10-04`. The separate prior Tiny evidence
archive remains sealed and unchanged. The **495/2,676-second** full games remain
evidence of completion, not balanced pacing, fairness, fun or supported capacity.

## Acceptance retained

The previously reported fifteen-cell Azure discrepancy is explained and the
corrected native-phase fresh-fixture recovery gate passes. It does not call for
a server fog/restore/wildlife fix. Native Tiny Skirmish admission and exact-mode
acceptance remain with mode owner `01a103cc`; ordinary served/Mac New Game,
recovery, fog, defense, rematch/reconnect, process restart and defeat observation
remain open. No deployment or browser screenshot is claimed. Keep
`pveSupported: false` until actual admission and applicable ordinary acceptance
are satisfied.
