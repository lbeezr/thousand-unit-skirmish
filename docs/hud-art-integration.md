# Worker identity and future field notes

One selected living friendly Worker now has a compact portrait, name and live HP.
The portrait opens the existing dismissible Selection drawer with practical role
notes. Multiple units retain their composition summary. Building, enemy, dead,
stale and spectator selections never receive an invented individual portrait.
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

A later field-notes or codex entry can reuse these boundaries without enlarging
the default HUD or creating a separate rules registry:

| Field | Owner and current Worker value |
| --- | --- |
| Entry and role | `unit.worker`; `unitKind: worker`; label and all abilities come from [gameplay definitions](../src/gameplay-definitions.mjs) (`move`, `attack`, `gather`, `build`, `repair`) |
| Appearance | Effective sprite role: `human` or `boughward-worker`; [portrait descriptors](../src/selection-portrait.mjs) supply illustration and viewport |
| Live instance | Snapshot HP and current selection; never stored as general lore or attached to a multi-selection |
| Culture and lore | Optional source-linked prose kept separate from appearance and gameplay capabilities; no individual name, birthplace, faction membership or ancestry-derived personality is established here |

Human [peoples and cultures](lore/peoples.md#humans) describe varied agricultural,
trading and traveling societies, not one universal Human culture. The selected
[Human clothing direction](art-direction/human-vaelora-sprites-v1/README.md)
uses Bellweather/Common Hearth inspiration without binding faction membership.
Boughward [institutions](lore/institutions.md) explore woodland stewardship;
jurisdiction and history remain proposals. An appearance association alone
must not promote these working notes into settled individual lore.

For later production-button imagery, start with deliberately framed approved
model captures for Town Center and Storehouse, and the integrated Barracks
sprite/capture. Keep those building identities separate from illustrated unit
portraits and action symbols. Exact candidates are
[Town Center](../assets/buildings/frontier-civilization-scale-pilot-v1/captures/town-center-complete-view-00.png),
[Storehouse](../assets/buildings/frontier-civilization-models-v1/captures/storehouse-complete-view-00.png)
and [current Barracks](../assets/buildings/barracks-sprite-test-v1/runtime/barracks-complete-azure.webp).
This Worker slice does not add a building icon loader or a full encyclopedia.

## Evidence and limits

The shipped HTML/client-handler tests cover both seats, live HP, notes open and
Escape focus restoration, group summaries, invalid selections, effective
appearance/legacy fallback, and decorative icon survival through target states.
Asset checks verify source hashes, byte-identical reuse, viewport bounds,
explicit HTTP allowlisting and release Docker inclusion. These checks are not
native pixel, pointer, Retina or VoiceOver acceptance. Follow the
[cumulative Mac checklist](contextual-hud-validation.md#cumulative-mac-qa-checklist)
and record the actual build and observations in the implementation PR.
