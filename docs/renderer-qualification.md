# Reusing the hosted game capture

[Testing commands](testing.md) · [Testing strategy](testing-strategy.md) ·
[Capture checkpoint helper](../scripts/capture-checkpoint.mjs)

The [Renderer qualification workflow](../.github/workflows/renderer-qualification.yml)
provides a bounded, sandboxed browser on standard hosted Ubuntu. Its current
scenario is **packed Open Field movement**, implemented by
[`renderer-qualification.mjs`](../scripts/renderer-qualification.mjs). It starts
the packed room supervisor, installs the existing lockfile's production
dependencies, verifies served bytes and decoded image hashes, sends a real
worker Move, and retains two advancing game-canvas captures. It does not accept
a scenario, map, command or arbitrary script input today.

## Verified starting point

[PR323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323) merged as
`32b7179590f9cd8a0c59172bd9ebd9a8049c4fdf`. The actual
[successful run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37215311854)
checked out clean `52e19ec0180dd1c6f8002984fea6e43af0b6d69c`, packed 1199 source
files with digest
`sha256:ebdbd76649c04708024b96d288611ce43d9a752d86229e9f6564194751a0b32a`,
and used Chrome154, sandboxed WebGL2 and software SwiftShader. Thirteen decoded
image receipts matched packed bytes and dimensions. Frames44→50 followed worker0
on team0 moving3.9032 units; their1280×720 canvas PNGs differed at214 pixels.
All four PNGs were inspected. The coarse48-pixel readback grid had equal digests;
the actual canvas images establish pixel change. No unexpected browser or
cleanup errors occurred.

The [artifact](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37215311854/artifacts/11308580689)
contains `preflight.json`, `qualification.json`, logs, `movement-1.png`,
`movement-2.png`, `canvas-1.png` and `canvas-2.png`. Hosted artifacts expire after
one day; the acceptance owner must download useful evidence before expiry and
retain it in that feature's established evidence location. This is a packed
Open Field proof, separate from staging pixels, ordinary human/AI match acceptance,
art approval and performance measurements.

## Run the existing scenario once

For a reviewed change to the qualification workflow, script or browser fixture,
the path-filtered pull-request trigger already schedules a run. It checks out
the exact PR head. Inspect Actions for that head before considering a manual run.
A feature-only source change does not match those capture path filters.

When the existing Open Field scenario is the needed acceptance, use the
repository's Actions page → Renderer qualification → Run workflow, selecting
the intended reviewed branch or tag. Record the requested ref and actual
40-character checkout SHA. One owner records the run link in the feature PR;
other owners consume that run rather than dispatching the same source/scenario.
The current concurrency group is per Git ref, so different branches do **not**
deduplicate one another. A new head on the same PR supersedes its earlier run.
The CI/capture owner owns the shared workflow and runner edits; feature owners
own their scenario assertions and acceptance evidence.

Inspect the retained JSON and actual PNGs before claiming success. The job is
read-only, has a ten-minute limit, needs no repository secrets or paid runner,
and does not deploy. Use its normal sandboxed browser. Do not launch a separate
generic capability probe when this verified backend already answers that question.

## Ordinary-build feature adapter and dispatch

The separate [Ordinary game capture workflow](../.github/workflows/ordinary-game-capture.yml)
is manual and supports `all` and the individual cases in the registry below.
The explicit `worker-animations,novice-flow` subset is available when those two
owner modules are prepared and the resource/building bridges are still incomplete.
The CLI also accepts a comma-separated list of unique registered IDs. Unknown,
duplicate, empty or path/command selections fail; unavailable requested modules
still block before launch. A subset never silently becomes `all` or skips a case.
It pins the selected ref's event SHA, checks all requested adapters before any
browser launch, runs one WebGL2 prerequisite and clean pack, then executes cases
sequentially. Each case receives a fresh normal supervisor and isolated browser;
the shared runner does not force the Open Field lab map for these cases.
The workflow is globally serialized across refs, with no cancellation of a
running batch. This does not coalesce repeated manual requests: one dispatch
owner records the requested cases, source SHA and run link in the feature PRs,
and checks existing runs before dispatch. Prefer `all` at a common reviewed
source containing every requested adapter and candidate fixes. A ready, urgent
individual case can run without waiting for other owners' implementation.

[`renderer-feature-capture.mjs`](../scripts/renderer-feature-capture.mjs) owns the
explicit registry and batch report. Feature owners own only these adapter files:

| Case | Owner | File |
| --- | --- | --- |
| `worker-animations` | Foot animation owner | `scripts/renderer-worker-animation-scenario.mjs` |
| `novice-flow` | HUD owner | `scripts/renderer-novice-flow-scenario.mjs` |
| `worker-routes` | Resource owner | `scripts/renderer-worker-route-scenario.mjs` |
| `building-catalog` | Building owner | `scripts/renderer-building-catalog-scenario.mjs` |
| `forest-jobs` | Forest jobs owner | `scripts/renderer-forest-job-scenario.mjs` |
| `site-composition` | Site composition owner | `scripts/renderer-site-composition-scenario.mjs` |
| `tree-targeting` | Tree targeting owner | `scripts/renderer-tree-targeting-scenario.mjs` |

The workflow has a thirty-minute outer bound for the expanded registry; each
case retains its three-minute deadline. Registration and CPU import/contracts
do not establish ordinary-game, appearance or deployed acceptance. Dispatch
and sign-in remain paused under the current access decision.

Each file exports its exact registered `id`, `contextVersion = 1`, and
`async run(context)`. Importing it must not start a server, browser or workload.
The versioned [context contract](../scripts/renderer-capture-context.mjs) is
strictly checked with the existing Node checkJs configuration. The immutable
context provides `version = 1`, `page`
(initially `about:blank`), `openPage()` for another instrumented isolated page,
loopback `origin`, immutable `source.revision`/`source.digest`, and
`capture({page, mapId, checkpoint})`. The immutable `evidenceDirectory` points
to this case's owned artifact folder for safe numeric receipts and extra frame
files. The shared runner owns its lifetime; retain only reduced, nonprivate facts
and keep the runner's `qualification.json` separate from owner sidecars.
Navigate with normal menu/room input. The
runner enables the existing read-only snapshots before each document through
`window.__rtsCaptureDiagnostics`; this preserves ordinary entry URLs and assets.
Do not add `rendererCapture=environment-state` to the initial menu URL: that
historical authored link deliberately enters the game directly. The HUD case
starts at `/`, uses New Game and Tiny Terraced Vale (`veyrholds-terraced-vale`),
then selects one Worker and issues Move through actual pointer input. A reload
to insert a diagnostic query does not prove that uninterrupted novice flow.

`capture()` uses the existing checkpoint helper, verifies live applied map and
viewport, and writes a source-bound PNG/hash manifest under a unique safe
checkpoint name. Captures accept only this case's instrumented pages; one
primary page and at most four additional pages are allowed. At most64 screenshots
per case are allowed. A case returns
`{status, checks}`, where status is `passed`, `failed` or `blocked`, and checks
is a nonempty list of unique `{id, passed: boolean}` assertions. A passing case
needs actual screenshot receipts and all checks true; missing heading/clip art
must return blocked/failed checks. The shared runner validates these results,
records safe check identities and receipts, and retains browser failures even
if the evidence buffer fills. It also rejects swallowed screenshot failures.
Started capture/page operations are drained within the same three-minute case
deadline; new operations are rejected after completion or timeout. Adapter error
messages are redacted in public evidence; safe check IDs identify the failed
feature contract. Three-minute case deadlines and a20-minute workflow limit
bound the four-case batch.
Other cases continue after a feature blocks/fails so their evidence is retained.

Before integration, owners can check preparation without a browser:

```sh
node scripts/renderer-feature-capture.mjs --check all
```

Absent files return `case-unavailable`; broken imports/exports return
`case-invalid`. A missing requested adapter stops the batch before preflight;
the workflow retains `adapters.json`. Prepared cases run in the hosted job with
`node scripts/renderer-feature-capture.mjs PACK_JSON EVIDENCE_DIRECTORY all`
after clean packing and the existing production dependency install. The job
retains `batch.json`, per-case `qualification.json`, checkpoint manifests and
PNGs for one day. No ordinary adapter is supplied by the infrastructure pilot;
the four owners must integrate and review their actual assertions first.

The feature owner prepares a small scenario in a separately owned script and
records the exact candidate SHA, map, match mode, seat, ordinary input sequence,
expected checkpoints, command and time bound in the feature PR. Keep client
assets and gameplay defaults enabled. Use actual menu/room/socket commands and
authoritative observations; distinguish authored lab fixtures from ordinary
matches. Avoid teleporting workers, overriding routes, playing animation clips
directly or mutating the world to manufacture the required result.

The feature owner and CI/capture owner agree on that exact script/command before
integration. Changes to registry/runner/workflow remain CI-owned; the registered
adapter scripts can be implemented independently. Reuse the
qualified clean-pack, locked-dependency, loopback-supervisor, sandbox, safe-error,
cleanup and artifact handling. Extract a shared helper only where the new case
actually shares that behavior. The existing
[`captureCheckpoint()`](../scripts/capture-checkpoint.mjs) consumes an already
live CDP page and checks applied map/viewport identity; it does not launch a
browser, verify a pack or validate a gameplay route by itself.

Older standalone owner helpers with `run({browser, pack})`
or `runNoviceScenario({release})` do not implement version1.
Their owners may reuse pure observations/assertions in the registered adapters;
the loader rejects old identities, missing exports and incompatible versions
before qualification. The registered adapter receives no browser/pack ownership
and uses `context.capture()` for passing screenshot receipts. Integrate and run
CPU contract tests against each owner's actual prepared exports on the common
candidate before dispatching; a stale PR description cannot establish compatibility.

For the reported angled gather/drop-off route versus manual Move, the resource
owner retains the fix and acceptance. Compare matched starting conditions and
destinations using native Gather/return-to-drop-off and manual Move, including
the relevant obstacle and camera angle. Record authoritative worker positions,
task transitions, cargo/deposit outcome, animation identity and observed frame
times alongside ordinary-zoom screenshots covering departure, turns, approach
and contact. A single endpoint image or an animation plan cannot prove the
route or contact sequence. Each before/after set needs its own clean source,
release digest, map/mode/seat and screenshot hash receipts. CI runs the integrated
case once; the resource owner inspects the sequence and owns any separate
identified-release staging check.
