import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = process.env.RTS_SERVER_ROOT || root;
const mapPath = path.resolve(serverRoot, process.env.RTS_SQUAD_MAP || 'maps/forked-vale.json');
// Set this to the exact Git SHA of the server source before running the scenario.
const baselineCommit = process.env.RTS_BASELINE_COMMIT?.trim() || '';
if (!/^[0-9a-f]{40,64}$/i.test(baselineCommit)) {
  throw new Error('RTS_BASELINE_COMMIT must be the full 40- or 64-character server-source Git SHA.');
}
function cleanCheckoutCommit(directory, label) {
  let commit;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: directory,
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    throw new Error(`${label} must be a Git checkout: ${error.message}`);
  }
  const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: directory,
    encoding: 'utf8',
  }).trim();
  if (changes) throw new Error(`${label} has changes; evidence requires a clean checkout:\n${changes}`);
  return commit;
}
const harnessCommit = cleanCheckoutCommit(root, 'Scenario harness checkout');
const checkoutCommit = cleanCheckoutCommit(serverRoot, 'RTS_SERVER_ROOT');
if (checkoutCommit.toLowerCase() !== baselineCommit.toLowerCase()) {
  throw new Error(`RTS_BASELINE_COMMIT ${baselineCommit} does not match RTS_SERVER_ROOT HEAD ${checkoutCommit}.`);
}
const relativeMapPath = path.relative(serverRoot, mapPath);
if (!relativeMapPath || relativeMapPath === '..' || relativeMapPath.startsWith(`..${path.sep}`)
  || path.isAbsolute(relativeMapPath)) {
  throw new Error('RTS_SQUAD_MAP must resolve to a map inside RTS_SERVER_ROOT.');
}
try {
  execFileSync('git', ['ls-files', '--error-unmatch', '--', relativeMapPath], {
    cwd: serverRoot,
    encoding: 'utf8',
  });
} catch {
  throw new Error(`RTS_SQUAD_MAP must name a tracked baseline file: ${relativeMapPath}`);
}
const mapSourceBytes = await readFile(mapPath);
const mapSourceText = mapSourceBytes.toString('utf8');
const mapSourceSha256 = createHash('sha256').update(mapSourceBytes).digest('hex');
const scenario = {
  map: relativeMapPath,
  mapSourceSha256,
  startingArmySize: 24,
  squadSize: 4,
  fogOfWar: false,
};
const runtime = { node: process.version, platform: process.platform, arch: process.arch };
const temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-worker-squad-'));
const listener = createServer();
listener.listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: serverRoot,
  env: {
    ...process.env,
    PORT: String(port),
    RTS_HOST: '127.0.0.1',
    RTS_MAP: relativeMapPath,
    RTS_MATCH_STATE_PATH: path.join(temporary, 'checkpoint.json'),
    RTS_CUSTOM_MAP_DIRECTORY: path.join(temporary, 'custom-maps'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk.toString(); });
server.stderr.on('data', chunk => { serverLog += chunk.toString(); });
const clients = [];
const single = process.argv.includes('--single');
const expectedCaseCount = single ? 1 : 8;
const results = [];

async function connect() {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1']);
  const messages = [];
  const waiters = [];
  const client = {
    socket,
    messages,
    send(command) { socket.send(JSON.stringify(command)); },
    waitFor(predicate, after = 0, timeoutMs = 60_000) {
      const found = messages.slice(after).find(predicate);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          after,
          resolve,
          timeout: setTimeout(() => {
            waiters.splice(waiters.indexOf(waiter), 1);
            reject(new Error(`message timeout: ${JSON.stringify(messages.slice(-3))}`));
          }, timeoutMs),
        };
        waiters.push(waiter);
      });
    },
  };
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    messages.push(message);
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      if (messages.length <= waiter.after || !waiter.predicate(message)) continue;
      waiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  clients.push(client);
  const welcome = await client.waitFor(message => message.type === 'welcome');
  client.team = welcome.player.team;
  return client;
}

function latestState(client) {
  const recent = [...client.messages].reverse().find(message =>
    message.type === 'state' || message.type === 'mapChange');
  return recent?.type === 'mapChange' ? recent.state : recent;
}

function group(state, team, kind) {
  return state.units.filter(row => row[1] === team && row[5] === kind);
}

try {
  const healthDeadline = Date.now() + 15_000;
  let healthy = false;
  while (Date.now() < healthDeadline) {
    if (server.exitCode !== null) throw new Error(`server exited: ${serverLog}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) {
        healthy = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, `server did not become healthy: ${serverLog}`);
  console.error('local server healthy');

  const azure = await connect();
  const ember = await connect();
  assert.equal(azure.team, 0);
  assert.equal(ember.team, 1);
  console.error('both seats connected');
  const clientsByTeam = [azure, ember];
  const template = JSON.parse(mapSourceText);

  async function fight(teamZeroX, workerTeam, commandOrder) {
    const state = latestState(azure);
    const infantryTeam = 1 - workerTeam;
    const participants = [
      { team: workerTeam, kind: 'worker', units: group(state, workerTeam, 'worker') },
      { team: infantryTeam, kind: 'infantry', units: group(state, infantryTeam, 'infantry') },
    ];
    assert.deepEqual(participants.map(row => row.units.length), [4, 4]);

    const parking = [0, 1].map(team => ({
      team,
      units: state.units.filter(row => row[1] === team && !participants.some(groupRow =>
        groupRow.team === team && groupRow.units.some(participant => participant[0] === row[0]))),
      x: team === 0 ? Math.sign(teamZeroX) * 25 : -Math.sign(teamZeroX) * 25,
      z: team === 0 ? 15 : -15,
    }));
    assert.deepEqual(parking.map(row => row.units.length), [8, 8]);
    const parkAfter = azure.messages.length;
    for (const groupRow of parking) {
      clientsByTeam[groupRow.team].send({
        type: 'move', ids: groupRow.units.map(row => row[0]), x: groupRow.x, z: groupRow.z,
      });
    }
    const parked = await azure.waitFor(message => message.type === 'state'
      && parking.every(groupRow => groupRow.units.every(row => {
        const unit = message.units.find(candidate => candidate[0] === row[0]);
        return unit && Math.hypot(unit[2] - groupRow.x, unit[3] - groupRow.z) < 3;
      })), parkAfter, 30_000);
    console.error(`parked noncombat units for worker team ${workerTeam}, spawn ${teamZeroX < 0 ? 'left' : 'right'}`);

    const battleAfter = azure.messages.length;
    for (const team of commandOrder) {
      const participant = participants.find(row => row.team === team);
      clientsByTeam[team].send({
        type: 'attackMove', ids: participant.units.map(row => row[0]), x: 0, z: 0,
      });
    }
    const resolved = await azure.waitFor(message => message.type === 'state'
      && participants.some(participant => group(message, participant.team, participant.kind)
        .filter(row => row[4] > 0).length === 0), battleAfter, 30_000);

    const combatGroups = participants.map(participant => {
      const units = group(resolved, participant.team, participant.kind);
      return {
        team: participant.team,
        kind: participant.kind,
        survivors: units.filter(row => row[4] > 0).length,
        remainingHp: units.reduce((sum, row) => sum + row[4], 0),
      };
    });
    const workerResult = combatGroups.find(row => row.kind === 'worker');
    const infantryResult = combatGroups.find(row => row.kind === 'infantry');
    const result = {
      teamZeroSpawnSide: teamZeroX < 0 ? 'left' : 'right',
      workerTeam,
      infantryTeam,
      commandOrder,
      battleSeconds: Number((resolved.matchElapsedSeconds - parked.matchElapsedSeconds).toFixed(1)),
      groups: combatGroups,
      winner: workerResult.remainingHp > 0 ? 'worker'
        : infantryResult.remainingHp > 0 ? 'infantry' : 'draw',
    };
    results.push(result);
    assert.ok(workerResult.remainingHp < 400 && infantryResult.remainingHp < 400,
      `both groups should take damage: ${JSON.stringify(result)}`);
    assert.equal(result.winner, 'infantry',
      `four workers should lose the equal-count, equal-cost fight: ${JSON.stringify(result)}`);
    console.error(`squad result ${results.length}/${expectedCaseCount}: ${JSON.stringify(result)}`);
  }

  const orientations = single ? [-8] : [-8, 8];
  for (const [orientationIndex, teamZeroX] of orientations.entries()) {
    const map = structuredClone(template);
    map.id = teamZeroX < 0 ? 'worker-squad-left' : 'worker-squad-right';
    map.name = teamZeroX < 0 ? 'WORKER SQUAD LEFT' : 'WORKER SQUAD RIGHT';
    map.fogOfWar = false;
    // Forked Vale gives each team four workers and eight infantry; both types cost 50 food.
    map.startingArmySize = 24;
    map.spawnPoints = [
      { team: 0, x: teamZeroX, z: 0 },
      { team: 1, x: -teamZeroX, z: 0 },
    ];
    const publishAfter = clientsByTeam.map(client => client.messages.length);
    azure.send({ type: 'publishMap', map });
    const [azureMap] = await Promise.all(clientsByTeam.map((client, team) => client.waitFor(
      message => message.type === 'mapChange' && message.map?.id === map.id,
      publishAfter[team])));
    assert.equal(azureMap.state.armySize, 24);

    const commandOrders = single ? [[0, 1]] : [[0, 1], [1, 0]];
    const workerTeams = single ? [0] : orientationIndex === 0 ? [0, 1] : [1, 0];
    for (const workerTeam of workerTeams) {
      for (const commandOrder of commandOrders) {
        if (results.length > 0) {
          const resetAfter = azure.messages.length;
          azure.send({ type: 'reset' });
          await azure.waitFor(message => message.type === 'state' && message.mapId === map.id
            && message.armySize === 24 && message.units.every(row => row[4] === 100), resetAfter);
        }
        await fight(teamZeroX, workerTeam, commandOrder);
      }
    }
  }

  console.log(JSON.stringify({
    event: 'complete',
    baselineCommit,
    harnessCommit,
    scenario,
    runtime,
    results,
  }));
} catch (error) {
  console.error(serverLog);
  console.log(JSON.stringify({
    event: 'failed',
    baselineCommit,
    harnessCommit,
    scenario,
    runtime,
    completedResults: results,
    error: error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: typeof error, message: String(error) },
    serverLog,
  }));
  throw error;
} finally {
  for (const client of clients) client.socket.close();
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
  }
  await rm(temporary, { recursive: true, force: true });
}
