# Bellweather Sheep — first harvestable animal draft

**Status, 3 October 2026:** the original source-based proposal at fork main
`9990ed3` remains the claim/herd design. A narrower neutral food foundation is now
implemented below. It delivers no new art, sprites, runtime mesh, default-map
placement or accepted stock/gatherer-cap balance.

[Wiki wildlife entry](lore/wildlife.md) · [Art evolution](lore/art-evolution.md)

## Implemented neutral food foundation — 3 October 2026

[Authoritative state](../src/wildlife-state.mjs) admits one optional resource-node
identity, `wildlifeSpecies: "bellweather-sheep"`, only on existing `food` nodes.
Maps still specify the ID, coordinates and finite positive stock; no additional
food pool or currency is created. The node limit, open-cell, both-seat
reachability, construction-site and food drop-off rules remain the existing ones.
No shipped map opts in yet. [Map schema](map-authoring.md#resources-and-forests)
contains the authoring contract; dedicated Map Studio controls are future work.

The room worker starts each sheep `alive`. A seat's own living, gather-capable,
reachable Worker may issue the existing `gather` command with the node ID only
while its cell is currently visible. An accepted distant order leaves it alive.
The first authorized Worker in normal interaction range changes it once to a
stationary `carcass`; activation itself grants no food. Existing gathering then
moves stock into food cargo at the unchanged rate/carry limit and deposits at
valid food drop-offs. Either seat may gather the same visible carcass, regardless
of who activated it. There is no ownership or claim check. Repeated orders and
interruption preserve the same stock pool; exhausting it sets `depleted` and
rejects new gathering. Wildlife adds no movement/sight/population or path blocker
and is absent from combat targeting. No gatherer cap is introduced in this slice.

Checkpoint schema 20 saves species, lifecycle, stock and existing Worker intent/
cargo together. It validates `alive` only at full authored stock, `carcass` only
with positive remaining stock and `depleted` only at zero. Schema 19 ordinary
maps migrate without replenishment. Reconnect/restart retains partial carcasses
and untouched live sheep; an explicit rematch restores authored live stock and
resets the economy. There is no decay, reproduction, regeneration or restocking
inside a match.

Run `node --test scripts/wildlife-state.test.mjs` and
`node scripts/wildlife-food-scenario.mjs`. The disposable two-seat scenario uses
real map publication/orders, tests hidden/foreign-worker rejection, fractional
stock conservation with lost-cargo/duplicate-credit negative controls, shared
carcass access after Stop, partial/depleted recovery, both-seat deposits, rematch
and rejection of a contradictory saved lifecycle. Its fixture stocks are test
values, not balance choices. Rendering, claim/herding, combat dispatch, regional
placement, AI-specific wildlife policy and browser match evidence remain separate
outcomes. The high-detail Sheep GLB is an art reference, not a runtime mesh; client
integration must be coordinated with the parent and sprite owner before it starts.

## Observed source

![Selected Bellweather ecology key](art-direction/vaelora-v1/bellweather-ecology.png)

The 1536 × 1024 key's middle-left animal is labelled **Bellweather Sheep**.
Direct pixel inspection shows a deep cream fleece with broad overlapping locks,
a pale face, outward brown-pink ears, bare lower legs and dark hooves. No horns,
harness or magical ornament are visible. This one oblique illustration supplies
identity, not a turnaround, gait cycle, measured anatomy or transparent sprite.
Its SHA-256 is `043d3be76343e9e5c04850fe99be84333b977a7215e503152bf1ab9dc588ed40`.

The [regional map](art-direction/vaelora-v1/bellweather-map.png), also inspected,
shows irregular pasture beside oak groups, orchards, winding tracks and river
banks. Small pale animals appear in the lower pasture; their anatomy is too small
to settle a second design. Fenced cultivation and open grassy margins motivate
placement. They do not establish coordinates for a playable scenario.

## Regional inventory from inspected pixels

All ten ecology keys were opened at original resolution. Labels below are
provisional source labels; illustrative specimen sizes do not establish scale,
edibility or playable capabilities. Only the sheep receives a design in this slice.

| Ecology key | Visible fauna and distinguishing forms | Later design consideration |
| --- | --- | --- |
| [Bellweather](art-direction/vaelora-v1/bellweather-ecology.png) | Cream Sheep, orange Field Fox, spotted antlered River Deer, Meadow Beetle | Sheep first; deer could be a separate hunt outcome |
| [Underbough](art-direction/vaelora-v1/underbough-ecology.png) | Tusky Bough Boar, rust Squirrel, Bark Moth, leaf-covered Bough Deer | Boar would require a distinct threat/retaliation decision |
| [Sereward](art-direction/vaelora-v1/sereward-ecology.png) | Harnessed Antelope, large-eared Dune Fox, turquoise Oasis Beetle, Dune Lizard | The pictured antelope is a caravan animal; food use is unsettled |
| [Ellionar](art-direction/vaelora-v1/ellionar-ecology.png) | Jewel-Blue Kingfisher, Copper-Gold Scarab, Orchard Gazelle, patterned Garden Tortoise | Gazelle suggests a later mobile hunt candidate |
| [Veyrholds](art-direction/vaelora-v1/veyrholds-ecology.png) | Shaggy curved-horn Goat, dark Cleftwing Raptor, Stone Marmot, Furnace-Cricket | Goat suggests a later herd candidate with regional anatomy |
| [Pale Meridian](art-direction/vaelora-v1/pale-meridian-ecology.png) | Harnessed shaggy Pack Beast, long-eared Snow Hare, Starfeather Owl, Winter Moth | Pack role and cold habitat differ from the sheep pilot |
| [Siltmouths](art-direction/vaelora-v1/siltmouths-ecology.png) | Silt Heron, broad Mud Crab, Estuary Otter, silver Estuary Fish | Aquatic access would need separate economy/path rules |
| [Vesperra](art-direction/vaelora-v1/vesperra-ecology.png) | Many-eyed Ootilok, Vespermouse, winged Pale Glider, Sleepless Moth | Supernatural inhabitants have no implied food role |
| [Sombral Mere](art-direction/vaelora-v1/sombral-mere-ecology.png) | Silver-haired Merehart, Violetreach bird, translucent Lunescale fish, Mereveil moth | Preserve distinctive anatomy; no implied universal livestock |
| [Ru’Lora](art-direction/vaelora-v1/ru-lora-ecology.png) | Green-violet Loralisk and Fringe Lizard; interior Ashmites labelled dead specimen | Living fauna belongs to the fringe proposal; no interior herd |

## Proposed player loop

Explore a pasture, claim a small flock, move it to a defensible gathering place,
then trade its finite food for production. This follows the user's AoE-sheep
analogy while keeping Vaelora's observed animal identity. Wool is lore/craft
context, not a second resource in this pilot.

| State | Proposed behavior and player feedback |
| --- | --- |
| Unclaimed grazing | Small head dips and occasional short steps inside its pasture; no combat aggression. Visible selection says `Unclaimed · Food 100`. |
| Claiming | Explicit Worker interaction claims a visible living sheep within normal interaction range. Viewing or scouting it alone does not transfer ownership. Competing requests must resolve through server authority and show the result to both seats. |
| Claimed / moving | Owner selects the sheep and orders a ground destination. Walk slowly, stay on passable ground, stop with a clear blocked-route notice. Stop cancels travel. Retain the claim until death or rematch in this first proposal; stealing/recapture is a later decision. |
| Harvest activation | Owner's explicit Worker Gather starts a brief non-graphic dispatch/settle action. It stops movement and permanently changes the animal to a stationary carcass at that location. No food is banked by the transition itself. |
| Carcass gathering | Reuse food cargo and valid food drop-offs. Proposed stock: 100 food per animal; proposed gatherer cap: three. Preserve remaining stock across interruptions and worker loss. A carcass is a shared food site; enemy Workers may gather it when visible and reachable. |
| Depleted | At zero stock, end gathering and remove the resource target; a short fading remnant must not grant food or block a route. No breeding, regeneration, decay loss or restocking in the pilot. |

Stock and gatherer cap are trial values, not accepted balance. Existing gather
rate and carrying limits should be the starting comparison. Claimed animals
should not consume military population or grant new sight; targeting still uses
the owner's current fog-filtered visibility. Combat damage may kill a sheep into
the same carcass once; military auto-targeting should ignore neutral livestock.
Death during dispatch must not create a second stock pool. Ownership belongs in
selection/status overlays, keeping the cream fleece neutral.

## Organic placement proposal

Author two to four animals around a pasture anchor, using unequal spacing and
different headings. Favor dry grass near an oak's open margin or an orchard's
outside edge. Leave paths, bridge approaches, water, steep banks, dense canopy,
resource interaction space and Town Center exits clear. A seed should reproduce
the layout; use bounded candidate attempts and report an unplaceable flock.

For a symmetric two-seat pilot, give each opening the same total food and compare
reachable travel distance, gathering room and escort exposure. Flocks can have
different visual arrangements without changing the opening budget. Specify a
pasture boundary so idle wandering cannot cross into the opponent's opening or
silently become a blocker. Local crowd avoidance should yield to armies.

This is a wildlife habitat requirement for a future map outcome. It supplies no
coordinates and changes no resource-placement algorithm or existing food nodes.

## Perspective sheet and possible sprite package

First prepare a same-animal anatomy sheet: front, left profile, right profile,
rear, and elevated three-quarter. Preserve head shape, ear attachment, four legs,
fleece mass and tail across views. Plain anatomy guides and painted concepts are
separate review stages. Neither sheet exists yet.

For game views, keep the [measured camera](art-direction/environment-camera-v1/README.md)
fixed at 45° azimuth / 45.4359024848° elevation. Rotate the animal in eight world
yaws from 0° through 315°; yaw zero points +Z. Label world yaw explicitly instead
of guessing compass labels from the painting. Share one canvas, root, scale and
light direction; use true rear/profile drawings rather than mirroring one view.

Initial scale trial: 0.60 world units at the shoulder and 0.90 nose-to-rump,
compared beside the current 1.2161865234375-world-unit Human Worker. These are
proposed object dimensions, not values measured from the key or sprite-card
height. Start with cream/light-ochre fleece masses and a darker face/leg contour
so the sheep remains distinct from stones and pale foliage at strategic zoom.

| Planned source | Smallest useful coverage | Review focus |
| --- | --- | --- |
| Idle / graze | Eight registered standing views; one heading's short head-down/up loop | Consistent identity, four-leg attachment, planted feet |
| Walk | One heading with four alternating hoof-contact keys, then other headings | Animal gait, root continuity, stable fleece volume |
| Dispatch / death | One bounded settle sequence with a clear stationary final pose | No repeated live/harvest state or clipped legs |
| Carcass / exhausted | Readable prone form, then depleted remnant or empty state | Distinct resource availability at normal/strategic zoom |

Potential home: `assets/wildlife/bellweather-sheep-v1/`, once produced. Use the
[sprite-atlas contract](sprite-atlas-contract-v1.md): source/runtime pairs, exact
hashes, grounded pivots, explicit clips and alpha margins. Register a hoof-plane
root; changing alpha bounds must not move the animal or shrink its body.
Backgrounds, labels, shadows and ownership UI stay out of runtime cutouts.
No wildlife loader or validated sprite manifest exists in this slice.

## Implementation boundary and next proof

At `9990ed3`, [map authoring](map-authoring.md#resources-and-forests) and
[server validation](../server.mjs) admit finite `food`/`wood` nodes. Worker
economy gathers from stationary node state; it has no sheep ownership, movement,
harvest activation or wildlife snapshot contract. Replacing berries with a sheep
picture would not implement this loop. A later gameplay slice must own entity
identity, fog, authoritative transitions, cargo/drop-off reuse, recovery/rematch,
AI behavior and Map Studio serialization before claiming harvestable animals.

The next art outcome is one saved anatomy/perspective candidate with exact input
references and review notes. Later inspect loaded art at 1280 × 720, recorded DPR,
ordinary 0.91 and strategic 0.48 zoom: sheep versus Worker/rock recognition, ground
contact, eight headings, motion and resource states. A later two-seat match must
prove contested claims, food conservation, blocked routes, worker death,
reconnect and rematch. Source pixel review in this draft is not runtime evidence.

## Design references

The [openage ability API](https://github.com/SFTtech/openage/blob/master/doc/nyan/api_reference/reference_ability.md)
separates Gather/Harvestable, stock and gatherer limits, harvest activation,
DropSite, Herd/Herdable ownership, and Restock. That separation informs the
proposed state boundaries; it is API documentation, not proof of finished
openage gameplay or rules already present here.

The [archived official 0 A.D. placement source](https://github.com/0ad/0ad/blob/master/binaries/data/mods/public/maps/random/rmgen-common/player.js)
uses grouped StartingAnimal placement, configurable distance/spacing, a base
resource constraint and bounded retries. It informs the placement proposal;
the numbers and code are not copied, and this archive does not certify current
upstream behavior. Both references were read on 2 October 2026.

**Sources:** selected ecology/map pixels, their
[manifest](art-direction/vaelora-v1/manifest.json), current runtime source and the
primary design references above. Proposed behavior, scale and stock are new
design work. The [preservation audit](art-direction/preservation-audit-2026-10-02.json)
records inspected files and verification scope. No Meshy or paid generation ran.
