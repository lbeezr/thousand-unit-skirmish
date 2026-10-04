# Economy and content workstream

[Roadmap](roadmap.md) · [Farm](farm-finite-planting.md) · [Stone](stone-runtime-interface.md) · [Balance evidence](first-skirmish-balance.md)

Owner: economy/content worker, retaining each bounded slice through review,
ordinary authorized merge and proportionate integration checks. Frontier is the
implemented gameplay civilization. Copper, gold and asymmetric civilizations
remain planned decisions; artwork does not establish their rules.

## Current source and acceptance queue — 4 October 2026

Wood continuation [PR #283](https://github.com/lbeezr/thousand-unit-skirmish/pull/283)
is merged at `8200ec6c`: visible reachable Wood within eight world units of the
original assignment, typed cargo conservation and accepted external-order
priority. Independent review and 102 exact postmerge checks pass; actual native
process restarts retain the job and bank 18/12 harvested Wood exactly. The clean
packed runtime digest is
`sha256:1ba6fb2ae93aecccdb643ccf092aa5b10350f014c53dd96d94904c6f6cf6915d`.
[Source evidence](qa-evidence/wood-job-continuation-2026-10-04/README.md) and the
[shared intent contract](worker-resource-job-contract.md) are the implementation
boundary.

Earlier identified staging `53a47ee` lacked `8200ec6c`. The release delivery
owner's latest platform inspection records staging deployment
`6fcca7ce-cc91-4009-bec1-59648d979d94` **SUCCESS** at 15:04:53 UTC on 4 October,
source `839f0737`, containing merged Wood and Stone continuation. The earlier
`c487990a` SUCCESS at 14:50:50 UTC, source `1acaf9a4`, contained Wood only;
one of one instances was online and production was unchanged at that inspection.
This confirms containing staged platform delivery, while served runtime bytes
and actual rendered ordinary gameplay remain unverified. The release delivery
owner retains served-source/release identification; the cloud testing owner
retains Worker selection, depletion, continuation, Stop/Move/Return and reconnect
observation. These served and rendered acceptance outcomes remain open.
Construction-specific Gate/wall continuation remains
with its separate owner and consumes the merged intent boundary.

The merged [Food/Stone audit](qa-food-stone-continuation-audit-2026-10-04.md)
records the source-only baseline separately from healthy manual/cargo behavior.
Stone continuation [PR #305](https://github.com/lbeezr/thousand-unit-skirmish/pull/305)
explicitly extends the existing intent to finite
Stone nodes within the original eight-unit circle, with visibility, reachability,
typed cargo, manual/queued priority and cold recovery. [Stone continuation QA](qa-stone-job-continuation-2026-10-04.md)
retains source evidence and acceptance. Identified staging source `839f0737`
contains this Stone implementation; served runtime-byte verification and actual
rendered cloud gameplay remain open with the same owner roles. The earlier
`53a47ee` and `1acaf9a4` observations are historical.
The [Food source continuation proposal](food-source-continuation-proposal.md)
inventories current rules and recommends plain neutral land Food only as the
first possible extension. It changes no gameplay policy: Farms, wildlife and
land/Skiff fishing remain source-only. The economy/content owner retains the
decision and future contract tests; fishing, wildlife and construction owners
retain their existing implementations. No stock/price/radius or construction
policy is changed by either the Stone slice or this Food design receipt.

## Ranked next actions

| Rank | Outcome and next action | Write boundary | Dependencies | Acceptance and state |
| --- | --- | --- | --- | --- |
| 1 | Supply authoritative positive-progress Worker action receipts to the existing animation consumer. | `server.mjs` work grant branches/snapshots, bounded transient journal, contract and focused/native checks; no consumer/combat/stance edits. | [Versioned row-17 contract](worker-performing-action-contract.md); the animation integration owner retains consumer and appearance. | Actual grants vs waiting, same-tick invalidation, fog, no-wood clear broadcast, real commands, recovery and rematch. Producer implemented and verified in [PR #187](https://github.com/lbeezr/thousand-unit-skirmish/pull/187); exact deployed producer+consumer revision and cloud rendered acceptance remain with animation integration/cloud testing. |
| 2 | Verify paid Farm/Watchtower coexistence and a carrying Worker changing from Stone to an owned Farm on the shipped Stone Defense Field; compare baseline Millrace prices. | Native scenario/check and evidence; Farm/Stone guide corrections. No runtime/map changes. | Merged profile/node admission; existing Gather, Return, checkpoint and Farm interfaces. | [PR #214](https://github.com/lbeezr/thousand-unit-skirmish/pull/214) merged and exact merge `717ebeb6` passes [21 conservation stages](qa-farm-stone-paid-2026-10-04.md) on both seats: no injected state; exact payments/refunds, typed delivery, owner rejection and cold recovery. Deployment is N/A for the regression tool. Smaller dated maps do not establish the developing 160 × 160 gameplay floor. |
| 3 | Compare one paid Farm with nearby neutral food on Millrace using ordinary starting stocks, actual travel/deposits and matched Worker counts. | Bounded measurement scenario and dated balance record; no tuning change. | Rank 2's accounting/checkpoint contract; current map geometry and neutral-source ownership. | [PR #218](https://github.com/lbeezr/thousand-unit-skirmish/pull/218) contains [clean paired measurements](qa-paired-farm-food-2026-10-04.md): 40 vs 30 deposited Food at one Worker, 150 vs 90 at three in both seats' 60-second openings, with Farm construction and 60-Wood cost recorded. Independent review accepted and merged at `3f3593d0`; economy/content retains exact postmerge checks. Different geometry and finite pools prevent a general balance claim. |
| 4 | Close client/server wildlife metadata validation parity using the existing validator. | One client import and predicate, actual importer/native publication tests; no new fields, duplicated rules or wildlife runtime edits. | Already published claims/Herd validator, schema 28. [Consumer boundary proposed](https://github.com/lbeezr/thousand-unit-skirmish/pull/194#issuecomment-5974850086) and [refreshed for Herd](https://github.com/lbeezr/thousand-unit-skirmish/pull/194#issuecomment-5975013512); these records do not assert an owner response. | [PR #221](https://github.com/lbeezr/thousand-unit-skirmish/pull/221) provides [source/native parity](qa-wildlife-import-parity-2026-10-04.md) and now rejects the same sixteen malformed inputs; legal legacy bytes survive and a newer checkpoint proves rejected publication retains banks/buildings/stocks. Economy/content retains review/merge/postmerge and deployed editor observation; existing Railway delivery owner retains identified revision delivery. Future field/interface changes still require the affected wildlife owner. |
| 5 | Prove Stone acquisition and paid spending in the opponent policy. Agree the policy boundary with its owner before implementation. | Existing opponent economy policy and its focused replay/native evidence; no new faction. | Opponent owner, stable Stone/Farm rules; rank 2's mixed-resource regression. | Zero Stone grants; finite nodes, typed return and actual 50-Stone defense debit. No concurrent policy edit allocated here. |
| 6 | Observe contested Farm/neutral food and Stone defense choices with human players before adjusting provisional values. | Dated balance evidence, then a separately justified small tuning PR. | Identified playable build and available participants; appropriate runtime owner/session. | Player decisions, travel, exposure, losses and stocks in paired matches. Automated scenarios do not satisfy human balance acceptance. |

Shared affordability/prerequisite extraction belongs to the quality owner and
[PR #144](https://github.com/lbeezr/thousand-unit-skirmish/pull/144), now merged.
This stream consumes those rules and leaves their integration untouched. Maps,
movement, water, fishing, lobby and art have separate active owners; new evidence
uses their current interfaces without changing their implementation.

## Delivery ledger

- Worker receipt producer [#187](https://github.com/lbeezr/thousand-unit-skirmish/pull/187) implements [v1](worker-performing-action-contract.md) with [exact-source checks](qa-worker-performing-action-producer-2026-10-03.md). [Consumer contract checkpoint](https://github.com/lbeezr/thousand-unit-skirmish/pull/186#issuecomment-5974508410) is published independently of producer merge. The animation integration owner retains default client binding and producer+consumer delivery; the cloud testing owner retains rendered appearance acceptance.

- Typed Stone ledger/recovery [#115](https://github.com/lbeezr/thousand-unit-skirmish/pull/115), client controls [#118](https://github.com/lbeezr/thousand-unit-skirmish/pull/118), and map admission [#124](https://github.com/lbeezr/thousand-unit-skirmish/pull/124) are merged. [Final independent integration/postmerge evidence](https://github.com/lbeezr/thousand-unit-skirmish/pull/124#issuecomment-5973050052) includes natural zero-grant harvesting/payment/refund/depletion and resolved Worker duel checks.
- Farm's historical [paid lifecycle evidence](qa-finite-farm-2026-10-03.md) remains dated evidence. [PR #214](https://github.com/lbeezr/thousand-unit-skirmish/pull/214#issuecomment-5974964359) adds verified mixed-resource paths on shipped maps. [Paired opening measurements](qa-paired-farm-food-2026-10-04.md) retain their own exact source and observations; no historical measurement is overwritten.
- New regression/measurement tools require their actual command/check acceptance. They do not introduce runtime bindings or create a deployment requirement. For a later gameplay change, record source/release inclusion, exact delivered revision and observed in-game acceptance separately; a merge alone does not close it.

When a slice finishes, update its PR/evidence and this ledger, select the highest
ready justified action, and proceed under existing authority. Pause only its
dependent actions for a concrete authorization, ownership, execution or evidence
gap; record the owner and smallest next action. Do not turn this backlog into one
large PR or use it as a merge gate.
