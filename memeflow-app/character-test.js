import * as THREE from '/vendor/three.module.js';
import {
  createPepeCharacterRig
} from '/character-rig.js?v=1786492600';

const mount =
  document.getElementById('stage');

const status =
  document.getElementById('statusText');


/* ================================
   THREE SCENE
================================ */

const scene = new THREE.Scene();

const camera =
  new THREE.OrthographicCamera(
    -2.4,
     2.4,
     2.4,
    -2.4,
     0.1,
     100
  );

camera.position.set(0, 0, 10);


const renderer =
  new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio || 1, 2)
);

renderer.setClearColor(0x000000, 0);

mount.appendChild(renderer.domElement);


/* ================================
   CHARACTER ROOT
================================ */

const characterAnchor =
  new THREE.Group();

scene.add(characterAnchor);


/* ================================
   PEPE RIG
================================ */

const pepe =
  createPepeCharacterRig({
    parent: characterAnchor
  });

pepe.root.scale.setScalar(1.22);
pepe.root.position.set(0, -0.08, 0);


/* ================================
   STATES
================================ */

function happy() {

  status.textContent =
    'PRICE UP · HAPPY · HIGH THRUST';

  status.style.color = '#64ff9a';

  pepe.setMarket({
    direction: 1,
    speed: 0.85,
    thrust: 1
  });

  pepe.setLookToCamera(0.85);
}


function neutral() {

  status.textContent =
    'IDLE · CRUISING';

  status.style.color = '#ffffff';

  pepe.setMarket({
    direction: 0,
    speed: 0.22,
    thrust: 0.25
  });

  pepe.setLookToCamera(0.35);
}


function sad() {

  status.textContent =
    'PRICE DOWN · SAD · LOW THRUST';

  status.style.color = '#ff7272';

  pepe.setMarket({
    direction: -1,
    speed: 0.08,
    thrust: 0.08
  });

  pepe.setLookToCamera(1);
}


document
  .getElementById('happyBtn')
  .addEventListener('click', happy);

document
  .getElementById('neutralBtn')
  .addEventListener('click', neutral);

document
  .getElementById('sadBtn')
  .addEventListener('click', sad);


/* ================================
   RESIZE
================================ */

function resize() {

  const w = innerWidth;
  const h = innerHeight;

  renderer.setSize(w, h, false);

  const aspect = w / h;

  const size = 2.45;

  camera.left =
    -size * aspect;

  camera.right =
     size * aspect;

  camera.top = size;
  camera.bottom = -size;

  camera.updateProjectionMatrix();
}

window.addEventListener(
  'resize',
  resize
);

resize();


/* ================================
   ANIMATION
================================ */

const clock =
  new THREE.Clock();

let elapsed = 0;

function frame() {

  requestAnimationFrame(frame);

  const delta =
    Math.min(clock.getDelta(), 0.05);

  elapsed += delta;

  pepe.update(
    elapsed,
    delta
  );

  renderer.render(
    scene,
    camera
  );
}


/* ================================
   START
================================ */

pepe.ready.then(() => {

  status.textContent =
    'READY · CHARACTER ACTIVE';

  neutral();

  frame();

  console.log(
    '[PEPE TEST] Character rig running'
  );
});
