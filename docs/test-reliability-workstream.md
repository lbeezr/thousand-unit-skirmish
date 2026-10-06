# Test reliability workstream

Owner: fixture workstream `01a1085f`, under the parallel code-quality campaign.
Production movement/crowd and UI/renderer remain separate lanes. The existing
[testing strategy](testing-strategy.md) owns qualification claims; the
[extraction backlog](code-extraction-backlog.md) and
[architecture guide](architecture.md) own production modularization.

## Concrete failure history

| Integrated correction | Observed extraction failure | Retained contract |
| --- | --- | --- |
| [PR365](https://github.com/lbeezr/thousand-unit-skirmish/pull/365) | Extracted client `sendCommand` lacked `browserStateRecovery`. | Real recovery binding, both-seat fractional cargo and conservation controls. |
| [PR397](https://github.com/lbeezr/thousand-unit-skirmish/pull/397) | Extracted construction assignment lacked `ordinaryMoveBodyRadius`. | Shared real movement exports; original reacquisition and route-attempt assertions. |
| [PR433](https://github.com/lbeezr/thousand-unit-skirmish/pull/433) | Extracted queued Palisade assignment lacked `followTravelMovementActive` after a merge-ref integration. | Real predicate and missing-binding controls; original intent/revision/queue assertions. |
| [PR449](https://github.com/lbeezr/thousand-unit-skirmish/pull/449) | Main `c8aa92c8` receipt VM missed `constructionEndpointSnapshotGetter`; 14/18 passed. | Real endpoint/access helpers; all 18 original bodies and four occupied-endpoint controls. |
| [PR503](https://github.com/lbeezr/thousand-unit-skirmish/pull/503) | Main `a2bdd041` receipt VM missed `finishFarmReplantHarvest`; 28/29 passed locally, matching [shard3 public failure](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37381496303/job/112004637661). | Real server helper body and existing real `activeWorkIntent` binding; all 29 original tests and expectations remain unchanged. |
| Parked crowd shared dependencies | Core513 main `d27728f8` and current `06a3ca83` both fail all 18 `crowd-forward-progress` scenarios on missing `constructionMovementActive`, matching [public shard2 failure](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37391641406/job/112038057661). | Reuse `constructionServerBindings()` and its real AST-discovered imports; original test callbacks, vectors, route completion and parked-actor expectations remain unchanged. |

These are fixture dependency failures, not evidence that the underlying
production policy should change. Historical passes and failures retain their
source identities; no full-suite green claim follows from a correction.

## First shared boundary: construction phase dependencies

[`construction-server-fixture.mjs`](../scripts/construction-server-fixture.mjs)
parses the production entrypoint with the existing Acorn dependency. Its bounded
slice starts at `constructionEndpointSnapshotGetter` and ends before
`updateWallBuildOrders`, retaining intervening source bytes and newly inserted
helpers. The named pose/access roots must remain present. It loads referenced
local production imports using their real exported values and aliases; it does
not execute the server entrypoint. Missing boundaries or exports fail setup.

The receipt and paid-wall fixtures share this boundary. Their scenario state,
geometry, routing hooks and assertions remain explicit. Each receives a fresh
retry WeakMap. This removes the duplicated helper/import lists within this one
seam; it does not infer every host-global dependency or replace the full server.

The identifier scan is deliberately conservative. It excludes noncomputed
property labels and ignores strings/comments, while retaining shorthand and
computed value references. A local shadow of an imported name can still select
an unnecessary import; referenced nonlocal host imports fail setup. Contract
tests record that limit instead of claiming a general lexical-scope resolver.

## Bounded economy/drop-off audit

At main `c42a9b4b`, the selected paid-economy, Storehouse, Mill and cargo-return
fixtures reproduce 46 passes and six failures across 52 checks. Every failure is
the paid-economy consumer missing `currentConstructionAccessRetry` when real
`finishPalisadeBuilderAssignments` runs. The drop-off consumers themselves pass;
there is no evidence for a new economy dependency resolver or runtime change.

The paid-economy fixture now consumes the existing production-derived construction
functions/imports and fresh retry state. All 14 original test bodies remain
unchanged. Four additional both-seat controls exercise paid assignment keeping
the current occupied-endpoint retry and removing retries with a foreign site,
epoch, generation, revision or nonblocking state. Equal actor fields cannot
transfer a WeakMap retry to another object. Payment, assigned site and revision
remain checked. Scenario route admission stays an explicit synchronous double.

Core Farm/Worker ownership remains at `01a107c9-0032`/`01a107ba`: no server,
production module, shared route binding, CI registry or gameplay edit is allocated
here. Their existing construction roots and drop-off scoring remain the consumed
interface; production modularization can later replace the seam with exports.

## Paid Gate consumer audit

At main `231a5de6`, the unchanged Gate, depleted-resource, construction-intent
and building-limit files pass 109 checks. This is a selected-source receipt,
not a full-suite verdict or closure of the crowd-owned movement backlog.
The Gate topology fixture's no-op `assignFormationMove` never changes the
builder revision, so `finishPalisadeBuilderAssignments` skips the accepted actor.
A temporary copy exercising that synchronous accepted-builder branch fails with
`currentConstructionAccessRetry` undefined. This is an uncovered fixture
dependency, not a demonstrated production movement failure.

The Gate consumer shares the production-derived construction helper/import seam
and fresh retry state. Its original assertions remain unchanged. Four new
both-seat controls run real paid-wall and builder endpoint admission against real
military reservations: free access captures one owned planning job; occupied
access keeps the charged site, construction intent and current retry through 90
ticks without admitting a route. Replaying the existing site neither charges nor
queues another job. The planner scheduler and recovery-route submission are
explicit captures; no physical execution, arrival or productive liveness is
claimed. Crowd owner `01a10933` retains that runtime outcome.

## Diagnostic VM identity repair

Public [CI run37326861233](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37326861233)
uses merge-ref `9bb0a234` for PR463. Shard 1 / job `111819948554` fails in
`local-detour-route-budget-journeys.mjs:291`: the extracted `runSimulationTick`
reads an unbound `matchId`. The same check fails on exact CI source, base
`e839f59d` and containing main `c3725def`. Commit `fbea1455` added match/map
association to private whole-tick diagnostics; the VM setup did not follow it.
The run's formation assertion and native queued-wall timeout remain separate
crowd-owned failures. No full-suite verdict changes from this fixture correction.

The repaired fixture evaluates the actual production match-identity initializer
with Node's real `randomBytes` binding. It supplies its actual synthetic metadata
map object, named for the fixture dimensions, rather than pretending to be a
shipped/admitted XL map or substituting a fixed match ID. All original assertions
remain. Added controls verify current match/map association and earlier-row
immutability, scalar-only route retention, and no identity/map read when whole-tick
diagnostics are off. Temporary constant-identity, retention-identity leak and
diagnostic-off leak mutations must fail those controls.

The bounded write scope is this fixture plus this guide. A specific coordination
note for diagnostics owner `01a10c49-2cac` lives in
[PR464](https://github.com/lbeezr/thousand-unit-skirmish/pull/464#issuecomment-5997376584):
its private replay pause projection and crowd/core agreement remain separate.
No production initializer, diagnostic payload, player row, replay hook, movement
policy, deadline or CI registration changes here.

## Farm versus inspectable wildlife fixture contract

Public [CI run37371764428, shard 2](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37371764428/job/111970388093)
executes clean main `bbc8ac5418fa3de0a73e49c77ee0a6622b13a012` and stops at
354 passed / one failed / 109 unrun checks. The fishing contact fixture's line146
expects null when excluding non-wildlife targets, but supplies the obsolete
`ownedWildlifeOnly` option. [PR482](https://github.com/lbeezr/thousand-unit-skirmish/pull/482)
intentionally replaced that option with `inspectableWildlifeOnly` to admit shared
positive-food carcasses while retaining owned-live Sheep selection. The ignored
old option enters ordinary resource picking; its exhausted Farm result is not a
new depletion policy. The existing explicit stock-zero assertion confirms that
ordinary Farm targeting retains authoritative refusal and exhausted-plot help.
The same stale option fails both seats in the Farm context-order fixture.

Only those fixture callers and their real `selectInspectableWildlife` binding
change. Original null, stock-zero, fog, Worker payload and fishing assertions
remain. Added both-seat production-picker controls exercise real Farm body rays
outside the point radius and the generic point adapter, productive/exhausted Farm
exclusion, current relocated carcasses with positive fractional Food regardless
of former ownership, and owned-live Sheep inspection. Hidden/explored-only,
omitted, marker-unavailable, vacated authored-position and depleted carcasses
remain excluded. The existing real DOM Harvest and checkpoint-conservation checks
remain separate consumers of the same production contract.

Sheep interaction owner `01a10d83-3a7d` retains that production interface; the
[specific coordination note](https://github.com/lbeezr/thousand-unit-skirmish/pull/482#issuecomment-6003329874)
records the bounded fixture adoption. No production picker, Farm adapter,
carcass authority, presentation, art, CI registration or deadline change is needed.
This fixture qualification and clean pack do not claim a full-suite pass,
identified deployment or ordinary rendered acceptance of Sheep interaction.

## Construction movement/body consumer checks

Core513 added a construction predicate to the actual `getMoveVector` body.
The parked Infantry fixture extracted that body without its imported predicate;
the established construction harness already resolves the real dependency.
Its adopter now spreads those bindings before its existing fixture state. No
false predicate, movement policy, loader/framework rewrite or assertion change
is needed. [Specific core dependency coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/513#issuecomment-6006368753)
retains core body-guard/selector ownership and caller Patrol/access ownership.

The expanded set initially passes 498/500 and exposes two more real wall-fixture
dependencies: the completion phase's `createNextQueuedMilitaryEndpointClaims`
and checkpoint validation's `validDockFacingState`. Resolving the first also
exposes its actual `MAX_QUEUED_WAYPOINTS` input. The existing construction loader
now visits the completion declaration for imported names, reads the queue limit
from its literal production declaration, and retains the original returned
body range and caller-owned state. Existing economy bindings expose the real
Dock validator beside their orientation validator. No original wall or Worker
test callback/expected value changes. One new loader control checks completion
imports, a non-default production queue value, unchanged body boundaries and a
missing queue declaration rejected at setup. Passing consumers stay unchanged.

The existing impacted consumers below form a focused dependency check set for
future construction movement/body-helper changes. Run it on the proposed head
before merge; it is not full native movement or full-suite qualification.

| Production-derived consumer | Dependency boundary / retained check |
| --- | --- |
| `crowd-forward-progress.test.mjs` | Actual `getMoveVector`; real shared construction imports; both seats/eight headings, forward completion, unchanged parked actors and exact legacy soft-separation vector. |
| `unit-movement.test.mjs` | Actual `getMoveVector`, body guard, land executor and interaction separation; real construction predicate/body segment imports and bounded query/admission controls. |
| `construction-work-intent.test.mjs` | Production construction/parking slice with real predicate, static body and endpoint policy; retained paid-job/access/retry contracts. |
| `worker-performing-action.test.mjs`, `economy-server.test.mjs`, `wall-construction-draft.test.mjs`, `palisade-gate.test.mjs` | Existing shared AST construction import adopters; retain activity, economy, wall and Gate assertions. The loader's existing inserted-helper/import/setup/isolation controls remain in Worker receipt tests. |
| `worker-economy-route-admission-journeys.mjs` | Extracted land executor and real construction body guard; economy-only actors must retain their separate publication/quota/recovery path. |
| `construction-next-leg-journeys.test.mjs` | Full production replay import graph and next-head parking/repair consumers; retained both-seat warm/cold completion. |
| `worker-patrol-acquired-clearance.test.mjs` | Existing shared selected-route clearance consumer from PR508; acquired Worker travel remains a separate caller policy. |

```sh
node --test scripts/crowd-forward-progress.test.mjs scripts/unit-movement.test.mjs \
  scripts/construction-work-intent.test.mjs scripts/worker-performing-action.test.mjs \
  scripts/economy-server.test.mjs scripts/wall-construction-draft.test.mjs \
  scripts/palisade-gate.test.mjs scripts/worker-economy-route-admission-journeys.mjs \
  scripts/construction-next-leg-journeys.test.mjs scripts/worker-patrol-acquired-clearance.test.mjs
```

The full-server replay adapters keep actual imports when copying the host, so
their existing controlled trajectories above cover that binding mechanism.
Broad `pathing-replay`, Worker Patrol 64-actor and queued-first-wall journeys
remain their runtime owners' acceptance. Known formation/arrival failures are
not missing globals; this fixture slice does not alter their expectations,
deadlines, CI labels or inputs. Passing consumers need no migration.

## Coordination and ongoing queue

The default-delivery audit at main `6ee1cce4` reproduces four false-green controls:
removing the normal Spearman role, changing its version, omitting its release
family, and omitting the already-default economy building family all leave the
12-record asset audit green. These are missing qualification boundaries, not
evidence that current runtime files are missing. Worker default-v3 fishing,
Infantry PR485's actual identity/idle-placeholder qualification, eight Complete
building registrations, and oak depletion/default ground already have guards.
The prepared-unbound pine variety pilot and military missing action cells remain
expected incomplete work, separate from registration regressions.

The [Spearman slice PR492](https://github.com/lbeezr/thousand-unit-skirmish/pull/492)
adds only its established v1 record and an audit probe consuming
the actual no-art-option main constructor, real civilization-role selector,
manifest identity and atlas/mask dependencies from the release inventory. Its
existing 11 missing action cells and rendered/deployed acceptance remain unchanged.
The [specific foot-art coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/489#issuecomment-6003884705)
reserves no asset, builder, clip, runtime or Infantry qualification changes.
Fixture owner `01a1085f` completed the disjoint three-family economy audit in
[PR496](https://github.com/lbeezr/thousand-unit-skirmish/pull/496), using
the existing building probe. Default renderer and packed HTTP tests already
consume those assets; the adoption registry now records all three real selectors
and their declared Complete/lifecycle files. New controls reject turning off
normal building registration, cross-family manifest substitution, and omission
of each manifest, Complete image or later lifecycle image from the actual pack.
The [specific economy owner coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/381#issuecomment-6004032245)
retains its existing served/rendered acceptance. There is no new runtime, art,
lifecycle, rotation, HTTP admission or gameplay policy here.

The next disjoint consumer check addresses Bellweather's normal maple factory.
At clean main `24802184`, omitting its lifecycle JSON/page from the actual pack
or changing the normal selector to generic field-maple leaves all 16 adoption
records green. Existing flora tests validate all 21 descriptors and Underbough's
production binding; [berry PR494](https://github.com/lbeezr/thousand-unit-skirmish/pull/494)
covers its separate berry factory. The appended Bellweather test keeps all three
earlier forest test bodies intact, loads the complete current environment module
with real production imports and no art options, and uses the authored Millrace
theme on a bounded forest fixture. All image/metadata loads read only files
admitted by a real release inventory. It checks the registered family, actual
page hash, full/worked/low/depleted/reset UVs and stable slot matrices; missing
JSON/page and wrong-family controls must fail those same checks. This proves
CPU default registration/package consumption, not decoded pixels or a game.
The [specific flora coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/490#issuecomment-6004266572)
preserves the descriptor, art, pine activation and served/rendered ownership.

| Slice / owner | Next step | Dependency / evidence |
| --- | --- | --- |
| Construction shared fixture / `01a1085f` | Completed in [PR453](https://github.com/lbeezr/thousand-unit-skirmish/pull/453); retain production-root contracts during future extraction. | All original 22 receipt and 15 paid-wall test bodies stay byte-identical. Seven loader controls cover inserted helpers, import forms, labels/computed values, setup failures and isolated retries. |
| Paid-economy shared construction adopter / `01a1085f` | Completed in [PR457](https://github.com/lbeezr/thousand-unit-skirmish/pull/457); retain typed payment and retry ownership. | Six real missing-helper failures; original 14 bodies plus four retry-ownership controls. Storehouse/Mill/return regressions remain unchanged. |
| Paid Gate shared construction adopter / `01a1085f` | Completed in [PR460](https://github.com/lbeezr/thousand-unit-skirmish/pull/460); retain admission/paid-job controls. | Reproduced accepted-builder missing dependency despite green topology-only baseline; original assertions plus both-seat endpoint/paid-job controls. No production or CI edit. |
| Diagnostic VM identity / `01a1085f` | Completed in [PR469](https://github.com/lbeezr/thousand-unit-skirmish/pull/469); retain identity/privacy and original detour checks. | Exact public CI/base/main reproduction; real production initializer and truthful synthetic map metadata. Diagnostics owner `01a10c49-2cac` retains its separate replay consumer. |
| Inspectable wildlife fixture adoption / `01a1085f` | Completed in [PR488](https://github.com/lbeezr/thousand-unit-skirmish/pull/488); retain exact Farm/carcass/fog consumers. | Exact main `bbc8ac54` public/local failure; PR482's renamed option and real selection predicate. Sheep owner `01a10d83-3a7d` retains runtime/served/rendered acceptance; original expected values stay unchanged. |
| Spearman default registration guard / `01a1085f` | Completed in [PR492](https://github.com/lbeezr/thousand-unit-skirmish/pull/492); retain registration regressions independently of action completeness. | Reproduced missing-role, wrong-version and missing-release false greens; established v1 registration and real constructor/role consumer, not complete action coverage. Foot-art owner retains art/served/rendered acceptance. |
| Economy default consumer / `01a1085f` | Completed in [PR496](https://github.com/lbeezr/thousand-unit-skirmish/pull/496); retain existing Mill/Farm/Dock selector/release controls. | Demonstrated economy-family omission false green; unchanged building probe and lifecycle/fallback/packed-HTTP assertions. Economy art/renderer owner retains actual appearance acceptance. |
| Bellweather default forest consumer / `01a1085f` | Qualify, independently review and normally integrate the production-family/real-pack guard; then inspect remaining uncovered consumers. | Main24802184 selector and actual-pack omission false greens; four-state registered page and stable slot/reset controls. Flora owner retains current ordinary-game appearance and matching source-art dependencies. |
| Continuing delivery-quality audit / `01a1085f` | After Bellweather integration inspect the existing generic pine eight-full-view release boundary; select only a demonstrated disjoint consumer gap. | Flora501's bounded missing-lifecycle specification stays separate; its 24 absent cells and prepared-unbound selector are not tests to turn green. Worker normal v3, Infantry485, oak depletion and flora490/494 already have guards. Use existing approved full-view source/pack evidence and preserve source/render incompleteness. |
| Next reliability audit / `01a1085f` | Check new reported extraction failures against exact containing source before selecting another bounded migration. | Passing fixtures need no rewrite. Core/modularization owners retain runtime roots; crowd owner retains formation/native-wall liveness; CPU owner retains the known-red full suite. No further production write reserved. |
| Worker Farm completion fixture / `01a1085f` | Completed in [PR503](https://github.com/lbeezr/thousand-unit-skirmish/pull/503); retain real completion-helper extraction during future Farm changes. | Public main `a2bdd041` fails at the original line160 completion assertion; scoped fixture repair only. [Specific Farm coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/491#issuecomment-6004406428); Farm owner `01a10e0d-d8e7-70fa-ae57-6c301bd2c023` retains renewal policy and ordinary acceptance. Worker receipts and existing real Farm renewal/checkpoint tests retain their contracts; CPU owner retains full-suite qualification. |
| Parked crowd shared dependency adopter / `01a1085f` | Qualify the recorded ten-file consumer set, independently review and normally integrate the real shared binding repair. | Exact public/local `d27728f8` and current `06a3ca83` missing-predicate failures; all 18 original crowd expectations preserved. Core513 owns body admission, separate movement/crowd owners retain their known native formation/arrival regressions, and CPU owner retains full-suite qualification. After integration, inspect a containing current-head CI result; select only a genuinely new fixture dependency error. |
| Production modularization owner | Preserve or explicitly replace these construction roots when extracting them into an exported runtime module; then replace only the affected fixture slice. | No production host/module/path changes in this slice. Architecture owner retains import/domain guards. |
| Checked-type owner | Retain strict project membership, negative contracts and ambient isolation; assess the fixture interface in the dedicated type lane. | No tsconfig, runtime type-contract or coverage-floor edits here. Existing type gates remain required. |
| CPU qualification owner `01a10378` | Qualify containing source through the existing full-suite workflow. | The existing receipt registration runs the new loader controls; labels, deadlines, shard selection and CI registry are unchanged. Focused checks are not a full-suite receipt. |

This tooling outcome requires actual fixture/contract checks and clean packaging.
Deployment, served identity and ordinary playable evidence remain separate; it
does not change shipped gameplay. Private archives, held publications, hosted
dispatch, credentials and renderer capability are outside this lane.
