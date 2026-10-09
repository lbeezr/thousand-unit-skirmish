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
The environment controller continuation is scoped below; audio,
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

Integrated in [PR617](https://github.com/lbeezr/thousand-unit-skirmish/pull/617)
at `fe86f05cba09568a0420eae2cbdf31b8136f68c4`, after qualification at
`3c3d5638c6b425456a95b47b98faffa161aad0fc` over `af77e334`. The final merged
tree exactly matches that qualified tree. Imports and packed controller serving
passed again at the merge; the original 166/166 affected checks and independent
review receipts remain in the PR. Parent integration review confirmed hosted
failures also exist on the baseline. Source organization is the completed scoped
milestone; no provider deployment or ordinary rendered acceptance is claimed.

## Standalone environment review controller — 9 October 2026

The same organization owner continues the
[source-role inventory's standalone-page proposal](source-organization-inventory-2026-10-07.md#proposed-next-batches-and-ownership)
on `codex/environment-study-controller-home-20261009`, starting from PR617 merge
`fe86f05cba09568a0420eae2cbdf31b8136f68c4`. Move only the 114-line controller
from `src/environment-review.mjs` to `src/studies/environment/review.mjs`.
The retained `/environment-review.html` is its only executable consumer; the
controller exports no module API and is outside normal game/server closures.
The two relative imports retain their targets, `camera-controls.mjs` and
`environment-pilot.mjs`, alongside the same mapped `three` package.

Write scope is that controller and HTML entry, exact browser/package/domain and
HTTP path registrations, existing import/admission/packed-release guards, and
this canonical note. Preserve the body, controls, asset URLs, camera/probe timing
and authenticated-only controller admission. Retire its old root path without a
stub; no supported CLI or external module API was identified. Root files become
178 (173 JavaScript and five CSS); 21 forwarding entries and six generated
descriptors remain. The review-only pilot stays in place; its implementation,
shaders, asset paths and historical audit links are outside this slice.

PR617 supplies the nested-entry boundary fixtures and integrates the shared
registration files before this move. PR618's gameplay documentation, audio's
test/matrix, QA registration1476, diagnostic tests, movement, HUD and held
PR541/546/548 are separate owners. Reconcile fresh main before final qualification
without editing their files. Art backing is N/A because presentation is unchanged.

Integrated in [PR619](https://github.com/lbeezr/thousand-unit-skirmish/pull/619)
at `743e1030caf44698ee4cd300b60a13313921e65f`, after qualification at
`8dad9dd2f2df9122c1ba760ae018851dae891c57` over `f2ab964c`. Their tree IDs
match. Imports and packed controller serving passed again at the merge; exact-head
145/145 affected tests and independent 59/59 review receipts remain in the PR.
The parent retains downstream integration/deployment; no rendered proof is claimed.

## Standalone environment pilot helper — 9 October 2026

The same organization owner continues the inventory's explicit
`environment-pilot.mjs` → `src/studies/environment/` destination on
`codex/environment-study-pilot-home-20261009`, from PR619 merge
`743e1030caf44698ee4cd300b60a13313921e65f`. Its 74-line implementation moves
byte-for-byte to `src/studies/environment/pilot.mjs`; the existing study controller
imports `./pilot.mjs`. There are no normal game/server consumers. Shader strings,
texture URLs, creation/update/disposal order and uniforms stay unchanged. No art,
asset, default terrain binding or production renderer change belongs to this slice.

The sole new forwarding entry replaces the old implementation at
`src/environment-pilot.mjs`, explicitly exporting only `createEnvironmentPilot`.
Owner: the organization lane in source task
`01a0f784-c5d7-72e0-82e8-1747b4c840c1`. Its identified compatibility consumers
are the published exact module URL/API and the preserved
[historical cliff audit link](art-runtime-audit-2026-10-03.md). Retain that path and
its existing static access semantics. The canonical path receives the same exact
static admission; the study controller remains authenticated-only.

No retirement is planned here. Before removing this entry, its owner must inventory
tracked and supported external imports, preserve the historical source/reference
at its pinned revision without breaking its link, verify canonical coverage and
source/packed/served imports without the alias, and identify a containing release
that passes those checks. Zero current runtime callers alone does not retire it.
The existing 21 forwarding entries stay unchanged; this named entry makes 22.
Root count remains 178 files (173 JavaScript and five CSS), while one study body
leaves the root. Generated descriptors and historical evidence remain unchanged.

Write scope: the canonical helper, single root forwarding entry, controller import,
client domain/exact HTTP registrations, existing import/export/negative/admission
and packed-serving guards, and this canonical note. PR619 must integrate first.
Audio, QA registration1476/Frontier fixture PR620, diagnostics, movement, HUD,
gameplay records and held experiments keep their separate owners.

Integrated in [PR621](https://github.com/lbeezr/thousand-unit-skirmish/pull/621)
at `b6d619c3b5e6ef3965dd62a70c186bc205d79c11`, after qualification at
`531ebb0e97d6d5b10e6428ccc5f135885156a0fa` over `8ac6cb3c`. Their tree IDs
match. Imports, named legacy/canonical export identity and packed serving passed
again at the merge; 148/148 affected tests, independent 62/62 review and clean
release receipts remain in the PR. The alias stays owned under the retirement
conditions above. No browser pixels or provider deployment are claimed.

## Private Practice catalog world home — 9 October 2026

The same organization owner continues the source inventory's explicit
`practice-entry-catalog.mjs` → `src/world/` destination on
`codex/practice-catalog-world-home-20261009`, starting from PR621 merge
`b6d619c3b5e6ef3965dd62a70c186bc205d79c11`. Move the 27-line implementation
to `src/world/practice-entry-catalog.mjs` and update its only runtime consumer,
`room-supervisor.mjs`, plus `scripts/game-entry.test.mjs` and
`scripts/practice-entry.test.mjs`. Its two import targets remain `match-modes.mjs`
and `map-size-policy.mjs`; their implementations do not change.

This is portable map/mode metadata used by the supervisor's existing configured
fresh-room setup. Preserve `practiceEntryCatalog`, DTO keys/data, preset order,
optional-field omission, defaults, clones and errors. No normal browser or
match-worker module reaches it before or after the move. Both source URLs stay
outside exact public admission; canonical bytes still belong in the package.
No root forwarding entry is needed: the only identified imports are the three
internal consumers moved together, and no supported external API/URL or CLI was
found. The old root path retires with a guard against copies or stubs.

Write scope: the module, three consumer imports, exact world/retired memberships,
existing import/export/client-admission/public-denial/packed-private-path guards,
and this canonical note. Root count becomes 177 files (172 JavaScript and five
CSS); all 22 forwarding entries, six generated descriptors and historical evidence
remain unchanged. Main, map/mode rules, worker simulation, bootstrap bodies,
movement, audio PR622, QA1476, diagnostic tests and private HUD work remain outside
this slice. Art backing is N/A because behavior and presentation are unchanged.

Integrated in [PR624](https://github.com/lbeezr/thousand-unit-skirmish/pull/624)
at `8485db5d32b18580d699acaa764f1c6f00aa667f`. The merge tree is
`8807f2307c39fa7c41c0010f44187fa656371e3f`, identical to the qualified
combination of reviewed head `3aae8f38` and containing audio main `004cf382`.
All catalog blobs and both audio blobs were preserved; 109/109 affected
catalog/import/public-entry tests, docs and allowlist passed on that tree.
The original 195/195 affected checks, independent review, clean package and
real menu/Practice entry receipts remain in the PR. Parent confirmed terminal
hosted CI matches the actual base's nine movement assertions; this slice adds
none. No provider deployment or ordinary-game rendered acceptance is claimed.

## Population accounting rules home — 9 October 2026

The same organization owner takes the source inventory and architecture's
explicit `population.mjs` → `src/rules/` destination on
`codex/population-rules-home-20261009`, from PR624 merge `8485db5d` above.
The parent reserved the one production `server.mjs` import line after catalog
integration. Move the existing 15-line implementation to
`src/rules/population.mjs`; its registry dependency still resolves to
`src/gameplay-definitions.mjs`. Keep the sole `teamPopulation` export, weighted
living units, FIFO and Worker reservations, completed friendly capacity,
opening defaults, 1,000 cap, returned fields and existing errors unchanged.
The function remains pure accounting; production, command, checkpoint and
simulation policies stay with their owners.

`server.mjs` is the only runtime consumer and changes to the canonical import.
The four existing script consumers (population, population readout, Skiff
contracts and Skiff scenario) retain the supported root import. The root URL is
already publicly admitted and architecture records that path, so retain exactly
one named forwarding export without a wrapper or duplicate implementation.
Both paths belong to the exact rules domain and public admission, and both are
packed. No normal browser reaches this implementation before or after the move;
public availability does not establish runtime invocation. Root count remains
177 files (172 JavaScript and five CSS), with 23 forwarding entries and all six
generated descriptors unchanged. The organization owner retains this alias:
retirement requires reconciling all script/documented/external import and public
URL consumers with their owners, a containing release check, and a separate
explicit retirement decision. Zero runtime callers alone is insufficient.

Write scope: implementation and named forwarder, the single server import,
exact rules/static-path registrations, existing population/export/dependency/
anonymous-admission/packed-serving guards, and this canonical note. Existing
test files, registrations, cases and historical evidence remain. Main/HUD,
audio, movement algorithms, Skiff runtime, QA1476, diagnostic tests, assets,
security/access decisions and held experiments remain outside this slice.
Art backing is N/A because behavior and presentation are unchanged.

Integrated in [PR625](https://github.com/lbeezr/thousand-unit-skirmish/pull/625)
at `24f4809150aa216f04becf402d812591ea9f3839`, with reviewed tree
`70066ab3c502a107db0def4852e72aba45b4223b` unchanged from qualified
head `77cb60bc`. Merged imports, export identity, five focused population/public
tests and packed GET/HEAD serving passed again. The 178/178 affected tests,
77/77 independent review, native population/Skiff and clean package receipts
remain in the PR. Parent confirmed exact-base hosted CI has only the added
passing syntax check and the same nine movement assertions. The alias stays
owned under the conditions above; no deployed/rendered acceptance is claimed.

## Resource credit ledger rules home — 9 October 2026

The same organization owner continues the explicit `economy-ledger.mjs` →
`src/rules/` destination in architecture and the source inventory, from PR625
merge `24f48091`, on `codex/economy-ledger-rules-home-20261009`. Qualification
uses containing main `fb0f5126` after disjoint audio PR626 integrated; its
policy/test/matrix bytes remain untouched. The parent reserved only the three `creditResourceBalance` import lines in `server.mjs`,
`src/economy-profile.mjs` and `src/skiff-fishing.mjs`. Current local branches,
main and the open PR626/541/546/548 diffs showed no edits to those lines.
Naval ownership confirmed its only unpublished candidate is map coordinates;
the current movement correction owns crowd-steering lifecycle/regression and
PR626 owns audio-policy/test/matrix. This slice changes none of those bodies.

Move the complete seven-line implementation byte-for-byte to
`src/rules/economy-ledger.mjs`. It remains a dependency-free pure rule with the
sole `creditResourceBalance` export. Preserve addition, whole-balance rounding,
the existing 16× relative epsilon and exact fractional, nonfinite, signed-zero
and error behavior. Worker bank selection/validation, refund validation/order
and fishing cargo/drop-off transitions remain at their existing call sites.

The normal browser reaches this rule through `economy-profile`; server Worker
deposits and Skiff delivered-food credits also use it. All three production
callers use the canonical path. Six script imports and the Stone-profile HTTP
check retain the supported root path, as does the dated mineral-readiness link.
Keep a sole named forwarding export, exact public admission for both paths and
byte-checked release inclusion. Root count remains 177 files (172 JavaScript
and five CSS); forwarding entries become 24, with all prior 23 and the six
generated descriptors unchanged. The organization owner retains this alias
until script/documented/external API and URL consumers are reconciled with their
owners, a containing release is verified and retirement is explicitly decided.

Write scope: implementation/forwarder, the three production import lines,
exact rules/public-path memberships, existing ledger/export/dependency/public
admission/packed-serving guards and this canonical record. Existing script
consumers, test files/cases/registrations and historical evidence remain.
No general resource registry, arithmetic abstraction, new validation or type
policy is introduced. Art backing is N/A; behavior/presentation are unchanged.

[PR583](https://github.com/lbeezr/thousand-unit-skirmish/pull/583) merged at
`daf4f78d115895572877291298d4519160585c74` and is an ancestor of this base;
first-Barracks preparation is not a held dependency for this slice. The stale
held wording in the separate economy/content guide remains with that record's
owner; its receipt and ordinary served/rendered acceptance are distinct.

Next transition: independent review and exact-head imports/types/docs;
fractional conservation, typed refunds/deposits, cargo/Mill, Stone-profile and
Skiff fishing contracts; native both-seat fishing stock/cargo/recovery and
typed Food/Stone deposit recovery; then exact canonical/legacy GET/HEAD,
negative paths and a clean package/draft with source/check/digest receipts.
Parent retains ready/merge and deployment. Movement algorithms, audio PR626,
HUD, diagnostics, assets and held experiments remain outside this slice;
existing movement failures and ordinary rendered acceptance keep their owners.

The ledger integrated through [PR627](https://github.com/lbeezr/thousand-unit-skirmish/pull/627)
at `39e28f242b88a722150c694f9503bcbef6348e45`; its tree
`662a3c8e011eade06ffa08eaf99d024d3d0fe58c` equals the independently reviewed
source tree. Canonical/legacy export identity and exact GET/HEAD admission pass
on the containing source. The parent independently confirmed exact-base hosted
CI parity, with only the additional passing ledger syntax entry.

## Seat-private production projection home — 9 October 2026

The same organization owner takes the architecture and source inventory's
explicit simulation destination for `snapshot-private-production.mjs`, on
`codex/private-production-simulation-home-20261009` from containing main
`39e28f242b88a722150c694f9503bcbef6348e45`. The parent reserved the sole server
import and confirmed no other active owner reserves it. Qualification rebases
onto containing main `d91919e3ce70174e53f28021172c6f29dad963f4` after the
disjoint caption merge. Movement is a separate read-only audit;
integrated [PR628](https://github.com/lbeezr/thousand-unit-skirmish/pull/628)
owns `src/main.js`, `scripts/audio-settings.test.mjs` and the audio matrix.
Those files and held PR541/546/548 remain outside this slice; inspected diffs
change neither this helper nor its import line.

Move the complete dependency-free 19-line implementation byte-for-byte from
`src/snapshot-private-production.mjs` to
`src/simulation/economy/snapshot-private-production.mjs`. The existing
`broadcastState` no-fog branch is its sole production caller: it shares the
public roster while projecting each seat's private production/population and
persistent orders. Preserve the sole `privateProductionView` export, all
payload keys and optional-field omission, spectator payload identity, own-seat
row identity, shared roster storage, enemy queue/options masking, owned-order
filtering and input nonmutation. No disclosure framework or protocol is added.

Update the server import and the three imports in
`scripts/snapshot-private-production.test.mjs`,
`scripts/population-readout.test.mjs` and `scripts/persistent-command.test.mjs`;
retain their assertions, workloads and CI commands. No supported old-path
API, module URL or external consumer was identified. Both paths are private,
so retire the old root without a copy or forwarding entry and enforce its
absence. Root files reduce from 177 to 176 (171 JavaScript and five CSS), while
all 24 supported root aliases and six generated descriptors remain unchanged.

Write scope: the moved leaf, four import lines, exact simulation/retired-path
membership, additive existing import/public-admission/packed-serving guards and
this canonical record. Public allowlist and production admission policy remain
unchanged. Test authenticated GET/HEAD denial and anonymous denial in every
existing public-mode fixture; require canonical package/source byte equality
and absence of the retired path. Art backing is N/A for this internal move.

The unchanged fresh-main baseline ran 372 tests: 371 passed and the existing
Worker acquired Patrol exclusion assertion failed with
`workerEconomyBodyRadius is not defined` in
`scripts/worker-patrol-acquired-clearance.test.mjs`, loaded by the persistent
command suite. Privacy/snapshot cases passed. Preserve that movement failure
and compare its exact signature at final head rather than changing its fixture.

Next transition: independent exact-head review; baseline/implementation privacy
comparisons including optional arrays, spectators, sharing and nonmutation;
both-seat native production/population and snapshot receipt; imports, both
configured type gates, docs and exact private-path clean package checks; then a
draft PR with source/test/digest evidence. Parent retains ready/merge and
deployment in source task `01a0f784-c5d7-72e0-82e8-1747b4c840c1`; delivered
ordinary-match acceptance remains distinct from local native/package proof.

The seat-private projection integrated through
[PR629](https://github.com/lbeezr/thousand-unit-skirmish/pull/629) at
`56be560061e9658b0c8cb39d14254d738ee1affa`; tree
`fcd774d1ed41888272383828b6f5007099cdabbe` equals the independently reviewed
source tree. Five compact privacy/import/real private-serving checks pass on
the containing source. The parent independently confirmed hosted exact-base
parity across all nine existing failure assertions and every check outcome,
apart from passing syntax-path relocation; this is not a full-green claim.

## Private lobby authority homes — 9 October 2026

The same organization owner takes the source inventory's coherent private
server/orchestration pair on `codex/private-lobby-authority-home-20261009`,
from containing main `56be560061e9658b0c8cb39d14254d738ee1affa`. The parent
reserved only the two corresponding `server.mjs` import lines and reconciled
the types/contracts owner `01a11265-7c21-71a4-8345-611bf0318011`, who released
the pregame/chat modules and fixture paths after PR588 integrated; no retained
active or unpublished work overlaps. Qualification uses containing main
`373b063a00bafe778ca786efaf08eda079864819` after disjoint audio PR630 merged;
its audio policy, playback, execution/native tests and matrix bytes remain
untouched.

Move `src/room-pregame.mjs` (206 lines) and `src/room-lobby-chat.mjs` (56 lines)
to `src/server/orchestration/` with the same filenames. These are the actual
server-owned invite-lobby authority, separate from public lobby UI. The existing
worker creates `RoomPregame` for configured pregame sessions and restored phase;
`RoomLobbyChat.send` consumes that room's phase and existing connected seats.
Both leaves have only `server.mjs` as a runtime importer. Chat remains byte-for-byte
identical; pregame changes only its relative import of `match-modes.mjs`.
All method/function bodies, declarations, JSDoc and named exports stay intact.

Preserve revision invalidation, getter validation order, checked checkpoint,
seat/payload projections and exact diagnostic codes; preserve map/mode/readiness,
launch races and restored phases. Chat retains plain-text validation, connected
sender authority, retry acknowledgement, rate/window/history bounds, room
isolation, rematch retention and ephemeral restart semantics. No type enrollment,
new validation, access expansion, timer/session logic or gameplay change.

Update the two host imports, the existing authority tests' direct/source/type
paths and the pregame fixture's matching relative import expectation. Preserve
its actual-declaration selection, positive/negative programs, compiler settings
and exact diagnostic assertions. Native scenarios retain their existing
authority/UI workloads and commands; their private-route checks cover both
canonical and retired paths with GET/HEAD. The current architecture source
reference follows the canonical file; dated inventory and QA evidence stay pinned.

Neither root path is a supported public module URL or external import identified
by the consumer audit. Retire both without copies or forwarding entries; root
files reduce from 176 to 174 (169 JavaScript and five CSS). All 24 supported
aliases and six generated descriptors remain unchanged. Exact server membership,
sole-worker reachability and retired-root guards follow the pair. The production
public allowlist and admission implementation are unchanged; existing public-mode
fixtures and clean package checks prove anonymous denial, authenticated GET/HEAD
404, canonical source/manifest byte identity and absence of both retired roots.

Write scope: the pair, two host imports, required paths in the two authority tests
and native scenarios, additive existing runtime/public/package guards, this record
and the current architecture filename reference. Public UI implementations,
launch options, supervisor, index/persistence, compiler/CI/discovery configuration,
audio, movement, held experiments and historical evidence remain outside it.
The held `workerEconomyBodyRadius` repair is not reconstructed or adopted here.
Art backing is N/A for this internal placement change.

Fresh-main baseline: 99/99 existing pregame/chat authority, UI and launch-option
tests pass. Next transition: independently review the implemented exact head;
run the same authority/UI/type contracts and focused import/public regressions,
both existing native lobby scenarios, imports, both configured type gates, docs,
client allowlist and clean packed private serving; then a draft PR with exact
source/check/package evidence. Parent retains ready/merge and deployment in source
task `01a0f784-c5d7-72e0-82e8-1747b4c840c1`; local DOM/native process proof does
not establish ordinary-match browser acceptance on a delivered release.

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
