# Frontier Command Kit v1

A compact cursor and HUD icon study for the Thousand Unit Skirmish field interface. The kit follows the existing dark-pine panels, warm field, and muted resource colors. It is a visual handoff: it does not change runtime UI code.

## Files

- `cursors/<state>.svg` — editable 32 × 32 source for each cursor.
- `cursors/<state>.png` — 32 × 32 runtime exports for the interface owner's requested stable paths.
- `icons/*.svg` — editable 24 × 24 resource and command icons at their stable runtime paths.
- `cursors/manifest.json` — state names, hotspot coordinates, CSS keyword fallbacks, and asset paths.
- `preview.html` — a static in-context HUD board and an asset-size review strip.
- `PROVENANCE.md` — authorship, palette, design decisions, and handoff limits.
- `export-cursors.swift` — reproducible macOS AppKit SVG-to-PNG cursor export.

## Cursor use

```css
.viewport[data-cursor-mode="select"] canvas {
  cursor: url("/assets/ui/cursors/select.png") 3 3, crosshair;
}

.viewport[data-cursor-mode="move"] canvas {
  cursor: url("/assets/ui/cursors/move.png") 3 3, crosshair;
}

.viewport[data-cursor-mode="attack-move"] canvas {
  cursor: url("/assets/ui/cursors/attack-move.png") 3 3, crosshair;
}

.viewport[data-cursor-mode="gather"] canvas {
  cursor: url("/assets/ui/cursors/gather.png") 3 3, crosshair;
}

.viewport[data-cursor-mode="build-valid"] canvas {
  cursor: url("/assets/ui/cursors/build-valid.png") 3 3, crosshair;
}

.viewport[data-cursor-mode="build-blocked"] canvas {
  cursor: url("/assets/ui/cursors/build-blocked.png") 3 3, crosshair;
}

.viewport[data-cursor-mode="box-select"] canvas {
  cursor: url("/assets/ui/cursors/box-select.png") 16 16, crosshair;
}

.viewport[data-pan-mode="ready"] canvas { cursor: grab; }
.viewport[data-pan-mode="dragging"] canvas { cursor: grabbing; }
```

The arrow-led cursors use `(3, 3)`, at the arrow tip. `box-select` is centered at `(16, 16)`. Keep the text and accessible names on HUD controls when adding these icons. The handoff retains native `grab` and `grabbing` for manual pan, along with existing `auto` fallbacks on ordinary controls.

SVGs are the editable source; PNGs are the fixed-size cursor exports. Use the PNG files for runtime cursor URLs and retain a CSS keyword fallback; do not leave a cursor declaration without a fallback.

To regenerate the PNG exports on macOS, run `swift assets/ui/export-cursors.swift` from the repository root. Each source is rendered at its intrinsic 32 × 32 size.

## Review

Open `preview.html` directly in a browser. The mock field is a static composition used to judge icon scale, contrast, and hierarchy; it is not a game capture or a runtime integration claim.
