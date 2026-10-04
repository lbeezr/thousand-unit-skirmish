# Selection identity and future field notes

One selected living friendly Worker, Infantry, Archer or Spearman has a compact portrait, name and live HP.
The portrait opens the existing dismissible Selection drawer with practical role
notes: registered abilities, live HP, base movement/attack stats and training
producer, cost, duration and population. Military notes retain separate
structure damage and registered target multipliers. The same 52px slot retains the legacy Barracks lifecycle
thumbnail and the Farm's admitted lifecycle illustration; both open existing
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

Worker/Infantry/Archer/Spearman training controls reuse the same sources as decorative 20px
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

Existing public mounted/siege illustrations are inventoried below;
their portrait/training deliveries and deliberate framing remain missing.
Skiff and barriers have no matching approved HUD illustration. The newer
Mill/Dock battlefield captures are separate from missing matching HUD
portraits; the Farm reuse below closes its source/framing gap. Keep text/symbol disclosure where needed, with no borrowed role image or
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

## Farm runtime reuse — 4 October 2026

The requested Farm illustration now reuses the admitted default Frontier family
in the existing 52px Selection portrait and 40px inline figure. [Provenance and
all eight source hashes](../assets/ui/portraits/PROVENANCE.md#farm-runtime-reuse--4-october-2026)
pin view-01 and the CSS viewport x260/y420/500px. Actual original pixels at both
sizes retain crop rows/roof, the open construction scaffold and exhausted bare
soil. The fixed view illustrates building identity; camera rotation and live
team standards remain battlefield cues. No asset is generated, modified or copied.

Construction uses foundation/frame at the registered 0.275 threshold. Completion
requires the authoritative flag; productive/exhausted and damage variants follow
finite stock and the registered 0.6/0.3 health thresholds. Written stock, state,
health and desktop/touch Worker instructions retain their existing meanings.
Image errors immediately restore the labelled Food symbol without retrying that
failed state on every snapshot; unsupported snapshots use the same fallback.
The stable design-study link, dismissible details, focus recovery, select audio,
clear/replant actions and FoodTools research are unchanged. CPU source inspection
and DOM/HTTP tests do not establish actual native HUD appearance acceptance.

## Approved Spearman reuse — 4 October 2026

The established painted Human Spearman v1 and Boughward isolated idle figures
now supply the single-friendly-Spearman portrait and both dynamic Barracks
training surfaces by default. [Source hashes and selection reasons](../assets/ui/portraits/PROVENANCE.md#spearman-reuse--4-october-2026)
pin whole-image contain framing inside the unchanged 52px/20px slots; upper-body
crops cut long equipment. Both hands and the spear remain intact. Full names,
live HP, costs, guarded commands, dismissible notes and visible focus retain
their existing behavior. Spearman notes replace Archer facts and include the
registered 3× mounted-damage multiplier, separate structure damage and Barracks
training. Failed/unsupported art retains written controls and notes. Returning
to Worker or Farm clears contain styles on stable image nodes.

### Current selection and training bindings — 4 October 2026

This is the current inventory; the 3 October audit below is dated source history.

| Role | Current HUD binding | Remaining source/acceptance |
| --- | --- | --- |
| Worker | Human/Boughward approved illustrations in 52px Selection and 20px training | Native framing/recognition open |
| Infantry | Restored Human v3/Boughward illustrations; default integration [PR375](https://github.com/lbeezr/thousand-unit-skirmish/pull/375) | Containing staging `b07df557` reported successful by parent; ordinary-game acceptance open |
| Archer | Established Human v2/Boughward idle copies in the same compact surfaces; [PR387](https://github.com/lbeezr/thousand-unit-skirmish/pull/387) | Included in containing staging `34e22bed`; native framing/recognition open |
| Farm | Existing Frontier lifecycle view-01 in 52px Selection and 40px inline figure; explicit Food symbol on failure/unknown state; [PR391](https://github.com/lbeezr/thousand-unit-skirmish/pull/391) | Parent independently confirmed Railway `e50337e8` SUCCESS at 22:31, exact `34e22bed`; actual compact visual/keyboard acceptance open |
| Spearman | Established Human v1/Boughward idle figures contained in existing Selection and both training slots | Clean package/containing identified delivery and native framing/recognition remain separate evidence |
| Scout / Rider | Text; approved mounted sources available | Portrait framing/delivery must preserve wolf/boar or horse identity |
| Siege Engine | Text; approved equipment sources available | Deliberate equipment framing/delivery missing |
| Skiff | Text | Matching approved HUD illustration missing |

The Archer change touches the existing training-decoration list and portrait
descriptors; it does not change selected Mill research, Food Tools descriptions,
availability, commands or focus. The Farm follow-on removes the stale temporary-
House claim and reuses existing default art; matching Mill/Dock HUD framing remains.

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
5. Through ordinary paid Worker controls, build a Farm and capture its existing
   52px portrait and 40px Selection illustration during foundation/frame,
   productive completion, actual finite depletion and paid replanting. Repeat
   both seats, desktop/touch, damaged/critical states available in normal play,
   and a narrow viewport. Record the containing served source/digest, viewport/DPR
   and map. Inspect original PNGs for crop rows/scaffold/bare soil, alpha edges,
   contrast and clipping beside readable stock/HP/Worker instructions; verify
   Tab/source-link focus, Escape/close and clear/replant/FoodTools controls.
   Native missing-image fallback needs a bounded request failure, not stock or
   economy injection. The known cloud sandbox block is not retried or bypassed.
6. In the paid completed Barracks, train a Spearman for 60 food / 20 wood.
   Capture both labelled 20px controls and the selected 52px figure on each
   effective family. Inspect the full two-handed spear, alpha edges, contrast
   and clipping beside the full name and live HP. Check the 3× mounted fact,
   separate structure damage, low-wood guarded activation, optional notes/link
   focus and Escape. Repeat Archer → Spearman → Worker/Farm → group/empty to
   verify framing resets and focus recovery at wide and narrow viewports.

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
