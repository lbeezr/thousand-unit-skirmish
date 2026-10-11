# Frontier interaction recordings v1

First playable increment for the user's 11 October request: villagers speak on
selection and acknowledge woodcutting; buildings have recognizable material or
activity sounds. Owner: chat `01a12b6b-d181-79b1-97b4-05de79523245` (Add unit and
building audio), retaining the full roster through deployed ordinary-game listening.

## Treatment and sources

The [Frontier voice direction](../../../docs/civilization-voice-language-guide.md)
backs the Worker lines **“What needs doing?”** and **“I'll cut wood.”** George's
warm male delivery was selected from the connected ElevenLabs voice inventory as
a first performance. It establishes no new canonical accent or civilization.
Barracks uses shield-rack equipment; Town Center uses indistinct hall activity,
following the user's request for characteristic building sounds. These are
provisional runtime selections, not a claim of creative listening approval.

Sequence: select Worker → selection line; issue Wood Gather → only the matching
applied order starts the wood line, replacing selection speech; rejected/planned
orders stay on the existing policy. Select Barracks/Town Center → one brief
building sound. Master/bus mute, hidden page, disposal and map replacement cancel
samples. No per-worker chorus or continuous building loop is introduced.

[Production flow](https://elevenlabs.io/app/flows/A9YBw84WvbCnv9m4GunT) contains
four takes of each of four meanings. [Catalog](catalog.json) preserves all sixteen
originals, exact prompts, provider models, voice/generation IDs, timestamps,
reported prices, hashes, provisional gains and selection reasons. The voice
model is `eleven_multilingual_v2`; effects use `eleven_text_to_sound_v2`, two
seconds, prompt influence 0.3, no loop. No voice cloning or music generation.
Provider terms govern generated material; no separate ownership or commercial
rights certification is asserted by this source record.

Eleven takes are assigned: eight Worker lines, Barracks take 4, Town Center takes
1 and 4. The others remain unbound comparisons, excluded from HTTP admission.
All originals stay byte-identical. Offline 44.1 kHz mono PCM checks excluded
Barracks takes 1/3 for full-scale decoded samples, and the quieter/redundant
comparisons. Recorded gains target -20 dBFS RMS subject to a -3 dBFS decoded-peak
ceiling and gain ≤2. This is a signal check, not perceived-loudness acceptance.

## Rebuild and delivery

Run `node assets/audio/frontier-feedback-v1/build-manifest.mjs`. It verifies each
original hash and rebuilds `assets/audio/runtime/frontier-feedback/v1/manifest.json`.
Update `DEFAULT_GAME_AUDIO_REFERENCE` in `src/audio-shipped-catalog.mjs` with its
printed digest before release. The original recordings are Docker/release inputs;
only selected filenames and the runtime manifest have public HTTP admission.

Main supplies this default independently of map music. Exact map event bindings
can override it; generic map cues retain exact default Worker/building responses.
Namespaces prevent a map source with the same ID from replacing a default file.
If either pack fails, the other still works, with synthesis for unbound events.

## Remaining outcome

This increment covers two Worker meanings and two buildings. Other Worker tasks,
the other seven units and eleven buildings remain missing in this first slice.
The user clarified that Marketplace/Castle were examples, outside this goal. The
ordinary-game and deployment receipt lives in the
[audio event matrix](../../../docs/audio-event-asset-matrix.md#interaction-delivery-owner--11-october-2026).
