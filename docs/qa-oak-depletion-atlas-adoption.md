# Generic oak depletion default adoption

[Adoption ledger](asset-adoption-checklist.md#terrain-workstream-backlog) ·
[Runtime pack](../assets/environment/frontier-oak-depletion-atlas-v1/README.md)

Owner: terrain integration. Bounded write scope: production oak export, resource
texture selection/sampling, narrow server/Docker admission, existing adoption
guard and related capture evidence. Full/directional/regional art, source pixels,
authoritative stock/collision and construction/building sprite paths are preserved.

## Normal entry and cost

`resourceStateAssetsReady` loads the production manifest and six hash-verified
mips. Generic `oak-worked`, `oak-low` and `oak-depleted` resolve to shared-page
textures; `createWoodResourceInstances()` retains its canvas, root, geometry,
instance transform, alpha test and depth writing. Full oak keeps the existing
Meshy/directional design, or the old full cutout under `meshyResources=0`.
Regional profiles resolve before generic oak creation and keep their own art.
Any atlas failure fetches all existing individual fallback states.

The successful path skips the three individual oak state downloads and decodes
verified atlas bytes through revocable blob URLs, avoiding a second HTTP image
fetch. Six mips total 1,191,760 bytes, plus JSON. The corresponding old three
individual files total 817,940 bytes; the increase is 373,820 bytes. Shared decoded
RGBA is 27.54 MiB, about 3.55 MiB above those three individual full mip chains.
Three state batches still draw separately. Individual fallbacks remain packaged;
the old four-state lossless reference and source pages remain excluded.

## Evidence and limits

Offline validation compares every alpha sample against independently filtered
source cells at all six levels; source/canvas/root/layout hashes and half-pixel
rectangles are checked. Runtime tests verify missing/hash/dimension rejection,
shared six-level sRGB/clamped source, mip-5 shader sampling, pending-material
switching, skipped duplicate requests, fallback, normal/legacy full and regional
art, roots and unchanged alpha/depth settings. Image decode is mocked in these
factory tests; they do not establish GPU pixels. The approved-runtime registry
guards normal binding and all six actual release dependencies. Packaged HTTP
checks verify GET/HEAD MIME, length/hash and source/preview exclusion.

The exact tested head, independent review, merge, clean release digest and
identified staging revision belong in the implementation PR. Linux Chromium
sandbox startup and staging CONNECT access have failed in this executor; no
sandbox-disabling flags may be used. Actual in-game acceptance stays incomplete
until a working authorized environment runs this identified revision.

## Ordinary-game acceptance

On an identified staging source/release containing this integration, verify the
served manifest and six file hashes. In an ordinary generic-wood match, observe
one node crossing full → worked (≤66%) → low (≤33%) → depleted (0%). Check root
stability, silhouette, alpha fringes, cross-state bleed and pixel aliasing at
fitted, normal and closest zoom, including the mip-5 transition. Check nearby
Workers in front/behind the cutouts, fog hiding/reveal, and depleted clearing or
construction behavior. Repeat on raised ground. Default full Meshy directions
must remain intact; Underbough Rootways must retain regional wood. Use
`meshyResources=0` only as the separate legacy full comparison.

Capture map/action/stock/zoom, source SHA, release digest, active deployment id,
actual observations and screenshots in this PR/note. Terrain integration retains
acceptance ownership. The current cloud testing/CI owner receives renderer
qualification and capture execution under the [testing strategy](testing-strategy.md#start-here);
Mac testing was stopped by the user and is not a dependency. Painted-ground QA
remains separate and open.
