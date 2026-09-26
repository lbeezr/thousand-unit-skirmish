# Unit sprite exploration — 26 September 2026

## Recommendation

Explore illustrated cutout sprites as the default **unit art output** for this fixed-camera game. Keep the current 3D unit renderer as the live baseline while the art sample proves its appearance and animation contract. This changes the art exploration, not the running game.

The choice fits the project's existing environment art: painted transparent cutouts already sit on camera-facing planes, and the battlefield uses a fixed oblique orthographic camera. A 2D illustration can spend its effort on silhouette, materials, and team accents without requiring the team to become proficient Blender modelers.

The work shifts rather than disappears. A sprite needs a consistent frame for every chosen facing and animation pose. The generated Infantry sheet in [`assets/units/infantry-sprite-v1`](../assets/units/infantry-sprite-v1/README.md) looks promising as a painted character, but its prompt requested seven rows and the result has six; its walk loop has only two poses, and frame orientation, pivots, and team variants are not production-ready. Animation continuity is the main art risk.

## Evidence and implications

- World's Edge described *Age of Empires: Definitive Edition* as a 2D isometric engine that renders its 3D-made units into 2D images. The original used eight directions; the Definitive Edition used 32 and rendered assets at three zoom levels. This is useful precedent for the directional and zoom cost, not content to copy: [World's Edge, “Is it a 3D or a 2D game?”](https://www.ageofempires.com/news/age-empires-definitive-edition-3d-2d-game/).
- Three.js `Sprite` is a camera-facing plane with a transparent texture, which fits the current locked view: [Three.js Sprite](https://threejs.org/docs/pages/Sprite.html). Three.js textures support UV offset/repeat, and `InstancedMesh` reduces draw calls for repeated geometry/material pairs: [Texture](https://threejs.org/docs/pages/Texture.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).
- The existing unit batches do not have a per-instance atlas-frame selector. A production sprite route would need an instanced quad atlas path with per-unit facing/state/frame data, or an equivalent frame-texture-array design. Creating one Three.js object per soldier would work against the large-army renderer.
- An eight-view set preserves recognizable turns better than a four-view set, but every added state multiplies the art frames. A 32-view set or separate zoom levels would multiply the atlas more; start with eight and measure before widening it.

## First sample

The [Infantry atlas](../assets/units/infantry-sprite-v1/infantry-atlas-source.png) is a source-only 8-column, 6-row study: idle, two walk poses, attack wind-up, attack strike, and defeated corpse. The pack includes a manifest, prompt/provenance notes, and an interactive frame preview, following the building-art sample's source/manifest/preview/validation workflow. The building sample's GLB material schema is not reused because its material bindings do not describe sprite frame grids.

The sheet is transparent RGBA and about 1.4 MB as a PNG. Its decoded pixel buffer is about 6.0 MiB before mipmaps, roughly 8.0 MiB with a full mip chain. That is just one role/team sheet. Atlas memory, alpha overdraw, filtering, and batching need a measured runtime comparison before claiming a performance benefit.

## Next production slice

1. Correct and inspect the eight facing columns and the frame pivots; confirm the soldier still reads at the game's ordinary and strategic zooms.
2. Make a longer walk cycle and separate strike, hit, defeat, and corpse states. Decide whether Azure/Ember use baked variants or a shared accent mask.
3. Expand only after the Infantry sheet and one browser preview establish a repeatable 2D source workflow. Do not require Blender as the source tool.
4. If the sample holds up, integrate a small mixed-role runtime slice with an atlas selector and compare it against current instanced units at ordinary zoom. Measure a 2,000-unit browser run before attributing a speedup to sprites.

The paused GLB exploration remains source-only in its own worktree. This pilot does not move, delete, publish, or merge that pack and does not make a production switch for unit rendering.
