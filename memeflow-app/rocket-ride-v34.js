import * as THREE from '/vendor/three.module.js';
import { createPepeHeadController } from '/pepe-head-controller.js?v=34205';
const clamp01=v=>Math.min(1,Math.max(0,Number(v)||0));
function loadTexture(loader,url,{repeat=false}={}){return new Promise((resolve,reject)=>loader.load(url,tex=>{tex.colorSpace=THREE.SRGBColorSpace;tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;if(repeat){tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;}resolve(tex);},undefined,reject));}
function material(tex,{transparent=true,opacity=1,blending=THREE.NormalBlending}={}){return new THREE.MeshBasicMaterial({map:tex,transparent,opacity,depthWrite:false,depthTest:false,side:THREE.DoubleSide,blending});}
export function createRocketRideV34({scene,parent,baseUrl='/game-assets/rocket-v34/'}={}){
  if(!scene||!parent)throw new Error('[ROCKET V34.2] scene and parent required');
  const loader=new THREE.TextureLoader(),rideRoot=new THREE.Group(),rocketRoot=new THREE.Group(),backdrop=new THREE.Group(),flameRoot=new THREE.Group();
  rideRoot.name='RocketRideV34_2';rocketRoot.name='RocketBodyRootV34_2';backdrop.name='SpaceBackdropV34_2';flameRoot.name='FlameRootV34_2';
  parent.add(rideRoot);rideRoot.add(rocketRoot);rocketRoot.add(flameRoot);scene.add(backdrop);
  let head=null,farMesh,midMesh,nearMesh,speedMesh,rocketMesh,glassMesh,cockpitShadow,flameOuter,flameCore,flameGlow,ringMesh;
  const mats=[],geos=[],textures=[];
  const ready=Promise.all([
    loadTexture(loader,`${baseUrl}rocket/rocket-body.png`),loadTexture(loader,`${baseUrl}rocket/rocket-glass.png`),
    loadTexture(loader,`${baseUrl}flame/flame-outer.png`),loadTexture(loader,`${baseUrl}flame/flame-core.png`),
    loadTexture(loader,`${baseUrl}space/space-far.png`,{repeat:true}),loadTexture(loader,`${baseUrl}space/stars-mid.png`,{repeat:true}),
    loadTexture(loader,`${baseUrl}space/stars-near.png`,{repeat:true}),loadTexture(loader,`${baseUrl}space/speed-lines.png`,{repeat:true}),
    loadTexture(loader,`${baseUrl}fx/boost-ring.png`)
  ]).then(([rocketTex,glassTex,outerTex,coreTex,farTex,midTex,nearTex,speedTex,ringTex])=>{
    textures.push(rocketTex,glassTex,outerTex,coreTex,farTex,midTex,nearTex,speedTex,ringTex);
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
    flameRoot.position.set(-0.505,-0.565,0.12);
    flameRoot.rotation.z=THREE.MathUtils.degToRad(45);

    const outerGeo=new THREE.PlaneGeometry(1.95,0.92),
      coreGeo=new THREE.PlaneGeometry(1.58,0.54),
      glowGeo=new THREE.PlaneGeometry(2.60,1.24);

    // Pull flame origin closer to nozzle so it starts inside the pipe.
    outerGeo.translate(-0.97,0,0);
    coreGeo.translate(-0.79,0,0);
    glowGeo.translate(-1.30,0,0);

    const outerMat=material(outerTex,{opacity:0.88,blending:THREE.AdditiveBlending}),
      coreMat=material(coreTex,{opacity:0.96,blending:THREE.AdditiveBlending}),
      glowMat=material(outerTex,{opacity:0.18,blending:THREE.AdditiveBlending});

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
    farMesh=bgPlane(farTex,0,1);midMesh=bgPlane(midTex,1,0.80);nearMesh=bgPlane(nearTex,2,0.76);speedMesh=bgPlane(speedTex,3,0);
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
      0.72 +
      thrust*0.74 +
      speed*0.14 +
      boost*0.88 +
      modeUp*0.22 -
      modeDown*0.18;

    const widthBase=
      0.90 +
      power*0.26 +
      modeUp*0.06 -
      modeDown*0.10 +
      flickerB;

    flameRoot.scale.x=lenBase*(1+flickerA+flickerC);
    flameRoot.scale.y=widthBase;

    flameRoot.position.x=-0.505 + Math.sin(t*20.0)*vol*0.006 - modeDown*0.008;
    flameRoot.position.y=-0.565 + Math.cos(t*17.0)*vol*0.006 + modeUp*0.004;

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
        0.10 +
        power*0.18 +
        boost*0.14 -
        modeDown*0.05;

      flameGlow.scale.set(
        1.10 + power*0.28 + boost*0.14,
        0.96 + power*0.12,
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
    if(farMesh?.material.map)farMesh.material.map.offset.y=(t*travel*0.08)%1;
    if(midMesh?.material.map)midMesh.material.map.offset.y=(t*travel*0.22)%1;
    if(nearMesh?.material.map)nearMesh.material.map.offset.y=(t*travel*0.50)%1;
    if(speedMesh?.material.map)speedMesh.material.map.offset.y=(t*travel*1.05)%1;
    if(speedMesh)speedMesh.material.opacity=clamp01(speed*0.22+thrust*0.18+boost*0.86);
    if(nearMesh)nearMesh.material.opacity=0.48+speed*0.36;
    if(midMesh)midMesh.material.opacity=0.56+speed*0.24;
    head.update(t,dt,state);
  }
  function resetPoseForFit(){rideRoot.position.set(0,0.05,0);rideRoot.rotation.set(0,0,0);flameRoot.scale.set(0.82,0.9,1);}
  function destroy(){rideRoot.removeFromParent();backdrop.removeFromParent();head?.destroy();geos.forEach(g=>g.dispose?.());mats.forEach(m=>m.dispose?.());textures.forEach(t=>t.dispose?.());}
  return{root:rideRoot,rocketRoot,backdrop,flameRoot,get head(){return head;},ready,update,resetPoseForFit,destroy};
}
