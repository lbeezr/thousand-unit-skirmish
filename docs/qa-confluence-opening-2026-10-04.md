# Confluence opening correction and saved worlds — 4 October 2026

[Map catalog](maps.md) · [Original arena evidence](qa-confluence-grounds-2026-10-04.md) · [Scale inventory](map-tier-inventory-2026-10-04.md)

Both home berries and timber now sit 8.944272 world units from their home
spawn, satisfying the unchanged nine-unit layout invariant. Fresh games expose
both food and wood before orders. The correction moves exactly four canonical
`z` coordinates. It leaves the terrain, forests, Sheep, Stone, fish, stocks,
stable resource IDs, home/city/expansion/Dock pads, water graph and crossings
unchanged. Worker/Infantry/Scout speeds and simulation cells are unchanged.

| Nodes, both mirrored seats | Previous local row / world z | Corrected local row / world z |
| --- | --- | --- |
| `s0-berries`, `s1-berries` | 86 / 6.5 | 84 / 4.5 |
| `s0-timber`, `s1-timber` | 70 / −9.5 | 76 / −3.5 |

Local column remains 29, reflected to 130 on the other bank; home is local
(21,80). Each resource has a 12-unit cardinal marker route. Both seats still fit
the 30-building audit template. The base route remains 135 units and usable
ground remains 16,754 cells. These source measurements are separate from
rendered usability, human pacing and supported capacity.

## Exact compatibility and reset contract

The [naval owner's shared decision](https://github.com/lbeezr/thousand-unit-skirmish/pull/260#issuecomment-5976826106)
and [independent fixture reruns](https://github.com/lbeezr/thousand-unit-skirmish/pull/260#issuecomment-5976852979)
agree on the four-node delta. The additional
[same-ID lobby boundary](https://github.com/lbeezr/thousand-unit-skirmish/pull/260#issuecomment-5976840739)
retains the embedded definition during a waiting lobby's army-size changes.

| Identity | SHA-256 |
| --- | --- |
| Previous raw canonical file | `12a9b2a71763fde866a02211cc235b38a6574095fab0040ee8582f99bd20acdc` |
| Corrected raw canonical file | `02582970bdaac4caaf2d6ad5c8261b824b32462d08ba9155c2815b12cf0ec9ec` |
| Previous normalized runtime definition (base64url) | `3uGjdX_oWE2AtGuLaem-L7BWf1Or-KMiZtY6sVZLMTI` |
| Corrected normalized runtime definition (base64url) | `aaJfD4u2B3Bga0xkgDjc7J98Y149wZl1Wc-hpzk6HNI` |

The complete checkpoint validator still runs before the shipped-map guard.
The guard accepts only the exact old/new pair: reversing the four positions
in the current normalized definition must recreate the historical hash. Any
extra catalog change or unknown old hash still rejects. There is no checkpoint
migration or implicit stock refill. Saved canonical coordinates/hash, depleted and partial
stocks, banks/cargo, paid buildings, gather and boat routes/queues, exploration,
match identity and session identities stay with the saved world and its re-save.

A legal old House at local (28,77) occupies the corrected timber cell (29,76).
This concrete overlap is why ongoing saves keep their old geometry. Same-ID
map selection and unauthorized guest reset do not upgrade it. A waiting lobby's
duplicate reset remains a no-op. Army-size configuration in that historical
lobby uses its existing embedded definition under the existing lobby reset
behavior. Selecting a different map uses that map's catalog definition.

Fresh games use corrected canonical positions. Explicit host reset of a
running historical Practice or human match adopts them under existing reset
semantics, retaining army size, mode, match and session identities. The human
match returns to its waiting lobby. Both peers receive `mapChange` despite the
same stable map ID: ordinary resource rows omit static coordinates, so a state
update alone cannot update client construction geometry. The general `resetArmy`
function does not adopt new geometry during unrelated army-size controls.

## Repeatable proof and source qualification

The cross-revision CLI creates genuine paid old worlds through public room
creation and ordinary commands. It copies stopped room files unchanged into a
current disposable supervisor. It uses the public session probe to start an
invite worker without a connected peer. Running matches still advance
movement, wildlife and economy under existing behavior. An immediate fixed-tick
witness uses unchanged real authority functions to prove exact restoration before
steps; it then matches the native checkpoint after the same ≤60 elapsed ticks.
No move planning is pending and no new move-order ID is allocated in each
compared interval. Lobby revision/readiness and session expiry/connection
metadata follow existing recovery invalidation/grace semantics and are outside
exact-world equality. This is a bounded witness, not general replay acceptance.
Recovery session files/tokens remain private and are deleted with the fixtures.
Public artifacts contain safe economic/order projections and fog digests only.

```sh
node --test scripts/confluence-opening-compat.test.mjs scripts/confluence-opening-checkpoint.test.mjs scripts/client-rematch-recovery.test.mjs
node scripts/vaelora-map-layout-scenario.mjs --check-only
git worktree add --detach /tmp/confluence-legacy b7db83641be61c480a7b41dc6478feeed57ed690
node scripts/confluence-opening-scenario.mjs --legacy-source=/tmp/confluence-legacy --output=/tmp/confluence-opening-NEW
node scripts/confluence-grounds-scenario.mjs --output=/tmp/confluence-paid-NEW
node scripts/skiff-counterflow-scenario.mjs --output=/tmp/confluence-naval-NEW
node scripts/map-scale-audit.mjs --summary-jsonl
```

Both CLI source checkouts must be clean and remain unchanged throughout a run.
The exact old canonical file is required; do not re-author it or edit a positive
checkpoint fixture. Focused negative tests separately declare malformed saved
states and use the existing fixed-tick adapter's intact validation/restore
bodies. They verify unchanged supplied state and unchanged active world on
checksum, overstock, cargo, route and unknown definition rejection; consistent
rehashed ID/type/stock/coordinate changes reach the shipped-map guard.

| Receipt | Exact clean source / old source | Result and scope |
| --- | --- | --- |
| [Cross-revision paid proof](qa-evidence/confluence-opening-2026-10-04/cross-revision.json.gz) | `be94025984753e4ed608f9bc5a9bfae43ebd9a84` / `b7db83641be61c480a7b41dc6478feeed57ed690` | All 13 phases pass: real paid old worlds, two recoveries/re-save, conservation, old House overlap, cargo/queues/fog, same-ID and guest-reset preservation, both explicit resets/both peer updates, lobby no-ops/configuration and fresh visibility |
| [Unchanged paid arena](qa-evidence/confluence-opening-2026-10-04/paid-arena.json.gz) | `77bb0c1b2d8379b24c18518bea9318047f6be430` | 21 phases pass: naturally paid Farm/Mill/Watchtower/Dock/Skiff, finite food/wood/Stone, Sheep, Worker/Skiff shared fish, exact deposits, sequential crossings, cold recovery/reset and one-human clock/move |
| [Unchanged naval counterflow](qa-evidence/confluence-opening-2026-10-04/naval-counterflow.json) | `77bb0c1b2d8379b24c18518bea9318047f6be430` | All seven phases pass: reciprocal passing, queued intent through cold restart, selected Stop, replacement, positive fish cargo through cold restart and one owned-Dock deposit |
| [Static audit](qa-evidence/confluence-opening-2026-10-04/audit-summary.jsonl.gz) | `766761eb9dd6ba33f82aaea4297ce6e2e64ab004` | 33 source-bound records, including all 32 maps; corrected arena geometry/resources and four-tier admission |
| [Collector timeout](qa-evidence/confluence-opening-2026-10-04/collector-health-timeout.json.gz) | `77bb0c1b2d8379b24c18518bea9318047f6be430` | Failed: health query boots the default worker, not the saved invite; corrected to authenticated public session probe |
| [Collector session-field failure](qa-evidence/confluence-opening-2026-10-04/collector-session-field.json.gz) | `766761eb9dd6ba33f82aaea4297ce6e2e64ab004` | Failed after successful worker restore: collector read absent top-level `sessions`; corrected to `state.seatSessions` |
| [Running-world assumption failure](qa-evidence/confluence-opening-2026-10-04/collector-running-world.json.gz) | `9a5873794549235ee672bbc685f20b25a6a5238a` | Failed: no-peer recovery continues ticks; replaced incorrect pause comparison with an immediate restore and bounded elapsed-tick witness, without runtime changes |
| [Lobby-revision collector failure](qa-evidence/confluence-opening-2026-10-04/collector-lobby-revision.json.gz) | `16e6e54989790128f0b229e76a79cab173417466` | Paid Practice stages pass; human selection fails because a one-seat receipt supplied a stale revision; fixed by requiring both connected teams |

The four earlier collector runs remain failures; they establish no complete
compatibility acceptance. Evidence sources remain their own frozen commits.
Runtime bytes are unchanged across these collector commits. Later collector,
test and documentation changes do not relabel the accepted paid arena or naval
run. Its economy clock measured 406.033 game-seconds across 406.057 wall receipt
seconds (ratio 0.999942), excluding startup/restart/reset. This functional run
is not a capacity benchmark. [Artifact manifest](qa-evidence/confluence-opening-2026-10-04/manifest.json)
seals compressed and decoded bytes; each report retains its own source identity
and relevant input hashes. Focused tests, strict types, import graph and the
unchanged regional layout scenario pass; all 17 maps retain the literal
nine-unit home food/wood assertion.

## Delivery boundary

This bounded source change does not alter ordinary map defaults, other maps,
water runtime, simulation cells/speeds, prices or security. The earlier
[inventory PR273](https://github.com/lbeezr/thousand-unit-skirmish/pull/273)
is merged at `b7db83641be61c480a7b41dc6478feeed57ed690`; its dated failed
opening projection remains historical. Source review/merge and clean release
packing are recorded on this correction's PR with exact identities.

Served staging revision and rendered/browser acceptance remain delivery owner
task `01a10227-2c6d` work. No manual Railway deployment or production promotion
was performed. Native/DOM receipt handlers prove authoritative behavior and
client construction bookkeeping; they do not prove rendered marker appearance,
physical pointer/minimap use, human balance or hosted traffic capacity.
