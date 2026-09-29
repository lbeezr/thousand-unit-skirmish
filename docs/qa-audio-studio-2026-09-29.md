# Audio Studio acceptance — 29 September 2026

Base: main `8a870f8`, with the completion changes recorded in the accompanying PR.
Local isolated headless Chrome, generated mono 440 Hz WAV, no paid generations.

`node scripts/audio-studio-browser.mjs` exercises the actual Audio Studio UI:
create pack, import a WAV, create a profile, assign Worker gather-wood, arrange
two tracks, preview and stop, and save. It renders a 20-second stereo WAV through
OfflineAudioContext, exports a backup, deletes the local pack, imports the
backup, and compares every one of the 44,144 original bytes. The restored profile
loads through the game audio controller, plays the sampled gather cue and map
music, and reports a missing pack. Reload retains the restored library. An
injected storage failure leaves Save marked unsaved and reports the failure.

Focused library, composer, runtime routing/settings, sampled playback, composition
clock/cancellation, and existing audio policy checks pass. Map persistence checks
retain the audio reference through a server restart. Client import allowlist and
Docker context checks pass. These are automated integration observations, not
human sound-quality, loop-seam listening, or fresh-player recognition evidence.

The first authored sound pack should be auditioned in a Forked Vale match and
run through the ten-trial recognition check with fresh players. Every player
must install the same exported pack in their own browser. The default synthesis
remains usable without it.
