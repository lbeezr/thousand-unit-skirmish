# Testing and validation

[Documentation index](README.md) · [QA protocol](qa-vertical-slice.md)

## Repository checks

```sh
npm ci
npm test
```

[`scripts/ci.mjs`](../scripts/ci.mjs) is the exact suite list. It checks JavaScript
syntax and runs focused logic, gameplay, map, PvE, visibility, recovery, asset
contract, room, and release scenarios. CI uses Node 24. Browser/GPU appearance
captures and sustained performance runs are separate.

The [CI workflow](../.github/workflows/ci.yml) runs in the repository receiving
the event. Its checkout uses that repository and event ref, so it does not
depend on the upstream `lbliii/thousand-unit-skirmish` repository. The active
fork is [lbeezr/thousand-unit-skirmish](https://github.com/lbeezr/thousand-unit-skirmish).
Pushes to `main`, pull requests, and manual runs use the same checks. The workflow
needs only the built-in read-only GitHub token; it uses no repository secrets
and does not deploy to Railway.

GitHub runs three independent jobs with `npm test -- --shard=1/3` (and `2/3`,
`3/3`). Each registered check runs exactly once across those jobs; release
packaging runs in job 1. Local `npm test` still runs the complete suite in order.
`node scripts/ci.mjs --list` prints the registry without starting fixtures, and
accepts the same shard option for coverage inspection.

### Incremental checked JavaScript

`npm run check:types` uses locked TypeScript 5.9.3 with strict `checkJs` and
`noEmit`. Browser-compatible leaves keep `types: []`. The explicit file list in
[`tsconfig.check-js.json`](../tsconfig.check-js.json) names each checked module
and compile-only consumer explicitly. The current boundary covers
[`canopy ages`](../src/forest-age-composition.mjs),
[`woodland habitat`](../src/forest-habitat.mjs) and
[`Underbough species`](../src/forest-composition.mjs), plus
[`resource stages`](../src/resource-visual-state.mjs) and
[`terrain masks`](../src/terrain-blend.mjs): numeric cell identity and
world/grid coordinates, immutable authored rectangles, a row-major depth grid,
numeric seed/spacing/factors, the five existing species IDs and four resource
stage IDs with complete numeric fallback scales. Resource transition inputs
remain unknown until membership checking narrows the filtered output. The runtime
algorithms and serialization are unchanged; no generated JavaScript is shipped.
Terrain masks take immutable paint/forest rectangles and numeric dimensions/seed,
then return ordered RGBA `Uint8Array` buffers with numeric pixel dimensions;
forest ground masks require a null check before use.

`node --test scripts/check-types.test.mjs` compiles intentionally invalid
consumers in memory and requires the expected diagnostics for missing/string
cell IDs, misspelled/nonnumeric coordinates, string seed/radius, string map
keys/values, unchecked missing lookups and point mutation. Habitat/species cases
also reject missing dimensions/rectangle rows, wrong obstacle materials,
string depth/spacing and species typos. No suppression is used.
Resource cases reject string stock, stage typos, wrong transition element types
and mutation of the canonical stage list. `resource-visual-state-scenario.mjs`
covers the existing thresholds and dirty-batch ordering;
`node --test scripts/resource-visual-state.test.mjs` protects unknown membership
without coercion and the stock/stage/scale path. Numeric stock/scale
contracts apply to checked callers; legacy runtime coercion/fallback behavior
is retained for unselected callers.
Terrain cases reject missing/misspelled rectangle fields, numeric material IDs,
string dimensions/seed/flags, floating-point pixel buffers, input mutation and
unguarded absent masks. `terrain-blend-scenario.mjs` retains normalized joins,
catalog/compression independence, organic-edge determinism and input preservation.
Static types check buffer/dimension kinds; exact RGBA length and valid geometry
remain runtime/scenario checks.

[`tsconfig.check-node.json`](../tsconfig.check-node.json) separately checks the
existing [outbound framing leaf](../src/networking/websocket-frame.mjs) and its
compile-only consumer. It inherits the same strict/no-emit settings with locked
development-only `@types/node` 24.19.1. No runtime leaf or signature is changed.
`node --test scripts/check-node-types.test.mjs` rejects text/plain/float/null
payloads, string opcodes/flags/counts and Buffer/number confusion, and proves
`Buffer`/`process` globals still fail in the browser boundary. Existing native
framing tests retain 100% line/branch/function coverage, exact literal headers,
byte-length thresholds and independent ownership for offset byte views.

Both compiler configurations and their negative tests run in `npm test`;
existing `forest-age-scenario.mjs`, `forest-habitat-scenario.mjs`
and `forest-composition-scenario.mjs` cover determinism, seed variation, spacing,
glades, rectangle compression, root retention and input preservation.

Expand this boundary only with a bounded file scope and a zero-error result.
Unselected gameplay/client files do not need a type cleanup to pass this check.
Runtime validation of finite values, positive radius and unique cell IDs remains
separate from static types; unchecked callers are outside this initial boundary.

#### Ranked type-safety backlog

The incremental type-safety stream owns this list and takes one bounded,
reviewed/tested slice at a time under the existing merge authority. Completed:
canopy identity/factors ([PR #162](https://github.com/lbeezr/thousand-unit-skirmish/pull/162)),
woodland habitat/species ([PR #167](https://github.com/lbeezr/thousand-unit-skirmish/pull/167)),
resource stages ([PR #178](https://github.com/lbeezr/thousand-unit-skirmish/pull/178)),
terrain masks ([PR #188](https://github.com/lbeezr/thousand-unit-skirmish/pull/188))
and the separately scoped Node framing gate. Re-rank after each merge from current
main and active PR scopes; record a concrete defect risk before expanding.

| Rank / state | Boundary | Defect risk and required proof | Scope/dependency |
| --- | --- | --- | --- |
| 1 — reassess when evidence appears | Next stable pure-data boundary | Select a concrete unchecked shape/identity/ownership risk with a positive consumer, a failing negative case and exact runtime/serialization proof. The current ready queue is exhausted. | No additional source writes reserved. Deflate-offer inputs intentionally remain `unknown` and its boolean contract already has strict-check/coverage evidence from its extraction; topology/cell helpers have active gameplay consumers and no new type defect reproduced in this audit. Revisit a documented defect or an agreed stable seam; avoid annotations solely to increase coverage. |

Do not expand into audio reader/production/research extractions, gameplay roots
or active render/entry hotspots to chase coverage. Coordinate concrete moves or
shared contract changes with their architecture/quality owners before editing.
Unchanged-runtime tooling gates are complete when enforced and validated;
deployment/in-game acceptance belongs to the runtime release owner when applicable.

### Enable and verify fork CI

Open the fork's [Actions page](https://github.com/lbeezr/thousand-unit-skirmish/actions).
If GitHub offers to enable inherited workflows, enable them; if CI is individually
disabled, enable that existing workflow. A missing run alone does not establish
why CI is unavailable. With an already authorized GitHub CLI connection:

```sh
gh api repos/lbeezr/thousand-unit-skirmish/actions/workflows/ci.yml --jq '{id, state, path}'
gh workflow enable ci.yml --repo lbeezr/thousand-unit-skirmish
gh workflow run ci.yml --repo lbeezr/thousand-unit-skirmish --ref main
gh run list --repo lbeezr/thousand-unit-skirmish --workflow ci.yml --commit COMMIT_SHA
```

Enable only when the returned state is disabled. Manual dispatch becomes
available after the workflow containing `workflow_dispatch` reaches `main`.
Select the intended branch/ref, then verify the run's `head_sha`, event,
conclusion, and all three shard results against the intended commit. A PR run
tests GitHub's merge ref by default; its head SHA identifies the proposed
commit, while the push run validates the final `main` commit after merging.
Zero runs or zero checks is unavailable CI, not a pass. Do not create a second
workflow, add deployment tokens, broaden app permissions, or weaken repository
rules to work around missing access. See the
[deployment guide](deployment.md#github-source-and-deployment-triggers) for
Railway's separate source and CI-wait settings.

Use checks proportionate to a change, then run required repository checks.
For dependency/folder changes, run `npm run architecture:check` and
`node --test scripts/check-runtime-imports.test.mjs`. Both are registered in
the suite. The [architecture guide](architecture.md#module-dependencies-and-gradual-organization)
defines dependency directions, the explicit cycle baseline and the separate
HTTP/release obligations of a module move.
For client import/module changes, include
`node scripts/client-asset-allowlist-scenario.mjs`; the packed release scenario
also traverses served static, re-export and literal lazy imports for all five
registered browser entrypoints. The exact client-path manifest lives in
`src/server/client-asset-paths.mjs`; packed HTTP checks cover every declared path,
HEAD/MIME behavior and rejected/private paths independently of the server's source
declaration shape. The hosted Railway smoke uses
the same `scripts/check-client-imports.mjs` audit; focused fixtures cover missing
transitive dependencies, cycles, compact/escaped syntax, ignored comment/string
lookalikes, computed-import rejection, incorrect MIME and origin boundaries. Source
and served audits share the parser in `scripts/module-imports.mjs`. See the
[client-loading incident](qa-client-boot-recovery-2026-09-27.md).
Use disposable rooms and directories: many scenarios publish maps, reset armies,
restart workers, or deliberately disconnect clients.

## Documentation checks

```sh
npm run docs:check
```

This offline check verifies local Markdown paths and heading anchors across guides,
archives, and asset READMEs. It runs in `npm test`; external URLs are not fetched.

## Focused checks that start their own fixture

Run from the repository root:

| Area | Command |
| --- | --- |
| Normal finished Frontier building bindings, state fallback, grounding/facing, picking/depth and texture ownership | `node --test scripts/frontier-building-default.test.mjs`; [runtime contract and deployed-game acceptance](frontier-building-runtime.md) |
| Unit snapshot receipt, confirmed work/event clocks, movement, slot reuse, fog and sprite LOD buffers | `node --test scripts/unit-presentation-client.test.mjs` ([CPU fixture](../scripts/unit-presentation-client-fixture.mjs): actual client source slices/constants, shipped Human/Boughward Worker manifests and Three instanced UV/matrix buffers; UI, network, procedural fallback and GPU pixels excluded). [Agreed Worker v1](worker-performing-action-contract.md) covers waits, clear/resume, resource identity and unknown/generation defaults. `node scripts/worker-performing-action-scenario.mjs --client-presentation` adds actual both-seat WebSocket rows through controlled held-packet CPU frame checks; see [limits and ordinary-game recipe](qa-worker-performing-action-consumer-2026-10-04.md). |
| Building body occlusion, server cap and renderer-only 129th item; native fixture counters, query gates, serving and preservation | `node --test scripts/building-sprites.test.mjs scripts/building-occlusion-fixture.test.mjs`; [paired crowded scene and exact Mac GPU recipe](qa-building-occlusion-native-plan-2026-10-03.md) |
| Map logic / elevation | `node scripts/map-utils-scenario.mjs` / `node scripts/elevation-scenario.mjs` |
| Crowd deflection / terrain boundaries | `node --test scripts/unit-movement.test.mjs` (real authoritative movement blocks, cliffs, corners, working/striking separation and route repair) |
| Formation destinations after paid obstruction | `node --test scripts/pathing-replay.test.mjs`; `node scripts/pathing-native-scenario.mjs dynamic-goal` (both-seat reservation, opponent goal independence, native arrival) |
| Bounded choke baseline / deterministic replay | `PATHING_BASELINE_RECORD=/tmp/pathing.json node scripts/pathing-baseline.mjs all 2` (seven fixed-tick cases; [source evidence and limits](qa-pathing-goal-repair-2026-10-03.md)) |
| Dynamic paid walls / queued formation legs | `node --test scripts/dynamic-wall-pathing.test.mjs`; `DYNAMIC_WALL_RECORD=/tmp/walls.json node scripts/dynamic-wall-pathing.mjs 2`; `node scripts/dynamic-wall-native-scenario.mjs` (both seats, 16/64 Infantry, route obstruction, future targets and removal; [evidence](qa-queued-wall-pathing-2026-10-03.md)) |
| Manual gate closure over future formation targets | `QUEUED_GATE_RECORD=/tmp/gates.json node scripts/queued-gate-pathing.mjs`; add `--observe --park-builder` for the separate parked-Worker congestion probe; `--observe-pauses` retains at most eight owned-actor finite pause/proposal/admission observations, nullable last-evaluation position change, and a nullable fixed 30-tick net-displacement/sampled-travel window without rich traces or changing arrival assertions; incomplete/stale is null, not no progress or goal success; [bounded failing-actor repeat](qa-unit-displacement-animation-2026-10-04.md#fixed-window-net-displacement-audit-and-consumer--5-october-2026) |
| Parked Worker route recovery / Stop and Hold | `node --test scripts/stationary-worker-pathing.test.mjs scripts/unit-movement.test.mjs`; `node scripts/queued-gate-pathing.mjs --park-builder --stop-builder` (or `--hold-builder`); `node scripts/stationary-worker-native-scenario.mjs`; [bounds and evidence](qa-stationary-worker-pathing-2026-10-03.md) |
| Queued routes after finite cargo delivery | `node --test scripts/queued-cargo-return.test.mjs`; `QUEUED_CARGO_RECORD=/tmp/cargo.json node scripts/queued-cargo-return-case.mjs`; `QUEUED_CARGO_NATIVE_RECORD=/tmp/native-cargo.json node scripts/queued-cargo-return-native-scenario.mjs`; [failure, conservation and restart evidence](qa-queued-cargo-return-2026-10-03.md) |
| Default map geometry | `node scripts/forked-vale-layout.mjs` |
| Fortified Crossing foundation | `node scripts/fortified-crossing-layout.mjs` and `node scripts/fortified-crossing-economy.mjs`; [evidence and scale runner](qa-custom-skirmish.md) |
| Fortified late-arrival construction clearance | `node --test scripts/fortified-site-clearance.test.mjs` and `node scripts/fortified-construction-clearance-scenario.mjs 2000`; [diagnosis](qa-fortified-clearance-2026-10-03.md) |
| Selected construction workers | `node --test scripts/construction-selection.test.mjs` and `node scripts/construction-selection-scenario.mjs`; [reproduction and Mac check](qa-construction-selection-2026-10-03.md) |
| Larger map geometry | `node scripts/frontier-160-layout.mjs` |
| Highland Grove definition | `node scripts/generate-highland-grove.mjs --check` |
| Complete Forked Vale scenario, each winner | `node scripts/forked-vale-scenario.mjs 0` and `node scripts/forked-vale-scenario.mjs 1` |
| Mirrored combat | `node scripts/infantry-seat-combat-scenario.mjs --expect-parity` |
| Building attacks across disconnected terrain | `node scripts/ranged-building-attack-scenario.mjs` |
| In-range building attacks during construction repair | `node scripts/ranged-building-attack-scenario.mjs --edge-range-repair` |
| Archer firing positions across gaps | `node scripts/archer-firing-approach-scenario.mjs` |
| Cliff pursuit and attack-move alternatives | `node scripts/cliff-pursuit-scenario.mjs --direct` and without `--direct` |
| Attack-target loss and queued route continuation | `node --test scripts/attack-target-geometry.test.mjs`; `ATTACK_QUEUE_RECORD=/tmp/attacks.json node scripts/attack-queue-case.mjs`; `ATTACK_QUEUE_NATIVE_RECORD=/tmp/native-attacks.json node scripts/attack-queue-native-scenario.mjs`; [failure and bounded evidence](qa-attack-queue-transitions-2026-10-03.md) |
| Direct military Attack continuation | `node --test scripts/army-attack-continuation.test.mjs`; `ARMY_ATTACK_NATIVE_RECORD=/tmp/army-native.json node scripts/army-attack-continuation-native-scenario.mjs`; [reproduction, stance inventory and appearance limits](qa-army-attack-continuation-2026-10-03.md) |
| Military stances and idle defense | `node --test scripts/military-stance.test.mjs`; `MILITARY_STANCE_NATIVE_RECORD=/tmp/stance-native.json node scripts/military-stance-native-scenario.mjs`; [stance command/HUD and acceptance contract](military-stances.md) |
| Moving-target pursuit and Worker-combat timeout | `node scripts/worker-combat-scenario.mjs`; `node --test scripts/worker-combat-repath.test.mjs`; `WORKER_COMBAT_RECORD=/tmp/worker-pursuit.json node scripts/worker-combat-repath-case.mjs`; `WORKER_COMBAT_NATIVE_RECORD=/tmp/native-worker-pursuit.json node scripts/worker-combat-repath-native-scenario.mjs`; [baseline failure and recovery evidence](qa-worker-combat-repath-2026-10-03.md) |
| Construction on disconnected terrain / route protection | `node scripts/construction-connectivity-scenario.mjs` |
| Mirrored construction | `node scripts/opening-production-scenario.mjs --expect-builder-parity` |
| Producer destruction, replacement builders, and population caps | `node scripts/production-lifecycle-scenario.mjs` |
| Forest clearing | `node scripts/harvestable-woodland-scenario.mjs` |
| Forest route repair / exact deposits | `node scripts/worker-cargo-return-scenario.mjs` and `node scripts/worker-cargo-return-scenario.mjs frontier-160` |
| Patrol / Follow intent and replanning bounds | `node --test scripts/persistent-command.test.mjs` |
| Both-seat Patrol / Follow combat, recovery, interruptions and obstruction | `node scripts/persistent-command-scenario.mjs` |
| Patrol / Follow actual browser controls and large selections | `node scripts/persistent-command-browser.mjs` (installed Chrome; owner-run headless smoke) |
| Combined Fortified Crossing paid economy, event/order recovery, combat, result and rematch | `node scripts/fortified-crossing-combined.mjs 0` and `1` |
| Visual Fortified authoring, authoritative publication, fresh guest audio and native work/reset lifecycle | `node scripts/fortified-crossing-browser.mjs` (installed Chrome) |
| Two-seat rendered Fortified scale diagnostics and retained failures | `FORTIFIED_SCALE_RECORD=<output.json> node scripts/fortified-crossing-browser-scale.mjs 20 250,500,1000,2000` |
| Queued routes and checkpoint recovery | `node scripts/queued-waypoint-scenario.mjs` |
| Queue HUD metadata under backpressure | `node --test scripts/waypoint-backpressure.test.mjs` |
| Route repair after construction | `node scripts/live-attack-move-repair-scenario.mjs` |
| Research and rewards | `node scripts/research-scenario.mjs` |
| [Food-only Mill evidence](qa-mill-food-dropoff-2026-10-03.md): contract/menu, paid construction, deposits, ownership and lifecycle recovery | `node --test scripts/mill-contract.test.mjs scripts/roster-building-ui.test.mjs` and `node scripts/mill-scenario.mjs` |
| [Paid finite Farm evidence](qa-finite-farm-2026-10-03.md): owned finite stock, Mill return, no regrowth, cancellation/replanting/destruction and recovery | `node --test scripts/farm-harvest.test.mjs scripts/farm-client.test.mjs scripts/roster-building-ui.test.mjs`; `node scripts/farm-scenario.mjs --output=NEW_DIRECTORY` |
| [Simulated depot travel and paid economy comparisons](qa-mill-depot-economy-2026-10-03.md) | `node --test scripts/depot-economy-analysis.test.mjs scripts/depot-source-snapshot.test.mjs`; `node scripts/depot-economy-scenario.mjs --smoke`; full matrix: `node scripts/depot-economy-scenario.mjs --output=NEW_DIRECTORY` |
| Paid mature settlement, all current roles, restart and host reset | `node scripts/mature-settlement-scenario.mjs` and `--reverse-seats`; [inspection checkpoint and scope](qa-mature-settlement-2026-10-02.md) |
| Map persistence / timed events | `node scripts/map-persistence-scenario.mjs` / `node scripts/timed-event-scenario.mjs` |
| Deadline victory | `node scripts/timed-victory-scenario.mjs` |
| Elimination recovery, destroyed homes and disconnected clocks | `node scripts/victory-elimination-native-scenario.mjs` |
| Seats and reconnects | `node scripts/resume-session-scenario.mjs` |
| Delayed transport and interrupted orders, both seats | `node scripts/impaired-connection-scenario.mjs` |
| Client rematch roster and stale sockets | `node --test scripts/client-rematch-recovery.test.mjs` |
| Rooms and worker restart | `node scripts/room-supervisor-scenario.mjs` |
| Checkpoint write failure and recovery | `node scripts/checkpoint-storage-recovery-scenario.mjs` (unprivileged POSIX user) |
| Worker signal exits and forced shutdown | `node --test scripts/worker-shutdown.test.mjs` |
| Invite expiry during joins and worker startup | `node scripts/room-expiry-scenario.mjs` |
| PvE policy / launch lifecycle | `node scripts/pve-opponent-scenario.mjs` / `node scripts/pve-room-launch-scenario.mjs` |
| PvE tactics during gather retries | `node scripts/pve-decision-fairness-scenario.mjs` |
| PvE stranded reinforcement recovery | `node scripts/pve-reinforcement-recovery-scenario.mjs` |
| PvE stalled-army retry policy / server reproduction | `node scripts/pve-tactical-retry-scenario.mjs` / `node scripts/pve-tactical-stall-runtime-scenario.mjs` |
| PvE production budgets | `node scripts/pve-production-scenario.mjs` |
| PvE Worker recovery with one free population slot | `node --test scripts/pve-worker-recovery.test.mjs`; [fixed-tick paid recovery and checkpoint evidence](qa-pve-worker-recovery-2026-10-03.md) |
| PvE paid Farm starvation recovery, finite replant and no-spam guards | `node --test scripts/pve-farm-policy.test.mjs`; [both-seat deterministic restart evidence](qa-pve-paid-farm-2026-10-03.md) |
| PvE visible Worker/building raids and bounded objective recovery | `node --test scripts/pve-home-defense.test.mjs`; [both-seat raid, fog and restart evidence](qa-pve-home-defense-2026-10-03.md) |
| PvE bounded regroup after a wipeout | `node --test scripts/pve-regroup.test.mjs`; [paid recovery, checkpoint and four-map comparisons](qa-pve-regroup-2026-10-03.md) |
| Explicit Skirmish AI source policy | `node --test scripts/pve-skirmish-targets.test.mjs scripts/pve-skirmish-replay.test.mjs`; [paid producer and integration limits](qa-pve-skirmish-targets-2026-10-03.md) |
| Authoritative socket AI mode and canonical Skirmish recovery | `node --test scripts/pve-mode-adapter.test.mjs scripts/pve-skirmish-checkpoint.test.mjs`; [full-map replay and retained capability acceptance](qa-pve-mode-adapter-2026-10-04.md) |
| Both-seat canonical Skirmish army/producer losses and paid recovery | `node --test scripts/pve-skirmish-loss.test.mjs`; [legal casualty, rebuilding and cold-restart receipt](qa-pve-mode-adapter-2026-10-04.md#paid-loss-recovery) |
| PvE obstructed capture target rotation | `node --test scripts/pve-objective-rotation.test.mjs`; [paid walls, matched control and restart](qa-pve-objective-rotation-2026-10-03.md) |
| PvE destroyed producer replacement | `node scripts/pve-barracks-recovery-scenario.mjs` |
| PvE objective retake after losses | `node scripts/pve-objective-recovery-runtime-scenario.mjs TEAM SEED` (teams `0`, `1`; CI seed `20260925`, additional audited seed `4294967295`) |
| Contested seeded PvE match | `node scripts/pve-contested-match-scenario.mjs 300 20260925 4294967295` |
| PvE live construction / reinforcements (legacy and regional maps) | `node scripts/pve-production-runtime-scenario.mjs forked-vale` and `woodland-expanse`; also `bellweather-millrace` and `underbough-rootways` |
| Compact HUD | `node --test scripts/hud-layout.test.mjs scripts/selection-context.test.mjs scripts/objective-summary.test.mjs` |
| Tactical-map movement and Space selection centering | `node --test scripts/minimap-orders.test.mjs scripts/selection-center-shortcut.test.mjs`; [native Mac recipe and evidence](qa-minimap-orders-2026-10-03.md) |
| Native two-seat minimap input, camera preservation, responsive size and DPR | `node scripts/minimap-orders-browser.mjs --output=NEW_DIRECTORY` (installed Chrome); camera observation regression: `node --test scripts/minimap-browser-probe.test.mjs` |
| Audio policy | `node scripts/audio-policy-scenario.mjs` |

Three Crowns also has both-seat scenarios: `node scripts/three-crowns-scenario.mjs 0`
and `1`. Add `--stress` to the Forked Vale scenario for its 2,000-unit path and combat check.

## Checks against an existing disposable server

Start a dedicated worker in one terminal:

```sh
RTS_HOST=127.0.0.1 PORT=4174 node server.mjs
```

In another terminal, wait for health, then run the relevant scenario:

```sh
curl -fsS http://127.0.0.1:4174/health
node scripts/building-economy-scenario.mjs 4174
node scripts/attack-move-scenario.mjs 4174
node scripts/trigger-scenario.mjs 4174
node scripts/fog-of-war-scenario.mjs 4174
node scripts/order-status-scenario.mjs 4174
```

These commands change the fixture. Run them sequentially, and use a fresh worker
when a scenario needs a specific initial state. For the hardening scenario,
start a separate worker with `RTS_MAX_PEERS=2` and run
`node scripts/server-hardening-scenario.mjs 4174`.

## Browser and art checks

Chrome/Chromium is required; use `CHROME_PATH` if discovery fails.

The vegetation, resource-direction, mist, meadow, landscape, settlement and
terrain QA entrypoints create an invocation-owned profile under the job's
temporary directory. Startup failures and capture exceptions dispose it; normal
completion waits for Chrome to close before removal. Screenshots remain in their
evidence directories. No old profiles or other release outputs are swept.
`node --test scripts/temporary-resources.test.mjs` checks ownership, early failures,
child shutdown and successful release cleanup with unrelated output retained.

Before a browser proof, `node scripts/browser-preflight.mjs --launch` reuses the
isolated CDP launcher, reads the browser version, and disposes its temporary
profile. It emits versioned JSON and exits 0 for successful startup/cleanup or
1 for an unsupported runtime. No arguments or unknown options exit 2 without
launching a browser. CI tests its contract without requiring Chrome.

On a runtime already known to be blocked, use
`node scripts/browser-preflight.mjs --diagnose=/path/to/startup.log` instead.
This reads an existing local log and launches nothing. A log diagnosis always
exits 1: it cannot establish current readiness. Multiple observed blockers, such
as sandbox and Crashpad storage errors, are reported separately; raw stderr and
environment values are omitted from the JSON. Keep the original log locally
for investigation.

Sandbox failures require a provider-provisioned working sandbox. Profile/config
failures require writable per-job temporary, XDG configuration, and cache paths.
Installing a JavaScript automation library alone does not supply these runtime
prerequisites. This command changes no sandbox flags or permissions. `ready`
proves browser/CDP startup and cleanup only: WebGL2, game rendering, screenshots,
performance, and player usability still require their own evidence.

`scripts/capture-checkpoint.mjs` exports `captureCheckpoint()` for an existing
page from `createFortifiedBrowser()`. It launches nothing. Supply the clean
checkout revision, `browser.version`, intended map ID, a short checkpoint ID
(such as `ordinary-zoom`), and an absolute existing writable output directory.
Open the local game with `?rendererCapture=environment-state` to enable its
existing applied-state snapshot. A missing snapshot fails honestly; the selector
value alone cannot identify the applied map.
The caller owns browser readiness, checkpoint interaction, and final disposal:

```js
import {captureCheckpoint} from './scripts/capture-checkpoint.mjs';
const capture = await captureCheckpoint({page, revision, browserVersion: browser.version,
  mapId: 'underbough-rootways', checkpoint: 'ordinary-zoom', outputDirectory: '/tmp/captures'});
```

The helper checks a synced local game page and its applied-map snapshot before
and after the screenshot. Pending selection, uncertain/offline connection, missing
or changed applied map, and changed viewport reject the capture. It then writes
`color.png` and `manifest.json` in a new checkpoint folder.
The manifest records revision/browser/checkpoint context, viewport, PNG dimensions,
byte count and SHA-256. Revision and checkpoint labels are caller-supplied;
the helper does not establish which source build the server is serving or prove
the labeled gameplay event occurred. Identical context and image bytes produce
identical manifests. PNG framing/dimensions are checked; pixels and CRCs are
not decoded or reviewed. Existing output folders are preserved, and failed
captures remove only their newly created folder. A missing/failed CDP page
throws `CaptureCheckpointError` with code `capture-runtime-unavailable`.
Unit tests inject CDP replies and do not provide fresh rendered-game evidence.

- `node scripts/map-studio-draft-scenario.mjs`: editor draft behavior.
- `node scripts/frontier-160-map-studio-roundtrip.mjs`: legacy, elevation, large-map,
  and Highland Grove authoring round trips.
- [Asset guide](assets.md): manifest validation, sprite previews, and appearance
  capture contracts. Inspect the resulting pixels before claiming a visual pass.
- [Deployment guide](deployment.md): guarded public release smoke.

Authoring generators such as `author-forked-vale.mjs` and `improve-three-crowns.mjs`
write map files. They are authoring tools, not read-only validation commands.

## Performance measurements

Run one timed profile at a time. Record commit, hardware, browser, map, roster,
workload duration, host load, and every budget override.

Health timing includes `p99Ms` and `overBudgetTickCount` for its existing rolling
up-to-300-tick window. Counts compare Float64 stored durations against the exact
tick period; do not sum overlapping windows or confuse a late zero count with
no earlier spikes or skipped slots. The [bounded Crownroads record](qa-performance-window-overruns-2026-10-05.md)
retains baseline/candidate source identities and a real preparation overrun.
Existing p95/max diagnostic budgets remain unchanged.

The [identified tick-attribution consumer](qa-crownroads-tick-attribution-2026-10-05.md)
uses `map-capacity-scenario.mjs` and its existing report-check CLI. It retains raw
rows once by worker/match/map/tick, reports observed phase means/tails, and keeps
known map-probe interruptions separate from capture gaps. Exact per-row overrun
flags survive display rounding; attribution is observational, not a causal claim.

The opt-in [bounded inner observer](qa-crownroads-inner-attribution-2026-10-05.md)
uses `--attribution on` only for Crownroads, 24 units and ten-second waves. Its
existing report checker joins exact identities/phases, reports inclusive function
timing and GC overlap, and keeps profile boundaries separate. Diagnostic startup
overhead can fail the existing lag budget; retain that failure without a waiver.

Use `--recovery-profile-control on` with that bounded inner mode for the
[matched startup control](qa-crownroads-profiler-startup-2026-10-05.md). It restores
one checkpoint in profile/observer/observer/profile order and retains fixed
first60 tick windows with57 continuous post-startup clocks. Observer-only still
contains wrapper/memory/GC overhead; retain earlier failures and exact identities.

The [core tranche profile](core-playtest-tranche.md#scale-measurement-profile--proposed)
documents the bounded hosted movement ladder and per-seat tagged-order intervals.
Its success status asserts protocol liveness, not the broader scale budgets.

```sh
node scripts/checkpoint-performance-scenario.mjs 12
node scripts/checkpoint-performance-scenario.mjs 12 idle
node scripts/browser-performance-scenario.mjs 10
```

The browser profile runs three movement waves; `40` uses 40 seconds per wave for
a sustained sample. It uses an explicit 1280×720 CSS-pixel viewport at DPR 1 and
records actual viewport/canvas dimensions. Optional long-animation-frame
attribution identifies script/render phases and marks deferred startup entries;
tasks ending before the measurement starts are retained separately. Tasks
overlapping the measured window count against the long-task budget, regardless
of optional frame-attribution support.
Defaults are frame-interval p95 ≤33.333 ms, animate-callback
p95 ≤8 ms, and zero long tasks over 50 ms. Headless frame timing does not measure
windowed presentation latency or GPU completion.

To measure snapshots, start a disposable Open Field worker, then run:

```sh
node scripts/network-snapshot-scenario.mjs 4174 10
```

For Dense Clash, start the worker with `RTS_MAP=maps/dense-clash.json` and
`RTS_SEPARATION_DIAGNOSTICS=1`, then run
`node scripts/performance-scenario.mjs 4174 10 3 dense-clash`.

The optional game-dev adapter in `.game-dev/adapter.json` defines sealed scenarios
such as `checkpoint-move-2000` and `checkpoint-attack-move-2000`. Those profiles
use three 12-second windows, 33.333 ms p95 tick/start-lag budgets, and 100 ms
single-tick/start-lag/planning-stage ceilings. Preserve the run bundle when
comparing results. The [dated baseline](performance-reliability-baseline-2026-09-25.md)
includes reproduction commands and known limitations.

## Report the result

Main menu regressions: `node --test scripts/game-entry.test.mjs scripts/game-navigation.test.mjs`
and `node scripts/game-menu-scenario.mjs` check the [entry contract](game-entry.md),
fresh/stale profiles, explicit session validation, room isolation, both-seat
authority, navigation and packaged lazy client imports. The [dated evidence and
Mac recipe](qa-game-entry-2026-10-03.md) separates local proof from native staging QA.

Pregame regressions: `node --test scripts/room-pregame.test.mjs scripts/room-lobby-ui.test.mjs scripts/room-launch-options.test.mjs`
and `node scripts/room-pregame-scenario.mjs` cover the [lobby contract](room-lobby.md),
including both-client authority, paused scenarios, launch races and seat/phase
recovery. Existing supervisor/PvE/expiry scenarios remain the legacy-flow checks.

Chat regressions are in `scripts/room-lobby-chat.test.mjs`,
`scripts/room-lobby-chat-ui.test.mjs` and `scripts/room-lobby-chat-scenario.mjs`.

Separate logic, protocol, browser appearance, local performance, deployed
behavior, and human comprehension. A pass in one category does not establish
another. Keep raw measurements with their build; put current instructions here
and dated evidence in the [archive](archive/README.md).

Scenario authoring regressions: `node --test scripts/scenario-authoring.test.mjs`
checks bounded history/gestures and completion registry semantics;
`node scripts/completion-event-scenario.mjs` checks both-seat activation, initial
completed state, technology grants, pending restart, exact rewards, rematch,
and host-only diagnostics. `node scripts/progression-scenario.mjs` also observes
completion conditions during paid construction and research.
`node scripts/map-studio-draft-scenario.mjs` runs isolated headless Chrome for
region gestures, name/delete, undo/redo, typed conditions, local recovery and
JSON export/import. These are scripted checks, not unassisted human evidence.


Regional map/elevation regressions: `node scripts/terrain-authoring-scenario.mjs`,
`node scripts/vaelora-map-layout-scenario.mjs`,
`node scripts/regional-ambience-scenario.mjs`, and
`node scripts/regional-objective-scenario.mjs bellweather-millrace` (repeat with
`underbough-rootways`). The objective scenarios use the authored opening and each
seat in turn; they prove routes, holds and rematches, not contested match balance.
