// Source-production checks supplement the canonical atlas/runtime contracts.
import {createHash} from 'node:crypto';
import {readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSpriteAtlas} from './sprite-atlas-contract.mjs';
import {decodeRgba8} from './sprite-pixel-bounds.mjs';
import {normalRoster} from './audit-asset-adoption.mjs';

export const unitArtDirections=['north','north-east','east','south-east','south','south-west','west','north-west'];
const coreStates=['idle','walk','attack','defeat'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6;
const repoRoot=fileURLToPath(new URL('..',import.meta.url));
const pilot='docs/art-direction/human-roster-v1/infantry-production-contract.json';

function repoFile(root,relative){
  if(typeof relative!=='string'||path.isAbsolute(relative))throw Error('Expected a repository-relative source path');
  const file=realpathSync(path.resolve(root,relative)),base=realpathSync(root)+path.sep;
  if(!file.startsWith(base))throw Error('Source path escapes the repository');
  return file;
}

export function checkUnitClipTiming(spec,sequence){
  const errors=[],durations=sequence.map(s=>s.durationMs),duration=durations.reduce((a,b)=>a+b,0);
  if(!durations.length||durations.some(n=>!Number.isFinite(n)||n<=0))errors.push('frame durations must be positive finite milliseconds');
  if(!close(duration,spec.durationMs))errors.push('clip duration differs from the declared source timing');
  if(spec.mode==='timed-keys'){
    if(spec.sourceFPS!==null)errors.push('explicit timed keys have no intrinsic sampled source FPS');
    if(!equal(durations,spec.frameDurationsMs))errors.push('explicit source key durations changed');
    const uniform=durations.every(n=>close(n,durations[0]));
    if(spec.playbackFPS!==null&&(!uniform||!close(1000/durations[0],spec.playbackFPS)))errors.push('declared playback FPS differs from actual key cadence');
  }else if(spec.mode==='sampled-frames'){
    if(!Number.isFinite(spec.sourceFPS)||spec.sourceFPS<=0||!Number.isFinite(spec.playbackFPS)||spec.playbackFPS<=0)errors.push('source and playback FPS must be positive finite values');
    if(!close(spec.sourceFPS,spec.playbackFPS))errors.push('source/playback FPS mismatch; do not silently play 24 FPS samples at 30 FPS');
    if(sequence.length!==spec.frameCount||!close(duration,1000*spec.frameCount/spec.sourceFPS))errors.push('sample count/FPS duration mismatch');
    if(durations.some(n=>!close(n,1000/spec.playbackFPS)))errors.push('sampled frame duration differs from playback FPS');
  }else errors.push('timing mode must be timed-keys or sampled-frames');
  return errors;
}

// Same registered visible-pixel convention as PR287; all actions are included.
// Invisible RGB, atlas relocation and renamed keys cannot manufacture motion.
export function decodeRegisteredUnitFrames(asset,page,image){
  return Object.fromEntries(asset.frames.map(frame=>{
    const crop=frame.frameRectsPx.find(r=>r.pageId===page.id&&r.layerId==='actor');
    const r=crop.rectPx,o=crop.offsetPx??{x:0,y:0},p=frame.groundPivotPx;
    const x=512+o.x-p.x,y=768+o.y-p.y;
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+r.width>1024||y+r.height>1024)throw Error(`registered audit canvas exceeded: ${frame.id}`);
    const rgba=Buffer.alloc(1024*1024*4),alpha=Buffer.alloc(1024*1024);
    for(let row=0;row<r.height;row++)for(let col=0;col<r.width;col++){
      const src=((r.y+row)*image.width+r.x+col)*4,dst=(y+row)*1024+x+col;
      if(!image.pixels[src+3])continue;
      rgba.set(image.pixels.subarray(src,src+4),dst*4);alpha[dst]=image.pixels[src+3];
    }
    return[frame.id,{rgba:sha(rgba),alpha:sha(alpha)}];
  }));
}

export function analyzeUnitArtCoverage(asset,cells,states=coreStates){
  const clips=new Map(asset.clips.map(c=>[`${c.stateId}|${c.directionId}`,c]));
  const rows=[],errors=[];
  for(const state of states)for(const direction of unitArtDirections){
    const key=`${state}|${direction}`,clip=clips.get(key),idle=clips.get(`idle|${direction}`);
    if(!clip){errors.push(`required clip absent: ${key}`);rows.push({key,status:'missing-clip'});continue;}
    const hashes=clip.sequence.map(s=>cells[s.frameId]?.rgba),silhouettes=clip.sequence.map(s=>cells[s.frameId]?.alpha);
    if(hashes.some(h=>!h))errors.push(`unknown decoded frame in ${key}`);
    const idleHashes=new Set(idle?.sequence.map(s=>cells[s.frameId]?.rgba));
    const fallback=state!=='idle'&&hashes.every(h=>idleHashes.has(h));
    const distinct=new Set(hashes).size,distinctSilhouettes=new Set(silhouettes).size;
    const status=fallback?'idle-fallback':state!=='idle'&&(distinct<2||distinctSilhouettes<2)?'static-action':'authored';
    rows.push({key,state,direction,status,distinctFrames:distinct,distinctSilhouettes,hashes});
  }
  for(const state of states){
    const authored=rows.filter(r=>r.state===state&&r.status==='authored');
    for(const row of authored){
      const others=new Set(authored.filter(r=>r!==row).flatMap(r=>r.hashes));
      if(row.hashes.every(h=>others.has(h))){row.status='borrowed-facing';errors.push(`duplicate/borrowed facing pixels: ${row.key}`);}
    }
  }
  return{rows,errors,missingCells:rows.filter(r=>r.status!=='authored').map(r=>r.key)};
}

async function auditUnitArtProduction({root=repoRoot,contractPath=pilot,contract=null,requireComplete=false}={}){
  contract??=JSON.parse(readFileSync(repoFile(root,contractPath)));
  const sections=['identity','provenance','publication','calibration','integration','renderAcceptance','timing'];
  if(!contract||sections.some(key=>!contract[key]||typeof contract[key]!=='object')||!['requiredStates','requiredDirections','missingSourceCells'].every(key=>Array.isArray(contract[key]))||!['sources','anchors','approvedRuntimeFiles'].every(key=>Array.isArray(contract.identity[key])&&contract.identity[key].length)||!Array.isArray(contract.renderAcceptance.evidence))return{errors:['production contract requires identity/provenance/publication/calibration/integration/timing/render sections, nonempty source/anchor/runtime arrays and matrix/evidence arrays'],missingCells:[],scope:'source-contract'};
  const errors=[],canonical=await validateSpriteAtlas(repoFile(root,contract.manifest));
  if(canonical.errors.length)return{errors:canonical.errors,missingCells:[],scope:'source-contract'};
  const pack=canonical.manifest,asset=pack.assets.find(a=>a.id===contract.assetId),page=pack.pages[0];
  if(!asset)return{errors:['pilot asset absent from manifest'],missingCells:[]};
  if(pack.pages.length!==1||asset.frames.some(f=>!f.frameRectsPx.some(r=>r.pageId===page.id&&r.layerId==='actor')))return{errors:['pilot decoder requires one actor page; extend it explicitly before admitting another layout'],missingCells:[]};
  if(contract.schemaVersion!==1)errors.push('unsupported production contract version');
  if(typeof contract.sourceComplete!=='boolean'||new Set(contract.requiredStates).size!==contract.requiredStates.length)errors.push('sourceComplete must be boolean and required states must be unique');
  if(!equal(contract.requiredDirections,unitArtDirections)||coreStates.some(s=>!contract.requiredStates?.includes(s)))errors.push('required action/direction matrix must retain all core actions and eight headings');
  for(const source of contract.identity.sources){
    if(sha(readFileSync(repoFile(root,source.path)))!==source.sha256)errors.push(`approved identity/source hash changed: ${source.path}`);
  }
  const approvedFiles=contract.identity.approvedRuntimeFiles??[];
  for(const file of pack.files.filter(f=>['runtime','team-mask'].includes(f.usage))){
    const relative=path.posix.join(path.posix.dirname(contract.manifest),file.path);
    const approved=approvedFiles.find(f=>f.path===relative);
    if(!approved||sha(readFileSync(repoFile(root,relative)))!==approved.sha256)errors.push(`approved runtime bytes changed or unpinned: ${relative}`);
  }
  if(contract.identity.rebuildPolicy!=='explicit-reviewed-revision'||!contract.identity.style?.id||!contract.identity.style?.version)errors.push('approved identity needs versioned style and explicit reviewed replacement');
  if(!contract.provenance?.sourceRecord||!contract.provenance?.version||!['unknown','documented'].includes(contract.provenance?.trainingPermission))errors.push('source provenance/version and independent training-permission status are required');
  if(contract.provenance.trainingPermission==='documented'){
    const receipt=contract.provenance.trainingPermissionReceipt;
    if(!receipt?.path||!receipt.sha256)errors.push('documented training permission requires a retained hashed receipt');
    else if(sha(readFileSync(repoFile(root,receipt.path)))!==receipt.sha256)errors.push('training-permission receipt hash changed');
  }
  if(contract.publication?.state!=='existing-public-runtime-only'||contract.publication?.newUploadsAuthorized!==false)errors.push('this pilot only authorizes already-public runtime reuse, with no new uploads');
  const runtimeFile=pack.files.find(f=>f.id===page.runtimeFileId);
  const image=decodeRgba8(readFileSync(path.join(path.dirname(repoFile(root,contract.manifest)),runtimeFile.path)));
  const cells=decodeRegisteredUnitFrames(asset,page,image);
  for(const anchor of contract.identity.anchors)if(cells[anchor.frameId]?.rgba!==anchor.rgbaSha256)errors.push(`established identity anchor changed: ${anchor.frameId}`);
  const pixels=asset.frames.map(f=>({id:f.id,...cells[f.id]}));
  if(sha(JSON.stringify(pixels))!==contract.identity.registeredFramesSha256)errors.push('registered source pixels changed; crop relocation must preserve complete poses');
  const coverage=analyzeUnitArtCoverage(asset,cells,contract.requiredStates);errors.push(...coverage.errors);
  if(!equal([...coverage.missingCells].sort(),[...contract.missingSourceCells].sort()))errors.push('declared missing source cells differ from decoded action coverage');
  if((requireComplete||contract.sourceComplete)&&coverage.missingCells.length)errors.push(`source completion cannot be claimed: ${coverage.missingCells.length} action/heading cells missing`);
  for(const row of coverage.rows.filter(r=>r.status==='authored')){
    const clip=asset.clips.find(c=>`${c.stateId}|${c.directionId}`===row.key);
    const spec=contract.timing[row.state]?.directions?.[row.direction]??contract.timing[row.state];
    if(!spec)errors.push(`source timing absent: ${row.state}`);
    else errors.push(...checkUnitClipTiming(spec,clip.sequence).map(e=>`${row.key}: ${e}`));
  }
  const worldPerPixel=asset.heightWorld/Math.max(...asset.frames.map(f=>f.alphaBoundsPx?.height||f.canvasPx.height));
  if(!Number.isFinite(contract.calibration.worldPerPixel)||Math.abs(worldPerPixel-contract.calibration.worldPerPixel)>1e-12)errors.push('world-per-pixel calibration changed; do not fit equipment or individual poses');
  const registration=asset.frames.map(f=>({id:f.id,pivot:f.groundPivotPx,canvas:f.canvasPx,crops:f.frameRectsPx.map(r=>({layer:r.layerId,offset:r.offsetPx??{x:0,y:0},size:{width:r.rectPx.width,height:r.rectPx.height}}))}));
  if(sha(JSON.stringify(registration))!==contract.calibration.registrationSha256)errors.push('registered pivots/canvas/offsets changed');
  if(!['prompt-only','unknown','verified'].includes(contract.calibration.cameraStatus))errors.push('camera status must be prompt-only, unknown or verified');
  if(contract.calibration.cameraStatus==='verified'){
    const recipe=contract.calibration.cameraRecipe;
    if(!recipe?.path||!recipe.sha256)errors.push('verified camera requires an exact retained recipe with path/hash');
    else if(sha(readFileSync(repoFile(root,recipe.path)))!==recipe.sha256)errors.push('retained camera recipe hash changed');
  }
  if(contract.calibration.pivotStatus==='reviewed'&&asset.frames.some(f=>f.groundPivotStatus!=='reviewed'))errors.push('pivot acceptance cannot exceed actual frame review');
  const versions=normalRoster(readFileSync(path.join(root,'src/main.js'),'utf8')).unitSpritePreviewVersions;
  if(versions[contract.assetId]!==contract.integration.runtimeVersion)errors.push('ordinary roster does not bind the declared identity/version');
  if(!equal(contract.renderAcceptance.requiredScenes,['normal-zoom','crowded-scene']))errors.push('normal-zoom and crowded-scene acceptance are required');
  if(!['pending','accepted'].includes(contract.renderAcceptance.status))errors.push('render acceptance status must be pending or accepted');
  if(contract.renderAcceptance.status==='accepted'){
    for(const kind of contract.renderAcceptance.requiredScenes){
      const evidence=contract.renderAcceptance.evidence.find(e=>e.kind===kind);
      if(!evidence||evidence.normalEntry!==true||evidence.webgl2!==true||!['Chromium/CDP','Firefox','Safari/WebKit','native-WebGL2'].includes(evidence.backend)||!/^[a-f0-9]{40}$/.test(evidence.sourceRevision)||evidence.servedRevision!==evidence.sourceRevision||evidence.runtimeVersion!==contract.integration.runtimeVersion)errors.push(`identified ordinary-game render evidence missing: ${kind}`);
      else if(sha(readFileSync(repoFile(root,evidence.path)))!==evidence.sha256)errors.push(`render evidence hash changed: ${kind}`);
    }
  }
  return{scope:'source-identity-matrix-timing-calibration-and-binding',assetId:asset.id,manifest:contract.manifest,packVersion:pack.packVersion,identity:{status:contract.identity.status,style:contract.identity.style,rebuildPolicy:contract.identity.rebuildPolicy},provenance:contract.provenance,publication:contract.publication,integration:contract.integration,errors,requiredCells:coverage.rows.length,authoredCells:coverage.rows.length-coverage.missingCells.length,missingCells:coverage.missingCells,worldPerPixel,normalBinding:versions[contract.assetId],renderAcceptance:contract.renderAcceptance.status,rows:coverage.rows.map(({hashes,...row})=>row)};
}

// A catalog must receive an invalid audit result rather than crash on a stale
// path or malformed sidecar. An empty missingCells list with errors is unknown
// coverage, never a completion result.
export async function validateUnitArtProduction(options={}){
  try{return await auditUnitArtProduction(options);}
  catch(error){return{scope:'source-contract',errors:[`production contract could not be audited: ${error.message}`],missingCells:[]};}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2);
    if(args.some(a=>a.startsWith('--')&&a!=='--require-complete')||args.filter(a=>!a.startsWith('--')).length>1)throw Error('Usage: node scripts/unit-art-production-contract.mjs [contract.json] [--require-complete]');
    const report=await validateUnitArtProduction({contractPath:args.find(a=>!a.startsWith('--'))??pilot,requireComplete:args.includes('--require-complete')});
    console.log(JSON.stringify(report,null,2));process.exitCode=report.errors.length?1:0;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
