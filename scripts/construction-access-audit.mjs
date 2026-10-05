// Real production command/step receipts. This is a focused CPU witness, not a
// rendered game or a whole-route physical pair-avoidance qualification.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { constructionAccessJourney, constructionWorkPoseJourney, constructionRepairAccessJourney } from './construction-access-journeys.mjs';
const root = new URL('..', import.meta.url);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const source = git('rev-parse', 'HEAD'), dirty = Boolean(git('status', '--porcelain'));
const serverSha256 = createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex');
const cases = [];
for (const team of [0, 1]) {
  for (const cold of [false, true]) {
    for (const cooperative of [false, true]) cases.push(await constructionWorkPoseJourney(team, { cold, cooperative }));
    for (const scenario of ['initial-reservation', 'late-reservation']) cases.push(await constructionAccessJourney(team, scenario, { cold }));
  }
  for (const scenario of ['stop', 'holdPosition', 'queuedMove', 'cancelConstruction', 'query-deferred']) {
    cases.push(await constructionAccessJourney(team, scenario, { cold: true }));
  }
  cases.push(await constructionAccessJourney(team, 'initial-reservation', { cold: true, planningTurns: 1 }));
  cases.push(await constructionRepairAccessJourney(team));
  console.log(JSON.stringify({ team, completedCases: cases.length }));
}
const receipt = { source, dirty, serverSha256,
  scope: '30 real production-command construction/access/work-pose/repair journeys; both seats; validated separate-module cold recovery; zero state injection; no rendered or general body-pair claim',
  cases };
await writeFile(process.argv[2] || '/tmp/construction-access-audit.json', JSON.stringify(receipt, null, 2) + '\n');
