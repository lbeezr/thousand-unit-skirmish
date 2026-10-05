# Spearman Northwest walk increment — 5 October 2026

[West checkpoint](qa-spearman-west-walk-2026-10-05.md) · [Coverage backlog](human-foot-unit-coverage.md) · [Adoption](asset-adoption-checklist.md)

Owner: Human foot-unit art lane. Animation-state owner `01a103d4` retains selectors/clocks; permitted ordinary-game capture remains with transport owner `01a10378` and parent delivery support. Foot art retains appearance acceptance. Combat/stances and other characters remain separate.

## Own-view source and occlusion-aware motion

[PR479](https://github.com/lbeezr/thousand-unit-skirmish/pull/479) merged West at `7bc13b4190dd2160257281e66afab17fa0bc580d`. This slice inspected Northwest's own registered idle crop, 207×285 with inherited pivot (101,285), and the already-public [Northwest seed](art-direction/human-roster-v1/extracted/spearman/idle/04.png) before authoring. No matching existing approved Northwest walk keys were located. The [registration receipt](art-direction/human-roster-v1/extracted/spearman/walk/north-west-local-v1/registration.json) pins source, contour, masks, reviewed raw CPU outputs, normalized sources and the preceding stage.

The visible boots overlap, so an early rectangular split would cut the solid cuff. Independent source inspection traced the painted occlusion seam through source y228; x143 becomes safe only from y229. Free Blender 4.3.2 CPU authoring uses separate full-width UV planes, a rigid upper through y204, and exact near/far masks below y205. The foreground cuff bridge stays stationary through y220, with the far boot behind it. Near weights span y220–268 and far y205–253. Contacts move near ±16x/∓6y and far ∓12x/±4y; passing lifts are14px near and12px far.

Exact lower-shaft separation at `x > .8*y+7`, y≥205, retains **438 alpha-positive original source samples** (eight fully opaque). Near/far masks retain **2,453/922 alpha-positive source samples**. Every original sample has one owner; recombining upper, far, near and shaft reproduces the entire seed RGBA exactly, with **zero reconstructed pixels**. Packed textures/UVs are source-exact. CPU rendering resamples the original seed RGBA; rendered upper pixels remain frozen across the new keys.

| Interval | Selected own-view key | Motion |
| --- | --- | --- |
| 0–200 ms | [Near contact](art-direction/human-roster-v1/extracted/spearman/walk/north-west-local-v1/00.png) | Near boot advances; far retreats behind the cuff. |
| 200–400 ms | [Far passing](art-direction/human-roster-v1/extracted/spearman/walk/north-west-local-v1/01.png) | Far boot lifts from its retained attachment. |
| 400–600 ms | [Far contact](art-direction/human-roster-v1/extracted/spearman/walk/north-west-local-v1/02.png) | Opposite contact opens the silhouette. |
| 600–800 ms | [Near passing](art-direction/human-roster-v1/extracted/spearman/walk/north-west-local-v1/03.png) | Near boot lifts and returns to contact. |

Independent source review found no functional blockers: complete visible boots/cuffs/shaft, four distinct PNG and alpha≥8 silhouettes, no detached occlusion edge, and **82,800 positive pose-triangle instances**, minimum signed area ratio0.564778646. All420 inspected cuff-bridge vertices remain stationary. A private heading-label typo was corrected only in metadata; original text versions, all actual art files and verification remain retained. One fixed camera/root/scale, canvas320×352 and padding(56,24) give inherited pivot **(157,309)**. Alpha≥8 bounds end at y285/291/297/277, giving24/18/12/32px clearance above that provisional pivot. These image-space values do not prove ground contact.

All source-size and calculated ordinary/useful/strategic sheets, GIF, masks, scripts, packed scene and art iterations remain private and retained. No mirror, borrowed facing, private input, held v2 art, provider/paid job or matching 3D-master claim is involved. Rough usable motion is the source goal; actual planting, speed and ordinary readability remain open.

## Registration and preservation

Default Spearman v1 pack **0.10.0** has **60 frames**: all56 preceding registered frames and four newly authored Northwest keys. Across all walk increments this retains32 original legacy frames and adds28 new own-seed poses; the original SE walk remains its eight real keys. All32 clip entries remain; only `walk|north-west` replaces its own idle sequence. The other31 clips, prior frame records/RGBA, rectangles/pivots and asset calibration stay exact. Four200ms keys form an800ms loop. HeightWorld `1.6722564697265625`, world-per-pixel `0.0052421832906788795` and maximum alpha height319 remain fixed. Normalization changes only RGB beneath alpha zero, preserving every raw visible RGBA and every alpha sample.

Page metadata remains **2048×3200**, and the encoded zero mask is byte-identical. Four disjoint previously zero-RGBA cells receive Northwest keys. All former page bytes outside them remain exact; clearing only these cells reconstructs the preceding whole-page hash. Existing append guards retain complete own-record/timing comparisons and reject any hidden RGBA in new slots. Full builder replays baseline→NE→East→North→South→Southwest→West→Northwest. Older standalone stages guard their reviewed construction boundary.

| Served file | West0.9 bytes | Northwest0.10 bytes | Increase |
| --- | ---: | ---: | ---: |
| Runtime atlas | 2,401,311 | 2,476,162 | 74,851 |
| Zero mask | 6,432 | 6,432 | 0 |
| Manifest | 75,755 | 80,761 | 5,006 |

The served three-file pack adds **79,857 bytes**; the retained source atlas adds another74,851. Texture dimensions and base allocation are unchanged; no measured GPU claim is made. Normal no-option v1 binding, exact HTTP admission and existing release/Docker paths consume the same pack. Runtime/state/protocol/loader, capture implementation, simulation and stances are unchanged.

## Coverage and acceptance

Spearman now has **8/8 genuine own-facing source walks**, up from7/8 at merged West. Source gaps are **14 Spearman /56 military**: attack and defeat × **N/NE/E/S/SW/W/NW**. Infantry/Archer retain21 each. Eight Spearman plus eight Worker walks produce16 animated capture rows and **zero walk gaps**. Historical records/clips stay pinned; earlier whole-page recovery explicitly clears separately reviewed later slots.

**99 focused CPU checks** cover the preserved crops/records/calibration, four source poses/silhouettes, page recovery/mask, inherited depth/terrain behavior, real instanced UV advancement for both teams/selection states, loop/Stop to own idle/fresh resume and load/provenance failure controls. Existing fallback-negative coverage uses an explicitly altered private walk fixture; the real read-only post-render hook exercises the still-missing Northwest attack. Neither fixture reports a missing production walk. Stale or wrongly attributed gaps, frozen keys and wrong heading/clock/transform remain rejected. Deterministic builder/repeats, required repository checks, independent integration review and clean release/HTTP receipts accompany source/default/release milestones.

All **63 original native/deployed cells remain unverified**. Identified containing delivery and ordinary rendered planting, pace, readability, fog/selection/strategic/crowded behavior stay open. Calculated sheets, CPU playback and package/hash checks are not game captures. No denied capture route, sandbox bypass, stopped Mac testing or provider operation is retried.

1. Inspect the retained attack sources, then author one own-view thrust/recovery increment that preserves the painted hands, two-handed grip and long spear. Keep selectors/clocks with `01a103d4`.
2. Produce a matching terminal defeat increment; retain original idle and genuine SE attack/defeat, explicit duration and terminal clamp.
3. Continue established Infantry and Archer action/direction gaps without adopting held replacement identities.
4. Inspect identified default Move/Stop/resume and attack/defeat in actual game frames through the permitted transport route; retain exact source/deployment identity and foot-art acceptance.
