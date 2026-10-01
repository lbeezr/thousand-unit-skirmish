# Shipped audio cache accounting — 1 October 2026

On fork baseline `017dede2dca19b9557de543aa8fced0b45e7c9fc`, simultaneous
loads of one uncached shipped reference each verify their manifest and sources,
then replace the same cache entry. The second replacement charged the bytes
again without removing the first charge. The real `rts-feedback-test/v1` pack
left one retained entry of 207,909 bytes but reported 415,818 cached bytes.

The loader now removes an existing same-key charge before normal LRU eviction
and insertion. Each completion still performs its independent transfer and
verification and returns its loaded pack. Hash, MIME, source size/path, profile,
timeout, two-pack and 64 MiB contracts retain their existing behavior.
Recordings, manifests, references, playback and creative direction are unchanged.

```sh
node --test scripts/audio-shipped-loader.test.mjs
node scripts/audio-shipped-serving-scenario.mjs
node scripts/audio-runtime-playback-scenario.mjs
```

Four deterministic regressions cover concurrent success, failed loads followed
by concurrent retries, a late failed peer after successful verification, and
completion among other retained packs followed by eviction. Three regressions
failed on the original implementation; all seven loader tests pass with the fix.
Promise barriers control delayed completion without timing guesses. These checks
establish correct retained-entry byte accounting and LRU behavior; they do not
measure browser process memory or claim a measured memory reduction.
