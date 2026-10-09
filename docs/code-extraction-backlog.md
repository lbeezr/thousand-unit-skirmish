# Code extraction and maintainability backlog

Owner: the code extraction workstream in source task
`01a0f784-c5d7-72e0-82e8-1747b4c840c1`. Update this queue in each owned slice.
Repository issues are disabled. This note records bounded extraction work;
product priorities remain in the roadmap. Dedicated type, error and architecture
owners retain their tooling and broader migrations.

## Ranked queue

| Rank / state | Evidence and next action | Write boundary | Dependencies and acceptance |
| --- | --- | --- | --- |
| 1 — [PR170 transport contract](https://github.com/lbeezr/thousand-unit-skirmish/pull/170), native acceptance open | The server's 27-line deflate-offer rule was unchanged since prototype `691c6d2` and lacked a direct unit contract. Its raw header decision is now isolated with current negotiation behavior retained. Next: verify deployed fresh join, accepted/declined offers, compression and reconnect on an identified source containing PR164/170. | `src/networking/websocket-deflate-offer.mjs`, one server import/call/removal, dedicated tests, adjacent CI coverage registration and this note. No further source writes reserved. | 38 literal cases, 9,223 author baseline decisions, strict checkJs, 10 real handshakes and package smoke pass; independent review adds 21,179 comparisons and repeated-header probes. Merge/deployed checkpoints live in the PR. Native execution is currently unavailable here; quality owner retains acceptance. |
| 2 — audited, no extraction selected | Tick duration and start lag repeat small local ring-window quantile calculations in `tickTimingPayload`. Browser/pathfinding/staging helpers differ in rounding and empty results, so a cross-tool utility is unjustified. The two local copies currently do not establish a useful separate shared interface. Revisit when a diagnostic consumer needs that contract or a concrete fault exposes it. | No writes reserved. Counters, scheduler, performance policy and broader directory strategy remain with their owners. | Preserve output names, nulls, rounding and window behavior if a future slice is justified. Do not extract solely to move lines or turn a possible convenience into an architecture project. |
| 3 — checkpoint domains integrating through architecture owner | The historical audit found roughly 400 checkpoint lines and a main client exceeding 10,000 lines with 54 imports. Stable envelope, map and scenario-state contracts now have real default consumers. Saved living/queued population and Bannerfall roster/result validation is integrated in [PR530](https://github.com/lbeezr/thousand-unit-skirmish/pull/530). The [current organization queue](architecture.md#remaining-organization-queue--6-october-2026) selects future responsibilities after owner/interface agreement; the completed roster slice is not a pending task. | Architecture retains the integrated roster contract and its source/release/served acceptance; no further roster writes are reserved. Other checkpoint domains, movement, construction, HUD, rendering, combat, animation, lab entry, live mode policy, Skiff, AGENTS and shared planning-guide ownership remain unchanged. | Retain exact ordered body/errors, explicit host caps, saved identity, real validate/restore/native consumers, private HTTP denial and all CI entries. Independent review, normal merge and exact package/staging reconciliation remain separate from served/rendered acceptance. No bulk moves or generalized validator context. |

## Standalone water study controller — 9 October 2026

The organization lane in this source task owns the bounded move from
`src/water-study-preview.mjs` to `src/studies/water/preview.mjs` on
`codex/water-study-controller-home-20261009`, based on clean main
`2c0fcb4e41ad9a0fc2a1e44e10d9c9e2b2ee9b9a`. The retained `/water-study.html`
entry is the controller's only runtime consumer. Production geometry, surface,
state and live fish binding stay in `src/presentation/rendering/water/`.
This completes only the water controller portion of the
[source-role inventory's standalone-page proposal](source-organization-inventory-2026-10-07.md#proposed-next-batches-and-ownership).
Environment study controllers remain a separate unallocated candidate; audio,
diagnostics, movement, HUD and active PR614/616 integrations are outside this slice.

The refreshed root inventory at that baseline has 180 files: 175 JavaScript
modules and five stylesheets, including 21 compatibility-only modules and six
generated descriptors. The 148 implementation modules include three standalone
study modules and two unresolved modules (`building-production-cue.mjs` and
`painted-material-atlas.mjs`). This move retires one implementation path without
adding a stub; historical inventory/evidence stays pinned to its original source.
No supported CLI or external module consumer was found for the old controller.

Write scope is the controller and HTML entry, exact browser/domain/HTTP path
registrations, existing import/admission/package guards, this owning backlog and
the water guide. Preserve the controller body, DOM controls, query/time/disclosure
semantics, asset URLs and production renderer bytes. Exact path replacement in
the review-only admission set retains authenticated-only study access; it does
not grant anonymous access or widen directory admission.

Next transition: independent review and exact-head import/type, affected water,
public-route, client-admission and packed-release checks, then a qualified draft
PR. The PR retains exact source/check receipts and clean release digest. Art
backing is N/A because there is no presentation change. Source organization is
the scoped outcome; no merge, provider deployment, asset publication, native Mac
or ordinary rendered acceptance is authorized or claimed here. Existing movement
CI failures remain owned by the movement lane.

## Integrated code milestones

| Slice | Merge and evidence | Remaining acceptance |
| --- | --- | --- |
| [Bounded shipped-audio reader, PR138](https://github.com/lbeezr/thousand-unit-skirmish/pull/138) | `af36898d4cf7857bbfa4a09e5dbbc3f4cc2d70f8`; 132 tests, safe fixed expected-error messages, retained programmer/cancellation failures, narrow 100% coverage and local delivered/package proof. Independent review is recorded in the PR. | Native delivered audio/mute/recovery acceptance on an identified deployed source. |
| [Shared action rules, PR144](https://github.com/lbeezr/thousand-unit-skirmish/pull/144) | `8bfbc3c066ac4574a13544c8b7aa0295c31849f7`; 128 tests, 80,640 comparisons, exact reason order/epsilon and native production/research/refund/restart/package proof. | Deployed action acceptance; the PR contains the native recipe. |
| [Outbound frame/count contract, PR164](https://github.com/lbeezr/thousand-unit-skirmish/pull/164) | `14590fb2189f76c3babb3a5e43e9a2c5edcac76b`; six files, 119 additions/27 deletions. 42 tests at 100% helper coverage, 497 baseline comparisons and real hardening/slow-reader/compression/resume probes. [Exact integration review](https://github.com/lbeezr/thousand-unit-skirmish/pull/164#pullrequestreview-5403208630) passed; actual merged source passed 50 framing/fixture/import/CI/objective tests and packaged release. | Fresh authorized join/state/control frames, negotiated compression and reconnect on a SUCCESS deployment containing the merge. |

## Runtime ownership and execution limits

The quality owner retains these acceptance steps, coordinated with the source
task parent's staging deployment and native QA. No independent redeploy or
config/auth change is authorized. Read-only Railway inspection now confirms
SUCCESS deployment `df65855c-57e3-4979-a345-1c7e83e90173`, source
`0fb9a3dcc1f93f44b87fe5ea8ab8caabf9da0739` (3 October, 22:55 UTC).
Git ancestry includes PR138/144/164; this establishes deployment inclusion,
not native acceptance. PR170 is excluded until a later deployed source contains it.

In this executor, staging CONNECT probes failed with proxy 403 before application
HTTP, and supported Chromium preflight reported unavailable sandbox/storage.
Do not bypass either. PR144 and PR164 own the prepared native recipes; passing
local tests or a deployment alone does not establish listening/native acceptance.
Tooling-only slices need their real tool/check acceptance, not a game deployment.

## Organization handoff

PR164 records the inspected graph: baseline `94fb803` had 146 direct source
files, 141 JS modules and no subdirectories. The static runtime graph had 247
local edges and no cycles; dynamic imports and tests/tools were outside that
count. History starts with six flat prototype modules and incremental additions.
The lack of a planned domain migration is an inference about that history.

The architecture owner retains graph guards, folder strategy and consumer
migrations. The two transport leaves use direct named exports without barrels
or dependencies back into simulation, rendering, UI or entry roots.
Checked-type tooling and error policy remain with their dedicated owners.
