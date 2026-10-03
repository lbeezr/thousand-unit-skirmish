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

The full Node suite passes 449 cases with zero failures/skips at the initial
working implementation. Existing camera/build/rematch extraction fixtures retain
their original assertions and supply the new welcome-history callback.
Final head, integration/release evidence and independent review belong to the
owning PR and will be recorded there.

## Browser check on Mac

Use two independent profiles on the exact local build. Verify ordinary and
narrow desktop sizes, labelled input/Send, Tab navigation in the native dialog,
Enter sends once, and text containing markup appears as text. Exchange enough
messages to scroll; new messages should follow when reading at the bottom and
retain a scrolled-up reading position. Verify a pending send survives another
player's readiness update, rejection retains its draft, reconnect displays the
current history, and rematch/restart show the documented history behavior.
Typing in the input uses the existing dialog/editing-target keyboard guard.

The cloud Chromium SUID sandbox remains unavailable. No browser sandbox bypass
or native appearance/focus/input claim is made by these DOM/HTTP/WebSocket
checks. No deployment, paid service, new simulation civilization/team capacity
or persistent communication system is delivered.
