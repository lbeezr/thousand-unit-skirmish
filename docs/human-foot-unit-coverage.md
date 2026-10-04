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

## Archer slice — 4 October 2026

Built on [Infantry PR228](https://github.com/lbeezr/thousand-unit-skirmish/pull/228), refreshed against contract PR225 at main `26ac28db1435623b519add48ccac5a0eb92f2447`. PR228's refreshed source `9c686953cdd5fc54433cda45c902cfc3e927fdad` passes 21 focused checks and a clean release with digest `sha256:c20065dc9a3d68e0c1a3e7502874f231943098bd114bb55e97786470848050c3`; its three exact runtime files are included. These are source/package proofs, not deployed evidence.

The [Archer v3 pack](../assets/units/archer-sprite-v3/README.md) recovers all 48 separate painted v1 actors, including complete feet cut by its old row grid. The same public-source registration contract supplies eight views, two-key walk/draw/release and a short idle-to-terminal defeat. It reuses **48 poses**, adds **0 new/generated/mirrored/interpolated poses**, retains v1/v2, and changes only default/version admission, HTTP/Docker admission and candidate tests/docs. Per-heading durations are uniform: walk 800, attack 1,000, defeat 850 ms. No animation-state or Worker productive-work changes. The combined 23 focused tests, canonical Archer manifest, packed Basic Auth/MIME/hash/source-denial scenario, documentation links, both strict type projects and whitespace pass.

| Coverage after each source/CPU slice | Infantry missing | Spearman missing | Archer missing | Total missing |
| --- | ---: | ---: | ---: | ---: |
| PR222 baseline | 21 | 21 | 21 | **63** |
| Infantry PR228 | 0 | 21 | 21 | **42** |
| Stacked Archer candidate | 0 | 21 | 0 | **21** |

Across both slices: **96 unique reused poses, 0 newly authored poses**. The remaining 21 cells are exactly Spearman walk/attack/defeat × N/NE/E/S/SW/W/NW. Neither candidate has an identified containing deployment or native capture yet, so deployed/observed coverage is not claimed. Two-key terminal transitions supply usable endpoint feedback, not smoothly articulated defeat.

Read [PR225's shared loader contract](sprite-atlas-contract-v1.md#current-unit-loader-binding-subset) before further exports: role identity, one page/mask, canvas-local pivots/crop offsets, shared world scale and existing clip/state/event timing apply. These exports stay within that subset. The one-line Archer version addition is the only further helper edit for animation owner `01a103d4` to review. No new enum or multiple-heading lifetime ambiguity.

## Ranked retained backlog after both source slices

1. **Infantry delivery/acceptance:** obtain independent review of PR228's exact refreshed candidate head, merge through repository rules, pack a clean source release, identify the containing staging revision, then run the ordinary recipe below. Art owner retains this outcome; parent-owned Railway/Mac routes support identified delivery/capture.
2. **Archer integration/acceptance:** independent exact-head review of the stacked Archer slice, retarget onto refreshed main after PR228 merges, resolve conflicts, rerun proportionate checks, then own the same release/deployed/native steps through paid Range production. It is wired into default candidates and packaging, not an export-only packet. Native browser sandbox remains unavailable here.
3. **Spearman source gap:** current public pack has only eight idle views and SE walk/attack/defeat. No equivalent directional legacy action source exists. Retain those real keys and 21 missing cells. Next useful input is seven headings of readable short walk/thrust/defeat sequences, supplied with public rights or explicitly authorized local authoring. Do not relabel its SE clip or borrow Infantry's round-shield costume as Spearman coverage. No paid rigging/new-generation charges or private-source pixels are authorized.
4. **Polish after function:** smoother loops, more defeat intermediates, costume/finish and team-mask refinement. Do not delay usable direction coverage for this work.

## Ordinary-game acceptance

At a named served source/release SHA, enter Millrace or Terraced Vale through Create Room and normal map selection, without art query flags. Use both seats and normal paid Barracks Infantry production. For Human Infantry capture idle, move/Stop/resume, attack/fresh attack and lethal defeat along N/NE/E/SE/S/SW/W/NW. Verify the actual direction's keys advance, wind-up/strike ends at 850 ms, a new event restarts, terminal corpse clamps and fades, and selection clearing/fog/strategic LOD do not freeze state. Inspect planted roots and spear/shield readability at ordinary zoom; verify the gold-tunic costume and sash tint on the containing build. Include enemy views through disclosed fog. Save chronological clips with SHA, map, seat, action, heading and selected/unselected status.

A release/hash/CPU pass is a milestone. Review, deployed identity and actual in-game function remain incomplete until recorded here; there is no cosmetic approval gate.
