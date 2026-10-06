# Acquired Worker Patrol static-clearance characterization

Caller owner `01a10933-e913`; current runtime baseline
`6c5dde0feeaa3b2f026825fe401a06676fc462d9`. This continues the documented
Worker Patrol acquired-pursuit characterization and scoped consumer adoption. It does not restart the canceled
acquired-AttackMove handoff. Core owns planner, publication/rejoin and economy
quotas; crowd owns steering/body pairs and the original queued-wall deadline;
architecture owns checkpoint-envelope import/prefix and XL audit bindings.

The only initial edits are a test-only opt-in pre-write Patrol observation in
`pathing-replay-fixture.mjs`, a small actual-command probe/regression and this
receipt. No production host, attack/Sheep flow or target policy is changed by
characterization. Actual substeps carry the acquired Patrol state at the write,
avoiding classification from the later target-free tick state.

The [exact-source baseline receipt](qa-evidence/worker-patrol-acquired-2026-10-05/baseline.json)
is captured at clean observation head `e75a887577f9f37f70b3c1d7360d90f1b4493c15`;
production server SHA-256 is `b9e0a1426aa08815d309f5a1152f1ea26f8610f62840b6c4a46e7040dcf65a56`.
Eight public-source command journeys cover both seats, open-ground and
near-stone starts, and acquired target kill/loss through fresh-server replay
recovery. No actor pose, HP, route, target, checkpoint or body admission is
injected. Stance, original Patrol cells/leg, acquired anchor, saved continuation,
range/damage and unaffected actors remain checked. The near-stone start is
`(.79,.95)` beside stone `(1,1)`, reached by ordinary Move; the independently
commanded enemy Worker settles at `(5.5,.5)` before Patrol is accepted.

Seat 0's near-stone kill/loss cases each execute 3 **strict-clearance failures** (`allowEscape:false`) and
one new static contact. Both still meet their original policy/recovery outcomes.
Two of those three steps also fail physical admission with the existing
`allowEscape:true` rule; the third is a permitted monotone escape from the prior
overlap. The baseline field `unsafeSteps` counts strict-clearance failures,
not physical rejection counts. The observer now records both measures.
Seat 1's corresponding cases and all four open-ground controls have zero unsafe
substeps/contacts. This is an asymmetric, attributed sample; no general or
symmetric acquired-pursuit failure is inferred. The existing four Patrol policy
controls previously passed while explicitly excluding acquired substeps from
static acceptance. The initial strict four-case regression was 2/4 red before
adoption. Diagnostic exit 0 means collection, not clearance.

```sh
node scripts/worker-patrol-acquired-clearance.mjs OUTPUT.json
node --test scripts/worker-patrol-acquired-clearance.test.mjs
```

The consumer adds a separate acquired Worker Patrol predicate and the existing
`.18` fallback, then adds that predicate to the two existing acquired
publication/repath rejoin guards in `simulateTick`. Original selected
tails/leading waypoints, range/leash, targets and orders remain authoritative.
No shared planner, economy/crowd algorithm or global attack/Sheep flow changes.

Source/reviewed-head receipts belong in the associated PR. Recovery here means
fresh server-module fixed-tick replay, **not native cold-process/WebSocket
recovery**. Native, full-suite, release/deployed identity and rendered acceptance
remain OPEN. The exact main source tree is represented with two explicitly
omitted unavailable >1 MiB Spearman PNG bodies; complete packaging is OPEN.
Art backing N/A: internal movement characterization, no presentation change.

A rejected profile-only candidate was tested separately: the strict near-stone
regression remained 2/4, with seat0 kill failing original 1,600-tick productive
completion and seat0 loss admitting no acquired movement. It was reverted;
none of that profile-only candidate is promoted. This distinguishes clearance from liveness.
The concrete proposed host scope is only the `simulateTick` acquired-unit
repath and initial acquired-publication rejoin condition guards (baseline
lines 8877 and 8978), plus the import of a separate Worker Patrol acquired
predicate. Both already call `rejoinSelectedUnitRoute` with the active body
radius and original automatic/static prefix guard. Preserve `getUnitAttackPath`,
`boundedAutomaticApproach`, selected tails/leading waypoints and original policy.
This proposed boundary was recorded in
[the affected-owner coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/487#issuecomment-6005420484).
The coordinating owner subsequently authorized resuming only the scoped Patrol
consumer after construction body-admission PR513 merged.

## 6 October: construction dependency refreshed, Patrol consumer adopted

The actual containing main is PR513 merge
`d27728f84f947e7936fee44b8adbf63c4e518239` (tree
`da1fa787487c1b44d7c0acfe4672c803db53efe9`). Its
`constructionBodyStepAllowed` implementation, all actual construction write
guards and explicit `.18` construction selector remain unchanged. Core owns
that shared body-admission fix; crowd retains original qualification, which is
not rerun by this Patrol lane.

Clean refreshed observation head `a90c7ef42a8c3f0fa4d4da9be20f9e84e765ced4`
reproduces all eight original policy outcomes and the same seat0 static failures:
three strict failures, two admission-rule failures, one new contact. Its server
SHA-256 is `caedcd50bf5099ad81d6dd3e4b5683bd6004155000fecb2acfda1933526051f3`.
The separate Patrol predicate/fallback plus the two existing selected-route
rejoin consumer conditions remove those contacts while retaining original
completion bounds. No pose/HP/path/checkpoint patch or alternate planner is used.

The 25 focused controls cover both seats, both callback/tick planning modes,
warm and fresh-module acquired kill/loss, Stop/Hold/Move replacements and queued
Move cancellation/recovery. Queue cancellation retains its existing acquired
AttackMove state/profile and saved route/index until original continuation
promotes the precise queued point. Pending replacement Move recovery uses the
existing single revision increment on re-enqueue. Actual acquired rejoin
observations verify the complete selected tail is retained with at most one
start-cell prefix; actual pre-write acquired substeps verify `.18` and zero
strict failures, admission failures or new static contacts. These controls now
run by default through `persistent-command.test.mjs`. The existing military
Patrol/Follow and Worker target-free/direct AttackMove controls remain present.

This slice establishes selected-route consumption and static clearance for its
observed Patrol domain. It does not qualify Patrol body-pair avoidance, revive
canceled acquired-AttackMove adoption or change target selection. Exact-head
review/check receipts remain in PR508; acquired-case native process recovery,
complete package/served/deployed identity and actual rendered acceptance remain
OPEN with caller ownership. Two explicitly unavailable atlas bodies still
prevent a complete release inventory; no metadata-only visual pass is claimed.
