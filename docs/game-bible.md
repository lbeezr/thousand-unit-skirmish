# Game bible

[Documentation index](README.md) · [Roadmap](roadmap.md)

## Product promise

Build an original browser RTS where friends command large armies, fight over
readable terrain and objectives, and author their own scenarios. Solo play
against a deterministic opponent makes the same core easy to practice and test.
Desktop mouse and keyboard are the baseline.

The current priority is a reusable, dependable RTS core demonstrated in complete
matches. A broader faction roster, campaign, ranked service, and persistent
progression come after that proof.

## Design principles

| Principle | What players should experience |
| --- | --- |
| Command the crowd | One order gives a large formation a clear destination; selecting, grouping, and redirecting it is predictable. |
| Terrain creates decisions | Routes, resources, sight, and objectives offer visible reasons to split, defend, expand, or attack. |
| Every match can be authored | Map Studio produces valid, portable maps and scenarios without requiring engine knowledge. |
| Readability survives scale | Team, role, selection, health, commands, and ownership remain distinct in a crowded battle. |
| Online play earns trust | Orders receive specific feedback; disconnects, recovery, results, and rematches are understandable. |

## The match loop

1. Join a friend or start a solo match and understand the objective.
2. Gather resources, build infrastructure, and choose production.
3. Organize the army and choose routes through the map.
4. Contest objectives and react to the opposing plan and scenario events.
5. Reach a clear result, then rematch or try another authored scenario.

[Forked Vale](forked-vale-scenario.md) is the default small-opening scenario.
Larger maps test travel, resource regions, forest clearing, and elevation.
Match length and economy pacing must come from observed play.

## Implemented scope

- Azure and Ember seats, invite rooms, spectators, reconnects, and checkpoints.
- Workers, Infantry, and Archers; food/wood gathering, construction, queues,
  rally points, population reservations, and two attack upgrades.
- Box/Line/Column destinations, direct attacks, attack move, queued waypoints,
  control groups, class selection, and idle-worker selection.
- Capture prerequisites, any/all victories, continuous holds, deadlines, supply
  events, branching/joined event chains, and elimination.
- Fog, minimap, Map Studio, saved custom maps, elevation, and cut-to-clear forests.
- Seeded deterministic PvE through the same authoritative command rules.

Implementation is distinct from balance, readability, and external-playtest
proof. The [QA plan](qa-vertical-slice.md) defines those observations.

## Quality floor

- A first glance identifies the team, objective, route, and selection.
- Every important action gives immediate, specific feedback; rejected actions
  explain what prevents them.
- Armies remain readable through chokes, combat, construction, and zoom changes.
- Essential text and controls are comfortable at ordinary desktop sizes.
- Invalid map authoring names a fix before publication.
- Both players understand connection state, the winner, and who can rematch.
- Code, names, art, audio, maps, and writing are original project work.

## World and presentation

The setting is an inviting medieval frontier: moss, worn earth, timber, slate,
weathered stone, and muted water. Use a painterly finish with clear silhouettes
and restrained effects. Azure is sky blue; Ember is rust/terracotta. Reinforce
team identity with shapes and labels.

Workers need a readable tool/pack; Infantry a spear/shield; Archers a bow/quiver.
Buildings need distinct rooflines and entrances. Art must work at normal and
strategic zoom. The [art direction](art-direction-contract-v1.md) and
[renderer contract](renderer-state-contract.md) define the shared rules.

The player is a commander, with personality expressed through strategy. There
is no fixed cast or campaign canon. Azure and Ember are team identities. Keep
announcements brief and specific, with a human, adventurous tone.

## Scope boundaries and open decisions

Campaigns, many asymmetric factions, a large technology tree, public accounts,
ranked matchmaking, naval combat, and general-purpose scripting remain outside
the first slice. Optional model-opponent research is isolated and default-off;
normal solo play uses no model provider.

Open decisions include ordinary match length, the supported device/network
profile, whether large armies are routine or a stress ceiling, and how much
fantasy asymmetry improves the command game. Test [living-land](living-land-experiment.md)
and [larger-map](map-scale-density.md) ideas as bounded experiments before
expanding their scope.

## References

The [RTS coverage guide](references/feature-coverage-inventory.md),
[Openage study](references/openage-study.md), and
[Warcraft study](references/warcraft-rts-inventory.md) preserve design research.
For a new reference, record the source and date, concrete observation, project
decision it informs, and differences in scale or constraints. Reference research
does not add features to the roadmap automatically.
