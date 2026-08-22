import * as THREE from '/vendor/three.module.js';
import { createPepeHeadController } from '/pepe-head-controller.js?v=34207';
const clamp01=v=>Math.min(1,Math.max(0,Number(v)||0));
function loadTexture(loader,url,{repeat=false}={}){return new Promise((resolve,reject)=>loader.load(url,tex=>{tex.colorSpace=THREE.SRGBColorSpace;tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;if(repeat){tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;}resolve(tex);},undefined,reject));}
function material(tex,{transparent=true,opacity=1,blending=THREE.NormalBlending}={}){return new THREE.MeshBasicMaterial({map:tex,transparent,opacity,depthWrite:false,depthTest:false,side:THREE.DoubleSide,blending});}

function makeExhaustTexture(kind='outer'){
  const c=document.createElement('canvas');
  c.width=512; c.height=256;
  const ctx=c.getContext('2d');
  const cy=128;

  ctx.clearRect(0,0,c.width,c.height);
  ctx.globalCompositeOperation='lighter';

  if(kind==='outer'){
    const g=ctx.createLinearGradient(20,0,505,0);
    g.addColorStop(0.00,'rgba(255,60,160,0)');
    g.addColorStop(0.16,'rgba(255,70,170,0.26)');
    g.addColorStop(0.43,'rgba(255,105,125,0.68)');
    g.addColorStop(0.72,'rgba(255,155,80,0.90)');
    g.addColorStop(0.91,'rgba(255,220,130,0.98)');
    g.addColorStop(1.00,'rgba(255,250,225,1)');

    ctx.shadowColor='rgba(255,80,170,0.62)';
    ctx.shadowBlur=24;
    ctx.fillStyle=g;

    ctx.beginPath();
    ctx.moveTo(505,78);
    ctx.bezierCurveTo(430,82,325,94,145,113);
    ctx.bezierCurveTo(90,119,50,123,18,128);
    ctx.bezierCurveTo(50,133,90,138,145,144);
    ctx.bezierCurveTo(325,163,430,174,505,178);
    ctx.closePath();
    ctx.fill();
  }else{
    const g=ctx.createLinearGradient(70,0,505,0);
    g.addColorStop(0.00,'rgba(190,225,255,0)');
    g.addColorStop(0.22,'rgba(210,235,255,0.30)');
    g.addColorStop(0.55,'rgba(255,240,190,0.88)');
    g.addColorStop(0.83,'rgba(255,250,220,1)');
    g.addColorStop(1.00,'rgba(255,255,255,1)');

    ctx.shadowColor='rgba(255,235,180,0.72)';
    ctx.shadowBlur=14;
    ctx.fillStyle=g;

    ctx.beginPath();
    ctx.moveTo(505,102);
    ctx.bezierCurveTo(400,105,270,113,92,125);
    ctx.bezierCurveTo(70,127,58,128,48,128);
    ctx.bezierCurveTo(58,129,70,131,92,133);
    ctx.bezierCurveTo(270,145,400,151,505,154);
    ctx.closePath();
    ctx.fill();
  }

  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  return tex;
}

function makeNozzleGlowTexture(){
  const c=document.createElement('canvas');
  c.width=256; c.height=256;
  const ctx=c.getContext('2d');

  const g=ctx.createRadialGradient(128,128,4,128,128,120);
  g.addColorStop(0.00,'rgba(255,255,245,1)');
  g.addColorStop(0.13,'rgba(255,235,170,0.98)');
  g.addColorStop(0.32,'rgba(255,135,70,0.75)');
  g.addColorStop(0.58,'rgba(255,70,155,0.30)');
  g.addColorStop(1.00,'rgba(255,40,150,0)');

  ctx.fillStyle=g;
  ctx.fillRect(0,0,256,256);

  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}

function makeSpaceTexture(kind='far'){
  const c=document.createElement('canvas');
  c.width=1024; c.height=1536;
  const ctx=c.getContext('2d');

  let seed=kind==='far'?617:kind==='mid'?911:kind==='near'?1427:1999;
  const rand=()=>{
    seed=(seed*1664525+1013904223)>>>0;
    return seed/4294967296;
  };

  if(kind==='far'){
    const bg=ctx.createLinearGradient(0,0,0,c.height);
    bg.addColorStop(0.00,'#02040d');
    bg.addColorStop(0.32,'#071128');
    bg.addColorStop(0.62,'#091833');
    bg.addColorStop(1.00,'#01040b');
    ctx.fillStyle=bg;
    ctx.fillRect(0,0,c.width,c.height);

    const nebula=(x,y,r,color)=>{
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,color);
      g.addColorStop(0.48,color.replace(/[\d.]+\)$/,'0.035)'));
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;
      ctx.fillRect(x-r,y-r,r*2,r*2);
    };

    nebula(230,360,500,'rgba(55,80,190,0.12)');
    nebula(790,760,610,'rgba(18,115,155,0.10)');
    nebula(560,1270,620,'rgba(80,35,125,0.08)');

    for(let i=0;i<220;i++){
      const x=rand()*c.width;
      const y=rand()*c.height;
      const r=rand()<0.90?rand()*1.15+0.25:rand()*2.0+1;
      ctx.fillStyle=`rgba(${190+Math.floor(rand()*65)},${205+Math.floor(rand()*50)},255,${0.20+rand()*0.50})`;
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    }
  }else if(kind==='speed'){
    ctx.clearRect(0,0,c.width,c.height);
    for(let i=0;i<80;i++){
      const x=rand()*c.width;
      const y=rand()*c.height;
      const len=35+rand()*100;
      ctx.strokeStyle=`rgba(170,220,255,${0.08+rand()*0.18})`;
      ctx.lineWidth=0.7+rand()*1.4;
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.lineTo(x-len,y+len);
      ctx.stroke();
    }
  }else{
    ctx.clearRect(0,0,c.width,c.height);

    const count=kind==='near'?115:270;
    for(let i=0;i<count;i++){
      const x=rand()*c.width;
      const y=rand()*c.height;
      const big=kind==='near' && rand()>0.87;
      const r=big?1.7+rand()*2.2:0.45+rand()*1.35;
      const a=kind==='near'?0.48+rand()*0.42:0.28+rand()*0.42;

      ctx.fillStyle=`rgba(${200+Math.floor(rand()*55)},${215+Math.floor(rand()*40)},255,${a})`;
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();

      if(big){
        ctx.strokeStyle=`rgba(210,235,255,${a*0.55})`;
        ctx.lineWidth=0.8;
        ctx.beginPath();
        ctx.moveTo(x-r*4,y);
        ctx.lineTo(x+r*4,y);
        ctx.moveTo(x,y-r*4);
        ctx.lineTo(x,y+r*4);
        ctx.stroke();
      }
    }
  }

  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;

  if(kind!=='far'){
    tex.wrapS=THREE.RepeatWrapping;
    tex.wrapT=THREE.RepeatWrapping;
  }

  return tex;
}

export function createRocketRideV34({scene,parent,baseUrl='/game-assets/rocket-v34/'}={}){
  if(!scene||!parent)throw new Error('[ROCKET V34.2] scene and parent required');
  const loader=new THREE.TextureLoader(),rideRoot=new THREE.Group(),rocketRoot=new THREE.Group(),backdrop=new THREE.Group(),flameRoot=new THREE.Group();
  rideRoot.name='RocketRideV34_2';rocketRoot.name='RocketBodyRootV34_2';backdrop.name='SpaceBackdropV34_2';flameRoot.name='FlameRootV34_2';
  parent.add(rideRoot);rideRoot.add(rocketRoot);rocketRoot.add(flameRoot);scene.add(backdrop);
  let head=null,farMesh,midMesh,nearMesh,speedMesh,rocketMesh,glassMesh,cockpitShadow,flameOuter,flameCore,flameGlow,nozzleGlow,ringMesh;
  const mats=[],geos=[],textures=[];
  const ready=Promise.all([
    loadTexture(loader,`${baseUrl}rocket/rocket-body.png`),loadTexture(loader,`${baseUrl}rocket/rocket-glass.png`),
    loadTexture(loader,`${baseUrl}flame/flame-outer.png`),loadTexture(loader,`${baseUrl}flame/flame-core.png`),
    loadTexture(loader,`${baseUrl}space/space-far.png`,{repeat:true}),loadTexture(loader,`${baseUrl}space/stars-mid.png`,{repeat:true}),
    loadTexture(loader,`${baseUrl}space/stars-near.png`,{repeat:true}),loadTexture(loader,`${baseUrl}space/speed-lines.png`,{repeat:true}),
    loadTexture(loader,`${baseUrl}fx/boost-ring.png`)
  ]).then(([rocketTex,glassTex,outerTex,coreTex,farTex,midTex,nearTex,speedTex,ringTex])=>{
    textures.push(rocketTex,glassTex,outerTex,coreTex,farTex,midTex,nearTex,speedTex,ringTex);

    // V34.6: use purpose-built live textures instead of the old flat PNG flame/space art.
    const liveOuterTex=makeExhaustTexture('outer');
    const liveCoreTex=makeExhaustTexture('core');
    const liveGlowTex=makeNozzleGlowTexture();

    const deepFarTex=makeSpaceTexture('far');
    const deepMidTex=makeSpaceTexture('mid');
    const deepNearTex=makeSpaceTexture('near');
    const deepSpeedTex=makeSpaceTexture('speed');

    textures.push(
      liveOuterTex,liveCoreTex,liveGlowTex,
      deepFarTex,deepMidTex,deepNearTex,deepSpeedTex
    );
    const rocketGeo=new THREE.PlaneGeometry(3.25,3.25),rocketMat=material(rocketTex);geos.push(rocketGeo);mats.push(rocketMat);
    rocketMesh=new THREE.Mesh(rocketGeo,rocketMat);rocketMesh.renderOrder=20;rocketRoot.add(rocketMesh);
    // Dark cockpit backing so the head feels inside the rocket, not pasted on top.
    const cabinGeo=new THREE.CircleGeometry(0.255,48),
      cabinMat=new THREE.MeshBasicMaterial({
        color:0x0b1623,
        transparent:true,
        opacity:0.34,
        depthWrite:false,
        depthTest:false,
        side:THREE.DoubleSide
      });
    geos.push(cabinGeo);mats.push(cabinMat);
    const cabinMesh=new THREE.Mesh(cabinGeo,cabinMat);
    cabinMesh.position.set(0.655,0.305,0.14);
    cabinMesh.renderOrder=29;
    rocketRoot.add(cabinMesh);

    const shadowGeo=new THREE.RingGeometry(0.178,0.258,64),
      shadowMat=new THREE.MeshBasicMaterial({
        color:0x02101a,
        transparent:true,
        opacity:0.22,
        depthWrite:false,
        depthTest:false,
        side:THREE.DoubleSide
      });
    geos.push(shadowGeo);mats.push(shadowMat);
    cockpitShadow=new THREE.Mesh(shadowGeo,shadowMat);
    cockpitShadow.position.set(0.655,0.305,0.19);
    cockpitShadow.renderOrder=41;
    rocketRoot.add(cockpitShadow);

    const headAnchor=new THREE.Group();
    headAnchor.position.set(0.655,0.305,0.06);
    rocketRoot.add(headAnchor);

    head=createPepeHeadController({parent:headAnchor,radius:0.238});

    const glassGeo=new THREE.PlaneGeometry(0.72,0.72),glassMat=material(glassTex,{opacity:0.82});geos.push(glassGeo);mats.push(glassMat);
    glassMesh=new THREE.Mesh(glassGeo,glassMat);
    glassMesh.position.set(0.655,0.305,0.22);
    glassMesh.renderOrder=50;
    rocketRoot.add(glassMesh);
    // Anchor flame exactly at the engine nozzle center.
    flameRoot.position.set(-0.512,-0.562,0.12);
    flameRoot.rotation.z=THREE.MathUtils.degToRad(45);

    const outerGeo=new THREE.PlaneGeometry(2.65,1.02),
      coreGeo=new THREE.PlaneGeometry(2.10,0.62),
      glowGeo=new THREE.PlaneGeometry(3.05,1.28);

    // Pull flame origin closer to nozzle so it starts inside the pipe.
    outerGeo.translate(-1.32,0,0);
    coreGeo.translate(-1.05,0,0);
    glowGeo.translate(-1.52,0,0);

    const outerMat=material(outerTex,{opacity:0.92,blending:THREE.AdditiveBlending}),
      coreMat=material(coreTex,{opacity:0.98,blending:THREE.AdditiveBlending}),
      glowMat=material(outerTex,{opacity:0.24,blending:THREE.AdditiveBlending});

    geos.push(outerGeo,coreGeo,glowGeo);
    mats.push(outerMat,coreMat,glowMat);

    flameOuter=new THREE.Mesh(outerGeo,outerMat);
    flameCore=new THREE.Mesh(coreGeo,coreMat);
    flameGlow=new THREE.Mesh(glowGeo,glowMat);

    flameGlow.renderOrder=6;
    flameOuter.renderOrder=8;
    flameCore.renderOrder=9;

    flameRoot.add(flameGlow,flameOuter,flameCore);
    const ringGeo=new THREE.PlaneGeometry(1.05,1.05),ringMat=material(ringTex,{opacity:0,blending:THREE.AdditiveBlending});geos.push(ringGeo);mats.push(ringMat);
    ringMesh=new THREE.Mesh(ringGeo,ringMat);ringMesh.position.set(-0.56,-0.61,0.10);ringMesh.renderOrder=7;rocketRoot.add(ringMesh);
    function bgPlane(tex,order,opacity=1){const geo=new THREE.PlaneGeometry(8.8,13.2),mat=material(tex,{opacity});geos.push(geo);mats.push(mat);const mesh=new THREE.Mesh(geo,mat);mesh.position.z=-8+order*0.01;mesh.renderOrder=-100+order;backdrop.add(mesh);return mesh;}
    farMesh=bgPlane(deepFarTex,0,1);
    midMesh=bgPlane(deepMidTex,1,0.78);
    nearMesh=bgPlane(deepNearTex,2,0.74);
    speedMesh=bgPlane(deepSpeedTex,3,0);
    return head.ready;
  });
  function update(t,dt,state={}){
    if(!rocketMesh||!head)return;
    const d=Math.min(1,Math.max(-1,Number(state.direction)||0)),speed=clamp01(state.speed),thrust=clamp01(state.thrust),vol=clamp01(state.volatility),boost=clamp01(state.boost),power=clamp01(thrust*0.72+speed*0.18+boost*0.35);
    const bob=Math.sin(t*(1.25+speed*0.55))*(0.025+power*0.025),turb=Math.sin(t*12.5)*vol*0.014;
    rideRoot.position.x=d*0.06+turb;rideRoot.position.y=0.05+d*0.07+bob;rideRoot.rotation.z=-d*0.050+Math.sin(t*1.1)*0.008+turb*0.22;
    const boostColor=new THREE.Color(0xd6f7ff),
      hotCore=new THREE.Color(0xfff7d8),
      warmOuter=new THREE.Color(0xff9960),
      warmIdle=new THREE.Color(0xffb47a),
      downTint=new THREE.Color(0xff7b9a);

    const modeUp=Math.max(0,d);
    const modeDown=Math.max(0,-d);

    const flickerA=Math.sin(t*(11+thrust*11))*0.08;
    const flickerB=Math.sin(t*23.0)*0.045;
    const flickerC=Math.sin(t*31.0+0.8)*0.028;

    // Exhaust should feel attached to the engine, not like a laser beam.
    const lenBase=
      0.88 +
      thrust*0.74 +
      speed*0.14 +
      boost*0.88 +
      modeUp*0.22 -
      modeDown*0.16;

    const widthBase=
      1.08 +
      power*0.28 +
      modeUp*0.06 -
      modeDown*0.08 +
      flickerB;

    flameRoot.scale.x=lenBase*(1+flickerA+flickerC);
    flameRoot.scale.y=widthBase;

    flameRoot.position.x=-0.512 + Math.sin(t*20.0)*vol*0.004 - modeDown*0.004;
    flameRoot.position.y=-0.562 + Math.cos(t*17.0)*vol*0.004 + modeUp*0.002;

    flameOuter.material.opacity=
      0.46 +
      power*0.24 +
      boost*0.10 -
      modeDown*0.10;

    flameCore.material.opacity=
      0.72 +
      power*0.18 +
      modeUp*0.04 -
      modeDown*0.10;

    if(flameGlow){
      flameGlow.material.opacity=
        0.14 +
        power*0.20 +
        boost*0.14 -
        modeDown*0.04;

      flameGlow.scale.set(
        1.18 + power*0.24 + boost*0.14,
        1.02 + power*0.12,
        1
      );
    }

    flameCore.material.color.copy(hotCore).lerp(boostColor,boost*0.86);

    flameOuter.material.color
      .copy(warmIdle)
      .lerp(warmOuter,modeUp*0.55)
      .lerp(downTint,modeDown*0.28)
      .lerp(boostColor,boost*0.34);
    if(ringMesh){ringMesh.material.opacity=boost*0.72;const rs=0.65+boost*0.85+0.07*Math.sin(t*9);ringMesh.scale.setScalar(rs);ringMesh.rotation.z=-t*0.55;}
    const travel=0.010+speed*0.035+thrust*0.025+boost*0.08;
    if(midMesh?.material.map){
      midMesh.material.map.offset.x=(t*travel*0.055)%1;
      midMesh.material.map.offset.y=(t*travel*0.095)%1;
    }

    if(nearMesh?.material.map){
      nearMesh.material.map.offset.x=(t*travel*0.14)%1;
      nearMesh.material.map.offset.y=(t*travel*0.24)%1;
    }

    if(speedMesh?.material.map){
      speedMesh.material.map.offset.x=(t*travel*0.40)%1;
      speedMesh.material.map.offset.y=(t*travel*0.70)%1;
    }
    if(speedMesh)speedMesh.material.opacity=clamp01(speed*0.22+thrust*0.18+boost*0.86);
    if(nearMesh)nearMesh.material.opacity=0.48+speed*0.36;
    if(midMesh)midMesh.material.opacity=0.56+speed*0.24;
    head.update(t,dt,state);
  }
  function resetPoseForFit(){rideRoot.position.set(0,0.05,0);rideRoot.rotation.set(0,0,0);flameRoot.scale.set(0.82,0.9,1);}
  function destroy(){rideRoot.removeFromParent();backdrop.removeFromParent();head?.destroy();geos.forEach(g=>g.dispose?.());mats.forEach(m=>m.dispose?.());textures.forEach(t=>t.dispose?.());}
  return{root:rideRoot,rocketRoot,backdrop,flameRoot,get head(){return head;},ready,update,resetPoseForFit,destroy};
}
