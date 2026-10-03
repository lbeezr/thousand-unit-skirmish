# Existing victory-rule clarity and regression proof

[Victory audit and pending proposal](victory-modes-audit-2026-10-03.md) · [Testing](testing.md)

## Source and outcome

Owner: the delegated victory-audit task. Audited main `d063ad5`, then refreshed
against `32f11d5`, including separate target-reacquisition and Lab/Practice entry
fixes. After the later main `4467986` integration, focused tests and documentation
links were checked again; the native server source remains unchanged. This source
names existing Objective Control/Elimination rules in the normal objective strip
and brief. It
explains ownership-based holds, Workers, recoverable producers, Town Center loss
and Skiff exclusions. It changes no map rule, timer, server win evaluation, AI
policy, lobby configuration or default. The proposal remains a shared decision.

## Evidence

- Forty focused objective/HUD/selection/CI-sharding tests passed. The authored
  Millrace/Rootways assertions pin 24 total units, their exact capture thresholds,
  twenty/thirty-second holds and 900-second center deadlines.
- [Native edge proof](qa-evidence/victory-audit-2026-10-03/elimination.json): twelve
  deliberate checkpoint states run in the unchanged real worker after normal paid
  Barracks and land-unit queues. They cover surviving Workers, destroyed homes,
  affordable empty production, insufficient resources, paid Worker/military queues,
  unfinished producers, mutual defeat, a one-hour stalemate, pre-start no-player
  clocks, pre-clock elimination, disconnected running clocks and final-result
  recovery. The JSON retains the exact server SHA-256 and observed results.
- Existing `timed-victory-scenario.mjs` passed eleven cases: validation,
  capture/deadline precedence, claimed/unclaimed deadlines, any/all holds,
  recapture reset, delayed supplies and restart/reconnect.
- Existing `elimination-scenario.mjs` passed native combat victory, terminal
  movement/production rejection, guest reset rejection and reconnect persistence.
- Documentation links, served client import graph, syntax and diff-whitespace
  checks passed. The changed runtime files are existing served/Docker source
  inputs; no new runtime URL or resource is introduced.

These are local source/protocol checks. The new native proof uses explicit edge
fixtures, not unassisted matches. It does not create boats or establish water-only
match acceptance; the Skiff exclusion is audited from the live predicate. Full
CI and a release package are separate evidence from these proportionate checks.

## Deployment and ordinary acceptance — incomplete

At inspection on 3 October, the connected staging `game` service was **Online**,
with deployment `cf9bea37-1681-4b1c-8764-23eb260bedde` in **SUCCESS**, sourced from
`00ff45d9702dfbcf9da6f6ac88e0ca4381e374dc`. Its connected source is
`lbeezr/thousand-unit-skirmish`, branch `main`. This source slice was not yet on
that deployed revision. The old zero-change staged patch was not applied.

This workspace's network proxy rejected the staging game HTTPS tunnel with 403.
Chromium's browser preflight reported sandbox/storage unavailable. No sandbox or
auth bypass was attempted; no credentials or new service were created. The
GitHub connector can prepare the PR, although the workspace CLI token is invalid.
Neither a platform SUCCESS for an older revision nor source tests prove this
slice's deployment or rendered acceptance.

Retained next steps for the victory owner: independent review of the exact PR
head; integrate the small clarity slice; identify the served revision; run a
supported ordinary menu/lobby match on Millrace and an elimination map, observe
the objective strip/brief at normal size, and record a screenshot and result.
Coordinate the `matchModeId` decision and an AI base-objective owner through the
parent before a separate Skirmish-default change. Live/browser acceptance and
the default gameplay outcome remain open until that evidence exists.
