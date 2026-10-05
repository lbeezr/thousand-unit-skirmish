import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

// Read-only synthetic boundary witness. Run from the repository root. This
// executes the production publisher without admitting a map or changing it.
const root=process.cwd(), git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sourceRevision=git('rev-parse','HEAD'), sourceDirty=git('status','--porcelain')!=='';
const inputs=['server.mjs','src/unit-movement.mjs','src/unit-path-line.mjs','src/construction-work-intent.mjs',
  'src/combat-movement.mjs','src/elevation.mjs','src/server/checkpoint-route-budget.mjs'];
const files=Object.fromEntries(await Promise.all(inputs.map(async name=>[name,await readFile(resolve(root,name),'utf8')])));
const hash=value=>createHash('sha256').update(value).digest('hex');
const movement=await import(pathToFileURL(resolve(root,'src/unit-movement.mjs')));
const lines=await import(pathToFileURL(resolve(root,'src/unit-path-line.mjs')));
const {XL_CHECKPOINT_ROUTE_MAX_ENTRIES}=await import(pathToFileURL(resolve(root,'src/server/checkpoint-route-budget.mjs')));
const source=files['server.mjs'], begin=source.indexOf('\nfunction applyPlannedMoveAssignment('), end=source.indexOf('\nfunction takeMoveStartBroadcastRequest(',begin);
assert.ok(begin>0&&end>begin);
const leafBegin=source.indexOf('\nfunction validCellPath('), leafEnd=source.indexOf('\nfunction ',leafBegin+1);
assert.ok(leafBegin>0&&leafEnd>leafBegin);
const validCellPath=runInNewContext(`(${source.slice(leafBegin,leafEnd)})`);
const cases=[];
for(const [width,height] of [[16,17],[64,48],[160,160],[256,256],[320,256],[256,320],[320,320]]){
  const cells=width*height,startCell=Math.floor(height/2)*width+width/2,destination=startCell+4;
  const cellToWorld=c=>({x:c%width-width/2+.5,z:Math.floor(c/width)-height/2+.5}), center=cellToWorld(startCell);
  const worldToCell=(x,z)=>Math.floor(z+height/2)*width+Math.floor(x+width/2);
  for(const length of [cells-1,cells]){
    // Repeated cells are intentionally a checkpoint-leaf/retention envelope,
    // not a legitimate planner route, complete save, or crowd workload.
    const raw=Object.freeze(Array(length).fill(destination));
    assert.equal(validCellPath(raw,cells),true);
    const unit={id:0,team:0,generation:9,orderRevision:7,hp:100,kind:'worker',movementDomain:'land',
      x:center.x-.25,z:center.z+.45,path:[],pathIndex:0,movePlanningPending:true,
      moveGoalCell:destination,moveGoalPoint:null,buildingTargetId:34,repairing:false,
      attackTargetId:-1,attackBuildingTargetId:-1,gatherNodeId:null,gatherForestCell:-1,gatherPhase:'',
      attackMove:false,attackMoveResumePath:null,holdingPosition:false,stanceCombat:false,stanceReturning:false,persistentOrder:null};
    const result=movement.createUnitRouteResult({unit,epoch:3,navigationRevision:4,startCell,path:raw,originalCost:900});
    const assignment={unit,revision:7,destination,routeResult:result},job={epoch:3,buildingTargetId:34};
    const context={...movement,...lines,units:[unit],MAP_WIDTH:width,MAP_HEIGHT:height,MAP_HALF_X:width/2,MAP_HALF_Z:height/2,
      elevationLevelByCell:new Uint8Array(cells),isWalkable:c=>c>=0&&c<cells&&c!==startCell+width+1,
      worldToCell,cellToWorld,nearestOpenCell:c=>c,movePlanningEpoch:3,navigationRevision:4,
      WALK_SPEED:2.6,STEP_SECONDS:1/30,TICK_RATE:30,tickNumber:10,movePlanningServiceTick:null,
      CELL_COUNT:cells,MAX_UNITS:2000,MAX_RESOURCE_NODES:128,XL_CHECKPOINT_ROUTE_MAX_ENTRIES,
      resourceNodeStates:new Map(),pendingMoveStartBroadcasts:new Set(),dirty:false};
    const publish=runInNewContext(`(${source.slice(begin,end)})`,context);
    const accepted=publish(job,assignment);
    assert.equal(raw.length,length);assert.equal(raw.at(-1),destination);
    assert.equal(result.originalPathLength,length);assert.equal(result.originalCost,900);
    assert.equal(unit.buildingTargetId,34);assert.equal(unit.orderRevision,7);assert.equal(unit.moveGoalCell,destination);
    if(accepted){assert.equal(unit.path.at(-1),destination);assert.deepEqual([...unit.path].slice(-length),raw);}
    cases.push({width,height,withinCurrentDimensionCeiling:width<=256&&height<=256,synthetic:true,
      selectedEntries:length,published:accepted,publishedEntries:unit.path.length,
      publicationGrowth:accepted?unit.path.length-length:0,checkpointPathLeafAcceptsPublished:validCellPath(unit.path,cells),
      ...(assignment.routePublicationOutcome?{publicationOutcome:assignment.routePublicationOutcome}:{}),
      acceptedGoalRetained:true,constructionSiteRetained:true,originalLengthAndCostRetained:true});
  }
}
assert.equal(git('rev-parse','HEAD'),sourceRevision);assert.equal(git('status','--porcelain')!=='',sourceDirty);
for(const name of inputs)assert.equal(hash(await readFile(resolve(root,name),'utf8')),hash(files[name]));
const report={sourceRevision,sourceDirty,sourceInputSha256:Object.fromEntries(inputs.map(name=>[name,hash(files[name])])),
  scope:'Synthetic actual publisher and checkpoint route leaf; no map admission, complete save, live journey, timing, heap, capacity, release or rendered claim',cases};
const target=process.argv[2];
if(target)await writeFile(target,JSON.stringify(report,null,2)+'\n');
else console.log(JSON.stringify(report,null,2));
