
import * as THREE from '/vendor/three.module.js';
import { createRocketRideV34 } from '/rocket-ride-v34.js?v=36101';

const stage = document.getElementById('world');

if(!stage){
  console.error('[PEPE ROCKET V36 GAME] #world missing');
}else{
  const clamp=(n,a=0,b=1)=>
    Math.max(a,Math.min(b,Number(n)||0));

  const scene=new THREE.Scene();

  const camera=new THREE.OrthographicCamera(
    -2,2,2,-2,.1,100
  );

  camera.position.set(0,0,10);

  const renderer=new THREE.WebGLRenderer({
    alpha:true,
    antialias:true,
    powerPreference:'high-performance',
    premultipliedAlpha:true
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio||1,2)
  );

  renderer.setClearColor(0x01040b,1);

  renderer.domElement.id='pepeRocketCanvasV36';

  Object.assign(
    renderer.domElement.style,
    {
      position:'absolute',
      inset:'0',
      width:'100%',
      height:'100%',
      display:'block',
      pointerEvents:'none'
    }
  );

  stage.prepend(renderer.domElement);

  const fitGroup=new THREE.Group();
  scene.add(fitGroup);

  const ride=createRocketRideV34({
    scene,
    parent:fitGroup,
    baseUrl:'/game-assets/rocket-v34/'
  });

  const target={
    mode:'idle',
    stage:'ground',
    multiplier:1,
    peak:1,
    direction:0,
    speed:0,
    thrust:0,
    volatility:0,
    boost:0,
    progress:0,
    danger:'none'
  };

  const current={...target};

  let ready=false;
  let destroyed=false;

  let lastW=0;
  let lastH=0;

  let baseX=0;
  let baseY=0;
  let baseScale=1;

  const clock=new THREE.Clock();
  let t=0;

  function lerp(a,b,k){
    return a+(b-a)*k;
  }

  function fitModel(){
    if(!ready)return;

    fitGroup.position.set(0,0,0);
    fitGroup.scale.setScalar(1);

    ride.resetPoseForFit();

    const wasFlame=
      ride.flameRoot.visible;

    ride.flameRoot.visible=false;

    fitGroup.updateMatrixWorld(true);

    const box=
      new THREE.Box3()
        .setFromObject(ride.rocketRoot);

    ride.flameRoot.visible=wasFlame;

    if(box.isEmpty())return;

    const size=new THREE.Vector3();
    const center=new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const worldW=
      camera.right-camera.left;

    const worldH=
      camera.top-camera.bottom;

    /*
      In the real Game stage the viewport is much wider
      than the old standalone V36 page.

      Keep rocket large enough to read the Pepe face,
      but leave HUD / flight path around it.
    */
    const maxW=
      worldW*(worldW/worldH>1.25 ? .49 : .76);

    const maxH=
      worldH*.73;

    let scale=Math.min(
      maxW/Math.max(size.x,.001),
      maxH/Math.max(size.y,.001)
    );

    scale=THREE.MathUtils.clamp(
      scale,
      .38,
      1.08
    );

    baseScale=scale;

    baseX=-center.x*scale;
    baseY=-center.y*scale-.06;

    fitGroup.scale.setScalar(baseScale);
    fitGroup.position.set(baseX,baseY,0);
  }

  function resize(){
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

    if(w===lastW && h===lastH)return;

    lastW=w;
    lastH=h;

    renderer.setSize(
      w,
      h,
      false
    );

    const aspect=w/h;
    const halfH=2.2;

    camera.left=
      -halfH*aspect;

    camera.right=
      halfH*aspect;

    camera.top=halfH;
    camera.bottom=-halfH;

    camera.updateProjectionMatrix();

    fitModel();
  }

  function setState(next={}){
    if(!next || typeof next!=='object')return;

    if(next.mode!=null)
      target.mode=String(next.mode);

    if(next.stage!=null)
      target.stage=String(next.stage);

    if(next.danger!=null)
      target.danger=String(next.danger);

    for(const key of [
      'multiplier',
      'peak',
      'direction',
      'speed',
      'thrust',
      'volatility',
      'boost',
      'progress'
    ]){
      if(Number.isFinite(Number(next[key]))){
        target[key]=Number(next[key]);
      }
    }

    target.direction=
      clamp(target.direction,-1,1);

    target.speed=
      clamp(target.speed);

    target.thrust=
      clamp(target.thrust);

    target.volatility=
      clamp(target.volatility);

    target.boost=
      clamp(target.boost);

    target.progress=
      clamp(target.progress);
  }

  function updateSmooth(dt){
    const k=
      1-Math.exp(-dt*7.5);

    current.direction=
      lerp(
        current.direction,
        target.direction,
        k
      );

    current.speed=
      lerp(
        current.speed,
        target.speed,
        k
      );

    current.thrust=
      lerp(
        current.thrust,
        target.thrust,
        k
      );

    current.volatility=
      lerp(
        current.volatility,
        target.volatility,
        k
      );

    current.boost=
      lerp(
        current.boost,
        target.boost,
        k
      );

    current.progress=
      lerp(
        current.progress,
        target.progress,
        k*.68
      );

    current.multiplier=
      target.multiplier;

    current.peak=
      target.peak;

    current.mode=
      target.mode;

    current.stage=
      target.stage;

    current.danger=
      target.danger;
  }

  function placeRocket(){
    /*
      Real multiplier controls the overall flight.

      1x  : around center/lower area
      pump: drifts up/right
      dip : falls slightly back/down

      The smaller rideRoot bob/turbulence still comes
      from rocket-ride-v34.js.
    */
    const p=current.progress;

    const live=
      current.mode==='live' ||
      current.mode==='settling';

    const searching=
      current.mode==='searching';

    const xTravel=
      live
        ? p*.42
        : searching
          ? Math.sin(t*.48)*.025
          : 0;

    const yTravel=
      live
        ? p*.30
        : Math.sin(t*.72)*.018;

    const dip=
      Math.max(
        0,
        -current.direction
      )*.085;

    fitGroup.position.x=
      baseX+xTravel+
      current.direction*.025;

    fitGroup.position.y=
      baseY+yTravel-dip;

    const scaleBoost=
      1+
      current.boost*.022+
      Math.max(0,current.direction)*.010;

    fitGroup.scale.setScalar(
      baseScale*scaleBoost
    );
  }

  function frame(){
    if(destroyed)return;

    requestAnimationFrame(frame);

    if(document.hidden)return;

    const dt=Math.min(
      clock.getDelta(),
      .05
    );

    t+=dt;

    updateSmooth(dt);
    placeRocket();

    ride.update(
      t,
      dt,
      current
    );

    renderer.render(
      scene,
      camera
    );
  }

  const ro=
    new ResizeObserver(resize);

  ro.observe(stage);

  addEventListener(
    'resize',
    resize,
    {passive:true}
  );

  visualViewport?.addEventListener(
    'resize',
    resize,
    {passive:true}
  );

  const api={
    setState,

    getState(){
      return {
        target:{...target},
        current:{...current},
        ready
      };
    },

    resize,

    destroy(){
      destroyed=true;
      ro.disconnect();
      ride.destroy();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };

  globalThis.pepeRocketGameV36=api;

  ride.ready
    .then(()=>{
      ready=true;

      resize();
      fitModel();

      /*
        Idle pose before a round starts.
        Small engine pulse, calm head, moving space.
      */
      setState({
        mode:'idle',
        direction:0,
        speed:.035,
        thrust:.10,
        volatility:.02,
        boost:0,
        progress:.08,
        multiplier:1,
        peak:1
      });

      frame();

      console.info(
        '[PEPE ROCKET V36 GAME]',
        'READY'
      );
    })
    .catch(err=>{
      console.error(
        '[PEPE ROCKET V36 GAME]',
        err
      );

      renderer.domElement.dataset.error='1';
    });
}
