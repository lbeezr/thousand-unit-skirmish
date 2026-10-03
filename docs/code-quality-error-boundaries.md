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
| 1 — active | A Blob whose `text()` rejects is reported as `Audio pack is not valid JSON`; its read error is lost. Separate unreadable file from JSON syntax failure, retain causes, prove successful retry. | `src/audio-library-store.mjs`, `scripts/audio-library.test.mjs`, this note | Syntax/read-failure, no-storage-access, retry and programmer-fault regressions now pass. Finish review and merge; no known source overlap. | Source and browser import acceptance: error-handling owner. Runtime release: parent. Native acceptance has the sandbox blocker below. |
| 2 — confirmed | `validateSpriteAtlas()` combines user manifest and bundled schema reads, then appends raw `error.message`. Node JSON syntax errors include malformed input excerpts. A synthetic private token reproduces the exposure. | Sprite-atlas contract and its CLI consumers/tests; narrow before writing | Separate invalid user input from unavailable bundled schemas; preserve useful diagnostics without contents. Verify library and actual CLI invocations. | Error-handling owner; tooling only, no production deployment. |
| 3 — confirmed | `validate-visual-pack.mjs /nonexistent-parent/manifest.json` reaches parent `realpath()` before its input catch; stderr contains a raw Node stack and absolute path. | Validator and existing visual-pack path-safety scenario | Give expected missing-path/permission errors retry guidance while preserving programmer faults. Verify real invalid and valid CLI invocations. | Error-handling owner; tooling only, no production deployment. |

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
