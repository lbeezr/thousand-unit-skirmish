# HUD component specimen

Source-only Obsidian comparison for the user's requested **52px compact versus
72px expressive portrait** review. The runnable entry is the preserved
[standalone specimen](../../../docs/art-direction/hud-design-system-2026-10-11/component-specimen.html).
The live game imports none of these files. No production HUD is replaced.

`specimen.html` is the literal visual template; `runtime.mjs` supplies local fixture
interactions; `scripts/build-hud-component-specimen.mjs` imports canonical game definitions and emits a single
inline fragment. To rebuild, supply an output path:

```sh
node scripts/build-hud-component-specimen.mjs /absolute/output/hud-component-specimen.html
```

The build also writes a sibling provenance JSON with the source revision and
input hashes. The visualize skill's standalone renderer supplies the preview
wrapper and variant navigation; the fragment itself is the inline review source.
This is a separately runnable study, not a new runtime entry or release asset pack.

## Real data and simulated state

- Costs, products, research, durations, population, health and capabilities come
  from `src/gameplay-definitions.mjs`, including its Farm/Palisade dependencies.
- Production and research eligibility use the source functions from
  `src/rules/production-actions.mjs`, `research-actions.mjs` and
  `gameplay-action-rules.mjs`. Training/research cancellation uses
  `src/rules/base-lifecycle.mjs`'s `unfinishedRefund` function.
- Four stance labels/hints come from `src/combat-stance-ui.mjs`; bindings and
  formations are extracted from `index.html`. The builder checks the server and
  client queue limits agree. Worker capacity is extracted from `server.mjs`.
- Resource balances, owned counts, cargo, selection, health state, queue progress,
  research progress and connection loss are fixtures, not a live match. Step +6s
  advances only local training/research. Placement validates fixture costs and
  requirements; no geometry, pathfinding, combat or actual server acceptance is
  simulated. The pending cue uses a local 420ms delay, not measured latency.
- Selection, balance, queue and disclosure state are shared across the two
  portrait variants. Changing the Match state fixture resets local progress.
  Runtime keyboard/camera parity and ordinary-game acceptance remain future work.

## Art sources

The four local assets are unchanged copies of derivatives already retained in
the task's 11 October visual explorations. No new images were generated or edited.

| Study file | Original source and treatment |
| --- | --- |
| `assets/worker.png` | [Human Worker](../../../assets/ui/portraits/human-worker-source.png), previously downsampled to 480px wide; CSS uses the canonical source crop proportions. |
| `assets/infantry.png` | [Human Infantry](../../../assets/ui/portraits/human-infantry-source.png), previously downsampled to 480px wide; canonical crop proportions. |
| `assets/barracks.png` | [Barracks view 01](../../../assets/buildings/frontier-civilization-military-models-v1/captures/barracks-complete-view-01.png), existing compressed derivative; CSS uses the documented x212/y246/600 framing. |
| `assets/battlefield.jpg` | Existing compressed derivative of the [generated concept](../../../docs/art-direction/hud-design-system-2026-10-11/battlefield-concept.png); illustrative only. |

Action/resource icons are embedded unchanged from `assets/ui/icons/`; the
[icon provenance](../../../assets/ui/PROVENANCE.md) and
[action-glyph provenance](../../../assets/ui/icons/actions/README.md) retain their
origins. Repair temporarily reuses Build's glyph; final dedicated icon treatment
is not claimed. The Google Fonts stylesheet provides DM Sans and Barlow Condensed
in this study only; production font licensing/self-hosting remains in the plan.

See [the review checkpoint](../../../docs/art-direction/hud-design-system-2026-10-11/README.md#component-specimen--11-october-2026)
for bounded browser observations and limitations.
