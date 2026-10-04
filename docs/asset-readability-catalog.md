# Runtime asset readability catalog

[Adoption record](asset-adoption-checklist.md) · [Approval guard](asset-adoption-registry.json) · [Testing strategy](testing-strategy.md)

Owner: building/catalog workstream. This is a small read-only debug view in the
existing game, covering **Town Center Complete art and the Follow glyph**.
It adds no CMS, art generation, private source publication or second runtime
asset registry. It also reads PR318's existing Infantry manifest and production
sidecar as a metadata pilot. Foot owner `01a10469` retains character source identity,
action × direction and timing schemas; this slice leaves all unit manifests,
animation selectors and their coverage contracts untouched. HUD owner retains
novice-flow tests and command semantics. Shared presentation consumes their
existing runtime output; future foot catalog rows should read their owned
manifests rather than duplicate the schema here.

## Open the view on a normal battlefield

At an identified containing source/release, enter an ordinary room and add
`&assetReadability=1` to its `?room=…` URL. No art-preview or renderer override is
needed. The optional panel inspects an owned Town Center from the existing
`buildingVisuals`/captured loader, and its camera buttons center that building
at normal **0.91** or strategic **0.48** zoom. The world keeps its actual map
terrain, fog, Workers, standard and feedback. Nothing is spawned, substituted
or ordered by the catalog. An absent/pending/fallback building is reported.

Follow samples use the live labelled control's source, matched to its existing
action manifest; the served SVG hash is recorded without inventing an approval.
They appear uncropped at
16/20/24 CSS px, with labels, on the normal contextual HUD backing; 20 px is
the existing command size. Grayscale comparison is optional. Close removes
the panel. The normal URL does not mount it or fetch catalog metadata.

The panel reports current manifest binding, eight source directions, matching
lifecycle coverage and missing states. Source coverage and a runtime-visible
flag are **not rendered readability acceptance**. `window.__rtsAssetReadabilitySnapshot`
contains only this bounded observation with map ID, camera zoom, viewport/DPR,
coverage, style version and explicit `unverified` readability.

## Consume the existing production interface

The foot owner's [existing production interface](unit-art-production-contract.md)
and [Infantry sidecar](art-direction/human-roster-v1/infantry-production-contract.json)
own approved source/runtime pins, style/provenance versions, publication scope,
source coverage and timing. The catalog reads them unchanged; it does not add
approval fields to the adoption registry, rebuild hashes from descriptions or
create another schema. It compares the sidecar's existing runtime pins to the
manifest's matching asset ID and served public PNGs, then reports declared
source coverage/timing and configured default version separately from rendered
acceptance.

Infantry retains the sidecar's exact style/provenance/publication fields and
**11 declared authored cells / 32 required, 21 missing**. PR318's owner retains
decoded source auditing; all 63 family gaps and normal-game acceptance remain
open. The catalog does not claim new poses, validate timing a second way or
load private sources. Its publication check admits only that existing public
pilot; its pins cover only the already admitted runtime PNG and mask.

Town Center still uses its existing hash-bound captured manifest. Follow is
original project vector work, with one public SVG for source/runtime. Neither
has a production sidecar yet, which is displayed explicitly; that absence
cannot become approved/complete art. Town Center's editable model remains
private/local and unshipped. Only the existing public Infantry sidecar and
action manifest are newly admitted metadata; normal asset loading is unchanged.

These constraints address the author's reported small-icon contrast/crop and
description-hash replacement problems in the
[DragonScape development account](https://www.reddit.com/r/aigamedev/comments/1wgfhfp/solo_dev_1000_hours_ai_art_and_aiassisted_code/).
They do not import reference art or adopt automatic generation.

## Evidence and next scoped step

CPU contracts check consumption of unchanged sidecar identity under descriptive
edits, changed hash/asset-ID/private-scope rejection, live camera/pivot/density,
lifecycle and image contract comparison, retained coverage,
real default Follow DOM binding, sample dimensions, camera-only callbacks and
keyboard isolation and actual main held-key release over panel controls.
HTTP/hash checks use the real server and clean packed files,
including rejection of unadmitted docs and private source paths. These checks
establish contracts and delivery files, not contrast, recognition or pixels.

**Rendered readability remains unverified.** After the CI306 owner qualifies
the supported packed-game renderer with inspected artifacts, run this view on
a clean containing release at fixed viewport/DPR/browser zoom. Retain original
PNG/full-page evidence at both camera zooms, actual map/background, source SHA,
release digest, browser/backend and the same-frame catalog snapshot. Inspect
Town Center edges/Workers/standard and Follow's shape/contrast at all three
sizes, including grayscale; report a specific defect before any art change.
Then remove the debug option and retain the separate
[paid Barracks ordinary-game acceptance](qa-frontier-building-adoption.md).
Neither the catalog nor renderer qualification closes that gameplay outcome.
Mac testing, paid generation, extra infrastructure and deployment actions are
outside this slice.
