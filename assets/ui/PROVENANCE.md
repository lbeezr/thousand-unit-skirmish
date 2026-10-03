# Provenance — Frontier Command Kit v1

- Authored for the Thousand Unit Skirmish HUD as original vector artwork for this project.
- Shapes are hand-authored in SVG; no external icons, fonts, logos, or generated image assets are embedded.
- Cursor SVGs are editable source files with explicit 32 × 32 dimensions; each has a corresponding 32 × 32 PNG runtime export.
- HUD icon source and delivery files are the same 24 × 24 SVGs.
- The design is independent from the held environment art pack and unit/building asset branch.
- Preview composition is illustrative. It uses a CSS and inline-SVG field mock to review the graphics beside a representative dark HUD; it does not claim that these assets are integrated into the live game.

## Palette

| Role | Color | Existing interface reference |
| --- | --- | --- |
| Pine ink | `#131b16` | `--panel` |
| Field text | `#e5e8d7` | `--ink` |
| Quiet text | `#98a293` | `--muted` |
| Selection / valid | `#d5ef78` | `--lime` |
| Wood | `#9bb877` | `.wood-stock` |
| Food | `#e4bd63` | `.food-stock` |
| Blocked / threat | `#ef886c` | `--ember` |

## Visual decisions

- The click pointer is a compact field standard: a neutral spear tip and pale pennant with pine outlines, a brass-toned staff, and a leaf-green seam. Its (3, 3) hotspot remains at the point. This gives orders an in-world marker without making the commander a named hero. Action badges retain the state meaning: movement, target, gather, valid build, or blocked build.
- Box-select uses a centered four-corner frame rather than a second arrow. This keeps its hotspot aligned to the drag origin.
- Wood is shown as bound cut logs; food as a berry-and-leaf cluster, matching the existing field resource vocabulary. Command glyphs are distinct at 24 px and use one accent rather than team colors.
- Azure and Ember team colors are not used to encode command state. Valid and blocked use the established lime and ember status colors.
- Pan remains a platform hand cursor (`grab` / `grabbing`) so drag affordance stays familiar.

## Handoff limits

The preview is a source-art review board, not a browser compatibility certification. Verify cursor presentation in the actual target browsers when integrating. The manifest records mandatory fallbacks and hotspots. The kit does not rename or remove any visible text, status, or ARIA label.

## Action glyph candidates v1 — 3 October 2026

The six SVGs in [icons/actions](icons/actions/README.md) are original,
project-authored vector sources for Patrol, Follow, Stop, Hold position, Return
cargo and Formation. They use the existing 24 × 24 canvas, palette and compact
strokes. No external source, font, generated image or paid provider was used.
Their manifest records intended selectors and command meanings. These are
candidate sources, not integrated HUD controls or native recognition evidence.
