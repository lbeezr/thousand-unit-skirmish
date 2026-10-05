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
| Worker Farm completion fixture | Main `a2bdd041` receipt VM missed `finishFarmReplantHarvest`; 28/29 passed locally, matching [shard3 public failure](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37381496303/job/112004637661). | Real server helper body and existing real `activeWorkIntent` binding; all 29 original test bodies and expectations remain unchanged. |

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
Fixture owner `01a1085f` now takes the disjoint three-family economy audit using
the existing building probe. Default renderer and packed HTTP tests already
consume those assets; the adoption registry now records all three real selectors
and their declared Complete/lifecycle files. New controls reject turning off
normal building registration, cross-family manifest substitution, and omission
of each manifest, Complete image or later lifecycle image from the actual pack.
The [specific economy owner coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/381#issuecomment-6004032245)
retains its existing served/rendered acceptance. There is no new runtime, art,
lifecycle, rotation, HTTP admission or gameplay policy here.

| Slice / owner | Next step | Dependency / evidence |
| --- | --- | --- |
| Construction shared fixture / `01a1085f` | Completed in [PR453](https://github.com/lbeezr/thousand-unit-skirmish/pull/453); retain production-root contracts during future extraction. | All original 22 receipt and 15 paid-wall test bodies stay byte-identical. Seven loader controls cover inserted helpers, import forms, labels/computed values, setup failures and isolated retries. |
| Paid-economy shared construction adopter / `01a1085f` | Completed in [PR457](https://github.com/lbeezr/thousand-unit-skirmish/pull/457); retain typed payment and retry ownership. | Six real missing-helper failures; original 14 bodies plus four retry-ownership controls. Storehouse/Mill/return regressions remain unchanged. |
| Paid Gate shared construction adopter / `01a1085f` | Completed in [PR460](https://github.com/lbeezr/thousand-unit-skirmish/pull/460); retain admission/paid-job controls. | Reproduced accepted-builder missing dependency despite green topology-only baseline; original assertions plus both-seat endpoint/paid-job controls. No production or CI edit. |
| Diagnostic VM identity / `01a1085f` | Completed in [PR469](https://github.com/lbeezr/thousand-unit-skirmish/pull/469); retain identity/privacy and original detour checks. | Exact public CI/base/main reproduction; real production initializer and truthful synthetic map metadata. Diagnostics owner `01a10c49-2cac` retains its separate replay consumer. |
| Inspectable wildlife fixture adoption / `01a1085f` | Completed in [PR488](https://github.com/lbeezr/thousand-unit-skirmish/pull/488); retain exact Farm/carcass/fog consumers. | Exact main `bbc8ac54` public/local failure; PR482's renamed option and real selection predicate. Sheep owner `01a10d83-3a7d` retains runtime/served/rendered acceptance; original expected values stay unchanged. |
| Spearman default registration guard / `01a1085f` | Completed in [PR492](https://github.com/lbeezr/thousand-unit-skirmish/pull/492); retain registration regressions independently of action completeness. | Reproduced missing-role, wrong-version and missing-release false greens; established v1 registration and real constructor/role consumer, not complete action coverage. Foot-art owner retains art/served/rendered acceptance. |
| Economy default consumer / `01a1085f` | Review/qualify and normally integrate existing Mill/Farm/Dock registrations and selector/release omission controls. | Demonstrated economy-family omission false green; reuse existing building probe and preserve lifecycle/fallback/packed-HTTP assertions. Economy art/renderer owner retains actual appearance acceptance. |
| Continuing delivery-quality audit / `01a1085f` | Inspect remaining Worker/trees consumer boundaries after economy integration; select only another demonstrated registration/release regression. | Worker normal v3 and Infantry485 already have guards; flora490's strict descriptors and prepared-unbound pine remain separate. Preserve expected missing source/render cells, reject coverage inflation, and avoid duplicate suites or source-only delivery claims. |
| Next reliability audit / `01a1085f` | Check new reported extraction failures against exact containing source before selecting another bounded migration. | Passing fixtures need no rewrite. Core/modularization owners retain runtime roots; crowd owner retains formation/native-wall liveness; CPU owner retains the known-red full suite. No further production write reserved. |
| Worker Farm completion fixture / `01a1085f` | Qualify, independently review and normally merge the missing real completion-helper extraction. | Public main `a2bdd041` fails at the original line160 completion assertion; scoped fixture repair only. [Specific Farm coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/491#issuecomment-6004406428); Farm owner `01a10e0d-d8e7-70fa-ae57-6c301bd2c023` retains renewal policy and ordinary acceptance. Worker receipts and existing real Farm renewal/checkpoint tests retain their contracts; CPU owner retains full-suite qualification. |
| Production modularization owner | Preserve or explicitly replace these construction roots when extracting them into an exported runtime module; then replace only the affected fixture slice. | No production host/module/path changes in this slice. Architecture owner retains import/domain guards. |
| Checked-type owner | Retain strict project membership, negative contracts and ambient isolation; assess the fixture interface in the dedicated type lane. | No tsconfig, runtime type-contract or coverage-floor edits here. Existing type gates remain required. |
| CPU qualification owner `01a10378` | Qualify containing source through the existing full-suite workflow. | The existing receipt registration runs the new loader controls; labels, deadlines, shard selection and CI registry are unchanged. Focused checks are not a full-suite receipt. |

This tooling outcome requires actual fixture/contract checks and clean packaging.
Deployment, served identity and ordinary playable evidence remain separate; it
does not change shipped gameplay. Private archives, held publications, hosted
dispatch, credentials and renderer capability are outside this lane.
