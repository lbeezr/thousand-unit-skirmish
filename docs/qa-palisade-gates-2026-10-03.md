# Manual gate checks — 3 October 2026

The foundation is specified in [the gate contract](palisade-gates.md). Automated
evidence checks actual server commands and actual client button callbacks.
Native Mac appearance and usability remain unverified. Provider browser capture
has previously failed sandbox/storage preflight; this slice claims no rendered
screenshots or bypass of that restriction.

## Reproduce locally

Check out the gate PR's final reviewed commit (recorded in its Conversation),
run `npm ci`, then `node scripts/paid-gate-scenario.mjs` and
`node --test scripts/palisade-gate.test.mjs`. The scenario authors its own small
maps, pays from declared starting wood, uses selected Workers and resumes both
seat tokens across server restarts. It injects invalid checkpoint data only for
the deliberately corrupt recovery case.

For human review run `npm start` normally, with no preview flags. Open two local
browser sessions, create a PvP room with enough declared starting wood, ready
both seats and launch an open map. For each seat:

1. Select one Worker, then choose **Build Palisade Gate**. Confirm other Workers
   retain their current orders. Click an empty cell; check one 15-wood payment,
   only selected construction and initially closed leaves.
2. Select the unfinished gate. Confirm only ordinary construction controls are
   offered; opening is unavailable. Let it finish naturally.
3. Select the completed gate and focus **Open gate · both teams may pass**.
   Activate with Enter/Space. Confirm the leaves visibly open, the button now
   says **Close gate**, and focus remains on that same button.
4. Send a Worker from each team through the open cell. Stop one inside it and
   attempt to close. Confirm `GATE REJECTED · UNITS IN GATE`, no movement,
   payment or state change. Move it out, close, and check a subsequent route
   avoids the cell. Gate operation must not recruit Workers.
5. Open it again. Attempt to place another building on it: the site remains
   reserved. Drag a friendly wall line across it: the gate is reused free and
   remains open; adjacent walls join the gate. Enemy placement remains blocked.
6. Restart the local server with a configured checkpoint, reconnect both tokens,
   and confirm gate state, identity, bank and a unit stopped inside an open gate
   survive. Resume its move through the cell after reconnect.
7. In an authored two-passage corridor, build a closed gate at one gap while
   leaving the other open. Open the gate, then build a wall at the other gap.
   Closing the last remaining gate passage must reject with
   `GATE REJECTED · WOULD BLOCK A ROUTE`; both teams must still traverse it.

Record exact commit, browser/device, both-seat observations and screenshots if
the human session is run. Do not treat analytic geometry or DOM assertions as
rendered appearance evidence. Gate artwork and final price balance remain open.
