# Map scale and playability backlog

[Current measurements](qa-map-scale-2026-10-03.md) · [Scale guide](map-scale-density.md)

Owner: Map scale/playability workstream. Scope: measured ordinary skirmish scale,
terrain readability and representative acceptance. Coordinate actual map, mode
and economic contracts before shared edits. Preserve small custom scenarios and
the separate massive Risk-world mode. Dimensions below are proposals unless
explicitly marked shipped; no default-map adoption is implied.

| Rank | Outcome / dimensions | Next action and write boundary | Dependencies | Acceptance / current evidence |
| --- | --- | --- | --- | --- |
| 1 | Repeatable current-state audit; all 26 **shipped** maps | Integrate reviewed `scripts/map-scale-audit*`, dated JSONL, this queue and scale-guide link. No simulation/map edits. | Independent review of exact head. | Focused geometry/tempo/roster tests; regenerated output; source/staging identity. [Dated findings](qa-map-scale-2026-10-03.md). Tooling-only acceptance; deployment N/A. |
| 2 | Representative large-map diagnostic; **shipped 160 × 160** Woodland Expanse | Run an existing native movement collector on a disposable local server; retain host conditions, exact source/map and full failure/success evidence. Evidence files only; do not tune budgets to pass. | Quiet runtime window for comparative measurements; renderer/hosted follow-up remains separate. | Actual both-seat orders and completion, wall/game-time factor, A*/tick/start-lag, checkpoint and snapshots. Earlier [Dense Clash hosted run](qa-hosted-scale-profile-2026-09-29.md) and [Open Field sample](qa-checkpoint-scale-2026-09-27.md) are historical compact-map evidence, not large-map support. |
| 3 | One ordinary regional showcase; **160 × 160 candidate** Veyrholds Terraced Vale | Agree placement/mode/resource contract, then add only `maps/veyrholds-terraced-vale.json`, its focused generator/layout check and owning guide. Three-level terraces, valley and passes use current engine. | Coordinate world-mode owner task `01a103cc` and map/resource owner; no conflicting default edits. Establish objective/deadline intent and resource distribution before authoring. | Base path 130–156 cells (50–60 s Worker, 28.9–34.7 s Scout); two separated 12–16-cell passes plus 6–8-cell flanks; home city template and two reachable expansion sites per seat. Mirrored access/stock, readable traversability; paid normal-game build/harvest/expand/combat/reconnect/rematch. No terrain enforcement expansion hidden in map work. |
| 4 | AoE2/WC3 comparison calibrated to tempo and usable footprint | Attach the researcher's versioned source handoff and fill the missing AoE2 unit-travel calibration. Docs/reference data only. | Initial native source values received; exact guide link/version and expanded timing remain pending. | [Supplied bounds and HQ-envelope normalization](qa-map-scale-2026-10-03.md#next-larger-map-and-external-comparison) distinguish total versus playable WC3 bounds and AoE2 player-dependent sizes. Do not equate raw grid counts. |
| 5 | Ordinary-map acceptance and potential roster/default adoption | Benchmark current Millrace, Woodland Expanse control, and the new 160 candidate under identical workload; collect a human-pair match. Map/picker/PvE edits only after owner agreement and evidence. | Rank 3 delivery; mode/resource owners; named player device/browser, hosting and network budgets. | Start with 24 total units, grow to 250/500/1,000; 2,000 diagnostic ceiling. Mixed units, paid city/expansion, long orders through every pass, combat and forest cutting, reconnect/checkpoint/rematch. Record first contact/expansion, region use, player explanation, 3+ route waves per load, server/browser/network costs separately. |
| 6 | Larger ordinary option **192 × 192 candidate**; **224 × 224 stress probe** | Expand one proven layout only if the 160 match exposes a specific remaining spatial constraint. Map/evidence slice only. | 160 acceptance; measured fog/frame/pathing costs and justified player need. | Better decisions/expansions, not just extra walking. No blanket map resizing, cell/speed changes, or assumption that the maximum valid 256 grid is supported. |

The first benchmark must report game/wall-time ratio, command acknowledgment and
final application separately, actual arrival/formation spread, path expansions,
tick/start-lag p95/max and skipped slots, vision cost, checkpoint cost, snapshots/
compressed egress, and browser frame/memory/minimap readability. Existing native
tick limits are p95 ≤33.333 ms, max ≤100 ms; retain them as diagnostic checks.
Agree player-facing browser/network limits on named hardware before claiming
supported scale. A short native run is not that claim.

A single seat's raw packed fog is 1,440 bytes at 80 × 72, 6,400 at 160 × 160,
9,216 at 192 × 192 and 12,544 at 224 × 224, before base64. These are area costs,
not measured egress/frame costs. Keep unit-load and map-area comparisons separate.

For the dramatic 160 candidate, reserve a level-0 valley, level-1 terraces and
level-2 plateau rims; connect every intended approach with explicit level-1 ramps.
Keep city centers in 41 × 41 home working regions and flat footprint pads. Home resources should
remain near 10–15 route cells, first expansions around 30–45, deeper sites around
65–90, with contested pockets rewarding the passes. Stock numbers and timed
victory are to be agreed with resource/mode owners from the current economy,
not multiplied blindly by area. Reuse current regional art and clarify cliffs,
ramps, cuttable forests and permanent barriers. New bridges/caves/stacked walkable
layers are separate unranked engine-feature proposals, not this map's dependencies.

If a shared owner decision remains unresolved, stop that dependent map/default
edit, record the concrete contract here, and continue independent measurements.
No spending, security/access change or production promotion is authorized by
this backlog.
