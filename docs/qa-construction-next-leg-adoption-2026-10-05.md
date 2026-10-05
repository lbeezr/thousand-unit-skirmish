# Construction final parking and accepted next queued leg — 5 October 2026

Owner: caller adoption `01a10933-e913`. The agreed dependency is merged
[core PR504](https://github.com/lbeezr/thousand-unit-skirmish/pull/504), source
`1a1f99b681b2fd095be16aab16b2fe0715e372d7`. Core owns the endpoint helpers and
shared planner/publication/executor; crowd owns steering and body pairs. This
slice changes only construction completion consumption in `server.mjs`, its
regressions and default CI registration. Art backing: N/A, no presentation change.

The reproduced queued-first wall workload previously completed all seven paid
sites and parked selected Worker 68 at `(18.5,1.5)` on tick 1571. That was actor
120's already accepted queue head, which became current on tick 2202. Its exact
return remained pending at the original tick-2700 deadline. The unchanged
current-only helper correctly reported this future point available before
activation. Baseline source was `6ee1cce4`; simulation bytes matched PR487 merge
`a54fa31dde2a05e19699bd38063bcdd8c46ef236`. This is a final-parking gap.

The default consumer now takes one newly frozen, finally-closed PR504 next-head
view per synchronous construction phase. Productive work and intermediate-site
continuation keep their existing current/static admission and rates. At terminal
completion or full repair, the Worker retains its completed target, original
construction area/site IDs and own construction clearance until it settles at a
current/next-clear pose. It continues a safe accepted own approach or uses the
existing radius-eight cell selector and `enqueueRouteRepairs` in construction
access mode. Every movement write remains admitted by the shared executor.
Claims grant no movement authority. Unavailable/deferred candidates retain
active completion intent, with searches bounded to once per second and rebuilt
on generation, order, navigation or planning-epoch change. No new durable schema.

The retained actual-command regression now finishes productive work at the same
tick 1571 and same 105 Wood, parks clear at `(20.5,.5)` on tick 1607, and actor
120 reaches the original `(18.5,1.5)` by the unchanged deadline. Its activation
remains tick 2202. The 64-unit formation has 56 arrivals; eight other nonarrivals
remain an independently owned crowd issue. No full-formation success claim.
The runner preserves every accepted return record, original goals, untouched
Workers, and the settled idle Worker's exact pose/revision on every later tick.

Both seats have real accepted Move, queued Move and paid single-site Palisade
journeys. They prove productive completion while the final work pose is claimed,
retention of the **last** site/area, actual body-clear executed egress, original
military arrival, unchanged costs and idle-pose immobility. Fresh checkpoints
recover in a newly created server instance during work, at completion and
during egress without patched fields or retained transient retry state.
Stop, Hold and queued Move supersede completion egress and remain superseded
through recovery. Two controlled host-boundary cases establish all-candidates
claimed/deferred wait, bounded retry and independent release; these are not
native or real sealed-map liveness claims. Existing real-command construction
access/repair, paid obstruction, cancellation and cooperative-completion checks
remain required adjacent controls. Independent review found full-repair cleanup
behind the productive reach guard: all four new real-command repair controls
failed before the correction. Eight accepted queue heads now force the repair
Worker to execute its own escape outside repair reach. Both seats, warm and
fresh recovered completion, require full HP, exact repair cost, retained queue
records, physical clearance and eventual target/repair-flag cleanup. Completed
jobs are handled before productive access/reach admission. The primitive retains its nine-bucket /
64-claim bounds and queue-head-only scope; its source is unchanged here.

Validation command:

```sh
node --test --test-reporter=tap scripts/construction-work-intent.test.mjs scripts/construction-next-leg-journeys.test.mjs scripts/construction-queued-first-wall.test.mjs scripts/military-next-leg-claims-journeys.mjs scripts/military-endpoint-availability-journeys.mjs
npm run check:types
node scripts/check-runtime-imports.mjs
node scripts/check-docs.mjs
node --test scripts/farm-replant.test.mjs scripts/farm-harvest.test.mjs
node scripts/pack-railway-release.mjs
```

The first four commands establish focused CPU/type/import/document contracts;
packing establishes release inclusion. Exact source, independent review, clean
pack digest and served identity belong in the associated PR evidence, rather
than treating this dated source document as a deployment receipt. Native
process recovery for this new next-leg case, full-suite coverage, deployment
identity and real rendered ordinary-game acceptance remain **OPEN**. There is no
metadata-only visual pass, consumer-GPU capacity or universal escape guarantee.
A physically sealed site may retain active wait.

After this construction increment, combat and Patrol adoption remain separate
measured increments under the existing caller plan. No global attack, Sheep,
Worker economy or crowd flow pruning is part of this change.
