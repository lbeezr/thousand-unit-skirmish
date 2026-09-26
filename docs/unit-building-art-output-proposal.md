# Unit and building art format and finish review

**Status:** the former unit recommendation below is superseded. On 26 September 2026, the user chose painterly sprites for new unit-character art because the current Blender modeling route is too difficult for the team. The live game still uses its existing instanced 3D placeholders until sprite runtime integration lands. This choice does not change the building-art lane. The v0.2.0 Worker/Barracks GLB remains a source-review sample, not a production unit target.

## Recommendation

For unit characters, use painterly transparent atlases with eight approximate directions, explicit per-pose frame rectangles, stable ground pivots, role actions, and a team-accent mask. The first sheets are source art with a manifest-driven runtime contract; the game has not switched yet. Buildings remain a separate choice and can continue their own authored geometry work.

Keep equipment neutral and recolor only the sash: the source sheet stays Azure, and its aligned gray8 mask marks pixels where the runtime applies the team hue while retaining source luminance and alpha. Building standards remain under the separate building-art contract. Silhouette, pose, pivot stability, and strong value regions matter more than surface noise at ordinary zoom.

The current v1 GLBs are a geometry and batching experiment, not the target finish. A texture map by itself will not settle the question: review the ordinary game-zoom capture over the real environment.

## Evidence from this project

- [`docs/environment-pack-v1.md`](environment-pack-v1.md) describes a fixed oblique view over textured ground with painterly transparent cutouts. The source `oak.webp`, `pine.webp`, `rock-outcrop.webp`, and `seamstone.webp` have painted value and material detail unlike the v1 meshes.
- [`src/environment-art.mjs`](../src/environment-art.mjs) creates those assets on camera-facing textured planes and batches repeated props with `THREE.InstancedMesh`.
- Read-only GLB inspection reports 416 triangles for the Worker asset and 524 for the Barracks, with two materials and zero textures in each. The existing preview README records the Worker at about 12 pixels high at gameplay zoom 0.91 and 6 pixels at strategic zoom 0.48.
- In the rendered meadow preview, the Worker collapses into a small color cluster at play zoom and the Barracks reads as a plain shed. The close-camera frames expose the geometry, but cannot establish fit at ordinary zoom.
- The meshes already have vertex-color attributes and UV coordinates, but the v1 UV assignment is coordinate-projected rather than a packed painted material atlas. The proposed atlas needs deliberate UV islands and a texture-sharing rule in the manifest/renderer contract.

## Earlier painted 3D treatment proposal

A small painted atlas can harmonize the live GLBs without trying to reproduce every detail of a 1024-pixel oak cutout on a 12-pixel unit. Use broad, hand-painted swatches for wool, leather, skin, timber, slate, stone, and iron, with one consistent light direction, soft baked occlusion, and restrained edge wear. The atlas should carry low-frequency brush variation; vertex colors should retain the large color blocks and per-face light/shadow shapes that survive downsampling. Preserve matte, unlit shading to avoid adding a specular style the environment images do not use.

Use one 512×512 or 1024×1024 RGBA8 atlas for the first shared material set. With a complete mip chain that is about 1.33 MiB or 5.33 MiB of uncompressed GPU memory, respectively. Share it across all unit part batches and the building materials; keep the team sash/pennants in their designated accent slots. This adds a small, bounded memory cost while retaining the present projected unit budget of eight part bins × two teams (16 batches) and the current Barracks projection of nine structure draw calls. The actual imported GLB path still needs a 2,000-unit runtime measurement; the existing movement benchmark measures the procedural renderer, not these authored GLBs.

At game zoom, silhouette, pose, and large value/color regions matter more than texture grain. The Worker needs a readable head/body/tool/backpack outline; buildings need distinct rooflines, entrances, and construction silhouettes. Enlarged close views are useful for craft checks only. Strategic zoom keeps the role silhouette and team cue in the renderer-owned LOD at the same world scale.

## Selected unit runtime direction

The current source atlases provide eight approximate directions, explicit frame bounds and pivots, two walk frames, role actions, and defeat poses. This matches the environment's cutout medium and avoids requiring Blender modeling for new unit art, while changing runtime direction/state handling:

- Live units currently turn to the continuous `unit.angle` every update and animate walk, work, attack, hit, spawn, and defeat by changing rigid-part transforms. A sprite pack must quantize facing to a chosen number of views (for example 8, 16, or 32), then bake each required action into directional frames. Low direction counts can visibly pop as units turn; more directions and animation frames multiply atlas cells.
- Team hue must not tint the whole sprite. The pilot's aligned grayscale mask uses black to preserve source RGB and white to apply the full team hue while preserving luminance and alpha.
- The environment helper currently batches one fixed image per `InstancedMesh`; it has no per-instance atlas-frame selector. A compact animated army would need an instanced quad atlas with a per-instance frame/facing selector in a custom shader or texture-array path. Without that, splitting batches by role × team × facing × state can grow draw calls sharply.
- Texture memory grows with directions × action frames × roles × team variants × pixel dimensions. As a simple lower-bound example, three roles × eight directions × four frames × two baked team variants at 64×64 RGBA8 uses 3 MiB of base pixels (about 4 MiB with a full mip chain), before atlas padding, buildings, extra actions, or zoom levels. Doubling frame width and height multiplies that cost by four. WebP reduces download size, not necessarily decoded GPU memory.

Sprite quads could reduce per-unit geometry to two triangles and use one or a few draw calls when a shared atlas selector is implemented. They replace much of the vertex work with atlas memory, fragment/alpha work, and custom frame-selection logic. They also lose continuous model rotation and need more baked views for smooth turns. The sprite route is plausible for this fixed camera, but it is not automatically faster or cheaper overall; compare both in the same 2,000-unit browser workload before switching.

## Historical comparison

There is no single medium across the Age of Empires and Warcraft series. World's Edge describes *Age of Empires: Definitive Edition* as a 2D isometric game that models units/buildings/trees in 3D and renders them to 2D images; its original directional set had eight views, while Definitive Edition expanded to 32 and added three zoom levels. This is precedent for the direction/state tradeoff, while our current art direction uses transparent sprites as unit output ([official Age of Empires explanation](https://www.ageofempires.com/news/age-empires-definitive-edition-3d-2d-game/)). Blizzard's *Warcraft III: Reforged* art write-up describes reviewing live 3D models for scale, color, readability, and silhouette, then polishing their animation ([official Blizzard art write-up](https://news.blizzard.com/en-gb/article/23150111/tales-from-the-smithy-reforging-the-night-elves)). Building art can continue to use that kind of geometry workflow independently.

## Next slices and milestone evidence

For units, integrate the manifest-driven sprite consumer and show the Worker, Infantry, and Archer replacing the current placeholders at game zoom. Keep the existing GLB exploration paused and separate. Building artists can ship their own small asset families; technical art can support their export and material conventions independently. Preserve source images, frame anchors, pose samples, team rules, provenance, hashes, and texture-memory estimates with each versioned sample.

The current [renderer contract](renderer-state-contract.md) describes the old GLB path; the `spriteRuntime` manifest is a separate versioned contract for frame rectangles, animations, pivots, bounds, and team masks. Validate an actual game view at ordinary and strategic zoom before calling the art production-ready. A measured 2,000-unit run establishes M3 performance evidence, without becoming a blanket PR gate.

On 26 September 2026, the user explicitly released the original Worker/Barracks v0.2 sample pack for a focused PR and author-owned merge with known visual limits. This release does not itself run a separate GPU capture or promote production.
