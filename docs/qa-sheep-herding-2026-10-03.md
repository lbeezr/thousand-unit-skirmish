# Sheep Herd authority — 3 October 2026

Owner: wildlife worker, branch `codex/sheep-herding-authority-v1`, retaining
integration, client entry, packaging and identified deployed game acceptance.

## Implemented authority boundary

Existing finite food nodes accept owner-only `herd` and `stopWildlife` commands
with current resource/forest epoch and order acknowledgement. Source and exact
unsnapped destination require current sight and legal bounded land. Existing
cardinal navigation, terrain/elevation/corner checks and swept actor occupancy
control 0.6-unit/second travel. No new pathfinder, army entity, sight, food,
population, reproduction or currency is added.

Stop, accepted shared Gather, recapture, harvest and depletion cancel at actual
position. A persisted local anchor prevents return to authored position after
arrival/cancellation. Shared food rights remain unchanged. Current positive
food reserves current construction/spawn/rally/gate cells; exact zero releases
them, while unknown runtime stock remains conservatively reserved.
Schema 27 deep-copies private anchor/herd/path. Compatible schema 26 live motion
retains its authored anchor and frozen motion retains current pose, without
changing claims, stock, cargo or banks. Malformed current fields reject.

## Checks

Pure Herd tests cover both seats, admission before navigation, route/bounds,
speed/turn budgets, cancellation, food immutability and checkpoint shape.
Actual server replay and real two-seat WebSocket scenarios prove commands and
recovery; their final results and reviewed commit are recorded in the focused
PR. Existing default motion/claims/food regression paths remain required.

At source `efa8001ed94bb61c31be2b099801068e2c0f1f82` (server SHA256
`9865f37ce1f2aba9d4a8ae8ba77d3eed5f66ecfe0dc7ff6528efe44d7d4faa07`),
the production-body authority replay passes all nine cases, including an
occupied open gate, exact continuation after deep-copy recovery, hidden-source
and retired-epoch rejection, both-seat shared Gather cancellation and strict
schema 26 migration. The real WebSocket scenario passes three recoveries,
natural claims, multi-cell travel, Stop/recapture/Gather cancellation and paid
construction on the vacated cell. All 8.5 harvested food is returned once;
the hidden 100-food Sheep remains untouched. These are authority checks;
they do not assert ordinary client controls or rendered appearance.

## Remaining player outcome

Server protocol is ready for the active HUD owner through the
[Sheep guide](wildlife-bellweather-sheep.md) and
[HUD backlog](hud-controls-backlog.md). Ordinary selection/order binding and
cross-cell renderer/minimap/build-preview/AI disclosure require shared-interface
agreement before overlapping edits. Current renderer authored-radius validation
still suppresses relocated Sheep; no moved-Sheep game appearance is claimed.
The active Sheep art owner (task `01a101a8-fba6-7323-a40c-27efd0112007`) owns
walk/graze/carcass/collar production and binding. Static/marker fallbacks remain.

Wildlife worker retains ordinary Herd/Gather/Stop/reclaim acceptance. Active
Railway owner owns staging delivery, with exact deployed/source revisions in
the adoption ledger. Native browser screenshots are unavailable because this
executor's Chromium SUID sandbox helper is not configured; no sandbox bypass
or direct deployment is authorized or used. Source merge/package does not
close client entry, appearance, or deployed runtime acceptance.
