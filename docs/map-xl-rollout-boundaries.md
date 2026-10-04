# XL320 rollout: useful map and joint admission boundaries

[Size policy](map-size-tiers.md) · [Visibility prerequisite](qa-xl-visibility-runtime-2026-10-04.md) ·
[Movement contract](movement-pathing-workstream.md) · [Measured prior catalog](qa-map-scale-2026-10-03.md)

Ordinary XL is unfinished. The current server, editor restore/import/resize,
HTML controls, wall geometry, water graph and catalog all stop at 256 per axis.
PR328 integrated bounded 32-bit visible/fringe storage under that unchanged limit.
No current menu choice offers an unsupported 320 map. Tiny remains the default
and only fresh AI choice; 160–256 maps and legacy checkpoints retain their exact
behavior. Quick custom modes and a massive Risk world remain separate work.

## One reproducible intended map

The deterministic [Far Marches generator](../scripts/generate-far-marches.mjs)
writes only [a proposed fixture](../scripts/fixtures/xl-far-marches.json), outside
the runtime `maps/` pool. Do not copy it into that pool while the validator
rejects 320: startup validates every canonical file. It reauthors320² of useful
land, rather than resizing another map or adding an empty border. Existing
regional art/audio, one-world-unit cells, speeds, 24 opening units, 150 food/250 wood
per seat, fog and elimination remain unchanged.

| Static measure | Far Marches proposal |
| --- | --- |
| Initially walkable/reachable from either seat | 92,106 of 102,400 (89.9%); all reachable |
| Base path / nominal game seconds | 287 world units / Worker 110.385, Infantry 110.385, Scout 63.778 |
| Forests cleared | 285 units / Worker 109.615 s; still in the 105–125 s XL target |
| Forced crossing alternatives | 22 rows/287 units, 22/325, 16/467, 16/467; flanks impose a real detour |
| Home campus / city example | 57² flat cells per seat; existing 30-building template fits with one-cell circulation rings |
| Expansion campuses |Five per seat; 19² flat ground with an 11² resource-free inner area; paired stocks/routes |
| First shelf node routes | 86 food, 102 wood cells from own spawn, versus 72/88 on Large Crownroads |
| Other own-site node routes |Outer march 119–127; basin 138–154; causeway 156–172; crown 188–204 |
| Home node routes | 12 cells, both types/seats; existing nine-unit Euclidean predicate passes |
| Ordinary finite stock | 22,900 food / 28,350 wood; deliberately authored sites, not an area multiplier |
| Separate cuttable forest potential | 10,262 cells × 6 wood = 61,572 |
| Compact map / publish command JSON | 89,485 / 89,528 bytes; current 1,000,000-byte inbound frame fits the command |
| Compressed authoring rectangles | 830 terrain, 224 elevation, 286 forest; each below 4,096 |

These are constructive static geometry and nominal speed measurements. They do
not establish actual formation arrival, wall time, maximum city capacity,
economic balance, forest density/physical clearance, a human-play verdict or
rendered terrain. No raw tile equivalence with AoE2/Warcraft is claimed.

## Route, checkpoint and transport findings together

Run the [machine-readable audit](../scripts/xl-map-boundary-audit.mjs):

```sh
node scripts/generate-far-marches.mjs
node scripts/xl-map-boundary-audit.mjs > /tmp/xl320-boundaries.json
node scripts/xl-map-boundary-audit.mjs --native > /tmp/xl320-native-boundaries.json
node --test scripts/map-grid-cost-audit.test.mjs
```

It records exact git/source-input/map hashes, every dimension consumer, real
wall/water/catalog probes, both rectangular 320 orientations, static city/routes,
the actual publication command and the executed checkpoint path-validation leaf.
The optional native probe uses the existing authoritative fixed-tick adapter
without replacing any dimension guard. It checks 160/192/224/256 activation and
both-seat in-memory checkpoint restore, and actual 257/320/321 rejection. That
probe is neither a process restart nor ordinary room entry. A native result
inconsistent with the measured dimension policy exits nonzero.

Current land routes use absolute cell indices in JS arrays. A* can expand the
entire finite grid in one atomic search: at 320, 102,400 cells. The 4,096-cell
callback threshold is checked **between searches** and can be overshot by one
search. Default planning turns per tick stay 0. The 16-bit Manhattan heuristic
fits 320 (maximum 63,800); that does not bound search latency.

Checkpoint validation permits up to 102,400 entries separately in each actor's
active and attack-move resume path, without adjacency/uniqueness validation or
an aggregate route budget. One accepted repeated-final-cell array serializes to
716,801 bytes. Across 2,000 actors and both arrays, the validation envelope is
**2,867,204,000bytes (about 2.67 GiB)** before unit/map/other state. This is a
validation upper bound, not an observed legitimate save; the audit allocates
only one witness array. The earlier grid-cost projection uses the smaller
simple-route `cells−1` bound and excludes resume paths.

Capture clones both paths, then `JSON.stringify` serializes the entire snapshot.
The writer atomically writes/fsyncs/renames; recovery reads the whole UTF-8 file
then parses it. Neither side has an explicit checkpoint byte envelope in the
audited source. Public snapshots exclude these paths. 320 fog alone is 25,600
packed bytes / 34,136 base64 characters per seat; checkpoint explored grids are
273,072 base64 characters across two seats. Current outbound frame/queued bytes
are bounded to 4 MiB per peer. The map's compact publication fit does **not** prove
actual welcome/mapChange/worst-state frames or checkpoint size.

## Next integrated slice and retained gates

Before editing shared path publication/retention, resolve the concrete
[movement-owner decision](https://github.com/lbeezr/thousand-unit-skirmish/pull/332#issuecomment-5982283468):
preserve ≤256 route/goal/checkpoint behavior and choose an explicit XL-only
route/search/save envelope, with a clear command outcome and no truncation or
lost durable goal. A finite `cellCount` alone is not a memory/latency budget.
Avoid a second global smoothing/flow/planning service alongside U2–U7. The
map-size owner retains this integrated outcome and the other admission sites.

Then change all relevant 320 dimension consumers together, keeping wall command
waypoints 256 and other non-geometric quotas unchanged. Admit one canonical
Far Marches human-Skirmish choice only when ordinary create/join/two Ready/Launch,
both-seat paid build/harvest/expand, real Worker/Infantry/Scout journeys, replacement/
failed/long routes, privacy, untouched cold recovery and reset all pass. Keep
Tiny's fresh AI/default binding. No silent resize or migration of existing saves.

The representative native matrix remains 24/250/500/1,000 actors, three route
waves, warm/cold cache, forest cutting, failed routes and city construction;
2,000 is diagnostic. Record first command application/notice/arrival, game/wall
ratio, A* expansion/retained route totals, tick/start-lag/skips, vision cache,
process RSS/heap/arrayBuffers, checkpoint capture/serialize/write/read and actual
plain/compressed snapshots. Keep p95≤33.333ms and max≤100ms. Reuse
[PR325](https://github.com/lbeezr/thousand-unit-skirmish/pull/325)'s observed-source,
map/seed/driver, window/warmup and sampled RSS/swap/cgroup/OOM validity contract.
Repeat the same candidate geometry under matched declared controls; reject
resource-disrupted/unknown comparisons. Large-versus-XL changes geometry, so
their area-cost study is not a matched causal runtime comparison.

Use the existing qualified capture owner's
[version 1 ordinary adapter interface](https://github.com/lbeezr/thousand-unit-skirmish/pull/331)
for the two-human entry, 320 fog/terrain/minimap/picking and paid movement/build
captures. Agree a separate XL adapter slot with CI before editing its registry;
do not add another launcher/workflow/capability probe. Record exact clean source,
release digest, applied map, advancing PNGs and observed staging revision
separately. No such 320 native journeys, comparable performance, rendered or
staging acceptance exists yet; supported unit capacity remains unset.
