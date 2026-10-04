# Vaelora HUD direction study v1

**Historical rejected exploration, 2 October 2026.** The user rejected all three
directions: the HUD needs to be much more compact, dense, subtle and dismissible.
Brown was only the strongest relative material preference; no concept is approved.
Publication of this archive and implementation of the old direction remain paused.
The next UI outcome is source-based game HUD/RTS UX research, measured battlefield
occupancy, persistent/contextual/dismissible control and keyboard/focus audit, and
one compact structural wireframe.

These code-authored 2D overlays reuse existing cursor/icon files on captured game
backgrounds. The original images, HTML and source scripts retain their creation-time
labels and pixels as historical artifacts. No runtime HUD, new ImageGen output or
Meshy job is delivered by this archive.

## The field journal

![Field journal proposal on captured snow terrain](previews/journal-snow-blocked.png)

Parchment, dark botanical ink and folio rules. Existing light SVGs sit on dark
plates. Reading surfaces stay plain; decoration stays at the margins.

## Oak and iron

![Oak and iron proposal on captured snow terrain](previews/wood-snow-blocked.png)

Warm timber, brass fasteners and iron tool plates reuse the existing cursor
material language. Keep frames small enough to preserve terrain visibility.

## The quiet wayfinder

![Quiet wayfinder proposal on captured snow terrain](previews/map-snow-blocked.png)

Matte map green and restrained route arcs. No moving glow or translucent text
surface; ornament must remain distinct from real gameplay markers.

## Review and reproduction

- [Compact three-concept preview](previews/compact-three-directions.png),
  with readable direction captions. Presentation thumbnails; use full-size
  images for text/badge evaluation.
- [Three-direction comparison](previews/three-directions-comparison.png).
- [All 16 cursors at 40 px; icons at 13/19/24 px](previews/asset-normal-size-check.png).
- Grayscale proxies: [journal](previews/journal-woodland-queued-grayscale.png),
  [wood](previews/wood-woodland-queued-grayscale.png),
  [map](previews/map-woodland-queued-grayscale.png). These are not calibrated
  color-vision simulations.
- [Audit and current binding/state table](../../vaelora-hud-icon-audit-2026-10-02.md).
- [Runtime text samples](contrast-runtime.json), [proposal text samples](contrast-proposals.json),
  [pixel review](review.json), [file inventory](manifest.json).
- [Initial sketches](iterations/initial/preview.html) and
  [original comparison](iterations/initial/previews/three-directions-comparison.png)
  retain unsupported Objectives/Hold glyphs and the original disabled-button
  treatment. The clipped first asset-board capture is also retained there.
- [Completed gameplay receipt](captures/attempt-2/live-capture.json) and
  [failed first capture receipt](captures/attempt-1/failure.json). The three
  background PNGs survive; their original `captures/backgrounds/capture.json`
  receipt is missing from the inspected committed source-branch history.

### Missing background receipt

The original manifest lists `captures/backgrounds/capture.json` as 1,052 bytes,
SHA-256 `d65f785b9a47a6220dfc3e872e1b78a2541f23b18f7ae656957bbf87e6a6ccdf`.
The path is absent at original draft head
`732c40c0d12d89aab9358e795a672f2c738c4d8c` and from its inspected public history;
root ignore rules exclude `capture.json`. The saved capture script describes the
intended receipt fields, but does not supply the original executed receipt bytes.
No receipt was reconstructed or fabricated. Recover the original from its source
session, verify this exact identity, and obtain any needed publication permission
before adding it. The manifest retains the expected entry marked missing, alongside
99 available entries. Surviving PNGs, completed/failed gameplay receipts and source
scripts remain unchanged; this gap limits the background-capture metadata claim.

Open [preview.html](preview.html) through a local static server rooted at the
repository. Queries `?theme=journal|wood|map&terrain=snow|meadow|woodland&state=blocked|queued`
select a sketch; `?compare=1` displays all three. [asset-check.html](asset-check.html)
shows the current asset board. These HTML files resolve existing root assets;
they are not independent runtime applications or a hosted site.

[Executed source scripts](source/README.md) retain capture/render options and
the exact authoring code. The standard view is 1280 × 1100, DPR 1. At a
960 × 800 viewport this fixed 1280 px sketch overflows; responsive layout is
unfinished. Native OS cursor pixels are absent from direct screenshots, so the
cursor board uses DOM images. Values, objective prose and the schematic
mini-map are illustrative; photographed terrain/buildings/units are actual
gameplay. Full color-vision, human readability and real task-state acceptance
remain open.

This is a flat screen-space asset class: UI reference yaw is not applicable.
Image axes are screen right/down. No 3D orientation or eight-heading sprite
acceptance is inferred. Existing upstream asset provenance and rights are
retained; this pack makes no new claim about missing Mac-only work.

[Art evolution](../../lore/art-evolution.md) ·
[Cursor contract](../../ui-cursor-icon-contract.md) ·
[Documentation index](../../README.md)
