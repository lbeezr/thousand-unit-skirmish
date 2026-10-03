# PvE last-slot Worker recovery — 3 October 2026

Baseline: fork `main` at `604912130aaeae9a6cb0adea4cca380305afae66`.
The existing deterministic opponent gathers, contests and retakes objectives,
scouts, repairs and expands its base, recruits counters and replaces losses.
Its production policy evaluated military population expansion before restoring
a depleted Worker economy. One free slot fits a Worker, but the military branch
requires two slots (three when acquiring siege). Without a builder or the House
wood reserve, that branch returned without considering legal Worker production.

The bounded fix evaluates the existing Worker-replacement decision first.
It still requires fewer than four living Workers, an available completed friendly
producer with an empty queue, at least 100 food (50 spent, 50 reserved), room in
the 24-unit policy roster, and the existing opening delay and rejection backoff.
An actually full population still needs a House. The military counter, capacity,
combat and gathering policies retain their existing rules.

## Authoritative fixed-tick reproduction

[`pve-worker-recovery.test.mjs`](../scripts/pve-worker-recovery.test.mjs) starts a
fogged 80 × 64 fixture with the ordinary 24-unit opening and 100 food / zero wood.
A validated checkpoint models the loss of all four Workers with two Riders,
two unlocked Siege Engines and four Infantry surviving on the tested seat:
14 used population out of 15, within the policy's current composition limits.
The Town Center's authoritative production option explicitly permits a Worker.
The enemy opening remains hidden. The other seat does not issue orders.

On the unchanged baseline, all six seat/seed cases fail: no Worker is queued
through tick 2,400, no Worker spawns and no wood is deposited. After the fix:

| Seat | Policy seeds | Worker queued | Worker spawned | First wood deposit | Bank after deposit |
| --- | --- | --- | --- | --- | --- |
| Azure | `0`, `20260925`, `4294967295` | 300 | 1,050 | 1,425 | 50 food / 10 wood |
| Ember | `0`, `20260925`, `4294967295` | 300 | 1,050 | 1,502 | 50 food / 10 wood |

Each case runs the complete fixture twice and compares the full command trace,
event ticks and deposit amount. Shadow policies also compare each decision.
Training uses the normal authoritative command dispatcher, spends exactly 50
food, reserves the final population slot and spawns a real Worker after 750 ticks.
The policy assigns it to the observed wood node; real movement, gathering,
cargo return and deposit replenish the bank. A validated checkpoint round trip
preserves the recovered Worker, resource balances, fog and population.

The original loss fixture used six Riders and two Infantry with the same
population. Review also checked the current-policy composition above: all six
seat/seed cases failed against the baseline production module and passed on the
fix with identical queue, spawn and deposit ticks. That composition is now the
permanent regression.

The test-only headless adapter replaces timers, socket listening and deferred
planning scheduling in a temporary server copy. Command, observation,
simulation and checkpoint function bodies remain intact. It changes no engine
code, observation fields, match prices, seat authority or shipped map.

## Checks and limits

```sh
node --test scripts/pve-worker-recovery.test.mjs scripts/population-ai.test.mjs scripts/siege-ai.test.mjs
node scripts/pve-production-scenario.mjs
node scripts/pve-barracks-recovery-scenario.mjs
node scripts/pve-decision-fairness-scenario.mjs
node scripts/pve-tactical-retry-scenario.mjs
node scripts/pve-reinforcement-recovery-scenario.mjs
```

All 40 combined tests and all five policy scenarios pass. The six additional
budget tests cover three-Worker recovery, exact food reserves, opening delay,
duplicate observations, rejected-order backoff, queued/full population, the
1,000 population ceiling, busy/blocked/destroyed/unfinished/foreign producers,
the four-Worker target, roster limit, visible siege demand and ordinary House
expansion. The new regression is registered in the full repository suite.

All three local `npm test -- --shard=N/3` runs passed at `b886728` (726 registered
checks, including release integration). That build includes queued-wall main
`cec4c89`. After integrating main `7d00942`, including finite Farm and Skiff,
the refined fixture and all 40 focused tests pass again at `861596c`, alongside
the five policy scenarios, documentation links and whitespace checks.
The earlier unsharded invocation was interrupted to integrate main
and run the documented shards; it is not counted as a full pass.

This is a deterministic local gameplay improvement after a checkpoint-injected
loss. It does not establish adversarial survival, human enjoyment, browser
usability, supported scale or deployed behavior. Hosted CI and full repository
check outcomes belong in the integration PR.
