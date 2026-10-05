import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { constructionEndpointContract } from './construction-endpoint-contract.mjs';

process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
delete process.env.RTS_MATCH_STATE_PATH;
const output = process.argv[2];
if (!output || process.argv.length !== 3) throw new Error('Usage: node scripts/construction-endpoint-audit.mjs OUTPUT.json');
const cases = [];
for (const team of [0, 1]) {
  for (const direction of ['military-first', 'builder-first']) cases.push({ team, direction });
  for (const parkOrder of ['stop', 'holdPosition']) cases.push({ team, direction: 'builder-first', parkOrder });
}
const results = [];
for (const scenario of cases) results.push(await constructionEndpointContract(scenario));
const evidence = {
  status: 'existing-contract-verified',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
  scope: 'real production command/tick bodies, physical substeps and separate-module checkpoint recovery; no native transport or rendered claim',
  policy: 'new construction avoids accepted military endpoints; already parked Workers retain pose and exact military point/queue until independently commanded departure',
  results,
};
await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ status: evidence.status, source: evidence.sourceRevision,
  cases: results.length, substeps: results.reduce((n, r) => n + r.substeps, 0),
  contacts: results.reduce((n, r) => n + r.contacts, 0) }));
