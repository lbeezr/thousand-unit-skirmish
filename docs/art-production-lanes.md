# Art production lanes

The [roadmap](roadmap.md) names long-running outcomes. These lanes divide the current asset backlog so more people can finish useful pieces in parallel. They are not a sequential approval chain or exclusive file ownership. Each maker may edit adjacent code and files needed to ship a small asset family, run proportionate checks, merge its own scoped PR under the standing staging authorization, and fix forward after auto deploy.

## Current runtime

The game uses painted ground textures and fixed-camera cutout sprites for most environment art. The current unit/building renderer and existing GLB packs remain available as references. New unit and building art uses painterly 2D/2.5D sprites under the [sprite atlas contract](sprite-atlas-contract-v1.md); do not start new Blender, UV, or GLB production. The historical [unit/building format proposal](unit-building-art-output-proposal.md) is superseded for new production.

## Who makes what

| Lane | Primary output | Natural collaborators |
| --- | --- | --- |
| Environment art | Ground and regional material sets, water and shorelines, large terrain landmarks | Maps for placement; vegetation for biome fit; renderer for display |
| Vegetation and world props | Reusable tree, shrub, rock, and resource families, variants, and relevant depletion states | Environment for palette; Maps for density and spacing; renderer for instancing |
| Unit character art | Painterly Worker, Infantry, and Archer sprite silhouettes, equipment, team cues, directional poses, and named action states | Technical art for manifest and masks; renderer for frame selection and batches |
| Building architecture art | Painterly Town Center, Barracks, and Archery Range sprites with ownership, construction, and damage states | Technical art for manifest and layers; renderer for state mapping and occlusion |
| Technical art and surfacing | Shared sprite page/manifest contract, image integrity, explicit frame geometry, optional team masks/layers, repeatable previews | Asset makers for pilots; renderer for loader and batch behavior |
| Art direction | Style examples and concise feedback on the few changes that improve gameplay readability | All visual lanes; no standing signoff |
| Maps and scenarios | Placement, traversal, forest density, lakes and routes in playable maps | Environment and vegetation for reusable assets |
| Renderer and animation | Efficient runtime loading, instancing, visual-state mapping and camera-scale behavior | Asset makers for representative samples |

Concept design, painting, sprite layout, animation, scene composition, lighting, VFX, UI art, and technical integration are distinct crafts. A task may cover several crafts for a small deliverable. Split a role further when its backlog and working asset format show a concrete benefit; do not require every asset to pass through every craft.

## Small, shippable outputs

- A vegetation slice can be a few compatible tree or shrub silhouettes, source files, runtime files, a simple manifest/provenance record, and one forest view at ordinary zoom. Maps can place them immediately.
- A terrain slice can be one water/shoreline treatment that reads on an authored map, with a source asset and runtime view.
- A technical-art slice is the shared sprite manifest/schema plus image-hash, page-dimension, frame-rectangle, pivot, and preview tooling. It must accept explicit uneven rectangles and must not impose a grid, canvas size, state list, or direction count.
- A unit slice can make Infantry or Archer recognizable at ordinary zoom and include painted source, a source-only sprite manifest, full cutout fallback frames, and explicit state/direction samples. Use pilot evidence to choose dimensions and counts.
- A building slice can show a distinct construction or damage progression with a full transparent cutout fallback per state, optional ordered occlusion layers, and occupancy/art/culling/sort/height data recorded separately.

Merge useful source samples before runtime integration or final visual treatment is finished; state that limit in the PR and continue with the next slice. Runtime integration uses the sprite manifest and proportionate local validation; milestone captures and large-match measurements remain separate claims. Keep existing GLB packs and runtime work intact as references. Do not edit the specifically held unit/building pack or conduct the held berry candidate capture.

Use source assets, focused PRs, and named game-zoom captures as asynchronous shared state. Ask only an affected owner when a specific format, shader, placement rule, or conflicting edit blocks the current slice; include a proposed resolution and continue other work. Observe broader readability and 2,000-unit performance for milestone claims, without making them blanket PR merge gates. Respect any still-held user decision only for its named asset or action.
