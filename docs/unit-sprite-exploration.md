# Unit sprite exploration — 26 September 2026

## Recommendation

On 26 September 2026, the user selected painterly cutout sprites as the unit-art direction and asked to pause new 3D unit-art exploration. The normal game path still uses its current instanced 3D placeholders and role markers; this exploration adds an opt-in Worker preview with `?workerSpritePreview=1`. Building-art choices remain a separate lane.

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

The first Worker atlas consumer is wired into the local renderer. Add `?workerSpritePreview=1` to the game URL to replace only Workers with batched camera-facing sprites at both play and strategic zoom; Infantry and Archer retain the current renderer. The normal game URL keeps the existing unit presentation. Fog filtering continues to come from the current unit visibility state. Worker facing, walking, gathering/building, and defeat select the matching directional atlas clips.

The `renderer-appearance-lod` game-dev run completed on both Meadow and Cinder, for Azure and Ember clients at zoom 0.91 and 0.48: [capture manifest](../assets/generated/.game-dev/runs/run_1790448685854_c83d72220eb843e2ac0630e70ce256d5/capture.json), [Meadow at play zoom](../assets/generated/.game-dev/runs/run_1790448685854_c83d72220eb843e2ac0630e70ce256d5/frames/01-meadow-azure-zoom-091.png). This confirms the earlier Worker pack rendered in the actual game camera at both zooms while other roles kept their current presentation. The capture predates the broadened Worker garment-tint mask and remains static; it does not verify movement or action transitions. The current opt-in wiring maps Worker facing, walking, gathering/building, and defeat to directional clips, but the updated tint and transitions still need a fresh in-game capture.

## Next production slice

1. Review Worker scale, ground pivot, facing, and team tint in the local game view; compare both teams against light and dark terrain before widening the pilot. Keep v2 out of the renderer until its edge contamination is cleaned up.
2. Observe walking and gather/build transitions during orders, then extend the two-frame walk or work poses where the game view needs more motion. Capture military attacks and defeat when enabling the other roles.
3. Measure a 2,000-unit browser run before attributing a speedup to sprites. Blender is not a prerequisite for new unit art.

The paused GLB unit exploration remains separate. Existing files are retained as historical samples; this sprite pilot does not make a runtime production switch until the integrated art is visible and reviewed in game.

## Resume checkpoint

- **Direction:** continue with painterly directional sprites for units. This fits the fixed oblique camera and avoids making Blender modeling a prerequisite.
- **Ready to inspect:** the three source atlases and [`sprite-animation-test.html`](../assets/units/sprite-animation-test.html) show all roles walking and performing their main actions. The page is an illustrative mock battlefield, not proof of game behavior.
- **In-game scope:** `?workerSpritePreview=1` opts only Workers into the batched atlas renderer. Infantry and Archer still use the existing presentation; the normal URL is unchanged. The Worker v1 pack is the pilot input.
- **What looks promising:** eight directional columns preserve more turns than four, role equipment reads in the sheets, gray8 masks separate team color from the authored art, and deterministic packing makes frame/pivot metadata repeatable.
- **What remains weak:** eight facings are approximate, walk loops have only two frames, action poses are short/static, and direction-to-direction anatomy is not perfectly consistent. The Worker v2 pass has conspicuous colored edge contamination. No 2,000-unit performance claim has been measured.
- **Next decision:** look at the opt-in Worker in a fresh game capture at play and strategic zoom, then decide whether to clean/revise the source and integrate the military roles or leave this as a source-art direction checkpoint. Do not describe it as the production renderer until that visual review is done.
- **Repeatable pack check:** `node scripts/validate-unit-sprite-atlas.mjs assets/units/<role>-sprite-v1/manifest.json`; use `worker-sprite-v2/manifest.json` only to inspect that parked alternative.
