# Technical art and surfacing checkpoint · 26 September 2026

## Sprite-atlas contract slice

- Current main is `3a52f2c` (PR #139, Archery Range sprite atlas). This branch
  includes that main revision.
- The user confirmed that `codex/sprite-atlas-contract-20260926` was published
  to `origin` at `333769f`. The local remote-tracking ref records that head.
- The branch adds the sprite-atlas schema, validator, HTML preview, and authoring
  contract. Cutout sprites remain separate from the painted-material GLB path.
- The independent painted-material study and GLB runtime work are excluded from
  this PR.

## Validation

- `node scripts/validate-sprite-atlas.mjs assets/buildings/archery-range-construction-v1/sprite-atlas-pack-v1.json`
  passed against the current-main Archery Range pack: 13 files, one page, one
  asset.
- `git diff --check origin/main...HEAD` passed after merging current main.
- Validator acceptance establishes manifest, file, and bounds integrity. It
  does not establish renderer integration or appearance approval.
