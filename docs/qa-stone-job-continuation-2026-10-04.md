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
Explicit checkpoint intent must match the referenced source resource (forest
requires Wood). This rejects cross-type corruption before restore can mutate
authority, while allowing incompatible carried cargo on a valid manual handoff.

## Proof boundaries

`scripts/stone-job-continuation.test.mjs` runs full production authority with
fixed ticks and only I/O scheduling adapted. Both seats cover positive partial
continuation and untouched recovery, two Workers sharing a depleted final source,
empty completion/no retry/duplicate-deposit checks, queued Move cancellation,
queued Return/AttackMove cold restore, incompatible Food-to-Stone manual orders,
and an actually undisclosed inside-radius Stone successor. Conservation is checked
through each fixed tick. Legacy field omission and malformed rejection are
explicit checkpoint compatibility cases; they are not untouched native recovery.
Positive cases retain nearby Wood untouched. Independent review reproduced a
mixed Stone-target/Wood-intent corrupted checkpoint harvesting Wood after recovery;
the corrected validator and regressions reject that record, a Food-target/Stone
intent and a forest-target/Stone intent without authority mutation.

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

Clean source `4fda0775721eded0645a081bed18116943ba7f5f` passes 104 focused
authority/intent/cargo/receipt/profile/CI checks, both type boundaries, import
audit and documentation checks (607 files, 4,338 links). Real native recovery
freezes 187 inputs: Food uses fresh checkpoint 6→7 and stays at 106/106,
12 drawn total, successor stock six; Stone uses 5→6 and finishes at 12/12,
24 drawn total, successor stock zero. Cargo and final intent are empty. Other-type
and distant stocks remain six. These are local source observations.

The clean runtime package contains the changed server and both gather/intent
modules with exact source bytes; its digest is
`sha256:270aa04ba2ce57094b175bca85e57d53ffb52ad3d5b9092f8df3dd288647d28b`.
Raw reports, logs and hashes are retained in the implementation owner's local
evidence record and [PR #305](https://github.com/lbeezr/thousand-unit-skirmish/pull/305).
This source/package identity is separate from a served release.

## Source, release and gameplay acceptance

The economy/content implementation owner retains review, normal merge and exact
postmerge verification. The release delivery owner's latest inspected staging
platform deployment is `6fcca7ce-cc91-4009-bec1-59648d979d94`, SUCCESS at
15:04:53 UTC on 4 October, source `839f0737`, containing this Stone slice and
Wood `8200ec6c`. Earlier `c487990a` was SUCCESS at 14:50:50 UTC on source
`1acaf9a4`, with one of one instances online and production unchanged; it
contained Wood only. Earlier staging `53a47ee` lacked Wood.
The release delivery owner retains served-byte/release identification for both.
The cloud testing owner retains actual rendered
ordinary Stone selection, depletion/continuation, Stop/Move/Return, queued priority
and reconnect at a containing release. Containing Stone platform delivery is
confirmed; served-byte and rendered acceptance outcomes remain explicitly open.
Platform delivery does not close those outcomes. Local source/native/package evidence
does not close them. [Current queue](economy-content-workstream.md).
