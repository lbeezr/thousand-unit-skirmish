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

## Coordination and ongoing queue

| Slice / owner | Next step | Dependency / evidence |
| --- | --- | --- |
| Construction shared fixture / `01a1085f` | Completed in [PR453](https://github.com/lbeezr/thousand-unit-skirmish/pull/453); retain production-root contracts during future extraction. | All original 22 receipt and 15 paid-wall test bodies stay byte-identical. Seven loader controls cover inserted helpers, import forms, labels/computed values, setup failures and isolated retries. |
| Paid-economy shared construction adopter / `01a1085f` | Independently review and qualify the exact integrated head, then normally merge; source and clean-pack identities belong in the slice PR. | Six real missing-helper failures; original 14 bodies plus four retry-ownership controls. Storehouse/Mill/return regressions remain unchanged. |
| Next reliability audit / `01a1085f` | Read-only audit remaining paid construction consumers for real missing dependencies before selecting another bounded migration. | Shared economy/route bindings and core Farm/Worker owners; passing drop-off checks do not justify mass rewriting. No production write reserved. |
| Production modularization owner | Preserve or explicitly replace these construction roots when extracting them into an exported runtime module; then replace only the affected fixture slice. | No production host/module/path changes in this slice. Architecture owner retains import/domain guards. |
| Checked-type owner | Retain strict project membership, negative contracts and ambient isolation; assess the fixture interface in the dedicated type lane. | No tsconfig, runtime type-contract or coverage-floor edits here. Existing type gates remain required. |
| CPU qualification owner `01a10378` | Qualify containing source through the existing full-suite workflow. | The existing receipt registration runs the new loader controls; labels, deadlines, shard selection and CI registry are unchanged. Focused checks are not a full-suite receipt. |

This tooling outcome requires actual fixture/contract checks and clean packaging.
Deployment, served identity and ordinary playable evidence remain separate; it
does not change shipped gameplay. Private archives, held publications, hosted
dispatch, credentials and renderer capability are outside this lane.
