import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { replayWoodDiscovery } from './pve-wood-discovery-case.mjs';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
const key = unit => `${unit.id}:${unit.generation}`;
const selected = (units, type, extra = {}) => ({ type, ids: units.map(u => u.id),
  unitGenerations: units.map(u => u.generation), ...extra });

// Ordinary one-casualty raid following the real paid depletion/discovery/deposit.
// Focus selection reads only the raider's disclosed player observation.
export async function replayContestedWood(team, { loop = null, opening = null, cold = false,
  control = 'none', seconds = 180 } = {}) {
  assert.ok([0, 1].includes(team));
  assert.ok(['none', 'no-replacement-gather', 'no-new-wood-gather'].includes(control));
  assert.equal(seconds, 180);
  loop ??= await replayWoodDiscovery(team, { opening });
  assert.equal(loop.result.depositWitness.bankIncrease, 10);
  const initial = loop.result.final;
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-riven-escarpment.json', import.meta.url)));
  let fixture = await createPveHeadlessFixture(map, identity), r = fixture.replay;
  r.restore(initial);
  const enemy = 1 - team, view = seat => toOpponentObservation(r.observe(seat), seat, map);
  const initialTick = view(team).tick, initialViews = [r.observe(0), r.observe(1)];
  const originalWorkers = new Set(view(team).units.friendly.filter(u => u.kind === 'worker').map(key));
  const startWorkers = originalWorkers.size;
  const raiders = view(enemy).units.friendly.filter(u => u.kind === 'infantry' && u.hp > 0);
  const raiderKeys = new Set(raiders.map(key));
  const publicSpawn = map.spawnPoints.find(p => p.team === team);
  const rendezvous = { x: publicSpawn.x + (team ? -21 : 21), z: -2.5 };
  const retreat = map.spawnPoints.find(p => p.team === enemy);
  const trace = [], samples = [], purchases = [], replacements = new Map(), assignedWood = new Set(), assignedReplacement = new Set();
  const stages = { focusedAttack: null, casualty: null, workerPurchase: null,
    replacementSpawn: null, replacementGather: null, replacementDeposit: null,
    woodGather: null, woodDeposit: null, coldRestart: null };
  let focused = null, casualty = null, focusWitness = null, lossWitness = null,
    replacementDepositWitness = null, woodDepositWitness = null;
  let lastSeen = null, lastSeenWitness = null, nextRaidOrder = 0;
  let restart = false, deadCargo = 0;
  const spent = { food: 0, wood: 0 };
  const order = async (seat, command, policyOrder = false) => {
    const before = r.observe(seat), notices = await r.order(seat, command); r.drain();
    const accepted = !notices.some(n => /REJECTED|FAILED/.test(n.message || ''));
    assert.ok(accepted || policyOrder, JSON.stringify({ command, notices }));
    const after = r.observe(seat), cost = { food: before.food[seat]-after.food[seat], wood: before.wood[seat]-after.wood[seat] };
    trace.push({ tick: before.tick, team: seat, command, notices, cost, accepted,
      ...(policyOrder ? {} : { playerView: before }),
      ...(accepted ? {} : { rejectedView: before }) });
    spent.food += cost.food; spent.wood += cost.wood;
    return { cost, accepted };
  };
  try {
    const military = view(team).units.friendly.filter(u => u.kind !== 'worker' && u.hp > 0);
    await order(team, selected(military, 'setStance', { stance: 'noAttack' }));
    await order(team, selected(military, 'holdPosition'));
    await order(enemy, selected(raiders, 'setStance', { stance: 'noAttack' }));
    await order(enemy, selected(raiders, 'move', rendezvous));
    // A comparable ordinary human loss prelude, as in the existing paid-loss
    // scenarios. Native Workers continue their current jobs; no state is edited.
    for (let step = 0; step < 180*30 && !casualty; step++) {
      if (step%30 === 0) {
        const seen = view(enemy);
        const target = focused ? seen.units.visibleEnemies.find(u => u.id === focused.id
          && u.generation === focused.generation && u.hp > 0)
          : seen.units.visibleEnemies.filter(u => u.kind === 'worker' && u.hp > 0)
            .sort((a,b) => Math.hypot(a.x-rendezvous.x,a.z-rendezvous.z)-Math.hypot(b.x-rendezvous.x,b.z-rendezvous.z) || a.id-b.id)[0];
        if (target) {
          lastSeen = { x: target.x, z: target.z };
          lastSeenWitness = { tick: seen.tick, target, raiderView: r.observe(enemy) };
        }
        if ((target || lastSeen) && step >= nextRaidOrder) {
          const living = seen.units.friendly.filter(u => raiderKeys.has(key(u)) && u.hp > 0);
          assert.ok(living.length);
          if (target) {
            if (!focused) {
              focused = { id: target.id, generation: target.generation };
              focusWitness = lastSeenWitness;
              stages.focusedAttack = seen.tick;
            }
            await order(enemy, selected(living, 'setStance', { stance: 'aggressive' }));
            await order(enemy, selected(living, 'attack', { targetId: target.id, targetGeneration: target.generation }));
          } else {
            // A human can search a last-seen position, but cannot Attack an
            // undisclosed generation. Native fog still controls reacquisition.
            await order(enemy, selected(living, 'move', lastSeen));
            trace.at(-1).searchWitness = lastSeenWitness;
          }
          nextRaidOrder = step + 10*30;
        }
      }
      const before=r.observe(team),checkpoint=r.checkpoint();r.step();const after=r.observe(team);
      const dying=focused && checkpoint.state.units.find(u => u.id===focused.id && u.generation===focused.generation);
      if (dying?.hp>0 && !after.units.some(u => u[0]===dying.id && u[8]===dying.generation && u[4]>0)) {
        casualty={id:dying.id,generation:dying.generation};stages.casualty=after.tick;
        lossWitness={tick:after.tick,worker:dying,before,after};
        deadCargo=dying.cargoType==='wood' ? dying.cargo : 0;
      }
    }
    if (!casualty) {
      const error=new Error('the bounded ordinary raid did not kill a Worker');
      error.details={team,identity,initial,initialViews,rendezvous,focused,focusWitness,trace,
        views:[r.observe(0),r.observe(1)],final:r.checkpoint()};
      throw error;
    }
    assert.equal(lossWitness.worker.workIntent?.kind,'gather');
    assert.equal(lossWitness.worker.workIntent?.resource,'wood');
    assert.equal(lossWitness.worker.workIntent?.sourceKind,'forest-group','the actual casualty interrupts durable forest work');
    const livingRaiders=view(enemy).units.friendly.filter(u => raiderKeys.has(key(u)) && u.hp>0);
    if (livingRaiders.length) {
      await order(enemy,selected(livingRaiders,'setStance',{stance:'noAttack'}));
      await order(enemy,selected(livingRaiders,'move',{x:retreat.x,z:retreat.z}));
    }
    const livingMilitary=view(team).units.friendly.filter(u => u.kind!=='worker' && u.hp>0);
    await order(team,selected(livingMilitary,'setStance',{stance:'aggressive'}));
    const prepared=r.checkpoint(),startTick=view(team).tick,start=[r.observe(0),r.observe(1)];
    assert.equal(view(team).units.friendly.filter(u => u.kind==='worker' && u.hp>0).length,startWorkers-1);
    let policy=createDeterministicPolicy(20260925,identity),shadow=createDeterministicPolicy(20260925,identity);
    const setupTraceLength=trace.length;
    for (let step=0;step<=seconds*30;step++) {
      if (step%30===0) {
        const observation = view(team);
        for (const worker of observation.units.friendly.filter(u => u.kind === 'worker' && u.hp > 0)) {
          if (!originalWorkers.has(key(worker))) {
            replacements.set(worker.id, worker.generation);
            stages.replacementSpawn ??= observation.tick;
          }
        }
        const commands = policy.next(observation);
        assert.deepEqual(commands, shadow.next(structuredClone(observation)));
        if (step < seconds * 30) for (const command of commands) {
          const replacementIds = command.ids?.filter(id => replacements.get(id) === observation.units.friendly.find(u => u.id === id)?.generation) || [];
          const forestGather = command.type === 'gather' && Object.hasOwn(command, 'forestCell');
          const source = forestGather ? { type: 'wood' } : observation.resourceNodes.find(node => node.id===command.nodeId && node.stock>0);
          const gather = command.type==='gather',woodGather=gather && source?.type==='wood';
          if (woodGather && control==='no-new-wood-gather') {
            trace.push({tick:observation.tick,team,suppressed:command});continue;
          }
          if (gather && replacementIds.length && control === 'no-replacement-gather') {
            trace.push({ tick: observation.tick, team, suppressed: { ...command, ids: replacementIds } });
            command.ids = command.ids.filter(id => !replacementIds.includes(id));
            if (!command.ids.length) continue;
          }
          if (forestGather) {
            assert.ok(observation.forestCells.some(tree => tree.cell === command.forestCell && tree.stock > 0));
          }
          if (gather) assert.ok(source,'Gather requires a disclosed positive source');
          const { cost, accepted } = await order(team, command, true);
          if (!accepted) continue;
          if (woodGather) {
            for (const id of command.ids) {
              const worker=observation.units.friendly.find(u=>u.id===id);
              assert.equal(worker.cargo,0,'a new Wood-job witness starts with empty cargo');
              assignedWood.add(key(worker));
            }
            stages.woodGather ??= observation.tick;
          }
          if (gather) {
            const acceptedReplacements=replacementIds.filter(id=>command.ids.includes(id));
            for (const id of acceptedReplacements) assignedReplacement.add(`${id}:${replacements.get(id)}:${source.type}`);
            if (acceptedReplacements.length) stages.replacementGather ??= observation.tick;
          }
          if (command.type === 'trainUnit' && command.kind === 'worker') {
            assert.equal(cost.food, UNIT_DEFINITIONS.worker.cost.food);
            assert.equal(cost.wood, 0);
            purchases.push({ tick: observation.tick, buildingId: command.buildingId, cost });
            stages.workerPurchase ??= observation.tick;
            restart ||= cold && stages.coldRestart === null;
          }
        }
        samples.push([r.observe(0), r.observe(1)]);
      }
      if (restart) {
        const checkpoint = r.checkpoint(), before = [r.observe(0),r.observe(1)];
        const fresh = await createPveHeadlessFixture(map, identity); fresh.replay.restore(checkpoint);
        for (const seat of [0,1]) assertRecoveredWorkerObservation(fresh.replay.observe(seat),before[seat],'paid replacement queue preserves complete both-seat views');
        await fixture.dispose(); fixture=fresh;r=fresh.replay;
        policy=createDeterministicPolicy(20260925,identity);shadow=createDeterministicPolicy(20260925,identity);
        stages.coldRestart=r.observe(team).tick;restart=false;
      }
      if (step < seconds*30) {
        const before=r.observe(team);r.step();const after=r.observe(team);
        const nativeDelivery=(type,eligible)=> {
          const bankIncrease=after[type][team]-before[type][team];
          if (bankIncrease<=0) return null;
          const allDelivered=before.units.filter(u=>u[7]===type && u[6]>0)
            .filter(u=>after.units.some(v=>v[0]===u[0] && v[8]===u[8] && v[6]===0 && v[4]>0));
          const delivered=allDelivered.filter(eligible);
          if (!delivered.length) return null;
          assert.ok(Math.abs(bankIncrease-allDelivered.reduce((sum,u)=>sum+u[6],0))<1e-5,'all simultaneous native credits equal actual living-generation cargo');
          return {tick:after.tick,type,before,after,delivered,allDelivered,bankIncrease,
            qualifiedCargo:delivered.reduce((sum,u)=>sum+u[6],0)};
        };
        if (!replacementDepositWitness) for (const type of ['food','wood']) {
          replacementDepositWitness=nativeDelivery(type,u=>assignedReplacement.has(`${u[0]}:${u[8]}:${type}`));
          if (replacementDepositWitness) {stages.replacementDeposit=after.tick;break;}
        }
        woodDepositWitness ??= nativeDelivery('wood',u=>assignedWood.has(`${u[0]}:${u[8]}`));
        if (woodDepositWitness) stages.woodDeposit ??= woodDepositWitness.tick;
        if (replacementDepositWitness && woodDepositWitness) break;
      }
    }
    const final=r.checkpoint();
    const accountedWood=state => state.teamWood.reduce((sum,bank)=>sum+bank,0)
      + state.resourceNodes.filter(n=>n.type==='wood').reduce((sum,n)=>sum+n.stock,0)
      + state.units.filter(u=>u.hp>0 && u.cargoType==='wood').reduce((sum,u)=>sum+u.cargo,0)
      + state.forestStocks.reduce((sum,[,stock])=>sum+stock-6,0);
    const preludeWoodResidue=accountedWood(initial.state)-accountedWood(prepared.state)-deadCargo;
    const recoveryWoodResidue=accountedWood(prepared.state)-accountedWood(final.state)-spent.wood;
    assert.ok(Math.abs(preludeWoodResidue)<0.0001,'native forest work and actual lost cargo conserve Wood in the human prelude');
    assert.ok(Math.abs(recoveryWoodResidue)<0.0001,'stock/cargo/banks and paid recovery spending conserve Wood');
    return { loop, result: { team,identity,control,cold,seconds,initialTick,initialViews,prepared,startTick,start,
      rendezvous,raiders,stages,focused,casualty,focusWitness,lossWitness,
      startWorkers,setupTraceLength,purchases,replacements:[...replacements],replacementDepositWitness,woodDepositWitness,spent,deadCargo,
      preludeWoodResidue,recoveryWoodResidue,trace,samples,final } };
  } finally { await fixture.dispose(); }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const options=JSON.parse(await readFile(process.argv[3],'utf8'));
  try {
    await writeFile(process.argv[4],JSON.stringify(await replayContestedWood(Number(process.argv[2]),options)));
  } catch (error) {
    if (error.details) await writeFile(process.argv[4],JSON.stringify({error:{message:error.message,details:error.details}}));
    throw error;
  }
}
