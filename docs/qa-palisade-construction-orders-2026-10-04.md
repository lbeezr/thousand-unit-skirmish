# Palisade construction orders — 4 October 2026

## Report and retained reproductions

The 12:24 staging report says that placing a gate redirects a wall builder;
after completing the gate the Worker stops, and right-click on the unfinished
wall does not resume construction. The reported deployed source is
`64cc391e6d9c4164dca7bd45696cf3862fe19729`. This investigation also checks main
`278d133d548261e622ca1777d8b8ca811de37d54` rather than attributing every symptom
to an old deployment.

The actual client functions, a real Three ray/camera and empty Palisade groups
reproduce the absent cell hit area and absent friendly-construction contextual
branch in both revisions: 12 of 16 targeted regressions fail, with four
explicit-order/selection priority checks passing. This is geometry/command
evidence, not a rendered browser capture.

A separate real WebSocket/server probe places a paid three-cell line for one
Worker on each seat, waits for positive progress, then places an adjoining
gate with that same Worker. Both servers discard the line's generation/revision
sequence on gate assignment. After gate completion and another 60 ticks, both
Workers have `buildingTargetId: null` and all three paid walls remain unfinished.
Each bank stays at 240 wood (three walls plus one gate). The retained server
SHA256 identities are:

| Revision | Server SHA256 |
| --- | --- |
| `64cc391e` | `d84d3a605d8443d0b3a3896c84a6c925b9d60c0c9393634a00ea8707f794f5ba` |
| `278d133d` | `7ccea1b3541a60b69ba4b4d43e67a93e6b5c490239641a1ceb86e2e923db09bd` |

## First incremental correction: targeted resume

The normal right-click path now uses the existing authoritative
`build {buildingId, ids, unitGenerations}` admission. It targets the clicked
unfinished owned site, serializes only selected living owned Workers and keeps
the camera in place. Visible Palisade cells retain a full one-cell ground hit
area through thin/incomplete art. The existing nearest-construction help button
still focuses the nearest site; it does not change selection or recruit units.

`scripts/construction-targeting.test.mjs` executes actual picking, contextual
resolution, construction and serialization functions. Both seats cover wall
and gate, cell edges, outside/hidden denial, mixed selections, completed/enemy
sites, Shift queue and explicit movement priority. The historical reproduction
accepts `CONSTRUCTION_TARGETING_SOURCE=/path/to/retained/src/main.js`.

`scripts/construction-targeting-scenario.mjs` uses real paid placement and actual
right-click payloads on both seats. Foreign-site, stale-generation and empty
builder requests reject. The clicked walls then finish without charging again;
the clicked gate assignments survive cold restart and naturally complete. All
unselected Workers retain no construction assignment. Banks stay at 270 wood
and `nextBuildingId` stays 5 throughout resumption/recovery. Focused surrounding
selection, placement, contextual HUD and gate checks also pass.

## Retained construction continuation baseline

After the independently reviewed targeted-resume correction merged in
`6d7cb40cc7c6bb35721eea956304537697cda103`, seven additional real-command cases
check paid three-wall lines redirected to adjoining gates on both seats. Every
case starts an unrelated food Gather job with an unselected Worker, records
the paid ledger, and cold-restarts the actual server with the original seat
tokens. [Retained baseline events](qa-evidence/palisade-continuation-2026-10-04/baseline.json)
record the exact server/scenario hashes, progress, targets, refunds and schema.
The [retained originally executed scenario](qa-evidence/palisade-continuation-2026-10-04/baseline-scenario.mjs)
matches the recorded SHA256 `828029cafe617845e532b686580e03ac2d827a8832f67a8adddf6b3e4d9a6e0e`.
It is a historical source artifact: to replay it, copy it into `scripts/` so
its relative fixture import resolves, and use the recorded source revision.
The current prepared scenario has subsequently strengthened acceptance; each
new report computes its own scenario/server hashes and identifies an alternate
server entrypoint separately from the checkout revision.

| Case | Observation on retained source 6d7cb40c after recovery |
| --- | --- |
| Gate completes | Both builders idle; all remembered wall progress stays unchanged. Wood remains 240 per seat. |
| Gate is cancelled | Both builders idle; all remembered wall progress stays unchanged. Partial gates refund 14.7 wood once per seat in this capture. |
| Pending wall is cancelled during gate work | Gate completes, then both builders idle; the other two walls per seat stay unfinished. The untouched cancelled cell refunds exactly 15 wood once. |
| Explicit Stop | All paid Palisade progress stays unchanged through recovery. |
| Explicit Move | Move replaces construction; paid Palisade progress stays unchanged through recovery. |
| Explicit Gather | Gather replaces construction; paid Palisade progress stays unchanged through recovery. |
| Unrelated manual House | The distant paid House naturally completes; old wall/gate work stays unchanged through recovery. |

All seven cases preserve match identity under checkpoint schema 29, retain
unselected Workers' unrelated Gather jobs, preserve remaining building IDs,
and avoid further construction debit. Foreign cancellation rejects; repeated
cancellation refunds nothing; cancelled sites do not reappear after recovery.
The four explicit replacement cases pass the current regression floor. The
three natural continuation cases are **reproduced failures**, not acceptance.

`scripts/palisade-continuation-scenario.mjs --observe --case=complete` records
the present failure without waiting for impossible completion. The analogous
cases are `cancel-gate` and `cancel-pending-wall`. Without `--observe`, these
three cases require natural completion/resumption and are expected to fail
until the construction implementation lands. `--case=stop`, `move`, `gather`
and `manual-replacement` require explicit replacement priority now. The script
is prepared on the construction branch, not yet admitted to CI or claimed as a
passing continuation implementation.
Independent preparation review caught vacuous completion and missing builder
attribution. The current acceptance predicates require every expected paid
ID, type and team to survive recovery and settlement; House completion requires
the two actually assigned House IDs. Final passing continuation must capture
each original builder actively progressing a remembered wall. Every observed
checkpoint also checks all unselected Workers' original Gather/idle assignments,
rather than checking only two Gather Workers after completion. The natural
continuation assertions remain pending the agreed runtime foundation/fix.
The [strengthened replacement controls](qa-evidence/palisade-continuation-2026-10-04/strengthened-controls.json)
pass all four both-seat cases with the same server bytes: expected site IDs and
all six unselected Worker jobs survive every inspected checkpoint/recovery;
Stop has no route/queue, Move retains its goal, Gather retains its accepted node,
and both actually assigned distant Houses complete without resuming old work.

Preparation added two cases, bringing it to nine at that revision. Those [fresh-main observations](qa-evidence/palisade-continuation-2026-10-04/warm-and-exclusion.json)
use server bytes from main `53a47ee3`, with gameplay checkout
`f6e1b6826070a4089e6437c4a19d62b3aa04240a` and server SHA256
`5fe92df439782e3f0b5cf81a5d142f78ff30ce0b9184c765316fb72e225e56f6`.
`complete-warm` performs no restart: the Gate completes but both builders idle,
with remembered progress unchanged and 240 wood per seat. `unassigned-site`
has separate selected Workers pay for neighboring walls inside the same area,
then explicitly Stop. After the original builders finish their Gates and cold
recover, all six unselected Worker jobs and both excluded site IDs remain;
the excluded walls stay unchanged, banks stay at 225 and no new IDs appear.
Original builders still idle with their remembered progress unchanged. These
are reproduced failures. Default mode will additionally require those original
builders to complete their remembered sites while excluded neighbors stay
untouched. The executed driver was uncommitted at capture; its recorded SHA256
`a1d2dd7dfd170c92b29455dafc102e3ee335f7bb33d0ecc08be405d8c387cf11`
matches the [retained executed scenario](qa-evidence/palisade-continuation-2026-10-04/warm-and-exclusion-scenario.mjs),
which replays from `scripts/` like the original baseline artifact. The evidence
marks that provenance explicitly rather than assigning the amended driver to
the older gameplay checkout.

## Continuation boundary and unfinished acceptance

The parent's intermediate direction removed waiting for a generic framework;
fresh main then merged economy's canonical `workIntent` boundary through PR #283
at `8200ec6c`. The [actual merged-contract response](https://github.com/lbeezr/thousand-unit-skirmish/pull/283#issuecomment-5980759209)
supersedes the provisional `gatherWorkArea` proposal. Walls consumes that existing
generation-bound constructor variant and leaves accepted external-order hooks,
Gather targeting/cancellation and shared capture/restore unchanged. Construction
alone corrects legacy construction-area derivation to footprint edges plus two
world units. `wallBuildOrder` retains its execution/compatibility role, with owned
Gate IDs and targetless pending reacquisition permitted by its own validation.
Internal routes preserve durable intent; navigation route repair already carries
the compatibility sequence to its new revision. No generic formation routing or
movement helper is edited.

`src/construction-work-intent.mjs` supplies the fixed footprint bounds plus two
world units, filters remembered owned unfinished IDs and prepends an explicitly
assigned adjoining Gate without expanding the area. Adjacency inspects remembered
IDs only; an unassigned neighbor cannot extend the job. The server captures prior
construction before an accepted route and installs its sequence only for actually
assigned original builders. Unrelated House/resume orders replace it. A blocked
site preserves its IDs and clears stale route execution, then retries at most
once per second, three times per target/navigation revision. A topology change or
a new remembered target permits another bounded attempt. An idle out-of-range
builder with a failed current-target route reacquires it; active/pending routes
and in-range building continue. Checkpoints retain the canonical copied/validated
area rectangles and permit owned Gates in compatibility sequences and targetless
pending reacquisition. Legacy construction bounds derive only from remembered
paid sites or the existing unfinished target.

Runtime review caught three meaningful route-retry gaps: settled failed current
targets never reacquired, exhausted budgets carried to a different site, and a
found approach erased the budget before its later route failed. Regression tests
execute the actual updater and route finalizer; all three are corrected in the
candidate. Every automatic attempt now consumes the budget before planning.
The final eleven-case native/release proof and final exact-head review are in
progress. Retained baselines above describe their exact earlier bytes. No idle-worker
recruitment, global job search, combat or Patrol rewrite belongs in this fix.

Walls/gates owner retains source/release integration and the next continuation
slice. Parent schedules native wall/gate acceptance after a containing identified
deployment. The animation Mac task `01a106da-40ec` currently owns its browser;
this investigation does not operate it. No deployment, new artwork, Chromium
sandbox bypass or GPU/user acceptance is claimed.

Native recipe: select one Worker, draw a paid line, place an adjoining gate with
that same Worker, and observe gate completion/continuation. Explicitly select
the Worker and right-click a visibly unfinished wall and gate cell, including
space beside a thin post. Confirm the chosen site begins progressing, selection
and camera stay put, unselected Workers retain their jobs, Shift/Move/Stop take
priority, and reconnect preserves paid progress. Record served source, map,
both seats and actual captured behavior; an older staging capture does not
accept the new source.
