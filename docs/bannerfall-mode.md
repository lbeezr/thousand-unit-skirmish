# Bannerfall v1 prototype

[Mode contract](match-mode-contract.md) · [Playable modes backlog](playable-modes-backlog.md)

Owner: playable-modes workstream. Bannerfall is an original, provisional
reinforcement mode inspired by the requested custom-game pacing. It uses the
existing roster and Town Center presentation. These values are prototype tuning,
not balance acceptance. Ordinary Skirmish and Objective Control defaults are unchanged.

## Player rules

- Choose `bannerfall@1` on the shipped `bannerfall-arena` map. Two humans start
  the ordinary clock; explicit Practice starts with one human. There is no AI support.
  The world meets the 160-cell normal-map floor, with a compact central battle area.
- Each side starts with eight controllable Infantry and its original Town Center.
  That original building is the designated stronghold, with the existing 2,400 HP.
  There are no Workers, starting resources, resource nodes or capture objectives.
- Every 15 seconds, attempt up to two free controllable troops per side near its
  living stronghold. Living troop supply is capped at 12: Infantry costs one,
  Rider costs two. Use existing walkability, occupancy and roster-generation rules.
  Each blocked or capped slot expires; no pending stream builds up. A delayed
  simulation attempts one bounded wave, then schedules the next ordinary interval.
- Six enemy troop kills unlock Rider reinforcements for that side. Only future
  waves change; surviving Infantry keep their identity, health and orders. The
  evolution notice appears once. There are no heroes, abilities or additional tiers.
- Destroying the enemy original Town Center wins even while its troops remain.
  Other buildings cannot replace it. Both strongholds destroyed by the same
  combat tick draw; resolution follows all accumulated structure damage. Losing
  all troops alone does not defeat a living stronghold, which can repopulate.
- Results freeze waves, scoring and the match clock. Host reset retains the
  selected mode and resets strongholds, troops, evolution and wave schedule.

## Determinism and recovery

`src/bannerfall-rules.mjs` owns a version-1 state with the next wave index, two
saturating kill counters and one latest credited generation per unit ID. Combat
passes only a current authoritative positive-HP→zero-HP victim to kill credit;
there is no external death-receipt API. All accumulated hits target the opposite
team, so a multi-attacker lethal tick credits that enemy team once. Recycled IDs
carry fresh generations, including wrap; saved dead bodies never score again.
The ledger is bounded by the existing 2,000-ID roster.

Schema 29 checkpoints require this mode's explicit identity and versioned state.
Other modes omit that state, so their existing snapshots and migrations retain
their behavior. Validate troop kinds, weighted supply, fixed opening, zero
economy, receipt identities, wave schedule and terminal stronghold results before
restore. Invalid state follows the existing byte-preserving rejection path.
Saved identity remains authoritative over fresh launch settings. Server downtime
does not advance the saved simulation clock.

## Entry and consumers

The existing room API accepts
`{mode:'pvp', pregame:true, matchModeId:'bannerfall', matchModeVersion:1}` or
`{mode:'pvp', practice:true, matchModeId:'bannerfall', matchModeVersion:1}`.
Room workers select the registry's `defaultMapId` even when their supervisor has
another default map. A direct server launch without `RTS_MAP` uses that preset too.
A connected host can instead configure the map/mode pair together before launch.
The descriptor exposes `fixedArmySize:16`; the host cannot substitute a large
Lab army. Existing revision/readiness authority still applies.

Welcome/map-change maps contain effective `bannerfall` rules. State includes
`reinforcements` with kill progress, future wave kinds, next wave time, cap and
designated stronghold IDs. The objective brief explains the rules, evolution
uses the normal notice stream, and terminal text names the original Town Center.
The pure helper is admitted to the browser import graph and release packaging.

Lobby selector owner `01a101c4` owns the visible built-in option and fixed-size
control behavior against the shared descriptor. AI is explicitly unsupported;
no bot or ordinary default changes belong to this prototype. Railway delivery
owner `01a10227-2c6d` coordinates its staging build. The mode owner retains
identified deployed human/Practice and rendered acceptance. Source/native proof
does not close those steps; the workspace browser and staging proxy failures
remain recorded in the existing Skirmish QA.

The existing human lobby reaches this mode by selecting Bannerfall Arena, then
Bannerfall, then both Ready controls and Launch. An independent real-socket DOM
probe established that sequence on the earlier schema28 candidate; its pinned
[receipt](qa-evidence/bannerfall-prototype-2026-10-04/dom-entry-schema28.json)
is historical evidence. The normal Practice dialog now offers Bannerfall as a
server-published preset bound to Bannerfall Arena and its exact mode version.
Lobby and running-match controls consume `fixedArmySize`, showing a fixed
16-unit opening. The objective brief describes 15-second waves, kill-based Rider
evolution, and victory by destroying the opposing original Town Center. AI
remains unsupported for this mode. See [game entry](game-entry.md) and
[PR254](https://github.com/lbeezr/thousand-unit-skirmish/pull/254) for the current
menu/lobby source and native DOM/protocol checks; rendered/deployed acceptance
remains open.

## Acceptance

The pure rules cover repeated kill credit, recycled identities and generation
wrap, one evolution, weighted caps, blocked-slot expiry, bounded missed-wave
handling, state validation and simultaneous stronghold outcomes. Registry/room
tests cover compatible human/Practice entry, rejected AI and map choices, paired
host changes and fixed-opening readiness behavior. The native worker scenario
exercises ordinary first waves and combat commands, cap/timer fixtures, saved
evolution, core damage, terminal restart, rematch and one-human Practice.
Actual rendered/deployed play and pacing observations remain separate checks.

Fresh-main integration at `c409771c` retains Small admission and schema29 wildlife
headings; server SHA256 is
`0c0db97f3106ff40e20eb19ede392ff3bf931152bc8df8ad5e1626bdbb1cba5e`.
Ninety focused checks, fifteen [native cases](qa-evidence/bannerfall-prototype-2026-10-04/schema29-native.json)
and three [real API cases](qa-evidence/bannerfall-prototype-2026-10-04/schema29-room-entry.json)
pass, with independent semantic review and type checks. Seven ordinary floor
cases, the actual paid Small/restart scenario and eight legacy Skirmish cases
also pass at that server hash. The floor harness waits for the host's actual
two-seat Ready acknowledgement before comparing atomic rejection state. No
runtime authority assertion was weakened. These receipts preserve historical
source identities; they do not imply deployment, rendered play or balance.
