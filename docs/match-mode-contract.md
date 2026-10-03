# Versioned match modes

[Victory audit](victory-modes-audit-2026-10-03.md) · [Mode backlog](playable-modes-backlog.md) · [Configuration](configuration.md)

Owner: playable-modes workstream. This small source contract is the shared input
for server, lobby and AI work. Its registry/projection checks do not claim that a
new mode is already connected to ordinary gameplay. The next runtime slice owns
that integration and its native/release/ordinary-match acceptance.

## Identity and capabilities

`matchModeId` and `matchModeVersion` are top-level fields, separate from the
existing opponent `mode: pvp | pve`. Supply both together, with an exact string ID
and integer version. Missing both means `authored@1`; a partial pair, unknown ID
or unsupported version is an error. Never reinterpret missing legacy fields as
the newest default. Registry descriptors expose `id`, `version`, `label`,
`victoryPolicy`, `aiStrategyId`, `pveSupported` and `selectable`.

| Identity | Map compatibility | Victory / AI contract |
| --- | --- | --- |
| `authored@1` | Any validated authored map; hidden legacy identity | Exact authored capture, hold, deadline or elimination combination. Existing capture-post AI remains the current behavior. |
| `objective-control@1` | Validated maps with at least one marked victory post | Exact authored rules and timers. `aiStrategyId: capture-posts`; existing curated PvE map restrictions still apply. |
| `skirmish@1` | Initially `bellweather-millrace` and `underbough-rootways` | `victoryPolicy: recovery-elimination`, `aiStrategyId: base-elimination`. Human PvP and explicit solo Practice supported. `pveSupported: false` until mode-specific AI acceptance. |

The hidden identity preserves elimination-only Lab maps and unusual legacy
hybrids without calling them Objective Control. New selectors offer compatible
explicit modes; an existing hidden selection must still be displayed honestly.
Practice remains an independent one-human entry with authored rules by default;
this contract does not globally relabel Lab maps or change their rules.

## Canonical map and effective rules

`effectiveMapForMatchMode(map, identity)` clones the validated canonical map.
Authored/Objective Control retain all its content. Skirmish changes marked
`trigger.victory` to false and removes `victoryHoldSeconds` and `timedVictory`.
Post positions, counts, capture duration/prerequisites, food/wood/unit rewards,
scenario-event hooks and relief supplies remain intact. Capture bonuses must be
described as bonuses; ownership can never pick Skirmish's winner at 900 seconds.
Economy, terrain, opening and canonical map files are unchanged.

The server continues using its existing recovery-aware elimination predicate.
Workers and paid land queues preserve survival; a destroyed Town Center is not
defeat while land units or affordable legal production remain. No resignation,
inactivity draw, new clock behavior or minimum-duration guarantee is added.

## Runtime boundary for the next slice

- `POST /rooms` launch options add the pair, for example
  `{mode:'pvp', pregame:true, matchModeId:'skirmish', matchModeVersion:1}`.
  Validate capability before creating a room. Worker environment keys are
  `RTS_MATCH_MODE_ID` and `RTS_MATCH_MODE_VERSION`; absent both preserves legacy
  launch behavior. The existing `RTS_GAME_MODE` and Practice/PvE seed keys retain
  their meanings.
- `configureLobby` adds the pair to its existing `revision`, optional `mapId`
  and optional `armySize`. Validate the entire proposed map/mode tuple before
  mutation. Only the connected host can configure; an accepted change increments
  the existing revision, clears readiness and rebuilds the waiting setup. Unknown,
  stale, unsupported or incompatible requests leave current settings unchanged.
  Configuration during a running match is rejected.
- Lobby, welcome/state and map-change payloads carry the effective pair.
  Mode catalog descriptors let the UI show compatible choices and explain AI
  limitations. Lobby UI owns rendering/options; it does not rewrite victory
  flags or choose a policy from a label. AI reads the identity and the registry's
  `aiStrategyId`; it must not infer a base objective from a cleared post array.
- Map switching/publication must reject an incompatible active mode before
  changing the map. A host may choose a compatible mode/map together in the lobby.
  Reset preserves the selected identity; it clears victory state/readiness using
  the existing reset boundary. No running-match mode switch.
- Persist the pair with the canonical map definition/hash and simulation state.
  Derive effective rules from that saved version on restore. A new schema/rules
  migration must preserve legacy authored snapshots, including hybrid deadlines,
  elapsed clocks, owners, holds and terminal results. Old snapshots cannot claim
  new mode fields. Unknown versions use the existing checkpoint-retention error
  path. Restored identity is authoritative over a fresh-room default or its initial
  launch configuration; supervisor metadata must describe the effective identity.

The mode owner retains registry, simulation/checkpoint and native protocol
integration. Lobby/entry ownership and base-objective AI ownership must be assigned
through the parent before overlapping their files. Neither HUD nor AI work needs
to alter the canonical maps or the server's elimination predicate.

## Source acceptance

Pure contract tests use real Millrace/Rootways definitions, prove bonuses/events
and originals remain intact, preserve authored elimination-plus-deadline, and
reject invalid identities, incompatible maps and unsupported PvE. Runtime
acceptance additionally needs both-seat lobby/readiness, capture without victory,
post-deadline survival, recoverable production/defeat, reset/restart and exact
legacy recovery. The ordinary default remains authored until AI, entry/map support
and actual play establish Skirmish readiness.

Current exports in `src/match-modes.mjs`: `normalizeMatchMode(value)`,
`matchModeDefinition(value)`, `assertMatchModeCompatibility(value, map, options)`,
`effectiveMapForMatchMode(map, value)` and `matchModeCatalog(map, options)`.
Compatibility returns an immutable descriptor or throws; projection returns an
independent clone. Catalog includes hidden authored plus compatible/supported
choices. `options` contains existing opponent `mode` and explicit `practice`.
The twelve pure tests and syntax/doc checks pass; the suite is registered in CI.
This module is not yet used by room launch, server simulation, HUD or AI.
