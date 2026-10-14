# Vaelora brand and interface bible

[Game bible](game-bible.md#world-and-presentation) · [Entry contract](game-entry.md) · [Visual studies](art-direction/vaelora-brand-v1/README.md)

Version 0.4 · 14 October 2026. Creative owner: **Unify game art direction and lore**
(`01a13a8a-37a9-7812-800a-12e48c842b52`). The 11 October portal delivery remains
recorded under its original owner (`01a12b79`).
Use this reference for the front page, player portal, dialogs and future client
surfaces. [Open the visual component reference](art-direction/vaelora-brand-v1/interface-reference.html)
to compare colors, materials, button families and states.

The [creative direction](creative-direction.md) and
[curated atlas](art-direction/creative-atlas-v1/README.md) now connect this client
foundation to lobby planning, mode disclosure, character voice and the approved
Obsidian battlefield treatment. The bridge reduces ornament as attention rises;
it does not replace either selected visual system. Bellweather is the portal's
world concept, while the actual selected battlefield is named before launch.
The [pregame-lobby increment](qa-vaelora-lobby-2026-10-14.md) applies this palette,
brass action, control boundaries and feedback treatment through scoped lobby
tokens. Its runtime/source evidence and pending ordinary-room appearance checks
remain separate from the atlas's earlier source-only milestone.

**Selected foundation:** world-first composition, pine, parchment, textured brass
and layered oak foliage. **Proposed extensions:** the semantic colors, component
families and state rules below. These are reviewable specifications; they have
not all been applied to the game. The current portal implementation and its
[QA record](qa-vaelora-brand-portal-2026-10-11.md) remain the record of delivered behavior.
User direction: **world-first, evocative art with a clear Play entry**, inspired
by how World of Warcraft and League of Legends make functional clients feel
part of their worlds. The name is established; this selects a first portal
treatment, not final approval of a bespoke logo or every future surface.

## Brand position

**Vaelora — A living world. Yours to command.**

A painterly fantasy RTS about raising settlements and commanding armies in a
world already full of ordinary lives, inherited craft and immense lost power.
The emotional promise is belonging, curiosity and consequential command.
The practical promise is a clear route into solo play or a match with a friend.
Lead with places worth inhabiting, then the decisions made within them.

Vaelora becomes the player-facing name on this entry and the small in-game
lockup. Thousand Unit Skirmish remains the repository/package name and the
historical title in dated records. The world name does not imply an MMO,
campaign, public matchmaking or newly playable cultures.

## Visual system

| Element | Direction and role |
| --- | --- |
| Wordmark | Widely spaced uppercase serif **VAELORA**. Live text stays sharp and accessible. A restrained V monogram is a working navigation mark; custom lettering remains a future art outcome. |
| Pine `#102c27` / deep pine `#0b201c` | Persistent client frame, launcher and dialogs. |
| Parchment `#f3eddf` | Reading surfaces and primary text against pine. |
| Brass `#d0b376` | The main action, fine borders and navigation emphasis. |
| Copper `#985d3b` | Small editorial accents on parchment. Not an error or team cue. |
| Sage `#bcc9bd` | Supporting text on dark surfaces. |
| Type | Georgia/Times serif for the name and editorial headings; system sans for controls and body copy. Intentional installed-font stacks avoid a remote font dependency. |
| Shape | Rectangular panels, thin inset rules, a small diamond separator. Keep ornament outside readable labels and target areas. |
| Imagery | Preserved Bellweather concept establishes inhabited warmth. Keep region attribution and **world concept art** labeling visible. It is not a game screenshot. |
| Motion | 140ms color/border feedback only. No ambient animation, automatic carousel or autoplay audio. Reduced motion removes transitions. |

The [immersive study](art-direction/vaelora-brand-v1/immersive-client-study.png)
is the selected implementation reference. The earlier
[light atlas study](art-direction/vaelora-brand-v1/world-first-study.png) is
retained as a comparison: its reading treatment survives below the hero, while
the dark frame better answers the user's client reference. The user then selected
the textured brass action, border and foliage, requesting separate layers.
The [material iteration](art-direction/vaelora-brand-v1/README.md#material-iteration--11-october-2026)
now supplies isolated brass and transparent oak assets. The crest and map marks
remain exploratory.

Material hierarchy: the landscape establishes the world; a shadowed pine panel
anchors the controls; fine brass rules define the frame; oak branches overlap
its corners; a textured gold button makes New Game the strongest action.
Each layer is independently adjustable. Keep leaf silhouettes outside labels,
retain rectangular hit targets and live text, and reduce ornament at narrow
widths. Hover warms the brass, press deepens its inset shadow, pending removes
the bright finish, and keyboard focus adds a visible external ring.

## Color roles

The character of Vaelora comes from pine, warm craft materials, botanical edges
and inhabited landscapes. Familiar brass remains useful: give it a specific job
and a recognizable finish. Gold is not a synonym for every clickable thing.
Red is available for strong emphasis, but the proposed functional system reserves
it for destruction and failures. Decorative regional reds can still appear in art.

Keep three independent color systems: **brand identity**, **interface meaning**
and **gameplay identity**. A region or civilization can change its imagery and
ornament without changing what an error, selected control or player team means.
Azure and Ember keep their existing sky-blue and rust/terracotta gameplay cues.

| Role and token | Value | Use and companion cue |
| --- | --- | --- |
| Deep backing `--v-ink` | `#0B201C` | Stable backdrop; dark text on brass. |
| Surface `--v-pine` | `#102C27` | Default client panels and secondary buttons. |
| Raised surface `--v-raised` | `#1B3730` | Dialogs and contextual layers. |
| Primary text `--v-paper` | `#F3EDDF` | Text on dark panels; reading-page background. |
| Secondary text `--v-sage` | `#BCC9BD` | Supporting descriptions, never opacity-faded essential text. |
| Primary action `--v-brass` | `#D0B376` | Dominant next step, with dark label and inset rule. |
| Selection `--v-selected` | `#A8D0BD` | Celadon border plus check mark or explicit selected label. |
| Keyboard focus `--v-focus` | `#CEEDD9` | 3px external ring with 4px dark gap; survives other states. |
| Control boundary `--v-line` | `#809387` | Edges needed to identify controls on pine. |
| Decorative rule `--v-decoration` | `#52634D` | Quiet dividers and nonessential ornament only. |
| Editorial copper `--v-copper` | `#985D3B` | Small headings on parchment, not small text on dark pine. |
| Destructive fill `--v-danger` | `#902F3E` | Explicit loss action, parchment label and consequence wording. |
| Error text / wash | `#FFD0C8` / `#542627` | Error symbol, plain explanation and recovery action. |
| Warning text / wash | `#E8C078` / `#3E3221` | Warning symbol and specific consequence. |
| Success text / wash | `#A8C79C` / `#1C342C` | Check mark and completed-result wording. |
| Information text | `#A9CCDE` | Progress/help text on pine, with explicit status wording. |
| Disabled fill | `#3B4841` | Sage label and visible reason; remove bright material treatment. |

The [specimen stylesheet](art-direction/vaelora-brand-v1/interface-reference.css)
holds the proposed `--v-*` values. Production currently uses `--menu-*` tokens;
adoption requires an explicit mapping and component review, not a global replace.

Calculated solid-color pairs: ink/brass **8.40:1**, ink/pressed brass **6.13:1**,
parchment/crimson **6.76:1**, parchment/crimson hover **5.12:1**, celadon/pine
**8.80:1**, and control boundary/pine **4.56:1**. The boundary against secondary
hover is **3.37:1**. Ratios describe these exact solid pairs; textured composites
and real rendered states still need separate checks.

## Buttons and states

| Family | Purpose | Treatment | Examples |
| --- | --- | --- | --- |
| Primary | The dominant next step in a decision group | Worked brass, dark label, fine inset rule | New Game; a dialog's main safe confirmation |
| Secondary | An available alternative | Pine, visible sage boundary, parchment label | Practice, Create Room, Join Room, Cancel |
| Quiet utility | A lower-priority tool or reading path | Celadon text, underline or clear icon, full target area | Settings, field guide, back link |
| Destructive | A deliberate action that loses meaningful work or progress | Crimson lacquer, parchment label, no decorative gold fill | Discard unsaved changes |
| Choice | A persistent selected option | Pine, celadon edge, check mark; semantic selected state | Skirmish rules selection |

Use one dominant primary action per immediate decision group. Keep Resume
available when valid; this specification does not change its current priority
or saved-session rules. “Close” and “Cancel” are ordinary secondary actions.
Use destructive treatment only when the consequence justifies it.

| State | Visual rule | Behavior and wording |
| --- | --- | --- |
| Rest | Brass `#D0B376`; secondary pine; danger `#902F3E` | Specific verb; optional server-provided description below. |
| Hover | Brass `#E1C997`; secondary `#244237`; danger `#A84050` | Warm or lighten the face. Preserve size, position and readable label. |
| Pressed | Brass `#BA9658`; secondary deep backing; danger `#762334` | Inset shadow. No layout shift; this is the transient activation moment. |
| Focus | External celadon ring, separated from the surface | Retain during selection, errors and pending work; never communicate focus with glow alone. |
| Selected | Celadon edge and check mark | Use `aria-pressed`, `aria-selected` or native selection according to the actual control. Persist until changed. |
| Pending | Quiet surface and explicit progress label | “Creating…” or “Checking room…”. Block duplicate activation, announce progress, keep target dimensions stable and focus predictable. |
| Disabled | Quiet surface, readable sage label, no glow or raised shadow | Show a nearby reason; not only a hover tooltip. Native disabled controls do not activate. |
| Success | Check plus sage-green feedback near the task | “Saved” describes a result; primary actions do not permanently become green. |
| Error | Error symbol plus warm pale-red text on dark red wash | Preserve the player's input, explain the failed action, offer a retry or correction. |

State order: disabled/pending suppress hover and activation; focus remains
visible on focusable controls; pressed is transient; selected persists.
Distinguish an unavailable action from an action still being checked. Never
replace server errors with atmospheric lore or imply success before confirmation.

## Material and layering rules

| Material | Intended surface | Restraint |
| --- | --- | --- |
| Worked brass | Primary action, a few frame edges | Broad gold fills are rare; no flickering highlights or loud grain under text. |
| Dark pine finish | Launcher, dialogs, tool panels | Nearly opaque backing; subtle grain, no large stains behind controls. |
| Parchment | World reading and long-form guide surfaces | Warm light background; quiet fibers only if they preserve small-text contrast. Current runtime uses a flat fill. |
| Crimson lacquer | Destructive controls | Restrained matte surface. The initial specification uses flat color; a dedicated texture is not yet produced. |
| Oak foliage | Entry frame and editorial corners | Alpha layer, pointer-inactive, outside labels; reduce on narrow layouts. |
| Painted landscape | Large entry image and world discovery | Clear attribution; no essential UI baked into the painting. |

Compose in this order: **world painting → material backing → frame rules →
edge foliage → live controls**. Keep the frame and foliage separate so the
panel can resize without stretching a baked screenshot. Decoration may cross
the outer rule but must not cover text, focus rings or hit areas. Keep the
button face flexible; borders and corners should retain their thickness.

The production brass and oak assets are already preserved with
[hashes and provenance](../assets/ui/vaelora-brand-v1/materials-manifest.json).
Reuse them before generating near-duplicates. Preserve originals and export
runtime derivatives separately. The current lossless material pair adds about
2.95MB; a smaller delivery derivative remains a measured optimization task.
Do not treat the full-size sources as a future interface asset budget.

On a live battlefield, remove foreground foliage and most ornamental framing.
Retain the material palette and readable edges without competing with units,
orders or the map. Region-specific branches, stones or architectural motifs
are future art outcomes requiring their own approved reference and provenance.

## Typography, shape and composition

- **Identity and headings:** Georgia/Times serif, regular weight. The current
  spaced uppercase wordmark is provisional; use it consistently until custom
  lettering is selected. Keep clear space around the name of at least one
  capital-letter height. Do not stretch, bevel or texture the actual text.
- **Working text:** system sans, sentence case. Aim for 16px body, 14px control
  descriptions and 12px short metadata. Use a 1.5–1.65 body line height; larger
  serif headings can use 1.1–1.25. Existing portal sizes are not all migrated.
- **Controls:** rectangular silhouettes, 1px functional borders, small inset
  rules. Keep 48px normal button height, at least 44px targets, and 8px between
  adjacent targets. Primary entry can be taller to contain its description.
- **Spacing:** 4, 8, 12, 16, 24, 32, 48 and 64px steps. Prefer 24–40px panel
  padding on desktop and 20–24px on narrow screens. Allow natural content height.
- **Icons:** a consistent simple stroke style at 16–20px, generally beside a
  label. Use check, warning and error shapes alongside color. Decorative crests
  and branches are art, not control icons. The custom icon family remains open.
- **Density:** one clear entry cluster before editorial reading. Reveal less
  frequent rules and tools progressively. Keep long descriptions and translations
  readable at 320px width and 200% zoom; never crop the reason an action is disabled.

## Motion and sound

Control feedback uses 140ms color/border transitions; press feedback is immediate.
Do not resize controls on hover. Future panel reveals may use 160–220ms easing,
but only after their state sequence is storyboarded. No automatic shimmer,
pulsing primary button, ambient parallax or autoplay audio is part of this bible.
Reduced motion removes nonessential transitions. Motion and texture cannot be
the only difference between states. Any future sound follows the existing mute
and volume settings; success, warning and error remain understandable silently.

## Accessibility requirements

Use at least **4.5:1** for ordinary text and **3:1** for qualifying large text;
meaningful non-text control/state cues need **3:1** against adjacent colors.
Pair semantic colors with wording or symbols. These requirements follow
[W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
and [use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
Our readable disabled labels and 44px targets are additional design choices;
do not describe every local preference as a WCAG mandate.

Check the darkest and lightest texture patches beneath text, hover and pressed
states, focus visibility, image failure, reduced motion, forced colors, keyboard
navigation, native dialog dismissal and narrow/zoomed reflow. Do not reduce
whole-control opacity to implement disabled styling. A flat fallback must keep
the action understandable when the image does not load.

## Front page and portal

1. **Client frame:** Vaelora wordmark; Play, The world and Field guide anchors.
   Play returns to the real launch controls. The page stays scrollable.
2. **World hero:** large Bellweather landscape, Vaelora name and promise.
   Dark backing protects text independently of image loading.
3. **Player entry:** validated Resume when present; prominent New Game with
   the existing server-reported AI/map/rules description; Practice with its
   existing rules disclosure; Create Room and Join Room; Map Studio and Settings.
   These remain real actions using their existing IDs, API and saved-session rules.
4. **World introduction:** three short regional entries grounded in the lore,
   with expandable field notes that keep reading inside the portal. An optional
   atlas link opens the actual wiki. These are reading destinations, not map selectors.
5. **Field guide:** three short player verbs and links to the existing guide.
   Content does not pretend to be an interactive tutorial.

One useful screen comes before deeper reading. Narrow layouts retain a compact
world banner and then the launch controls. Small widths stack the room buttons;
short windows can scroll. Dialogs use the same pine/brass language, native focus
containment, Escape and existing cancellation rules. The [state storyboard](art-direction/vaelora-brand-v1/entry-storyboard.svg)
defines ready, Resume, pending, error, dialog and narrow states.

## Voice

World copy is concrete, inviting and lightly curious. Product copy is literal.
Use **New Game**, **Practice**, **Create Room**, **Join Room**, **Resume** and
**Settings**. Keep server-provided availability and failures visible. Do not
turn an error into lore or call an unimplemented feature a destination.

Example world line: “Orchards, river crossings and towns built around the work
of everyday life.” Example action: “Join Room — Use a room code or invite link.”
Avoid grand claims about endless worlds, mass battles, population counts or
complete factions that the current build has not established.

## Reference decisions

Read 11 October 2026. These are design interpretations, not claims of a live
desktop-client audit, and no third-party artwork, fonts or UI assets are reused.
The [research and alternatives](art-direction/vaelora-brand-v1/brand-research.md)
separate current website observations, historical UI guidance and our own
recommendations. The [visual reference](art-direction/vaelora-brand-v1/interface-reference.html)
compares brass, celadon and crimson entry actions while holding the composition
constant. Brass remains the recommended continuation of the user's selection.

| Primary reference | Observed principle | Vaelora decision |
| --- | --- | --- |
| [Blizzard: getting started](https://worldofwarcraft.blizzard.com/en-us/start) | World introduction accompanies explicit starting and returning-player paths. | Pair world imagery with direct launch and validated Resume. |
| [Riot: League client update](https://na.leagueoflegends.com/en/featured/preseason-2017/client) (historical, 2017) | Client identity and practical player tools are developed together. | Give entry, settings and room dialogs one material language. |
| [Riot: Hextech UI](https://www.riotgames.com/en/news/under-hood-league-client%E2%80%99s-hextech-ui) (historical, 2017) | Shared components, type and motion make independent features coherent. | Reuse theme variables, plain DOM controls and bounded feedback; retain the lightweight existing entry. |

## Delivery slices and acceptance

The extended system is a specification, not a claim that every component exists
in production. Current differences requiring a later focused implementation:

| Area | Current portal | Proposed adoption |
| --- | --- | --- |
| Focus | Brass ring | Celadon ring with dark separation |
| Control borders | Existing menu line token | Stronger functional boundary, separate decorative line |
| Feedback | Existing brass status and dialog error text | Semantic feedback pairs with symbols and literal copy |
| Destructive and selected components | No shared v0.2 component family | Adopt only on real relevant flows; keep existing authority and confirmation rules |
| Typography | Mixed 12–14px descriptions and current serif headings | Review small copy against the proposed scale and actual available space |

The bible, research and component reference are internal repository documentation,
not public game endpoints. Keep current API, session and launch contracts intact
when adopting a component. Validate its exact colors, state behavior, art inputs,
packaging and appearance at the identified release; update the owning QA record.

| Slice | Owner, scope and acceptance |
| --- | --- |
| First portal | This chat owns `index.html`, `src/game-menu.css`, exact public art admission and the brand pack through integration. Preserve game-entry behavior; exercise existing fresh/Resume/Join/Practice/settings tests and real menu protocol scenario. Package the art; inspect identified deployed root and actual entry when an approved browser is available. |
| Cohesive room journey | Follow-up owned by this chat: extend the agreed material language to lobby, loading and result surfaces after reviewing the first portal. Keep lobby readiness, host/guest authority and errors explicit. No simulation changes. |
| Identity refinement | Follow-up owned by this chat: compare custom wordmark/crest options at header, favicon and small HUD scale before replacing the working text mark. Keep provenance and approved comparisons. |
| Living presentation | Later, only after the static entry is accepted: storyboard optional restrained scene motion and deliberate audio, measure loading and respect existing mute/reduced-motion settings. |

Acceptance must distinguish a generated study, source tests, packaged files,
deployed identity and actual rendered use. See the [QA record](qa-vaelora-brand-portal-2026-10-11.md)
and [adoption ledger](asset-adoption-checklist.md#vaelora-player-portal--11-october-2026).
