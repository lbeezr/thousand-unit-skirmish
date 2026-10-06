import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {ScenarioEditHistory,regionGestureZone,createScenarioEditCoordinator} from '../src/authoring/scenario-authoring.mjs';
import * as scenarioAuthoring from '../src/authoring/scenario-authoring.mjs';
import * as legacyScenarioAuthoring from '../src/scenario-authoring.mjs';
import * as mapResize from '../src/authoring/map-resize.mjs';
import * as legacyMapResize from '../src/map-resize.mjs';
import {validCompletionTrigger,completionTeam} from '../src/scenario-regions.mjs';
import {scenarioEventSourceIds} from '../src/world/scenario-event-chain.mjs';

const mainSource=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function draftEventGraph(events){
 const context=vm.createContext({...scenarioAuthoring,scenarioEventSourceIds,editorScenarioEvents:events});
 const a=mainSource.indexOf('function editorScenarioEventCaptureRootId(');
 const b=mainSource.indexOf('\nfunction reconcileEditorScenarioEventTriggers(',a);
 assert.ok(a>=0&&b>a,'actual Map Studio graph consumer');
 vm.runInContext(mainSource.slice(a,b),context);
 return context;
}
const captureEvent=id=>({id,team:'both',trigger:{type:'capture',objectiveId:'zone'}});
const dependentEvent=(id,...eventIds)=>({id,team:'capturing',trigger:eventIds.length===1
 ?{type:'event',eventId:eventIds[0]}:{type:'event',eventIds}});

test('actual draft graph queries keep roots, convergent all-of chains and missing or mixed roots',()=>{
 const events=[captureEvent('a'),captureEvent('b'),dependentEvent('one','a'),dependentEvent('two','one'),
  dependentEvent('same','one','two'),dependentEvent('mixed','a','b'),dependentEvent('missing','absent'),
  {id:'clock'}, {id:'region',trigger:{type:'region-entry',regionId:'region'}},dependentEvent('empty')];
 const bytes=JSON.stringify(events),f=draftEventGraph(events);
 for(const [id,root] of [['a','a'],['b','b'],['one','a'],['two','a'],['same','a'],['mixed',null],
  ['missing',null],['absent',null],['clock',null],['region',null],['empty',null]]){
  assert.equal(f.editorScenarioEventCaptureRootId(id),root,id);
  assert.equal(f.editorScenarioEventHasCaptureRoot(id),root!==null,id);
 }
 assert.equal(JSON.stringify(events),bytes);
});

test('actual draft graph roots retain caller cache identity, visiting guards and deterministic traversal',()=>{
 const events=[captureEvent('a'),dependentEvent('one','a'),dependentEvent('child','one','a')];
 const f=draftEventGraph(events),cache=new Map([['unrelated','keep']]),visiting=new Set(['retained']);
 assert.equal(f.editorScenarioEventCaptureRootId('child',cache,visiting),'a');
 assert.deepEqual([...cache],[['unrelated','keep'],['a','a'],['one','a'],['child','a']]);
 assert.deepEqual([...visiting],['retained']);
 const sentinel={legacy:'cache value'};cache.set('child',sentinel);visiting.add('child');
 assert.equal(f.editorScenarioEventCaptureRootId('child',cache,visiting),sentinel,'cache precedes visiting guard');
 assert.ok(visiting.has('child'));
 assert.equal(f.editorScenarioEventCaptureRootId('one',new Map(),new Set(['one'])),null);
});

test('actual draft graph cycle refusal handles self, downstream, malformed draft cycles and replaced arrays',()=>{
 const events=[captureEvent('a'),dependentEvent('one','a'),dependentEvent('two','one'),
  dependentEvent('cycle-a','cycle-b'),dependentEvent('cycle-b','cycle-a')];
 const bytes=JSON.stringify(events),f=draftEventGraph(events);
 assert.equal(f.editorScenarioEventSourceWouldCycle('missing','missing'),true);
 assert.equal(f.editorScenarioEventSourceWouldCycle('two','a'),true);
 assert.equal(f.editorScenarioEventSourceWouldCycle('a','two'),false);
 assert.equal(f.editorScenarioEventSourceWouldCycle('cycle-a','unrelated'),false);
 assert.deepEqual(f.eligibleEditorScenarioEventSources({id:'one'}).map(e=>e.id),
  ['a','cycle-a','cycle-b'],'actual source picker excludes self and downstream cycle candidates');
 const cache=new Map(),visiting=new Set();
 assert.equal(f.editorScenarioEventCaptureRootId('cycle-a',cache,visiting),null);
 assert.deepEqual([...cache],[['cycle-b',null],['cycle-a',null]]);assert.equal(visiting.size,0);
 assert.equal(JSON.stringify(events),bytes);
 f.editorScenarioEvents=[dependentEvent('two','missing')];
 assert.equal(f.editorScenarioEventCaptureRootId('two'),null,'query reads the replaced draft');
 assert.equal(f.editorScenarioEventSourceWouldCycle('two','a'),false);
});

test('actual draft graph capturing-team reconciliation changes only unrooted recipients',()=>{
 const events=[captureEvent('a'),dependentEvent('rooted','a'),dependentEvent('unrooted','missing'),
  {id:'clock',team:'capturing'}, {id:'ordinary',team:'0'},dependentEvent('mixed','a','ordinary')];
 const f=draftEventGraph(events),before=JSON.stringify(events);
 assert.equal(f.reconcileEditorScenarioEventCapturingTeams(),3);
 assert.equal(events[1].team,'capturing');
 for(const index of [2,3,5])assert.equal(events[index].team,'both');
 assert.equal(events[4].team,'0');assert.equal(f.reconcileEditorScenarioEventCapturingTeams(),0);
 assert.deepEqual(events.map(e=>({...e,team:JSON.parse(before).find(old=>old.id===e.id).team})),JSON.parse(before));
});
test('compatibility paths preserve exactly the existing named export bindings',()=>{
 for (const [canonical,legacy,keys] of [
  [scenarioAuthoring,legacyScenarioAuthoring,['ScenarioEditHistory','regionGestureZone']],
  [mapResize,legacyMapResize,['resizeWorldMarkers']],
 ]) {
  assert.deepEqual(Object.keys(canonical).sort(),[...keys,...(canonical===scenarioAuthoring?['createScenarioEditCoordinator']:[])].sort());
  assert.deepEqual(Object.keys(legacy).sort(),keys.sort());
  for (const key of keys) assert.equal(legacy[key],canonical[key],key);
 }
 const h=new legacyScenarioAuthoring.ScenarioEditHistory();
 assert.ok(h instanceof scenarioAuthoring.ScenarioEditHistory);
});
test('bounded history branches and clones state',()=>{
 const h=new ScenarioEditHistory(2);h.record({x:0});h.record({x:1});h.record({x:2});h.record({x:3});
 assert.deepEqual(h.undo(),{x:2});assert.deepEqual(h.undo(),{x:1});assert.equal(h.undo(),null);
 h.record({x:5});assert.equal(h.redo(),null);
});
test('region gestures remain within grid',()=>{
 assert.deepEqual(regionGestureZone({tool:'region-draw',start:{column:8,row:9},current:{column:2,row:3}},10,10),{column:2,row:3,width:7,height:7});
 assert.deepEqual(regionGestureZone({tool:'region-move',start:{column:2,row:3},current:{column:20,row:-5},zone:{column:2,row:3,width:4,height:4}},10,10),{column:6,row:0,width:4,height:4});
 assert.deepEqual(regionGestureZone({tool:'region-resize',start:{column:2,row:3},current:{column:-4,row:40},zone:{column:2,row:3,width:4,height:4}},10,10),{column:2,row:3,width:1,height:7});
});
test('completion registry validation and deterministic initial presence',()=>{
 const trigger={type:'construction-complete',buildingType:'barracks',team:'either'};
 assert.ok(validCompletionTrigger(trigger));assert.equal(validCompletionTrigger({...trigger,buildingType:'unknown'}),false);
 const buildings=[{team:1,type:'barracks',hp:100,complete:true},{team:0,type:'barracks',hp:100,complete:true}];
 assert.equal(completionTeam(trigger,buildings,[{},{}]),0);
 buildings[1].complete=false;assert.equal(completionTeam(trigger,buildings,[{},{}]),1);
 buildings[0].hp=0;assert.equal(completionTeam(trigger,buildings,[{},{}]),-1);
 assert.equal(completionTeam({type:'research-complete',technologyId:'infantry-attack',team:'1'},[],[{}, {infantryAttack:true}]),1);
});

test('scenario coordination records only active state and always synchronizes availability',()=>{
 const history=new ScenarioEditHistory(2);let active=false,current={value:0},captures=0;
 const availability=[];
 const coordinator=createScenarioEditCoordinator({history,canRecord:()=>active,
  capture:()=>{captures++;return current;},apply:state=>{current=state;},
  onRecord:()=>availability.push([history.canUndo,history.canRedo])});
 coordinator.record();assert.equal(captures,0);assert.deepEqual(availability,[[false,false]]);
 active=true;coordinator.record();current={value:1};coordinator.record();current={value:2};coordinator.record();
 assert.equal(captures,3);assert.deepEqual(availability.at(-1),[true,false]);
 assert.equal(coordinator.restore('undo'),true);assert.deepEqual(current,{value:1});
 assert.deepEqual(availability.at(-1),[true,true]);
 assert.equal(coordinator.restore('redo'),true);assert.deepEqual(current,{value:2});
 assert.equal(coordinator.restore('redo'),false);
});

test('scenario application suppresses reentrant capture and preserves redo until a distinct edit',()=>{
 const history=new ScenarioEditHistory(64),calls=[];let current={value:0},coordinator;
 coordinator=createScenarioEditCoordinator({history,canRecord:()=>true,
  capture:()=>{calls.push('capture');return current;},
  apply:state=>{calls.push('apply');current=state;coordinator.record();},
  onRecord:()=>calls.push('availability')});
 coordinator.record();current={value:1};coordinator.record();calls.length=0;
 assert.equal(coordinator.restore('undo'),true);
 assert.deepEqual(calls,['apply','availability','capture','availability']);
 assert.equal(history.canRedo,true);assert.equal(history.states.length,2);
 current={value:2};coordinator.record();assert.equal(history.canRedo,false);
 assert.equal(coordinator.restore('redo'),false);assert.deepEqual(current,{value:2});
});

test('exhausted restoration has no callbacks and existing application failures keep recording suppressed',()=>{
 const history=new ScenarioEditHistory(64);let current={value:0},captures=0,availability=0,applications=0;
 const failure=new Error('apply failed');
 const coordinator=createScenarioEditCoordinator({history,canRecord:()=>true,
  capture:()=>{captures++;return current;},apply:()=>{applications++;throw failure;},
  onRecord:()=>{availability++;}});
 assert.equal(coordinator.restore('undo'),false);assert.equal(availability,0);assert.equal(applications,0);
 coordinator.record();current={value:1};coordinator.record();
 assert.throws(()=>coordinator.restore('undo'),error=>error===failure);
 assert.equal(applications,1);const previous=availability;coordinator.record();
 assert.equal(captures,2);assert.equal(availability,previous+1);
 assert.throws(()=>coordinator.restore('unknown'),TypeError);
});
