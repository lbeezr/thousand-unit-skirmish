# Tiny opponent search: measured source acceptance

[AI backlog](pve-policy-backlog.md) · [Tiny map QA](qa-terraced-vale-2026-10-03.md) · [Testing](testing.md)

Owner: Opponent AI. This slice fixes bounded exploration only. It does not
enable PvE, change the normal catalog/default, edit terrain or deploy a release.
Mode owner `01a103cc` retains admission/default/capabilities; map owner
`01a103e8` retains the unchanged Tiny map. Ordinary served acceptance remains
with the coordinated staging/Mac session and the implementation owner.

## Exact map, engine and identity

Canonical `veyrholds-terraced-vale` from PR202 / `399455af` is **160×160
cells**, with 24 total opening units, 150 food/250 wood per seat, terrain seed
93025, fog enabled and two bonus-only posts. Map SHA256:
`1d91efb4f377f5c382f5a18e31e30d70efae17fb7434f133b878a2802c309dbd`.
It already has recovery-aware elimination, with no capture victory, hold or
deadline. The old Millrace/Rootways proofs remain legacy-map evidence.

Matched comparison engine: `67b2a6946ecca9e22e88a50545ad4888f167c3cb`.
Current-main regression engine: `a22b75ce` plus the same AI search changes
(`3c2007a6` before adding the test harness). Each candidate comparison restores
the exact initial checkpoint from its corresponding baseline. Neither terrain,
bank, positions, HP nor opening roster is modified.

**Native identity is authored@1; policy identity is explicitly skirmish@1.**
Current registry correctly rejects native Skirmish on Tiny. The smallest
[admission proposal](https://github.com/lbeezr/thousand-unit-skirmish/pull/176#issuecomment-5975052406)
is with the mode owner. These configured-policy runs do not establish native
Skirmish entry, a supported PvE capability or ordinary launch behavior. The
fixture replaces I/O scheduling only, retains authoritative command/simulation/
checkpoint bodies and has no connected seats or active authored scenario clock.

## Reproduced failure and bounded fix

Both baseline seed assignments gather, pay for and complete producers, and
recruit. Neither opponent issues a building assault in 3,600 simulation
seconds; both games remain ongoing. Exploration replaces its goal when forward
sight reveals the goal before the army arrives. After local goals stall near
terrace edges, unknown local probes also prevent the existing global cursor
from ever running.

Retain an exploration approach until arrival within two cells or its existing
60-second deadline, even after it is revealed. After an unreached goal expires,
give the existing bounded cursor a turn before selecting another local probe.
Visible enemy targets still interrupt search. Combat protection, ordinary
orders, generation checks, retry bounds and caller-reserved troops remain
unchanged. Inputs are own positions, dimensions and filtered sight; no enemy
spawns, hidden terrain, enemy economy or new route planner.

## Matched full Tiny games

Each row has two exactly equal executions: every command/notice and full final
native checkpoint repeats. All orders pass authoritative validation, with zero
rejected/failed/unreachable orders. Times are simulation ticks / 30.

| Azure / Ember policy seeds | Baseline | Retain revealed approach only | Final bounded cursor fix |
| --- | --- | --- | --- |
| 20260925 / 0 | Ongoing at 3,600s; neither building assaulted | Ongoing at 3,600s; Ember building assault at 826s | Ember elimination at **495s**; first building assault 202s |
| 0 / 20260925 | Ongoing at 3,600s; neither building assaulted | Ongoing at 3,600s; building assaults at 1,798/1,622s | Ember elimination at **2,676s**; first building assault 252s |

Assault times in this table mean any visible building: the first game attacks a
Storehouse at 202s and a Barracks at 419s. The intermediate swapped Azure
case attacks a Farm at 1,798s and a land producer at 1,824s.

The current-main two-case regression repeats those terminal times. Both seats
pay for their first Barracks at 17s and complete it at 39–42s. First-case total
command debits are Azure 300 food/425 wood, Ember 650 food/575 wood; second-case
debits are Azure 960 food/845 wood, Ember 2,550 food/1,475 wood. Bonus income and
finite Farms remain normal gameplay; these debit totals are not a complete
resource conservation ledger. Initial opposing armies stay hidden, and changing
unseen enemy banks/entities in a copied observation leaves both policy inputs
and commands equal. Entity assaults require current visible targets.

The second case performs native checkpoint restore at 600s with fresh policies
and full Worker-observation equality except the documented transient receipt
slot. The first finishes before that checkpoint. Both perform native map/reset
after defeat: winner clears, 24 opening units and 150/250 banks return, fog clears
enemy sight, identity remains authored and the simulation tick stays monotonic.
This is the native reset primitive, not a browser rematch or process restart.

Both games have Ember winners. This two-case observation establishes completion,
not seat fairness, balance, win rate or fun. Observed per-seat maxima are four
Workers and at most twelve military units; it establishes no supported capacity
for the 160-cell tier or larger maps.

## Paid loss recovery and strict fog blocker

The existing legal loss prelude pays for a Barracks, loses all eight opening
Infantry in real combat and then loses the producer to an observed enemy
assault. Four Workers survive, gather and fund a replacement and recruits.
On Tiny, Ember completes this case with native foundation checkpoint restore,
fresh configured policy and exact replay: purchase 113s, completion 138s and
accepted five-unit advance 223s after recovery start. Food/wood stock, cargo,
both banks and spending reconcile within 3e-10, with no capture grants.

Azure's strict foundation restore fails at tick **14,129**: only visibility
changes, with fifteen cells flipping current/explored state around the surviving
Workers. Units, banks, queues and Worker receipt slots remain equal. It
reproduces on current engine `a22b75ce`; it is not ignored by the full-equality
helper. [Runtime issue receipt](https://github.com/lbeezr/thousand-unit-skirmish/pull/200#issuecomment-5975157230)
requests owner inspection of visibility-cache restore timing. No server/fog edit
is included here. Azure recovery through that checkpoint remains blocked.

An independent Azure live-game control omits checkpoint restore and completes
the same legal recovery: replacement purchase 118s, completion 142s and
accepted five-unit advance 247s after recovery start. Both repeats match exactly;
four Workers survive, and 260 food/470 wood spending (including a paid House)
reconciles stock/cargo/banks within 3e-10 with no capture grants. This proves
ordinary simulation recovery separately; it does not close the fog restore gap.

No map topology defect is established: normal commands can complete both games.
The policy's unseen terrace-edge selections motivate the cursor fix, not a
silent map retune. Campus production succeeds; longer Worker resource travel
does not establish a resource-layout bug. Route/campus/resource changes remain
with their existing owners if a reproducible control case establishes one.

## Checks, artifacts and remaining acceptance

Author checks: 60 focused AI/paid recovery/adapter checks, 23 mode/population/
reconnaissance checks, and two full Tiny exact-replay cases pass. Eighteen pure
target tests include four new reveal/arrival/deadline/cursor regressions. Runtime
import boundaries, source syntax, whitespace and documentation links pass.
The new full Tiny cases are registered in CI, with their authored native identity
stated in the test name. Full commands are:

```sh
node --test scripts/pve-skirmish-targets.test.mjs scripts/pve-skirmish-replay.test.mjs scripts/pve-mode-adapter.test.mjs scripts/pve-skirmish-checkpoint.test.mjs scripts/pve-skirmish-loss.test.mjs scripts/pve-regroup.test.mjs scripts/pve-defense.test.mjs scripts/pve-worker-recovery.test.mjs scripts/pve-farm.test.mjs
node --test scripts/match-modes.test.mjs scripts/pve-population.test.mjs scripts/pve-reconnaissance.test.mjs
node --test scripts/pve-tiny-search.test.mjs
node scripts/check-runtime-imports.mjs
node scripts/check-docs.mjs
git diff --check
```

Raw matched checkpoints/traces, intermediate candidate, loss prelude, strict
failure snapshots and output are in
`/workspace/pve-tiny-evidence-2026-10-04`. Older probe fields named
`firstFoodDeposit`/`firstWoodDeposit` mean only bank exceeding the opening value;
they are not first-deposit measurements and are not used as such here.

Still open: native Tiny Skirmish admission and exact-mode cases; Azure foundation
fog restore; served bytes and ordinary New Game/fog/recovery/defense/rematch/
reconnect/process-restart/defeat observation. Keep `pveSupported: false` until
the receiving owners close the applicable ordinary gate. Source merge is a
useful bounded fix, not completion of that gate.

2026-10-04 correctness follow-up: the [foundation phase investigation](qa-pve-fog-restart-phase-2026-10-04.md)
explains the fifteen-cell Azure discrepancy as an off-phase cached mask in the
diagnostic comparison. At the next native snapshot phase, both seat views match;
the corrected test now restores a fresh fixture and passes paid recovery on both
Tiny seats without weakening fog equality or changing server restore. Native
Skirmish admission and ordinary served acceptance remain open. The original
failure and sealed Tiny archive above remain historical evidence.
