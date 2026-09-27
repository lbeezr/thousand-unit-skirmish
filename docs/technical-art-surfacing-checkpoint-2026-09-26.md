# Technical-art checkpoint — 26 September 2026

[Documentation index](README.md) · [Sprite-atlas contract](sprite-atlas-contract-v1.md)

**Historical scope:** the sprite-atlas schema, validator, preview, and authoring
contract at branch `333769f`, with main `3a52f2c` included. The painted-material
study and GLB runtime integration were separate work.

The recorded validation passed the Archery Range construction manifest with
13 files, one page, and one asset. The branch diff check also passed.

Reproduce package validation with:

```sh
node scripts/validate-sprite-atlas.mjs assets/buildings/archery-range-construction-v1/sprite-atlas-pack-v1.json
```

This establishes manifest/file/bounds integrity. Renderer adoption, pivot review,
appearance, and performance require their own evidence.
