# XL visibility index and bounded cache — 4 October 2026

The original design was reviewed in [PR252](https://github.com/lbeezr/thousand-unit-skirmish/pull/252). Keep the current 256-side server/editor/wall/water/catalog
bound until correctness and native/browser budgets are accepted. Source reference:
`server.mjs:markVisionFrom`, `updateVisionMasks`, `ensureVisionMasks`; the preceding cache was one Map per
visited source cell, keyed by requested sight, with 16-bit coverage indices. Merely widening the
validator was invalid. The [runtime increment](qa-xl-visibility-runtime-2026-10-04.md) now integrates
bounded 32-bit coverage under unchanged 256 admission. It is a prerequisite, not ordinary XL completion.

## Data contract implemented under the existing admission limit

Use `Uint32Array` for both current-visible and explored-forest-fringe absolute indices on every map. Validate each computed cell as an
integer in `[0, width*height)`. Path/visibility consumers remain absolute grid indices. The proposal
supports at most 320 per axis; do not infer unbounded larger grids. Boundary tests cover 65535,
65536, 102399 and an invalid 102400, including 320 × 160 rectangles and the final row/column. The
current 16-bit Manhattan heuristic still fits 320 (max 63,800); 384 would need separate treatment.

Replace the per-cell unbounded Maps with one room-owned cache keyed by numeric `sourceCell*17 +
sight`. Current requested sights are 8/10/11 (effective raised radius 9/11/12), but the rules registry
accepts 1–16. Stride 17 preserves that full contract without collisions; the original stride-16
sketch would collide for sight 16. Key validation rejects unsupported sight and invalid source cells. Geometry and rules identity belong to a cache generation
rather than being silently omitted from the key. A rebuild/reset creates a fresh cache object,
preserving the existing `ensureVisionMasks` identity check, and increments an explicit geometry
generation. Every geometry invalidation must replace that cache object; clearing
the same object alone is forbidden because a same-tick snapshot would otherwise
reuse stale visible masks. LRU hits and evictions leave geometry generation
unchanged. No cache state is serialized into durable checkpoints.

Cache limits: **8MiB live typed-array payload and 8,192 entries per room**, both enforced before
insertion. Cache entries own exact-length Uint32 backing buffers, with zero byte
offset and `coverage.byteLength === coverage.buffer.byteLength`; copy a foreign
subarray before retention so a short view cannot hide a larger retained buffer.
Count exact `visible.byteLength + fringe.byteLength`, not index count or an average. Both buffers
are copied before retention, even overlapping views into a larger foreign buffer. A cache hit moves its
entry to the end of insertion order. On insertion, evict oldest entries until both prospective
bounds fit; add/replace/remove/clear maintain exact accounting. Eviction ordering uses access
sequence, not wall-clock time. A single entry larger than the payload cap is returned for that
computation without retention. Temporary miss arrays, garbage pending collection and JS Map/ray
metadata are outside the payload bound; measure RSS/heap/arrayBuffers rather than advertising 8 MiB
as total room memory. An entry cap separately bounds object/key overhead.

The widest current raised radius 12 contains 441 cells on unobstructed interior ground, so one
combined Uint32 visible/fringe payload is at most 1,764 bytes: every ray target enters at most one
of visible or forest candidates, and fringe is a subset of the latter. All 102,400 sources at all current sight values could
otherwise retain 438,681,600 bytes (about 418 MiB). The proposed live payload cap is 8,388,608
bytes; cells that become relevant again are recomputed. The cache remains an optimization: an
eviction must never change either seat's visible/explored masks or authoritative simulation
behavior. A crowded city may thrash; limits require measured hit/miss and recomputation cost before
acceptance.

## Invalidation boundary

Preserve each current whole-cache invalidation site for map activation, resetForestStocks,
progressive forest depletion, building footprint addition/removal, destruction/cancellation and
wall/gate changes. Replace the cache object on every visibility blocker/height mutation, including
geometry changes between ticks. Add tests around the existing
`visionMasksUpdatedTick`/cache-identity condition so a same-tick build/forest change cannot reuse a
stale mask. Requested sight, source ground elevation, map dimensions and vision rules are covered by
the key/generation. Economic stock changes that do not alter geometry must not spuriously clear it.

The cache is shared only for identical terrain coverage; `visibleCellsByTeam`, `exploredCellsByTeam`
and processed source masks stay per seat. A cache hit must not expose another seat's processed
sources, explored fog or private units/resources/buildings. Cold recovery restores exploration state
but rebuilds coverage; reset restores new initial fog. Legacy compact checkpoints remain canonical
and are not remapped.

## Observable acceptance and remaining ordinary XL gates

Pure tests compare cached versus uncached coverage for boundaries, rectangular maps,
cliffs/forests/buildings/gates, high-ground bonus and all requested sights. Test exact accounting on
replacement/hit/eviction/clear, a zero/one-entry cache, an entry larger than the byte cap, and long
sweeps that remain within both caps. Deterministic identical event sequences yield identical
coverage and eviction outcomes.

Native tests use explicit internal invalidation fixtures under 256 first, with both-seat privacy
checks and untouched cold checkpoints; widening all admission paths follows only in the same
reviewed shared-contract slice. Run fog-enabled open/elevated/forest/water 320 fixtures at
24/250/500/1,000 actors, with 2,000 diagnostic, three route waves, paid construction/forest cutting,
failed goals and reconnect/reset. Record peak/cache resident payload, entry count,
hit/miss/evictions/clear reasons, covered indices/rebuild time, per-tick vision cost, tick/start-lag
p95/max/skips, RSS/heap/arrayBuffers, checkpoint and compressed egress. Retain cold and
post-eviction windows, not just warm steady state. Existing tick diagnostics remain p95 ≤33.333 ms
and max ≤100 ms.

Separately bound route storage/work and checkpoint size, then perform renderer/minimap/picking and
two-seat use on named browser hardware and hosting/network budgets. The 512 MiB harness probe stop
is not a supported memory budget. Ordinary Medium 224 and Large 256 source maps can continue before
this future XL slice; quick custom modes and a massive Risk world remain separate products.

Owner boundary: map-scale stream now owns the integrated visibility prerequisite and its
[acceptance record](qa-xl-visibility-runtime-2026-10-04.md). Forest discovery semantics stay with
the forest/visibility owner ([PR297](https://github.com/lbeezr/thousand-unit-skirmish/pull/297));
the integration changes only its index width. Runtime/path owner retains route storage/work and
planner/scheduler decisions ([PR285](https://github.com/lbeezr/thousand-unit-skirmish/pull/285)).
Controlled performance and rendered ordinary-game acceptance remain with their active testing
owners; no limit, speed, cell size, scheduler budget or permissions change is made here.
