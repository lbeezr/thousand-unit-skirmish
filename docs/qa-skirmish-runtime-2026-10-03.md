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
SHA-256 `65022ce9d11eaaafc561e4c7e0e7198005dd10199f841adf16c73f801152900d`.
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
Saved Skirmish overrides missing fresh launch fields. A genuine schema-25 legacy
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
stances 24→25, mode identity 25→26. All 50 stance tests plus its native return/
restart scenario pass after integration. Exact old fixtures omit mode fields;
legacy saves claiming them are not accepted as new modes.

A broader production check exposed a stale synthetic fixture also reproduced on
untouched main `913afa2b`: relocating a stance-bearing attacker retained its old
automatic combat anchor. The fixture now clears automatic stance movement for
the focused lethal attack and holds cloned capacity-test units passive. These
are test-state corrections; gameplay combat/construction is unchanged. The full
production scenario now passes, including replacement production at 2,000 units.

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
