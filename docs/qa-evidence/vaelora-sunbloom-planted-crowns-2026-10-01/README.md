# Sunbloom planted-crown refinement · 1 October 2026

The [preceding root-fan capture](../vaelora-sunbloom-authored-views-2026-10-01/sunbloom-views-close.png)
made the flowers appear uprooted. The [new crown capture](sunbloom-views-close.png)
replaces hanging roots with compact copper stems and basal green leaves. Both
use the same four world pivots, registered 0.88654×0.85 cards, fixed camera
direction (0.78,1.12,0.78), 45° azimuth and 45.435902° elevation. The new base reads
as a growing garden plant; the lapis flowers and four heading identities remain
recognizable. Removing the root fan shortens the painted silhouette without
enlarging each view. This is visual contact improvement, not anatomical root
registration or exact pixel preservation of the old upper foliage.

[Heading proof](sunbloom-views-proof.json) checks 80 instances across four
headings at stocks 5/3/2/1/0/6 (480 transitions). Positive stock retains full,
zero hides, and reset restores exact matrices and UVs. Direction choice is
repeatable; no mirroring/card roll is introduced; GL renders and legacy mode
loads. The historical `workedLifecycleChecks` field counts stock tests, not
worked flower drawings.

[Garden proof](garden-proof.json) retains 15 beds (nine Sunbloom, six vine), two
batches and clearing independence. [Garden capture](garden-ordinary.png) and
[mixed understory](understory-renderer.png) show the existing composition.
[Plant contracts](plant-contract-proof.json) cover 27 plants and 22 companion
identities, clearing/reset and ground height. [Occupation](forest-cover-proof.json)
covers nine categories and foundation restoration. No placement, yield,
collision or gathering rule changes.

[Release proof](release-proof.json) verifies exact server/environment/config/atlas
bytes in the Docker context. The export checker verifies source/reference hashes,
extraction records and exact decoded alpha. Browser, supervisor and temporary
release context were stopped. The isolated Bellweather baseline reports no
browser errors. These are local appearance/lifecycle checks, not hosted or
performance measurements. Source-authoring angles and anatomical crown location
remain approximate; worked/low flower artwork remains absent.
