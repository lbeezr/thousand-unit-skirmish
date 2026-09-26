# Infantry sprite exploration v1

This sheet explores a painterly cutout Infantry for the fixed oblique RTS camera. The atlas remains source art; a canonical runtime-candidate pack is prepared, but the live unit renderer has not been changed.

![Eight-facing Infantry sprite atlas](infantry-atlas-source.png)

The renderer-facing manifest is [`sprite-atlas-pack-v1.json`](sprite-atlas-pack-v1.json). It points to the source and visible-pixel-preserving runtime pages, an aligned team mask, full-cell fallback cutouts, actor crops, cell-local pivots, and eight-direction clips. The zero-gutter pilot declares linear filtering, no mipmaps, and the same half-texel inset for color and mask.

The atlas has eight approximate facing columns and six rows. See [`manifest.json`](manifest.json) for the intended order, row definitions, pixel-edge partition, hash, and current limitations. Open [`preview.html`](preview.html) to inspect individual frames, and the shared [animation test](../sprite-animation-test.html) to see the three roles move. Check the source pack with:

```sh
node scripts/validate-unit-sprite-atlas.mjs assets/units/infantry-sprite-v1/manifest.json
```

| Row | Pose |
| --- | --- |
| 0 | Idle, ready stance |
| 1–2 | Two walk poses |
| 3–4 | Attack wind-up and strike |
| 5 | Defeated corpse |

## What this sample establishes

- The painterly cutout style can sit beside the existing painted environment assets without requiring a Blender-authored runtime model.
- An eight-view atlas can express facing changes for the locked battlefield camera.
- The pack can follow the building-art workflow's source image, manifest, provenance, and browser-preview conventions.
- The pack records frame rectangles, pose alpha bounds, estimated per-facing feet pivots shared across upright poses, idle/walk/attack/defeat clips, and separate art/culling/selection bounds. Map occupancy remains point-based and outside this art manifest.
- A derived gray8 `team-accent-mask.png` marks the sash. Black preserves source RGB; white applies full team hue while preserving source luminance and alpha.

## What is still unresolved

- The ImageGen prompt asked for seven rows but produced six; directions and cell edges are only approximate and need cleanup.
- Walking has only two frames, so the loop will look rough. Gathering, building, hit, spawn, and fuller attack/defeat sequences are absent.
- There is only an Azure-blue sash in the source. The aligned mask supports runtime team recoloring, but the treatment has not been visually reviewed in-game.
- Eight facings are approximate; animation still has a two-frame walk and two attack poses. Pixel art cleanup and ordinary-zoom readability have not been approved.
- The metadata and masks are not yet loaded by the game.

Do not count this sheet as runtime appearance or performance evidence. The next slice is an integrated small roster at ordinary game zoom, followed by corrections to the most visible facing, pivot, scale, and team-color errors.
