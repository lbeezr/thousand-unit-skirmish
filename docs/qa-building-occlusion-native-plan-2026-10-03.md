# Building body occlusion: native cost and appearance plan

[Documentation index](README.md) · [Renderer contract](renderer-state-contract.md) ·
[Original body-depth evidence](qa-building-sprite-occlusion-2026-10-03.md)

This fixture prepares the native WebGL comparison requested after PR #107.
It does not change the shipping renderer or any artwork. **No native fixture
frames, measured draw counts, or GPU timings have been collected in this cloud
workspace.** Further visual effects remain on hold until native evidence is
reviewed. There is no cost verdict or proposed renderer rewrite yet.

## What is bounded, and what is verified now?

The server admits at most 128 buildings. The renderer does not truncate its
building loop at 128: every loaded direct-sprite building owns a body-depth pass.
The focused CPU tests exercise 129 attached buildings, including the last pass
and its non-picking contract. They execute the actual server admission function:
at 127 it reaches Worker validation, while at 128 and 129 it rejects a new
building before that validation. An existing building ID still dispatches to
construction resumption at the cap; this test does not claim construction has
completed. A future server cap increase fails the existing cost-bound test and
needs a new budget review, rather than silently dropping later building depth.

The structural extra cost is one draw per visible loaded direct-sprite building,
up to 128 in an ordinarily admitted match. That is an architectural bound,
**not a measured GPU result**. There is an extra sprite/material and shader
variant, but no extra building texture or geometry buffer. The existing blended
color pass, ground-depth correction, alpha edges and painted shadows remain
unchanged. The depth pass uses alpha test 0.9; the color pass uses 0.08.

Run the CPU checks from the repository root:

```sh
node --test scripts/building-sprites.test.mjs scripts/building-occlusion-fixture.test.mjs
```

The 17 checks cover lifecycle/depth contracts, actual admission, 129 renderer
items, scene planning, quantiles, query cleanup/disjoint handling, conservative
GPU attribution, failed-start recovery, all served hashes/MIME types and
byte-preserving evidence extraction. They do not execute WebGL or decode the
extractor test's deliberately minimal PNG header as a rendered image.

## Native comparison

The fixture uses the shipped Barracks/Range helper, Human v3 and Boughward Worker
sprite runtimes, and the existing elevation helper. It covers all 20 current
building state/team images. The default game view direction, 43-unit base
frustum, fixed 1280 × 720 render size, zooms 0.91/0.48, facing angle 0 and sprite
time 1000 ms are recorded. Baseline and candidate use the same scene and assets;
only body-depth visibility changes.

| Case | Native evidence produced by a completed run |
| --- | --- |
| 32 buildings + 512 Workers, each zoom | Actual total draw calls, body submissions, triangles, resource/program counts; paired PNGs; four timing blocks |
| 128 buildings + 512 Workers, each zoom | Same measurements; strategic view must submit all 128 body passes |
| Renderer-only 129 buildings | Actual body submissions must equal 129; this bypasses server admission only in the QA scene |
| Opaque roof behind/front, transparent margin, low-alpha edge | 24 paired GPU pixel probes at heights 0/2.4 and three camera directions |
| Four buildings and eight Workers on flat/raised ground (0/1.6 world units, valid levels 0/2) | Four paired PNG views: normal, strategic, opposite azimuth, steeper |
| Body and transparent-margin picking | Eight real Three raycasts per view must hit existing color sprites, with identical hit lists in both modes |
| Hidden/revealed building group | Both color and depth submissions disappear together and return together |

The narrow low-alpha probe is sampled from the actual source fringe. It does
not prove the appearance of every painted shadow. Review the paired detail
images for soft edges, shadows and ground contact. The rectangular color-sprite
picking behavior is deliberately preserved; this is not an alpha-aware selection
change or an authoritative gameplay-selection test. Group hiding exercises the
fog visibility contract without rendering a fog overlay.

The Mac run exposed an invalid level-3 detail patch after the timing blocks.
The detail scene now uses the actual maximum level 2 (1.6 world units); a CPU
regression executes its source definition through the real terrain/elevation
boundary and samples every building anchor. Independent pixel probes still use
0/2.4 world-unit transforms as a shader stress test, without authoring an invalid
map patch. Preserve the earlier incomplete receipt; its completed timing blocks
do not establish the later picking/fog/detail checks.

The stress scene uses a simple untextured terrain mesh. It omits simulation,
HUD, resources, production cues, production LOD and the rest of a match. Both
Worker families and both teams use the existing instanced materials, including
their current transparent/double-sided draw behavior. Frame intervals and CPU
submission times describe this fixture, not end-to-end game latency.

Each configuration warms 120 frames in each mode, then samples 120 frames per
block in baseline/candidate/candidate/baseline order. Draw counters must remain
stable; the added calls must equal actual body submissions. Texture/geometry
counts and warmed program counts must match between modes. Resource counts
include the already warmed candidate variant in both modes.

GPU elapsed-time queries are optional. The sampler checks query counter support,
reads results asynchronously, discards disjoint results and deletes query
objects according to the [Khronos extension contract](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/).
Each block records count, median/p95 and dropped/invalidated queries. A hardware
GPU delta is calculated only with a recognized unmasked hardware identity and
four complete, non-disjoint blocks. Missing queries, masked/unknown identities,
software renderers or incomplete blocks leave that delta `null`, not zero.
CPU submission timing and animation-frame intervals remain separate fields.

## Exact Mac recipe

Use Node 24 or newer and normal foreground Google Chrome on the Mac GPU. Keep
other GPU-heavy work quiet for the comparison and record the machine, Chrome
version, power mode and any known contention with the evidence. The fixed
render size does not depend on the displayed page width. Do not change browser
zoom during a run. Keep DevTools closed during timings.

In Terminal 1, create a clean isolated checkout of the reviewed integration
revision. For a repeat comparison, set `qa_revision` to its full recorded commit
SHA instead of resolving a moving `main`:

```sh
git fetch origin main
qa_revision="$(git rev-parse origin/main)"
qa_root="$(mktemp -d /tmp/tus-occlusion-qa.XXXXXX)"
git worktree add --detach "$qa_root/repo" "$qa_revision"
cd "$qa_root/repo"
npm ci
node --test scripts/building-sprites.test.mjs scripts/building-occlusion-fixture.test.mjs
node scripts/serve-building-occlusion-review.mjs 8768
```

Leave this server running. It binds only to `127.0.0.1`, accepts GET/HEAD and
serves an explicit allowlist. It snapshots all 39 source/vendor/asset files at
startup and records their SHA-256 values, installed Three version, server cap,
revision and dirty status. A dirty checkout blocks sampling. The immutable
served bytes prevent edits during a run from mixing source versions; installed
vendor bytes are hashed even though `node_modules` is ignored.

In Terminal 2, open a separate ordinary Chrome profile:

```sh
qa_profile="$(mktemp -d /tmp/tus-occlusion-chrome.XXXXXX)"
open -n -a "Google Chrome" --args --user-data-dir="$qa_profile" \
  --no-first-run --no-default-browser-check "http://127.0.0.1:8768/"
```

1. Leave **Current game cap (up to 1.75)** selected. Press **Run paired checks
   and samples** and keep the tab visible for about one minute. A hidden tab,
   context loss or load failure makes the run incomplete.
2. Press **Save evidence JSON with paired PNGs**. Confirm that the actual file
   exists in Downloads before another run. Requesting a download alone does
   not verify preservation. Save incomplete/failed iterations too.
3. From the isolated checkout in a third terminal, extract the selected file
   into a new directory. Substitute the actual filename; the output directory
   must not already exist:

   ```sh
   node scripts/extract-building-occlusion-evidence.mjs \
     "$HOME/Downloads/building-occlusion-ACTUAL-FILENAME.json" \
     /tmp/tus-occlusion-evidence-FIRST-UNIQUE-RUN
   ```

4. Inspect `receipt.json`, `manifest.json` and the decoded PNGs. A complete run
   preserves 16 original paired PNGs and the exact receipt bytes. The extractor
   checks signatures/header dimensions and records hashes; it does not certify
   decoded pixels, hardware identity or artistic acceptance. Repeat at
   **Controlled DPR 1** if comparing pixel-density cost, preserving each run in
   its own directory. Keep same-DPR comparisons separate from cross-DPR ones.
5. Repeat a same-DPR run if contention or variance warrants it. Retain all
   iterations and explain any exclusions; do not select only the fastest block.

First review `status`, `errors`, source hashes, `identity`, physical pixel size,
`hardwareGpuTimingComplete`, all pixel/counter checks, picking and fog results.
`checks-passed-human-review-pending` is an automated result, not visual approval.
Compare each `measuredAdditionalDraws` value with its recorded body submissions.
Report paired block medians/p95 and `hardwareGpuMedianDeltaMs` without relabeling
CPU time or RAF intervals as GPU time.

Then open each detail pair side by side. Check Workers behind roofs disappear
only behind opaque structure, foreground Workers remain visible, foundation
holes and transparent margins remain open, and soft alpha edges/shadows retain
their existing appearance. Check raised anchors for sinking or floating. The
two changed camera directions retain the original single-view art: they stress
depth correction and do not constitute newly authored perspectives. Inspect
the crowded pairs for missing late buildings and obvious overlap errors.

If complete identified-hardware timings show unacceptable cost, use these
measurements to choose between a shared batched depth pass or another bounded
depth prepass. Neither strategy is implemented or recommended before that
measurement. A later full-game run is still needed for match-level impact.

## Preservation and remaining evidence gap

No artwork is generated by this change. Native screenshots will be outputs of
the Mac run; none currently exist here. The extractor preserves original
receipt/PNG bytes locally and refuses to overwrite an existing iteration.
After decoded-pixel review, add the selected, bounded evidence and its provenance
to a new QA evidence directory, then link it from this guide and the existing
[art evolution wiki](lore/art-evolution.md). Preserve rejected iterations and
their reasons rather than replacing them with a final-only image. No large
binary set or private local file is automatically committed or uploaded.

The cloud environment cannot see Mac-only uncommitted files or Downloads.
Its previous supported browser preflight reported `sandbox-unavailable` and
`storage-unavailable`, and the `game-dev` CLI is absent. No native WebGL claim
follows from CPU tests or an offscreen art study. The missing deliverable is a
saved receipt from the clean reviewed revision, its actual decoded paired PNGs,
hardware/cost result (or explicit query unavailability) and a human appearance
observation. Until those exist, measured additional draws, GPU cost and native
occlusion acceptance remain pending.
