# Empty-selection command visibility

## Workshop Build prerequisite disclosure — 7 October 2026

The registered Workshop construction choice in Build & train now stays
keyboard-focusable when unavailable, using the existing inspectable-action
pattern. Its visible label and matching tooltip name **MILITARY TIER II at
Town Center**, rather than only “RESEARCH REQUIRED”. Once unlocked, it shows
the current rounded-up resource shortfall, or why team/Worker selection,
pending construction or the ended match prevents activation. Completion uses
the registered technology upgrade key; no prerequisite or price changes.

Stable buttons retain focus through stock/research updates. Activation refreshes
current eligibility before entering or cancelling placement, so keyboard,
pointer and retained stale controls cannot start unavailable construction.
Mixed selection retains its eligible Workers; empty, foreign, dead or stale IDs
do not. Other catalog buildings retain their existing native-disabled treatment.

Both-seat tests in `contextual-hud.test.mjs` exercise these transitions through
the actual menu handlers; `roster-building-ui.test.mjs` retains exact-price and
placement/cancellation checks. Backing is the existing labelled compact HUD,
44px actions and focusable research/production reason pattern described below.
DOM/source checks do not establish rendered readability or an identified
deployed build. The previously recorded cloud sandbox/storage capability
blocker remains open; the HUD owner retains ordinary-game acceptance.

## Selection visibility

When no living friendly units or owned building are selected, the selection
command bar is hidden. The existing Quick commands row appears instead:
Commands, Production, Army and Idle workers. Commands opens the remembered
drawer tab; its Selection tab retains control-group assignment and recall.
The keyboard group shortcuts remain available. Selecting Workers, military,
mixed units or an owned building restores the existing contextual command bar.
This slice changes visibility, not the visual theme or command semantics.

Both rows use explicit `hidden` state. Their ResizeObserver supplies the
height of the visible row to the existing drawer, hint, action-feedback and
narrow minimap offsets; an empty selection therefore does not reserve a vanished
selection bar or leave feedback behind Quick commands. The Quick row can wrap.

Focus moves to a visible, enabled command when its old row/action becomes hidden.
Closing a drawer restores its opener while that opener remains available; if
it became hidden, disabled or disconnected, focus returns to another visible
command. Escape closes the drawer before the existing battlefield handler can
clear selection. A later Escape with the drawer closed keeps the established
target-mode cancellation and selection-clear behavior.

Resources, owned population, the minimap and independent objective urgency,
order feedback, runtime-error and match-result elements are outside both rows.
Selection visibility updates do not hide or rewrite those elements. A selected
building's contextual information still follows selection as before.

## Focused proof

After the lockfile install, run:

```bash
node --test scripts/contextual-hud.test.mjs scripts/selection-context.test.mjs \
  scripts/stationary-command.test.mjs scripts/base-lifecycle-ui.test.mjs \
  scripts/roster-production-ui.test.mjs scripts/research-ui.test.mjs \
  scripts/resource-format.test.mjs scripts/population-readout.test.mjs \
  scripts/hud-layout.test.mjs scripts/client-rematch-recovery.test.mjs \
  scripts/client-build-recovery.test.mjs scripts/ci-sharding.test.mjs
node scripts/client-asset-allowlist-scenario.mjs
npm run docs:check
```

The new DOM tests load the shipped HTML and stylesheet into the pinned,
test-only jsdom dependency and execute the actual client selection, quick-command,
drawer and Escape handlers. Both seats traverse empty → Worker → army → building
→ empty; checks cover close/reopen, retained selection, visible focus, existing
group assignment/recall keys and the independent HUD/alert elements. Separate
cases check unavailable openers and observation of both command rows.
The dependency is [jsdom 26.1.0](https://github.com/jsdom/jsdom), MIT licensed,
pinned in the lockfile and imported only by tests; it adds no client import or
runtime asset. That version supports the project's Node 24 requirement.

The DOM fixture stubs renderer/network/audio and unrelated lifecycle
work. jsdom has no layout engine: rectangles and row heights are synthetic.
These checks prove DOM state, focus and event routing, not rendered dimensions,
visual readability, real mouse hit targets, assistive-technology use or performance.
No provider browser tool is available in this cloud worker, and local Chromium's
sandbox must remain enabled. This slice has no browser or pixel validation;
earlier population-slice captures do not validate it. No browser security flags
were changed or disabled to run these checks.

## Complete contextual command strip — 3 October 2026

Mac QA reported clipping at main `20c4fcea1c35ac9920f04ecd6f891d55c31b0f56`,
Chrome 154.0.8037.93, 1280 × 800, DPR1: New Game → PvE Bellweather Millrace →
one Azure Worker at 100 HP with zero cargo. **Formation / route** wrapped into
a second action row; only its upper strip remained visible. The relevant CSS
was unchanged at implementation baseline `d99b30e`. A 52px identity plus two
44px command rows, their 5px gap and 18px padding/borders need at least 163px
inside the 128px bar cap. Existing vertical overflow did not make the partly
clipped command apparent.

Commands now occupy one horizontally scrollable row under the identity.
Buttons keep 44px targets and full labels; groups and lifecycle actions stay
in that row, and production/research containers keep their existing DOM.
An 8px Chromium/WebKit scroll track/thumb exposes overflow; inset command focus
rings remain inside the strip. The bar keeps its 128px cap and uses 7px padding
to reserve room for a native scrollbar too. Minimap-aware width limits and
measured-height offsets remain unchanged. The Worker's known 52px identity,
44px row, 8px track and 16px padding/borders total 120px; this is a source sizing
budget, not native pixel acceptance.

Both-seat DOM cases open Formation / route, preserve its focused node through
live HP updates and restore focus on Escape/close without changing selection.
Geometry checks include the reported viewport and small/large minimaps.
Synthetic geometry does not prove native overflow retrieval. The Library report
was read, but image reads returned extracted text and image materialization
failed; this cloud worker did not inspect the supplied native pixels. Optional
assets missing from the QA sparse checkout are outside this clipping change.

For native validation, repeat the exact reproduction, then Tab and Shift-Tab
through Formation / route: its full label and ring must enter view. Open it and
dismiss with Escape/close, retaining Worker selection and visible focus. Use
horizontal trackpad swipe, Shift-wheel and the scroll thumb to reach both ends.
Repeat at 800 × 420 and 360 × 480 with small/large minimaps, Workers, mixed groups
and producing/researching Barracks. Verify map clearance, readable disabled
reasons and that scrolling the strip does not pan the battlefield. Record
browser, actual build, viewports and capture hashes.

### Keyboard reveal follow-through — 3 October 2026

Native Mac QA at `33ded0fe877c39b73adeb8cf8ff56e082e83bd1c` confirmed the
single row and thumb/horizontal-wheel retrieval at 1280 × 800, DPR1, Chrome
154.0.8037.93. Tab reached all 11 enabled Worker commands, but Formation / route
remained 23.0625px beyond the strip's right edge with `scrollLeft` zero. CDP
Shift-wheel with vertical delta also left the strip at zero. Physical OS-event
Shift-wheel was not independently tested. Reverse traversal and drawer focus
recovery stopped at the clipping assertion, so PR128 remains open for native
keyboard closure. The report was read from Library; no cloud pixel claim is made.

The direct action strip now reveals its focused button using its own viewport
bounds and scroll offset, then rechecks once after browser focus scrolling.
Changing focus or hiding the selection cancels the old target's effect. A
Shift+vertical-wheel fallback scrolls this strip when it overflows; native
horizontal deltas keep their normal handling. Neither path scrolls an ancestor,
changes selection or issues an order. Renderer, geometry and action art are
unchanged. DOM tests replay the measured fractional overflow, reverse traversal,
later/hidden focus, near-fit and oversized fractional buttons, overflow limits
and pixel/line/page wheel deltas; they do not
establish native acceptance.

Repeat the same native Worker capture and every Tab/Shift-Tab full-visibility
assertion, then Formation Enter → Escape and Enter → Close. Record retained
selection, fully visible recovered focus, page scroll and camera observations.
Retest CDP Shift+deltaY, horizontal deltaX and thumb drag in both directions.
Retain the viewport/selection/minimap matrix above as broader follow-up checks.

## Tactical-map keyboard view — 3 October 2026

After Fit map, navigating the focused tactical map with an arrow key cancels
automatic fit, as pointer navigation already does. A window resize or fullscreen
transition then retains the manually chosen camera target, subject to the
existing camera bounds and minimum zoom. Fit map remains automatic until actual
navigation; unrelated keys do not cancel it.

At baseline `f60fd03`, all four arrow directions reproduced a missing state
transition: the shipped key handler moved the target but left automatic fit
enabled, so the shipped resize handler called Fit map and replaced that target.
The regression in `scripts/hud-layout.test.mjs` executes both handlers with the
shipped focusable tactical-map element. It covers each direction, repeated keys,
unhandled keys and the existing resize zoom limit. Renderer/layout and Fit map
geometry are stubbed; these are DOM/state proofs, not pixel or native-input proof.

Native reproduction/capture on a runtime with a working browser sandbox:

1. Run `npm ci`, then `RTS_HOST=127.0.0.1 PORT=4174 node server.mjs` in a
   disposable checkout. Open `http://127.0.0.1:4174/` at 1280 × 720.
2. Click Fit map. Use Tab to focus the tactical-map canvas (past its size/hide
   buttons), then press ArrowRight twice. Capture the battlefield and minimap
   camera outline and record the focused element.
3. Resize to 1024 × 720, then enter/exit fullscreen. The view should stay panned
   rather than return to the fitted center. Repeat with the other arrow directions.
4. Click Fit map again and resize without arrow navigation: fitting should still
   follow the viewport. Record commit, browser version, viewports and capture hashes.

Cloud preflight reported `sandbox-unavailable` and `storage-unavailable`; no
sandbox bypass, native screenshot or visual-acceptance claim accompanies this fix.

## Inspectable contextual training — 3 October 2026

Contextual training choices remain in the keyboard focus order while unavailable.
Their existing cost and block reason remain in the button text, and
`aria-disabled="true"` exposes the unavailable state. Activation is guarded:
an unavailable choice sends no training request. Becoming available clears that
state without replacing the button or moving focus. The production drawer's
catalog retains its existing native disabled behavior. Other contextual actions
keep their existing focus-recovery behavior when hidden, removed or disabled.

At baseline `7f9c8fd`, the shipped production and contextual update handlers
moved focus from an unaffordable training button to Idle workers on both seats.
A training choice that started unavailable could not receive keyboard focus.
Three new cases reproduce these failures in the shipped DOM. Both-seat state
transitions now cover food shortage, full queue, blocked spawn, full population,
unit cap, authoritative prerequisite denial and match completion. They check
retained focus, accessible state, visible reason, guarded activation, re-enabling
and recovery when the selection is cleared. Separate activation checks cover
keyboard-style and pointer-style click events. jsdom has no native Tab traversal,
layout or assistive-technology engine; native behavior still needs the recipe below.

### Exact Mac capture recipe

Use a disposable checkout and a fresh private Chrome window. With Node 24 and
the locked dependencies installed, create this untracked fixture map:

```sh
node --input-type=module <<'NODE'
import { writeFileSync } from 'node:fs';
writeFileSync('maps/hud-training-focus-audit.json', JSON.stringify({
  id: 'hud-training-focus-audit', name: 'HUD Training Focus Audit',
  width: 64, height: 64, terrainSeed: 19, fogOfWar: false,
  startingArmySize: 24, startingResources: { food: 60, wood: 500 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: []
}), { flag: 'wx' });
NODE
RTS_HOST=127.0.0.1 PORT=4174 RTS_MAP=maps/hud-training-focus-audit.json node server.mjs
```

1. Open `http://127.0.0.1:4174/` at 1280 × 720. Select Idle workers, open Build,
   place a Barracks on open ground near the home base, and wait until READY.
   Close the drawer and click the Barracks to show its contextual products.
2. Tab to Train Spearman and press Enter once. With exactly 60 initial food,
   this spends the remaining food and makes that same choice unavailable.
   Capture its focus ring, shortage text and `aria-disabled="true"`. Focus
   must stay on Train Spearman rather than move to Idle workers.
3. Before the 12-second training finishes, press Enter and Space again, then
   click the unavailable choice. The queue must still contain one unit.
   In DevTools Network's WebSocket messages, verify one initial `trainUnit`
   request and no additional requests from those unavailable activations.
4. Tab away and Shift+Tab back: the unavailable choice remains reachable.
   Repeat at 620 × 640, checking the entire button/reason is reachable by
   scrolling the command bar, its focus ring is visible, and no new panel opens.
5. Open Production, then Escape: the drawer closes and building selection stays.
   Clear the building selection: focus should return to visible Quick commands.
6. Open a second private Chrome profile to claim Ember and repeat steps 1–4.
   With VoiceOver enabled, record whether it announces the training label,
   price/reason and unavailable state. Record commit, browser, viewports, focus
   target, WebSocket request count and capture hashes; do not publish session data.

Stop the disposable server and remove only the fixture map afterwards. The cloud
browser's documented sandbox/storage block remains; no cloud browser was awaited
or bypassed for this change. Native readability and VoiceOver acceptance are open.

## Inspectable contextual research — 3 October 2026

At baseline `ae88e0f`, resource or research-state updates moved focus from an
unavailable contextual research choice to Idle workers on both seats. A choice
with an unmet prerequisite could not receive focus to expose its explanation.
The shipped DOM regression reproduced these three failures before the fix.

Contextual research now shares training's availability setter and activation
guard. Unavailable choices keep focus and expose `aria-disabled="true"` with
their existing cost/reason text; an unavailable activation sends no request.
The research drawer retains native disabled choices. The existing contextual
disabled styling also applies to research. Build already opens its details
without resources and restores focus on Escape, verified for both seats.

Both-seat research cases cover shortages, incomplete construction, research in
progress, completed upgrades, authoritative denial, match completion, re-enabling
and focus recovery when selection clears. An initially unavailable prerequisite
is inspectable. Existing training and Return cargo cases remain in the same
fixture. These are automated DOM/state checks, not native keyboard or VoiceOver
validation.

### Cumulative Mac QA checklist

Record commit, browser/VoiceOver version, viewports and capture hashes. Native
acceptance for these items remains pending; use 1280 × 720 and 620 × 640.

- Tactical map: Fit map → Tab to map → arrow pan → resize/fullscreen. The view
  stays panned; Fit map followed by resize without navigation still fits.
  Enlarge/shrink it with Worker, mixed army and Barracks selected at 1280, 800
  and 621px wide: the command bar must stay beside the map. At 620 and 360px,
  the map stays above the scrollable bar. Check short 800 × 420 too.
- Edge scroll: with it enabled, hover 60px from each canvas edge; movement starts
  inside the new 80px band and stops at 80px. Check after resize and at Retina
  scale; editable focus, dialogs, drag selection and build placement still block
  it. Saved speed and disabled settings remain effective.
- Training: use the exact 60-food fixture above. Enter on Train Spearman keeps
  focus on the newly unavailable choice; Enter, Space and pointer activation
  send no additional request. Tab away/back and verify VoiceOver label, reason
  and unavailable state on both seats.
- Research: use the same fixture recipe with **100 food** and a distinct map
  id/name/file such as `hud-research-focus-audit`. After Barracks completes,
  Tab to Infantry Forging and press Enter. Its 100-food/75-wood cost starts one
  research; focus stays on the now unavailable choice with its research reason.
  Further Enter, Space and pointer activation send no additional `researchUpgrade`
  WebSocket request. Tab to Military Armor: its Military Tier II prerequisite
  remains reachable. Verify both choices' label, price/reason and unavailable
  state with VoiceOver on both seats, and scroll the narrow bar to check focus.
- Dismissal/selection: Worker → Build → Escape restores Build focus and keeps
  selection; building → Production → Escape keeps building selection. Clear
  selection to reach Quick commands. Verify Return cargo still appears for a
  carrying Worker and issues that order.
  Scroll the single command strip to Formation / route; Tab/Shift-Tab must bring
  its full label/ring into view. Open/dismiss it, retaining selection and focus.
  Check the exact 1280 × 800 clipping reproduction above and narrow/large-map
  cases with the visible overflow track, including unavailable production reasons.
- Worker visual: on both seats, select one Worker and inspect the compact
  portrait, name/HP, target and Build icons at 1280 × 720, 800 × 420 and 360 × 480,
  with small/large minimap. Check portrait framing and text at Retina scale.
  Tab to the portrait, open notes, then Escape and the close button: focus returns
  to the portrait and selection remains. Damage the Worker and verify live HP.
  Check the registered abilities, base stats and Town Center training facts.
  Tab to **World notes (working lore)**, use Enter/Space to open/close it and
  confirm VoiceOver announces its disclosure state and the source link's new tab.
  While its summary/link has focus, damage the Worker: focus and open state stay.
  Clear selection or select Barracks/group: focus moves to the visible Selection
  tab and lore closes. Escape dismisses the drawer without clearing selection.
  Select two Workers or a mixed group: the portrait disappears and the composition
  summary remains. Clear selection with notes open, dismiss and verify visible
  Quick-command focus. Check VoiceOver's Worker/family/role-note button name;
  decorative images add no repeated command name and M remains visible.

- Barracks visual: on both seats select a Barracks at 0%, 20% and 90%
  construction, then at 100%, 65% and 32% health. Check its 52px thumbnail against
  the same battlefield state and preserve existing name/health/production text.
  Open the thumbnail for structure details, dismiss with Escape/close, and verify
  focus returns without changing selection. Worker → Barracks → unsupported
  building/group must hide stale Worker notes and retain visible focus. Use the
  same desktop/short/narrow sizes above; framing and recognition remain native
  QA, not a source-metadata acceptance claim.

The [selection art contract](hud-art-integration.md) records sources, framing,
supported appearances and the future source-linked codex boundary.

## Compact enlarged-map clearance — 3 October 2026

At baseline `d1ad07a`, the contextual bar's width cap reserved only the small
tactical map width. The declared CSS geometry permits a crowded bar to overlap
the enlarged map by 94px at 1280 × 720, 122px at 800 × 640 (also 800 × 420),
and 65.56px at 621 × 640. Worker, army and building states share that bar.

The map and command width caps now consume one responsive width token. The
existing desktop/narrow spacing, 128px scrollable bar cap and stacked map below
621px remain. Narrow Quick commands also reserve the current map width. Colors,
art and gameplay handlers are unchanged.

Six cases execute the shipped map-size toggle and evaluate active stylesheet
declarations at 1280 × 720, 800 × 640, 621 × 640, 800 × 420, 620 × 640 and
360 × 480 through small → large → small. Four fail before the fix. The check
models the declared width caps and stacked offsets, with an observed bar-height
fixture; it uses CSSOM parsing and explicit supported selector specificity.
It does not measure actual content wrapping, browser rectangles or pixels.
The cumulative Mac checklist above remains the native visual acceptance path.

Record exact source revisions and proportionate results in the implementation PR.
Private exploratory art and support artifacts remain outside this patch.

## Six default action glyphs — 3 October 2026

The normal selected-unit strip now shows Patrol, Follow, Stop, Hold position,
Return cargo and Formation images at 20 px beside their retained names/hotkeys.
Patrol/Follow/Stop/Hold use the same files in the Command drawer. Formation
appears only for Workers, military, mixed and boat selections; building details
keep their separate Rally / upgrade label without that image. No orders, cargo
availability or selection/dismissal behavior change.

After the parent-owned Mac QA machine reconnects, capture normal Bellweather
Millrace gameplay on an identified deployed revision containing this integration
and PR134's keyboard fix. At 1280 × 800 DPR1, and short/narrow sizes above, select
a Worker and Tab/Shift-Tab through the full row: each whole label and focus ring
must be visible after the 20 px additions. Inspect Follow's leader connection
and Return cargo's crate/receiver at native size, both team appearances and
Retina scale. For carrying food/wood/Stone Workers and a carrying Skiff, confirm
the generic cargo image, text and actual deposit order. Empty cargo hides it.
Select an army/mixed group, then a production building: Formation changes to
Rally / upgrade details with no stale formation image. Use Enter on Formation,
Escape and Close, retaining selection and restoring visible focus. Check physical
Shift-wheel, native horizontal wheel/thumb drag and unchanged page/camera.
VoiceOver should announce each written action/hotkey once; images add no name.
Cloud DOM/HTTP/source checks and private CPU previews do not close this native
check. Receiving owner: parent-owned Mac QA; HUD owner retains the outcome and
Railway delivery owner supplies the exact relevant user deployment.

## Focused command after live layout changes — 3 October 2026

Baseline `14590fb` reveals a command on focus but never rechecks an already
focused label when preceding cargo/production controls grow or the strip narrows.
The bounded fix observes the strip and its buttons for actual horizontal layout
changes; child-list observation only discovers button insertion/removal. Repeated
unchanged text/hidden writes and manual scrolling alone must not reset the strip.
One animation-frame correction retains focus and selection, skipping hidden,
disabled, removed or later outside focus. Disposal releases both observers.

Synthetic DOM/geometry tests cover growth, minimap/viewport shrink, nested added
and removed controls, unchanged updates/manual scrolling, deferred focus states
and cleanup. These checks do not supply native pixels or deployed acceptance.

Pending native recipe, owned by the parent Mac QA lane: on an identified deployed
revision containing this fix, enter PvE Bellweather Millrace at 1280 × 800 DPR1.
Tab to fully reveal Formation, then let a selected Worker gain cargo so Return
cargo appears before it. Keep keyboard focus and verify the whole Formation
label/ring. Repeat with growing production text, enlarged minimap and 620/360px
widths; remove a preceding control and check reverse-edge recovery. Manually
scroll away, apply unchanged snapshots and confirm no snap-back. Verify physical
Shift-wheel, native horizontal wheel/thumb drag, dismissal and selection retention.
Record source/deployed revisions, browser, rectangles, PNG/hash and observations.
The HUD owner retains implementation/source checks; the receiving Railway owner
retains delivery of the identified user build. No deployment is part of this slice.
