# RTS feature coverage

[Documentation index](../README.md) · [Game bible](../game-bible.md) · [Openage study](openage-study.md)

This maps the current project to the feature families raised by the original
RTS study. It is a scope guide, not a promise of parity with another game.
The [original 0.95 ledger](../archive/2026-09/feature-coverage-inventory.md) retains
fine-grained observations and pinned research sources.

## Current project coverage

| Area | Implemented scope | Remaining decision/evidence |
| --- | --- | --- |
| Sessions | Invite rooms, assigned seats, spectators, reconnects, checkpoints. | Complete current-build human join/recovery session. Accounts/matchmaking remain later. |
| World/visibility | Authored terrain, elevation, fog, minimap, cuttable forest cells. | Readable slopes, forest changes, and larger-map routes in play. |
| Economy | Finite food/wood, carrying/depositing, costs, queues, population reservations. | Contested economy and pacing; trade/regrowth remain proposals. |
| Units/technology | Worker, Infantry, Archer; two attack upgrades. | Role balance/readability. Broad factions/technology tree remain later. |
| Selection/orders | Single/box/class/double-click/groups, formations, attack move, waypoints. | Discoverability and crowded-match control. |
| Movement | Authoritative pathfinding, shared routes, separation, elevation costs, repair after occupancy changes. | Measured long-order/choke behavior on intended hardware. |
| Combat | Unit/building attacks, ranged roles, simultaneous damage, visibility checks. | Human counterplay and parity beyond isolated fixtures. Heroes/spells/naval systems remain candidates. |
| Buildings | Barracks/Range construction, rally, training/research; Town Center worker queue. | Placement/blocked-exit feedback. General repair/garrison/walls remain later. |
| Scenarios | Capture dependencies, any/all/hold/deadline victory, supply/repeat/event chains. | Complete authored matches and understandable triggers. |
| Editor | Painting, resizing, elevation, resources, objectives/events, import/export/publish. | Unassisted authoring and current deployed round trip. |
| Reliability | Isolated workers, bounded transport, seat reclaim, checkpoints, guarded release. | Hosted latency/loss, restore rehearsal, and measured capacity. |
| UI/audio | Compact HUD, contextual actions, help, synthesized cues/captions. | Fresh-player recognition and discovery. |
| AI/content | Seeded deterministic PvE; bounded optional fake-provider experiment. | Solo-play feedback. Campaign/public mod ecosystem are outside the first slice. |

## How to use references

Openage material mixes reverse-engineered game behavior, architecture, and idea
pages. Keep those evidence types distinct. Borrow a principle only when it solves
a project need and can be tested against the current engine.

Use [roadmap milestones](../roadmap.md) and [QA acceptance](../qa-vertical-slice.md)
for product proof; do not duplicate their checklists here. Update this summary
when a feature boundary changes, with a link to the owning contract or experiment.
