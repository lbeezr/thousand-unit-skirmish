# Map scale and playability backlog

[Historical compact-map measurements](qa-map-scale-2026-10-03.md) · [Size tiers and migration](map-size-tiers.md) · [Scale guide](map-scale-density.md)

Owner: Map scale/playability workstream. Scope: measured ordinary skirmish scale,
terrain readability and representative acceptance. The user now requires both
ordinary dimensions to be at least 160: Tiny, then Small/Medium/Large/XL. Preserve
smaller maps as internal fixtures and legacy save identities, including existing
Practice scenarios; keep the massive Risk-world mode separate. Coordinate the
map/mode/economic interface before shared edits. Dimensions below are proposals
unless explicitly marked shipped.

| Rank | Outcome / dimensions | Next action and write boundary | Dependencies | Acceptance / current evidence |
| --- | --- | --- | --- | --- |
| 1 | Repeatable audit; dated 26-map baseline, current checkout catalog | Merged [audit PR177](https://github.com/lbeezr/thousand-unit-skirmish/pull/177); retain dated JSONL and repeat the CLI against current checkout. No simulation edits. | Independent review of exact head. | Focused geometry/tempo/roster tests; regenerated output; source/staging identity. [Dated findings](qa-map-scale-2026-10-03.md). Tooling-only acceptance; deployment N/A. |
| 2 | Representative large-map diagnostic; **shipped 160 × 160** Woodland Expanse | Run an existing native movement collector on a disposable local server; retain host conditions, exact source/map and full failure/success evidence. Evidence files only; do not tune budgets to pass. | Quiet runtime window for comparative measurements; renderer/hosted follow-up remains separate. | Actual both-seat orders and completion, wall/game-time factor, A*/tick/start-lag, checkpoint and snapshots. Earlier [Dense Clash hosted run](qa-hosted-scale-profile-2026-09-29.md) and [Open Field sample](qa-checkpoint-scale-2026-09-27.md) are historical compact-map evidence, not large-map support. |
| 3 | One ordinary regional showcase; **160 × 160 Tiny candidate** Veyrholds Terraced Vale | Deliver [candidate PR202](https://github.com/lbeezr/thousand-unit-skirmish/pull/202), its focused generator/layout/native checks and owning guide. Three-level terraces, valley and passes use current engine. | Coordinate world-mode owner task `01a103cc` and map/resource owner; no conflicting default edits. Establish objective/deadline intent and resource distribution before authoring. | Base path 130–156 cells (50–60 s Worker, 28.9–34.7 s Scout); two separated 12–16-cell passes plus 6–8-cell flanks; home city template and two reachable expansion sites per seat. Mirrored access/stock, readable traversability; paid normal-game build/harvest/expand/combat/reconnect/rematch. No terrain enforcement expansion hidden in map work. |
| 4 | AoE2/WC3 comparison calibrated to tempo and usable footprint | Confirm current-game wall clocks/TC envelopes and obtain actual versioned reference paths when available. Docs/reference data only. | Verified Library report read; independent local-byte/raw-map extraction unavailable here. | [Reference normalization and timing](qa-map-scale-2026-10-03.md#next-larger-map-and-external-comparison) distinguish total versus playable WC3 bounds, AoE2 player-dependent sizes and controlled travel examples from actual base routes. |
| 5 | Required ordinary floor/default migration and acceptance | Consume the shared tier policy in normal selectors, selection validation and fresh defaults; retain old canonical loading/current saves and Practice. Mode runtime owner task `01a103cc` and entry owner branch `codex/match-mode-entry-ui-v1` own the receiving integration, tracked on [PR176](https://github.com/lbeezr/thousand-unit-skirmish/pull/176). Benchmark legacy compact controls, Woodland and Tiny under identical workloads; collect a human-pair match. | [Candidate PR202](https://github.com/lbeezr/thousand-unit-skirmish/pull/202); seeded PvE pools are undersized and need honest capability behavior; named browser/hosting/network budgets. | Start with 24 total units, grow to 250/500/1,000; 2,000 diagnostic ceiling. Mixed units, paid city/expansion, long orders through every pass, combat and forest cutting, reconnect/checkpoint/rematch. Record first contact/expansion, region use, player explanation, 3+ route waves per load, server/browser/network costs separately. |
| 6 | Progressive Small **192²**, Medium **224²**, Large **256²**, future XL **320²** | [Small Threefold Basin](qa-threefold-basin-2026-10-04.md) adds a third expansion pocket and distinct valley/causeway/flank routes. [Bounded harness](../scripts/map-capacity-scenario.mjs) and [XL source/cost audit](map-grid-limit-audit-2026-10-04.md) retain exact evidence. Medium/Large remain future authored slices. | Named browser/hosting budgets and human play remain open. XL needs widened vision indices, bounded caches/routes/save costs and coordinated limit changes. | Small is a candidate; capacities remain unverified. No stretching/empty borders, blanket resizing or speed changes; schema acceptance at 256 is not performance support. |

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
