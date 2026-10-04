# Isolated catalog and paid Barracks capture

[Catalog](asset-readability-catalog.md) · [Ordinary building acceptance](qa-frontier-building-adoption.md)

Owner: catalog/building workstream. This adapter prepares seven original
full-page PNG checkpoints through the existing `captureCheckpoint` helper:
Town Center and Follow at 0.91/0.48 zoom in color/grayscale, then paid Barracks
construction and selected healthy Complete art at both zooms. It keeps ordinary
asset selectors, original runtime images, world backgrounds and real UI orders.
It never replaces construction states or changes banks/checkpoints to accelerate
the result. A captured batch still requires inspected pixels; readability and
the wider eight-family/Barracks acceptance remain open.

## Shared execution boundary

CI owns renderer core, browser/server launch, packed dependency verification,
cleanup and workflow dispatch. HUD owns ordinary room creation/join/launch and
map import. This adapter launches nothing and performs no capability probe.
Use the already qualified [PR323 run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37215311854)
and coordinate one reviewed hosted batch containing the three owners' scenarios.
Do not edit or dispatch a parallel workflow for this slice.

The shared runner now has a before-cleanup case call and a version 1
[capture context](../scripts/renderer-capture-context.mjs). Its registered
`building-catalog` filename is `scripts/renderer-building-catalog-scenario.mjs`;
that wrapper is not supplied here. The remaining integration gap is the bridge
from HUD's ordinary flat-map entry/import receipt to this adapter, together with
the qualified pack and browser version. Version 1 currently supplies only
immutable source/digest identity, owned pages, origin, capture and evidence
directory. CI owns any context extension or runner wiring; HUD owns the entry
and exact import receipt. The bridge must make this call before shared cleanup:

```js
const catalogReport = await runCatalogBarracksScenario({
  page, pack, revision: pack.sourceRevision, browserVersion: browser.version,
  outputDirectory: catalogEvidenceDirectory, team: 0,
  entryEvidence: {
    ordinaryEntry: true, sourceRevision: pack.sourceRevision,
    mapId: 'frontier-buildings-acceptance-flat', mapSha256: importedMapSha256,
  },
});
assert.equal(catalogReport.status, 'captured-needs-review');
```

Import [the existing flat map](qa-evidence/default-frontier-buildings-2026-10-03/acceptance-map-flat.json)
through ordinary Map Studio and retain its actual file hash in HUD's receipt.
The adapter requires that exact hash and checks the applied map again through
the existing helper. Supply a clean, digest-verified containing pack with its
existing locked dependencies installed. Establish the flags below on the
ordinary room document before loading main; preserve the room/session privately
in the harness rather than artifacts:

`rendererCapture=environment-state&assetReadability=1&assetScenario=catalog-barracks`

Compose the adapter's `catalogBarracksBeforeScript()` with the existing qualified
probe in the same designated page's `beforeScript`. It leaves the initial menu
untouched, then adds QA flags only when the real room document loads. Ordinary
`roomEntryUrl` deliberately drops old query options, so putting QA flags on the
initial menu URL would both bypass normal entry and fail to preserve them through
room creation. Do not alter that production URL helper. After artifacts are
written, the caller must propagate a returned `failed` status to batch failure;
awaiting the adapter alone cannot establish a successful batch. Its nonenumerable
`cause` retains local diagnosis without serializing private CDP messages.

`assetReadability` opens a developer QA panel. `assetScenario` enables only
read-only observations after the normal renderer draws, including owned banks,
loaded default view pins/pivot/density, depth, selection and screen projection.
Neither flag gates approved art, asset defaults, gameplay or a player's access
to building controls. Alternate-art query options are rejected by this scenario.
The QA panel uses a distinct DOM class while sharing the existing HUD backing
and button rules; normal command-bar queries keep their actual controls.

## Checkpoints and evidence limits

The QA panel scrolls normally to expose the whole Follow glyph/label row;
viewport/panel clipping and hit tests must pass before each catalog capture.
The ordinary visible Production/Worker/Build controls and actual CDP mouse and
keyboard events place one Barracks on the existing Azure pad `(-20.5,-6.5)`
(mirrored Ember pad also supported). The live owned bank must pay exactly
175 wood / zero food. Construction must retain the old fallback while new
Complete art is hidden. Healthy completion must load packed default view 01
with the original hash, texture dimensions, world scale, ground pivot and body
depth. Workers move away through a real right-click order before ordinary
building selection and Space centering; normal wheel input reaches strategic
zoom. The developer panel closes before paid-gameplay screenshots.

Each PNG bundle retains the existing helper's observed viewport/DPR/browser,
map and source identity and original PNG hash. `scenario.json` brackets the
CDP screenshot with frame/time-tagged post-render observations. It explicitly
does **not** claim a same-frame canvas capture. `catalog-barracks.json` retains
release digest, exact map hash, source, paying seat, selected default view,
checkpoint hashes and the first bounded failure. It stores no full URL, invite,
session, private source or arbitrary CDP error payload. Partial successful
checkpoints remain visible if a later checkpoint fails; a new output directory
is required for another execution.

Success means `captured-needs-review`, never visual acceptance. Inspect the
original PNGs for Town Center edges/contact, Workers and standard; Follow shape,
contrast and labels at 16/20/24 pixels; actual Barracks fallback, Complete
silhouette, standard, selection and normal/strategic readability. Record defects
before changing approved artwork. Both-seat occlusion, damage/repair,
destruction/rebuild, production/rally, fog/raised-ground and identified staging
acceptance remain with the existing ordinary-game recipe.

CPU tests validate observations, real payment/default-view contracts and
negative controls; they execute no browser rendering and cannot close these
pixel or gameplay outcomes.
