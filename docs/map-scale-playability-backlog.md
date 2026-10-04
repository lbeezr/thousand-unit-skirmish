# Map scale and playability backlog

[Historical compact-map measurements](qa-map-scale-2026-10-03.md) · [Current four-tier inventory](map-tier-inventory-2026-10-04.md) · [Size tiers and migration](map-size-tiers.md) · [Scale guide](map-scale-density.md)

Owner: Map scale/playability workstream. Scope: measured ordinary skirmish scale,
terrain readability and representative acceptance. The user now requires both
ordinary dimensions to be at least 160: Tiny, then Small/Medium/Large/XL. Preserve
smaller maps as internal fixtures and legacy save identities. Ordinary Practice
also needs 160 arenas; retaining compact Practice fixtures alone is insufficient.
Keep the massive Risk-world mode separate. Coordinate the
map/mode/economic interface before shared edits. Dimensions below are proposals
unless explicitly marked shipped.

| Rank | Outcome / dimensions | Next action and write boundary | Dependencies | Acceptance / current evidence |
| --- | --- | --- | --- | --- |
| 1 | Repeatable audit; dated 26-map baseline, current checkout catalog | Merged [audit PR177](https://github.com/lbeezr/thousand-unit-skirmish/pull/177); retain dated JSONL and repeat the CLI against current checkout. No simulation edits. | Independent review of exact head. | Focused geometry/tempo/roster tests; regenerated output; source/staging identity. [Dated findings](qa-map-scale-2026-10-03.md). Tooling-only acceptance; deployment N/A. |
| 2 | Representative large-map diagnostic; **shipped 160 × 160** Woodland Expanse | Run an existing native movement collector on a disposable local server; retain host conditions, exact source/map and full failure/success evidence. Evidence files only; do not tune budgets to pass. | Quiet runtime window for comparative measurements; renderer/hosted follow-up remains separate. | Actual both-seat orders and completion, wall/game-time factor, A*/tick/start-lag, checkpoint and snapshots. Earlier [Dense Clash hosted run](qa-hosted-scale-profile-2026-09-29.md) and [Open Field sample](qa-checkpoint-scale-2026-09-27.md) are historical compact-map evidence, not large-map support. |
| 3 | One ordinary regional showcase; **160 × 160 Tiny candidate** Veyrholds Terraced Vale | Deliver [candidate PR202](https://github.com/lbeezr/thousand-unit-skirmish/pull/202), its focused generator/layout/native checks and owning guide. Three-level terraces, valley and passes use current engine. | Coordinate world-mode owner task `01a103cc` and map/resource owner; no conflicting default edits. Establish objective/deadline intent and resource distribution before authoring. | Base path 130–156 cells (50–60 s Worker, 28.9–34.7 s Scout); two separated 12–16-cell passes plus 6–8-cell flanks; home city template and two reachable expansion sites per seat. Mirrored access/stock, readable traversability; paid normal-game build/harvest/expand/combat/reconnect/rematch. No terrain enforcement expansion hidden in map work. |
| 4 | AoE2/WC3 comparison calibrated to tempo and usable footprint | Confirm current-game wall clocks/TC envelopes and obtain actual versioned reference paths when available. Docs/reference data only. | Verified Library report read; independent local-byte/raw-map extraction unavailable here. | [Reference normalization and timing](qa-map-scale-2026-10-03.md#next-larger-map-and-external-comparison) distinguish total versus playable WC3 bounds, AoE2 player-dependent sizes and controlled travel examples from actual base routes. |
| 5 | Required ordinary floor/default migration and acceptance | Consume the shared tier policy in normal selectors, selection validation and fresh defaults; retain old canonical loading/current saves and Practice. Mode runtime owner task `01a103cc` and entry owner branch `codex/match-mode-entry-ui-v1` own the receiving integration, tracked on [PR176](https://github.com/lbeezr/thousand-unit-skirmish/pull/176). Benchmark legacy compact controls, Woodland and Tiny under identical workloads; collect a human-pair match. | [Candidate PR202](https://github.com/lbeezr/thousand-unit-skirmish/pull/202); seeded PvE pools are undersized and need honest capability behavior; named browser/hosting/network budgets. | Start with 24 total units, grow to 250/500/1,000; 2,000 diagnostic ceiling. Mixed units, paid city/expansion, long orders through every pass, combat and forest cutting, reconnect/checkpoint/rematch. Record first contact/expansion, region use, player explanation, 3+ route waves per load, server/browser/network costs separately. |
| 5a | Admitted ordinary Practice arena **160²** | Author [Confluence Grounds](qa-confluence-grounds-2026-10-04.md): useful connected bays/banks, two fords, flat home/expansion campuses, paid Dock/Skiff/Stone/Farm/Watchtower and nearby neutral Sheep. New map/generator/scenario; no default or Tiny resource edits. Mode/entry owners hide compact Labs from ordinary Practice while retaining explicit internal launches/saves. | Exact catalog boundary recorded on [PR242](https://github.com/lbeezr/thousand-unit-skirmish/pull/242#issuecomment-5975590890) and [PR198](https://github.com/lbeezr/thousand-unit-skirmish/pull/198#issuecomment-5975591347). | Focused land/water/buildability/finite-economy checks, real ordinary Practice entry/selection, paid commands and cold recovery/reset. Source/release/deployed/rendered evidence remain separate. |
| 6 | Progressive Small **192²**, Medium **224²**, Large **256²**, future XL **320²** | [Small Threefold Basin](qa-threefold-basin-2026-10-04.md) adds a third expansion pocket. [Medium Riven Escarpment](qa-riven-escarpment-2026-10-04.md) authors twin ridges, a low rift and flat sites on three levels; 207-unit route. [Bounded harness](../scripts/map-capacity-scenario.mjs) and [XL source/cost audit](map-grid-limit-audit-2026-10-04.md) retain exact evidence. [Large Crownroads](qa-crownroads-2026-10-04.md) adds four separated sites per seat and a 251-unit route; paid acceptance is recorded at its exact source. | Named browser/hosting budgets and human play remain open. XL has an [integrated bounded 32-bit visibility prerequisite](qa-xl-visibility-runtime-2026-10-04.md); route/checkpoint/admission and measured native/rendered capacity still precede a limit change. | Small/Medium/Large are candidates; capacities remain unverified. [Elevation capabilities](map-elevation-capabilities.md) distinguish logical paths from rendered terrain. No stretching/empty borders, blanket resizing or speed changes; schema acceptance at 256 is not performance support. |

Tiny/Small/Medium/Large are now authored and human-Skirmish admitted; Tiny is
the ordinary default and only fresh AI choice. Dated candidate receipts in the
table retain their original scope. The next proposed XL layout is retained outside
the runtime pool in the [joint rollout-boundary audit](map-xl-rollout-boundaries.md).
The inventory owns the current aggregate status and
representative play/capacity next steps. XL visibility now has a bounded runtime increment;
ordinary XL remains unfinished. Next scope: jointly bound route work/storage and untouched
checkpoint/transport size, then coordinate all 320 admission paths and one representative authored
320 map. Preserve current defaults until paid both-seat entry/recovery/reset, long route waves,
forest/water/high-ground behavior and controlled native/rendered budgets pass. The map-size owner
retains ordinary-map integration; runtime/path and cloud performance/render owners retain their
shared gates. Quick custom modes and massive Risk worlds remain separate.
Confluence's [four-node opening correction](qa-confluence-opening-2026-10-04.md)
passes the unchanged nine-unit assertion and the agreed exact legacy-save
contract. Paid old worlds retain their geometry/resources through recovery;
fresh games and explicit host resets use corrected positions. Native paid/naval
and both reset-path proofs pass. Served/rendered acceptance remains with the
delivery owner; this source result does not establish it.

The first benchmark must report game/wall-time ratio, command acknowledgment and
final application separately, actual arrival/formation spread, path expansions,
tick/start-lag p95/max and skipped slots, vision cost, checkpoint cost, snapshots/
compressed egress, and browser frame/memory/minimap readability. Existing native
tick limits are p95 ≤33.333 ms, max ≤100 ms; retain them as diagnostic checks.
Agree player-facing browser/network limits on named hardware before claiming
supported scale. A short native run is not that claim.

A single seat's raw packed fog is 1,440 bytes at 80 × 72, 6,400 at 160 × 160,
 9,216 at 192 × 192, 12,544 at 224 × 224 and 16,384 at 256 × 256, before base64. These are area costs,
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
