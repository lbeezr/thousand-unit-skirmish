// Source-side pine pilot sidecar over the retained manifest; no runtime registry.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pilot = 'docs/art-direction/tree-variety-v1/pine-production-contract.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);

export function auditTreePilot({root=repoRoot, contract=null, requireComplete=false}={}) {
  const errors=[];
  const file = relative => {
    if (typeof relative !== 'string' || path.isAbsolute(relative)) throw Error('Expected repository-relative tree path');
    const resolved=realpathSync(path.resolve(root,relative));
    if (!resolved.startsWith(realpathSync(root)+path.sep)) throw Error('Tree path escapes repository');
    return resolved;
  };
  try {
    contract ??= JSON.parse(readFileSync(file(pilot),'utf8'));
    const manifestBytes=readFileSync(file(contract.manifest)), manifest=JSON.parse(manifestBytes);
    const folder=path.posix.dirname(contract.manifest);
    if (contract.schemaVersion !== 1 || contract.assetId !== 'pine' || manifest.name !== 'pine') errors.push('Unsupported tree pilot identity');
    if (sha(manifestBytes) !== contract.identity.manifestSha256) errors.push('Pinned source manifest changed');
    if (contract.identity.style !== 'frontier-meshy-pine-v3' || contract.identity.version !== 1) errors.push('Pinned pine style/version changed');
    if (!same(contract.requiredStates,['full','worked','low','depleted'])
      || !same(contract.requiredYawDegrees,[0,45,90,135,180,225,270,315])) errors.push('Required tree state/yaw coverage changed');
    const expectedMissing=['worked','low','depleted'].flatMap(state=>contract.requiredYawDegrees.map(yaw=>`${state}|${yaw}`));
    if (contract.sourceComplete !== false || !same(contract.missingSourceCells,expectedMissing)) errors.push('Pine has only intact sources; lifecycle cells must remain missing');
    if (manifest.captureMode !== 'model-rotation' || manifest.projection !== 'orthographic'
      || !same(manifest.framePixels,[640,640]) || !same(manifest.anchorPixelFromTopLeft,[320,480])
      || manifest.pixelsPerWorldUnit !== 128 || Math.abs(manifest.elevationDegrees-45.43590248481586)>1e-10
      || manifest.stats.fixedCameraAzimuthDegrees !== 45 || manifest.fitMethod !== 'projected-mesh-vertices'
      || manifest.frames.length !== 8 || new Set(manifest.frames.map(f=>f.sha256)).size !== 8) errors.push('Fixed camera/root/fit or distinct view contract changed');
    if (!same(contract.calibration.canvasPx,manifest.framePixels) || !same(contract.calibration.groundPivotPx,manifest.anchorPixelFromTopLeft)
      || contract.calibration.pixelsPerWorldUnit !== 128 || contract.calibration.perViewRescale !== false
      || contract.calibration.symmetryReuse !== false || contract.calibration.lighting !== manifest.lighting
      || !same(contract.calibration.normalizedSizeWorld,manifest.stats.normalizedSize)
      || contract.calibration.captureMode !== manifest.captureMode || contract.calibration.projection !== manifest.projection
      || contract.calibration.fitMethod !== manifest.fitMethod || contract.calibration.cameraAzimuthDegrees !== 45
      || contract.calibration.cameraElevationDegrees !== manifest.elevationDegrees) errors.push('Sidecar calibration differs from retained capture');
    for (const [field,kind] of [['sources','source'],['approvedRuntimeFiles','runtime']]) {
      const rows=contract.identity[field];
      if (!Array.isArray(rows) || rows.length !== 8) throw Error(`Pine needs eight pinned ${kind} files`);
      for (const [index,row] of rows.entries()) {
        const expected=kind==='source' ? `${folder}/references/frames/color/view-${String(index).padStart(2,'0')}.png`
          : `${folder}/runtime/pine-${String(index).padStart(2,'0')}.webp`;
        if (row.path !== expected || sha(readFileSync(file(row.path))) !== row.sha256) errors.push(`Pinned ${kind} changed: view ${index}`);
        const frame=manifest.frames[index];
        if (frame.index !== index || frame.modelYawDegrees !== index*45 || frame.cameraAzimuthDegrees !== 45
          || kind==='source' && row.sha256 !== frame.sha256) errors.push(`Source view lineage changed: view ${index}`);
      }
    }
    const source=contract.provenance.privateSource;
    if (!same(source.manifestFields,['sourceModel','sourceModelSha256'])
      || source.publication !== 'private' || contract.provenance.meshTask !== manifest.meshTask
      || contract.provenance.remeshTask !== manifest.remeshTask) errors.push('Private model lineage changed');
    if (contract.publication.state !== 'existing-public-runtime-only' || contract.publication.newUploadsAllowed !== false
      || contract.publication.additionalCredits !== 0) errors.push('Pilot cannot authorize new publication or credits');
    if (contract.variation.version !== 1 || !same(contract.variation.key,['terrainSeed','forestCell'])
      || !same(contract.variation.scaleRange,[0.7,1])) errors.push('Saved pine variation contract changed');
    if (contract.integration.status !== 'prepared-unbound' || contract.renderAcceptance.status !== 'blocked'
      || !same(contract.renderAcceptance.evidence,[])) errors.push('Prepared pilot cannot claim runtime/render acceptance');
    const available=existsSync(path.resolve(root,manifest.sourceModel));
    if (available && sha(readFileSync(file(manifest.sourceModel))) !== manifest.sourceModelSha256) errors.push('Private source digest mismatch');
    if (requireComplete) errors.push('Pine pilot lacks 24 same-design lifecycle cells and normal-game acceptance');
    return {scope:'tree-source-contract',assetId:contract.assetId,manifest:contract.manifest,
      authoredCells:8,requiredCells:32,missingSourceCells:expectedMissing,sourceModelAvailable:available,
      missingPrivateSource:available?null:{manifest:contract.manifest,fields:source.manifestFields},publication:contract.publication.state,
      integration:contract.integration.status,renderAcceptance:contract.renderAcceptance.status,errors};
  } catch (error) {
    return {scope:'tree-source-contract',coverage:'unknown',errors:[error.message]};
  }
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if (args.some(arg=>arg!=='--require-complete')) throw Error('Usage: node scripts/tree-art-production-contract.mjs [--require-complete]');
  const report=auditTreePilot({requireComplete:args.includes('--require-complete')});
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.errors.length?1:0;
}
