# Unit and building art — frontier kit v1

This is the first original game-object kit for the 1v1 vertical slice. It follows the game bible's oblique camera, Azure and Ember team colors, and illustrated frontier materials. Terrain and neutral landmarks are owned by the environment art track.

## Shape language

| Object | Readable cue at play zoom | Material and color cue |
| --- | --- | --- |
| Worker | Short body, warm cap, back pack, broad hand tool | Ochre leather and worn timber over team cloth |
| Infantry | Full-height body, dark six-sided shield, upright spear | Steel-grey cap, deep team shield, dark shaft |
| Archer | Narrower body, bow on the forward side, back quiver | Moss hood, weathered wood over team cloth |
| Town Center | Wide stone hall with a high rear tower | Pale weathered stone, charcoal slate, team doorway trim and tower banner |
| Barracks | Enclosed timber walls, pitched ridge roof, shield over gate | Dark timber and slate, team standard |
| Archery Range | Open corner posts, single sloped canopy, target at the front | Dark timber and slate, team standard |

Azure stays sky blue and Ember rust red. Authored unit packs reserve team tint for the dedicated sash; tools, shields, packs, and weapons stay neutral. Building walls, roofs, shields, and trim also stay neutral; compact standards and ownership outlines carry team identity. Azure standards use a straight-cut pennant with one centered bar, while Ember standards use a forked-tail pennant with a split bar. Stone, slate, wood, leather, and metal stay shared so the teams occupy one world. Shapes and equipment distinguish roles when color is hard to see. The procedural full-detail renderer keeps its current body/shield tint until a side-by-side review approves migration.

## Motion and signals

- Walking units have an offset stride phase so mass movement does not pulse in lockstep. Only moving units update their pose each frame.
- At full detail, known cargo tints the existing Worker backpack batch: leaf green for wood, amber for food, and neutral when unknown. Strategic role LOD keeps role glyphs and equipment, including the small backpack facet, neutral; Azure identity remains in a separate team-colored square marker, and Ember identity in a team-colored diamond marker. The facet reuses the existing Worker role batch and adds no unit draw batch. These renderer cues are source-only and still need runtime visual review.
- Workers swing their tool while the server reports gathering or building. Server-reported strikes drive a short infantry spear thrust, archer bow release, or worker tool swing. A capped, sampled arrow trace marks some archer shots without filling a mass battle with projectiles.
- Newly produced units scale in briefly. Defeated units tilt and shrink before disappearing. The server sends a strike tick and target point only while the event is fresh; target coordinates stay private under fog when the attacker is an enemy.
- Existing damage flashes, focused-fire rings, building impact flashes, and construction progress remain localized cues. Finished building details appear with the roof. Small team-color lamps pulse on a Town Center, Barracks, or Range while its production queue is active.
- Unit pieces are instanced per team; no unit owns an individual Three.js object. The extra gear raises a fixed draw-call count, independent of roster size. The 2,000-unit browser benchmark remains the gate for further detail.

## First-pass review

Stone Pass was reviewed in the browser at the normal game zoom and a closer base view with 250 and 1,000 units. Team color, the Town Center roof, and the massed spear silhouette read clearly. In a 250-unit mixed-roster preview, workers completed a Range and Barracks, an archer and infantry appeared after training, and the Town Center and Barracks showed active production. The Range's open canopy and target distinguish it from the enclosed Barracks at closer zoom. The isolated branch was also reviewed at ordinary zoom on Stone Pass and Cinder Ridge; team colors remain distinct over both grounds, while small role gear calls for closer viewing.

The final 2,000-unit headless Chrome movement benchmark passed on the isolated art branch on Apple M2 / Metal: 1,998 moving units, 16.8 ms frame interval p95, 3.5 ms animation callback p95, and no tasks over 50 ms across a 30.13-second measurement. These headless timings do not measure windowed presentation or GPU completion. `npm test` and the separate live Archer research/combat scenario passed on that branch.

## Motion and readability refinement

The follow-up pass eases unit facing toward movement or strike direction, adds a low-amplitude idle breath and a short hit recoil, and keeps their timing offset across the roster. Idle matrices update at a bounded cadence; walking units keep their normal frame-rate pose updates. Town Center roof trim and a larger banner, Barracks ridge color, and Range canopy trim carry team identity at a distance. Large selections use smaller, fainter rings so the rings do not cover the unit silhouettes.

## Remaining review

Review role recognition and building silhouettes at ordinary zoom on both meadow and cinder ground with a more evenly mixed roster. Refine the brief combat poses from live two-player footage; the current arrow cue is intentionally sampled and has a fixed cap. Recheck the 2,000-unit movement budget after every increase in animated detail.
