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
| 2 | [PR185 stance controls](https://github.com/lbeezr/thousand-unit-skirmish/pull/185) provides four labelled choices, confirmed/mixed state and snapshot eligibility in the existing strip. 185 focused tests pass; client/Docker admission and actual packed HTTP checks pass. The actual command/snapshot probe against merged combat confirms all four choices for paid Infantry/Archers on both seats, Worker exclusion, Mixed and visible Stop/Hold stance updates. | HUD owner retains [stance delivery and native recipe](military-stance-hud.md). Source scope is the browser leaf/test, selected-unit markup/CSS, HUD snapshot hooks, public client admission and bounded observation of the marked stance group. Keep the command/snapshot path as a postmerge check, identify the user deployment, and obtain native status-growth/full keyboard acceptance. | Combat owner merged [PR159](https://github.com/lbeezr/thousand-unit-skirmish/pull/159) at `913afa2b`, retaining policy/recovery. The checkpoint collision was resolved by schema 25 following wildlife schema 24; [simulation evidence](qa-military-stances-2026-10-03.md) records legacy recovery. HUD owner retains an identified user deployment and parent-owned Mac normal-game/VoiceOver acceptance. |
| 3 | [PR180 live-layout strip fix](https://github.com/lbeezr/thousand-unit-skirmish/pull/180) merged at `57a762f`: focus follows cargo/label growth, viewport changes and added/removed buttons. Independent exact-head review and 99 postmerge tests, docs/client/release guards pass. | HUD owner retains [dated native cargo/resize recipe](contextual-hud-validation.md). PR185 additionally marks the stance group for bounded size observation and reproduces/fixes status-only growth that shifts buttons without resizing them. | Source integration is established; deployed/native usability remains open with parent-owned Mac QA. Verify retained Formation focus during cargo/label growth, the stance reason while offline/finished, viewport/minimap resize and ordinary manual scrolling on an identified build. |

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
