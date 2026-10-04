import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { createRoomLobby } from '../src/room-lobby-ui.mjs';
import { NORMAL_MATCH_MAP_ID, NORMAL_HUMAN_MATCH_MODE } from '../src/match-modes.mjs';
import { terrainHeightField } from '../src/terrain-height.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { createNeutralWildlifeRenderer } from '../src/neutral-wildlife-renderer.mjs';
import { readDisclosedWildlife, selectOwnedWildlife } from '../src/wildlife-client-state.mjs';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const SHEEP_IDS=['s0-home-food','s0-terrace-food','s1-home-food','s1-terrace-food'];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≈ ${b}`);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=value=>({matchModeId:value.matchModeId,matchModeVersion:value.matchModeVersion});
const cellFor=(map,point)=>Math.floor(point.z+map.height/2)*map.width+Math.floor(point.x+map.width/2);
function currentlyVisible(map,state,point) {
  if(!Number.isFinite(point?.x)||!Number.isFinite(point.z)||point.x< -map.width/2
    ||point.x>=map.width/2||point.z< -map.height/2||point.z>=map.height/2)return false;
  const cell=cellFor(map,point),bytes=Buffer.from(state.visibility.data,'base64');
  return ((bytes[cell>>2]>>((cell&3)*2))&3)===2;
}

// Geometry proof against the real public terrain, elevation and Town Center
// contracts. Actual Worker claim/Gather/recovery is the separate native slice.
function accessibleFromWorker(map,state,sheep) {
  const field=terrainHeightField(map),blocked=new Uint8Array(map.width*map.height);
  for(const obstacle of map.obstacles)for(let row=obstacle.row;row<obstacle.row+obstacle.height;row++)
    for(let column=obstacle.column;column<obstacle.column+obstacle.width;column++)blocked[row*map.width+column]=1;
  for(const team of [0,1])for(const cell of townCenterFootprintCells(map.spawnPoints,team,map.width,map.height))blocked[cell]=1;
  assert.equal(blocked[cellFor(map,sheep)],0,'opening Sheep stands on legal land');
  const queue=[],seen=new Uint8Array(blocked.length);
  for(const worker of state.units.filter(row=>row[5]==='worker'&&row[4]>0)) {
    const cell=cellFor(map,{x:worker[2],z:worker[3]});
    if(!blocked[cell]&&!seen[cell]){seen[cell]=1;queue.push(cell);}
  }
  for(let index=0;index<queue.length;index++) {
    const cell=queue[index],column=cell%map.width,row=Math.floor(cell/map.width);
    const point={x:column-map.width/2+.5,z:row-map.height/2+.5};
    if(Math.hypot(point.x-sheep.x,point.z-sheep.z)<=1.4)return true;
    for(const next of [column>0?cell-1:-1,column+1<map.width?cell+1:-1,
      row>0?cell-map.width:-1,row+1<map.height?cell+map.width:-1]) {
      if(next<0||seen[next]||!canTraverseUnitStep(cell,next,map.width,field.levels,target=>!blocked[target]))continue;
      seen[next]=1;queue.push(next);
    }
  }
  return false;
}

// Start the actual manager with only disposable storage/network settings. In
// particular, no RTS_MAP, internal fixture, practice flag or gameplay override
// selects the default map, units, stock, owners or positions in this proof.
async function managedRoomServer() {
  const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const directory=await mkdtemp(path.join(os.tmpdir(),'rts-tiny-sheep-entry-'));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('RTS_')));
  Object.assign(env,{PORT:String(port),RTS_HOST:'127.0.0.1',RTS_ROOM_DATA_DIRECTORY:directory});
  const child=spawn(process.execPath,['room-supervisor.mjs'],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});
  const origin=`http://127.0.0.1:${port}`,clients=new Set();let logs='';
  for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{logs=(logs+bytes).slice(-8000);});
  async function dispose() {
    for(const socket of clients)socket.close();
    if(child.exitCode===null&&child.signalCode===null) {
      const exited=once(child,'exit');child.kill('SIGINT');
      let timeout;
      await Promise.race([exited,new Promise(resolve=>{timeout=setTimeout(resolve,9000);})]);clearTimeout(timeout);
      if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}
    }
    await rm(directory,{recursive:true,force:true});
  }
  async function start() {
    const deadline=Date.now()+15_000;
    while(Date.now()<deadline) {
      if(child.exitCode!==null||child.signalCode!==null)throw new Error(`Supervisor exited: ${logs}`);
      try{if((await fetch(`${origin}/health`,{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}
      await sleep(50);
    }
    throw new Error(`Supervisor health timeout: ${logs}`);
  }
  async function connect(roomId,team,{holdMessages=false}={}) {
    const socket=new WebSocket(`ws://127.0.0.1:${port}/ws?room=${encodeURIComponent(roomId)}`,['rts-v1']);clients.add(socket);
    const messages=[],pending=new Set(),held=[];let latest=null,lobby=null;
    function wait(predicate,label,after=0) {
      const found=messages.slice(after).find(predicate);if(found)return Promise.resolve(found);
      return new Promise((resolve,reject)=>{
        const waiter={predicate,resolve,reject,timer:setTimeout(()=>{
          pending.delete(waiter);reject(new Error(`${label} timeout: ${logs}`));
        },15_000)};pending.add(waiter);
      });
    }
    function receive(message) {
      messages.push(message);
      if(message.type==='state')latest=message;else if(message.state)latest=message.state;
      if(message.lobby)lobby=message.lobby;else if(message.state?.lobby)lobby=message.state.lobby;
      for(const waiter of pending)if(waiter.predicate(message)){
        pending.delete(waiter);clearTimeout(waiter.timer);waiter.resolve(message);
      }
    }
    socket.addEventListener('message',event=>{
      const message=JSON.parse(event.data);
      if(holdMessages&&message.type!=='welcome')held.push(message);
      else receive(message);
    });
    socket.addEventListener('close',()=>{
      for(const waiter of pending){clearTimeout(waiter.timer);waiter.reject(new Error(`Seat ${team} socket closed: ${logs}`));}
      pending.clear();
    });
    const welcome=await wait(message=>message.type==='welcome',`seat ${team} welcome`);
    assert.equal(welcome.player.team,team);
    return {socket,messages,welcome,wait,get latest(){return latest;},get lobby(){return lobby;},
      releaseMessages(){holdMessages=false;for(const message of held.splice(0))receive(message);},
      send(command){socket.send(JSON.stringify(command));}};
  }
  return {start,dispose,connect,origin};
}

function waitForConnectedSeats(client) {
  return client.wait(message=>{
    const lobby=message.lobby||message.state?.lobby;
    return lobby?.phase==='lobby'&&[0,1].every(team=>lobby.seats.some(seat=>seat.team===team&&seat.connected));
  },`seat ${client.welcome.player.team} observes both connected seats`);
}

async function readyInLobby(client,layout,team) {
  const after=client.messages.length;layout.button('lobby-ready').click();
  assert.equal(layout.sent.at(-1)?.type,'setReady');assert.equal(layout.sent.at(-1).ready,true);
  const response=await client.wait(message=>message.type==='lobbyRejected'
    ||message.type==='lobby'&&message.lobby.seats.some(seat=>seat.team===team&&seat.ready),'ordinary Ready accepted',after);
  assert.equal(response.type,'lobby',response.message);
}

function lobbyDOM(client,origin) {
  const dom=new JSDOM('<dialog id="room-lobby"></dialog>',{url:origin}),root=dom.window.document.querySelector('dialog'),sent=[];
  root.showModal=()=>{root.open=true;};root.close=()=>{root.open=false;};
  const ui=createRoomLobby({root,send:command=>{sent.push(command);client.send(command);return true;},copyInvite:()=>{}});
  const update=event=>{
    const message=JSON.parse(event.data),lobby=message.lobby||message.state?.lobby;
    if(lobby)ui.update(lobby,client.welcome.player,true,client.welcome.map);
    if(message.type==='lobbyRejected')ui.reject(message.message,message.lobby,client.welcome.player);
  };
  client.socket.addEventListener('message',update);ui.update(client.lobby,client.welcome.player,true,client.welcome.map);
  return {dom,root,sent,button:id=>root.querySelector(`#${id}`),
    close(){client.socket.removeEventListener('message',update);dom.window.close();}};
}

test('normal Create Room → Tiny/skirmish lobby launch discloses neutral accessible Sheep to both seats and renders the existing atlas',
  {timeout:40_000},async t=>{
    const files=['server.mjs','room-supervisor.mjs','maps/veyrholds-terraced-vale.json',
      'src/terraced-vale-sheep.mjs','src/neutral-wildlife-renderer.mjs'];
    const sourceBytes=Object.fromEntries(await Promise.all(files.map(async file=>[file,digest(await readFile(path.join(ROOT,file)))])));
    const server=await managedRoomServer();t.after(()=>server.dispose());await server.start();
    const statusResponse=await fetch(`${server.origin}/api/rooms/status`);assert.equal(statusResponse.status,200);
    const status=await statusResponse.json();assert.equal(status.enabled,true);
    assert.equal(status.ordinarySetup.minimumSide,160);assert.deepEqual(identity(status.ordinarySetup),NORMAL_HUMAN_MATCH_MODE);
    assert.equal(status.ordinarySetup.defaultMapId,NORMAL_MATCH_MAP_ID);
    const response=await fetch(`${server.origin}/api/rooms`,{method:'POST',headers:{'content-type':'application/json',origin:server.origin},
      body:JSON.stringify({mode:'pvp',pregame:true})});assert.equal(response.status,201);
    const created=await response.json();assert.deepEqual(created.launchOptions,{mode:'pvp',pregame:true,...NORMAL_HUMAN_MATCH_MODE});
    const clients=[await server.connect(created.roomId,0),await server.connect(created.roomId,1)];
    // Guest admission invalidates the host's welcome revision. Observe that
    // update on each socket before constructing controls or sending Ready.
    await Promise.all(clients.map(waitForConnectedSeats));
    const layouts=clients.map(client=>lobbyDOM(client,server.origin));t.after(()=>layouts.forEach(layout=>layout.close()));
    const shipped=JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json',import.meta.url)));
    for(const [team,client]of clients.entries()) {
      const {map}=client.welcome,state=client.latest,layout=layouts[team];
      assert.equal(map.id,NORMAL_MATCH_MAP_ID);assert.deepEqual(identity(client.welcome),NORMAL_HUMAN_MATCH_MODE);
      assert.equal(map.width,160);assert.equal(map.height,160);assert.equal(map.startingArmySize,24);
      assert.deepEqual(map.startingResources,{food:150,wood:250});assert.equal(map.fogOfWar,true);
      const choice=client.welcome.maps.find(row=>row.id===map.id);
      assert.ok(choice.selectable&&choice.ordinarySelectable&&!choice.internalFixture);assert.equal(choice.sizeTierLabel,'Tiny');
      assert.ok(client.welcome.maps.every(row=>row.width>=160&&row.height>=160&&row.selectable&&!row.internalFixture));
      assert.equal(layout.button('lobby-map').value,map.id);assert.equal(layout.button('lobby-map').selectedOptions[0].disabled,false);
      assert.equal(layout.button('lobby-match-mode').value,'skirmish@1');
      assert.equal(layout.button('lobby-army-size').value,'24');assert.equal(layout.button('lobby-ready').disabled,false);
      assert.deepEqual(map.resourceNodes,shipped.resourceNodes,'normal public map retains every authored resource ID, stock and pose');
      assert.deepEqual(map.resourceNodes.filter(row=>row.wildlifeSpecies==='bellweather-sheep').map(row=>row.id),SHEEP_IDS);
      assert.equal(map.resourceNodes.filter(row=>row.type==='food').reduce((total,row)=>total+row.stock,0),6100);
      assert.equal(map.resourceNodes.filter(row=>row.type==='wood').reduce((total,row)=>total+row.stock,0),7950);
      assert.equal(state.scenarioClockStarted,false);assert.equal(client.lobby.phase,'lobby');
    }
    for(const [team,client]of clients.entries())await readyInLobby(client,layouts[team],team);
    await clients[0].wait(message=>message.type==='lobby'&&message.lobby.canLaunch,'both real seats ready');
    assert.equal(layouts[0].button('lobby-launch').disabled,false);assert.equal(layouts[1].button('lobby-launch').hidden,true);
    const launchAfter=clients.map(client=>client.messages.length);layouts[0].button('lobby-launch').click();
    const states=await Promise.all(clients.map((client,team)=>client.wait(message=>message.type==='state'
      &&message.scenarioClockStarted===true&&message.lobby?.phase==='running','ordinary Launch accepted',launchAfter[team])));
    assert.deepEqual(layouts.flatMap(layout=>layout.sent).map(command=>command.type),['setReady','launchMatch','setReady']);
    assert.ok(layouts.every(layout=>!layout.root.open),'real lobby closes after accepted launch');

    const nativeFetch=globalThis.fetch,NativeImage=globalThis.Image,assetRequests=[];
    globalThis.fetch=(input,options)=>{
      const url=new URL(typeof input==='string'?input:input.href||input.url);
      if(url.protocol==='file:') {
        const relative=path.relative(ROOT,fileURLToPath(url));assert.ok(relative.startsWith('assets/wildlife/bellweather-sheep-static-v1/'));
        assetRequests.push(relative);return nativeFetch(`${server.origin}/${relative}`,options);
      }
      return nativeFetch(input,options);
    };
    globalThis.Image=class {
      async decode(){const pixels=decodeRgba8(Buffer.from(await(await nativeFetch(this.src)).arrayBuffer()));this.width=pixels.width;this.height=pixels.height;}
    };
    const renderers=[];
    try {
      for(const [team,state]of states.entries()) {
        const map=clients[team].welcome.map,ownId=`s${team}-home-food`,field=terrainHeightField(map);
        assert.deepEqual(identity(state),NORMAL_HUMAN_MATCH_MODE);assert.equal(state.mapId,map.id);assert.equal(state.armySize,24);
        assert.equal(state.food[team],150);assert.equal(state.food[1-team],null);assert.equal(state.wood[team],250);assert.equal(state.wood[1-team],null);
        assert.equal(state.rosterSize,12,'seat roster count respects actual fog');assert.equal(state.units.length,12);
        assert.deepEqual(state.units.map(row=>row[0]),Array.from({length:12},(_,index)=>index+team*12));
        assert.ok(state.units.every(row=>row[1]===team&&row[4]>0&&row[6]===0&&row[7]===null));
        const visible=point=>currentlyVisible(map,state,point),view=readDisclosedWildlife(map,state,team,visible),row=view?.rows.get(ownId);
        assert.ok(row,`seat ${team} sees its opening home Sheep`);assert.equal(row.wildlifeState,'alive');assert.equal(row.wildlifeTeam,null);assert.equal(row.stock,650);
        assert.equal(selectOwnedWildlife(view,ownId),null,'neutral food is not owned merely because it is visible');
        assert.equal(view.rows.has(`s${1-team}-home-food`),false,'opposing home Sheep is fog filtered');
        assert.ok(accessibleFromWorker(map,state,row),'a living ordinary Worker has a legal land/elevation route into claim/Gather range');
        const scene=new THREE.Scene(),renderer=createNeutralWildlifeRenderer({THREE,scene,groundHeight:field.sample});renderers.push(renderer);
        renderer.reset(map.resourceNodes,map);await renderer.ready();renderer.reconcile(state.resourceNodes,visible);
        const camera=new THREE.OrthographicCamera(-15,15,15,-15,.1,500);camera.position.set(row.x,60,row.z+60);
        camera.lookAt(row.x,field.sample(row.x,row.z),row.z);camera.updateMatrixWorld();renderer.update(camera);
        const group=scene.children.find(node=>node.userData.wildlifeNodeId===ownId),art=group?.children[2];
        assert.equal(renderer.diagnostics().artStatus,'ready','existing runtime atlas loads through actual managed HTTP');
        assert.ok(group?.visible&&art?.isMesh&&art.visible&&art.material.map);
        assert.equal(art.material.map.image.width,2048);assert.equal(art.material.map.image.height,1024);
        near(group.position.x,row.x);near(group.position.z,row.z);near(group.position.y,field.sample(row.x,row.z));
        near(group.children[0].rotation.y,row.wildlifeHeading);
        assert.ok(scene.children.filter(node=>node.userData.wildlifeNodeId!==ownId).every(node=>!node.visible),
          'only currently disclosed live Sheep enter this opening seat scene');
      }
    } finally {for(const renderer of renderers)renderer.dispose();globalThis.fetch=nativeFetch;globalThis.Image=NativeImage;}
    assert.equal(assetRequests.filter(file=>file.endsWith('sheep-atlas-runtime.png')).length,2);
    const finalBytes=Object.fromEntries(await Promise.all(files.map(async file=>[file,digest(await readFile(path.join(ROOT,file)))])));
    assert.deepEqual(finalBytes,sourceBytes,'proof source bytes remained stable during the managed entry run');
    t.diagnostic(JSON.stringify({normalCreateRoom:true,twoRealSeats:true,normalReadyLaunch:true,mapId:NORMAL_MATCH_MAP_ID,
      matchMode:NORMAL_HUMAN_MATCH_MODE,typedSheep:SHEEP_IDS,foodStock:6100,woodNodeStock:7950,
      sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),sourceBytes,
      limits:['CPU Three scene/atlas and DOM lobby protocol; no native-browser/GPU appearance claim.',
        'Access uses production terrain traversal; separate native scenario owns actual claim/Gather/recovery.']}));
  });

test('delayed host seat updates retain the Ready revision guard and require observing guest admission',
  {timeout:40_000},async t=>{
    const server=await managedRoomServer();t.after(()=>server.dispose());await server.start();
    const response=await fetch(`${server.origin}/api/rooms`,{method:'POST',headers:{'content-type':'application/json',origin:server.origin},
      body:JSON.stringify({mode:'pvp',pregame:true})});assert.equal(response.status,201);
    const {roomId}=await response.json(),host=await server.connect(roomId,0,{holdMessages:true}),guest=await server.connect(roomId,1);
    await waitForConnectedSeats(guest);
    assert.equal(host.lobby.seats.length,1,'host still has its welcome revision');
    let observed=false;const admitted=waitForConnectedSeats(host).then(()=>{observed=true;});
    await Promise.resolve();assert.equal(observed,false,'guest welcome alone cannot satisfy the host observation');
    const after=host.messages.length;host.send({type:'setReady',ready:true,revision:host.lobby.revision});
    host.releaseMessages();
    const rejected=await host.wait(message=>message.type==='lobbyRejected','stale Ready rejected',after);
    assert.equal(rejected.message,'Lobby changed. Review the settings and ready again.');
    assert.ok(rejected.lobby.revision>host.welcome.state.lobby.revision);
    assert.ok(rejected.lobby.seats.every(seat=>!seat.ready));assert.equal(rejected.lobby.canLaunch,false);
    await admitted;
    const layout=lobbyDOM(host,server.origin);t.after(()=>layout.close());
    await readyInLobby(host,layout,0);
    assert.equal(host.lobby.seats.find(seat=>seat.team===0).ready,true);
    assert.equal(host.lobby.seats.find(seat=>seat.team===1).ready,false);
    assert.equal(host.lobby.canLaunch,false,'one accepted Ready cannot launch without the other real seat');
  });
