# Compact HUD and controls backlog

Owner: HUD integration owner. This is the ranked work list for the ongoing HUD
lane, under [planning rules](contributor-planning.md). Keep small reviewed PRs
and exact evidence beside each item; a merged source milestone does not close
an in-game outcome. Dense, subtle, dismissible controls and retained labels
remain the direction. No final visual redesign has been approved.

## Ranked work

| Rank | Outcome and current evidence | Next action and write boundary | Dependencies and acceptance |
| --- | --- | --- | --- |
| 1 | Six default glyphs and reachable keyboard strip: [PR134](https://github.com/lbeezr/thousand-unit-skirmish/pull/134), [PR150](https://github.com/lbeezr/thousand-unit-skirmish/pull/150). Source/release checks pass; native acceptance remains open. | Parent-owned Mac QA retains the [normal Millrace recipe](contextual-hud-validation.md#six-default-action-glyphs--3-october-2026). Verify small-size glyphs, full Tab/Shift-Tab rings, cargo/unit/building states, Shift-wheel and Escape/Close recovery; record an exact native result before choosing a defect fix. | Identify a relevant user build containing `68e46aa` or a descendant, not the removed `32f11d5` deployment. Parent owns build acceptance and staging coordination; Railway delivery owner supplies the identified build. See the dated delivery checkpoint below. |
| 2 | [PR185 stance controls](https://github.com/lbeezr/thousand-unit-skirmish/pull/185) merged at `68e46aa43cf6712edeed8ecab15d342bcbc9499d`: four labelled choices, confirmed/mixed state and snapshot eligibility in the existing strip. 235 postmerge HUD/stance/order checks pass. The shipped-HTML/real-binding two-seat command/snapshot probe confirms all eight choices for paid Infantry/Archers, Mixed, Worker exclusion and visible Stop/Hold checkmarks. | Parent-owned Mac QA retains the [stance native recipe](military-stance-hud.md#acceptance-and-remaining-delivery): normal military choices, reconnect/rematch, status growth, full keyboard visibility and VoiceOver states. HUD owner fixes only a reproduced control defect in a bounded PR. | Source/provider and packed-release integration are established. [PR159](https://github.com/lbeezr/thousand-unit-skirmish/pull/159) at `913afa2b` retains combat policy/recovery; schema 25 follows wildlife schema 24, with [simulation evidence](qa-military-stances-2026-10-03.md). Identified relevant-user delivery and native acceptance remain open. |
| 3 | [PR180 live-layout strip fix](https://github.com/lbeezr/thousand-unit-skirmish/pull/180) merged at `57a762f`: focus follows cargo/label growth, viewport changes and added/removed buttons. Independent exact-head review and 99 postmerge tests, docs/client/release guards pass. PR185 also fixes reproduced status-only growth through bounded observation of the marked stance group. | Parent-owned Mac QA retains the [dated cargo/resize recipe](contextual-hud-validation.md#focused-command-after-live-layout-changes--3-october-2026). Verify retained Formation focus during cargo/label growth, offline/finished stance reasons, viewport/minimap resize and manual scrolling. | Run on the identified build containing `68e46aa` or a descendant. Source/model geometry does not establish deployed/native usability; the HUD owner retains any resulting bounded fix. |

## Source and delivery checkpoint — 3 October 2026

Source `68e46aa43cf6712edeed8ecab15d342bcbc9499d` contains PR134, PR150, PR180,
PR159 and PR185. PR185's [exact-head COMMENT review](https://github.com/lbeezr/thousand-unit-skirmish/pull/185#pullrequestreview-5403460939)
found no source blockers; the shared connected identity is not separate-account
approval. The HUD owner's postmerge receipt reports 235 checks, a runtime graph
of 154 modules / 266 edges without cycles, 100 served client modules, 39 Docker
UI assets and 513 Markdown files / 3,458 local links. Detailed command and
release receipts belong in [PR185](https://github.com/lbeezr/thousand-unit-skirmish/pull/185),
alongside [PR180's focused-layout evidence](https://github.com/lbeezr/thousand-unit-skirmish/pull/180).

The clean packed `68e46aa` release contains 1,149 files, digest
`sha256:c826450fadf01b1c95c0a0244d55b5d5bdca75c9cdd3a3c5aa6145cb3e879d91`.
Actual packed main/stance/layout GET/HEAD bytes, MIME and hashes, plus six glyph
serving/rejection checks, pass. This is local release evidence, not deployment
or native browser acceptance.

The latest read-only Railway staging observation at **22:55:42 UTC** reports
SUCCESS deployment `df65855c-57e3-4979-a345-1c7e83e90173`, source
`0fb9a3dcc1f93f44b87fe5ea8ab8caabf9da0739`. Git ancestry contains PR134/PR150
and excludes PR180/PR159/PR185. Earlier SUCCESS deployment
`29d74cac-b078-4a88-8f2a-e3141a2f9465`, source
`32f11d58018404835fd47489441f9cdfef7c403b`, was removed; retain it only as a
historical observation, not the native target. Neither observation proves the
current HUD changes are deployed.

Parent owns Mac/relevant-user-build acceptance and staging coordination; the
Railway delivery owner supplies an identified build containing `68e46aa` or a
descendant. Record deployed and source revisions separately before running the
ranked native recipes. The relevant user browser build is still unspecified.
Ordinary cloud public HTTP previously failed DNS `EAI_AGAIN`; cloud browser
preflight remains unsupported by available sandbox/storage. No manual deployment
or browser sandbox bypass is authorized by this checkpoint.

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
slice. No further independently reproduced HUD defect is recorded here; stop
source-only iteration at this checkpoint while identified delivery and native
acceptance remain pending. Resume a bounded fix when evidence justifies it.
Do not add speculative work to keep a worker busy.
