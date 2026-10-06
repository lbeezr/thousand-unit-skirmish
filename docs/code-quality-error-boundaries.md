# Error boundary quality workstream

[Working rules](../AGENTS.md) · [Planning guide](contributor-planning.md)

The error-handling owner retains small reproduced fixes through tests,
independent review, merge and applicable integration proof. Rank by recovery,
diagnostic accuracy and churn. This backlog does not gate other workstreams.
GitHub Issues is disabled, so this is the durable workstream record.

Keep expected invalid input distinct from programmer faults, retain original
causes, clean only acquired resources, and use useful messages without raw
contents or secrets. No noisy logging, telemetry service or broad rewrite.
Combat, lobby, animation, modes, Skiff and shared-hotspot refactors are outside
the current write scope. The shipped-audio reader already has its own owner.

## Current queue — 6 October 2026

The quality swarm's error lane now owns bounded persistence/import diagnostics.
The only allocated main-client change is `importEditorMap` read-versus-parse
handling. R4 draft timers/save/close, publishing, other editor globals and the
audio organization lane remain outside this slice.

| Priority/outcome | Evidence and boundary | Next action/owner |
| --- | --- | --- |
| 1 — map import failure acceptance | [PR #561](https://github.com/lbeezr/thousand-unit-skirmish/pull/561) separates native file-read failures from JSON syntax failures, retains exact causes and unexpected-error identity, and preserves the existing input handler and draft-save scheduling. Unchanged main `c1a51059` fails 13 of the 16 new production-consumer controls; all 16 pass with the correction. | Error owner tracks exact review, normal source merge, clean package and automatic staging inclusion in the PR; native file-picker/status observation remains separate and open. |
| 2 — draft recovery rendered acceptance | [PR #554](https://github.com/lbeezr/thousand-unit-skirmish/pull/554), merge `f657383c45c67479e791c9f18dd31efe6188c398`, rejects four malformed collection containers before editor mutation. Verified containing source `c1a51059eb500d3c52eb4561ddce24f6e8dd27e8` reached normal staging `SUCCESS` in deployment `1f3302c6-b93f-4e8a-8d6e-d3ee0f05a8d7` at 18:57:48 UTC on 6 October, with the recovery contract/tests unchanged and no manual rollout or config change. | Error owner retains Restore failure/repair/retry observation on an identified release. Provider-reported staging inclusion does not establish authenticated served identity, deployed-byte digest or rendered acceptance. |
| 3 — elevation draft recovery | Production Restore accepts malformed elevation patches through preflight, then population clears history and replaces editor definition/material grids before reporting shape, bounds, level, overlap or limit. The bounded correction reuses the existing elevation validator after all envelope/collection guards and before population, retaining its diagnostics and unexpected-error identity. | Error owner owns focused failure/valid recovery/repair tests, exact pure import-closure review, normal source merge, clean package and automatic staging inclusion; rendered Restore observation remains open. |
| Next source candidate — no reproduced issue reserved | Read-only audit of existing authoring persistence/import helpers; preserve incomplete local drafts, validation order, storage behavior and private diagnostics. | Choose another small correction only after reproduction and overlap checks; do not manufacture a refactor to fill the queue. |

The dedicated import regression is registered additively in the normal CI suite;
all existing registrations and assertions remain. Direct import failures preserve
editor/form/history/raw storage/timers/redraw state. A bubbling file-input change
retains the host's existing dirty flag, `SAVING DRAFT…` status and debounced write,
even on failure; this is compatibility evidence, not a draft-lifecycle change.
The import PR records focused checks and independent exact-head review separately
from hosted full-suite failures/skips, clean packaging and runtime acceptance.
Historical native acceptance still depends on the recorded browser capability;
no unchanged blocked browser or denied metadata route is retried by this slice.

## Historical queue — 5 October 2026

| Rank/status | Reproduction and outcome | Write boundary | Next action/dependency | Acceptance owner |
| --- | --- | --- | --- | --- |
| 1 — reproduced, source fix under review | Map Studio Publish leaves “Draft ready to publish” in its own status after offline/recovering/stalled transport rejection; nothing is sent. Reproduced at `a5639c06`. | Two existing rejection branches in `sendCommand`, mounted real Publish/sender tests, CI and owning guides | Independent exact-head review, merge, clean package/serving checks. Native editor/status observation requires a working browser and identified release. | Error-handling owner owns rejection feedback; architecture/authoring retains publishing lifecycle and import/validation. |
| 2 — source integrated, native acceptance blocked | [PR #458](https://github.com/lbeezr/thousand-unit-skirmish/pull/458) discards obsolete export publication; merge `a5639c06e30306c42a7c64f7d69dab0a3a062b99`. [PR #455](https://github.com/lbeezr/thousand-unit-skirmish/pull/455) preserves WAV read/decode causes; merge `55860818ca95c41c454fb0ff9df05ac177464192`. [PR #450](https://github.com/lbeezr/thousand-unit-skirmish/pull/450) cancels obsolete preview startup/status; merge `70289cacc33065182e0c9a4ab7f36251e6178c07`. Each has independent exact-head review and clean merged-source/package/serving checks. | No further audio source edit justified by these acceptance dependencies | Observe preview Stop/retry, export failure/repair/retry and stale completion on an identified containing release. Head `19e581cd` browser probe failed sandbox/storage startup with zero frames/screenshots; do not retry unchanged capability. | Error-handling owner retains native acceptance; coordinated release owner retains deployment identity. |
| 3 — source integrated, native acceptance blocked | Audio library opening/import fixes [PR #166](https://github.com/lbeezr/thousand-unit-skirmish/pull/166) and [PR #172](https://github.com/lbeezr/thousand-unit-skirmish/pull/172) retain their source proofs below. | No additional source edit justified | Working provider browser sandbox and identified coordinated runtime release before normal/blocked-open/import retry observation. | Error-handling owner retains native acceptance; coordinated release owner retains deployment identity. |
| Parked — unconfirmed audio audit | Asynchronous composer Save completion after edit/selection while persistence is pending has not been reproduced in this lane. | Read-only only, no source edits reserved | Prefer reproduced game/editor/network failures. Revisit only with an actual race and current persistence ownership; map import/validators and diagnostic loaders remain outside this lane. | Error-handling owner |

### Queue reconciliation and rejected publish audit — 5 October 2026

Local and remote main matched `a5639c06e30306c42a7c64f7d69dab0a3a062b99`.
PR #458 is merged, not awaiting source review. Its exact independent review
and fresh merged-source checks cover 17 lifecycle controls (13 baseline failures),
41 aggregate focused results, existing scheduling and packed serving. Clean
1,388-file package digest:
`sha256:2c356d9595381f67a68bb38490f1daad51e098915734bcfe30bd793e3d1ee2fd`.
These establish source/package evidence, not a live deployment or native download.

The new priority is editor/network rejection feedback. The actual main-client
Publish callback and `sendCommand` were executed in a DOM fixture with no socket,
closed socket, recovering state and a stalled server. Each sent nothing and
kept Publish enabled, but left “Draft ready to publish” in the editor while only
the existing general toast changed. No assertion about toast visibility in a
native modal is made. The two early return branches now write safe, fixed
not-published/retry messages to the existing editor status for `publishMap` only.

Ten controls pass; unchanged baseline fails the four rejection/status cases and
passes six compatibility controls. Explicit retry publishes the original payload
once after recovery; recovery alone publishes nothing. Ordinary command status,
serialization/generation identity, oversized map feedback, draft bytes and exact
programmer error/cause identity remain. No catch, new asynchronous request,
resend queue, protocol change or raw map/error content is added.

Architecture/authoring retains the [draft/publish lifecycle seam](architecture.md#continuing-boundary-workstream),
map import/validators and rendered recovery. At audit start, PR #451 concerned
the draft format; refreshing main included that merge without conflict, and no
active PR overlapped these two transport-rejection status writes.
Diagnostic loaders and held art #25/#230/#241 are unchanged. The implementation
adds no lifecycle or validation changes. Art backing: the existing
[Save & Play status treatment](qa-evidence/studio-landscape-strokes-2026-09-30/save-play.png)
is retained; only failure copy changes. CPU DOM tests do not prove native editor
appearance. Browser sandbox/storage and denied CLI metadata routes were not
retried. The owned PR retains exact review, merge and source/package/serving
identity; deployed/native feedback acceptance stays open with this lane.

### Delayed export completion audit — 5 October 2026

Fresh main `2b4a5246b83ad9faecbaefa7bb467f75e9625245` had no composer
changes after PR #455. Open PR inspection showed architecture-owned #451 and
held art #25/#230/#241; none overlaps export. Through the mounted production
editor, a delayed first-composition render followed by selection of the second
composition and Stop downloaded `Second-mix.wav` from the first render and
replaced “Preview stopped” with “WAV exported.” A separate delayed rejection
replaced the stopped status. No native browser/download is claimed by these
instrumented DOM/audio observations.

Each export now owns its initiating filename and completion identity. Existing
edit/selection/new/Stop/Play paths, Save, and a newer export discard obsolete
publication. Invalid edits also invalidate completion before validation fails.
No offline rendering abort mechanism is added; results can settle without
allocating download URLs or cleanup timers. Current errors keep their messages
and original error/cause objects; normal download publication and its 60-second
URL revocation remain. Mere track/clip selection does not cancel an export.

All 17 delayed lifecycle controls pass; unchanged baseline fails 13 and passes
four positive controls. Both settlement orders, successful/failed old results,
normal output/name/duration/cleanup, edit and composition retries, Stop,
invalid-edit error status, pending Save, New, Play and disposal are covered.
Preview, WAV cause/identity, library and existing scheduling checks remain green.
Art backing: N/A, existing controls/status treatment retained. Native rendering,
downloads and deployment identity remain open under the earlier browser block;
no browser or denied CLI metadata route was retried. Exact review and source,
package and serving identities belong in the owned PR.

### WAV export audit — 5 October 2026

Local and remote main matched `70289cacc33065182e0c9a4ab7f36251e6178c07`.
Open PRs #451/#452/#453 concern authoring format, animation diagnostics and
construction fixtures; none overlaps composer export. Reproduction through the
actual export API with injected native failures proved that `EncodingError` and
Blob `NotReadableError` lost their causes; read failure received a decode message,
and decoder `TypeError` lost identity behind the same message.
The 14 focused controls fail 13 cases on unchanged baseline; all 14 pass with
the fix. Existing WAV scheduling passes on both revisions, and preview/library
checks remain green.

Split the existing read/decode catch. Only native Blob `NotFoundError`,
`NotReadableError` and `SecurityError` get a safe read/retry message with cause.
Only native decode `EncodingError` keeps the existing decode message with cause.
Unexpected exceptions, including name-spoofed ordinary Errors, pass through
unchanged. These classifications follow the [File API read failure reasons](https://w3c.github.io/FileAPI/#errorsAndExceptions)
and [Web Audio decode algorithm](https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-decodeaudiodata).
No offline rendering starts after either failure; retry creates a new context,
preserves source bytes and matches a valid WAV. Mounted-editor status checks
retain private native details in the cause only. Art backing: N/A, existing
status treatment retained. This is CPU/API evidence, not native decoding,
playback, downloads, rendered or deployed acceptance. Existing CLI metadata
denials and browser capability blockers are retained without retry.

### Composer preview audit — 5 October 2026

Current remote main and local source were `b5b4dd49139b86dbe6ad0d299469f6b193df81b1`.
Open PR inspection showed only held art PRs #25/#230/#241; no overlapping
composer change. Workspace `.agents` and `.codex` directories were empty.
The mounted production editor with a deferred `AudioContext.resume()` scheduled
one source after Stop while reporting “Preview stopped.” A separate late resume
rejection replaced that status. The same regression suite against unchanged
baseline failed six of nine tests; the fix passes all nine. It also proves
obsolete startup cannot stop a successful retry, editing cancels startup,
disposal closes once, and late decode success/failure leaves Stop intact.

The fix checks the existing preview token after resume and guards the existing
failure status with that token. No error is wrapped or relabelled; active error
messages, original error/cause objects, saved metadata and source Blobs are
unchanged. Art backing: N/A, existing controls/status treatment is retained.
These are CPU DOM/audio doubles, not native playback, deployment or rendered
evidence. Exact-head review and packaging are recorded in the owned PR.

## Completed evidence

- **Capture failure causes:** [PR #160](https://github.com/lbeezr/thousand-unit-skirmish/pull/160),
  merge `c5527f77087b57ea6d9c716555c711402bd3b592`. Original CDP/filesystem
  causes survive; dual capture/cleanup failures are retained. Safe messages and
  directory ownership are unchanged. All 45 focused checks pass on merged main;
  [independent COMMENT review](https://github.com/lbeezr/thousand-unit-skirmish/pull/160#pullrequestreview-5403106515)
  found no blockers. At descendant main `4467986fe15b6595d0929ba0d63306473687a356`,
  standalone invocation of the actual helper with injected CDP proved original
  cause retention, directory cleanup, successful retry and a published synthetic
  68-byte image/manifest. Image SHA-256:
  `880ab29fcec83622dac6492f1c061f1e85a0f19948b2732169732d96ac37547f`.
  No GPU or live-game appearance claim; production deployment is not applicable.

- **Audio-library open retry/cleanup source integration:**
  [PR #166](https://github.com/lbeezr/thousand-unit-skirmish/pull/166), merge
  `944b64ded22260d0a18362300b6244deab59d347`.
  [Independent COMMENT review](https://github.com/lbeezr/thousand-unit-skirmish/pull/166#pullrequestreview-5403255919)
  found no blockers. Archive byte/metadata checks, blocked/error/programmer-fault
  and concurrent retry/late-success cleanup, audio runtime policy, served client
  imports and packaged-release checks pass before and after merge. The reviewed
  files match merged files. **Native/deployed acceptance remains incomplete:**
  parent retains coordinated release; this stream retains normal Audio Studio
  and blocked-open retry observation on that identified deployment using a
  provider runtime with a working browser sandbox.

- **Archive read/syntax source integration:**
  [PR #172](https://github.com/lbeezr/thousand-unit-skirmish/pull/172), merge
  `f55ef4330fb0b3a19589930deff353495874982b`.
  [Independent COMMENT review](https://github.com/lbeezr/thousand-unit-skirmish/pull/172#pullrequestreview-5403283747)
  found no blockers. Read and syntax failures retain causes behind safe messages;
  unexpected parser faults retain identity. Failed import does not open storage,
  and retry preserves metadata/original bytes. Library, audio runtime, served
  imports and packaged-release checks pass at merged main. **Native/deployed
  import acceptance remains incomplete** with the same runtime release and
  browser-sandbox ownership/blocker as PR #166.

- **Sprite-atlas input/schema diagnostics:**
  [PR #183](https://github.com/lbeezr/thousand-unit-skirmish/pull/183), merge
  `9feda6617d227ad41e196a50e1ab3af9eb905528`.
  [Independent COMMENT review](https://github.com/lbeezr/thousand-unit-skirmish/pull/183#pullrequestreview-5403330978)
  found no blockers. Safe manifest read/JSON and schema messages retain native
  causes; unexpected path argument faults remain exceptions. Handoff, archery,
  town-center and cast scenarios pass before and after merge, including actual
  invalid CLI consumers, isolated schema repair/retry and valid pack checks.
  Actual valid CLI invocation at merged main reports 16 files, one page and one
  asset. This tooling outcome needs no production deployment.

- **Visual-pack input/schema diagnostics source checks:**
  [PR #190](https://github.com/lbeezr/thousand-unit-skirmish/pull/190) retains
  original causes behind useful file/JSON/schema retry messages. The actual
  CI-registered scenario covers missing parent/file, directory input, private
  malformed JSON, input preservation, repair/retry, isolated schema repair and
  programmer-fault stacks. External model symlinks still fail before their bytes
  are parsed. Real valid pack output matches the pre-change output byte-for-byte.
  Exact independent review, merge and fresh-main acceptance are recorded in the
  linked PR. This tooling outcome needs no production deployment.

The [IndexedDB opening algorithm](https://w3c.github.io/IndexedDB/#open-a-database-connection)
fires `blocked`, waits for the existing connections to close, then continues
opening. Rejecting our own promise does not cancel that request; the owner must
close its eventual unused connection.

Actual `node scripts/browser-preflight.mjs --launch` at `4467986` with writable
per-job profile/config/cache directories returned `sandbox-unavailable`, exit 1,
and zero screenshots. Deferred IndexedDB tests establish source recovery and
cleanup, not native browser storage or deployed Audio Studio acceptance.

## Integration and stop conditions

Keep reviewed, merged and deployed revisions separate. Queued hosted CI is not
a passing result or a hold unless an actual protection requires it. After each
merge record applicable source/tool/package evidence and take the next justified
disjoint item. Runtime source integration does not close browser/deployed
acceptance; preserve its named owner and next action. Stop dependent work for
missing authorization, unresolved overlap, unavailable execution or no justified
remaining issue, and state the concrete condition. Never invent work or expand
spending, access, publication rights or repository permissions to continue.

Historical input/capture fixes and PRs #450/#455/#458 have source integration
evidence; they do not remain in the ready source queue. The current bounded
authoring scope and remaining acceptance are recorded in the 6 October queue
above. Earlier Publish/audio observations retain their historical browser and
release dependencies; they do not authorize edits to those lanes. Resume native
acceptance when the required capability and identified release are available;
select another source fix only after concrete reproduction and ownership checks.
