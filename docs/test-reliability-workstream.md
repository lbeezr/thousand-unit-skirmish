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

## Coordination and ongoing queue

| Slice / owner | Next step | Dependency / evidence |
| --- | --- | --- |
| Construction shared fixture / `01a1085f` | Independently review exact source, qualify both consumers and normally integrate; merge/clean-pack identities live in the slice PR. | All original 22 receipt and 15 paid-wall test bodies stay byte-identical. Seven loader controls cover inserted helpers, import forms, labels/computed values, setup failures and isolated retries. |
| Next reliability slice / `01a1085f` | Audit the existing economy/drop-off shared fixture against recurring missing production exports; select a bounded interface only if another concrete failure justifies it. | PR397 history and `economy-server-fixture.mjs`; no bulk migration or reserved writes yet. |
| Production modularization owner | Preserve or explicitly replace these construction roots when extracting them into an exported runtime module; then replace only the affected fixture slice. | No production host/module/path changes in this slice. Architecture owner retains import/domain guards. |
| Checked-type owner | Retain strict project membership, negative contracts and ambient isolation; assess the fixture interface in the dedicated type lane. | No tsconfig, runtime type-contract or coverage-floor edits here. Existing type gates remain required. |
| CPU qualification owner `01a10378` | Qualify containing source through the existing full-suite workflow. | The existing receipt registration runs the new loader controls; labels, deadlines, shard selection and CI registry are unchanged. Focused checks are not a full-suite receipt. |

This tooling outcome requires actual fixture/contract checks and clean packaging.
Deployment, served identity and ordinary playable evidence remain separate; it
does not change shipped gameplay. Private archives, held publications, hosted
dispatch, credentials and renderer capability are outside this lane.
