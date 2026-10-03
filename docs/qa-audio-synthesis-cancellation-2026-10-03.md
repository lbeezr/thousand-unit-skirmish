# Synthesized cue interruption — 2026-10-03

Audio owner retains this correctness fix through release, relevant deployment
and ordinary in-game mute/return observation. No source asset or map reference
changes; Shore Fishing continues to use its provisional public regional profile.

## Reproduced behavior and fix

At main `14590fb`, sampled cues are cancelled when their bus is muted, while
synthesized tones and filtered noise survive a brief mute. Future notes in the
music preview likewise remain scheduled. A fast return can therefore expose
the old cue/preview again. Hiding and returning or replacing a map also leaves
those transient synthesis nodes alive. This was reproduced with modeled Web
Audio nodes, not reported as an audible browser observation.

The runtime now remembers each synthesis node's destination. Effects mute
cancels only Effects notes/transients; Music mute cancels synthesized music and
its preview. Master mute, Overall zero, hiding, map replacement and disposal
cancel all transient synthesis. A nonzero volume edit preserves current notes;
Voice/Regional ambience controls remain independent. The continuous synthesized
wind bed and recorded composition players retain their existing controls.

Cancellation detaches `onended`, stops the node, and releases its connections
and budget immediately. This prevents a fast return from retaining stale notes
or waiting for old end events before a fresh cue can fit the voice limit.

## Exact check scope

`node --test scripts/audio-synthesis-lifecycle.test.mjs` reproduced six failed
interruption cases and the failed repeated-cancellation case before the fix;
the nonzero-edit case already passed. After the fix, all nine tests pass
(eight cases plus their parent). They check two attack tones and two noise
transients, future preview notes, independent bus preservation, one fresh cue,
24 repeated cancellations and the unchanged twelve-tone cap. This suite is
registered with the existing audio CI group. Registered audio/supporting and
clean-package receipts are recorded on the integrating PR; no aggregate-suite
or perceptual listening pass is claimed.

## Retained acceptance

The [Shore profile receipt](qa-shore-audio-profile-2026-10-03.md#staging-source-follow-up)
identifies staging source `32f11d5`, which includes the profile but predates this
runtime fix. Audio owner must identify a settled source containing the fix,
verify exact served runtime/asset bytes, then observe ordinary Shore Fishing:
activate once, issue a cue, mute Effects and restore quickly, and confirm the
old cue stays stopped while a fresh cue works. Also interrupt the music preview,
mute Overall, switch tabs, change maps, reload saved mix settings and listen
through a full recorded loop boundary. Record revision, browser/output, mix and
actual observations. The cloud browser sandbox and network proxy block that
path here; no playback/hearing substitute is claimed.

This item is retained in the [ranked audio backlog](audio-runtime-packs.md#ranked-audio-backlog).
