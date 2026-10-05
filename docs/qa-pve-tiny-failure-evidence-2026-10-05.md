# Tiny completion failure: retained evidence boundary

Opponent AI `01a10297`, 5 October 2026. The new exact-source CPU receipt confirms
noncompletion, but supplies no terminal checkpoint or decision history. No
survivor, hidden-information, acquisition or movement defect can be identified
from that receipt. This source slice fixes the scenario's evidence retention;
it changes no gameplay policy, mode rule, seed or completion requirement. Art N/A.

## Exact input and bounded diagnosis

[CI coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/379#issuecomment-5986716137)
reports frozen clean `f2931a41a525fff6e6731e24197e5fdbebd46318`:
1,080 registry checks pass, one fails and 215 remain unrun of1,296. The Tiny
batch contains two passes and two failures. Seeds `[20260925,0]` remain ongoing
at108000ticks/3600seconds in both authored@1 and skirmish@1; reversed seeds
`[0,20260925]` complete at2412seconds and exactly replay/reset in both native
modes. Policy identity is skirmish@1 throughout.

The received receipt explicitly says its assertion precedes returning the final
checkpoint and trace. Exact-source inspection confirms that ordering and the
fixture's unconditional cleanup. The cited CI-local directory
`/workspace/cpu-qualification-f2931a41` is absent from this worker environment;
the coordination receipt and Git source are accessible. No raw local report,
terminal phenotype or original failed replay was inspected here. The input
does establish a match-completion failure rather than a missing mode binding
or checkpoint restore rejection.

This case is separate from the older
[Scout/contact evidence](qa-pve-contact-memory-2026-10-04.md) and PR372 Worker
mirror. Their actor identities or causes cannot be borrowed for this failure.
Movement integrations after f293 also do not retroactively qualify its result.
No further full match is run to manufacture a diagnosis.

## Replay-neutral retention change

The existing Tiny scenario keeps the latest already-computed seat-filtered
decision view for each seat. When the original terminal checkpoint is ongoing,
it emits one `PVE_TINY_FAILURE ` line containing a checksummed gzip/base64
packet before throwing the original completion assertion. The packet includes:

- Source revision/dirtiness, native/policy identities and seeds.
- Original opening and terminal native checkpoints, with stable generations.
- Complete accepted command/notice ledger and existing economy metrics.
- Last filtered decision views, with their actual ticks. They precede the
  terminal checkpoint and do not claim continuous or terminal sight.

The collector adds no checkpoint, observation call, tick, command or policy
decision. It stores copied views without feeding authority into a policy. The
original108000-tick loop, restart at18000, victory reason, paid economy, exact
replay and rematch assertions remain. A failed logging sink still throws the
original noncompletion assertion. Successful terminal input emits no packet.

The line is part of normal test stderr/CI console output and does not depend on a
temporary file remaining accessible across workers. The uploaded scoped CI JSON
report does not contain child output; CI must retain the complete console log
for diagnosis. Durable hosted packet availability remains unverified until an
actual failed qualification emits it. Strip a Node TAP `# ` prefix if
present, parse the JSON after `PVE_TINY_FAILURE `, and pass the envelope to
`decodeTinyFailureEvidence` from `scripts/pve-tiny-failure-evidence.mjs`.
The decoder verifies byte length and SHA256 before returning the record.
Native checkpoints are trusted QA artifacts, not new gameplay inputs.

## Verification and next dependency

Five focused retention contracts pass: exact payload/hidden-view boundary,
corruption and broken-sink failure, success silence, and both native identities.
Each native probe starts with the ordinary canonical opening, issues one owned
Move, advances150ticks/five seconds, captures a genuine ongoing checkpoint and
restores the decoded packet into a fresh native fixture. Full seat wire state
matches under the existing documented Worker-transient recovery rule. Encoding
leaves the original checkpoint and command data unchanged. These short probes
do not truncate or pass the3600-second qualification.

Independent review also round-trips an 18,319,366-byte historical analysis
payload through Node's default/TAP reporters and the CI runner's inherited
stdio: the complete 988,497-character packet decodes exactly, with failed child
exit1. This establishes local log transport, not hosted retention or a new game.
Independent review and exact-head author/postmerge checks are retained by the
owning PR. No full CPU suite, full-match reproduction, gameplay improvement,
deployment or rendered acceptance is claimed. Medium admission is unchanged.

On the later4b8ab97b baseline, a broader targeting/reconnaissance run passes
87 of92 checks; five historical Medium target fixtures reject `unsupported
schema version` before policy execution. Their old schema predates the new
voluntary-ending checkpoint version, and their expected older content-pin
rejection is never reached. This is separate from f293's reported Tiny failure
and from the earlier Food Tools fixture migration. These failures and their
logs remain; this PR changes no checkpoint migration or validator. The final
focused floor excludes only those five named legacy cases.

The concrete dependency remains a failure packet from the **normal next
qualified Tiny check**, at its exact source, or an equivalent retained native
checkpoint/decision record supplied by CI owner `01a10378`. Opponent AI retains
the bounded survivor/disclosure/command diagnosis after that input; movement
`01a107ba` is involved only if an actual route witness implicates shared paths.
No gameplay fix is selected before such evidence, and no invented time-limit
victory or weaker assertion closes the failed qualification.
