# Stone client surfaces · 2026-10-03

On clean client source `b235eb3ce6e9bd4a28e757e979eb4b47c607c5ec`, both real browser
seats accept the explicit `stone-defense-v1` profile, show zero Stone, show the
existing 150 wood / 50 food Watchtower price plus 50 Stone, and disable the
unfunded build action. The baseline Stone card stays hidden. The stock card
fits the 1280×720 and 390×720 viewports. There were no captured browser/runtime
errors, and all 92 modules in the served client import graph were readable.

[Recorded checks](../artifacts/stone-client-surfaces/2026-10-03/checks.json) ·
[Azure desktop](../artifacts/stone-client-surfaces/2026-10-03/seat-0-1280.png) ·
[Azure mobile](../artifacts/stone-client-surfaces/2026-10-03/seat-0-390.png) ·
[Ember desktop](../artifacts/stone-client-surfaces/2026-10-03/seat-1-1280.png) ·
[Ember mobile](../artifacts/stone-client-surfaces/2026-10-03/seat-1-390.png).

The owner visually inspected Azure desktop/mobile stock and selected cargo
surfaces. The native proof publishes a bounded 64×64 empty-node map through the
normal host socket and uses real game snapshots. It does not inject client banks
or patch application functions. It proves surfaces only, without natural Stone
gathering, funded construction, or authored ore artwork.

Chromium 151.0.7922.173 ran with local ANGLE SwiftShader. The host's default launch
failed on a misconfigured sandbox helper/crashpad setup; a disposable test wrapper
used local XDG directories and `--no-sandbox --disable-crash-reporter
--use-angle=swiftshader --enable-unsafe-swiftshader`. These are local capture
settings, with no deployment changes and no performance claim.

The client regression command passed 164 tests. The additional real snapshot
decoder tests passed 17 tests, including both seats' cold welcome and subsequent
updates with fractional Stone cargo, plus rejecting a mismatched gameplay pin.
The tests exercise conservative stock display, exact fractional affordability,
selection/Return cargo, private opponent-null banks, baseline reset, Mill food-only
labels, and existing Farm/Dock/Skiff/wall/rematch surfaces.

```sh
node --test scripts/economy-client.test.mjs scripts/client-rematch-recovery.test.mjs scripts/building-placement-forest.test.mjs scripts/dock-placement.test.mjs scripts/resource-format.test.mjs scripts/roster-building-ui.test.mjs scripts/depleted-resource-construction.test.mjs scripts/mill-contract.test.mjs scripts/construction-selection.test.mjs scripts/contextual-hud.test.mjs scripts/skiff-contracts.test.mjs scripts/wall-placement-client.test.mjs scripts/unit-visual-state.test.mjs scripts/selection-context.test.mjs scripts/skiff-fishing.test.mjs
node scripts/economy-client-browser.mjs --output=/tmp/stone-client-surfaces-proof
```

Next content outcomes follow the [selected Stone contract](stone-defense-contract-proposal.md):
the map owner admits profile-specific nodes and authoring with 200 finite stock
per seat in 67/67/66 nodes; the opponent owner adds typed gather/spend policy;
then both seats prove natural harvest → deposit → paid Watchtower → proportional
unfinished refund and cold recovery. Frontier remains the sole verified playable
faction. These surfaces add no civilization.
