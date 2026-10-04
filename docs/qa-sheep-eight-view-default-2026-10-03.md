# Eight approved Sheep views in the default game — 3 October 2026

This slice replaces the normal Sheep renderer's earlier one-view illustration
with the approved eight static producer captures. It builds on main `20c4fce`
and the integrated authored-pose runtime from [PR #69](https://github.com/lbeezr/thousand-unit-skirmish/pull/69).
The [pack](../assets/wildlife/bellweather-sheep-static-v1/README.md) is consumed
without a lab option, query flag or alternate preview loader. Existing default
Millrace Sheep retain their IDs, positions, stock and gameplay behavior.

## Source and registration evidence

The current Library resolved reference was downloaded by the supported native
file download after the unchanged transfer helper returned a generic download
failure. The native result was readable locally: 15,762,931 bytes, SHA-256
`5dbe4d4e7516126d3aaa2aa4f84fbd494f39674636962547d632a1afc957d881`.
Library metadata was applied by its supported helper. Eight original PNGs and
producer evidence were inspected; only the approved views and required source
contract enter this public pack. Full model/source bundles were never fetched.
The user's explicit public-image approval is recorded in
[source admission](../assets/wildlife/bellweather-sheep-static-v1/source-admission.json).

All eight decoded images are 512×512 RGBA, alpha 0–255, with complete uncropped
animal silhouettes and no visible floor or baked contact shadow. Nose/body
offset is approximately 42.035°. Camera, normalization, bounds, root and yaw
labels match the producer contract. The common canvas root stays `[256,256]`
at 256 px/world unit across all eight views; no per-view fit, scale compensation,
mirroring or new animation was introduced. This fixed-camera production scale
differs from the older estimated illustration and needs actual game appearance
review beside a Worker.

The [readiness report](qa-evidence/sheep-eight-view-default-2026-10-03/readiness.json)
reports eight readable original views, decoded source/runtime alpha acceptance,
original-to-source RGBA equality and unchanged visible runtime RGB. Its
`liveDirectionalIntegration: false` field means that this offline checker does
not establish game integration; the independent game scenarios below do.
Pixel integrity and visual acceptance are separate claims.

## Game and package checks

On Linux, Node 24.19, the focused suite passes 28 checks, including both the
historical one-view fallback and the actual admitted eight-view pack. The new
`sheep-eight-view-runtime.test.mjs` exercises the default registry/loader with
real atlas bytes, eight simultaneous immutable UVs, omitted-pose north reuse,
shared texture/material, common projected root at the normal camera, stable
reset order, fog/omitted rows, carcass/depleted suppression, resource disposal
and corrupt-atlas proxy fallback. It does not run WebGL.

`wildlife-render-scenario.mjs` publishes the
[eight-direction game map](qa-evidence/sheep-eight-view-default-2026-10-03/game-map.json)
to a real room worker through HTTP/WebSocket, attaches the verified atlas to
actual Three scene meshes, rejects three invalid yaw values, proves all eight
views and a shared north companion, hides undisclosed Sheep, gathers naturally
through alive/carcass/depleted, restarts without resurrection, preserves authored
pose, and restores live art on rematch. These are normal game map/snapshot paths.

`millrace-sheep-scenario.mjs` starts with the worker's default map and no map
publication. Both seats have their actual opening Sheep attached to the
2048×1024 texture. Natural harvest/cargo delivery, old-map save migration,
food conservation, restart and rematch still pass. No default map/balance was
changed by this slice.

`railway-release-scenario.mjs` verifies the packaged binding and manifest hashes,
eight directions, no animations and 2048×1024 page. Exactly three Sheep runtime
files enter the release. Seven source/model/metadata URLs return 404 in the real
worker scenario. This is local packaging evidence, not a deployment claim.

## Native game appearance still pending

`node scripts/browser-preflight.mjs --launch` returned `unsupported`, zero
screenshots, `sandbox-unavailable` and `storage-unavailable`. No sandbox bypass
or security change was used. Fresh game ground contact, Worker-relative scale,
strategic-zoom recognition and foreground occlusion are therefore unverified.
Earlier Mac captures show the historical one-view binding and cannot accept
this different eight-view pack.

The existing Mac QA route needs the integrated head and the normal game:

1. Start a normal Bellweather · Millrace match. Capture a home Sheep beside its
   Worker at ordinary and strategic zoom, then close enough to inspect hooves.
2. Import the linked game-map JSON in Map Studio and play it. Seat 0's opening
   view contains all eight yaw poses and a separate north companion. Capture
   all poses at the fixed oblique camera, checking common ground-root contact,
   alpha edges and shape/scale consistency. Walk a Worker in front of and behind
   the Sheep; use an authored foreground obstacle if testing tree occlusion.
3. Gather `visible-sheep` (3.5 test food) and capture its food-cache marker and
   depletion. Check undisclosed `hidden-sheep` stays absent, then rematch and
   verify the live sprite returns.

Record the exact head, viewport, zoom, map and readable image artifact IDs/bytes.
Any registration or depth defect should be fixed in this default path. These
are static idle captures: walk, graze, dispatch and animal carcass/depletion
animations remain absent; the high-poly source model remains outside runtime.
