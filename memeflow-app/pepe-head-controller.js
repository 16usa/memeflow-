import * as THREE from '/vendor/three.module.js';

const HEAD_NAMES=['idle','cruise','up','pump','boost','down','shocked','recover','blink'];

export function createPepeHeadController({parent,baseUrl='/game-assets/rocket-v34/head/',size=0.48}={}){
  if(!parent) throw new Error('[PEPE HEAD V34.2] parent required');
  const root=new THREE.Group(); root.name='PepeHeadV34_2'; parent.add(root);
  const geometry=new THREE.PlaneGeometry(size,size);
  const material=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material); mesh.renderOrder=40; root.add(mesh);
  const loader=new THREE.TextureLoader(),textures={};
  let current='idle',nextBlink=2.0+Math.random()*2.8,blinkLeft=0,recoverLeft=0,lastDirection=0;
  const ready=Promise.all(HEAD_NAMES.map(name=>new Promise((resolve,reject)=>{
    loader.load(`${baseUrl}head-${name}.png`,tex=>{
      tex.colorSpace=THREE.SRGBColorSpace; tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter;
      textures[name]=tex; resolve();
    },undefined,reject);
  }))).then(()=>{material.map=textures.idle;material.needsUpdate=true;});
  function setHead(name){if(!textures[name]||current===name)return;current=name;material.map=textures[name];material.needsUpdate=true;}
  function chooseBase(state){
    const d=Number(state.direction)||0,speed=Number(state.speed)||0,thrust=Number(state.thrust)||0,vol=Number(state.volatility)||0,boost=Number(state.boost)||0;
    if(recoverLeft>0)return 'recover';
    if(boost>0.34)return 'boost';
    if(d>0.64&&thrust>0.72)return 'pump';
    if(d>0.18)return 'up';
    if(d<-0.62||(d<-0.30&&vol>0.62))return 'shocked';
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
    const bob=Math.sin(t*(1.45+thrust*0.55))*(0.004+thrust*0.006);
    const driftX=Math.sin(t*0.72)*0.006;
    const driftY=Math.cos(t*0.95)*0.004;

    // Put the whole head deeper inside the cockpit.
    root.position.set(driftX, -0.020 + bob + driftY, -0.035);

    root.rotation.z=
      Math.sin(t*0.95)*0.010 +
      Math.sin(t*8.5)*vol*0.006 -
      d*0.012;

    const squash=1+Math.sin(t*4.5)*0.006+boost*0.020;
    const baseScale=0.86;
    root.scale.set(baseScale*squash, baseScale*(2-squash), 1);
  }
  function destroy(){root.removeFromParent();geometry.dispose();material.dispose();Object.values(textures).forEach(t=>t.dispose());}
  return{root,mesh,material,textures,ready,update,setHead,getHead:()=>current,destroy};
}
