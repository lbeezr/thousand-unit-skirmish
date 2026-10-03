# Stone ledger and recovery · 2026-10-03

The optional `stone-defense-v1` server profile now has typed bank, Worker cargo,
deposit, new Watchtower payment, proportional unfinished refund and checkpoint23
recovery. The baseline keeps its food/wood rules and exact gameplay pin. The
profile starts with zero Stone. Authoritative Stone nodes and initial Stone grants
remain closed; this is ledger readiness without a natural-harvest claim.

The native test uses a 64×64 empty-node fogged map and real asynchronous two-seat
sockets. Both seats see their own zero bank and an opponent-null bank, and cannot
build a Watchtower without 50 Stone. Banks, occupancy and next building ID stay
unchanged. A declared checkpoint fixture then supplies fractional Stone bank/cargo
only for recovery testing. Each real Worker returns 3.125 Stone to its Town Center
once, without food or wood credit. Actual Watchtower commands pay 50 food / 150 wood / 
50 Stone. Builders stop while construction is partial; cold recovery preserves the
paid banks, zero delivered cargo, building IDs and exact frozen progress. Foreign
and replayed cancellations reject. Refunds equal each price times the frozen
unbuilt fraction, rounded to six decimals, with only binary precision tolerance.

Missing typed banks, missing or mismatched profile identity, and future pins reject
without changing the rejected file bytes. Legacy baseline saves retain fractional
banks/cargo and depletion. Old schemas cannot claim new Stone state. Existing Farm
stock, queues and paid prices remain governed by their own supported content pins.

[Clean native result](../artifacts/stone-ledger/2026-10-03/native-recovery.log) ran
at `bee4a563f7578838b0a3c7f52fc17cd92ea0aeec`. The conflict-free integration with
main's queued delivery and paid PvE Farm changes passed 93 focused checks at
`49e2c30ee7b9d083fce839d6a0f8f2b8c8cd3a09`, plus 6 admission/routing checks,
baseline ruleset recovery, and natural food/wood delivery with queued legs and
restarts for both seats. A later main merge added only occlusion fixtures/docs;
server runtime bytes remained unchanged.

[Focused checks](../artifacts/stone-ledger/2026-10-03/focused-checks.log) ·
[Admission/routing](../artifacts/stone-ledger/2026-10-03/admission-routing.log) ·
[Baseline pin migration](../artifacts/stone-ledger/2026-10-03/baseline-ruleset.log) ·
[Natural queued food/wood cargo](../artifacts/stone-ledger/2026-10-03/baseline-queued-cargo.log).

Independent review covered 95 focused/native checks and 28 legacy migration cases,
plus both-seat native deposits, paid foundation recovery and foreign/replayed
cancellation. Review of the added native test requested a stronger fraction check;
builders now stop before capture, recovered progress is compared, and each refund
is compared to that frozen fraction.

The broader local suite is reported as segmented evidence. Shards 1/2 passed.
Shard 3's prefix passed; a stale mutual-lethal fixture included the unarmed Skiff,
so its eligibility now follows registered attack/self-target capabilities. The
corrected native fixture passed all 42 same-role and 8 asymmetric cases, then its
remaining checks passed. Shard 4 reached an existing Worker-combat movement timeout:
both attack orders leave Workers/infantry undamaged after 35 seconds. The same
timeout reproduced on clean main `1850b3b9d7ace7db572470411167d90d217236f8`.
Its remaining checks passed separately. This is not a green full-suite claim.
Hosted CI was queued, without a hosted pass claim.

```sh
node --test scripts/economy-profile.test.mjs scripts/economy-checkpoint.test.mjs scripts/economy-server.test.mjs scripts/economy-recovery-native.test.mjs scripts/gameplay-definitions.test.mjs scripts/ruleset-revision.test.mjs
node --test scripts/stone-authoring-fixture.test.mjs scripts/storehouse-routing.test.mjs scripts/pve-farm-policy.test.mjs scripts/queued-cargo-return.test.mjs
node scripts/ruleset-checkpoint-scenario.mjs
node scripts/queued-cargo-return-native-scenario.mjs
```

Next: map admission/editor/cluster support for the selected 200 stock per seat
67/67/66 budget; typed Stone gather/spend policy with the opponent owner; both-seat
natural Stone harvest/deposit/payment/refund/destruction/wood-only repair/recovery
conservation. The [shared interface](stone-runtime-interface.md) and
[selected contract](stone-defense-contract-proposal.md) own those boundaries.
Frontier remains the sole verified playable faction.
