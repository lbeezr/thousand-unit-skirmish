# Terrain candidate readiness — 3 October 2026

[Ranked workstream backlog](asset-adoption-checklist.md#terrain-workstream-backlog)
· [Painted-ground acceptance](qa-painted-ground-atlas-adoption.md)
· [Resource source candidate](../assets/environment/frontier-resource-atlas-v1-candidate/README.md)
· [Cliff review pilot](../assets/environment/frontier-cliff-pilot-v1/README.md)

Owner: terrain art integration workstream. Inspected from main `4467986`.
This slice adds a read-only source pixel check, its failure-injection tests and
the normal npm entry point. It changes no runtime selector, gameplay rules,
art bytes, source publication or paid-provider workflow. Tool acceptance is the
actual report and failures below; a game deployment is not required for this tool.

## Source inspection and selected slice

The seven resource PNG pages and their manifests already pass the generic
sprite-atlas validator. A direct reconstruction of the committed crop rectangles
and canvas offsets matches all eight oak/berries full/worked/low/depleted frames.
The static imagery was inspected: oak becomes a stump, while depleted berries
retain leaf/wood structure. These are existing project derivatives; no new art
was generated. Bottom-center pivots are labelled `unreviewed-estimate` on all
eight frames. There are no runtime page encodes/hashes. HSV partitions preserve
pixels but do not establish foreground/background depth around an actor.

The builder checks layers before packing and records `visibleRgbaReconstruction`.
The new `npm run validate:resource-atlas-pixels` checks the pages that actually
exist after packing, their referenced crops and offsets, and the original source
lineage. It detects an RGB-only edit even when alpha and updated file hashes agree;
Pillow's RGBA bounding-box default would hide that kind of difference if only
the alpha channel were considered. No existing art was found corrupted.

The report verifies seven page hashes/dimensions, eight source hashes,
transparent-RGB zeroing, source/fallback equality, non-overlapping layer alpha,
exact RGBA recomposition and alpha bounds at the declared threshold 96.
It records manifest/lineage hashes, eight unreviewed pivots and
`runtimeReady: false`. It does not resolve those review decisions. Run:

```sh
node scripts/validate-sprite-atlas.mjs assets/environment/frontier-resource-atlas-v1-candidate/manifest.json
npm run validate:resource-atlas-pixels
python3 scripts/resource-atlas-pixels.test.py
```

Python 3/Pillow are required; the optional `game-dev` CLI is absent here and is
not needed by this source check. Hosted Node CI does not install Pillow; no
unavailable Python check is added to that workflow. The implementation PR records
the exact tested/reviewed source and command results.

## Cliff findings and retained boundary

All sixteen cliff runtime color/depth files match their recorded SHA-256 hashes
and decode at 640 × 640; their combined encoded size is 1,028,670 bytes.
The eight-view pixels and current pilot consumer were inspected. The manifest's
normalized size is 4 × 0.998 × 1.306 world units: a low ridge, not a replacement
for the taller existing cliff artwork. Repeated joins, corners, caps and variants
remain unresolved. Static file integrity does not establish terrain registration,
foliage depth or GPU cost. The source GLB remains offline authoring material;
the existing pilot and normal obstacle consumers are unchanged.

## Painted-ground followthrough

Railway read-only deployment/state inspection at about 22:47 UTC identifies active
staging SUCCESS `29d74cac-b078-4a88-8f2a-e3141a2f9465`, one running replica,
platform source `32f11d58018404835fd47489441f9cdfef7c403b`. Git ancestry proves
that source contains painted-ground merge `7193c4ba74376c592c57804537f072a33d7146aa`;
the ground implementation files match this inspected main checkout. This is
platform/source delivery evidence, not authenticated asset-byte or GPU evidence.

A direct staging manifest request failed at the execution network's CONNECT
tunnel with response 403 and no origin HTTP status. No claim about the server's
asset response follows from that failure. The sandboxed Chromium preflight still
reports `sandbox-unavailable` with writable XDG directories. Zero game screenshots
were captured; no sandbox-disabling flags were used. The parent staging/Mac
coordinator must run the existing ordinary-game/zoom recipe and hash checks in
the authorized user environment; terrain integration retains acceptance ownership.

## Next selection and stop boundary

After this tool slice merges, the highest-value next action is painted-ground
normal/strategic/closest-zoom evidence at the identified staging revision. That
action is blocked in this executor by browser startup and the staging HTTP tunnel.
Resource default adoption still needs a reviewed ground registration/export
contract; a passing pixel report cannot select a different default resource design
or prove the HSV layers' semantic depth. Cliff binding remains blocked by the
module/height/join/cap contract. No further automatic candidate runtime binding is
justified by the inspected evidence. Keep these items open, with the receiving
owners and smallest next actions in the ranked backlog; continue when the missing
execution or accepted contract becomes available.
