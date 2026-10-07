# Source organization inventory — 7 October 2026

Baseline: `7df6b20404b3e480c6b1a4a82f8adfcac5c1f02c`. Local and fetched
`origin/main` matched that revision before editing. This is dated source evidence,
not a second roadmap. The [conventions](source-organization.md) own new-file placement; the
[complete inventory](source-organization-inventory-2026-10-07.json) retains each root
file's domain, role, proposed destination, actual runtime importers, entrypoint
paths, tool/test mentions and inspected call/flag evidence. No private model or
Blender source is included.

## What is at the root?

| Baseline root content | Files | After the five-policy migration |
| --- | ---: | ---: |
| Implementation modules, excluding forwarding entries and generated descriptors | 160 | 155 |
| Forwarding-only compatibility modules | 21 | 21 |
| Generated asset descriptors | 6 | 6 |
| Stylesheets | 5 | 5 |
| Total | 192 | 187 |

The move transfers five complete policy bodies (459 physical lines) into
`src/simulation/ai/policies/`. It adds no forwarding stub. The five import changes
in `src/pve-opponent.mjs` and thirteen script import changes retain the same
implementations, exports and real callers. Opponent orchestration and production
stay in place. Policies do not pin an implementation version merely because
their disclosed observation has a schema version.

Forwarding-only modules are counted from their parsed export-only bodies, not
from names. They retain supported-path obligations recorded in architecture;
zero current runtime consumers alone does not authorize removing a public path.
The six generated descriptors have explicit Python producers that write/check
the exact output paths. They are not counted as handwritten implementations.

## How roles were established

The inventory combines Acorn parsing of literal static, re-export and lazy
imports; the five registered shipped HTML entries; both Node hosts; the separate
local `building-map.js` entry; exact runtime domain memberships; Python descriptor
producers; script consumers; actual call sites and query/mode conditions.
`index.html` runs `game-entry.mjs`, which lazily imports `main.js` for a game URL.
`npm start` runs `room-supervisor.mjs`, which starts `server.mjs` match workers.
`Dockerfile` copies all of `src/` plus the five shipped HTML pages; the exact
client allowlist governs public HTTP access. A packaged module is not necessarily
public, active, or visible. The JSON's “shipped default runtime” label describes
normal loading reachability; default invocation requires its explicit call/flag
evidence and can remain content-dependent. Filename/script mentions are weaker
evidence than an import or call, and are recorded as such.

Baseline role counts (including stylesheets) are 137 normally loaded runtime
files, 11 optional shipped features, 12 editor/tool files, three study files,
21 compatibility entries, six generated descriptors, and two unknowns. No root
file was established as a test fixture or genuinely unreferenced. The unknown
files are `building-production-cue.mjs` and `painted-material-atlas.mjs`: neither
is reachable from the audited runtime entries, and tools/tests still mention
them. They are retained; absence from this graph does not prove dead code.

## Which map and forest code does the game use?

| Code | Observed role and consumer |
| --- | --- |
| `map-utils.mjs`, `map-size-policy.mjs`, `regions.mjs`, `scenario-regions.mjs` | Shared shipped runtime metadata/topology/validation. Server and client consume these; map-utils also retains named world-contract forwarding exports. |
| `map-studio-viewport.mjs`, `terrain-authoring.mjs`, resource brush/cluster, landscape and settlement authoring | Editor/generator code. The game imports the editor helpers; `scripts/build-vaelora-maps.mjs` directly consumes landscape/settlement generators outside shipped runtime closures. Ordinary simulation does not become an editor consumer. `resource-cluster-authoring.mjs` is reserved to resource owner `01a11678-18d5-7456-9304-f96d8cd6f005` for its seeded-placement fix. |
| Root `map-resize.mjs`, `scenario-authoring.mjs` | Deliberate compatibility entries. Actual main editor consumers use canonical `src/authoring/` implementations. |
| `forest-fringe.mjs` | Server vision uses `exploredForestFringe` for reachable forest-edge disclosure. Gameplay runtime. |
| `forest-gather-group.mjs` | Server initializes/restores groups and selects visible gather candidates. Worker gameplay runtime. |
| `forest-habitat.mjs`, `forest-composition.mjs` | Real Underbough forest rendering through `environment-art`. Composition uses mosaic by default, with `forestSpecies=groves` comparison; `forestEdges=layered` selects margin treatment. |
| `forest-lifecycle-atlas.mjs` | Real forest resource-state art selection through environment directional-resource binding. |
| `forest-age-composition.mjs` | Optional shipped rendering helper called only for Underbough with `forestAges=irregular|young`. `forestAges=pockets` is another host branch. |
| `water-surface-study.mjs`, `water-study-state.mjs`, `water-study-fish-binding.mjs` | Default playable water rendering and live fish disclosure binding on water maps. `ground-surfaces` invokes the renderer; `waterSurfaceOptions` defaults to study quality and `waterQuality=low` requests fallback. They cannot be classified as disposable studies from their names. |
| `sheep-static-preview.mjs`, `frontier-building-preview.mjs` | Normal runtime binding despite preview names: visible idle Sheep and default Complete building manifests. Explicit building preview parameters remain comparison overrides. |

No map, forest, terrain, resource, audio-runtime or building-art implementation is
moved in this slice. The reserved resource module and its tests are unchanged.

## Separately runnable pages

| Page | Entry and purpose | Release status |
| --- | --- | --- |
| `index.html` | `src/game-entry.mjs` → lazy `src/main.js`; normal game/menu/embedded Map Studio. | Shipped. |
| `environment-review.html` | `src/environment-review.mjs` → `environment-pilot.mjs`; independent cliff comparison. | Shipped separate study page. Proposed `src/studies/environment/`; not moved here. |
| `water-study.html` | `src/water-study-preview.mjs`; independent configurable water scene using production water modules. | Shipped separate study page. Only page-specific orchestration belongs in `src/studies/water/`. |
| `audio-studio.html` | `src/audio-studio.mjs`; library/composition authoring. | Shipped separate tool page. |
| `audio-zones.html` | `src/audio-zones.mjs`; regional listening/audition. | Shipped separate tool page. |
| `building-map.html` | Root `building-map.js`; standalone local building-art catalog/editor with no module imports. | Not copied by Docker; local tool, not a served release page. |

These are source/entrypoint findings, not a claim that a browser rendered them
in this executor. No visual acceptance or provider deployment is claimed.

## Proposed next batches and ownership

| Batch | Coherent home | Owner and boundary |
| --- | --- | --- |
| Five disclosed-observation AI policies (this slice) | `src/simulation/ai/policies/` | Organization owner; no policy tuning, production logic or movement. Exact AI domain membership and retired-root guards move with real callers. |
| Remaining AI production/orchestration | `src/simulation/ai/` | PvE owner; separate from the recently completed observation projection and current first-Barracks/content work. Agree active files before moving. |
| Shared map metadata/topology and forest gather/disclosure | `src/world/`, `src/simulation/economy/` | Map/resource owner `01a11678-18d5-7456-9304-f96d8cd6f005`; audit only here, preserve current seeded-placement/continuation files and tests. |
| Map/terrain generators and gestures | `src/authoring/<feature>/` | Authoring/resource owners; reserve active resource-cluster and editor-recovery work. Stable map-resize/scenario aliases have separate retirement obligations. |
| Forest/water environment rendering | `src/presentation/rendering/<feature>/`, descriptors in `presentation/assets/` | Renderer/resource owners; preserve default water rendering, query comparisons, asset URLs, caches, disposal and real appearance proof. |
| Standalone environment/water page controllers | `src/studies/environment/`, `src/studies/water/` | Study/renderer owners; keep shared production renderer dependencies in production homes and update HTML, HTTP, package and browser closure together. |
| Client input/entry/lobby helpers | `src/client/<input|entry|lobby>/` | Respective control/entry owners; current HUD and completed room/session contracts remain outside this slice. Preserve all public-path obligations. |
| Remaining server adapters | `src/server/<transport|persistence|orchestration>/` | Server/transport owners; do not repeat completed room-index/output/checkpoint boundaries or change security and access policy. |
| Generated descriptors and compatibility retirement | Existing asset feature homes and explicit old entries | Asset/API owners must update producers, URLs and real consumers before a separate retirement; six generated descriptors and 21 root aliases are retained here. |

These are proposed destinations, not grants to move active files. Root reduction
counts migrated implementation separately from retained aliases. The conventions
apply to new work; later batches require their actual consumers and owner inputs.

## Publication and integration evidence

Open-PR inspection in this executor failed with
`Post "https://api.github.com/graphql": Forbidden`. That action stopped; no
alternate API/read route was used. The normal Git fetch separately succeeded
and confirmed the source baseline. Open-PR overlap and remote draft creation
remain unavailable here until access is restored through the authorized route.
Exact-head tests, independent review, release digest and any separate Git branch
publication receipt belong to the owned task/PR result; none imply source merge,
provider deployment, served identity or actual game/rendered verification.
