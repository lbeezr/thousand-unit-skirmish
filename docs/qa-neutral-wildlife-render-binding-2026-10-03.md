# Neutral Sheep render binding — 3 October 2026

Baseline: fork main `c1faf60` (including villager-facing PR #36 and wall planner
PR #37). [Renderer](../src/neutral-wildlife-renderer.mjs) owns separate neutral
scene groups; the match client has limited resource build/snapshot/picking hooks.
Unit heading math, HUD layout, environment art, gathering rules and deployments
are unchanged by this slice.

## Inspect in a disposable match

Run `npm start`, join Azure, open Map Studio, **Import JSON** from this
[preview map](qa-evidence/neutral-wildlife-render-2026-10-03/preview-map.json), then
**Save & Play Map**. The visible Sheep at `(-15, 6)` is a stationary public
illustration. Order a Worker to gather it: activation replaces the animal with
a low food-cache marker; exhaustion removes that marker and resource picking.
Reset the match to restore the live Sheep. The second Sheep remains hidden until
its cell is currently visible. Ordinary food remains berries. Fixture stock and
placement do not establish balance or a shipped ecology map.

## State and art contract

| Authoritative state | Client presentation |
| --- | --- |
| `alive`, full authored stock | Verified public one-view static illustration; cream geometric Sheep proxy if loading fails. |
| `carcass`, positive remaining stock | Separate low neutral food-cache marker; live art is hidden immediately. |
| `depleted`, zero stock | Animal, marker, resource ring, callout, minimap marker and resource picking suppressed. |
| Fogged, omitted, duplicate or inconsistent snapshot | Hidden; no authored-stock assumption or remembered animal. |

Only a validated authored `food` node with `wildlifeSpecies: "bellweather-sheep"`
and a matching authoritative snapshot is admitted. Coordinates and starting stock
come from the map; lifecycle and remaining stock come from the room worker.
Current fog visibility is checked by the match client in addition to server-side
snapshot omission. There is no unit ID, movement, animation clock, team tint,
combat target or heading input for this stationary animal.

The fixed illustration requests the one approximate `north` idle reference.
It is one fixed pose, not an eight-direction lookup or a substitute for an absent
walking/grazing/dispatch/carcass clip. The registry leaves animation absent and
does not modify villager facings. Atlas texture/material/geometry are shared
between live Sheep meshes; the loader verifies manifest and PNG SHA-256.
Map switches dispose old neutral groups. A late texture load cannot restore a
carcass or depleted animal.

## Validation and limits

`node --test scripts/neutral-wildlife-renderer.test.mjs` covers consistent
species/stock/lifecycle, immediate fog/omission suppression, duplicate IDs,
distinct proxies, late loading, failed decoding, rematch and disposal.
`node scripts/wildlife-render-scenario.mjs` starts a disposable real worker,
publishes the delivered preview map, loads the actual PNG through the production
HTTP routes and CPU-decodes it, attaches the verified texture to real Three.js
scene meshes, and drives alive/carcass/depleted/rematch through real seat snapshots
and gathering. It also verifies six required module/art URLs return 200 and five
non-runtime/source paths return 404. The complete client import graph passes its
existing static allowlist check. Villager-facing regression tests remain green.
The current shore-fishing integration retains its separate placeholder and
excludes both fish and Sheep from berry batches. Docker COPY/context entries
include exactly the public binding, manifest and runtime PNG. The existing
release-package scenario verifies their HTTP availability and SHA-256 through
the local room supervisor and excludes all original/source/GLB Sheep files.

This is CPU, byte and live snapshot evidence. Chromium's existing SUID sandbox
configuration still prevents a sandboxed browser launch; no WebGL screenshot,
ground-contact acceptance or play/strategic-zoom readability is claimed. The
[original preview evidence](qa-bellweather-sheep-static-preview-2026-10-03.md)
records that failure and the directly inspected source/cutout pixels.

The single image remains an estimated, uncalibrated appearance trial. Its
already-public provenance and preserved originals are unchanged. The eight private
Library views still have no readable local bytes: the supported helper failed with
`Tunnel connection failed: 403 Forbidden`. Permission to publish those views is
pending separately. This change publishes none of them, admits no 44 MiB GLB,
starts no rigging/paid job, and supplies no new atlas or carcass art.
