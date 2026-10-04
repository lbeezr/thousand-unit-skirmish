# Gameplay commands and observations

[Documentation index](README.md) · [Architecture](architecture.md)

## Seat authority

The server assigns Team 0 (Azure/host), Team 1 (Ember), or `null` (spectator) in
`welcome.player.team`. Resume retains the assigned seat. A command never supplies
its own team or a substitute peer object.

All orders enter the ordinary authoritative command path. The server checks
ownership, unit generations, resources, capacity, visibility, reachability,
prerequisites, and limits. An internal opponent requires a server-created seat
capability. An external adapter takes its seat from `welcome`; a resume token
is for reconnect only and must not enter policy input or logs.

## Ordinary commands

| `type` | Arguments |
| --- | --- |
| `move`, `attackMove` | `ids`, `x`, `z`; optional aligned `unitGenerations`, `formation` (`box`, `line`, `column`), `queue: true`. |
| `attack` | `ids`, `targetId`; optional `unitGenerations`, `targetGeneration`. |
| `attackBuilding` | `ids`, `buildingId`; optional `unitGenerations`. |
| `gather` | `ids` and either `nodeId` or `forestCell`; optional `unitGenerations`. |
| `build` | New: `ids`, `buildingType` (`barracks`, `archery-range`), `x`, `z`. Resume: `ids`, `buildingId`. Optional `unitGenerations`. |
| `train`, `trainArcher` | `buildingId`. |
| `trainUnit` | `buildingId`, `kind` from the building definition’s products. Costs and training time are authoritative. |
| `trainWorker` | No extra arguments. |
| `researchUpgrade` | `buildingId`, `upgrade` (`infantry-attack`, `archer-attack`). |
| `setRallyPoint` | `buildingId`, `x`, `z`; or `clear: true`. |

Map publication/selection, army size, and reset are host controls rather than bot
strategy. `clientOrderToken` is a positive integer for correlated notice/order
feedback. A notice alone is not a complete state-result API; reconcile subsequent
authoritative snapshots.

Forest cells use `row * map.width + column`; they are not resource-node IDs.
The PvE v1 observation below does not expose the forest stock table, so adding
forest strategy requires an explicit observation change.

## Terrain boundaries during movement

The authoritative simulation checks actual movement after crowd separation,
including stationary working/striking separation. `src/unit-movement.mjs` applies
the planner's one-level elevation limit and requires both side cells of a diagonal
crossing to be walkable with legal elevation edges. An illegal crowd deflection
falls back toward the current route waypoint. If both steps are rejected, or a
waypoint becomes blocked, the existing bounded route-repair queue rebuilds from
the actual cell; combat pursuit requests its normal replanning instead. This rule
concerns simulation
positions; renderer headings and interpolation consume the resulting snapshots.

## PvE observation v1

`toOpponentObservation` in `src/pve-opponent.mjs` builds an allow-listed DTO from
the assigned seat's filtered state. The deterministic policy runs at most once
per second. Snapshots can be coalesced; consumers must tolerate skipped ticks.

Exact top-level fields:

```text
schemaVersion, team, tick, map, fogOfWar, visibility, resources, population,
units, buildings, workerProduction, research, resourceNodes, objectives
```

| Field | Boundary |
| --- | --- |
| `schemaVersion` | `1`. |
| `population` | Own team’s used, reserved, capacity and available population; `null` for older observations. No enemy capacity is projected. |
| `team` | Server-assigned seat. |
| `map` | Only `id`, `width`, `height`. |
| `units`, `buildings` | `friendly` and `visibleEnemies`; never hidden opponents. |
| `resources` | Own food/wood only. |
| `workerProduction`, `research` | Own-team projection only. |
| `resourceNodes` | Currently visible state IDs/type/stock, with coordinates looked up only for those IDs and visibility rechecked. |
| `objectives` | Public ID, zone, owner, victory, and prerequisite-owner fields; visible-unit counts and conditionally visible progress. |

The integer policy seed is separate configuration, not a DTO field or team selector.
The adapter may inspect static resource `{id,x,z}` only for visible IDs and
objective `{id,zone}` for public locations/visibility checks. It never forwards
the raw map, welcome, map-change, catalog, checkpoint, or spectator/global payload.

Exclude opponent economy/research/production, hidden entities/resources, session
tokens, connection/roster totals, spawns, raw terrain, trigger rewards/conditions,
scenario prose/events, match clock, `scenarioClockStarted`, and winner. The v1
DTO also omits global victory-hold state even though the human HUD can show it.

## Objective visibility

Objective locations, ownership, and prerequisite owners are public. Counts include
only own units and individually visible enemies, so `[0,0]` does not rule out
hidden occupancy. Capture `progressTeam`/`progress` is visible only when the whole
zone is visible. Human snapshots use `-1`/`0` sentinels; the PvE DTO omits those
progress fields until visible.

Human victory-hold progress is public because it depends on public ownership and
the scenario clock. Map-wide event completion and capture attribution from public
sources are public. A future hidden event source must not expose private attribution.

## State consumed by rendering

| State | Meaning |
| --- | --- |
| Unit row `[id, team, x, z, hp, kind, cargo, cargoType, generation, task, focusedBy, ...]` | Task intent is `gathering`, `returning`, `building`, `attacking`, or null; derive idle/movement from positions. Generations distinguish reused slots. |
| Optional tail `[lastAttackTick, lastAttackX, lastAttackZ]` | Deduplicated recent attack event. Fog can null enemy target coordinates. |
| Optional unit row index `15`, `workHeading` | World yaw toward the resource/forest target during actual gathering; shore fish uses its canonical derived water visual while land gather authority stays unchanged. Zero points along +Z. Omitted during travel, return, idle, death, or overlapping targets. Enemy work remains withheld under fog. Index `14` retains its existing work-audio execution value. |
| Optional unit row index `16`, `workResourceVariant` | `shore-fish` only during active own/shared Worker gathering at that variant; omitted otherwise. Cosmetic `gather-fish` selection, never cargo, timing or navigation authority. Legacy/absent/unknown values clear on receipt. |
| Building `progress`, `complete`, `hp`, `maxHp`, `attackers`, `queue`, `trainingRemaining`, `trainingProgress`, `productionBlocked`, `rallyCell` | Construction, damage, and production. Enemy rally is hidden under fog with `-1`. |
| Resource `{id, type, stock}` | Current visible stock. Initial stock comes from map data; there is no `maxStock` state field. |
| `forestStocks`, `forestEpoch` | Changed forest stock and epoch, filtered by viewer. |

`cargoType` describes carried resources, not a guaranteed description of the next
work target. The [renderer contract](renderer-state-contract.md) defines conservative
visual mapping. The renderer must never infer hidden changes.

Unit cargo normally retains the existing two-decimal snapshot rounding. A positive
load that would round to zero is sent at its authoritative precision, so carrying
controls still accept the final fraction of a finite food/wood source. Exact zero
stays zero. Checkpoints and resource deposits retain their existing precision;
this transport rule neither grants food nor changes visibility or display formatting.
[Fractional cargo evidence](qa-fractional-cargo-return-2026-10-03.md) exercises both
seats through the production client command path and restart.

## Checks

The deterministic policy assigns one Scout to reconnaissance separately from
frontline army orders. It samples sixteen frontier destinations from the filtered
visibility mask and public objective locations, avoiding up to 64 observed threats.
An enemy within nine cells triggers retreat toward a known friendly completed
Town Center. A stalled route retries after 300 ticks and remembers four failed
destinations. Orders bind entity generation; neither hidden terrain nor enemy
economy is available to this planner. See `scripts/pve-reconnaissance.test.mjs`
and `scripts/field-roles-scenario.mjs` for deterministic and terrain checks.

Use `scripts/pve-opponent-scenario.mjs`, `scripts/objective-fog-visibility-scenario.mjs`,
`scripts/harvestable-woodland-scenario.mjs`, and the relevant command scenario in
[testing](testing.md). Schema and visibility changes need both-seat coverage.
