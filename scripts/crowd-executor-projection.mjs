import {ordinaryCrowdBodyRadius,crowdPassagePoint} from '../src/unit-crowd-steering.mjs';
import {LAND_CLEARANCE_PROFILE,activeMoveGoalPoint,canTraverseUnitStep,canTraverseStaticBodySegment,pointSegmentDistanceSquared,segmentRectangleDistanceSquared} from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
// Diagnostic own-call contract; no production executor adopts this helper yet.
// Oracles and query completeness are host-owned. Future-turn bounds spend no budget.
const EPS=1e-9;
export const guardFor=(u,tick,navigationRevision,epoch)=>({actor:u,generation:u.generation,orderRevision:u.orderRevision,path:u.path,pathIndex:u.pathIndex,tick,navigationRevision,epoch,x:u.x,z:u.z});
export function projectOrdinaryStep(frame) {
 const {unit,budget,expected,tick,navigationRevision,epoch}=frame;
 const radius=ordinaryCrowdBodyRadius(unit),stats={passageProposals:0,passageBodyVisits:0,staticCells:0,bodyVisits:0,queryVisits:0};
 const no=(status,extra={})=>({status,spendable:false,stats,...extra});
 if(!radius)return no('ineligible');
 if(!budget||budget.actor!==unit||budget.tick!==tick||!['own-call','future-turn-bound'].includes(budget.kind)||!(budget.remainingStep>0&&budget.remainingStep<=Math.min(.25,UNIT_DEFINITIONS[unit.kind].combat.moveSpeed/30)+EPS))return no('unavailable-budget');
 for(const[k,v]of Object.entries({actor:unit,generation:unit.generation,orderRevision:unit.orderRevision,path:unit.path,pathIndex:unit.pathIndex,tick,navigationRevision,epoch,x:unit.x,z:unit.z}))if(expected?.[k]!==v)return no('changed-route-or-pose',{changed:k});
 const query=frame.query;
 if(!query||query.overflow!==false||!Number.isInteger(query.visits)||query.visits<0||query.visits>128||!Array.isArray(query.neighbors)||query.neighbors.length>64)return no('query-overflow');
 stats.queryVisits=query.visits;
 const neighbors=query.neighbors.toSorted((a,b)=>a.id-b.id||a.generation-b.generation);
 if(new Set(neighbors.map(n=>n.id)).size!==neighbors.length||neighbors.some(n=>n===unit||n.hp<=0||!Number.isFinite(LAND_CLEARANCE_PROFILE.radiusByKind[n.kind])))return no('invalid-query');
 const {width,height,cell,point,levels,isWalkable}=frame.map;
 if(!Number.isInteger(width)||width<1||!Number.isInteger(height)||height<1||levels.length!==width*height)return no('invalid-map');
 const inside=p=>p.x>=-width/2+.5&&p.x<=width/2-.5&&p.z>=-height/2+.5&&p.z<=height/2-.5;
 const ownCell=cell(unit.x,unit.z),endpoint=activeMoveGoalPoint(unit);
 const raw=endpoint&&unit.pathIndex===unit.path.length-1&&unit.path[unit.pathIndex]===endpoint.cell?endpoint:point(unit.path[unit.pathIndex]);
 if(!raw||!Number.isFinite(raw.x)||!Number.isFinite(raw.z))return no('invalid-waypoint');
 const targetCell=cell(raw.x,raw.z),adjacent=Math.abs(ownCell%width-targetCell%width)<=1&&Math.abs(Math.floor(ownCell/width)-Math.floor(targetCell/width))<=1;
 if(!isWalkable(targetCell)||(adjacent&&!canTraverseUnitStep(ownCell,targetCell,width,levels,isWalkable))||(!canTraverseStaticBodySegment(raw,raw,radius,width,height,isWalkable)&&!canTraverseStaticBodySegment(unit,raw,radius,width,height,isWalkable,{allowEscape:true})))return no('static-route-rejected',{raw});
 let target=raw,travelDirection={x:raw.x-unit.x,z:raw.z-unit.z};
 if(unit.pathIndex<unit.path.length-1){const following=point(unit.path[unit.pathIndex+1]),previous=unit.pathIndex?point(unit.path[unit.pathIndex-1]):point(ownCell);let dx=raw.x-previous.x,dz=raw.z-previous.z;if(!dx&&!dz){dx=following.x-raw.x;dz=following.z-raw.z;}travelDirection={x:dx,z:dz};
 target=crowdPassagePoint(raw,travelDirection,unit,neighbors,p=>canTraverseStaticBodySegment(p,p,radius,width,height,isWalkable),stats);}
 const distance=Math.hypot(target.x-unit.x,target.z-unit.z),stepDistance=Math.min(distance,budget.remainingStep,.25);
 const to=distance?{x:unit.x+(target.x-unit.x)/distance*stepDistance,z:unit.z+(target.z-unit.z)/distance*stepDistance}:{x:unit.x,z:unit.z};
 const staticBlockers=[];
 if(!inside(to))staticBlockers.push({reason:'map-bounds'});
 if(!canTraverseUnitStep(ownCell,cell(to.x,to.z),width,levels,isWalkable))staticBlockers.push({reason:'cell-or-elevation'});
 const minX=Math.max(0,Math.floor(Math.min(unit.x,to.x)-radius+width/2)-1),maxX=Math.min(width-1,Math.floor(Math.max(unit.x,to.x)+radius+width/2)+1);
 const minZ=Math.max(0,Math.floor(Math.min(unit.z,to.z)-radius+height/2)-1),maxZ=Math.min(height-1,Math.floor(Math.max(unit.z,to.z)+radius+height/2)+1);
 for(let row=minZ;row<=maxZ;row++)for(let col=minX;col<=maxX;col++){stats.staticCells++;const c=row*width+col;if(isWalkable(c))continue;const margin=Math.sqrt(segmentRectangleDistanceSquared(unit,to,{minX:col-width/2,minZ:row-height/2,maxX:col-width/2+1,maxZ:row-height/2+1}))-radius;if(margin<-EPS)staticBlockers.push({reason:'static-body',cell:c,margin});}
 const bodyBlockers=[];let bodyMinimumMargin=Infinity;
 for(const other of neighbors){stats.bodyVisits++;const margin=Math.sqrt(pointSegmentDistanceSquared(other,unit,to))-radius-LAND_CLEARANCE_PROFILE.radiusByKind[other.kind];bodyMinimumMargin=Math.min(bodyMinimumMargin,margin);if(margin<-EPS)bodyBlockers.push({actor:other,id:other.id,generation:other.generation,x:other.x,z:other.z,margin});}
 return {status:'projected',spendable:budget.kind==='own-call',budgetKind:budget.kind,remainingStep:budget.remainingStep,raw,target,travelDirection,to,stepDistance,radius,staticBlockers,bodyBlockers,bodyMinimumMargin,strictClear:!staticBlockers.length&&!bodyBlockers.length,stats};
}
