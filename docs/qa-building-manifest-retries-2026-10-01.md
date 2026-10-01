# Captured-building manifest retries — 1 October 2026

Baseline: fork main `dfca7f66b9fccf41511a86b9ced4b3bfbed5b09d`.
The [art binding audit](qa-art-runtime-contract-audit-2026-10-01.md) found six
Complete-only local preview families absent from Docker. Shipped `src/main.js`
references them only behind `frontierBuildingsPreview=1`; normal URLs use the
existing assets. A packaged authoritative server returned 404 for all six
preview manifests and sampled front views while default building assets passed.
No hosted asset batch or preview promotion is part of this repair.

Previously, each failed manifest fetch was removed from the shared cache and
the sprite cleared its pending request. Five controlled renderer updates after
HTTP 404 therefore issued five requests. Now all sprites using one canonical URL
share its attempt and retain failures. HTTP 404 waits for explicit invalidation;
network, HTTP 503 and invalid-schema failures admit a new shared attempt on the
first update at least five seconds after failure. No timer or background poll
runs. Loaded manifests keep the existing successful rendering path.

`invalidateCapturedBuildingManifest(url)` retires the cached attempt. On their
next update, live consumers of that URL reset to fallback and share one fetch
using `cache: 'reload'`, including previously successful consumers after an asset
change. Call it only for a deliberate retry/asset change; omitting the URL targets
the existing default Town Center manifest. Other manifest URLs remain unchanged.
Old manifest/frame completions and disposed sprites cannot alter visible artwork
or warnings. Frame SHA-256 verification and lifecycle mappings remain intact.

```sh
node --test scripts/captured-building-manifest-retry.test.mjs \
  scripts/captured-building-state-race.test.mjs scripts/frontier-building-renderer.test.mjs \
  scripts/building-sprites.test.mjs scripts/ci-sharding.test.mjs
```

Deterministic promise barriers and a controlled clock cover repeated 404s,
shared cooldown boundaries, eventual transient recovery, explicit fresh retry,
changed successful content, distinct URLs, stale success/failure, disposal and
pending old frames. Existing lifecycle/source tests retain fallback, repair and
admission coverage. These are loader/HTTP integrity checks, not browser appearance,
player readability, creative acceptance or performance measurements.
