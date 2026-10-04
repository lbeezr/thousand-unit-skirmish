# Bounded visibility prerequisite for XL — 4 October 2026

[XL contract](map-xl-visibility-design.md) · [Tier policy](map-size-tiers.md) ·
[Current cost audit](../scripts/map-grid-cost-audit.mjs) · [Map backlog](map-scale-playability-backlog.md)

The map-size owner integrates the first XL runtime prerequisite: the existing authority now uses
32-bit visible and forest-fringe indices and one room-private deterministic LRU cache. All seven
geometry invalidations replace the object and advance its generation, preserving same-tick mask
refresh. No map, cell size, speed, planner/scheduler budget, checkpoint schema, private snapshot
field, ordinary default or admission limit changes. Tiny 160, Small 192, Medium 224 and Large 256
retain their current behavior; **XL 320 remains unavailable**.

The cache retains at most **8,388,608 exact owned typed-array bytes and 8,192 entries**. Both visible
and fringe buffers count; all retained buffers have exact size and zero offset. Temporary miss
arrays, garbage pending collection, JS metadata and ray geometry are excluded. This is a retained
payload bound, not total room memory or a performance claim. Requested sights 1–16 use stride 17,
correcting the stride-16 sketch in PR252. Seat masks remain distinct; cache contents are derived
geometry and never enter saves, network snapshots or HTTP admission.

The pure private helper belongs to the server domain because it owns an authoritative room's
derived cache. Runtime import guards exclude it from browser closures; the actual packed release
scenario tests its file inclusion and authenticated GET/HEAD denial. This adds no broad private
source exception or client allowlist entry.

## Repeatable checks

Run `node scripts/ci.mjs --list` first. New cache and cost tests are imported by the existing
registered forest/fog test; the active central CI registry is unchanged.

```sh
node --test scripts/fog-checkpoint-boundary.test.mjs scripts/fog-checkpoint-forest.test.mjs scripts/fog-checkpoint-reinforcement.test.mjs scripts/watchtower-targeting.test.mjs scripts/tick-attribution.test.mjs scripts/economy-server.test.mjs scripts/palisade-gate.test.mjs scripts/depleted-resource-construction.test.mjs scripts/check-runtime-imports.test.mjs scripts/map-size-policy.test.mjs
node scripts/map-grid-cost-audit.mjs > /tmp/xl-grid-cost.json
npm run architecture:check
npm run check:types
npm run docs:check
node scripts/client-asset-allowlist-scenario.mjs
node scripts/railway-release-scenario.mjs
```

Cache tests cover indices 65535/65536/102399 and reject invalid 102400 before conversion, including
320×160 and last-row/column geometry. They count both buffers, copy overlapping foreign subarrays,
exercise zero/one-entry and oversized uncached results, atomic invalid replacement, deterministic
LRU hit/eviction/delete/clear, and independently fill both default bounds with 12,000 sources.
Actual source-copy `markVisionFrom` on 320 geometry avoids wrapping current/explored masks; this
does not admit a 320 room. Current-visible masks match frozen preceding LOS code across compact,
160/192/224/256 edges, all registry boundary/current sights, high ground, forests, rocks and building
occlusion. Forced eviction and disabled retention produce identical visible/explored masks.

The same-tick negative control clears the original cache object and observes stale masks; actual
geometry replacement refreshes them. Existing authority fixtures carry both-seat paid foundations,
forest clearing, cold recovery and rematch. Paid foundation tests record actual cache generations,
payload and rebuilt metrics without saving cache state. Native forest cases preserve hidden unit,
stock and targeting privacy through real WS clients, untouched disk checkpoints and a new process.
The disposable tick-attribution adapter reads cache metrics before/after each captured tick; its
inspection does not promote entries, increment gameplay cache counters or change authority bodies.

Exact review/source/package evidence belongs in the owning PR record. CPU and source-copy checks
are not rendered acceptance, and packed serving is not deployed identity.

## Remaining ordinary XL outcome

Map-size owner retains a real ordinary 320 map and integrated admission. Runtime/path owner must
first bound route work/storage and checkpoint/transport size; all server/editor/wall/water/catalog
limits must move coherently in the subsequent reviewed slice. It must preserve old map/save/reset
contracts and avoid silently shrinking a selection. The map should provide useful home campuses,
five candidate expansion sites per seat, separated main passes and flanks, with the tier's measured
105–125-second Worker route target assessed under actual game/wall clocks. Do not derive stocks or
speed changes by multiplying area.

Performance owner must run fog-enabled open/elevated/forest/water workloads at 24/250/500/1,000
actors, with 2,000 diagnostic, three route waves, paid city/cutting/combat, failed goals, reconnect,
cold restart and reset. Record cold and post-eviction cache windows, tick/start-lag p95/max/skips,
vision cost, RSS/heap/arrayBuffers, save size/cost and compressed egress. Existing diagnostic budgets
remain unchanged; supported capacities remain unverified. Cloud renderer/testing owner retains
ordinary 320 minimap, terrain, picking and two-seat rendered use on identified hardware/release.
No new art, paid runner, stopped Mac workload, security bypass or preview-only delivery is required.
