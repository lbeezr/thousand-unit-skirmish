# Building and construction composition — 4 October 2026

[Renderer contract](renderer-state-contract.md) · [Default buildings](frontier-building-runtime.md)

Rendering/compositing owner retains the user reports: completed Watchtower and
apparently most non-TownCenter buildings have a dark square on top; Workers
appear under construction earth; adjacent palisades have overlapping earth
squares. Gameplay, rotation/ghost preview, approved art and terrain are outside
this correction. Initial clean current source is
`faf9e718805054683e37fc7e1faac3d98ca10ae5`.

## First demonstrated cause and small correction

The shipped construction ground factory sets transparent render order 8.
Worker sprites have order 1.1, depth testing and **no depth writes**. Thus the
late earth color pass has no Worker depth to reject it and blends over Workers
where they intersect in the image. Ground now uses order -0.5 and keeps depth
testing/no depth writes and its existing height +0.002. This changes one color
pass order, with no actor/terrain height, asset, simulation or picking changes.
CPU factory contracts exercise loaded and unloaded textures, ordering relative
to real actor/captured building constants, elevated contact, capacity refusal
and empty membership. They do not establish rendered appearance.

The treatment preserves the existing [earthwork source](../assets/environment/frontier-interactive-v1/construction-earthwork.png),
[foundation source](../assets/environment/frontier-interactive-v1/construction-foundation.png)
and their [runtime/provenance manifest](../assets/environment/frontier-interactive-v1/manifest.json).
Existing [Worker production backing](human-foot-unit-coverage.md) and
[Watchtower capture](../assets/buildings/frontier-civilization-models-v1/captures/watchtower-complete-view-01.png)
remain unchanged. The selected correction puts that approved detail beneath its
actors and samples the original soil core along connected wall cells; no new
art is generated. Before/after pixels remain a separate required comparison.

## Layer audit

| Content | Current order / pass | Depth and alpha convention |
| --- | --- | --- |
| Terrain and opaque procedural foundations/bodies | Opaque, normally 0 | Test/write depth; ordinary geometry |
| Terrain blend / shore-bank shade | Early transparent; bank -2 | Test depth, no writes |
| Ground haze | Transparent -1 | Test depth, no writes |
| Construction earth/foundation | Transparent -0.5 (was 8) | Test depth, no writes; texture cutout 0.04 |
| Environment props/trees | Transparent normally 0 | Cutout 0.08, depth writes |
| Direct building body | Opaque 0 | Color disabled, alpha 0.9, depth writes; same texture/ground correction |
| Captured building body | Opaque child of color sprite | Color disabled, alpha 0.9, depth writes; same transform/texture |
| Direct / captured building color | Transparent 0 / 0.9 | Test depth, no writes; alpha 0.08 / 0.025; painted shadows stay in original art |
| Unit LOD / Workers | Transparent 0.8 / 1.1 | Test depth, no writes; Worker alpha 0.035, root/contact depth bias retained |
| Unit ground rings/shadows | Existing procedural pass | No new shadow plane added; live feedback remains separate |
| Selection, combat, rally / arrows | Existing orders 2–4 | Mainly depth-tested blended feedback, no writes |
| Health / attacker badges | Existing feedback | Unit health and attacker badge bypass depth intentionally; building health uses geometry |
| Placement previews | Existing orders 4–5 | Blended previews, no writes; owned by rotation/ghost workstream |
| Water / surface plants | Existing orders 5–7 | Separate water composition; dry construction does not change it |
| Fog / resource labels | Existing orders 12 / 15 | Fog and screen labels intentionally bypass depth |

Opaque passes run before transparent passes regardless of numeric order. The
ground fix preserves that occlusion; lowering its order is not flattening depth
or changing actor heights.

## Dark-square diagnosis is open

The original Watchtower view-01 PNG was visually inspected: it has the authored
roof, no extra square. Current completed captured art hides its grouped generic
fallback, while health/selection/team/combat feedback remain on the outer group.
No fallback, foundation, shadow, depth or alpha cause is yet proven for the
reported square. No geometry or source art has been removed speculatively.

Local sandboxed WebGL prerequisite at the initial source failed with
`sandbox-unavailable` and `storage-unavailable`: zero frames/screenshots. The
[qualified PR323 run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37215311854)
artifact was downloaded and its actual canvas inspected. That older OpenField
movement frame shows a TownCenter and qualifies the backend; it does not
reproduce the reported buildings or prove this correction.

## Retained visual acceptance

CI owner `01a10378` owns the common hosted interface, registry and dispatch.
The concrete [interface request](https://github.com/lbeezr/thousand-unit-skirmish/pull/331#issuecomment-5982274444)
proposes `site-composition`, owned file
`scripts/renderer-site-composition-scenario.mjs`. Exact current-source baseline
and candidate normal packed assets must capture real paid healthy Watchtower,
House and other families, TownCenter control, Worker front/rear crossing and
construction contact, mixed-stage palisades, gate/gap/corner, completion,
cancel/removal and elevated terrain occlusion. Inspect actual PNGs and retain
simulation state and source/release identities; screenshot manifests alone
cannot pass visual acceptance. Identified staging delivery remains separate.

## Second bounded increment: connected palisade ground

The original ground pipeline places the same 3×3 square on every 1×1 wall or
gate. Adjacent sites therefore overlap across two cells in each direction.
The candidate removes walls/gates from that pipeline and draws two preallocated
union meshes (earthwork/foundation), each at most 128 one-cell quads. No positive
area overlaps between cells or stages. Authoritative reciprocal connections,
same owner, surviving unfinished membership and equal sampled center height
determine joined edges. Diagonals, gaps, completed/open gates and removed sites
do not bridge. A gate under construction joins just like its owned segment;
its operation rules are untouched.

Both existing textures were visually inspected. A shared mirrored soil-core
sample (central 30–70%) avoids repeating their square grass/stone curb inside
the strip. World coordinates keep this placement stable across stage changes,
snapshot ordering and reconstruction. Only exposed union edges feather; there
are no stacked alpha squares. Vertices sample the real terrain just inside each
cell corner and retain +0.002 lift and depth testing. Two fixed buffers update
only when signatures change; progress within one stage causes no upload. Other
building site art and every map, ledger, navigation and picking rule remain.

CPU controls cover reciprocal versus stale/missing connections, mixed stages,
straight/corner/junction, gap/diagonal/opponent, gate completion/open state,
duplicates, terrain step, exact triangle coverage, overflow, stable buffers,
real renderer reconciliation and completion/removal. These are topology and
composition contracts, not a GPU visual pass. The adapter still needs the
CI-owned registration and exact baseline/candidate captures described above.

## Prepared owned regression adapter

`scripts/renderer-site-composition-scenario.mjs` exports `site-composition`,
`contextVersion=1` and `run(context)` for the merged shared capture contract.
It enters `/` → Practice with Authored Rules, joins the same disposable room
with a second real seat, then publishes an explicitly declared 64×64 authored
regression map. It uses default loaded assets and normal socket Build/BuildWall,
CancelConstruction and Move. This is a construction regression, not ordinary
New Game/menu usability or deployment acceptance.

Four workers per seat naturally build Watchtower, House, an eight-cell L and
its adjacent Gate. Fourteen checkpoints cover earthwork, productive foundation,
cancelled middle gap, completed captured buildings/cleared ground, and real
foreground/rear Worker approaches for both seats. A second declared raised map
with fog covers owned TownCenter and naturally completed House terrain contact.
The terrain rectangles do not overlap; the level-1 rim provides legal access
to level 2. The House position avoids the real offset TownCenter footprint.

Each shared screenshot retains only disclosed scene/render projections and
exact source/release identity. A read-only opt-in snapshot records actual
rendered-frame captured/fallback visibility, screen coordinates, terrain contact
and live Worker action. The adapter returns **blocked** until actual retained
PNGs receive visual inspection; image receipts and state metadata never pass
the dark-square, occlusion or raised/fog checks. CPU orchestration tests validate
that boundary and propagate screenshot failures without producing pixels.

`node scripts/site-composition-scene-scenario.mjs REPORT.json` exercises the same
declared maps through the public Practice room service and authoritative server.
It checks the real 22-site paid ledger, productive wall progress, both real
cancelled gaps, natural completion of 20 surviving sites, real front/rear Move
arrival and naturally completed raised House. It is scene preparation with
zero rendered frames and no DOM/deployed acceptance. The initial overlapping
elevation draft was rejected; a later raised House draft intersected the offset
TownCenter and was also rejected. Both fixture errors were corrected without
changing admission, economy, maps or simulation rules.

CI owner `01a10378` retains the explicit registry/manual selector admission;
the shared registry currently has no `site-composition` case. Independent review
is still required by the contributor planning guide before these author-owned
merges. The rendering owner retains exact baseline/candidate PNG inspection,
dark-square diagnosis, clean packaging and identified staging verification.
