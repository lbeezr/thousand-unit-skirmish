# Authoritative Worker performing-action v1

Producer owner: economy/content. Consumer, default renderer binding, deployment
and native appearance owner: animation integration task `01a103d4`.
The parent routed this boundary from the
[proposal and dated probe](worker-performing-action-contract-proposal.md).
This is the agreed producer/consumer contract. The [consumer evidence](qa-worker-performing-action-consumer-2026-10-04.md)
records version-aware default sprite/procedural/scheduling binding; identified
deployment and ordinary-game appearance remain owned steps. No new work artwork
or gameplay rules are admitted.

## Snapshot contract

State adds `workerPerformingActionVersion: 1`. Unit row **17** is
`performingAction`; all previous indices and meanings remain unchanged.

| Value | Positive authoritative mutation in this simulation step |
| --- | --- |
| `gather-food` | That Worker received food from a neutral node, Farm or shore-fish grant. |
| `gather-wood` | That Worker received wood from a resource node or forest cell. |
| `gather-stone` | That Worker received Stone under the admitted optional economy profile. |
| `build` | That Worker increased unfinished building progress. |
| `repair` | That Worker contributed positive repaired HP. |
| `null` | No currently valid productive receipt. Waiting, travel, Stop, returning cargo, completed/depleted targets and no-wood repair clear work. |

Own Workers and the shared no-fog roster receive explicit nulls. A visible enemy
under fog has no disclosed row 17, matching task privacy; hidden enemy rows stay
omitted. Non-Workers have no row 17. The existing `state.tick` is the integer
**30 Hz simulation-step count** (one step = 1/30 second), not milliseconds or a
presentation clock. There is no new per-row timestamp or checkpoint version.
Absent version/field, unknown versions/actions and generation changes mean no
confirmed work; consumers must not reconstruct work from row 9 intent. Sparse
legacy row slots retain their existing JSON null serialization behavior.

Stance collision check: [military PR #159](https://github.com/lbeezr/thousand-unit-skirmish/pull/159)
at `9afe392d6bce5276549a60e3189ff0dcd7095304` uses state-level
`unitStances: [[id, generation, stance], ...]` and leaves positional rows unchanged.
Row 17 is free; this marker and the stance array have distinct names. The stance
owner retains its schema-25 migration. This presentation addition has no
persisted fields and adds no checkpoint schema migration.

## Receipt lifetime and delivery

The producer records beside existing positive mutations in the forest/node/Farm
gather and construction/repair branches. A bounded map uses Worker object
identity plus tick, generation, order revision and target. Each simulation step
clears receipts. Snapshot reads require the same tick/generation/revision, a
living Worker and the same compatible assignment/target. Returning after full
capacity or depletion, completion, target removal and Stop/resume cannot expose
an earlier receipt. A successful final wood-consuming repair can be positive in
its own step; the next no-wood step is null even while repair intent persists.

The resolved action identity is compared with the preceding step. Action changes,
including positive → null with all authority otherwise stable, mark the existing
state broadcaster dirty. Delivery uses its existing bounded three-step cadence;
continuous productive work adds no extra broadcast. Receipts do not live on
units, enter checkpoints, alter resource/progress/HP rates, consume RNG or change
navigation/combat. Recovery and rematch clear the journal, and only a new positive
mutation can reconstruct work.

## Acceptance and remaining integration

[Producer source/release evidence](qa-worker-performing-action-producer-2026-10-03.md)
records tested revisions and separates remaining client/deployment acceptance.

`node --test scripts/worker-performing-action.test.mjs` exercises actual server
work/snapshot branches for positive food/wood/Stone/Farm/forest grants, waits,
stock/capacity exhaustion, per-builder attribution, repair wood exhaustion,
completion, invalidation and fog. `node scripts/worker-performing-action-scenario.mjs`
uses both seats on shipped Stone Defense Field, actual WebSocket commands,
approach/positive work, Stop/resume, paid Farm completion/harvest, cold recovery
and rematch. Its exhausted-repair phase explicitly seeds damaged paid Farms and
nine repair steps of wood in a disposable checkpoint; subsequent repair commands,
positive progress and no-input clear delivery use the normal native server.
These setup values are regression fixtures, not paid-match balance evidence.

Release inclusion is the server import and normal Docker/release copy of `src`.
Local native acceptance establishes the producer contract, not appearance.
Animation task `01a103d4` retains version-aware row ingestion, sprite/procedural
pose/scheduling gates, shipped-manifest frame checks and Mac ordinary-game
appearance acceptance on an identified served and deployed producer+consumer
revision. No deployment is inferred from source merge. The exact wire addition
is limited to the one version marker and row 17; combat/stance authority remains
with its existing owner.

The default consumer validates version/action/task/health, clears reused
generations and renders positive/null transitions immediately. Work frames use
the confirmed resource, not previous cargo. Missing/unknown protocol has no work
fallback. `--client-presentation` adds actual native rows through CPU client
receipt/scheduling and shipped atlas buffers to the scenario above; controlled
held-packet checks do not establish GPU or deployed appearance.
