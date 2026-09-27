# Cursor and icon contract

[Documentation index](README.md) · [UI pack](../assets/ui/README.md)

## Current runtime cursors

The battlefield canvas exposes `data-cursor-mode`; `src/battlefield-cursor.mjs`
resolves the mode and `style.css` maps it to the native browser cursor.
The authoritative size/path/hotspot record is
[assets/ui/cursors/manifest.json](../assets/ui/cursors/manifest.json).

Current custom cursors are **40 × 40 PNGs**, built from Meshy pointer/hammer
renders with command marks. Older 32 × 32 SVGs are retained as legacy sources.

| Modes | Hotspot | Keyword fallback |
| --- | --- | --- |
| `select`, `select-add`, `select-remove`, `box-select`, `box-crossing` | `(4,4)` | `default` |
| `move`, `move-queued`, `attack`, `attack-move`, `attack-move-queued` | `(4,4)` | `default` |
| `gather`, `gather-wood`, `rally` | `(4,4)` | `default` |
| `build-valid` | `(6,6)` | `default` |
| `build-blocked` | `(6,6)` | `not-allowed` |
| `unavailable` | `(4,4)` | `not-allowed` |
| `pan`, `panning` | Native | `grab`, `grabbing` |

Runtime files are `assets/ui/cursors/<mode>.png`. Keep a CSS keyword fallback.
Enemy targeting precedes resource targeting; only movement modes show the Shift
queue mark. Hover resolution must not advance overlap selection.

## Icons

The 24 × 24 SVG icons are `wood`, `food`, `move`, `attack`, `gather`, and `build`
under `assets/ui/icons/`. Preserve resource labels, command title/hint, written
costs, and accessible names. Icons supplement those meanings.

## Build and verify

```sh
python3 scripts/build-cursor-pack.py
node --test scripts/battlefield-cursor.test.mjs
node scripts/docker-ui-assets-context-scenario.mjs
```

The builder needs Pillow and spends no provider credits. Source renders/provenance
are in [art/cursor-sources](../art/cursor-sources/README.md). The old Swift SVG
export is not the current PNG build path.

Check hotspots, contrast, modifiers, targeting precedence, fallback, and pan in
the actual browser. The static `assets/ui/preview.html` is a review composition.
The server's explicit allowlist and Docker/release inputs must include new runtime
assets; source-only production files do not need public serving.
