# Default interaction audio — 11 October 2026

Owner: chat `01a12b6b-d181-79b1-97b4-05de79523245` (Add unit and building audio).
The user reports missing unit voices and characteristic building selection sounds.
The [event matrix](audio-event-asset-matrix.md#interaction-delivery-owner--11-october-2026)
retains the full goal; this receipt covers the first four meanings, the fourteen
Worker action/readiness meanings and the subsequent 67 current-roster meanings.
Source coverage does not close deployment or listening acceptance.

## Source and delivery identity

| Boundary | Observation |
| --- | --- |
| Audited main | `e0ced8ad21081cdbd221561b784f16575035e5da`; no character recordings or building activity recordings. |
| Staging before change | Railway deployment `7151cde3-db10-4284-afb2-bc53c7661c3c`, SUCCESS, same `e0ced8ad` source. Platform identity only; no authenticated served-byte or listening claim. |
| Implemented/tested source | `4d50d4d111e4f7a0535d8f822b57e76aaef51a44`, local branch `codex/unit-building-audio`. |
| Clean release | `sourceDirty: false`, digest `sha256:528ef8bcd85104b31c23a89e5f91d24e0a2dd911cace223daecd63d6f7635c7c`. All eleven bound source hashes verified in the packed directory. |
| Follow-up source | `b8e0878b4232e42eae69af252c7159604f7d471c`; internal source-ID isolation and ordinary cloud output-capture preparation. |
| Follow-up clean release | `sourceDirty: false`, digest `sha256:3f4ff4e00b56d78bbac586cb0549094b0cb846fdefea1bf3d1eeace946a7e29d`; all eleven recordings hash-verified through the real packed HTTP server. |
| Worker response source | `6c155918c088d30ce2a7ddcc6ee81914b563b2cb`; fourteen further Worker meanings, default v2 and bounded parallel downloads. |
| Worker response clean release | `sourceDirty: false`, digest `sha256:81094af16f71716e6fec4cd6575ddfb3cd6bfd2f7e12c4231f1b1e7aaffd07d0`; 1,561 packed files. All 39 selected recordings hash-verified through the actual packed game HTTP server. |
| Current-roster source | `22c6d7fbe5814f1db9682c2f7257c7500c7c2fd2`; all current selection/supported-command recordings and applied Return Cargo routing. |
| Current-roster clean release | `sourceDirty: false`, digest `sha256:ea62ef2e6536e5104f9fc7deaf99eeac88264995c94cd2218835c39ee38f837f`; 1,816 files. Real packed server hash-verifies all 119 default recordings and serves all 146 imported client modules. |
| Audio manifest | `frontier-feedback/v1`, profile `interactions`, SHA-256 `b13cb7b0f5a0e89fa0d8c03d86923964ed78f8a3260d6a3ba035def5aad4f55c`; eleven sources, 450,927 source bytes. |
| Publication access | The CLI identity `lbliii` rejects the fork push and reports `push: false`. On the user's correction, the GitHub app connection was checked separately and confirms `admin: true`, `push: true` for `lbeezr/thousand-unit-skirmish`. Publication and merge succeeded through that already-authorized app; no permission expansion was needed. |
| Publication / merge | [PR638](https://github.com/lbeezr/thousand-unit-skirmish/pull/638), published through the GitHub app at `53be9499ccf788594dd08d11d5e3d213c6c76abd`, merged as `b4ad36cf80ca923ed808c06df113ae6bdad5c997`. The published tree exactly matches independently reviewed local `48d4fe37`; all 365 uploaded blob hashes were checked. |
| Merged clean release | Source `b4ad36cf80ca923ed808c06df113ae6bdad5c997`, `sourceDirty: false`, digest `sha256:c771c5933f5856d564858cb63111c442041e71f8fe72a2eb0c30b5090a6ea468`, 1,821 files. This includes current main's separately merged portal. |
| Containing deployment | Staging deployment `36e172c3-0439-4507-b596-7fe6bb924f53` serves `b4ad36cf`. The [authenticated served receipt](qa-evidence/interaction-audio-2026-10-11/staging-served.json) verifies exact source identity and all 119 recording hashes. Railway Git identity leaves runtime digest/cleanliness unknown; the clean local/cloud pack digest is separate. |
| Ordinary-game listening | **Incomplete.** [Cloud native-output run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38153340669) at `b4ad36cf` passed sandboxed WebGL2 and packing but failed during the broad ordinary-entry stage, before any recording or screenshot. [Raw case receipt](qa-evidence/interaction-audio-2026-10-11/first-cloud/interaction-audio/interaction-audio.json). |

The original production sources and editorial selections are retained in
[Frontier feedback v1](../assets/audio/frontier-feedback-v1/README.md).

## Implemented behavior

- Worker selection resolves recorded “What needs doing?”; matching applied Wood
  Gather resolves recorded “I'll cut wood.” Four performance takes each.
- Barracks selects short shield-rack equipment; Town Center selects indistinct
  hall activity. One and two assigned takes respectively.
- Main supplies these defaults regardless of a map audio assignment. Exact map
  bindings override defaults; generic map cues retain exact default meanings.
  Source namespaces prevent same-ID map blobs from replacing default audio.
- A priority-1 applied-order voice cancels playing and pending selection speech.
  The existing 1.25-second routine speech gate still bounds equal-priority orders;
  urgent voices cancel pending lower-priority speech as well as active voices.
- Existing mute, hidden-page, map/disposal cancellation, captions, authoritative
  token admission and synthesis fallback remain in force.

## Verification

### Independent review follow-up

The independent code review of local source `a037ef9e` found one uncovered
ordinary command: Farm Replant still produced only the send tone. It now uses
the existing Worker Build line after a matching `FARM REPLANTED` acceptance.
The internal replant context prevents that notice from consuming another
construction or role intent. Both-seat caller tests cover accepted, failed,
duplicate, reset, unknown-token and unsent orders. The reviewer cleared the
three-file fix with all 38 audio execution tests passing; the execution/default
pair passes 50 tests and both type projects pass. No new audio generation was
needed. This is event-routing evidence, not a listening claim.

All 259 audio tests pass after the fix. Main advanced to `ac9e5579` during
publication; its portal changes merged cleanly. All 292 combined audio/entry
tests, both type projects, docs, import boundaries, client static admission and
cloud-adapter precheck pass on local integration `09fb1abd`. Its tree
`1368f6129167631f5bc2253c49df93456a2ce86b` exactly matches merged `b4ad36cf`.
Hosted CI was running at merge; main had no required branch protections or
rules. [PR638 CI](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38153265164)
subsequently failed the same three movement checks as
[pre-audio main CI](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37956916490):
paid-wall/closed-gate queued destinations, obstructed formation reservations,
and opt-in planning budgets/order invalidation. The audio checks passed. No
hosted/full-suite pass is claimed; these pre-existing failures remain separate
from audio acceptance.

### First cloud execution and served delivery

The first actual cloud run used Linux uid 1001, Chromium 154 with its sandbox
enabled, and a software WebGL2 renderer. Capability readbacks passed. Its clean
release digest matches the local merged pack exactly. Game boot reached ready
with a canvas, but the case failed before recording. Its broad `ordinary-entry`
stage does not distinguish opening-worker observation, default source loading or
gesture unlock. The [qualification receipt](qa-evidence/interaction-audio-2026-10-11/first-cloud/interaction-audio/qualification.json)
also reports an unknown-path canceled request; that independent browser event
remains unresolved. No audio failure or success is inferred from this receipt.

The follow-up adapter adds specific wait stages, safe probe error names and
bounded state/screenshot diagnostics. Its source-ready wait now allows 35 seconds,
exceeding the shipped loader's 30-second deadline. These changes make the next
cloud run diagnosable; they do not change production audio or assert a fix.

[The third run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38154129086)
at `e1e63ee3` identifies the failure at `default-audio-ready`. Its
[case receipt](qa-evidence/interaction-audio-2026-10-11/loading-cloud/interaction-audio.json)
shows a ready game, the expected map and visible Workers, with no observation
faults. The default bindings did not become available within 35 seconds. The
[browser receipt](qa-evidence/interaction-audio-2026-10-11/loading-cloud/qualification.json)
records canceled voice downloads, and the
[diagnostic frame](qa-evidence/interaction-audio-2026-10-11/loading-cloud/failure-default-audio-ready.png)
shows a reconnect. The second run (`38153774353`) failed earlier at menu entry;
guarding the transient missing document root allowed this third run to proceed.

Inspection found a concrete lifecycle defect: each welcome called `loadMapAudio`
even for an unchanged map, aborting all pending source downloads and clearing
the active bindings. The follow-up preserves audio on an unchanged-map welcome;
actual map changes still reset it. This is independently justified by the
reconnect path, but the third receipt alone does not distinguish a reconnect
abort from the loader's 30-second timeout. The reconnect correction passes 355
audio/recovery tests, both type projects and independent review.

[The fourth run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38154650347)
at `7a881513` contains that correction. Its
[download timings](qa-evidence/interaction-audio-2026-10-11/reconnect-cloud/interaction-audio.json)
show one default-pack attempt: source transfers complete in 2–13 ms, but the
next batch starts 8–10 seconds later. The load still times out; the observation
was already 3.27 seconds old. The clean pack digest is
`sha256:8596db541b0bb68f285ba9484db571f73c4fe9d75dd55ff1e899fbb2252703b1`.
The next adapter revision removes the per-frame debugger breakpoint in favor
of an on-demand, read-only snapshot under the existing capture-diagnostics flag.
This tests possible instrumentation overhead without extending audio deadlines
or changing gameplay. Playback remains unverified. The user confirms that the
staging address above is their intended game environment.

[The fifth run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38154999260)
at `da5770a4` removes the debugger, but its
[case receipt](qa-evidence/interaction-audio-2026-10-11/no-debugger-cloud/interaction-audio.json)
still shows the same download scheduling gaps and timeout. The fresh snapshot
is only 0.1 ms old, so the stale-observer hypothesis does not explain loading.
Default bindings remain absent while the smaller regional pack becomes ready.
This motivates the worker-loading correction: the existing verified loader now
runs in a dedicated browser worker, with the same four-transfer concurrency,
byte/hash/MIME checks, two-pack cache and 30-second deadline. A separate client
watchdog bounds worker startup; cancellation IDs and disposal retain ownership.
Ten worker protocol/canonical-loader/runtime-disposal tests join the existing
audio and recovery checks: 365 pass. Both type projects, 65 import-boundary tests
and actual HTTP serving of all 119 default sources and both worker modules pass.
These CPU/HTTP results do not establish native-worker playback; that cloud run
remains the next acceptance step.

[The sixth run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38155874639)
at `8e4e54a9` verifies native worker loading in the actual packed game: all 85
default bindings become available and the audio context reaches `running` after
an ordinary gesture. Its clean release digest is
`sha256:248705f96c62556f07ffaf0b4967a13b1b6e3d965147176131d471292a083a05`.
The [receipt](qa-evidence/interaction-audio-2026-10-11/worker-cloud/interaction-audio.json)
then fails at Town Center selection. The
[frame](qa-evidence/interaction-audio-2026-10-11/worker-cloud/failure-town-center-click.png)
shows Infantry selected instead: an overlapping unit wins the normal picker at
the building's projected ground center. The next adapter scans rendered building
bounds with a read-only observation of the same unit-first picker, without
advancing stack selection. Loading is now verified; no recording or listening
pass is inferred. Worker network requests are outside the page CDP session, so
the empty page-download list does not measure their transfers.

The worker/reconnect fix is merged in [PR639](https://github.com/lbeezr/thousand-unit-skirmish/pull/639)
as `7d4a588c502a87048f64552c516836fc94197bb5`, including the separately merged
Worker HUD pilot. At that exact merged source, 403 focused audio/recovery/HUD
tests and both type projects pass. [Cloud run seven](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38156525628)
has clean release digest
`sha256:d21088cbeb9ae60685c092982f8feb4eb54ff3e4f758fbda05eed36a71b90f64`.
Its [case receipt](qa-evidence/interaction-audio-2026-10-11/merged-worker-cloud/interaction-audio.json)
records actual native starts for Worker selection and the correctly selected
Town Center. The strict visual checkpoint then rejects the syncing page before
the recording is saved. This is native start evidence, not a saved-output or
listening pass. The previously unidentified canceled requests are now classified
as room-API fetches; they remain qualification failures.

The capture follow-up arms the recorder for the exact expected recording hash,
so slow input/decode work cannot use up its recording window before playback.
Each verified output is saved before attempting the final screenshot; a later
failure or case deadline leaves the partial evidence explicitly incomplete.

Staging deployment `5b93b8bd-1795-4d6b-a4ba-eff9033c2bcd` is **SUCCESS** for
`7d4a588c`. Its [served verification](qa-evidence/interaction-audio-2026-10-11/staging-worker-served.json)
confirms the exact source, all 119 recording hashes, 138 recursively discovered
client modules and both worker module bytes matching the reviewed source.
Public gameplay/readiness and private health/source admission checks pass.
Runtime digest/cleanliness remain unknown for Railway Git identity; the clean
cloud digest above is separate. After refreshing their confirmed staging address,
the user answered **“Yes, both responses work”** for villager selection and the
wood-chopping order. This is human hearing acceptance for those two meanings on
the identified staging deployment, not a full-roster/building listening pass.

[Run eight](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38157245378)
at `1daa1f6d` has the same runtime release digest as merged `7d4a588c` because
only capture tooling/docs changed. Its
[receipt](qa-evidence/interaction-audio-2026-10-11/armed-cloud/interaction-audio.json)
again records native Worker and Town Center starts, but a wait times out before
any native-output file is saved. The shared CDP helper limits an awaited call to
15 seconds, so the next capture polls recorder completion within a separate
45-second bound before retrieving the resolved value. Separate schedule/output/
receipt stages and recorder state make that hypothesis diagnosable; no passing
recording or exact timeout cause is inferred from this run.

The staging HTTP check passed source `b4ad36cf`, public gameplay/readiness and
protected health, default v3 manifest/source verification (119 recordings),
136 recursively discovered client modules, and private source/catalog rejection.
This served-import count differs from the local architecture graph's 146-module
set because the checks have different entry coverage. Both are bounded receipts.
The exact merged local pack also passes the real-server audio scenario. The
audio owner retains full-roster ordinary interaction output and listening, rapid
order mix, caption-free recognition and solo/1v1 acceptance.

### Current-roster source increment

Default `frontier-feedback/v3`, profile `interactions`, manifest SHA-256
`ac8b054bdd5dcd0865eccea0eefd34b56316d8df58104cdcc065b5ed6e9828cb` retains
the first 39 recordings and adds 80 selected takes: **119 recordings, 85
bindings, 4,485,737 encoded bytes**. All eight registered unit roles have
selection, supported-command and readiness lines, and all thirteen registered
buildings have characteristic selection sounds. Worker/Skiff Return Cargo now
uses the actual applied token notice; both-seat tests execute Main's committed
caller and reject planning, failures, unknown/duplicate/reset tokens and other
role/command intent. Skiff gets no unsupported Attack/Patrol/Follow voice.

[Current-roster source pack](../assets/audio/frontier-roster-feedback-v1/README.md)
preserves 253 new original takes (9,667,867 bytes), production IDs/prompts/cast,
reported costs, hashes and mono decode checks. Four takes were requested per
meaning; 15 alternate starts in the first batch were refused by the provider's
queue before receiving a session. No generation was retried, and every meaning
retains three or four originals. Later batches were bounded by outstanding work.
The selected 80 have nonzero signal, no full-scale mono samples and bounded gain.
These are provisional signal-based choices, not a creative or hearing pass.

All **256 audio tests**, both type projects, the runtime import boundary check
(253 modules / 488 edges / no cycles), sampled playback scenario and cloud
adapter precheck pass. The exact new server admission list is generated with
the manifest and classified as server-only. No full CPU suite or browser pass
is claimed. An additional 83 shared architecture/capture tests pass. The clean
release and actual packed server receipts are recorded above; the packed source
head is `22c6d7fb`, separate from the later documentation checkpoint commit.

The Mac briefly rejected writes with `ENOSPC`. Three owned obsolete test packs,
72 disposable decoded WAVs and this task's npm cache were removed; source
recordings, catalog signal evidence and release receipts were retained. The user
offered to free space; subsequent availability reached about 991 MiB and source
production/validation completed. After packaging, 1.7 GiB was available, so the
disk blocker is cleared. This did not modify another task's artifacts.

### Worker response increment

The second increment targeted `frontier-feedback/v2`, manifest SHA-256
`ead2445947e811a451959325cd0f64de57ad7206db0947eca65c02576f1c3209`.
It retains the eleven v1 sources unchanged and adds 28 selected takes for fourteen
Worker meanings (39 sources, 1,479,204 bytes total). All 56 new originals remain
in [their source pack](../assets/audio/frontier-worker-actions-v1/README.md), with
exact spoken text, generated IDs, prices, source hashes and offline signal results.
The default uses two takes per new meaning to provide variation with a bounded
download size. Source selection is provisional; no listening pass is claimed.

The mapped responses cover Move, Patrol, Follow, Stop, Hold, Attack, coarse Food,
Farm, Sheep Carcass, Shore Fish, Stone, Build, Repair and Ready. Existing selection
and Wood Gather responses remain. The food-job resolver is tested against the
actual extended manifest so farm/fish/carcass do not collapse into generic Food.
Exact static admission tests cover every selected and unassigned original.

The loader validates the complete declared pack before requesting sources and
fetches at most four simultaneously. New tests hold the first batch to verify
the concurrency bound and fail one source to prove peers cancel, later batches
do not start, and no partial pack enters the cache. This addresses loading many
short voice clips without changing the existing total deadline or size/hash gates.

All **249 audio tests**, both type projects, runtime import boundaries, docs and
the cloud adapter precheck pass for the Worker increment. Focused native-probe
receipt tests also pass; no full CPU suite, cloud browser, deployed source or
audible gameplay acceptance is inferred from those results.

### First increment evidence retained

At follow-up source `b8e0878b`, all 246 audio tests pass again. The fifteen
shared capture/interaction receipt tests pass, including a modeled native-API
probe test preserving the original decoded buffer, speaker connection and
single timed source start. Types, runtime import boundaries, docs, runtime
playback scenario, adapter registration and packed HTTP audio serving pass.
These checks do not establish an executed cloud capture.

At the implemented source, all **246 `scripts/audio-*.test.mjs` tests pass**,
including nine new default-pack tests. They verify real manifest/source hashes,
default Main binding, exact public asset admission, source-ID isolation, map
override/failure behavior, select-then-order replacement, late-decode suppression,
mute, superseded loads and disposal. These are modeled Web Audio/DOM checks.

`audio-runtime-playback-scenario.mjs`, `audio-shipped-serving-scenario.mjs`, both
TypeScript projects, runtime import boundaries, documentation links and
`git diff --check` pass. The actual isolated server serves and hash-verifies all
eleven assigned recordings plus the existing regional profiles. CI registration
was inspected with `node scripts/ci.mjs --list`; no full CPU-suite claim is made.

The clean pack includes the selected manifest and source bytes and retains the
unassigned original comparisons. Exact HTTP admission excludes those comparisons,
the source catalog and its build script. Packaging does not establish deployment.

All sixteen originals were decoded offline to 44.1 kHz mono signed 16-bit PCM
with `afconvert`; the initial unspecified-format attempt failed at `cfmt`, while
the explicit sample-rate/channel conversion succeeded. The source catalog retains
duration, decoded peak/RMS and full-scale sample counts. Eleven assigned takes
have nonzero signal and no full-scale samples in this conversion. Their gains
are bounded by a -3 dBFS decoded mono peak and gain ≤2. This is file validation,
not a browser decode, true-peak measurement or creative listening check.

## Remaining ownership

### Cloud click/output check prepared

The `interaction-audio` case in the existing Ordinary game capture workflow
starts from New Game on Tiny Terraced Vale, clicks an ordinary Worker and a
disclosed wood target, selects the Town Center, and pays for/completes/selects
a Barracks. It uses the existing packed-release/cloud capability runner.
On-demand read-only diagnostics observe the actual audio decisions. A parallel
tap preserves the normal speaker connection and records four short WebM/Opus
outputs, screenshots, source hashes and observed final-output levels. Native
decode/start hashes distinguish the intended recording from synthesized fallback.
It adds no microphone access and changes no gameplay or mix settings.

Run with the workflow's `interaction-audio` choice. The local
precheck is `node scripts/renderer-feature-capture.mjs --check interaction-audio`.
The adapter and receipt tests are CPU checks only. The first executed cloud case
failed before recording, as documented above.
Its `captured-needs-listening` receipt deliberately leaves creative listening
pending. The shared browser fixture permits autoplay, so this case also does
not establish browser-policy unlock behavior on the user's device. Staging
identity and actual user-environment listening remain separate work.

The follow-up also reserves slash-prefixed internal default source keys; slashes
are forbidden in portable pack IDs. This closes the collision with a valid
imported source named `default:select`, which the expanded regression reproduces.
The clean first-increment pack was additionally served from its packed directory;
the real server hash-verified all eleven clips there as well.

The same owner next publishes these prepared increments when repository write
access is restored, verifies their containing staging release and ordinary game
selection/job clicks across all eight unit roles and thirteen building types.
Worker death/work-loop sounds remain separate missing material;
the fourteen responses do not claim those additional events. The user clarified
that Marketplace/Castle were examples; the goal covers only registered buildings.
No publishing or deployment success is inferred from this local commit or pack.

Checkpoint: **2026-10-11 15:03:49 UTC**, branch `codex/unit-building-audio`,
code head `b8e0878b`. The user replied that they will enable repository write
access. The latest GitHub metadata read still reports `push: false`, so no
publication retry or alternate credential route was attempted. Resume publication
when that repository permission is available; then review/merge under existing
authority and run the cloud `interaction-audio` case, retaining the same owner
through identified staging delivery and listening review.

Worker checkpoint: **2026-10-11 15:13:02 UTC**, code head `6c155918`, same
branch. Refreshed `origin/main` remains `e0ced8ad`; no new main conflict exists.
All 249 audio tests and fifteen shared capture/receipt tests pass, and the
clean packed server serves the expanded v2 source bytes. Latest GitHub permission
read remains `push: false`. Independent source work next covers the other seven
registered unit roles and eleven buildings; publication resumes on restored
write access, with independent review still pending and no deployed/listening
success claimed.

Current-roster checkpoint: **2026-10-11 15:32:23 UTC**, branch
`codex/unit-building-audio`, code head `22c6d7fb`, refreshed `origin/main`
`e0ced8ad`. All 253 accepted provider generations completed; no jobs remain
pending. The selected v3 manifest and real clean-package HTTP checks pass.
GitHub's latest read still reports `push: false`; the earlier rejected push
was not retried, and no alternate credential or publication route was used.
The user has offered to enable that permission. Publication resumes when the
current connection reports write access: publish the prepared branch/PR, obtain
independent review at the final source head, merge under standing staging
permission, verify the containing deployment and actual game output, then
complete full-roster listening and mix review. The same owner retains every
step. This goal is not completed by the local source or clean release.

Access correction: the user's next message explicitly requested checking both
CLI and app. CLI `gh auth status` identifies `lbliii`, which has no push access
to the fork. The GitHub app's repository metadata and collaborator permission
check both confirm admin/write access for `lbeezr`. The earlier blanket access
blocker was therefore an incomplete diagnosis. Use the connected app's Git Data
API to publish the verified tree, preserving binary originals and local history.
No authentication change, broader permission request or alternate repository is
needed. Record its published commit separately because the API commit identity
will differ from the local source commits even when the trees match exactly.
