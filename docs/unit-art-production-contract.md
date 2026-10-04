# Approved unit art production contract

Owner: Human foot-unit art lane. Animation-state owner `01a103d4` owns clocks and
protocol; building/catalog owner `01a0fcf5` consumes these records for readability
review. This is a source-side pilot, not a second unit registry or runtime format.

## Pilot and shared interface

The [Infantry sidecar](art-direction/human-roster-v1/infantry-production-contract.json)
joins the existing atlas by `assetId` and repository-relative `manifest`. The atlas
continues to own frames, clips, durations, bounds and file admission. The sidecar
adds pinned identity/source bytes, style and provenance versions, publication
scope, required action/heading coverage, retained source timing, calibration and
separate integration/render status. The catalog should read existing manifests
and optional sidecars rather than copy them into another registry. A missing
sidecar means no production-contract audit yet, not approved or complete art.

```sh
node scripts/unit-art-production-contract.mjs
node scripts/unit-art-production-contract.mjs --require-complete
node --test scripts/registered-foot-sprites.test.mjs
```

The first command emits JSON for the current pilot and exits successfully when
the partial state is accurately declared. The strict command intentionally fails
with **21 missing cells**. All 32 required clips exist in v3, but decoded registered
pixels establish only eight idle headings plus SE walk/attack/defeat: **11 authored
cells**. Walk/attack/defeat for N/NE/E/S/SW/W/NW still hold idle. Counts establish
source motion availability, not correctness of gait, facing anatomy or acceptance.
Archer v2 and Spearman v1 retain 21 missing cells each: **63 total**, unchanged.

The JSON report includes identity/style, provenance, publication and integration
status alongside decoded coverage, timing errors, normal binding and pending
render acceptance. Catalog code can import `validateUnitArtProduction` for this
pilot. The decoder currently admits one actor page; extend that explicitly for a
different layout. This offline check is not part of rendering or room simulation.

## Identity and permissions

Mutable game descriptions are independent of approved art inputs. Description or
prompt edits do not invalidate approved artwork or trigger generation. The pilot
pins all four source PNGs, runtime atlas/mask bytes and two registered idle anchors.
Changing these requires an explicit retained art revision and review; never update
the pinned hashes automatically during a rebuild. Keep old source iterations.

`identity.status` records the established default restored in PR286, not full
motion approval. `identity.style` and `provenance.version` identify the retained
family/source history separately from editable text. Provider visibility and
training permission are separate fields; historical settings are unknown here.
Private provider visibility alone is not evidence of no-training permission.
`publication.state` is `existing-public-runtime-only` and new uploads are disabled.
This records existing repository/runtime reuse; it grants no authority to upload
private material or generate paid assets. See the existing
[source adoption rules](sprite-strip-adoption-contract.md).

## Failure checks and timing

The canonical validator already checks schema, file hashes, geometry and sampling.
The production check compares visible RGBA and alpha on a fixed registered canvas;
transparent RGB, crop relocation and renamed keys cannot manufacture motion.
Idle fallbacks, frozen actions and identical pixels relabelled as multiple headings
remain missing. Pinned world-per-pixel, canvas, root and crop offsets catch automatic
pose fitting. Camera and pivot review cannot be claimed beyond retained evidence.

Explicit 2D source keys use `timed-keys`: retained frame milliseconds and total
duration are checked directly. Infantry walk is eight 100 ms keys, 800 ms total;
attack/defeat are 850 ms with variable cadence. No intrinsic rig FPS is known.
For future `sampled-frames`, source FPS, playback FPS, frame count and duration
must agree. A regression control deliberately rejects 24 FPS samples played at
30 FPS. Repeated source keys do not become new authored poses.

These checks apply the workflow, timing, actual-screen-size and isolated-workspace
lessons described by the author of
[Day 13: stopped making models and started making systems](https://www.reddit.com/r/aigamedev/comments/1wx403s/day_13_of_building_an_rpg_with_claude_i_stopped/).
The parent also supplied the DragonScape description-edit/prompt-hash rebuild
failure as motivation for immutable approved bytes; that report has not been
independently verified here. The posts' memory/FPS savings are not measurements of
this project. This pilot adds no engine, CMS, dependency or performance claim.

## Integration and ordinary-game review

Source coverage, default binding, packaging, deployed identity and rendered
acceptance are separate. The pilot is bound to ordinary Infantry v3 and uses its
existing admitted runtime files. Render acceptance remains `pending`; there is no
new deployed/native appearance claim. See [foot-unit acceptance](human-foot-unit-coverage.md#ordinary-game-acceptance)
and the existing [temporal evidence contract](qa-unit-displacement-animation-2026-10-04.md).

Review both paid teams through normal room/map entry, at normal zoom and in a
representative crowded scene. Inspect identity/equipment, team recognition,
planted roots, walking support-foot contact, start/Stop/resume/turns, fresh attacks,
terminal defeat, selection/fog and strategic LOD. Retain frame/root overlays and
quarter-speed playback as diagnostic aids; judge readability at actual game size.

An accepted record needs both `normal-zoom` and `crowded-scene` evidence entries,
each with a repository-relative hashed artifact, `normalEntry`, `webgl2`, actual
`backend`, matching 40-character `sourceRevision`/`servedRevision`, and the bound
`runtimeVersion`. The validator checks receipt shape/hash, not GPU execution or
artistic quality. The owner must establish those through actual identified game
captures, including the clean release/deployment receipt. CPU passing cannot
approve a missing capture. Crowded appearance review is not a benchmark claim.

## Next slices and workspace ownership

1. Retain the Infantry sidecar as the catalog pilot; add other role sidecars only
   after inspecting their actual sources and contracts.
2. Obtain a matching Infantry NE strip or editable exact-character model/camera
   recipe for four contact/passing keys, 200 ms each. That input is still missing;
   no available mismatched character or duplicated SE facing closes the cell.
3. Use one isolated worktree/output directory per art slice, preserve prior
   iterations, and name the owner who integrates the reviewed pack. Catalog work
   consumes the above interface; state/protocol work retains its existing owner.
4. Review one heading in normal gameplay, then extend genuine headings. Report
   source cells, default/release state and remaining rendered evidence separately.

No Library transfer is retried by this contract. The private motion study remains
private; its earlier hosted upload failure and missing source input remain open.
