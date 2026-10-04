# Ordinary Tiny floor and human default acceptance

[Mode contract](match-mode-contract.md) · [Map tiers](map-size-tiers.md) · [Playable backlog](playable-modes-backlog.md)

Owner: playable-modes runtime task `01a103cc`. The user's160-minimum requirement
supersedes the compact ordinary roster. This slice binds the existing size policy,
Tiny map and versioned Skirmish without changing elimination, economy or authored
timers. Bannerfall remains parked separately at local commit `1c3e6a2510bb1171398f782bea06bbbbdb89e0a4`.

## Player-facing contract

- Fresh normal two-seat Create Room starts Terraced Vale160×160 in `skirmish@1`.
  Four Workers/eight Infantry per side and150 food/250 wood stay unchanged.
  Posts grant bonuses; no center or deadline win is introduced.
- Ordinary selection requires both axes160–256. Only actual shipped maps appear;
  the five tier descriptors do not populate absent larger maps. XL320 stays blocked.
  Existing Woodland/Frontier160 Labs retain their authored Objective Control rules.
- Practice starts Tiny in `authored@1`, with an explicit supported Skirmish choice.
  Compact Labs carry `internalFixture:true, ordinarySelectable:false` and remain
  available through Authored one-human Practice. This preserves Shore Fishing,
  Stone Defense and asset review while their160 replacements are authored.
- Normal map/configuration/publication rejects compact maps before mutation.
  A restored compact canonical map/hash/mode is preserved and displayed disabled
  as `legacyCurrent:true`. Historical shipped-map room metadata is a startup
  fallback when no checkpoint exists. Explicit RTS_MAP roots remain fixture paths.
- Fresh ordinary AI returns an unavailable explanation pending qualifying160-map
  acceptance. Existing AI seed pool, indexed rooms, checkpoints and reset remain
  playable. Status exposes `ordinarySetup.pve` for entry presentation; Skirmish
  still declares PvE unsupported.

## Evidence

The implementation was based on `74d6095e`, then integrated entry219 and main
`9351320d`. Paid Tiny proof used server bytes
`fb65a7f03089ac96718724d0a5850797014e9a59189103966542b5a0644f3071`.
The final direct-Practice alignment used
`575ebe75f3572ea1d452b9026afec776562565014e06a8eb6bbb05dda6aab763`
for ordinary-entry, legacy-mode and elimination proof;
ordinary-entry supervisor bytes were
`52ffd073ca9384bd3914cc08f60fe265ef5fb5adeb74892b96c11c04268197cb`.
The paid run truthfully records its working-tree base, rather than a future merge.

[Ordinary entry receipt](qa-evidence/ordinary-map-floor-2026-10-04/ordinary-entry.json)
proves fresh status/root, actual REST Create Room and two ready humans, atomic compact
selection/publication rejection, exact Woodland Objective timers, actual Shore/
Stone Practice selection, truthful AI rejection, historical checkpointless index
fallback, old AI seeds and canonical cold restart. The
[pregame receipt](qa-evidence/ordinary-map-floor-2026-10-04/pregame.json) includes
both real DOM/socket lobbies, mode changes, ready invalidation, reconnect, reset,
publication and legacy index recovery. The [real menu receipt](qa-evidence/ordinary-map-floor-2026-10-04/menu.json)
also checks actual authenticated HTTP creation, Practice lab selection, explicit
mode choice, strict Resume and110 lazy browser module admissions. The
[full supervisor receipt](qa-evidence/ordinary-map-floor-2026-10-04/supervisor.json)
covers crash/restart, paid queues and room-directory/index recovery. The
[legacy mode receipt](qa-evidence/ordinary-map-floor-2026-10-04/legacy-modes.json)
proves unchanged Objective timers and saved mode authority; the
[elimination receipt](qa-evidence/ordinary-map-floor-2026-10-04/elimination.json)
retains all twelve original defeat/clock edge cases. The
[legacy AI receipt](qa-evidence/ordinary-map-floor-2026-10-04/legacy-ai.json) proves
that a restored seeded opponent still gathers/moves and recovers through rematch.

[Paid Tiny default run](qa-evidence/ordinary-map-floor-2026-10-04/paid-tiny-default.json)
uses actual native player commands. Both sides paid for Stables and Scouts,
deposited resources and completed expansion Town Centers and Houses. Infantry
crossing was49.4–50.1 game-seconds; Worker crossing50.1–50.9, Scout26.5–27.4.
Opening fog packed6,400 bytes per seat with no enemy units disclosed. Actual home
TC attacks, cold seat recovery, rematch and one-human movement passed. Expansion
TC completion was about257 game-seconds. This is a peaceful economy/travel proof,
not competitive balance or a supported-capacity claim.

123 focused registry, size, checkpoint, launch, pregame, entry, DOM and import
checks passed after integration. Browser/Node types, import graph and docs pass.
Regression arenas are now160 while preserving their original world coordinates;
Millrace Sheep is an explicit historical fixture. The schema26 native mode
fixture was contaminated by schema28 herd fields; independent untouched-baseline
reproduction confirmed this. The fixture now omits those later fields, preserving
strict historical admission rather than weakening a migration assertion.

## Delivery and remaining ownership

Entry owner `01a101c4` owns UI labeling/separation and consumption of unavailable
AI status, using the [agreed boundary](https://github.com/lbeezr/thousand-unit-skirmish/pull/200#issuecomment-5975184482).
Railway delivery owner `01a10227-2c6d` coordinates the next staging build. The
runtime owner retains packaging, identified deployment and actual normal
human/Practice acceptance. Production is untouched. Workspace Chromium startup
and staging HTTPS proxy failures remain concrete rendered/deployed blockers;
local protocol/DOM and paid native proof do not establish served browser play.

A separately reproduced fog-restoration defect also blocks Tiny AI acceptance:
off-cadence moving-unit checkpoints use cached visibility, while restore derives
it from current cells. Runtime owns a small follow-up; strict full fog equality
must remain. Fresh AI remains unavailable until that proof and the AI owner's
full Tiny acceptance pass. Do not claim the mode outcome complete at merge.
