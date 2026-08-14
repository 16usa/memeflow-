import * as THREE from '/vendor/three.module.js';

const HEAD_NAMES=['idle','cruise','up','pump','boost','down','shocked','recover','blink'];

export function createPepeHeadController({parent,baseUrl='/game-assets/rocket-v34/face/',radius=0.238}={}){
  if(!parent) throw new Error('[PEPE HEAD V34.2] parent required');
  const root=new THREE.Group(); root.name='PepeHeadV34_2'; parent.add(root);
  const geometry=new THREE.CircleGeometry(radius,64);
  const material=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material); mesh.renderOrder=40; root.add(mesh);
  const loader=new THREE.TextureLoader(),textures={};
  let current='idle',nextBlink=2.0+Math.random()*2.8,blinkLeft=0,recoverLeft=0,lastDirection=0;
  const ready=Promise.all(HEAD_NAMES.map(name=>new Promise((resolve,reject)=>{
    loader.load(`${baseUrl}face-${name}.png`,tex=>{
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.minFilter=THREE.LinearFilter;
      tex.magFilter=THREE.LinearFilter;

      // Keep the whole head visible, but slightly tucked behind the frame.
      tex.wrapS=THREE.ClampToEdgeWrapping;
      tex.wrapT=THREE.ClampToEdgeWrapping;
      tex.repeat.set(0.85,0.85);
      tex.offset.set(0.075,0.075);

      textures[name]=tex;
      resolve();
    },undefined,reject);
  }))).then(()=>{material.map=textures.idle;material.needsUpdate=true;});
  function setHead(name){if(!textures[name]||current===name)return;current=name;material.map=textures[name];material.needsUpdate=true;}
  function chooseBase(state){
    const d=Number(state.direction)||0,speed=Number(state.speed)||0,thrust=Number(state.thrust)||0,vol=Number(state.volatility)||0,boost=Number(state.boost)||0;
    if(recoverLeft>0)return 'recover';
    if(boost>0.34)return 'boost';
    if(d>0.64&&thrust>0.72)return 'pump';
    if(d>0.18)return 'up';
    if(d<-0.90&&vol>0.76)return 'shocked';
    if(d<-0.16)return 'down';
    if(speed<0.18)return 'cruise';
    return 'idle';
  }
  function update(t,dt,state={}){
    const d=Number(state.direction)||0,thrust=Number(state.thrust)||0,vol=Number(state.volatility)||0,boost=Number(state.boost)||0;
    if(lastDirection<-0.32&&d>-0.04)recoverLeft=0.85;
    lastDirection=d; recoverLeft=Math.max(0,recoverLeft-dt);
    nextBlink-=dt;
    if(nextBlink<=0&&boost<0.25&&Math.abs(d)<0.75){blinkLeft=0.10+Math.random()*0.05;nextBlink=2.0+Math.random()*3.0;}
    blinkLeft=Math.max(0,blinkLeft-dt);
    setHead(blinkLeft>0?'blink':chooseBase(state));
    // Head floats inside the cabin and visibly approaches / recedes from the glass.
    const floatY=Math.sin(t*1.05)*(0.010+thrust*0.006);
    const floatX=Math.sin(t*0.71)*0.007;
    const depthPulse=Math.sin(t*0.82)*0.045;

    // In this 2D setup, scale is our fake Z-depth.
    // Slightly smaller = deeper in cabin, slightly larger = closer to the glass.
    const approach=
      0.955 +
      depthPulse +
      thrust*0.010 +
      boost*0.016;

    root.position.set(
      floatX,
      -0.006 + floatY,
      -0.040
    );

    root.rotation.z=
      Math.sin(t*0.90)*0.009 +
      Math.sin(t*8.5)*vol*0.005 -
      d*0.010;

    root.scale.set(approach,approach,1);
  }
  function destroy(){root.removeFromParent();geometry.dispose();material.dispose();Object.values(textures).forEach(t=>t.dispose());}
  return{root,mesh,material,textures,ready,update,setHead,getHead:()=>current,destroy};
}
