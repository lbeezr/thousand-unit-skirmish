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
Sequential bounded roster subsets reuse that one owned room and preserve
partial output and explicit missing keys; a partial run cannot establish full coverage. No debug command or direct
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
coverage is not completed playback evidence. The runner uses no staging administration credentials and compares eight public runtime
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


### Capacity and one-room capture follow-through

[Run 38162075786](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38162075786)
used corrected fixture source `63c1fc57` against staging `448f1630`, passed
capability and public source checks, then received HTTP 429 while creating its
room. It never reached the corrected map and recorded zero interactions. The
[failed attempt](qa-evidence/interaction-audio-2026-10-11/roster-third-cloud.json)
and [separate served identity](qa-evidence/interaction-audio-2026-10-11/roster-staging-448f1630.json)
are retained. Staging had eight saved rooms at its eight-room cap; the default
idle lifetime is six hours. Existing rooms cannot safely be attributed to this
attempt and are preserved.

The user explicitly authorized a temporary tenth room slot for audio, following
the HUD task's separate ninth-slot approval, and authorized a coordination
message to that task. HUD run `38162536764` completed before the audio setting
change; HUD leaves its expected nine for this transition. This audio owner must
restore the configured and served cap to eight after the capture no longer
needs ten, without deleting saved rooms. This is a temporary capacity change,
not a new permanent room limit.

The full roster now runs sequentially in one owned room. Each subset retains
its 300-second deadline; native reload preserves the browser's own room session
and resets capture instrumentation, then ordinary Studio import/Save & Play
resets the authored map. No room code or session credential is retained in the
artifacts. Lost entry/context stops the batch; individual cue or browser failures
remain failed evidence even when later subsets can safely continue. Source
hashes are checked around each subset to detect a deployment during the pass.

The room lookup client now consumes its successful finite response body under
the existing ten-second deadline before opening the socket, and rechecks stale
attempt/navigation state afterward. This corrects an abandoned-response path;
previous canceled requests remain failures, and this change alone does not prove
their cause. Seven focused tests cover completion, interrupted bodies, stale
attempts and unchanged 401/404/503 behavior. Longer paid training queues are
observed in progress before recording is armed, retaining the existing
30-second audio arm limit.

PR [#652](https://github.com/lbeezr/thousand-unit-skirmish/pull/652) merged at
`8367e5cc23a73f568dd2a76e664932bf3a3797fe`. Railway deployment
`c08d2b43-30b5-4e43-bd4f-3d07fd5fa669` reached SUCCESS; the separate
[served receipt](qa-evidence/interaction-audio-2026-10-11/roster-staging-8367e5cc.json)
verified that exact source, 141 client modules, both audio workers and all 119
recordings. Its clean release digest is unavailable. The public room service
reported nine saved rooms and the authorized temporary limit of ten.

Full-roster [run 38163794135](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38163794135)
was dispatched on this exact source with `all`, sequentially in one room. It
passed capability, public hashes before/after and browser-error checks, but
stopped during Save & Play after 67.528 seconds with zero recordings. The
[retained report](qa-evidence/interaction-audio-2026-10-11/roster-fourth-cloud.json)
keeps all remaining subsets explicitly not run. Studio retained the original
map, and the final recovery observation showed an open socket and applied state.
The old combined timeout classification cannot distinguish a stalled CDP read,
readiness wait, control wait or publication wait. The initial welcome itself
writes the reconnect message; that text does not prove publication was sent.

The follow-up mirrors actual `sendCommand` readiness: a welcome can already be
publishable before the first animation-frame counter increment. It separates
readiness/control/result stages and CDP/state-wait timeout codes. Join Room also
finishes its finite successful lookup body under a ten-second deadline and
rechecks cancellation before navigating. These are bounded corrections, not
evidence that the remaining playback or exact prior timeout cause is solved.

One POST 201 and three subsequent room lookups in the run's exact time window
shared the cloud browser's source address and user agent and identified one
owned room. No room identifier is retained here. The user explicitly authorized
adding its invitation code as temporary repository Actions secret
`RTS_AUDIO_REVIEW_ROOM` and deleting that secret after the run. The next capture
uses ordinary Join Room and requires the host seat; it must never create a
replacement room when joining fails. All later subsets reuse that same session.
The restore-to-eight deployment `4fa5f604-a62d-4466-9f7c-6a497769ae14`
reached SUCCESS on source `7a0a59938b278b6b911cc12427190dbb2a67843b`.
The public room service then reported `roomLimit: 8` and `roomCount: 10`,
confirming restored capacity while retaining every saved room. The setting
change and served observation both completed; no saved room was deleted.

The retry code passed 79 focused tests, both type-check projects, runtime-import
checks and independent review. It also safely waits for the new document's
observer and records a failed Studio dialog only when its origin/document are
stable and no other modal is open. Such a diagnostic screenshot cannot count
as ordinary gameplay or listening acceptance. The temporary Actions secret
was added with user approval and still needs removal after the retry.

PR [#656](https://github.com/lbeezr/thousand-unit-skirmish/pull/656) merged at
`9e31a840b1af1049039c033e4d1b729f3cfffb83`. The subsequent HUD merge
`978ebb6531b639a8ab48390d0e8ba2435c1fbac1` deployed successfully as Railway
`ec98f461-7b8b-49f8-aeb9-11ef0233b6f2`. Its separate
[served receipt](qa-evidence/interaction-audio-2026-10-11/roster-staging-978ebb65.json)
verifies that source, 141 client modules, both audio workers and all 119
recordings; the clean release digest remains unavailable.

[Run 38165638835](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38165638835)
on that source joined the existing owned room as host, loaded all 85 bindings
and passed browser-error/public-hash checks. It stopped at `open-studio` with
a state-wait timeout after 46.125 seconds, before importing the map or recording
any cue. The [fifth-run receipt](qa-evidence/interaction-audio-2026-10-11/roster-fifth-cloud.json)
keeps all thirteen later subsets not run. Its combined opening stage cannot
identify which control or modal prevented progress. The next runner revision
records the individual menu/control transitions and fixed UI states to resolve
this without inferring an audio failure or changing gameplay speculatively.

Runner-only [run 38166129247](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38166129247)
at `c64353ec` matched the same served runtime, opened Studio and imported the
160-cell map. It failed at `publish-readiness` after 109.694 seconds with the
socket open but recovery still `SYNCING CURRENT STATE`; Studio retained its
disconnect message. The [sixth-run receipt](qa-evidence/interaction-audio-2026-10-11/roster-sixth-cloud.json)
has no recorded cues. Its guarded Studio screenshot was inspected and confirms
the imported map, without claiming gameplay acceptance. Additional frame,
transport-lifecycle and pending-state observations are needed to distinguish
missing refresh delivery from a delayed presentation frame. The normal
publication gate remains enforced.

The [seventh run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38166757436)
at runner source `f66ec36e` reached the same failure on served `978ebb65`.
Its [timing receipt](qa-evidence/interaction-audio-2026-10-11/roster-seventh-cloud.json)
records 74 native frames, a 3,183 ms final frame gap and a 6,166 ms maximum,
with only twelve units. The page remained visible and focused. One socket
closed abnormally (1006), and recovery had applied zero frame updates. These
observations establish a severe frame stall; they do not separately attribute
CPU versus GPU cost or the transport closure. The displayed FPS is not a valid
measurement here because its frame delta is clamped to 0.1 seconds.

The bounded candidate keeps animation-frame scheduling, authoritative state
application, waypoint updates and connection recovery running while Map Studio
is open, then skips the obscured battlefield's animation/render work and all
post-render evidence counters. The editor canvas remains event-driven. Closing
Studio resumes the ordinary presentation path on its next native frame.
The real Main-loop regression consumes a correlated fresh recovery reply while
editing and confirms the closed-dialog path resumes. Validation includes 67
focused tests; staging candidate acceptance is still pending.

Visual backing is the inspected [existing Studio treatment](qa-evidence/interaction-audio-2026-10-11/roster-studio-before.png).
The intended sequence retains this editor and the last battlefield frame behind
its backdrop while editing, then resumes the live battlefield after close.
No assets, style, editor layout or gameplay state change. The next ordinary
open/import/Save & Play run must establish recovery and the returned game frame;
this source change alone does not close the audio goal.
