import * as THREE from '/vendor/three.module.js';
import { createPepeFaceController } from '/pepe-face-controller.js?v=34021';
const clamp01=v=>Math.min(1,Math.max(0,Number(v)||0));
function loadTexture(loader,url,{repeat=false}={}){return new Promise((resolve,reject)=>loader.load(url,tex=>{tex.colorSpace=THREE.SRGBColorSpace;tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;if(repeat){tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;}resolve(tex);},undefined,reject));}
function material(tex,{transparent=true,opacity=1,blending=THREE.NormalBlending}={}){return new THREE.MeshBasicMaterial({map:tex,transparent,opacity,depthWrite:false,depthTest:false,side:THREE.DoubleSide,blending});}
export function createRocketRideV34({scene,parent,baseUrl='/game-assets/rocket-v34/'}={}){
  if(!scene||!parent)throw new Error('[ROCKET V34] scene and parent required');
  const loader=new THREE.TextureLoader(),rideRoot=new THREE.Group(),rocketRoot=new THREE.Group(),backdrop=new THREE.Group(),flameRoot=new THREE.Group();
  rideRoot.name='RocketRideV34';rocketRoot.name='RocketBodyRootV34';backdrop.name='SpaceBackdropV34';flameRoot.name='FlameRootV34';
  parent.add(rideRoot);rideRoot.add(rocketRoot);rocketRoot.add(flameRoot);scene.add(backdrop);
  let face=null,farMesh,midMesh,nearMesh,speedMesh,rocketMesh,glassMesh,flameOuter,flameCore,ringMesh;
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
    const faceAnchor=new THREE.Group();faceAnchor.position.set(0.655,0.318,0.18);rocketRoot.add(faceAnchor);
    face=createPepeFaceController({parent:faceAnchor,radius:0.292});
    const glassGeo=new THREE.PlaneGeometry(0.70,0.70),glassMat=material(glassTex,{opacity:0.72});geos.push(glassGeo);mats.push(glassMat);
    glassMesh=new THREE.Mesh(glassGeo,glassMat);glassMesh.position.set(0.655,0.318,0.22);glassMesh.renderOrder=50;rocketRoot.add(glassMesh);
    flameRoot.position.set(-0.64,-0.79,0.12);flameRoot.rotation.z=THREE.MathUtils.degToRad(45);
    const outerGeo=new THREE.PlaneGeometry(2.10,0.98),coreGeo=new THREE.PlaneGeometry(1.78,0.66);outerGeo.translate(-1.05,0,0);coreGeo.translate(-0.89,0,0);
    const outerMat=material(outerTex,{opacity:0.88,blending:THREE.AdditiveBlending}),coreMat=material(coreTex,{opacity:0.94,blending:THREE.AdditiveBlending});
    geos.push(outerGeo,coreGeo);mats.push(outerMat,coreMat);flameOuter=new THREE.Mesh(outerGeo,outerMat);flameCore=new THREE.Mesh(coreGeo,coreMat);
    flameOuter.renderOrder=8;flameCore.renderOrder=9;flameRoot.add(flameOuter,flameCore);
    const ringGeo=new THREE.PlaneGeometry(1.05,1.05),ringMat=material(ringTex,{opacity:0,blending:THREE.AdditiveBlending});geos.push(ringGeo);mats.push(ringMat);
    ringMesh=new THREE.Mesh(ringGeo,ringMat);ringMesh.position.set(-0.56,-0.61,0.10);ringMesh.renderOrder=7;rocketRoot.add(ringMesh);
    function bgPlane(tex,order,opacity=1){const geo=new THREE.PlaneGeometry(8.8,13.2),mat=material(tex,{opacity});geos.push(geo);mats.push(mat);const mesh=new THREE.Mesh(geo,mat);mesh.position.z=-8+order*0.01;mesh.renderOrder=-100+order;backdrop.add(mesh);return mesh;}
    farMesh=bgPlane(farTex,0,1);midMesh=bgPlane(midTex,1,0.80);nearMesh=bgPlane(nearTex,2,0.76);speedMesh=bgPlane(speedTex,3,0);
    return face.ready;
  });
  function update(t,dt,state={}){
    if(!rocketMesh||!face)return;
    const d=Math.min(1,Math.max(-1,Number(state.direction)||0)),speed=clamp01(state.speed),thrust=clamp01(state.thrust),vol=clamp01(state.volatility),boost=clamp01(state.boost),power=clamp01(thrust*0.72+speed*0.18+boost*0.35);
    const bob=Math.sin(t*(1.25+speed*0.55))*(0.025+power*0.025),turb=Math.sin(t*12.5)*vol*0.014;
    rideRoot.position.x=d*0.06+turb;rideRoot.position.y=0.05+d*0.07+bob;rideRoot.rotation.z=-d*0.050+Math.sin(t*1.1)*0.008+turb*0.22;
    const pulse=1+Math.sin(t*(9+thrust*9))*0.065;

    // Engine never disappears completely.
    // DOWN = short flame, UP = long flame, BOOST = huge exhaust.
    flameRoot.scale.x=
      (0.70+thrust*0.65+speed*0.18+boost*0.45)*pulse;

    flameRoot.scale.y=
      0.90+power*0.18+vol*0.08*Math.sin(t*17);

    flameOuter.material.opacity=0.70+power*0.28;
    flameCore.material.opacity=0.82+power*0.17;
    const boostColor=new THREE.Color(0xc8f7ff),warmColor=new THREE.Color(0xfff0b0);flameCore.material.color.copy(warmColor).lerp(boostColor,boost);flameOuter.material.color.setRGB(1,0.72+boost*0.18,0.68+boost*0.25);
    if(ringMesh){ringMesh.material.opacity=boost*0.72;const rs=0.65+boost*0.85+0.07*Math.sin(t*9);ringMesh.scale.setScalar(rs);ringMesh.rotation.z=-t*0.55;}
    const travel=0.010+speed*0.035+thrust*0.025+boost*0.08;
    if(farMesh?.material.map){
      farMesh.material.map.offset.x=(t*travel*0.045)%1;
      farMesh.material.map.offset.y=(t*travel*0.080)%1;
    }
    if(midMesh?.material.map){
      midMesh.material.map.offset.x=(t*travel*0.120)%1;
      midMesh.material.map.offset.y=(t*travel*0.220)%1;
    }
    if(nearMesh?.material.map){
      nearMesh.material.map.offset.x=(t*travel*0.280)%1;
      nearMesh.material.map.offset.y=(t*travel*0.500)%1;
    }
    if(speedMesh?.material.map){
      speedMesh.material.map.offset.x=(t*travel*0.620)%1;
      speedMesh.material.map.offset.y=(t*travel*1.050)%1;
    }
    if(speedMesh)speedMesh.material.opacity=clamp01(speed*0.22+thrust*0.18+boost*0.86);if(nearMesh)nearMesh.material.opacity=0.48+speed*0.36;if(midMesh)midMesh.material.opacity=0.56+speed*0.24;
    face.update(t,dt,state);
  }
  function resetPoseForFit(){rideRoot.position.set(0,0.05,0);rideRoot.rotation.set(0,0,0);flameRoot.scale.set(0.82,0.9,1);}
  function destroy(){rideRoot.removeFromParent();backdrop.removeFromParent();face?.destroy();geos.forEach(g=>g.dispose?.());mats.forEach(m=>m.dispose?.());textures.forEach(t=>t.dispose?.());}
  return{root:rideRoot,rocketRoot,backdrop,flameRoot,get face(){return face;},ready,update,resetPoseForFit,destroy};
}
