import * as THREE from '/vendor/three.module.js';
import { createPepeRealRigV16 } from '/character-real-rig-v16.js?v=44023';
import { createMotionController } from '/motion-controller.js?v=33010';
import { createRocketRide2D } from '/rocket-effects.js?v=33010';

const stage = document.getElementById('stage');
const label = document.getElementById('state');
const debug = document.getElementById('debug');

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 100);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, powerPreference:'high-performance' });
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
const rideRoot = new THREE.Group();
anchor.add(fitGroup);
fitGroup.add(rideRoot);
scene.add(anchor);

const pepe = createPepeRealRigV16({ parent:rideRoot });
const motion = createMotionController({ response:5.5 });
const rocketRide = createRocketRide2D({ rideRoot, backdropParent:scene });
motion.bindMarketTarget(pepe);

let ready = false;
let lastW = 0;
let lastH = 0;

const labels = {
  up: 'UP · ROCKET BOOST / HIGH THRUST',
  idle: 'IDLE · ROCKET CRUISING',
  down: 'DOWN · LOW THRUST / DESCENT'
};

function set(mode){
  const resolved = motion.setMode(mode);
  label.textContent = labels[resolved];
}

document.getElementById('up').onclick = () => set('up');
document.getElementById('idle').onclick = () => set('idle');
document.getElementById('down').onclick = () => set('down');

function removeRigDebugVisuals(){
  const legitimateMeshes = new Set();
  for (const part of Object.values(pepe.parts || {})) {
    if (part?.mesh) legitimateMeshes.add(part.mesh);
  }
  const remove = [];
  pepe.root.traverse(object => {
    if (legitimateMeshes.has(object)) return;
    const geometryType = object.geometry?.type || '';
    const name = String(object.name || '').toLowerCase();
    const diagnosticGeometry = geometryType === 'RingGeometry' || geometryType === 'CircleGeometry' || geometryType === 'TorusGeometry' || geometryType === 'EdgesGeometry';
    const diagnosticName = name.includes('debug') || name.includes('marker') || name.includes('diagnostic') || name.includes('axishelper') || name.includes('jointdot') || name.includes('pivotdot');
    const diagnosticPrimitive = object.isLine || object.isLineLoop || object.isPoints;
    if (diagnosticGeometry || diagnosticName || diagnosticPrimitive) remove.push(object);
  });
  for (const object of remove) object.parent?.remove(object);
  console.log('[PEPE V33] removed rig debug visuals:', remove.length);
}

function fitModel(){
  if(!ready) return;
  fitGroup.position.set(0,0,0);
  fitGroup.scale.setScalar(1);
  rocketRide.resetPoseForFit();
  pepe.root.position.set(0,0,0);
  pepe.root.rotation.set(0,0,0);
  pepe.root.updateMatrixWorld(true);
  rocketRide.root.updateMatrixWorld(true);

  // Exclude dynamic flame from fit so thrust cannot visually resize the whole ride.
  const flameWasVisible = rocketRide.flameGroup.visible;
  rocketRide.flameGroup.visible = false;
  fitGroup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fitGroup);
  rocketRide.flameGroup.visible = flameWasVisible;
  if(box.isEmpty()) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const worldW = camera.right - camera.left;
  const worldH = camera.top - camera.bottom;
  const maxW = worldW * .74;
  const maxH = worldH * .84;
  let s = Math.min(maxW / Math.max(size.x,.001), maxH / Math.max(size.y,.001));
  s = THREE.MathUtils.clamp(s,.20,1.12);
  fitGroup.scale.setScalar(s);
  fitGroup.position.x = -center.x * s;
  fitGroup.position.y = -center.y * s + .16;
  fitGroup.updateMatrixWorld(true);
}

function resizeCanvas(){
  const rect = stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if(w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  renderer.setSize(w,h,false);
  const aspect = w / h;
  const halfH = 2.2;
  camera.left = -halfH * aspect;
  camera.right = halfH * aspect;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  fitModel();
  debug.textContent = `ROCKET V33 · ${w}×${h}`;
}

const ro = new ResizeObserver(resizeCanvas);
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
  const state = motion.update(dt);
  pepe.update(t,dt);
  rocketRide.update(t,dt,state);
  renderer.render(scene,camera);
}

pepe.ready.then(()=>{
  ready = true;
  removeRigDebugVisuals();
  set('idle');
  requestAnimationFrame(()=>{
    resizeCanvas();
    fitModel();
    frame();
  });
}).catch(err=>{
  console.error('[PEPE ROCKET V33]',err);
  label.textContent = 'LOAD ERROR';
  document.body.dataset.error = '1';
});
