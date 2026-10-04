# Stone profile and paid-ledger interface

[Selected contract](stone-defense-contract-proposal.md) · [Map preflight](stone-authoring-preflight.md)

The shared field is `map.economyProfileId`. Omission resolves to `food-wood-v1`;
the explicit experiment ID is `stone-defense-v1`. Unknown IDs, null and empty
strings are invalid. The helpers are merged. The server integration adds typed banks, deposits,
Watchtower payment/refunds and checkpoint recovery. The client supports profile pins,
typed banks/cargo, drop-off labels and the paid Watchtower price. Profile-specific
node admission and the existing patch brush now support Stone, with a
[natural two-seat conservation proof](stone-authoring-preflight.md#profile-aware-schema-and-placement-interface).
The 160-minimum ordinary catalog excludes the compact Stone laboratory. Its
[shipped map](../maps/stone-defense-field.json) remains accessible through
**Practice → Battlefield → Internal fixture · Lab · STONE DEFENSE FIELD**,
using the agreed 200 Stone per seat and zero starting Stone. A second player can
join that Practice room. The natural two-seat proof uses this internal route;
a separate real Tiny lobby check retains the ordinary floor, rejection,
readiness, launch and reset assertions. No debug flag or map publication is needed.

`src/economy-profile.mjs` owns the single additional price: new Watchtower
construction costs its existing food/wood amounts plus 50 Stone only in the
Stone profile. All other costs and wood-only repairs retain their baseline
contract. The shared base definition validator still rejects Stone/gold/copper
keys, including zero, and requires explicit food/wood prices. It is not widened
to declare unpaid ore costs. A profile override and typed payment must agree.

`constructionCostForProfile` supplies actual construction prices;
`debitEconomyCost` rejects missing/nonfinite banks and produces no partial debit;
`proportionalEconomyRefund` records the unbuilt fraction; `creditEconomyRefund`
preserves fractional bank balances. Command/lifecycle ownership must still
remove canceled work before any replay can refund it again. The server uses these helpers for the construction command and its cancellation.
Other production/research costs remain two-resource; their refunds never create Stone.
See the [dated native ledger/recovery evidence](qa-stone-ledger-recovery-2026-10-03.md).

The map owner can target the unchanged `{id,type,x,z,stock}` node shape with
`type:"stone"`, 200 per seat in 67/67/66 nodes, no regrowth and zero initial Stone.
Authoritative/editor/cluster admission must use the same resolved profile; keep
the exact explicit profile required for Stone nodes.
Town Center/Storehouse accept Stone; Mill remains food-only. Terrain stones stay
blocking terrain. Existing uneven 101-stock rejection fixtures remain separate.

The baseline profile retains the exact `GAMEPLAY_RULESET_REVISION` pin. The
Stone profile has a distinct canonical pin incorporating the base revision,
profile ID, Watchtower price and Stone drop-offs. Checkpoint23 records
`economyProfileId` and `state.teamStone`; exact supported legacy checkpoints
remain baseline with zero Stone and unchanged paid prices. Do not mutate an
omitted map field during migration: its existing map checksum must still match.
Old/future pins cannot claim new mineral state. Unknown pins stay rejected and
the file remains byte-exact. The old content migration first reaches schema22, then the economy migration
adds only the explicit baseline selector and `[0,0]` Stone bank. A schema22
checkpoint claiming any Stone bank, cargo, source or profile is rejected.

The server wire fields are `economyProfileId` and a Stone-profile-only `stone`
bank array, with the existing opponent-null filtering under fog. Runtime owns
typed cargo/deposit/spend/refund/checkpoint dispatch. Map ownership supplies
profile/node/bank admission and placement; opponent ownership supplies Stone
gather/spend policy. Farm AI planting remains with the opponent owner.

The [natural Farm/Stone handoff proof](qa-farm-stone-paid-2026-10-04.md) verifies
paid planting and defense together on the shipped laboratory, typed Stone
delivery before Farm food gathering, Mill food-only routing, proportional Farm
refunds and cold recovery. The same tool checks baseline Millrace prices; it
does not change the developing 160 × 160 gameplay floor or provisional tuning.

The client loads prices from `constructionCostForProfile`, keeps fractional balances
for affordability and displays conservative whole stocks. Stone bank/card, selected
cargo, Worker cargo and Town Center/Storehouse labels appear only in the Stone
profile. Mill remains food-only. Unknown cargo is never displayed as food.
An empty-node profile proves these surfaces and recovery readiness, not natural harvesting.
The Stone node marker is a plain gray indicator, without an authored ore asset.
See the [dated client surface evidence](qa-stone-client-surfaces-2026-10-03.md).

```sh
node --test scripts/economy-profile.test.mjs scripts/economy-checkpoint.test.mjs scripts/economy-server.test.mjs scripts/gameplay-definitions.test.mjs scripts/ruleset-revision.test.mjs
node --test scripts/economy-client.test.mjs scripts/resource-format.test.mjs scripts/contextual-hud.test.mjs
node scripts/economy-client-browser.mjs --output=/tmp/stone-client-surfaces-proof
```
