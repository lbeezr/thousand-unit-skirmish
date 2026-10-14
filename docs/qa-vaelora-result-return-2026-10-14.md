# Vaelora result and return — 14 October 2026

[Creative direction](creative-direction.md) · [Endings contract](match-endings-and-recaps.md) · [Interface system](ui-design-system.md)

Owner: **Unify game art direction and lore**, chat
`01a13a8a-37a9-7812-800a-12e48c842b52`. Initial source baseline:
`72de634559713793df31696ca6355fa055496854`. This is a presentation/copy and
navigation increment; ordinary rendered acceptance remains incomplete.

## Selected continuation

The result remains an Obsidian command surface, with the selected working fonts,
quiet boundary and mint interaction accent. Its actual title and reason now use
sentence case and readable working text, replacing the remaining tiny monospaced
all-caps treatment. Optional recap facts keep their native collapsed details,
privacy, missing-field wording and reset/reconnect behavior.

Backing: the [approved HUD/component direction](art-direction/hud-design-system-2026-10-11/README.md),
[journey stage 6](art-direction/creative-atlas-v1/journey-storyboard.svg), the
preserved [Azure](qa-evidence/qa-004-staging-f1d6482-azure-result-1280x600.png) and
[Ember](qa-evidence/qa-004-staging-f1d6482-ember-result-1280x600.png) result captures,
and a new [result/return state storyboard](art-direction/creative-atlas-v1/result-return-storyboard.svg).
The old captures were inspected as historical backing and remain unchanged.
The new editable SVG was natively rasterized and visually inspected as a schematic;
it is not a game capture or measured component geometry. No new raster assets,
fonts or recordings are introduced.

The intended mood is clear resolution with room for relief or loss. Put the
confirmed outcome, its cause and the available next action first. Preserve authored
objective names exactly, including case and punctuation. Give a stronghold loss
the player's viewpoint: “Your original Town Center was destroyed.” Explain land
elimination as having no land units and no ability to produce more; surviving
boats do not turn that into an assertion that every unit was destroyed. Draw,
resignation, deadline, hold and ordinary objective reasons remain distinct.

There is no new fictional battle history, consolation dialogue, result sound,
automatic transition or cinematic delay. The current single result cue and
winner/draw validation are unchanged. The UI introduces no new result statistics.

## Existing return paths, clearer actions

The host's existing `reset` request is still the only replay command. A terminal
invite room has a real pregame projection, so its label becomes **Back to lobby**;
both players will review settings and ready again after authoritative reset.
An immediate room retains **Play again**. The guest's waiting text describes the
corresponding host action; neither guests nor spectators gain reset authority.

All viewers have a **Main menu** link through the existing `/` entry. It leaves
the terminal view through the ordinary menu/session path and does not send a reset,
create a match or clear another player's seat. It makes the return to the branded
welcome visible inside the result card. Recap disclosure remains optional.

Write scope: only result wording/actions in `src/main.js`, the existing result
markup in `index.html`, scoped result rules in `src/client/hud/match-ui.css`,
focused result/input fixtures and the owning creative/QA guides. No simulation,
mode rule, ending command, snapshot schema, victory predicate or audio policy changes.

## Evidence and remaining acceptance

All 105 focused result/rematch and wildlife-input checks pass. They cover the
real extracted result/state/reconnect handlers, player
and observer viewpoints, proper-name preservation, draw/resignation, optional
recap privacy and reset clearing. The return-label fixture binds the same latest
lobby projection used in production. New hold coverage also consumes the actual
time formatter, rather than a test substitute. The stylesheet parses as 66
top-level rules. Native input/HTTP fixtures require authorized loopback permission;
the initial sandbox-only attempt refused their listeners with `EPERM`.

Both strict type projects, runtime architecture, documentation links and diff
whitespace pass. The client asset-allowlist scenario passes with 157 imported
modules served. These are named source/contract scopes, not the full CPU suite,
an independent review or rendered game acceptance.

Clean package, public path/import admission, staging identity and served hashes
are recorded at the integration checkpoint when completed. The existing index,
main client and match stylesheet are already admitted and included in releases;
the SVG stays in documentation. No preview flag or new runtime path is introduced.

The owner retains ordinary host/guest/observer results at the identified release:
Victory, Defeat and supported Draw; long authored names; narrow/short windows;
keyboard focus and both return paths; recap disclosure, reconnect and rematch;
forced colors and readable mint-action contrast. Confirm that the completed match
remains visible around the card and that Main menu returns to the real Vaelora portal.

The task has no exposed qualified cloud browser executor. The general Mac-browser
restriction and scoped earlier exceptions remain unchanged. No Mac game browser
fallback or unchanged cloud launch retry is used. Source/DOM/native/package/HTTP
evidence does not establish appearance or human comprehension; those remain open.
