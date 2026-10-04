# Selection identity and future field notes

One selected living friendly Worker, Infantry or Archer has a compact portrait, name and live HP.
The portrait opens the existing dismissible Selection drawer with practical role
notes: registered abilities, live HP, base movement/attack stats and training
producer, cost, duration and population. Infantry/Archer notes retain the separate
structure-damage value. The same 52px slot retains the legacy Barracks lifecycle
thumbnail and the Farm's explicitly labelled Food symbol; both open existing
structure details. Matching the newer default captured Barracks identity remains
incomplete. Multiple units retain their composition summary. Unsupported
buildings, enemy, dead, stale and spectator selections have no portrait.
The existing Build, battlefield target and Attack move commands use the original
[purpose-drawn icons](../assets/ui/PROVENANCE.md), retaining visible labels and
the established M hotkey. Patrol, Follow, Stop, Hold position, Return cargo and
Formation now use [action glyphs](../assets/ui/icons/actions/README.md) by default
in existing labelled controls at 20 px. The Command drawer's duplicate tactical
controls use the same files. Formation remains hidden for building details;
Return cargo retains its distinct text, tooltip and carrying-Worker/Skiff behavior.

Worker/Infantry/Archer training controls reuse the same sources as decorative 20px
thumbnails. Product names, costs, availability reasons and commands remain on
the existing buttons. The source image/label nodes survive live updates; an
image error hides only the decorative frame. Legacy/model previews retain text.

The portrait resolves the effective sprite appearance, rather than inferring
ancestry from seat number. Normal Human/Boughward rendering and the explicit
Vaelora Human preview have matching inspected illustrations. Unrepresented
legacy cast/model previews retain text. Low-detail rendering does not change
the presentation association. [Source hashes and framing](../assets/ui/portraits/PROVENANCE.md)
record reuse of already public art; no new concept image was published.

## Small integration contract

The Worker entry uses these boundaries without enlarging the default HUD or
creating a separate rules registry:

| Field | Owner and current Worker value |
| --- | --- |
| Entry and role | `unit.worker`; `unitKind: worker`; label and all abilities come from [gameplay definitions](../src/gameplay-definitions.mjs) (`move`, `attack`, `gather`, `build`, `repair`) |
| Appearance | Effective sprite role: `human` or `boughward-worker`; [portrait descriptors](../src/selection-portrait.mjs) supply illustration and viewport |
| Live instance | Snapshot HP and current selection; never stored as general lore or attached to a multi-selection |
| Gameplay facts | Base movement, damage, attack class/target tags, interval and range; training cost, duration, population and producer products derive from the same definitions |
| Culture and lore | Optional source-linked prose kept separate from appearance and gameplay capabilities; no individual name, birthplace, faction membership or ancestry-derived personality is established here |

The initially collapsed **World notes (working lore)** disclosure quotes one
sentence from the [Vaelora overview](lore/world.md). Its source link identifies
an immutable version and announces a new tab. The same general world note serves
both appearances. Live snapshots retain its nodes, open state and focus; removing
the Worker entry closes it and moves any contained focus to the visible Selection
tab. Escape retains the existing drawer dismissal and selection behavior.

Human [peoples and cultures](lore/peoples.md#humans) describe varied agricultural,
trading and traveling societies, not one universal Human culture. The selected
[Human clothing direction](art-direction/human-vaelora-sprites-v1/README.md)
uses Bellweather/Common Hearth inspiration without binding faction membership.
Boughward [institutions](lore/institutions.md) explore woodland stewardship;
jurisdiction and history remain proposals. An appearance association alone
must not promote these working notes into settled individual lore.

## Approved Infantry reuse — 4 October 2026

The restored Human Infantry v3 idle sheet and existing Boughward isolated idle
now supply the single-friendly-Infantry portrait and labelled training thumbnail
by default. [Exact source hashes, framing and provenance](../assets/ui/portraits/PROVENANCE.md#infantry-reuse--4-october-2026)
retain helmet, face, cream/sage or burgundy clothing, short spear and upper shield.
The existing 52px portrait, 20px action size, 44px command target, dismissible
drawer and restrained panel treatment remain. Worker → Infantry replaces every
role fact and the notes group's accessible name; no Worker abilities or Town
Center training persist. The general sourced world note remains optional.

Existing public Spearman and mounted/siege illustrations are inventoried below;
their portrait/training deliveries and deliberate framing remain missing.
Skiff and barriers have no matching approved HUD illustration. The newer
Farm/Mill/Dock battlefield captures are separate from missing matching HUD
portraits. Keep existing text/symbol disclosure, with no borrowed role image or
newly generated/rejected placeholder.

## Approved Archer reuse — 4 October 2026

The established Human Archer v2 and Boughward idle illustrations now supply the
single-friendly-Archer portrait and both contextual/drawer training thumbnails
by default. [Pinned source hashes and framing](../assets/ui/portraits/PROVENANCE.md#archer-reuse--4-october-2026)
retain open face/cape or green goblin/burgundy scarf, plus bow and quiver. The
same 52px Selection slot, decorative 20px thumbnails, written names/costs,
44px targets and dismissible notes remain. Archer notes use registered ranged
damage/range, separate structure damage and Archery Range training, replacing
Infantry facts during live selection changes. Failed artwork retains text and
notes; unsupported effective appearances retain their text-only state.

### Current roster HUD bindings — 4 October 2026

This is the current inventory; the 3 October audit below is dated source history.

| Role | Current HUD binding | Remaining source/acceptance |
| --- | --- | --- |
| Worker | Human/Boughward approved illustrations in 52px Selection and 20px training | Native framing/recognition open |
| Infantry | Restored Human v3/Boughward illustrations; default integration [PR375](https://github.com/lbeezr/thousand-unit-skirmish/pull/375) | Containing staging `b07df557` reported successful by parent; ordinary-game acceptance open |
| Archer | Established Human v2/Boughward idle copies in the same compact surfaces | Clean package/identified delivery and native framing/recognition remain separate evidence |
| Spearman | Text; approved idle sources available | Deliberate portrait framing/delivery missing |
| Scout / Rider | Text; approved mounted sources available | Portrait framing/delivery must preserve wolf/boar or horse identity |
| Siege Engine | Text; approved equipment sources available | Deliberate equipment framing/delivery missing |
| Skiff | Text | Matching approved HUD illustration missing |

The Archer change touches the existing training-decoration list and portrait
descriptors; it does not change selected Mill research, Food Tools descriptions,
availability, commands or focus. The building-action owner retains the Farm
symbol's stale temporary-House wording after the new captured Farm default,
and matching economy-building HUD framing. No new building image is adopted here.

The building-action owner retains two observed follow-ups: a rotated Barracks
returns no legacy image URL and the old portrait helper throws on `.replace()`;
the nonrotated Complete thumbnail also uses the legacy family beneath the newer
default battlefield captures. These are source-contract gaps recorded on
[building selection PR352](https://github.com/lbeezr/thousand-unit-skirmish/pull/352),
not acceptance of a substitute building identity.

### Ordinary-game capture recipe and remaining evidence

Use an identified clean release containing this integration in the already
qualified runner after CI resolves its existing access clarification. Record
source SHA, pack digest, served identity, browser, viewport/DPR, map and team.
Do not retry the blocked cloud sandbox, start a new dispatch or resume cancelled
login. The HUD owner retains pixel inspection and the unfinished outcome.

1. Enter through root → New Game → Tiny Terraced Vale. Select a Worker, use
   Build to pay for/place a Barracks, finish it, then select its Infantry training
   control and pay 50 food. Capture the ordinary labelled Worker/Infantry
   product controls at 20px and the Build & train drawer's matching thumbnails.
2. Select one living Infantry in the battlefield. Capture its 52px portrait and
   live HP, open role notes, inspect the registered abilities/training and
   separate structure damage, then dismiss with Escape and confirm visible focus.
3. Repeat for the other viewing team, low resources/full queue, Worker → Infantry
   → group/empty, and narrow horizontal scrolling. Inspect every retained PNG
   for framing, contrast, clipping, alpha edges and unchanged readable labels.
   Retain color/grayscale comparisons; exact native screenshots establish the
   represented states only, without claiming unassisted role recognition.
4. Build/finish an Archery Range through the same ordinary paid controls, train
   an Archer for 25 food / 45 wood, and capture both labelled 20px training
   surfaces plus the 52px selected Archer. Verify ranged/structure attack facts,
   Archery Range training, live HP, Worker → Infantry → Archer → group/empty
   focus/dismissal, low wood/unavailable activation and both effective families.

Static original/52px/20px CPU source pixels were inspected in color and grayscale.
DOM tests cover effective appearance, both seats, stable nodes, truthful facts,
focus/dismissal, unavailable activation, image errors and unchanged training
commands. HTTP checks verify exact GET/HEAD PNG MIME/hash and source-only denial;
clean pack evidence is recorded in the implementation PR. Rendered native HUD
appearance, identified deployed delivery and human recognition remain incomplete.

## Existing-art mapping audit — 3 October 2026

Checked against main `518b3bd`, definitions and actual renderer bindings.
Illustration availability does not establish final portrait acceptance. Unit
illustrations remain separate from smaller packed runtime silhouettes; retain
effective appearance roles, mount identity and equipment rather than inventing
an individual character for every role.

| Unit | Human illustration | Boughward illustration | HUD status |
| --- | --- | --- | --- |
| Worker | [Idle facings](art-direction/human-vaelora-sprites-v1/source/Idle/facings.png) | [Isolated idle](art-direction/boughward-roster-v1/extracted/worker/00.png) | Integrated through PR84 |
| Infantry | [Idle facings](art-direction/human-roster-v1/source/infantry-idle-facings.png) | [Isolated idle](art-direction/boughward-roster-v1/extracted/infantry/00.png) | Pixels inspected; deliberate framing can follow |
| Spearman | [Idle facings](art-direction/human-roster-v1/source/spearman-idle-facings.png) | [Isolated idle](art-direction/boughward-roster-v1/extracted/spearman/00.png) | Available; framing deferred |
| Archer | [Idle facings](art-direction/human-roster-v1/source/archer-idle-facings.png) | [Isolated idle](art-direction/boughward-roster-v1/extracted/archer/00.png) | Available; framing deferred |
| Scout | [Mounted idle](art-direction/human-mounted-v1/extracted/scout/00.png) | [Wolf-mounted idle](art-direction/boughward-roster-v1/extracted/scout/00.png) | Available; retain mount |
| Rider | [Mounted idle](art-direction/human-mounted-v1/extracted/rider/00.png) | [Boar-mounted idle](art-direction/boughward-roster-v1/extracted/rider/00.png) | Available; retain mount |
| Siege Engine | [Equipment](art-direction/human-mounted-v1/extracted/siege-engine/00.png) | [Equipment](art-direction/boughward-roster-v1/extracted/siege-engine/00.png) | Available; equipment portrait |

Generation scope and source provenance remain in the
[Human](art-direction/human-roster-v1/README.md),
[mounted/siege](art-direction/human-mounted-v1/README.md) and
[Boughward](art-direction/boughward-roster-v1/README.md) production notes.

| Building | Current renderer identity | HUD status |
| --- | --- | --- |
| Barracks | [Five lifecycle states × Azure/Ember](../assets/buildings/barracks-sprite-test-v1/PROVENANCE.md), direct WebPs | Integrated using the battlefield's `buildingSpriteUrl` |
| Archery Range | [Equivalent direct lifecycle frames](../assets/buildings/archery-range-sprite-v1/README.md) | Available; its framing audit remains |
| Town Center | [Captured lifecycle grid](../assets/buildings/town-center-lifecycle-meshy-v1/lifecycle-grid.json) and team masks | Defer; the simple sprite resolver points to an older Complete-only reference |
| House, Storehouse, Stable, Workshop, Watchtower | Procedural default geometry; [Frontier model captures](../src/frontier-building-preview.mjs) are opt-in previews | Defer an exact-match portrait; do not imply preview captures are defaults |
| Mill, Dock, Palisade | Procedural placeholders | No matching authored portrait yet |

Stable/Workshop reuse presentation roles but have no Barracks/Range sprite URL;
do not give them another building's picture. No separate Boughward building
family is established. Model renders remain the preferred production-icon
source once their active identity is verified. This slice adds no broad icon
loader or encyclopedia.

All ten Barracks frames are existing 640² WebPs with retained hashes. Their
combined nonzero-alpha bounds `(40,99,600,636)` fit inside the common square
viewport `(32,64,576,576)`. No bytes were changed or duplicated. The shared
resolver retains construction thresholds at 20%/90%, completed health thresholds
at 66%/33%, and Azure/Ember variants. Frontier preview flags do not replace
Barracks. Existing server routes and release Docker rules already include them.

## Evidence and limits

The shipped HTML/client-handler tests cover both seats, live HP, notes open and
Escape focus restoration, registry-derived facts, sourced optional lore,
disclosure/link focus during live updates and entry removal, group summaries, invalid selections, effective
appearance/legacy fallback, and decorative icon survival through target states.
Action checks cover all six default bindings, both seats' unit/building/empty
transitions, stable image/label nodes through live updates, text after an image
error and unchanged cargo ordering. A dedicated HTTP scenario checks default
HTML plus all six GET/HEAD responses, MIME and source hashes; source-only
manifest/README and unapproved paths remain rejected. It also accepts a clean
release directory to verify packaged serving. Deployment and native in-game
appearance/keyboard verification remain incomplete in the
[adoption ledger](asset-adoption-checklist.md); the active HUD owner retains them.
Asset checks verify source hashes, byte-identical reuse, viewport bounds,
explicit HTTP allowlisting and release Docker inclusion. These checks are not
native pixel, pointer, Retina or VoiceOver acceptance. Follow the
[cumulative Mac checklist](contextual-hud-validation.md#cumulative-mac-qa-checklist)
and record the actual build and observations in the implementation PR.
