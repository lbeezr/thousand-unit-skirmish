# Skirmish balance

[Documentation index](README.md) · [Forked Vale](forked-vale-scenario.md) · [QA protocol](qa-vertical-slice.md)

## Current tuning decision

Keep unit stats, production costs, and objective rewards as the current baseline
until contested, seat-swapped player matches support a change. Existing scripts
check fairness and opening mechanics; they do not establish human win rates.

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
