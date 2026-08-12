import * as THREE from '/vendor/three.module.js';
import { createPepeRealRigV16 } from '/character-real-rig-v16.js?v=16110';

const stage = document.getElementById('stage');
const label = document.getElementById('state');
const debug = document.getElementById('debug');

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 100);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({
  alpha:true,
  antialias:true,
  powerPreference:'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);

renderer.domElement.style.position = 'absolute';
renderer.domElement.style.inset = '0';
renderer.domElement.style.display = 'block';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';

stage.appendChild(renderer.domElement);

const anchor = new THREE.Group();
const fitGroup = new THREE.Group();
anchor.add(fitGroup);
scene.add(anchor);

const pepe = createPepeRealRigV16({ parent:fitGroup });

let ready = false;
let lastW = 0;
let lastH = 0;

function set(mode){
  if(mode === 'up'){
    pepe.setMarket({direction:1,speed:.9,thrust:1});
    label.textContent = 'UP · HAPPY / HIGH THRUST';
  }else if(mode === 'down'){
    pepe.setMarket({direction:-1,speed:.08,thrust:.08});
    label.textContent = 'DOWN · LOW THRUST';
  }else{
    pepe.setMarket({direction:0,speed:.22,thrust:.25});
    label.textContent = 'IDLE · CRUISING';
  }
}

document.getElementById('up').onclick = () => set('up');
document.getElementById('idle').onclick = () => set('idle');
document.getElementById('down').onclick = () => set('down');

function fitModel(){
  if(!ready) return;

  fitGroup.position.set(0,0,0);
  fitGroup.scale.setScalar(1);

  pepe.root.position.set(0,0,0);
  pepe.root.rotation.set(0,0,0);
  pepe.root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(fitGroup);
  if(box.isEmpty()) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const worldW = camera.right - camera.left;
  const worldH = camera.top - camera.bottom;

  // Character gets most of the CENTRAL canvas, not whole Safari viewport.
  const maxW = worldW * .68;
  const maxH = worldH * .82;

  let s = Math.min(
    maxW / Math.max(size.x,.001),
    maxH / Math.max(size.y,.001)
  );

  s = THREE.MathUtils.clamp(s,.22,1.15);

  fitGroup.scale.setScalar(s);
  fitGroup.position.x = -center.x * s;
  fitGroup.position.y = -center.y * s;

  fitGroup.updateMatrixWorld(true);
}

function resizeCanvas(){
  const rect = stage.getBoundingClientRect();

  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  if(w === lastW && h === lastH) return;
  lastW = w;
  lastH = h;

  renderer.setSize(w,h,false);

  const aspect = w / h;
  const halfH = 2.2;

  camera.left = -halfH * aspect;
  camera.right = halfH * aspect;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();

  fitModel();

  debug.textContent = `CANVAS ${w}×${h}`;
}

const ro = new ResizeObserver(() => resizeCanvas());
ro.observe(stage);

window.addEventListener('resize', resizeCanvas);
window.visualViewport?.addEventListener('resize', resizeCanvas);
window.visualViewport?.addEventListener('scroll', resizeCanvas);

const clock = new THREE.Clock();
let t = 0;

function frame(){
  requestAnimationFrame(frame);

  const dt = Math.min(clock.getDelta(),.05);
  t += dt;

  pepe.update(t,dt);
  renderer.render(scene,camera);
}

pepe.ready.then(()=>{
  ready = true;
  set('idle');

  requestAnimationFrame(()=>{
    resizeCanvas();
    fitModel();
    frame();
  });
}).catch(err=>{
  console.error('[PEPE V16.2]',err);
  label.textContent = 'LOAD ERROR';
  document.body.dataset.error = '1';
});
