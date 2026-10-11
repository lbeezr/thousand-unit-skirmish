# Frontier current-roster interaction recordings v1

Owner: chat `01a12b6b-d181-79b1-97b4-05de79523245`, retaining default integration,
release, identified deployment and actual in-game listening. This increment
completes selection and supported-command material for the current eight units
and selection material for the current thirteen buildings, extending the two
earlier [Worker](../frontier-worker-actions-v1/README.md) and
[first interaction](../frontier-feedback-v1/README.md) source slices. Marketplace
and Castle were examples in the user's request and are explicitly out of scope.

## Treatment and sequence

The [Frontier voice guide](../../../docs/civilization-voice-language-guide.md)
backs brief, practical, companionable responses. Cast from the connected provider
inventory: Harry for Infantry, Adam for Spearman, Daniel for Archer, Liam for
Scout, Charlie for Rider, Brian for the Siege Engine crew, Eric for Skiff.
George remains the Worker. Different performers distinguish roles without
declaring a new canonical accent or civilization. Lines acknowledge intent,
never claim a hit, a kill, a sighting, gathered cargo or a completed task.

Selection → one role response; accepted command → its task-specific response,
interrupting selection at priority 1; repeated commands → shared speech limiter.
Ready uses existing authoritative lifecycle events. Skiff supports Select, Move,
Stop, Hold, Fish Gather, Return Cargo and Ready; it has no recorded Attack,
Patrol or Follow binding because those orders are not supported for water units.
Worker Return Cargo uses the same accepted-order receipt and its existing voice.

Building treatment follows the user's request for recognizable activity and the
[Frontier architecture reference](../../../docs/lore/frontier-architecture.md):

| Building | Selection treatment |
| --- | --- |
| Palisade Wall / Gate | Solid timber brace / moving hinge and latch |
| House | Door, hearth and pottery |
| Archery Range | Bow release and straw target |
| Storehouse | Grain sack and wooden crate |
| Mill | Turning wooden gears and grain |
| Farm | Sickle and wheat rustle |
| Dock | Water and mooring rope |
| Watchtower | Lookout steps, timber and pennant |
| Stable | Horse snort, hoof and tack |
| Workshop | Hand hammer and wheel ratchet |

Barracks and Town Center retain the first pack's equipment/hall sounds.
Each selection starts one short activity sound; no continuous building loop,
false alarm, intelligible building speech or music is introduced. Existing mute,
visibility, disposal, map replacement and group-response controls apply.

## Provenance, selection and delivery

The [production plan](production-plan.json) records exact prompts, cast IDs,
node/session/generation identities and the estimate before generation. Four
takes per meaning were requested. Fifteen alternate takes in the first batch
were refused by the provider's queue limit before receiving sessions; the
remaining three or four original takes per meaning are preserved, with no
generation retries. The [catalog](catalog.json) records
provider/model, timestamps, reported price, hashes, decoded mono signal checks,
gains and provisional selection reasons. No voice cloning is used; provider
terms govern generated material and this is not a separate rights certification.

Two takes per unit Select/Attack and one per other new meaning keep the combined
pack inside its existing 128-source budget. Selection checks nonzero decoded
signal, duration and full-scale mono samples, then ranks level/headroom. Gains
target -20 dBFS RMS, limited to 2 and a -3 dBFS decoded mono peak. These checks
do not establish perceived loudness, creative quality or actual in-game hearing.

Run `node assets/audio/frontier-roster-feedback-v1/build-manifest.mjs` to verify
all original hashes, extend preserved `frontier-feedback/v2` into v3 and generate
the exact server admission list. Update the default catalog digest with the
printed hash. All originals remain release inputs; only selected recordings and
the runtime manifest are HTTP-admitted. Catalogs, production plans and comparison
takes remain private. No generation runs during this build.

The [QA receipt](../../../docs/qa-interaction-audio-2026-10-11.md) distinguishes
source/package/serving checks from unfinished publication, containing deployment
and normal-game listening. The existing cloud interaction capture covers the
initial Worker/wood/Barracks/Town Center path; it does not yet prove this full
roster. Death, ongoing work and building completion recordings are separate
future material, outside selection and accepted-command coverage.
