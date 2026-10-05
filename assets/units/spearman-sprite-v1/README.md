# Human Spearman partial animation pack

Pack 0.8.0 preserves all 48 existing registered poses and adds four locally authored Southwest walk keys from the already-public painted Southwest seed. SE/NE/East/North/South walks, SE attack/defeat and all eight idle facings remain unchanged. Southwest uses four 200ms contact/passing keys, one 800ms loop, existing body calibration and padded original pivot. Two walk headings, seven attack and seven defeat headings remain missing (16 cells).

Page dimensions remain 2048x3200; the encoded zero team mask is unchanged. All prior page RGBA outside the four formerly empty Southwest slots stays exact; old frame rectangles/pivots and scale remain fixed. No matching 3D master, provider job, held v2 art or state/simulation change is involved.

Selected source/provenance: `docs/art-direction/human-roster-v1/extracted/spearman/walk/south-west-local-v1/registration.json`. The full builder replays baseline, NE, East, North, South and Southwest; older append scripts intentionally guard their construction stage. Exact original packed textures/UVs differ from CPU-resampled rendering, whose upper pixels stay frozen between keys. All private process and art iterations remain retained. Ordinary GPU gait, support-foot speed, normal/strategic/crowded appearance and deployed acceptance remain pending.
