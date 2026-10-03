# Empty-selection command visibility

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

The DOM fixture stubs renderer/network/audio and unrelated lifecycle/research
work. jsdom has no layout engine: rectangles and row heights are synthetic.
These checks prove DOM state, focus and event routing, not rendered dimensions,
visual readability, real mouse hit targets, assistive-technology use or performance.
No provider browser tool is available in this cloud worker, and local Chromium's
sandbox must remain enabled. This slice has no browser or pixel validation;
earlier population-slice captures do not validate it. No browser security flags
were changed or disabled to run these checks.

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

Record exact source revisions and proportionate results in the implementation PR.
Private exploratory art and support artifacts remain outside this patch.
