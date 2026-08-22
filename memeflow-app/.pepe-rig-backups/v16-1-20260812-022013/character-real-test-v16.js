import * as THREE from '/vendor/three.module.js';
import { createPepeRealRigV16 } from '/character-real-rig-v16.js?v=1601';

const mount = document.getElementById('stage');
const label = document.getElementById('state');

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-2.5,2.5,2.5,-2.5,.1,100);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({
  alpha:true,
  antialias:true,
  powerPreference:'high-performance'
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0,0);
mount.appendChild(renderer.domElement);

const anchor = new THREE.Group();
scene.add(anchor);

const pepe = createPepeRealRigV16({ parent:anchor });
pepe.root.scale.setScalar(1.05);

function set(mode) {
  if (mode === 'up') {
    pepe.setMarket({direction:1, speed:.9, thrust:1});
    label.textContent = 'UP · HAPPY / HIGH THRUST';
  } else if (mode === 'down') {
    pepe.setMarket({direction:-1, speed:.08, thrust:.08});
    label.textContent = 'DOWN · LOW THRUST';
  } else {
    pepe.setMarket({direction:0, speed:.22, thrust:.25});
    label.textContent = 'IDLE · CRUISING';
  }
}

document.getElementById('up').onclick = () => set('up');
document.getElementById('idle').onclick = () => set('idle');
document.getElementById('down').onclick = () => set('down');

function resize() {
  const w = innerWidth, h = innerHeight;
  const aspect = w / h, size = 2.45;
  renderer.setSize(w,h,false);
  camera.left = -size * aspect;
  camera.right = size * aspect;
  camera.top = size;
  camera.bottom = -size;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let t = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05);
  t += dt;
  pepe.update(t,dt);
  renderer.render(scene,camera);
}

pepe.ready.then(() => {
  set('idle');
  frame();
}).catch(err => {
  console.error(err);
  label.textContent = 'LOAD ERROR — CHECK CONSOLE';
  document.body.dataset.error = '1';
});
