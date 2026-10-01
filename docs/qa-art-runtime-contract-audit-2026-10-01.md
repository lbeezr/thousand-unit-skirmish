# Art runtime contract audit — 1 October 2026

Baseline: verified `lbeezr/thousand-unit-skirmish` main `25488c8ebf89fbf6a5f56691a2d7ba446bb607eb`,
including merged audio PR #13. This is source/contract evidence, not a browser
appearance acceptance.

## Units already bound

`src/main.js` selects Human for team zero and Boughward for team one on normal
URLs. `civilizationSpriteRole`, `spriteDirectory` and `spriteActionClip` in
`src/unit-sprite-runtime.mjs` resolve the following existing packs:

| Role | Human pack under `assets/units/` | Human frames | Boughward pack | Boughward frames |
| --- | --- | --- | --- | --- |
| Worker | `cast-human-sprite-v3` | 80 | `boughward-worker-sprite-v1` | 8 |
| Infantry | `infantry-sprite-v3` | 32 | `boughward-infantry-sprite-v1` | 4 |
| Spearman | `spearman-sprite-v1` | 32 | `boughward-spearman-sprite-v1` | 4 |
| Archer | `archer-sprite-v2` | 32 | `boughward-archer-sprite-v1` | 4 |
| Scout | `scout-sprite-v1` | 4 | `boughward-scout-sprite-v1` | 4 |
| Rider | `rider-sprite-v1` | 4 | `boughward-rider-sprite-v1` | 4 |
| Siege Engine | `siege-engine-sprite-v1` | 4 | `boughward-siege-engine-sprite-v1` | 4 |

All 14 manifests validate, including 42 declared file hashes. All required
actions resolve at eight headings via existing approximate-direction reuse;
Worker includes food/wood gathering, construction and repair. The server routes
and Docker COPY/ignore rules include all 14 manifest/atlas/mask triples.
Directional motion, authored team masks, mounts/siege scale, ground registration
and fresh in-game appearance remain unfinished or unverified. The
[Human](art-direction/human-roster-v1/README.md) and
[Boughward](art-direction/boughward-roster-v1/README.md) sources own those limits.

## Buildings ready for preview, missing for full replacement

Town Center and House in `frontier-civilization-scale-pilot-v1`, plus Storehouse,
Stable, Workshop and Watchtower in `frontier-civilization-models-v1`, each have
eight registered Complete PNG views and a `<type>-complete-renderer.json`.
All 48 view hashes match their capture records. Camera, density, scale and pivot
admission tests cover these six families. `?frontierBuildingsPreview=1` binds
them in a full checkout, yielding to older artwork for missing lifecycle states.
Their six manifests and 48 PNGs are **absent from the Docker release** despite
local HTTP routes; packaging is a separate small follow-up before hosted preview.

The newer Frontier Barracks/Range designs have single-view Complete concepts,
without this calibrated eight-view runtime family. Default Barracks/Range use
their older direct five-state/two-team WebPs. Default Town Center uses its older
five-state/eight-view captured pack and team masks; constructed Town Centers
pass progress/health, while starting landmarks pass Complete. Other buildings
retain procedural profiles. No separate Boughward building family was found.
New lifecycle families, masks, live scale/readability review and default adoption
are missing inputs; source integrity alone does not justify promoting them.

## Chosen contract repair

On baseline, a loaded Complete sprite followed by a Damaged image returning
HTTP 503 logs that fallback is in use but keeps the old Complete texture visible.
The same mismatch occurs when Damaged pixels fail SHA-256 verification. This
hides damage feedback because the main loop derives fallback visibility from
`!sprite.visible`.

The loader now hides artwork when the **current** frame request fails. A stale
or disposed request is ignored before visibility or warning changes. Successful
view switching and existing source bindings stay intact; no art is promoted or
regenerated. Tests cover HTTP/hash failures, repair recovery, late failure after
newer Critical success, disposal, and the existing missing-state/late-success
race. Captured lifecycle and six-family admission tests now run in project CI.

Focused verification uses `node --test` on captured-building-state-race,
frontier-building-renderer, building-sprites, unit-sprite-clock and ci-sharding
test files. The four new failure cases (HTTP, hash, superseded and disposed)
fail against baseline and pass with the two-line loader repair. The real local
authoritative server returns HTTP 200 for 197 requested asset paths: 42 unit
manifest/atlas/masks, 54 new building preview manifests/views and 101 default
building lifecycle/mask/direct frames. Documentation links, syntax and whitespace
checks pass. Asset validation and release integrity are separate checks.
No screenshot, deployment, player readability or GPU/performance claim is made.
