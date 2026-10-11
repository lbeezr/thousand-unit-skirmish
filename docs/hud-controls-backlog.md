# Compact HUD and controls backlog

Owner: HUD integration owner. This is the ranked work list for the ongoing HUD
lane, under [planning rules](contributor-planning.md). Keep small reviewed PRs
and exact evidence beside each item; a merged source milestone does not close
an in-game outcome. Dense, subtle, dismissible controls and retained labels
remain the direction. The user accepted the staged 72px Obsidian Worker pilot and authorized extending it across the HUD/UI.

## Design-system plan — 11 October 2026

Owner: HUD redesign task `01a12b67-645a-7a33-8fb2-8e8979756ac1` owns the
[design-system proposal](ui-design-system.md) and retained
[interactive explorations](art-direction/hud-design-system-2026-10-11/README.md).
The user reviewed the real-data interactive specimen, selected **72px**, and
authorized implementing the **Obsidian Worker HUD pilot** in the game on 11 October.
The preserved comparisons remain the visual backing; there is no runtime preview flag.

| Order | Reviewable outcome and acceptance | Dependencies and bounded write scope |
| --- | --- | --- |
| 1 — specimen reviewed | [Real-data component specimen](art-direction/hud-design-system-2026-10-11/component-specimen.html) compares 52px and 72px portrait framing, Worker/Build, Barracks/queue/shortage, army/mixed, empty and recovery contexts. [Bounded checks](art-direction/hud-design-system-2026-10-11/README.md#component-specimen--11-october-2026) pass. | User chose the expressive 72px portrait for the Worker pilot. Study source is isolated in `src/studies/hud-component-specimen/`; game rules and runtime consumers are unchanged. |
| 2 — Worker pilot accepted | Tokens and the new selection dock serve a real Worker: task, cargo, Build, Repair, Return and all other supported orders remain reachable. Selecting a different context clears Worker disclosures. | Agreed baseline; existing availability/focus contracts. New code in `src/client/hud/` with bounded existing DOM/style/binding edits; same owner retains package, delivery and game checks. |
| 3 — Buildings staged | Selected producer owns products, live queue, research, rally and lifecycle actions; shortages, cancellation and rejection remain truthful. | Worker dock primitives and real economy/lifecycle bindings. Extend production components and their existing consumers; do not copy rules or introduce multi-producer execution. |
| 4 — Army, mixed and Skiffs in progress | Composition, eligible actions, formations and all existing stance states remain readable; repeated snapshots, death and selection changes preserve focus and authority. | Existing selection/stance/command contracts. Extend the dock and its targeted regression checks. |
| 5 — Coverage and reuse | Remaining buildings, boats, wildlife and lifecycle states use the same vocabulary; then apply proven foundations to pause/settings and other menus. | Inventory actual supported contexts first. Small consuming-surface slices; no speculative framework or theme system. |

Each implementation slice must include focused checks, source/release/served
identity and an ordinary-game observation at its relevant build. The HUD owner
retains those steps; an artifact, source merge or handoff does not close them.
The older functional defects and acceptance gaps below remain open according to
their own evidence and can be resolved within the affected redesign slice.

## Building rollout — 11 October 2026

Owner: HUD redesign task `01a12b67-645a-7a33-8fb2-8e8979756ac1`.
The user reported that the Worker pilot “does feel way better” in staging and
requested similar improvements across the HUD/UI. Continue the existing sequence
without another mock approval gate.

- **Outcome:** the selected building owns its 72px identity, health, lifecycle,
  registered training choices, ordered live queue, local research, rally and
  cancellation/repair controls. Includes Barracks, other producers and utility
  structures; Dock has no rally, Mill has research, and Farm keeps retained
  selected Workers for replanting. Repair explicitly names all living Workers.
- **Backing:** the retained [Barracks queue/shortage/research storyboard](art-direction/hud-design-system-2026-10-11/README.md#component-specimen--11-october-2026)
  and approved Worker treatment. Reuse Barracks/Farm lifecycle portraits and
  existing glyphs; other structures retain a symbol rather than unrelated art.
- **Scope/dependencies:** shared skin in `src/client/hud/selection-hud.css`, new
  `building-hud.*`, bounded HTML/client bindings and existing production/research/
  lifecycle consumers. No protocol, economy or multi-producer execution changes.
  Independent review follows the current main-based implementation.
- **Acceptance:** both seats switch Worker → Barracks → utility → army; live
  affordability/queue/research updates retain focus; only the selected producer
  receives commands; research explains local versus elsewhere progress; no
  offline dispatch; disclosure Escape restores its opener. Check normal New Game
  with actual buildings, 1280×720/1920×1080/1024×768, both teams and UI scale.
- **Delivery:** default HTML admission and clean package, reviewed incremental
  merge and exact staged source/bytes. HUD owner retains ordinary-game review.
  The documented hosted capture/sign-in pause applies only to that route; it
  does not hold implementation, publication or staging verification.

**Review-ready checkpoint:** the building slice passes 190 focused CPU checks
(188 in the combined set plus two real-client producer-switch/reconnect cases),
runtime boundaries, both strict type boundaries, changed-file syntax and docs.
Independent review has no remaining actionable findings after the reconnect
hover-title correction. [Focused receipt](qa-evidence/building-hud-2026-10-11/focused-checks.json).
**Staged:** [PR644](https://github.com/lbeezr/thousand-unit-skirmish/pull/644)
merged at `9f76585c1d95fa65b30f270b007506296228ffa8`. The clean 1,841-file
package digest is `sha256:9c016880767b208b18553403f57402bcb33f375f88c7e7651ec87209e5693baa`.
Railway staging deployment `5ae7146d-a47e-46bc-ae0d-e6e76ffed345` succeeded;
authenticated health identifies that exact source, readiness passes, all 139
client modules resolve and 12 actual HUD/font/license response hashes match.
[Delivery receipt](qa-evidence/building-hud-2026-10-11/staging-receipt.json).
The provider does not report a release digest, so the clean local package digest
is not asserted as its image identity. Ordinary-game appearance remains open
under the documented hosted capture/sign-in pause; no alternate route was used.

## Army, mixed selection and Skiffs — 11 October 2026

Owner: HUD redesign task `01a12b67-645a-7a33-8fb2-8e8979756ac1`.
Base: staged buildings `9f76585c`; branch `codex/unit-hud`.

- **Outcome:** a 72px identity, live composition, combined health, typed cargo and
  queued/persistent-order summary accompanies the actual selected units. Land
  units expose Target battlefield, Attack move, Stop, Hold, Patrol and Follow;
  formation sets the next applicable order. Stances name their eligible military
  subset and reflect confirmed state. Return names carrying Workers or Skiffs.
- **Boundaries:** mixed land/water routes stay unavailable with a reason; Stop and
  Hold still address the whole selection. Pure Skiffs show supported orders and
  the existing 16-Skiff route limit. Missing Skiff portrait uses a text fallback.
  Commands, Production, Army and Idle navigation remain in the measured header,
  independent of selection. Worker Formation / route remains reachable.
- **Backing:** reuse the approved [army/mixed/empty/recovery storyboard](art-direction/hud-design-system-2026-10-11/README.md#component-specimen--11-october-2026),
  shared Obsidian skin and admitted portraits/glyphs. No new artwork, gameplay
  rules, optimistic stance state or command protocol.
- **Scope:** `src/client/hud/unit-hud.*`, existing stable action nodes, bounded
  main/HTML layout bindings and exact public admission. Escape cancels Attack
  move before deselection, including combined tap targeting; tooltip state tracks
  targeting and reconnect. Existing consumers retain actual order dispatch.
- **Acceptance:** both seats switch Worker → army → mixed → Skiff → building;
  confirm exact command recipients and generations, input isolation, focus,
  cancel/reconnect recovery, 1280×720/1920×1080/1024×768 and UI scale in normal
  New Game. HUD owner retains identified staged delivery and game review. CPU
  DOM checks cannot establish rendered layout or player comprehension.

**Review-ready checkpoint:** 196 focused CPU checks pass, covering real client
recipient IDs/generations in both seats, formation synchronization, offline
activation, targeting/cancellation, glyph retention and header placement.
Boundaries, both strict type checks, docs, syntax and whitespace pass.
Independent review has no remaining actionable findings after correcting Attack
move Escape cancellation and live Target tooltip restoration. [Focused receipt](qa-evidence/unit-hud-2026-10-11/focused-checks.json).
This is source/DOM evidence; publication, clean packaging and staged identity are
next, with ordinary-game appearance retained separately.

Remaining consuming surfaces are wildlife, match details/settings/help and
broader menu consistency. They retain their own bounded outcomes; the new main
menu portal is a separate active design and is not silently overwritten here.

## Worker pilot — 11 October 2026

Owner: HUD redesign task `01a12b67-645a-7a33-8fb2-8e8979756ac1`.
Branch: `codex/worker-hud-pilot`, based on `7524a0e1` plus the preserved studies.

- **Outcome:** selecting one or several owned Workers shows a 72px identity area,
  actual health/task/typed cargo and six primary commands: Build, Gather, Repair,
  Return, Move and Stop. More orders retains Patrol, Follow, Hold, formation/route
  and role details. Other selections keep their existing command surfaces.
- **Backing:** [72px specimen and state storyboard](art-direction/hud-design-system-2026-10-11/README.md#component-specimen--11-october-2026),
  chosen explicitly by the user. Existing authored portraits/glyphs are reused;
  Repair shares the study's Build glyph pending a dedicated icon. Self-hosted
  [DM Sans and Barlow Condensed](../assets/ui/fonts/README.md) retain their licenses.
- **Scope:** `src/client/hud/worker-hud.*`, bounded `index.html`/`src/main.js`
  bindings, exact public asset admission, HUD tests and the owned novice capture.
  The specimen builder moves to `scripts/build-hud-component-specimen.mjs` under
  source-role conventions; the preserved HTML/provenance are historical records.
- **Acceptance:** normal New Game → select Worker → inspect task/cargo → build
  palette → cancel/submit placement → Gather/Repair/Return/Move/Stop; selection
  changes, repeated snapshots, offline and match-finished states retain authority
  and usable focus. Check both seats, 1280×720, 1920×1080 and 1024×768 plus UI scale.
- **Delivery:** default binding, exact HTTP admission and clean release required.
  Source/release/local served identities are recorded below. Hosted delivery and
  ordinary-game observations remain incomplete; the HUD owner retains them.
- **Capture dependency:** the [existing hosted capture](renderer-qualification.md#ordinary-build-feature-adapter-and-dispatch)
  records dispatch/sign-in paused under the access decision. The established
  novice-flow adapter is the intended cloud proof; stopped Mac game testing is
  not a fallback. Continue CPU, package, source integration and authorized staging
  checks while retaining the specific capture gap.

**Checkpoint — 11 October 2026, 16:22 UTC:** implementation revision
`e0b8c5dab8fa33fd0a3178598705354ef1f8f34f` contains the default Worker binding
and independent review corrections: defined minimap spacing, complete target
cancellation on Escape/Build/More, and cursors matching Gather/Repair/Move.
The independent correction review has no remaining actionable code findings.
All 144 focused HUD/cursor/Farm/environment/default-building checks and 13 novice
capture contract checks pass. These include both seats and real client command
bindings; they do not establish rendered appearance.

The extra full CPU run was intentionally interrupted after 1,170 of 1,511
registered checks passed; 340 remained unrun and the active Worker work-receipt
scenario received SIGINT. [Partial run summary](qa-evidence/worker-hud-pilot-2026-10-11/broad-cpu-summary.json).
It is **not a full-suite pass**. The earlier attempt stopped at the baseline
macOS `/var` versus `/private/var` temporary-path assertion; the normalized-TMPDIR
rerun passed that check. Focused pilot qualification above is the relevant
completed acceptance, separate from both broad CPU and rendered-game evidence.

The clean 1,836-file release has digest
`sha256:2150aab7428d5e24e6d8518fc491849ea636c60390c0a41be66c4cb379914fd5`.
The local trial supervisor at `http://127.0.0.1:4173` reports that exact clean
revision/digest, and actual served HTML, main client, Worker module/CSS and cursor
bytes match the package. [Local identity receipt](qa-evidence/worker-hud-pilot-2026-10-11/local-trial.json).
This server is retained for the user's New Game → select Worker trial; no Mac
browser capture or ordinary-game visual pass is claimed.

**Publication route correction:** the CLI's origin push was rejected and its
repository permission response reported `pull:true, push:false`. The user then
identified the existing GitHub app connection; that connection confirms
`push:true` on `lbeezr/thousand-unit-skirmish`. The CLI result does not establish
a repository-wide restriction. The HUD owner is publishing the reviewed tree
through the app and retains merge/staging verification. Read-only Railway inspection found
the staging `main` auto-deploy trigger enabled and no production trigger; no
provider settings or deployments were changed. Staging deployment
`c18608c2-6e55-4e69-afb8-8c7b89ccfb5c` predates this pilot.

**Staged delivery and user trial — 11 October 2026:**
[PR641](https://github.com/lbeezr/thousand-unit-skirmish/pull/641) merged as
`819044363ad0d4270fbb99e95777c40770d7c5c1`. Railway deployment
`efe20fc4-f2eb-4701-94b8-d3b863a58ad1` succeeded; authenticated health, readiness,
137 client imports and nine actual HUD/font/license file hashes were verified.
[Staging receipt](qa-evidence/worker-hud-pilot-2026-10-11/staging-receipt.json).
The merged clean package has the same content digest recorded above; staging
reports Git source identity without a release digest. The user subsequently
reported that the pilot “does feel way better” while using staging and approved
wider rollout. This is firsthand usability acceptance, not a claim that all
commands, seats, scales or the paused automated capture matrix were inspected.
The browser revision at that exact user observation was not separately read back.
The HUD owner retains those broader regression/appearance checks during rollout.

## Existing ranked functional work

| Rank | Outcome and current evidence | Next action and write boundary | Dependencies and acceptance |
| --- | --- | --- | --- |
| 0 | Native QA reported stale Worker construction at deployed `64cc391e6d9c4164dca7bd45696cf3862fe19729`. Both-seat source/DOM regressions reproduce disabled Build after Worker selection and a recreated training button after producer reselection. | Refresh economy availability with user selection; retain the selected producer while clearing its control group. Snapshot/waypoint-only renders avoid another economy pass. HUD owner retains the native follow-up below. | Source tests establish these two defects. The separately reported completed-Range unavailability remains unexplained; completion, shortages, queues, population and authoritative denial/recovery pass modeled checks. |
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

The latest read-only Railway staging result reports SUCCESS deployment
`df65855c-57e3-4979-a345-1c7e83e90173`, updated at **22:55:42 UTC**, source
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

- Wildlife owner retains the agreed narrow string-ID Sheep selection and
  Herd/Stop binding in the existing contextual strip. The HUD lane retains
  layout; new Sheep action/collar frames remain with the art owner. No army
  group, stance or generation includes a Sheep ID. Source/native acceptance is
  recorded in [Sheep controls evidence](qa-sheep-owned-controls-2026-10-04.md).
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

## Selection availability follow-up — 4 October 2026

The HUD source check after PR234 also reproduced Patrol/Follow enabled in the
open Orders drawer with no living owned units selected. Command refresh was
overwriting the stationary-control selection gate, while the target-mode handler
silently returned. The command refresh now retains that gate. Both-seat tests
cover empty, dead, enemy-only, Worker, military, mixed, building and Skiff
selection, plus repeated economy/command refresh. This is a separate functional
empty-selection fix; it does not resolve the native completed-Range report below.

The parent-owned native QA run identified deployed source
`64cc391e6d9c4164dca7bd45696cf3862fe19729`, superseding the 3 October staging
observation above. It reported an idle Worker whose construction stayed disabled
until a later Move, and a completed Archery Range whose contextual production
was unavailable. HUD owner reproduced the Worker selection refresh gap in both
seats at that revision and current main `966dc0a`; Move itself does not refresh
the controls, while the next economy snapshot can. Integrated selection/economy
tests also exposed producer reselection recreating the training control and
losing focus. These are bounded source fixes, with native acceptance still open.

On an identified user build containing the fix, use normal Millrace gameplay
with enough wood: clear selection, select an idle Worker using pick, rectangle,
Idle and group recall, then inspect `#build-barracks`, `#build-archery-range`,
`#build-house` and a catalog construction option immediately, before a Move or
new snapshot. They should enable for living owned Workers and disable on empty
or military selection; shortages and pending construction should still disable
them. Repeat selection and replenish resources. Select a paid, completed Range,
focus the visible `[data-context-products] [data-product="archer"]`, reselect the
same Range and verify the same control remains focused and targets its ID.
Verify incomplete-to-complete recovery, resource recovery and one accepted paid
Archer queue through normal gameplay. These modeled tests do not prove native
layout, renderer picking or server acceptance.

If Range production remains unavailable, record the visible button text,
`aria-disabled`, `disabled`, `data-producer`, selected building ID, and the matching
snapshot's `complete`, `productionBlocked`, `productionQueue`, `productionOptions`,
food/wood and population. The hidden legacy `[data-context-proxy="train-archer"]`
is not the visible production choice. Mac-local receipts remain with parent QA;
HUD owner retains diagnosis and any resulting fix rather than closing that
report from passing source models. No browser sandbox bypass or manual
deployment is authorized.

Review current main and new native/command evidence before choosing another
slice. Do not add speculative work to keep a worker busy.
