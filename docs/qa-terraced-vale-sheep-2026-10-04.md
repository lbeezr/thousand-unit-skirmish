# Terraced Vale Tiny default Sheep — 4 October 2026

Wildlife owns this ordinary adoption slice through default integration,
packaging, identified staging delivery and native use. Source base is fork
main `be656c47`; exact reviewed and merged heads belong in the owning PR.
The map owner retains Small/multipurpose arena work, HUD retains layout,
and the Sheep art owner retains new action/collar exports.

Four existing food nodes change animal identity only: each seat's home food
is one 650-food Sheep, and terrace food is one 1,000-food Sheep. The mirrored
IDs, positions and all other authored map fields remain fixed. Valley food
stays ordinary. Map food stays 6,100, node wood 7,950, and each opening retains
24 total units with 150 food and 250 wood per seat. The 160×160 floor, terrain,
Town Center footprints, normal Skirmish rules and bonus-only posts remain.

Normal two-seat Create Room starts Tiny with at least one visible, accessible
alive neutral home Sheep per seat. Ordinary land-unit proximity claims it;
owned live selection uses existing Herd/Stop. Any authorized visible Worker
may Gather, including the opposing seat, using the existing food stock,
carry limit and drop-off rules. Carcass/depletion and food returns retain the
existing conservation/recovery behavior. Existing approved still art is bound;
no high-detail reference mesh or new generated artwork enters runtime.

Exact pre-adoption schema29 saves use a guarded identity-only map migration
after full validation. Untouched selected stock becomes neutral alive;
partially consumed stock becomes carcass; zero stays depleted. All food,
cargo, banks, positions, unit orders, match timing and map geometry survive.
Unrelated changed or forged revisions reject atomically. Current saves resume
their real animal motion, claims and lifecycle without reinitialization.

Initial source checks pass 11 map/regeneration/migration assertions, one actual
managed Create Room/lobby/atlas entry test and 107 wildlife, economy, mode, fog
and CI-coverage regressions. The motion capture fixture now supplies its
precomputed visibility boundary and inactive Bannerfall state explicitly; its
private-motion copy assertions remain unchanged. Exact final-head counts,
both-seat HTTP/WebSocket claim/Herd/Stop/Gather/food return and cold recovery,
and packaged map/module/art evidence belong in the owning PR. CPU/Three and
server checks establish those contracts; native GPU
appearance remains incomplete in this executor because Chromium's SUID sandbox
is unconfigured. No bypass or direct deployment is authorized.

At `f6fb4d87`, refreshed through fork main `384ac60c`, all **119/119** focused
checks pass. The real both-seat default lifecycle and exact old-map cold restore
also pass with server SHA-256
`7e60b0838092d31444efbeacc19a59f9b72edf9143c28d779268e5baa950c32e`.
Two unchanged 650-food home nodes fully deplete; final combined banks are
1,600 (the 300 opening food plus 1,300 returned food), including opposing-seat
Gather. Remaining stock, cargo and banks conserve all 6,400 opening food.
[PR249](https://github.com/lbeezr/thousand-unit-skirmish/pull/249) records the
exact independent review, release inclusion and postmerge receipt separately.

The active Railway delivery owner must supply an identified build containing
this map identity change. On that build, launch ordinary Tiny as each seat,
find the opening Sheep, claim/select/Herd/Stop it, Gather it with a Worker,
return cargo and reconnect/rematch. Verify actual art/picking/rings/minimap,
food/owner text, blocked/hidden/foreign order rejection and once-only food
return. The latest observed staging source `64cc391e` predates even the Herd
controls; source merge does not establish this default deployed use.
