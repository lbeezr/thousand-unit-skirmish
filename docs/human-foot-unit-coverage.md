# Human foot-unit functional coverage

[Coverage priority matrix](qa-unit-animation-audit-2026-10-03.md#functional-coverage-priority--4-october-2026) · [Assets](assets.md) · [Adoption checklist](asset-adoption-checklist.md)

Owner: delegated Human foot-unit art lane; animation-state integration owner `01a103d4` retains state clocks and protocol. Worker/fishing/Sheep/Coastal and combat/stances are separate lanes. The user's task authorizes public reuse, default wiring and packaging without paid generation or private-source publication.

## Infantry slice — 4 October 2026

Source inspected at main `9351320d68b3b9c949166b7d5991973004b7553d`, including all three Infantry packs, both Archer packs and the only Spearman pack. The Meshy Infantry v2 bake has 264 real directional poses but lacks weapons/shield. The painted Infantry v1 retains readable equipment and distinct physical views; its old floor-grid registration is unusable because feet/weapons cross cell borders. The v3 SE keys work but cannot face the other seven headings.

The new [Infantry v4 pack](../assets/units/infantry-sprite-v4/README.md) reuses **48 unique original poses**, with **0 new, generated, interpolated or mirrored poses**. It recovers complete connected actors, excludes adjacent-row pixels, registers eight real source columns and translates one coherent role into a shared padded canvas/root/scale. Two-key walks/thrusts and idle-to-terminal defeat are the functional minimum. The old SE eight-key art remains in v3; the new default's short SE sequence is a consistency tradeoff for complete directional coverage, not cosmetic refinement. No combat or stance implementation changes.

| Coverage checkpoint | Infantry missing | Spearman missing | Archer missing | Total missing |
| --- | ---: | ---: | ---: | ---: |
| PR222 baseline ordinary defaults | 21 | 21 | 21 | **63** |
| This Infantry default candidate, source/CPU checks | 0 | 21 | 21 | **42** |
| Verified deployed/native coverage | Unchanged baseline until identified delivery and capture | 21 | 21 | **63 remains unverified** |

The remaining cells are exactly walk/attack/defeat × N/NE/E/S/SW/W/NW for Spearman and Archer. The candidate has every idle/walk/attack/defeat heading. Defeat coverage means a readable two-key terminal transition; it does not claim intermediate collapse motion.

Default binding is `src/main.js`'s ordinary no-option Human roster. `spriteDirectory` admits v4; the server admits exactly its manifest/runtime/mask, and Docker/release includes those same three files. No protocol, action enum, state-selection or approximate-direction algorithm changes. Equal authored durations for every heading preserve the animation owner's existing role/state lifetime interface: walk 800, attack 850, defeat 850 ms. Existing clocks, fresh-event deduplication and generation reset are retained.

The shared edit is limited to one supported-version addition in `src/unit-sprite-runtime.mjs`; its state/facing helpers are untouched. Direct cross-thread messaging to `01a103d4` is unavailable in this executor. This tracked contract is ready for that owner's independent review; the parent retains routing to the existing owner rather than creating a second state implementation.

Checks: canonical manifest/file-hash validation; 48 decoded full-pose bounds with four-pixel padding and shared pivot; eight distinct pixel hashes per action; real default no-option configuration; exact-heading CPU instanced UV keys for both teams and selection values, loop/end/fresh event/defeat/resume. The existing animation-runtime and sprite-clock suites also pass. Local browser preflight returns `sandbox-unavailable`, zero screenshots. No sandbox bypass, native or deployment claim.

## Ranked retained backlog

1. **Infantry delivery/acceptance:** obtain independent review of the exact candidate head, merge through repository rules, pack a clean source release, identify the containing staging revision, then run the ordinary recipe below. Art owner retains this outcome; parent-owned Railway/Mac routes support identified delivery/capture.
2. **Archer ready reuse slice:** recover all 48 public v1 actors (the old grid cuts feet badly), use the same physical-view registration, test two-key walk/draw/release and readable terminal defeat, wire a separate bounded PR. No dependency on Infantry deployment; reuse the reviewed registration contract.
3. **Spearman source gap:** current public pack has only eight idle views and SE walk/attack/defeat. No equivalent directional legacy action source exists. Retain those real keys and 21 missing cells. Next useful input is seven headings of readable short walk/thrust/defeat sequences, supplied with public rights or explicitly authorized local authoring. Do not relabel its SE clip or borrow Infantry's round-shield costume as Spearman coverage. No paid rigging/new-generation charges or private-source pixels are authorized.
4. **Polish after function:** smoother loops, more defeat intermediates, costume/finish and team-mask refinement. Do not delay usable direction coverage for this work.

## Ordinary-game acceptance

At a named served source/release SHA, enter Millrace or Terraced Vale through Create Room and normal map selection, without art query flags. Use both seats and normal paid Barracks Infantry production. For Human Infantry capture idle, move/Stop/resume, attack/fresh attack and lethal defeat along N/NE/E/SE/S/SW/W/NW. Verify the actual direction's keys advance, wind-up/strike ends at 850 ms, a new event restarts, terminal corpse clamps and fades, and selection clearing/fog/strategic LOD do not freeze state. Inspect planted roots and spear/shield readability at ordinary zoom; verify the gold-tunic costume and sash tint on the containing build. Include enemy views through disclosed fog. Save chronological clips with SHA, map, seat, action, heading and selected/unselected status.

A release/hash/CPU pass is a milestone. Review, deployed identity and actual in-game function remain incomplete until recorded here; there is no cosmetic approval gate.
