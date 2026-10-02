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

Record exact source revisions and proportionate results in the implementation PR.
Private exploratory art and support artifacts remain outside this patch.
