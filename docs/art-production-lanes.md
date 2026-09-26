# Art production lanes

The [roadmap](roadmap.md) names long-running outcomes. These lanes divide the current asset backlog so more people can finish useful pieces in parallel. They are not a sequential approval chain or exclusive file ownership. Each maker may edit adjacent code and files needed to ship a small asset family, run proportionate checks, merge its own scoped PR under the standing staging authorization, and fix forward after auto deploy.

## Current runtime

The game uses painted ground textures and fixed-camera cutout sprites for most environment art, with repeated props instanced by the renderer. Units and buildings currently use instanced rigid parts; the [authored unit/building proposal](unit-building-art-output-proposal.md) explores Blender-authored GLBs and a shared painted atlas. A rigging and skinning specialist becomes useful if the game adopts skeletal deformation. It is not a prerequisite for more trees, terrain, buildings, or the current rigid-part motion.

## Who makes what

| Lane | Primary output | Natural collaborators |
| --- | --- | --- |
| Environment art | Ground and regional material sets, water and shorelines, large terrain landmarks | Maps for placement; vegetation for biome fit; renderer for display |
| Vegetation and world props | Reusable tree, shrub, rock, and resource families, variants, and relevant depletion states | Environment for palette; Maps for density and spacing; renderer for instancing |
| Character and building art | Unit and structure silhouettes, geometry, team accents, construction and damage variants, pose samples | Technical art for surfacing/export; renderer for runtime poses |
| Technical art and surfacing | Shared painted materials or atlases, UV and export conventions, asset manifests, repeatable previews and packaging checks | Asset makers for source examples; renderer for loader and batch behavior |
| Art direction | Style examples and concise feedback on the few changes that improve gameplay readability | All visual lanes; no standing signoff |
| Maps and scenarios | Placement, traversal, forest density, lakes and routes in playable maps | Environment and vegetation for reusable assets |
| Renderer and animation | Efficient runtime loading, instancing, visual-state mapping and camera-scale behavior | Asset makers for representative samples |

Concept design, modeling, UVs, texturing, rigging, animation, scene composition, lighting, VFX, UI art, and technical integration are distinct crafts. A task may cover several crafts for a small deliverable. Split a role further when its backlog and working asset format show a concrete benefit; do not require every asset to pass through every craft.

## Small, shippable outputs

- A vegetation slice can be a few compatible tree or shrub silhouettes, source files, runtime files, a simple manifest/provenance record, and one forest view at ordinary zoom. Maps can place them immediately.
- A terrain slice can be one water/shoreline treatment that reads on an authored map, with a source asset and runtime view.
- A surfacing slice can be one shared atlas and a repeatable UV/export/manifest path on a small sample. It should remove manual work for later assets; it is not a mandatory preflight service for other authors.
- A character or building slice can improve one role or structure at ordinary zoom and integrate the relevant runtime state, even while the rest of the pack is unfinished.

Use source assets, focused PRs, and named game-zoom captures as asynchronous shared state. Ask only an affected owner when a specific format, shader, placement rule, or conflicting edit blocks the current slice; include a proposed resolution and continue other work. Observe broader readability and 2,000-unit performance for milestone claims, without making them blanket PR merge gates. Respect any still-held user decision only for its named asset or action.
