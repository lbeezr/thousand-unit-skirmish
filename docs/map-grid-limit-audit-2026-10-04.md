# Grid limit and XL 320 proposal — 4 October 2026

[Tier policy](map-size-tiers.md) · [Repeatable source-bound audit](../scripts/map-grid-cost-audit.mjs) · [Capacity harness](../scripts/map-capacity-scenario.mjs)

**Keep the 256 limit. XL 320 is not admitted.** The current server, editor/input
controls, wall-line planner and water-route graph independently cap either axis
at 256. The ordinary size policy also excludes larger maps. Updating only the
server comparison would leave these other paths inconsistent.

There is a correctness reason for the bound: `server.mjs:markVisionFrom` stores
covered cell indices using `Uint16Array.from(cells)`. A 256² grid ends at 65535;
a 320² grid ends at 102399, which becomes 36863 under that storage. Cells 65536+
can mark unrelated northern cells visible/explored. The repeatable witness tests
the actual numeric conversion without loading an invalid map. The native harness
also verifies rejection of 257×256,256×257 and 320×320, acceptance of 256×256,
and unchanged active-map identity after rejection.

Path indices, predecessors and queue slots use 32-bit arrays. The separate 16-bit
Manhattan heuristic stores 100 times distance: maximum 51000 at 256 and 63800 at 320
still fit, but 76600 at 384 would wrap. Do not mistake this safe 320 heuristic for
safe 320 vision or infer an unlimited larger-grid contract.

## Bounded cost accounting

The CLI records exact source/hash provenance and derives allocation counts from
the current map-activation source. Its fixed array model is 66 bytes/cell plus 32
bytes/spatial bucket (1.2-unit bucket side). This is a **partial resident array
count**, excluding JS state/caches, catalog, unit routes, water grids, temporary
validation/component queues, runtime/allocator overhead and renderer/GPU memory.

| Cost | Small 192 | Current max 256 | Proposed XL 320 |
| --- | ---: | ---: | ---: |
| Cells |36,864|65,536|102,400|
| Resident array model, bytes |3,252,224|5,777,184|9,039,648|
| Eight cached attack-flow grids, bytes |1,179,648|2,097,152|3,276,800|
| Packed fog bytes/seat/snapshot |9,216|16,384|25,600|
| Fog base 64 chars/seat/snapshot |12,288|21,848|34,136|
| Two-seat fog base 64 chars/s at 10 Hz |245,760|436,960|682,720|
| Checkpoint explored base 64 chars, both seats |98,304|174,768|273,072|
| Raised base mesh attributes+indices, bytes |7,962,624|14,155,776|22,118,400|

XL is 1.5625 times 256's area and 4 timesTiny's area. Base mesh accounting is 4
vertices/6 indices per cell with position/normal/UV/RGBA-color attributes and
32-bit indices. Each full-grid blend surface can add the same geometry again;
RGBA mask and fog textures add 4 bytes/cell each. Corner/level storage adds 17
bytes/cell. JS staging arrays, cliffs, trees, water and GPU/driver allocations are
additional. This is arithmetic from current geometry, not rendered acceptance.

The more serious server-memory risk is cached visibility. All source cells at
all current sight values 8/10/11 on raised, unoccluded ground admit up to 1071
indices/source. Current 16-bit storage at 320 could occupy 219,340,800 bytes
in index payload alone while being incorrect. A direct 32-bit replacement could
occupy 438,681,600 bytes (about 418 MiB), before Maps/objects/rays and the rest of
the room. Terrain occlusion reduces actual coverage; exploring more land grows
the cache. Widening the type alone does not bound memory adequately.

Checkpoint paths are separate from ordinary network snapshots. A conservative
single-simple-path bound is N−1 indices/unit. At 320, using the maximum 6-digit
index width gives 716,794 JSON bytes/path and 1,433,588,000 bytes for 2,000 units;
unit metadata, queued work and possible `attackMoveResumePath` are additional.
Real authored routes are much shorter. This bound shows why raw grid/array costs
cannot stand in for bounded path/save behavior. Actual save bytes/capture/
serialization/write times and transport deltas come from the native harness.

## Separate future admission slice

Before changing any limit, agree one shared geometry contract across server,
editor, walls, water, selection and checkpoint restore. Then:

1. Widen vision indices, add a byte-bounded cache/eviction policy, and test cells
   65535/65536/102399 with privacy, obstacle invalidation and cold recovery.
2. Bound route work, route storage and checkpoint size explicitly. Exercise
   long serpentine routes, failed/unreachable goals, command replacement, 2,000
   actors, queued work and recovery; don't reject existing saves accidentally.
3. Measure occupied/open/forest/water/elevated 320 fixtures with three route waves,
   fog, combat and paid construction. Retain tick/start-lag/skips, cache growth,
   RSS, A* expansions, checkpoint costs, compressed egress and queue refusal.
4. Assign actual room/device/network budgets and measure renderer frame/memory,
   terrain construction, minimap/picking and both-seat play on that hardware.

The harness defaults to a 512 MiB **probe stop**, not a supported room budget.
The existing 33.333 ms tick p 95 and 100 ms maximum remain diagnostics. Current
limits are unchanged; this proposal does not promise a working XL map or unit
capacity. Quick custom modes and a territorial/Risk world remain separate work.

```sh
node scripts/map-grid-cost-audit.mjs > /tmp/map-grid-cost.json
node --test scripts/map-grid-cost-audit.test.mjs
node scripts/map-capacity-scenario.mjs --map veyrholds-threefold-basin --loads 24,250,500,1000 --output /tmp/small-capacity
```
