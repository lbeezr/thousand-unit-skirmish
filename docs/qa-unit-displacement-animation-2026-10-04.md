# CPU displacement-to-animation integration — 2026-10-04

Production source `53a47ee3` contains selector PR #284, direct-ground trajectory
PR #285, and the Infantry default restoration #286. A bounded cloud CPU run
passes 64 cases: Worker/Spearman × eight bearings × both teams × full/low
detail. This adds the missing client update-loop and decoded source-cell links
to the existing selector/clock tests; it does not repeat the 47-check suite.

The runner executes the committed `src/main.js` displacement interpolation,
heading easing and transform-update scheduling, calls the real sprite runtime,
and maps its Three instance UV buffer back to committed frame keys. It checks
clock/timeline phase, actual interpolated velocity, exact facing after turn
settling, continuous clocks through turns, Stop-equivalent held snapshots,
idle and resumed first frames. Snapshot displacement is deterministic input;
server path generation, paid production and Stop-command handling are separate.

The two approved manifests are Worker v0.33 (`cast-human-sprite-v3`) and
Spearman v0.3 (`spearman-sprite-v1`). Runtime PNG hashes are verified against
their manifests; the existing Node RGBA decoder reads their actual actor cells. Pixel hashes anchor
the ground pivot and clear RGB under transparent pixels, preventing atlas
offsets or invisible bytes from faking advancement. Named walk keys aliasing
identical visible cells fail. Exact pixel differences establish source change,
not anatomical gait quality or rendered appearance.

| Pack | Authored walk directions | Distinct frame keys / visible cells / silhouettes |
| --- | --- | --- |
| Worker v0.33 | All eight | 8 / 8 / 8 in every direction |
| Spearman v0.3 | SE | 8 / 8 / 8 |
| Spearman v0.3 | N, NE, E, S, SW, W, NW | 1 / 1 / 1; exact-facing idle fallbacks, missing gait art |

Negative controls prove the checks reject a frozen clock (64 failures), forced
SE UV selection (56 non-SE failures), and identical cell hashes beneath
different authored walk keys (36 authored-walk failures). The cell control
injects identical fingerprints into the comparison; it does not alter PNGs.
The positive run exits 0 with `passed-with-art-gaps`; each negative run exits 1.
Syntax, architecture and checked-JavaScript/Node boundaries also pass.

Run from the repository with the locked Node dependencies installed:

```sh
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-proof
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-frozen --negative=frozen-clock
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-facing --negative=wrong-heading
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-static --negative=duplicate-cells
```

Each run writes `checks.json` with source revision/dirty flag, pack/PNG hashes,
per-case UV/frame/heading/displacement samples, missing art and failures. This
is an owner-run diagnostic and requires no browser, Python or new dependency.
The extraction fails if the committed client loop/constants move, rather than
silently testing a copied implementation. Texture loading uses a CPU stub.

No GL context, browser frame, screenshot, live staging or ordinary server
command acceptance is claimed. These checks cannot prove that the atlas is
uploaded to a GPU, that a browser draws it, or that the live client reaches the
same state. The initial cloud Chromium sandbox/Firefox download blocker is
separate. The parent cloud browser owner retains native temporal acceptance;
the path owner retains PR #285 trajectory evidence. No new art or runtime
behavior changes are included here.

## Gameplay diagnostics lane — 5 October 2026

The audit at `b5b4dd49` found a reproducible reporting gap: Spearman v1
resolves all eight walk clip keys, but seven keys reference exact-facing idle
frames. The existing post-render `worker-animations` probe exposed clocks and
UVs without the action/direction selection provenance. Fourteen of sixteen
both-seat heading cases therefore need an explicit idle-placeholder signal;
the two SE cases have eight distinct frame IDs. This is source/CPU evidence.

The existing runtime now offers read-only `observeAction(unit, now, localTeam)`.
It reports role/version, requested and selected action/direction, frame counts,
independent fallback flags and a reason (`exact`, `idle-placeholder`,
`direction-fallback`, `action-fallback`, `missing-clip`). Typed Food/Wood gather
is treated as its requested resource action. A static authored action or ordinary
idle is not labelled an idle placeholder. Distinct IDs do not certify distinct
pixels, anatomical motion or GPU drawing; the existing decoded-cell/UV checks
remain authoritative for their own scope.

The existing post-render probe calls it only for local, visible Worker/Spearman
records, retaining at most eight explicitly targeted provenance observations
or 32 opening observations per frame. Existing samples remain capped at 180.
The new method has no history and does no work during ordinary rendering;
clock, state selector, sprite update, artwork, matrices, geometry, admission and
server/public session contracts are unchanged. Enemy and retained fog records
are rejected before role lookup. No coordinates, unit identities, targets or
session fields are added to the provenance value.

`identifyUnitFrame` consumes the captured provenance, checks it against the
retained manifest/selector alongside actual UV/clock checks, and retains it in
heading/Stop evidence. CPU tests drive the real runtime through the actual
serialized post-render observer, verify unchanged units/matrices, reject false
completeness/borrowed-heading/missing signals, and test opening/target limits,
privacy and the existing sample cap. The tests run through existing registered
`unit-animation-runtime` and `registered-foot-sprites` checks; no new framework
or standalone unused utility is introduced.

Owner: gameplay diagnostics lane. Foot-art owner `01a10469` retains default art
coverage/held PR230/241; shadow-renderer owner `01a10c3c` retains geometry and
render work. Read-only ownership inspection found clean main and only held art
PR25/230/241 open. This slice changes no art/default/version/selector/update or
shadow hook, and introduces only the additive observation method and existing
animation-domain adapter evidence. Their implementation scopes remain separate.

The one normal-sandbox cloud capability attempt in this executor returned
`sandbox-unavailable` and `storage-unavailable`, zero WebGL readbacks, game
frames or screenshots. Do not retry that launch or any denied hosted dispatch.
The diagnostics owner retains ordinary packed/staging observation through the
existing shared capture adapter on a capable authorized cloud runtime; no Mac
work, access changes or new diagnostic platform are requested. Source/package,
served/deployed identity and actual rendered acceptance remain separate.

### Ranked next diagnostics slices

| Rank | Measured risk / next action | Owned scope and acceptance |
| --- | --- | --- |
| 1 — current slice; rendered use open | Clip labels conceal seven Spearman idle walk placeholders. Integrate and retain provenance in existing animation capture evidence. | Read-only runtime observation and animation-domain adapter/tests. Both-seat 14 placeholder / 2 exact controls; false provenance rejected; no selector/art changes. Identified deployed/GPU consumer use still requires the existing capable capture owner. |
| 2 — implemented; review/integration and rendered use tracked in its PR | Pending and seven representative loader failure paths originally produced the same null action observation. The existing animation probe now retains bounded aggregate load state and finite failure provenance, including failure before any capture. | Read-only `observeLoad()` and existing adapter/report only; no roles, URLs, error payloads, identifiers, counts or timestamps. Promise outcomes, warning identity/count, all-or-nothing admission and late sibling controls remain unchanged. Shadow no-overlap confirmation and precise foot-art supported-version-only patch inspection cover the allocated loader boundary. |
| 3 — pause ambiguity reproduced; hook agreement pending | On both seats, a production crowd wait, Hold and planning-pending state produce identical ordinary unit rows. Select one finite observation in the existing private queued-gate report; do not infer a deadlock from missing motion. | Requested owned actors only, at most eight current-step observations; no paths, targets, neighbors or public/session transport changes. Crowd/core owners must agree the exact replay hook before implementation. Rich native instrumentation and movement policy stay with their owners. |

### Pending versus failed loader provenance — 5 October 2026

The bounded CPU audit at `c42a9b4b` reproduces HTTP, fetch rejection, JSON
rejection, missing unit asset, missing page files and both color/mask texture
failures. Every failure has the same null action observation as pending loading,
false ready result, one warning and zero meshes. Success makes one manifest/two
texture attempts and admits two meshes. A successfully loaded late sibling
cannot admit the group after another role failed. These are controlled CPU
inputs to the existing loader, not rendered or provider-deployment evidence.

The additive `observeLoad()` returns a fresh, fixed-size `{state, stage, cause}`.
Pending is `pending/loading/null`; aggregate success is `ready/complete/null`.
Failure uses finite stages (`manifest-request`, `manifest-decode`,
`manifest-shape`, `texture-load`, `color-texture`, `mask-texture`, `pack-setup`,
`batch-admission`) and causes (`http`, `rejected`, `invalid`, `exception`).
`rejected` identifies a promise rejection at that stage, not an inferred
network/parser/provider reason from free-form text. No roles, URLs, HTTP status
codes, error messages/stacks, entity data, identifiers, counts or timestamps are
exported. The first recorded failure remains terminal despite late siblings.

Failure observers attach to the actual existing promise outcomes. Returned
promises/rejection objects, load order, role/texture Promise.all admission,
warning and retry policy remain intact. A synchronous fetch throw still aborts
the factory before a runtime exists; this interface cannot report that case.
A texture callback that synchronously resolves before an executor exception
retains its original success. Aggregate diagnostic readiness follows completed
batch setup and setVisible; even a failure after the internal ready flag changed
is reported as failed. Existing partial side effects in that exceptional case
are preserved rather than silently changing renderer policy.

The existing post-render animation probe reads once per frame outside its unit
loop, retaining the existing 180-snapshot cap and action-observation limits.
No new entity census/history, normal-render callback, retries or textures are
added. The domain adapter checks readiness before animation acceptance, accepts
a loader failure in the existing startup wait, and always writes its existing
`unit-animation-acceptance.json` under the shared case evidence directory.
Pending timeout and early failure therefore retain truthful loader status even
with zero screenshots. Invalid/extra-field snapshots are discarded before
retention, keeping arbitrary payloads out of the report.

Boundary coordination: the parent relayed shadow owner `01a10c3c`'s no-overlap
confirmation at merged `2b4a5246`. At `231a5de6`, the actual loader/probe files
are unchanged since the audit. Read-only inspection of held PR230/241's exact
`src/unit-sprite-runtime.mjs` patches shows only supported-version additions in
`spriteDirectory`, which this increment leaves unchanged. The parent explicitly
authorized proceeding after this precise non-overlap check while foot-art review
remains pending. No foot-art approval or held art release is inferred. Diagnostics
owns this implementation; art owners retain artwork and visual acceptance.

Existing registered tests cover the real runtime-to-serialized-probe-to-report
path, pending/success/failure, malformed shape and setup errors, sync promise
outcomes, first failure/late siblings, fresh immutable observations, original
warning objects and admission counts, one read per frame, and missing/false
readiness or private extra-field rejection. The adapter's early-failure and
pending-timeout report test is a CPU mock with no GPU or screenshot acceptance.
The previously recorded cloud sandbox/storage failure remains blocked; no
browser or denied hosted dispatch was retried. Source, clean release/local
packed HTTP and actual deployed/rendered states remain separately recorded in
the increment's PR. Art backing N/A for this internal diagnostic change.

### Disclosed-local pause audit — 5 October 2026

At source `e839f59d`, the existing production movement/snapshot bodies reproduce
three distinct pause states on both seats with identical ordinary unit rows:
`waitingForCrowd`, Hold, and `movePlanningPending`. The controlled inherited
static-escape/body-admission fixture in `scripts/unit-movement.test.mjs` provides
the crowd wait: its vector returns `waitingForCrowd`, actor state does not change,
and no repair is queued. Hold also leaves the actor unchanged; pending planning
has the same transmitted row. Opposing-seat hidden rows remain absent. This is
a bounded CPU contract audit, not a new choke algorithm study, native scheduling
result, actual player session or rendered observation.

The existing animation probe sees position, walking, task and productive work,
but receives neither the authoritative pending flag nor vector/repair outcomes.
It therefore cannot truthfully derive a body wait or accepted repair from that
row. A finite cause must come from the actual observation boundary; a timeout or
missing animation alone must not become a stuck-unit claim.

The smallest current consumer identified is `runQueuedGateCase()` in
`scripts/queued-gate-pathing.mjs`. Its current report retains controller maxima,
missing controller records and unfinished actors, but no finite pause observation
for a selected owned actor. The proposed shared boundary is the existing
`recordReplayCrowdStep` and repair-entry hooks in
`scripts/pathing-replay-fixture.mjs`. Owner agreement with crowd `01a10933-c2b0`
and core `01a107ba` is pending; no hook or algorithm has been changed.

Any implementation should opt in a valid team and at most eight requested owned
actors before reading their movement fields, retain one current-step observation
per actor, and return fresh finite projections in request order. It must not
enable `traceActorIds` merely to obtain this projection: that richer existing
trace records paths, goals, queues and neighbors. It must clear observations on
step/reset/restore and reject stale generation/order revisions. A vector wait
means the last observed vector evaluation waited, not that the whole tick had
zero motion. A positive vector is a proposal, not admitted movement. The repair
hook observes an attempt before validity/admission checks, so it cannot label
repair accepted. Missing observations stay unobserved. Hold/work/planning controls
must not be marked as unexplained stalls.

This proposed increment is private replay/report tooling. It adds no normal
player unit-row fields, public health/session data or browser cause claim, and
does not expose enemy movement internals even when an enemy actor is visible.
Source/tool consumption, packaged runtime, identified deployment and actual
rendered acceptance remain distinct. Art backing N/A.
