import * as THREE from '/vendor/three.module.js';
import { createPepeRealRigV16 } from '/character-real-rig-v16.js?v=1601';

const mount = document.getElementById('stage');
const label = document.getElementById('state');

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(-2.5, 2.5, 2.5, -2.5, .1, 100);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100dvh';
renderer.domElement.style.display = 'block';
renderer.domElement.style.pointerEvents = 'none';
mount.appendChild(renderer.domElement);

// anchor = screen placement
// fitGroup = automatic centering/scaling
const anchor = new THREE.Group();
const fitGroup = new THREE.Group();
anchor.add(fitGroup);
scene.add(anchor);

const pepe = createPepeRealRigV16({ parent: fitGroup });

let modelReady = false;
let fittedScale = 1;

function set(mode) {
  if (mode === 'up') {
    pepe.setMarket({ direction: 1, speed: .9, thrust: 1 });
    label.textContent = 'UP · HAPPY / HIGH THRUST';
  } else if (mode === 'down') {
    pepe.setMarket({ direction: -1, speed: .08, thrust: .08 });
    label.textContent = 'DOWN · LOW THRUST';
  } else {
    pepe.setMarket({ direction: 0, speed: .22, thrust: .25 });
    label.textContent = 'IDLE · CRUISING';
  }
}

document.getElementById('up').onclick = () => set('up');
document.getElementById('idle').onclick = () => set('idle');
document.getElementById('down').onclick = () => set('down');

function updateCamera() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  const aspect = w / h;

  // Constant vertical world height. Portrait gets narrower automatically.
  const halfH = 2.6;

  camera.left = -halfH * aspect;
  camera.right = halfH * aspect;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h, true);
}

function fitCharacterToViewport() {
  if (!modelReady) return;

  // Neutral transforms while measuring.
  fitGroup.position.set(0, 0, 0);
  fitGroup.scale.setScalar(1);

  pepe.root.position.set(0, 0, 0);
  pepe.root.rotation.set(0, 0, 0);
  pepe.root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(fitGroup);
  if (box.isEmpty()) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const worldW = camera.right - camera.left;
  const worldH = camera.top - camera.bottom;

  // Leave room for HUD above and buttons below.
  const maxW = worldW * 0.70;
  const maxH = worldH * 0.58;

  fittedScale = Math.min(
    maxW / Math.max(size.x, 0.001),
    maxH / Math.max(size.y, 0.001)
  );

  // Hard safety limits.
  fittedScale = THREE.MathUtils.clamp(fittedScale, 0.28, 1.15);

  fitGroup.scale.setScalar(fittedScale);

  // Center the measured character.
  fitGroup.position.x = -center.x * fittedScale;

  // Slight upward bias to keep feet clear of the buttons.
  fitGroup.position.y = (-center.y * fittedScale) + 0.08;

  fitGroup.updateMatrixWorld(true);

  console.info('[PEPE V16.1] viewport fit', {
    model: { x: size.x, y: size.y },
    world: { x: worldW, y: worldH },
    scale: fittedScale
  });
}

function resize() {
  updateCamera();
  fitCharacterToViewport();
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
  setTimeout(resize, 80);
});

updateCamera();

const clock = new THREE.Clock();
let t = 0;

function frame() {
  requestAnimationFrame(frame);

  const dt = Math.min(clock.getDelta(), .05);
  t += dt;

  pepe.update(t, dt);
  renderer.render(scene, camera);
}

pepe.ready.then(() => {
  modelReady = true;
  set('idle');

  // Wait one frame so all textures/meshes have final matrices.
  requestAnimationFrame(() => {
    fitCharacterToViewport();
    frame();
  });
}).catch(err => {
  console.error('[PEPE V16.1]', err);
  label.textContent = 'LOAD ERROR — CHECK CONSOLE';
  document.body.dataset.error = '1';
});
