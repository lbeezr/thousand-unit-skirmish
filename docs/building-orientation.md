# Building facing and final-art placement

[Finished building renderer](frontier-building-runtime.md) · [Recovery contract](references/build-placement-recovery.md) · [Testing strategy](testing-strategy.md)

The orientation workstream owns manual placement facing through normal rendering,
release inclusion, identified staging delivery and actual appearance verification.
This increment uses the eight existing Complete families and introduces no art.
Smart facing remains a separate follow-on. Source and CPU acceptance do not close
rendered or deployed acceptance.

## Audit and implemented contract

Baseline inspected: `e445d344bafe68823b51babe60ccdad6508ce8ad`, 4 October 2026.
Eight authored camera views already existed for Town Center, House, Storehouse,
Stable, Workshop, Watchtower, Barracks and Archery Range. The camera selected the
view; the building had no persisted logical facing. The old placement ghost was
procedural geometry, with no rotation control. Placement commands, server
validation and checkpoints carried no orientation.

| Stage | Current behavior in this increment |
| --- | --- |
| Placement and input | Build displays the real Complete sprite at 50% opacity over a clear/blocked footprint. Rotate left/right buttons and default `[` / `]` keys change the preview. Settings remap the two printable keys; visible labels follow the binding. Camera wheel/scroll remains unchanged. Typing, composition, open dialogs, repeated keys and Ctrl/Alt/Meta shortcuts cannot rotate placement. |
| Command and cost | Normal `build` serializes integer `orientation` with the selected workers and snapped site. Pending requests freeze the site/facing and disallow duplicate submission/rotation. Preview creation never invokes a gameplay factory or debits resources. Invalid canvas/UI targets cannot submit. |
| Server authority | Omitted orientation means zero. Approved odd square footprints accept exactly integer 0–3; malformed values and nonzero unsupported facings reject before occupancy, IDs, navigation or cost change. Existing terrain, collision, affordability, worker and resource guards retain authority. Resume-by-building-ID uses the existing building's facing. |
| State and recovery | Paid buildings store facing; ordinary disclosed building snapshots emit it. Checkpoint validation rejects invalid facings. Legacy optional field omission recovers at zero; this additive field retains checkpoint schema 29. The native scenario exercises two real process restarts, both seats and legacy omission. |
| Atlas and fallback | Camera azimuth minus logical quarter turn selects the original manifest view. Ordinary final rendering and preview use the same loader, image, scale and anchor. Rotated procedural construction/damage fallback turns once; older single-view captures yield to procedural fallback for nonzero facing. Existing normal depth shader remains unchanged. |
| Footprint and entrances | Today's approved paid footprints are scalar square 3×3, or 5×5 for Town Center. Four quarter turns preserve the complete reserved cells. Logical front is authored +Z, rotating with the view and preview entrance marker. Rectangular, irregular, even-sized or unapproved definitions cannot opt in implicitly. |
| Production egress | Ground producers prefer the legal cell nearest the rotated front midpoint, then other legal perimeter cells, with stable cell-ID ties. A threshold must have a legal local cardinal elevation crossing from the footprint. Occupied thresholds may spill through at most four legal traversable steps. A distant ramp cannot legalize a cliff drop. No locally legal spawn room rejects training without debit. Dock berth and historical starting Town Center production retain their separate contracts. |

The eight camera views remain intact, including diagonal views as the camera
turns. They are not eight diagonal gameplay footprints. No asset symmetry or
orientation metadata is rewritten, no image is mirrored, and no new heading is
invented. Doorways are a preferred exit side, not a simulated interior portal;
workers, repairers and attackers still use the legal perimeter. Rally points
continue to direct units after birth.

The ghost resets and releases texture leases on cancellation/type changes;
late image loads cannot restore a canceled preview. Buttons retain the last valid
battlefield site while focused, so mouse/touch rotation remains visible over HUD.
Actual placement still requires a fresh valid battlefield click. All eight
approved families retain their calibrated source colors, anchors and full images.
Explicit old-art/family comparison URLs do not establish rotated procedural
fallback parity for excluded families; use an ordinary URL for this feature.
Farm, Mill, Dock and palisades have no approved Complete family in this increment:
they retain footprint/line previews and fixed facing. Farm/building-action and
asset readability audits remain separate outcomes.

## Controls and precedent

The existing HUD and Settings use English DOM text rather than a localization
catalog. This increment follows that convention and `event.key` for keyboard
layouts; Unicode printable bindings and Shift-produced bindings work. Number keys,
existing unit-order letters, camera keys and modified browser shortcuts are
reserved. Touch users have visible buttons, with 44-pixel coarse-pointer targets.

The user's remembered AoE scroll-wheel building rotation is unverified. The
[official AoE IV shortcut guide](https://www.ageofempires.com/news/aoeiv-shortcuts-revealed/)
confirms remappable controls and camera rotation; it does not establish that
building-wheel behavior. The implementation therefore chooses explicit remappable
keys/buttons without claiming that precedent or taking camera zoom.

## Acceptance and retained evidence

```sh
node --test scripts/building-orientation.test.mjs scripts/building-orientation-client.test.mjs scripts/building-placement-preview.test.mjs scripts/building-rotation-controls.test.mjs scripts/frontier-building-default.test.mjs scripts/renderer-qualification-building-orientation.test.mjs
node scripts/building-orientation-scenario.mjs --report=/tmp/orientation-native.json
npm run test:fast -- --report=/tmp/orientation-fast.json
node scripts/railway-release-scenario.mjs
```

CPU contracts use real approved manifest/PNG hashes, both team colors, eight
families and four facings. Image decode is mocked; these tests verify image
selection, transform/anchor parity, cancellation and depth/picking ownership,
not GPU pixels. Paid server tests cover malformed/colliding requests, balances,
corrupt checkpoint rejection, legacy default and local ledge exits. Native
process coverage includes eight paid Barracks, a paid wall obstructing the front,
training costs and cold recovery.

The [cloud preflight](qa-evidence/building-orientation-2026-10-04/cloud-preflight.json)
records clean baseline source, one normal sandbox launch, `sandbox-unavailable`
and `storage-unavailable`, zero readbacks, screenshots or game frames. No sandbox
bypass was attempted. The [first qualified cloud run](qa-evidence/building-orientation-2026-10-04/qualified-first-run.json) passed sandboxed WebGL2 and captured two live movement frames, but failed before any building image: the placement snapshot omitted the shared strict diagnostic flag used across normal room navigation. The capture adapter now observes that flag with the same opt-in contract as existing diagnostics. This failed run establishes no building appearance acceptance. The existing qualified #323 Actions workflow now runs
`renderer-qualification.mjs PACK_JSON EVIDENCE --buildings`: clean pack/digest,
locked dependencies, normal HUD selection/build, native input, real paid House,
three retained actual WebGL screenshots and preview/final source-transform parity.
The diagnostic flag only observes the renderer; no building-art override or
fabricated simulation object is used. Human review of those exact-build images
is still required; changing full-canvas hashes alone cannot prove the ghost
because workers also move. House on flat ground establishes only that bounded
case. Other-family, raised-ground and occlusion acceptance remain open.

The orientation owner retains rendered acceptance on the exact packed source and
identified staging build. Layering owner `01a107d0-baaf-73f1-b097-4d31db1ae026`
retains the dark building square, occlusion and palisade earth fixes. Shared
captured-art hunks here are only orientation-relative frame choice and the
preview opacity/depth/picking option; normal depth correction is unchanged.
Universal movement owner `01a107ba` retains endpoint/egress contracts; this bounded
production preference and local exit guard live in `findProductionSpawnCell`
and `src/building-orientation.mjs`. Catalog `01a0fcf5`, novice HUD
`01a101f7-35be`, and helper moves `01a10711` retain their separate streams.

## Next justified slice: optional suggested facing

Keep manual choice authoritative. A separate, tested helper can rank the four
legal facing thresholds by reachable open-space clearance using only terrain and
occupancy already disclosed to the player. Unknown cells must not reveal hidden
buildings or units. Score a bounded cardinal neighborhood, reject illegal local
ledge/wall exits, and break equal scores by default facing then stable integer
orientation. Suggest once at placement start or explicit player request; do not
spin while hovering or override any explicit key/button choice. Validate wall,
ledge, crowded, symmetric and fog cases separately before default adoption.

Rectangular/irregular buildings need authored footprint offsets, rotated access
cells, anchor semantics and collision/recovery tests before adding facings. New
matching lifecycle art and doorway-only interaction are separate asset/simulation
work, not prerequisites for this manual square-footprint increment.
