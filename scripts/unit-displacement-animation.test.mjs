import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
test('CPU temporal integration and fault controls require neither a browser nor Python', { timeout: 120000 }, async t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'rts-temporal-ci-'));
  try {
    for (const [name, failures] of [['positive', 0], ['frozen-clock', 96], ['wrong-heading', 84], ['duplicate-cells', 84]]) {
      await t.test(name, () => {
        const output = path.join(directory, name);
        const run = spawnSync(process.execPath, ['scripts/unit-displacement-animation-scenario.mjs',
          `--output=${output}`, ...(name === 'positive' ? [] : [`--negative=${name}`])],
        { cwd: root, encoding: 'utf8', timeout: 25000 });
        assert.ifError(run.error);
        assert.equal(run.status, failures ? 1 : 0, run.stderr + run.stdout);
        const report = JSON.parse(readFileSync(path.join(output, 'checks.json')));
        assert.equal(report.rendered, false);
        assert.equal(report.rows.length, 96);
        assert.equal(report.failures.length, failures, 'fault detection cannot silently regress');
        if (!failures) {
          assert.equal(report.missingArt.length, 3, 'actual default Infantry missing gait remains explicitly incomplete');
          assert.deepEqual(report.authoredWalkHeadings,{human:8,infantry:5,spearman:8});
          assert.deepEqual(report.missingArt.map(m=>[m.role,m.direction]),['south-west','west','north-west'].map(h=>['infantry',h]));
          assert.ok(report.rows.filter(r=>r.role==='infantry'&&['north-east','east','north','south'].includes(r.requestedHeading))
            .every(r=>r.distinctFrameKeys===4&&r.distinctVisibleCells===4&&r.distinctSilhouettes===4));
          assert.ok(report.rows.filter(r => r.role === 'human' || r.requestedHeading === 'south-east')
            .every(r => r.distinctFrameKeys === 8 && r.distinctVisibleCells === 8 && r.distinctSilhouettes === 8));
        } else {
          const assertion = name === 'frozen-clock' ? /timeline phase|fresh clock/
            : name === 'wrong-heading' ? /UV cell must face actual bearing/ : /duplicate\/static source pixels/;
          assert.ok(report.failures.every(f => assertion.test(f.error)), 'fail for the intended animation fault');
        }
      });
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
