# Explicit human Skirmish runtime

[Mode contract](match-mode-contract.md) · [Mode backlog](playable-modes-backlog.md) · [Victory audit](victory-modes-audit-2026-10-03.md)

Owner: playable-modes workstream. This is a native/protocol milestone; ordinary
rendered matches, lobby-selector delivery and identified deployed acceptance
remain open. Parent-assigned lobby owner `01a101c4` consumes the paired mode and
capability catalog. Parent-assigned AI owner consumes the policy descriptor.
Railway delivery owner `01a10227-2c6d` coordinates future staging execution; the
mode owner retains gameplay acceptance. No ordinary default change is included.

## Native behavior

`node scripts/match-mode-native-scenario.mjs` passed eight cases on runtime
SHA-256 `d59c49ba44a688f7b218cca233a6faeaa2b3d12f33338bfd7ec608cd4cb9e76c`.
[Retained native records](qa-evidence/skirmish-runtime-2026-10-03/native.json)
pin the runtime bytes. The normal Millrace worker starts with `skirmish@1` through explicit launch fields.
An actual North Ford capture at about 26 seconds awards 75 food and 50 wood.
Deliberate checkpoint boundaries additionally prove all posts owned beyond
900 seconds do not produce a winner, a Worker survives Town Center loss with
zero resources, and losing all recovery paths produces elimination. Terminal
results remain final. These edge fixtures do not establish balance or a minimum
match duration.

The welcome uses effective bonus-only post rules, while the checkpoint preserves
the canonical map, checksum, capture/reward/event fields and exact identity.
Saved Skirmish overrides missing fresh launch fields. A genuine schema-26 legacy
snapshot without either field recovers authored deadline rules despite fresh
Skirmish launch settings. Unknown IDs/versions are rejected and retained
byte-for-byte through the existing recovery path.

`node scripts/room-pregame-scenario.mjs` passed two-seat host configuration,
readiness invalidation, guest/stale/partial/version/map rejection, canonical
checkpoint persistence and restored Skirmish readiness clearing. Room metadata
reports the selected identity independently of unchanged initial launch options.
The existing lifecycle proof also covers waiting freeze, launch races, rematch,
publication, spectators and host reservation/replacement.

The 38 focused registry/checkpoint/launch/pregame tests pass. Current main's
military stance migration composes before mode migration: wildlife 23→24,
stances 24→25, Sheep claims 25→26, mode identity 26→27. Stance and Sheep
regressions plus both native scenarios pass after integration. Exact old fixtures omit mode fields;
legacy saves claiming them are not accepted as new modes.

A broader production check exposed a stale synthetic fixture also reproduced on
untouched main `913afa2b`: relocating a stance-bearing attacker retained its old
automatic combat anchor. The fixture now clears automatic stance movement for
the focused lethal attack and holds cloned capacity-test units passive. These
are test-state corrections; gameplay combat/construction is unchanged. The full
production scenario now passes, including replacement production at 2,000 units.

The public mode registry was served byte-exact by the native HTTP worker. The
client import/asset admission check also passes after the stance-HUD integration
and extracted manifest; its 107-module probe includes the explicit mode entry.

## Scope and remaining acceptance

The base-target policy from [PR #195](https://github.com/lbeezr/thousand-unit-skirmish/pull/195) is integrated; the server passes the effective identity
to its policy factory on activation/reset. Its fourteen pure and two paid replay
checks pass together with this slice's 38 focused tests (54 total). PvE Skirmish
remains rejected while full-map/ordinary-entry AI acceptance is pending. Existing
PvE room launch/rematch/recruit recovery passes under `authored@1`. Objective
Control retains authored timers. Workers, paid land queues and affordable legal
production retain existing elimination semantics; Town Center destruction alone
is not a loss. Resignation and automatic stalemate outcomes remain absent.

The workspace's supported browser launch failed sandbox/storage setup; staging
HTTPS was blocked by the workspace proxy. No credential change or sandbox/access
bypass was attempted. Native checks do not substitute for ordinary rendered or
served-match acceptance. Clarity's previously identified staging deployment was
`df65855c-57e3-4979-a345-1c7e83e90173`, source
`0fb9a3dcc1f93f44b87fe5ea8ab8caabf9da0739` (SUCCESS, contains PR #158).
That deployment predates this runtime slice; the next coordinated build and its
mode/legacy normal-match checks remain owned and incomplete.

## Post-merge verification

[PR #200](https://github.com/lbeezr/thousand-unit-skirmish/pull/200) merged at
`dc6e5ac752cf82a73b946a4976bd24ebfe52d3d8`. Independent review approved local
`49efd9831bd522f9a1e414f47c569d9ffc3ef44c`, tree
`bf9ab5ec5bd929a58a439a94ac7eb352624eeab5`; the published candidate had that
exact tree. It passed 106 focused checks, browser/Node types, imports, syntax,
docs and 107-module admission. Its clean 1,152-file release package had digest
`sha256:678df8bf07f3b839c6d6c04e207746ecfd456bfa07d8ebd18bece45acb915a89`.
That package identifies the reviewed candidate, not the subsequently merged
source or a deployed release.

Concurrent Worker activity and objective AI rotation changes entered the merge.
The eight native mode cases were repeated on the exact merged source above;
[merged native records](qa-evidence/skirmish-runtime-2026-10-03/merged-native.json)
pin server SHA-256
`49a7d1832a8194dc5b8bfe5f1341e99bfe14f1d5189fe019fd94f0ba6e854b46`.
The 38 mode/launch/checkpoint/pregame checks plus eight objective-rotation checks
also passed (46 total). This includes paid wall obstruction and checkpoint
replay for both AI seats under authored objective rules.

A read-only Railway lookup after merge still identified staging deployment
`df65855c-57e3-4979-a345-1c7e83e90173`, source
`0fb9a3dcc1f93f44b87fe5ea8ab8caabf9da0739`. No new staging execution was
performed. Delivery owner `01a10227-2c6d` must identify a deployed source
containing PR #200 before mode-owner live acceptance. The selector and AI owners
retain their documented dependencies; no ordinary-default or PvE-capability
change follows from this merge.
