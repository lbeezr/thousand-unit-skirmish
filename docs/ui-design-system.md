# RTS interface design system

**Status — 11 October 2026:** the user selected the **72px portrait** and
accepted the **Obsidian Worker HUD pilot** in staging and authorized wider
HUD/UI rollout. The selected-building dock is the next implementation slice;
army/mixed and remaining surfaces follow in incremental changes. Owner: HUD redesign task
`01a12b67-645a-7a33-8fb2-8e8979756ac1`.

The user's central complaint is that unrelated global controls obscure the
selected unit or building. The system should make three things obvious:
**what I selected, what it is doing, and what I can do with it.** A contemporary
RTS interface earns its finish through clear hierarchy, responsive controls and
authored art. It must remain useful during a crowded battle.

This guide owns the proposed visual and interaction rules. The
[HUD backlog](hud-controls-backlog.md#design-system-plan--11-october-2026) owns
sequencing; the [game bible](game-bible.md#quality-floor) owns product intent.
The plan covers the HUD first, then extends its vocabulary to menus and settings.
It does not change gameplay, the world art direction or faction definitions.

## Direction and visual backing

Open the [interactive studies](art-direction/hud-design-system-2026-10-11/hud-studies.html)
and use the arrows to compare Obsidian, Ivory and Citadel. Select Worker,
Barracks and Army in each. The [preservation record](art-direction/hud-design-system-2026-10-11/README.md)
includes provenance, limitations and the state storyboard.

| Study | Keep or investigate | Tradeoff |
| --- | --- | --- |
| **Obsidian — recommended foundation** | Dark mineral surfaces, condensed names, compact labeled commands, quiet borders. | Needs expressive portraits and distinctive icons to avoid becoming generic utility UI. |
| **Citadel — portrait alternative** | Stronger character framing and a restrained material edge on identity panels. | Large frames, brass everywhere and circular navigation consume battlefield space. Do not adopt the entire treatment by default. |
| **Ivory — retained alternative** | Clear reading hierarchy and generous separation of identity from actions. | Large light surfaces pull attention away from a bright battlefield. Revisit only if the dark baseline fails readability. |

The proposed signature is **a dark command instrument with illustrated identity**:
square-cut geometry, fine mineral edges, warm portraits and a sparse mint action
accent. Decorative detail belongs near identity, not behind every number.
Use solid or near-opaque surfaces; background blur must not carry readability.
Avoid pill-shaped controls, ornamental gradients and a separate card for every
statistic. The generated landscape in the study is an illustrative backdrop,
not a replacement for Vaelora's world art or a screenshot of the current game.

## Foundations to establish in the next specimen

These are starting tokens to test at actual game scale, not frozen production
values. Components use semantic names instead of their own color constants.

| Foundation | Proposed rule |
| --- | --- |
| Surfaces | `surface.base` #101A22; `surface.raised` #17252E; `surface.hover` #23333D. One fine border, one restrained shadow for floating disclosures. |
| Text | `text.primary` #F2F4EE; `text.secondary` #B2C1C5. Dim decorative separators before dimming useful information. |
| Interaction | `accent.action` #A4E7C5 for selection and active controls. Keyboard focus also gets a clear 2px outline and offset, independent of fill. |
| Meaning | Warning #EDC77C; danger #EC8D83. Health, ownership, selection and errors get separate semantic tokens even when some hues are related. Use text/shape as well as color. |
| Teams | Retain Azure #5AA7D7 and Ember #E67A5E with their established square/diamond and pennant cues. Team color does not recolor every panel or replace the action accent. |
| Typography | DM Sans for labels and numbers; Barlow Condensed for entity names and major headings. Start with 14px body/action labels, 12px secondary metadata, 22–26px entity names. Tabular numerals; sentence case for actions. |
| Spacing and shape | 4px base rhythm; 8/12/16/24px spacing steps. Mostly 2px corners, 1px borders. Align related information rather than boxing each item. |
| Controls and art | Start with 44px minimum primary command targets and 20–24px icons. Use the approved 72px portrait in the Worker pilot; retain the 52px study as comparison backing. |
| Contrast | Project targets: 4.5:1 for ordinary text and 3:1 for meaningful control boundaries, checked against the actual rendered surface. Never convey availability through opacity alone. |

The Worker pilot self-hosts the approved font pair with reliable fallbacks;
[font provenance and licenses](../assets/ui/fonts/README.md) record the exact sources. Do not add Citadel's or Ivory's extra typefaces
merely because their portraits are reused. Verify long names and localized text
expansion before fixing widths.

## Information architecture

Three layers have distinct jobs:

1. **Match layer:** resources, population, objective, timer, minimap, connection
   and urgent notices. These remain available as selection changes.
2. **Selection dock:** identity and health; current task/order or production;
   relevant actions. The selected entity owns this area completely.
3. **Temporary detail:** construction palette, full statistics, advanced orders,
   research details and settings. Open on demand, retain selection, close cleanly.

Keep the minimap in a stable lower corner and the selection dock along the lower
edge. Keep the center of the battlefield clear. A global Production shortcut may
help locate a producer, but it must not inject unrelated producers' actions into
the selected Barracks panel. Exact shortcut behavior follows the existing contract.

| Selection | Immediate information | Action area |
| --- | --- | --- |
| None | Compact selection hint; independent match information remains. | No entity actions. Preserve existing Commands, Production, Army and Idle-worker navigation. |
| Worker | Portrait, role, HP, task, carried resources. | Gather, Build, Repair, Return cargo and applicable orders. Secondary combat and movement capabilities remain reachable. |
| Barracks | Building identity, HP/lifecycle, current production and queue. | Its available products, its research, rally and applicable repair/cancel actions. No Worker construction palette or unrelated training. |
| Military unit/group | Identity or composition, count, relevant health and current orders. | Supported military orders, formation and existing stance choices, including Mixed. |
| Mixed friendly units | Composition with eligible counts; no invented single shared task. | Common orders plus explicitly scoped actions such as “Return cargo · 3 eligible.” Unsupported combinations remain unavailable. |
| Other owned buildings, Skiffs and Sheep | Their actual identity and state. | Capability-specific existing controls. Do not force boats or owned wildlife into an army template. |
| Enemy, dead, stale or spectator context | Only information permitted by existing visibility and selection rules. | No owned commands or hidden-state inspection. Clear invalid targets immediately. |

Use real capability and ownership data. The mock's example costs, research names,
age gates, two stances and hotkeys are illustrative. The runtime has an established
Attack move **M** binding and additional stance choices; a visual redesign must
not silently change these. Multi-building production and new subgroup mechanics
are separate gameplay/input proposals, not implied by this design system.

## Components and state contract

Worker and building contexts share the 72px Obsidian skin in
`src/client/hud/selection-hud.css`; each retains its own state and controls. Avoid creating a general UI framework before these uses exist.

| Component | Required variants and behavior |
| --- | --- |
| Resource/population readout | Value, change or pressure where supported, shortage, capacity warning; stable numeric alignment. |
| Selection identity | Single unit, building lifecycle, group composition, missing artwork; text survives a failed image. |
| Status row | Current task/order, cargo, progress; updates without moving focus or rebuilding the whole dock. |
| Command tile | Icon, visible label, binding and optional cost; stable shared-order positions within each context. |
| Construction palette | Existing categories, costs, requirements and placement handoff; closes when selection becomes incompatible. |
| Production area | Current item, progress, ordered queue, training choices, research, rally, cancellation and truthful cost/refund feedback. |
| Detail/tooltip | Name, purpose, binding, exact cost and specific blocked reason; available on focus as well as hover. |
| Notice and recovery | Action rejection near its origin; persistent connection state; urgent alerts independently visible. |
| Menu primitives | Buttons, tabs, toggles, sliders, dialogs and focus rules derived from the HUD vocabulary when menus are addressed. |

An action can be ready, hovered, focused, pressed, targeting, awaiting acceptance,
active/queued, temporarily unavailable or locked by a real requirement.
Irrelevant actions are absent. Relevant actions blocked by resources, capacity or
requirements stay in place with a reason. Inspectable blocked controls remain
keyboard reachable and cannot dispatch a command; use the existing availability
helper rather than relying on CSS or `aria-disabled` alone.

Immediate feedback may acknowledge input, but it must not claim that the server
accepted an order. Costs, queue progress, refunds and completed research follow
authoritative data. A denial replaces pending feedback with its specific reason.
Selection changes and live snapshots retain stable DOM nodes where possible.

Escape handles the topmost active interaction: cancel targeting first, otherwise
close the local disclosure and restore focus, otherwise follow the established
selection/menu behavior. The early studies differ in their illustrative Escape
order; they are not authority for changing the runtime input contract. Clicking
or scrolling HUD controls must never issue a battlefield order underneath them.

## Art, motion and layout

Reuse the existing [purpose-drawn action icons](../assets/ui/PROVENANCE.md),
[action glyphs](../assets/ui/icons/actions/README.md) and
[portrait mappings](hud-art-integration.md) as the first inventory. Evaluate them
together at 20–24px before requesting replacement art. The studies' Lucide symbols
are interaction placeholders, not the proposed shipping icon family. Commission
missing glyphs with consistent silhouette, optical weight and negative space.
Portrait framing follows the effective appearance, independent of team or ancestry
assumptions; building portraits must match their admitted gameplay appearance.

Motion should explain cause and state: 100–140ms control responses, 160–200ms
disclosure transitions, a brief accepted-order cue. Do not animate every resource
tick or loop decorative highlights. Reduced-motion mode removes movement while
retaining state changes. Reuse the [UI audio direction](ui-audio-direction.md)
for sound/caption meaning; do not add a sound to every hover.

Start layout review at **1280 × 720**, then 1920 × 1080 and 1024 × 768, recording
DPR and UI scale. Aim for roughly 20–25% or less persistent HUD coverage at the
normal desktop baseline. This is a design budget to measure, not a reason to
shrink essential text. At 125% and 150% UI scale, collapse secondary details before
compressing labels; keep primary actions, notices and navigation accessible.
The study's 320px layout check does not establish a supported mobile game.

Test bright and dark terrain, both team identities, long labels and missing art.
Measure actual HUD bounds for camera centering and input exclusion. Temporary
panels may occupy more space while open but must have an obvious close path.

## Review package and implementation sequence

The [Obsidian component and state specimen](art-direction/hud-design-system-2026-10-11/component-specimen.html)
is now available with compact 52px and expressive 72px portrait variants sharing
one simulated match state. It uses registered products, requirements, costs,
bindings and all four stances; shows Worker → Build → placement, Barracks → queue
→ shortage, Army → mixed selection, and empty/recovery states. The
[review checkpoint](art-direction/hud-design-system-2026-10-11/README.md#component-specimen--11-october-2026)
records its source and bounded checks. The earlier visual alternatives remain
preserved. The user selected 72px, accepted the Worker pilot in staging, and authorized wider rollout. Its default
runtime binding and clean local trial are recorded in the
[delivery checkpoint](hud-controls-backlog.md#worker-pilot--11-october-2026);
the pilot is merged, staged and accepted by the user. The exact user-observed
browser revision and full viewport/action capture matrix remain unmeasured.

Proceed through small vertical slices: **Worker → Barracks →
army/mixed selection → remaining roster and lifecycle coverage → menus/settings**.
The [HUD backlog](hud-controls-backlog.md#design-system-plan--11-october-2026)
defines each slice's acceptance and ownership. Each usable slice includes its
real interaction wiring and delivery; do not leave the entire redesign on an
indefinite preview switch. Existing functional defects remain in that backlog.

New runtime UI implementations belong in `src/client/hud/`. Current consumers
include `index.html`, `style.css`, `src/main.js`, `src/hud-layout.mjs`,
`src/selection-context.mjs` and `src/selection-portrait.mjs`. Extract only what a
slice needs, preserving callers. Read definitions from `src/gameplay-definitions.mjs`
and existing economy/command bindings; do not duplicate a UI rules registry.
Update the HUD bounds and battlefield input exclusion selectors with any moved
controls. Preserve existing density/minimap preferences. No framework migration
or broad file reorganization is required.

## Acceptance and ownership

The HUD redesign owner retains the outcome through source integration, packaging,
the relevant deployed build and ordinary-game verification. Art reuse, icon
production and delivery dependencies should be named in each slice; a handoff or
successful screenshot is not completion of an in-game outcome.

For implementation, inspect `node scripts/ci.mjs --list` and run the registered
checks affected by the change: HUD layout, contextual selection/empty selection,
availability, focus recovery, action icons, selection centering and the changed
economy/lifecycle/stance contract. Apply the repository's required checks. Before
game rendering, use the cloud renderer capability preflight in the
[testing strategy](testing-strategy.md); keep capability separate from game proof.

The final slice evidence must show these observations on an identified game build:

- Worker → Barracks → army replaces context immediately, with no stale actions.
- Shortages, full queues, capacity limits and rejected orders explain the cause;
  no duplicate order, fabricated refund or premature success appears.
- Build targeting, cancellation, death, enemy selection, reconnect and repeated
  snapshots preserve valid selection, focus and authority boundaries.
- Both teams can read the dock at the target sizes; HUD interaction does not move
  the camera or issue a field order; the camera respects current HUD bounds.
- A fresh player can select a Worker and start construction, then select a
  Barracks and train an available unit without searching unrelated global panels.

Record source SHA, clean release digest and served/deployed identity separately,
with map, viewport, scale and concrete observations. Link evidence in the existing
HUD acceptance guides. The retained study checks establish only mock interaction
and layout behavior; this planning change makes no runtime or deployment claim.
