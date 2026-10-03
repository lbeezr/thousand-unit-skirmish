# Sheep on the default Millrace map — 3 October 2026

At fork main `8562807dd09116eaf4819f2721ab26a9b3e29f69`, no normal catalog
map contained `wildlifeSpecies`; the public Sheep renderer was exercised through
published test fixtures. The user requested Sheep on ordinary maps to test them.

**Bellweather · Millrace** is the configured default. Its existing opening
satellites `s0-0-1`, `s0-0-3`, `s0-0-4` and their `s1` mirrors now carry
`wildlifeSpecies: "bellweather-sheep"`. The dirt-track anchor and remaining food
marker stay ordinary food. The normal client uses its existing public static
illustration; no pose option, preview page, new artwork or moving animal is needed.

There are three 130-food Sheep per side: 780 Sheep food and 2,020 ordinary food,
still **2,800 map food**. Node wood remains 4,200; forest wood remains 1,404.
Each seat still starts with 150 food / 250 wood. IDs, all coordinates, terrain
seed 93000, terrain, objectives, Town Center clearings and paths are unchanged.
The count/stock is provisional test content, preserving existing economy rather
than accepting new animal balance. The existing seeded cluster generator applies
the identity opt-in reproducibly after placing its validated ordinary markers.

Actual opening fog includes satellite `-1` for both seats. The Sheep occupy open
level meadow with mirrored route lengths of 10/14/14 cells. Existing cluster
tests prove both-seat reachability, flat cells, legal build clearings and track
clearance. Unknown/positive resource construction exclusions and finite gathering
use the same existing rules, including Return cargo and food-only Mills.

An exact compatibility update prevents this identity-only revision from rejecting
the previous shipped Millrace save. The prior map hash is
`XF4DowoHH8lN_HYtFhrOy7E6TkXdMo3TQck2QFTHNt8`. Full legacy validation runs first;
the migration requires that hash for both the saved map and current map with only
the six new species fields removed. It annotates the six saved rows with `alive`
at full stock, `carcass` at partial stock and `depleted` at zero, without changing
stock, bank, cargo, worker intent, match ID or schema. Full upgraded validation
runs again. Other map drift and corrupt state retain rejection/archive behavior.

Validation:

- `node --test scripts/millrace-sheep.test.mjs scripts/resource-cluster-authoring.test.mjs`
- `node scripts/millrace-sheep-scenario.mjs`

The real worker uses its actual default map, without publication or stock
injection. Both seats receive an immediately visible live Sheep, load its public
art through HTTP, and attach the existing Three scene illustration. Natural
gathering supplies partial carcass stock and carried food. Removing identities
only from that valid checkpoint reproduces the exact previous map format;
restart migrates it, preserves stock/cargo/match identity, and both Workers return
their food once. A current-save restart preserves the deposit; rematch restores
all six live stocks. A correctly hashed unrelated legacy terrain edit rejects and
is archived. Food stock + both banks + cargo stays 3,100 throughout the paid-free
fixture, including 300 starting bank. Unit tests cover full/partial/zero migration
and corrupt/missing/duplicate selected rows. This is CPU Three/HTTP evidence;
native browser appearance is not established.

For play, use **Bellweather · Millrace** in the normal map picker. A fresh default
battlefield or new room includes the Sheep. Select a Worker and right-click the
visible Sheep beside its home orchard; the other two reveal on approach. An
already running browser must reconnect to the updated deployment. A customized
published copy is its own saved map and is not silently changed. Main merge and
Railway availability are separate results; the PR records exact deployment status
and SHA when observed, without initiating a deployment in this lane.
