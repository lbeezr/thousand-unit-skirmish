# Human Worker South walk — first pass

Approved reference: the already-public default `human` frame `idle-south-0`,
extracted at its fixed registration in [seed provenance](seed-provenance.json).
South is world -Z and screen-up-right under the fixed game camera.

The user authorized bounded first-pass image tools after actual current and
legacy source inspection found no same-character South walk strip. Built-in
ImageGen used [the full prompt](prompt.json), [seed](approved-idle-seed.png) and
[layout reference](edit-reference.png). No external paid provider/rigging job or
private-source pixels were used. [Raw iteration 1](raw.png) is preserved exactly;
[connected-silhouette extraction](extracted/extraction.json) discards alpha<9,
consistent with the runtime alpha test. Transparent RGB in the raw image is
not a visible background. All eight whole characters are source-edge clear.

[Deterministic registration](../../../../../scripts/admit-worker-south-walk.py)
uses shared scale 232/455, fixed column roots [224,608,992,1376], two layout
baselines [489,979] and local pivot [128,244]. It preserves source motion offsets
without per-frame scaling/centering. Eight 100 ms keys loop in the default Human
v3 atlas; Carry/Return uses the same walk and existing cargo cue.

The green vest, cream sleeves/sash, dark hair, axe, backpack/bedroll and actual
South facing match the seed. Eight distinct leg/arm/tool poses form a usable
rough loop. Frame drift and the loop seam remain polish
items; the user prioritizes functional breadth. [Iteration review](iteration-review.json)
and [ordinary/strategic key sheet](../../../../qa-evidence/worker-land-art-2026-10-04/south-walk-keys.png)
are source-pixel reviews. Actual game root/turn/cargo appearance remains open
pending an identified containing native/deployed build. Existing art iterations
are unchanged; this directory is a retained additive source iteration.
