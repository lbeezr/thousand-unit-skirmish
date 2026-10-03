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
| `buildings/frontier-civilization-concepts-v1` | Eight selected concepts; new Barracks/Range have no matching model/view manifest in the two packs. | Reference only; not packed. | **Incomplete production** → building owner: derive new-design models/views before binding; existing Barracks/Range designs stay usable. |
| `buildings/town-center-lifecycle-meshy-v1` | Older [captured loader](../src/captured-building-art.mjs): five states × eight views, team masks; now supplies missing-state/loading fallback beneath the new Complete Town Center. | 81 files packed. | **Current combined appearance unverified here** → renderer owner: recorded-build construction/damage/repair, team/zoom/occlusion check. |
| `buildings/barracks-sprite-test-v1`, `buildings/archery-range-sprite-v1` | Default [direct sprites](../src/building-sprites.mjs): five states × two teams. | Ten WebPs each packed. | **Full current-build appearance unverified** → renderer owner: both-team lifecycle/occlusion proof; [prior checks](qa-barracks-lifecycle-2026-09-27.md) are dated evidence. |
| `buildings/archery-range-construction-v1` | Exported five-stage atlas with masks; pivot/game placement unverified; normal game uses the other Range pack. | Candidate/review only; omitted. | **Incomplete admission**, not a drop-in final replacement → building + renderer owners: resolve five-stage mapping/pivot and choose explicit adoption or retained comparison. |
| `units-buildings/frontier-glb-sample-v2`, `frontier-barracks-construction-v1`, `frontier-archery-range-construction-v1` | GLB/source-review samples. Authoring manifests do not match runtime renderer schema; no gameplay GLB consumer. | Static reviews; omitted. | **Incomplete runtime production** → technical art owner: compatible export/capture and state mapping if these designs are chosen; no need to ship unused GLBs. |
| `buildings/town-center-sprite-v1`, `town-center-meshy-review-v1`, `town-center-state-concepts-v1` | Legacy direct Complete, earlier captured Complete and lifecycle source concepts. Default lifecycle pack supersedes them. | Direct/concepts omitted; eight earlier captured WebPs still packed. | Retained lineage, **not new adoption targets** → building owner preserves provenance; renderer owner can audit redundant release copies separately. |
| Skiff, palisade wall/gate | Current normal gameplay uses procedural placeholders in [water units](../src/water-unit-runtime.mjs) and [main](../src/main.js); no authored public runtime binding is verified. | Placeholder code ships; export readiness/private source work does not prove public admission. | **Incomplete export/adoption** → accepted Coastal technical art owner: finish Skiff runtime export/adoption readiness, then walls, against existing mechanics. Private publication, if required, may need exact approval; publication is unverified. Close with default binding, release, deployed-build and in-game proof. |
| Mill, Dock, shore-fish glyph | Normal gameplay uses procedural placeholders in [main](../src/main.js) and [fish marker](../src/shore-fishing-placeholder.mjs). No independent authored runtime pack found. | Placeholder code ships; no art gate. | **Incomplete production** → art recipient **unassigned** for these families. Gameplay owners retain functioning rules. |
| `wildlife/bellweather-sheep-static-v1` | Eight approved static idle views in the default [wildlife registry](../src/neutral-wildlife-renderer.mjs), including normal Millrace opening Sheep. Carcass remains marker; empty/fog-hidden nodes disappear. | Three runtime files packed, no opt-in. Historical `previewOnly` metadata is not a current runtime gate. | **Staging source delivered; appearance incomplete** → Sheep owner runs [normal/all-view game recipe](qa-sheep-eight-view-default-2026-10-03.md); Railway owner retains production delivery. Walk/graze/carcass animation absent. |
| `wildlife/bellweather-sheep-public-reference-v1`; [Sheep concept/model-input records](wildlife-bellweather-sheep.md) | Earlier single-view/reference lineage; superseded by eight-view pack. [Local walk candidate](sheep-local-walk-candidate.md) is capability/inspection planning, not a walking clip. | Old pack omitted; private GLB not published. | **Walking production incomplete** → Sheep owner: supported private transfer, hash-verified rig feasibility, one actual articulated heading. Preserve idle art. |
| `units/cast-human-sprite-v3` + [fishing SE source](art-direction/human-roster-v1/fishing-SE-v1/README.md) | Default Human Worker v0.14.0 has four SE fishing keys + water-contact cue. Seven headings/Boughward keep exact food/gather/idle fallback; ordinary central Lab approaches are east/west. | Three unit runtime files packed, no fishing flag. | **Native SE contact/root/readability verified** in [PR142](https://github.com/lbeezr/thousand-unit-skirmish/pull/142); **deployed acceptance/motion coverage incomplete** → Worker art/renderer owner: smooth the four stepped keys and admit seven remaining headings; Railway owner verifies the delivered user build and retains production delivery. [Contract](worker-fishing-animation.md). |
| `ui/cursors`, `ui/icons` original six SVGs, `ui/portraits` | Native PNG cursors, six labelled icons, Human/Boughward Worker portrait; Barracks portrait reuses its actual battlefield frames. [HUD bindings](hud-art-integration.md). | UI directory packed, admitted active files served. Old SVG cursor sources are history. | **Native usability/recognition incomplete** → HUD integration owner: game pointer/zoom/layout review; other roster/building portraits need deliberate matching framing. |
| `ui/icons/actions` six new glyphs ([PR130](https://github.com/lbeezr/thousand-unit-skirmish/pull/130)) | Source candidates; no controls bound and server rejects these paths. | Directory copy packs sources **despite no serving/default use**; absent from the observed staging source revision. | **Incomplete source refinement/admission** → HUD integration owner accepts six-icon integration + clip fix: improve weak 16px Follow/cargo details, bind appropriate labelled controls, fix clipping and add serving/default-use proof. This merge alone does not deliver new HUD art. |

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
| [`environment/frontier-painted-material-atlas-v1`](../assets/environment/frontier-painted-material-atlas-v1/README.md) | `manifest.json` + `frontier-painted-material-atlas-mip-0.webp` … `-5.webp` are hashed runtime exports; omitted/unbound. Normal [ground consumer](../src/environment-art.mjs) still uses individual textures; [mirrored UV helpers](../src/painted-material-atlas.mjs) exist but are not consumed. | **Exported but unbound candidate** → technical art + environment renderer owners: load six authored mips with cap 5, connect split-quad UVs/half-pixel inset to `groundTexture()` / `createGroundSurfaces()`, preserve 12-unit world alignment, feather alpha, current stochastic sampling and regional/variant selection, then compare normal/strategic zoom. The eight original paints do not cover every current regional/variant texture. |
| [`environment/frontier-resource-atlas-v1-candidate`](../assets/environment/frontier-resource-atlas-v1-candidate/README.md) | Source-only `manifest.json`, `build-report.json` and seven `pages/*.png`: oak fallback/foliage-back/wood-structure; berries fallback/foliage-back/wood-structure/fruit-front. No runtime encodes/hashes; omitted. Intended recipient is oak/berry state loading and instance presentation in [environment art](../src/environment-art.mjs). | **Incomplete production** → technical art owner: review estimated bottom-center pivots, canvas offsets and semantic layer/depth order; HSV color mattes are only an occlusion proposal. Export/hash runtime pages with declared no-mip/half-pixel sampling before an environment renderer owner integrates four-state selection/fallback. Preserve current stock/occupancy and existing directional/default art until the replacement contract is accepted. |
| `environment/sereward-succulent-action-v1` | Four exported poses; review-only, no harvesting gameplay binding; omitted. Current decorative succulents remain separate. | **Incomplete registration/gameplay admission** → vegetation owner + gameplay recipient **unassigned**: resolve anatomical anchors and whether a distinct harvest action is wanted; do not map leaf cutting to forest wood depletion. |
| `environment/vaelora-ground-studies-v1`, `frontier-v2-concepts` | Ground accent/design sources unbound/omitted. | **Experimental production/adoption incomplete** → environment/technical art owners: review motif scale/repetition, then select a normal-game integration; concepts need not ship automatically. |
| [`environment/frontier-cliff-pilot-v1`](../assets/environment/frontier-cliff-pilot-v1/README.md) | `manifest.json` + `runtime/cliff-color-00.webp` … `-07.webp` and `cliff-depth-00.png` … `-07.png`; sixteen runtime images packed/served only through [review pilot](../src/environment-pilot.mjs) and `/environment-review.html`. Normal [obstacle consumer](../src/environment-art.mjs) `addObstacleEnvironmentSprites()` still selects existing cliff/cap art. | **Review-only production/adoption incomplete** → environment/technical art owners: resolve the 4 × 0.998 × 1.306 low-ridge fit, uneven joins and missing corners/caps/variants; establish normal terrain registration, depth/foliage occlusion and device cost before binding. Review estimates ~29 MiB decoded textures; source GLB is offline authoring material. Reuse the existing pilot depth contract rather than rebuilding building rendering. |
| Stone resource/economy (`stone-defense-v1`) | [PR124](https://github.com/lbeezr/thousand-unit-skirmish/pull/124) runtime support is in observed staging `19cae81`; its merge `d5aa464371e21d53f7854e11288e16a5f077d708` is an ancestor. Plain gray node markers are procedural, with no authored ore asset. Current shipped maps declare no Stone profile, so ordinary map selection cannot exercise it. | **Ordinary entry/deployed gameplay adoption incomplete** → [PR140](https://github.com/lbeezr/thousand-unit-skirmish/pull/140) recovery owner finishes corrected checks/review/merge for **Lab · STONE DEFENSE FIELD** (observed draft head `fe3f3a910835cbeef343f770bdf147adbb67ddff`); Railway owner then delivers that map revision and native QA verifies normal lobby → gather/carry/deposit → paid completed Watchtower. Prior executor transport failure is being recovered by the new owner. Authored ore art recipient remains **unassigned**; runtime deployment alone does not close adoption. |
| `audio/runtime` | Eleven regional v2 landscape profiles + technical `rts-feedback-test/v1`; [hash-bound shipped catalog](../src/audio-shipped-catalog.mjs), map selection and input unlock consume them. All runtime files packed. Twelve regional maps + Fortified Crossing bind recorded packs; other maps synthesize. | **Listening/mix acceptance incomplete** → Audio owner (resumed): existing public Shore Fishing profile assignment/listening followthrough and exact-build cue/mute/loop audition. No authored Shore Fishing assignment; [audition](qa-shore-audio-audition-2026-10-03.md) remains provisional. |
| `audio/vaelora-zones-v1`, `audio/vaelora-pilot-v1` | Zone catalog: 44 originals; regional runtime uses 11 music + 11 terrain beds. Eleven contrast beds + eleven signatures are audition-only. Pilot sources include four shipped UI ingredients; its music originals are candidates. Source directories are packed, which does not establish map/event bindings. | **Selected audio adoption incomplete** → Audio owner (resumed): audition existing public Shore Fishing water bed or signature against the current cue; select/bind only the accepted material. [Coverage audit](qa-audio-coverage-2026-10-03.md) owns event/score limits. No new recordings required. |

Remaining unit packages are covered by the [normal roster mapping](assets.md#know-what-is-actually-in-game):
Human seven-role v3/v2/v1 set and all seven `boughward-*-sprite-v1` packs ship
and bind by team. `worker-sprite-v1/v2/v3`, `infantry-sprite-v1/v2`,
`archer-sprite-v1`, `cast-human-sprite-v1/v2`, and `cast-orc/elf/troll-sprite-v1`
ship as explicit legacy comparisons, not defaults. `infantry-meshy-reference-v1`
is an omitted source reference. **Authored action/direction/team-mask finish and
fresh deployed roster appearance remain incomplete** → unit art/renderer owners;
do not count approximate action reuse or idle holds as completed motion.

## Maintaining this record

Change the relevant row when binding, release or evidence changes; link the
implementation owner's existing PR/task rather than creating another roadmap.
Run `npm run audit:asset-adoption` for the small
[approved-runtime registry](asset-adoption-registry.json): eight-view Sheep,
Human Worker SE fishing, and six Frontier Complete families. The guard evaluates
normal URL selectors, checks reachable consuming modules, manifest runtime
hashes/dependencies and an actual disposable release pack. It fails on lost
default bindings or omitted default dependencies; owner-held experimental
exceptions report **incomplete**, with a reason and exit action. All eight
current entries require default binding; none retain an experimental exception.
Once an experiment becomes default, its exception cannot excuse missing release files.

The focused mutation tests run in existing CI. Initial coverage is only these
eight entries, not every resource/HUD/audio pack. Add a chosen approved runtime
family with its concrete selector probe; do not register unused concepts merely
because files exist. This is source/configuration/package evidence, not proof
of HTTP admission, GPU appearance, listening or deployment. The existing
`railway-release-scenario.mjs` checks real served HTTP assets; recorded deployed
in-game evidence is still required. No default renderer changes are made by
this audit, and it reads no credentials or private sources.
