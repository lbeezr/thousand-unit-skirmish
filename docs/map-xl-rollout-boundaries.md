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
| Forests cleared | 287 units / Worker 110.385 s; still in the 105–125 s XL target |
| Forced crossing alternatives | 22 rows/287 units, 22/325, 16/467, 16/467; flanks impose a real detour |
| Home campus / city example | 57² flat cells per seat; existing 30-building template fits with one-cell circulation rings |
| Expansion campuses |Five per seat; 19² flat ground with an 11² resource-free inner area; paired stocks/routes |
| First shelf node routes | 86 food, 102 wood cells from own spawn, versus 72/88 on Large Crownroads |
| Other own-site node routes |Outer march 119–127; basin 138–154; causeway 156–172; crown 188–204 |
| Home node routes | 12 cells, both types/seats; existing nine-unit Euclidean predicate passes |
| Ordinary finite stock | 22,900 food / 28,350 wood; deliberately authored sites, not an area multiplier |
| Separate cuttable forest potential | 10,262 cells × 6 wood = 61,572 |
| Compact map / publish command JSON | 89,516 / 89,559 bytes; current 1,000,000-byte inbound frame fits the command |
| Compressed authoring rectangles | 826 terrain, 230 elevation, 286 forest; each below 4,096 |

These are constructive static geometry and nominal speed measurements. They do
not establish actual formation arrival, wall time, maximum city capacity,
economic balance, forest density/physical clearance, a human-play verdict or
rendered terrain. No raw tile equivalence with AoE2/Warcraft is claimed.

Independent review exposed unintended one-row shoulder bypasses. The corrected
shoulders retain their inner two-level cliff. Closing the full width of both
ridge bands inside all four declared passes now disconnects the homes. A
negative control restores the old shoulders and detects the 289-unit bypass.
Declared pass rows measure static authored geometry, not physical crowd clearance.

## Route, checkpoint and transport findings together

Run the [machine-readable audit](../scripts/xl-map-boundary-audit.mjs):

```sh
node scripts/generate-far-marches.mjs
node scripts/xl-map-boundary-audit.mjs > /tmp/xl320-boundaries.json
node scripts/xl-map-boundary-audit.mjs --native > /tmp/xl320-native-boundaries.json
node --test scripts/map-grid-cost-audit.test.mjs
```

It records exact git/source-input/map hashes, PR325's observed whole-runtime
identity (server/lockfile/all source modules), nested grid-cost input provenance,
every dimension consumer, real
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

The historical PR345 checkpoint path leaf, considered without an XL aggregate guard,
would permit up to 102,400 entries separately in each actor's
active and attack-move resume path, without adjacency/uniqueness validation or
an aggregate route budget. One accepted repeated-final-cell array serializes to
716,801 bytes. Across 2,000 actors and both arrays, the validation envelope is
**2,867,204,000bytes (about 2.67 GiB)** before unit/map/other state. This is a
path-leaf upper bound, not an admitted320 checkpoint or observed legitimate save;
the audit allocates
only one witness array. The earlier grid-cost projection uses the smaller
simple-route `cells−1` bound and excludes resume paths.

At PR345/403, capture cloned both paths and any wildlife herd path, then `JSON.stringify` serialized the entire snapshot.
The writer atomically writes/fsyncs/renames; recovery reads the whole UTF-8 file
then parsed it. Neither side had a whole-checkpoint byte envelope at those
revisions; the XL-only guard below addresses that separate finding. Public snapshots exclude these paths. 320 fog alone is 25,600
packed bytes / 34,136 base64 characters per seat; checkpoint explored grids are
273,072 base64 characters across two seats. Current outbound frame/queued bytes
are bounded to 4 MiB per peer. The map's compact publication fit does **not** prove
actual welcome/mapChange/worst-state frames or checkpoint size.

Post-merge source review found that forest-group runtime integration adds a
four-byte `Int32Array` membership entry per cell. The nested source-bound cost
audit includes that live array: its partial resident model is now70bytes/cell,
plus32bytes/spatial bucket, or9,449,248bytes at320. Checkpoint validation's
separate temporary membership is409,600bytes at320. JS group cell lists,
other temporary buffers and runtime/GC overhead remain excluded; this is not
a measured RSS budget. The original66bytes/cell table remains historical.

## XL-only checkpoint route preflight

The first save/allocation slice adds a private
[route preflight](../src/server/checkpoint-route-budget.mjs) before capture's
vision refresh/path cloning and before full restore validation's map/grid
allocations. The existing restore path validates before mutating the live world.
It applies only when at least one axis exceeds256 and both axes are at most320;
all ≤256 saves keep their existing validator, accepted route envelope and error
ordering. Invalid or out-of-scope dimensions still use the map validator.
Checkpoint schema29, persisted fields, path endpoints, goal/intent and every
movement/planner/publication function remain unchanged. Art backing: N/A for
this internal validation milestone.

The explicit budget is **1,048,576 cell indices** across all active actor,
attack-move-resume and wildlife herd paths. Each array keeps the existing
`cellCount` length bound. Existing limits of2,000 actors and128 resource nodes
bound metadata to4,128 path references. The first pass counts lengths and
rejects oversized state before reading any cells; the second visits at most
1,048,576 entries, rejecting noninteger/out-of-range indices, nulls and sparse
holes. The guard neither copies nor truncates route payloads. Full water,
wildlife, goal and other state validators still apply after preflight.

At a conservative eight bytes per JS array slot, the accepted route payload
is at most8MiB **per copy**, plus bounded array/reference overhead. It is not
a whole-process RSS bound: live routes, coalesced/in-flight snapshots, JSON,
other checkpoint state, parser allocations and GC remain separate. A synthetic
1,000-actor witness with active and resumed467-cell flank routes and128×64 herd
entries totals942,192, within the quota; repeated indices establish retention
accounting, not legitimate journey or supported-capacity evidence.

The existing [machine audit](../scripts/xl-map-boundary-audit.mjs) now executes
the full accepted aggregate, its copying payload and a rejected over-budget
witness whose index getters prove zero payload reads. It retains source/module
hashes, records exact counts/bounds and diagnostic Node memory/timing samples,
and labels them as a single-process allocation witness without GC normalization
or a comparable-performance claim. Tests execute the unchanged capture body
and real restore boundary, prove pre-allocation rejection and unchanged both-seat
worlds, keep the ordinary320 dimension rejection, and round-trip a formerly
accepted256 save containing more route entries than the XL quota. The focused
contract is included in the existing registered checkpoint CPU test lane.

## Next integrated slice and retained gates

The [current parallel-lane contract](https://github.com/lbeezr/thousand-unit-skirmish/pull/395#issuecomment-5985510449)
allocates checkpoint validation/allocation to the map owner and leaves active
Worker/planner/executor/publication work with movement. The
[exact save-slice interface](https://github.com/lbeezr/thousand-unit-skirmish/pull/395#issuecomment-5985575410)
records this guard and the remaining shared dependency. Before editing shared
path publication/retention, preserve the concrete movement contract:
preserve ≤256 route/goal/checkpoint behavior and choose an explicit XL-only
live route/search envelope, with a clear command outcome and no truncation or
lost durable goal. A finite `cellCount` alone is not a memory/latency budget.
Avoid a second global smoothing/flow/planning service alongside U2–U7. The
map-size owner retains this integrated outcome and the other admission sites.
Checkpoint file reads still allocate the whole UTF-8 file before JSON parsing;
the original PR403 slice did not bound the entire persisted state or parser.
The next XL-only envelope below preserves the absence of a global legacy cap.
An over-budget XL capture fails through existing checkpoint failure handling
and preserves the last good file; it does not halt accepted gameplay. Therefore
live publication must establish a bounded outcome that preserves durable intent
before ordinary XL admission. These prerequisites do not complete XL.

### Whole-file, parser and state volume

The [private reader](../src/server/checkpoint-file-reader.mjs) keeps the existing
JSON format and schema29. Its first pass uses a32KiB buffer, incremental UTF-8
decoding, at most16 shallow metadata frames and an80-character key prefix.
The [lexical inspector](../src/server/checkpoint-json-scan.mjs) finds the final
effective root `mapDefinition`, supporting arbitrary property order, escaped
keys and last duplicate values. Nested/string lookalikes cannot choose the
compatibility branch. Dimension approximation classifies valid integer ≤256
versus ≥257 with a half-unit margin; it never accepts a map or replaces exact
`JSON.parse`/authority validation.

Admitted ≤256 files retain the prior unbounded byte/shape/parser contract,
including valid reordered/duplicate metadata and large ignored values or
whitespace. The complete classification pass is required: an early320 value
may be overwritten by a later256 value. Thus classification work on rejected
or legacy files is **linear in file bytes**, with bounded auxiliary memory.
The descriptor is pinned across inspection/read; size/mtime changes reject
rather than parsing a different file. Atomic replacement preserves the pinned
old contents. This is not a constant-time rejection or a global I/O quota.

For XL and other non-legacy candidates, raw files must fit **32MiB** before
whole-buffer/string allocation and snapshot parsing. Lexical limits also cap
4,194,304 values,262,144 containers, depth16,102,400 entries per array,128 members
and key code units per object,262,144 decoded code units per string and64 units
per scalar token. Actual JSON syntax remains checked by the native parser.
The second bounded read verifies content volume and stable size/mtime before
parsing; byte/structure failures enter the existing rejected-file preservation
path. No new persisted flag, framing format, migration or route field is added.

The [state inspector](../src/server/checkpoint-json-budget.mjs) accounts exact
compact UTF-8 JSON bytes without constructing the serialization. It limits
record families before traversal, rejects cycles/sparse arrays/nonfinite or
unsupported values, and caps the same state volume. Capture checks live
clone-bearing records and map metadata before copying/`structuredClone`;
serialization checks the complete captured DTO before `JSON.stringify`;
recovery checks the parsed current XL shape before migrations and full
validation checks it before map/grid allocation. The existing route guard
still precedes route payload scanning; all semantic checks remain in place.
Every new guard is a no-op for admitted ≤256 shapes. Art backing: N/A.

Run the [repeatable sizing audit](../scripts/checkpoint-json-budget-audit.mjs):

```sh
node scripts/checkpoint-json-budget-audit.mjs --native
node --test scripts/checkpoint-json-budget.test.mjs
```

It reads actual source limits (2,000 actors,128 buildings/resources/sites,
eight waypoints, five production slots,25 maximum footprint cells) and records
input hashes. On the current combat-state shape, the actual admitted256²
roster checkpoint measures2,182,138
compact bytes,100,117 values,6,037 containers, depth5 and48 actor fields. A
declared supported-field combination adds both route kinds to their1,048,576
aggregate,128×64 herd paths, all site/waypoint slots,128 buildings/resources,
102,400 fractional-stock rows and both320 exploration grids:19,458,422 bytes,
2,104,047 values,154,704 containers and depth7; actor non-route payload is at
most4,485 bytes. It fits the quotas without expanding them. This synthetic
combination is an allocation witness, not a semantically valid320 world/save.

The explicit canonical sizing allowance is29,066,026 bytes: route digits,
8KiB non-route actor allowance, finite stock rows, buildings/resources, the
current1,000,000-byte map-publication envelope, generation counters, exploration
and fixed controls. The32MiB quota leaves headroom. These allowances use
canonical IDs/pins and supported field combinations; previously unconstrained
custom metadata can exceed them and is explicitly restricted for new XL.
They do not impose any new limit on old ≤256 saves.

Boundary tests cover byte/value/container quotas at and around their limits,
2,000 seeded JSON trees, scientific/long-zero integer dimensions, UTF-8 and
escaped/surrogate strings, distributed arrays, sparse/cyclic state and all
meaningful malformed routes. Actual paid Large256 native process recovery
admits a32MiB+1 file whose persisted state is untouched, restores both seats and
their paid Houses/banks, and retains bad XL files byte-for-byte. Existing full
Large entry, cold recovery, storage-failure and legacy migration checks remain
the regression floor. These checks enter the existing checkpoint CPU lane.

Per-file buffers/strings and parser/state allocation counts are bounded for
accepted XL; total process RSS, collector/container overhead, coalesced save
copies and live route/search retention remain separate. Diagnostic timing and
Node memory samples do not establish match capacity or comparable performance.
Ordinary320 admission still waits for the movement-owned live publication/search
outcome and actual320 cold recovery, playability, performance and rendered proof.
The source-bound dimension audit follows the extracted Map Studio draft-store
guard, verifies its client binding before restoration, and hashes that helper;
the extraction preserves its256 limit.

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
