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
node scripts/browser-preflight.mjs --launch
```

Run it once in the intended cloud environment. Record its JSON and exit status:
`ready` means browser/CDP startup only; `unsupported` is an explicit blocker,
not a visual pass. `--diagnose=STARTUP_LOG` classifies an existing startup log
without launching another browser. Do not repeat the same failed startup or
download unchanged. Continue independent CPU/native work while the cloud testing
owner resolves the recorded capability failure.

**The stronger render gate is pending implementation.** Before accepting pixels,
it must prove a sandboxed isolated browser can load the clean packed game, create
WebGL2, compile/draw the production renderer, decode the actual atlas, receive
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

Inventory verified at `53a47ee3` on 4 October 2026. The [CI registry](../scripts/ci.mjs)
and [workflow](../.github/workflows/ci.yml) are authoritative for current execution.
`npm test` runs the registered CPU contracts and native scenarios. GitHub uses
Node 24, three shards (`npm test -- --shard=1/3`, `2/3`, `3/3`) and packs the release
on shard 1. New lane entrypoints are **proposed until their wiring PR merges**;
use the commands below now. See [the command guide](testing.md) for parameters,
dependencies and disposable-room setup.

| Lane / existing command | What it establishes | Remaining boundary |
| --- | --- | --- |
| Source: `npm run architecture:check`, `npm run check:types`, `npm run docs:check` | Runtime dependency/cycle policy, explicitly checked types and documentation links | Static checks do not establish gameplay or pixels. |
| Focused CPU: `node --test scripts/unit-sprite-clock.test.mjs scripts/unit-animation-runtime.test.mjs scripts/villager-facing.test.mjs scripts/unit-presentation-client.test.mjs` | Clocks, headings, shipped manifests, interpolation and Three UV/matrix buffers | Presentation uses VM-extracted client code and stub textures, without a browser/GPU. |
| Replay: `node --test scripts/pathing-replay.test.mjs scripts/pve-skirmish-replay.test.mjs` | Fixed-tick source-copy simulation, paid rules and exact scenario recovery | Listening/timers are disabled; real network admission and the render loop need separate proof. |
| Native: `node scripts/impaired-connection-scenario.mjs` and registered room/checkpoint scenarios | Real processes, two seats, delayed transport, interrupted orders and recovery | Process/snapshot assertions do not prove appearance. |
| Snapshot: `node --test scripts/snapshot-private-production.test.mjs scripts/snapshot-row-allocation.test.mjs` | Seat privacy, exact fields and wire equivalence | Snapshot receipt must still reach the intended visible state. |
| Assets: `npm run audit:asset-adoption`, `npm run validate:visual-pack`, `node --test scripts/sprite-pixel-bounds.test.mjs scripts/registered-foot-sprites.test.mjs` | Admission/provenance, alpha clipping, pivots and registered artwork contracts | Labelled frame directions do not prove the artwork faces correctly. |
| Work bridge: `node scripts/worker-performing-action-scenario.mjs --client-presentation` | Native productive-work receipts linked to CPU presentation | Each packet is held for 640 ms to settle interpolation; this is not continuous browser/network walking. |
| Package: `npm run release:pack`, `node scripts/railway-release-scenario.mjs` | Clean release identity and Docker COPY output, served imports/assets, private-path denial, auth/WS behavior | Serving bytes does not establish shader/image decode or ordinary use. |
| Browser: existing CDP/room harnesses and [.game-dev adapter](../.game-dev/adapter.json) | Opt-in LOD, environment, clipping and browser-performance captures | Outside default CI; some modes preview art. They are not universal normal-roster acceptance. |
| Hosted: `npm run release:smoke -- --environment staging` | Authorized ready/auth/import/assets and WebSocket 401/101 checks | Uses existing authorized service access; does not render or currently enforce an expected deployed SHA. |
| Performance: `node scripts/browser-performance-scenario.mjs 10`, `node scripts/checkpoint-performance-scenario.mjs 12 move 1` | Declared browser/CPU timing and native checkpoint/load metrics | Heavy runners are outside default CI. Backend/hardware and workload must match a comparison. |

Run focused checks appropriate to the changed contract, then complete required
repository checks. Preserve the existing suite while adding faster lane selection;
do not replace it with a green subset. The CI wiring owner must prove each selected
lane's registration, exclusions and shard coverage. A missing/queued hosted run is
unavailable evidence, not a pass or an invented merge restriction.

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

The cloud testing owner must add a bounded ordinary Move → continuing walk → Stop
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
| Served | Local packed origin or authorized hosted environment, exact deployed/served source SHA and corroborating release/asset identity. Do not infer this from main or a deploy request; expected-versus-served identity enforcement remains pending. |
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
command and acceptance result here when implemented. These rows are pending,
not checked-off infrastructure. Keep runtime/test/CI changes in the owners' small
PRs rather than folding them into this documentation change.

| Rank / status | Owner and write boundary | Completion evidence |
| --- | --- | --- |
| 1 — blocked capability | Cloud testing owner; preflight/render harness | Supported isolated sandbox, packed WebGL2 production draw/atlas decode/temporal PNG proof, cleanup and separate staging access result. Replace the dated blocker record. |
| 2 — pending temporal regression | Cloud testing owner; existing browser/CPU presentation harnesses | Normal Worker/Spearman Move/Stop and jitter/reconnect checks above; deliberate freeze mutation fails. Publish the merged command and artifacts. |
| 3 — pending facing regression | Cloud testing owner with art owner; directional fixture/reference evidence | Eight reviewed bearings linked to admitted source identity; swapped-heading mutation fails; no unreviewed golden/style change. |
| 4 — pending lane wiring | CI wiring owner; `package.json`, `scripts/ci.mjs`, `.github/` | Fast CPU, native, qualified render and scheduled depth lane entrypoints; exact registry/shard proof, explicit unavailable capability, retained existing coverage and failure artifacts. |
| 5 — pending replay contract | Gameplay test owner; fixed-tick/native fixtures | Immutable seed/map/ruleset/accepted-command trace and meaningful checkpoint comparisons across restore/mirrored seats; normalize only declared volatile fields. |
| 6 — pending served identity | Release owner with cloud testing owner; existing package/hosted smoke | Expected source/build/served SHA and asset digest checks, then normal two-seat capture at that hosted release; unknown identity/access stays incomplete. |
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

Proposed execution gates, once their pending implementations are merged: relevant
PR CPU/native/package checks and short qualified temporal visuals; scheduled
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
