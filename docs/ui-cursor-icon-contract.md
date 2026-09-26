# UI cursor and icon integration contract

## Cursors

The battlefield canvas exposes `data-cursor-mode` values consumed by `style.css`:

| Mode | Asset path | Size | Hotspot | System fallback |
| --- | --- | --- | --- | --- |
| `select` | `assets/ui/cursors/select.png` | 32 × 32 PNG | 3, 3 | crosshair |
| `box-select` | `assets/ui/cursors/box-select.png` | 32 × 32 PNG | 16, 16 | crosshair |
| `move` | `assets/ui/cursors/move.png` | 32 × 32 PNG | 3, 3 | crosshair |
| `attack-move` | `assets/ui/cursors/attack-move.png` | 32 × 32 PNG | 3, 3 | crosshair |
| `gather` | `assets/ui/cursors/gather.png` | 32 × 32 PNG | 3, 3 | crosshair |
| `rally` | native cursor | — | — | crosshair |
| `build-valid` | `assets/ui/cursors/build-valid.png` | 32 × 32 PNG | 3, 3 | crosshair |
| `build-blocked` | `assets/ui/cursors/build-blocked.png` | 32 × 32 PNG | 3, 3 | not-allowed |
| `pan` | native cursor | — | — | grab |
| `panning` | native cursor | — | — | grabbing |

Cursor images should have transparent backgrounds. When the PNGs arrive, replace
the corresponding `--cursor-*` fallback in `style.css` with a CSS cursor value,
for example:

```css
--cursor-select: url('/assets/ui/cursors/select.png') 3 3, crosshair;
```

## Icons

Use 24 × 24 SVG files under `assets/ui/icons/`: `wood.svg`, `food.svg`,
`move.svg`, `attack.svg`, `gather.svg`, and `build.svg`. The initial runtime
integration scope is the command-mode symbol and the HUD food/wood readouts.
Keep the visible `FOOD` and `WOOD` labels, command title and hint, and written
resource costs so the art remains supplementary and the controls stay clear.

Please include asset provenance and a static in-context preview with the files.
Until delivery, the canvas uses its named system cursor fallbacks and the
existing text/glyph labels.

The production server serves client files through an explicit allowlist. Add
the delivered cursor and icon files to that allowlist as part of runtime
integration so the assets are available in deployed builds.
