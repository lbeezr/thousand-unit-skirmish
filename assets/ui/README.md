# Frontier command UI assets

**Status:** 40 px Meshy cursor PNGs and the original six 24 px HUD icons are integrated.
The six new action glyphs are source candidates.
[Cursor contract](../../docs/ui-cursor-icon-contract.md) · [Provenance](PROVENANCE.md)

## Files

| Path | Purpose |
| --- | --- |
| `cursors/*.png` | Sixteen native cursor images. |
| `cursors/manifest.json` | Current paths, 40 × 40 dimensions, hotspots, fallbacks. |
| `icons/*.svg` | Food, wood, move, attack, gather, and build icons. |
| `icons/actions/` | Six [action glyph candidates](icons/actions/README.md); not integrated or served. |
| `cursors/*.svg`, `export-cursors.swift` | Earlier 32 px cursor sources/export path, retained as history. |
| `preview.html` | Static review composition, not gameplay evidence. |

The current source renders and provider records are in
[art/cursor-sources](../../art/cursor-sources/README.md). The older provenance
record describes the original SVG kit; it does not override the current manifest.

## Build

From the repository root, with Pillow installed:

```sh
python3 scripts/build-cursor-pack.py
node --test scripts/battlefield-cursor.test.mjs
```

This rebuild uses local sources and spends no credits. Do not run the legacy
Swift exporter to reproduce the current Meshy PNGs.

## Use and review

Use PNGs in native CSS cursor URLs with manifest hotspots and keyword fallback.
Pan/panning retain `grab`/`grabbing`. Keep HUD text, costs, accessible names,
and icon fallback glyphs.

Serve the preview through the game server at `/assets/ui/preview.html`. Test
cursor targeting, modifiers, hotspots, contrast, and fallbacks in the game;
a static board cannot validate native pointer behavior.
