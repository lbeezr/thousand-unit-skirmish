# Settlement checks after approved Rootways glades — 1 October 2026

Fork main `71a1610` fails the settlement scenario because its historical
pre-settlement snapshot predates the adopted Rootways glades. The reviewed
layout in commit `3405588` relocated 132 forest cells, retained 1,026 total,
and explicitly kept ground patches unchanged. The shipped map exactly matches
the saved [reviewed candidate](qa-evidence/underbough-wide-glades-2026-10-01/candidate.json).
The [adoption record](qa-evidence/underbough-wide-glades-2026-10-01/README.md)
documents that decision.

The mismatch affects three expectations: exact historical obstacles, margin
paint's distance to trees, and treating retained dense ground beneath relocated
forest as new settlement wear. Of 568 dense-ground cells, 28 exceed the original
2.25-cell margin threshold against the new forest; zero exceed it against the
forest used when that paint was authored.

The scenario now checks each layer against its approved contract:

- Blockers must exactly match the adopted candidate; every other non-paint
  field still matches the original historical snapshot.
- Settlement ground still exactly matches deterministic regeneration from that
  snapshot. Town Center pads, mirrored paint and blocked-cell wear checks remain.
- Dense ground must exactly match the adopted candidate's retained patches and
  still satisfy its original meadow/woodland-margin relationship.
- The blocked-cell wear comparison uses settlement paint, so retained dense
  grass is not incorrectly classified as a new working path.

No map, generator, renderer, source fixture or approved candidate was edited.
`node scripts/settlement-authoring-scenario.mjs` passes both maps. In a disposable
archive of fork main plus only the revised test, four independent mutations
each exit 1: an unapproved obstacle, starting food change, dense-ground change,
and settlement dirt change. The unmodified archive exits 0. This verifies the
assertions still reject unintended layout, economy and paint changes.

Full CI and independent review are tracked in the separate fix PR. The Rootways
250-unit gameplay proof remains a separate deliverable.
