# Simulation timing

[Documentation index](README.md) · [Architecture](architecture.md)

## Fixed-step policy

The server targets 30 simulation ticks per second. Each timer callback advances
exactly one fixed step. Monotonic deadlines determine the next callback.

After an event-loop stall or overlong tick, the scheduler skips elapsed
wall-clock slots. It does not replay missed ticks in a burst. Movement, combat,
and scenario clocks therefore slow relative to wall time during overload.

## Diagnostics and check

`/health.tickTiming.scheduler` reports the policy, cumulative skipped slots,
and the count/tick of the most recent overload. Start-lag samples report callback
delay separately from simulation work.

With `RTS_TICK_DIAGNOSTICS=1`, `/health?tickSamples=1` also returns the retained
raw complete-tick rows in chronological order. The ring holds up to 300 ticks;
collect more often than once per ten simulation seconds and deduplicate by tick
when measuring a longer interval. Ordinary `/health` responses omit raw rows.
Detailed diagnostics disabled means the query adds no raw rows. These costs
include synchronous outer-tick work; asynchronous checkpoint writes and default
callback planner work remain outside that duration. See the
[paid battle qualification](qa-paid-battle-tick-budget-2026-10-04.md) for exact
checkpoint boundaries, failed budget evidence and measurement limits.

```sh
node scripts/simulation-scheduler-test.mjs
```

The test covers normal cadence, an injected 150 ms stall, and the boundary that
prevents immediate catch-up. See `simulation-scheduler.mjs` for the scheduling
helper and `server.mjs` for the simulation loop.
