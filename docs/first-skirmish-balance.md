# First 1v1 skirmish balance ledger

Status: first tuning pass, 25 September 2026. This is a test plan and evidence
record, not a claim that the skirmish is balanced. Scope follows the
[game bible](game-bible.md) and [feature inventory](references/feature-coverage-inventory.md):
one complete invite-first 1v1 scenario with a small roster. Large armies remain
a separate stress workload.

## Baseline found in the prototype

| Rule | Current value | Design implication |
| --- | ---: | --- |
| Default start | 1,000 total, 500 per team | Opening economy and production have little leverage. |
| Initial workers | 4 per team | There are 496 starting infantry per team at the default size. |
| Starting resources on shipped maps | 0 food, 0 wood | Players must gather before placing either production building. |
| Worker | 100 HP, 10 damage / 0.85 s, range 1.28; 50 food, 25 s | Same combat numbers as infantry. Worker protection has little incentive. |
| Infantry | 100 HP, 10 damage / 0.85 s, range 1.28; 50 food, 12 s | Fast food-only frontline and building attacker. |
| Archer | 70 HP, 7 damage / 1 s, range 4.5; 25 food + 45 wood, 7 s | Ranged support needs space or a frontline; wood gates mass production. |
| Barracks / Archery Range | 175 / 150 wood, 20 s construction | First building is a real wood allocation if starting wood is limited. |
| Gathering | 1 resource/s, 10 carried per trip | Travel and drop-off time lower the effective income rate. |
| Three Crowns | 6 / 6 / 8 units, 8 / 8 / 10 s capture; no hold | A large starting army can take objectives before production matters. |

Numbers above come from `server.mjs`, `src/main.js`, and
`maps/three-crowns.json`. The worker/infantry equality is a likely role
problem, not yet a measured win-rate finding. Archers' range suggests a
positioning role; it does not prove they are cost-effective.

## First focused change

Maps may now set `startingArmySize` to an even **total** from 8 to 2,000.
Startup, map selection, and map publication use that map value. Omission keeps
the old 1,000-unit default. A host's explicit army-size selection remains a
stress control, and rematch preserves the selected size.

The first authored scenario should try **24 total units**: 4 workers and
8 infantry per team, with **150 food and 250 wood per team**. This makes two
immediate production plans possible after one building completes:

| Opening | Initial spending after building | First reinforcement | Remaining stock before gathering |
| --- | --- | --- | --- |
| Barracks | 175 wood + 50 food per infantry | ~32 s after construction starts with one builder | 100 food, 75 wood after one infantry |
| Archery Range | 150 wood + 25 food + 45 wood per archer | ~27 s after construction starts with one builder | 125 food, 55 wood after one archer |

These are rule-clock estimates: 20 s construction plus 12 s or 7 s training.
Walking, placement, congestion, and command time add delay. The resource
allocation permits three infantry or two archers from the opening stock, before
gathering. It does not establish that the two plans are equally strong.

## Measurable hypotheses for playtests

1. **Opening clarity:** In at least 8 first-time 1v1 player seats, 6 can
   assign workers within 45 s and start a production building within 90 s
   without coaching. Record rejected orders and the reason players give.
2. **Two meaningful responses:** A barracks-first frontline and a
   range-first ranged-support plan are both chosen and can contest the main
   objective in mirrored Azure/Ember tests. After at least 20 paired games,
   neither opening should exceed 70% wins; treat this as a tuning trigger,
   not a statistical proof.
3. **Role clarity:** Players can describe infantry as the close frontline,
   archers as ranged support, and workers as economy after one match. Test
   whether 4 workers versus 4 infantry is an unwanted even fight; if so,
   reduce worker combat value in the next isolated change.
4. **Pacing:** In contested games, first combat should occur by 2 min,
   first objective ownership by 3 min, and the median game should last
   6–10 min. At least 90% should finish within 15 min. Record both seats'
   first building, first reinforcement, first contest, decisive objective,
   and match-end times.
5. **Victory incentive:** Players should move to contest objectives by
   4 min, and be able to explain why the final objective ended the game.
   A quiet base standoff beyond 4 min or a surprise victory is a scenario
   rule/UI failure to investigate before adding more units or technology.

All time and win-rate bands are hypotheses. The scenario designer owns objective
geometry and timing; gameplay engineering owns reliable commands and pathing;
QA will collect mirrored matches and player explanations. Revisit the bands
after the first outside playtest rather than treating them as ship criteria by
themselves.

## Evidence for this pass

- `node scripts/starting-army-scenario.mjs` passed locally: a 24-unit
  published map yielded 4 workers and 8 infantry in both player seats with
  150 food and 250 wood each; rematch retained 24; manual 250-unit stress
  selection and its rematch worked;
  selecting a map without the field restored 1,000; reselecting the authored
  map restored 24; five invalid sizes were rejected.
- This verifies map publication, selection, reset, and validation through
  the local command protocol. It is not a two-human balance playtest or
  hosted-network measurement.

## Next tuning decisions

- Measure worker-vs-infantry combat and tune worker survivability/damage if
  the current combat parity lets economic units substitute for frontline units.
- Compare first reinforcement and income timing for barracks and range
  openings. Adjust one cost or time at a time, then rerun mirrored matches.
- If objectives resolve before armies and economy matter, adjust capture
  prerequisites, hold time, or map routes in the authored scenario. Preserve
  an understandable ending and a reason to leave the base.
