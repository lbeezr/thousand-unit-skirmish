# Audio and captions

[Documentation index](README.md) · [QA protocol](qa-vertical-slice.md)

## Direction

The [UI sound direction](ui-audio-direction.md) specifies proposed materials,
rhythms and edited durations for all 21 existing cues, with a recorded ElevenLabs
pilot. It is an audition specification; current playback remains as described below.

Audio should confirm commands and distinguish urgent events without becoming
constant noise during a large battle. The default sounds are synthesized with
Web Audio in `src/audio.mjs`. Optional local Audio Studio packs supply contextual
recorded cues and composed map music; no sampled pack is required.

The [reusable audio kit plan](audio-kit-plan.md) proposes the next palette,
ElevenLabs source workflow, cue recipes and modular music. Its prompts are saved
as drafts. Sampled playback and map composition loops are implemented; adaptive
music transitions and the produced sound palette remain future work. See the
[Audio Studio library](audio-library.md), [composer](audio-composer.md), and
[runtime packs](audio-runtime-packs.md).

## Runtime responsibilities

| Module | Responsibility |
| --- | --- |
| `src/audio.mjs` | Synthesis, cue cooldowns, voice limits, ambience, ducking, and saved mix settings. |
| `src/audio-policy.mjs` | Which notices/events produce local cues and how combat alerts are gated. |
| `src/audio-recognition-check.mjs` | Shuffled recognition trials, answers, mix metadata, and optional copy action. |
| `src/main.js` | Gameplay integration, audio controls, and visible critical captions. |

Order cues include selection, move, attack, gather, build, rally, and queue.
Completion, research, rewards, objectives, depletion, battle/base alerts, and
victory/defeat/draw have distinct event roles. Cooldowns and voice budgets prevent
large armies from producing one sound per unit.

Critical captions follow the gameplay cue decision even before audio unlock or
when output is muted/unavailable. The match-result card takes precedence over
a duplicate outcome caption. Captions must not reveal a hidden event or enemy state.

## Settings

Defaults are audio enabled, master volume 0.5, effects level 1, ambience enabled,
ambience level 1, and captions off. Settings persist under `tus-audio-v1`.
The UI distinguishes waiting for audio unlock, muted, silent mix, and unavailable
output. Audition controls use the current mix; critical samples also show their
caption when captions are enabled.

Storage is best effort: denied reads use defaults, and a failed write keeps the
live mix working while a new instance sees the prior durable preferences (or
defaults). A later edit retries saving. Legacy ambience level migrates to music
when no valid music level is stored; legacy ambience mute keeps migrated music
at zero. Explicit zero levels survive reload. Opening audio does not rewrite
preferences; an intentional settings edit saves the full normalized mix.
`node --test scripts/audio-settings.test.mjs` exercises fresh-instance round trips,
migration, malformed JSON, denied storage, failed/recovered writes and disposal.
The 2026-10-03 fixtures reproduced no runtime defect; this coverage adds no
settings behavior change or promise of persistence when browser storage fails.

Transient synthesized cues and music-preview notes stop when their bus is
muted. Master mute, Overall zero, hiding, map replacement and disposal stop all
transient synthesis; returning requires a fresh cue. Nonzero level edits and
independent buses preserve current notes. The [interruption regression receipt](qa-audio-synthesis-cancellation-2026-10-03.md)
records modeled scheduling checks and the remaining exact-build listening step.

## Short Mac listening session

Use Node 24 and Chrome on Mac, from the repo root:

```sh
npm ci
node --test scripts/audio-settings.test.mjs scripts/audio-music-lifecycle.test.mjs scripts/audio-cue-lifecycle.test.mjs scripts/audio-decoded-cache.test.mjs scripts/audio-shared-decode.test.mjs
npm start
```

Open [localhost:4173](http://127.0.0.1:4173), start a disposable solo match and
open Audio settings. Allow about ten minutes; use a comfortable headphone level.

1. Enable audio and Regional ambience. Set Overall volume to 25%, Effects/Voice
   to 100%, Music to 50% and Ambience to 40%. Try a cue, mute audio, then reload.
   Confirm the mute and slider values
   survived; re-enable audio and click once to activate it. Also save Music at
   0%, reload and confirm it stays at zero before restoring 50%.
2. On Bellweather · Millrace, listen briefly, switch tabs for five seconds and
   return. Quickly toggle Enable audio, then Music 0%/50%, then Overall volume
   0%/25%. Listen for one returning music loop, with no doubled entrance or stale
   burst. Change to The Underbough and check that the old regional bed stops.
3. Change to Fortified Crossing for its shipped technical cues. Stop nearby
   workers so the quiet check has no ongoing work sounds. Select a worker and
   issue Move; interrupt with Effects 0% or a tab switch, restore and wait quietly.
   Old acknowledgements should stay stopped. After a second, issue a fresh order
   and expect one acknowledgement. Then compare gathering wood/food: fresh work
   cues every 1.5 seconds are expected. Close the match tab; sound should stop.
   These recordings use Effects, not Voice.
4. Repeat a few orders, then use Refresh decisions in Audio settings to identify
   any silence or repeated acknowledgement. The tests above force delayed-decode,
   Voice, disposal and shared-source races; ordinary listening alone cannot prove
   one decode or the 24 MiB cache bound.
5. Open `/audio-zones.html`. Compare the existing Bellweather and Underbough music
   and landscape beds at similar perceived loudness, then try command cues over
   each. Aim for Bellweather's warmth and Underbough's curious, watchful intimacy,
   with orders still clear. Record one useful mix or masking change; audition
   whole music takes separately because they are not synchronized stems.

Keep a short note: commit, Chrome version, headphones/output, mix, and the action
that caused a repeat, missing cue or seam. This recipe is prepared for Mac;
cloud scheduling tests are not a completed listening session.

## Recognition check

Audio settings offers ten shuffled trials: two each of move, attack, victory,
defeat, and draw. Players answer before the label is revealed and can choose
**Not sure** separately from a confident wrong answer. Results include mix and
caption settings and can be copied explicitly; nothing is sent automatically.

Run with fresh players, captions off and on, and record category results. Change
a cue in response to a specific confusion, then repeat the affected trials.
No automated sound-policy test establishes human recognition.

## Checks and evidence

```sh
node scripts/audio-policy-scenario.mjs
node scripts/audio-recognition-check-scenario.mjs
```

Browser checks should cover pre-unlock, mute, zero output, missing Web Audio,
rapid repeated orders, overlapping alerts, caption density, and ambience seams.
The [historical audio ledger](archive/2026-09/audio-design.md) retains the original
mix decisions, dated checks, cue revisions, and their limits.
