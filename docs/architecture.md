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

There are **no cyclic edges** at that revision, including lazy imports.
[`runtime-import-baseline.json`](../scripts/fixtures/runtime-import-baseline.json)
records this explicit empty baseline. The checker compares every cyclic edge,
including self-imports and new edges within an existing cyclic component.
New edges fail; resolved entries must be removed from the baseline. Do not
regenerate the ledger to admit a new cycle or add wildcard/module exemptions.

The useful target domains are responsibilities first; these directory names
are destinations for future small, cohesive moves, not a rename plan:

| Domain | Existing evidence | Dependency direction |
| --- | --- | --- |
| `src/rules/` | `gameplay-definitions`, `gameplay-action-rules`, `production-actions`, `research-actions`, `economy-profile`, `palisade-profile`, `farm-harvest` | Browser, simulation and AI consume rules and validated definitions. Rules do not import their hosts, UI or rendering. Keep shared business-rule extractions with their existing quality owner. |
| `src/world/` | `map-utils` → `elevation`; `shore-fishing-placement` → `map-utils`, `town-center-spawn`, `shore-fishing` | Simulation and browser authoring consume portable topology/placement helpers. Authoring may consume rules; shared topology must not depend on editor controls. |
| `src/presentation/` | `environment-art` → Three, terrain/world helpers and plant packs; `selection-portrait` → definitions, building sprites and resource formatting | Rendering/audio/HUD consume disclosed snapshots, rules and world data. Authoritative simulation does not consume renderers or mutate gameplay through presentation. |
| `src/client/` | `game-entry` lazily imports `main`; `main` composes lobby, input, HUD, world authoring and presentation | Browser entry/UI code composes lower domains and owns DOM, storage, audio and WebSocket interaction. Lower domains do not import browser boot code. |
| `src/server/` and root Node hosts | `room-supervisor` → `room-launch-options`; `server` → shared rules, topology and deterministic PvE; `pve-model-proposal` is an offline Node adapter | Node adapters depend on portable rules/world helpers. Supervisor, transport, persistence and scheduling stay outside browser closures. |
| `scripts/` | Scenario runners and asset/release tools import runtime helpers | Tools/tests may consume runtime modules; runtime modules must not consume tools/tests. |

These directions guide extraction. The first executable safeguard is narrower:
runtime imports must resolve to exact relative runtime modules, Node builtins
or the mapped `three` package. All `src` modules stay within `src`; only the two
named Node adapters may import Node builtins. Browser closures cannot reach a
Node adapter or unmapped package, and server closures cannot reach Three or a
browser entrypoint. Package imports must match every consuming page's import
map; the audio pages have no Three mapping. A contract test checks the five
registered entrypoints against their shipped HTML. Register a new entrypoint
and its document's package policy together. This checks import edges, not browser globals, injected
callbacks, runtime asset fetches or gameplay semantics. It also scans unreferenced
`src` modules and nested folders, so new files cannot evade the cycle check.

Acceptance is safer parallel ownership, not folder count or reduced line count.
A shared-rule owner can change a helper's internals and focused contracts while
the world owner changes topology and the presentation owner consumes disclosed
state, provided their exported signatures and value semantics remain stable.
Those changes need no edits to `main.js` or `server.mjs`; host edits belong to
actual orchestration/interface changes. The source graph protects this first
boundary by refusing imports back into hosts, tools, browser boot or Three from
authoritative rule closures. Check consumer regressions before claiming a stable
interface. This slice itself edits no runtime files and touches the shared CI
registry only to register its two checks.

The browser uses native ESM without a bundler. `index.html`, the environment
review and water study map `three` to `/vendor/three.module.js`; the server serves
that module and `three.core.js` from the installed package. `server.mjs` admits
client module paths explicitly. Docker copies `src/` recursively, while the
release packer audits Docker COPY inputs and `.dockerignore`. Passing the source
graph check therefore does not prove HTTP admission or release inclusion:
retain the [served and packed import checks](testing.md#repository-checks).
Acorn is a pinned development dependency; production installs omit it.

The first folder-migration candidate is the offline `pve-model-proposal.mjs`
Node adapter, which is outside browser closures and normal hosted simulation.
Its sole current source importer is `scripts/pve-opponent-scenario.mjs`, so that
move can establish a Node-adapter folder without a `main.js`/`server.mjs` edit.
Before moving it, agree that exact scope with the existing quality owner through
the producer and refresh its importers. Keep the active room-launch/game-mode
and gameplay hot spots out of this first migration. For a served module, update
HTTP admission, imports and release tests together; preserve an existing public
path only with a deliberate compatibility module forwarding the required named
exports, a named removal owner and a removal condition. Avoid broad barrels.
This check-only slice moves no files and changes no runtime binding. Deployment
and in-game acceptance remain with the producer's release stream; they are not
claimed by these source checks.

### Continuing boundary workstream

Goal: preserve stable exported contracts and reduce shared-host edits so rules,
world, UI/presentation and tooling owners can work safely in parallel. The
boundary owner retains each slice through reviewed integration and its actual
source/tool acceptance. Use the [continuing-work guidance](contributor-planning.md#continuing-workstream-bounded-pr)
for checkpoints and real stop conditions.

| Rank | Next action and evidence | Bounded write scope | Dependency and acceptance |
| --- | --- | --- | --- |
| 1 | Unify source/served import parsing. The served audit currently fetches a commented `import './ghost.mjs'` and passes a missing dependency written as valid `import{value}from'./missing.mjs'`. | Import-parser helper, the two audit scripts and focused fixtures; no runtime hosts. | Existing parser is ready. Both counterexamples, lazy/re-export/origin fixtures, source graph and packed-release checks must pass; preserve `checkClientImports` arguments/results. |
| 2 | Move the offline PvE Node adapter into a cohesive server-adapter domain. | `src/pve-model-proposal.mjs`, its new implementation path and sole scenario consumer; preserve exported signatures. | Agree this exact first runtime-module scope with the existing quality owner through the producer. Fake-provider policy tests and source graph must pass; no hosted mode, credentials or spending changes. |
| 3 | Separate client-module admission data from the HTTP host when the server owner is ready. Repeated central allowlist edits currently require touching `server.mjs` for each served helper. | A narrow module-path manifest, its server consumer and serving/release contract fixtures. | Agree the manifest format and ownership with the server owner before edits. Preserve exact admitted/denied URLs, origin/MIME behavior and packed imports; retain runtime release acceptance with the producer. |

Select the next useful ready item after each small merge. Coordinate real
overlap rather than moving gameplay hot spots speculatively. A paused dependency
does not block the independent tooling item or another owner's gameplay work.

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

`src/base-lifecycle.mjs` defines bounded proportional refunds and paid repair
steps from validated lifecycle policy. Cancellation commands verify seat ownership
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
