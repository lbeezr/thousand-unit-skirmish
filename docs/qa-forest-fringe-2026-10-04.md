# Forest edge discovery investigation · 4 October 2026

[Renderer contract](renderer-state-contract.md#environment-stages-and-fog) ·
[Testing strategy](testing-strategy.md) · [Command guide](testing.md)

Owner: forest-fog investigation delegated from task
`01a0f784-c5d7-72e0-82e8-1747b4c840c1`. Outcome remains open until an identified
containing deployment has actual normal-game rendered acceptance. Cloud only;
stopped Mac testing is not a dependency.

## Evidence and diagnosis

The user reports that walking next to forest in normal Terraced Vale Tiny leaves
it black/unexplored, obscuring its art and depth. Read-only Railway inspection
confirmed staging deployment `e104638c-2c8b-433b-8928-7b53a8f3494e`, SUCCESS,
source `53a47ee379660f30b65776ea813f3a986d29aa37`, online with one running replica.
This is platform identity, not a browser reproduction or served-byte verification.

The investigation started from main `0fc2e9b8a3050ba9f4dff2aee0daabe9cc18cbb0`.
These three source files are byte-identical at both revisions:

| File | SHA-256 |
| --- | --- |
| `server.mjs` | `5fe92df439782e3f0b5cf81a5d142f78ff30ce0b9184c765316fb72e225e56f6` |
| `src/main.js` | `d85025756fcd16737f9c93a75e4eb94d76873cf8df774551f1176ee899c2f143` |
| `src/environment-art.mjs` | `8a25976ff766f6808f7a2792f36979a404f14384d7e7d67fd40a38a4bfeca057` |

Confirmed source findings:

- `markVisionFrom` checks intermediate ray cells and excludes the endpoint from
  blocking. Ordinary forest defaults to height 1.12, above eye height 1.0: its
  first cell is seen, but cells behind it are blocked. The same coverage writes
  current visibility and permanent exploration. Eight-bearing regressions
  reproduce the undiscovered second forest layer in the frozen deployed function.
- `updateVisionMasks` clears current visibility, retaining exploration. Checkpoints
  persist both seats' exploration; restore rebuilds current sight. No exploration
  erasure defect was demonstrated. Explicit rematch clears exploration as intended.
- `updateFogFromState` maps states 0/1/2 to alpha 255/154/0 for both terrain and
  minimap. `buildFogOverlay` uses nearest filtering and a depth-test-disabled
  terrain surface at render order 12. Unknown cells therefore have opaque, hard
  boundaries, not soft silhouette discovery.
- `addObstacleEnvironmentSprites` keeps deterministic forest instances and roots;
  their batches disable frustum culling. Stock-driven stages use disclosed data.
  No separate canopy discovery/culling predicate explains the missing interior.

The ground-plane overlay can cover elevated canopy pixels where their screen
projection overlaps unknown terrain. That is a source-based inference, not a
measured pixel defect. LOS-limited exploration plus the opaque hard edge is the
demonstrated mechanism; the visual contribution of canopy projection remains open.

## Precise decision and bounded candidate

This is a **terrain discovery rule change**, not a correction to a broken LOS or
save contract. The recommended candidate discovers one additional forest layer:

1. Keep the exact current LOS coverage, sight ranges and existing high-ground bonus.
2. Consider only forest target cells inside that same source radius whose ray's
   first blocker is forest, with no building occupying that blocker.
3. Add targets adjacent in the eight-neighbor grid to a directly LOS-visible forest
   cell. Newly explored cells never seed another ring. Open land, distant forest,
   forest behind a first rock/building blocker and the rest of the map stay unknown.
4. Write only permanent exploration. Emit state **1**, never state 2, for the fringe.
   The existing production renderer/minimap consume the same authoritative mask.

The candidate lives in a server-only [leaf](../src/forest-fringe.mjs) and the vision
coverage cache. Geometry invalidation rebuilds visible and fringe coverage together.
No client dilation, new wire field, save schema, map override or renderer framework
is introduced. Old checkpoints remain compatible; present sources discover the new
bounded fringe after restore. Enemy rows, targeting/detection, private totals,
production and live forest/node stock filtering continue to use current visibility.

Newly discovered scenery uses authored initial art or the client's last disclosed
stock stage. Hidden clearing is not inferred. Existing in-memory last-known forest
stages survive omitted rows and same-map reconnect; new matches clear them. A fresh
browser does not have persistent historical stock-stage memory: the server saves
terrain discovery, not each client's remembered resource stages. The candidate
does not add or claim that separate feature.

| Option | Tradeoff |
| --- | --- |
| Recommended: one-cell explored-only forest fringe | Makes the nearby woodland silhouette/depth less black while retaining unit visibility. Explicitly changes terrain discovery on fogged maps; integration needs that decision. |
| Keep exploration rules; soften or repair the rendered mask | Preserves the existing discovery contract. Requires actual pixels to select feathering/root-aware masking and check canopy/depth at both zooms. It cannot establish deeper terrain knowledge. |
| Expand forest LOS or globally reveal terrain | Broader scouting/balance change; outside this candidate. |

[OpenRA's primary trait documentation](https://docs.openra.net/en/release/traits/#shroud)
models map exploration and fog separately, and
[FrozenUnderFog](https://docs.openra.net/en/release/traits/#frozenunderfog) describes
remembered actor presentation. This supports keeping terrain memory separate from
live detection; it does not prescribe or prove our one-cell forest rule.

## Validation and remaining acceptance

[Registered forest tests](../scripts/fog-checkpoint-forest.test.mjs) include the
[frozen deployed LOS oracle](../scripts/fixtures/forest-vision-53a47ee.txt), CPU
production-function fixtures and [native cases](../scripts/forest-fringe-native-cases.mjs).
The existing forest-test registration imports the new native cases; the concurrently
owned central CI registry is untouched.

Coverage: both-seat eight-bearing masks and actual legal Worker approach/retreat;
seeds 93025/17/42 on authored Terraced Vale, sight 7/8/11 and real high-ground data;
map corners/row wrapping, nonrecursive depth, rock/building exclusions, unchanged
current masks; actual client terrain/minimap alpha, omission memory and rematch;
native hidden occupant and productive node changes, attack/forest-gather denial,
private totals/queues, warm token reconnect, untouched checkpoint/new-process
restart and rematch. Native setup explicitly seeds three already-cut forest cells
to admit an enemy legally; subsequent actions use real commands. It does not claim
a player-generated initial clearing or browser/GPU execution.

Focused/required check results, exact source and clean release digest are recorded
in the PR. A passing CPU suite or release HTTP check is not rendered acceptance.
The one supported cloud browser preflight reports `unsupported`, screenshots 0,
`sandbox-unavailable` and `storage-unavailable`. No bypass/retry, paid service,
security change, deployment mutation or generated art is part of this work.

Before closing the outcome, the cloud testing owner must supply a supported
sandbox/storage/WebGL2 executor. At an identified containing release, use normal
Tiny Skirmish entry with fog enabled, both seats, all eight forest approaches,
ordinary/strategic zoom and retreat/reconnect. Capture actual gameplay PNGs with
viewport, camera, map/seed, connection state and source/release/deployment identity.
Inspect tree crowns, the black boundary and terrain depth; verify hidden enemy
and stock negatives alongside the actual received mask. The implementation owner
retains this acceptance; deployment and rendered evidence remain incomplete.
