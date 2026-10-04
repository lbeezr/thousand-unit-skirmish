# Tiny Skirmish fresh AI admission

[Mode contract](match-mode-contract.md) · [Playable backlog](playable-modes-backlog.md)

Owner: playable-modes runtime task `01a103cc`. The parent authorized this narrow
admission after [AI231 strict cold restore/full replay](qa-pve-fog-restart-phase-2026-10-04.md)
and [runtime233 immediate fog reads](qa-fog-checkpoint-boundary-2026-10-04.md).
Those dated AI receipts remain unchanged. This slice changes configuration and
capability only; AI policy, terrain, economy, defeat predicates and schema29/rules6
remain unchanged. Source base is `be656c47`, integrated with Bannerfall245 and
Worker-art244 through `384ac60c` before final checks.

## Exact admission and recovery boundary

- Normal Play vs AI already posts `{mode:'pve'}`. Fresh admission supplies explicit
  `skirmish@1` and selects canonical Terraced Vale160, independent of map seed or
  an inherited supervisor map. It retains both seeds; the policy seed still
  configures deterministic AI. No UI or policy source changes are required.
- Registry `pveSupported:true` means at least one map; frozen `pveMapIds` restricts
  Skirmish to Terraced Vale. Compatibility and catalog descriptors check the
  actual map. Small/Millrace/Rootways Skirmish still reject AI. Status exposes
  `available:true`, the map/pair and one-entry `supportedMapIds`.
- Explicit Authored/Objective Control fresh AI requests reject before allocation
  or seed generation. Their normalized/indexed/direct fixtures and omitted
  historical identities retain the exact old seed pool. Saved mode, canonical
  map/hash, banks, queues and clocks keep the existing recovery boundary.
- Ordinary human defaults, Authored Practice/Labs and explicit Bannerfall remain
  unchanged. Bannerfall AI remains unavailable. No compact-map fresh AI path
  or additional Skirmish map acceptance is introduced.

## Focused evidence

`tiny-skirmish-pve-entry-scenario.mjs` uses the real supervisor/REST/WebSocket
entry, with a Small map inherited by the supervisor. Fresh AI opens Tiny Skirmish;
the bot reserves Ember, the clock starts normally, and bonus posts have no
hold/deadline victory. Rejected identities/maps/versions allocate no room.
The human spends the real 75 wood on a House, completes it, and deposits gathered
food. A real supervisor/worker process restart reclaims the saved seat, paid
building, map/pair and seeds. Reset restores the ordinary 24-unit/150-food/
250-wood opening and keeps Skirmish. No grants or checkpoint edits are used.

`pve-room-launch-scenario.mjs` also creates fresh Tiny AI and separately resumes
the historical seeded Authored room; old AI opening and generation-aware rematch
remain exercised. `game-menu-scenario.mjs` clicks the actual New Game control
through authenticated HTTP and confirms native Tiny Skirmish entry without
loading the renderer. Ordinary floor tests retain historical recovery and Labs.

The [paid cold-recovery receipt](qa-evidence/tiny-skirmish-pve-admission-2026-10-04/paid-entry.json)
identifies the actual tested server/supervisor hashes. Unit tests retain exact
legacy seed mapping across uint32 extremes and map-specific catalog rejection.

## Delivery still owned

These checks establish source/native protocol admission and paid cold recovery.
The existing AI231 proof separately establishes exact configured full games and
paid loss recovery. Neither establishes rendered pacing, fairness, fun or capacity.
Runtime retains integration and packaging; staging execution owner
`01a10227-2c6d` coordinates deployment, and entry owner `01a101c4`
owns labels/presentation. Actual human/AI play on an identified deployed revision
remains incomplete and owned by the mode implementation workstream.

Independent review also identified a dormant presentation-helper edge: without
an actual map, `matchModePresentation` rehydrates registry descriptors and can
discard a supplied map-specific `pveSupported:false`. Actual-map compatibility
still withholds Small/legacy choices, and fresh AI has no configurable lobby.
The [parent's consumer-boundary receipt](https://github.com/lbeezr/thousand-unit-skirmish/pull/200#issuecomment-5975700480)
routed supplied-capability preservation to entry owner `01a101c4`;
this admission slice makes no UI source change or claim that the edge is fixed.
