# Medium Skirmish admission

[Map acceptance](qa-riven-escarpment-2026-10-04.md) · [Mode contract](match-mode-contract.md)

Owner: playable-modes runtime task `01a103cc`. Map
[PR262](https://github.com/lbeezr/thousand-unit-skirmish/pull/262) merged at
`c54fb9410c80f6739289393d9c1daa20f1199997`. This receiver adds only reviewed
`veyrholds-riven-escarpment` to the human Skirmish allowlist. Tiny remains the
ordinary default and the only fresh PvE map. Canonical224×224 geometry,
24-unit opening,150 food/250 wood per seat, fog and recovery-aware defeat remain
unchanged; this map already has no victory posts, deadline or scenario events.
No AI policy, server, lobby UI, timer, schema, capacity or grid limit changes.

## Native acceptance

The [paid entry receipt](qa-evidence/medium-skirmish-admission-2026-10-04/paid-entry.json)
was collected on clean integrated source
`c1a8a718f120716b78f1de117f679db8d3291c1b`, containing main `83f4eb1b`.
It uses the real supervisor and room/socket protocol: ordinary Create Room starts
Tiny Skirmish, host selects Medium through `{mapId}` alone, both human seats
Ready/Launch, each pays75 wood for a completed House and deposits real gathered
food. Both seats receive12,544-byte packed fog. Real supervisor stop/start resumes
both existing seat tokens, canonical map/hash and Skirmish; a subsequent host
reset returns to the Medium lobby and original24/150/250 opening. No grants,
position edits, checkpoint injection or alternate start mode are used.

The initial collector awaited the non-pregame reset notice and timed out after
its paid/cold assertions. The corrected collector awaits the actual human
pregame lobby acknowledgement and then the opening state; the complete run
passed on clean `d6943b1b` and was repeated successfully on the integrated source.
This was a harness correction, with no reset runtime change.

The [ordinary-floor receipt](qa-evidence/medium-skirmish-admission-2026-10-04/ordinary-entry.json)
passes eight native cases. The catalog contains seven actual admitted maps,
including actual Medium dimensions; Medium is human Skirmish-compatible and
`pveSupported:false`. Fresh AI remains Tiny-only, and legacy Authored AI seeds,
saved map identity and cold recovery remain unchanged. XL is still unavailable.
The [focused transcript](qa-evidence/medium-skirmish-admission-2026-10-04/focused.txt)
passes33 registry, mode-control, pregame, Medium-map and size-policy tests.
Types and runtime import checks pass. Independent review approved the admission
and corrected reset predicate;74 additional focused review checks passed.

Canonical file SHA256:
`42824ee5b4a4f9ef63df3961c2737ca37d3f71a61937d55860dec830ec38d2eb`.
Saved canonical map hash: `vyrQgkHO-acWKNx_KvMnPBs2nnv_0lyS7HOCNAGsbWE`.
Server SHA256:
`269ba44cda8dc64434af811d06dbcd5ae81f9a1bb2bbf56ac8907c0687af409c`;
supervisor SHA256:
`945db07787319ddd1b80c4813b8d1d5712f8d3f24fc1ddf191936bd17b3b0b24`.

## Delivery and limits

These are native entry, paid development and recovery receipts, not a full battle,
balance, travel-arrival, supported-capacity, AI, rendered or deployed claim.
Canonical map authoring evidence remains in PR262 and its dated map QA.
AI owner `01a10297` retains future Medium paid-loss/fog/full-game qualification;
this receiver intentionally leaves its capability unsupported. The map-only
configuration and exact Tiny-only PvE interface are recorded on
[PR200](https://github.com/lbeezr/thousand-unit-skirmish/pull/200#issuecomment-5976355036).

Runtime retains release inclusion and ordinary match acceptance. Central staging
owner `01a10227-2c6d` coordinates the containing deployment. Parent thread
`01a0f784-c5d7-72e0-82e8-1747b4c840c1` explicitly paused Railway Agent execution
pending relayed user approval; this work does not invoke that route. Source merge
and exact release packing remain authorized. The receiving admission PR records
the final merged source and package separately from the deployed revision.
Identified served human/Practice Medium entry, fog, paid construction/gathering,
cold recovery and rendered map observation remain owned and incomplete.
