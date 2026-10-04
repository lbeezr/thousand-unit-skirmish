import assert from 'node:assert/strict';
import test from 'node:test';
import { visionIndexWitness, gridCosts, runGridCostAudit } from './map-grid-cost-audit.mjs';
import './xl-map-boundary-audit.test.mjs';

test('256-cell-side coverage indices survive; 320 cell indices wrap under the historical 16-bit storage contract', () => {
  assert.deepEqual(visionIndexWitness(256), { index: 65535, stored: 65535, wraps: false });
  assert.deepEqual(visionIndexWitness(320), { index: 102399, stored: 36863, wraps: true });
  assert.deepEqual(visionIndexWitness(320, 32), { index: 102399, stored: 102399, wraps: false });
});
test('fog packing, checkpoint base64 and geometry grow with area without a capacity claim', () => {
  const model = { bucketSide: 1.2, residentBytesPerCell: 66, bucketBytes: 32, attackFlowLimit: 8,
    sights: [8, 10, 11], highGroundBonus: 1, visionIndexBits: 16, validatorMaxSide: 256, snapshotHz: 10 };
  const small = gridCosts(192, model), xl = gridCosts(320, model);
  assert.equal(small.fogPerSeat.packedBytes, 9216); assert.equal(xl.fogPerSeat.packedBytes, 25600);
  assert.equal(xl.fogPerSeat.base64Characters, 34136); assert.equal(xl.checkpointExploredBase64CharactersTwoSeats, 273072);
  assert.equal(xl.raisedGroundBaseGeometry.attributeAndIndexBytes, 22118400);
  assert.equal(xl.areaFactorVs256, 1.5625); assert.equal(xl.heuristicFitsUint16, true);
  assert.equal(gridCosts(384, model).heuristicFitsUint16, false);
  assert.equal(xl.validatorAllows, false); assert.throws(() => gridCosts(15, model), RangeError);
});
test('source-bound allocation accounting records provenance and retains XL rejection', async () => {
  const report = await runGridCostAudit();
  assert.equal(report.model.residentBytesPerCell, 66); assert.equal(report.model.bucketBytes, 32);
  assert.equal(report.model.visionIndexBits, 32);
  assert.equal(report.model.visionCache.maxBytes, 8388608);
  assert.equal(report.model.visionCache.maxEntries, 8192);
  assert.deepEqual(report.model.visionCache.coverageArrays, ['visible', 'fringe']); assert.equal(report.xlAdmitted, false);
  assert.equal(report.grids.at(-1).visionIndexWitness.wraps, false);
  assert.equal(report.grids.at(-1).visionCoverageRetainedPayloadBytesLimit, 8388608);
  assert.equal(report.schemaVersion, 2);
  assert.match(report.sourceInputSha256['server.mjs'], /^[a-f0-9]{64}$/);
});
