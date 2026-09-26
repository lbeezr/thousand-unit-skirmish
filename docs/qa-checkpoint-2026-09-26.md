# QA evidence checkpoint — 26 September 2026

This snapshot supplements the vertical-slice acceptance record and the 25 September QA checkpoint. Older captures and fingerprints keep their original build and environment scope; this checkpoint does not relabel them as current-build evidence.

## Source and deployment snapshot — 26 September 2026, 16:02 UTC

| Environment | Identity | Verification and limits |
| --- | --- | --- |
| Main | a8bd1e99dd0ceb917186a7a79ac6179c50e1ca88 (merge PR #93) | Includes PRs #85–93: the interactive pack and Docker fix, map and environment roadmaps, balance roadmap, audio-preview caption change, unit/building art format review, agent coordination guidance, and Map Studio zoom/pan. |
| Staging | Deployment 3507c1ba-314a-48e2-b207-c5e99ed959e1, source a8bd1e99dd0ceb917186a7a79ac6179c50e1ca88, image sha256:739a5345d64485c06c561d3c87cb969f8059334cb82f06a2e396bfcac98cfeaa | Railway reported SUCCESS; `/ready` succeeded at 16:01:59Z. Build logs include Docker `COPY` steps for the interactive manifest and WebPs. At 16:02Z, authenticated GETs returned HTTP 200 for the manifest and all ten runtime WebPs; each image SHA-256 matched its manifest entry. This verifies asset delivery, not renderer behavior. No full HTTP, WSS, browser, or match smoke was run. |
| Production | Manual redeploy 014448c3-4a3b-4942-9d96-6d77515d0d61, still SUCCESS | No new production deployment was made. Railway metadata still gives no source SHA or immutable image digest. The 25 September 52-file fingerprint matched application files at 2530714869a342e37cdd0fee17bd33ac757b7a88; it does not establish platform image provenance. |

PR #85 integrated the interactive environment pack, and PR #88 added Docker and `.dockerignore` entries for the manifest and runtime WebPs. Current staging source `a8bd1e9` includes those `COPY` steps and passed `/ready`. QA fetched the manifest and all ten runtime WebPs with staging authentication; every response was HTTP 200 and every image hash matched the manifest. This establishes that the assets are served by the current image. It does not establish renderer-state selection or visual quality; no browser or GPU capture was run. Production remains untouched.

## Live deployment recheck — 26 September 2026, 16:24 UTC

Railway's current metadata reports main at `c931e692f000d9567de4ff459595605190f9d020` (PR #97) and staging deployment `b245b6c4-831f-47cf-a477-496eebcee365` as `SUCCESS` from that exact SHA. The staging service is online with one of one replicas and `/ready` configured as its healthcheck. Since PR #95's merge `9f4568a`, PR #96 added documentation and `scripts/map-balance-audit.mjs`, PRs #98–99 updated documentation, and PR #97 changed `src/pve-opponent.mjs` and its scenario. No browser-client or map files changed; the server-side PvE behavior did. This establishes source alignment from Railway metadata, not a fresh runtime-file fingerprint.

The latest direct asset verification remains the earlier deployment `3507c1ba` at source `a8bd1e9`: its manifest and ten WebPs returned HTTP 200 and the hashes matched. A fresh public GET to both staging and production failed at DNS resolution from this QA environment, so `/ready`, served assets, and WSS were not directly rechecked on the latest deployment. Do not carry the old GET result forward as a runtime check for `b245b6c4`.

The roadmap records PR #97's owner-run seeded Forked Vale trace for signal progression, prerequisite-gated Vale Watch, and retake after ownership loss, plus live WebSocket smoke for both bot seat assignments. QA has not independently reproduced those results on `c931e69`; they remain synthetic owner evidence, not human solo-play or two-player match evidence. One solo-play observation remains for the PvE lane.

Production remains on manual redeploy `014448c3-4a3b-4942-9d96-6d77515d0d61`, still `SUCCESS` and online with one of one replicas. Current Railway metadata has reason `redeploy`, with no source SHA, branch, or immutable image digest. The prior read-only 52-file container manifest for this same deployment matched application files at `2530714869a342e37cdd0fee17bd33ac757b7a88` and lacked `origin-policy.mjs`; this identifies the observed app-file tree but does not prove Railway's image/build provenance. Staging and production are not verified as the same build. No production action was taken.

Infra's latest host sample is `2026-09-26T16:23:43Z`: 1/5/15-minute loads `11.17 / 10.07 / 8.48`. The 1-minute load is still above `2.0`; the required two readings at or below `2.0`, at least 60 seconds apart, and explicit Infra release are absent. No scenario or browser run is active in the QA task, and none was started for this checkpoint.

## Live deployment recheck — 26 September 2026, 16:32 UTC

After fetching `origin/main`, the latest observed main source is `d11680b0d7f4dca8ffb47b659881654e1c45cd5a` (PR #101, `audio: add cue recognition check`). Railway reports staging deployment `5f0efbb8-00c8-423c-8f89-ab6fda22bed0` as `SUCCESS` from that exact SHA. At `16:31:53Z`, direct unauthenticated GETs to both staging and production `/ready` returned HTTP 200 with `{"ok":true}`. The interactive asset manifest returned HTTP 401 from both environments because it requires Basic Authentication; no credentials were used, so current asset hashes were not verified. No WSS, room, browser, or match check was run.

Production remains on deployment `014448c3-4a3b-4942-9d96-6d77515d0d61`, `SUCCESS`, reason `redeploy`, with no source SHA, branch, or immutable image digest. Its `/ready` success proves health only; it does not establish build identity or alignment with staging. The prior 52-file manifest for that deployment still identifies the app-file tree observed at `2530714869a342e37cdd0fee17bd33ac757b7a88`, not Railway image provenance.

PR #101 adds the Audio settings recognition check: six randomized guess-before-reveal trials, two each for move, attack, and match-result cues. The current UI shows a per-category score but keeps responses in page memory, so record each player's answers and misreads before the session ends. The CI scenario is wired to the check; QA has not run it or observed a fresh player's recognition. No result should be described as player comprehension evidence yet.

The latest read-only host sample is `2026-09-26T16:30:05Z`, loads `5.91 / 6.88 / 7.47` (1/5/15 minutes). The 1-minute value is above `2.0`; no qualifying pair or explicit Infra release is recorded. No QA scenario or browser run is active, and none was started for this checkpoint.

## Live deployment recheck — 26 September 2026, 16:37 UTC

The repository's latest fetched `origin/main` is `4a931021e437dd0ac73328d575ef0c05cb2728df` (PR #103, worker-counter recheck). PRs #102–103 after the audio check changed documentation and agent guidance, not application files. Railway staging deployment `77a34f3a-39eb-4140-89fb-aac6dac315ae` is `SUCCESS` from that exact source SHA. Direct `/ready` GETs returned HTTP 200 at `16:37:10Z` for staging and `16:37:08Z` for production. The current staging interactive asset manifest still returns HTTP 401 without Basic Auth; no credentials were used, and no current asset hashes were fetched. No WSS, room, browser, or match check was run.

Production remains on manual redeploy `014448c3-4a3b-4942-9d96-6d77515d0d61`, `SUCCESS`, with reason `redeploy` and no source SHA, branch, or immutable image digest. The earlier 52-file manifest still identifies only the app-file tree observed at `2530714869a342e37cdd0fee17bd33ac757b7a88`, not image provenance. Readiness does not resolve this identity gap.

The latest host sample is `2026-09-26T16:36:28Z`, loads `6.85 / 8.41 / 7.94` (1/5/15 minutes). The 1-minute value remains above `2.0`; there are no two qualifying readings or explicit Infra release. No QA scenario or browser run is active, and none was started.

## Live deployment recheck — 26 September 2026, 16:41 UTC

The latest fetched `origin/main` is `da6544bd2d4935a30d74ab36bc723fb1fd5169c0` (PR #107, a source-only Worker/Barracks art checkpoint). Railway staging deployment `5d1b6094-8c02-49a5-aab1-807cfc2db433` is `SUCCESS` from that exact SHA. Direct `/ready` GETs returned HTTP 200 at `16:40:57Z` for staging and `16:40:54Z` for production. The staging interactive asset manifest returned HTTP 401 at `16:41:11Z` without Basic Auth; no credentials were used, so current asset hashes remain unverified. No WSS, room, browser, or match check was run.

Production remains on manual redeploy `014448c3-4a3b-4942-9d96-6d77515d0d61`, `SUCCESS`, reason `redeploy`, with no source SHA, branch, or immutable image digest. The earlier 52-file manifest still identifies only the app-file tree observed at `2530714869a342e37cdd0fee17bd33ac757b7a88`, not image provenance. Readiness does not resolve this identity gap.

PR #105 makes the audio-recognition report copyable from the UI; copying is a player action and nothing is sent automatically. The six randomized trials still sample move, attack, and victory/result twice each. QA has not collected fresh-player answers or visually checked PR #107's source-only art on staging.

The latest read-only host sample is `2026-09-26T16:44:08Z`, loads `16.03 / 10.31 / 8.65` (1/5/15 minutes). The 1-minute value exceeds `2.0`; no qualifying pair or explicit Infra release is recorded. No QA scenario or browser run is active, and none was started.

## Live deployment recheck — 26 September 2026, 16:47 UTC

The latest fetched `origin/main` is `157e602849a32ab6cbc19da598f35be09afcd51d` (PR #110, producer-status artifact update). The merge changed agent guidance and the roadmap only; no application files changed. Railway staging deployment `c15c431b-38e7-468a-b85a-719c9d7dcfc1` is `SUCCESS` from that exact source SHA. Direct `/ready` GETs returned HTTP 200 at `16:47:39Z` for staging and `16:47:43Z` for production. The staging interactive asset manifest returned HTTP 401 at `16:47:41Z` without Basic Auth; no credentials were used, so current asset hashes remain unverified. No WSS, room, browser, or match check was run.

Production remains on manual redeploy `014448c3-4a3b-4942-9d96-6d77515d0d61`, `SUCCESS`, reason `redeploy`, with no source SHA, branch, or immutable image digest. The earlier 52-file manifest still identifies only the app-file tree observed at `2530714869a342e37cdd0fee17bd33ac757b7a88`, not image provenance. Readiness does not resolve this identity gap.

The latest read-only host sample is `2026-09-26T16:47:19Z`, loads `24.68 / 19.27 / 12.86` (1/5/15 minutes). The 1-minute value remains above `2.0`; there are no two qualifying readings or explicit Infra release. No QA scenario or browser run is active, and none was started.

## Live deployment recheck — 26 September 2026, 16:53 UTC

The latest fetched `origin/main` is `4a0deb5bd89d7ad9e189b0c0dbe07af92ccd6e31` (`Add varied vegetation and a dense 160× forest scene`). Railway staging deployment `62f4718b-3522-4e68-857b-2f4ab5a3e162` is `SUCCESS` from that exact SHA. Direct `/ready` GETs returned HTTP 200 at `16:53:00Z` for staging and production. The current staging interactive asset manifest returned HTTP 401 at `16:52:57Z` without Basic Auth; no credentials were used, so current asset hashes remain unverified. No WSS, room, browser, or match check was run.

Production remains on manual redeploy `014448c3-4a3b-4942-9d96-6d77515d0d61`, `SUCCESS`, reason `redeploy`, with no source SHA, branch, or immutable image digest. The earlier 52-file manifest still identifies only the app-file tree observed at `2530714869a342e37cdd0fee17bd33ac757b7a88`, not image provenance. Readiness does not resolve this identity gap.

PR #109 expands the Audio settings recognition check to ten randomized trials: two each for move, attack, match victory, match defeat, and match draw. The UI reports per-category scores and offers opt-in copyable notes; it sends nothing automatically. QA has not run a fresh-player check. The current main also adds Field Maple, Hazel Thicket, Silver Birch, and a 160 × 160 Woodland Expanse map; QA has not verified the authenticated asset manifest or reviewed these visuals in the runtime.

The latest read-only host sample is `2026-09-26T16:52:34Z`, loads `13.18 / 16.39 / 13.56` (1/5/15 minutes). The 1-minute value exceeds `2.0`; there are no two qualifying readings or explicit Infra release. No QA scenario or browser run is active, and none was started.

## Live deployment recheck — 26 September 2026, 16:57 UTC

Railway still reports staging deployment `62f4718b-3522-4e68-857b-2f4ab5a3e162` as `SUCCESS` from source `4a0deb5bd89d7ad9e189b0c0dbe07af92ccd6e31`, the same deployed source recorded at 16:53. The current GitHub main tip could not be confirmed. Production remains on manual redeploy `014448c3-4a3b-4942-9d96-6d77515d0d61`, `SUCCESS`, with reason `redeploy` and no source SHA, branch, or immutable image digest.

The read-only production service config identifies `lbliii/thousand-unit-skirmish`, Railpack/V3, `/ready` health checking, one `us-west2` replica, and a persistent volume mounted at `/app/data`. Deployment logs say the default Stone Pass match was restored from checkpoint 5366 at tick 160891. This is evidence of runtime state restoration, not deployment identity or acceptance. No production action was taken.

GitHub fetch and `gh pr view 100` could not reach `api.github.com` at 16:57 UTC, so the live `origin/main` and PR #100 state could not be refreshed. Do not infer that the PR remains open or draft from this snapshot. Railway's staging metadata still confirms the exact source SHA above.

The latest read-only host sample is `2026-09-26T16:57:15Z`, loads `12.35 / 14.34 / 13.43` (1/5/15 minutes). The 1-minute value remains above `2.0`; there are no two qualifying readings or explicit Infra release. No QA scenario, browser run, WSS connection, or match was started.

## CI runner availability

The GitHub Verify Node 24 project check failed before runner assignment on merged PRs #76, #77, #78, #79, #81, #82, #83, and #84. For each job, the Actions job API reported runner_id 0, an empty runner name, and no steps; each completed in about two seconds. These runs provide no assertion or test result. CI status for PRs #85–93 was not verified for this checkpoint. See [PR #76](https://github.com/lbliii/thousand-unit-skirmish/pull/76), [PR #77](https://github.com/lbliii/thousand-unit-skirmish/pull/77), [PR #78](https://github.com/lbliii/thousand-unit-skirmish/pull/78), [PR #79](https://github.com/lbliii/thousand-unit-skirmish/pull/79), [PR #81](https://github.com/lbliii/thousand-unit-skirmish/pull/81), and [PR #82](https://github.com/lbliii/thousand-unit-skirmish/pull/82), [PR #83](https://github.com/lbliii/thousand-unit-skirmish/pull/83), [PR #84](https://github.com/lbliii/thousand-unit-skirmish/pull/84), [PR #85](https://github.com/lbliii/thousand-unit-skirmish/pull/85), [PR #86](https://github.com/lbliii/thousand-unit-skirmish/pull/86), [PR #87](https://github.com/lbliii/thousand-unit-skirmish/pull/87), [PR #88](https://github.com/lbliii/thousand-unit-skirmish/pull/88), [PR #89](https://github.com/lbliii/thousand-unit-skirmish/pull/89), [PR #90](https://github.com/lbliii/thousand-unit-skirmish/pull/90), [PR #91](https://github.com/lbliii/thousand-unit-skirmish/pull/91), [PR #92](https://github.com/lbliii/thousand-unit-skirmish/pull/92), and [PR #93](https://github.com/lbliii/thousand-unit-skirmish/pull/93).

PR #79 moved critical caption decisions ahead of the audio enabled, volume, and effects-level early return. PR #83 records the focused pre-unlock, muted, and zero-output regression as passed on PR #79, and this code is included in current staging. That is focused regression evidence, not an independent QA browser check or player cue-recognition observation on the current staging build. The GitHub CI job did not reach a runner.

PR #90 now shows mapped captions for critical sample previews when captions are enabled; attack and move sample cues remain audio-only. This behavior is in current main/staging, but QA has not observed player cue recognition on the current build.

PR #101 adds a six-trial, guess-before-reveal recognition check for move, attack, and match-result cues, with two trials per category and a per-category score. Responses are page-memory only; QA has not run the check or collected fresh-player observations on staging.

PR #95's Verify Node 24 job failed before runner assignment: the job API reported runner ID 0, no runner name, and no steps, so no assertions ran. PR #96's CI result was not verified.

An earlier source trace on `085948e` found that every `scenarioEvent`, including the non-capture Relief Caravan timed supply, used the objective-capture cue. Current main contains the correction from `a6e5063` (`audio: distinguish scenario reward cue`): `src/main.js` routes the event through `cueForScenarioEvent`, which selects `scenario-reward` only for an affected seat, and `scripts/audio-policy-scenario.mjs` asserts team-specific routing. That script is wired into CI, but QA has not independently run it or verified the audible/caption behavior in a browser. The source-level misroute is no longer an open current-main bug; current-build browser and player-recognition evidence remain open.

## Renderer environment-state pilot

The PR #77 renderer-environment-state-pilot-plan completed as a static plan. It declares four Meadow/Cinder resource-state tuples but starts no server or browser, creates no WebGL context, and captures no screenshots; its output sets verifiedDuringPlan to false. This is planning evidence only.

The capture runner's `verifyEnvironmentPack()` requires `assets/environment/frontier-interactive-v1/manifest.json` plus ten hash- and dimension-verified WebP runtime images before either static preflight or GPU capture. PR #85 integrated the pack and PR #88 fixed Docker packaging. On current staging deployment `3507c1ba-314a-48e2-b207-c5e99ed959e1` at source `a8bd1e9`, the authenticated manifest and all ten runtime images returned HTTP 200; all ten image hashes matched the manifest. This proves static delivery, not a renderer capture or visual review.

The current Dockerfile and `.dockerignore` include the interactive manifest and WebPs. The pack provenance records an unresolved yellow-green oak edge contour; hash verification alone is not visual acceptance. After the host gate opens, capture the environment states and review terrain edges in-game at ordinary and strategic zoom.

No environment-state capture is registered in the current game-dev capture list. No GPU or browser capture was started.

## Host and player evidence gates

Infra's latest host sample, at 2026-09-26T16:57:15Z, was 12.35 / 14.34 / 13.43 for the 1/5/15-minute load averages. The 1-minute value is above the <=2.0 threshold. The required two readings at or below 2.0, at least 60 seconds apart, plus explicit Infra release have not been recorded. No performance scenario, browser run, or renderer capture was started for this checkpoint.

No new two-seat WSS/reconnect/rematch run or complete Forked Vale match was conducted on the current staging build. The earlier f1d6482/1d74cae results remain historical evidence. The novice external playtest remains pending; no testers were contacted. Keep synthetic scenario results, browser automation, and player observations as separate evidence classes.

## Living-land experiment evidence

PR #84's living-land experiment is a design proposal, not a first-slice completion requirement or a routine PR gate. No traversable-height, specialty-crop, or regrowth pilot is implemented in the current build. When the pilot is runnable, QA will coordinate the map/snapshot revision with the affected Maps, Gameplay, and Renderer owners and record:

- Both seats' path choices and whether they take, defend, or bypass the special site.
- Site-control time by seat and each seat's harvest and exchange totals.
- Resource state and regrowth after a player leaves, reconnects or restarts, and rematches.
- Whether each player can explain if and why the terrain changed a decision.

Record the exact build and map/snapshot revision with this evidence. Keep the experiment's player evidence separate from the current invite-match acceptance gates.

## Map-scale and density observations

PR #86's guide proposes a selectable 160 × 160 Frontier map, with a possible 224 × 224 variant later. PR #89's roadmap assigns Maps the populated 160 × 160 map with working resource clusters and a lake or stream region, while Renderer and Environment advance water, shoreline, and tree variety in parallel. This is a map and art iteration experiment, not a PR gate or prerequisite for current milestone proof. No large authored-map observation was run for this checkpoint. Once the map is runnable on a recorded build, observe both seats and record:

PR #93's Map Studio zoom/pan navigation is now in main and staging. It improves large-map authoring controls, but QA has not observed or round-tripped a 160 × 160 map.

- Each seat's routes, explored area, and discovered resource pockets.
- Available base and expansion building space, first contact, and whether contact or objectives are delayed by empty travel.
- Whether players describe the map as large and strategically open or simply empty, using their words where possible.

Include the build SHA, map revision, seat actions, and any missed resources or unusable building areas. Keep this iteration evidence separate from acceptance gates.

## Next QA proof

1. **P0 — Verify current staging online behavior.** After Infra provides a safe disposable room/seat and releases the host window, use two isolated browser profiles against successful deployment `62f4718b` / source `4a0deb5`. `/ready` returned HTTP 200 at 16:53:00Z; the current asset manifest returned 401 at 16:52:57Z without credentials, and no WSS or browser match check was run. Verify authenticated assets and hashes, allowlisted WSS, both-seat join/state agreement, room isolation, gather/build/production/orders/objective winner, reload/reconnect/restart, and synchronized rematch. Save both-seat captures, timestamps, room counts, failures, and exact deployment SHA; don't reuse the historical `f1d6482` browser result or PR #97's owner-run bot smoke as current QA match proof.
2. **P0 — Close production identity as a read-only audit.** Obtain the manually promoted deployment's exact source SHA or immutable image digest, compare its full application-file manifest and served asset hashes with the artifact, and record the gap from staging. Keep production manual; this acceptance checkpoint authorizes no deployment or promotion.
3. **P0 — Complete the human match.** Once tester availability and outreach authorization are resolved, run the two novice pairs and seat swaps in Forked Vale. Keep the first two minutes uncoached; record both seats' opening/contest/result/rematch, explanations, two viable responses, and exact player words separately from scripted evidence.
4. **P1 — Reproduce the 2,000-unit tick gate locally.** Wait for two host readings with 1-minute load <=2.0 at least 60 seconds apart, no competing scenario/browser run, and explicit Infra release. Recheck exact main SHA, machine, Node, map, workload, and instrumentation; run checkpointed movement then attack-move serially. Preserve verified run bundles. Pass only when each 12-second window keeps tick-p95 and tick-start-lag-p95 <=33.333 ms, maxima for tick/start-lag/planning <=100 ms, has zero checkpoint failures, and records combat damage. Distinguish these synthetic localhost numbers from hardware capacity.
5. **P1 — Measure hosted capacity separately.** Agree the target Railway machine/CPU budget, CPU/egress stop thresholds, and 80 ms RTT / 1% loss profile with Infra. Use one closed 2,000-total-unit staging room first; record ack p50/p95, tick p50/p95/max, per-seat snapshots/egress, and reconnect time; stop at the first agreed threshold or room cap. Do not infer capacity from the historical 10-second 100-snapshot-per-seat smoke.
6. **P1 — Finish current-build visual/audio acceptance.** After Infra releases a safe browser window, check captions with audio disabled and volume/effects at zero. With fresh players, run the ten-trial guess-before-reveal check once with captions off and once on; use **Copy trial notes** after each round to preserve answers, category scores, caption state, and misreads (copy is opt-in; nothing is sent automatically). Capture Meadow/Cinder and Woodland Expanse at both zooms, inspect Field Maple/Hazel Thicket/Silver Birch, the unresolved oak edge, and team-shape cues, and keep player recognition results separate from visual review.
7. **Iteration evidence, not release gates.** When the living-land or 160 x 160 map is runnable, record exact build/map revisions, both-seat routes, resource use/site control, building space/first contact, and player explanations. The static map audit is layout evidence only; it does not establish playability or human preference.
