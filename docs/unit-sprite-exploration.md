# Unit sprite exploration — 26 September 2026

## Recommendation

On 26 September 2026, the user selected painterly cutout sprites as the unit-art direction and asked to pause new 3D unit-art exploration. The normal game path still uses its current instanced 3D placeholders and role markers; this exploration adds an opt-in full-roster preview with `?unitSpritePreview=1` and a Worker-only v2 preview with `?workerSpritePreview=1`. Building-art choices remain a separate lane.

The choice fits the project's existing environment art: painted transparent cutouts already sit on camera-facing planes, and the battlefield uses a fixed oblique orthographic camera. A 2D illustration can spend its effort on silhouette, materials, and team accents without requiring the team to become proficient Blender modelers.

The work shifts rather than disappears. A sprite needs a consistent frame for every chosen facing and animation pose. The generated source atlases have six rows, with approximate eight-way views, two walk poses, role actions, and a defeated pose. Runtime metadata now records measured rectangles, pose bounds, ground pivots, action sequences, world bounds, and a grayscale team-accent mask. The art remains exploratory: facing consistency, action continuity, scale, and ordinary-zoom readability still need an in-game review.

## Evidence and implications

- World's Edge described *Age of Empires: Definitive Edition* as a 2D isometric engine that renders its 3D-made units into 2D images. The original used eight directions; the Definitive Edition used 32 and rendered assets at three zoom levels. This is useful precedent for the directional and zoom cost, not content to copy: [World's Edge, “Is it a 3D or a 2D game?”](https://www.ageofempires.com/news/age-empires-definitive-edition-3d-2d-game/).
- Three.js `Sprite` is a camera-facing plane with a transparent texture, which fits the current locked view: [Three.js Sprite](https://threejs.org/docs/pages/Sprite.html). Three.js textures support UV offset/repeat, and `InstancedMesh` reduces draw calls for repeated geometry/material pairs: [Texture](https://threejs.org/docs/pages/Texture.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).
- The existing unit batches do not have a per-instance atlas-frame selector. The next runtime slice needs an instanced quad atlas path with per-unit facing/state/frame data, or an equivalent frame-texture-array design. Creating one Three.js object per soldier would work against the large-army renderer.
- An eight-view set preserves recognizable turns better than a four-view set, but every added state multiplies the art frames. A 32-view set or separate zoom levels would multiply the atlas more; start with eight and measure before widening it.

## Sprite roster and animation check

Source-only eight-facing studies now cover all three unit roles: [Worker](../assets/units/worker-sprite-v1/README.md), [Infantry](../assets/units/infantry-sprite-v1/README.md), and [Archer](../assets/units/archer-sprite-v1/README.md). Each sheet has six rows: idle, two walk poses, role-specific action poses, and a defeated pose. The [animation test](../assets/units/sprite-animation-test.html) puts the three sheets on a small battlefield: Worker walks to gather/build sites, Infantry walks and thrusts at a practice post, and Archer walks, draws/releases, and repositions. It includes pause, replay, size/speed, and defeat controls.

The sheets include manifests, prompts, provenance, measured frame metadata, gray8 team-accent masks, and validation, following the building-art sample's source/manifest/preview/validation workflow. The source PNGs remain unchanged. The building sample's GLB material schema is not reused because its material bindings do not describe sprite frame grids. A second Worker source pass is parked at [`worker-sprite-v2`](../assets/units/worker-sprite-v2/README.md); it improves body mass at atlas scale but still has visible colored edge contamination and is not the runtime choice.

All three RGBA atlases are about 1.4 MB on disk apiece. Their combined decoded pixel buffer is about 18.0 MiB; the three gray8 team masks add about 4.5 MiB. The zero-gutter pilot uses linear filtering without mipmaps and applies a shared half-texel UV inset to color/mask pages; inspect for aliasing at strategic zoom. Mask recoloring avoids storing baked images for both teams. Atlas memory, alpha overdraw, filtering, and batching need a measured runtime comparison before claiming a performance benefit.

## Local game preview — 26 September 2026

The local renderer has two opt-in atlas previews: `?unitSpritePreview=1` replaces Worker, Infantry, and Archer with batched camera-facing v1 sprites, while `?workerSpritePreview=1` replaces only Workers with the newer v2 pack. The normal game URL keeps the existing unit presentation. Fog filtering continues to come from each unit's visibility state. The atlas runtime maps facing, walking, role action, and defeat to directional clips. Team/role LOD glyphs remain visible below zoom 0.6 while strategic sprite readability is being evaluated.

An all-role `renderer-appearance-lod` capture now covers Meadow and Cinder, both teams, and zooms 0.91 and 0.48: [capture manifest](../assets/generated/.game-dev/runs/run_unit_sprite_roster_markers_20260926/capture.json), [Meadow/Azure at play zoom](../assets/generated/.game-dev/runs/run_unit_sprite_roster_markers_20260926/frames/01-meadow-azure-zoom-091.png), and [Cinder/Ember at strategic zoom](../assets/generated/.game-dev/runs/run_unit_sprite_roster_markers_20260926/frames/08-cinder-ember-zoom-048.png). All three sprite atlases load in the actual game renderer for both fog-filtered clients. The wide 64×64 review map makes the sprites small at play zoom; strategic team/role glyphs remain as a fallback. This capture is static and does not verify movement or action transitions, and it is not a performance measurement.

The Worker v2 route was also opened in the local game at `?workerSpritePreview=1`; it reaches the renderer without atlas-loader warnings. This verifies the opt-in integration path, not action animation quality. The current map composition is zoomed far out, so judge the sheet at a closer play view; live movement, gathering/building, and defeat still need a focused capture.

## Next production slice

1. Review Worker v2's scale, ground pivot, facing, team tint, and alpha edge in the game renderer at both zooms and against light and dark terrain. Its game preview is opt-in; `runtimeReady` remains false until the edge and estimated pivots are reviewed.
2. Observe walking, Worker gather/build, military attacks, and defeat transitions under live orders; extend the two-frame walk or action sequences where the game view needs more motion.
3. Measure a 2,000-unit browser run before attributing a speedup to sprites. Blender is not a prerequisite for new unit art.

The paused GLB unit exploration remains separate. Existing files are retained as historical samples; this sprite pilot does not make a runtime production switch until the integrated art is visible and reviewed in game.

## Resume checkpoint

- **Direction:** continue with painterly directional sprites for units. This fits the fixed oblique camera and avoids making Blender modeling a prerequisite.
- **Ready to inspect:** the three source atlases and [`sprite-animation-test.html`](../assets/units/sprite-animation-test.html) show all roles walking and performing their main actions. The page is an illustrative mock battlefield, not proof of game behavior.
- **In-game scope:** `?workerSpritePreview=1` opts only the Worker into the batched renderer using Worker v2. `?unitSpritePreview=1` previews all three roles using their v1 packs. Both flags leave the normal game path unchanged, and the role/version map in `src/main.js` keeps the two comparisons independent. The server allowlist exposes only the required atlas/runtime/mask files.
- **What looks promising:** eight directional columns preserve more turns than four, role equipment reads in the sheets, gray8 masks separate team color from the authored art, and deterministic packing makes frame/pivot metadata repeatable.
- **What remains weak:** eight facings are approximate, walk loops have only two frames, action poses are short/static, and direction-to-direction anatomy is not perfectly consistent. The 64×64 all-role v1 capture reads small at play zoom; the Worker v2 pass has conspicuous colored edge contamination and estimated pivots. No 2,000-unit performance claim has been measured.
- **Next decision:** judge Worker v2 inside the game at ordinary and strategic zoom, then correct its alpha edge and pivot estimates before changing the default renderer. Do not describe it as production-ready until that visual review is done.
- **Repeatable pack check:** `node scripts/validate-unit-sprite-atlas.mjs assets/units/<role>-sprite-v1/manifest.json`; run the same validator against `assets/units/worker-sprite-v2/manifest.json` for the Worker v2 experiment.
- **Merge checkpoint:** current `main` (`53a1aff`, #153) is merged into local branch `codex/unit-sprite-exploration-20260926` at `627d4cd`; the earlier refresh at `21d31934` is recorded at `276ff26`. The branch and commits remain local: the GitHub connection reports `pull: true` and `push: false` for this repository, and there is no published PR. Repository write access is the remaining prerequisite; once enabled, publish and merge this branch under the existing staging authorization.
