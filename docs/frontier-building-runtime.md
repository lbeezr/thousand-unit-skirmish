# Finished Frontier buildings in normal matches

[Asset guide](assets.md) · [Renderer contract](renderer-state-contract.md) ·
[Preserved source history](lore/art-evolution.md)

The existing finished **Town Center and House** captures are now selected in
ordinary matches without a preview URL flag. Both starting and paid Town Centers
use the same finished civic-hall design. The House's eight existing PNGs and
manifest join the already packaged Town Center; no model or new binary is added.
Storehouse, Stable, Workshop and Watchtower are the next default bindings in
this integration task, using their existing eight-view families.

## Existing art, truthful state fallback

These packs contain Complete only. At progress ≤27.5% the loader requests
Foundation, above that until completion Frame, and after completion health
≤30%/≤60% selects Critical/Damaged. When this design lacks that state, its
Complete sprite is hidden immediately and only that state uses fallback:

| Building | Normal Complete source | Missing-state fallback |
| --- | --- | --- |
| Town Center | `frontier-civilization-scale-pilot-v1/town-center-complete-renderer.json` | Existing five-state captured Town Center; procedural geometry while a fallback frame is unavailable |
| House | `frontier-civilization-scale-pilot-v1/house-complete-renderer.json` | Existing construction/procedural House |

Repair to healthy Complete restores the preserved finished art. A pending,
failed or superseded image cannot leave a finished sprite over an unavailable
construction/damage state. Destruction removes the group; no new collapse or
ruins animation is claimed. The full lifecycle/mask validator remains useful
for future authored coverage, but missing coverage does not reject the existing
finished family from normal use.

All 48 existing source PNGs across the six families were independently hashed
against the consuming fork's manifests and decoded as unclipped 1024-square
RGBA. The [source receipt](qa-evidence/default-frontier-buildings-2026-10-03/source-images.json)
records exact paths, bytes, SHA-256 and alpha bounds. Town Center/House view 01
pixels were inspected again for this integration. They retain their civic-hall
and small-house designs; source PNGs, registered capture records and manifests
are unchanged. Original ignored GLBs are unnecessary for using these sprites
and are not added to public runtime packaging.

## Renderer and gameplay boundaries

The recorded camera remains orthographic at 46° elevation, eight 45° azimuths,
128 pixels/world unit and ground pivot `[512, 647.1527325565025]`. An 8-unit canvas
retains the measured 4.4-unit Town Center and 2.3-unit House base widths; there
is no independent fitting/cropping. Orthographic facing uses camera direction,
so panning and different map positions cannot choose a different heading.
Game occupancy remains the authoritative **5 × 5 Town Center / 3 × 3 House**;
the renderer does not change placement, collision or costs.

The original blended captured color pass keeps its existing alpha edges and
baked lighting. A shared-art, color-disabled opaque body pass applies the same
ground-depth correction as PR #107, with alpha test 0.9 and no picking handler.
Its child transform, center, image and shared Sprite geometry match the color
sprite exactly. It inherits fog visibility and disappears with the parent.
Existing selection, health, production, combat and rally objects remain on the
outer group. Team standards remain outside hidden fallback geometry. These
Complete captures have no aligned team masks: their painted pennants retain
source colors, while the existing live standards/outline/cues retain team color
and shape. This does not claim newly authored team variants.

Immutable composed frames are shared by URL/hash and, when present, verified
mask/team color. Unmasked images share one CanvasTexture across both teams and
all instances. Each displayed/pending consumer holds a lease; stale requests
release their leases and the last owner disposes the texture. The body pass
shares that texture, avoiding one 1024-square texture per normal House. This is
a structural resource contract; GPU timing/residency requires native evidence.

Explicit `frontierBuildingsPreview=0` remains an old-art comparison override.
Named preview modes and `=1` retain their earlier comparison semantics. Normal
URLs require none of these flags. The server already admits the exact six
families' manifest/PNG paths; Docker admission includes only selected sprites,
not provider snapshots, GLBs, galleries or unrelated files.

## Verification and open native acceptance

```sh
node --test scripts/frontier-building-default.test.mjs scripts/frontier-building-preview.test.mjs scripts/frontier-building-renderer.test.mjs scripts/captured-building-state-race.test.mjs scripts/captured-building-manifest-retry.test.mjs scripts/building-sprites.test.mjs
node scripts/railway-release-scenario.mjs
npm run docs:check
```

The default-factory test executes actual game constructors with Three objects,
verifies real manifest/image hashes, exercises both teams and missing states,
checks calibrated anchors/facing, raycast/depth ownership, retained feedback and
last-owner texture disposal. DOM image decoding is mocked; it does not render
WebGL. The release scenario serves the actual Docker COPY output and checks
every admitted PNG's HTTP status, MIME, byte count and SHA-256, plus the client
import graph and private/source exclusions.

This task remains open until the integrated revision is deployed and observed
in an **ordinary game without preview flags**. Mac QA should record the served
revision and room/map, then capture both teams' starting Town Centers and a paid
House at normal/strategic zoom, with actual Workers, selection/production/rally
feedback and terrain contact. Exercise foundation → frame → Complete, damage
→ repair, fog hiding and destruction; finished art must appear on completion,
with truthful state fallback and no ghost depth/picking target. Preserve before,
after and rejected iterations with hashes and link them from the art wiki.
Neither this source check nor the separate Barracks depth-cost fixture proves
that deployed normal-match acceptance. No such screenshot is claimed here yet.
