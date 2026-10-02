# Executed capture and render source

These five files preserve the exact scripts used for the revised study:

- [CDP bridge and owned Chromium lifecycle](ui-audit-cdp.mjs).
- [Actual gameplay states](ui-audit-live-capture.mjs); executed with `meadow`.
- [Three terrain backgrounds](ui-audit-background-capture.mjs).
- [Three direction renders and text-hidden samples](ui-audit-render-previews.mjs).
- [Native-size DOM cursor/icon board](ui-audit-asset-board.mjs).

They ran with Node 24.19.0, `/usr/bin/chromium`, and the repository's existing
`scripts/fortified-crossing-fixture.mjs`, using disposable game servers and
loopback-only browser endpoints. No external generation/service requests are
part of these scripts. The static preview servers allow only this pack and
`assets/ui/` paths. Source revision is `68f859f903ad09119594dcafca83f6de8362a9ed`.

These are executed-source records, with the original cloud path
`/workspace/thousand-unit-skirmish-ui-audit`; adapt that root and the fixture
import to another checkout. Copy/adapt them outside the retained pack and
choose a new output directory for a rerun so it cannot overwrite these saved
iterations. Existing dependencies must be installed from the lockfile first.
Chromium requests software ANGLE; the receipt records renderer-reported
`WebKit WebGL`, not a proven hardware model or comparable GPU benchmark.

The first gameplay attempt used `fromSurface:true` and timed out during
`Page.captureScreenshot`. The revised bridge uses `fromSurface:false`.
The [failed-attempt receipt](../captures/attempt-1/failure.json) and partial
images remain saved. The [initial sketch renderer](../iterations/initial/render-executed.mjs)
and original HTML/PNGs retain the first glyph-defective study. The current
HTML is [the revised authoring source](../preview.html).

[measure-contrast.py](../measure-contrast.py) reads CSS metadata and PNG pixels
with Pillow. It writes only the proposal measurement JSON; it does not edit
images. It excludes the mixed-style objective description/link parent and
records the conservative rectangle-sampling limits. The runtime receipt is a
separate earlier measurement of the actual game's five captured states.

The scripts are evidence utilities rather than a new repository capture
interface. `game-dev` was unavailable; these direct CDP outputs are unsealed.

[Pack gallery](../README.md)
