# Zone audio import provenance validation — 1 October 2026

Baseline: fork main `8cdf5285ddb79bc6b9ca9c5e92d40b07b6d43091`.
The [source catalog](../assets/audio/vaelora-zones-v1/catalog.json) validator
checked prompts, node IDs, provider and original hashes but did not check
`model` or `downloadedOn`. Removing either from a cloned source left those
checks true while Audio Studio import rejected `provenance.model` or
`provenance.createdAt`. The [existing import](../src/audio-zones.mjs) supplies
those properties directly from the catalog.

`validate-zone-audio.mjs` now also validates that metadata projection through
the shared `validateAudioPack` contract. Errors name the catalog's `model` or
`downloadedOn` field and preserve Audio Studio's non-empty, 400-character text
limit. No new date/model interpretation, placeholder or provenance is invented.
The catalog, recordings and import/playback runtime are unchanged.

Checks: all 44 existing source records pass without mutation. Contract tests
reject missing, null, empty, whitespace, non-text and overlong values for both
fields, and retain the shared 400-character boundary. The existing coverage,
byte-count and SHA-256 validation still checks all 44 original recordings.
These are metadata/integrity checks, not new browser, listening or creative
acceptance evidence. See [the original source evidence](qa-zone-audio-2026-09-30.md).
