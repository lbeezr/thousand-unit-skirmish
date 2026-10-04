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

## Continuation boundary and unfinished acceptance

The [owning workstream decision](https://github.com/lbeezr/thousand-unit-skirmish/pull/87#issuecomment-5979931148)
proposes keeping only the assigned builder's remembered paid wall sequence when
redirected to an adjacent gate. Explicit Move/Stop/Gather/Attack/repair or an
unrelated manual replacement must invalidate continuation; internal route
repair preserves the generation/order revision. No idle-worker recruitment,
global job search, combat or Patrol rewrite belongs in this fix. The economy
owner (`01a101f7-5683`, tree continuation) owns the shared task boundary; server
continuation edits require that agreement. This first slice changes client
targeting only, not the reproduced server interruption.

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
