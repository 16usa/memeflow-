import * as THREE from '/vendor/three.module.js';

import {
  createPepeRealRigV2
} from '/character-real-rig-v2.js?v=jointfix4';

const mount = document.getElementById('stage');
const status = document.getElementById('state');

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(
  -2, 2,
   2.6, -2.6,
   0.1, 100
);

camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio || 1, 2)
);

renderer.setClearColor(0x000000, 0);

mount.appendChild(renderer.domElement);

const anchor = new THREE.Group();
scene.add(anchor);

const pepe = createPepeRealRigV2({
  parent: anchor
});

const PX = 4 / 1000;

function fixAssembly() {

  const p = pepe.parts;

  /*
    ARMS:
    move slightly toward body
    and put BEHIND torso.
  */

  p.armLeft.mesh.position.x += 18 * PX;
  p.armLeft.mesh.position.y += 5 * PX;
  p.armLeft.mesh.position.z = 0.005;
  p.armLeft.mesh.renderOrder = 5;

  p.armRight.mesh.position.x -= 18 * PX;
  p.armRight.mesh.position.y += 5 * PX;
  p.armRight.mesh.position.z = 0.006;
  p.armRight.mesh.renderOrder = 6;


  /*
    BODY covers shoulder sockets.
  */

  p.body.mesh.position.z = 0.010;
  p.body.mesh.renderOrder = 10;


  /*
    HANDS:
    move upward/inward over wrist openings.
  */

  p.handLeft.mesh.position.x += 18 * PX;
  p.handLeft.mesh.position.y += 27 * PX;
  p.handLeft.mesh.scale.setScalar(1.12);
  p.handLeft.mesh.position.z = 0.020;
  p.handLeft.mesh.renderOrder = 20;

  p.handRight.mesh.position.x -= 18 * PX;
  p.handRight.mesh.position.y += 27 * PX;
  p.handRight.mesh.scale.setScalar(1.12);
  p.handRight.mesh.position.z = 0.021;
  p.handRight.mesh.renderOrder = 21;


  /*
    LEGS stay behind torso.
  */

  p.legLeft.mesh.position.z = 0.001;
  p.legLeft.mesh.renderOrder = 1;

  p.legRight.mesh.position.z = 0.002;
  p.legRight.mesh.renderOrder = 2;


  /*
    HEAD stays above everything.
  */

  p.head.mesh.position.z = 0.040;
  p.head.mesh.renderOrder = 40;

  console.log('[PEPE V4] assembly corrected');
}


function setMode(mode) {

  if (mode === 'up') {
    status.textContent = 'PRICE UP · HIGH THRUST';
    status.style.color = '#71ffa5';

    pepe.setMarket({
      direction: 1,
      speed: .75,
      thrust: .75
    });
  }

  else if (mode === 'down') {
    status.textContent = 'PRICE DOWN · LOW THRUST';
    status.style.color = '#ff7676';

    pepe.setMarket({
      direction: -1,
      speed: .05,
      thrust: .05
    });
  }

  else {
    status.textContent = 'IDLE · CRUISING';
    status.style.color = '#ffffff';

    pepe.setMarket({
      direction: 0,
      speed: .15,
      thrust: .15
    });
  }
}

document.getElementById('up').onclick =
  () => setMode('up');

document.getElementById('idle').onclick =
  () => setMode('idle');

document.getElementById('down').onclick =
  () => setMode('down');


function resize() {

  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(
    width,
    height,
    true
  );

  const aspect = width / height;
  const vertical = 2.6;

  camera.top = vertical;
  camera.bottom = -vertical;
  camera.left = -vertical * aspect;
  camera.right = vertical * aspect;

  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();


const clock = new THREE.Clock();

let elapsed = 0;
let running = false;

function frame() {

  requestAnimationFrame(frame);

  if (!running) return;

  const dt = Math.min(
    clock.getDelta(),
    0.05
  );

  elapsed += dt;

  pepe.update(elapsed, dt);

  /*
    Пока фиксируем конечности.
    Настоящие суставы сделаем следующим шагом.
  */

  pepe.parts.armLeft.mesh.rotation.z = 0;
  pepe.parts.armRight.mesh.rotation.z = 0;

  pepe.parts.legLeft.mesh.rotation.z = 0;
  pepe.parts.legRight.mesh.rotation.z = 0;

  pepe.parts.handLeft.mesh.rotation.z = 0;
  pepe.parts.handRight.mesh.rotation.z = 0;

  renderer.render(scene, camera);
}


pepe.ready.then(() => {

  fixAssembly();

  setMode('idle');

  running = true;

  frame();

  console.log('[PEPE TEST V4] RUNNING');
});
