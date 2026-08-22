import * as THREE
from '/vendor/three.module.js';

import {
  createPepeSkeletonV15
} from '/character-real-rig-v15.js?v=front-arms-1502';


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

camera.position.z = 10;


const renderer =
  new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });

renderer.setPixelRatio(
  Math.min(
    devicePixelRatio || 1,
    2
  )
);

renderer.setClearColor(
  0x000000,
  0
);

mount.appendChild(
  renderer.domElement
);


const anchor =
  new THREE.Group();

scene.add(anchor);


const pepe =
  createPepeSkeletonV15({
    parent: anchor
  });


function mode(name) {

  if (name === 'up') {

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

  else if (name === 'down') {

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
      speed: .20,
      thrust: .20
    });

  }
}


up.onclick =
  () => mode('up');

idle.onclick =
  () => mode('idle');

down.onclick =
  () => mode('down');


function resize() {

  const w = innerWidth;
  const h = innerHeight;

  renderer.setSize(
    w,
    h,
    true
  );

  const aspect =
    w / h;

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


addEventListener(
  'resize',
  resize
);

resize();


const clock =
  new THREE.Clock();

let time = 0;


function frame() {

  requestAnimationFrame(
    frame
  );

  const dt =
    Math.min(
      clock.getDelta(),
      .05
    );

  time += dt;

  pepe.update(
    time,
    dt
  );

  renderer.render(
    scene,
    camera
  );
}


pepe.ready.then(() => {

  mode('idle');

  frame();

  console.log(
    '[PEPE V11 TEST] RUNNING'
  );
});
