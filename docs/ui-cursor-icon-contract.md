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
| `build-blocked` | `assets/ui/cursors/build-blocked.png` | 32 × 32 PNG | 3, 3 | crosshair |
| `pan` | native cursor | — | — | grab |
| `panning` | native cursor | — | — | grabbing |

Cursor images use transparent backgrounds. The ordinary pointer is a neutral
field standard, with the command state carried by the badge; its spear tip stays
at the existing `(3, 3)` hotspot. `box-select` remains a centered frame.
`style.css` points each mode at its runtime PNG and retains the manifest's
keyword fallback, for example:

```css
--cursor-select: url('/assets/ui/cursors/select.png') 3 3, crosshair;
```

## Icons

Use 24 × 24 SVG files under `assets/ui/icons/`: `wood.svg`, `food.svg`,
`move.svg`, `attack.svg`, `gather.svg`, and `build.svg`. The initial runtime
integration scope is the command-mode symbol and the HUD food/wood readouts.
Keep the visible `FOOD` and `WOOD` labels, command title and hint, and written
resource costs so the art remains supplementary and the controls stay clear.

The kit includes editable cursor sources, icon SVGs, the hotspot manifest,
provenance, and a static preview. The UI uses the command icon and food/wood
readout icons while retaining the visible labels and text fallback glyph.

The production server serves client files through an explicit allowlist. The
runtime cursor exports, their editable SVGs, the manifest, icon SVGs, and static
preview are listed there; the export script and provenance notes remain source
materials in the repository.
