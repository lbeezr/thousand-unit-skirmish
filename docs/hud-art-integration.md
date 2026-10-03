# Selection identity and future field notes

One selected living friendly Worker now has a compact portrait, name and live HP.
The portrait opens the existing dismissible Selection drawer with practical role
notes: registered abilities, live HP, base movement/attack stats and training
producer, cost, duration and population. The same 52px slot shows a selected owned Barracks's current lifecycle
frame and opens its existing structure details; health/production are not repeated
in a new panel. Multiple units retain their composition summary. Unsupported
buildings, enemy, dead, stale and spectator selections have no portrait.
The existing Build, battlefield target and Attack move commands use the original
[purpose-drawn icons](../assets/ui/PROVENANCE.md), retaining visible labels and
the established M hotkey. Return cargo keeps its distinct text and behavior.

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
Asset checks verify source hashes, byte-identical reuse, viewport bounds,
explicit HTTP allowlisting and release Docker inclusion. These checks are not
native pixel, pointer, Retina or VoiceOver acceptance. Follow the
[cumulative Mac checklist](contextual-hud-validation.md#cumulative-mac-qa-checklist)
and record the actual build and observations in the implementation PR.
