// Runs inside the project-owned offscreen diagnostic browser, using the actual
// instanced sprite runtime. No live game state is changed by this probe.
export async function probeCastRuntimeClipping() {
  const THREE = await import('/vendor/three.module.js');
  const { createUnitSpriteRuntime } = await import('/src/unit-sprite-runtime.mjs');
  const roles = ['human', 'orc', 'elf', 'troll'];
  const directions = ['north','north-east','east','south-east','south','south-west','west','north-west'];
  const packs = await Promise.all(roles.map(role => fetch(`/assets/units/cast-${role}-sprite-v1/sprite-atlas-pack-v1.json`).then(r=>r.json())));
  if (packs.some(pack => pack.packVersion !== '0.3.0')) throw new Error('Full-pose v0.3 packs are required');
  const renderer = new THREE.WebGLRenderer({alpha:true,antialias:false});
  renderer.setSize(256,128); renderer.setClearColor(0,0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4,4,2,-2,0.1,100);
  camera.position.set(8,10,8);camera.lookAt(0,0.5,0);camera.updateMatrixWorld(true);
  const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({color:0x334455}));
  ground.rotation.x=-Math.PI/2;scene.add(ground);
  const runtime = createUnitSpriteRuntime({THREE,scene,capacity:4,teamHex:[0x4093ce,0xce6240],cameraQuaternion:camera.quaternion,roles,castPreview:true});
  if (!await runtime.ready) throw new Error('Runtime packs did not load');
  const target = new THREE.WebGLRenderTarget(256,128,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType});
  const baseline = new Uint8Array(256*128*4),source = new Uint8Array(baseline.length),actual = new Uint8Array(baseline.length);
  const read = destination => {renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,256,128,destination);};
  const report = {packs:packs.map(pack=>({id:pack.packId,version:pack.packVersion})),frames:0,posesPerSpecies:0,teams:[0,1],zooms:[1,0.48],directions,states:{},maxCompositeChannelError:0,clippedOpaquePixels:0,previews:[]};
  for (const zoom of report.zooms) {
    camera.zoom=zoom;camera.updateProjectionMatrix();
    for (const team of report.teams) {
      runtime.setCount(team,4);runtime.setCount(1-team,0);
      runtime.setVisible(false);ground.visible=true;read(baseline);runtime.setVisible(true);
      for (let heading=0;heading<8;heading++) for(const state of ['idle','walk','gather','defeat']) {
        const clip = packs[0].assets[0].clips.find(clip=>clip.stateId===state&&clip.directionId===directions[heading]);
        let elapsed=0;
        for(let frame=0;frame<clip.sequence.length;frame++) {
          const now=1000+elapsed+1;
          for(let slot=0;slot<4;slot++) {
            const ownClip=packs[slot].assets[0].clips.find(clip=>clip.stateId===state&&clip.directionId===directions[heading]);
            if(ownClip.sequence.length!==clip.sequence.length || ownClip.sequence.some((pose,index)=>pose.durationMs!==clip.sequence[index].durationMs))throw new Error('Cast pose clocks differ');
            const position=right.clone().multiplyScalar((slot-1.5)*1.9);
            runtime.update({kind:'worker',team,slot,renderX:position.x,renderZ:position.z,angle:heading*Math.PI/4,
              hp:state==='defeat'?0:100,defeatStartedAt:state==='defeat'?1000:0,
              walking:state==='walk',task:state==='gather'?'gathering':'idle',
              spriteClockState:state,spriteClockStartedAt:1000},now,1);
          }
          runtime.markTeamDirty(team);
          ground.visible=false;read(source);ground.visible=true;read(actual);
          for(let x=0;x<256;x++) if(source[x*4+3] || source[((127*256)+x)*4+3])throw new Error('Pose touches diagnostic viewport edge');
          for(let y=0;y<128;y++) if(source[y*256*4+3] || source[(y*256+255)*4+3])throw new Error('Pose touches diagnostic viewport edge');
          let opaque=0,clipped=0,maxError=0;
          const coverage=[0,0,0,0];
          for(let index=0;index<source.length;index+=4) {
            const alpha=source[index+3]/255;
            if(alpha<0.9)continue;
            opaque++;
            const x=(index/4)%256;
            const slot=Math.max(0,Math.min(3,Math.floor((x-128)/(1.9*32*zoom)+2)));
            coverage[slot]++;
            let error=0;
            for(let channel=0;channel<3;channel++) {
              const expected=source[index+channel]+baseline[index+channel]*(1-alpha);
              error=Math.max(error,Math.abs(actual[index+channel]-expected));
            }
            maxError=Math.max(maxError,error);
            if(error>3)clipped++;
          }
          if(coverage.some(count=>count<3))throw new Error(`Missing species render: ${coverage} ${team}/${zoom}/${state}/${directions[heading]}/${frame}`);
          if(opaque<20)throw new Error(`Empty pose render: ${team}/${zoom}/${state}/${directions[heading]}/${frame}`);
          if(clipped)throw new Error(`Terrain clipped ${clipped}/${opaque} opaque pixels: ${team}/${zoom}/${state}/${directions[heading]}/${frame}; error=${maxError}`);
          report.frames++;report.states[state]=(report.states[state]||0)+4;
          report.maxCompositeChannelError=Math.max(report.maxCompositeChannelError,maxError);
          report.clippedOpaquePixels+=clipped;
          if(zoom===1&&heading===2&&frame===Math.floor(clip.sequence.length/2)) {
            renderer.setRenderTarget(null);renderer.render(scene,camera);
            report.previews.push({label:`${team===0?'azure':'ember'}-${state}-east`,png:renderer.domElement.toDataURL('image/png').split(',')[1]});
          }
          elapsed+=clip.sequence[frame].durationMs;
        }
      }
    }
  }
  report.posesPerSpecies=report.frames;
  renderer.dispose();target.dispose();
  return report;
}
