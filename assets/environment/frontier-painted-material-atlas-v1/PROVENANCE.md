# Provenance

The atlas uses only the original, project-owned ground paintings listed in `manifest.json`: `meadow`, `short-grass`, `long-grass`, `forest-floor`, `dirt`, `sand`, `scree`, and `cinder`. Their source PNGs and original prompts are documented in [`../frontier-v1/PROVENANCE.md`](../frontier-v1/PROVENANCE.md). No third-party imagery, held unit/building pack, berry source, or external model provider is used.

`scripts/build-painted-material-atlas.py` resizes each source to 512 × 512 with Pillow LANCZOS, creates mirrored edge gutters, packs the materials row-major, and builds each mip from independent material slots. The manifest records every source and generated runtime file hash and image size. Rebuild with the pinned Pillow version to reproduce the checked-in outputs byte-for-byte.
