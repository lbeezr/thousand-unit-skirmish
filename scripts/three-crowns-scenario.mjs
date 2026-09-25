import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const winnerTeam = Number(process.argv[2] ?? 0);
assert.ok([0, 1].includes(winnerTeam), 'pass the expected winner team as 0 or 1');
const loserTeam = 1 - winnerTeam;
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'three-crowns-playthrough-'));
const portListener = createServer();
portListener.listen(Number(process.argv[3] || 0), '127.0.0.1');
await once(portListener, 'listening');
const port = portListener.address().port;
await new Promise((resolve, reject) => portListener.close(error => error ? reject(error) : resolve()));
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), RTS_HOST: '127.0.0.1', RTS_MAP: 'maps/three-crowns.json',
    RTS_MATCH_STATE_PATH: path.join(tempRoot, 'match.json'), RTS_CUSTOM_MAP_DIRECTORY: path.join(tempRoot, 'maps') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stdout.on('data', chunk => { log += chunk.toString(); });
child.stderr.on('data', chunk => { log += chunk.toString(); });
const clients = [];
let stage = 'starting isolated Three Crowns match';

function createClient(team) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1']);
  const client = { socket, team, messages: [], states: [], waiters: [] };
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    client.messages.push(message);
    const state = message.type === 'state' ? message
      : ['welcome', 'mapChange'].includes(message.type) ? message.state : null;
    if (!state) return;
    client.states.push(state);
    for (let i = client.waiters.length - 1; i >= 0; i--) {
      const waiter = client.waiters[i];
      if (!waiter.predicate(state)) continue;
      client.waiters.splice(i, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(state);
    }
  });
  client.welcome = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('welcome timed out')), 12000);
    socket.addEventListener('message', event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'welcome') { clearTimeout(timer); resolve(message); }
      } catch {}
    });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket failed')); });
  });
  client.waitState = (predicate, timeoutMs = 90000) => {
    const existing = [...client.states].reverse().find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timeout: setTimeout(() => {
        client.waiters.splice(client.waiters.indexOf(waiter), 1);
        reject(new Error(`state timeout for team ${client.team}`));
      }, timeoutMs) };
      client.waiters.push(waiter);
    });
  };
  client.waitNextState = (predicate, timeoutMs = 12000) => new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, timeout: setTimeout(() => {
      client.waiters.splice(client.waiters.indexOf(waiter), 1);
      reject(new Error(`new state timeout for team ${client.team}`));
    }, timeoutMs) };
    client.waiters.push(waiter);
  });
  clients.push(client);
  return client;
}

const objective = (state, id) => state.objectives.find(row => row.id === id);
const move = (client, ids, x, z) => client.socket.send(JSON.stringify({ type: 'move', ids, x, z }));
function nearestIds(state, team, x, z, count, exclude = new Set()) {
  return state.units.filter(row => row[1] === team && row[4] > 0 && !exclude.has(row[0]))
    .sort((a, b) => Math.hypot(a[2] - x, a[3] - z) - Math.hypot(b[2] - x, b[3] - z))
    .slice(0, count).map(row => row[0]);
}
const logStep = name => console.log(JSON.stringify({ stage: name }));
const flank = winnerTeam === 0
  ? { winner: { id: 'north-crown', x: 0, z: -20 }, loser: { id: 'south-crown', x: 0, z: 20 } }
  : { winner: { id: 'south-crown', x: 0, z: 20 }, loser: { id: 'north-crown', x: 0, z: -20 } };

try {
  const healthDeadline = Date.now() + 15000;
  let healthy = false;
  while (Date.now() < healthDeadline) {
    if (child.exitCode !== null) throw new Error(`server exited: ${log}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) { healthy = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, `server health timed out: ${log}`);
  stage = 'joining both player seats';
  const azure = createClient(0);
  const azureWelcome = await azure.welcome;
  assert.equal(azureWelcome.player.team, 0);
  const ember = createClient(1);
  const emberWelcome = await ember.welcome;
  assert.equal(emberWelcome.player.team, 1);
  assert.equal(azureWelcome.map.id, 'three-crowns');
  assert.equal(emberWelcome.map.id, 'three-crowns');
  assert.equal(azureWelcome.state.armySize, 1000);
  assert.equal(emberWelcome.state.armySize, 1000);
  const clientsByTeam = [azure, ember];
  const welcomesByTeam = [azureWelcome, emberWelcome];
  const winnerClient = clientsByTeam[winnerTeam];
  const loserClient = clientsByTeam[loserTeam];
  const winnerUnits = nearestIds(welcomesByTeam[winnerTeam].state, winnerTeam,
    flank.winner.x, flank.winner.z, 8);
  const loserUnits = nearestIds(welcomesByTeam[loserTeam].state, loserTeam,
    flank.loser.x, flank.loser.z, 8);
  assert.equal(winnerUnits.length, 8);
  assert.equal(loserUnits.length, 8);

  stage = 'capturing opposite flank objectives';
  const winnerFlankCaptured = winnerClient.waitState(state => objective(state, flank.winner.id)?.owner === winnerTeam);
  const loserFlankCaptured = loserClient.waitState(state => objective(state, flank.loser.id)?.owner === loserTeam);
  move(winnerClient, winnerUnits, flank.winner.x, flank.winner.z);
  move(loserClient, loserUnits, flank.loser.x, flank.loser.z);
  await Promise.all([winnerFlankCaptured, loserFlankCaptured]);
  const opposingOwners = await Promise.all([
    azure.waitState(state => objective(state, flank.winner.id)?.owner === winnerTeam
      && objective(state, flank.loser.id)?.owner === loserTeam),
    ember.waitState(state => objective(state, flank.winner.id)?.owner === winnerTeam
      && objective(state, flank.loser.id)?.owner === loserTeam),
  ]);
  assert.ok(opposingOwners.every(state => objective(state, 'heartland-keep')?.owner === -1));
  logStep(`Team ${winnerTeam} owns ${flank.winner.id}; Team ${loserTeam} owns ${flank.loser.id}; keep remains neutral`);

  stage = 'attempting the gated keep before prerequisites are united';
  const winnerKeepUnits = nearestIds(winnerClient.states.at(-1), winnerTeam, 0, 0, 8, new Set(winnerUnits));
  assert.equal(winnerKeepUnits.length, 8);
  const beforeKeepOrder = winnerClient.states.length;
  move(winnerClient, winnerUnits, 0, 0);
  const gatedPresence = await winnerClient.waitState(state => objective(state, 'heartland-keep')?.unitCounts?.[winnerTeam] >= 8
    && objective(state, 'heartland-keep')?.requiredOwners?.[0] === objective(state, 'north-crown')?.owner
    && objective(state, 'heartland-keep')?.requiredOwners?.[1] === objective(state, 'south-crown')?.owner
    && objective(state, 'north-crown')?.owner !== objective(state, 'south-crown')?.owner);
  const gatedTick = gatedPresence.tick;
  await new Promise(resolve => setTimeout(resolve, 1500));
  const gatedSnapshots = winnerClient.states.filter(state => state.tick >= gatedTick
    && objective(state, 'heartland-keep')?.unitCounts?.[winnerTeam] >= 8);
  assert.ok(winnerClient.states.length > beforeKeepOrder);
  assert.ok(gatedSnapshots.length >= 8, `expected repeated keep states, saw ${gatedSnapshots.length}`);
  assert.ok(gatedSnapshots.every(state => {
    const keep = objective(state, 'heartland-keep');
    return keep.owner === -1 && keep.progressTeam === -1 && keep.progress === 0;
  }), `keep must not progress while Team ${loserTeam} owns one required flank`);
  logStep(`keep stayed locked for ${gatedSnapshots.length} snapshots with Team ${winnerTeam} units inside`);

  stage = `withdrawing Team ${loserTeam} and recapturing its flank`;
  const loserClearedFlank = loserClient.waitState(state => objective(state, flank.loser.id)?.unitCounts?.[loserTeam] === 0);
  move(loserClient, loserUnits, loserTeam === 0 ? -24 : 24, 0);
  await loserClearedFlank;
  const loserFlankRecaptured = Promise.all([
    azure.waitState(state => objective(state, flank.loser.id)?.owner === winnerTeam),
    ember.waitState(state => objective(state, flank.loser.id)?.owner === winnerTeam),
  ]);
  move(winnerClient, winnerUnits, flank.loser.x, flank.loser.z);
  await loserFlankRecaptured;
  logStep(`Team ${winnerTeam} retook ${flank.loser.id}; both prerequisite owners match`);

  stage = 'capturing the now-unlocked keep and resolving all-objectives victory';
  const azureVictory = azure.waitState(state => state.winner === winnerTeam
    && state.winnerTriggerId === 'heartland-keep' && state.winnerReason === 'capture');
  const emberVictory = ember.waitState(state => state.winner === winnerTeam
    && state.winnerTriggerId === 'heartland-keep' && state.winnerReason === 'capture');
  move(winnerClient, winnerKeepUnits, 0, 0);
  const [finalAzure, finalEmber] = await Promise.all([azureVictory, emberVictory]);
  for (const state of [finalAzure, finalEmber]) {
    assert.deepEqual(state.objectives.filter(row => row.victory).map(row => row.owner),
      Array(3).fill(winnerTeam));
  }
  stage = 'resetting the completed match for both player seats';
  const resetStates = [azure, ember].map(client => client.waitNextState(state => (
    state.mapId === 'three-crowns' && state.winner === -1
      && state.objectives.filter(row => row.victory).every(row => row.owner === -1)
  )));
  azure.socket.send(JSON.stringify({ type: 'reset' }));
  const [resetAzure, resetEmber] = await Promise.all(resetStates);
  for (const [team, state] of [resetAzure, resetEmber].entries()) {
    assert.equal(state.armySize, 1000, 'rematch must restore the selected army size');
    assert.equal(state.alive[team], 500, 'rematch must restore the player army');
    assert.equal(state.alive[1 - team], null, 'fog must keep the opponent roster private');
    assert.equal(state.winnerReason, null, 'rematch must clear the victory reason');
  }
  console.log(JSON.stringify({
    map: 'three-crowns', roster: finalAzure.armySize, testedWinner: winnerTeam,
    oppositeFlanks: [winnerTeam, loserTeam], lockedKeepSnapshots: gatedSnapshots.length,
    finalOwners: finalAzure.objectives.filter(row => row.victory).map(row => row.owner),
    winner: finalAzure.winner, winnerTriggerId: finalAzure.winnerTriggerId,
    winnerReason: finalAzure.winnerReason, rematchReset: 'both seats restored',
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ stage, error: error.message, log,
    latest: clients.map(client => ({ team: client.team, tick: client.states.at(-1)?.tick,
      winner: client.states.at(-1)?.winner,
      objectives: client.states.at(-1)?.objectives?.map(row => ({ id: row.id, owner: row.owner,
        progressTeam: row.progressTeam, progress: row.progress, unitCounts: row.unitCounts,
        requiredOwners: row.requiredOwners })) })) }, null, 2));
  process.exitCode = 1;
} finally {
  for (const client of clients) { try { client.socket.close(); } catch {} }
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 2500))]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await rm(tempRoot, { recursive: true, force: true });
}
