# Art direction evidence and gaps — 4 October 2026

[Art direction](art-direction-contract-v1.md) · [Preserved explorations](lore/art-evolution.md) · [Adoption checklist](asset-adoption-checklist.md)

## Finding and scope

Vaelora has substantial world, ecology, character and architecture exploration.
The largest direction gap is the bridge from those individual sources to a
coherent playable match: composed scenes, readable state changes, action
storyboards and a shared treatment of feedback and UI. More isolated finished
assets will not, by themselves, answer those questions.

This inventory checks tracked guides, source packs and selected runtime bindings
at main `5d081ecf376f2e6e19331713bb5cc764bae75941`. The Bellweather ecology key,
Frontier Town Center concept and Boughward direction sheet were visually inspected
as existing source images. No new art or gameplay frames were produced. Private
studies are attributed to their owning records; their pixels were not inspected.
No live deployment or ordinary-game appearance is certified here.

The user's direction is that **everything we make should have backing in art,
storyboards or explorations**. The [evidence contract](art-direction-contract-v1.md#visual-development-backing)
applies this to every player-facing visual outcome, including procedural work,
map composition, animation, effects and interface changes. Existing relevant
sources count. A written brief or a passing implementation check alone does not
supply visual development evidence.

## What already has backing

| Surface | Preserved backing | What it establishes |
| --- | --- | --- |
| World and regions | [Selected atlas, ten maps and ten ecology keys](art-direction/vaelora-v1/README.md) | Regional palette, ecology and world mood; aspirational paintings rather than playable layouts. |
| Human identity and land actions | [Human identity](art-direction/human-vaelora-sprites-v1/README.md), [roster sources](art-direction/human-roster-v1/README.md), [Worker land-action evolution](qa-worker-land-art-2026-10-04.md) | Selected appearance plus retained poses/iterations. Current Worker v0.33 supplies 64/64 land action/heading source cells; that is separate from rendered motion acceptance. |
| Human military motion | [Unit production contract](unit-art-production-contract.md) | Identity, registration and timed source keys are pinned. Infantry/Spearman/Archer retain 63 missing motion cells across their three actions and seven other headings. |
| Mounted, siege and rival identity | [Human mounted/siege sheets](art-direction/human-mounted-v1/README.md), [Boughward board and seven role sheets](art-direction/boughward-roster-v1/README.md) | Role, costume, mount and equipment explorations exist. Static poses reused across headings do not establish directional animation. |
| Frontier architecture | [Eight illustrated concepts](lore/frontier-architecture.md), [current building production record](building-atlas-production-plan.md) | All eight Complete families have default selectors and 64 directional captures. Matching construction/damage and ordinary-game review remain open. |
| Landscapes and resources | [Regional kit plan](regional-environment-kits.md), [ground studies](../assets/environment/vaelora-ground-studies-v1/README.md), [region-kit sources](../assets/environment/vaelora-region-kits-v2/README.md), [adoption ledger](asset-adoption-checklist.md#resources-terrain-and-audio) | Palette/material and selected resource-state studies exist; full kit coherence, species/view coverage and game acceptance vary. |
| Water and shore | [Water comparison study](water-surface-study.md), [preserved bank-shade comparisons](qa-shore-bank-shade-2026-10-03.md) | A bounded treatment and first-pass water acceptance are recorded. The shade comparisons are CPU studies; they do not establish ordinary-game shore acceptance. |
| Sheep and coastal/barrier work | [Sheep evolution](lore/art-evolution.md), [Coastal workstream](coastal-barrier-art-workstream.md) | Sheep has a public eight-view static family. Skiff/barrier sources have separately recorded readiness and publication boundaries; an absent public pack is not proof that no exploration exists. |
| Interface | [UI source/preview kit](../assets/ui/README.md), [action glyphs](../assets/ui/icons/actions/README.md), [portrait mapping](hud-art-integration.md), [menu study](game-menu-art-study.md) | Sources, compact compositions and meaning constraints exist. Some comparison studies remain private and native recognition/whole-flow acceptance is incomplete. |

The inspected sources share warm craft, broad painterly forms and restrained
regional color. They also expose different jobs: the ecology key describes a
landscape, the Town Center is a detailed isolated building, and the Boughward
board proposes people and architecture together. None specifies how their detail,
lighting, scale and accents should combine at game zoom. The Boughward sheet's
proposed architecture and cast do not automatically become implemented buildings
or roles.

## Gaps and the smallest useful backing

These are design-evidence gaps or incomplete production/acceptance, distinguished
below. Owners are recorded roles, not a claim that a worker is currently running.
Items without a recorded receiving owner remain explicitly unassigned.

| Gap | Existing evidence and remaining question | Next visual evidence / retained owner |
| --- | --- | --- |
| **Composed match target** | Regional paintings and the [Rootways polish proposal](art-runtime-audit-2026-10-03.md#recommended-single-scene-polish-proof) exist. No maintained selected scene board spanning landscape, roster, buildings, HUD and feedback was found in this review. | One annotated Bellweather/Frontier scene using the current roster, at ordinary and strategic zoom: opening economy, contested edge, damaged settlement. A paired Underbough study can test regional transfer. Art direction leads; Maps, Renderer and HUD contribute their existing interfaces. |
| **Scale, light and finish together** | The [camera study](art-direction/environment-camera-v1/README.md) and building measurements exist. The current Human size supersedes the older 0.8-unit ruler, and baked sprite lighting cannot be corrected just by adding scene lights. | A shared lineup of Worker, mounted unit, House, Town Center, Barracks, tree and resource; annotated doors, roots, occupancy, light direction and detail hierarchy on flat/raised ground. Building and technical-art owners retain calibration; Renderer retains actual pixels. |
| **Building lifecycle continuity** | Eight Complete concepts/capture families exist. Matching Foundation, Frame, Damaged and Critical remain absent: **256 color views**, not eight missing Complete designs. Old-state fallbacks can switch visual identity. | Storyboard one building's build → Complete → damage → repair, keeping camera, anchor and architecture fixed; then derive its missing states. Building architecture owns it through adoption. Final removal/collapse needs a supported event treatment before production; persistent ruins are not established. |
| **Mill, Farm, Dock, Stone and fish identity** | [Mill prose brief](frontier-mill-art-brief.md), [finite Farm](farm-finite-planting.md) and [Dock rules](dock-shoreline-foundation.md) exist. Mill/Farm/Dock still use House placeholders; Stone/fish have procedural markers. Coastal records mention candidates without a public default family. | Audit retained candidates first, then make a role/silhouette board beside current buildings/resources. Add Farm productive/exhausted/replant, Dock berth/cargo and mineral full/worked/depleted panels. Mill art recipient and ore recipient are unassigned in the adoption record; Farm and Dock art recipients also need explicit assignment. Gameplay owners retain their rules. |
| **Action mechanics and temporal coverage** | Worker land breadth has advanced beyond the earlier audit. Fishing headings, Human military, mounted/siege, Boughward and Sheep motion still have recorded gaps. The [unit pipeline](unit-character-meshy-pipeline.md#recommended-workflow-to-test) already recommends action storyboards. | Per next action/heading: identity seed, root/foot markers, target/tool contact, anticipation/contact/recovery, milliseconds and loop/terminal behavior. Reuse supplied keys first. Unit-art owners retain sources; animation integration owns visible state/timing. Rough short sequences remain acceptable. |
| **Combat, commands and outcomes** | Runtime health/impact/target/rally cues exist; this review found no shared visual sequence board connecting order acceptance/refusal, attack release/impact, damage, defeat, objective capture and match result. | Small cue storyboards at both zooms showing trigger, duration, priority, team shape and fog/reduced-motion behavior. HUD and combat/animation owners own their cues; art-direction synthesis needs a named receiving owner. Avoid decorative effects with no player meaning. |
| **HUD and entry as one visual language** | Icons, portraits and menu studies exist. The portrait audit retains older building-default descriptions and should not be used as today's binding inventory. Complete families now use the current [building selector](../src/frontier-building-preview.mjs). | Annotated existing-flow boards: entry → map/room choice → selection/production → rejected order → result/rematch; include narrow layout, focus and text/image fallback. Show current building identity in proposed portraits. HUD/entry owners retain their respective surfaces; maintain the compact, dismissible direction. |
| **Regional gameplay composition and state changes** | Ten ecology keys and kit briefs are strong backing. They do not prove playable route hierarchy, clear resources, quiet command space or full/worked/depleted coherence. | Derive one biome board with a contested route, settlement edge, harvest opening, shoreline and raised-ground transition; mark decorative versus interactive forms. Maps and Environment/Vegetation own production; compare it in the composed match target. Do not produce all ten full kits at once. |
| **Rival architecture and allegiance cues** | Boughward's direction board includes architectural proposals, but no separate implemented building family is established. Both teams currently share Frontier building designs. | State that reuse explicitly in the current scene board; show Boughward units with shared buildings and both team accents. A later architectural exploration needs a concrete presentation outcome. Art direction owns continuity; no faction mechanics or new building roster follow from the board. |
| **Preservation and selection history** | The [recovery register](lore/art-evolution.md#recovery-gaps) identifies omitted world/culture iterations, missing exact atlas prompts and the Storehouse pre-extraction original. Some rejected local/private studies have receipts rather than public pixels. | Original source owner recovers and hashes existing outputs and selection reasons within current access/publication authority. Preserve before/after and rejected attempts; do not reconstruct exact prompts or claim unseen files are recovered. |

## Recommended order

The [roadmap](roadmap.md#art-development-backing) remains the outcome queue;
this inventory links the evidence needed by its existing streams.

1. Establish the shared scene and scale/finish board from preserved sources.
   It should resolve which qualities belong together and which details disappear
   at game size. Keep studies labelled as studies until accepted.
2. Back the next existing building lifecycle slice with a registered state
   storyboard. Continue the building owner's current ordinary-game acceptance
   rather than starting another Complete replacement queue.
3. Give the conspicuous economy placeholders a silhouette/state exploration
   and named art recipient, reusing retained candidates where suitable.
4. Attach action guides to the already ranked animation gaps. Finish usable
   action/direction breadth before polishing working sequences.
5. Compose combat/command cues and the compact entry/HUD flow against the same
   scene. Retain existing labels, supported triggers and access semantics.

Each task should carry **source/board → selected choice and reason → runtime
binding → identified release → observed match**. These stages can advance
incrementally; a source milestone does not claim delivery or game acceptance.
The [adoption checklist](asset-adoption-checklist.md) owns downstream status,
and [QA](qa-vertical-slice.md) owns acceptance evidence. This inventory creates
no paid generation job, private publication, extra gameplay capability or new
approval queue.

## Generated examples following this stocktake

The user's follow-up requested pictures to explain these inputs. The
[three preserved visual-development examples](art-direction/visual-development-studies-v1/README.md)
now demonstrate a composed Bellweather match, one House lifecycle sequence and
Mill/Farm/Dock silhouette alternatives. They retain exact prompts/reference hashes
and explicit visual-review limits. All are exploratory and unselected; they add
discussion material without closing the selected-direction, production or
ordinary-game acceptance gaps above.

A further user request expands the reference material to
[complete civilization building families and village/town/city studies](art-direction/civilization-settlements-v1/README.md):
four boards each for Frontier/Human and Boughward, including all thirteen shared
building roles. This supplies new exploratory discussion material for scene
composition, economy silhouettes and rival architecture. Selection, calibrated
production, supported runtime transitions and actual match acceptance stay open.
