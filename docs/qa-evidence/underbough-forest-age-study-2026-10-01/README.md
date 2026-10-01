# Irregular canopy age experiment — 1 October 2026

Eight actual game captures compare existing canopy sizes with the opt-in
`forestAges=irregular` profile on copied Underbough Rootways and Bellweather
Millrace maps. Sources, ground kit, roots and species selection are identical.
Browser errors were empty; renderer texture/cache and unchanged map checks passed.
The ordinary Underbough pair was inspected: varying sizes breaks some repetition,
but prominent roots and branch clutter remain. It is not adopted as the default.
Bellweather does not use the profile.

The profile selects seeded local rank minima among existing jittered canopy
roots within radius 1.6 world units. Mature roots are mutually separated without
a two-by-two grid rule. Their factor is 1.05; remaining canopy factors range
0.65–0.8. Bramble scales and understory density keep their current rules. Every
wood cell remains represented at a positive scale. Factors are applied before
the existing edge/core habitat scale, and remain the slot's clearing/reset scale.
This scale proxy is not anatomically authored sapling art or a new resource rule.

The scenario exercises 900 jittered points: 130 mature selections, minimum
spacing, positive representation, seed sensitivity, order independence and no
input mutation. No hosted deployment, worker-harvest or performance result is
claimed. Future source work should provide quieter crowns/roots and actual young
plant forms; this diagnostic alone does not finish forest composition.
