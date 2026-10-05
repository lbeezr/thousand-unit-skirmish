# Building facing and final-art placement

[Finished building renderer](frontier-building-runtime.md) · [Recovery contract](references/build-placement-recovery.md) · [Testing strategy](testing-strategy.md)

The orientation workstream owns manual placement facing through normal rendering,
release inclusion, identified staging delivery and actual appearance verification.
Manual facing now covers the eleven registered square building families and introduces no art.
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
Actual placement still requires a fresh valid battlefield click. All eleven
approved families retain their calibrated source colors, anchors and full images.
Explicit old-art/family comparison URLs do not establish rotated procedural
fallback parity for excluded families; use an ordinary URL for this feature.
Mill, Farm and Dock now use their admitted economy lifecycle packs. Palisades retain their line/connection contract; Gate facing comes from the existing wall conversion rather than this free-rotation control. Farm/building-action and asset readability audits remain separate outcomes.

## 5 October 2026 — economy-facing regression audit

At main `446d5a99374b3aaf06d30948ad9c01cb3f6080e5`, eleven families had default registered views, but the original eight-family rotation list still excluded Mill, Farm and Dock. This hid their buttons, ignored rotation keys, and rejected paid nonzero facing. The fix admits all eleven explicitly; a registry-parity guard catches another art-only admission. The existing key/button, pending request, camera and editing guards serve every admitted family.

| Family | Footprint | Registered headings per state | Placement facing before → after | States in default registered manifest |
| --- | --- | --- | --- | --- |
| Town Center | 5×5 | 0,45,90,135,180,225,270,315° | four → four | Complete |
| House | 3×3 | same eight | four → four | Complete |
| Storehouse | 3×3 | same eight | four → four | Complete |
| Stable | 3×3 | same eight | four → four | Complete |
| Workshop | 3×3 | same eight | four → four | Complete |
| Watchtower | 3×3 | same eight | four → four | Complete |
| Barracks | 3×3 | same eight | four → four | Complete |
| Archery Range | 3×3 | same eight | four → four | Complete |
| Mill | 3×3 | same eight | fixed → four | Foundation, Frame, Complete, Damaged, Critical |
| Farm | 3×3 | same eight | fixed → four | those five plus Exhausted, Exhausted Damaged, Exhausted Critical |
| Dock | 3×3 land, shoreline constraint | same eight | fixed → four legal shore choices | Foundation, Frame, Complete, Damaged, Critical |
| Palisade | 1-cell line segments | no registered captured family | line/connection placement | procedural connection states |
| Palisade Gate | converted wall cell | no registered captured family | wall conversion | procedural gate/connection states |

The eight captured headings remain camera views; manual placement has four logical quarter-turns. Ordinary placed art, lifecycle art, procedural fallback and preview consume the same persisted `orientation`. There is no sprite-only occupancy rotation: each square keeps its reserved cells. Mill/Farm retain legal perimeter drop-off/harvest access, rather than inventing a doorway-only rule. Art backing is the already admitted [economy pack](../assets/buildings/frontier-economy-models-v1/README.md) and its selected reference records.

Dock's registered front landing is +Z. Explicit manual facing 0/1/2/3 binds the water berth to south/east/north/west. The chosen shore must provide the same hull clearance and outward legal water edge during preview, authoritative placement, saved-state validation, Skiff birth and fish delivery. An unavailable chosen shore shows a rotate hint and rejects before cost/occupancy/IDs change; it never silently switches to another open shore. New explicit-facing paid Docks carry optional `dockFacingVersion: 1`, emitted in snapshots and persisted with their facing. Invalid markers, missing marked facing and corrupt marked shoreline reject recovery.

Unmarked old Docks saved zero while selecting any cardinal berth; they retain that historical priority and zero artwork on recovery. Commands from older clients that omit facing retain the same legacy contract. Marked manual sites never take that compatibility branch. No checkpoint version migration, old-site automatic spin, new art, held source publication, cost change or camera-wheel change is introduced.

Cloud executor: Linux `/workspace`, connected on 5 October. The one local normal-sandbox capability probe was blocked by `sandbox-unavailable`/`storage-unavailable`, with zero game frames. The qualified #323 Actions capture now requests House, Mill, Farm and Dock through native HUD/input, each with default ghost, quarter-turn and paid Complete parity; Dock publishes disclosed two-shore terrain through the ordinary map command. Capture acquisition and actual appearance acceptance remain separate. Earlier House screenshots do not establish these new families or this revision. Implementation owner retains current cloud capture, independent appearance inspection, clean release and identified staging verification.

Focused commands include the checks below plus `node --test scripts/dock-placement.test.mjs scripts/skiff-fishing.test.mjs scripts/frontier-economy-art.test.mjs`, `node scripts/building-economy-orientation-scenario.mjs`, and the existing Dock/Skiff native compatibility scenarios. The new native scenario uses real paid sites/costs, all four Dock facings for both seats and two process restarts. It explicitly supplies completed checkpoint fixtures for spawn tests and makes no rendered claim.

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
training costs and cold recovery. The changed native Scout exit exposed a PvE housing interaction: an empty-cargo Worker traveling to a distant tree was pulled back to build before its first delivery. Home housing now uses an idle Worker or a gatherer within 12 units of home. Both-seat paid discovery/deposit and cold recovery regressions verify this bounded integration guard.

The [cloud preflight](qa-evidence/building-orientation-2026-10-04/cloud-preflight.json)
records clean baseline source, one normal sandbox launch, `sandbox-unavailable`
and `storage-unavailable`, zero readbacks, screenshots or game frames. No sandbox
bypass was attempted. The [first qualified cloud run](qa-evidence/building-orientation-2026-10-04/qualified-first-run.json) passed sandboxed WebGL2 and captured two live movement frames, but failed before any building image. Its generic failure stage did not locate the cause. Review found and fixed a missing shared strict diagnostic flag in the placement observer. The [second run](qa-evidence/building-orientation-2026-10-04/qualified-second-run.json) localized the remaining failure to map publication: a 64-square lab map cannot be published in the ordinary room. The adapter now uses a normally admitted 160-square map. Neither failed run establishes building appearance acceptance. The existing qualified #323 Actions workflow now runs
`renderer-qualification.mjs PACK_JSON EVIDENCE --buildings`: clean pack/digest,
locked dependencies, normal HUD selection/build, native input, real paid House,
three retained actual WebGL screenshots and preview/final source-transform parity.
The diagnostic flag only observes the renderer; no building-art override or
fabricated simulation object is used. The [exact-build qualified report](qa-evidence/building-orientation-2026-10-04/qualification.json) passed at `2a4d070f7d85c5da5563bb10422c8185641a0729`, clean release `sha256:ae5a497edf612fbe23771928420abcab1098fd7cdff771823fbf37e93705149c` (1,213 files). Both the implementation owner and independent evidence review inspected the original [default ghost](qa-evidence/building-orientation-2026-10-04/building-ghost-default.png), [rotated ghost](qa-evidence/building-orientation-2026-10-04/building-ghost-rotated.png) and [paid completed House](qa-evidence/building-orientation-2026-10-04/building-paid-complete.png). The [bounded appearance review](qa-evidence/building-orientation-2026-10-04/appearance-review.json) accepts visible facing change, translucent preview and final image/site/scale/anchor parity. The HUD records the ordinary 75-Wood debit and eight capacity gain. House on flat ground establishes only that bounded
case. Other-family, raised-ground and occlusion acceptance remain open.

Headless exact-replay observations exclude the per-process `serverInstanceId`
transport nonce introduced by browser recovery; complete gameplay payloads remain
compared. Actual process/browser recovery tests retain that identity contract.

Exact rendered source acceptance above is retained separately from identified staging delivery. The orientation owner retains staging identity verification. Final broad fast testing found a Tiny completion failure at `pve-tiny-search-case.mjs:73` for seeds `20260925,0`. Independent isolated testing reproduces it on unmodified main `5669ad8dfa4bf49f0a6945cd70d412f35b518e66`, before this increment; the unchanged 3,600-second limit fails. No green full fast lane or full CPU suite is claimed. Browser/navigation/camera VM bindings discovered by that run were repaired with the shared recovery adapter and actual capture function. Layering owner `01a107d0-baaf-73f1-b097-4d31db1ae026`
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
