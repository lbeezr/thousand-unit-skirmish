# Source roles and conventions

This is the file-placement reference for contributors and agents. Product priority
stays in the [roadmap](roadmap.md), dependency policy and supported migration
interfaces in [architecture](architecture.md#stages-ownership-and-stable-entrypoints),
and task ownership in the existing workstream guides. This guide creates no
additional approval queue or general rewrite. Its [7 October inventory](source-organization-inventory-2026-10-07.md)
records observed consumers and unresolved roles separately from proposed paths.

## Determine the role before choosing the path

| Role | Evidence required | Placement |
| --- | --- | --- |
| Shipped default runtime | Normal game/server entry, actual consumer, default call or loader and release inclusion. Import reachability alone establishes loading, not invocation or rendered acceptance. | `src/rules/`, `src/world/`, `src/simulation/`, `src/presentation/`, `src/client/`, or `src/server/` according to responsibility. |
| Optional shipped feature | Real runtime caller plus the mode, query parameter, content or capability condition that enables it. | Inside its runtime subsystem and feature directory. An optional feature is production code, even when the default mode does not invoke it. |
| Editor or tool | HTML/CLI/package entry and actual edit/build/validation consumers. Record whether it ships and how it runs. | Browser map editing in `src/authoring/`; browser audio tools in `src/client/audio/`; Node/build/QA tools in purpose-based `scripts/` directories. Preserve supported launch commands. |
| Experimental study | Separate study entry or explicit experimental switch, owner, reason and adoption/retirement action. Shared runtime dependencies retain their production home. | New standalone browser studies in `src/studies/<subject>/`; study runners in `scripts/` under their purpose. Do not move default rendering to studies merely because its old name says study. |
| Test or fixture | Registered test/scenario consumer and isolation from shipped entrypoints. | Existing `scripts/*.test.mjs`, domain scenarios and `scripts/fixtures/`; follow the [tool organization stages](architecture.md#tests-fixtures-scenarios-and-performance-tools). Do not place new test doubles in `src/`. |
| Generated asset or descriptor | Named producer and exact output path, consumer, version/manifest and provenance. Distinguish source, output and evidence. | `assets/<subsystem>/<pack>/` for content; a consumed code descriptor can live in `src/presentation/assets/<feature>/`. Update its producer when migrating it. Preserve private source/evidence restrictions and supported URLs. |
| Compatibility entrypoint | Identified supported command, URL or import, owner and canonical implementation. | Existing supported path until its specific retirement conditions pass. Forward named bindings only; avoid duplicate implementation, singleton or cache. |
| Unknown or apparently unreferenced | Inventory runtime static/lazy loaders, HTML, tools, generators, tests, flags and release manifest before claiming absence. | Retain the file and record the unresolved consumer/owner question. No deletion or dead-code claim based on filenames or one graph. |

The categories can overlap: an editor is shipped, a generated descriptor can be
used by default runtime, and a study can share production shaders. Record both
the role and the execution condition. Package presence and HTTP admission are
separate facts. The whole `src/` tree is copied into the release; the exact
client allowlist determines which modules can be requested publicly.

## Subsystem homes and names

Use the existing [destination map](architecture.md#module-dependencies-and-gradual-organization)
and exact `RUNTIME_DOMAINS` memberships; do not infer authority from the current
flat path. These directory responsibilities refine that map for new files:

| Home | Responsibility and examples |
| --- | --- |
| `src/rules/<feature>/` | Portable definitions, prices, prerequisites and validated action rules. No DOM, rendering, socket or accepted-tick state. |
| `src/world/<feature>/` | Map topology, placement, regions and scenario contracts shared deliberately by runtime and authoring. |
| `src/simulation/<feature>/` | Authoritative combat, economy, construction, movement, wildlife and naval execution. State mutation remains separate from presentation. |
| `src/simulation/ai/policies/` | Seeded policies that consume disclosed observations and emit ordinary commands. `home-defense.mjs`, `regroup.mjs`, `reconnaissance.mjs`, `skirmish-targets.mjs`, `objective-rotation.mjs`. Observation projection stays in `src/simulation/ai/opponent-observation.mjs`. |
| `src/presentation/rendering/<feature>/` | Render disclosed state, batches, materials and lifetime; map/forest/water rendering belongs here when its owner migrates it. |
| `src/presentation/assets/<feature>/` | Runtime image/pack loading, descriptors, atlas binding and approved asset selection. |
| `src/client/<entry|input|hud|lobby|audio|networking>/` | DOM, input, client recovery, selection, settings, room UI and playback. Client controls can consume portable world/rules; they cannot become simulation dependencies. |
| `src/authoring/<feature>/` | Editor state, gestures, generation, draft/history and import/export. Shared map validators belong to world or the authoritative server adapter. |
| `src/server/<transport|persistence|orchestration>/` | Node adapters, private I/O, sockets and process orchestration. Root server launch entrypoints stay stable. |
| `src/studies/<subject>/` | Separately runnable browser comparisons/experiments, with their HTML entry and reason recorded. Use production dependencies through their canonical homes. |

Use lower-case hyphenated names that describe the responsibility. Prefer
`simulation/ai/policies/home-defense.mjs` over a root file carrying both a mode
prefix and an ambiguous role. Choose a subfolder only for a coherent feature
with real consumers; do not create a generic `utils/`, `shared/`, `misc/`, `old/`
or an all-domain `index.mjs` barrel. Split implementation from composition
before moving a mixed host. Existing `.js` entrypoints and `.mjs` modules keep
their supported extensions; naming work does not authorize bulk conversion.

Put a genuinely pinned format or implementation in `<subsystem>/<feature>/v1/`,
as already demonstrated by `authoring/map-studio/draft/v1/contract.mjs`.
Unversioned lifecycle and coordination stay outside that directory. A DTO's
version field does not version every policy consuming it. Add `v2/` only with
its real reader/writer, version selection and compatibility decision. Preserve
versioned asset pack names, public URLs, manifest identities and historical
evidence; do not manufacture `latest/` aliases or rewrite history.

## A bounded migration

Record old/new paths, actual consumers, owner and behavior contract before
editing. Agree an actual overlapping write with its owner. Move implementation
and real callers together; keep assertions, seeds, error order and workloads.
Inventory tests/tools/docs and external supported imports before retiring a
path. A private policy without a supported old-path API does not need a stub;
public browser helpers retain their explicit compatibility obligations.

Update exact domain memberships and negative dependency tests with each move.
Use a retired-path guard where a deliberately removed private implementation
must not return to the root. Existing recursive syntax/discovery and import
guards cover nested modules; do not add a broad type/lint ratchet without a
demonstrated weak contract. Verify source imports/cycles, actual consumers,
private/public HTTP admission and clean release inclusion. Record exact source,
package digest, provider source, served identity and rendered acceptance as
separate evidence. Do not count retained stubs as migrated implementation.

The current five-policy slice changes no AI decisions, protocol, type rollout,
asset, map, gameplay balance, security policy or deployment. Remaining subsystem
batches and owners are recorded in the inventory, not allocated by this guide.
