import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { SHEEP_WANDER_RADIUS } from '../src/wildlife-motion.mjs';
import { SHEEP_HERD_SPEED } from '../src/wildlife-herding.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { wildlifeControlsFixture, controlsMap, controlsState, controlsUnits, visibilityFor } from './wildlife-client-controls-fixture.mjs';

const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
const own = (team,map=controlsMap) => map.resourceNodes.find(row=>row.id===`sheep-${team}`);
async function fixture(t,team=0,options={}) {
  const f=await wildlifeControlsFixture(team,options);t.after(()=>f.close());return f;
}

test('shared input fixture renders terminal recap with seat privacy and clears it on result reset', async t => {
  for (const team of [0, 1, null]) {
    const f = await fixture(t, team), document = f.w.document;
    const terminal = controlsState(f.map, { winner: 2, winnerReason: 'stronghold-destruction',
      matchElapsedSeconds: 123, food: [12, 98], wood: [34, 76], alive: [2, 2], objectives: [] });
    const before = structuredClone(terminal);
    f.w.applyState(terminal, false);
    assert.equal(document.querySelector('#match-result-title').textContent, 'DRAW');
    assert.equal(document.querySelector('#match-recap').hidden, false);
    assert.equal(document.querySelector('#match-recap-duration').textContent, 'Duration 2:03');
    const resources = document.querySelector('#match-recap-resources');
    assert.equal(resources.textContent, team === null ? ''
      : `Your remaining resources: ${terminal.food[team]} Food · ${terminal.wood[team]} Wood`);
    assert.equal(resources.hidden, team === null, 'spectators receive no player bank recap');
    assert.deepEqual(terminal, before, 'recap rendering does not mutate the accepted DTO');
    f.w.updateMatchResult(-1);
    assert.equal(document.querySelector('#match-recap').hidden, true);
    assert.equal(resources.textContent, '');
  }
});

function selected(f,id) {
  assert.equal(f.w.selectedWildlifeId,id);
  assert.equal(f.w.selectedBuildingId,null);
  assert.deepEqual([...f.w.selected],[]);
  assert.equal(f.w.ui.selected.textContent,'1 SHEEP');
  assert.equal(f.w.selectionMesh.count,1);
}
function cleared(f) {
  assert.equal(f.w.selectedWildlifeId,null);
  assert.equal(f.w.selectedWildlifeView,null);
  assert.equal(f.w.selectionMesh.count,f.w.selected.size);
}
function rowState(f,patch={},extra={}) {
  return controlsState(f.map,{...extra,resourceNodes:controlsState(f.map).resourceNodes.map(row=>
    row.id===own(f.w.localTeam,f.map)?.id ? {...row,...patch} : row)});
}
function ack(f,command,message) {
  f.receive({type:'notice',clientOrderToken:command.clientOrderToken,message});
}
function payload(command,type,id,epoch) {
  assert.equal(command.type,type);assert.equal(command.nodeId,id);assert.equal(typeof command.nodeId,'string');
  assert.equal(command.resourceEpoch,epoch);assert.ok(Number.isSafeInteger(command.clientOrderToken));
  assert.deepEqual(Object.keys(command).sort(),(type==='herd'
    ? ['type','nodeId','resourceEpoch','x','z','clientOrderToken']
    : ['type','nodeId','resourceEpoch','clientOrderToken']).sort());
}

for (const team of [0,1]) {
  test(`seat ${team}: actual left-click picking selects owned live Sheep only, with numeric army separation`,async t=>{
    const f=await fixture(t,team),node=own(team);
    f.click(own(1-team));cleared(f);f.click(controlsMap.resourceNodes[2]);cleared(f);
    f.click(node);selected(f,node.id);
    assert.equal(f.w.ui.commandMode.textContent,'HERD');
    const stop=f.w.document.querySelector('[data-stationary-order="stop"]');
    assert.equal(stop.disabled,false);assert.equal(stop.hidden,false);
    for(const button of f.w.document.querySelectorAll('[data-persistent-order], [data-stationary-order="holdPosition"]')) {
      assert.equal(button.hidden,true);assert.equal(button.disabled,true);
    }
    assert.equal(f.sent.length,0,'selection creates no order or optimistic claim');
    assert.ok(f.w.controlGroups.every(group=>group.size===0));
  });

  test(`seat ${team}: RMB Herd and S/Stop use exact epoch/string IDs and production tracked ACK feedback`,async t=>{
    const f=await fixture(t,team),node=own(team),destination={x:team===0?-1.25:1.25,z:7.25};
    f.click(node);const before=JSON.stringify([...f.w.latestWildlifeView.rows]);
    f.right(destination);const herd=f.sent.at(-1);payload(herd,'herd',node.id,7);
    near(herd.x,destination.x);near(herd.z,destination.z);
    assert.equal(f.w.ui.orderStatus.dataset.state,'pending');
    ack(f,{clientOrderToken:herd.clientOrderToken+100},'HERD ORDER · FOREIGN TOKEN');
    assert.equal(f.w.ui.orderStatus.dataset.state,'pending');
    ack(f,herd,'HERD ORDER · VISIBLE CLEAR LAND');assert.equal(f.w.ui.orderStatus.dataset.state,'applied');
    assert.equal(JSON.stringify([...f.w.latestWildlifeView.rows]),before,'wire/ACK does not move or consume Sheep locally');
    f.key('s');const stop=f.sent.at(-1);payload(stop,'stopWildlife',node.id,7);
    assert.ok(stop.clientOrderToken>herd.clientOrderToken);
    ack(f,herd,'HERD REJECTED · STALE ACK');assert.equal(f.w.ui.orderStatus.dataset.state,'pending');
    ack(f,stop,'SHEEP STOP ORDER');assert.equal(f.w.ui.orderStatus.dataset.state,'applied');
    f.w.document.querySelector('[data-stationary-order="stop"]').click();
    payload(f.sent.at(-1),'stopWildlife',node.id,7);
    ack(f,f.sent.at(-1),'SHEEP STOP REJECTED · STALE RESOURCE EPOCH');
    assert.equal(f.w.ui.orderStatus.dataset.state,'failed');selected(f,node.id);
    const count=f.sent.length;f.key('h');f.key('p');f.key('f');f.key('m');
    assert.equal(f.sent.length,count,'unsupported military orders cannot target a Sheep');
    assert.equal(f.w.attackMoveMode,false);assert.equal(f.w.persistentTargetMode,null);
  });

  test(`seat ${team}: armed touch Herd handles cancellation, drag, invalid endpoints, Shift and offline transport`,async t=>{
    const f=await fixture(t,team),node=own(team),destination={x:0.25,z:7.25};
    f.click(node);f.w.ui.orderTargetToggle.click();assert.equal(f.w.tapOrderArmed,true);
    const screen=f.screen(destination);
    f.pointer(f.canvas,'pointerdown',{...screen,id:5,pointerType:'touch'});
    f.pointer(f.canvas,'pointercancel',{...screen,id:5,pointerType:'touch'});
    assert.equal(f.sent.length,0);assert.equal(f.w.tapOrderArmed,true);
    f.pointer(f.canvas,'pointerdown',{...screen,id:6,pointerType:'touch'});
    f.pointer(f.canvas,'pointerup',{x:screen.x+20,y:screen.y,id:6,pointerType:'touch'});
    assert.equal(f.sent.length,0,'a touch drag is not a Herd destination');
    f.click({x:2.5,z:6.5},{pointerType:'touch'});
    assert.equal(f.sent.length,0);assert.equal(f.w.tapOrderArmed,true);
    f.click(destination,{pointerType:'touch',shiftKey:true});
    assert.equal(f.sent.length,0);assert.equal(f.w.tapOrderArmed,true);
    assert.match(f.w.toast.textContent,/QUEUED HERDING/);
    f.w.socket.readyState=3;f.click(destination,{pointerType:'touch'});
    assert.equal(f.sent.length,0);assert.equal(f.w.tapOrderArmed,true);
    assert.equal(f.w.ui.orderStatus.dataset.state,'failed');assert.match(f.w.ui.orderStatus.textContent,/OFFLINE/);
    f.w.socket.readyState=1;f.click(destination,{pointerType:'touch'});
    payload(f.sent.at(-1),'herd',node.id,7);assert.equal(f.w.tapOrderArmed,false);
    near(f.sent.at(-1).x,destination.x);near(f.sent.at(-1).z,destination.z);
  });

  test(`seat ${team}: minimap Herd is exact, rejects clamped edges/fog/queues, and retains unarmed camera dragging`,async t=>{
    const f=await fixture(t,team),node=own(team);
    f.click(node);f.mini({x:1.25,z:8.25});payload(f.sent.at(-1),'herd',node.id,7);
    near(f.sent.at(-1).x,1.25);near(f.sent.at(-1).z,8.25);
    const count=f.sent.length;
    for(const point of [{x:32,z:0},{x:-32.01,z:0},{x:0,z:32},{x:0,z:-32.01}])f.mini(point);
    assert.equal(f.sent.length,count,'upper edge and out-of-map targets cannot clamp into legal orders');
    for(const point of [{x:2.5,z:6.5},{x:5.5,z:6.5}])f.right(point);
    for(const point of [null,{}, {x:NaN,z:0},{x:0,z:Infinity},{x:'0',z:0}])
      assert.equal(f.w.issueWildlifeOrder('herd',point),false,'invalid coordinates fail before transport');
    assert.equal(f.sent.length,count,'stone, water and malformed coordinates cannot create orders');
    f.mini({x:0.25,z:8.25},{shiftKey:true});assert.equal(f.sent.length,count);
    f.receive(controlsState(f.map,{visibility:visibilityFor(f.map,[{x:.25,z:8.25}])}));
    f.mini({x:.25,z:8.25});assert.equal(f.sent.length,count,'currently hidden destination is rejected');
    f.receive(controlsState(f.map));
    f.mini({x:7.25,z:8.25},{button:0,id:8});
    assert.equal(f.sent.length,count);near(f.w.cameraTarget.x,7.25);near(f.w.cameraTarget.z,8.25);
    f.pointer(f.minimap,'pointerup',{x:1000,y:120,button:0,id:8});
    f.w.ui.orderTargetToggle.click();assert.equal(f.w.tapOrderArmed,true);
    f.mini({x:32,z:0},{button:0,pointerType:'touch'});
    assert.equal(f.sent.length,count);assert.equal(f.w.tapOrderArmed,true);
    f.mini({x:0.25,z:8.25},{button:0,pointerType:'touch'});
    assert.equal(f.sent.length,count+1);assert.equal(f.w.tapOrderArmed,false);
    f.mini({x:-32,z:-32});assert.equal(f.sent.length,count+2,'inclusive lower map edge is valid clear land');
    near(f.sent.at(-1).x,-32);near(f.sent.at(-1).z,-32);
  });

  test(`seat ${team}: actual disclosure clears selection on fog, omission, reclaim, lifecycle, corrupt/duplicate rows and epoch`,async t=>{
    const f=await fixture(t,team),node=own(team);
    const cases=[
      ['fog',controlsState(f.map,{visibility:visibilityFor(f.map,[node])})],
      ['omission',controlsState(f.map,{resourceNodes:[]})],
      ['missing list',controlsState(f.map,{resourceNodes:undefined})],
      ['malformed list',controlsState(f.map,{resourceNodes:{}})],
      ['opponent claim',rowState(f,{wildlifeTeam:1-team})],
      ['neutral claim',rowState(f,{wildlifeTeam:null})],
      ['carcass',rowState(f,{wildlifeState:'carcass',wildlifeActivity:undefined,stock:99.75})],
      ['depleted',rowState(f,{wildlifeState:'depleted',wildlifeActivity:undefined,stock:0})],
      ['invalid heading',rowState(f,{wildlifeHeading:Infinity})],
      ['private route',rowState(f,{wildlifeHerd:{path:[4]}})],
      ['duplicate row',controlsState(f.map,{resourceNodes:[...controlsState(f.map).resourceNodes,
        controlsState(f.map).resourceNodes.find(row=>row.id===node.id)]})],
      ['missing epoch',controlsState(f.map,{forestEpoch:undefined})],
      ['epoch',controlsState(f.map,{forestEpoch:8})],
    ];
    for(const [label,state]of cases) {
      f.receive(controlsState(f.map));f.click(node);selected(f,node.id);
      f.w.ui.orderTargetToggle.click();f.receive(state);cleared(f);
      assert.equal(f.w.tapOrderArmed,false,label);const count=f.sent.length;f.key('s');
      assert.equal(f.sent.length,count,`${label}: stale selection has no Stop payload`);
      if(!['opponent claim','neutral claim','carcass','epoch'].includes(label))
        assert.equal(f.w.wildlifeRenderer.isAvailable(node.id),false,`${label}: hidden/corrupt art is unavailable`);
    }
    f.receive(controlsState(f.map));f.click(node);selected(f,node.id);
    f.w.mapDefinition=structuredClone(f.map);f.receive(controlsState(f.map));cleared(f);
    assert.equal(f.w.latestWildlifeView.map,f.w.mapDefinition,'rebuilt same-ID map context cannot preserve selection');
    f.w.mapDefinition=f.map;
    f.receive(controlsState(f.map));f.click(node);
    f.welcome();cleared(f);assert.equal(f.w.latestWildlifeView.resourceEpoch,7,'same-epoch welcome also clears selection');
    f.click(node);f.welcome(controlsState(f.map),f.map,1-team);cleared(f);
    assert.equal(f.w.localTeam,1-team);assert.equal(f.w.latestWildlifeView.team,1-team);
  });

  test(`seat ${team}: actual relocated pose drives picking, fog and current selection ring`,async t=>{
    const f=await fixture(t,team),node=own(team),actual={x:team===0?-24.25:24.25,z:24.25};
    f.receive(rowState(f,actual));f.click(node);cleared(f);f.click(actual);selected(f,node.id);
    const matrix=new THREE.Matrix4();f.w.selectionMesh.getMatrixAt(0,matrix);
    near(matrix.elements[12],actual.x);near(matrix.elements[14],actual.z);
    f.receive(rowState(f,actual,{visibility:visibilityFor(f.map,[actual])}));cleared(f);
    assert.equal(f.w.wildlifeRenderer.isAvailable(node.id),false,'authored visible cell provides no relocated sight');
  });

  test(`seat ${team}: unit, box, control-group, whole-army and Escape selection never put Sheep IDs into army commands`,async t=>{
    const f=await fixture(t,team),node=own(team),worker=controlsUnits.find(row=>row[1]===team&&row[5]==='worker');
    f.click(node);f.click({x:worker[2],z:worker[3]});cleared(f);assert.deepEqual([...f.w.selected],[worker[0]]);
    f.key('1',{code:'Digit1',ctrlKey:true});assert.deepEqual([...f.w.controlGroups[0]],[worker[0]]);
    f.click(node);selected(f,node.id);f.key('1',{code:'Digit1'});cleared(f);
    assert.deepEqual([...f.w.selected],[worker[0]]);
    f.right({x:-1.5,z:12.5});assert.equal(f.sent.at(-1).type,'move');
    assert.deepEqual(f.sent.at(-1).ids,[worker[0]]);assert.deepEqual(f.sent.at(-1).unitGenerations,[worker[8]]);
    f.click(node);f.key('1',{code:'Digit1',ctrlKey:true});cleared(f);
    assert.deepEqual([...f.w.controlGroups[0]],[worker[0]],'Sheep-only assignment does not overwrite a numeric unit group');
    f.click(node);f.key('a');cleared(f);assert.equal(f.w.selected.size,2);
    assert.ok([...f.w.selected].every(Number.isInteger));
    f.click(node);const p=f.screen({x:worker[2]-2,z:worker[3]-2}),q=f.screen({x:worker[2]+2,z:worker[3]+2});
    f.pointer(f.canvas,'pointerdown',p);f.pointer(f.canvas,'pointermove',q);f.pointer(f.canvas,'pointerup',q);
    cleared(f);assert.ok(f.w.selected.has(worker[0]));
    f.click(node);f.w.ui.orderTargetToggle.click();f.key('Escape');
    assert.equal(f.w.tapOrderArmed,false);selected(f,node.id);f.key('Escape');cleared(f);
  });

  test(`seat ${team}: building picking/rally stays separate and Worker Gather still targets foreign Sheep/carcass`,async t=>{
    const f=await fixture(t,team),node=own(team),worker=controlsUnits.find(row=>row[1]===team&&row[5]==='worker');
    const building={id:77,type:'barracks',team,x:-1.5,z:-20.5,complete:true,progress:1,hp:1800,maxHp:1800,productionQueue:[]};
    const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());
    group.position.set(building.x,1,building.z);group.add(mesh);f.w.scene.add(group);
    f.w.buildingVisuals.set(building.id,{group});f.w.latestBuildings=[building];
    t.after(()=>{mesh.geometry.dispose();mesh.material.dispose();});
    f.click(node);f.click(building);cleared(f);assert.equal(f.w.selectedBuildingId,77);
    f.right({x:-1.5,z:-14.5});assert.equal(f.sent.at(-1).type,'setRallyPoint');assert.equal(f.sent.at(-1).buildingId,77);
    f.click(node);selected(f,node.id);
    f.click({x:worker[2],z:worker[3]});cleared(f);assert.deepEqual([...f.w.selected],[worker[0]]);
    const foreign=own(1-team);f.right(foreign);let command=f.sent.at(-1);
    assert.equal(command.type,'gather');assert.equal(command.nodeId,foreign.id);
    assert.deepEqual(command.ids,[worker[0]]);assert.equal(command.resourceEpoch,undefined);
    const state=controlsState(f.map);state.resourceNodes=state.resourceNodes.map(row=>row.id===foreign.id
      ? {...row,wildlifeState:'carcass',stock:12.25,wildlifeActivity:undefined,x:16.5,z:12.5}:row);
    f.receive(state);f.right({x:16.5,z:12.5});command=f.sent.at(-1);
    assert.equal(command.type,'gather');assert.equal(command.nodeId,foreign.id);assert.deepEqual(command.ids,[worker[0]]);
    assert.ok(f.sent.every(row=>!row.ids||row.ids.every(Number.isInteger)));
  });
}

test('production input → HTTP/WS authoritative two-seat natural claim, Herd movement and Stop', {timeout:45_000},async t=>{
  const server=await createFortifiedFixture({mapPath:null,matchModeId:'authored',timeoutMs:18_000});t.after(()=>server.dispose());await server.start();
  const clients=[await server.connect(0),await server.connect(1)];
  const authored={id:'sheep-client-input-native',name:'Sheep Client Input Native',width:160,height:160,
    terrainSeed:17,terrainBase:'meadow',fogOfWar:true,startingArmySize:8,
    startingResources:{food:0,wood:250},spawnPoints:[{team:0,x:-14.5,z:-5.5},{team:1,x:14.5,z:-5.5}],
    obstacles:[],triggers:[],scenarioEvents:[],resourceNodes:[
      {id:'owned-sheep-0',type:'food',stock:100,x:-9.5,z:-4.5,wildlifeSpecies:'bellweather-sheep'},
      {id:'owned-sheep-1',type:'food',stock:100,x:9.5,z:-4.5,wildlifeSpecies:'bellweather-sheep'},
    ]};
  const afterPublish=clients.map(client=>client.messages.length);clients[0].send({type:'publishMap',map:authored});
  const publication=await clients[0].wait(message=>message.type==='mapPublished'||message.type==='mapRejected',
    'ordinary Sheep arena publication result',afterPublish[0]);
  assert.equal(publication.type,'mapPublished',publication.message);
  const applied=await Promise.all(clients.map((client,team)=>client.wait(message=>message.type==='mapChange'
    &&message.state.mapId===authored.id,'ordinary normal map publication',afterPublish[team])));
  const map=applied[0].map;
  const helper=await fetch(`http://127.0.0.1:${server.port}/src/wildlife-client-state.mjs`);
  assert.equal(helper.status,200);assert.match(await helper.text(),/export function createWildlifeCommand/);
  const main=await fetch(`http://127.0.0.1:${server.port}/src/main.js`);
  assert.equal(main.status,200);assert.equal(await main.text(),readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),
    'HTTP delivers the same production main source whose handlers this fixture executes');
  await Promise.all(clients.map(async(client,team)=>{
    const worker=client.latest.units.find(row=>row[1]===team&&row[5]==='worker'),source=map.resourceNodes[team];
    await client.command({type:'move',ids:[worker[0]],unitGenerations:[worker[8]],x:source.x+(team===0?-1:1),z:source.z,
      clientOrderToken:900+team},/^MOVE ORDER/);
    await client.state(state=>state.resourceNodes.some(row=>row.id===source.id&&row.wildlifeTeam===team),'ordinary Worker naturally claims Sheep');
    // Friendly-unit picking intentionally wins a crowded click. Move the real
    // claimant away before clicking Sheep; an unattended claim must persist.
    await client.command({type:'move',ids:[worker[0]],unitGenerations:[worker[8]],x:source.x+(team===0?-6:6),z:source.z,
      clientOrderToken:910+team},/^MOVE ORDER/);
    await client.state(state=>{
      const unit=state.units.find(row=>row[0]===worker[0]),sheep=state.resourceNodes.find(row=>row.id===source.id);
      return unit&&sheep&&sheep.wildlifeTeam===team&&Math.hypot(unit[2]-sheep.x,unit[3]-sheep.z)>5;
    },'claim persists after ordinary Worker departure and Sheep can be picked');
  }));
  const claimed=await server.checkpoint(saved=>saved.mapDefinition.id===map.id
    &&saved.state.resourceNodes.every(row=>row.wildlifeTeam===Number(row.id.at(-1))));
  assert.deepEqual(claimed.state.teamFood,[0,0]);assert.equal(claimed.state.resourceNodes.reduce((sum,row)=>sum+row.stock,0),200);
  assert.ok(claimed.state.units.every(unit=>unit.cargo===0));
  const observedHerd=new Map(),stopAnchors=new Map();
  for(const [team,client]of clients.entries()) {
    const f=await fixture(t,team,{map,state:client.latest,onSend:command=>client.send(command)});
    const bridge=event=>f.receive(JSON.parse(event.data));client.socket.addEventListener('message',bridge);
    t.after(()=>client.socket.removeEventListener('message',bridge));
    f.welcome(client.latest,map,team);
    // Inspect the animal at a normal local zoom. At a whole-160-map overview,
    // nearby friendly units correctly win the existing pixel-sized pick radius.
    f.w.camera.zoom=3;f.w.camera.updateProjectionMatrix();
    const source=client.latest.resourceNodes.find(row=>row.id===map.resourceNodes[team].id);
    assert.ok(source);assert.equal(f.w.latestWildlifeView.rows.has(map.resourceNodes[1-team].id),false,'real seat fog hides remote Sheep');
    f.click(source);selected(f,source.id);const target={x:source.x+(team===0?2:-2),z:source.z};
    assert.equal(f.w.wildlifeEndpointLegal(target),true,'native Herd destination is current visible legal land');
    const after=client.messages.length;
    if(team===0)f.right(target);
    else {f.w.ui.orderTargetToggle.click();f.mini(target,{button:0,pointerType:'touch'});}
    const command=f.sent.at(-1);payload(command,'herd',source.id,client.latest.forestEpoch);
    await client.wait(message=>message.type==='notice'&&message.clientOrderToken===command.clientOrderToken
      &&/^HERD ORDER/.test(message.message),'normal input Herd acknowledged',after);
    assert.equal(f.w.ui.orderStatus.dataset.state,'applied');
    const movedState=await client.state(state=>state.resourceNodes.some(row=>row.id===source.id&&Math.hypot(row.x-source.x,row.z-source.z)>.3),
      'real Sheep position moves after ordinary client input');
    const moved=f.w.latestWildlifeView.rows.get(source.id);assert.ok(Math.hypot(moved.x-source.x,moved.z-source.z)>.3);
    observedHerd.set(source.id,{start:{x:source.x,z:source.z},pose:{x:moved.x,z:moved.z},tick:movedState.tick});
    const stopAfter=client.messages.length;
    if(team===0)f.key('s');else f.w.document.querySelector('[data-stationary-order="stop"]').click();
    const stop=f.sent.at(-1);payload(stop,'stopWildlife',source.id,client.latest.forestEpoch);
    await client.wait(message=>message.type==='notice'&&message.clientOrderToken===stop.clientOrderToken
      &&/^SHEEP STOP ORDER/.test(message.message),'normal input Stop acknowledged',stopAfter);
    assert.equal(f.w.ui.orderStatus.dataset.state,'applied');
    const stopSaved=await server.checkpoint(saved=>saved.mapDefinition.id===map.id&&saved.state.tickNumber>=movedState.tick
      &&saved.state.resourceNodes.find(row=>row.id===source.id)?.wildlifeHerd===null);
    const stoppedRow=stopSaved.state.resourceNodes.find(row=>row.id===source.id),anchor=stoppedRow.wildlifeGrazeAnchor;
    const elapsedTicks=stopSaved.state.tickNumber-movedState.tick;
    assert.ok(Math.hypot(anchor.x-moved.x,anchor.z-moved.z)<=SHEEP_HERD_SPEED*elapsedTicks/30+1e-8,
      'Stop anchors the reached pose within the actual saved-tick movement budget');
    stopAnchors.set(source.id,{x:anchor.x,z:anchor.z});
  }
  const stopped=await server.checkpoint(saved=>saved.mapDefinition.id===map.id
    &&saved.state.resourceNodes.every(row=>row.wildlifeHerd===null));
  assert.deepEqual(stopped.state.teamFood,[0,0]);assert.deepEqual(stopped.state.teamWood,[250,250]);
  assert.ok(stopped.state.units.every(unit=>unit.cargo===0));
  for(const row of stopped.state.resourceNodes) {
    assert.equal(row.stock,100);assert.equal(row.wildlifeState,'alive');
    assert.equal(row.wildlifeTeam,Number(row.id.at(-1)));
    const observed=observedHerd.get(row.id),anchor=row.wildlifeGrazeAnchor;
    assert.ok(Math.hypot(observed.pose.x-observed.start.x,observed.pose.z-observed.start.z)>.3,
      'each seat observed real Herd movement before Stop');
    assert.deepEqual(anchor,stopAnchors.get(row.id),'later grazing preserves the checkpointed Stop anchor');
    assert.ok(Math.hypot(row.x-anchor.x,row.z-anchor.z)<=SHEEP_WANDER_RADIUS+1e-8,
      'subsequent grazing stays bounded around the Stop pose');
  }
  t.diagnostic('Actual production DOM handlers + Three CPU picking + disclosed native fog → real HTTP/WS worker, automatic claims, ACKs, motion and Stop. No capture globals, GPU pixels, owner/stock/position/checkpoint injection, or native-browser appearance claim.');
});
