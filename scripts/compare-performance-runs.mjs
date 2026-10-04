#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { comparePerformanceReports } from './performance-run-evidence.mjs';

const [baselinePath, candidatePath, baselineSource, candidateSource, ...extra] = process.argv.slice(2);
if (!baselinePath || !candidatePath || !/^[0-9a-f]{40}$/.test(baselineSource ?? '')
  || !/^[0-9a-f]{40}$/.test(candidateSource ?? '') || extra.length) {
  console.error('Usage: node scripts/compare-performance-runs.mjs BASELINE.json CANDIDATE.json BASELINE_SHA CANDIDATE_SHA');
  process.exitCode = 2;
} else {
  try {
    const reports = await Promise.all([baselinePath, candidatePath].map(async filename => JSON.parse(await readFile(filename, 'utf8'))));
    const comparison = comparePerformanceReports(...reports, [baselineSource, candidateSource]);
    console.log(JSON.stringify(comparison, null, 2));
    process.exitCode = comparison.status === 'comparable-diagnostics' ? 0 : 3;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
