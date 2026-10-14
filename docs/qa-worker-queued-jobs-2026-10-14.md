# Worker completion before queued travel — 14 October 2026

Owner: unit functionality chat `01a13a88-6b18-7821-9ca1-5856d78ad67b`.
The owner retains review, integration, release identity and ordinary-game acceptance.

## Outcome and reproduction

On baseline `dcde6da3150151a3c4b7398fa369345611096b59`, build a paid House
on Open Field with one selected Worker, then Shift Move before it completes.
Both seats report `PLANNING MOVE`, clear the construction target and retain no
waypoint. The Worker abandons the paid site. The new regression fails at the
expected `WAYPOINT QUEUED` notice before the correction.

Shift Move / Shift Attack Move now wait behind construction or repair. Remaining
assigned wall sites retain priority across internal approaches and the
segment-completion window. Safe construction egress remains required. Final
completion retains an anchor for the existing waypoint planner. Explicit later
travel overrides the Farm renewal's automatic harvesting continuation. Removing
the current site releases later travel after any remaining assigned sites.
Ordinary Move, Stop and Hold immediately replace both work and queued travel.
No new order shape, saved field, asset, movement rule or payment rule is introduced.

Write scope: server job/route transitions, existing construction/renewal
regressions, a fixed-tick journey and a native two-seat scenario, CI registration
and the owning behavior guides. Existing [Worker HUD treatment](art-direction/hud-design-system-2026-10-11/README.md)
and queued waypoint readouts remain the presentation backing; no artwork or
presentation layout changes. Runtime inclusion uses the existing server release
entrypoint, with no new public HTTP path.

## Validation

- `node --test scripts/worker-queued-job.test.mjs` exercises both seats through
  paid House/wall construction, paid repair, no-Wood wait, cancellation/refund,
  full queue refusal, recovery and immediate Move/Stop/Hold replacement.
- Existing construction-access and completion-egress journeys retain their
  legal-pose, selected-Worker, payment and cold recovery assertions. Their former
  queued-interruption cases now check explicit unqueued interruption or deferred
  travel, according to the new contract.
- `scripts/farm-replant.test.mjs` adds both-seat normal/recovered renewal followed
  by queued travel, preserving food cargo, banks and the full replanted supply.
- `RTS_PREGAME=0 node scripts/worker-queued-job-native-scenario.mjs` runs the
  actual asynchronous server with two WebSocket seats. Each seat pays for a
  House or three-wall line, queues Move then Attack Move, restarts the process
  during work, completes every site and reaches the final destination. All
  unselected units remain unchanged, with no duplicate payment. Initial native
  source-content checks finish in 720 ticks for Houses and 750 for wall lines;
  these fixture timings are not performance or balance budgets.

Final implementation `a1264e30f95f3be02edd9eaae8fa2e61ba2909ea` is clean.
Server SHA-256 is `fd630008087101f6104347a2beecc95def5ee56cdb7c4865f75c3442fea5293a`.
All 438 focused Worker/order checks pass. The final clean native run repeats
the 720/750-tick completions and preserves payments and unselected units through
process restart; [native.json](qa-evidence/worker-queued-jobs-2026-10-14/native.json)
retains the exact receipt. The clean pack includes the production server among
1,846 files with digest
`sha256:d802937a7d9671c02a5644f38decf44000f7f8257f0e35a38317d258ee95ade2`.
[checks.json](qa-evidence/worker-queued-jobs-2026-10-14/checks.json) separates
the focused, native, pack and incomplete broader qualification.
`node scripts/railway-release-scenario.mjs` also passes local packed HTTP,
Basic Auth, WebSocket, import/asset admission, atlas hashes and volume checks.
This verifies served package contracts without claiming browser pixels.

The fixed-tick repair fixture injects 200 HP of damage only; commands, payment,
movement and completion use production functions. The native construction
scenario injects no actor, progress, cargo or economy state. Neither establishes
rendered usability or the current hosted release.

An adjacent Patrol VM test had a missing `workerEconomyBodyRadius` binding;
its context now receives the same real helper already used by production.
The broader 574-test selection passed 554 and failed 20 military-stance checks.
Nineteen fail in the Team 0 `actors arrive` setup; one schema-25 migration test
fails before migration because Gather has not transferred food. Both failure
classes reproduce with pristine baseline server `dcde6da3` through the unchanged
replay adapter. Team 1's same stance setup passes. These remain separate unit
defects, with this owner retaining diagnosis; they are not waived or reported as
a green full suite. Architecture, strict type and documentation checks pass.
The fast lane stopped after 1,139 passing registrations at a platform-path
assertion in `cloud-install.test.mjs`: `/var/...` and its physical `/private/var/...`
root compare unequal on macOS. The remaining 214 registrations are unrun.
This lane started on the candidate working tree and is not final clean-head
qualification. No full CPU pass is claimed.

## Delivery checkpoint

14 October, 13:33 UTC: branch `codex/worker-finish-then-move`, implementation
head `a1264e30`, focused/native/static validation and clean package complete.
Automatic approval review rejected the GitHub push for private-source egress.
Repository authority, remote identity and matching GitHub/staging main were
checked; the next CLI attempt passed approval review but the CLI identity had
no push permission. Connector publication was then rejected as an indirect
retry of the earlier denial. No branch, PR, merge or deployment is claimed.
Explicit user approval for this repository/payload is pending in the owning
chat; no further publication attempt will occur before that answer.

Independent review is pending explicit authorization to use a review subagent
or review supplied by the user. Owner next transition after those inputs:
publish the bounded PR, complete review, refresh current main, merge under
staging authority and verify the identified served release through normal
game controls. Staging still reports baseline `dcde6da3` on successful deployment
`324fc814-e3a6-477b-b760-b5d5087e351b`; this change is not deployed. Ordinary
game observation remains incomplete. The continuing unit goal stays active;
this receipt does not claim all unit functionality complete.
