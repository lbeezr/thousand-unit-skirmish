import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('./pve-contested-wood-case.mjs', import.meta.url));

for (const team of [0, 1]) test(`Medium seat ${team}: native forest Worker loss, paid replacement and restored income, controls/cold exact replay`, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pve-contested-wood-'));
  let sequence = 0;
  const run = async options => {
    const config = path.join(directory, `options-${sequence}.json`), output = path.join(directory, `result-${sequence++}.json`);
    await writeFile(config, JSON.stringify(options));
    const child = spawnSync(process.execPath, [helper, String(team), config, output], { encoding: 'utf8', maxBuffer: 1024*1024 });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    return JSON.parse(await readFile(output));
  };
  try {
    const warm = await run({});
    assert.deepEqual(await run({ opening: warm.loop.opening }), warm, 'the complete paid loop, ordinary loss, all commands/notices, peer samples and final checkpoint repeat exactly from the untouched opening');
    const cold = await run({ loop: warm.loop, cold: true });
    assert.deepEqual(await run({ loop: warm.loop, cold: true }), cold, 'the paid replacement queue repeats across a fresh authority/policy restore');
    for (const branch of [warm, cold]) {
      const r = branch.result, { stages } = r;
      assert.equal(branch.loop.result.depositWitness.bankIncrease, 10, 'ordinary paid depletion/discovery/deposit precedes the raid');
      assert.equal(r.prepared.state.resourceNodes.find(n => n.id === `s${team}-home-wood`).stock, 0);
      assert.ok(r.focusWitness.raiderView.units.some(u => u[0] === r.casualty.id && u[8] === r.casualty.generation && u[4] > 0), 'focused Attack names a currently disclosed living generation');
      assert.equal(r.lossWitness.worker.workIntent.sourceKind, 'forest-group');
      assert.ok(r.lossWitness.worker.hp > 0);
      assert.ok(r.lossWitness.after.units.some(u => u[0] === r.casualty.id && u[8] === r.casualty.generation && u[4] === 0), 'native damage kills the actual forest Worker');
      assert.equal(r.purchases.length, 1, 'one ordinary replacement is actually paid');
      assert.deepEqual(r.purchases[0].cost, { food: 50, wood: 0 });
      assert.ok(stages.workerPurchase > stages.casualty);
      assert.ok(stages.replacementSpawn > stages.workerPurchase);
      assert.ok(stages.replacementGather >= stages.replacementSpawn);
      assert.ok(stages.replacementDeposit > stages.replacementGather);
      assert.ok(stages.woodDeposit > stages.woodGather);
      assert.equal(r.replacementDepositWitness.qualifiedCargo, 10);
      assert.equal(r.woodDepositWitness.qualifiedCargo, 10);
      assert.equal(r.woodDepositWitness.type, 'wood');
      assert.ok(r.replacementDepositWitness.delivered.every(u => r.replacements.some(([id, generation]) => id === u[0] && generation === u[8])), 'the paid replacement supplies actual matching living-generation cargo');
      assert.equal(r.final.matchModeId, 'skirmish');
      assert.equal(r.final.state.matchWinner, -1);
      assert.equal(r.final.state.units.filter(u => u.team === team && u.kind === 'worker' && u.hp > 0).length, r.startWorkers);
      assert.ok(Math.abs(r.preludeWoodResidue) < 0.0001 && Math.abs(r.recoveryWoodResidue) < 0.0001);
      assert.equal(r.trace.filter(row => row.accepted === false).length, 0, 'the qualified bounded case has no rejected commands');
    }
    assert.equal(cold.result.stages.coldRestart, cold.result.stages.workerPurchase);
    const controls = {};
    for (const control of ['no-replacement-gather', 'no-new-wood-gather']) {
      const branch = await run({ loop: warm.loop, control });
      assert.deepEqual(await run({ loop: warm.loop, control }), branch, `${control}: exact matched ordinary native replay`);
      assert.deepEqual(branch.result.casualty, warm.result.casualty, 'controls preserve the same actual loss');
      assert.deepEqual(branch.result.purchases, warm.result.purchases, 'controls still pay for the ordinary replacement');
      assert.equal(branch.result.final.state.tickNumber-branch.result.startTick, 180*30, 'the recovery control horizon stays bounded');
      if (control === 'no-replacement-gather') {
        assert.equal(branch.result.stages.replacementGather, null);
        assert.equal(branch.result.replacementDepositWitness, null, 'a paid/spawned replacement alone cannot qualify productive recovery');
      } else {
        assert.equal(branch.result.stages.woodGather, null);
        assert.equal(branch.result.woodDepositWitness, null, 'earlier surviving forest deliveries cannot qualify a newly assigned Wood recovery job');
      }
      controls[control] = branch;
    }
    if (process.env.RTS_PVE_CONTESTED_EVIDENCE_DIR) await writeFile(path.join(process.env.RTS_PVE_CONTESTED_EVIDENCE_DIR, `contested-wood-${team}.json`), JSON.stringify({ warm, cold, controls }));
    console.log(JSON.stringify({ team, warm: warm.result.stages, cold: cold.result.stages,
      replacementIncome: warm.result.replacementDepositWitness.type, lostWood: warm.result.deadCargo, controls: Object.keys(controls) }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
