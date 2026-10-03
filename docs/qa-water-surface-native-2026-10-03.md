# Native water first-pass review — 3 October 2026

[Surface and live fish contract](water-surface-study.md) · [Art evolution](lore/art-evolution.md)

The Mac QA owner captured real WebGL rendering at
`b96557faf226adfaf6b7edb3c5e06d1d5b140c34` in Chrome 154.0.8037.93,
ANGLE Metal / Apple M2. The supplied `water-visual-qa.json` provenance was read
in cloud. The user then inspected the images and accepted the direction as a
good first pass, authorizing default integration without another approval.

| Check | Recorded native result |
| --- | --- |
| GPU | Surface and ripple programs compiled/linked; captured shader/program logs were empty. The match surface also compiled/linked. |
| Geometry/readability | QA inspected shallows, darker-looking inner water, restrained directional bands, conservative shores and the dry-island hole. The real match pond left units and HUD readable. Apparent depth remains cosmetic. |
| Activity gates | Preview depleted stock, hidden bank and hidden water each stopped ripple draws. These are the fixture's explicit inputs. |
| Reduced motion | Explicit preview control stopped ripples; the study-pane capture was identical at logical times 12 and 16. Native OS preference switching was not exercised. |
| Static fallback | Decoded corresponding panes differed at 13 of 266,400 pixels (0.00488%), with mean absolute RGB channel delta 0.000166. QA found the fallback visually matching. Exact pixel/PNG identity is not claimed. |
| Motion | Study panes changed 4,688 of 266,400 pixels between times 12 and 16; the current static pane changed zero. |
| Draw-rate smoke | QA reported roughly 59.94 draws/second over 81.57 seconds. This is not an incremental overhead benchmark or a scale budget. |

The provenance retains an initial `passed: false` fallback entry from comparing
encoded PNG hashes. Its final review explicitly resolves that inconclusive
comparison with decoded RGB pixels and reports the visual match above. This
record preserves the correction rather than interpreting different file hashes
as a remaining rendering blocker.

Saved Library artifacts are `water-study-time-12-1280x720.png`,
`water-study-time-16-1280x720.png`, `water-actual-match-1280x800.png`,
`water-simple-fallback-1280x720.png` and `water-visual-qa.json`. The comparison
viewport was 1280 × 720/DPR 1 and match viewport 1280 × 800/DPR 1. The cloud
Library image reads returned extracted text only; cloud did not independently
inspect their pixels or copy private image bytes into this repository.

The native match capture predates the real fish adapter and therefore contained
the water surface with zero match ripple instances. [PR #59](https://github.com/lbeezr/thousand-unit-skirmish/pull/59)
then bound current resource snapshots and both visibility cells using the shared
shore placement contract. Its merged tree passed 100 focused/adjacent tests and
the actual two-seat pilot's 776 packet checks through depletion, checkpoint
recovery and rematch. These are state/geometry proofs, not a native fish-cue
recognition result. Default integration changes selection of that unchanged
surface/ripple implementation and keeps static quality/reduced motion; later
fish silhouettes and strategic-zoom readability can improve incrementally.
