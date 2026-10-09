# Game audio event and asset matrix

[Runtime and pack contract](audio-runtime-packs.md) · [Sound direction](ui-audio-direction.md) · [Current factions/rosters](../src/gameplay-definitions.mjs) · [Source catalogue](../assets/audio/vaelora-zones-v1/catalog.json)

This is the canonical coverage and missing-asset matrix for scalable civilization
audio. Audited main `7df6b204` on 7 October 2026, then updated for the bounded
building-selection slice and Worker Gather context against main `86d66396`.
Warning-output recovery was reproduced against merged main `ac4a09dd`.
It replaces neither the gameplay registry nor the
dated [3 October audit](qa-audio-coverage-2026-10-03.md). “Implemented” below means
source routing/scheduling exists; it does not mean a recording is produced,
creatively accepted, deployed, heard or recognizable.

## Current material and scope

- Gameplay registers one civilization, `frontier`, eight unit kinds and thirteen
  building types. Azure/Ember are ownership colors, not civilizations. Boughward
  has [art direction](art-direction/boughward-roster-v1/README.md); it is not a
  registered gameplay/audio civilization or a reason to distribute new sources.
- There are 31 supported cue names, 23 shipped manifest/profile versions (22
  regional versions and one technical feedback profile), and 44 regional originals:
  eleven each of music, terrain beds, contrast beds and signatures. Only regional
  music/terrain assignments are currently shipped; contrast/signature audition
  availability does not establish default gameplay bindings or listening approval.
- The seven-file pilot contains two music candidates, two horn takes and one each
  of iron latch, muted pluck and wood token. Its manifest says candidate material.
  The existing `rts-feedback-test/worker-actions` technical profile reuses four UI
  originals through 15 bindings. They are technical feedback, not civilization
  voices, animal foley or an approved voice palette. Other shipped profiles have
  no contextual command/selection recordings.
- No role-specific speech, exact-building selection recording, civilization
  override recording, predator warning voice, bleat, splash or farming/construction
  foley is produced/assigned by this slice. Existing originals, hashes, rights notes
  and publication holds remain unchanged. No generation, paid service or credits.

## Civilization contract and fallback

Pack schema v1 gains an optional, sparse `civilizationBindings` object on each
profile. Its keys are stable civilization IDs, with at most 32 civilizations;
each layer uses the existing 128-event/16-variant bounds, source IDs, bus, gain,
trim, caption, priority and cooldown validation. Existing pack/source/metadata
size limits apply. Omitted layers preserve the exact legacy normalized shape.

```json
{
  "bindings": {
    "cue.select": { "bus": "effects", "variants": [{ "sourceId": "existing-common-source" }] }
  },
  "civilizationBindings": {
    "frontier": {
      "building.barracks.select": {
        "bus": "voice", "cooldownMs": 450,
        "variants": [{ "sourceId": "approved-frontier-barracks", "caption": "Barracks ready" }]
      }
    }
  }
}
```

The example is a format illustration; its source IDs must exist in the pack and
are not new assets or a delivered assignment. Resolution is:

1. Resolve the event's `civilizationId`, otherwise the audio instance's ID, otherwise
   current `frontier`. Future gameplay owners must pass the local actor's registered
   civilization; do not infer it from team color, region, enemy appearance or fog.
2. In that civilization's layer, try exact building selection, or Worker food
   Gather's recognized job key before role/action/resource, then role/action,
   then `cue.<name>` (`ready` also tries `cue.complete`). The optional job retains
   `resource: food`; absent/unknown jobs and other roles/cues use the old chain.
3. If no match, repeat that chain in common `bindings`. Unknown IDs and missing
   override events retain common behavior. Own-property lookup prevents inherited
   names such as `constructor` from being treated as civilization layers.
4. If unbound, unavailable pack/profile, missing/invalid source or eligible decode
   failure, use existing synthesis. A configured generic recording intentionally
   wins before synthesis; the technical profile therefore retains its shared tick.

Existing `Math.random` choice avoids an immediate same-source repeat when
alternatives exist; it does not promise deterministic rotation. Cooldowns and voice
priority remain shared within the active profile; changing civilization does not
create a per-unit sound loop or bypass the same-key cooldown. The gate tracks
the resolved event key, shared by civilization overrides and common fallback,
rather than civilization or source identity. The current default
is Frontier and current source packs have no override layer. The API supports a
future mixed-civilization caller; faction selection/state transport and production
of civilization voices are separate work, not claimed here.

## Event matrix

All interface acknowledgements are centered, short and non-positional. They
describe an action or owned disclosed event, not an attacker location or audible
simulation of an unseen object. Selection/order metadata represents one group.
`P0` means urgent warning/outcome, `P1` applied command or lifecycle, `P2` routine
selection, and `P3` nearby work. These are editorial priorities; actual default
sample priority remains urgent 10/other 0, with explicit pack overrides allowed.

| Event / stable key | Actual route and implemented status | Material / remaining gap | Priority, aggregation, spatial/disclosure and cooldown |
| --- | --- | --- | --- |
| `unit.<kind>.select` | Local click, box/group recall and owned roster selection; first representative kind. | Generic synthesis; technical generic pluck. Role voices missing for all eight kinds below. | P2; one/group; own selection; centered; synthesis 90 ms. |
| `unit.<kind>.move`, `.patrol`, `.follow`, `.stop`, `.hold` | Issued token speaks only after matching authoritative applied notice; planning/rejection/duplicate success silent. | Generic synthesis/technical ticks; role acknowledgements missing. | P1; one applied order, not one/unit; local issuing player; move 90 ms, other listed actions 170 ms. |
| `unit.<kind>.attack` | Applied Attack/Attack Building/Attack Move token. | Existing compact synthesized commitment; technical iron contact. Role combat voice missing. | P1; one/group; no claim that a hit landed; 120 ms. |
| `unit.worker.gather.wood` | Applied forest/node Gather order supplies wood context. | Technical wood token or generic gather synthesis; wood voice/foley missing. | P1; one/order; local intent, no hidden forest/enemy observer; 140 ms. |
| `unit.worker.gather.farm` | Matching applied Gather token preserves `gatherJob: farm` plus `resource: food` for an actual owned complete living stocked Farm via `farmHarvestNode`. Authored food IDs do not imply farming. | Context/key implemented; Farm-specific recording remains missing. Existing generic food/role/cue and synthesis remain fallback; the technical food pluck is generic food. | P1; one/order; living owned representative Worker; no new server observer/protocol; gather 140 ms. |
| `unit.worker.gather.sheep-carcass` / requested hunting | Matching applied Gather token preserves `gatherJob: sheep-carcass` plus food only for a current disclosed visible stocked sheep carcass at its actual pose. Live sheep management is herding; no hunting event is introduced. | Carcass context/key implemented; harvest recording and any supported hunting action remain missing. Generic food is not a bleat or hunting voice. | P1; one/order; living owned representative Worker; missing/hidden/stale/live/depleted rows retain coarse food with no job. |
| `unit.worker.gather.fish` / `unit.skiff.gather.food` | Worker applied Gather preserves `gatherJob: fish` plus food from a currently visible authored shore-fish node. A matching `FISHING ORDER` consumes a locally issued Skiff Gather event once, retaining its food resource without Worker job context. | Worker context/key and Skiff applied acknowledgement implemented; fish voice/splash missing. Existing role/cue and synthesis fallback stays. | P1; one/order; local issuing player; no per-fish loop or inferred hidden target; gather 140 ms. |
| `unit.worker.gather.stone` | Authored Stone Gather supplies node type. | Generic synthesis; distinct Stone voice/foley missing. | P1; applied token/local worker; 140 ms. |
| `unit.worker.build`, `.repair` | Applied Build/Resume/Wall Build/Repair token. Wall segments do not each acknowledge. | Generic build/repair synthesis; technical repair latch; building/construction voices missing. | P1; one/order; no premature construction success; 170 ms. |
| `unit.worker.work.wood`, `.food`, `.repair`, `.stone` | Actual execution from living local worker row 14 within 24 world units of camera; resource set aggregates. | Technical three trims when assigned; distinct Stone material and variant-specific Farm/sheep/fish work palette missing. Stone uses existing exact/role/cue binding resolution and generic synthesis when unbound. Richer execution metadata does not automatically become an audio binding. | P3; at most four resources every 1.5 s; legacy/hidden enemy execution silent; task/map/mute/hide/death cancel. |
| `building.<type>.select` | Existing caller passes the authoritative selected building type. This slice preserves it through synthesis and decode failure, with distinct defaults for all thirteen types below. | Exact civilization recordings missing. Configured common generic sample remains a deliberate pack choice. | P2; one selection; own/disclosed building; same 55 ms gesture/90 ms cue cooldown/gain, different type pitches; centered. |
| `unit.<kind>.ready`, `.death` | Local authoritative generation appears alive, or explicit alive-to-dead row; one representative/cue/snapshot. Initial/reset/older tick and fog absence silent. | Generic rise/fall and technical horn/latch; role voices missing. | P1; ready/death 2.2 s; no enemy death inference. |
| `cue.building-complete` | Friendly observed incomplete-to-complete transition; aggregated per reconciliation. | Generic completion. Caller omits building type and binding schema only supports typed selection; typed completion is missing, not an asset-only task. | P1; initial/reset silent; 2.6 s; no queued-build success claim. |
| `cue.queue`, `.research-complete` | Registered unit queue notices and local-team registered technology completion notices. | Existing synthesis; contextual producer/technology voice missing. | P1; issuing/local team only; 170 ms/2.6 s; cancellation is not ready. |
| `cue.rally`, `.send`, `.reject` | Existing local control/applied notice or pending neutral send; rejection stays failure. | Existing synthesis; future civilization gesture palette unproduced. | P1/P2; 550/90/250 ms; no accepted-order claim from send. |
| `cue.battle-alert` / first damage contact | Existing own-unit HP decrease aggregation, including an exploring worker/unit. Attacker identity/cause is not read. A new engagement emits after 9 s without another presentable friendly damage observation. Unavailable output no longer consumes this cadence; fresh damage after restoring output can warn. | Existing attention synthesis; caption “YOUR UNITS TOOK DAMAGE” describes only observed owned-unit HP loss. Contextual unit/worker voice missing; actual hostile-wildlife behavior/hearing remains unverified. | P0; one aggregate snapshot decision; no camera-distance gate or proximity/attacker/allied-unit claim; no hidden enemy count/location/type. |
| `cue.selected-alert` | Existing selected owned units lose HP. | Existing attention synthesis; selected-force voice missing. | P0; shared selected-damage aggregate; policy 12 s, playback 11 s. |
| `cue.base-alert` | Existing owned building HP decreases. Takes precedence over selected/battle alert. | Existing rounded repeated attention synthesis; civilization building-danger voice missing. | P0; one aggregate; policy 12 s, playback 11 s; attacker source/location never exposed. |
| First sight of an enemy / animal-specific attack callout | No dedicated disclosed-first-sight reducer or predator identity event found. Cause-agnostic own HP warning above already works for a reported loss. | Missing specialized event/asset. Do not invent an enemy/wildlife presence observer or claim native animal-attack coverage. | Future P0/P1; only actual local disclosure, not terrain/fog/AI-private state; bounded deduplication required. |
| `cue.resource-empty`, `.base-lost` | Existing local depletion/own producer-destruction notices. | Existing synthesis; civilization notice voice missing. | P0/P1; 8 s/2 s; recipient filtering retained. |
| `cue.objective`, `.objective-lost`, `.scenario-reward` | Existing live objective and affected-team reward events. | Existing synthesis; regional signature originals are audition-only, not assigned. | P0; 1.2/1.2/2.4 s; no opponent-only reward cue. |
| `cue.victory`, `.defeat`, `.draw` | Authoritative match result; existing result card wins over duplicate caption. | Existing synthesized cadences; civilization outcome voices missing. | P0; 5 s; current match/reset/recovery boundaries retained. |

## Warning-output recovery

Warning readiness is a bounded client correction, not a new alert family. On
`ac4a09dd`, an unselected Worker at `(30, -20)` taking disclosed HP loss while
master audio/captions were muted consumed `battle-alert`; continued damage after
unmuting at 10 s scheduled no warning through 20 s. The actual path is Main's
owned HP comparison (independent of camera and selection), `CombatAudioGate`,
`audio.playEvent`, and the synthesis/sample plus enabled-caption consumers.
`audio.canPresentEvent` now reads visibility, captions, master/context readiness
and the selected civilization/common binding bus without unlocking, decoding,
queueing or consuming a sample cooldown. Main also requires visible live browser
feedback. The gate advances only for an eligible warning. Restoring output alone
does not replay damage: the acceptance condition is a warning on a subsequent
fresh disclosed HP loss. Existing first-contact/quiet-gap, selected/base priority,
cooldowns and mute choices remain in force. Caption-enabled muted warnings still
consume the cadence because they have an enabled presentation route.

The registered `scripts/audio-settings.test.mjs` executes the committed Main HP
aggregation and caption consumer with real warning/audio policy and modeled
Web Audio/DOM boundaries. It covers locked/muted/zero-level output, fresh damage
after restoration, enabled captions, hidden/recovering presentation, sparse
civilization bus choice and unchanged warning priority/aggregation. These checks
do not establish audible/native or rendered acceptance. No simulation producer,
attacker metadata, wildlife action, sound asset or voice take changes. Current
sheep lifecycle supplies no hostile-animal attack producer; Boughward's wolf art
is not evidence of a new wildlife action. Listening and cause-specific gameplay
evidence remain open with the audio owner.

## Registered units and proposed exact voice slots

The IDs below come from the current registry, including Skiff; the older audit's
seven-unit count is historical. All selection routes are implemented with common
fallback. No row-specific voice is currently produced or assigned. Slots are
proposals, not commands to generate/distribute audio. Use the same event keys
across civilizations; change sources and pronunciation, not event semantics.

| Kind | Current capabilities / applicable voice slots | Missing Frontier source IDs |
| --- | --- | --- |
| `worker` | select, move, attack, wood/farm/sheep/fish/Stone gather, build, repair, stop/hold/patrol/follow, ready/death | `frontier.worker.<action>-01` through `-03`; contextual actions `gather-wood`, `gather-farm`, `harvest-sheep`, `gather-fish`, `gather-stone` |
| `infantry` | select, move, attack/attack structures, stop/hold/patrol/follow, ready/death | `frontier.infantry.<action>-01` through `-03` |
| `spearman` | same military acknowledgement set | `frontier.spearman.<action>-01` through `-03` |
| `archer` | same military acknowledgement set | `frontier.archer.<action>-01` through `-03` |
| `scout` | same set; first damage uses existing own-unit alert | `frontier.scout.<action>-01` through `-03` |
| `rider` | same military acknowledgement set | `frontier.rider.<action>-01` through `-03` |
| `siege-engine` | same military acknowledgement set; crew voice is a future source decision | `frontier.siege-engine.<action>-01` through `-03` |
| `skiff` | placeholder naval move/gather plus select/lifecycle; no attack capability | `frontier.skiff.select-01..03`, `move-01..03`, `gather-fish-01..03`, `ready-01..03`, `death-01..03` |

Proposed acknowledgement lines describe applied intent: “Chopping wood”,
“Tending the fields”, “Harvesting food”, “Fishing”, “Gathering stone”,
“Building”, “Repairing”, “On my way”, “Moving to attack”. Selection voices can
use “Ready”, “Standing by”, “Yes?” without disclosing anything about the opponent.
Worker “hunting sheep” needs a real supported hunting action before binding that
line. Voice language/character casting, exact duration/variants, rights and creative
approval remain asset-production decisions; no unrelated pilot trim is labeled speech.

## Every building selection and default signature

The single gesture retains the current gain 0.13, duration 55 ms and upward
620→780 contour ratio. The following frequency values produce distinct scheduled
signatures; they do not prove thirteen perceptually recognizable identities.
Pitch separation and masking need actual listening. Town hall is the registered
`town-center`, with the existing `townCenter` alias; no fourteenth building is invented.

| Building ID | Binding key | Default start Hz | Missing exact source IDs (two short variants) |
| --- | --- | --- | --- |
| `town-center` | `building.town-center.select` | 587.33 | `frontier.building.town-center.select-01`, `-02` |
| `barracks` | `building.barracks.select` | 783.99 | `frontier.building.barracks.select-01`, `-02` |
| `watchtower` | `building.watchtower.select` | 880 | `frontier.building.watchtower.select-01`, `-02` |
| `archery-range` | `building.archery-range.select` | 987.77 | `frontier.building.archery-range.select-01`, `-02` |
| `house` | `building.house.select` | 659.25 | `frontier.building.house.select-01`, `-02` |
| `storehouse` | `building.storehouse.select` | 329.63 | `frontier.building.storehouse.select-01`, `-02` |
| `mill` | `building.mill.select` | 493.88 | `frontier.building.mill.select-01`, `-02` |
| `farm` | `building.farm.select` | 523.25 | `frontier.building.farm.select-01`, `-02` |
| `dock` | `building.dock.select` | 698.46 | `frontier.building.dock.select-01`, `-02` |
| `stable` | `building.stable.select` | 440 | `frontier.building.stable.select-01`, `-02` |
| `workshop` | `building.workshop.select` | 392 | `frontier.building.workshop.select-01`, `-02` |
| `palisade-wall` | `building.palisade-wall.select` | 293.66 | `frontier.building.palisade-wall.select-01`, `-02` |
| `palisade-gate` | `building.palisade-gate.select` | 349.23 | `frontier.building.palisade-gate.select-01`, `-02` |

Unknown building types and unit selection retain exactly 620→780. Unknown
civilizations retain common recordings/default synthesis. Candidate civilization
voices must preserve the [existing gesture/attention grammar](ui-audio-direction.md),
not make a different building's selection sound like an attack warning.

## Warning assets, boundaries and next work

Propose two dry, centered takes per actual warning: `frontier.alert.units-under-attack-01..02`,
`frontier.alert.selected-force-under-attack-01..02`, and `frontier.alert.base-under-attack-01..02`.
A neutral “Your units are under attack” remains safe for a cause-agnostic own loss.
Do not say “wolf”, enemy civilization, direction, unit count or location unless
that exact context was already disclosed to the local player. An animal-specific
take remains unassigned until an actual supported/disclosed encounter exists.

Urgent sampled events default to priority 10 and can interrupt routine voice;
nonurgent voice uses a 1.25 s speech gap and binding default 450 ms. The technical
profile uses 900 ms. At most two simultaneous voices/eight samples are retained;
urgent synthesis uses the existing 20-note budget versus 12 routine notes and
ducks the background. Effects/master mute, overall zero, hidden pages, stale
pack/decode generations and disposal remain in force. Return never replays stale
selection/order samples; a fresh eligible event can schedule. Normal synthesized
warnings invoke the decision callback while the page is visible, including muted
or locked output. Eligible sampled warnings invoke it only when captions are
enabled or master audio is disabled; lock or bus mute alone does not guarantee a
callback. Visible warning captions require captions enabled; Main's
`showAudioCaption` otherwise returns immediately. Hidden pages do not queue warning
callbacks for replay.

The preceding building-selection slice owns default delivery and sparse override
validation/resolution. Its backing is the existing short selection gesture and
[sound specification](ui-audio-direction.md#routine-commands); no held source is
published or rebound. The selection HUD owns panel presentation; Main and its
selection/event hooks were unchanged in that slice. Focused tests execute the committed
selection consumer with injected presentation boundaries, all thirteen defaults,
sample precedence/decode failure, unknown fallback, shared cooldown, mute/focus
return and existing warning aggregation. The muted-warning assertion observes
`onCueDecision`, not caption UI. These CPU scheduling/callback checks do not
establish UI rendering, audible playback or recognition.

The audio test-contract owner (this cloud task) retains the bounded same-event
civilization-switch regression, merged in
[PR622](https://github.com/lbeezr/thousand-unit-skirmish/pull/622), in `scripts/audio-building-selection.test.mjs`,
checked against main `8ac6cb3c` on 9 October 2026. Its effects-only
`unit.worker.select` fixture uses distinct Frontier/common sources and a 450 ms
cooldown: Frontier at 1000 ms succeeds, unknown-civilization fallback at 1449
rejects for binding cooldown and at 1450 succeeds; Frontier at 1899 rejects and
at 1900 succeeds. After reset, another Frontier choice at 1900 succeeds. Accepted
choices retain the exact key, binding identity and source and clear the rejection
reason; reset itself makes no rejection-reason promise. This covers the existing
gate contract without changing playback or adding assets. Review and focused
source checks are this owner's delivery evidence; audible recognition and native
listening remain with the audio outcome owner at an identified containing release.

The same test-contract owner retains the cross-event voice-priority regression,
checked against containing main `7cfb34b8` on 9 October 2026 after PR622 merged.
The production gate accepts routine selection at 1000 ms and an urgent base
alert (default priority 10) at 1001. A distinct move binding with explicit
priority 0 or 10 rejects at 1002 and 2250 for speech cooldown, then succeeds at
2251: exactly 1250 ms after the alert. Explicit priority 11 is admitted at 1002
within that window, then rejects at 2251 and succeeds at 2252: its accepted voice
starts the next window. Rejected choices never extend it. Each accepted choice
asserts the exact key, binding identity and source; success clears the rejection
reason. These are existing decision-gate rules, not a new priority design or
proof of audible sample interruption. Runtime, assets and listening acceptance
are unchanged; independent review and focused source checks remain this owner's
delivery evidence.

The Worker context slice changes only `sendTrackedOrder` metadata and the event
key resolver, using its existing Farm/fish/disclosure imports. Main imports and
water-module paths remain unchanged; there is no server producer or protocol
edit. `scripts/audio-execution.test.mjs`, already in the CPU registry, executes
the actual committed caller and fog predicate with the real Farm/wildlife/token
adapters for both seats. It covers distinct jobs, disclosure loss, unknown
context, planning/queued intent, rejection, duplicate success, unsent orders,
civilization/common/food/role/cue fallback and shared speech limits. Existing
recordings/manifests and all 30 proposed voice-guide takes stay unchanged.
This is an engineering context contract; native listening remains open.

The warning-caption correction starts from main `fb0f5126` on 9 October 2026.
It changes only the generic `battle-alert` caption from “BATTLE NEARBY” to
“YOUR UNITS TOOK DAMAGE”: the producer observes disclosed HP decreases for
`unit.team === localTeam`, without establishing proximity or attacker identity.
The existing actual-consumer regression covers both seats with near/far owned
Workers, unchanged HP and opponent-only damage, caption-enabled master mute,
unchanged aggregation and a stationary camera. Warning triggers, sound,
cooldowns and selected/base priority remain unchanged. Existing caption UI is
the presentation backing; CPU DOM/audio boundaries do not establish rendered
or listening acceptance. Retained Town Center role and queue-less destruction
patches remain separate, held outcomes; this correction does not reconstruct them.

The audio owner reconciled the Skiff notice boundary with naval owner thread
`01a101c2-cc88-75bc-a26d-973995694006` on 9 October 2026 at 13:50 UTC:
no active or unpublished naval work touches the applied-notice gate or token
matching; PR260 is merged and the remaining naval candidate changes map coordinates.
The correction starts from main `8485db5d`. `OrderAudioGate` now admits the
existing server `FISHING ORDER · ...` notice only for a pending Skiff Gather
event with the matching locally issued token. It consumes that event once;
planning, unknown tokens, failure/cancellation, reset and duplicate success stay
silent. Worker Gather and other Skiff commands retain their existing routes.
The actual committed caller fixture checks both seats and exact
`{cue: gather, kind: skiff, resource: food, gatherJob: undefined}` metadata, with
Skiff food/role/cue binding fallback and no new Worker job or asset.
Server notices, command metadata, recordings and synthesis remain unchanged.
This is source acknowledgement admission, not proof of fishing execution,
deposited food, audible playback or caption rendering. The audio owner retains
listening and ordinary-game acceptance at an identified containing release;
the parent task retains draft-to-ready/merge transitions.

The Stone execution correction starts from containing main `d91919e3` on
9 October 2026. It adds Stone to the existing row-14 resource set and raises
the work scheduler's bound from three to four, so simultaneous Food, Repair,
Stone and Wood all reach the existing playback route. Locality, liveness,
aggregation, 1.5 s cadence, cancellation, binding fallbacks and the global sample
limit remain unchanged; gameplay, server and economy producers are untouched.
The registered actual-Main CPU fixture covers both seats, mixed resources,
aggregation and enemy/distant/dead/legacy/stopped Stone silence. The existing
playback scenario uses synthetic fixture bytes to exercise four bound samples,
cadence boundaries, task/reset/mute/hide/map/dispose cancellation and unbound
fallback. It does not establish distinct Stone sound or native hearing. Existing
work-feedback treatment backs this bounded routing correction; no new media is
created. The audio owner retains listening and ordinary-game acceptance at an
identified containing release; the parent task retains ready/merge/deployment.

Next asset task: choose/cast/audition the
listed Frontier voice slots, then publish only separately authorized material.
Native audible playback/recognition, identified packaged/served release and future
civilization selection/state integration remain open with the audio owner. Cloud
only; no Mac dependency, paid generation, security change or deployment in this task.
