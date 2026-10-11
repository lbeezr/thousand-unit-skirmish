# HUD design explorations — 11 October 2026

Open [the interactive study](hud-studies.html) in a browser. Its arrows switch
between **Obsidian**, **Ivory** and **Citadel**; battlefield controls select
Worker, Barracks or Army. The Tweak controls expose shortages, population limits,
lighting and hotkey labels. Artwork is embedded; fonts and icon libraries use
external hosts, so full fidelity requires network access.

These are retained creative references for the [design-system proposal](../../ui-design-system.md).
Obsidian is the recommended working baseline. Citadel's more expressive portrait
framing remains a comparison; Ivory remains an alternative. No final visual
treatment, production theme or gameplay behavior has been approved by this record.

## State storyboard

| Trigger | Visible change being explored |
| --- | --- |
| Select Worker | Identity, health, task, cargo and economy actions replace the empty context. |
| Open Build | A local palette presents construction categories; the Worker stays selected. |
| Choose a building and click the field | Targeting resolves, example wood decreases and the Worker's task changes. |
| Select Barracks | Worker disclosure closes; this producer's queue, products, research and rally appear. |
| Train or cancel | The example queue and resource counter update. |
| Apply a shortage or capacity setting | Relevant products remain visible with a reason they cannot be used. |
| Select Army | Composition and military controls replace economy/production controls. |
| Clear selection | Entity commands disappear; resources and navigation remain. |

Mock values and interactions illustrate hierarchy, not a rules specification.
Research names, age requirements, bindings, stance coverage and Escape order must
be reconciled with the actual game before implementation. Queue progress and
clock values are illustrative. Existing game contracts retain authority.

## Sources and verification limits

[Provenance](provenance.json) records the original task paths, SHA-256 hashes,
repository art sources, reference links, generation prompt and prior mock checks.
The [original generated battlefield concept](battlefield-concept.png) is retained
beside its embedded compressed use. It is a concept backdrop, not a game capture
or a replacement world-art direction. Unit and building illustrations reuse
existing repository sources without changing their gameplay adoption status.

The original standalone study was inspected in the Codex in-app browser at
1280, 1024, 390 and 320px widths, including selection changes, construction,
queue changes and shortage feedback. That bounded historical record is preserved
in provenance; it is not a fresh verification of this copied artifact or ordinary
game acceptance. This directory is documentation backing, not a production route
or a new shipping asset pack.

## Component specimen — 11 October 2026

The follow-up [interactive component specimen](component-specimen.html) compares
**Compact · 52px** with **Expressive · 72px** on the Obsidian foundation. Both
variants share the same fixture state. Use the selection buttons, Match state
chooser and Step +6s to inspect construction, production, research, stances and
recovery. The [editable study source](../../../src/studies/hud-component-specimen/README.md)
records generation, real-data boundaries and art reuse.

[The data receipt](component-specimen.provenance.json) identifies source
`e0ced8ad21081cdbd221561b784f16575035e5da` and input hashes. Registered prices,
durations, products, prerequisites, stance choices and bindings replace the early
study's invented examples. Match state and order confirmations remain simulated.
This is a design deliverable; portrait choice and production implementation remain
pending user review. The author's current preference is the expressive portrait
because identity reads more clearly with little additional dock height.

Bounded inspection in the Codex in-app browser covered 1280, 1024 and 320px widths:

- Worker → Build → House used 75 wood (275 → 200), changed the task and closed
  the palette. Selecting Barracks replaced Worker controls.
- Spearman training spent 60 food/20 wood; cancelling the untouched queued item
  refunded those costs. Cancelling an Infantry with 6 of 12 seconds remaining
  refunded 25 food, rather than the full 50.
- Military Armor required Military Tier II. The satisfied fixture spent
  100 food/100 wood and started 25 seconds of research; Step +6s displayed 19.
- Low food, full population, queue 5/5 and connection loss showed specific
  reasons. The final shortage wording showed “Need 30 more food” for Infantry
  when the fixture held 20 food.
- Mixed selection exposed all four stance choices and excluded its three
  Workers from the military stance feedback. M entered attack-move targeting;
  Escape cancelled it. Closing construction returned focus to Build.
- Both variants rendered with loaded artwork. At 320px viewport, each had
  288px content and scroll width. Narrow controls reflowed without horizontal
  overflow. No browser console errors were observed.

Syntax, fragment-size and documentation-link checks accompany this record.
These are standalone mock observations, not cloud renderer qualification, real
match performance, gameplay correctness, release inclusion or deployed acceptance.

## Approved runtime pilot — 11 October 2026

The user selected **72px** and requested the Worker HUD pilot in the game. This
selects Obsidian's expressive identity treatment for the first runtime slice.
The 52px specimen remains a retained comparison. The study and its original
provenance are unchanged; the builder now lives at
[`scripts/build-hud-component-specimen.mjs`](../../../scripts/build-hud-component-specimen.mjs),
and the local fixture script is `src/studies/hud-component-specimen/runtime.mjs`.
See the [delivery checkpoint](../../hud-controls-backlog.md#worker-pilot--11-october-2026)
for default integration and evidence; source studies are not game acceptance.
