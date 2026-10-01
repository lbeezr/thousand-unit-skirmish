# Sunbloom worked-state integration · 1 October 2026

[Full](sunbloom-views-close.png) and [worked](sunbloom-views-worked-close.png)
capture all four headings at identical pivots through the actual instanced
material. Fixed camera direction (0.78,1.12,0.78), 45° azimuth, 45.435902° elevation
and registered 0.88654×0.85 cards remain. Worked foliage is thinner and exposes
more copper stems, while lapis flowers and basal crowns remain readable. No
obvious crown jump appears at this scale; anatomical registration remains
uncertified. Source-coordinate pairing uses one common canvas/scale per pair,
not independent silhouette fitting after foliage removal.

[Frame proof](sunbloom-views-proof.json) checks 80 instances across four headings
at stocks 5/3/2/1/0/6 (480 transitions), selecting worked for positive partial
stock, hiding at zero and restoring full at six. Every positive transition
retains exact matrices/heading and expected UVs. Selection repeats; no mirroring
or card roll is introduced; GL succeeds; legacy single-view mode loads.
[Garden proof](garden-proof.json) retains 15 independent beds (nine Sunbloom,
six vine), two batches and parent-clearing independence.
[Plant contracts](plant-contract-proof.json) cover 27 plants and 22 companion
identities; [occupation](forest-cover-proof.json) covers nine categories and
foundation restoration. No gameplay rule changes.

Ordinary full-copy release packaging failed with ENOSPC; the incomplete context
created by this run was removed. A native macOS `cp -c` snapshot test matched
source bytes, and modifying the snapshot left its source unchanged. The packer
now requests native cloning on macOS, falling back to ordinary copying on
failure/other platforms. Full release packaging then passed.
[Release proof](release-proof.json) verifies exact server/environment/config/atlas
bytes. Native copying still produces isolated files, not hard links to mutable
sources. Temporary test and release files were removed.

The isolated browser completed with no reported errors before disk exhaustion;
the subsequent local room shutdown logged checkpoint-write ENOSPC errors. Its
workers were stopped. This is local appearance/lifecycle evidence, not a hosted
or performance measurement. Distinct low/depleted flower art and independent
flower gathering remain absent.
