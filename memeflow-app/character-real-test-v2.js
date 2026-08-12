import * as THREE
from '/vendor/three.module.js';

import {
  createPepeRealRigV2
} from '/character-real-rig-v2.js';


const mount =
  document.getElementById('stage');

const status =
  document.getElementById('state');


const scene =
  new THREE.Scene();


const camera =
  new THREE.OrthographicCamera(
    -2,
     2,
     2.6,
    -2.6,
     0.1,
     100
  );

camera.position.set(
  0,
  0,
  10
);


const renderer =
  new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });


renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio || 1,
    2
  )
);

renderer.setClearColor(
  0x000000,
  0
);

renderer.domElement.style.position =
  'fixed';

renderer.domElement.style.inset =
  '0';

renderer.domElement.style.display =
  'block';

mount.appendChild(
  renderer.domElement
);


const anchor =
  new THREE.Group();

scene.add(anchor);


const pepe =
  createPepeRealRigV2({
    parent: anchor
  });


function setMode(mode) {

  if (mode === 'up') {

    status.textContent =
      'PRICE UP · HIGH THRUST';

    status.style.color =
      '#71ffa5';

    pepe.setMarket({
      direction: 1,
      speed: .85,
      thrust: 1
    });

  }

  else if (mode === 'down') {

    status.textContent =
      'PRICE DOWN · LOW THRUST';

    status.style.color =
      '#ff7676';

    pepe.setMarket({
      direction: -1,
      speed: .08,
      thrust: .08
    });

  }

  else {

    status.textContent =
      'IDLE · CRUISING';

    status.style.color =
      '#ffffff';

    pepe.setMarket({
      direction: 0,
      speed: .22,
      thrust: .25
    });

  }
}


document
  .getElementById('up')
  .onclick =
  () => setMode('up');


document
  .getElementById('idle')
  .onclick =
  () => setMode('idle');


document
  .getElementById('down')
  .onclick =
  () => setMode('down');


function resize() {

  const width =
    window.innerWidth;

  const height =
    window.innerHeight;

  renderer.setSize(
    width,
    height,
    false
  );


  /*
    На телефоне сохраняем большой запас
    вокруг персонажа.

    Vertical world = 5.2 units.
  */

  const aspect =
    width / height;

  const vertical =
    2.6;

  camera.top =
    vertical;

  camera.bottom =
    -vertical;

  camera.left =
    -vertical * aspect;

  camera.right =
    vertical * aspect;

  camera.updateProjectionMatrix();
}


window.addEventListener(
  'resize',
  resize
);

resize();


const clock =
  new THREE.Clock();

let elapsed = 0;


function frame() {

  requestAnimationFrame(frame);

  const dt =
    Math.min(
      clock.getDelta(),
      0.05
    );

  elapsed += dt;

  pepe.update(
    elapsed,
    dt
  );

  renderer.render(
    scene,
    camera
  );
}


pepe.ready.then(() => {

  setMode('idle');

  frame();

  console.log(
    '[PEPE TEST V2] RUNNING'
  );
});
