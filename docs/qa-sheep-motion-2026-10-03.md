# Gentle Sheep motion — 3 October 2026

Owner: authoritative wildlife worker (`codex/sheep-grounded-wander-v1`), retaining
default integration, release inclusion and identified deployed-game verification.
The active Railway owner handles staging delivery under the standing authorization;
the shared [adoption ledger](asset-adoption-checklist.md) records deployment IDs.
The Sheep art owner (task `01a101a8-fba6-7323-a40c-27efd0112007`) owns articulated
walk/graze and carcass art. This slice uses existing eight-view static idle images.

## Outcome and contract

Normal Bellweather · Millrace's six neutral Sheep visibly change position and
heading without moving their food stock to another ID/cell. Speed is capped at
0.18 world units/second and displacement at 0.35 inside the authored cell.
Each step checks actual open land/building/wall/TC masks and swept 0.45-unit
living-unit/Sheep occupancy. Deterministic goals/waits consume no random stream.
Pending valid Worker Gather pins the current position, Stop releases it, and
harvest activation freezes carcass/depleted state. Gathering rights remain shared.

Disclosed fields: `x`/`z` world units, `wildlifeHeading` radians `[0,2π)` (zero +Z,
positive +X), live `wildlifeActivity: idle|grazing|wandering`. These contain no team
or claim state. Private schema24 checkpoint motion saves sequence, target,
wait ticks, activity and heading. Exact stationary23 migration preserves food and
cargo. Map definitions/hash/budget remain unchanged; rendering/picking/rings,
callouts, minimap and environment diagnostics use disclosed current coordinates.

## Acceptance evidence

- `node --test scripts/wildlife-motion.test.mjs`: continuous speed/radius/food,
  exact replay, Gather hold/release, frozen carcass/depletion, swept collision,
  unclamped cell bounds, exact legacy migration, corrupt motion and deep capture.
- `node scripts/sheep-motion-scenario.mjs`: real default map/two seats, no stock
  or position injection, changing motion/activity, hidden rows, mid-motion restart,
  saved tick replay, real Gather/Stop/Return cargo, interrupted cargo recovery,
  same-source food conservation and single credits. Total food stays 3,100.
- `node --test scripts/neutral-wildlife-renderer.test.mjs`: actual Three group
  translation and east-facing static pose, actual position for clicks/visibility,
  carcass coordinates, malformed/omitted rows hidden immediately.
- `node scripts/wildlife-render-scenario.mjs`: production HTTP art, eight views,
  harvest/depletion/restart/rematch with real state rows and Three meshes.
- `node scripts/millrace-sheep-scenario.mjs`: normal both-seat static-art attachment,
  natural harvesting/cargo, exact pre-Sheep stationary format migration, rematch
  and contradictory map rejection. No stock/cargo/bank replenishment.

## Delivery and appearance — incomplete

Source/release revision, review and package result are recorded in the focused PR.
The current motion revision has not yet been verified deployed. Merge alone does
not establish deployment or actual appearance. Native ordinary-game screenshots
remain incomplete: `/usr/bin/chromium` launched by the existing isolated browser
fixture aborts because its SUID sandbox helper is not configured correctly
(`setuid_sandbox_host.cc:166`; helper requires root ownership/mode4755). No sandbox
disable flag, credential or paid generation was used. CPU mesh and state checks
prove the binding/positions, not rendered ground contact or animal animation.

Next action: the wildlife owner verifies this merged revision's served release
and normal/default Millrace on an available sandboxed browser, recording deployment
ID, source hash, position changes and ordinary/strategic screenshots. The active
Railway owner delivers staging and records the deployed revision in the adoption
ledger; the art owner consumes the public heading/activity contract for actual
walking/grazing/carcass frames. Automatic proximity claiming, controllable herding
and a real ownership collar require the separate agreed ownership contract.
