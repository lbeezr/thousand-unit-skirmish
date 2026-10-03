# Palisade drag placement — 3 October 2026

## Scope

The normal **Build Palisade** choice now starts a two-endpoint wall placement
mode. Drag/release places a cardinal line, including one elbow for diagonal
endpoints. Shift chooses the other elbow. A tap places one cell. The whole line
has a connected geometry placeholder and aggregate configured food/wood cost;
compatible friendly segments count as reused/free. No preview flag is required.
The [paid runtime](palisade-runtime.md) remains responsible for collective
connectivity, Worker access, occupancy and one aggregate commit/debit.

Focused tests run the actual client placement functions and renderer event
handlers in a DOM fixture for both seats, rather than a second input controller.
They cover no send on press, exactly one command on release, pending suppression,
invalid-line correction, keyboard input, pointer ownership, cancelled capture,
blur, Escape/RMB, HUD/off-map release and matched terminal acknowledgements.
Pure planner/preview checks include costs, fractional shortage, visible occupancy,
forest disclosure and friendly reuse. Three.js instance checks cover the full
elbow, all sixteen connection masks and the maximum 511-cell two-point preview.
These checks do not establish native input, pixels or unassisted usability.

The owner-run browser preflight reports `sandbox-unavailable` and
`storage-unavailable` in this cloud environment; zero browser screenshots were
produced. No browser sandbox bypass was attempted. Native Mac checks below
remain a follow-up, not an integration hold.

## Exact Mac QA recipe

1. From the reviewed/main build, run `npm ci` and `npm start` on a Mac with Node
   24+. Open the URL printed by the supervisor in Chrome. Start **Play vs AI**
   for the first pass; repeat on Azure and Ember in a two-tab invite room after
   both ready and the host launches. Use the normal game URL without art or
   wall preview parameters. Record the commit, browser version, map and seat.
2. Select a Worker and open **Build**, then choose **Palisade**. Placement should
   focus the battlefield, show drag/keyboard/cancel instructions and leave Map
   Studio closed. The existing build flow selects the team's living Workers.
   Pan/zoom to clear nearby ground away from units, resources and Town Centers.
3. Press on a clear cell and drag four cells along one grid axis. Before release,
   verify five connected green cells and **5 NEW · 75 WOOD** with the current
   provisional profile. The bank must stay unchanged while dragging. Release:
   expect one accepted line and one 75-wood deduction, then Workers build the
   five ordinary sites in sequence. One held press or repeated release must not
   create a second line while confirmation is pending.
4. Drag with both grid coordinates changed. Check the elbow and total cells;
   hold/release Shift before release and verify the alternate elbow. Release
   should place precisely the last preview. Tap a clear cell to place one paid
   post. Retrace friendly segments: reused cells show free and a fully reused
   line acknowledges **WALL ALREADY PLACED · NO CHARGE**, exits placement and
   neither charges again nor restarts Worker work. Entry stays available even
   at zero wood so free reuse works; any new cell still requires its full cost.
5. Start a line through a disclosed live unit, forest/terrain, resource, Town
   Center or other building. The whole preview must turn red with a reason;
   release must send no build and create/pay for no subset. With insufficient
   wood, extend a short affordable line until its **NEED … WOOD** message appears;
   shrink and retry. Whole-line affordability uses the exact bank, not its
   rounded readout. Off-map endpoints must reject rather than snap to the edge.
6. During a drag use Escape, right-click, switch applications, or release over
   the HUD/outside the battlefield. None may place or charge the line. Start a
   new drag afterward. On a touch-capable device, repeat with one finger;
   cancellation/lost capture and a second finger must not submit the first line.
7. Activate Palisade with Tab/Enter. On the focused battlefield use arrows to
   move the cell, Enter to anchor, arrows to extend, then Enter to place. Hold
   Shift to choose the elbow. Held Enter must not submit; an invalid endpoint
   must remain editable until corrected. Escape cancels. Typing in inputs and
   operating the tactical map must retain their existing keyboard behavior.
   In browser fullscreen, the first Escape may exit fullscreen before cancelling.
8. Try closing an available narrow passage. Client green is a disclosed-cell
   preview; authoritative **WOULD BLOCK A ROUTE** or **NO REACHABLE WORKERS**
   rejection is still possible. It must release pending input for a retry and
   produce no partial line or deduction. Existing live paid scenario covers a
   controlled collective corridor cut; this manual map exercise is supplemental.
9. Disconnect while a request waits, then reconnect in the same tab. Placement
   should close; inspect the authoritative line/bank before trying again since
   acceptance may have preceded disconnect. Confirm ordinary single-building
   placement, unit box selection, queued movement and Map Studio resource brush
   gestures still work. Capture any mismatch with steps, commit and screenshot.

The procedural wall presentation is an interim layout placeholder. Finished
modular art, gates, siege policy and final balance remain independent work.
