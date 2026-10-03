# Selected military stance controls

HUD owner: HUD integration lane. Combat owner retains simulation and the
[command/snapshot contract](https://github.com/lbeezr/thousand-unit-skirmish/blob/f2b487dbb98ce3856d88bf4f14b1d7a6041abdfa/docs/military-stances.md)
in [PR159](https://github.com/lbeezr/thousand-unit-skirmish/pull/159).

The existing selected-unit command strip has four written choices: Aggressive,
Defensive, Stand ground and No attack. A checkmark and `aria-pressed` identify a
confirmed common choice; Mixed is written when eligible selections differ.
Tooltips explain automatic acquisition/chase limits and that military alone is
affected. The controls add no panel or keyboard shortcut and retain the strip's
44px targets, overflow, existing actions and dismissible drawer.

Only current own-seat, living, armed military with a matching
`[id, generation, stance]` snapshot entry is eligible. Missing/invalid/stale
entries never imply Aggressive. Workers, unarmed units, enemy, spectator,
building and empty selection hide these controls. Every snapshot clears previous
entries before applying current ones, including recovery/rematch and missing
fields. Mixed Worker/military selection sends only eligible military IDs and
their matching generations using the existing command sender.

Sending `setStance` does not invent an applied state, change selection, issue a
Move, or play a Move cue. Ordinary server notices and subsequent snapshots
confirm it. Choosing an already selected stance is allowed because it may release
Hold. Disconnection and match end retain inspectable unavailable reasons and
block activation; the handler also rechecks current selection/state before send.
Snapshot updates preserve button nodes and focused controls. Existing selection
focus recovery handles a stance group that becomes hidden.
The strip observes the marked stance group's size as well as buttons so a
longer mixed/offline/finished status keeps the focused command fully visible.
Unchanged status snapshots retain ordinary player scrolling.

## Acceptance and remaining delivery

Run `node --test scripts/combat-stance-ui.test.mjs scripts/contextual-hud.test.mjs`
plus the existing HUD/layout/order and client-asset guards. Tests use shipped HTML
and real bindings for both seats; they cover payloads, confirmed/mixed/absent
state, generation replacement, ineligible selection, offline/finished reasons,
fresh activation guards and hidden-group focus recovery. Source checks do not
establish native layout, VoiceOver or authoritative combat behavior.

The HUD PR retains default integration, served module/release checks and an
identified user deployment. The combat command provider must be integrated before
claiming a working normal-game stance outcome. After parent-owned Mac reconnect,
use the ordinary military selection on that identified build: select paid
Infantry/Archers on both seats, issue all four choices, confirm the subsequent
snapshot, then select a mixed Worker/army group and verify Workers retain tasks.
Check Stop → No attack, Hold → Stand ground, mixed selection, reconnect/rematch,
full Tab/Shift-Tab visibility with small/large minimap and growing status reasons,
Escape/Close focus recovery
and VoiceOver's names/pressed/unavailable states. Combat owner supplies policy
behavior proof; HUD owner retains actual control usability. Track open work in
the [ranked backlog](hud-controls-backlog.md).
