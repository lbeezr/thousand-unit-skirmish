# Art production lanes

The [roadmap](roadmap.md) names long-running outcomes. These lanes divide the current asset backlog so more people can finish useful pieces in parallel. They are not a sequential approval chain or exclusive file ownership. Each maker may edit adjacent code and files needed to ship a small asset family, run proportionate checks, merge its own scoped PR under the standing staging authorization, and fix forward after auto deploy.

## Current runtime

The game uses painted ground textures and fixed-camera cutout sprites for most environment art, with repeated props instanced by the renderer. New unit-character art follows the user's painterly sprite direction. Opt-in atlas previews are available with `?workerSpritePreview=1` for Worker v2 and `?unitSpritePreview=1` for all three v1 roles; the normal game path remains unchanged while the roster view is reviewed. Existing GLB samples remain separate historical/building-art material. Buildings continue in their own lane. A rigging and skinning specialist is not a prerequisite for the sprite unit path.

## Who makes what

| Lane | Primary output | Natural collaborators |
| --- | --- | --- |
| Environment art | Ground and regional material sets, water and shorelines, large terrain landmarks | Maps for placement; vegetation for biome fit; renderer for display |
| Vegetation and world props | Reusable tree, shrub, rock, and resource families, variants, and relevant depletion states | Environment for palette; Maps for density and spacing; renderer for instancing |
| Unit character art | Worker, Infantry, and Archer painterly directional atlases, equipment, gray8 team-accent masks, and action poses | Technical art for frame metadata and masks; renderer for batched runtime animation |
| Building architecture art | Town Center, Barracks, and Archery Range geometry, ownership cues, construction and damage variants | Technical art for materials/export; renderer for runtime states |
| Technical art and surfacing | Frame and pivot metadata, tint masks, asset manifests, repeatable previews and packaging checks | Asset makers for source examples; renderer for loader and batch behavior |
| Art direction | Style examples and concise feedback on the few changes that improve gameplay readability | All visual lanes; no standing signoff |
| Maps and scenarios | Placement, traversal, forest density, lakes and routes in playable maps | Environment and vegetation for reusable assets |
| Renderer and animation | Efficient runtime loading, instancing, visual-state mapping and camera-scale behavior | Asset makers for representative samples |

Concept design, modeling, UVs, texturing, rigging, animation, scene composition, lighting, VFX, UI art, and technical integration are distinct crafts. A task may cover several crafts for a small deliverable. Split a role further when its backlog and working asset format show a concrete benefit; do not require every asset to pass through every craft.

## Small, shippable outputs

- A vegetation slice can be a few compatible tree or shrub silhouettes, source files, runtime files, a simple manifest/provenance record, and one forest view at ordinary zoom. Maps can place them immediately.
- A terrain slice can be one water/shoreline treatment that reads on an authored map, with a source asset and runtime view.
- A surfacing slice can be one shared atlas and a repeatable UV/export/manifest path on a small sample. It should remove manual work for later assets; it is not a mandatory preflight service for other authors.
- A unit slice can deliver a manifest-driven Worker/Infantry/Archer sprite pilot with a representative game-zoom view; new unit GLBs are paused by the current art direction.
- A building sprite slice can establish one complete building design, then derive its construction and damage frames on a shared world grid. Follow the [building sprite production workflow](building-sprite-production-workflow.md) for the complete-first design, state review, and reproducible pack. The original Worker/Barracks v0.2 source sample is cleared for a focused PR with its known limits; it does not need to claim the full M2 appearance or M3 performance milestone.

Merge useful source samples before their runtime loader or final visual treatment is finished; state that limit in the PR and continue with the next slice. Runtime integration uses the applicable manifest and proportionate local validation; milestone captures and large-match measurements remain separate claims. Do not silently hold an asset pack for polish, a preview window, or another lane's future integration.

Use source assets, focused PRs, and named game-zoom captures as asynchronous shared state. Ask only an affected owner when a specific format, shader, placement rule, or conflicting edit blocks the current slice; include a proposed resolution and continue other work. Observe broader readability and 2,000-unit performance for milestone claims, without making them blanket PR merge gates. Respect any still-held user decision only for its named asset or action.
