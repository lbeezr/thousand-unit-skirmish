# Stone job continuation — 4 October 2026

The [Food/Stone audit](qa-food-stone-continuation-audit-2026-10-04.md) measured
source-only Stone: each selected six-stock node deposits six, then clears work
despite a reachable same-type node one world unit away. A new both-seat authority
test reproduces that failure on source `cade7c8b` before this fix.

## Bounded behavior

On the existing explicit `stone-defense-v1` profile, an accepted Stone Gather
now stores `workIntent.resource: 'stone'` with its original source anchor.
Continuation chooses live finite visible reachable Stone inside the same fixed
eight-world-unit circle. Partial compatible cargo fills across nodes; full or
incompatible cargo returns through existing compatible owned depots. A manual
source replacement creates a new anchor. Accepted external and queued orders
retain priority; rejected/stale/foreign/depleted-target requests preserve authority.
Empty, hidden or unreachable candidate sets deliver remaining cargo once, then
clear work without repeated failed searches or anchor expansion.

Wood retains its existing rule and forest scan. Stone never scans forest or
retargets to Food, owned Farms, wildlife, fishing or another ore. Food subtype
rules need a separate design decision. No source stocks, prices, radius, shared
construction behavior, public unit-row protocol or checkpoint schema is changed.
Version-one Wood/construction records remain valid; Stone intent on a baseline
map is rejected. Legacy active Stone anchors its current node only; legacy Food
does not acquire automatic area work.

## Proof boundaries

`scripts/stone-job-continuation.test.mjs` runs full production authority with
fixed ticks and only I/O scheduling adapted. Both seats cover positive partial
continuation and untouched recovery, two Workers sharing a depleted final source,
empty completion/no retry/duplicate-deposit checks, queued Move cancellation,
queued Return/AttackMove cold restore, incompatible Food-to-Stone manual orders,
and an actually undisclosed inside-radius Stone successor. Conservation is checked
through each fixed tick. Legacy field omission and malformed rejection are
explicit checkpoint compatibility cases; they are not untouched native recovery.

Three separately labelled topology boundary cases execute the production
continuation body with synthetic disconnected/no-flow/no-path facts, retaining
intent/cargo and forbidding forest scanning. No live topology is rewritten.
The existing map/runtime admission protects resource reachability; these cases
do not claim an unreachable accepted map or change walls/navigation.

The existing native Food/Stone scenario now requires both-seat Stone continuation
and unchanged source-only Food. It publishes a valid 160 × 160 fixture, draws
actual cargo, flushes and restarts a real server, reclaims both seats, and requires
a strictly newer checkpoint before checking typed original intent. Expected
Stone is 12/12 from zero with 24 drawn total; Food remains 106/106 from 100/100
with 12 drawn total. Out-of-area and other-type stocks stay six. Source hashes
remain frozen; native/package results and exact review/merge evidence are retained
in the incremental PR after execution, without implying staged observations.

## Source, release and gameplay acceptance

The economy/content implementation owner retains review, normal merge and exact
postmerge verification. The release delivery owner retains an identified staged
release containing Wood `8200ec6c` and this Stone slice. Identified staging
`53a47ee` contains neither. The cloud testing owner retains actual rendered
ordinary Stone selection, depletion/continuation, Stop/Move/Return, queued priority
and reconnect at a containing release. These staged delivery and rendered
acceptance outcomes remain explicitly open; local source/native/package evidence
does not close them. [Current queue](economy-content-workstream.md).
