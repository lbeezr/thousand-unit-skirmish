# Tactical map movement and selection centering — 3 October 2026

[Testing](testing.md) · [Game bible](game-bible.md) · [PR #76](https://github.com/lbeezr/thousand-unit-skirmish/pull/76)

The former tactical-map pointer handler accepted only the left button and moved
or dragged the camera. Selected units had no minimap destination control.
Right-click now sends one ordinary ground move for the living selected owned IDs;
Shift plus right-click queues a destination. Left-click/drag and focused arrows
continue camera navigation. The coordinate inverse uses the bitmap content box,
CSS border/padding, backing dimensions and aspect-preserving map rectangle, with
world-edge clamping. Camera zoom and DPR do not change the destination.

The minimap sends coordinates through the existing tracked order sender, including
unit generations, formation, queue state and authoritative notices. It performs
no target picking or fog updates. The server owns obstacle fallback and route
planning. Building selections, build placement, empty/foreign/dead selections,
spectators and finished matches cannot send. Browser context menus are suppressed
on this canvas only when an eligible minimap movement context exists.

Space was already bound to camera panning while dragging. A separate small change
adds tap-to-center on release and keeps Space plus drag: once a pan starts, release
cannot center. The shortcut reuses the Center selection camera path for living
owned units or an owned selected building, including HUD-safe positioning and
existing map bounds. It changes neither orders nor selection. Editable controls,
buttons, links, menus, dialogs, modified shortcuts and active targeting retain
their keyboard behavior. Repeat keydown does not cause repeated centering.

## Current evidence

The focused minimap/Space/HUD/navigation checks pass. The minimap suite includes
both seats using the shipped pointer handlers in JSDOM, the shipped WebSocket
serialization, and a disposable authoritative server on a 160×96 fog map. Each
seat moves only two selected units, receives MOVE and WAYPOINT QUEUED notices,
shows actual selected movement, persists one queued waypoint per selected unit,
and leaves all unselected order revisions/goals/queues unchanged. Blocked stone
destinations resolve to open cells. Distant enemies remain absent from filtered
snapshots; destinations stay unexplored before arrival. This is a real server
proof with a simulated DOM, not native rendered input or queue-completion proof.
Existing queued-waypoint scenarios own route completion/recovery coverage.

An independent code review found that the canvas's 1px border shifted large-map
destinations. That finding is fixed and covered by a 256×256 map / 150px bordered
canvas regression: the drawn (120, −120) maps exactly to (120, −120). The reviewer
confirmed the correction and reported no remaining minimap blockers.

The served client import allowlist passes. Native cloud Chromium preflight and
the browser runner both fail before any game rendering because the runtime has
no working Chromium sandbox (also reports unavailable Crashpad storage). No
sandbox flags or permissions were weakened. Zero screenshots or native input
passes are claimed from this runtime.

The parent reports that the first Mac attempt on merged `74d9d56` timed out
waiting for the initial camera outline before any interaction tests. The old
runner required a dashed viewport polygon, but `drawMinimap` draws that polygon
only when all four corner rays intersect the finite terrain mesh. A fitted or
edge view can omit it, and later comparisons could reuse a stale polygon. The
runner now observes the existing Three.js camera through an unchanged native
raycast call, waits for a fresh sample after input, and separately checks boot,
map and team. Real Three.js regressions cover a view where all four corners miss
terrain and verify that observation preserves ray results. Failed runs include
stage, boot/map/team/network and camera diagnostics. Gameplay code is unchanged
by this harness correction. A successful native retry and screenshot review
remain outstanding.

## Exact Mac automated recipe

Use an isolated checkout containing the harness correction and installed Chrome:

```sh
git fetch origin
git switch codex/minimap-browser-camera-probe
git pull --ff-only
npm ci
node scripts/browser-preflight.mjs --launch
node scripts/minimap-orders-browser.mjs --output=/tmp/minimap-orders-mac-proof-01
```

Choose a new output directory on each run. The runner creates and cleans up its
own server, two browser contexts and profiles. It publishes a small rectangular
fog fixture, selects the four Workers through native controls on Azure and Ember,
and exercises native right-click and Shift-right-click at small/large minimap
sizes, 1280×720/DPR 1 and 900×700/DPR 2. It checks exact owned IDs, single sends,
server acknowledgement, movement, queued checkpoints, unchanged selected count
and fresh camera position/orientation/frustum/zoom. The viewport outline is
optional when a camera corner lies beyond terrain. It then verifies left-click camera movement and tap Space
centering against the existing Center selection control, Space plus drag without
recentering on release, and focused-button Space activation, all without another
order. It writes `result.json`, four minimap
movement screenshots and two selection-centering screenshots. Review all six
images before claiming a rendered visual pass. A failed run writes failure evidence
and cannot report `passed: true`; this script has not been run successfully here.

## Exact human click recipe

Start a disposable local worker, then open its URL in one regular and one private
Chrome window to obtain different seats:

```sh
RTS_HOST=127.0.0.1 PORT=4174 RTS_MAP=maps/frontier-160.json node server.mjs
```

1. On Azure, click one friendly unit in the battlefield so the battlefield owns
   keyboard focus. Note another nearby unit that remains unselected. Right-click
   an unexplored minimap location. Expect one MOVE acknowledgement, only the
   selected unit moving, the camera remaining still, and no enemy/resource reveal
   at the destination before arrival. Repeat on Ember.
2. While moving, hold Shift and right-click another minimap location. Expect one
   queued waypoint and the unit continuing its first route before the next leg.
   A normal right-click should replace the route. Use the existing server feedback
   for blocked terrain; the client must not invent a target there.
3. Left-click and drag the minimap to another region. Expect camera navigation
   only, with selection and routes retained. Right-drag must not move the camera
   or emit a stream of orders. Test small/large map sizes, browser resize and zoom.
4. With the battlefield still focused, tap Space. Expect centering on the selected
   unit group and no new order or selection change. Hold Space and left-drag the
   battlefield, release the mouse, then release Space. Expect the dragged view
   to remain. Repeat centering with an owned building selection.
5. Clear selection and right-click the minimap: expect no command. Check a third
   window joined as spectator: expect no command. With a focused HUD button,
   Space must activate that button normally; text fields, chat and open dialogs
   must keep their normal Space behavior. Close panels before resuming game input.

Record the tested commit, Chrome version, both seat results and screenshot paths.
This human pass measures native interaction/discoverability; the automated checks
do not establish unassisted human comprehension.
