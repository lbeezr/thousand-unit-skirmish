# Code extraction and maintainability backlog

Owner: the code extraction workstream in source task
`01a0f784-c5d7-72e0-82e8-1747b4c840c1`. Update this queue in each owned slice.
Repository issues are disabled. This note records bounded extraction work;
product priorities remain in the roadmap. Dedicated type, error and architecture
owners retain their tooling and broader migrations.

## Ranked queue

| Rank / state | Evidence and next action | Write boundary | Dependencies and acceptance |
| --- | --- | --- | --- |
| 1 — [PR170 in review](https://github.com/lbeezr/thousand-unit-skirmish/pull/170) | The server's 27-line deflate-offer rule is unchanged since prototype `691c6d2` and had no direct unit contract. Its raw header decision is now isolated with current negotiation behavior retained. | `src/networking/websocket-deflate-offer.mjs`, one server import/call/removal, dedicated tests, adjacent CI coverage registration and this note. | 38 literal cases, 9,223 baseline decisions, strict checkJs, 10 real accepted/declined handshakes and package smoke pass. Finish independent review and guarded merge. Quality owner retains coordinated deployed transport acceptance. |
| 2 — audit before selecting | Tick duration and start lag repeat sorted ring-window quantiles in `tickTimingPayload`. Actual browser/pathfinding/staging percentile helpers differ in rounding and empty results; a cross-tool consolidation is unjustified. Inspect the two server timing windows' sample ordering and rounding next. | No writes reserved. Potential pure diagnostic helper and exact timing adapters/tests; counters, scheduler and performance policy remain outside this slice. | First prove useful shared semantics and check ownership of any overlapping performance interface. Preserve output names, nulls, rounding and window behavior. Defer if the only benefit is moving lines. |
| 3 — deferred | Checkpoint validation is roughly 400 lines; main exceeds 10,000 lines and imports 54 modules at the audited baseline. Both are real coupling hotspots, but save invariants and active feature owners require stable seams first. | No checkpoint/save, HUD, renderer binding, combat, animation, lab entry, mode config, Skiff, AGENTS or shared planning-guide edits reserved. | Agree any shared interface with its affected owner and establish behavior evidence before editing. No bulk moves, generalized protocols or coincidental abstraction. |

## Integrated code milestones

| Slice | Merge and evidence | Remaining acceptance |
| --- | --- | --- |
| [Bounded shipped-audio reader, PR138](https://github.com/lbeezr/thousand-unit-skirmish/pull/138) | `af36898d4cf7857bbfa4a09e5dbbc3f4cc2d70f8`; 132 tests, safe fixed expected-error messages, retained programmer/cancellation failures, narrow 100% coverage and local delivered/package proof. Independent review is recorded in the PR. | Native delivered audio/mute/recovery acceptance on an identified deployed source. |
| [Shared action rules, PR144](https://github.com/lbeezr/thousand-unit-skirmish/pull/144) | `8bfbc3c066ac4574a13544c8b7aa0295c31849f7`; 128 tests, 80,640 comparisons, exact reason order/epsilon and native production/research/refund/restart/package proof. | Deployed action acceptance; the PR contains the native recipe. |
| [Outbound frame/count contract, PR164](https://github.com/lbeezr/thousand-unit-skirmish/pull/164) | `14590fb2189f76c3babb3a5e43e9a2c5edcac76b`; six files, 119 additions/27 deletions. 42 tests at 100% helper coverage, 497 baseline comparisons and real hardening/slow-reader/compression/resume probes. [Exact integration review](https://github.com/lbeezr/thousand-unit-skirmish/pull/164#pullrequestreview-5403208630) passed; actual merged source passed 50 framing/fixture/import/CI/objective tests and packaged release. | Fresh authorized join/state/control frames, negotiated compression and reconnect on a SUCCESS deployment containing the merge. |

## Runtime ownership and execution limits

The quality owner retains these acceptance steps, coordinated with the source
task parent's staging deployment and native QA. No independent redeploy or
config/auth change is authorized. Read-only Railway inspection now confirms
SUCCESS deployment `df65855c-57e3-4979-a345-1c7e83e90173`, source
`0fb9a3dcc1f93f44b87fe5ea8ab8caabf9da0739` (3 October, 22:55 UTC).
Git ancestry includes PR138/144/164; this establishes deployment inclusion,
not native acceptance. PR170 is excluded until a later deployed source contains it.

In this executor, staging CONNECT probes failed with proxy 403 before application
HTTP, and supported Chromium preflight reported unavailable sandbox/storage.
Do not bypass either. PR144 and PR164 own the prepared native recipes; passing
local tests or a deployment alone does not establish listening/native acceptance.
Tooling-only slices need their real tool/check acceptance, not a game deployment.

## Organization handoff

PR164 records the inspected graph: baseline `94fb803` had 146 direct source
files, 141 JS modules and no subdirectories. The static runtime graph had 247
local edges and no cycles; dynamic imports and tests/tools were outside that
count. History starts with six flat prototype modules and incremental additions.
The lack of a planned domain migration is an inference about that history.

The architecture owner retains graph guards, folder strategy and consumer
migrations. The two transport leaves use direct named exports without barrels
or dependencies back into simulation, rendering, UI or entry roots.
Checked-type tooling and error policy remain with their dedicated owners.
