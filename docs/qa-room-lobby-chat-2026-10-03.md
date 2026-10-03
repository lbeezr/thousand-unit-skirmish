# Pregame room chat — 3 October 2026

[Lobby contract](room-lobby.md) · [Pregame integration](qa-room-lobby-2026-10-03.md)

This follows merged pregame PR #41. The separate slice starts from fork main
`ccc9b0727f0391b2ef6d952b84ee2549600261f7`; chat authority and presentation are
new room modules, with narrow existing command/welcome/client routing hooks.
There is no supervisor/session rewrite or checkpoint schema change.

## Delivered behavior and tests

Connected Azure/Ember seats can exchange plain text while waiting. Spectators
read only. The authoritative sender comes from the existing session, never the
request. Messages and retry/rate records are bounded; reconnect retains the
seat's rate limit. Chat leaves readiness and match configuration unchanged.
Launch/send races obey worker serialization; rematch retains the room log.
Worker restart clears it without putting text into simulation checkpoints.

`node --test scripts/room-lobby-chat.test.mjs scripts/room-lobby-chat-ui.test.mjs`
passes ten focused cases: authority/impersonation, atomic text/ID validation,
Unicode and markup-as-text, per-seat rate/retry behavior, bounded history and
replaced-seat records, pending duplicate suppression across lobby updates,
draft retention on rejection/disconnect, read-only spectators, log recovery,
scroll-position preservation and a simulated missing browser `randomUUID` API.

`node scripts/room-lobby-chat-scenario.mjs` passes eight groups using a real
supervisor and independent native WebSockets: two-seat identity/spectators,
atomic rejection, two-room isolation and legacy admission, retry/rate checks
across rejoin, unchanged ready state, send/launch ordering and rematch,
ephemeral restart with stable seat recovery, public UI/private authority routes.
No application accounts, chat backend or deployed service are used.

Final runtime integration `4548b854b5d4ca73d4963d8cdd7391787b53ebab` includes main
`7606d84d165f7907ca8f8b1a8a5ce483bdb84e31`, preserving the movement, water study,
shore authoring, audio lifecycle and HUD integrations. All 518 Node tests pass
with zero failures/skips; the chat scenario's eight groups and existing pregame
scenario's eleven groups pass. Existing camera/build/rematch extraction fixtures
retain their original assertions and supply the new welcome-history callback.

Documentation passes 418 Markdown files / 2,731 local links. Syntax, whitespace,
31 Docker UI assets and the complete packaged client import/art delivery checks
pass. The clean local release contains 1,026 files, digest
`sha256:3cee536955f1aec405c6be0f882ee79a37d2a34a7f3cdef318fdf2848ec830a2`.
The new public UI module returns 200; its server authority module returns 404.
No chat history is added to frequent state packets or checkpoints. The owning
PR records independent review, guarded merge and subsequent postmerge evidence.

## Current-main and focus integration

Runtime head `8848192025d1880df8aec8c9b5375371e3be6b19` integrates main
`9e7aadbff2039edd220896c829565edfb2205937`, including palisades, cargo return,
fish ripple binding and contextual research accessibility. The two recovery
fixture conflicts preserve both chat and fish hooks. All 623 Node tests pass
with zero failures/skips, including 17 focused room/chat authority and focus
cases. The chat protocol scenario passes all eight groups. Documentation passes
422 files / 2,753 local links; runtime syntax and whitespace checks pass.

The pregame scenario printed all eleven passing groups but hung awaiting a
client close during teardown. Its final cleanup now starts client closes,
stops its owned supervisor, and bounds the wait for each close. The rerun
completed successfully with all original eleven checks. This changes the test
cleanup only; no room/session runtime behavior changes.

The clean package at `8848192` contains 1,029 files, digest
`sha256:3e9960d45f1f301d18d3da9f9781a68d3d9c2741fbae5946ffc127f99075ca40`.
The owning PR records the final packaged-delivery/review/postmerge results.

## Browser check on Mac

Use two independent profiles on the exact local build. Verify ordinary and
narrow desktop sizes, labelled input/Send, Tab navigation in the native dialog,
Enter sends once, and text containing markup appears as text. Exchange enough
messages to scroll; new messages should follow when reading at the bottom and
retain a scrolled-up reading position. Verify a pending send survives another
player's readiness update, rejection retains its draft, reconnect displays the
current history, and rematch/restart show the documented history behavior.
Typing in the input uses the existing dialog/editing-target keyboard guard.

PR #57 also fixes the [Mac-observed Ready focus loss](https://github.com/lbeezr/thousand-unit-skirmish/pull/41#issuecomment-5969864079)
in the shared lobby component. The dialog opens on the host's enabled Map or
guest's Ready control. Acknowledgements/rejections restore the sending control
when disabling it moved focus to BODY; a newer deliberate control choice wins,
including overlapping Ready/chat requests. Seventeen focused authority/DOM
tests pass. This is a DOM regression check; the fix still needs native browser
verification on the final build.

The cloud Chromium SUID sandbox remains unavailable. No browser sandbox bypass
or native appearance/focus/input claim is made by these DOM/HTTP/WebSocket
checks. No deployment, paid service, new simulation civilization/team capacity
or persistent communication system is delivered.
