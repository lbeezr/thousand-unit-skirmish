# Ordinary crowd steering — 5 October 2026

Owner `01a10933-c2b0-70f1-991d-761518eb5010` retains
[draft PR400](https://github.com/lbeezr/thousand-unit-skirmish/pull/400), its source
integration, packaging, deployment identity and ordinary rendered acceptance.
This is an in-progress implementation record; it does not claim a merge or
completed gameplay acceptance.

## Exact source checkpoint

The retained candidate is clean source
`eb43a9767de76dfbd1bfc21bdcde26c04668fa73`.
The [evidence manifest](qa-evidence/ordinary-crowd-steering-2026-10-05/manifest.json)
binds its server/module hashes, unchanged historical input hash, captured new
inputs, results and check logs. The [raw journey records](qa-evidence/ordinary-crowd-steering-2026-10-05/journeys.json.gz)
reuse the preserved forest inputs and capture validated bridge/gate inputs.
These are prepared fixed-tick production-handler journeys, not native process,
rendered gameplay or deployment proof.

| Existing geometry / action | Arrivals / ticks | Terrain / body contacts | Maximum revision repairs |
| --- | --- | --- | --- |
| Retained Infantry and mixed Scout opposing pairs | 2 / 279 each | 0 / 0 | 0 |
| Retained opposing 16-unit forest formations | 32 / 417 | 0 / 0 | 8 |
| Dry land bridge, both seat orientations | 32 / 417 and 438 | 0 / 0 | 8 |
| Paid completed opened gate, both seat orientations | 32 / 417 and 438 | 0 / 0 | 8 |

Bridge and gate repeats are exact from each retained input. Their maximum net
progress gap is 72 ticks, maximum published-route count is nine, and last-arrival
seat differences are 23 and 12 ticks. All selected destinations remain intact.
The retained forest observer measures displacement gaps separately; no missing
net-progress measurement is represented as zero.

At the same source, 132 existing movement/endpoint/body controls pass. Types,
syntax, runtime imports (205 modules, no cycles) and documentation pass.
The focused crowd run is **29/30**, with **17/18** module controls and all twelve
real-journey controls passing. The newly retained perpendicular-goal control
is red: a stale progress clock incorrectly forces a front actor to retreat into
its same-route follower. It is an acceptance failure, not waived or marked TODO.

The [independent exact-source review](qa-evidence/ordinary-crowd-steering-2026-10-05/independent-review.json)
reruns 17/18 module and 12/12 journey checks, finds no new critical physical
safety or scope issues, and confirms liveness is blocking. It grants no merge
approval and does not replace the affected wider controls.

The [unchanged 64-unit queued gate seat-1 case](qa-evidence/ordinary-crowd-steering-2026-10-05/queued-gate-seat-1.json)
reaches **60/64 at 2,700 ticks**, leaving actors 94, 102, 103 and 104 unfinished.
Independent review identifies a statically boxed spawn pair and expensive
parked-body/gate detours. Earlier material queue/topology regressions remain
open until fresh full acceptance establishes otherwise. The 32-unit pass does
not establish large-group liveness, bounded release or global deadlock freedom.

The [movement plan](movement-pathing-workstream.md#u5-crowd-owner-reservation--4-october-2026)
and [shared hook agreement](https://github.com/lbeezr/thousand-unit-skirmish/pull/400#issuecomment-5985598359)
allocate a separate military ordinary-Move steering module, private bounded
serial-neighbor query and crowd-wait consumer. Core PR395 remains responsible
for Worker economy/static clearance; construction PR399 retains construction
travel. The three position admissions, accepted orders and planner remain
unchanged. Worker ordinary Move is also excluded from this first crowd slice.
Combat, water and wildlife adoption remain separate. Art backing: N/A for this
internal authority change; the existing forest-gap geometry is reused.

## Physical policy and retained acceptance

Eligible ordinary/group/queued land military movement proposes only its own
position. Every admitted short proposal uses the existing static circle profile,
cell/elevation admission, real map clamp and exact body capsule sweep against
current serial positions. Inherited overlap may only escape monotonically.
Parked bodies retain their state. Cell offsets propose intermediate same-cell
targets; they do not establish clearance or replace selected final goals.

The query bounds both bucket visits (128) and retained neighbors (64), including
dead/self/filtered visits. Overflow waits without truncating the physical set.
The module has fixed heading/length, lane-boundary and eight-body tangent
proposals. Transient progress/detour state resets with actor identity, accepted
order, navigation or waypoint changes and never enters checkpoint state.
Stopped/held, pending, economy, construction and combat callers are excluded.

The [retained land-body inputs](qa-evidence/ordinary-move-static-clearance-2026-10-04/substeps.json.gz)
are consumed unchanged. Earlier measurements remain historical evidence:
Infantry and mixed Scout opposing pairs had 11/9/9 penetrating serial steps;
the two 16-unit formations had 5,183. An earlier candidate reached both
actors in each pair by tick 279 and all 32 formation goals by tick 632, with
zero observed swept terrain/body contacts; the checkpoint above supersedes
that candidate's arrival measurement. These fixed-tick observations are
not CPU capacity, native scheduling or rendered appearance measurements.

The new registered journey controls reuse that geometry for a dry one-cell land
bridge between water belts and a normally paid, completed, opened palisade gate.
Both seat orientations run two 16-unit Moves twice from the same validated input.
They check exact accepted goals, serial swept contacts, full parked records,
900-tick arrival, 360-tick maximum net progress gap and 150-tick last-arrival
seat difference. Paid gates debit 15 Wood from the named owner. Separate
both-seat controls cover Stop replacement, checkpoint resume and a queued goal
that waits for a stopped actor's own later Move before exact handoff.

Eight old fractional-corner controls requested a point physically occupied by
stopped circles. Their new acceptance retains the exact point/queue without
shoving or repair, then explicitly releases that legacy diagnostic obstruction
and checks exact arrival. The original poses include parked overlap/static
penetration; their release is labeled diagnostic placement, not a command-only
witness. The separate parked-actor controls use actual Move commands to clear
a physically valid obstruction. Historical study traces remain unchanged.

## Failures and bounded repair

Initial local policies prevented contacts but stalled 32-unit traffic; observed
arrival counts ranged from 0 to 17 at tick 1,800. Selecting a nearby legal
same-cell point, enforcing consistent passage sides and preserving parked
obstacle detours removed those failures in the scoped retained journey.
Independent review then found an invalid wall-side detour target; evaluating
both sides and invalidating a stalled detour fixes the retained reproduction.
Two Scouts that cannot fit abreast have finite yielding controls in both serial
orders rather than being treated as a two-lane physical fit.

Broader existing 64-unit topology/queue controls exposed obsolete waypoints
across a wall after deflection. The crowd branch had hidden the original static
repair trigger behind legal oscillation. The corrective handoff stays within
the agreed vector/target contract: an explicitly rejected terminal proposal is
returned only when the exact unchanged pre-write guard necessarily rejects it.
Farther obsolete targets additionally require 30 ticks of net stall and an
actual blocked static sweep. It consumes no position, waypoint or movement
budget, and uses existing bounded repair to retain the goal/queue. A strict
point overlap alone is insufficient because inherited escape may be admitted;
direct regressions retain that counterexample.

The affected 64-unit queued gate seat-0 reproduction improved from 46/64 at
tick 2,700 to 64/64 at 1,096; queued-wall removal seat 0 improved from 52/64 to
64/64 at 1,030 in an earlier candidate. These are historical results, not fresh
acceptance for the retained checkpoint. Seat-1 counterflow/queue controls remain under qualification;
their failures are not replaced by the 32-unit pass. The source must not merge
while material routing regressions remain.

## Delivery and remaining work

Next: resolve the retained liveness failures using the existing 64-unit inputs,
then rerun exact-head review and full affected controls before a clean pack and
normal author-owned merge. Broad peer release, alternate direction/lane rules,
midpoint detours and own-retreat trials were retired after degrading 64-unit
return traffic; they are not in this checkpoint. Review's reduced boxed-pair
controls reproduce failure without new contacts and are diagnostic evidence,
not additional benchmark or journey completion proof.

The [specific core-interface decision](https://github.com/lbeezr/thousand-unit-skirmish/pull/400#issuecomment-5986484334)
asks owner `01a107ba` whether a separately scoped transient passage/wait
arbitration controller can extend the original hook agreement, which excluded
new flow algorithms. Crowd retains a reviewable design and the reproduction;
new integration beyond that agreement is dependent on this concrete decision.
The existing admissions, planner, orders and Worker policy remain unchanged.
This is not a parent merge queue or a global rendered-acceptance gate.

The cloud renderer capability attempt at clean source
`8f36c252f681f3dbaa1fa18a85ec3303cd5b4022` was blocked by the Linux browser
sandbox and unavailable storage. The [retained capability record](qa-evidence/ordinary-crowd-steering-2026-10-05/renderer-capability-blocked.json)
produced zero WebGL readbacks, game frames
or screenshots. The blocked capability is recorded once; no browser-security
change or launch retry is authorized. CI/capture owner `01a10378` retains the
existing capture interface. Crowd retains ordinary rendered verification at an
identified deployed release. Clean release digest and deployed source are
currently unverified; merge/source/pack evidence must remain separate.
