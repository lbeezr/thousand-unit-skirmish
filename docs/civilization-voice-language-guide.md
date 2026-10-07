# Civilization voices and language direction

[Lore reference](lore/README.md) · [Prose voice bible](lore-voice-bible.md) · [UI sound direction](ui-audio-direction.md) · [Runtime contract](audio-runtime-packs.md)

**Status: proposed creative direction for review, 7 October 2026.** Every casting
choice, accent feature, phrase, duration and language-development direction below
is a proposal. This guide adopts no new canon, approves no recording and assigns
no runtime asset. No voices or new assets were produced for it.

Source review uses main `7df6b204`. The separate
[PR598 event/asset matrix at `d19df5c3`](https://github.com/lbeezr/thousand-unit-skirmish/blob/d19df5c3d2c2ab8c013d847c64ebdc5b3994334f/docs/audio-event-asset-matrix.md)
is **draft branch evidence**, not a file present on main or a merged runtime
contract. It records caller coverage, missing context and proposed asset slots;
this guide supplies proposed spoken treatment. The owning lore entries retain
their selected, working, belief and open status.

## Sources and identity

The [Frontier architectural kit](lore/frontier-architecture.md) supplies cultivated
households, stores, workshops and militia buildings. Bellweather informs that
craft vocabulary; Frontier is the only registered gameplay civilization in the
[definitions](../src/gameplay-definitions.mjs), not a settled nation, ancestry or
religion. Azure/Ember identify ownership and supply no language or accent.

The [peoples reference](lore/peoples.md) separates ancestry, learned practice,
residence and political allegiance. Its human cultures are not universal, and
its elven survival and present-custodian questions remain open. The
[Boughward roster](art-direction/boughward-roster-v1/README.md) is a selected rival
art presentation under the same Frontier gameplay rules. That presentation does
not establish a language, a civilization chooser or an asymmetric roster.

The [prose voice bible](lore-voice-bible.md) supports practical responses, exact
materials, varied viewpoints and occasional dry humor. The
[UI sound grammar](ui-audio-direction.md) distinguishes acknowledgement,
completion, attention and result. A spoken layer should keep those meanings
clear; its character comes from delivery and vocabulary rather than new claims
about the world or the outcome of an order.

## Proposed Frontier performance

Aim for competent, companionable people from households, workshops and militia.
Put the practical action or noun early. Routine lines aim for two clear stresses,
a short downward close, clear consonants, full brief vowels and an unrolled
`r`. These are audition instructions, not a canonical accent or a national
caricature. Keep warning meaning literal and easy to understand.

| Role | Proposed delivery |
| --- | --- |
| Worker | Conversational, comfortable naming a task and getting on with it. |
| Infantry | Companionable; readiness belongs to a group. |
| Spearman | Economical, with a clear start and little ornament. |
| Archer | Precise, attentive to the requested mark. |
| Scout | Brisk and alert without inventing a sighting. |
| Rider | Energetic, with words remaining clear. |
| Siege Engine | Mechanically practical crew delivery; a speaking crew is a proposed casting choice. |
| Skiff | Matter-of-fact, treating boat work as ordinary work. |

Useful proposed vocabulary: **mend, fit, carry, steady, timber, wheel, rope,
stores**. Rare dry material humor can distinguish occasional routine lines;
alarms stay literal. This is an editorial direction, not implemented weighted
rarity. Avoid making every role a comedian or a variation of the same performance.

## First proposed audition: 30 takes

Eight unit-selection meanings × two takes = **16**; four Worker-order meanings
× two = **8**; three warnings × two = **6**. All thirty scripts are newly proposed.
The source-ID stems below reserve editorial names; append `-01` or `-02` for the
corresponding take. They identify no produced file or assigned pack source.

Routine duration target: **0.55–1.35 seconds**. Warning target: **1.1–1.8 seconds**.
Actual audition must establish sayability, timing, intelligibility and fit under
rapid orders and music. The targets are not measured recordings or new cooldowns.

| Stable meaning ID / event key | Proposed source-ID stem | Proposed take `-01` | Proposed take `-02` |
| --- | --- | --- | --- |
| `selection.worker` / `unit.worker.select` | `frontier.worker.select` | “What needs doing?” | “Tools at hand.” |
| `selection.infantry` / `unit.infantry.select` | `frontier.infantry.select` | “Together, then.” | “Line ready.” |
| `selection.spearman` / `unit.spearman.select` | `frontier.spearman.select` | “Spear ready.” | “Point the way.” |
| `selection.archer` / `unit.archer.select` | `frontier.archer.select` | “Bow at hand.” | “Your mark?” |
| `selection.scout` / `unit.scout.select` | `frontier.scout.select` | “Where next?” | “Eyes open.” |
| `selection.rider` / `unit.rider.select` | `frontier.rider.select` | “Ready to ride.” | “Reins in hand.” |
| `selection.siege-engine` / `unit.siege-engine.select` | `frontier.siege-engine.select` | “Crew ready.” | “Wheels and ropes.” |
| `selection.skiff` / `unit.skiff.select` | `frontier.skiff.select` | “Skiff here.” | “Taking orders.” |
| `order.worker.move` / `unit.worker.move` | `frontier.worker.move` | “On my way.” | “Taking the road.” |
| `order.worker.gather.wood` / `unit.worker.gather.wood` | `frontier.worker.gather-wood` | “To the timber.” | “I’ll cut wood.” |
| `order.worker.build` / `unit.worker.build` | `frontier.worker.build` | “Setting to work.” | “I’ll build it.” |
| `order.worker.repair` / `unit.worker.repair` | `frontier.worker.repair` | “I’ll mend it.” | “Repairing.” |
| `warning.units-damage` / `cue.battle-alert` | `frontier.alert.units-under-attack` | “Your units are under attack.” | “Units taking damage.” |
| `warning.selected-damage` / `cue.selected-alert` | `frontier.alert.selected-force-under-attack` | “Your selected force is under attack.” | “Selected units taking damage.” |
| `warning.buildings-damage` / `cue.base-alert` | `frontier.alert.base-under-attack` | “Your buildings are under attack.” | “Buildings taking damage.” |

## Meaning and binding boundaries

- Order acknowledgements require a matching **authoritative applied order**.
  Pending/planned commands, rejection and duplicate success do not speak as
  accepted work. Selection is a separate local selection event.
- Choose one representative for a group rather than a clip for every unit.
  Preserve common/synthesis fallback, shared cooldowns, urgent priority and
  interruption/mute/focus limits. A longer proposed phrase does not authorize
  changing these policies or adding a queue of stale acknowledgements.
- Farm, sheep and fish-specific lines remain **UNBOUND** until callers supply real,
  already disclosed context. Generic food does not imply farming, fishing or
  hunting. The current sheep route does not establish a supported hunting action.
  Skiff has no attack capability; do not add an attack line for it.
- Exact `building.<type>.select` keys already exist. Typed building completion is
  a caller/schema gap: the completion caller omits type and building keys support
  selection only. PR598's distinct synthesized building defaults are draft work;
  no exact-building voice is delivered by this guide.
- Damage warnings describe observed losses to owned units or buildings. They
  supply no attacker, animal cause, count, direction, location or proximity. The
  legacy “BATTLE NEARBY” caption does not establish a distance-gated event. No
  dedicated first-sight or animal-specific warning is introduced here.
- Do not derive voice identity from seat, team color, art assignment or region.
  A future explicit actor/civilization association needs a coordinated interface;
  the current Human/Boughward presentation pairing does not supply one.
- Existing variant choice uses `Math.random`, avoiding immediate same-source
  repeats when alternatives exist. It supplies no weighted rarity, deterministic
  rotation or personality system. Performance variety is an audition decision.

## Future palettes and invented-language experiments

**Boughward proposal:** coordinated woodland-craft speech, with practical attention
to fitting, hauling and keeping a group together. Preserve role differences.
Permanent growls and comic goblin voices are not the default treatment. Neither
this proposal nor the existing art establishes speech anatomy, accent, language
genealogy or temperament for an entire people.

**Elven proposals:** source-linked palettes may explore cultivation, observation
or custodianship where the [peoples reference](lore/peoples.md) supports that
working direction. Keep sun, moon and star traditions distinct. Moon/star survival
and the identity of current speakers/custodians are unresolved; a performance
proposal must not make a present population or shared origin canonical.

**Wayfarer proposal:** draw from the practical care, hospitality and traveling
craft in [Wayfarer traditions](lore/wayfarers.md). It is a cultural direction,
not a universal human accent or an inferred bull/jackal temperament.

Invented-language seeds remain **experimental**. Give each trial a spelling,
sayable pronunciation, intended meaning, gloss and direction version. Keep
stress/sound trials and naming-family hypotheses separate from accepted grammar,
genealogy, ancestry or religious history. Do not infer a language family from an
apostrophe, a regional name or an art palette. No seed word or invented language
is adopted here.

Stable meaning IDs allow later spoken-language replacement without renaming
gameplay events or changing what an acknowledgement claims. Distinguish the
spoken-language ID from the player's UI/caption locale. A comprehensible semantic
caption should remain available by its normal enabled-caption path even when
the proposed spoken words are unfamiliar.

## Editorial ledger and runtime limits

Maintain one row per proposed take, with:

| Field | Editorial requirement |
| --- | --- |
| Meaning ID | Stable player meaning, independent of translated wording. |
| Event key or `UNBOUND` | Exact existing key and disclosed caller context, or the unresolved route. |
| Source ID | Proposed/reserved identifier, then the actual source when separately produced. |
| Text and pronunciation | Exact spelling, stress/respelling and any accepted name reading; mark new readings proposed. |
| Gloss and localized caption | Understandable meaning; keep speech language and caption locale separate. |
| Direction version | Civilization/voice-family, role, performance revision and language-trial version. |
| Approval state | Separate script review, recording approval, listening acceptance, imported and runtime-verified state. |
| Source/status | Linked lore basis, its actual status and any new proposal; retain recording provenance/rights separately. |

The existing [pack validator](../src/audio-assets.mjs) has a voice bus and one
plain `caption` string per variant. Language, caption locale, explicit actor
identity and these editorial fields are **future** bounded validation and
save/import/export design; adding them to prose or arbitrary JSON implements
none of them. The draft PR598 civilization layers do not implement locale
selection or produce a voice family.

Both Main caption renderers require captions enabled. Sampled profile text follows
successful playback start. Decision callbacks have separate conditions: normal
synthesized cues call back while visible, including muted/locked output; an
eligible sampled cue calls back when captions are enabled or master audio is
disabled. Lock or bus mute alone does not guarantee that callback. A callback
fixture proves neither visible caption UI nor audible playback.

For future localization, retain the existing cue caption as a fallback where
available after a localized/default semantic caption. Keep the caption setting
gate. Source trims, gain, cooldowns, priorities, pack budgets and original bytes
remain governed by the runtime contract. This guide changes no schema, stored
settings, event hooks or imports.

## Next review steps

1. Review the proposed delivery and all thirty scripts against their exact meanings
   and linked lore status; revise wording without adopting an accent or language
   as canon.
2. Review reserved IDs, pronunciation notes, glosses and caption intent in the
   editorial ledger. Keep missing context `UNBOUND` and future language seeds
   experimental.
3. Seek separate recording approval before producing sources. Then audition
   sayability, duration, pronunciation, warning clarity and rapid-order masking;
   this document supplies no paid-production instruction or listening pass.
4. Before import/binding, coordinate actual actor/locale/caption interfaces and
   validated metadata preservation. Existing asset holds and gameplay disclosure
   boundaries remain applicable.
5. Record imported, packaged, identified served-build and ordinary-game
   voice/caption verification separately. Script review or a docs merge establishes
   none of those downstream outcomes.
