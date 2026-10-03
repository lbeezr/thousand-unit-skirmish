# Interrupted final cargo delivery — 3 October 2026

The original observation was reproduced at build
`218e53cfba6041ba8fe247bcde302fbda495541c` on the open-field-derived
`interrupted-sheep-cargo-proof` map: eight starting units, fog disabled, no
starting food/wood and one Bellweather Sheep at `(-12, 6)` with `0.5` food.
Gather depleted it; Stop left Azure Worker 0 idle carrying all `0.5` food.
Another Gather rejected `RESOURCE NODE EMPTY`. Restart recovered the idle
carrier and zero bank, leaving no player order to deliver this last food.

The exact authored fixture remains runnable with
`node scripts/interrupted-cargo-return-scenario.mjs --reproduce-only`. Its
historical build field identifies the original observation; run it from that
build to repeat the failure. The ordinary scenario adds the symmetric Ember
Sheep at `(12, 6)` and checks the fixed path with both seats.

The fix exposes **Return cargo** for selected carrying workers. The server
validates own living gather-capable units and generation metadata, prevalidates
the existing compatible owned completed drop-off route, and replaces previous
intent only for accepted carriers. It sets a source-free `to-base` intent in
existing checkpoint fields; arrival moves cargo to the existing resource bank
and leaves the worker idle. Depleted and unknown nodes remain invalid Gather
targets. No sheep stock or lifecycle is restored by the new command.

Validation commands:

- `node --test scripts/return-cargo.test.mjs scripts/contextual-hud.test.mjs`
- `node scripts/interrupted-cargo-return-scenario.mjs`
- `node scripts/interrupted-cargo-return-scenario.mjs --reproduce-only`

The real-server scenario stops both final carriers, checks depleted and stale
Gather rejection, restarts while stopped, rejects foreign workers/stale
generations/node-bearing return commands, sends duplicate valid return orders,
and restarts during delivery. Each seat banks exactly `0.5` food and each worker
empties its cargo. Repeated return commands after arrival reject; another
restart preserves `[0.5, 0.5]` banks and depleted sheep. At every boundary,
authored food equals remaining stock plus both banks and carried food; deliberate
lost-cargo and duplicate-credit negative controls fail that assertion.

Authority tests also exercise existing drop-off helpers against foreign,
unfinished, incompatible, unreachable and destroyed buildings. A rejected route
leaves the prior worker order untouched; destruction/replanning preserves cargo
until a valid arrival. DOM tests click the actual contextual action for both
seats, check selection visibility and match-end disabling, and verify generation
metadata and applied-order feedback. Native browser rendering is outside this
economy/recovery slice.

A later [queued delivery regression](qa-queued-cargo-return-2026-10-03.md)
preserves this command's authority and conservation contract while allowing its
accepted Shift ground waypoints to continue after deposit. The original
interrupted-delivery measurements above remain specific to their recorded build.
