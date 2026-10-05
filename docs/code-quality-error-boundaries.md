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

## Ranked backlog

| Rank/status | Reproduction and outcome | Write boundary | Next action/dependency | Acceptance owner |
| --- | --- | --- | --- | --- |
| 1 — reproduced, source fix under review | Pending export of First mix downloaded as Second mix after selection/Stop, replacing the stopped status; late failure also replaced it. Reproduced at `2b4a5246`. | Mounted composer export completion, delayed lifecycle tests, CI and owning guides | Independent exact-head review, merge and clean package/serving proof. Native/deployed download remains open. | Error-handling owner; coordinated release owner retains deployment. |
| 2 — source integrated, native acceptance blocked | [PR #455](https://github.com/lbeezr/thousand-unit-skirmish/pull/455) preserves WAV read/decode causes and unexpected fault identity. Merge `55860818ca95c41c454fb0ff9df05ac177464192`; independent review and fresh-source/package/serving checks pass. | No additional read/decode source edit justified | Observe native export failure/repair/retry on an identified release in a working provider browser. | Error-handling owner; coordinated release owner retains deployment. |
| 2 — source integrated, native acceptance blocked | [PR #450](https://github.com/lbeezr/thousand-unit-skirmish/pull/450) cancels pending preview resume and obsolete status updates. Merge `70289cacc33065182e0c9a4ab7f36251e6178c07`; independent review found no blockers. Nine regressions, composer/player/library checks and clean package/serving pass. | No additional preview source edit is justified | Observe preview Stop/retry on an identified release in a working provider browser sandbox. Head `19e581cd` probe was blocked with sandbox/storage failures, zero frames/screenshots; do not retry unchanged capability. | Error-handling owner; coordinated release owner retains deployment. |
| Historical — integration tracked | [PR #190](https://github.com/lbeezr/thousand-unit-skirmish/pull/190) fixes missing-parent raw stacks and malformed JSON excerpts in visual-pack input loading. Real invalid/valid CLI, repair/retry, programmer-fault and unchanged symlink checks pass. | Validator, existing visual-pack path-safety scenario, this note | The linked PR retains exact reviewed head, merge and fresh-main tool acceptance. | Error-handling owner; tooling only, no production deployment. |
| 2 — native acceptance blocked | Audio open and import source fixes have merged in PRs #166 and #172. The actual browser launch failed with `sandbox-unavailable`; no deployed revision has been identified for native Audio Studio retry/import observation. | No further source edit is justified by this blocker. | Parent identifies the coordinated runtime release; resume normal/blocked-open/import retry observation in a provider runtime with a working browser sandbox. | Parent owns coordinated release; error-handling owner retains native acceptance in the linked audio PRs below. |
| 3 — next bounded audit, unconfirmed | Check asynchronous Save completion after editing or selecting another composition while persistence is pending. | Read-only mounted-editor Save audit; no edits reserved | Reproduce lost edits or stale status before proposing any change and verify persistence ownership. Map import/validators remain with architecture; shipped-audio reader remains outside this lane. | Error-handling owner |

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

Once PR #190 is integrated, every reproduced source candidate in this ranked
set has shipped; there is no further confirmed disjoint source issue in this
audit set. Remaining native/deployed audio acceptance is blocked by the actual
browser launch failure and the unidentified coordinated runtime release above.
Resume that acceptance when both dependencies are available, or select another
source fix only after a new concrete reproduction establishes its scope.
