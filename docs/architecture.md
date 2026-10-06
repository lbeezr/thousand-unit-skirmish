# Architecture

[Documentation index](README.md) · [Testing](testing.md)

## Runtime

The browser sends orders over a WebSocket. The room supervisor routes each room
to its own Node process. That worker validates commands, advances the simulation,
and sends visibility-filtered state back to each seat.

```text
Browser: index.html + style.css + src/main.js
                 │ HTTP / WebSocket
       room-supervisor.mjs
                 │ loopback routing
          server.mjs per room
                 │
       checkpoints and custom maps
```

The simulation targets 30 Hz and ordinarily sends snapshots every three ticks
(10 Hz). The browser smooths visual motion between snapshots. During overload,
the scheduler skips elapsed wall-clock slots and advances one simulation step
per callback; see [simulation timing](simulation-timing.md).

The server owns movement, collision, combat, resources, production, objectives,
visibility, and match results. The browser owns selection, camera, HUD, audio,
and visual interpolation. A renderer fallback cannot change gameplay occupancy
or reveal hidden state.

## Module dependencies and gradual organization

`npm run architecture:check` parses imports, re-exports and literal lazy imports
with Acorn; it does not execute game modules. At source revision `32f11d5`
(3 October 2026), the graph contains 141 `src` modules plus five root JavaScript
modules, 253 distinct local dependency edges, 105 modules reachable from the
five shipped browser entrypoints and 53 reachable from the two Node hosts.
Twenty-four modules are shared by those closures. The command prints the exact
shared set so a refactor can check its actual consumers.

The pinned audit at `53a47ee379660f30b65776ea813f3a986d29aa37`
(4 October 2026) contains **168 `src` JavaScript modules**, of which **164 are
flat and four are nested**, plus the same five root JavaScript modules.
There are **317 distinct local edges, 118 browser-reachable modules,
73 server-reachable modules and 31 shared modules**. Static imports, re-exports
and literal lazy imports are included; tests/tools are outside this runtime
graph. The nested modules are the two WebSocket leaves under `networking/` and
the offline proposal adapter/client-path manifest under `server/`. These are
the first boundaries, not the completed organization.

Refresh against main `8200ec6c` after the wood-job continuation merge
[PR283](https://github.com/lbeezr/thousand-unit-skirmish/pull/283): two more flat
modules, `gather-work-area` and `work-intent`, belong to authoritative economy/work
state. That graph contains 175 runtime modules (170 `src`, 166 flat), 319 local
edges, 118 browser-reachable, 75 server-reachable and 31 shared modules; zero
cycles remains the baseline. Historical size/coupling measurements below stay
pinned to their stated revision.

There are **no cyclic edges** at either audited revision, including lazy imports.
[`runtime-import-baseline.json`](../scripts/fixtures/runtime-import-baseline.json)
records this explicit empty baseline. The checker compares every cyclic edge,
including self-imports and new edges within an existing cyclic component.
New edges fail; resolved entries must be removed from the baseline. Do not
regenerate the ledger to admit a new cycle or add wildcard/module exemptions.

The useful target domains are responsibilities first; these directory names
are destinations for future small, cohesive moves, not a rename plan:

| Domain | Existing evidence | Dependency direction |
| --- | --- | --- |
| `src/rules/` | `gameplay-definitions`, `gameplay-action-rules`, `production-actions`, `research-actions`, `base-lifecycle`, `economy-profile`, `economy-ledger`, `population`, `combat-rules`, `palisade-profile`, `farm-harvest`, `bannerfall-rules` | Intentionally shared pure definitions and policy calculations. Simulation, AI, authoring and disclosed client choices consume them; no DOM, Three, timers, sockets, storage or host imports. Keep stable content IDs, revision hashing, reason ordering and value semantics. High fan-in is expected for the validated registry. |
| `src/world/` | `elevation`, `map-size-policy`, `town-center-spawn`, `water-contours`, `water-route-graph`, `shore-fishing-placement`, `dock-placement`, `world/scenario-event-chain`, `world/capture-prerequisites`, portable parts of `map-utils`/`scenario-regions` | Portable topology, map metadata, placement and scenario validation; no editor controls or presentation singleton state. Scenario-event and capture-prerequisite validation have separate pure leaves; `map-utils` retains topology/elevation and both pairs of named forwarding exports. Prerequisite ownership is enforced by the authoritative caller, not by topology or editor state. `terrain-height` uses an active-terrain singleton and remains presentation, not authoritative height. |
| `src/simulation/` by domain | `formation-assignment`, `unit-movement`, `unit-obstacle-detour`, `unit-path-line`; `wall-build-order`, `wall-construction-draft`; `skiff-fishing`, `skiff-waypoints`, `skiff-group-orders`, `water-unit-runtime`; `wildlife-claims`, `wildlife-state`, `wildlife-motion`, `wildlife-heading`, `wildlife-herding`; `combat-stance`, `snapshot-private-production` | Authoritative movement/orders, economy/construction, combat, wildlife/water execution and visibility projection. Own match state and accepted-tick mutations; consume rules/world/contracts. Do not import client, authoring controls, Three or transport. Browser-safe pure wildlife validation/math may be shared deliberately; authority belongs to the caller, not its folder name. |
| `src/simulation/ai/` | `pve-opponent`, `pve-production`, `pve-reconnaissance`, `pve-home-defense`, `pve-regroup`, `pve-skirmish-targets`, `pve-objective-rotation` | Seeded policy consumes its existing filtered observation and emits ordinary commands. Observation projection and policy are separate future seams within `pve-opponent`; neither may read hidden state or a Node transport. The offline model adapter stays server-private. |
| `src/presentation/` with `rendering/` and `assets/` | `environment-art`, `building-sprites`, `captured-building-art`, `unit-sprite-runtime`, `neutral-wildlife-renderer`, `water-surface-geometry`; `*visual-state`, `unit-lod-state`, `gameplay-presentation`, `worker-work-presentation`, `worker-fishing-presentation`, plant-pack descriptors and atlas runtimes | Render disclosed state, select actual art, load/verify textures and manage batches, LOD and disposal. Keep pure state-to-art mapping separate from Three/resource ownership. No authoritative damage, occupancy, rewards or work grants depend on animation. Asset URLs/hashes, approved character identity and fallback paths remain stable. |
| `src/client/` with `input/`, `hud/`, `lobby/` and `audio/` | `game-entry`, `game-entry-session`; `camera-controls`, `unit-selection`, `battlefield-cursor`, `wall-placement`; `hud-layout`, `selection-context`, `selection-portrait`, `objective-summary`, `population-readout`, `resource-format`; `room-lobby-ui`, `room-lobby-chat-ui`, `room-presence`, `match-mode-controls`; `audio`, its policy/loader/cache/composer/library modules | DOM/input, client selection, order sending, HUD, lobby and Web Audio/storage lifecycle. Compose portable rules/world/contracts and presentation through explicit parameters/callbacks; lower domains never import `main.js`. `resource-format` is UI text even though placement also consumes it. No formatters enter authoritative error/validation policy by accident. |
| `src/authoring/` | `scenario-authoring`, `terrain-authoring`, `resource-brush-authoring`, `resource-brush-controls`, `map-studio-viewport`, `map-resize`, `landscape-authoring`, `settlement-authoring`, `resource-cluster-authoring` | Draft edits, bounded history, gestures, brush transactions, generation and import/export. Pure generators may run in tools/browser; editor controls cannot enter simulation. Shared format validation goes in world/rules, not in a browser editor. Editor changes cannot mutate a running match until the existing publish command is accepted. |
| `src/networking/protocol/` | Existing command/observation contract, Worker action version/vocabulary, public row/disclosure shapes, map audio reference shape | Only deliberately shared pure contracts/encoders/decoders; preserve existing JSON keys, positional rows, optional-field defaults, generations and visibility. There is no standalone general protocol module today. `worker-performing-action` combines vocabulary with an authoritative transient journal; do not move the journal here merely because both closures reach that file. `wildlife-client-state` is also consumed by AI: its pure disclosed-row reader must stay portable if client selection is later separated. |
| `src/server/transport/`, persistence and orchestration | `networking/websocket-frame`, `networking/websocket-deflate-offer`; `server/pve-model-proposal`, `server/client-asset-paths`, `room-launch-options`; root `origin-policy`, `simulation-scheduler`; peer/checkpoint/static-serving sections in `server` and lifecycle/routing sections in `room-supervisor` | Node Buffer framing, negotiation, socket queues, origin/access policy, persistence and worker/scheduler adapters. Pure negotiation still belongs to server transport, not the public gameplay protocol. Hosts wire these to simulation; simulation never imports them. Root process entrypoints and existing startup commands stay stable. No broader HTTP admission or security-policy change. |
| Tests, scenarios and tools | Existing `scripts/*.test.mjs`, `*-fixture.mjs`, `*-scenario.mjs`, native/browser runners, author/build/validate/release tools | One-way consumers of runtime. Group by purpose/domain as described below, preserve current commands while migrating, and keep telemetry/evidence outside executable fixtures. No general `utils/` or `shared/` drawer and no all-domain barrel. |

These directions guide extraction. The executable import safeguards begin with
package and runtime reachability:
runtime imports must resolve to exact relative runtime modules, Node builtins
or the mapped `three` package. All `src` modules stay within `src`; only the
declared Node adapters may import Node builtins. The existing server-only
`networking/websocket-frame` seam owns Node Buffer encoding, so its owner can
test wire bytes independently of HTTP/gameplay orchestration. Browser closures cannot reach a
Node adapter or unmapped package, and server closures cannot reach Three or a
browser entrypoint. Package imports must match every consuming page's import
map; the audio pages have no Three mapping. A contract test checks the five
registered entrypoints against their shipped HTML. Register a new entrypoint
and its document's package policy together. This checks import edges, not browser globals, injected
callbacks, runtime asset fetches or gameplay semantics. It also scans unreferenced
`src` modules and nested folders, so new files cannot evade the cycle check.

The first domain ratchet declares the responsibilities of every current runtime
module in `RUNTIME_DOMAINS`/`RUNTIME_DOMAIN_HOSTS`, without moving those files.
New runtime files must receive reviewed membership; stale or duplicate entries
fail the existing checks. Rules may reach rules; world may also reach world;
simulation and portable disclosed projections may additionally reach each other;
AI may consume those domains and its own policy helpers. Every protected module
is checked even when no host imports it. Static, re-export and literal lazy paths
are followed transitively, so a middle helper cannot hide a backwards edge or
Node/Three dependency. Server host closures reject known UI, editor and rendering
dependencies; browser closures reject all declared private server files, including
the package-free client manifest and deflate negotiation helper.

Current memberships reflect current responsibilities: `wildlife-client-state`
is a portable disclosed reader, `worker-fishing-presentation` a portable projection,
and the Worker receipt journal belongs to simulation. `camera-controls` is
currently pure camera/projection math consumed by rendering, not a DOM input
adapter. [PR298](https://github.com/lbeezr/thousand-unit-skirmish/pull/298) separates
`validateMapAudioReference` into the portable `world/map-audio-reference` leaf.
`audio-event-profile` retains playback policy and the named compatibility export;
existing hosts keep that import, while new lower-domain consumers use the world
validator. Lower domains cannot acquire the playback profile.
These classifications do not prove absence of DOM/storage globals, injected
callbacks, hidden-state misuse or lifetime errors; those still need owner review
and consumer contracts. The existing audit JSON keys and empty cycle ledger stay
stable. Packed local HTTP checks require all declared private host/transport files
and compatibility entries to exist while authenticated GET and HEAD return 404.

Acceptance is safer parallel ownership, not folder count or reduced line count.
A shared-rule owner can change a helper's internals and focused contracts while
the world owner changes topology and the presentation owner consumes disclosed
state, provided their exported signatures and value semantics remain stable.
Those changes need no edits to `main.js` or `server.mjs`; host edits belong to
actual orchestration/interface changes. The source graph protects this first
boundary by refusing imports back into hosts, tools, browser boot or Three from
authoritative rule closures. Check consumer regressions before claiming a stable
interface. The original guard slice registered its two checks in CI. The
4 October plan was integrated in [PR291](https://github.com/lbeezr/thousand-unit-skirmish/pull/291);
the subsequent domain ratchet in [PR294](https://github.com/lbeezr/thousand-unit-skirmish/pull/294)
uses the existing checks, with no package/CI change.

For future combat extractions, keep durable player orders/queues, stance policy,
transient engagement, movement execution and disclosed visual events as distinct
contracts. The pinned [OpenRA attack-move activity](https://github.com/OpenRA/OpenRA/blob/b6fc03fcfaef1277592bbd4cbc7d44dd85219902/OpenRA.Mods.Common/Activities/Move/AttackMoveActivity.cs)
retains a movement factory while a temporary attack runs, then resumes movement.
This supports a review question: does target invalidation preserve the parent
goal and queue, while Stop still cancels authoritative work? These are future
extraction criteria; the import check proves dependency edges only.

Simulation acceptance should use accepted-tick commands and recorded seeds/map
content, independently of render callbacks or network arrival timing. The pinned
[Recoil synchronization test guidance](https://github.com/beyond-all-reason/RecoilEngine/blob/cce3f7cba839217ae2edebf94cc07a44497d1a13/test/synctest/README.md)
uses fixed seeds/content and explains how wall-clock-derived UI order timing can
break reproducibility. Preserve the repository's
[`stationary-command`](../scripts/stationary-command.test.mjs),
[`attack-target-geometry`](../scripts/attack-target-geometry.test.mjs) and
[`pathing-replay`](../scripts/pathing-replay.test.mjs) contracts when their owners
extract those responsibilities. Presentation consumes authoritative state/events;
clip completion cannot create damage or cancel gameplay. These criteria use
source studies to define testable boundaries; no upstream implementation is copied.

The browser uses native ESM without a bundler. `index.html`, the environment
review and water study map `three` to `/vendor/three.module.js`; the server serves
that module and `three.core.js` from the installed package. `server.mjs` admits
client module paths explicitly. Docker copies `src/` recursively, while the
release packer audits Docker COPY inputs and `.dockerignore`. Passing the source
graph check therefore does not prove HTTP admission or release inclusion:
retain the [served and packed import checks](testing.md#repository-checks).
Acorn is a pinned development dependency; production installs omit it.
`src/server/client-asset-paths.mjs` owns the immutable exact client-path list and
separate renderer-module path. A client-module owner updates that small manifest
instead of the HTTP host. The host retains membership/equality checks and all
authorization, decoding, normalization, MIME and non-client asset rules. The
source allowlist and packed import audit cover all five registered browser
entrypoints; real packed HTTP tests check every declared path and denied paths,
including the manifest itself and offline Node adapters.
The source and served audits share [`module-imports.mjs`](../scripts/module-imports.mjs)
for static imports, re-exports and literal lazy imports. Comments/string/regular
expression text cannot create edges; compact syntax and escaped specifiers must
still expose dependencies. Computed imports fail with the owning path. Filesystem
and served-URL resolution remain separate policies, including origin, credentials,
MIME and the served Three alias. Runtime asset requests remain outside this audit.
Lazy imports must use the mapped `three` alias, a relative/rooted path or an
absolute same-origin URL; an unmapped bare package cannot masquerade as a served
relative file. The source HTTP-allowlist scenario uses the same parser, including
its comment/escape/computed-import handling.

The first runtime folder move places the offline model-proposal adapter in
`src/server/pve-model-proposal.mjs`, depending on the portable `pve-opponent`
policy/observation helper. Its sole scenario consumer uses that canonical path.
The old `src/pve-model-proposal.mjs` forwards only the four existing named
exports with identical bindings; its removal owner/criteria live in the
[research guide](model-controlled-opponent-research.md#boundary). This allocated
scope changes no browser or HTTP-host code. Both paths are declared Node adapters,
rejected by every browser entrypoint and remain HTTP 404 even though Docker's
recursive `src` copy includes them for offline use. Fake-provider policy and
ordinary WebSocket command-path regressions retain the adapter's behavior.
Keep active room-launch/game-mode and gameplay hot spots out of this migration.
For a served module, update
HTTP admission, imports and release tests together; preserve an existing public
path only with a deliberate compatibility module forwarding the required named
exports, a named removal owner and a removal condition. Avoid broad barrels.
This offline source/API milestone changes no hosted runtime binding. Producer
release/deployment ownership remains explicit; source and packed-release checks
do not claim a gameplay or visual change.

### Continuing boundary workstream

Goal: preserve stable exported contracts and reduce shared-host edits so rules,
world, UI/presentation and tooling owners can work safely in parallel. The
boundary owner retains each slice through reviewed integration and its actual
source/tool acceptance. Use the [continuing-work guidance](contributor-planning.md#continuing-workstream-bounded-pr)
for checkpoints and real stop conditions.

Completed tooling outcomes: the source boundary/cycle ratchet and shared
source/served parser. The served audit now ignores commented imports and detects
compact missing dependencies. Its arguments/results and the source checker's
`moduleImports` import path remain stable; regression fixtures, source graph and
real served/packed release checks cover the change.
The review follow-up rejects unmapped bare lazy packages before dependency fetch
and removes duplicated import-regex parsing from the source allowlist scenario.
The first allocated folder move gives the offline Node adapter a canonical
`src/server` home while preserving its original API and client-serving boundary.
The allocated client-admission extraction moves its exact path data into the
server-domain manifest and removes source tests' dependence on the host's literal
array shape. No admission entry or other serving rule changes. All five browser
closures now receive source and served-package admission checks.

The earlier statement that this bounded backlog had no remaining migration
described completion of those allocated leaves, not a completed repository
architecture. The 4 October audit below replaces that stopping point with a
broader staged queue. [Code extraction](code-extraction-backlog.md) still owns
its narrow completed behavior contracts and retained runtime acceptance;
[testing strategy](testing-strategy.md) owns test/type strategy and
[testing](testing.md) owns the command catalog. Keep these existing records,
not a second competing extraction/testing roadmap. The
[planning inventory](README.md#planning-inventory--4-october-2026) identifies
the other canonical queues and their evidence gaps.

### Current coupling and mixed responsibilities

Counts below use physical lines (including comments/blank lines) and distinct
direct local runtime imports/importers, from the existing Acorn graph. They
exclude Node/Three package edges and test/tool imports; zero fan-in for a host
does not mean it is easy to change.

| File at `53a47ee3` | Lines | Local fan-out / fan-in | Actual extraction pressure |
| --- | ---: | ---: | --- |
| `src/main.js` | 10,625 | 61 / 1 | Rendering/building factories, unit buffers/interpolation, socket receipt/reconciliation, input/orders, HUD and Map Studio all share module state. `buildMap` is 350 lines, `validateImportedMap` 298, `connectSocket` 244, `updateEconomyUI` 229 and `applyState` 214. Splitting by arbitrary line ranges would preserve the coupling. |
| `server.mjs` | 8,911 | 57 / 0 | Map validation, entity/path state, command authority, simulation, fog/public/private snapshots, peer transport, checkpoint validation/migration and HTTP. `validateMatchCheckpoint` is 480 lines, scenario evaluation 367, tick execution 328, map validation 313 and `createPeer` 236. These functions also read shared state. |
| `src/environment-art.mjs` | 1,275 | 24 / 1 | Verified loading, texture/material registries, ground/forest/vegetation batches and resource-state fallback in one renderer module. Verification can be isolated before texture ownership or batching. |
| `src/pve-opponent.mjs` | 940 | 10 / 2 | Visibility decoding, disclosed observation projection and deterministic policy/socket-player adapter. Preserve filtered inputs and recorded policy traces when separating those seams. |
| `room-supervisor.mjs` | 760 | 5 / 0 | Persistent room index, worker lifecycle, room HTTP and upgrade proxying. Keep process startup/environment/path semantics stable before separating storage/lifecycle. |
| `src/audio.mjs` | 734 | 4 / 3 | Synthesis, sampled cue/music scheduling, bus settings, interruption and disposal. Existing cache and bounded reader are useful independent seams; avoid reopening the audio lifecycle while organizing them. |
| `src/gameplay-definitions.mjs` | 239 | 2 / 23 | Highest runtime fan-in; intentional validated registry. Move late, with all consumers and revision parity, rather than split a cohesive definition solely to lower the number. |
| `src/match-modes.mjs`, `src/map-utils.mjs` | 132 / 267 | 1 / 10 and 1 / 8 | Mode identity is deliberately shared and active; map helpers mix topology with event DAG checks. Separate responsibilities before migrating their many consumers. |

The 31-module shared closure includes audio reference validation, wildlife
disclosure, Worker action receipts and terrain material metadata. Thus filenames
such as `*-client-state` and `audio-*` are not sufficient classifiers.
The import guard checks domain direction, explicit private/Node adapters and
Three/package reachability;
it does **not** detect DOM/storage globals in an otherwise package-free module,
state sharing through callbacks, or hidden-data misuse. Owner review and
behavioral contracts must cover those additional boundaries.

There are 665 tracked files under `scripts/`, 649 directly in that folder:
227 `*.test.mjs` files and 199 filenames containing `scenario` (descriptive
counts, not the number of CI jobs or independent scenarios). A literal source
path search over tracked JS/MJS scripts finds 68 mentioning `src/main.js` and
161 mentioning `server.mjs`; these include launches and ordinary references,
not just source slicing. Actual VM/source-slice fixtures include
`unit-presentation-client-fixture`, `economy-server-fixture`,
`pathing-replay-fixture`, `construction-client-fixture` and
`wildlife-client-controls-fixture`. An extraction must replace only its affected
slice with the real exported implementation, retaining the same independent
assertions; do not rename tests or rebuild unrelated fixtures to make a move pass.

### Stages, ownership and stable entrypoints

1. **Ratchet responsibilities before paths.** Extend the existing guard through
   its owner with explicit domain memberships for current files, negative
   boundary fixtures and private HTTP-path assertions. Record baseline fan-in,
   fan-out, host responsibilities and fixture dependence. Review this plan and
   route exact write scopes through the parent before any runtime migration.
2. **Admit small canonical modules.** Use the eight candidates below to establish
   useful rule/world/simulation/UI/authoring/asset boundaries. Existing host
   imports can stay on explicit compatibility entries during active feature
   work. New work uses canonical paths. A move earns acceptance by an enforced
   dependency/API/ownership boundary, not by increasing folder count.
3. **Extract host responsibilities one at a time.** Agree state inputs, mutations,
   return values, lifetime and accepted-tick behavior first. Server candidates
   are map validation, private snapshot projection, checkpoint validation vs
   migration vs atomic I/O, and peer transport. Client candidates are Map Studio
   draft/form storage, HUD projection, socket session/message handling and
   renderer runtimes. Preserve a thin host call site and the real consumer
   regression in each PR. No single `simulation.mjs`/`renderer.mjs` replacement
   monolith, context object containing all host state, or ECS/framework rewrite.
4. **Retire aliases and organize tools by use.** Convert known consumers when
   their owners are free, remove verified-unused shims, then migrate matching
   fixtures/scenarios without changing workloads or measurement conditions.
   Keep the planning/status record here and in each existing owning queue.

`room-supervisor.mjs` and `server.mjs` remain the Node launch entrypoints;
`src/game-entry.mjs` and the other four registered browser entrypoints remain
the shipped HTML entries. Keep `src/main.js` as the lazy browser composition
entry while extracting its responsibilities. Preserve the established exports
of `src/environment-art.mjs`, the existing public helper paths when required,
and `scripts/check-runtime-imports.mjs`'s `moduleImports` compatibility export.
Do not introduce an `index.mjs` barrel as a substitute for those APIs.

Compatibility entries forward only their existing named exports, with binding
identity and no duplicate cache, singleton or side effect. Name the migration
owner, canonical path, known remaining consumers and removal condition in the PR.
Remove an entry when tracked runtime/tools/tests/docs use the canonical path,
the affected owner confirms no supported external command/import needs it,
and source/served/packed checks pass without it. For browser paths, confirm the
containing identified release and retain the current no-store behavior; a Git
search alone does not establish that a user page can reload safely. Do not give
a server-private shim HTTP admission. The existing offline proposal shim keeps
its [specific removal criteria](model-controlled-opponent-research.md#boundary).

The current runtime, mode, movement, Worker job/animation, HUD and art owners
retain their files. In particular, [resource continuation PR283](https://github.com/lbeezr/thousand-unit-skirmish/pull/283)
and the animation diagnostic [PR287](https://github.com/lbeezr/thousand-unit-skirmish/pull/287)
(merged during this audit) make `server.mjs`, `main.js`, worker receipts and presentation fixtures active
coordination surfaces. The testing-strategy owner retains
`AGENTS.md`, testing-strategy docs, package and CI edits. This plan's write scope
was `docs/architecture.md` and the inventory in `docs/README.md`; that planning
slice reserved no runtime file. Subsequent slices below name their executing
role and exact scope. Follow the [continuing-work and integration rules](contributor-planning.md#continuing-workstream-bounded-pr)
for author-owned normal merges under standing authorization; resolve concrete
overlap with its owner. Review/coordination does not grant independent
deployment, spend, security changes or release of an art-direction hold.
The testing-strategy documentation merged as `70e7c813` during this audit;
future rendered acceptance uses its supported cloud capability path. Mac
execution and canceled deployments stay stopped. Local packed checks do not
restart either operation.

### Versioned feature contracts

The 5 October 2026 inventory at `b5b4dd49` finds **118 filenames containing v1**:
41 assets, 70 documentation/art files, four schemas and three construction scripts;
none are runtime source filenames. Across all numbered `v` filename tokens there
are 239 matches, including 51 audio `v001` take names. These lexical counts are
an inventory, not a mandate to rename content. Existing versioned asset directories,
public URLs, manifest IDs/hashes, schema `$id`/`$ref` values, historical evidence and
copied provenance are supported contracts with their own consumers.

Use `feature/v1/` for an implementation or format contract actually pinned to that
version. Keep stable feature entrypoints as explicit named adapters when required;
do not add an unused v2 directory, a `latest` barrel or version every helper merely
because its input contains a version field. Unversioned storage/transport/lifecycle
coordination stays outside the pinned format implementation. Introduce another
version only with its real reader/writer and explicit compatibility decision.

| Feature / staged next action | Actual files and consumers | Boundary and evidence before migration |
| --- | --- | --- |
| Map Studio draft — integration tracked in [PR451](https://github.com/lbeezr/thousand-unit-skirmish/pull/451), architecture/authoring owner | Existing `src/authoring/map-studio-draft-store.mjs` pins draft format 1. Its version constant and recovery preflight live in `src/authoring/map-studio/draft/v1/contract.mjs`; the store retains its two named exports and five-method API. Main, `scripts/fixtures/map-studio-draft-fixture.mjs`, registered brush controls and XL audits keep their existing entrypaths. | Pure format validation separates from deferred WebStorage access; byte-preserved body/error/16–256 limits, raw reads/key/save bytes and per-store methods. Existing host recovery/close/cancel/portable-map cases, canonical/old API controls, import-domain negatives, exact public paths and clean packed HTTP establish the source milestone. No host, asset, building, movement or renderer edits. |
| Sprite-atlas format — proposal after renderer/asset owner agreement | `schemas/sprite-atlas-pack-v1.schema.json` and `schemas/sprite-atlas-capture-v1.schema.json`; `scripts/sprite-atlas-contract.mjs`, sprite capture/provenance and `docs/sprite-atlas-contract-v1.md` consumers. Proposed canonical grouping: `schemas/sprite-atlas/v1/pack.schema.json` and `capture.schema.json`. | Decide supported old filesystem and schema identities before moving the pair. The relative capture `$ref`, validator resolution, old command behavior and actual capture tests must remain valid. No JSON forwarding format or duplicated canonical schemas are introduced speculatively. Outside this lane's current write scope. |
| Renderer asset-pack / painted-material format — proposal with owning validators | `schemas/renderer-asset-pack-v1.schema.json`, `schemas/painted-material-atlas-v1.schema.json`; `scripts/validate-visual-pack.mjs`, `scripts/visual-pack-path-safety-scenario.mjs`, `scripts/painted-material-atlas-contract.mjs` and linked guides. Proposed separate feature homes: `schemas/renderer-asset-pack/v1/` and `schemas/painted-material-atlas/v1/`. | Preserve schema IDs, contract bytes, isolated CLI/path-safety fixtures and supported commands. Separate schema organization from runtime texture/asset loading, pack IDs and art changes. Active renderer ownership is a dependency; no move here. |
| Construction generators — deferred to building/asset owners | `scripts/build_archery_range_construction_v1.py`, `scripts/build_barracks_construction_v1.py`, `scripts/pack-archery-range-construction-v1.py`. The builders copy their own scripts into output `source/` and embed generator paths. | A future `scripts/buildings/<feature>/v1/` move needs an agreed root command and identical generated paths/provenance/output. It does not authorize changing existing asset-pack directories or active construction/renderer work. No generator or registry edits here. |
| Historical content and audio take names — preserve current identities | The 41 asset and 70 documentation/art v1 filenames include published pack paths, snapshots, sources and contracts; `v001` audio names identify takes. | No automatic move. An actual feature owner first inventories runtime URLs, manifest/hash/provenance and historical links. Source organization can improve without rewriting those supported identities. |

Testing-strategy, package, CI and workflow ownership stays with the existing
command/testing lane. [PR463](https://github.com/lbeezr/thousand-unit-skirmish/pull/463)
integrates the real portable-map validator at `src/authoring/map-import-validator.mjs`,
with the existing policy inputs, pure helpers and unchanged import/export/publish
callers. Its source milestone is recorded at `c3725def`; rendered browser acceptance
remains incomplete. The next world responsibility below separates the existing
scenario-event dependency contract from map topology without moving its callers.

### First eight migration PR candidates

PR1 is the common prerequisite. PR2–PR7 have distinct canonical source scopes;
their existing-module imports can stay behind explicit shims so `main.js` and
`server.mjs` need no path-only churn. The manifest, guard membership and any
type/coverage/CI registries are shared integration files: apply those deltas
serially through their owners, not concurrent edits disguised as disjoint work.
PR8 waits for the asset/renderer owner's agreed lifetime interface.

| PR / owner and dependency | Exact candidate source scope and resulting boundary | Focused acceptance beyond the common checks below |
| --- | --- | --- |
| 1 — architecture/import owner; plan reviewed in PR291 | [PR294](https://github.com/lbeezr/thousand-unit-skirmish/pull/294): `scripts/check-runtime-imports.mjs`, `scripts/check-runtime-imports.test.mjs` and the existing `scripts/railway-release-scenario.mjs` private-path assertions; `scripts/fixtures/runtime-import-baseline.json` stays unchanged and empty. Explicit current responsibility memberships reject backwards edges before files move. The PR records exact-head review, checks and integration. | Import/served regressions: 41/41 pass; actual source allowlist: 118 modules; unchanged 175-module/319-edge/zero-cycle graph. Negative simulation→client/editor/presentation, rules/world direction, transitive host-package and browser→private-module cases pass. Pure disclosed helpers used by AI/server remain intentionally shared; new files need a classification. Clean pack and actual packed HTTP private GET/HEAD denial pass. No new package/CI pipeline, wildcard exception or cycle-baseline reset. |
| 2 — world/metadata owner after PR1 and audio-owner agreement | Extract only `validateMapAudioReference` from `src/audio-event-profile.mjs` into proposed `src/world/map-audio-reference.mjs`; retain its named re-export at the old path. Leave random binding choice/cooldown behavior in the audio module. Its shared reference validation can no longer acquire Web Audio/storage dependencies. | Existing audio runtime/map-persistence/shipped-serving scenarios and new exact old/new validator parity for accepted/rejected references, optional version/hash pair, returned keys and error text. Existing host imports can stay stable. No source audio bytes, map reference or playback change. |
| 3 — shared-rule/extraction owner after PR1 | `src/gameplay-action-rules.mjs` and `src/base-lifecycle.mjs` → proposed `src/rules/` counterparts; explicit named compatibility entries retain the old API. Update only relative dependencies of the canonical copies. The cohesive action/refund calculations remain portable and independent of UI/hosts. | `scripts/gameplay-action-rules.test.mjs`, `scripts/base-lifecycle.test.mjs`, production/research action tests and `scripts/base-lifecycle-scenario.mjs`. Preserve rejection reason order, epsilon, refund/repair rounding, immutable inputs, payment and cold recovery; preserve existing comparison evidence. |
| 4 — movement owner after PR1 and current path work | `src/formation-assignment.mjs` → proposed `src/simulation/movement/formation-assignment.mjs`, named old-path forwarding entry. No changes to `unit-path-line`, planner budgets, force combination, command queues or server host imports. Establish the authoritative formation-helper home without moving active path/order implementations. | `scripts/formation-assignment-scenario.mjs`, pathing replay and fortified-site-clearance tests; compare ordered IDs/slot pairing/ties for the same inputs and retain no input mutation. Existing real terrain/paid-construction controls remain meaningful. |
| 5 — HUD owner after PR1 and selection-fix coordination | `src/resource-format.mjs`, `src/population-readout.mjs`, `src/objective-summary.mjs` → proposed `src/client/hud/` counterparts with named forwarding entries. Keep state projection/text separate from DOM layout, authoritative accounting and rendering. `hud-layout`, `main.js`, selection/stance hooks and HTML stay outside this slice. | Their three matching tests, `scripts/selection-context.test.mjs` and relevant contextual HUD regressions. Preserve all labels/formatting, unknown/hidden/enemy values, population totals, notice retention/order and disclosed objective state. Existing `selection-portrait`/`wall-placement` imports may use the shims until their own migration. |
| 6 — audio/extraction owner after PR1; coverage registration through testing owner | `src/audio-decoded-cache.mjs`, `src/audio-shipped-response.mjs` → proposed `src/client/audio/` counterparts with named forwarding entries. Preserve cache and bounded-response interfaces; `audio.mjs`, loader/profile behavior and all recordings stay stable. | `scripts/audio-decoded-cache.test.mjs`, `scripts/audio-shared-decode.test.mjs`, `scripts/audio-shipped-response.test.mjs`, shipped-loader/lifecycle tests and serving scenario. Exact reader limits/errors/cancellation, shared object identity, LRU accounting/retry and independent bus interruption. Keep the existing 100% reader coverage pointed at the canonical implementation, not the shim; no test renaming. |
| 7 — map-authoring owner; [PR300](https://github.com/lbeezr/thousand-unit-skirmish/pull/300) | `src/scenario-authoring.mjs`, `src/map-resize.mjs` → canonical `src/authoring/` counterparts with explicit named forwarding entries. Both implementations remain byte-identical to `a93c8175`; normal `main.js` imports stay stable. [Known consumers and retirement conditions](map-authoring.md#authoring-module-paths). No validators, map/default/size changes or editor-loop rewrite. `map-studio-viewport` remains a later slice without a direct viewport contract. | Existing scenario-authoring tests plus exact named-export/binding identity, canonical marker resize/publish/save/reopen, game-menu/served imports, domain negatives and packed HTTP hashes/privacy pass. The normal-sandbox cloud browser cannot start; rendered `map-studio-draft-scenario.mjs` acceptance remains incomplete with the authoring owner. Source/release/review evidence and this capability limitation are recorded in PR300. |
| 8 — environment/asset-loading owner after PR1–2 and renderer agreement | Extract only `fetchVerifiedRuntimeImage` from `src/environment-art.mjs` into proposed `src/presentation/assets/interactive-runtime-image.mjs`. Pass the existing root/loader dependencies explicitly; keep manifest selection, material registries, resource-state status, `resourceStateAssetsReady`, oak fallback and batch mutation in the old module. | Focused hash/dimension/failure/disposal contract using the actual exported helper; existing resource visual, oak depletion, environment asset and packed release scenarios. Same request paths/cache options, SHA acceptance, texture filters/dimensions/error text and exactly-once failed-texture disposal. No new source assets, default art, quality decision or capture claim. |

### Migration checkpoints and retained compatibility

| Slice | Canonical boundary / current consumers | Retirement owner and criteria |
| --- | --- | --- |
| Capture-prerequisite contract, extracted from `53951d6b` | `src/world/capture-prerequisites.mjs` preserves the exact existing `capturePrerequisiteIds` and `findInvalidCapturePrerequisite` statements (48 lines including a separator) with no imports. Map-utils retains its full ten-name API and forwards the same two bindings; main, server and the authoring validator keep their existing imports and use the canonical implementation by default. Legacy `requires`, ordered `requiresAll`, shape/duplicate/self/missing/cycle rejection and first-error order stay unchanged. The event validator remains separate. At this 2026-10-05 checkpoint, map-utils goes from 197 to 150 lines; graph 221 modules / 412 edges becomes 222 / 413, zero cycles. These values measure the responsibility split, not an absolute quality target. | Architecture/world boundary owner retains the named exports. Migrate capture-only consumers only after caller-owner agreement and an inventory of tracked/runtime/tool/test/docs and supported external uses. Remove those exports only after canonical contract coverage, source/served/packed checks and an identified containing release succeed without them; the topology/elevation module remains. Both paths are exact public modules; private host/transport GET/HEAD denial is retained. No export retirement, map/save/protocol change, crowd replay edit or host rewrite occurs here. |
| Scenario-event dependency contract, extracted from `c3725def` | `src/world/scenario-event-chain.mjs` contains the exact two adjacent functions (71 lines) formerly in `src/map-utils.mjs`: `scenarioEventSourceIds` and `findInvalidScenarioEventChain`. It has no imports and is an unversioned world responsibility. Map-utils retains all ten named exports and forwards the same two bindings. Existing main, server, authoring validator and fortified-crossing imports remain stable; the map-utils scenario exercises the canonical API and old-path identity. Topology, elevation and capture-prerequisite bodies remain in map-utils. At the 2026-10-05 extraction checkpoint against `c3725def`, map-utils goes from 267 to 197 lines; the runtime graph goes from 219 modules / 407 local edges to 220 / 408 with zero cycles. Existing hosts and validator source bytes stay unchanged. These counts track this boundary, not an absolute quality score; no generalized graph framework, map schema or save/protocol change is introduced. | World/scenario boundary owner retains the two public exports in map-utils. Event-only caller migration first inventories tracked runtime/tools/tests/docs and supported external consumers with their owners. Remove these exports only after those callers use the canonical module, canonical contract checks pass, and source plus an identified served/packed release work without them. Map-utils remains a real topology/elevation/capture module. No retirement is scheduled here. Exact canonical and old module paths remain public; private host/transport paths retain GET/HEAD denial. |
| Map audio reference, [PR298](https://github.com/lbeezr/thousand-unit-skirmish/pull/298) | `src/world/map-audio-reference.mjs` contains the byte-identical validator and has no imports. The named export in `src/audio-event-profile.mjs` preserves binding identity; at extraction, `server.mjs`, `src/main.js`, `src/audio-shipped-loader.mjs` and validator fixtures keep their old paths. The loader uses the canonical validator after [PR349](https://github.com/lbeezr/thousand-unit-skirmish/pull/349) and main after [PR370](https://github.com/lbeezr/thousand-unit-skirmish/pull/370); server and compatibility fixtures retain their entry. Playback choice/cooldown code is unchanged. Canonical and legacy paths are exact HTTP entries. Initial extraction graph at `4fcf4f42`: 176 runtime modules, 320 edges, 119 browser / 76 server / 32 shared, zero cycles. Subsequent PR295 adds an independent renderer leaf; the PR records refreshed counts. | Audio/world boundary owner retains the compatibility export. Migrate known validator consumers through their owners, check tracked and external/release consumers, then prove canonical source and an identified served/packed release before removing only the named forwarding export. The playback module itself remains. No removal is scheduled in this slice. |
| Pure action/base rules, [PR314](https://github.com/lbeezr/thousand-unit-skirmish/pull/314) | `src/rules/gameplay-action-rules.mjs` preserves all implementation bytes from `908d80f6`; `src/rules/base-lifecycle.mjs` changes only the relative import of the same definitions module. The old paths explicitly forward the same three/two named values; the action entry also preserves its two existing JSDoc type names. At extraction, production/research consume the action shim; the import-only [PR336](https://github.com/lbeezr/thousand-unit-skirmish/pull/336) checkpoint below migrates both to the canonical leaf. `server.mjs` still consumes the lifecycle shim. Both paths remain rules responsibilities. Action rules retain exact public canonical/legacy paths; lifecycle remains HTTP-private at both paths. | Rules/extraction owner retains both shims. Action consumers `production-actions` and `research-actions` use the canonical leaf after PR336; lifecycle consumers are `server.mjs`, Worker action test/scenario/probe, Skiff contracts and wall-construction fixtures. The two matching contract tests now consume canonical exports and verify old-path binding identity. Later caller migration inventories tracked runtime/tools/tests/docs and supported external consumers through their owners. Remove each shim only after that inventory and owner confirmation, canonical implementation coverage, source/served/packed checks and an identified containing release succeed without it. Keep lifecycle HTTP denial; retain action-path reload safety under existing `no-store` behavior. No shim retirement occurs in this slice. |
| Client audio helpers, [PR322](https://github.com/lbeezr/thousand-unit-skirmish/pull/322) | `src/client/audio/audio-decoded-cache.mjs` and `src/client/audio/audio-shipped-response.mjs` preserve all implementation bytes from `33b05ed1`, without imports. Each old path explicitly forwards its sole named value. At extraction, `audio.mjs` and `audio-shipped-loader.mjs` retain their existing imports; the caller batch [PR349](https://github.com/lbeezr/thousand-unit-skirmish/pull/349) below migrates both to the canonical leaves. Canonical and legacy paths remain client responsibilities and exact public HTTP entries; rules/world/simulation/AI and server hosts cannot import either path. | Audio boundary/extraction owner retains both shims. Matching cache/reader contracts exercise canonical exports and verify legacy binding identity; shared-decode/loader/lifecycle consumers exercise the original shims at extraction and the same canonical bindings after PR349. Before retirement, inventory runtime/tools/tests/docs and supported external consumers with their owners; retain canonical coverage, check source/packed/served imports without the shim, identify a containing release and confirm page reload safety under the existing `no-store` policy. Caller migration is recorded in PR349; shim removal remains a later bounded integration step; no playback, recordings, errors or cache lifetime changes are included. |
| Verified interactive image, [PR327](https://github.com/lbeezr/thousand-unit-skirmish/pull/327) | `src/presentation/assets/interactive-runtime-image.mjs` contains the exact private `fetchVerifiedRuntimeImage` body from `f73c6702`. Its sole `environment-art.mjs` call supplies the same interactive root, TextureLoader and Three constants explicitly. Existing environment exports, manifest/status/readiness, oak fallback, texture/material registries and batch updates stay in the host. The helper has no imports and one named export; its exact public module entry is separate from private hosts/adapters. | The asset-loading boundary owner owns this host call, not a new compatibility shim: the helper was private before extraction. Keep the unchanged public environment host and its orchestration/lifetime contracts. Same-fixture original/canonical checks preserve requests/cache/SHA, sampling/dimensions, failure identity and rejected-texture disposal. Renderer/resource-state/appearance acceptance remains with its existing owner; no new assets or default binding are introduced. |

Candidate 3's atomic [PR314](https://github.com/lbeezr/thousand-unit-skirmish/pull/314)
retargets the existing action-rule coverage registration to
`--test-coverage-include=src/rules/gameplay-action-rules.mjs` and the matching
canonical-path expectation in `scripts/ci-lanes.test.mjs`. The parent assigned
only those two shared CI hunks to the rules owner after the CI owner's
PR306 integrated. Every other registered check, the test command, all three
100% line/branch/function floors and lane-partition assertions are preserved.
Registered coverage must exercise the canonical implementation; coverage of a
forwarding entry cannot replace it. Other CI/workflow ownership stays unchanged.

The parent assigned candidate 6's bounded audio migration to the boundary owner
after PR314. Read-only overlap inspection found PR319's Food registration and
native label changes in `scripts/ci.mjs`, separate from the existing reader job.
The audio slice changes only its include argument to
`src/client/audio/audio-shipped-response.mjs` and the exact expectation in
`scripts/ci-lanes.test.mjs`. Every preceding registration, label, command and
100% line/branch/function floor is retained; discovery adds the two canonical
syntax checks. Refresh against main before integration to retain concurrent CI
registrations. No unrelated lane or renderer workflow changes belong here.

Step 8's shared scope is recorded with the catalog owner in
[PR326's exact coordination note](https://github.com/lbeezr/thousand-unit-skirmish/pull/326#issuecomment-5982110491).
That catalog's published scope excludes `environment-art.mjs`; its presentation
membership, manifest entries and CI job are distinct from PR327's leaf member,
single module admission and one focused registration beside the existing oak
contract. The CI owner's PR323 changes only renderer qualification files,
which this slice preserves. Refresh both sets of entries at integration. The
combined packed HEAD check asserts JSON MIME for the catalog's JSON admissions,
retaining the existing JavaScript/CSS/HTML and private-file assertions.

For each candidate, review a rename-aware diff and export list. A shim-only path
move must keep the canonical implementation byte-identical apart from import
specifiers; an extraction must compare the old function with the new export on
the same fixtures before deleting the old body. No command/snapshot/checkpoint
schema, revision, accepted tick, seed, price, order, target tie, fog projection,
art default, cache lifetime or error policy may change. Do not approve a move
by removing an assertion, resetting an expected result or broadly renaming tests.
A semantic change gets a separate owner-reviewed feature/fix PR.

All runtime candidates first inspect `node scripts/ci.mjs --list` under the
current strategy, then retain `npm run architecture:check`,
`node --test scripts/check-runtime-imports.test.mjs scripts/check-client-imports.test.mjs`,
`node scripts/client-asset-allowlist-scenario.mjs`, docs/whitespace and the
relevant existing type projects/coverage contracts. Served candidates add exact
canonical/shim entries in `src/server/client-asset-paths.mjs`, and run
`node scripts/railway-release-scenario.mjs` against the actual packed local
HTTP host plus `npm run release:pack` from a clean committed checkout.
Every declared client path must GET/HEAD with the existing MIME/headers, and all
five browser entry closures must resolve. Assert authenticated GET/HEAD **404**
for every new private simulation/Node/transport path and private shim, as well
as the existing manifest/offline adapters. Files being copied by Docker's
recursive `src` COPY does not make them public. Do not replace exact admission
with a folder-prefix rule. Keep current auth/origin/path-normalization behavior.
Private candidates retain socket/command/recovery smoke; their helper's focused
tests do not replace a real consumer check. Run required repository checks under
the testing owner's current strategy; this plan does not change that registry.

The reviewed plan is integrated, with PR1's guard/check milestone recorded in
PR294; PR298 records the first canonical metadata boundary with stable host
imports. Candidate 3 establishes the canonical pure-rule boundary and its
implementation coverage in PR314. Formation and authoring moves remain with their existing
owners, and caller migration stays a coordinated follow-up.

Step 5's HUD owner moves the three pure text/projection implementations
byte-for-byte to `src/client/hud/`, retaining explicit named old-path exports.
The source guard classifies both paths as client responsibilities; negative
fixtures reject rules/world/simulation/server consumers and keep the canonical
helpers dependency-free leaves, and packed HTTP checks
admit only the exact six paths. Existing helper tests exercise canonical exports
and verify compatibility binding identity; contextual consumers still use shims.
No layout, selection, accounting, labels or authored objective behavior changes.

The HUD integration owner retains shim retirement. Remaining runtime consumers
are `main.js` (all three), `selection-portrait.mjs` and `wall-placement.mjs`
(resource format), and `match-mode-controls.mjs` (objective summary). Tool/test
consumers include contextual HUD, construction/wildlife fixtures, roster and
shore-fishing checks, Practice/Bannerfall entry checks and the population browser
runner. Convert these with their owners in later bounded changes. Remove each
shim and its exact HTTP/domain entries only after tracked consumers/docs use the
canonical path, owners confirm no supported external import requires the old API,
and source/served/packed checks pass without it. Identify the containing release
and confirm page reload safety with the existing `no-store` policy before removing
a browser path. Historical QA receipts remain historical, not migration inputs.
This source/tooling work launches no browser, Mac workload, remote deployment,
provider request or security-setting change.

### Remaining callers and compatibility retirement

The eight initial slices establish enforced homes for existing leaves; they do
not complete the organization workstream. A tracked-source audit at `f73c6702`
on 4 October 2026 finds **17 runtime import edges through the ten forwarding
modules and the validator compatibility export, across nine consumer files**.
Every one of those eleven compatibility paths had a runtime consumer at that
snapshot. None was ready for deletion merely because its canonical implementation
existed.
The offline opponent adapter keeps its separately documented retirement policy.

The import-only [PR336](https://github.com/lbeezr/thousand-unit-skirmish/pull/336)
checkpoint changes just the two action-rule specifiers in `production-actions.mjs`
and `research-actions.mjs`, preserving the three imported ESM bindings and every
other source byte in those consumers. At that checkpoint, the tracked-runtime
audit finds **15 remaining compatibility imports across seven consumer files**. Ten of the eleven
retained compatibility paths still have runtime consumers; the action shim now
has none. It remains supported: `gameplay-action-rules.test.mjs` deliberately
checks its three value bindings, its two JSDoc type names and exact public HTTP
entry remain, and supported external imports/identified-release reload safety
have not been cleared for retirement. Production/research semantic wiring stays
with the building-functionality audit owner; this boundary slice owns only
the two import literals, as recorded in the PR's exact-hunk coordination note.
No shim, fixture, public entry or registration is removed. The PR records the
same full native research scenario timeout on preceding main and the caller
head, before any research command at its initial Infantry Move; that unchanged
check's research/recovery acceptance remains open with the building/movement
owners. Native both-seat production/research cancellation and paid reservation
lifecycle pass separately. The exact standalone command and both failing SHAs
are routed to the movement owner in
[PR332](https://github.com/lbeezr/thousand-unit-skirmish/pull/332#issuecomment-5982378433)
and the building/action owner in
[PR339](https://github.com/lbeezr/thousand-unit-skirmish/pull/339#issuecomment-5982522735).
Passing separate progression/cancellation checks do not close that failure.

The related client caller batch
[PR349](https://github.com/lbeezr/thousand-unit-skirmish/pull/349) changes six import
literals across five existing consumers: the cache in `audio.mjs`, bounded reader
and named map validator in `audio-shipped-loader.mjs`, resource formatting in
`selection-portrait.mjs` and `wall-placement.mjs`, and objective rule projection
in `match-mode-controls.mjs`. The same canonical ESM functions and reader alias
are used; every other byte in those consumers remains unchanged. Its
[exact-hunk note](https://github.com/lbeezr/thousand-unit-skirmish/pull/349#issuecomment-5982544346)
records active feature scopes and leaves semantic audio/HUD/ghost/mode wiring
with their owners. Main/server imports and all leaf/shim implementations stay
unchanged.

At the PR349 checkpoint, the tracked-runtime audit finds **nine compatibility
imports in two consumer files**: six in `src/main.js`, three in `server.mjs`.
Eight of the eleven retained paths still have runtime consumers at that point.

The main-client caller batch
[PR370](https://github.com/lbeezr/thousand-unit-skirmish/pull/370) changes just those
six import literals in `src/main.js`: resource formatting, population and
objective projection use `src/client/hud/`; history/region gestures and marker
resize use `src/authoring/`; the validator uses `src/world/map-audio-reference.mjs`.
Every named binding and every other main-client byte is preserved. Its exact
import scope is recorded in the draft PR for HUD, authoring and audio/world
receivers; gameplay, selection, actions, placement, editor and renderer bodies
stay with their feature owners. No server import enters the active movement
window.

At the PR370 checkpoint the tracked-runtime audit finds **three compatibility
imports in one consumer file**, `server.mjs`: validator, base lifecycle and
formation assignment. [PR404](https://github.com/lbeezr/thousand-unit-skirmish/pull/404)
changes just those three import literals to their established canonical homes.
The same four function values and every other host/import byte remain. Fresh
main `82a66766` already includes movement PR395, construction PR399, checkpoint
PR403 and the HUD/recap PR402/401; their implementation and imports stay intact.
The exact-hunk notes are recorded on the movement/construction/crowd artifacts,
and PR404 owns implemented-head independent review and consumer/type/import/
clean-pack/actual packed-HTTP evidence.

There are now **zero tracked-runtime consumers through the ten forwarding
modules and the validator compatibility export**. All eleven surfaces remain
supported while fixture/public/type/external and identified-release reload-safety
obligations remain. Zero runtime callers or a successful source pack alone does
not authorize retirement. The audio profile/playback library remains needed by
its real audio consumers; only its validator export is a compatibility surface.
No alias, test, type, HTTP entry or registration is removed.

The audit parses imports/re-exports/literal dynamic imports, then inspects
fixture/file-path references separately. Intentional export-identity tests,
guard fixtures and exact HTTP admissions are retained compatibility obligations;
they are not evidence that a production consumer has migrated. Historical QA
source inventories remain historical. The public `environment-art.mjs` host is
not a shim: its status/readiness, mesh/material and batch APIs remain needed
after the image-loading extraction.

| Retained compatibility surface / owner | Actual runtime callers | Tool/fixture work before retirement |
| --- | --- | --- |
| `audio-event-profile.mjs`'s **validator export only** / audio-world boundary owner | None after PR404; server uses the canonical world validator, joining the loader after PR349 and `src/main.js` after PR370 | Validator imports in `audio-runtime-scenario`, `audio-shipped-loader.test`, `stone-map-profile.test` and `wildlife-import-parity.test`; retain canonical/legacy parity while the alias is supported. Playback/profile consumers still need this module, so retirement removes only `validateMapAudioReference`'s forwarding export. |
| `gameplay-action-rules.mjs` / rules owner | None after PR336; `src/production-actions.mjs` and `src/research-actions.mjs` use the canonical rules leaf | The action contract already exercises canonical values and deliberately checks the legacy namespace. Preserve its two JSDoc type names while supported. Rejection order, affordability, production/research UI and native payment/recovery checks remain required. |
| `base-lifecycle.mjs` / rules owner with server/Worker/naval receivers | None after PR404; server uses canonical rules | `base-lifecycle.test`, Worker performing-action test/scenario/probe, `skiff-contracts.test` and `wall-construction-draft.test`. Retarget injected fixture bindings with their owners; preserve real refunds/repair/reservation scenarios and both old/canonical HTTP denials. |
| `formation-assignment.mjs` / movement owner | None after PR404; server uses canonical simulation helper | `formation-assignment-scenario` still exercises the legacy import plus explicit canonical binding identity. Keep formation pairing/ties and real pathing/native command consumers; both helper paths remain HTTP-private. |
| HUD aliases `resource-format`, `population-readout`, `objective-summary` / HUD integration owner | None after PR370; `src/main.js` uses all three canonical helpers, joining the PR349 selection/wall/match-mode consumers | Matching canonical/legacy contracts; contextual HUD, construction/wildlife client fixtures, roster/shore-fishing checks, population browser runner and Practice/Bannerfall entry checks. `contextual-hud.test` already imports canonical objective summary while still using legacy resource/population helpers; do not revert or rename it. |
| Authoring aliases `scenario-authoring`, `map-resize` / authoring owner | None after PR370; `src/main.js` uses both canonical leaves | `scenario-authoring.test` retains both binding identities; server-hardening and packed-release checks intentionally exercise exact compatibility HTTP paths. Map persistence already imports canonical resize. Reconcile the owning authoring/saga links with their owners rather than changing unrelated historical receipts. |
| Audio aliases `audio-decoded-cache`, `audio-shipped-response` / audio boundary owner | None after PR349; `src/audio.mjs` and `src/audio-shipped-loader.mjs` use canonical leaves | Matching contracts already use canonical implementations plus legacy identity; shared-decode/loader/lifecycle checks reach the same canonical functions through the real runtime. Canonical reader coverage is registered. Preserve both-path HTTP bytes and playback/cache/error/cancellation checks until alias deletion is justified. |

The next caller work is a bounded integration queue, not another batch of leaf
copies. Each row retains its owning review and the common source/served/packed
checks above; no source or test is renamed solely to make a path look tidy.

1. The rules caller slice in PR336 changes only the two imports in
   `production-actions.mjs` and `research-actions.mjs` to
   `rules/gameplay-action-rules.mjs`, without either host changing. The legacy
   API/type contract and public entry remain; existing binding/reason, UI and
   paid lifecycle checks establish the scoped migration. Full research recovery
   retains the baseline scenario limitation recorded above and in the PR.
   Its shim-retirement decision stays in steps 5–6 below.
2. Client batch PR349 migrates the cache import in `audio.mjs` and bounded reader
   import in `audio-shipped-loader.mjs`, plus that loader's named validator to
   its pure world leaf. The validator's main/server receivers retain their
   current API/path. Keep every cache/scheduling/reader/validator contract and
   all coverage floors; audio shim retirement remains steps 5–6.
3. The same batch migrates resource imports in `selection-portrait.mjs` and
   `wall-placement.mjs`, plus the objective import in `match-mode-controls.mjs`,
   preserving actual contextual/construction/selection consumers. These three
   leaf callers no longer traverse aliases; the main composition host does.
4. Main-client PR370 migrates its six imports without changing host behavior or
   any compatibility contract. Server PR404 follows the completed PR395 movement
   integration and changes only its three counterparts, preserving all four
   imported function values and the peer-owned host/module implementations.
   The completed runtime caller queue does not retire aliases or authorize order,
   path, editor, renderer or economy body changes.
5. Retarget remaining behavioral fixture bindings, source/HTTP helpers and
   current owning-guide links per domain. A legacy export-identity assertion
   stays while the alias is supported; retire that assertion only with the
   justified alias deletion, preserving every behavioral case and canonical
   implementation floor. Test names, workload inputs and historical receipts
   remain stable.
6. Remove aliases one boundary at a time only after the tracked inventory is
   clear, receivers confirm supported external imports/commands, and an
   identified containing served release establishes browser reload safety.
   Retire the corresponding exact manifest/domain entries and compatibility
   HTTP checks atomically. Keep private lifecycle/formation denial and the
   canonical implementations' checks. No alias removal is authorized by this
   audit alone.

The same `f73c6702` snapshot has 185 source JavaScript modules: 169 flat and
16 nested, plus five root hosts/adapters, with 342 local edges and zero cycles.
The largest mixed owners still dominate coupling: `server.mjs` has 9,077 lines /
62 local dependencies, `main.js` 10,625 / 61, `environment-art.mjs` 1,258 / 24,
and `pve-opponent.mjs` 940 / 10. `gameplay-definitions.mjs` has 24 runtime
importers. These are dated review ratchets for responsibility/growth, not
absolute size scores or reasons to split definitions arbitrarily. The existing
host-responsibility stage above and purpose-based fixture/scenario/performance
organization remain open; forwarding-path admission does not resolve them.

Parent allocation selected candidate 7's two editor leaves for PR300; their
canonical homes and retained aliases are recorded above and in
[map authoring](map-authoring.md#authoring-module-paths). Both implementation
bodies remain byte-identical. The integrated packed scenario retains the HUD
canonical/shim HTTP checks from PR299 and the private formation checks from
PR301 alongside the authoring checks. PR300's cloud capability probe and existing
draft scenario both fail at normal-sandbox browser startup, with zero game
frames/screenshots. Rendered editor acceptance remains with the authoring owner;
no Mac workload, remote deployment, provider request or security-setting change
is part of this migration.

### Tests, fixtures, scenarios and performance tools

The testing-strategy owner decides discovery and commands; this is the target
file boundary for that owner's later scoped moves, not an instruction to rename
the 227 test files now. Put imported contract tests and their domain fixtures
together, for example future `tests/unit/rules/` and `tests/fixtures/rules/`;
integration tests own real process/socket/packed HTTP fixtures. Source-slice
fixtures move with the extracted implementation only when their existing
assertions can consume the actual export. Retain fixture isolation, fixed
seeds/map identities and cleanup. Keep the empty cycle ledger and parser/type
negative fixtures beside their architecture/type checks until their owners move
them deliberately.

Keep scenario runners distinct from unit tests: future `scripts/scenarios/`
contains real command/recovery workloads; `scripts/performance/` contains
collectors/comparisons such as `checkpoint-performance-scenario`,
`map-capacity-scenario` and tick-attribution supporting probes and
browser measurement instrumentation, with run mode and workload explicit.
A scenario used for correctness stays in the scenario lane even if it reports
timings. Browser QA/capture helpers belong to `scripts/browser/`; map generators
to `scripts/authoring/`; build/validate art tools to `scripts/assets/`; pack/smoke
tools to `scripts/release/`. Leave their supported root CLI paths as small
argument-preserving launchers until CI/docs/consumers migrate together. Check
`import.meta.url`/root resolution after a move; relative filesystem/URL changes
can silently select different maps, receipts or assets. Do not move a test
called `*.test.mjs` into performance-only discovery and lose its CI coverage.
Keep authored maps in `maps/`, production assets in `assets/`, private/generated
sources in their existing authorized lanes and dated outputs in `docs/qa-evidence/`
or the runner's existing ignored output directory. No measurement is rerun or
rewritten merely to improve an organization metric.

### Release packer tooling boundary

[PR373](https://github.com/lbeezr/thousand-unit-skirmish/pull/373) begins the
planned purpose-based tooling stage with one complete release responsibility:
`scripts/release/pack-railway-release.mjs` owns Docker-source discovery,
isolated copying, clean-source checks, digest/identity declarations and failure
cleanup. Its implementation is byte-identical to the 153-line packer at
`c3fec9ea` except the one `import.meta.url` root-depth expression required by its
nested location. It reads the same repository root regardless of the caller's
working directory; no COPY/ignore, error, argument, manifest or cleanup rule
changes.

The actual `railway-release-scenario.mjs` subprocess uses the canonical CLI. Its
existing failure fixture copies that nested dependency and mocks the dependency
the scenario now calls, retaining all behavioral cases and assertions. The
supported root `scripts/pack-railway-release.mjs` is a three-line import launcher;
it preserves `process.argv`, cwd, stdout JSON, errors and exit behavior without
duplicating the implementation. Package/workflow commands, asset-adoption tools
and documented external commands still use that root entry. They are deliberate
compatibility consumers, not evidence that every tool has migrated.

The architecture/tooling owner retains both paths. Retire the root command only
after package/CI/workflow/docs/tool receivers agree their supported command
migration, tracked and supported external callers are inventoried, and root and
canonical CLI behavior, clean source-identified packs and actual packed HTTP
pass through those consumers. This slice does not change those registries or
release/deployment policy. Further smoke, browser, authoring, asset, scenario
and performance-tool responsibilities remain in the purpose-based queue above;
no bulk test rename, measurement rerun or workload change is implied. At this
PR373 checkpoint the three server compatibility imports remained outside the
movement owner's active window; PR404 later migrates those literals only.

### Release verification tooling boundary

[PR378](https://github.com/lbeezr/thousand-unit-skirmish/pull/378) continues the
same release-tooling stage with `scripts/release/railway-smoke.mjs` and
`scripts/release/check-served-build-identity.mjs`. The existing CLI's lookup,
readiness/auth/import/asset/WS sequence and the helper's three identity functions
are unchanged except their required relative imports. The smoke CLI consumes
the canonical helper, and the actual packed-release scenario does too. The
existing mocked CLI mismatch case follows the canonical entry; its assertions
remain unchanged. This is source/tool organization, not a provider lookup or
deployment action.

The old smoke command remains a three-line launcher with unchanged arguments,
cwd, usage, JSON and exit behavior. The old identity helper explicitly forwards
the same three named functions, preserving object identity for capture/QA tools
and contract fixtures. Package commands, capture consumers and external command
contracts remain supported while their owners migrate. The architecture/tooling
owner retains both root entries until those supported consumers are inventoried
and agree their migration, source/mock/native packed checks pass without the
entries, and the owning command/API documentation is reconciled. No caller or
policy is silently retired. Bounded health reads, failure sanitization and
early source-mismatch rejection retain their existing contracts; this slice
does not strengthen, weaken or otherwise change access/deployment policy.

### Served-browser audit tooling boundary

[PR382](https://github.com/lbeezr/thousand-unit-skirmish/pull/382) establishes
`scripts/browser/check-client-imports.mjs` for the existing served-module audit.
Its 46-line implementation is unchanged except the relative import of the
shared `scripts/module-imports.mjs` parser. Source guards and source admission
keep that parser and their current paths; the parser is intentionally shared
source/served grammar, not a new browser dependency or generic utility drawer.
The actual release smoke and packed-HTTP scenario use the canonical auditor.
Its existing regressions follow the implementation, preserving every case and
assertion; the cleanup fixture copies the nested dependency it now executes.

The supported root helper explicitly forwards the same sole named function.
`audit-asset-adoption.mjs`, `economy-client-browser.mjs` and
`game-menu-scenario.mjs` retain that entry and exact function identity. The
architecture/tooling owner retains both paths until those workload owners and
supported external API consumers agree migration, canonical fixture/served/pack
checks pass without the root entry, and current command/API documentation is
reconciled. Test names, workloads, CI registration policy, parser grammar,
HTTP access and runtime paths do not change. This tool move does not establish
rendered-game acceptance or a remote deployment.

### Next responsibility checkpoints

At main `0e46e736` (after the reviewed PR378 release tooling and PR380 packed
PNG MIME assertion fix), the graph contains **196 source modules: 178 flat and
18 nested**, plus five root hosts; **365 edges, 129 browser / 84 server / 33
shared modules and zero cycles**. Main remains 11,014 physical lines with 70
local dependencies; server 9,262 / 65; environment art 1,239 / 26; PvE opponent
968 / 10. Gameplay definitions has 24 runtime importers. The tooling moves
leave this runtime graph unchanged. These dated values show why the broad
workstream remains open; they do not turn growth into an arbitrary failure.

The boundary owner retains the following next proposals and integration checks.
The completed leaf/caller/tool slices do not authorize overlapping host edits,
retirement or a bulk tool/test rename. Resolve the named input for a row, then
choose its smallest meaningful implementation; keep unrelated feature work moving.

[PR406](https://github.com/lbeezr/thousand-unit-skirmish/pull/406) implements the
first Map Studio form responsibility against main `bd7f2915`, including the
movement owner's PR405 unchanged. Its graph has **206 modules, 378 local edges,
131 browser / 84 server / 32 shared modules and zero cycles**: one browser-only
authoring leaf and one main import added to that base. The 24-line controller
removes the two private form bodies from the 11,039-line client host (17 fewer
physical lines), while making its two actual dependencies explicit. The host's
extra import is composition, not a quality score; storage, recovery and publishing
are still distinct responsibilities to extract after concrete contracts exist.
The resource-brush fixture stops slicing those two bodies and consumes production
controller initialization. All eleven compatibility surfaces remain; no alias
retirement or broad fixture/test/command migration occurs.

[PR412](https://github.com/lbeezr/thousand-unit-skirmish/pull/412) continues from
main `565ab3c4` with versioned local draft storage/recovery preflight and real host
callers. The graph is **207 modules, 379 edges, 132 browser / 84 server / 32
shared and zero cycles**: one dependency-free authoring leaf and one composition
import added. The client host is 11,020 physical lines, 19 fewer than PR406.
The key/read/preflight bodies and JSON/storage operations preserve their old
behavior; no new save version, migration or storage service appears. A dedicated
test fixture owns actual draft/dialog and portable map paths without renaming
tests or changing their registrations. Versioned storage is now an explicit
contract. At this checkpoint, capture, debounce, history coordination, recovery
presentation and publishing remained host responsibilities. PR412 merged as
`8753c671`; its reviewed source, local served/packed identity and remaining
rendered acceptance are recorded in that PR.

[PR415](https://github.com/lbeezr/thousand-unit-skirmish/pull/415) selects the
remaining scenario-history coordination from actual host coupling: one applying
flag connected recording, Undo/Redo application and availability across the
editor's region/event callers. The existing canonical scenario-authoring module
now owns that coordination through `createScenarioEditCoordinator`; the host
supplies history, liveness, snapshot, state application and availability callbacks.
Its two existing implementation bodies and the legacy entry's two exports stay
unchanged. No folder, module, import edge, shim or HTTP admission is added.
On main `ca777a09`, including XL parser/file-budget PR407, the graph remains
**210 modules, 385 edges, 132 browser / 87 server / 32 shared and zero cycles**.
The client host grows by four physical lines to 11,024 because explicit callback
wiring replaces the shared applying flag and coordination body; that wiring
cost is intentional, rather than a line-count quality target. Current registered
tests now consume the coordinator and actual template Undo/Redo handlers, while
retaining prior cases and portable draft recovery/import/export checks.

The next Map Studio evidence is the existing rendered draft scenario against an
identified containing release, once normal-sandbox cloud browser capability is
available. Recovery presentation/inertness and close/publish interaction changes
would need that observation; the current JSDOM platform/rendering stubs do not
establish it. Capture and debounce still share ordered subpanel/host callbacks.
A further source slice needs a concrete responsibility with fewer shared state
dependencies; a format-only helper or a broad editor parameter bag is not a next
step. Keep the active server/movement/match-ending contracts separate and do not
turn this local evidence dependency into a global hold.

The portable-map validation slice based on main `fec90d44` selects an actual
298-line host responsibility with two callers. Its byte-preserved implementation
lives in [`authoring/map-import-validator.mjs`](../src/authoring/map-import-validator.mjs).
`createMapImportValidator` takes the existing eight scalar policy limits and
obstacle material list, and imports the same 17 pure bindings from nine existing
modules. Main retains the named `validateImportedMap` entry with its import and
collection/export/publish callers; storage, file reading, DOM, rendering, timers,
server authority and live-match state stay outside the factory.
This format has no new version namespace, schema change or migration.

The existing draft fixture and Stone/wildlife importer fixtures consume the
canonical implementation; the XL source audit follows and hashes its binding
without widening 16–256 dimensions or parser/file/route budgets. One exact
browser-module path and authoring membership are added; all eleven compatibility
surfaces stay supported. Main falls from 11,036 to 10,746 physical lines, a
290-line responsibility reduction; the canonical module is 320 lines. These
measurements do not certify size or quality by themselves. Architecture/authoring
owns independent local review, source/served/packed checks and subsequent
identified-release browser acceptance. The lifecycle/publish observation below
remains separate. This source candidate preserves current file-read/error behavior
and all unrelated host bytes; it does not incorporate an error-handling change.

| Checkpoint / next scoped slice | Input and owning boundary | Semantic acceptance and retirement limit |
| --- | --- | --- |
| Server caller slice [PR404](https://github.com/lbeezr/thousand-unit-skirmish/pull/404): the three `server.mjs` lifecycle, map-audio validator and formation literals | Fresh-main integration after PR395; exact scope retains construction/crowd and XL checkpoint imports/bodies. Canonical entries are `src/rules/base-lifecycle.mjs`, `src/world/map-audio-reference.mjs` and `src/simulation/movement/formation-assignment.mjs`. | Four identical bindings and every other host byte; actual consumer/native, types/imports, clean pack and packed HTTP/private-path checks plus implemented-head independent review belong to PR404. Zero tracked-runtime compatibility callers; all eleven surfaces and every existing fixture/admission remain. |
| Checkpoint envelope [PR507](https://github.com/lbeezr/thousand-unit-skirmish/pull/507), integrated after contract preparation in PR495 and module preparation in PR502 | Architecture owns the default private envelope binding after the parent allocated the core PR504 handoff and XL audit writes. The nine inputs, domain-state return and existing capture/restore/file contracts are preserved; PR506 parking/movement bytes remain unchanged. | Actual merge `6c5dde0f` has the reviewed tree: 91 checkpoint/XL cases, 90 old/new authority/restore observations, native economy/storage and 11 native XL dimension rows pass. Clean package and private HTTP checks pass. Railway staging SUCCESS `422033b4` contains that source; the direct public read is proxy-blocked, so served identity and ordinary-game recovery remain open with architecture/public staging. Hosted CI retains formation/native-wall failures, separately from the passing scoped contracts. Next: the disjoint world-helper caller migration below; do not move the remaining domain-state validator behind a broad host parameter bag. |
| Map Studio form snapshot controller [PR406](https://github.com/lbeezr/thousand-unit-skirmish/pull/406): `src/authoring/map-studio-form-state.mjs` with the two real draft callers in `src/main.js` | First small implementation of this row. Explicit `createMapStudioFormState({ root, document }) → { capture, restore }` owns only live dialog values; no host-state catch-all, storage, timer, rendering or simulation dependencies. The architecture/authoring owner retains the controller and source/browser acceptance. | Preserve old function bodies apart from closure identifiers/indentation, all draft JSON/version/storage/gesture/import/export/publish behavior and every prior brush case. Fixture uses production initialization; focused form/draft cases, import/privacy guard and exact served/packed bytes establish the source milestone. No new shim and all eleven existing surfaces retained. Normal-sandbox rendered draft acceptance remains incomplete. |
| Versioned Map Studio draft storage/preflight [PR412](https://github.com/lbeezr/thousand-unit-skirmish/pull/412): `src/authoring/map-studio-draft-store.mjs` and real `main.js` callers | Explicit deferred storage getter, key identity inputs and cached recovery references. Preserve version 1 and old rejection/error ordering; no new file budget, migration, storage service or server checkpoint dependency. Architecture/authoring retains source and rendered recovery ownership. | Current registered brush/form cases plus malformed/old/foreign drafts, interruption/cancel/restore reread, storage failures, real portable import/export parity and native saved-map restart. Preserve every old host byte outside the bounded extraction/calls, all eleven compatibility surfaces and exact public/private packed HTTP policy. |
| Scenario history coordination [PR415](https://github.com/lbeezr/thousand-unit-skirmish/pull/415), then the editable event-graph queries below: existing `src/authoring/scenario-authoring.mjs` with real main callers | Architecture/authoring owns the applying flag/order and the draft's capture-root/cycle questions. DOM/state assignments remain host callbacks; history, mutation, storage/debounce and publication stay outside the pure queries. New exports are canonical-only; the legacy namespace retains its two original bindings. | Preserve history gating/ordering and query roots, caller cache/visiting identity, partial/cyclic drafts, source eligibility and capturing-team reconciliation. Actual-host contract cases pass before extraction; real template controls and source/packed checks follow. No admission, alias retirement, registry or movement/Patrol body changes. |
| Remaining Map Studio capture/debounce/recovery presentation and publish seam in `src/main.js`; existing `map-studio-draft-scenario.mjs` consumer | Architecture/authoring retains the concrete lifecycle/publish contract and rendered recovery evidence. Use current form, store and history APIs; preserve ordered subpanel callbacks. Keep checkpoint parsing/XL file/route budgets with their owner, crowd/focused Attack/selected-route movement with their owners and match-ending actions with theirs. Avoid a broad editor context or unused formatter extraction. | Next evidence: real draft edit/save/reopen/publish on an identified containing cloud release when normal-sandbox capability is available. Source/CPU results do not close that recorded startup gap. Further source work needs an independently useful responsibility and real caller contract; current modal behavior and product decisions are not silently changed to manufacture another slice. |
| Root tool commands and test/fixture homes: current `package.json`, workflows and `docs/testing.md` consumers | Testing-strategy/command owners own registration migration, discovery and supported commands. Authoring/assets/scenario/performance owners first select an actual workload/API boundary from the purpose-based stage above. | Preserve every existing case, fixed input/seed, coverage floor, command and release consumer; root entries retire only after external/fixture/identified-release obligations clear. Those registries and broad tool/test moves are outside this lane's current write scope. |

### Checkpoint validator contract preparation — 5 October 2026

Architecture owns this continuing boundary with server/simulation and XL as the
affected interface owners. At main `6ee1cce4`, `validateMatchCheckpoint` has 514
physical lines. It validates an already parsed snapshot synchronously; it does
not read a file, migrate a schema, activate a map or assign running match state.
The ordinary restore caller validates first, applies its launch/catalog checks
and any existing Sheep content migration, validates again when that migration
applies, then performs activation and state restoration. Keep those operations
and atomic checkpoint storage outside validation.

The ordered envelope is part of the supported rejection contract: object shape;
XL aggregate route preflight; XL JSON/state preflight; schema; economy/profile and
resource banks; faction; rules version; sequence; save time; match identity;
canonical map validation; saved match-mode identity and launch compatibility;
effective mode projection; elevation/rules compatibility; canonical map checksum;
simulation state. State validation then proceeds through pregame, forest/unit,
economy/production, building/resource, objective/event/result, exploration/session,
reference/population and Bannerfall checks in its existing order. Do not reorder
checks or normalize malformed input to obtain a cleaner error.

Both preflights retain their existing scalar limits and execute before schema or
map admission: routes receive `MAX_UNITS` and `MAX_RESOURCE_NODES`; state receives
those limits plus `MAX_BUILDINGS`. They preserve their error identity/message/code,
do not alter routes and leave the existing <=256 policy untouched. Ordinary 320
admission stays closed. Route budget, JSON byte/parser budget, map validation and
live movement remain distinct contracts with their existing owners.

The return is exactly `{ definition: canonicalDefinition, state, explored,
savedMatchMode }`: normalized canonical authored map, the original saved-state
object by identity, two newly decoded Node Buffers and normalized mode identity.
Validation uses an effective map internally but returns the canonical authored
one. The tested normalized checkpoints retain their input serialization and the
live match remains unchanged. Preserve the existing map validator's defaulting
of `victoryMode` and `fogOfWar` before checksum validation; it can normalize the
input map. Restore's separate shipped-map veto stays outside this return contract.

The first proposed extraction is only that envelope/preflight responsibility,
before domain-state validation. Its explicit inputs would be the existing
schema/rules and three record limits, the existing map-validation/hash adapters,
and launch mode/Practice values. Import current pure economy/mode definitions and
the private preflights directly; no host-state catch-all, catalog, persistence,
movement writer or public HTTP admission. XL has agreed the per-call inputs
below. The core handoff is now allocated at the containing PR504 refresh; the
default-consumer integration checkpoint below records its narrow implementation.
Full-state validation remains host-owned until its separate domain interfaces
are established; copying all 514 lines behind dozens of injected bindings is
not the selected first step.

The existing headless authority fixture adds only a direct validator observation;
the registered economy checkpoint suite imports the focused contracts without
renaming tests or changing CI/package registration. Authored/Skirmish return and
restore parity, two-fault first-error cases, XL preflight codes and the separate
catalog veto are executable through the actual production functions. Existing
fog/route/JSON/match-mode and native cold-recovery checks remain required for a
later runtime extraction. No source extraction, deployed revision or playable
acceptance is claimed by preparing these tests. At that preparation checkpoint,
host integration awaited the core handoff. PR507 subsequently completed the narrow
default envelope binding below; remaining domain-state validation stays in the host.

#### Envelope dependency and write-allocation checkpoint

The follow-up audit is pinned to [PR495](https://github.com/lbeezr/thousand-unit-skirmish/pull/495)
merge `a2bdd041`. Its proposed cut is the 23 existing physical lines from the
object guard through `const state = snapshot.state` (24 lines including the
original function header), immediately before
`validatePregameCheckpoint`. Those lines reference ten host bindings and seven
imported bindings from six existing modules, excluding standard JavaScript
builtins. This is an ordered validation responsibility, not a size target; the
remaining domain-state validator and its final return stay in the host.

| Actual dependency | Proposed input or direct dependency | Retained owner and limit |
| --- | --- | --- |
| `MATCH_CHECKPOINT_SCHEMA_VERSION`, `MATCH_RULES_VERSION`, `MAX_UNITS`, `MAX_BUILDINGS`, `MAX_RESOURCE_NODES` | Agreed per-call values `checkpointSchemaVersion`, `gameRulesVersion`, `maxUnits`, `maxBuildings`, `maxResourceNodes`, supplied from the existing host constants (30, 6, 2000, 128, 128 at this source). | XL has confirmed these inputs. Do not duplicate constants or introduce fallback/default limits. Preserve `[1, 2, 3, 4, gameRulesVersion]` and all existing rejection positions. |
| `assertSnapshot` | The private module retains the same three-line assertion implementation, error prefix and timing. It is not an injected input. | The original host helper and all its other callers/fixture markers remain intact; this slice creates no common error-policy module or wrapper. |
| `validateMapDefinition`, `matchMapHash` | Existing host callbacks with the same map diagnostic label and canonical JSON hash. | Map validation is a separate 311-line host body with additional policy dependencies; it is not moved here. Keep its current defaults, property/hash order, <=256 admission and errors. The hash adapter remains unchanged. |
| `pveLaunchOptions`, `soloPractice` | Per-call `launchMode: pveLaunchOptions ? 'pve' : 'pvp'` and `practice: soloPractice`, supplied from the existing host values. | XL has confirmed this interface. The module receives neither the launch object nor environment access; the PvE launch-map veto remains in restore. |
| `preflightXlCheckpointRoutes`, `preflightXlCheckpointState` | Direct imports from the existing private route/JSON-budget modules. | XL retains both implementations and quotas. Route then state preflight still precede schema/economy/map checks. Capture, clone, write/read/parser and live-route calls stay where they are. |
| `validateEconomyCheckpoint`, `DEFAULT_FACTION_ID`, `validateMatchModeCheckpoint`, `assertMatchModeCompatibility`, `effectiveMapForMatchMode` | Direct imports from their four current modules, without barrels or policy copies. | Existing economy and mode owners retain their contracts. Canonical versus effective definitions remain distinct and no migration moves into validation. |

The agreed canonical entry is [validateCheckpointEnvelope](../src/server/checkpoint-envelope.mjs),
with signature `validateCheckpointEnvelope(snapshot, { checkpointSchemaVersion,
gameRulesVersion, maxUnits, maxBuildings, maxResourceNodes, validateMapDefinition,
matchMapHash, launchMode, practice })`. These are nine explicit inputs; no new
configuration check precedes the existing object/route/state rejection order.
It returns `{ canonicalDefinition, effectiveDefinition, state, savedMatchMode }`:
authored normalized map, effective mode projection, original state by identity
and normalized mode. Future host wiring aliases `effectiveDefinition` to the
existing local `definition` before continuing with domain-state checks.
This private intermediate result is not a new persisted or public checkpoint
shape. The host still decodes exploration Buffers and returns its original
`{ definition: canonicalDefinition, state, explored, savedMatchMode }` only after
all existing domain-state checks succeed. Preserve the original state-object
predicate rather than tightening it as part of organization.

One actual-consumer probe sets the existing `victoryMode` key to null on a
captured valid Skirmish checkpoint. Validation defaults it to `any`, accepts the
canonical hash and retains state identity without changing the live match. That
is existing normalization, not an input-immutability guarantee for arbitrary
maps. The [envelope parity tests](../scripts/checkpoint-envelope.test.mjs) retain
both accepted/defaulted and rejected-checksum controls against the actual host,
alongside canonical/effective map, first-error, domain-handoff and XL-code checks.
They use the real host map/hash adapters and limits through the existing headless
fixture; no validator policy is replaced. Existing normalized-input preservation
checks and source serialization remain unchanged.

XL owner `01a103e8` agreed the exact envelope/rejection/preflight interface;
the coordinating parent relayed that agreement. PR502 prepared the disjoint
module, parity tests/fixture observation and private-domain membership without
changing the production host. The parent subsequently confirmed core PR504
`1a1f99b6` as the containing queued-claim API handoff and allocated architecture
only the checkpoint import/prefix plus the XL binding/order and two audit-hash
updates. Construction caller `01a10933-e913` retains active-construction parking;
no parking, movement or domain-state section belongs to this extraction.

The smallest implementation follows that dependency order:

1. XL has agreed the cut, nine inputs and intermediate result; the parent has
   allocated the containing PR504 host refresh and audit writes. Keep the
   named `validateMatchCheckpoint` host entry and both replay fixtures intact;
   there is no legacy module path needing a shim or new browser admission.
2. The canonical private module and its `server` membership in
   `scripts/check-runtime-imports.mjs` are prepared. Add the approved host wiring
   against a current main containing that handoff. The current
   browser closure must never reach it. Existing imports used by capture,
   migrations or other host callers remain; remove only newly unused bindings.
3. Update `scripts/xl-map-boundary-audit.mjs` to follow the actual host binding to
   the canonical envelope and retain its route-before-map/limit checks. It
   currently demands literal preflight calls inside the host body, so ignoring
   that consumer would break an existing contract. Both it and
   `scripts/checkpoint-json-budget-audit.mjs` must include the new canonical file
   in their input hashes. Architecture owns these explicitly allocated writes; neither
   audit may widen admission or reinterpret synthetic upper witnesses as saves.
4. `scripts/checkpoint-envelope.test.mjs` adds six parity/handoff cases; the
   existing economy job imports them without CI/package registration changes.
   Preserve all existing economy, match-mode, fog,
   route/JSON, XL-audit, Farm and native checkpoint/storage-recovery assertions,
   fixture identities and test names. Run the affected consumers plus configured
   types, import guards and documentation checks; no package/CI/type-registration
   change is included in this proposed scope.
5. Run the existing allowlist and packed-release scenarios. Docker already copies
   `src/`; server-domain membership makes the existing packed loop require the
   new file on disk while GET and HEAD return 404. Keep `CLIENT_ASSET_PATHS`
   unchanged. Independently review the exact source union, then record the clean
   package digest, containing deployment and recovery observation separately.

The audited baseline is 223 modules, 415 local edges, 140 browser/94 server/34
shared and zero cycles. The prepared private module adds six direct edges but
is not reached by the production host: 224 modules/421 edges, with host closures
unchanged. Default host integration would add the seventh edge and make the
server closure 95 modules; browser/shared closures must not grow. Verify that
implemented graph and host responsibility reduction at the approved wiring
head. Preparation does not remove the original host prefix or establish runtime
adoption, a containing deployment or recovery acceptance.

#### Default checkpoint-envelope consumer integration — 5 October 2026

The narrow follow-up starts from PR502 merge `f9f329b0`, containing core PR504
and incoming Spearman PR505. `validateMatchCheckpoint` now calls the reviewed
private module with the nine existing host values and aliases its effective map
to the old local `definition`. Only its ordered envelope prefix and one import
change; two newly unused validator imports are removed while migration imports
remain. The rest of domain validation, final canonical-map/state/two-Buffer return,
restore, catalog veto, migrations, activation, pending rebuild, parking and
movement retain their existing bodies. The canonical module is unchanged.

The XL source audit follows the exact host import/call, current limit adapters
and route/state/schema/map/checksum order before domain validation. Its capture
preflight checks remain. Both XL and JSON-budget reports hash the canonical module;
negative controls reject a redirected import, substituted host limit, premature
domain validation and reversed preflights. Their supported-field upper witness
still does not establish an accepted 320 map or save. No quota, admission, error
code, checkpoint schema or browser path changes.

The expected implemented graph is 224 modules/422 local edges, 140 browser/95
server/34 shared and zero cycles: one composition edge makes the prepared leaf
the default host dependency. The 18-line prefix reduction is a responsibility
measurement, not a quality threshold. Actual authority/restore and native storage
checks, XL audits, independent exact-head review and clean packed private HTTP
checks establish this source integration. Record their final source/package
identity in the owning PR. A merge or local package does not establish a containing
deployment or ordinary-game recovery acceptance; architecture retains those
remaining obligations with the receiving release owner.

The actual [PR507](https://github.com/lbeezr/thousand-unit-skirmish/pull/507) merge
`6c5dde0f` has tree `6a155b88`, identical to the independently reviewed head.
Its clean package digest is
`sha256:944021b946ba3a9bc0c545fe7f90a924dc602230481e70c611ef228d4e64d747`.
Permitted Railway reads on 5 October report staging deployment
`422033b4-af51-4a00-a2ca-9f683b8659fe` as SUCCESS at that exact source, with one
healthy replica. Production remains at `67b16674`; no promotion was performed.
The public `/ready` read is blocked by the execution network proxy with 403;
that route is not retried or used to claim served identity. Public staging owner
`01a10e00` retains the permitted served-identity path; architecture retains
ordinary recovery observation at an identified containing release. Hosted run
`37387225241` ended with all three shards failing: formation reservation, paid-wall
formation destinations and a native queued-wall checkpoint timeout. The first
formation failures match the earlier baseline reproduction; the latter two were
not independently rerun here. CI stopped before 320 selected checks. Do not rerun
the full suite or weaken those assertions as part of this source boundary.

#### Authoring validator world-helper caller slice

The [PR510](https://github.com/lbeezr/thousand-unit-skirmish/pull/510)
compatibility-caller step selects the architecture-owned
`src/authoring/map-import-validator.mjs`, with its real calls to
`findInvalidCapturePrerequisite` and `findInvalidScenarioEventChain`.
Only these two import bindings move from `map-utils` forwarding exports to the
existing canonical world leaves. Its elevation/topology imports remain in
`map-utils`; all policy inputs, validation body, return/error ordering and actual
`main.js` import/export/publish consumers remain byte-identical. No host, movement,
parking, save, format, fixture, manifest or CI/package registration changes.

The runtime caller inventory at `6c5dde0f` retains the corresponding `main.js`
and `server.mjs` compatibility bindings, alongside tool/test/HTTP consumers.
Those callers required their own owner agreement at that checkpoint. This slice
has one existing architecture/authoring caller and does not remove any of the four `map-utils`
forwarding exports, their identity checks or their public paths; supported
external imports and containing-release reload evidence remain retirement inputs.
The world implementations and all eleven compatibility surfaces stay supported.
Existing portable/draft/resource/Stone/wildlife consumers, direct canonical and
old-path identity controls, import/type checks and actual packed public/private
HTTP establish the source contract. Rendered editor acceptance remains separate.

The two direct composition edges yield 224 modules/424 local edges, unchanged
140 browser/95 server/34 shared modules and zero cycles. The authoring validator
now declares eleven module dependencies instead of nine while retaining the same
17 imported bindings; that explicit ownership is intentional, not a size score.

The same checkpoint leaves the mixed hosts as the largest pressure: `src/main.js`
has 10,829 physical lines and 76 direct local dependencies; `server.mjs` has
10,080 and 74. `environment-art.mjs` has 1,243 and 28. The 242-line validated
`gameplay-definitions.mjs` registry has 29 runtime importers; that intentional
fan-in is not a reason to fragment its identity. Tracked `scripts/` now has 892
files, 859 directly at its root, 323 `*.test.mjs` files and 238 filenames containing
`scenario`; these are file counts, not CI jobs or independent workloads. Earlier
dated measurements remain historical. Host responsibility contracts and the
testing/tool owners' purpose-based queue remain the substantive work after these
small caller migrations.

#### Main/server world-helper caller allocation

After PR510 merged as `34e9beab`, the parent explicitly allocated the remaining
world-helper import bindings to this architecture owner. The existing plan and
runtime inventory above identify these actual consumers: `src/main.js` uses
`capturePrerequisiteIds` and `scenarioEventSourceIds`; `server.mjs` uses both plus
`findInvalidCapturePrerequisite` and `findInvalidScenarioEventChain` for validation,
capture authority and scenario evaluation/recovery. These six bindings now come
directly from the two existing canonical world leaves. Elevation/topology remain
in `map-utils`. Every other import and every byte after the hosts' import blocks
are preserved, including construction body admission, parking and Patrol symbols
and functions owned by the active core/caller lanes.

No canonical implementation, compatibility export, fixture/assertion, save/rules
version, admission, protocol, public path, manifest, package/CI/AGENTS/testing
registration or art changes. The ten-export `map-utils` namespace and its four
forwarding identities remain supported; its topology/elevation implementation is
still consumed. Existing tool/test and draft fixture imports remain intentional
compatibility consumers, so zero runtime forwarding callers do not retire an API.
Exact-head graph/types, real authoring/validation/persistence/recovery consumers,
clean packed canonical/old-path bytes and private GET/HEAD denial, then independent
review and actual containing deployment establish their separate milestones.

The base `f33c3a1a` contains PR509 and PR510, with staging SUCCESS `42e85b27`
at that source and one healthy replica. PR510's CI ended with all three shards
failing: formation reservation, paid-wall formation destinations and a native-wall
checkpoint timeout, leaving 320 selected checks unrun. No full-suite success or
ordinary-game acceptance is inferred. The earlier proxy-denied public route
remains unretried.
This header-only slice adds four composition edges: 224 modules/428 local edges,
140 browser/95 server/34 shared modules and zero cycles. Main's distinct local
dependencies become 78 and server's 76; all existing imported names remain.
Further host extraction still needs a useful interface and concrete write scope;
this allocation does not authorize construction/Patrol or a broad host refactor.

#### Editable scenario-event graph responsibility — 6 October 2026

After the PR512 caller migration, the next existing authoring responsibility is
the two Map Studio graph queries still in `main.js`, used by capturing-team
reconciliation and source eligibility. The input is the current draft event array
with explicit IDs; capture-root lookup also accepts the caller's cache and visiting
set. Outputs are the same root ID/`null` and cycle boolean. They need no DOM,
storage, timer, renderer, running match or host context. Incomplete/cyclic drafts
make these authoring queries distinct from authoritative map validation; use the
existing canonical authoring module and its world source-ID reader rather than
moving UI policy into the authority validator.

Contract preparation at `d106ceb0` runs through the actual old host functions:
single/all-of/mixed/missing roots, cache precedence and traversal/identity, cycles,
replaced arrays, actual eligible sources and exactly the same team reconciliation.
Extraction preserves those function bodies apart from names, explicit array input
and recursive forwarding. The two named host wrappers remain default-wired, and
every other host byte/import remains unchanged. Existing history/gesture/coordinator
bodies, the legacy two-export namespace and every canonical/legacy public path
stay supported. The actual draft fixture receives production exports, preserving
all old controls rather than copying query implementations or renaming tests.

The containing refresh to `d27728f8` includes core PR513's construction body
admission unchanged, with no overlapping file or hunk in this extraction. The
template draft consumer also executes the production wrappers using browser-realm
cache/visiting objects, reconciles the same recipients and autosaves the exact
event bytes without mutating the running map.

Movement core `01a107ba` retains shared admission/planning; caller/construction
`01a10933-e913` retains Patrol and construction functions. Open PR508's replay
fixture work is separate. No server/executor/movement/caller function, art,
save/protocol/rules version, quota, admission, package/CI/AGENTS/testing discovery,
manifest or source-domain registration changes. This creates no module or public
path: one authoring→world edge yields 224 modules/429 local edges, unchanged
140 browser/95 server/34 shared and zero cycles. The helpers have real editing
consumers; source/pack/deployment proof and ordinary rendered draft acceptance
remain separate. Do not retire any compatibility surface from these migrations.

### Coupling and size ratchets

Use the audited values above as a starting comparison and record each scoped
PR's source revision, affected importers, cross-domain edges, shared-host edits,
physical lines and remaining source-slice fixtures. Keep zero new cyclic edges,
zero runtime→tool edges and zero public→private-adapter edges as hard invariants.
An organization-only PR must not add another unrelated responsibility to a host;
an extraction removes its body and leaves only explicit wiring there. Record
intentional increases from a shim or new composition dependency rather than
gaming totals. High registry fan-in, a composition root's fan-out and pure helper
size have different meanings; no universal line/import/coverage score certifies
quality. After a domain is separated, ratchet its forbidden imports and keep its
previously removed responsibility from drifting back into the host. Expand any
size boundary only for a concrete cohesive behavior, with the owner and reason
in the PR. Fewer host edits by independent domain work and direct tests of real
exports are the practical success measures.

Neutral stationary Sheep use optional wildlife identity on an existing food node
and one conserved stock pool. Worker arrival activates its carcass once; both
seats reuse normal cargo/drop-offs. Species/lifecycle are fog-filtered with the
resource snapshot and saved in checkpoint schema 22, which rejects inconsistent
lifecycle/stock and migrates schema 19 ordinary maps. This is the
[neutral food foundation](wildlife-bellweather-sheep.md#implemented-neutral-food-foundation--3-october-2026),
with claim/herding and client art integration left as separate work.

Building placement compares connectivity before and after its proposed footprint.
It preserves existing connections among bases, units, resources, and building
access, including Town Centers, without requiring separate authored islands to
connect. Exact-zero resource stock releases the node's footprint exclusion and
resource access point; positive or unknown stock retains both. The browser uses
disclosed stock and restores the authored exclusion on reset epochs and welcome
receipts before applying current disclosed rows, including fog-hidden same-map resets.
Footprint occupancy and active move-route checks apply independently;
see [construction evidence](qa-construction-connectivity-2026-09-27.md).

Archer building attacks use reachable cells within weapon range as approach
goals; Infantry use the building perimeter. Shared flow fields distinguish unit
kind and connected region. Construction repair preserves attacks already within
actual unit-to-building range before searching approach-cell centers.
See [Archer approach evidence](qa-archer-firing-approach-2026-09-27.md) and
[range-boundary repair evidence](qa-building-range-repair-2026-09-27.md).

## Shared gameplay definitions

`src/gameplay-definitions.mjs` owns validated production costs/times, current
building footprints, combat stats, research costs/times and stable presentation IDs. Server,
HUD and deterministic production policy consume this data. Existing command,
roster and checkpoint formats remain unchanged in the initial extraction.
Building production uses a FIFO list of unit IDs with registry costs and head-unit
training duration. The numeric queue count remains available to existing clients
and AI. Checkpoint schema 11 migrates schema-10 single-product queues; private
queue contents are visible only to their owner and spectators. HUD training uses
`trainUnit`; legacy training commands remain accepted.

`src/gameplay-presentation.mjs` binds unit presentation IDs to the current
procedural renderer’s detail and strategic-zoom roles and colors. Profiles are
immutable and validated; a gameplay kind can reuse a supported appearance.
Faction resolution and asset-backed profile loading remain follow-up slices in the [foundation plan](gameplay-foundation-plan.md).
A presentation ID is a binding identifier; it does not yet load an animation.

## Code map

| Files | Responsibility |
| --- | --- |
| `room-supervisor.mjs` | Room creation/join, public routing, worker lifecycle, shared access control, persistent room index. |
| `server.mjs` | Map validation, command handling, simulation, state filtering, WebSocket transport, checkpoints, static allowlist. |
| `origin-policy.mjs` | Browser-origin validation for direct and proxied requests. |
| `simulation-scheduler.mjs` | Fixed-step scheduling and overload accounting. |
| `src/main.js` | Browser integration, rendering, input, Map Studio, and snapshot reconciliation. |
| `src/map-utils.mjs`, `src/elevation.mjs`, `src/map-resize.mjs` | Shared map validation, connectivity, elevation costs, and editor resizing. |
| `src/formation-assignment.mjs`, `src/unit-selection.mjs` | Formation and selection logic used by focused scenarios. |
| `src/wall-line-planner.mjs`, `src/wall-placement.mjs`, `src/wall-placement-ghost.mjs` | Shared atomic wall geometry, disclosed-cell placement/input state, and bounded connected preview instances. |
| `src/pve-*.mjs` | Seeded solo launch, filtered opponent observation, deterministic policy, optional fake-provider research helper. |
| `src/hud-layout.mjs`, `src/selection-context.mjs`, `src/objective-summary.mjs` | HUD geometry, selection actions, objectives, and notice history. |
| `src/*visual-state.mjs`, `src/environment-art.mjs`, `src/captured-building-art.mjs`, `src/building-sprites.mjs` | Snapshot-to-art mapping, environment batches, directional Town Center views, and Barracks/Range sprites. |
| `src/town-center-spawn.mjs` | Shared Town Center position and server collision footprint. |
| `src/audio.mjs`, `src/audio-policy.mjs` | Synthesized audio, mix settings, cue policy, and caption decisions. |
| `maps/`, `assets/`, `schemas/` | Authored content and versioned asset contracts. |
| `scripts/` | Regression scenarios, captures, authoring helpers, validators, and release tooling. |

## Commands and visibility

Seats are assigned by the server. Commands never choose their own team.
Ownership, generations, resources, population, visibility, and reachability are
checked before mutation. New orders supersede stale move plans; reset and map
changes cancel pending work.

Fog filters enemy units, structures, resource stock, and private intent. Objective
locations and ownership are public, but capture progress requires visibility of
the entire zone. The PvE policy receives a narrower allow-listed observation.
Read the [command and observation contract](gameplay-command-observation-contract.md)
before changing any of these boundaries.

## Persistence and transport

The supervisor persists invite metadata and gives workers separate map and
checkpoint paths. Workers capture authoritative state every 30 simulation ticks
and write atomically. Schema/rules validation decides whether a checkpoint can
be migrated, restored, or rejected.

[Pregame invite rooms](room-lobby.md) use the existing seat sessions and isolated
workers. `src/room-pregame.mjs` owns revisions, readiness and the launch gate;
the client panel is in `src/room-lobby-ui.mjs`. Schema 22 adds the optional
pregame phase and migrates schema 21 matches without resetting their running
state. Both unit simulation and scenario execution wait for explicit launch.

Outbound state coalesces for slow readers; per-peer queues and inbound messages
are bounded. Resume tokens are room-scoped and persisted as hashes. The detailed
`/health` response exposes timing, queue, and checkpoint diagnostics.

## Where to make a change

Keep rule changes in the authoritative path and update their scenarios. Put
reusable data checks in the shared modules when both editor and server need them.
Keep asset bounds separate from collision footprints. Extract small modules from
the large client/server files when a concrete change benefits from it.

Deployment instructions belong in [deployment](deployment.md); numeric settings
belong in [configuration](configuration.md); asset format rules belong in their
[specific contracts](assets.md). Avoid copying those details into status reports.

## Roster production options

Barracks produces Infantry and Spearman through the same persisted FIFO.
Contextual production choices and Map Studio unit selectors are generated from
registry entries; selection and group summaries count every registered kind.
Spearman currently reuses the procedural melee placeholder with a distinct tint.
The bounded AI adds Spearmen toward one per three Infantry when reserves permit.
Its mounted counter and the Stable arrive with F3 combat classes.

## Population capacity

`src/population.mjs` derives used and reserved population from live units, FIFO
product IDs and Town Center worker queues. Only completed friendly capacity
buildings contribute; House destruction never mutates units or paid queues.
Commands validate a new reservation before deducting resources. Owner/spectator
snapshots expose capacity; the opponent DTO projects only its own record.
Rules revision 6 deliberately adopts the population economy and migrates
compatible revision-5 saves while preserving existing queues and overcapacity
armies. Explicit stress fixtures retain their opening capacity.

### Resolved gameplay identity and action availability

The shared registry validates stable content and compact unit wire IDs, faction
roster references, production products, technology upgrade keys and prerequisite
cycles (including a research building requiring its own technology). Its canonical
SHA-256 revision excludes labels and presentation bindings; gameplay values and
ordered product lists participate. Snapshots carry the revision, default faction
and unit wire mapping. A browser with a different revision asks for a reload
before applying the state.

Each unit in a faction roster must be trainable by at least one building in that
faction's building roster. A globally registered producer outside the faction
does not satisfy this check. Producers may share products, and a unit may move
between producers; every product must still belong to the faction's unit roster.
Validation names the faction and unit when a roster loses its last producer.
Frontier is the only registered gameplay faction; Vaelora's regional art and lore
do not register additional playable civilizations.

Checkpoint schema 13 pins this identity. Schema 11 saves migrate to the current
compatible opening roster; an unknown pinned revision is rejected and the exact
save is renamed to a `.rejected-*` file before a fresh match starts. Future roster
changes must supply and test an explicit compatible migration rather than silently
reinterpreting paid queues or saved entities.

`src/production-actions.mjs` derives product availability, prerequisites and
rejection reasons from authoritative resources, reservations and safety limits.
Commands repeat these checks before spending. Own-seat options are projected to
the HUD and AI; no-fog broadcast caching shares the public roster but masks enemy
product names and population. Building construction and persisted geometry use
registered odd footprints (one to nine cells wide). Unit and building presentation
profiles bind supported procedural roles independently of gameplay identity;
they do not claim a skeletal animation backend.

Mill is additive Frontier content using `dropoff: ['food']` and the existing
construction, route selection, cancellation, repair and destruction handlers.
The HUD derives accepted resources from that list. Its `building.mill` profile
explicitly reuses the procedural House; no captured Mill asset is registered.
Schema 22's exact pre-Mill ruleset `v1:fe00d0541953e6ed6d2c4e121789dd26fa6a962abce9ab8b4de1f067064ad801`
migrates to the new revision without changing the persisted shape, existing
stats, resources, identities or paid queues. Unknown revisions remain rejected.
The earlier pre-palisade revision retains its existing guarded migration.

### Base lifecycle commands

`src/rules/base-lifecycle.mjs` defines bounded proportional refunds and paid repair
steps from validated lifecycle policy; `src/base-lifecycle.mjs` retains its two
named compatibility exports. Cancellation commands verify seat ownership
and unfinished state before removing a foundation, queue entry or active research.
Queue cancellation resets a replacement head's timer and releases precisely the
removed reservation. Legacy Town Center Worker queues retain their compatibility
command while using the same refund calculation.

Worker `repairing` state shares construction access/routing and is optional in
older saves. Schema 12's known Storehouse revision migrates to schema 13; unknown
content remains rejected. Repair pays for each HP increment, waits with an active
order when wood is exhausted, and stops at registered max HP. Normal Worker orders
clear the repair mode. Renderer action mapping reuses the construction capability.
The deterministic policy can repair observed damaged friendly buildings with a
wood reserve and bounded retries; it suppresses competing gather orders for the
chosen repairer.

### Starting and expansion Town Centers

Registered `town-center` expansions use generic construction, FIFO production,
population, repair and drop-off routing. Starting centers are separate
`homeTownCenters` snapshot records with reserved entity IDs from 1,000,000,000;
their production accessors preserve the compatibility `workerProduction` queue
without counting reservations twice. Clients and filtered AI observations combine
these records with constructed buildings. Destruction removes collision, vision
and production while retaining a dead home record in checkpoints. Cargo only
banks at a reachable living completed friendly drop-off; a destroyed home is
never a permanent deposit marker. Schema 14 explicitly migrates the known schema
13 ruleset, and preserves unknown pinned revisions for diagnosis.

### Stationary defenses

Optional validated building `combat` and `sight` definitions drive Watchtower.
Its scans use rotating enemy spatial buckets with a 64-visit budget and stable
ID ties. Unit visibility gates targets, and tower hits accumulate before shared
unit/building damage resolution, preserving lethal same-tick trades. Quarter-second
idle backoff avoids scanning empty areas every tick. Saved cooldowns prevent
restart from granting a free shot; schema 15 migrates the known Town Center
revision without changing existing HP or queues. Vision coverage caches separate
radii per source cell, so a tower can expand previously processed unit sight.
Enemy shot destinations are masked under fog like unit attack coordinates.

### Shared damage and supported effects

`src/combat-rules.mjs` resolves unit and stationary-defense damage from validated
content. Attack classes/tags, numeric armor, target eligibility and multipliers
are data; gathering, building, repair and structure-attack permissions use explicit
supported capabilities. Technology effects support damage multipliers and additive
armor by declared class; unsupported effect operations fail validation. Completion
state determines effects for both existing and newly produced entities. Cached
resolved effects invalidate when that state changes, including rematch, and use a
stable content-ID order. Numeric ranges are bounded at 16 cells. Schema 16
explicitly migrates the known defense revision without rewriting entity HP/queues.

The validator rejects unsupported combat fields and capability names, even when
a content edit adds that name to `combatRules.capabilities`. A new behavior needs
a runtime handler and an explicit contract change before content can declare it.

| Contract | Supported content |
| --- | --- |
| Unit combat | Required object: `mode`, `attackClass`, `targetTags`, `tagMultipliers`, `maxHp`, `moveSpeed`, `range`, `damage`, `period`, `structureDamage`. Numeric stats are finite and positive; range is at most 16 cells. |
| Unit capabilities | `move`, `attack`, `attack-structures`, `gather`, `build`, `repair`. Every unit requires `move`: the runtime does not support immobile unit definitions. |
| Damage classification | Buildings require the `structure` tag; units cannot have it. This tag selects the structure damage stat instead of ordinary damage. |
| Structure attacks | A unit with `attack-structures` needs at least one eligible building target using tag intersection, including specialized targets such as `defense`. An explicit `structure` target tag requires that permission. `attack` controls unit targets independently, so a structure-only attacker is permitted. The Worker's existing positive `structureDamage` remains dormant without the permission and eligible targets. |
| Building combat | Optional object: `mode`, `attackClass`, `targetTags`, `tagMultipliers`, `range`, `damage`, `period`. Defenses scan unit targets only, so `structure` targets and unit-only combat fields are rejected. Building HP remains the top-level `maxHp`; building capabilities are unsupported. |

Both combat modes are `melee` or `ranged`; attack classes, target tags and
multipliers must reference the declared vocabularies. Armor is nonnegative by
declared class. Declaring projectile speed or splash radius does not add a
projectile or area-damage behavior and fails validation.

Technology availability is derived by `src/research-actions.mjs` for authoritative
commands, building option snapshots, HUD and the filtered opponent adapter. Stable
technology IDs map to registry upgrade keys; fresh completion records enumerate
all definitions. Schema 18 migrates the known mounted revision by filling new keys
with false while retaining old completions and active research. Active home Town
Center research validates against its reserved ID, matching team, surviving HP and
Town Center research type. Enemy legal research options are masked alongside paid
product queues, including no-fog shared snapshots. Presentation reads completion
state and legal choices without mutating combat stats.

Siege Engine exercises registered ranged structure approach cells, siege damage
class and tag modifiers without adding a combat branch or projectile subsystem.
Workshop and the engine use registered prerequisites and generic legal production.
Schema 19 explicitly migrates the known progression revision, filling the new
technology key while retaining completions and active projects. The opponent's
siege assault lane reads only filtered building observations: two engines and at
most 64 visible defense candidates, with generation-aware assignment, observed
progress and a ten-second stalled-order retry. It excludes assigned engines from
ordinary army orders and releases them when the target leaves the observation.
