# Human Worker North walk — first pass

Approved reference: the already-public default `human` frame `idle-north-0`,
extracted at its fixed registration in [seed provenance](seed-provenance.json).
North is world +Z and screen-down-left under the fixed game camera.

The user authorized bounded first-pass image tools after actual current and
legacy source inspection found no same-character North walk strip. Built-in
ImageGen used [the full prompt](prompt.json), [seed](approved-idle-seed.png) and
[layout reference](edit-reference.png). No external paid provider/rigging job or
private-source pixels were used. [Raw iteration 1](raw.png) is preserved exactly;
[connected-silhouette extraction](extracted/extraction.json) discards alpha<9,
consistent with the runtime alpha test. Transparent RGB in the raw image is
not a visible background. All eight whole characters are source-edge clear.

[Deterministic registration](../../../../../scripts/admit-worker-north-walk.py)
uses shared scale 232/438, fixed column roots [192,576,960,1344], two layout
baselines [478,960] and local pivot [128,244]. It preserves source motion offsets
without per-frame scaling/centering. Eight 100 ms keys loop in the default Human
v3 atlas; Carry/Return uses the same walk and existing cargo cue.

The green vest, cream sleeves/sash, dark hair, axe, backpack/bedroll and actual
North facing match the seed. Eight distinct leg/arm/tool poses form a usable
rough loop. The planted forward leg, frame drift and loop seam remain polish
items; the user prioritizes functional breadth. [Iteration review](iteration-review.json)
and [ordinary/strategic key sheet](../../../../qa-evidence/worker-land-art-2026-10-04/north-walk-keys.png)
are source-pixel reviews. Actual game root/turn/cargo appearance remains open
pending an identified containing native/deployed build. Existing art iterations
are unchanged; this directory is a retained additive source iteration.
