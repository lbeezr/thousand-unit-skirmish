# Compact HUD and controls backlog

Owner: HUD integration owner. This is the ranked work list for the ongoing HUD
lane, under [planning rules](contributor-planning.md). Keep small reviewed PRs
and exact evidence beside each item; a merged source milestone does not close
an in-game outcome. Dense, subtle, dismissible controls and retained labels
remain the direction. No final visual redesign has been approved.

## Ranked work

| Rank | Outcome and current evidence | Next action and write boundary | Dependencies and acceptance |
| --- | --- | --- | --- |
| 1 | Six default glyphs and reachable keyboard strip: [PR134](https://github.com/lbeezr/thousand-unit-skirmish/pull/134), [PR150](https://github.com/lbeezr/thousand-unit-skirmish/pull/150). Source/release checks pass; native acceptance remains open. | HUD owner retains [normal Millrace recipe](contextual-hud-validation.md#six-default-action-glyphs--3-october-2026). Record exact native result in the PR/owning guide; fix a reproduced defect in its own scoped PR. | Railway staging reports source `32f11d58018404835fd47489441f9cdfef7c403b`, SUCCESS deployment `29d74cac-b078-4a88-8f2a-e3141a2f9465` (3 October 2026); ancestry contains both merges. Ordinary cloud HTTP verification failed DNS `EAI_AGAIN`; browser preflight remains sandbox/storage unsupported. Parent-owned Mac QA must reconnect and verify native small-size glyphs, full Tab/Shift-Tab rings, cargo/unit/building states, Shift-wheel and Escape/Close recovery. Relevant user browser environment remains unspecified. |
| 2 | Concise visible military stances. [PR159 contract](https://github.com/lbeezr/thousand-unit-skirmish/pull/159), `docs/military-stances.md` at `f2b487d`, defines `setStance` and generation-matched `unitStances`. | HUD owner implements four labelled choices, actual/mixed stance and eligibility in existing selected-unit controls; bounded client module, HUD-only `main.js`/HTML/CSS sections, client asset admission and focused DOM/handler tests. | Combat owner retains authoritative policy/command/recovery and source integration. Consume the published contract: missing entries are ineligible, not Aggressive; Workers/unarmed/enemies remain excluded. No optimistic stance confirmation. Verify both seats, mixed/stale/dead/spectator/building selection, reconnect/rematch, actual command payload and subsequent server snapshot. Deployed/native acceptance stays open until identified normal-game proof. |
| 3 | A focused command can become clipped when preceding cargo/actions appear or the viewport changes without another focus event. Existing focus-only binding misses that state. | Assigned strip implementation stream owns `src/hud-layout.mjs`, observer/geometry tests and a dated validation appendix. Root stance edits avoid that module. Add bounded layout observation with cleanup and preserve ordinary scrolling. | Reproduce baseline failure with synthetic geometry, then prove cargo/label growth, viewport change, inserted/removed buttons, hidden/later focus and unchanged-layout/manual-scroll behavior. Independent source review, normal merge and postmerge guards; native focused-Formation cargo/resize recipe remains with Mac QA. |

## Interfaces and boundaries

- Lobby/Practice/mode owner retains room/pregame/network entry sections. HUD
  changes use existing selection and snapshot application; coordinate a concrete
  overlap before editing those sections.
- Combat owner retains stance semantics, eligible snapshot entries, command
  validation and simulation. HUD consumes that interface; it adds no acquisition,
  chase, pathing or stance defaults of its own.
- Animation/art owners retain clips, effective unit appearance and gameplay-art
  mappings. This lane does not replace unit/building art or invent stance animation.
- Railway delivery owner supplies an identified relevant user build. HUD owns
  release checks and keeps deployment/native gaps explicit; no manual deployment,
  sensitive permission expansion, paid assets or private-image publication is
  authorized by this backlog.

Review current main and new native/command evidence before choosing another
slice. If these dependencies are unavailable and no further reproducible HUD
defect is justified, checkpoint here and report the specific blocker. Do not add
speculative work to keep a worker busy.
