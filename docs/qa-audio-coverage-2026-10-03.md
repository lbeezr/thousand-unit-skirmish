# Playable audio coverage and existing-source reuse — 3 October 2026

[Runtime](audio-runtime-packs.md) · [Mac listening recipe](audio-design.md#short-mac-listening-session) · [Regional source catalog](../assets/audio/vaelora-zones-v1/catalog.json)

Audited fork main `8c9a29f`: the 25 shipped map JSON files, current roster and
technology definitions, notice/snapshot routing, shipped manifests and source
provenance. This is a code/source audit, not a listening acceptance or new asset
license verification. Some catalog maps are diagnostics/reviews, not curated
match experiences. Existing source masters, hashes and provenance remain intact.
Latest-main follow-up at `2aea6d1` also inspected the new wall-line order UI.

## Score and ambience coverage

| Maps | Current audible surface | Concrete gap |
| --- | --- | --- |
| Bellweather · Orchard Common and Millrace | Shared Bellweather v2 music + barley/wind bed; synthesized gameplay cues. | River contrast and regional signature are available only for audition. |
| Underbough, Sereward, Ellionar, Veyrholds, Pale Meridian, Siltmouths, Vesperra, Sombral Mere, Ru’Lora fringe and interior | Ten v2 profiles: each has its own music + terrain bed; synthesized gameplay cues. | No discovery/conflict arrangement or automatic environment transition. |
| Fortified Crossing | `rts-feedback-test` v1 selection/orders/lifecycle/wood/food/repair recordings; synthesized music/ambience. | No authored regional score in this technical profile. One map references one pack, so a second regional reference cannot simply be layered onto it. |
| Cinder Ridge, Dense Clash, Forked Vale, Frontier Reach, Frontier Materials, Highland Grove, Meshy Forest Clearing, Open Field, Shore Fishing, Stone Pass, Three Crowns, Woodland Expanse | No map audio reference; synthesized soundtrack and cues. | No authored score/bed assignment. Diagnostic/review maps need not receive a regional identity. Shore Fishing is a useful bounded audition candidate. |

Twelve regional maps cover all ten zones/eleven palettes (Bellweather appears
twice). They use 11 music and 11 terrain originals. All 11 contrast beds and 11
signatures remain in the source/audition library rather than map runtime packs.
The 44-original catalog and four shipped pilot UI ingredients already exist;
no new recording is needed to audition the gaps. Music takes are complete mixes,
not synchronized stems. Their requested 96 BPM/key are briefs, not measured
performance guarantees; current runtime compositions fit each actual duration.

## Event coverage and priorities

| Event | Existing route and privacy | Gap / disposition |
| --- | --- | --- |
| Spearman, Scout, Rider, Siege Engine queue | Authoritative queue notice goes to its issuing player; existing `queue` cue has a two-note acknowledgement and cooldown. | Reproduced silence: the matcher named only Worker/Infantry/Archer. Fixed using registered unit labels. |
| Military Tier II, Military Armor, Mounted Forging, Siege Engineering complete | Team-prefixed authoritative notice; local-team-only classifier. | Reproduced wrong production cue: the matcher named only Infantry Forging/Archer Fletching. Fixed using registered technology labels; reuses the existing rising research triad/caption. |
| All seven unit types ready/death | Local authoritative generations; one representative per cue/snapshot, silent initial/reset/older ticks. Missing fogged rows are not death. | No missing lifecycle route found. Distinct role voices are unproduced candidates. |
| Shore fishing and harvestable sheep | Gather acknowledgement follows applied order token. Actual nearby living local worker execution reports `food`; food variants cover both activities. Depletion uses the existing empty-node cue. | No missing food route found. Fish/sheep identity is not exposed as a distinct audio resource; no animal or splash recording exists in the current UI kit. Keep generic feedback rather than invent an unrelated sound. |
| Mill, palisade and all other buildings | Friendly observed incomplete-to-complete transition emits at most one `building-complete` per reconciliation; initial state is silent. Selection falls back from building type to generic cue. Repair execution is local/nearby. | Generic completion is present. The caller supplies no building type for completion, so type-specific completion clips need a deliberate metadata slice, not an asset-only binding. |
| Palisade line order | New UI already sends a pending `build` event. Authoritative success is `WALL BUILD ORDER`; later segment work is `WALL BUILD SEQUENCE`. | Reproduced missing acknowledgement: audio gate did not recognize the applied wall-line notice. Fixed to return the existing build cue once for its issued token, never once per segment. |
| Discovery/objectives, combat, defeat | Existing reward-team/objective/combat gates and urgent ducking distinguish gameplay events. | No score-state selector; signatures are not assigned. Do not add enemy-position or wildlife-presence audio observers. |

The implemented change affects queue/research classifiers and one applied-order
notice pattern. The existing player
notice handler, order-token gate, lifecycle reducer, visibility/fog filtering,
work cadence, sound limits and playback cancellation remain in control. It adds
no per-unit/per-building sound loop or new game message.

## Bounded reuse and mix plan

Start the Mac comparison at Overall 25%, Effects/Voice 100%, Music 50%, Ambience
40%. These are audition starting points, not accepted loudness targets. If
commands are masked, first lower Music to 25%; record the offending cue and mix.
Current regional music track gain is 0.35 and environment track gain is 0.6,
with two-second entrance and three-second exit fades. Preserve those edits until
a particular seam, entrance or masking issue is heard.

| Next audition | Existing material and arrangement | Acceptance / safe event boundary |
| --- | --- | --- |
| Shore Fishing identity | Compare `siltmouths-music` with `siltmouths-contrast` (quiet tidal laps), then `bellweather-music` with `bellweather-contrast` (river current). Choose one complete music take and one water bed in a local Audio Studio draft. | Prefer the pair that leaves gather/empty-node cues clear. Geography is provisional; do not change the authored map or load both independent music takes as stems. |
| River/woodland ambience variation | Bellweather river contrast or Underbough distant-waterfall contrast replaces its terrain bed for an audition; compare at matched perceived loudness before layering. | A later transition may follow public authored region/camera context, with existing visibility/mute cancellation. It must not track hidden enemy activity. |
| Discovery accent | Audition the matching regional signature once against the existing objective/reward cue. Use the current affected-team event, not a second observer. | Choose replacement or restrained layer only after checking duplicate perception; preserve reward/objective deduplication and caption behavior. |
| Worker/building material | Reuse existing food muted-pluck, wood-token and iron-latch technical trims; retain synthesized building completion/research until a particular edited recording is accepted. | No new sample binding is shipped here. Continuous work stays aggregated at 1.5 seconds; no bleat, splash or hammer is claimed from unrelated source material. |

The catalog records provider, prompts, dates, original files and hashes; shipped
provenance does not contain a new license grant. This slice introduces no new
asset distribution or rights claim. The [existing kit rights note](audio-kit-plan.md#music-rights-boundary)
remains separate from technical playback and creative audition decisions.

## Verification scope

`scripts/audio-roster-notices.test.mjs` first reproduced both roster gaps, then passed
for all seven unit labels and all six technology labels, both local seats,
spectators/opponent research, rejection/planning precedence and unrelated notice
formats. The existing Barracks, mounted and siege production scenarios now
assert recipient queue-notice counts and audio classification using actual
server messages; progression checks the three newer technology messages, and
the siege scenario checks Siege Engineering. Runtime cue/mute/cooldown tests
remain the scheduling evidence. PR evidence records completed runs and exact
scope. The Mac listening session and aggregate project suite are separate;
neither is claimed complete by this audit.
The wall-line fixture checks issued token, planning/failure/reset cancellation,
duplicate success and later-segment silence. Main's actual pending event was
`build`, while the pre-fix applied wall notice returned no event.
