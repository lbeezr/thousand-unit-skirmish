# Underbough authored young-tree renderer study · 1 October 2026

`?forestAges=young` uses the existing seeded spacing ranks, replacing smaller
hornbeam silhouettes with the authored young hornbeam at the same wood-cell
roots. Oak/plum/copperleaf retain their scale experiment. Default forests and
other regions do not use the study.

[Fixture](capture.html) uses the real obstacle sprite renderer and source
Rootways map, with a fixed local camera and plain backdrop to isolate foliage
and root overlap. It is not a full-match screenshot or worker harvesting test.
[Proof](proof.json) retains all 1026 wood owners: 402 young hornbeams, 66 mature
hornbeams, 395 oaks, 59 plums, 51 copperleaf and 53 brambles. Source map is
unchanged. Texture readiness, all young atlas stock rectangles at 6/3/1/0/6,
and finite transforms passed. Reset screenshot pixels equal the full image.
Native Chrome capture completed with no reported errors.

[Original](uniform-6.png) and [young study](young-6.png) were inspected. The young
collars reduce some lower-root repetition, but mature branch clutter remains.
The first draft replaced all smaller species and made 80% of trees one
hornbeam form; it was rejected before publication. The corrected binding
keeps young forms within hornbeam groves. This is an opt-in production study,
not adopted default beauty. Other species need genuine young anatomy and
full-game appearance review remains. All lifecycle frames use one painted
view; no new rotated perspectives are claimed.
