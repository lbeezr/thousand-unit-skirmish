# Default Infantry walking diagnosis and qualification — 5 October 2026

[Foot-unit workstream](human-foot-unit-coverage.md) · [Production contract](unit-art-production-contract.md) · [Animation evidence](qa-unit-displacement-animation-2026-10-04.md)

Owner: delegated default Infantry lane. Capture owner `01a10378` retains the
identified-build ordinary visual test. Spearman art/attack owner `01a10469`
retains its separate pack. State owner `01a103d4` retains clocks and selectors.
This slice changes acceptance tooling only; no art, gameplay or runtime bytes.

## Finding and exact source gap

At inspected main `f3b655bfe71617222ad1f540a6826e8683f20f41`, the actual no-option
Human Infantry selects `infantry-sprite-v3`, pack **0.5.0**. The eight 100 ms SE
walk keys loop in 800 ms. The seven other walk clips select their own single idle
frame: **N, NE, E, S, SW, W, NW**. World SE projects screen-right at the normal
camera. Movement/facing/clocks can work while those seven headings visibly slide.
Worker `cast-human-sprite-v3` and Spearman v1 are different actors; their 8/8 source
walk coverage does not establish anything about Infantry.

Actual source pixels were viewed in the pinned
[approved idle sheet](art-direction/human-roster-v1/source/infantry-idle-facings.png),
[SE walk sheet](art-direction/human-roster-v1/source/infantry-walk-south-east-v1.png),
and [older v1 sheet](../assets/units/infantry-sprite-v1/infantry-atlas-source.png).
The approved family has cream/sage clothing, short spear, six-sided shield and
expressive open face. Its other seven facings are flattened standing images;
they provide neither articulated walk keys nor editable separated body/equipment
layers. The old sheet changes to a gold costume/round shield. The Meshy v2 bake
has motion but omits the spear/shield. Held v4 and PR25/230/241 are not adopted.
All original source/registered poses and identity pins remain unchanged.

**Next input:** a faithful NE walk strip for this exact Infantry, preferably
contact/passing/contact/passing at four 200 ms keys, or a layered/rigged master
with this exact character/equipment, frozen camera and ground/root recipe.
Maintain the existing body/world-pixel calibration and shield occlusion/handedness;
review the entire short loop at game size before default admission. Then fill
N/E/S/SW/W/NW in small increments. A flattened standing seed alone cannot supply
occluded surfaces or prove a faithful articulated cycle. This task uses no crude
geometry, idle relabelling, paid/provider job, private source publication or
character substitution. **Seven walk cells and 21 total Infantry action cells
remain missing.** Source absence blocks art production, not acceptance tooling.

## Completed acceptance-tooling slice

The CPU temporal scenario now evaluates the real no-option roster from `main.js`
and runs **Worker, actual Infantry and Spearman** through the committed client
interpolation/update loop, selector, continuous clock, instanced UVs and decoded
registered source pixels. Its 96 rows cover eight directions, both teams and
normal/strategic detail. Infantry has 1/8 genuine source walks; its seven idle
holds are explicitly `incomplete-art-correct-facing`. Source coverage compares
registered RGBA and alpha, so renamed keys, atlas relocation or repeated idle
pixels cannot manufacture a gait. Frozen clocks/UVs, wrong facing, duplicate
source cells, stale transforms and false aggregate completeness are rejected.
Real Infantry runtime controls also verify Stop and a fresh resume clock/phase.
These CPU controls prove wiring/time/frame semantics, not GPU gait quality.

A separate registered **`infantry-animations`** ordinary capture case reuses the
existing Worker/Spearman observer and runner contract. The original
`worker-animations` case still selects Worker/Spearman and retains its report
shape. The shared observer now includes Infantry; generalized military production
selects 50-food/0-wood Infantry or the existing 60-food/20-wood Spearman. No state,
protocol, capture-context version, transport, scene mutation, timeout or capture
limit changes. Both cases stay at 51 captures under the existing 64 limit.
Each case requires exactly one row for every observed actor/heading; seven static
Infantry gait checks remain false even when Move and Stop succeed.

Normal entry is Create Room → default Tiny Terraced Vale / Skirmish → two ready
connected seats → paid Worker → paid Barracks → paid Infantry. No art flags,
spawns, teleports or movement overrides. The observer reads immediately after
the actual render, retains draw texture/UV/matrix, elapsed clock, registered root,
source pixels and real displacement, and takes same-frame canvas/WebGL2 readbacks
plus separately labelled viewport images. Source manifests/textures must match
the exact clean pack. It records the build digest/source, not an inferred staging
revision. Captures still need visual inspection for occlusion, identity, gait,
planted support feet and actual-size readability.

```sh
node scripts/renderer-feature-capture.mjs --check infantry-animations
node --test scripts/renderer-infantry-animation-scenario.test.mjs
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/infantry-temporal
# Capture owner: existing Ordinary game capture workflow, prepared exact ref,
# cases=infantry-animations; retain and inspect the private PNGs before expiry.
```

The capture owner consumes the same version1 context and new registered case;
Spearman source/manifests/gates are untouched. This tracked contract is the
shared integration artifact; direct cross-thread tools are unavailable here.
Do not replace or redispatch the capture owner's already identified build test
as an uncoordinated status request. Keep its current ownership and source identity.

## Verification boundary and retained blockers

Focused CPU suites, type checks, default identity/production checks and actual
adapter loading passed in the implementation workspace. Exact-head review,
clean package/HTTP receipts and PR evidence are retained with the delivery.
The source audit still accurately declares 21 missing Infantry action cells.
No original approved pose or source hash was changed.

The one normal-sandbox cloud
[capability attempt](qa-evidence/default-infantry-walk-2026-10-05/renderer-capability.json)
at `f3b655bf` was blocked (`sandbox-unavailable`, `storage-unavailable`): **zero
WebGL2 readbacks, game frames or screenshots**. No retry/security bypass or Mac
path was used. The source contact-sheet preview is private Library evidence only.
It is not a rendered frame. Actual identified-release Infantry playback and
containing deployed revision remain incomplete with capture owner `01a10378`.
The delegated Infantry lane retains the art input gap and subsequent default
heading admission; no claim that all walking is fixed is made.
