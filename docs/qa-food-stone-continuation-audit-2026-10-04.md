# Food and Stone continuation audit — 4 October 2026

Economy/content's next bounded slice after Wood [PR #283](https://github.com/lbeezr/thousand-unit-skirmish/pull/283).
This is the dated pre-extension observation at `2617b934`, preserved unchanged
as baseline evidence. The later [Stone continuation slice](qa-stone-job-continuation-2026-10-04.md)
intentionally updates current Stone test expectations; Food remains source-only.
The [source/acceptance queue](economy-content-workstream.md) records Wood merge
`8200ec6c` separately from parent's identified staging `53a47ee`, which does not
contain it. This audit changes no runtime, source stock, price, radius or shared
construction contract. Frontier remains the verified playable civilization.

## Chosen gap and current contract

Food and Stone use source-only Gather execution. Exhausting the chosen node
returns its final cargo once, then clears its target and phase. A nearby live
same-type node remains untouched. `workIntent` is null; the durable automatic
eight-unit area policy implemented for Wood does not apply. Execution source ID,
phase, typed cargo and generation still survive cold restore. This is an
automatic reacquisition gap, not evidence of lost resources or broken manual
replacement.

The reproducible audit fixture is 160 × 160, eight starting units, two seats,
100 Food / 100 Wood and zero initial Stone. Ordinary neutral Food or Stone nodes
have six units each; a successor is one world unit away, another source has a
different resource type, and a distant same-type source is nine units away.
These stocks bound test duration and do not retune a shipped map. Stone uses
the existing explicit `stone-defense-v1` profile, whose initial bank is zero.
The Food fixture retains the default Food/Wood profile. No bank, cargo,
building, stock or checkpoint mutation supplies resources.

## Acceptance boundaries

`scripts/food-stone-continuation.test.mjs` runs eight full-authority fixed-tick
cases across both resources/seats. It preserves actual commands, simulation,
snapshots and checkpoint bodies; only I/O scheduling is adapted. It checks:

- Original typed source/cargo and both disclosed seat states after untouched
  restore; exactly six deposited, then idle, with successor/other/distant stocks
  unchanged and no failed retry loop.
- Explicit same-type replacement, Stop, Move and Return; other-type replacement
  first deposits incompatible cargo before drawing the accepted new source.
- Invalid target/Move, foreign and stale-generation orders preserve full
  authority; per-resource drawn stock equals bank changes plus typed cargo.

Four separate command-boundary topology tests execute production `assignGather`
against explicitly disconnected target/Worker components. Both Food and Stone
reject the order without clearing the previous Wood intent or cargo. This is
a synthetic graph contract check, not a live match topology mutation or a new
gate/navigation implementation. Existing map admission requires nodes reachable
from both spawns. A blocked route's recovery still belongs to the existing core
movement/depots contract.

`scripts/food-stone-continuation-scenario.mjs` supplies actual native server and
real WebSocket evidence for both seats/resources. It flushes untouched active
work, restarts a new process, reclaims seats, and requires a checkpoint sequence
newer than the saved file before comparing typed execution. Each seat finishes
with 106 Food or six Stone; all other banks/stocks remain unchanged. Source
revision and runtime/fixture hashes remain frozen throughout the report. Exact
clean-source results are retained with the PR; no live staging observation is
claimed. These new regression tools need source/tool acceptance, not deployment.

Clean native source `2617b9347f3a5c82663c1fe85deef1262f9e0e6e` passes both
resources/seats. The [raw native report](qa-evidence/food-stone-continuation-audit-2026-10-04/native.json)
retains frozen input hashes and fresh recovery sequence pairs. Food ends at
106/106 from 100/100; Stone ends at 6/6 from zero. Each resource draws 12 total,
leaves zero cargo, and preserves each adjacent successor at six. Sixty focused
authority/queue/intent/CI checks, both type boundaries, import audit and document
checks pass. Independent read-only review found no remaining findings at that
source. The first native attempt exposed an idle map-publication waiter race;
the corrected runner waits for both actual map-change messages and does not
claim the failed attempt as gameplay evidence.

## Next bounded decision

No automatic Food/Stone extension is implemented by this audit. A useful next
candidate is Stone-only reacquisition on its explicit profile, using the same
fixed original eight-unit area, visible/reachable finite Stone nodes and existing
compatible owned depots. That would explicitly extend the Wood-only intent
resource union and policy, rather than infer permission from a resource enum.

Food needs a source-subtype decision first: neutral berries, owned paid Farms,
wildlife/carcasses and shore fishing all carry Food but have different ownership,
interaction and lifecycle rules. Do not mix those jobs or claim a generic Food
area solely from cargo type. Keep construction-specific Gate/wall work with its
owner, retain explicit manual-order priority, and leave prices/stocks/radius
unchanged unless a separately justified policy change names them.
