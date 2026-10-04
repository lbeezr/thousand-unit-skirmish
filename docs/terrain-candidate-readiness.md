# Terrain candidate readiness — 3 October 2026

[Ranked workstream backlog](asset-adoption-checklist.md#terrain-workstream-backlog)
· [Painted-ground acceptance](qa-painted-ground-atlas-adoption.md)
· [Resource source candidate](../assets/environment/frontier-resource-atlas-v1-candidate/README.md)
· [Cliff review pilot](../assets/environment/frontier-cliff-pilot-v1/README.md)

Owner: terrain art integration workstream. Inspected from main `4467986`.
This slice adds a read-only source pixel check, its failure-injection tests and
the normal npm entry point. It changes no runtime selector, gameplay rules,
art bytes, source publication or paid-provider workflow. Tool acceptance is the
actual report and failures below; a game deployment is not required for this tool.

## Source inspection and selected slice

The seven resource PNG pages and their manifests already pass the generic
sprite-atlas validator. A direct reconstruction of the committed crop rectangles
and canvas offsets matches all eight oak/berries full/worked/low/depleted frames.
The static imagery was inspected: oak becomes a stump, while depleted berries
retain leaf/wood structure. These are existing project derivatives; no new art
was generated. Bottom-center pivots are labelled `unreviewed-estimate` on all
eight frames. There are no runtime page encodes/hashes. HSV partitions preserve
pixels but do not establish foreground/background depth around an actor.

The builder checks layers before packing and records `visibleRgbaReconstruction`.
The new `npm run validate:resource-atlas-pixels` checks the pages that actually
exist after packing, their referenced crops and offsets, and the original source
lineage. It detects an RGB-only edit even when alpha and updated file hashes agree;
Pillow's RGBA bounding-box default would hide that kind of difference if only
the alpha channel were considered. No existing art was found corrupted.

The report verifies seven page hashes/dimensions, eight source hashes,
transparent-RGB zeroing, source/fallback equality, non-overlapping layer alpha,
exact RGBA recomposition and alpha bounds at the declared threshold 96.
It records manifest/lineage hashes, eight unreviewed pivots and
`runtimeReady: false`. It does not resolve those review decisions. Run:

```sh
node scripts/validate-sprite-atlas.mjs assets/environment/frontier-resource-atlas-v1-candidate/manifest.json
npm run validate:resource-atlas-pixels
python3 scripts/resource-atlas-pixels.test.py
```

Python 3/Pillow are required; the optional `game-dev` CLI is absent here and is
not needed by this source check. Hosted Node CI does not install Pillow; no
unavailable Python check is added to that workflow. The implementation PR records
the exact tested/reviewed source and command results.

## Cliff findings and retained boundary

All sixteen cliff runtime color/depth files match their recorded SHA-256 hashes
and decode at 640 × 640; their combined encoded size is 1,028,670 bytes.
The eight-view pixels and current pilot consumer were inspected. The manifest's
normalized size is 4 × 0.998 × 1.306 world units: a low ridge, not a replacement
for the taller existing cliff artwork. Repeated joins, corners, caps and variants
remain unresolved. Static file integrity does not establish terrain registration,
foliage depth or GPU cost. The source GLB remains offline authoring material;
the existing pilot and normal obstacle consumers are unchanged.

## Painted-ground followthrough

Railway read-only deployment/state inspection at about 22:47 UTC identifies active
staging SUCCESS `29d74cac-b078-4a88-8f2a-e3141a2f9465`, one running replica,
platform source `32f11d58018404835fd47489441f9cdfef7c403b`. Git ancestry proves
that source contains painted-ground merge `7193c4ba74376c592c57804537f072a33d7146aa`;
the ground implementation files match this inspected main checkout. This is
platform/source delivery evidence, not authenticated asset-byte or GPU evidence.

A direct staging manifest request failed at the execution network's CONNECT
tunnel with response 403 and no origin HTTP status. No claim about the server's
asset response follows from that failure. The sandboxed Chromium preflight still
reports `sandbox-unavailable` with writable XDG directories. Zero game screenshots
were captured; no sandbox-disabling flags were used. The current cloud testing/CI
owner receives renderer qualification and the existing ordinary-game/zoom recipe
and hash checks under the [testing strategy](testing-strategy.md#start-here);
terrain integration retains acceptance ownership.

## Contract resolution and receiving owners

Followthrough inspected main `2ab16dea20406f237c834419d5d9c60711b9281c`.
The earlier broad resource-contract blockage mixed independently solvable export
work with new semantic depth choices. Terrain integration owns the technical art
and subsequent consumer; it is not waiting for a parent to approve routine exports.

| Exact contract question | Proposed resolution / receiving owner | Evidence / actual remaining dependency |
| --- | --- | --- |
| Must resource pivots or scale change to use a full-cutout atlas? | No. Terrain integration retains the active source canvas, bottom-center root and 4.1 × 3.75 oak plane. | The actual `createWoodResourceInstances()` factories verify all three ordinary depletion states and all four legacy states against the companion export. Geometry/root positions match; this is registration equivalence, not new visual approval. |
| Does the fallback need HSV foreground/background mattes? | No. Terrain integration keeps the whole cutout and current alpha/depth behavior. Semantic layers remain a separate production outcome. | The source pixel checker still passes all eight frames; no color-based layer enters the fallback draw contract. |
| Should normal full oak or regional wood be replaced? | No. The receiving consumer is terrain integration: generic oak worked/low/depleted, with full cutout only for `meshyResources=0`. | Actual factory checks preserve default Meshy full/directional geometry and Underbough root-oak. Before overlapping edits, agree this exact selector/UV boundary with the affected environment renderer owner. No building sprite paths are in scope. |
| Can the 4904-wide source oak row become a bounded runtime page? | Yes. Terrain integration prepared the separate [oak export contract](../assets/environment/frontier-resource-atlas-v1-candidate/oak-fallback-runtime.json) and six authored mips in a 2752 × 2880 2 × 2 layout. | Six hash/dimension/pixel checks, half-pixel insets, 64-pixel gutters, independent cell filtering and inherited registration pass. A consumer must cap sampling at mip 5 and use the stated fallback path. Berries remains independently owned export work, not parent-blocked. |
| Is the lossless atlas a justified production transfer/memory cost? | Terrain integration must assess the receiving runtime path before default admission. | 5,048,048 encoded bytes and 40.30 MiB decoded RGBA versus 1,266,974 encoded bytes for the four existing quality-86 oak WebPs. This is a lossless reference export, not a claimed optimization. Do not ship redundant individual files/atlas without explaining the cost. |
| Should the existing cliff model represent a low ridge or replace tall cliff obstacles? | Proposed receiving design owner: parent acting in art direction, with terrain integration retaining all technical work. Proposed answer: retain it as a low-ridge source and keep the current tall cliff/cap art unless a tall-cliff source-repair direction is chosen. | Normal cliff selection begins at obstacle elevation ≥1.75; measured model peak is 0.998. The decision changes the asset's intended role, rather than granting routine tool or publication permission. No new paid generation is required to inspect/plan either direction. |
| Do existing source ends establish matching repeated cliff joins/caps? | No. Terrain integration owns join/overlap/depth measurement and any bounded public-source repair after the intended role is settled. | The 0.05-unit end bands top out at 0.194/0.244 with 0.758/0.724 depth spans. Corners are not a current selector requirement; straight placement and end handling are the first consumer contract. Vertex bands do not prove continuous surfaces or safe overlap at the current two-cell placement spacing. |

The oak companion contract has status `runtime-export-unbound`. Original PNGs,
the seven-page source manifest, gameplay and shared renderer remain unchanged.
Lossless mip 0 retains every source RGBA sample; levels 1–5 match independently
filtered source cells. The four pixel/contract tests inject RGB-only mip changes,
registration/UV/LOD changes, missing levels and accidental overwrites. The Node
factory test exercises current normal/legacy/regional resource creation with
image decode mocked. No GPU appearance or live delivery follows from these tests.

```sh
npm run validate:oak-fallback-atlas
python3 scripts/oak-fallback-atlas.test.py
node --test scripts/oak-fallback-registration.test.mjs
python3 scripts/inspect-cliff-end-bands.py
```

The cliff read-only inspection checks original model SHA-256, all 516,571 actual
positions, accessor bounds and the existing capture normalization. It does not
modify or recapture the GLB, nor establish normals, join distance, depth pixels or
GPU performance. No private-source transfer/publication, new art generation,
paid provider, credential or security changes were used.

## Accepted continuation and next selection

Parent accepted generic oak worked/low/depleted runtime adoption and selected
the cliff source's low-ridge role; no parent design decision remains pending.
The normal [three-state oak pack](../assets/environment/frontier-oak-depletion-atlas-v1/README.md)
is separate from the four-state lossless reference. Its six quality-86 mips total
1,191,760 bytes plus JSON and 27.54 MiB decoded RGBA. Alpha remains unchanged
against independent source-cell filtering. Inherited root/canvas/scale and
existing full/directional/regional selection remain. The successful loader
decodes verified bytes once and skips the three individual state downloads;
those individual files still ship as failure fallbacks. This adds 373,820 encoded
bytes and about 3.55 MiB decoded compared with the three old state images.
The approved-runtime guard and packaged HTTP checks cover the new default path;
[identified delivery and ordinary game stock/zoom/depth acceptance](qa-oak-depletion-atlas-adoption.md)
remain owned by terrain integration. Shared renderer edits touch only resource
selection/sampling; construction/building sprite behavior is preserved.

Keep the low ridge out of normal binding until its [semantic placement constraints](../assets/environment/frontier-cliff-pilot-v1/README.md#low-ridge-placement-constraints)
pass: use existing nonwalkable stone occupancy, contain the 4 × 1.306 footprint,
match actual obstacle/vision height and flat terrain support, keep scale/view/depth
registration, and prove two-cell repeats and terminal readability. Do not add
navigation obstacles, change sight rules, imply walkable plateaus or stretch this
source into tall walls. Current tall cliff/cap defaults remain. Terrain integration
owns the join/cap/depth/readability work, with no generic parent approval gate.

The current cloud testing/CI owner receives painted-ground renderer qualification
and capture execution; terrain integration retains that separate acceptance.
Mac testing was stopped by the user and is not a dependency. Retain the recorded
browser/HTTP blockers and owned acceptance backlog under the linked strategy.
Berries remains a distinct later slice once the oak receiving path has
ordinary-game evidence.
