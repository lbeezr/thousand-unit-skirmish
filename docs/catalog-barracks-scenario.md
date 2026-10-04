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

CI owns renderer core, browser/server launch, clean-pack/dependency verification,
cleanup, registry and workflow dispatch. This case uses existing HUD menu and
Map Studio behavior; it changes no production entry helper. No capability probe
or launch runs on import. Coordinate one reviewed hosted batch using the already
qualified [PR323 run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37215311854).
Actual execution and original PNG inspection remain pending.

The registered [version-1 wrapper](../scripts/renderer-building-catalog-scenario.mjs)
exports `id = 'building-catalog'`, `contextVersion = 1`, and `run(context)`.
It accepts the existing immutable [capture context](../scripts/renderer-capture-context.mjs)
without browser/pack fields or a context extension:

```js
const result = await run({
  version: 1, page, openPage, origin, source, capture, evidenceDirectory,
});
// source = frozen { revision: fullCleanSourceSHA, digest: cleanPackDigest }
// page = the shared fresh about:blank CDP page
// capture({page, mapId, checkpoint}) = shared source-bound checkpoint hook
// evidenceDirectory = this registered case's absolute owned artifact folder
// id = 'building-catalog'; contextVersion = 1
```

The wrapper verifies the loopback health source/digest and clean identity, then
compares the served default Barracks manifest with this checked-out source and
Complete view 01 with its retained pixel hash. The runner owns clean packaging
and locked dependencies. The checkpoint sequence receives verified public
runtime metadata and the injected shared capture hook; it owns no pack/browser.

On the fresh page, the wrapper installs the room-only
`catalogBarracksBeforeScript()` plus a passive file-import observer before
navigation. It opens the ordinary root menu, clicks **Map Studio**, uploads
[the existing flat fixture](qa-evidence/default-frontier-buildings-2026-10-03/acceptance-map-flat.json)
through the actual `#studio-import-file` input with `DOM.setFileInputFiles`,
and clicks **Save & Play Map**. The capture-phase observer hashes the actual
chosen file before the normal handler clears its input; it retains only size
and SHA256. The real editor ID, applied map, owned Azure seat and starting banks
must settle before the sequence starts. This is an authored paid-acceptance
fixture entered through ordinary authoring controls; it does not establish a
normal New Game match or unassisted first play. No direct publish command,
synthetic bank, teleport or world override is used.

Only the actual room document receives
`rendererCapture=environment-state&assetReadability=1&assetScenario=catalog-barracks`.
The initial menu stays ordinary. `roomEntryUrl` drops old query options, so
placing diagnostic flags on the initial menu would bypass normal entry and
lose them during room creation; the production helper is unchanged.

All seven PNGs go through `context.capture()`. The wrapper checks the owned
page, exact order, applied map, source and owned checkpoint directory, then
propagates a returned sequence failure into the shared case's failed checks.
Its `building-catalog-entry.json` retains only reduced identity/import/receipt
facts and safe failed-stage IDs, separate from the runner's qualification.
The shared result's `passed` means seven captured contract-checked receipts;
owner sidecars still say `captured-needs-review`, readability unverified and
paid Barracks acceptance open. It never means inspected pixels.

```sh
node scripts/renderer-feature-capture.mjs --check building-catalog
node scripts/renderer-feature-capture.mjs --check all
node --test scripts/renderer-building-catalog-scenario.test.mjs scripts/catalog-barracks-scenario.test.mjs
```

These commands load/test source only; they perform no browser capture or dispatch.

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
