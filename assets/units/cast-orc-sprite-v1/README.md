# Orc cast sprite review pack

This exploratory four-cast readability pack supplies a default Worker variant by user direction. It
contains 264 frames across eight directions, with idle, walk, attack/work, and
defeat clips plus a grayscale team-accent mask.

Human, orc, elf, and troll variants are assigned across Worker slots in the normal game. Each Worker keeps its assigned appearance. Infantry and Archer retain their existing visuals; `?castPreview=0` restores the previous Worker.

The pack is a runtime candidate for visual review only. Shared motion scaffolds,
foot registration, identity consistency, and small-scale readability still need
human review before production use. See `PROVENANCE.md` for the source and
rights boundary.

The v0.3 runtime recovers all 264 complete poses from retained original directional sheets before packing. Nominal cells are layout hints, never crop boundaries. A shared motion envelope, eight-pixel margin and standing root preserve animation offsets; no poses are held or substituted. `clipping-review.json` records source hashes and extraction bounds. Rebuild with `python3 scripts/recover-cast-sprite-sheets.py --write assets/units/cast-orc-sprite-v1`. Art identity and motion remain exploratory.
