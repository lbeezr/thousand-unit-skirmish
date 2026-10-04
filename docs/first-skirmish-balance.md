# Skirmish balance

[Documentation index](README.md) · [Forked Vale](forked-vale-scenario.md) · [QA protocol](qa-vertical-slice.md)

## Current tuning decision

Keep unit stats, production costs, and objective rewards as the current baseline
until contested, seat-swapped player matches support a change. Existing scripts
check fairness and opening mechanics; they do not establish human win rates.

The newly approved match pacing/economy lane retains this guide as its canonical
plan. Its [4 October Tiny baseline](#tiny-paid-match-baseline--4-october-2026)
supports **no tuning change**: one elimination takes 39:53 and the reversed seed
assignment remains unresolved at the unchanged 60-minute limit. Quick objective
and custom modes keep their distinct victory contracts; these measurements do
not justify global timer, stock, speed, cost or reward changes.

The [Mill depot study](qa-mill-depot-economy-2026-10-03.md) adds paid, both-seat
travel simulations on three controlled placements. Mill and Storehouse overlap
on food; nearby wood makes Storehouse's additional service useful. Preserve the
provisional depot tuning: these cases supply no contested player evidence.

The [finite Farm prototype](farm-finite-planting.md) starts at 60 wood for 200
food stock, with 15 Worker-seconds of construction and ordinary paid harvesting.
These configurable values use the current Mill/House construction scale and a
four-Worker-training-price pool. They are provisional, with no adopted currency
exchange rate or human balance evidence. Observe Farm/neutral-source travel,
raid exposure and paid replanting in paired matches before retuning.

The [single-Stone recommendation](stone-defense-contract-proposal.md) selects
`stone`, one optional Watchtower construction sink (50 Stone plus its current
food/wood price), zero starting bank and 200 finite stock per seat. These are
provisional experiment values. Preserve the ordinary food/wood profile and old
paid prices; typed deposit/payment/refund/recovery must precede runtime admission.


The latest flat-map record in the prior ledger used `117284e` with Node 24.9.0.
It is historical evidence, not a new measurement of the documentation branch.
The full series, including failures and intermediate builds, is preserved in the
[balance archive](archive/2026-09/first-skirmish-balance.md).

## Recorded baselines

| Fixture | Recorded result | Interpretation |
| --- | --- | --- |
| Mirrored 8v8 Infantry at `117284e` | Left-side Team 0: 3 survivors/260 HP versus 4/230 at 10.7 s. Right-side Team 0: 4/260 versus 3/250 at 10.3 s. Command-send order did not change outcomes. | Passed existing bounds; small spatial/team differences remain worth observing. |
| Forked Vale two-worker construction at `117284e` | Barracks and Range completed at 10.9 s in both seat assignments; first Infantry at 23 s, Archer at 18 s. | Symmetric scripted production opening. |
| Equal-cost Worker/Infantry at `c931e69` | Infantry won all eight seat/spawn/order combinations. | Preserve the worker-counter regression; this does not determine raid balance in a full match. |
| Contested split at `c9e4791`, 80 s | North captured at 24.3–24.4 s; South stayed neutral. Three southern Infantry and two diverted Workers died. Two-worker Barracks took 11.5–11.7 s versus 7.0 s with four workers. | A resource/army/build-time tradeoff; the 120-second supply was excluded. |

In that contested run, the North capture reward was 75 food/50 wood. At 80 seconds,
the split's bank had gained 115 food/90 wood versus 80/80 for the response.
Including cargo, estimated acquisition was about 125/99 versus 99/99. Keep
rewards, deposited harvest, and carried cargo separate in comparisons.

## Reproduce focused checks

```sh
node scripts/infantry-seat-combat-scenario.mjs --expect-parity
RTS_OPENING_MAP=maps/forked-vale.json RTS_OPENING_BUILD_X=21.5 node scripts/opening-production-scenario.mjs --expect-builder-parity
node scripts/worker-squad-combat-scenario.mjs
node scripts/balance-contested-worker-opening-scenario.mjs
```

Record source, map, fixture options, duration, seat/spawn mapping, and command
order. The contested unequal groups are not a combat-parity fixture.

## Next observations

- Repeat the contested opening with human players in swapped seats. Record first
  gather/build/reinforcement/contact/control/win times, losses, stock and cargo.
- On larger maps, compare first contact, expansion, resource use by region,
  objective travel, and two viable routes. Revisit deadlines from observed pacing.
- On Highland Grove, compare terrace/route control with ordinary-resource openings.
  Coffee trade is still a proposal; the shipped site is a food placeholder.
- Elevation currently adds a 15% uphill path cost and one cell of sight radius.
  Measure whether routes and information matter before adding combat modifiers.
- Change one cost, timing, reward, or map rule at a time when an observation
  supports it, then repeat the paired-seat checks and match.

## Tiny paid-match baseline — 4 October 2026

Owner: match pacing/economy lane, branch `codex/tiny-match-pacing-baseline`.
The [measurement tool](../scripts/tiny-match-pacing.mjs) consumes the existing
fixed-tick authority without changing native gameplay, policy or admission.
The [receipt](balance-evidence/tiny-pacing-2026-10-04/summary.json) identifies
clean measurement source `24144f6b70dff6a2e00dfa4bec176ededa20a3c4`, containing
main `96b1c3ad` and movement U3 [PR364](https://github.com/lbeezr/thousand-unit-skirmish/pull/364).
Node is 24.19.0. Map is unchanged `veyrholds-terraced-vale`, terrain seed 93025,
160 × 160, raw file SHA-256
`2e352328e0b6795c04a11505672d17971231cc2e7ad34a858ff6418423d5d1f6`.
Native and policy identity are both `skirmish@1`; Azure is seat 0 and Ember seat 1,
with canonical spawn ownership and decision order `[0,1]` in every run.
This is the only admitted fresh Tiny economy AI map. Other ordinary size tiers,
legacy compact maps and quick modes are outside this baseline.

Both opponents use `src/pve-opponent.mjs`, seeds `[20260925,0]` and
`[0,20260925]`. This same-policy mirror is **not a separately qualified opponent**,
human play, an official win rate or the AI owner's unassisted qualification.
The ordinary opening is four Workers and eight Infantry per seat, 150 Food and
250 Wood per seat. Legal native Gather/build/train/research/repair orders pay
their real costs. There are no resource grants, edited checkpoints, forced losses
or tactical intervention. Policies receive only their own player-visible DTO;
observer checkpoints supply measurement data, never policy inputs.

Each complete game repeats exactly from its untouched initial checkpoint,
including every order, notice, sampled bank/cargo/node/building state and final
authority. At 600 seconds, the normal checkpoint is restored and fresh policies
start; both complete peer views agree, allowing only the established transient
Worker receipt clear. The existing 3,600-second ceiling is preserved. Simulation
seconds come from 30-Hz ticks; clocks/contacts are sampled each second. This
headless fixture has no connected WebSocket seats and its scenario clock is
stopped. Tick duration is **not** an ordinary process wall-time or deadline proof.

| Measurement (simulation seconds) | Azure seed 20260925 / Ember seed 0 | Azure seed 0 / Ember seed 20260925 |
| --- | --- | --- |
| First disclosed enemy, either seat | 216 | 418 |
| First damaged owned unit observed, Azure / Ember | 221 / 221 | 422 / 439 |
| Paid Barracks complete, Azure / Ember | 37 / 36 | 37 / 39 |
| First paid military recruit observed, Azure / Ember | 66 / 58 | 59 / 61 |
| First paid depot complete, Azure / Ember | 310 / 261 | 275 / 448 |
| Paid expansion center purchase → complete | Ember 651 → 759; Azure none | Ember 693 → 800; Azure none |
| Home Food nodes empty, Azure / Ember | 602 / 764 | 473 / 452 |
| Home Wood nodes empty, Azure / Ember | 786 / 706 | 881 / 780 |
| Peak military / Workers in every seat | 12 / 4 | 12 / 4 |
| Sampled bank below 50-Food Infantry cost, Azure / Ember | 97 / 0 seconds | 0 / 0 seconds |
| Terminal result | Ember elimination, 2,393 seconds (39:53) | Ongoing at 3,600 seconds (60:00), **bounded-unresolved**, no winner/draw |
| Rejected / failed / unreachable order notices | 0 | 0 |

The winning game ends because Azure has zero living land units, no surviving
Town Center or land producer and no land-production queue. Its House, Storehouse
and exhausted Farm survive; building destruction alone is not the victory rule.
Azure still has about 100 Food and 40 Wood. This is recovery-aware elimination,
not objective capture, a deadline victory or map-wide resource exhaustion.

At the unresolved endpoint, Azure has one living Worker, no military or home
center and one Storehouse; Ember has four Workers, twelve Infantry and a viable
home/Barracks/expansion. Azure has about 180 Food/10 Wood; Ember about
245 Food/3,010 Wood. Azure's surviving land Worker keeps elimination open.
Ember's last durable attack is at 2,975.3 seconds; its army remains near
`(+37,-35)` with unfinished native paths while emitting accepted search
orders. The retained final authority and trace support diagnosis; they do not
identify a policy or route cause. Do not interpret the timeout as a balance
problem or raise the completion ceiling to close it.

The unchanged canonical `pve-tiny-search.test.mjs` reversed-seed Skirmish case
also [fails its existing completion assertion](balance-evidence/tiny-pacing-2026-10-04/existing-completion-failure.txt)
at 3,600 seconds on this runtime. This corroborates the non-completion outside
the measurement driver. No server, map, policy, shared fixture or canonical
full-game test function changed in this lane. The failure remains open with the
AI/movement owners; focused measurement passes do not claim a green full suite.

### Economy and mode recommendations

- Retain provisional stocks/prices and the separate quick-mode contracts.
  Home nodes do empty within 7.5–14.7 minutes, but substantial valley/terrace
  resources remain at both endpoints. Local depletion is not total exhaustion.
  Node depletion, finite Farm depletion, cargo, banks and command debits/credits
  are separate fields in the receipt. Woodland's changed stocks remain in the
  final authority; this tool does not timestamp individual woodland depletion.
  Command debits exclude autonomous repair spending; they are not total income.
  A sub-50 Food sample alone does not establish starvation, income loss or
  an otherwise available production choice.
- Retain expansion prices. Both Ember centers really pay 100 Food/400 Wood,
  complete around 12.7–13.3 minutes and survive. Depots precede them. Azure
  instead purchases/replants Farms and loses forward depots. This establishes
  use and exposure, not a causal expansion advantage or human incentive.
  Compare seat-swapped paid stay-home/expand choices with equal labor and
  observed travel, deposits, defenses and losses before changing rewards.
- Retain production costs/times. The 12-military and four-Worker peaks reflect
  the deterministic policy's explicit budgets, not the engine's growth limit.
  This baseline cannot qualify 250/500/1,000-unit empire growth. The pacing owner
  retains a paid growing-army human/independently qualified-opponent match;
  building-actions owner `01a107c9-0032` retains unlock/action additions.
- Retain defeat rules. Neither game supplies evidence that economy Skirmish
  victories happen too quickly. Historical faster AI receipts retain their own
  source and seeds; no new target match length is adopted from two games.

### Acceptance, dependencies and next step

| Outcome | Owner / next action | Current acceptance |
| --- | --- | --- |
| Source baseline and no-tune recommendation | Pacing/economy lane; retain this guide and the receipt, then compare matched paid expansion/growth choices | Both seed assignments exactly repeat. One completion and one non-completion are explicit; no gameplay tuning. |
| Unresolved Tiny completion cause | AI owner `01a10297-f025-755e-9d18-f42798d06037` consumes the retained terminal/trace in its existing [qualification queue](pve-policy-backlog.md); movement `01a107ba` retains U3/U4 routes/clearance | No policy/route cause or competence claim. Original completion ceiling retained. No duplicate qualification lane or authority patch. |
| Ordinary default entry/economy/recovery | Existing mode owner, consumed by pacing lane | Real supervisor/REST/WebSocket Tiny entry, paid House, Food deposit, cold process resume and rematch pass in the separate [native receipt](balance-evidence/tiny-pacing-2026-10-04/native-entry.json). This is not the full match above. |
| Release | Pacing lane; exact final-head clean pack and ordinary packed serving check | Evidence is recorded in the PR; the measurement tool is internal and does not ship as a gameplay binding. |
| Served/deployed/rendered match and human decisions | Existing staging delivery `01a10227-2c6d`, shared cloud renderer and pacing owner | This cloud's one normal-sandbox [capability probe](balance-evidence/tiny-pacing-2026-10-04/renderer-capability.json) is blocked by sandbox/storage. Zero game frames. No hosted dispatch, Mac execution or deployment; these outcomes remain incomplete. |

Reproduce with `node scripts/tiny-match-pacing.mjs /tmp/tiny-pacing` at the named
source. [Accepted raw game A](balance-evidence/tiny-pacing-2026-10-04/seeds-20260925-0.json.gz)
and [game B](balance-evidence/tiny-pacing-2026-10-04/seeds-0-20260925.json.gz) preserve
complete initial/final authority and timelines; the summary hashes refer to their
**decompressed JSON**. The original
[superseded measurement receipt](balance-evidence/tiny-pacing-2026-10-04/superseded-summary.json)
and [initial focused failure](balance-evidence/tiny-pacing-2026-10-04/initial-focused-failure.txt)
remain historical. Independent review found its `firstAttackTick` sampled a
three-tick peer receipt every thirty ticks and missed early attacks; those
first-attack values are invalid. The repaired field is observer-only durable
`firstNativeAttackObservedTick`, labeled at the one-second sample boundary.
The initial 45-second focused test also ended before both real recruits spawned;
the corrected 225-second test covers paid recruits and early durable attacks
without increasing a gameplay deadline. Final review and exact-head checks are
recorded in the PR, separately from the dated measurement source above.
Original full-game bytes are retained under
[superseded game A](balance-evidence/tiny-pacing-2026-10-04/superseded/seeds-20260925-0.json.gz)
and [superseded game B](balance-evidence/tiny-pacing-2026-10-04/superseded/seeds-0-20260925.json.gz);
their decompressed hashes match the superseded receipt, not the accepted one.
