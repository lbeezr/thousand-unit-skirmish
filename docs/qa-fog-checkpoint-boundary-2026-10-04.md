# Fog checkpoint boundary correction

[Mode contract](match-mode-contract.md) · [Tiny default acceptance](qa-ordinary-map-floor-2026-10-04.md) · [Playable backlog](playable-modes-backlog.md)

Owner: playable-modes runtime task `01a103cc`. This isolated follow-up is based
on ordinary-floor [PR229](https://github.com/lbeezr/thousand-unit-skirmish/pull/229),
merged at `966dc0a597eb15162b751522d111c7ae854de22f`.

## Defect and correction

Periodic state publication updates visibility every third simulation tick.
Welcome/resume observations and shutdown checkpoints can occur between those
ticks. They previously combined current unit positions with cached visibility;
restore derived visibility from the saved current positions instead. The AI
owner first reported this in a legal Tiny paid recovery case at tick14129.
Independent legal Worker movement on the merged source reproduces38 cells
changing1↔2 at tick1229, with the rest of authority identical.

`roomPayload` and `captureMatchCheckpoint` now ensure visibility is current.
The result is reused for the completed tick and the current geometry coverage
cache. Every completed simulation step invalidates the stamp: forest depletion
can refresh vision before movement later in that step. Successful births also
invalidate it, covering authored reinforcements delivered after scenario
evaluation's periodic vision update. Existing geometry mutations replace the
coverage cache, including paid foundations created between ticks.

This derives the same current sight at both authoritative read boundaries and
restore. It leaves canonical maps, schema28/rules6, capture timers, elimination
and the fresh AI capability gate unchanged. Regular publication retains its
cadence; adjacent seat snapshots reuse the refreshed mask.

## Native proof

The reviewed server SHA256 is
`9ea53ffe41962d906995ac45e3e10257ae0a2924c7cfcd9d1662e2f8b3974f44`.
Nine new regressions pass, using the existing fixed-tick adapter with intact
authoritative command/snapshot/simulation/checkpoint bodies:

- Authored and Skirmish, both seats: actual outgoing/returning Worker orders,
  both off-cadence phases,56 strict comparisons per run for224 total. Both seat
  observations retain full fog, unit, building, queue, bank and rule equality.
- Both seats: an actually paid House foundation changes sight without advancing
  the simulation tick, then restores the entire observation exactly.
- Legal forest gathering earns six wood. At ticks248 and250, another Worker
  crosses a vision cell after the mid-step forest refresh. Both full observations
  restore exactly and earned cargo subsequently deposits.
- Both authored bonus captures deliver real Scouts at tick15, after the regular
  vision update. Wider sight and both full observations restore exactly; schema,
  rules, map/hash and defeat policy stay unchanged.

The shared assertion clears only the already documented transient Worker
presentation receipt; fog and all authority remain strict. All six initial
movement/foundation tests fail against untouched merged966dc0a5. Independent
private controls removing only completed-step invalidation fail both forest
cases; removing only birth invalidation fails the Scout case. These controls
alter disposable source, not gameplay checkpoints or resources.

Existing focused mode/AI/recovery checks pass54 tests, including both canonical
Tiny full matches and exact reset repeats (495 and2676 game-seconds, authored
native identity with configured Skirmish policy). They preserve the AI owner's
stated identity limitation. The seven real ordinary room admission/cold-restart
cases, twelve original elimination edge cases and eight legacy mode cases pass.
Browser/Node type, syntax, documentation and diff checks pass.

Fresh main54b36e0c's opt-in planning experiment was integrated without changing
the15-line fog correction. Integrated server SHA256 is
`a5007bd9b788a62ea9fa7a5631b0ee8a80446136fb423b6492fce365e856b6db`;
the nine fog cases and planning integration checks also pass on those bytes.

[Retained summary](qa-evidence/fog-checkpoint-boundary-2026-10-04/summary.json),
[ordinary room receipt](qa-evidence/fog-checkpoint-boundary-2026-10-04/ordinary-entry.json)
and [elimination receipt](qa-evidence/fog-checkpoint-boundary-2026-10-04/elimination.json)
record the source and scope. Independent source reviews approved the15-line
server change and authored disjoint forest/birth regressions.

## Delivery and remaining ownership

This correction does not establish the AI owner's full paid loss-case acceptance
at the actual configured Skirmish identity. That owner retains qualifying Tiny
games/recovery and capability adoption; fresh AI remains unavailable. The shared
read-boundary proposal is recorded on
[PR200](https://github.com/lbeezr/thousand-unit-skirmish/pull/200#issuecomment-5975378551).

Central staging owner `01a10227-2c6d` coordinates deployment; runtime ownership
continues through identified served match/recovery acceptance. Read-only Railway
inspection at01:26 UTC found deployment `e541d903-178b-47cb-8d1b-4358c93c5a8a`
SUCCESS with source `64cc391e6d9c4164dca7bd45696cf3862fe19729`, which predates
PR229 and this fix. Staging HTTPS still fails this workspace's CONNECT proxy
with403; existing Chromium startup also fails. No bypass or independent
deployment was attempted. Rendered and served acceptance remain incomplete.
