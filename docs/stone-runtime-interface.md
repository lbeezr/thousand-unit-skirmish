# Stone profile and paid-ledger interface

[Selected contract](stone-defense-contract-proposal.md) · [Map preflight](stone-authoring-preflight.md)

The shared field is `map.economyProfileId`. Omission resolves to `food-wood-v1`;
the explicit experiment ID is `stone-defense-v1`. Unknown IDs, null and empty
strings are invalid. This slice supplies pure profile/payment helpers; it does
not admit Stone maps, add live banks, or claim a playable Stone economy.

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
remove canceled work before any replay can refund it again. These pure helpers
do not themselves execute a command or prove recovery.

The map owner can target the unchanged `{id,type,x,z,stock}` node shape with
`type:"stone"`, 200 per seat in 67/67/66 nodes, no regrowth and zero initial Stone.
Authoritative/editor/cluster admission must use the same resolved profile; keep
Stone closed until typed deposits and the paid Watchtower loop are integrated.
Town Center/Storehouse accept Stone; Mill remains food-only. Terrain stones stay
blocking terrain. Existing uneven 101-stock rejection fixtures remain separate.

The baseline profile retains the exact `GAMEPLAY_RULESET_REVISION` pin. The
Stone profile has a distinct canonical pin incorporating the base revision,
profile ID, Watchtower price and Stone drop-offs. Proposed checkpoint23 records
`economyProfileId` and `state.teamStone`; exact supported legacy checkpoints
remain baseline with zero Stone and unchanged paid prices. Do not mutate an
omitted map field during migration: its existing map checksum must still match.
Old/future pins cannot claim new mineral state. Unknown pins stay rejected and
the file remains byte-exact. No migration or schema change is implemented here.

The intended wire fields are `economyProfileId` and a Stone-profile-only `stone`
bank array, with the existing opponent-null filtering under fog. Runtime owns
typed cargo/deposit/spend/refund/checkpoint dispatch. Map ownership supplies
profile/node/bank admission and placement; opponent ownership supplies Stone
gather/spend policy. Farm AI planting remains with the opponent owner.

```sh
node --test scripts/economy-profile.test.mjs scripts/gameplay-definitions.test.mjs scripts/ruleset-revision.test.mjs
```
