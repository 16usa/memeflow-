
import * as THREE from '/vendor/three.module.js';
import { createMotionController } from '/motion-controller.js?v=35001';
import { createRocketRideV34 } from '/rocket-ride-v34.js?v=35001';
import { createMarketBridgeV35 } from '/market-bridge-v35.js?v=35001';
import { createRealPriceSourceV36 } from '/market-source-v36.js?v=36001';

const stage=document.getElementById('stage');
const label=document.getElementById('state');
const debug=document.getElementById('debug');

const scene=new THREE.Scene();

const camera=new THREE.OrthographicCamera(
  -2,2,2,-2,.1,100
);

camera.position.set(0,0,10);

const renderer=new THREE.WebGLRenderer({
  alpha:true,
  antialias:true,
  powerPreference:'high-performance'
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio||1,2)
);

renderer.setClearColor(0x000000,0);

Object.assign(
  renderer.domElement.style,
  {
    position:'absolute',
    inset:'0',
    width:'100%',
    height:'100%',
    display:'block'
  }
);

stage.appendChild(renderer.domElement);

const fitGroup=new THREE.Group();
scene.add(fitGroup);

const motion=createMotionController({
  response:5.5
});

const ride=createRocketRideV34({
  scene,
  parent:fitGroup
});

const market=createMarketBridgeV35({
  motion
}).start({
  stateUrl:null,
  demoFallback:false,
  eventName:'memeflow:price'
});

const realPrice=createRealPriceSourceV36({
  market,
  url:'/data/state.json',
  intervalMs:350
}).start();

let manualTimer=0;

function manual(mode){
  market.setEnabled(false);
  motion.setMode(mode);

  clearTimeout(manualTimer);

  manualTimer=setTimeout(()=>{
    market.setEnabled(true);
  },1800);
}

// These buttons are now diagnostics only.
document.getElementById('up').onclick=()=>{
  manual('up');
};

document.getElementById('idle').onclick=()=>{
  market.setEnabled(true);
};

document.getElementById('down').onclick=()=>{
  manual('down');
};

let ready=false;
let lastW=0;
let lastH=0;
let lastHud=0;

function fitModel(){
  if(!ready)return;

  fitGroup.position.set(0,0,0);
  fitGroup.scale.setScalar(1);

  ride.resetPoseForFit();

  const flameVisible=
    ride.flameRoot.visible;

  ride.flameRoot.visible=false;

  fitGroup.updateMatrixWorld(true);

  const box=
    new THREE.Box3()
      .setFromObject(ride.rocketRoot);

  ride.flameRoot.visible=
    flameVisible;

  if(box.isEmpty())return;

  const size=new THREE.Vector3();
  const center=new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  const worldW=
    camera.right-camera.left;

  const worldH=
    camera.top-camera.bottom;

  const maxW=worldW*.91;
  const maxH=worldH*.75;

  let scale=Math.min(
    maxW/Math.max(size.x,.001),
    maxH/Math.max(size.y,.001)
  );

  scale=THREE.MathUtils.clamp(
    scale,
    .20,
    1.18
  );

  fitGroup.scale.setScalar(scale);

  fitGroup.position.x=
    -center.x*scale;

  fitGroup.position.y=
    -center.y*scale+.04;
}

function resizeCanvas(){
  const rect=
    stage.getBoundingClientRect();

  const w=Math.max(
    1,
    Math.round(rect.width)
  );

  const h=Math.max(
    1,
    Math.round(rect.height)
  );

  if(w===lastW&&h===lastH)return;

  lastW=w;
  lastH=h;

  renderer.setSize(w,h,false);

  const aspect=w/h;
  const halfH=2.2;

  camera.left=-halfH*aspect;
  camera.right=halfH*aspect;
  camera.top=halfH;
  camera.bottom=-halfH;

  camera.updateProjectionMatrix();

  fitModel();

  debug.textContent=
    `V35 AUTO · ${w}×${h}`;
}

new ResizeObserver(
  resizeCanvas
).observe(stage);

window.addEventListener(
  'resize',
  resizeCanvas
);

window.visualViewport?.addEventListener(
  'resize',
  resizeCanvas
);

const clock=new THREE.Clock();

let t=0;

function frame(){
  requestAnimationFrame(frame);

  const dt=Math.min(
    clock.getDelta(),
    .05
  );

  t+=dt;

  const state=
    motion.update(dt);

  ride.update(
    t,
    dt,
    state
  );

  renderer.render(
    scene,
    camera
  );

  if(t-lastHud>.25){
    lastHud=t;

    const x=
      market.getTelemetry();

    const pct=
      x.shortReturn*100;

    label.textContent=
      `AUTO ${x.source.toUpperCase()} · `+
      `${pct>=0?'+':''}${pct.toFixed(2)}% · `+
      `DIR ${x.direction.toFixed(2)}`;
  }
}

ride.ready
  .then(()=>{
    ready=true;

    requestAnimationFrame(()=>{
      resizeCanvas();
      fitModel();
      frame();
    });
  })
  .catch(err=>{
    console.error(
      '[PEPE ROCKET V35]',
      err
    );

    label.textContent=
      'LOAD ERROR';

    document.body.dataset.error='1';
  });

// Later the real game can also feed price directly:
window.pepeMarketV35=market;
window.pepeRealPriceV36=realPrice;
