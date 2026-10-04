# Versioned match modes

[Victory audit](victory-modes-audit-2026-10-03.md) · [Mode backlog](playable-modes-backlog.md) · [Configuration](configuration.md)

Owner: playable-modes workstream. This is the shared contract for server, lobby
and AI work. The server supports explicit human Skirmish through room creation
and host configuration. The lobby selector and base-objective AI have separate
owners; source/native checks do not establish ordinary rendered or deployed play.

## Identity and capabilities

`matchModeId` and `matchModeVersion` are top-level fields, separate from the
existing opponent `mode: pvp | pve`. Supply both together, with an exact string ID
and integer version. Missing both means `authored@1`; a partial pair, unknown ID
or unsupported version is an error. Never reinterpret missing legacy fields as
the newest default. Registry descriptors expose `id`, `version`, `label`,
`victoryPolicy`, `aiStrategyId`, `pveSupported`, `selectable` and `defaultMapId`.
Registry `pveSupported:true` means at least one map is supported; optional frozen
`pveMapIds` restricts it. Compatibility and catalog descriptors evaluate the actual
map, so another human-compatible map cannot inherit its preset's AI capability.

| Identity | Map compatibility | Victory / AI contract |
| --- | --- | --- |
| `authored@1` | Any validated authored map; hidden legacy identity | Exact authored capture, hold, deadline or elimination combination. Existing capture-post AI remains the current behavior. |
| `objective-control@1` | Validated maps with at least one marked victory post | Exact authored rules and timers. `aiStrategyId: capture-posts`; existing curated PvE map restrictions still apply. |
| `skirmish@1` | Tiny `veyrholds-terraced-vale` and reviewed Small `veyrholds-threefold-basin`; historical Millrace/Rootways remain compatible for recovery and explicit fixtures | `victoryPolicy: recovery-elimination`, `aiStrategyId: base-elimination`. Human PvP/Practice supported. PvE accepted only on Terraced Vale: `pveSupported:true`, `pveMapIds:['veyrholds-terraced-vale']`; Small and historical Skirmish maps remain unsupported for AI. |
| `bannerfall@1` | Shipped `bannerfall-arena` | Original reinforcement prototype: `victoryPolicy: designated-stronghold`, `aiStrategyId: unsupported`, `pveSupported:false`. Human PvP/Practice only; `defaultMapId` chooses its arena and `fixedArmySize:16` keeps the eight-Infantry opening. [Exact rules](bannerfall-mode.md). |

The hidden identity preserves elimination-only Lab maps and unusual legacy
hybrids without calling them Objective Control. New selectors offer compatible
explicit modes; an existing hidden selection must still be displayed honestly.
Practice remains an independent one-human entry with authored rules by default;
this contract does not globally relabel Lab maps or change their rules.

Fresh normal two-seat room admission (`pregame:true`) defaults explicitly to
Terraced Vale/`skirmish@1`. One-human Practice and plain Map Studio rooms default
explicitly to `authored@1` on Terraced Vale, preserving internal Lab access; the
Practice menu can deliberately choose supported Skirmish. Status and launch use
the same Practice pair. Explicit Objective Control starts Woodland Expanse160
with unchanged authored timers. Registry presets override inherited compact
worker maps for fresh explicit human identities. An explicitly configured
`RTS_MAP` root battlefield remains a historical/internal fixture path; fresh
normal REST entry still uses the new preset.

The ordinary server catalog applies the [160-floor policy](map-size-tiers.md).
Currently restored compact maps stay visible with `selectable:false` and
`legacyCurrent:true`. Practice adds `internalFixture:true` for compact Labs and
allows their explicit selection. Ordinary configure/select/publication rejects
under-160 maps; canonical loading/checkpoint validation remains16–256. Status
adds `ordinarySetup` with the default map/pair, floor, five tier descriptors and
fresh AI availability. `ordinarySetup.pve` exposes `available:true`, the exact
Terraced Vale `mapId`, `supportedMapIds:[Terraced Vale]` and `skirmish@1` pair.
Fresh `{mode:'pve'}` defaults to this explicit pair; explicit Authored/Objective
Control fresh AI requests reject before room allocation. Map seeds remain saved
receipts for this one-map preset; policy seeds still select deterministic AI.
Historical normalized/indexed/direct Authored or omitted identities retain their
exact Millrace/Rootways seed pool. Checkpoint identity/map remain authoritative;
no new default is applied during recovery. [Admission and paid protocol proof](qa-tiny-skirmish-pve-admission-2026-10-04.md)
is separate from identified deployment and actual rendered acceptance.

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

## Runtime protocol

- `POST /api/rooms` launch options add the pair, for example
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
- Lobby, welcome/state and map-change payloads carry the effective pair. State
  and lobby also expose the active `matchMode` descriptor; lobby exposes compatible
  `matchModes`, and each map catalog entry includes its compatible `matchModes`.
  `/health` includes the pair. Mode catalog descriptors let the UI show compatible choices and explain AI
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
  path. Schema 27 stores the explicit pair; exact schema-26/rules-6 snapshots
  without either mode field migrate to `authored@1` after existing content migrations.
  Earlier schema fixtures must actually omit both fields. Rooms-index version 3
  separates initial `launchOptions` from effective worker metadata, including
  post-ready IPC updates after host configuration. Versions 1/2 retain their old
  shapes and reject claimed mode fields. Restored identity is authoritative over a fresh-room default or its initial
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
legacy recovery. Human normal entry uses Tiny Skirmish; AI adoption remains a
separate capability acceptance. [Floor native evidence](qa-ordinary-map-floor-2026-10-04.md)
does not establish rendered or identified staging acceptance.

Current exports in `src/match-modes.mjs`: `normalizeMatchMode(value)`,
`matchModeDefinition(value)`, `assertMatchModeCompatibility(value, map, options)`,
`effectiveMapForMatchMode(map, value)` and `matchModeCatalog(map, options)`.
Compatibility returns an immutable descriptor or throws; projection returns an
independent clone. Catalog includes hidden authored plus compatible/supported
choices. `options` contains existing opponent `mode` and explicit `practice`.
Mode-specific descriptors may expose `defaultMapId` and `fixedArmySize`; consumers
must honor fixed openings rather than offering incompatible Lab army sizes.
The registry, room launch, pregame model, effective simulation map and checkpoint
recovery use this contract. The HTTP allowlist admits the browser-safe registry
for the lobby consumer. The AI policy factory consumes the effective pair on
activation/reset; its accepted Tiny base-target implementation is used by fresh PvE.
Checkpoint migration, launch/metadata and native mode
scenarios are registered in CI. Lobby rendering and mode-aware AI remain separate
consumer work; fresh PvE supports only Tiny Skirmish and saved authored AI rooms remain resumable.
