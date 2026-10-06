# Queued-wall temporal movement witness — 6 October 2026

[Movement workstream](movement-pathing-workstream.md) ·
[Public actor/query record](qa-evidence/construction-temporal-2026-10-06/actor75-temporal.json.gz) ·
[Registered regression](../scripts/construction-temporal-witness.test.mjs)

Core owns capture and the next candidate; crowd independently reviews this
temporal case before any correction. The failed short-prefix experiment
[PR #525](https://github.com/lbeezr/thousand-unit-skirmish/pull/525) is closed,
draft and unmerged. Its source and counterexamples remain public. No proposed
priority correction has been implemented here. Art backing: N/A.

## One new run, with explicit source and scope

The user authorized exactly one fresh production-source queued-wall reproduction
to capture the affected actor's first sustained no-progress interval. Run
`queued-wall-7628e8f8-2026-10-06T05:00:29.463Z` uses current main
`7628e8f803404dec5b46c1afc91e4a9836f49fe9` and committed observation harness
`d4d9d7a620f3eb9ef379e174e4af5ecc23195904`, tracked source clean. Node version
and all source/adapter hashes are in the record. The source differs from the
lost historical `7c031a05` report. Similar ticks and poses do not make this a
reconstruction of that run.

| Identity | SHA256 |
| --- | --- |
| Production server | `4117aa43ef1d900a5993f12250e008d8439d2d4e1a53ee7b68aceba9918526f7` |
| Production crowd selector | `5c619a38b3b71e8fae312d61951ab8f2491baca25c7da22f3d993d75d0d56a06` |
| Validated public map | `b1c062ac6c443385ef9db514011eef888466eb92e4f5d8c9fddd52fd06ecd508` |
| Original captured JSON | `18378884ffd37a2e96663eb0ec481a307d3931fbf5b26b43d574364af3aaba5b` |
| Compressed public artifact | `0ac8d06e7d5c9ed95214c70c9c9cb8fdde2a9372bdb7b30d89ae752683f3f38d` |

Map validation adds explicit `victoryMode:any`. The launch's pre-validation map
hash is separately retained as `requestedMapSha256`; the public artifact's
`mapSha256` identifies its actual validated map. This metadata clarification
changes no captured decision, body, command or tick. The artifact is 1,256,481
compressed bytes containing 181 selected-actor tick rows and 185 serial vector
calls, spanning ticks 528–708. It contains no room checkpoint, match/session
secret, full-world history or reconstructed older query.

The scene is the unchanged public 96×64 single choke, terrain seed 881, zero
elevation, 64 Infantry per seat and four Workers per seat. Both armies receive
No Attack stance at tick 0; seat1 receives Move(-8.5,.5), then queued Move(16.5,.5).
At tick 15, named Worker68 receives the paid seven-cell palisade line from
(column61,row32) through(column67,row32). The original 2700-tick journey ceiling
is preserved. Capture stops30 ticks after the first selector age120 interval for
the affected Infantry 75, rather than running an arrival or multi-case suite.

## Observed causal sequence

Actor 75 has fresh generation 934973698. At tick 557, a static proposal is rejected
and existing repair publishes pending revision5 while preserving goal2726 and
queued destination2751. At 558 the accepted route becomes
`[3121,3120,3119,3023,2927,2831,2735,2734,2733,2732,2731,2730,2729,2728,2727,2726]`.
Its controller resets progress credit at fixed waypoint(1.5,.5), distance
.5404107272. The actor remains on index0, revision5, epoch 2, navigation 1 through
the captured interval.

The selector's lane and separation decisions continue committing movement.
Ticks558–678 contain1.8506813677 tiles of travel:41 moving ticks and80 stationary
ticks. They never improve the retained best distance enough for the existing
.02 credit. This is a route that loses useful progress, not zero movement
throughout the whole120 tick interval.

At tick 594, before priority arbitration, ordinary half-step proposal 26 is
physically admitted: from(1.22,-.2978933806) to(1.2618567858,-.2866778886),
direction(+.9659258263,+.2588190451), length.0433333333. It passes the actual
bounds, cell, static and all live-body predicates and gains.0236634758 toward
the fixed waypoint. It is the selector's chosen `best` proposal before priority.

Lower-id Infantry 73 then activates `yieldingToPeer` using its distant final
goal(-11.5,-3.5), whose direction opposes actor75's accepted northward route
direction(0,1). But73's current waypoint is3120, next3119, and its actual current
waypoint direction(-1.1746618834,+.4130797850) has positive dot product with that
accepted route direction. Priority discards the already admitted proposal.
All existing recovery proposals then fail physical admission, so594 commits no
step. This directly proves that particular far-goal priority discards legal
current-waypoint progress; it does not prove that removing it completes the
journey or preserves fairness elsewhere.

Temporal-review clarification: that step would leave distance .8219333, above the
existing credit threshold .5204107; it does not reset progress credit. Peer73's
accepted route segment is westward, perpendicular to actor75's northward accepted
segment, while its actual current-waypoint direction has positive alignment.
The stronger shared-route evidence is the directed join `3121→3120→3119`. The
[subsequent candidate](qa-crowd-directed-join-2026-10-06.md) requires that join
per claimant, rather than inferring compatibility from alignment alone.

At 600,73 itself has revision3 and route start3121→3120→3119, the same first
segment sequence as75. All69 proposals for75 fail:32 static failures,30first body
refusals at73 and seven at95. At 660 priority selects a half-step southward
yield, increasing fixed-waypoint distance. At 678 there is still no active
detour, lease or contour, no overflow or pending plan, and no waypoint/queue
consumption. The120 tick counter is progress-credit age, not a persistent single
blocker identity or proof of permanent deadlock.

| Tick | Actual bucket visits / retained bodies | Proposals | Actual first rejection receipts |
| --- | --- | --- | --- |
| 558 | 21 / 12 | 59 | 29 body72,18 body81;12 proposals admitted |
| 594 | 28 / 16 | 69 | 32 static,16 body110,14 body95;7 proposals admitted before priority |
| 600 | 27 / 15 | 69 | 32 static,30 body73,7 body95;none admitted |
| 678 | 37 / 23 | 69 | 32 static,16 body84,9 body86,12 body73;none admitted |

These are the actual short-circuit first refusals, not independent per-body
geometry classifications. The artifact retains every actual bucket visit,
returned query member, route/identity binding, controller input/output, proposal,
predicate result, visited body sequence, score, priority decision and selected
result. It also retains the actor's real committed substeps and admission result.

## Public deterministic regression and next decision

The [test-only observer](../scripts/construction-temporal-observer.mjs) copies
existing functions and records their predicates once, preserving control flow,
query bounds and simulation writes. Production imports and modules remain
unchanged. The ordinary test reconstructs the actual stale bucket chains and
live poses from the public observations, seeds only observed transient steering
state, then calls real host functions, shared selector and physical oracles.
Using the hash-verified public archived selector from the captured source,
all185 calls reproduce the complete original result, proposal/score/priority
sequence and controller transition.182 consecutive controller inputs match the
previous observed output, including the repair/route handoff. This replay does
not create another match or regenerate the authorized production reproduction.

Run the self-contained receipt tests with
`node --test scripts/construction-temporal-witness.test.mjs`. They are also
registered in the existing unit movement test lane. The opt-in capture command
is separate; no further fresh reproduction is authorized by this receipt.

Smallest proposed runtime scope for crowd review: a route claimant should check
its current accepted route opposition before priority discards an already
physically admitted step that improves the actor's fixed waypoint. Keep the
existing behavior for a truly opposing claimant and every physical predicate,
route/queue binding, proposal budget, recovery/controller and original deadline.
That proposal targets the measured594discard rather than adding smaller steps
to an already boxed later pose. It is not yet a qualified correction: crowd
must review the temporal semantics first, then the author must preserve the
original wall/gate completion and150 tick forest/bridge/gate fairness contracts.

Source replay, release packaging, deployed identity and ordinary-game rendered
acceptance remain separate. No capture here supports consumer GPU capacity,
universal movement completion, a native scheduling result or default adoption.
