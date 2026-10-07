# Audio runtime and map packs

Audio Studio packs are installed in each browser's IndexedDB library. Legacy map audio references remain `{ "packId": "…", "profileId": "…" }`: export the pack and give every player its file to import locally. Shipped references add `version` and `sha256` together, and fetch their manifest and originals automatically from the same origin without an import. The map never embeds recordings. The game shows a missing-pack message and continues with synthesized cues if a pack or profile is absent. Browser storage is not a backup, so keep exported pack files.

Map Studio lists installed packs and their profiles. Publishing, saving, downloading, importing, reconnecting, and server restarts retain the map reference. Old maps omit the field and use the built-in synthesized soundtrack. The server validates stable IDs and rejects malformed references.

Bindings resolve from a role, action, and resource (for example `unit.worker.gather.wood`) to a role and action, then `cue.<name>`, then synthesis. Building selection first checks its exact building type. One selected group or issued order makes one decision, regardless of unit count. A profile can assign multiple variants; the resolver avoids an immediate repeat. Its voice cooldown is separate from synthesis, and urgent alerts can take priority. Captions use the binding's caption when present and the existing cue caption rules for fallback.

The [canonical event and asset matrix](audio-event-asset-matrix.md) records every
registered unit/building, contextual order and warning, current versus missing
sources, civilization overrides, fallback, priority, cooldown and disclosure rules.
Profiles may add sparse `civilizationBindings` maps using the same validated
binding format. The audio instance defaults to the current `frontier` civilization;
an event may provide `civilizationId` explicitly. That civilization's exact/role/cue
chain is tried first, then the unchanged common chain, then synthesis. Unknown or
absent overrides use common bindings; a matching generic recorded choice remains
an explicit pack choice. No current manifest gains an override or new recording.
Building selection synthesis now retains the supplied type for all 13 registered
buildings, including after decode failure. Unknown building types and unit
selection keep the original generic gesture. Existing cooldowns, mix, interruption
and disposal apply. Checks: `node --test scripts/audio-building-selection.test.mjs`.

The match decodes local Blobs on demand, limiting each composition to 24 MiB of decoded PCM, keeping a 24 MiB decoded-source cache, and allowing at most eight simultaneous sampled cues. A source over 16 MiB, unsupported codec, invalid trim, or decode failure is reported in the sound panel and falls back to synthesis. Music compositions use the shared Web Audio timeline player; map switches stop prior playback. The master, effects, voice, music, and ambience controls are saved under `tus-audio-v1`. Existing settings migrate with voice at 100% and music from the previous ambience level, with a previously disabled ambience setting keeping music muted.

Profile music waits for a running audio context. Hiding the page, muting music or
the master, setting master volume to zero, switching maps and disposing audio
cancel both pending player-module loads and source decodes. Returning to an
audible visible page starts one fresh loop; overlapping activation callbacks
share the current load. Check: `node --test scripts/audio-music-lifecycle.test.mjs`.
This uses a simulated Web Audio context and proves scheduling/cancellation,
not browser listening, loop quality or human recognition.

Sampled selection/command cues also cancel pending successful or failed decodes
across hide/return, master mute/zero volume and mute/restore of their own effects,
voice or ambience bus. Cancellation suppresses stale samples, synthesized error
fallback and profile captions; muting another bus preserves eligible cues.
Active samples on the interrupted bus stop rather than resume on return. Fresh
interactions use the existing binding/speech cooldowns and schedule once.
Disposal immediately stops samples and synthesized cues/previews, invalidates
pending work and rejects later playback calls while context closure is pending.
Check: `node --test scripts/audio-cue-lifecycle.test.mjs` uses deferred decoder and
close promises plus a fake cooldown clock; it is scheduling evidence, not listening.

Concurrent consumers of one source in the current pack share its Blob read and
decode. Each cue keeps its own playback eligibility: muting voice can cancel a
selection while an effects cue still uses the same result. Failed decodes release
all pending consumers and allow a fresh retry. Map replacement and disposal clear
the cache and invalidate pending results; an old same-ID decode cannot clear or
populate the replacement pack's job. Cache hits refresh LRU order. Decoded PCM is
charged once per retained source within the existing 24 MiB cache bound; active
playback may still hold a buffer after cache eviction, so this is not a total
Web Audio memory ceiling.

On 2026-10-03, the deferred runtime fixture with three eligible same-source cues
measured three Blob reads and three decodes before sharing, then one of each
afterward. All three sample nodes receive the same decoded object, charged once
at 400 bytes in the fixture. Checks:
`node --test scripts/audio-decoded-cache.test.mjs scripts/audio-shared-decode.test.mjs`
cover concurrent consumers, reference release, failure/retry, LRU eviction,
24 MiB boundaries, independent bus cancellation and late pack/disposal completion.
These simulated contexts measure duplicate work and scheduling, not listening
quality or timing speedups. Existing recordings and provenance are unchanged.

Focused checks: `node scripts/audio-runtime-scenario.mjs`, `node scripts/audio-runtime-playback-scenario.mjs`, `node scripts/audio-composition-player-scenario.mjs`, `node scripts/audio-policy-scenario.mjs`, and `node scripts/map-persistence-scenario.mjs`. The persistence check needs permission to bind a local loopback port.

## Client audio helper paths

[PR322](https://github.com/lbeezr/thousand-unit-skirmish/pull/322) establishes the
decoded-source cache implementation in
`src/client/audio/audio-decoded-cache.mjs`; the bounded shipped-byte reader lives
in `src/client/audio/audio-shipped-response.mjs`. Both preserve their earlier
implementation bytes and remain dependency-free client leaves. The old flat
paths forward the same single named exports, so `audio.mjs` and the shipped
loader retain their current imports. Matching cache/reader tests exercise the
canonical implementations and assert legacy binding identity; the existing
100% reader coverage includes the canonical path.

The [architecture migration checkpoint](architecture.md#migration-checkpoints-and-retained-compatibility)
owns later caller migration and shim retirement. The audio boundary owner retains
both shims until tracked and supported external consumers, exact public HTTP
entries, an identified containing release and page reload safety are accounted
for. This source organization milestone preserves cache accounting, reader
failure/cancellation and playback behavior; existing listening acceptance stays
with the audio runtime owner.

## Unit lifecycle bindings

Supported lifecycle keys are `unit.<kind>.ready`, `unit.<kind>.death` and
`unit.worker.repair`; generic fallbacks are `cue.ready`, `cue.death`, and
`cue.repair`. Ready also falls back to existing `cue.complete` recordings.
All roster kinds use the same routing. Wood and food orders retain distinct
`unit.worker.gather.wood` and `unit.worker.gather.food` bindings.

Ready comes from a newly alive local unit generation; death requires an explicit
alive-to-dead local row. Missing enemy rows never mean death. Initial/reconnect,
map/reset and rematch baselines are silent; repeated or older ticks are ignored.
Each snapshot emits at most one representative of each lifecycle cue, and voice
samples are limited to two concurrently within the existing eight-sample budget.
Queue cancellations no longer masquerade as unit-ready sounds. Match defeat is
still separate from unit death. Tracked move/gather/build/repair/Stop/Hold/Patrol/Follow acknowledgements now wait for the authoritative applied `clientOrderToken` notice. Sending produces a neutral synthesized tick; planning is silent and rejected orders do not speak success. No per-unit sound-set overrides were added.

Check: `node scripts/audio-lifecycle-scenario.mjs`.

Stop and Hold Position orders use `unit.<kind>.stop` and `unit.<kind>.hold`,
then `cue.stop`/`cue.hold`, with synthesized stationary confirmation fallback.

Queue acknowledgements use registered unit labels, including Spearman, Scout,
Rider and Siege Engine. All registered local technology completions use
`research-complete` rather than the production-complete cue; opponent research
stays silent. The existing player notice delivery and cue cooldowns are retained.
Palisade lines use the existing build cue once after `WALL BUILD ORDER` applies
to their issued token; planning, failures, repeated notices and later segment
work stay silent.
Check: `node --test scripts/audio-roster-notices.test.mjs` plus the roster-options
and progression scenarios. The [coverage and reuse audit](qa-audio-coverage-2026-10-03.md)
records current map scores, fishing/wildlife/building routes and the next bounded
mix auditions from existing sources.

## Shipped delivery and execution feedback

Map Studio offers the `rts-feedback-test` / `worker-actions` v1 profile as supplied
technical test material. Its manifest hash is listed in `src/audio-shipped-catalog.mjs`;
wood, food and repair use distinct existing UI recordings. These bindings prove the
runtime and are not creative acceptance of worker voices or final work sounds.
Shipped manifests are capped at 2 MiB, sources at 16 MiB and complete transfers at
64 MiB. Status, MIME, exact byte count, SHA-256, profile identity and safe same-origin
paths are checked, with a 30-second total fetch deadline. A two-pack LRU cache stays within 64 MiB; decoded samples retain
the separate 24 MiB bound. Load failures keep synthesized feedback. Local ID-only
references and portable pack export/import remain supported. Room uploads are absent.

Optional unit snapshot row 14 reports actual local wood/food gathering or repair execution,
not travel or an issued task. Fogged enemy execution is withheld. The client selects
living local workers within 24 world units of the camera, aggregates by resource,
and schedules at most three short work decisions every 1.5 seconds. Task changes,
death, reset, disconnect, pack switches, hidden pages and muting stop samples and
invalidate pending decodes. Continuous playback comes from fresh observed snapshots,
so there is no unattended timer or per-worker looping node.

The sound panel's inspector exposes profile bindings, source availability, load
status, active samples/voices/work, retained decoded bytes/sources, pending shared
sources/consumers and the last 24 decisions. Decisions
identify binding/speech cooldowns, muted or locked playback, voice/sample limits,
decode failures and synthesized fallback.

Checks: `node --test scripts/audio-shipped-loader.test.mjs scripts/audio-execution.test.mjs`,
`node scripts/audio-runtime-playback-scenario.mjs`, `node scripts/audio-shipped-serving-scenario.mjs`, and owner-run
`node scripts/audio-shipped-browser.mjs`. The browser check uses two independent
empty browser contexts: each fetches verified content, decodes all three distinct
work bindings and stops them without importing a pack. It proves browser playback
scheduling, not a human listening or discoverability session.

## Ordinary Shore Fishing profile

The normal `shore-fishing` map now references the existing public
`vaelora-siltmouths` / `landscape` v2 profile and its registered manifest hash.
It loads the Siltmouths score and reed-wind **terrain** bed automatically for
both seats; no local Audio Studio import or preview flag is needed. Worker
selection, food orders and other unbound gameplay cues retain synthesis.
The earlier private water comparison used `siltmouths-contrast`, which is not
in this shipped profile. Contrast water and regional signatures remain unbound.

This is a provisional aesthetic assignment, not listening acceptance. Existing
mute, visibility, map-switch and disposal cancellation stays in control.
[Adoption evidence and remaining delivery/listening work](qa-shore-audio-profile-2026-10-03.md)
are owned by the audio lane. Check:
`node scripts/audio-shore-profile-scenario.mjs` (real ordinary-map messages and
HTTP bytes; modeled scheduling, not browser hearing).

## Next bounded audio slice

Run the [short Mac listening session](audio-design.md#short-mac-listening-session)
on the recent music/cue fixes, then choose one reproduced audible issue or one
specific existing-track mix change. Settings persistence/migration/storage-failure
fixtures passed without a runtime defect; the key and defaults are retained.
Prioritize a concrete doubled entrance, stale acknowledgement, loop seam or cue
masking observation, with commit and mix recorded. Use existing originals and
preserve their provenance; no new generation is needed for this listening slice.

## Ranked audio backlog

Audio owner retains these outcomes. A blocked listening dependency pauses only
that action; independently reproduced runtime defects can ship in small PRs.
Source inclusion, scheduling checks and measured levels never close listening.
This queue uses the current guide rather than a second audio roadmap.

| Rank / status | Bounded next action | Write boundary / dependency | Acceptance |
| --- | --- | --- | --- |
| 1 — source delivered; native acceptance blocked | Finish ordinary Shore Fishing profile delivery and cue/mute/loop listening. | [Shore receipt](qa-shore-audio-profile-2026-10-03.md#staging-source-follow-up) only until a specific defect is observed. Needs an authorized native browser/output and authenticated exact-build HTTP path; neither is exposed to this cloud lane. Railway delivery owner supports exact source identification. | Settled source containing PR151; matching manifest/original bytes; actual recorded observations of activation, saved mute/mix, clear food cues, one returning loop, tab/map return and loop boundary. |
| 2 — reproduced; cancellation implemented in this slice | Stop old synthesized acknowledgements and preview notes across mute/return. | `src/audio.mjs`, `scripts/audio-synthesis-lifecycle.test.mjs`, existing audio CI registration and owning guides; no shared gameplay/message interface or new assets. Independent of hearing for the reproduced node-lifecycle fix; native runtime acceptance remains retained. | [Cancellation proof](qa-audio-synthesis-cancellation-2026-10-03.md): old nodes/graph/budgets released, independent buses preserved, one fresh cue and unchanged voice cap; clean package, identified containing deployment, ordinary-game interruption observation. |
| 3 — conditional; await rank 1 observation | Resolve one heard Shore cue-masking or loop-seam issue, if the session reports one. | Existing public Siltmouths profile gain/fade/trim in a new version + hash-bound catalog/map reference only when justified; coordinate any shared runtime hook before editing it. Needs a timestamp, mix and offending cue/seam from actual hearing. | Repeat the same ordinary action and hear the specific problem corrected; preserve original masters/provenance, settings/mute lifecycle and clear orders. No numerical loudness result substitutes for acceptance. |
| 4 — audition-only; dependent on accepted baseline | Audition one existing regional water contrast or signature against the current feedback before deciding on a separate binding. | Public catalog sources only; a small profile/version binding if accepted. Signature uses the existing affected-team event and deduplication gate, with no hidden-state observer. Needs baseline listening and explicit choice of replacement or layer. | Hear one useful distinction without masked commands or duplicate accents, then verify scoped binding/release/deployed ordinary use. Retain or reject the candidate explicitly; no generation or automatic wholesale adoption. |

If rank 2 has shipped and native execution remains unavailable, stop dependent
mix/binding changes and report that recovery need. Reopen implementation only
for a concrete observed/reproduced defect or accepted existing-source choice.
