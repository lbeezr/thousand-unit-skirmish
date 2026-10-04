# Asset adoption checklist

[Working rules](../AGENTS.md) · [Planning](contributor-planning.md) · [Asset guide](assets.md) · [Historical building audit](art-runtime-audit-2026-10-03.md)

Original source audit: fork main `90e7ad4c666916942c29670e339a8e79e03e0b18`.
Binding follow-up: `1757064b5e78a2ac2d9329771f6c16a599afd95b`,
3 October 2026, including renderer [PR136](https://github.com/lbeezr/thousand-unit-skirmish/pull/136)
and [PR141](https://github.com/lbeezr/thousand-unit-skirmish/pull/141).
This checklist records adoption gaps; it does not integrate the assets.
The Frontier building row was subsequently updated by its implementation owner
for [PR #136](https://github.com/lbeezr/thousand-unit-skirmish/pull/136) and
[PR #141](https://github.com/lbeezr/thousand-unit-skirmish/pull/141); the dated
deployment table below remains dated evidence; the release receipt was rerun
after both merges.
Owner names below are role owners reported in the active work or existing
[art lanes](art-production-lanes.md). **Unassigned** means no accepting worker
was identified. Source-only and superseded comparisons have no obligation to
replace current art.

## Definition of done

- [ ] Normal gameplay uses the intended art by default in the relevant map/action/state.
- [ ] The served release contains every requested runtime file; HTTP/hash checks pass.
- [ ] The relevant user environment runs an identified revision/release containing it.
- [ ] Actual in-game use on that revision is verified, with a map, observation and evidence.

Generation, exported files, an opt-in preview and PR merge are milestones.
Unchecked steps remain **incomplete**, with an owner/next action. Technical
delivery does not establish visual or listening acceptance. Preserve original
art, prompts, manifests and provenance; never publish a private source to close
a transfer gap. These criteria do not prevent incremental scoped merges.

## Exact deployment evidence

Railway read-only `environment-status` + `list-deployments`, inspected about
20:57 UTC on 3 October 2026, identified one running replica in each environment:

| Environment | Successful active deployment | Platform-reported source revision | Meaning |
| --- | --- | --- | --- |
| staging | `734d7f69-b4bc-4257-88b6-d8f565bdc5ae` (success 20:14:44 UTC) | `19cae81f7636ebfe426911695a423d93a81e59ed` | Contains [PR126 Sheep](https://github.com/lbeezr/thousand-unit-skirmish/pull/126) merge `7c6ec842349cab30afde9244c8953fee8ab91599` and [PR123 fishing](https://github.com/lbeezr/thousand-unit-skirmish/pull/123) merge `02b8ee378df5053091833e5236e8f3c008fae269`, checked with git ancestry. |
| production | `34b1722b-de5b-4583-98fa-89735746f6fb` (success 15:07:23 UTC) | `67b166748f6cc82c0a76319478f4475da1ab9083` | Contains neither merge. Eight-view Sheep and approved SE fishing delivery here are **incomplete**. |

Project `32da8e2c-3377-49ed-8df0-45f72ecdc562`, service `game`
`408356ca-c8cd-4932-abca-d5ebef430dd5`. These are deployment metadata and ancestry,
not authenticated asset-byte or fresh in-game observation. No credentials were
read and no deployment was changed. The public `/ready` endpoint exposes only
readiness, so it cannot establish a running revision. Railway owner retains
delivery and exact-build smoke; production promotion stays within its existing
authorization boundary. Which environment the user's browser targets was not
supplied. Sheep/fishing visual checks below remain incomplete. Neither observed deployment
contains the later PR136/PR141 six-family Frontier default integration; its
delivery and ordinary-game screenshots are also **incomplete**. The parent-owned
Mac QA machine was reported offline at the latest routing check.

## Buildings, wildlife, fishing and HUD

Package paths are under `assets/` unless linked otherwise. Release inclusion
comes from an actual clean `release:pack` at follow-up `1757064`: 1,113 files,
digest `sha256:8fe4de1ee7c932004572d35990b484c75a1e9f78c4735451e83595f09d638642`.
It proves local package contents, not delivery of those bytes to a browser.

| Package/family | Production and normal-game binding | Preview / release | Incomplete work → owner / next action |
| --- | --- | --- | --- |
| Frontier Town Center, House: `buildings/frontier-civilization-scale-pilot-v1`; Storehouse, Stable, Workshop, Watchtower: `buildings/frontier-civilization-models-v1` | Six **Complete-only** families now selected without preview flags; [runtime guide](frontier-building-runtime.md) records exact state fallback, shared texture/depth and retained team feedback. Source frames and authoritative occupancy are unchanged. | Six manifests + 48 original PNGs explicitly admitted; packed HTTP/hash checks pass. Named/`1` previews and `0` comparison remain available. | **Deployment and in-game adoption incomplete** → building workstream retains [PR #141](https://github.com/lbeezr/thousand-unit-skirmish/pull/141) through explicit acceptance closure. Railway delivery and offline Mac QA are supporting owners using the [exact ordinary-game recipe](qa-frontier-building-adoption.md). Source/CPU/release checks and handoff cannot close those steps. Building production owner derives missing lifecycle/masks separately. |
| `buildings/frontier-civilization-concepts-v1` | Eight preserved wiki concepts; the military pair now has original local Complete models and registered views in the new pack below. Older construction samples remain distinct designs. [Inventory and production slices](frontier-barracks-range-authoring.md). | Concepts are reference only; omitted. | **Full replacement incomplete** → building workstream retains matched lifecycle production, identified delivery and gameplay verification; concepts are not production-state coverage. |
| [`buildings/frontier-civilization-military-models-v1`](../assets/buildings/frontier-civilization-military-models-v1/README.md) | New Barracks and Range: sixteen original local Complete renders, two default manifests, public authoring scripts/provenance; editable models and rejected iterations retained privately. Missing states use older direct art; live team/selection/health/rally/depth feedback retained. | Eighteen exact manifest/PNG paths admitted to HTTP/Docker/release; packed MIME/hash check passes. No models, scripts or galleries ship. | **Deployment/native acceptance and matched lifecycle incomplete** → building workstream: verify normal entry, both teams, Worker front/rear, ground/flag legibility, paid construction/damage/repair/production, then author matched missing states. No native screenshot or delivery claimed; [source/replacement guide](frontier-barracks-range-authoring.md). |
| `buildings/town-center-lifecycle-meshy-v1` | Older [captured loader](../src/captured-building-art.mjs): five states × eight views, team masks; now supplies missing-state/loading fallback beneath the new Complete Town Center. | 81 files packed. | **Current combined appearance unverified here** → renderer owner: recorded-build construction/damage/repair, team/zoom/occlusion check. |
| `buildings/barracks-sprite-test-v1`, `buildings/archery-range-sprite-v1` | Retained [direct sprites](../src/building-sprites.mjs): five states × two teams; missing-state/loading fallback for the new Complete families. | Ten WebPs each packed. | **Full current-build appearance unverified** → building workstream: both-team lifecycle/occlusion proof; [prior checks](qa-barracks-lifecycle-2026-09-27.md) are dated evidence. |
| `buildings/archery-range-construction-v1` | Exported five-stage atlas with masks; pivot/game placement unverified; normal game uses the other Range pack. | Candidate/review only; omitted. | **Incomplete admission**, not a drop-in final replacement → building + renderer owners: resolve five-stage mapping/pivot and choose explicit adoption or retained comparison. |
| `units-buildings/frontier-glb-sample-v2`, `frontier-barracks-construction-v1`, `frontier-archery-range-construction-v1` | GLB/source-review samples. Authoring manifests do not match runtime renderer schema; no gameplay GLB consumer. | Static reviews; omitted. | **Incomplete runtime production** → technical art owner: compatible export/capture and state mapping if these designs are chosen; no need to ship unused GLBs. |
| `buildings/town-center-sprite-v1`, `town-center-meshy-review-v1`, `town-center-state-concepts-v1` | Legacy direct Complete, earlier captured Complete and lifecycle source concepts. Default lifecycle pack supersedes them. | Direct/concepts omitted; eight earlier captured WebPs still packed. | Retained lineage, **not new adoption targets** → building owner preserves provenance; renderer owner can audit redundant release copies separately. |
| Skiff | Normal gameplay still uses the procedural water placeholder; a private default-binding/export packet passes focused contracts, decoded registration and local release/HTTP checks. | Public runtime admission and deployed use remain unverified; no cloud game screenshots. | **Native acceptance/publication incomplete** → Coastal technical-art owner retains the [ranked workstream](coastal-barrier-art-workstream.md): inspect the occupancy-matched 0.72 × 0.27 hull in a working Mac browser; publish only the three Skiff runtime exports after the user's visual-check condition passes; retain default/release/identified-user-game acceptance. |
| Palisade wall/gate | One-cell procedural timber uses disclosed cardinal connections and authoritative `gateOpen`; current mechanics are distinct from the old three-cell gate concept. | No authored public runtime wall/gate manifest is registered. | **Production/adoption incomplete** → the same Coastal technical-art owner advances independent [bounded barrier slices](coastal-barrier-art-workstream.md): Complete wall topology first, separate one-cell open/closed gate, then registered lifecycle states. Preserve existing occupancy/traversal and fallback; barrier publication scope remains separate. |
| Mill, Dock, shore-fish glyph | Normal gameplay uses procedural placeholders in [main](../src/main.js) and [fish marker](../src/shore-fishing-placeholder.mjs). No independent authored runtime pack found. | Placeholder code ships; no art gate. | **Incomplete production** → art recipient **unassigned** for these families. Gameplay owners retain functioning rules. |
| `wildlife/bellweather-sheep-static-v1` | Eight approved static idle views in the default [wildlife registry](../src/neutral-wildlife-renderer.mjs), including historical Millrace opening Sheep; current ordinary Tiny defaults to Terraced Vale 160 with no Sheep. Actual disclosed motion/Herd positions drive art, picking, rings and minimap. Owned live Sheep use separate contextual Herd/Stop controls; shared Gather remains unchanged. Carcass remains marker; empty/fog-hidden nodes disappear. | Three runtime files packed, no opt-in. Historical `previewOnly` metadata is not a current runtime gate. | **Staging still source delivered; new client acceptance incomplete** → Wildlife owns [Herd/Stop native acceptance](qa-sheep-owned-controls-2026-10-04.md) and [position evidence](qa-sheep-relocated-client-2026-10-04.md); active Railway owner supplies an identified containing build. New walk/graze/carcass/collar exports remain with Sheep art task `01a101a8-fba6-7323-a40c-27efd0112007`, pending supported private transfer/publication boundary. [Motion deployment/appearance](qa-sheep-motion-2026-10-03.md) and [true-claim acceptance](qa-sheep-claims-2026-10-03.md) remain owned. |
| `wildlife/bellweather-sheep-public-reference-v1`; [Sheep concept/model-input records](wildlife-bellweather-sheep.md) | Earlier single-view/reference lineage; superseded by eight-view pack. [Local walk candidate](sheep-local-walk-candidate.md) is capability/inspection planning, not a walking clip. | Old pack omitted; private GLB not published. | **Walking production incomplete** → Sheep owner: supported private transfer, hash-verified rig feasibility, one actual articulated heading. Preserve idle art. |
| `units/cast-human-sprite-v3` + [fishing SE source](art-direction/human-roster-v1/fishing-SE-v1/README.md) | Default Human Worker v0.14.0 has four SE fishing keys + water-contact cue. Seven headings/Boughward keep exact food/gather/idle fallback; ordinary central Lab approaches are east/west. | Three unit runtime files packed, no fishing flag. | **Native SE contact/root/readability verified** in [PR142](https://github.com/lbeezr/thousand-unit-skirmish/pull/142); **deployed acceptance/motion coverage incomplete** → Worker art/renderer owner: smooth the four stepped keys and admit seven remaining headings; Railway owner verifies the delivered user build and retains production delivery. [Contract](worker-fishing-animation.md). |
| `units/cast-human-sprite-v3` land motion v0.19.0 | All eight default walks play: East retained; N/S/W/NW approved-seed keys; NE/SE/SW and all prior action/fishing pixels stay unchanged. Carry/Return use walk with the existing cargo cue. | Existing three runtime files plus manifest are admitted/packed; real packed HTTP/hash checks pass. [Source/playback evidence](qa-worker-land-art-2026-10-04.md). | **All eight walks reviewed/merged in PR226/236/238/244; containing deployment/native function and49 remaining land-action/heading cells incomplete** → delegated Human Worker land-art owner retains pack/source admission; animation `01a103d4` owns state/receipts, parent Railway/Mac route supports exact-build capture. Ranked next slices and art-input assessment are in the linked checkpoint. |
| `units/cast-human-sprite-v3` dedicated Stone SE v0.20.0 | Four dedicated pick ready/windup/strike/recovery keys; seven Stone headings absent. Failed broader iteration retained honestly. | Existing default pack/three runtime files; same directory and dimensions. | **Default selector adoption incomplete** → animation01a103d4 / PR216: enable dedicated Stone state and exact missing-heading idle, verify productive receipt/Stop/attack/move. Art owner retains [source/registration](qa-worker-land-art-2026-10-04.md) and seven headings; parent delivery/Mac route owns exact-build appearance support. |
| Human/Boughward Worker confirmed-work consumer | Default sprite/procedural/scheduling/fishing gates use [version 1 positive receipts](worker-performing-action-contract.md); waiting/unknown/cleared activity uses idle/walk. Existing food/wood frames bind to confirmed resource; Stone has no dedicated sprites. | Exact consumer/protocol module HTTP admission and packed atlas/hash checks pass; no new artwork or preview flag. | **Identified delivery and ordinary-game acceptance incomplete** → animation task `01a103d4` retains [consumer checks and capture recipe](qa-worker-performing-action-consumer-2026-10-04.md); Railway delivery owner supports a containing staging revision and parent-owned Mac QA supplies clips. Cloud browser sandbox failure prevents local GPU capture; CPU/native packet proof does not close appearance. |
| `ui/cursors`, `ui/icons` original six SVGs, `ui/portraits` | Native PNG cursors, six labelled icons, Human/Boughward Worker portrait; Barracks portrait reuses its actual battlefield frames. [HUD bindings](hud-art-integration.md). | UI directory packed, admitted active files served. Old SVG cursor sources are history. | **Native usability/recognition incomplete** → HUD integration owner: game pointer/zoom/layout review; other roster/building portraits need deliberate matching framing. |
| `ui/icons/actions` six glyphs ([PR130 source](https://github.com/lbeezr/thousand-unit-skirmish/pull/130), [PR150 integration](https://github.com/lbeezr/thousand-unit-skirmish/pull/150)) | Refined Follow/cargo sources; all six bound by default at 20 px to existing labelled controls. Drawer duplicates share sources; Formation image is restricted to unit contexts. [HUD contract](hud-art-integration.md). | Six SVGs explicitly admitted; default HTML and GET/HEAD MIME/hash checks pass. Clean release evidence is recorded in PR150. No public candidate-preview switch. | **Deployment and native usability incomplete** → HUD integration owner accepts and retains six-icon integration + clip fix and [native recipe](contextual-hud-validation.md#six-default-action-glyphs--3-october-2026). Railway delivery owner must serve an identified revision containing the integration and PR134 keyboard fix; parent-owned Mac QA must verify actual small-size icons and full keyboard/scroll/dismissal behavior after reconnect. The dated deployment table above does not contain this integration. |

The original `lbliii` retained commit
`99d18c2e74335e6a6fe6bef75ab9dbafcaec1821` was compared through its Git tree
against fork files with `git hash-object`: scale-pilot 44/45 identical (only
README changed), models 81/81 identical, concepts 13/13 identical, no missing
files. All 48 PNG captures, renderer manifests and model provenance match.
Recorded ignored GLB paths are not present here; that does not prove source
models are lost elsewhere. Each new Complete-only family still lacks four
lifecycle states and aligned team masks; destruction/ruins also needs an engine
presentation contract. Preserve the [historical audit](art-runtime-audit-2026-10-03.md)
for those exact production details.

## Resources, terrain and audio

| Package/family | Actual use and release | Incomplete work → owner / next action |
| --- | --- | --- |
| `environment/frontier-v1`, `frontier-interactive-v1` | Default grounds, regional forest/depletion atlases, vegetation/scenery and resource states via [environment art](../src/environment-art.mjs); 488/11 files packed. `meshyResources=0` is comparison; young/pocket forest-age modes are experiments. | **Broader current-build verification incomplete** → environment/renderer owners: map-specific depletion/reset, crossings and normal/strategic views. Regional decorative plants do not imply distinct harvestable resources. |
| `environment/vaelora-region-kits-v2` | Source palette/Root Oak/Hornbeam/Plum etc.; runtime derivatives live in `frontier-v1` and are used there. Source directory omitted intentionally. Original/muted canopy comparisons and young-tree experiments retain explicit switches. | **Directional production incomplete** → vegetation owner: consistent additional tree headings; preserve rejected 90° attempts. [Existing gameplay proof](qa-underbough-gameplay-proof-2026-10-01.md) is dated, not today's deployment observation. |
| `environment/frontier-meshy-fixed-camera-v3`, `frontier-meshy-sprites-v1` | V3 oak/pine eight-heading forest frames and oak/berry full-resource atlases are default; 18 selected files packed. V1 default single-view resource path/fallback remains; all 24 v1 WebPs packed. | **Matching depletion art incomplete** → vegetation owner: same-design worked/low/depleted captures; currently uses interactive art. V3 standalone berry frames/pine atlas are not default requests. |
| `environment/frontier-meshy-fixed-camera-v2` | Earlier fit/capture reference; superseded by v3; omitted. | Retained comparison → technical art owner preserves provenance; do not force the older fit to ship. |
| `environment/vesperra-podvine-low-v1`, `vesperra-veilcap-worked-v2`, `ellionar-sunbloom-low-v4` | Current default directional full/worked selectors; Podvine/Sunbloom additionally have low views, while Veilcap retains worked art at low stock. One atlas each packed; `plantViews=legacy` compares single-view sources. | **Veilcap low art, anatomical/directional and full kit acceptance incomplete** → vegetation owner: missing low views and game-scale root/state review; no pod/flower gathering rule is established. |
| `vesperra-podvine-views-v1`, `vesperra-podvine-worked-v1`, `vesperra-veilcap-views-v1`, `ellionar-sunbloom-views-v1`, `ellionar-sunbloom-crowns-v2`, `ellionar-sunbloom-worked-v3` under `environment/` | Earlier plant exports still packed/served, with descriptor modules; normal environment imports the newer packs above. | Superseded runtime lineage, **not six missing default features** → environment owner: retain source lineage; separately assess unnecessary release bytes. |
| [`environment/frontier-painted-material-atlas-v1`](../assets/environment/frontier-painted-material-atlas-v1/README.md) | Default for exactly eight represented paints after regional/quiet selection; six authored mips, level-5 gradient cap and half-pixel cell insets. Stochastic sampling, 12-unit world alignment and feather masks retained; uncovered surfaces/variants stay individual. Manifest + six WebPs admitted/packed, source PNGs omitted. | **Deployment/appearance incomplete** → painted ground atlas adoption owner retains [revision, checks and game-zoom recipe](qa-painted-ground-atlas-adoption.md); parent staging owner coordinates next staging release and Mac QA. A merge/static check does not close this outcome. |
| [`environment/frontier-oak-depletion-atlas-v1`](../assets/environment/frontier-oak-depletion-atlas-v1/README.md) | Default generic oak worked/low/depleted atlas; six authored quality-86 mips plus manifest admitted/packed. Full/directional/regional/berry art remains. Individual states remain as failure fallback and are skipped on successful atlas load. | **Delivery/game verification incomplete** → terrain integration owns identified staging release, normal stock/zoom/root/fog/depth proof and [cost/acceptance note](qa-oak-depletion-atlas-adoption.md). Static alpha/hash/factory/release checks do not prove pixels. |
| [`environment/frontier-resource-atlas-v1-candidate`](../assets/environment/frontier-resource-atlas-v1-candidate/README.md) | Seven-page layer manifest and four-state lossless oak reference remain unbound/unpacked. Production generic oak depletion is a separate default pack below. | **Retained lineage and split-layer production incomplete** → terrain integration: berries exports and semantic depth mattes remain separate later work. HSV review does not gate the whole-cutout oak path; preserve current stock/occupancy and full/directional/regional art. |
| `environment/sereward-succulent-action-v1` | Four exported poses; review-only, no harvesting gameplay binding; omitted. Current decorative succulents remain separate. | **Incomplete registration/gameplay admission** → vegetation owner + gameplay recipient **unassigned**: resolve anatomical anchors and whether a distinct harvest action is wanted; do not map leaf cutting to forest wood depletion. |
| `environment/vaelora-ground-studies-v1`, `frontier-v2-concepts` | Ground accent/design sources unbound/omitted. | **Experimental production/adoption incomplete** → environment/technical art owners: review motif scale/repetition, then select a normal-game integration; concepts need not ship automatically. |
| [`environment/frontier-cliff-pilot-v1`](../assets/environment/frontier-cliff-pilot-v1/README.md) | Sixteen color/depth images remain review-only. Parent selected low-ridge role; normal tall cliff/cap art remains. | **Technical/default acceptance incomplete** → terrain integration owns [low-ridge placement constraints](../assets/environment/frontier-cliff-pilot-v1/README.md#low-ridge-placement-constraints), join/end/depth/actual-elevation readability. Source height 0.998 with tapered ends cannot be stretched into a tall wall. Existing blocked stone occupancy only; no duplicate navigation, height or sight rules. No parent role decision remains pending. |
| Stone resource/economy (`stone-defense-v1`) | [PR124](https://github.com/lbeezr/thousand-unit-skirmish/pull/124) runtime support is in observed staging `19cae81`; its merge `d5aa464371e21d53f7854e11288e16a5f077d708` is an ancestor. Plain gray node markers are procedural, with no authored ore asset. Current shipped maps declare no Stone profile, so ordinary map selection cannot exercise it. | **Ordinary entry/deployed gameplay adoption incomplete** → [PR140](https://github.com/lbeezr/thousand-unit-skirmish/pull/140) recovery owner finishes corrected checks/review/merge for **Lab · STONE DEFENSE FIELD** (observed draft head `fe3f3a910835cbeef343f770bdf147adbb67ddff`); Railway owner then delivers that map revision and native QA verifies normal lobby → gather/carry/deposit → paid completed Watchtower. Prior executor transport failure is being recovered by the new owner. Authored ore art recipient remains **unassigned**; runtime deployment alone does not close adoption. |
| `audio/runtime` | Eleven regional v2 landscape profiles + technical `rts-feedback-test/v1`; [hash-bound shipped catalog](../src/audio-shipped-catalog.mjs), map selection and input unlock consume them. All runtime files packed. Regional maps, ordinary Shore Fishing and Fortified Crossing bind recorded packs; other maps synthesize. Staging source `32f11d5` contains Shore's PR151 reference. | **Authenticated delivery and actual listening incomplete** → Audio owner retains [profile adoption](qa-shore-audio-profile-2026-10-03.md#staging-source-follow-up) and [ranked backlog](audio-runtime-packs.md#ranked-audio-backlog); Railway delivery owner supports the exact-build path. Public Siltmouths score + reed-wind bed remain provisional, distinct from the earlier water audition. The separate [synthesized interruption fix](qa-audio-synthesis-cancellation-2026-10-03.md) still needs a containing deployment and native observation. |
| `audio/vaelora-zones-v1`, `audio/vaelora-pilot-v1` | Zone catalog: 44 originals; regional runtime uses 11 music + 11 terrain beds. Eleven contrast beds + eleven signatures are audition-only. Pilot sources include four shipped UI ingredients; its music originals are candidates. Source directories are packed, which does not establish map/event bindings. | **Selected audio adoption incomplete** → Audio owner (resumed): audition existing public Shore Fishing water bed or signature against the current cue; select/bind only the accepted material. [Coverage audit](qa-audio-coverage-2026-10-03.md) owns event/score limits. No new recordings required. |

Remaining unit packages are covered by the [normal roster mapping](assets.md#know-what-is-actually-in-game):
Human seven-role v3/v2/v1 set and all seven `boughward-*-sprite-v1` packs ship
and bind by team. `worker-sprite-v1/v2/v3`, `infantry-sprite-v1/v2`,
`archer-sprite-v1`, `cast-human-sprite-v1/v2`, and `cast-orc/elf/troll-sprite-v1`
ship as explicit legacy comparisons, not defaults. `infantry-meshy-reference-v1`
is an omitted source reference. **Authored action/direction/team-mask finish and
fresh deployed roster appearance remain incomplete** → unit art/renderer owners;
do not count approximate action reuse or idle holds as completed motion. The
[animation integration audit](qa-unit-animation-audit-2026-10-03.md) inventories
all default/legacy action frames and fixes idle-placeholder inflation of authored
attack/death lifetimes. Animation integration owner retains delivery and the
linked parent-owned Mac recipe; source tests do not close in-game acceptance.

## Terrain workstream backlog

Owner: terrain art integration workstream. Rank is the next useful work order,
not a gate on unrelated owners. [Inspected evidence/tool acceptance](terrain-candidate-readiness.md)
records why the candidates below stay outside default rendering.

| Rank / state | Outcome and smallest next action | Write boundary / dependency | Acceptance / retained owner |
| --- | --- | --- | --- |
| 1 — open, parent Mac execution queued | Finish painted-ground normal/strategic/closest-zoom and served-hash checks on an identified staging source containing [PR152](https://github.com/lbeezr/thousand-unit-skirmish/pull/152). Historical platform delivery includes `32f11d5` and `0fb9a3d`; identify the active revision at capture. | [Existing QA note](qa-painted-ground-atlas-adoption.md) and PR evidence. Executor browser/HTTP failure persists; parent queues Mac QA after Skiff/combat/Practice. | Exact deployment/source plus actual ordinary stochastic game screenshots. Terrain owner retains acceptance; parent staging/Mac coordinator is the assigned downstream recipient. Platform delivery is proven; appearance/served bytes remain incomplete. |
| 2 — implemented, checks accepted | [PR173](https://github.com/lbeezr/thousand-unit-skirmish/pull/173) checks the committed resource candidate's eight frames against source lineage and cropped layer reconstruction; exposes a read-only npm command and rejects corrupted pixels/offsets. | New pixel checker/tests, package script, candidate README and this evidence; depends only on existing public PNGs and Python/Pillow. No renderer/asset-byte edits. | Seven page/eight source hashes and exact RGBA recomposition pass; seven pixel-check tests, including corruption injections, pass. Independent review accepted the slice. Terrain owner owns merge and tool acceptance; game deployment is not required for this source tool. |
| 3 — default bound; delivery/game acceptance open | Verify [generic oak depletion adoption](qa-oak-depletion-atlas-adoption.md) for ordinary worked/low/depleted. Preserve full Meshy/directional, legacy full, regional wood and individual failure fallback. | New production pack six mips/manifest, resource runtime helper/selector/sampling, narrow release admission and approved-runtime guard. Terrain integration owns the receiving path and acceptance. Original source/lossless reference remains unchanged/unpacked. | Runtime/factory/fallback/hash/alpha and packaged HTTP checks pass. Payload 1,191,760 bytes plus JSON, decoded 27.54 MiB; +373,820 bytes / +3.55 MiB versus old states. Identify deployed source/release and observe stock transitions/root/zoom/fog/depth before closing. |
| 4 — independently available resource work | Prepare berries full-cutout exports only if the oak receiving path establishes a useful default outcome; otherwise retain the existing individual art. Semantic layers are a separate reviewed depth outcome. | Existing public berries source/canvas/current 2.55 × 1.56 registration; terrain integration owns technical art. No parent export approval dependency or new art generation. | Same source/pixel/registration acceptance as oak, with preserved default full/directional/regional selection and explicit cost. |
| 5 — low-ridge role accepted; technical validation owned | Validate straight joins/end handling, depth and blocked-route readability against actual elevation under [exact placement constraints](../assets/environment/frontier-cliff-pilot-v1/README.md#low-ridge-placement-constraints). Keep normal tall cliffs. | Existing public GLB/runtime pilot only; terrain integration owns technical work. No generic stone binding, duplicate navigation/vision, source stretching, new generation or paid work. | Flat support, contained unit-scale footprint and correctly paired oriented color/depth first; then actual-elevation ordinary-game join/end/terrain/foliage/readability proof before default binding. Source slab measurements are not matching-surface proof. |

Return to rank 1 when its queued execution is available; continue independent
rank 3 delivery/acceptance work meanwhile. Rank 5 now has an accepted low-ridge
role; validate its exact technical placement/readability constraints before binding.
Do not create more art or manufacture tooling merely to keep a PR queue moving.

## Maintaining this record

Change the relevant row when binding, release or evidence changes; link the
implementation owner's existing PR/task rather than creating another roadmap.
Run `npm run audit:asset-adoption` for the small
[approved-runtime registry](asset-adoption-registry.json): eight-view Sheep,
Human Worker SE fishing, eight Frontier Complete families, painted ground and generic oak depletion. The guard evaluates
normal URL selectors, checks reachable consuming modules, manifest runtime
hashes/dependencies and an actual disposable release pack. It fails on lost
default bindings or omitted default dependencies; owner-held experimental
exceptions report **incomplete**, with a reason and exit action. All registered
current entries require default binding; none retain an experimental exception.
Once an experiment becomes default, its exception cannot excuse missing release files.

The focused mutation tests run in existing CI. Coverage is only the listed
approved entries, not every resource/HUD/audio pack. Add a chosen approved runtime
family with its concrete selector probe; do not register unused concepts merely
because files exist. This is source/configuration/package evidence, not proof
of HTTP admission, GPU appearance, listening or deployment. The existing
`railway-release-scenario.mjs` checks real served HTTP assets; recorded deployed
in-game evidence is still required. No default renderer changes are made by
this audit, and it reads no credentials or private sources.
