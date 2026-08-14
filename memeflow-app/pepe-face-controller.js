import * as THREE from '/vendor/three.module.js';

const FACE_NAMES=['idle','cruise','up','pump','boost','down','shocked','recover','blink'];

export function createPepeFaceController({parent,baseUrl='/game-assets/rocket-v34/face/',radius=0.315}={}){
  if(!parent) throw new Error('[PEPE FACE V34] parent required');
  const root=new THREE.Group(); root.name='PepeFaceV34'; parent.add(root);
  const geometry=new THREE.CircleGeometry(radius,64);
  const material=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material); mesh.renderOrder=40; root.add(mesh);
  const loader=new THREE.TextureLoader(),textures={};
  let current='idle',nextBlink=2.2+Math.random()*2.6,blinkLeft=0,recoverLeft=0,lastDirection=0;
  const ready=Promise.all(FACE_NAMES.map(name=>new Promise((resolve,reject)=>{
    loader.load(`${baseUrl}face-${name}.png`,tex=>{
      tex.colorSpace=THREE.SRGBColorSpace; tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter;
      textures[name]=tex; resolve();
    },undefined,reject);
  }))).then(()=>{material.map=textures.idle;material.needsUpdate=true;});
  function setFace(name){if(!textures[name]||current===name)return;current=name;material.map=textures[name];material.needsUpdate=true;}
  function chooseBase(state){
    const d=Number(state.direction)||0,speed=Number(state.speed)||0,thrust=Number(state.thrust)||0,vol=Number(state.volatility)||0,boost=Number(state.boost)||0;
    if(recoverLeft>0)return'recover';
    if(boost>0.34)return'boost';
    if(d>0.64&&thrust>0.72)return'pump';
    if(d>0.18)return'up';
    if(d<-0.62||(d<-0.30&&vol>0.62))return'shocked';
    if(d<-0.16)return'down';
    if(speed<0.18)return'cruise';
    return'idle';
  }
  function update(t,dt,state={}){
    const d=Number(state.direction)||0,thrust=Number(state.thrust)||0,vol=Number(state.volatility)||0,boost=Number(state.boost)||0;
    if(lastDirection<-0.32&&d>-0.04)recoverLeft=0.85;
    lastDirection=d; recoverLeft=Math.max(0,recoverLeft-dt);
    nextBlink-=dt;
    if(nextBlink<=0&&boost<0.25&&Math.abs(d)<0.75){blinkLeft=0.12+Math.random()*0.05;nextBlink=2.2+Math.random()*3.2;}
    blinkLeft=Math.max(0,blinkLeft-dt);
    setFace(blinkLeft>0?'blink':chooseBase(state));
    const bob=Math.sin(t*(1.7+thrust*0.7))*(0.006+thrust*0.010);
    root.position.y=bob;
    root.rotation.z=Math.sin(t*1.2)*0.012+Math.sin(t*11)*vol*0.008;
    const squash=1+Math.sin(t*4.8)*0.008+boost*0.035;
    root.scale.set(squash,2-squash,1);
  }
  function destroy(){root.removeFromParent();geometry.dispose();material.dispose();Object.values(textures).forEach(t=>t.dispose());}
  return{root,mesh,material,textures,ready,update,setFace,getFace:()=>current,destroy};
}
