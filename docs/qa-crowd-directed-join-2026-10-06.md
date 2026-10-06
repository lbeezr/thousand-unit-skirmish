# Directed route-join arbitration candidate — 6 October 2026

[Movement workstream](movement-pathing-workstream.md) ·
[Temporal witness](qa-construction-temporal-witness-2026-10-06.md) ·
[Decision regressions](../scripts/crowd-directed-join.test.mjs)

Core owns this candidate and its integration. The crowd reviewer accepted the
merged PR527 temporal witness and requested this narrow per-claimant exception.
Independent exact-head code review comes next, then the crowd owner qualifies
the exact candidate through the original seeds, completion deadlines and fairness
contracts **before merge**. This is a candidate, not a qualified journey fix.
PR525 remains closed and unmerged. Art backing: N/A, internal arbitration.

## Cause and bounded change

The public tick 594 input has an already physically admitted half-step with
.0236634758 improvement toward the fixed waypoint. Existing far-goal arbitration
discards it, then every recovery proposal fails. This improvement would still
leave distance .8219333; the retained best distance .5404107 requires a pose below
.5204107 for progress credit. Preserving this step does not reset that credit.
Peer73's accepted segment turns west, perpendicular to actor75's northward
accepted segment. Positive current-waypoint alignment alone is insufficient;
the stronger evidence is their shared directed join `3121→3120→3119`.

The only production edits are 24 added lines in
[the shared selector](../src/unit-crowd-steering.mjs). The existing
`yieldingToPeer` check skips a particular claimant only when:

- The actor uses its ordinary military radius, entered without a detour/lease/
  contour and still has no active manoeuvre. Its already admitted best moves
  forward along the accepted segment and improves fixed-waypoint distance.
- Existing lane context and a finite accepted segment are available. The actor
  has three distinct known route cells, so terminal/unknown joins keep priority.
- The claimant is ordinary movement with a fresh controller bound to the actual
  generation, order/navigation revision, epoch, path identity and index, with no
  active detour/lease/contour. Its actual current-waypoint direction has positive
  alignment with the actor's accepted segment.
- The claimant shares exactly those three directed route cells at its current
  index, or is one waypoint ahead with that same previous/current/next join.

No route search, geometric probe, proposal, relocation, target substitution,
queue consumption, durable controller state or safety exception is added.
The check remains per claimant; another genuinely opposing claimant retains its
existing veto. Unknown, reversed and unrelated routes, manoeuvre handoffs and
excluded callers retain their complete historical decision. Existing ordering,
physical predicates, 64-neighbor/128-proposal budgets and deadlines are unchanged.

## Source regression evidence

Base source is merged PR527 `55b8321976b83b5b25fd7b35dacafcb8328dd1c2`.
The authorized production capture is unchanged, including its compressed artifact
SHA256 `0ac8d06e7d5c9ed95214c70c9c9cb8fdde2a9372bdb7b30d89ae752683f3f38d`.
No new match or reproduction runs for these checks.

The 6,755-byte [archived selector](qa-evidence/construction-temporal-2026-10-06/crowd-selector-7628e8f8.mjs.gz)
preserves exact captured source SHA256
`5c619a38b3b71e8fae312d61951ab8f2491baca25c7da22f3d993d75d0d56a06`.
It is public, hash-verified and used only by replay, so the original 185 complete
decisions, proposal receipts and 182 continuity comparisons remain exact historical
regressions when production changes. Production capture rejects archived-source
overrides. The reusable test helper only reconstructs those recorded inputs.

Candidate replay changes exactly nine decisions at ticks 594–598, 667, 692, 693, 695.
Every actual query/visit and controller output is identical. Physical proposals,
admission and scores before arbitration are identical; each changed result keeps
the same admitted `best`, skips ten existing recovery proposals and adds no probe.
All remaining 176 results and their complete event receipts remain identical.
These are independently seeded decisions on recorded inputs, not a counterfactual
whole-match journey after the first changed step.

Separate controls cover both current and one-ahead joins, query-order reversal,
unknown/opposing/perpendicular directions, unrelated/reversed/missing route cells,
terminal routes, non-progress/blocked proposals, stale identity/controller inputs,
actor/peer manoeuvres, overflow/proposal-cap boundaries and explicit-radius
Worker/water/Hold/pending/dead/combat/persistent/work callers. A second opposing
claimant keeps the veto in either query order. The tick 594 positive explicitly
asserts physical admission, unchanged intent and no fabricated progress credit.

Run the registered source controls with:

```sh
node --test scripts/unit-movement.test.mjs scripts/unit-crowd-steering.test.mjs scripts/land-body-clearance.test.mjs scripts/crowd-forward-progress.test.mjs scripts/crowd-parallel-route-yield.test.mjs scripts/crowd-projected-route-ranking.test.mjs
```

Exact-head results and independent review are recorded in the candidate PR.
Types, runtime imports, documentation links, syntax and diff checks accompany
those controls. Crowd retains the original wall/gate 2700 ceiling and 150-tick
forest/bridge/gate fairness qualification; there is no assertion or deadline
relaxation. Release inclusion, served/deployed identity and actual ordinary-game
rendered acceptance remain separate and incomplete until a qualified source ships.
