# Building lifecycle transition admission — 7 October 2026

Owner: delegated building-lifecycle lane, retaining this technical slice through
reviewed source publication. Inventory base: `7df6b20404b3e480c6b1a4a82f8adfcac5c1f02c`.
This is validation evidence, with no new art, model transfer or visual pass.
Art backing: N/A; no presentation behavior or pixels change.

## Actual default coverage

The inventory follows `BUILDING_DEFINITIONS` through the normal
`frontierBuildingManifestUrl(type)` selector, then reads each actual manifest.
All captured families have eight registered azimuths, at 45-degree increments.

| Default family | Declared states | Captured frames | Matching missing state/view cells |
| --- | --- | --- | --- |
| Town Center, House, Storehouse, Stable, Workshop, Watchtower | Complete only | 48 total | 192 total: Foundation, Frame, Damaged, Critical × eight views × six families |
| Barracks, Archery Range | Foundation, Frame, Complete, Damaged, Critical | 80 total | 0 |
| Mill, Dock | Foundation, Frame, Complete, Damaged, Critical | 80 total | 0 |
| Farm | Five lifecycle states plus Exhausted, Exhausted Damaged, Exhausted Critical | 64 | 0 |
| Palisade Wall, Palisade Gate | Procedural; no default captured manifest | 0 | Separate topology/open-state production contract |

Total default captured coverage is **272 frames in eleven manifests**.
[PR550](https://github.com/lbeezr/thousand-unit-skirmish/pull/550) already delivered
the 64 military non-Complete frames; this slice does not reproduce them.
Destroyed building removal still disposes its visual group; no persistent ruin
or collapse state is supplied or counted. Eight captures establish recorded
rotation coverage, not visual recognition or clearance acceptance.

## Available sources and dependencies

The six Complete-only families have approved Meshy provenance in their
scale-pilot/support packs, but their recorded `sourceModelPath` files are absent
in this cloud checkout. The registered Mill/Farm/Dock original GLBs are also
absent here; those families already have admitted lifecycle pixels. Older tracked
construction samples are different designs and do not fill the six matching gaps.
Military source recipes/provenance are available, with their matching runtime
states already delivered. No private GLB or Blend is added to this PR.

The next source priorities remain Town Center, House, Stable, Workshop,
Storehouse, Watchtower. Recover each existing approved source privately under its
specific transfer/publication authority, then derive registered states while
preserving the eight approved Complete images. Town Center's blocked transfer
is not retried here. No Mac or alternate transfer route is used.

The [Coastal workstream](coastal-barrier-art-workstream.md) owns preserved private
barrier candidates: Wall needs sixteen connection masks; Gate needs a separate
one-cell open/closed treatment with a clear center and current axis rules.
Public defaults remain procedural. Their publication conditions and lifecycle
extensions stay separate from the six missing family sources.

No new Meshy job is proposed: approved existing source recovery is the needed
input, and unavailable cloud bytes do not establish missing original designs.
No paid calls or credit spend occurred. Historical 30-credit economy tasks and
175-credit old Town Center spend are not current per-job quotes. If an original
is confirmed unrecoverable, first obtain a free current quote for that single
family/state proposal and its painterly textured reference; generation still
requires the user's explicit credit approval.

## Admission correction and acceptance

Previously metadata admission accepted reversed health bands, nonfinite or
out-of-range values, numeric strings and malformed mapping containers. A
foundation threshold of one makes Frame unreachable; a Critical threshold at or
above Damaged removes the Damaged interval. Zero silently uses the renderer's
`||` default rather than its declared threshold.

The validator now requires supplied thresholds to be finite numbers strictly
between zero and one, and effective Critical < Damaged. Omitted values keep the
existing renderer defaults (.275 construction, .3 Critical, .6 Damaged), including
when checking a partially declared mapping. Valid custom bands remain supported.
CLI, adoption audit, military transfer and Complete metadata preservation all
consume this existing validator. The renderer and every manifest remain unchanged.

The new negative controls first failed against unchanged validation: three of
thirteen lifecycle tests failed, including CLI exit zero for reversed bands.
Exact-head focused/static results and independent review belong to the PR.
The focused controls also read all eleven default manifests and the retained
different-design Town Center lifecycle fallback. They verify metadata admission;
they do not establish browser rendering, mask alignment or state appearance.

Runtime packaging is unchanged; this script is development tooling. Clean release
identity is recorded separately in the PR. No provider deployment or real-game
verification is claimed for this internal correction. The remaining art outcome
requires admitted matching sources, default use, exact served bytes and actual
construction/damage/repair/removal observations on an identified containing build.

Proposed canonical update for the coordinating parent: reconcile the atlas plan's
historical 256 missing views to **192** after PR550; retain the six source
dependencies and separate wall/gate contracts. Shared roadmap and adoption
documents are deliberately not edited by this lane.
