# Unit sprite exploration — 26 September 2026

## Recommendation

On 26 September 2026, the user selected painterly cutout sprites as the unit-art direction and asked to pause new 3D unit-art exploration. The live game still uses its current instanced 3D placeholders and role markers until the sprite renderer is integrated; this decision has not switched runtime assets yet. Building-art choices remain a separate lane.

The choice fits the project's existing environment art: painted transparent cutouts already sit on camera-facing planes, and the battlefield uses a fixed oblique orthographic camera. A 2D illustration can spend its effort on silhouette, materials, and team accents without requiring the team to become proficient Blender modelers.

The work shifts rather than disappears. A sprite needs a consistent frame for every chosen facing and animation pose. The generated source atlases have six rows, with approximate eight-way views, two walk poses, role actions, and a defeated pose. Runtime metadata now records measured rectangles, pose bounds, ground pivots, action sequences, world bounds, and a grayscale team-accent mask. The art remains exploratory: facing consistency, action continuity, scale, and ordinary-zoom readability still need an in-game review.

## Evidence and implications

- World's Edge described *Age of Empires: Definitive Edition* as a 2D isometric engine that renders its 3D-made units into 2D images. The original used eight directions; the Definitive Edition used 32 and rendered assets at three zoom levels. This is useful precedent for the directional and zoom cost, not content to copy: [World's Edge, “Is it a 3D or a 2D game?”](https://www.ageofempires.com/news/age-empires-definitive-edition-3d-2d-game/).
- Three.js `Sprite` is a camera-facing plane with a transparent texture, which fits the current locked view: [Three.js Sprite](https://threejs.org/docs/pages/Sprite.html). Three.js textures support UV offset/repeat, and `InstancedMesh` reduces draw calls for repeated geometry/material pairs: [Texture](https://threejs.org/docs/pages/Texture.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).
- The existing unit batches do not have a per-instance atlas-frame selector. The next runtime slice needs an instanced quad atlas path with per-unit facing/state/frame data, or an equivalent frame-texture-array design. Creating one Three.js object per soldier would work against the large-army renderer.
- An eight-view set preserves recognizable turns better than a four-view set, but every added state multiplies the art frames. A 32-view set or separate zoom levels would multiply the atlas more; start with eight and measure before widening it.

## Sprite roster and animation check

Source-only eight-facing studies now cover all three unit roles: [Worker](../assets/units/worker-sprite-v1/README.md), [Infantry](../assets/units/infantry-sprite-v1/README.md), and [Archer](../assets/units/archer-sprite-v1/README.md). Each sheet has six rows: idle, two walk poses, role-specific action poses, and a defeated pose. The [animation test](../assets/units/sprite-animation-test.html) puts the three sheets on a small battlefield: Worker walks to gather/build sites, Infantry walks and thrusts at a practice post, and Archer walks, draws/releases, and repositions. It includes pause, replay, size/speed, and defeat controls.

The sheets include manifests, prompts, provenance, previews, measured frame metadata, gray8 team-accent masks, and validation, following the building-art sample's source/manifest/preview/validation workflow. The source PNGs remain unchanged. The building sample's GLB material schema is not reused because its material bindings do not describe sprite frame grids.

All three RGBA atlases are about 1.4 MB on disk apiece. Their combined decoded pixel buffer is about 18.0 MiB; the three gray8 team masks add about 4.5 MiB. The zero-gutter pilot uses linear filtering without mipmaps and applies a shared half-texel UV inset to color/mask pages; inspect for aliasing at strategic zoom. Mask recoloring avoids storing baked images for both teams. Atlas memory, alpha overdraw, filtering, and batching need a measured runtime comparison before claiming a performance benefit.

## Next production slice

1. Integrate the manifest-driven sprite consumer for the current Worker, Infantry, and Archer atlases so players can see the art in the game. Start at play zoom with walking, role actions, facing changes, and defeat; keep strategic role/team markers until their replacement reads at that scale.
2. Capture both teams at ordinary and strategic zoom, then correct the visible scale, pivot, facing, and tint issues from the actual game view.
3. Replace the two-frame walk with a longer cycle and add temporal gather/build/attack, hit, and spawn transitions after the in-game pilot proves its runtime frame selection.
4. Measure a 2,000-unit browser run before attributing a speedup to sprites. Blender is not a prerequisite for new unit art.

The paused GLB unit exploration remains separate. Existing files are retained as historical samples; this sprite pilot does not make a runtime production switch until the integrated art is visible and reviewed in game.
