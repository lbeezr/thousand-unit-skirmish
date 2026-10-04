# Ordinary map source inventory — 4 October 2026

[Map catalog](maps.md) · [Historical compact-map audit](qa-map-scale-2026-10-03.md) · [Size policy](map-size-tiers.md) · [Continuing work](map-scale-playability-backlog.md)

**Tiny 160, Small 192, Medium 224 and Large 256 are authored and admitted to human
Skirmish.** Tiny is the default and only accepted fresh ordinary AI map. This
pass stops map authoring at Large. Deployed/browser acceptance, human pacing
and supported army capacity remain open.

Catalog/runtime baseline: main `22b6e2df0d366097cfb56489c6a8cf7e5d7c5535`, including
[Large admission PR271](https://github.com/lbeezr/thousand-unit-skirmish/pull/271).
The [machine snapshot](qa-evidence/map-tier-inventory-2026-10-04/audit-summary.jsonl)
records its own exact audit-source commit, clean/dirty status and every consumed
map/rule/tool hash. It includes all 32 canonical files; eight meet ordinary size
policy, and 24 smaller files retain internal/legacy identities. Size eligibility
alone admits no mode. Generic Authored/Objective Control `pveSupported` flags and
the retained Millrace/Rootways seeded pool do not establish fresh ordinary AI
support. All reported `supportedUnitCapacity` fields remain null.

## Four ordinary economy tiers

All four support human **Skirmish@1** and ordinary Authored Practice; explicit
Skirmish Practice admission has separate mode-owner receipts. Each opens with
24 total units (four Workers/eight Infantry per seat), 150 food/250 wood per seat,
private fog and recovery-aware defeat in Skirmish. Bonus posts on Tiny/Small
cannot win; Medium/Large have no posts, supplies or deadlines.

| Tier / canonical ID | Cells and world dimensions | Initially usable / construction-eligible ground | Base route | Worker / Infantry nominal | Scout nominal | Expansion sites per seat |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Tiny · `veyrholds-terraced-vale` |160×160|22,406 /22,194 (87.5% /86.7%)|133 units|51.154 s|29.556 s|2|
| Small · `veyrholds-threefold-basin` |192×192|32,798 /32,482 (89.0% /88.1%)|157|60.385 s|34.889 s|3|
| Medium · `veyrholds-riven-escarpment` |224×224|43,734 /43,716 (87.2% /87.1%)|207|79.615 s|46.000 s|3|
| Large · `veyrholds-crownroads` |256×256|57,278 /57,256 (87.4% /87.4%)|251|96.538 s|55.778 s|4|

Every initially usable cell on these four is reachable from either home. One
cardinal cell edge is one world unit; Worker/Infantry move 2.6 units per game
second and Scout 4.5. The static route includes both initial home TC footprints;
elevation cost changes route selection, not speed. Forest clearing preserves
these four shortest routes. Thirty fixed steps per second give nominal
1.0 game-second per wall-second; skipped scheduling slots can slow that clock.
Static estimates are not measured arrival, first contact or match duration.
Raw cells are not equivalent to AoE2/WC3 tiles. The [reference normalization](qa-map-scale-2026-10-03.md#next-larger-map-and-external-comparison)
uses declared clocks, gameplay building envelopes and usable area instead.

The earlier default Millrace route was 51 units/19.615 Worker seconds, and
Rootways 81/31.154; those compact canonical maps are now internal/legacy. Tiny
thus offers 2.61 times Millrace's base route and 4.15 times its initially usable
area under the same game rules. This explains the scale change more directly
than raw cross-engine tile counts.

| Tier | Verified complete route alternatives: strip width / path length | Home campus | Finite food / ordinary wood | Additional forest wood potential |
| --- | --- | --- | ---: | ---: |
| Tiny |two 15-row passes/133 each; two 8-row flanks/191 each|41×41|6,100 /7,950|18,972|
| Small |two 16-row passes/157; south 15/239; north 10/245|45×45|9,700 /11,950|24,204|
| Medium |two 18-row passes/207; south 18/301; north 14/319|49×49|12,100 /14,950|38,460|
| Large |two 20-row passes/251; south 20/369; north 16/379|53×53|19,700 /24,150|49,356|

Focused map tests force a complete route through each named strip; width is
neither a whole-map minimum cut nor measured formation throughput. Medium/Large
have two separated ridge bottlenecks; their open center column misses those
bottlenecks. Each expansion has authored resource access and a reachable flat
TC pad. Home food/wood marker paths are 12/12 on all four. Expansion food/wood
paths per seat are Tiny 36/44 and 69/77; Small 55/67,80/92,114/126;
Medium 71/87,81/97,113/129; Large shelf 72/88, crown 140/156,
basin 99/115 and causeway 134/144, mirrored for both seats.
Stocks are finite node totals; forest wood is potential after cutting, not an
opening bank or immediate income. Bonus-post income is separate.

Existing home TCs occupy 4×4 cells; paid new TCs 5×5; most city buildings 3×3.
Each tier fits the static 30-building template per seat inside the same 41×41
working square, with flat footprints/free one-cell circulation rings and 96
added House population. Larger campuses and expansion pads add spatial choice;
this constructive example is not a maximum or paid 30-building city. Overlapping
legal-center counts are not simultaneous building capacity. The 128 added-building
limit is shared by both seats; population remains capped at 1,000 per seat.
Terrain remains one ground surface with levels 0/1/2, traversable one-level steps
and impassable two-level edges. Mixed-height footprints are runtime legal;
flat pads are authored recommendations. See [elevation limits](map-elevation-capabilities.md).

## Actual crossing and ordinary-entry evidence

Keep sources/endpoints distinct. Native crossing receipts use real unit offsets,
a 0.8-unit arrival tolerance and Scout producer exits; they are not static base
anchors or rendered observations.

| Tier | Retained actual outward game seconds: Worker / Infantry / Scout, both seats | Exact measured source / scope |
| --- | --- | --- |
| Tiny |50.1/51.0;49.4/50.133;26.5/27.4|`2efb46ef903d80e1afbce410839f574a42e3b69a`; [paid native routes](qa-terraced-vale-2026-10-03.md), predates later Sheep/mode integration|
| Small |59.433/60.233;58.633/59.433;31.9/32.8|`6c7d86047d937aba2c6723c2eea25fd79dc0c013`; [paid native routes](qa-threefold-basin-2026-10-04.md), predates normal floor/Skirmish admission|
| Medium |No retained full base-to-base arrival for these three kinds|[Medium diagnostic](qa-riven-escarpment-2026-10-04.md) proves bounded movement/plans/cold recovery; [mode admission](qa-medium-skirmish-admission-2026-10-04.md) separately proves paid House/food deposit|
| Large |97.267/96.467;96.467/95.767;53.7/52.8|`36f6f9a949de208aeb77612f59600acaa1f33fd3`; [paid native routes](qa-crownroads-2026-10-04.md), Authored Practice before Skirmish admission|

Small Worker wall times were 59.383/60.184 seconds. Large Worker wall times were
96.286/95.487; its interval begins at a public snapshot earlier than the wall
stopwatch, so their quotient is not an exact applied-clock measurement. Retained
Large rolling clock windows measured 0.999818–0.999909; the separate longer paid
checkpoint interval measured 0.999903. Tiny retains two separate single-window
2,000-unit diagnostics, each with one skipped slot. Keep every skipped slot and source-qualified clock
window; do not assume measured server rates apply to staging or another load.

Fresh ordinary entry/recovery evidence is separate from these historical crossing
runs: [Tiny AI admission](qa-tiny-skirmish-pve-admission-2026-10-04.md),
[Small human admission](qa-small-skirmish-admission-2026-10-04.md),
[Medium human admission](qa-medium-skirmish-admission-2026-10-04.md),
[Large human admission](qa-large-skirmish-admission-2026-10-04.md). Large's latest
clean paid source `95800de30ed9618f2ab3b4d3feca5226df6d7540` proves normal Create
Room/map-only selection/Ready/Launch,16,384-byte fog, paid Houses/food deposits,
real cold seat resume, reset and one-human Skirmish Practice. It does not remeasure
full crossings or certify AI/balance/capacity.

## Other ordinary-size choices

These are the remaining four of eight eligible canonical maps, all Tiny 160×160.
They also support ordinary Authored Practice. Their static hypothetical
Worker/Infantry/Scout times do not prove those units exist in the mode opening.

| Canonical ID | Normal human mode / purpose | Base route / nominal W–I / Scout | Usable ground / material limitation |
| --- | --- | --- | --- |
| `siltmouths-confluence-grounds` |Authored Practice arena; no selectable Skirmish/PvE|135 /51.923 s /30.000 s|16,754 cells/65.4%, all reachable; actual opening wood visibility regression below|
| `woodland-expanse` |Objective Control@1; terrain/economy fixture|136 /52.308 s /30.222 s|20,328/79.4%, all reachable; only 2,000 food/2,000 ordinary wood plus 31,440 forest potential|
| `frontier-160` |Objective Control@1; large-opening regional diagnostic|111 /42.692 s /24.667 s|20,500/80.1%;20,252 reachable per seat,248 isolated decorative usable cells; canonical 1,000-unit opening is not capacity|
| `bannerfall-arena` |Bannerfall@1 quick reinforcement/evolution mode|26 /10.000 s /5.778 s|25,568/99.9%, all reachable;16 Infantry opening, zero food/wood, no economy or AI; flat empty-city geometry is not its gameplay|

The 32-file machine report retains all 24 smaller canonical maps, stock/routes and
seeded identities. Compact shore-fishing/Meshy micro-fixtures and historic
Millrace/Rootways are not ordinary baselines. Quick Bannerfall and the separately
owned massive territorial/Risk world do not define economy-map scale.

## Confluence invariant and compatibility

This section and its native opening projection retain the inventory's original
baseline. The [subsequent correction and source-qualified proof](qa-confluence-opening-2026-10-04.md)
implements the minimal four-node proposal and exact legacy-definition contract
below. The literal nine-unit check now passes; both food and wood are visible in
fresh games. Old saves keep their geometry/depletion/cargo/paid work until an
explicit reset. This dated inventory and its machine snapshot are not relabeled.

The unchanged layout scenario requires each seat's food and wood node within
nine Euclidean world units of spawn. It **already counts Sheep**. Nearest food
is 9.486833 units away; timber 12.806248. The [native opening projection](qa-evidence/map-tier-inventory-2026-10-04/confluence-opening-before.json)
at clean `1d380b0ae7acca140a6f4289837aa145fc50f34e` shows berries/Sheep visible but
no wood for either seat before commands, with 6,400-byte fog. Opening visibility
uses the union of initial units and building access cells, so the food-distance
failure is a stricter proxy; hidden wood is an actual opening regression. Earlier
paid scenarios moved Workers before gathering timber and did not test this
invariant. The earlier Crownroads phrase “ignores Sheep” is corrected; its
historical failed receipt remains a failure.

Unapplied minimal proposal: mirrored existing berries local row 86→84 and timber
row 70→76, retaining col 29 (reflection on the other bank). Both become 8.944 units
from home(21,80), with own marker paths 12/12. Independent in-memory review retains
geometry/routes/stocks/Sheep/Stone/fish/Dock pads and 30/30 city fits. Keep the
nine-unit rule. [Current-owner coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/260#issuecomment-5976694873)
precedes map edits; no canonical/runtime edit is included in this inventory.

The shipped-map hash guard rejects old Confluence checkpoints after any such
change. A narrow exact historical-definition/hash compatibility rule must retain
old node coordinates/hash, depleted stocks, banks/cargo, gather paths, paid
buildings and session identity; fresh games/reset use the new canonical layout.
A legal old House centered at grid(28,77) contains the proposed new timber cell,
so silently relocating old nodes is invalid. Unknown hashes or extra differences
must still reject. Map/restore owner coordination and focused old/new native
recovery proofs remain necessary; do not generalize the hash exception.

## Remaining benchmark and XL work

Use Tiny as the established default control and Large as the long-route/area
stress case, with Small/Medium intermediate samples. First complete Medium's
actual Worker/Infantry/paid Scout crossings and an observed two-human match on
an identified release. For all tiers, record first contact/paid expansion,
explored area, useful regions/routes, congestion and the player's consequential
choice/alternative. Observe cities, cliffs, picking, fog and minimap at ordinary
and strategic zoom. Browser/deployment acceptance stays with delivery task
`01a10227-2c6d`; AI expansion stays with AI owner `01a10297`.

Compare fog-enabled 24/250/500/1,000 total actors, with 2,000 diagnostic, on a named
host/device/network at one source. Use three complete route waves through distinct
passes/flanks, mixed Workers/Infantry/Scouts plus paid city/forest/combat workloads,
failed/replaced orders and real checkpoint/reconnect/reset. The current 10-second
collector waves can end before long routes arrive; do not relabel them as full
crossing or paid-army evidence. Above-opening army-size diagnostics remain
separate from naturally paid development. Record command application/notice,
actual arrival/spread, game/wall ratio, A* work, tick/start-lag p95/max/skips,
vision/cache cost, RSS/heap/arrayBuffers, save costs, compressed egress and browser
frame/memory. Current native diagnostics remain p95≤33.333 ms/max≤100 ms; the
512 MiB probe stop is not a support budget. Tiny's two separate single-window
2,000-unit diagnostics, Small's ladder
and Medium/Large's 24-unit windows are different source/workload evidence, not
comparable hardware results or supported capacities.

**XL 320 is unimplemented and rejected.** Follow the separately reviewed
[grid audit](map-grid-limit-audit-2026-10-04.md) and
[visibility design](map-xl-visibility-design.md) before authoring/admission:

1. Replace wrapping 16-bit visibility coverage with 32-bit absolute indices;
   test 65535/65536/102399 and rejected 102400, rectangles and final rows/columns.
2. Bound room-owned coverage to 8 MiB live owned typed payload plus 8,192 entries,
   deterministic LRU/exact accounting, no hidden oversized backing buffers.
   Temporary allocations/JS overhead still require measurement.
3. Replace cache identity on every geometry invalidation, including same-tick
   forest/building/wall/gate changes; prove cached/uncached equivalence, both-seat
   privacy, exploration persistence and cold/reset behavior.
4. Coordinate all 256-limit consumers (server, editor, walls, water, catalog and
   restore) and bound path work/storage/save size. The 320 Manhattan heuristic
   fits 16 bits; that does not make visibility or larger grids safe.
5. Run cold/post-eviction fog-enabled native workloads and actual two-seat
   rendered play on named hardware/hosting/network budgets.320 fog is 25,600
   packed bytes/seat; raised base geometry alone projects 22,118,400 bytes before
   other surfaces/JS/GPU costs. Arithmetic does not establish frame or room cost.

## Repeat the source audit

```sh
node --test scripts/map-scale-audit.test.mjs scripts/map-size-policy.test.mjs scripts/match-modes.test.mjs
node scripts/map-scale-audit.mjs > /tmp/map-scale-full.json
node scripts/map-scale-audit.mjs --summary-jsonl > /tmp/map-scale-summary.jsonl
```

Full JSON includes resource paths/stocks and explicit city placements. JSONL
retains all-map geometry/tempo/economy and source-derived size/mode admission.
The CLI starts no server and changes no map. Rendered/deployed checks remain
separate; read-only staging metadata last retained at 04:00UTC points to source
`64cc391e6d9c4164dca7bd45696cf3862fe19729`, predating these new tiers. It neither
proves served bytes nor describes the currently requested user environment.
