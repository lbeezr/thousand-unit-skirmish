# XL visibility index and cache design proposal — 4 October 2026

This is a separate future runtime slice. Keep the current 256-side server/editor/wall/water/catalog
bound until correctness and native/browser budgets are accepted. Source reference:
`server.mjs:markVisionFrom`, `updateVisionMasks`, `ensureVisionMasks`; current cache is one Map per
visited source cell, keyed by the requested sight. Cells at/above 65536 wrap in
`Uint16Array.from(cells)`; merely widening the validator is invalid.

## Proposed data contract

Use `Uint32Array` for covered absolute cell indices on every map. Validate each computed cell as an
integer in `[0, width*height)`. Path/visibility consumers remain absolute grid indices. The proposal
supports at most 320 per axis; do not infer unbounded larger grids. Boundary tests cover 65535,
65536, 102399 and an invalid 102400, including 320 × 160 rectangles and the final row/column. The
current 16-bit Manhattan heuristic still fits 320 (max63,800); 384 would need separate treatment.

Replace the per-cell unbounded Maps with one room-owned cache keyed by numeric `sourceCell*16 +
sight` (current requested sights 8/10/11; effective raised radius 9/11/12). Key validation rejects
unsupported sight and invalid source cells. Geometry and rules identity belong to a cache generation
rather than being silently omitted from the key. A rebuild/reset creates a fresh cache object,
preserving the existing `ensureVisionMasks` identity check, and increments an explicit geometry
generation. No cache state is serialized into durable checkpoints.

Cache limits: **8MiB live typed-array payload and 8,192 entries per room**, both enforced before
insertion. Count exact `coverage.byteLength`, not index count or an average. A cache hit moves its
entry to the end of insertion order. On insertion, evict oldest entries until both prospective
bounds fit; add/replace/remove/clear maintain exact accounting. Eviction ordering uses access
sequence, not wall-clock time. A single entry larger than the payload cap is returned for that
computation without retention. Temporary miss arrays, garbage pending collection and JS Map/ray
metadata are outside the payload bound; measure RSS/heap/arrayBuffers rather than advertising 8 MiB
as total room memory. An entry cap separately bounds object/key overhead.

The widest current raised radius 12 contains 441 cells on unobstructed interior ground, so one
Uint32 payload is at most 1,764 bytes. All 102,400 sources at all current sight values could
otherwise retain 438,681,600 bytes (about 418 MiB). The proposed live payload cap is 8,388,608
bytes; cells that become relevant again are recomputed. The cache remains an optimization: an
eviction must never change either seat's visible/explored masks or authoritative simulation
behavior. A crowded city may thrash; limits require measured hit/miss and recomputation cost before
acceptance.

## Invalidation boundary

Preserve each current whole-cache invalidation site for map activation, resetForestStocks,
progressive forest depletion, building footprint addition/removal, destruction/cancellation and
wall/gate changes. The replacement must clear on every visibility blocker/height mutation, including
geometry changes between ticks. Add tests around the existing
`visionMasksUpdatedTick`/cache-identity condition so a same-tick build/forest change cannot reuse a
stale mask. Requested sight, source ground elevation, map dimensions and vision rules are covered by
the key/generation. Economic stock changes that do not alter geometry must not spuriously clear it.

The cache is shared only for identical terrain coverage; `visibleCellsByTeam`, `exploredCellsByTeam`
and processed source masks stay per seat. A cache hit must not expose another seat's processed
sources, explored fog or private units/resources/buildings. Cold recovery restores exploration state
but rebuilds coverage; reset restores new initial fog. Legacy compact checkpoints remain canonical
and are not remapped.

## Observable acceptance for the separate implementation PR

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

Owner boundary: map-scale stream authors the design and fixture contracts. Runtime/path owner
retains the eventual server cache integration and scheduler/performance changes. No hotspot code,
limit, speed or permissions change is made by this proposal.
