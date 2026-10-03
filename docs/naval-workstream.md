# Naval gameplay workstream

[Roadmap](roadmap.md) · [Normal-game acceptance](qa-skiff-normal-entry-2026-10-03.md) · [Fishing contract](skiff-fishing-next-move.md)

Owner: fishing/naval gameplay worker `/root`. Charter refreshed by the user on
3 October 2026: carry the existing paid fishing loop through normal Practice
entry, investigate demonstrated naval correctness gaps, and retain deployment
and in-game acceptance. Coastal art has its own owner. No speculative weapons,
passengers, naval combat or new currency belongs in this loop.

## Ranked backlog

| Rank | Outcome / state | Next action and acceptance | Write boundary / dependency |
| --- | --- | --- | --- |
| 1 | Ordinary deployed Practice fishing acceptance — **blocked execution** | At identified staging revision, root Practice → Match Controls → SHORE FISHING → gather 175 wood → Dock → paid Skiff → fish and two Shift water Moves. Observe 10 food banked, 50 fish left; check Stop keeps cargo and Return deposits before movement. Record screenshots, mouse input and resumed match. | This owner's QA evidence and any reproduced correction. Needs a reachable staging origin and a functioning sandboxed browser; network tunnel returns 403 and local Chrome sandbox cannot launch. No independent deployment or credential/sandbox workaround. |
| 2 | Retained authored pilot reproduces its current normal map — **fixture repair integrated upstream; catalog proof passed** | Two reproduced authoring failures now pass with the existing audio reference. Current main independently integrated the identical fixture repair in PR165; no duplicate fixture change remains in PR181. Seeded helper/CLI preserves stock and unrelated fields. Catalog assertions and recipes follow SHORE FISHING without its former Lab prefix. | Owned catalog assertions and normal-game recipes. Current map/audio owners' runtime binding is consumed unchanged; no new audio, global catalog rule or listening claim. Exact review/integration evidence is in [PR181](https://github.com/lbeezr/thousand-unit-skirmish/pull/181). |
| 3 | Paid one-player Practice tool proof — **local tool acceptance passed** | Actual root handler/room service with one Azure player gathers/pays 175, clicks default Dock/Skiff choices, restores pending fishing Moves, banks 10, then Stop/recovers/returns positive cargo. Inactive seat stock is untouched; old two-seat proof passes. [PR181](https://github.com/lbeezr/thousand-unit-skirmish/pull/181) owns exact review, integration and postmerge checks; the next gameplay action is rank 1. | Owned adoption scenario, its CI registration and QA. Uses existing fixture `connect(..., roomId)` and checkpoint path support; no shared runtime schema or naval code change. This tool pass does not close browser acceptance. |
| 4 | Existing Dock-loss / cargo / queue correctness audit — **complete; no defect reproduced** | Inspection finds `destroyBuilding` clears affected water drop-off references/routes before fishing update; all 43 focused Skiff lifecycle/queue/contracts and room-launch checks pass. No runtime correction is justified by this audit. Reopen only with concrete gameplay/recovery evidence. | Read-only server and Skiff modules; existing tests. Coordinate an actual shared runtime edit with its affected owner before editing. |

Keep priorities evidence-driven. Finish each bounded reviewed change through
normal author-owned merge and proportionate postmerge checks, then take the
highest executable justified item. A blocked browser must not turn into invented
mechanics or a giant PR. Stop dependent acceptance when execution is unavailable;
retain the exact blocker and recovery action here. At most two owner PRs remain
unfinished; no PR merge closes an unverified gameplay outcome.

After this scoped tool/evidence integration, rank 1 is the only justified
remaining action here and depends on unavailable browser/network execution.
Retain ownership and report that blocker; do not invent a second naval feature
to keep the worker busy. Coastal art continues independently.

## Current delivery boundary

At 22:45 UTC on 3 October, read-only Railway `environment-status` and
`list-deployments` identify successful active staging deployment
`29d74cac-b078-4a88-8f2a-e3141a2f9465`, source
`32f11d58018404835fd47489441f9cdfef7c403b`, with one running replica.
Git ancestry confirms it contains [PR131](https://github.com/lbeezr/thousand-unit-skirmish/pull/131),
[PR143](https://github.com/lbeezr/thousand-unit-skirmish/pull/143) and
[PR155 Practice](https://github.com/lbeezr/thousand-unit-skirmish/pull/155).
That establishes platform-reported code delivery, not received game bytes or
actual player use. Ordinary deployed acceptance remains open.

The staging root `https://game-staging-21f9.up.railway.app/` returns a proxy
CONNECT-tunnel 403 from this executor before the application can be reached.
Local Chromium's SUID sandbox helper is owned by `nobody` rather than root and
aborts startup. No sandbox bypass or credentials were used. Recovery requires a
reachable authorized game/browser executor; the parent / coordinated delivery
owner retains environment operation, this owner retains naval acceptance.
