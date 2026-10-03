# Shipped map scale audit — 3 October 2026

[Scale and density](map-scale-density.md) · [Ranked next work](map-scale-playability-backlog.md)

The ordinary maps are compact in travel time. Millrace's bases are only **19.6
seconds apart for Workers/Infantry, 11.3 for Scouts**. Rootways reaches 31.2/18.0
seconds. Both fit the tested developed-city geometry; short travel and close
expansions are better-supported explanations for feeling small than an inability
to place a city. These are static estimates, not observed first-contact times.

## Revision and reproducibility

Audited source: `4467986fe15b6595d0929ba0d63306473687a356` ([machine report](qa-evidence/map-scale-2026-10-03/audit-summary.jsonl)).
The initial local checkout was older `d503d90`; the audit uses a separate branch
from fetched main, not that stale checkout. PR140 Stone and PR155 Practice are included.
Railway's read-only deployment list, checked at approximately 22:37 UTC, identified
staging deployment `29d74cac-b078-4a88-8f2a-e3141a2f9465`, `SUCCESS`, source
`32f11d58018404835fd47489441f9cdfef7c403b`, created at 22:27:54 UTC.
All map files, `server.mjs`, and the shared rules consumed by this audit match
that staging source. This is deployment metadata and source parity; direct
HTTP access failed in this executor, so it does not establish served bytes or
live gameplay. Later deployment revisions require a new check.

```sh
node --test scripts/map-scale-audit.test.mjs
node scripts/map-scale-audit.mjs > /tmp/map-scale-full.json
node scripts/map-scale-audit.mjs --summary-jsonl > /tmp/map-scale-summary.jsonl
```

Full JSON includes every resource's stock/access, objective routes, and explicit
city placements. JSONL retains all-map geometry, timing, stock, city counts and
source hashes while omitting long per-marker/placement lists. Each run records
its checkout SHA and exact rule/map/tool hashes. The dated snapshot is historical;
rerunning on a newer commit updates its identity even if measurements match.
Tests cover cliffs/ramps, asymmetric elevation cost, odd rectangular grids,
obstacle union, forest shortcuts, construction exclusions, per-unit travel,
city placement validity and actual roster classification.

## Which maps a player actually gets

The [server default](../server.mjs) is Millrace; the [seeded AI pool](../src/pve-match.mjs)
contains only Millrace and Rootways. The twelve curated regional skirmishes are
nine 80 × 72 maps and three 96 × 72 maps, with **24 total opening units, 12 per
seat**, and banks of 150 food/250 wood per seat. `startingArmySize` is a total,
despite the catalog guide's older wording implying 24 per seat.

All 26 shipped files remain selectable. Thirteen are prefixed Lab by the actual
catalog predicate. The 40 × 32 Shore Fishing micro-fixture has a `vaelora-` audio
tag, which makes its catalog presentation regional without making it an ordinary
skirmish baseline. Meshy Forest Clearing (48 × 48) is another micro-fixture.
Frontier Reach and Woodland Expanse (both 160 × 160) and Highland Grove (129 × 97)
are Lab maps. PR155 supplies normal one-player Practice access to these maps;
it does not enlarge the default or seeded AI pool.

## Geometry and tempo

One simulation cell is **1 × 1 world unit**. No meters or cross-engine tile
equivalence is defined. Initial passability includes obstacles and both home
Town Centers; construction exclusions additionally include resources/objectives.

| Map | Grid/world dimensions | Initial walkable | Eligible construction ground | Base route | Worker / Infantry | Scout |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Millrace (default) | 80 × 72 | 93.8% | 88.9% | 51 | 19.6 s | 11.3 s |
| Orchard Common | 96 × 72 | 93.3% | 89.8% | 67 | 25.8 s | 14.9 s |
| Rootways (AI pool) | 96 × 72 | 84.7% | 81.3% | 81 | 31.2 s | 18.0 s |
| Vesperra Pale Clearings | 96 × 72 | 87.8% | 84.3% | 67 | 25.8 s | 14.9 s |
| Frontier Reach (Lab) | 160 × 160 | 80.1% | 78.3% | 111 | 42.7 s | 24.7 s |
| Woodland Expanse (Lab) | 160 × 160 | 79.4% | 76.0% | 136 | 52.3 s | 30.2 s |
| Highland Grove (Lab) | 129 × 97 | 85.6% | 84.6% | 106 | 40.8 s | 23.6 s |
| Shore Fishing (fixture) | 40 × 32 | 95.0% | 94.7% | 25 | 9.6 s | 5.6 s |
| Meshy Clearing (fixture) | 48 × 48 | 81.5% | 81.3% | 36 | 13.8 s | 8.0 s |

Worker/Infantry speed is **2.6 world units per game second**; Scout is **4.5**.
The server takes fixed 1/30-second steps at 30 Hz: nominal game/wall-time factor
**1.0**. Overload skips timer slots without simulating catch-up; observed factor
is deliberately null in the static report. For a match, measure
`ΔmatchElapsedSeconds / ΔmonotonicWallSeconds`. Planning, collision/separation,
network delay, spawn offsets, stopping short for interactions and army congestion
can change observed travel. Uphill cost 115 versus 100 changes route choice;
movement speed itself is unchanged. The old balance audit uses the fastest unit
and omits home TC occupancy, so its single "walk" figure is not Worker pacing.

## Cities, resources and routes

Most buildings occupy **3 × 3**, built Town Centers **5 × 5**, palisades **1 × 1**.
Initial home TCs use a separate **4 × 4** footprint. Millrace spans 16 × 14.4
built-TC widths, and base separation is 10.2 TC widths. Rootways spans 19.2 × 14.4
with 16.2 between bases. A 160 × 160 map spans 32 × 32, giving **4.44 times**
Millrace's raw area, with distance normalized by the same game rules.

All twelve regional skirmishes fit a static 30-building example for each seat
with centers inside a 41 × 41 home square: one additional TC, seven production/drop-off
buildings, twelve Houses, eight Farms and two Watchtowers, with free 1-cell
circulation rings and flat footprints. Houses add 96 population per seat.
Millrace has 4,066 legal 3 × 3 centers (3,508 flat); Rootways has 4,552 (3,936
flat). These overlapping centers are **not** a capacity count. The packed example
is not a maximum or paid runtime guarantee: units, prerequisites, connectivity
refusals and economy are untested. The runtime caps added buildings at **128
shared by both seats**, and population at 1,000 per seat; more land does not
increase these caps. Shore/Meshy fit only 15–16 / 8–6 buildings in this same probe.

Millrace contains **2,800 food, 4,200 ordinary wood, 1,404 forest wood potential**.
Per seat: home patches 650 food/975 wood at minimum marker routes of 10/9 cells,
outer patches 750 food/1,125 wood at 24/28 cells. These are four economic patches,
not four complete expansion bases. The two outer capture posts also reward
75 food/50 wood each per capture, and relief grants both seats 100 food/75 wood
at 120 seconds. Repeated capture income is separate from finite stock.

Rootways contains **2,200 food, 2,200 ordinary wood, 6,156 forest wood potential**.
Per seat: home food/wood 650 each at 11 cells, outer food/wood 450 each at 43/42
cells. Cutting the forest can shorten base travel **81 → 67 cells**, saving 5.4
Worker/Infantry seconds. Full-clear stock is potential, not instantly reachable
income. Frontier Reach has 9,600 food/9,840 ordinary wood plus 25,344 forest wood;
Woodland Expanse has only 2,000 food/2,000 ordinary wood plus 31,440 forest wood.
Thus larger shipped maps do not consistently scale finite food or economic sites.

Millrace's center divide offers three open crossing runs of **12 / 8 / 12 cells**.
Its central objective starts just 21 cells from either spawn (8.1 Worker seconds).
Removing a 7 × 7 square around a primary-route midpoint yields 51 → 59 cells;
Rootways yields 81 → 83. That demonstrates local detour resilience, not independent
army flanks. Rootways's center column is fully open despite forest belts elsewhere;
a single cross-section cannot stand in for whole-map choke analysis. Match tests
must identify separated routes actually used and test arrival/congestion.

## Terrain capability inventory

| Contract | Supported now | Limit relevant to a showcase |
| --- | --- | --- |
| Ground | Integer levels **0/1/2**, up to 4,096 nonoverlapping patches; default level 0. Renderer height step **0.8**, total 1.6. | One ground layer per X/Z cell. Obstacle `elevation` is a separate visual/blocker height. |
| Slopes/ramps | Adjacent level delta ≤1 walks; interpolated render corners smooth those transitions. A 0→1→2 terrace forms a ramp. | Delta 2 is impassable; smoothed art does not change logical pathing. Cardinal A*, strict diagonal crossing checks during movement. |
| Cliffs | Direct 0↔2 edges remain discontinuities and route blockers. | No climb, stacked paths or alternate navigation layers. |
| Building ground | Renderer places buildings at sampled center height. Audit records both legal and flat-pad centers. | **Current server/client do not reject mixed-height footprints**, despite map-authoring prose saying sites must be level. Author flat pads and verify pixels; do not rely on enforcement. |
| Vision/fog | Raised sources gain **+1 sight cell** at either raised level; ordinary sight 8, Scout 11, Tower 10. Fog mesh follows terrain. Forest/stone obstacle height ≥1 and buildings block vision rays. | Ground elevations are not used as physical ray heights for terrain occlusion; there is no high-ground damage bonus. |
| Combat/projectiles | Range/damage use planar X/Z distances and visible-target checks; visual attack traces interpolate endpoint ground heights. | No terrain-intersection projectile simulation or per-attacker ballistic LOS. Visibility from another ally can expose a target. |
| Camera/picking | Fixed oblique orthographic view, pan/zoom/home/fit; ground picking raycasts the terrain surface. | Showcase must verify cliff/pad/selection/fog readability at normal and strategic zoom. |

Primary code: [elevation](../src/elevation.mjs), [height/render sampling](../src/terrain-height.mjs),
[movement boundaries](../src/unit-movement.mjs), [map validation](../src/map-utils.mjs),
[authoritative rules](../server.mjs), [camera](../src/camera-controls.mjs), [presentation](../src/main.js).
Bridges with a route underneath, caves, walkable overhangs and stacked cities
require separate future engine features. Decorative bridges cannot imply those rules.

## Next larger map and external comparison

Propose **one 160 × 160 Veyrholds terraced-valley skirmish**, with the current
cell size/speeds and 24 total starting units. Target **130–156-cell** base routes
(50–60 Worker/Infantry seconds; 28.9–34.7 Scout seconds), two broad separated
passes, smaller flanks, flat city pads and two paired expansion sites per seat.
Use levels 0/1/2 for a valley floor, terraces and plateau rims with explicit
level-1 ramps; use existing scree/material/vegetation art. This is a layout proposal,
not a shipped replacement. [The backlog](map-scale-playability-backlog.md) owns
mode/resource coordination, benchmark and adoption decisions.

Keep **160 × 160** as the first ordinary 1v1 candidate, **192 × 192** as a later
larger 1v1 candidate if exploration/expansion still needs room, and **224 × 224**
as a stress probe after measured acceptance. Quick custom modes and a massive
Risk world have different pacing and limits; this audit does not select their defaults.

The separate native researcher supplied these reference values; the full
versioned AoE2 guide handoff remains pending. Warcraft's primary extraction is
[wc3v map configuration](https://github.com/jblanchette/wc3v/blob/master/helpers/mapConfiguration.json)
and [building pathing](https://github.com/jblanchette/wc3v/blob/master/helpers/buildingPathing.json),
with Blizzard's [classic ladder catalog](https://classic.battle.net/war3/maps/war3xmappictures.shtml).

| Reference profile | Bounds in that engine | Gross HQ placement-envelope areas |
| --- | --- | ---: |
| AoE2 DE typical 1v1, Tiny (Zetnus guide values supplied by researcher) | 120 × 120 | 900, using a 4 × 4 envelope |
| AoE2 DE typical 2v2, Medium (same guide) | 168 × 168 | 1,764, using a 4 × 4 envelope |
| WC3 classic Echo Isles, playable bounds | 116 × 84 | 609, using a 4 × 4 envelope |
| WC3 classic Turtle Rock, playable bounds | 104 × 104 | 676, using a 4 × 4 envelope |
| WC3 classic Twisted Meadows, playable bounds | 124 × 124 | 961, using a 4 × 4 envelope |
| Our Millrace | 80 × 72 | 230.4 using constructed 5 × 5 TC; 360 using initial 4 × 4 home TC |
| Our Rootways | 96 × 72 | 276.5 constructed; 432 initial |
| Our 160 candidate | 160 × 160 | 1,024 constructed; 1,600 initial |

These are gross geometric ratios (area / HQ-envelope area), **not buildable
fractions or supported building counts**. On the constructed-TC ruler, Millrace
has about 26% of AoE2 Tiny's gross space, 38% of classic Echo Isles'; the 160
candidate is broadly in this reference range at 1,024 envelopes. Our initial
home TC is smaller than a constructed TC, so using that instead changes the
comparison substantially; both values are disclosed. Dimensions are not equivalent
engine tiles. WC3's editor canvas can differ from playable bounds (Twisted
Meadows 160 × 160 canvas versus 124 × 124 playable); modern Echo Isles v2.2 also
differs (108 × 88). There is no universal Warcraft standard size. Large AoE2 size
values vary by version; this comparison uses Tiny/Medium only.

Classic Echo Isles' supplied start straight-line separation is about 77 terrain
tiles. At 128 Warcraft world units/tile and 270 units/s for a Footman/Grunt, the
default-clock lower bound is **36.5 wall seconds**. This is a straight-line lower
bound, not an actual path time, whereas our 19.6-second Millrace Infantry figure
uses a cardinal route. Warcraft's real route can only be longer under these
assumptions. AoE2 unit-travel calibration remains pending; do not invent it from
tile counts. The proposed 50–60-second ordinary base route is a testable pacing
choice, not asserted reference parity. The [reference record](qa-evidence/map-scale-2026-10-03/reference-summary.json)
preserves supplied bounds, rulers, arithmetic and provenance limits.
