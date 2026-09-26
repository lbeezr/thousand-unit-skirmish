# Building sprite production workflow

Use this workflow when creating or revising a building sprite pack. It captures the approach used for the Barracks, Archery Range, and Town Center samples: settle the finished building's look first, then derive its other visual states against that approved design and a measured world grid.

## Production sequence

1. **Confirm the game's contract.** Read the current art and renderer guidance, inspect the building's actual footprint and lifecycle, and record what is gameplay occupancy versus visible support/base. Do not invent construction, damage, or destruction states the game does not represent. A static map landmark may correctly have only a complete frame.
2. **Lock the view and grid.** Start from the building sprite profile used by the current samples: a 5 × 5 world-unit frame, 640 × 640 pixels, 128 source pixels per world unit, fixed 45-degree azimuth and 46-degree downward view. Treat this as a measured baseline, not a rule that every asset must fill the frame. Record any justified change. Keep the gameplay footprint separate from the visible base. Define a projected ground-contact anchor and keep its world meaning consistent across every frame of that building; record its pixel and normalized coordinates. Pixel anchor height may differ between different buildings when their bases differ.
3. **Design the complete, undamaged building first.** Make one clear hero image the source of truth for silhouette, proportions, roofline, materials, team cue, palette, camera, and scale. Review it at the intended game size and against its footprint/grid before making lifecycle frames. Resolve aesthetic and identity issues here; later stages should inherit this design rather than become separate interpretations.
4. **Derive lifecycle frames from the approved complete image.** Use the complete image as an explicit visual reference when creating earlier and damaged forms. For the common building lifecycle, produce foundation, frame, complete, damaged, and critical. The Town Center sample is intentionally complete-only because it is currently a static map landmark. Keep camera, canvas, scale, anchor, light, and recognizable architectural features fixed. Remove or add construction elements deliberately; show damage through localized wear and missing/broken components while retaining the building's identity. Add a destroyed/wreck frame only when gameplay retains a destroyed structure as a visible state.
5. **Review the state sequence together.** Make a labeled contact sheet with the projected gameplay footprint. Check ground alignment, apparent scale, silhouettes, stage readability, team cue, and whether the complete image still reads as the same building in every state. Correct source frames before runtime normalization if any state shifts or changes camera. Review packs across buildings side by side when establishing a family style.
6. **Generate orthogonal variants from the approved art.** Produce team versions with a controlled mask or color transform that changes the designated team cue while preserving shading and neutral materials. Keep states, team, view direction, season, lighting, and wear as separate dimensions in the metadata. Do not prompt-generate every possible combination independently. Add seasonal or day/night layers later when a concrete game need exists.
7. **Normalize and package repeatably.** Preserve full-size transparent source PNGs. Generate same-sized runtime frames without stretching: use the complete frame to establish scale, crop transparent bounds only as needed, and align every lifecycle/team frame to the recorded anchor and canvas. Keep the preparation script, runtime frames, labeled preview, `sprite-grid.json`, and `PROVENANCE.md` with source prompts/output identifiers and SHA-256 hashes. A reviewer should be able to regenerate the runtime files from the checked-in source and command.
8. **State integration limits plainly.** Record how many views exist and what the pack does not support. A single camera-authored image cannot be rotated to create a new perspective. Camera/building rotation requires separately authored directional views sharing the same frame, scale, anchor, and corresponding lifecycle states. Alpha sprites have no per-pixel scene depth; terrain elevation and occlusion require renderer handling. A source/runtime pack being ready does not mean it has been integrated or visually validated in the game.

## Pack acceptance checklist

- The complete frame establishes a recognizable, approved silhouette and material/palette treatment.
- Every required construction and damage frame is derived from the same design and reads in the correct lifecycle order.
- Canvas dimensions, pixels per world unit, view parameters, footprint, visible base, anchor, team variants, and state mapping are recorded in `sprite-grid.json`.
- Team variants preserve neutral surfaces and shading; missing future dimensions are not implied to exist.
- Source, runtime, preview, generation script, provenance, and file hashes are present and reproducible.
- The preview shows the state sequence on the grid, and the notes distinguish source readiness from renderer integration and in-game appearance evidence.

## Current examples

- [Barracks sprite sample](../assets/buildings/barracks-sprite-test-v1/README.md)
- [Archery Range sprite pack](../assets/buildings/archery-range-sprite-v1/README.md)
- [Town Center sprite pack](../assets/buildings/town-center-sprite-v1/README.md)

The current samples are source/runtime art packs with one fixed view. They establish the production method and measured frame conventions; they do not by themselves prove directional rotation, elevation/occlusion behavior, or renderer integration.
