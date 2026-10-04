# Final independent runtime review — PR #290

Result: approved for the reviewed runtime/source scope. No blocking findings remain at `71fbe617ef596341a5ecf1683d5b514b7e6211c8`. All three independent retry findings are resolved. Release/deployment and ordinary-player verification remain separate owner obligations.

## Exact reviewed source

- PR: https://github.com/lbeezr/thousand-unit-skirmish/pull/290
- SHA: `71fbe617ef596341a5ecf1683d5b514b7e6211c8`
- Tree: `f8bf221c51ada5357b48ba1af7be8aadf384367e`
- Integrated base: `8200ec6c70c500bcb4f78425b9c8568ca5f99ee6`
- Full PR scope checked against that main: construction-specific helper/server callers/updater/checkpoint enclosure/legacy construction bounds; focused fixtures/tests; real-command continuation scenario and its CI execution; owning guides and retained historical records. The final delta from previously reviewed canonical `74d55e65` is five files: seven-line budget correction, actual failed-route loop regression, older wall-construction fixture bindings, positive native CI entry, and truthful QA finding notes.
- Canonical factory, generation-bound `activeWorkIntent`, and accepted external hooks are consumed from merged main. `src/work-intent.mjs`, Gather area module, Wall compatibility helper, movement/path helpers, generic cancellation and formation implementation remain unchanged from base. The construction branch of legacy derivation uses footprint edges plus two, without changing Gather derivation.
- No repository source edit, branch switch, merge, external comment, browser/Mac check, or external agent was performed by this reviewer.

## Finding resolution

1. Settled failed current target: actual empty failed-route finalization now reaches reacquisition while pending planning, active paths and in-range work remain preserved.
2. Different target after pruning: retries are keyed by site identity and navigation revision. Another builder's completion allows the new remembered target to route without unrelated topology changes.
3. Found approach followed by failed planning: every automatic attempt records its budget before approach discovery. Found approaches and later empty failed routes keep that record. The independent always-found-approach/actual failed-finalizer loop now issues only three routes in 120 ticks, at ticks 0, 30, and 60. A navigation change then permits attempt four; changing remembered target permits attempt five. Previously this exact failure path produced 90 routes in 90 ticks.

The source and admitted regressions cover all three. No outstanding construction/Gather boundary or generic-framework dependency is inferred.

## Independent verification at this candidate

- `node --test scripts/construction-work-intent.test.mjs scripts/work-intent.test.mjs scripts/palisade-runtime.test.mjs scripts/palisade-gate.test.mjs scripts/wall-construction-draft.test.mjs scripts/unit-movement.test.mjs`: 65/65 passed. Relevant controls include area and ownership validation, current-target route failure, target budget reset, repeated failed planner results, generation/revision/queued-command precedence, internal route repair, paid placement/connectivity, refunds, damage, checkpoint validation and Wall fixture compatibility.
- `/tmp/palisade-continuation-final-controls.mjs`: 17 independent caller/contract controls passed, plus the successful bounded-route spacing/exhaustion/topology/target-reset reproduction. The script reads the requested committed server with `git show`. It covers both-seat accepted/rejected installs and unselected exclusion; House replacement and completion cleanup; targetless bounded retry and external cancellation; dead-site pruning; canonical intent surviving internal revision changes; generation rejection; Gather preservation; canonical clone independence; legacy remembered-wall/full-footprint and unfinished-House migration; and legacy Gather remaining Gather.
- Native default `--case=complete-warm`: passed on both seats with no restart. Original builders 0/10 actively progressed remembered targets 1/4, then all six remembered walls and both Gates completed. All eight expected identities/type/team survived, both canonical and compatibility construction cleared, bank stayed 240 Wood per seat, six unselected Worker jobs remained unchanged, and no new paid IDs appeared.
- Native default `--case=checkpoint-controls`: passed on both seats with cold recovery. Six malformed canonical records were rejected and exact rejected bytes preserved: foreign Gate, stale generation, outside bounds, site-excluding bounds, nonfinite bounds and extra area field. The valid record recovered the same match/schema 29 and original builders naturally completed all remembered paid sites, with fixed area, identity, bank, unselected job and no-extra-allocation controls intact.
- `npm run check:types`, `npm run architecture:check`, and `npm run docs:check` passed. Architecture: 176 modules, 322 local edges, zero cycles. Docs: 604 Markdown files, 4274 local links. Existing explicit TypeScript lists do not newly typecheck the construction helper; no such claim is made.
- CI list independently checked at `/tmp/palisade-final-review-ci-list.json`: exactly one executable `scripts/palisade-continuation-scenario.mjs` entry, with no `--observe` or case filter. All eleven positive cases are now admitted to default CI, alongside the helper tests. This is registration proof; the implementation owner's separate complete eleven-case run is not counted as this reviewer's execution.
- Exact candidate diff checks passed and excluded shared-module/helper changes as described above. The repository remained at the requested SHA with a clean working tree through final verification.

The earlier canonical House replacement/legacy migration native records at `74d55e65` and prototype runs retain their own provenance. They are not claimed as newly executed final-source native cases. The final 17 independent controls explicitly recheck their relevant caller/migration/completion contracts at `71fbe617`.

## Independent deliverables and provenance

- `/tmp/palisade-continuation-final-controls.mjs`
- `/tmp/construction-review-final-warm-positive.json`
- `/tmp/construction-review-final-checkpoints.json`
- `/tmp/palisade-final-review-ci-list.json`

Both final native records identify the exact requested SHA, checkout server entrypoint and clean capture. Their measured hashes were independently matched to the commit:

- Server SHA-256: `6fed0168bf6d6705b6f36091a934eaa025bb980165b630a4bbc7cf99f6269d2a`
- Scenario SHA-256: `10ca8acec72aa6c970625c2386835ff0ef154b98caf470b267d5645ebc737665`

Expected-site predicates and original-builder attribution are nonvacuous: missing identities/type/team fail; the two original builders must be observed progressing remembered wall targets; observed checkpoints preserve the full unselected Worker set. Cost and monotonic-ID controls prevent hidden repayment/reallocation, while separately paid neighbors are excluded by explicit remembered-ID logic and the independent caller/helper controls.

## Limitations and owner boundary

This approval covers only the exact reviewed source/runtime behavior and named checks. No rendered browser/GPU, native keyboard, packaged release, served/deployed identity or ordinary-player acceptance is established by these CPU/native checks. The implementation owner retains final full-case execution, release/integration and downstream identified-environment acceptance. A later docs/evidence commit can retain this runtime review only after confirming runtime/helper/test/scenario byte identity and reviewing its changed evidence/provenance.
