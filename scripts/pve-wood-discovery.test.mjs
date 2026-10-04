import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('./pve-wood-discovery-case.mjs', import.meta.url));
const fog = (snapshot, cell) => (Buffer.from(snapshot.visibility.data, 'base64')[cell >> 2] >> ((cell & 3) * 2)) & 3;

for (const team of [0, 1]) test(`Medium seat ${team}: paid depletion, Scout disclosure, forest Gather and native deposit, controls/cold exact replay`, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pve-wood-native-'));
  let sequence = 0;
  const run = async options => {
    const config = path.join(directory, `config-${sequence}.json`), output = path.join(directory, `result-${sequence++}.json`);
    await writeFile(config, JSON.stringify(options));
    const child = spawnSync(process.execPath, [helper, String(team), config, output], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    return JSON.parse(await readFile(output));
  };
  try {
    const warm = await run({});
    assert.deepEqual(await run({ opening: warm.opening }), warm, 'paid prelude, commands/notices, full samples and final checkpoint exactly repeat');
    assert.equal(warm.setup.spentFood, 40); assert.equal(warm.setup.spentWood, 230);
    assert.ok(warm.setup.stages.scout < warm.setup.stages.depleted);
    assert.equal(warm.prepared.state.resourceNodes.find(n => n.id === `s${team}-home-wood`).stock, 0);
    assert.deepEqual(warm.result.start.forestCells, [], 'the paid depletion boundary has no currently visible tree');
    const cold = await run({ prepared: warm.prepared, cold: true });
    assert.deepEqual(await run({ prepared: warm.prepared, cold: true }), cold, 'accepted forest work survives exact fresh-fixture/policy replay');
    for (const branch of [warm, cold]) {
      const { stages, disclosureWitness, depositWitness } = branch.result;
      assert.ok(stages.forestDisclosed > branch.result.startTick);
      assert.ok(stages.forestGather >= stages.forestDisclosed);
      assert.ok(stages.woodDeposit > stages.forestGather);
      const disclosed = disclosureWitness.cells.filter(tree => Math.hypot(tree.x - disclosureWitness.scout.x, tree.z - disclosureWitness.scout.z) <= 11);
      assert.ok(disclosed.length > 0, 'actual moving paid Scout reaches the disclosed living tree');
      for (const tree of disclosed) assert.equal(fog(branch.result.samples[0][team], tree.cell), 0, 'that forest address was unknown before exploration');
      assert.ok(depositWitness.bankIncrease > 0);
      assert.ok(branch.result.final.state.forestStocks.some(([, stock]) => stock < 6), 'native tree stock is actually harvested');
      assert.equal(branch.result.final.matchModeId, 'skirmish');
      assert.equal(branch.result.final.state.matchWinner, -1);
    }
    assert.equal(cold.result.stages.coldRestart, cold.result.stages.forestGather);
    const controls = {};
    for (const control of ['no-disclosure', 'no-forest-gather']) {
      const branch = await run({ prepared: warm.prepared, control });
      assert.deepEqual(await run({ prepared: warm.prepared, control }), branch, `${control}: exact native negative replay`);
      assert.ok(branch.result.stages.forestDisclosed !== null, 'the Scout still performs native discovery');
      assert.equal(branch.result.stages.forestGather, null);
      assert.equal(branch.result.stages.woodDeposit, null, 'discovery or planned Gather alone cannot qualify');
      assert.equal(branch.result.final.state.tickNumber - branch.result.startTick, 180 * 30, 'unchanged bounded control horizon');
      assert.deepEqual(branch.result.final.state.forestStocks, warm.prepared.state.forestStocks, 'no native forest extraction occurs in either control');
      controls[control] = branch;
    }
    if (process.env.RTS_PVE_WOOD_EVIDENCE_DIR) await writeFile(path.join(process.env.RTS_PVE_WOOD_EVIDENCE_DIR, `wood-discovery-${team}.json`), JSON.stringify({ warm, cold, controls }));
    console.log(JSON.stringify({ team, paidPrelude: warm.setup.stages,
      warm: warm.result.stages, cold: cold.result.stages,
      deposited: [warm.result.depositWitness.bankIncrease, cold.result.depositWitness.bankIncrease], controls: Object.keys(controls) }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
