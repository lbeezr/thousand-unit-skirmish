# Compact objectives and feedback

[Documentation index](README.md) · [Player guide](playing.md) · [QA plan](qa-vertical-slice.md)

## Behavior

The closed HUD shows the next available victory objective, accounting for its
prerequisites. Active victory holds for either team and the deadline remain
visible outside the detail panel.

Objectives opens the nonmodal scenario brief with live objective/event cards,
requirements, rewards, locks, countdowns, and bounded grouped notice history.
Hints can be hidden and reopened; placement and armed targeting always show
cancellation guidance. Only the hint preference persists.

## Validate

```sh
node --test scripts/objective-summary.test.mjs
node --test --test-name-pattern='Objectives dismisses' scripts/contextual-hud.test.mjs
node scripts/objective-fog-visibility-scenario.mjs
```

In a browser, check the compact instruction, open/close behavior, scrollable
long content, Escape focus return, and Hide/Show hints. Verify that public
ownership does not expose hidden capture progress.

The contextual DOM regression binds the shipped Objectives open/close listeners
and real close/summary functions on both seats. Escape/Close restore opener
focus and retain Worker selection; closed hold/deadline feedback continues to
advance without issuing commands. The fixture uses disclosed Millrace objective
state, not the ordinary default Skirmish rule. Renderer, network and geometry
are stubbed, so this proves DOM/event behavior only. The
[novice protocol](novice-first-play.md) retains qualified cloud visuals and
actual human first-play comprehension as separate next acceptance steps.

The original 26 September check from `227526c` recorded a 1280 × 720 local UI
pass using borrowed runtime assets. That was UI evidence, not full art validation.
Human sessions, touch/fullscreen, and combined HUD geometry need their own
observations. Measure the combined persistent HUD area before claiming the
proposed 75% uncovered-viewport target.
