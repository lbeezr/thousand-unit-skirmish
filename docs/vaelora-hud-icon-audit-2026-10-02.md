# Vaelora HUD, icon and cursor study — 2 October 2026

**Status:** source audit and three visual proposals at fork main
`68f859f903ad09119594dcafca83f6de8362a9ed`. No runtime UI changes or new
Meshy jobs. [Study gallery and evidence](art-direction/vaelora-hud-study-v1/README.md).

The current kit already covers most immediate orders. The first useful change
is clearer state feedback, especially a known-empty resource before clicking,
and more distinctive small badges. A complete icon replacement is unnecessary
for this experiment. The three skins are choices for review, not selected art.

## Verified inventory and bindings

The [current asset README](../assets/ui/README.md),
[40 px manifest](../assets/ui/cursors/manifest.json) and
[cursor contract](ui-cursor-icon-contract.md) describe 16 bound PNG cursors,
46,807 bytes total. Ordinary hotspots are `(4,4)`; both hammer/build cursors use
`(6,6)`. CSS paths, sizes and hotspots match this manifest. Pan-ready and panning
use native `grab`/`grabbing`, outside the PNG inventory. Blocked/unavailable
fall back to `not-allowed`; the other PNGs fall back to `default`.

The older 32 px SVG cursor studies, Swift exporter and
[historical provenance](../assets/ui/PROVENANCE.md) remain saved. That provenance
is an earlier revision, not the current 40 px manifest. The
[pointer/hammer source record](../art/cursor-sources/README.md) describes already
completed Meshy work; this study neither repeats nor spends on it.

Six source SVG icons have 24 × 24 view boxes: food, wood, move, attack, gather
and build. Runtime resource icons use 13 px, command icons 19 px. Food/wood and
move/attack/build are currently bound; gather is available but is not currently
bound as a command button. The proposed Gather action deliberately reuses it.
The [hash and alpha-bound inventory](art-direction/vaelora-hud-study-v1/current-cursor-inventory.json)
records all 16 cursor files without copying those existing assets.

| Immediate state | Current cursor / feedback | Evidence boundary |
| --- | --- | --- |
| Empty selection; Shift add/remove | `select`, `select-add`, `select-remove` | Resolver and manifest; select captured live |
| Box selection | `box-select`, `box-crossing` | Resolver and existing tests; static PNG pixels reviewed |
| Move, Shift queue | `move`, `move-queued`; written queued-waypoint count | Queued cursor captured live; illustrative two-waypoint value in sketches |
| Enemy unit; supported enemy building | `attack`; unsupported building gives `unavailable` | Resolver; static badge review |
| Attack move, Shift queue | `attack-move`, `attack-move-queued` | Attack-move cursor captured live; queued binding inspected in source |
| Food, wood, harvestable forest | `gather`, `gather-wood`; non-Workers give `unavailable` | Resolver; native-size PNG board, not a live harvest capture |
| Supported selected building | `rally`; otherwise `unavailable` | Resolver and manifest |
| Construction preview | `build-valid`, `build-blocked`, written placement reason | Both captured live; House preview selected through actual controls |
| Repair | Damaged completed owned building action; written repair state and wood cost | Source; no separate repair cursor mode |
| Patrol/follow | Persistent order labels and Worker task states | Source; resolver receives no distinct patrol/follow mode |
| Stop/hold | Buttons, key labels and Worker task state | Source; no dedicated source SVG in this six-icon kit |
| Production/research/build queues | Queue text, disabled reasons, stock/population gates | Source; sketch's disabled Train archer is illustrative |
| Known depleted node | Muted ring and depleted model; positive-stock callout hidden | Source gap below; no live depletion capture in this study |

`src/battlefield-cursor.mjs` gives panning, selection drag, construction and
building-rally states precedence before unit orders. Enemy targeting wins over
resource targeting; only supported movement cursor modes receive a queue badge.
`src/main.js` retains ten Worker task values: idle, moving, gathering, returning,
building, repairing, attacking, holding, patrolling and following. Task state,
hover intention and an accepted authoritative order are separate signals.

## A concrete feedback gap

`updateResourceNodeVisual` stores current stock and dims an empty ring;
`updateResourceNodeCallouts` hides the positive-stock callout at zero.
`pickResourceNodeAt`, however, checks distance and optional fog visibility
without checking known remaining stock. The hover resolver receives that node's
resource type. A Worker can therefore still see a gather cursor at a node known
to be empty; `server.mjs` rejects the request with `RESOURCE NODE EMPTY` and the
client recognizes the notice afterward. This is verified from source, not a
new live reproduction or a claimed fix.

A bounded implementation should pair an empty/slash symbol with `EMPTY` before
the click, using only stock the client legitimately knows through the existing
fog rules. Preserve the authoritative rejection. Add separate readable cues for
repair and persistent orders through the same resolver contract; do not imply
new order semantics merely by adding icons. Reuse the current arrow, hammer,
food/wood glyphs and written disabled reasons wherever they still read clearly.

## Actual gameplay evidence and text contrast

The [completed live receipt](art-direction/vaelora-hud-study-v1/captures/attempt-2/live-capture.json)
records actual Bellweather gameplay at 1280 × 800, DPR 1: idle, queued move,
attack move, clear building preview and blocked building preview. The blocked
capture says `MOVE UNITS OUT OF THIS SITE`. The script selected four Workers and
House through the game's existing controls. No order acceptance or economic
outcome is inferred from these hover captures. No JavaScript exceptions were
reported. The first screenshot route timed out; its six completed images are
preserved separately with the failed-attempt record.

Three additional direct gameplay backgrounds at 1024 × 640 retain Bellweather
meadow, Pale Meridian snow and Underbough woodland. DOM HUD was hidden only for
these background captures; fog, terrain, buildings and units are actual game
pixels. These are direct owned Chromium/CDP captures, not sealed `game-dev`
captures. The unavailable `game-dev` executable and the initial capture failure
are recorded in the pack. Requested software-rendering flags are recorded, not
treated as a hardware performance measurement.

Normal gameplay text and important visual cues use a 4.5:1 target; inactive text
uses 3:1. A future high-contrast option should target 7:1. Use solid adjustable
backdrops and measure the lowest contrast on varying backgrounds. These targets
follow [Xbox Accessibility Guideline 102](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102).
The [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/provide-high-contrast-between-text-ui-and-background/)
also recommend solid backgrounds or suitable outlines/shadows.

The [runtime measurement](art-direction/vaelora-hud-study-v1/contrast-runtime.json)
samples a 2 px interior grid in each text/control rectangle from a corresponding
text-hidden capture. Foreground is computed CSS color blended by ancestor
opacity. The mixed-style field-hint parent is excluded. All 75 sampled regions
met their respective targets; this is not whole-game accessibility acceptance.

| Sampled current text family | Lowest sampled ratio |
| --- | ---: |
| Resource label | 4.725:1 |
| Contextual button | 4.961:1 |
| Placement status | 8.128:1 |
| Wood stock | 9.203:1 |
| Food stock | 10.030:1 |
| Map summary | 11.108:1 |

The current resource label has the smallest measured margin, so additional
background/state checks are useful. Rectangle samples may include borders or
decoration; this method does not measure individual glyph strokes. Current
later CSS overrides enlarge many early 7/8 px styles to 12/14 px text and 44 px
controls. Smaller-height media rules and other menus still need their own
measurements. Existing HUD spacing/minimap preferences do not supply a general
contrast or color-vision mode in this inspected build.

## Native-size visual observations

The [asset board](art-direction/vaelora-hud-study-v1/previews/asset-normal-size-check.png)
shows every current cursor at 40 px against captured light snow, textured
woodland and dark fog. The arrow/hammer body and gold outlines remain visible
on these sampled backgrounds. The body is subdued on fog, and the smallest
badges demand closer reading. Attack versus attack-move, and select versus
move, are visually close at this size; their PNG bytes are different. Plus,
minus, crossed-selection, food, wood and blocked badges provide useful shape
differences, though queue plus marks are small. Food/wood labels remain valuable
at the current 13 px icon size; the thin move glyph should keep its live label.

Cursor alpha reaches the outer image boundary on several files. Future dual
light/dark outlines need padding or a deliberate re-registration; expanding a
halo blindly inside the existing frame can clip it. Preserve each hotspot and
verify the real click point against selection/build previews before changing
native cursor registration. CDP screenshots omit native OS cursors: this board
uses DOM images and does not prove browser/OS cursor-size support or click
alignment. It does not claim numerical non-text contrast compliance.

## Three proposed identities

| Direction | Identity and reuse | Main tradeoff |
| --- | --- | --- |
| Field journal | Parchment panels, dark botanical ink, folio rules; current pale SVGs on dark icon plates | Light panels occupy more visual weight. Keep grain out of text and avoid distressed letters. |
| Oak and iron | Warm timber rhythm, brass fasteners, dark tool plates; closest to the existing pointer/hammer materials | Thick frames can obscure terrain; material detail must remain secondary to labels and silhouettes. |
| Quiet wayfinder | Matte map green, pale ink, restrained route arcs; identity from geometry rather than animated glow | Ornament must remain distinct from target/objective markers; avoid translucent reading surfaces. |

All three use live HTML text, existing SVG/PNG files, explicit costs/shortcuts,
and shape-plus-word state cues. Proposed ready, selected, queued, working,
blocked, empty, returning and repair chips are exploratory symbols, not newly
bound runtime modes. The mini-map diagram, objective prose and resource/order
values are illustrative; the underlying terrain capture is real. The proposed
Gather button reuses the unused source SVG. No UI Meshy generation is needed
for these directions; a later optional ornament would require its own bounded
decision.

Across meadow, snow and woodland × blocked/queued, the
[proposal measurements](art-direction/vaelora-hud-study-v1/contrast-proposals.json)
cover 138 text regions per direction, all above their targets. Minima are
5.014:1 for journal, 6.425:1 for wood and 7.321:1 for map. These are prototype
samples, not proof of an integrated high-contrast mode. First renders with
unsupported Objectives/Hold glyphs are retained; the revised sketches use
portable text and a semantic disabled button.

The grayscale queued/woodland previews retain labels, plus marks, crossed
blocked symbols and state words. Grayscale is only a color-removal proxy,
not a calibrated protan/deutan/tritan simulation or human usability test.
The 960 × 800 check exposes these sketches' fixed 1280 px board: responsive
layout is unfinished. Native-size testing, larger text/DPR 2, compact windows,
full color-vision checks, localization, real queues/depletion/repair/patrol and
fog-safe order feedback remain acceptance work before runtime adoption.

[Study gallery](art-direction/vaelora-hud-study-v1/README.md) ·
[Art evolution](lore/art-evolution.md) · [Documentation index](README.md)
