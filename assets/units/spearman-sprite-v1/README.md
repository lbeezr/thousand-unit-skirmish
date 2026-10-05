# Human Spearman partial animation pack

Pack 0.10.0 preserves all 56 existing registered poses and adds four locally authored Northwest walk keys from the already-public painted Northwest seed. SE/NE/East/North/South/Southwest/West walks, SE attack/defeat and all eight idle facings remain unchanged. Northwest uses four 200ms contact/passing keys, one 800ms loop, existing body calibration and padded original pivot. Seven attack and seven defeat headings remain missing (14 cells).

Page dimensions remain 2048x3200; the encoded zero team mask is unchanged. All prior page RGBA outside the four formerly empty Northwest slots stays exact; old frame rectangles/pivots and scale remain fixed. No matching 3D master, provider job, held v2 art or state/simulation change is involved.

Selected source/provenance: `docs/art-direction/human-roster-v1/extracted/spearman/walk/north-west-local-v1/registration.json`. The full builder replays baseline, NE, East, North, South, Southwest, West and Northwest; older append scripts intentionally guard their construction stage. Exact original packed textures/UVs differ from CPU-resampled rendering, whose upper pixels stay frozen between keys. All private process and art iterations remain retained. Ordinary GPU gait, support-foot speed, normal/strategic/crowded appearance and deployed acceptance remain pending.
