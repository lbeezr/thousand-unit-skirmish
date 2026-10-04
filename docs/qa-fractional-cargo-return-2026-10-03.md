# Fractional final cargo remains actionable — 3 October 2026

Source baseline: fork `lbeezr/thousand-unit-skirmish` main
`edf93b3dd07d7a578e72c4d19f9c9e92e2f1d12a`.

## Observation and correction

An independent production-code probe published a valid `0.004`-food Sheep, gathered
it naturally, stopped the carrying Worker and restarted from its checkpoint.
Authoritative cargo remained `0.004`, while unit row index 6 was rounded to zero.
The production Return cargo control sent no order and displayed
`SELECT YOUR CARRYING WORKERS`. A direct authenticated order for that same Worker
deposited exactly `0.004`, isolating the failure to the snapshot/control boundary.

`snapshotUnits` now preserves the authoritative positive cargo only when its usual
two-decimal rounding would yield zero. All other cargo values retain that existing
rounding; exact zero remains zero. Existing food/wood amounts, ownership,
generation validation, fog filtering, command fields and checkpoint schema are
unchanged. No new animal behavior, art or shipped map-stock change is included.

## Executed checks

`node --test scripts/return-cargo.test.mjs` passes nine groups. Both seats exercise
the actual snapshot serializer and production Return cargo control across food
and wood, zero, `Number.MIN_VALUE`, `0.000001`, `0.004`, `0.004999`, `0.005`,
ordinary fractional and full-capacity cargo. Hidden enemy rows stay absent.

`node scripts/fractional-cargo-return-scenario.mjs` passes with a disposable real
server and two authenticated WebSocket seats. Its map has two tiny Sheep stocks
for precision testing, with no runtime food, unit or position injection. Workers
move to reveal their Sheep normally, gather them, Stop, and retain `0.004` each.
The production `appendUnitFromState`, `selectedIds`, `issueReturnCargo`,
`sendTrackedOrder` and `sendCommand` functions consume those real snapshots.
Before recovery their control emits the correct command in a dry-run socket;
after recovery the same production path transmits it to the actual server.

Both orders are accepted with their real unit generations, both food banks reach
exactly `0.004`, and both Sheep remain depleted. Empty Gather and duplicate Return
cargo reject. A further restart preserves `[0.004, 0.004]` with no double credit.
All `0.008` authored food remains in stock, cargo or banks throughout. Lost-cargo
and duplicate-credit negative controls fail that conservation assertion.

The scenario's `--reproduce-only` mode asserts the original disabled-control
behavior before and after recovery when copied into the baseline checkout.
It is intentionally expected to fail on the corrected server.

## Limits

This is server/WebSocket and production-client CPU evidence. Rendering and audio
callbacks are stubbed in the client harness; no native browser appearance or
hosted deployment is claimed. Tiny stocks are test values, not animal balance.
The [gameplay contract](gameplay-command-observation-contract.md#state-consumed-by-rendering)
owns the transport rule; [Sheep guide](wildlife-bellweather-sheep.md) owns its food loop.
