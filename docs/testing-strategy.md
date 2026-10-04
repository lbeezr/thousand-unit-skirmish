# Testing strategy and execution contract

[Command guide](testing.md) · [QA acceptance](qa-vertical-slice.md) ·
[Working rules](../AGENTS.md) · [Deployment](deployment.md)

Use deterministic automation to reproduce defects and check contracts before
spending time on manual clicks. The implementation owner carries a gameplay
change through the normal entry path, packaging, identified deployment and actual
in-game verification. A CPU fixture, asset audit, screenshot of a preview, or
merged PR proves only its named scope. This strategy documents existing checks
and the next implementation slices; it does not install infrastructure or claim
AAA certification. Product acceptance is separate from current merge authority
and actual repository protections.

## Start here

For any change, inspect the exact registered checks without running the suite:

```sh
node scripts/ci.mjs --list
```

For browser/render work, the first executable capability check is:

```sh
node scripts/renderer-capability.mjs --launch
```

Run it once in the intended cloud environment. Record its JSON and exit status:
`ready` (exit 0) requires a WebGL2 context and two distinct exact pixel readbacks
in `about:blank`, source/backend metadata and cleanup; `blocked` (exit 1) retains
the capability failure. It makes one normal-sandbox launch attempt. This probe
records zero game frames and screenshots; readiness is not game-render acceptance.
`--diagnose=STARTUP_LOG` classifies an existing startup log without another launch.
The older `browser-preflight.mjs` remains a startup diagnostic. Do not repeat the
same failed startup or download unchanged. Continue independent CPU/native work
while the cloud testing owner resolves the recorded capability failure.

**Packed-game and staging pixel acceptance remain pending.** Before accepting
game pixels, prove the isolated browser can load the clean packed game,
compile/draw the production renderer, decode the actual atlas, receive
ordinary game state, advance multiple rendered frames, and save a nonempty PNG
with no relevant console/shader/asset failures. Check local packed-game capability
and staging navigation separately. The project's Three.js r180 renderer requires
[WebGL2](https://threejs.org/docs/pages/WebGLRenderer.html); a WebGL1 context,
browser process, DOM boot flag, Example Domain screenshot or CPU UV buffer is
insufficient.

Current reported cloud blockers, recorded 4 October 2026: Chromium startup fails
with `sandbox-unavailable`; Firefox download returned 403; headed cloud Chrome
rendered Example Domain but staging returned `ERR_BLOCKED_BY_CLIENT`. Mac testing
was stopped by the user and is not a dependency of this plan. These reports do
not establish a supported game renderer. The cloud testing owner must replace
this dated record with linked capability evidence before claiming the gate ready.
Use supported provider configuration; no sandbox/security bypass, new credentials,
hosted-runner purchase or weakened checks is authorized by this document.

## Existing checks and lanes

Inventory verified at `dea845b3` on 4 October 2026: 1,120 registered checks =
939 fast + 181 simulation, preserving all 1,115 preceding-main checks. These
registration counts do not claim a successful execution. The [CI registry](../scripts/ci.mjs)
and [workflow](../.github/workflows/ci.yml) are authoritative for current execution.
`npm test` runs the registered CPU contracts and native scenarios. GitHub uses
Node 24, three shards (`npm test -- --shard=1/3`, `2/3`, `3/3`) and packs the release
on shard 1. Named lanes select existing checks and retain the full default suite.
See [the command guide](testing.md) for parameters,
dependencies and disposable-room setup.

| Lane / existing command | What it establishes | Remaining boundary |
| --- | --- | --- |
| Source: `npm run architecture:check`, `npm run check:types`, `npm run docs:check` | Runtime dependency/cycle policy, explicitly checked types and documentation links | Static checks do not establish gameplay or pixels. |
| Focused CPU: `node --test scripts/unit-sprite-clock.test.mjs scripts/unit-animation-runtime.test.mjs scripts/villager-facing.test.mjs scripts/unit-presentation-client.test.mjs` | Clocks, headings, shipped manifests, interpolation and Three UV/matrix buffers | Presentation uses VM-extracted client code and stub textures, without a browser/GPU. |
| Temporal CPU: `node --test scripts/unit-displacement-animation.test.mjs` | 64 Worker/Spearman × bearing/team/detail cases through committed interpolation, sprite clocks, UV buffers and decoded PNG cells; frozen-clock, wrong-heading and duplicate-cell controls fail as intended | Injected server-position samples, fixture-selected approved packs via preview flags and CPU textures; no snapshot receipt, live commands, browser frames or gait judgment. Seven Spearman headings remain idle-art gaps. |
| Capability contracts: `node --test scripts/renderer-capability.test.mjs` | Injected readback, startup, deadline, cleanup and CLI failure contracts | CPU mocks do not prove an available GPU; execute the opt-in probe above separately. |
| Replay: `node --test scripts/pathing-replay.test.mjs scripts/pve-skirmish-replay.test.mjs` | Fixed-tick source-copy simulation, paid rules and exact scenario recovery | Listening/timers are disabled; real network admission and the render loop need separate proof. |
| Native: `node scripts/impaired-connection-scenario.mjs` and registered room/checkpoint scenarios | Real processes, two seats, delayed transport, interrupted orders and recovery | Process/snapshot assertions do not prove appearance. |
| Snapshot: `node --test scripts/snapshot-private-production.test.mjs scripts/snapshot-row-allocation.test.mjs` | Seat privacy, exact fields and wire equivalence | Snapshot receipt must still reach the intended visible state. |
| Assets: `npm run audit:asset-adoption`, `npm run validate:visual-pack`, `node --test scripts/sprite-pixel-bounds.test.mjs scripts/registered-foot-sprites.test.mjs` | Admission/provenance, alpha clipping, pivots and registered artwork contracts | Labelled frame directions do not prove the artwork faces correctly. |
| Work bridge: `node scripts/worker-performing-action-scenario.mjs --client-presentation` | Native productive-work receipts linked to CPU presentation | Each packet is held for 640 ms to settle interpolation; this is not continuous browser/network walking. |
| Package: `npm run release:pack`, `node scripts/railway-release-scenario.mjs` | Clean release identity and Docker COPY output, served imports/assets, private-path denial, auth/WS behavior | Serving bytes does not establish shader/image decode or ordinary use. |
| Browser: existing CDP/room harnesses and [.game-dev adapter](../.game-dev/adapter.json) | Opt-in LOD, environment, clipping and browser-performance captures | Outside default CI; some modes preview art. They are not universal normal-roster acceptance. |
| Identity: `node --test scripts/build-identity.test.mjs` | Expected/served SHA and declared pack digest, dirty/missing/conflicting identity failures, sanitized bounded health response and CLI mismatch exit | CPU and mocked CLI checks; native packed `/health` integration is covered by the release scenario. No render or byte attestation claim. |
| Hosted: `npm run release:smoke -- --environment staging --expected-source FULL_SHA` | Authorized ready/auth/import/assets, explicit expected/served source comparison and WebSocket 401/101 checks; optional `--expected-digest sha256:DIGEST` | Uses existing authorized service access. Provider-only source metadata leaves clean pack/digest unknown; declared digest comparison does not rehash the running image or render it. |
| Performance: `node scripts/browser-performance-scenario.mjs 10`, `node scripts/checkpoint-performance-scenario.mjs 12 move 1` | Declared browser/CPU timing and native checkpoint/load metrics | Heavy runners are outside default CI. Backend/hardware and workload must match a comparison. |

Run focused checks appropriate to the changed contract, then complete required
repository checks. Preserve the existing suite while adding faster lane selection;
do not replace it with a green subset. A missing/queued hosted run is
unavailable evidence, not a pass or an invented merge restriction.

### Executable lane selection

[Lane wiring PR #289](https://github.com/lbeezr/thousand-unit-skirmish/pull/289)
registers both new CPU tests and adds these commands:

| Command | Execution scope and limit |
| --- | --- |
| `npm run test:fast` | Registered `.test.mjs` contracts, recursive syntax, both type gates and import/docs guards. CPU only; fixtures may start native processes. “Fast” is relative to scenario work, not a fixed time promise. |
| `npm run test:simulation` | Remaining CPU scenario registrations, preserving their order. Together with `test:fast`, partitions every full-suite registration exactly once. |
| `npm run test:visual` | WebGL2 readback prerequisite, then actual `game-dev` four-frame environment pilot capture. Requires an existing authorized renderer executor/launcher. This preview does not prove Worker/Spearman motion, a clean packed game or staging acceptance. |
| `npm run test:performance` | Existing `checkpoint-performance-scenario.mjs 10 move 1`: one CPU timing/recovery sample. No GPU, soak or before/after performance claim. |

Append `-- --list` to inspect a lane without executing it. Full/fast/simulation
support `--shard=INDEX/COUNT`; visual/performance reject shards. Append
`-- --report=/tmp/test-lane.json` to retain schema-version-1 JSON with lane/shard,
full source revision/dirty flag, selected/lane/passed/unrun counts and per-check
outcomes. Plans have status `planned` and zero executed checks. Execution is
fail-fast: `passed` exits 0, `failed` exits 1, invalid options exit 2 and recognized
unavailable renderer capability/launcher yields `blocked` with exit 3. Malformed
preflight evidence and report-write failures fail. `fullCpuSuitePassed` is true
only for a successful unsharded full CPU suite; no lane or shard implies rendered
or comparative performance acceptance. Default CI retains three CPU shards with
JSON artifacts; manual workflow lane selection uses the existing runner type.

The wiring owner's [PR evidence](https://github.com/lbeezr/thousand-unit-skirmish/pull/289)
retains earlier executions from a dirty `53a47ee` tree: startup blocked the visual
lane before capture, and the existing 2,000-unit move performance workload failed
its planning-count assertion (six completed jobs versus two expected). The visual
attempt predates the new WebGL2 prerequisite; neither record is execution evidence
for the merged wiring revision. Renderer availability remains with the cloud
testing owner; the code-quality owner retains the route-completion diagnostic.
Lane wiring does not make either workload pass or change its assertions.

Full-suite success is also unverified. The recorded CPU shard 2 at `d8f10423`
failed the stale Practice launch-identity expectation in
[`shore-fishing-adoption-scenario.mjs`](../scripts/shore-fishing-adoption-scenario.mjs);
the other shard results were incomplete in that record. The code-quality owner
retains result collection and that fixture repair. Focused contracts, type/guard
checks and release packing pass in the wiring evidence; they are separate from
full-suite or rendered acceptance.

## Critical regression contracts

Source fixes for [selectors (#284)](https://github.com/lbeezr/thousand-unit-skirmish/pull/284),
[direct routes (#285)](https://github.com/lbeezr/thousand-unit-skirmish/pull/285)
and [Infantry identity (#286)](https://github.com/lbeezr/thousand-unit-skirmish/pull/286)
must be checked at the served revision before declaring their visible outcomes
accepted. The reported Worker source matrix covers 64 land action/heading entries;
rendered acceptance remains separate. At the inventory revision, Spearman v1 has
an eight-frame southeast walk clip and seven one-frame walk placeholders. Expose
direction borrowing and missing temporal coverage; available clip keys alone
cannot establish complete motion.

[Temporal regression PR #287](https://github.com/lbeezr/thousand-unit-skirmish/pull/287)
adds the displacement-to-clock/UV/decoded-cell tests and WebGL2 capability probe.
The [dated evidence](qa-unit-displacement-animation-2026-10-04.md) records all
64 positive cases and intended failure counts: frozen clock 64, forced southeast
selection 56, duplicate authored moving cells 36. Worker has eight distinct walk
cells in each direction; Spearman has eight southeast cells and seven exact-facing
idle fallbacks. This completes the named CPU regression scope, with those art gaps
explicit, while normal packed-game and staging pixels remain unverified.

| Contract / owner | Required assertions and scenarios |
| --- | --- |
| Economy/construction — gameplay owner | Resources stay finite/nonnegative; carried stock, spending, deposits and refunds conserve value and occur exactly once. Test owned unfinished wall clicks, gate completion/resume, tree exhaustion/nearby continuation, bounded unreachable targets, Stop/replacement, cancellation and cold recovery. |
| Movement/combat — gameplay owner | Finite in-bounds legal steps, progress and trajectory quality at arbitrary open-ground bearings; narrow gates, concave corners, diagonal obstacles, crowds and retargeting. Check work/attack target-facing, stale path/target cleanup, event timing, damage/death and production/capacity/ownership across recovery. |
| Authority/network — network test owner | Two real clients, controlled delay/disconnect and cold restart as separate cases; packet duplication/reordering only at a declared supported protocol boundary. No forged ownership mutation, duplicate effects, unbounded queues or obsolete command resurrection. Compare each seat's designated visible state with authority. |
| Fog/security — network test owner | Information designated hidden by the gameplay contract stays private in snapshots, reconnect, spectator/error paths and artifacts; public static map/resource information may legitimately be known. Reject unknown commands, nonfinite coordinates, oversized messages/arrays, invalid indices/references/schemas, path traversal and abusive rates without match crashes or cross-seat mutation. |
| Inputs/feedback — UI owner | Focused typing/chat does not issue gameplay shortcuts; check modifiers, selection, right-click, focus/key-up recovery, pointer capture, viewport/camera bounds and supported context recovery. Ownership/errors use readable non-color cues; volume/mute and valid event feedback work once through reconnect. |
| Asset identity — art/runtime owner | Required action/heading matrix, frame timing, dimensions, alpha/crop/atlas bounds, pivot/root, camera/scale, selector mapping, source/license/approval and hashes. Source coverage and rendered coverage are separate. Private/unapproved source variants and credentials stay out of the served bundle and evidence. |

Preserve intentional idle holds, declared static fallback and terminal defeat
poses. Fail unexpected duplicate phases or missing distinct phases in a required
moving clip; do not reject every repeated frame. Undeclared borrowed directions
cannot masquerade as complete directional coverage. An intentional incomplete
fallback retains an owner and explicit acceptance limit.

Extend existing fixture helpers with bounded seeded command sequences, per-tick
invariants and a minimal failing replay when useful. A property-test/shrinking
layer is proposed, not an installed dependency or an excuse to replace focused
regressions. Security/fog violations and critical functional defects keep release
acceptance open, even if unrelated source changes can integrate.

## Test design and acceptance

Keep one small seeded scenario definition where practical: ordinary input,
accepted command tick, expected world outcome and expected presentation. Reuse it
through the existing CPU, native and browser harnesses. Each layer should assert
its own boundary rather than duplicate every gameplay case in every renderer.
Use fixed simulation ticks and explicit frame samples; avoid uncontrolled sleeps
as the behavioral oracle. Multiplayer scenarios retain both seats, command
generations, fog privacy, cancellation and cold recovery.

The priority visual regressions are Worker frozen walking and Spearman facing.
Existing clock/interpolation tests remain valuable; they do not reproduce the
complete normal loop under real packet cadence, asset loading, selection and LOD.
One still screenshot also cannot distinguish an advancing walk from a held pose.
Direction metadata and projection math can agree with mislabelled artwork.

The merged CPU temporal regression covers actual client interpolation/update
scheduling, turns, a Stop-equivalent held position and resume using supplied
server-position samples and fixture-selected approved packs through preview flags.
Its negative controls check frozen clocks, wrong UV headings and
duplicate moving cells. It does not execute real server Move/Stop admission,
packet cadence or the browser render loop.

The cloud testing owner retains a bounded ordinary Move → continuing walk → Stop
scenario, using the normal shipped roster and real snapshots. Check both seats,
selected/unselected actors and ordinary/strategic zoom. Correlate displacement,
continuous clock, frame/UV progression and at least two visibly distinct authored
poses; Stop reaches idle. A short jitter/reconnect case must not reset or freeze
the clock. Manually setting `walking=true` is a selector test, not this acceptance.

For facing, capture eight commanded bearings with a fixed camera and destination
arrows. Compare actual body/weapon facing to reviewed sources under the existing
[angle-reference standard](asset-angle-reference-standard.md). Preserve approved
visual identity. Review expected/actual/diff crops before changing a golden;
failures do not authorize a new art style, regeneration or automatic baseline
replacement. Validate test sensitivity with isolated harness mutations that freeze
frame advancement and swap one heading. Do not ship those mutations.

### Ordinary game journeys

At least one acceptance path creates and joins a match through the actual map
selection/lobby and ordinary defaults. Fixtures may accelerate setup, but must
not replace production selectors, orders, pathing or asset decisions. Verify
served identity before asserting the gameplay result.

| Journey | Required normal-use observations |
| --- | --- |
| Entry/setup | Client/assets/UI load; supported map selection, room creation/join, launch and correct owned spawn. |
| Economy/building | Select Worker, Move, gather/deposit, paid construction, interrupt/resume, gate/wall interaction, tree continuation and cancellation. |
| Movement/combat | Individual/group selection, arbitrary bearings, corners/crowds, target changes, Stop, damage/death and visual cleanup. |
| Completion/recovery | Supported victory/defeat and result UI, rejoin/reconnect, cold worker restart and rematch with correct state. Save/load is tested only where actually implemented. |

Keep short deterministic versions for targeted changes and longer adversarial
versions for scheduled depth. Record unavailable/unimplemented journeys as pending
with their owner; a synthetic substitute cannot close the normal journey.

## Evidence and completion contract

Store the result beside the owning PR/QA record, linking reusable artifacts under
`docs/qa-evidence/` when appropriate. Keep credentials and invite/session secrets
out of logs and captures. Record these fields, using `unknown` with an owner and
next action when evidence is unavailable:

| Evidence field | Required meaning |
| --- | --- |
| Scope/status | CPU contract, native, packed render, hosted render or performance; `passed`, `failed`, `blocked`, or `not-run`; exact command and exit/result. |
| Failure class | Infrastructure, functional, performance or art judgment; preserve the first failure and its reproducing seed/trace. |
| Source | Tested commit SHA, clean/dirty state, relevant source hashes; distinguish PR merge-ref from branch head and final main. |
| Build | `release-manifest.json` `sourceRevision`, `sourceDirty`, digest and relevant asset hashes. A dirty experimental build cannot represent a clean release. |
| Served | Local packed origin or authorized hosted environment, explicit expected/served source SHA comparison through authenticated `/health` and corroborating release/asset identity. Record provider-only source scope separately from declared pack digest. Do not infer deployment from main or a deploy request. |
| Scenario | Map/ruleset hashes, seed, mode, seats/civilizations, unit IDs/generations, accepted command ticks, expected outcome and actual observation. |
| Render | Browser/version, WebGL2/backend/driver, viewport/DPR, camera/zoom, sampled frame times and state, atlas/frame IDs, cropped PNG sequence and errors. |
| Performance | Named machine/backend, workload, warmup, repetitions, baseline/candidate identity and comparable percentiles; distinguish CPU, GPU and display timing. |
| Ownership | Outcome owner, unresolved blocker, receiving owner when assigned, exact next action and linked implementation/evidence artifact. |

The runtime owner retains ordinary-game verification until the relevant user
environment runs the identified release and the requested behavior is observed.
A blocked render environment leaves pixel acceptance incomplete while verified
CPU/package work can proceed. The release owner coordinates deployments; this
strategy adds no deployment authority. Source/tool/documentation outcomes close
when their own checks and integration are complete; they must not claim gameplay
acceptance for future tests.

Retry only an identified transient infrastructure error with a small fixed cap
and the first failure retained. A flaky test needs a linked issue, owner, seed,
bounded quarantine scope and expiry; quarantine cannot satisfy its acceptance
gate. Do not retry until green, widen a tolerance to hide a defect or silently
omit an unavailable visual lane.

## Ranked implementation backlog

Ownership is assigned by stream; each receiving owner records its concrete PR,
command and acceptance result here when implemented. Statuses distinguish merged
checks from remaining acceptance. Keep runtime/test/CI changes in the owners' small
PRs rather than folding them into this documentation change.

| Rank / status | Owner and write boundary | Completion evidence |
| --- | --- | --- |
| 1 — probe implemented; game pixels blocked | Cloud testing owner; preflight/render harness | WebGL2 readback probe and CPU failure contracts merged in #287. Still needs supported isolated sandbox, packed production draw/atlas decode/temporal PNG proof and separate staging access result. Replace the dated blocker record. |
| 2 — CPU temporal regression implemented; browser pending | Cloud testing owner; existing browser/CPU presentation harnesses | #287 checks 64 supplied-position cases and rejects frozen clocks/duplicate moving cells. Normal Worker/Spearman Move/Stop, real packet cadence and jitter/reconnect render checks above remain pending. |
| 3 — CPU heading faults implemented; reviewed art pending | Cloud testing owner with art owner; directional fixture/reference evidence | #287 rejects forced southeast UV selection. Still needs eight reviewed rendered bearings linked to admitted source identity; seven Spearman gait directions remain idle fallbacks. No unreviewed golden/style change. |
| 4 — lane wiring implemented; workload acceptance separate | CI wiring owner; `package.json`, `scripts/ci.mjs`, `.github/` | #289 adds fast/simulation/visual/performance selection, exact registry/shard regressions and scoped JSON evidence while retaining the full CPU suite. Earlier executions retain renderer/performance diagnostics with their source provenance. Scheduled depth and qualified game visuals remain pending. |
| 5 — pending replay contract | Gameplay test owner; fixed-tick/native fixtures | Immutable seed/map/ruleset/accepted-command trace and meaningful checkpoint comparisons across restore/mirrored seats; normalize only declared volatile fields. |
| 6 — identity contract implemented; hosted receipt pending | Release owner with cloud testing owner; existing package/hosted smoke | `build-identity.test.mjs` and the native packed release scenario reject wrong served SHA; hosted smoke requires an explicit SHA and optionally the declared pack digest. Parent deployment/auth owner must run it at the new deployed revision. Normal two-seat hosted capture and existing asset byte checks remain separate; unknown identity/access stays incomplete. |
| 7 — pending controlled performance | Performance owner; existing load/measurement runners | Repeated comparable baseline/candidate metrics on a named cloud backend; meaningful regressions fail the declared budget. |

Current browser defaults are frame interval p95 ≤33.333 ms, animate callback CPU
p95 ≤8 ms and zero observed tasks over 50 ms. Native load checks tick/start-lag
p95 against the reported tick budget and maxima against three times that budget.
These are runner contracts, not universal hardware guarantees. Software WebGL2
may prove render correctness; it cannot establish hardware GPU performance or
display latency. Preserve existing limits; justify any budget change with product
evidence. Sustained performance comparisons need controlled host conditions,
whereas small appearance captures do not wait for a quiet-host clearance.

Performance coverage follows the [supported map policy](map-scale-density.md):
ordinary 160/192/224/256 maps, dense terrain/water/visibility edges, mixed
movement/gathering/combat/queues and order bursts. XL 320 remains gated on engine
index/cache support. A 2,000-unit rendered-capacity claim requires actual rendered
evidence, not a native count. Include representative clients, reconnect churn,
cold restarts, warmup, repeated short comparisons and cancellable multi-match
soak. Report whole-tick and frame p50/p95/p99/max where available, lag/overruns,
order latency, queues, memory growth, allocation/GC, asset load and render cost.
Mark unavailable metrics explicitly; function timing is not whole-tick timing.
Use one sustained comparison per runner, bounded load and cleanup. Stop at an
actual capability/resource/budget failure; no service upgrade is assumed approved.

Execution entrypoints above are implemented. Further acceptance gates remain
proposed: short qualified temporal visuals alongside relevant PR CPU/native/package
checks; scheduled
seeded recovery, broader role/direction/LOD coverage and multiplayer soak; release
identity plus ordinary hosted gameplay; controlled performance comparisons.
The owners must update this guide with actual commands rather than advertise
unimplemented entrypoints.

## Research and platform decisions

Epic separates [unit, feature, stress and screenshot testing](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine).
Its [screenshot tool](https://dev.epicgames.com/documentation/en-us/unreal-engine/screenshot-comparison-tool-in-unreal-engine)
captures within functional tests, compares with declared tolerances and supports
reference review; [Gauntlet](https://dev.epicgames.com/documentation/en-us/unreal-engine/gauntlet-automation-framework-in-unreal-engine)
treats a multiplayer session as server plus clients. Apply those practices using
the current Node/CDP harnesses; adopting another engine/framework is not required.

Headless execution still needs graphics for pixel claims: Unity documents that
[`-nographics`](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html)
does not initialize a graphics device. This is a distinction, not a Unity migration
proposal. [headless-gl](https://github.com/stackgl/headless-gl) advertises experimental
WebGL2 support; it is only an optional bounded compatibility spike, not the
default runner or a proven substitute for Three r180, DOM/input and networking.
No new dependency or platform purchase is part of this strategy PR.
