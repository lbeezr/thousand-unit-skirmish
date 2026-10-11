# Remaining roster audio verification — 11 October 2026

Owner: chat `01a12b6b-d181-79b1-97b4-05de79523245`. The user requested the
remaining unit/building listening pass and fixes through staging. The previous
[interaction receipt](qa-interaction-audio-2026-10-11.md) retains their confirmed
Worker selection/Wood Gather and Town Center/Barracks playback, plus two native
game-output recordings. Those confirmations remain accepted.

## Bounded follow-through

Default coverage is eight unit roles and thirteen building types: 85 event
bindings and 119 selected sources. No new building types or generations are
planned. Existing pack READMEs and the
[voice guide](civilization-voice-language-guide.md) retain creative backing.
Write scope is the gated read-only capture observations in Main, owned audio
capture scripts/workflow, focused tests and this evidence. Any discovered
playback defect will be fixed in its owning audio/caller path.

Reuse the ordinary Map Studio import/Save & Play path in a fresh anonymous
staging room with a small fixture. Construct buildings and train units through
paid gameplay; select and issue orders through native browser input. The cloud
runner keeps normal sandboxing, default audio and real authoritative receipts.
Separate bounded roster subsets preserve partial output and explicit missing
keys; a partial run cannot establish full coverage. No debug command or direct
audio-play call may masquerade as an ordinary action. No staging credentials
are copied into the cloud runner.

## Source-content audit

At source `3310f31c`, all 119 selected files match the default v3 manifest
SHA-256 `ac8b054bdd5dcd0865eccea0eefd34b56316d8df58104cdcc065b5ed6e9828cb`.
For source review, the complete takes were decoded to mono PCM and grouped by
role, with one second of silence between takes and no gain/content edits. This
is a source reel, not a recording of the game mixer.

The user explicitly approved uploading the nine reels (13,496,256 bytes) to
their ElevenLabs workspace. [The audit flow](https://elevenlabs.io/app/flows/0bo6lWRxFGH3dvWXjaVQ)
ran Scribe once per reel. The [transcription receipt](qa-evidence/interaction-audio-2026-10-11/roster-source-transcripts.json)
binds all source IDs, reel hashes and provider generation IDs. All **105 voice
takes** match the intended words after punctuation/case normalization. This
covers every selected take, including alternate selection/attack takes and
Worker resource/job distinctions. The fourteen building recordings yielded no
detected speech. No replacement material was required by this check.

The [decoded waveform audit](qa-evidence/interaction-audio-2026-10-11/roster-source-waveforms.json)
also covers all 119 sources. Every source contains nonzero signal, and none has
samples at or above 32,700 in signed 16-bit PCM. Source peaks range from
−14.083 to −0.438 dBFS. Farm and Workshop have the lowest whole-file RMS levels
(−39.205 and −33.901 dBFS); their existing binding gains are 2 and 1.7669.
These sparse sound effects need review in actual game output before changing
their mix. The measurements do not establish perceived loudness or absence of
earlier distortion in the generated material.

The current assistant audio-input tool explicitly reports that it cannot accept
audio input. Transcription and waveform/meter checks therefore do **not** claim
direct listening, recognizable building character or pleasant perceived mix.
Keep those judgments separate from complete native playback coverage. Human
confirmation currently covers only the four meanings identified above.

## Playback evidence

Pending: source-bound staging native output for the remaining roster. The small
read-only observer extension includes all owned living unit/building kinds,
bounded to 128 units / 64 buildings, with finite, visible-canvas projection. Normal
clients expose no such observer. The existing four-Worker observation remains
compatible. Nine focused observer/probe tests and independent review pass.

The [dedicated staging workflow](../.github/workflows/roster-audio-listening.yml)
now plans fourteen independently bounded subsets on flat 160×160, 24-unit
authored maps, framed around a compact central play area using normal camera
controls. This covers all 85 keys: all eight roles' supported commands/paid
Ready cues, all thirteen building selections and Worker jobs, including the
separate ordinary damaged-building Repair setup described below. Planned
coverage is not completed playback evidence. The runner uses no staging credentials and compares seven public runtime
files, the manifest and all 119 source files to the checkout. Deployment SHA
and release digest stay unknown in those public receipts until linked to the
owner's separate served-identity check.

Each validated WebM is persisted before continuing, and only a matching real
sample start plus observed ordinary-action scheduling can satisfy coverage.
Runtime/network errors, incomplete maps, expired bounds and missing output
remain failures. Eleven runner tests and nine existing observer/probe tests
pass. This is capture infrastructure; no new native roster result is claimed
until the cloud run produces it.

### First staging attempt and Repair follow-up

[Run 38160844233](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38160844233)
at `30b253d1` passed normal-sandbox WebGL2 capability and all 119 public audio
hash checks, then failed during ordinary entry after 80.5 seconds with no
recordings. [The retained receipt](qa-evidence/interaction-audio-2026-10-11/roster-first-cloud/qualification.json)
contains three HTTP 502s and canceled room requests during the concurrent
Railway rollout. The capture remained on the original map. Retry after a stable
deployment; no playback result follows from this attempt. Anonymous staging
also returned 401 for its absent optional `/favicon.ico`; the runner now retains
that diagnostic alongside the existing 404 exception. Gameplay errors and
canceled room requests remain fatal. Entry substeps are now recorded separately.

The Repair follow-up expands the plan to fourteen subsets and all 85 keys. A
second ordinary player damages a paid House, stops attacking, and the host's
Worker receives Repair through its visible controls. Acceptance requires the
native cue and increased health of that same previously damaged House. No
health/state injection is used; the guest is disposed within the shared bound.
This remains planned coverage until captured. The separately authenticated
[staging source receipt](qa-evidence/interaction-audio-2026-10-11/roster-staging-9bea9615.json)
verified `9bea9615`, 141 client modules, both audio workers and all 119 recordings
before the next deployment. Its clean release digest remains unavailable.

[Run 38161341341](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38161341341)
used `82174783` against stable staging `96fd31f4`. Worker, Infantry and Skiff
each reached file import and loaded all 85 bindings, then failed Save & Play
with the original map still active. Their [retained reports](qa-evidence/interaction-audio-2026-10-11/roster-second-cloud/unit-worker.json)
contain no interaction recordings. The remaining matrix was canceled after
identifying the common cause: ordinary server publication requires at least
160×160; the 64×64 fixture passed the portable importer but was inadmissible to
an ordinary room. The next fixture uses the existing ordinary floor and keeps
the flat terrain/small army. Canceled room requests also remain visible and
fatal; the next receipt adds fixed request purpose, response status and elapsed
time without retaining private URLs so those failures can be diagnosed. The
[served identity receipt](qa-evidence/interaction-audio-2026-10-11/roster-staging-96fd31f4.json)
separately verifies that deployment and all 119 recordings; it does not claim
a clean release digest or gameplay acceptance.
