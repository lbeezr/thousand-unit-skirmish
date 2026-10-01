# Exposed woodland soil comparison — 1 October 2026

Eight full-game captures use copied Underbough Rootways and Bellweather Millrace
maps with a 64-cell irregular forest-floor study on exposed ground near the home
settlement. `study-proof.json` verifies every study cell is unblocked and every
non-paint map field matches the shipped input. Normal maps are not changed.

The single/mixed ordinary Underbough pair was inspected. Mixed rendering is
slightly darker with quieter litter; the difference is modest at this zoom.
The transition from the study patch to grass remains abrupt in places. This is
evidence for improving terrain transitions, not a finished landscape claim.
Mixed mode enables existing clearing variants as well as woodland variants.
Bellweather is the unchanged regional control. Required texture loading, cache
isolation and unchanged study definitions passed; browser errors were empty.
No hosted deployment, performance or gameplay balance evidence is claimed.

Reproduce with `RTS_QA_SOIL_STUDY=1 RTS_QA_GROUND_VARIANTS=1` and explicit
`RTS_QA_URL`/`RTS_QA_EVIDENCE` on an isolated server. The helper paints copied
maps, replaces overlapping row-run paint, and saves the exact study inputs.
