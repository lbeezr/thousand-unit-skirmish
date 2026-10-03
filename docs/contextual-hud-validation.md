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

The DOM fixture stubs renderer/network/audio and unrelated production/research
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

Record exact source revisions and proportionate results in the implementation PR.
Private exploratory art and support artifacts remain outside this patch.
