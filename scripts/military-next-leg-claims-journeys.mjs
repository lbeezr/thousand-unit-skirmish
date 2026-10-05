import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrdinaryMilitaryEndpointAvailability, createNextQueuedMilitaryEndpointClaims,
  decideActiveConstructionParking, MILITARY_ENDPOINT_QUERY_VISIT_LIMIT }
  from '../src/simulation/movement/military-endpoint-availability.mjs';
import { createMoveGoalPoint, createClearanceMoveGoalPoint, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
const width=16,height=16,cell=(x,z,w=width,h=height)=>Math.floor(z+h/2)*w+Math.floor(x+w/2);
const scope=extra=>Object.freeze({tick:100,navigationRevision:9,epoch:5,...extra});
const actor=(id=0,extra={})=>({id,generation:7,orderRevision:3,hp:100,kind:'infantry',team:0,
 movementDomain:'land',holdingPosition:false,attackMove:false,stanceCombat:false,stanceReturning:false,
 persistentOrder:null,attackTargetId:-1,attackBuildingTargetId:-1,gatherNodeId:null,gatherForestCell:-1,
 gatherPhase:null,buildingTargetId:null,moveGoalCell:cell(-4.5,.5),moveGoalPoint:null,
 queuedWaypoints:[{destination:cell(.5,.5),attackMove:false}],...extra});
const snapshot=(units,extra={})=>{const frame=extra.scope??scope();return {frame,
 view:createNextQueuedMilitaryEndpointClaims({units,width,height,maxUnits:2000,maxQueuedWaypoints:8,
  isWalkable:c=>c>=0&&c<width*height,...extra,scope:frame})};};
const at=(s,x=.5,z=.5,team=0,radius=.18)=>s.view.check({scope:s.frame,team,position:{x,z},radius});

for(const team of [0,1])test(`seat ${team}: current-only contract unchanged, next accepted queue head separately claimed`,()=>{
 const unit=actor(0,{team}),before=structuredClone(unit),old=createOrdinaryMilitaryEndpointAvailability({units:[unit],width,height,maxUnits:2});
 assert.equal(old.check({team,position:{x:.5,z:.5},radius:.18}).status,'available');
 const s=snapshot([unit]);assert.equal(at(s,.5,.5,team).status,'claimed');assert.equal(at(s,.5,.5,1-team).status,'available');
 assert.deepEqual(unit,before);assert.equal(s.view.diagnostics.claims,1);assert.equal(s.view.diagnostics.censusHeadReads,1);
});

test('only queue head is read; routes and later goals remain outside the view',()=>{
 const unit=actor();for(const name of ['path','pathIndex','attackMoveResumePath'])Object.defineProperty(unit,name,{get(){throw Error('route read');}});
 Object.defineProperty(unit.queuedWaypoints,1,{get(){throw Error('later queued leg read');}});
 const s=snapshot([unit]);assert.equal(at(s).status,'claimed');assert.equal(at(s,4.5,.5).status,'available');
 assert.equal(s.view.diagnostics.censusHeadReads,1);assert.equal(s.view.diagnostics.claims,1);
});

for(const version of [1,2])test(`v${version} queued point accepts older revision and preserves exact accepted request`,()=>{
 const unit=actor(),head=unit.queuedWaypoints[0];
 head.point=version===1?createMoveGoalPoint(unit,.93,.22,head.destination,width,height)
  :createClearanceMoveGoalPoint(unit,.93,.22,head.destination,width,height,()=>true);
 unit.orderRevision=5;const before=structuredClone(unit),s=snapshot([unit]);
 assert.equal(at(s,.93,.22).status,'claimed');assert.equal(at(s,.53,.22).status,'available');
 assert.deepEqual(unit,before);
});

test('fractional head uses the existing activation projection at current navigation',()=>{
 const unit=actor(),head=unit.queuedWaypoints[0];head.point=createClearanceMoveGoalPoint(unit,.99,.99,head.destination,width,height,()=>true);
 const before=structuredClone(unit),s=snapshot([unit],{isWalkable:c=>c===head.destination});
 assert.equal(at(s,.78,.78).status,'claimed');assert.equal(at(s,.2,.2).status,'available');
 assert.deepEqual(unit,before);assert.ok(s.view.diagnostics.staticProbes>1);
});

test('statically covered head awaits host relocation; no guessed next endpoint',()=>{
 const unit=actor(),s=snapshot([unit],{isWalkable:()=>false});assert.equal(at(s).status,'available');
 assert.equal(s.view.diagnostics.claims,0);assert.equal(s.view.diagnostics.relocationPending,1);
});

test('head AttackMove does not scan forward to a later ordinary point',()=>{
 const unit=actor();unit.queuedWaypoints[0].attackMove=true;
 Object.defineProperty(unit.queuedWaypoints,1,{get(){throw Error('later ordinary goal read');}});
 assert.equal(at(snapshot([unit])).status,'available');
});

for(const [label,extra] of Object.entries({Stop:{moveGoalCell:-1},Hold:{holdingPosition:true},dead:{hp:0},
 Worker:{kind:'worker'},water:{movementDomain:'water'},combat:{attackTargetId:1},objective:{attackMove:true},
 persistent:{persistentOrder:{kind:'follow'}},gathering:{gatherPhase:'gathering'}}))test(`${label} intent is excluded without reading queue`,()=>{
 const unit=actor(0,extra);Object.defineProperty(unit,'queuedWaypoints',{get(){throw Error('excluded queue read');}});
 assert.equal(at(snapshot([unit])).status,'available');
});

for(const [label,change] of Object.entries({generation:u=>u.generation++,order:u=>u.orderRevision++,kind:u=>u.kind='rider',
 team:u=>u.team=1,goal:u=>u.moveGoalCell=cell(-3.5,.5),Hold:u=>u.holdingPosition=true,
 death:u=>u.hp=0,queue:u=>u.queuedWaypoints=[...u.queuedWaypoints],
 head:u=>u.queuedWaypoints[0]={...u.queuedWaypoints[0]},destination:u=>u.queuedWaypoints[0].destination=cell(1.5,.5),
 attack:u=>u.queuedWaypoints[0].attackMove=true,length:u=>u.queuedWaypoints.push({destination:cell(2.5,.5),attackMove:false})}))
 test(`changed ${label} invalidates an encountered snapshot claim`,()=>{
  const unit=actor(),s=snapshot([unit]);change(unit);assert.equal(at(s).status,'deferred');
 });

test('canonical replacement and roster size changes defer',()=>{
 const units=[actor()],s=snapshot(units);units[0]={...units[0]};assert.equal(at(s).status,'deferred');
 const again=snapshot(units);units.push(actor(1,{hp:0}));assert.equal(at(again,7.5,7.5).status,'deferred');
});

for(const [label,change] of Object.entries({reference:h=>h.point={...h.point},x:h=>h.point.x+=.01,
 revision:h=>h.point.revision++,extra:h=>h.point.extra=1}))test(`changed point ${label} invalidates the claim`,()=>{
 const unit=actor(),head=unit.queuedWaypoints[0];head.point=createMoveGoalPoint(unit,.93,.22,head.destination,width,height);
 const s=snapshot([unit]);change(head);assert.equal(at(s,.93,.22).status,'deferred');
});

test('malformed head/point, future generation/revision and queue bound fail closed per team',()=>{
 for(const mutate of [u=>u.queuedWaypoints[0]=null,u=>u.queuedWaypoints[0].destination=-1,
  u=>u.queuedWaypoints[0].attackMove=undefined,u=>u.queuedWaypoints.length=9,
  u=>{const h=u.queuedWaypoints[0];h.point=createMoveGoalPoint(u,.93,.22,h.destination,width,height);h.point.generation++;},
  u=>{const h=u.queuedWaypoints[0];h.point=createMoveGoalPoint(u,.93,.22,h.destination,width,height);h.point.revision++;},
  u=>{const h=u.queuedWaypoints[0];h.point=createMoveGoalPoint(u,.93,.22,h.destination,width,height);h.point.x=NaN;}]){
  const unit=actor();mutate(unit);const s=snapshot([unit]);assert.equal(at(s).status,'deferred');assert.equal(at(s,.5,.5,1).status,'available');
 }
});

test('missing/nonfrozen/new scope, invalid bounds and explicit close defer',()=>{
 for(const extra of [{scope:{tick:100,navigationRevision:9,epoch:5}},{scope:scope({epoch:-1})},
  {maxUnits:0},{maxQueuedWaypoints:0},{maxQueuedWaypoints:9},{width:NaN},{isWalkable:null}])assert.equal(at(snapshot([actor()],extra)).status,'deferred');
 const s=snapshot([actor()]);for(const frame of [undefined,scope(),scope({tick:101}),scope({navigationRevision:10}),scope({epoch:6})])
  assert.equal(s.view.check({scope:frame,team:0,position:{x:.5,z:.5},radius:.18}).status,'deferred');
 s.view.close();assert.equal(at(s).status,'deferred');
});

test('64 local claim visits are allowed; a 65th refuses positive clearance',()=>{
 for(const count of [64,65]){
  const units=Array.from({length:count},(_,id)=>actor(id,{queuedWaypoints:[{destination:cell(1.5,1.5),attackMove:false}]}));
  const s=snapshot(units),result=at(s);assert.equal(result.visited,MILITARY_ENDPOINT_QUERY_VISIT_LIMIT);
  assert.equal(result.status,count===64?'available':'deferred');
  assert.equal(s.view.diagnostics.censusSlots,count);assert.equal(s.view.diagnostics.censusHeadReads,count);
 }
});

for(const [w,h] of [[16,17],[160,160],[256,256],[320,320],[320,160],[160,320]])test(`primitive next-leg indices ${w}x${h}`,()=>{
 const unit=actor(0,{moveGoalCell:cell(-.5,.5,w,h),queuedWaypoints:[{destination:cell(w/2-.5,h/2-.5,w,h),attackMove:false}]}),
  s=snapshot([unit],{width:w,height:h,isWalkable:c=>c>=0&&c<w*h});
 assert.equal(at(s,w/2-.5,h/2-.5).status,'claimed');assert.equal(s.view.diagnostics.claims,1);
});

test('all next-leg work poses claimed: productive work remains independent; own escape or retained active wait',()=>{
 const units=[actor(0),actor(1,{queuedWaypoints:[{destination:cell(1.5,.5),attackMove:false}]})],before=structuredClone(units),s=snapshot(units);
 const current=createOrdinaryMilitaryEndpointAvailability({units,width,height,maxUnits:2000});
 for(const x of [.5,1.5]){
  const currentStatus=current.check({team:0,position:{x,z:.5},radius:.18}).status,nextStatus=at(s,x,.5).status;
  assert.equal(currentStatus,'available','existing productive-work admission remains available');assert.equal(nextStatus,'claimed');
  assert.equal(decideActiveConstructionParking({activeConstruction:true,currentStatus,nextStatus}),'wait');
 }
 assert.equal(at(s,2.5,.5).status,'available');
 assert.equal(decideActiveConstructionParking({activeConstruction:true,currentStatus:'available',nextStatus:'claimed',escapeAvailable:true}),'escape');
 assert.equal(decideActiveConstructionParking({activeConstruction:true,currentStatus:'blocked',nextStatus:'claimed',escapeAvailable:true}),'escape');
 assert.deepEqual(units,before,'no work, cost, goal, queue or position mutation by either view/decision');
 s.view.close();units[0].orderRevision++;units[0].queuedWaypoints=[];
 const released=snapshot(units);assert.equal(released.frame.navigationRevision,s.frame.navigationRevision);
 assert.equal(at(released).status,'available');
 assert.equal(decideActiveConstructionParking({activeConstruction:true,currentStatus:'available',nextStatus:at(released).status}),'park');
});

test('inactive builders retain their pose; deferred/invalid evidence cannot grant parking',()=>{
 assert.equal(decideActiveConstructionParking({activeConstruction:false,currentStatus:'available',nextStatus:'available',escapeAvailable:true}),'inactive');
 assert.equal(decideActiveConstructionParking({activeConstruction:true,currentStatus:'available',nextStatus:'deferred'}),'wait');
 assert.equal(decideActiveConstructionParking({activeConstruction:true,currentStatus:'unknown',nextStatus:'available',escapeAvailable:true}),'wait');
 assert.equal(decideActiveConstructionParking({activeConstruction:true,currentStatus:'blocked',nextStatus:'available'}),'wait');
});
