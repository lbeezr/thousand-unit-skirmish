# Infantry sprite exploration v1

This source-only sheet explores an illustrated cutout Infantry for the fixed oblique RTS camera. It is a visual and packaging sample; the live unit renderer has not been changed.

![Eight-facing Infantry sprite atlas](infantry-atlas-source.png)

The atlas has eight approximate facing columns and six rows. See [`manifest.json`](manifest.json) for the intended order, row definitions, pixel-edge partition, hash, and current limitations. Open [`preview.html`](preview.html) to inspect a frame and loop the two walk poses. Check the source pack with:

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

## What is still unresolved

- The ImageGen prompt asked for seven rows but produced six; directions and cell edges are only approximate and need cleanup.
- Walking has only two frames, so the loop will look rough. Gathering, building, hit, spawn, and fuller attack/defeat sequences are absent.
- There is only an Azure-blue sash. There is no Ember version, aligned tint mask, or validated team-color treatment.
- Frame pivots, pixel padding, alpha cleanup, export sizes, and ordinary-zoom readability have not been approved.
- This image is not a production atlas and is not loaded by the game.

Do not count this source sheet as runtime appearance or performance evidence. If the direction is promising, the next art pass should correct the eight facings and pivots, produce a longer walk cycle, add an Ember-compatible team treatment, and then compare an integrated small roster at ordinary game zoom before broadening the role pack.
