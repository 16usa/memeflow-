
import * as THREE from '/vendor/three.module.js';
import { createClassicPepeSpriteV1 } from '/classic-pepe-sprite-v1.js?v=14';

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

  
const classicPepe = createClassicPepeSpriteV1({
  parent: fitGroup,
  baseUrl: '/game-assets/classic-pepe-jetpack-v4/'
});

/*
 * Compatibility adapter.
 * The existing flight controller continues to drive "ride",
 * but the rendered character is Classic Pepe V4.
 */
const legacyFlameRoot = new THREE.Group();
legacyFlameRoot.visible = false;
fitGroup.add(legacyFlameRoot);

const ride = {
  rocketRoot: classicPepe.group,
  flameRoot: legacyFlameRoot,

  ready: Promise.resolve(),

  resetPoseForFit() {
    classicPepe.group.position.set(0, 0, 0);
    classicPepe.group.rotation.set(0, 0, 0);
    classicPepe.group.scale.setScalar(1);
    classicPepe.setVisible(true);
  },

  update(t, dt, state = {}) {
    const mode = String(state.mode || '').toLowerCase();
    const stage = String(state.stage || '').toLowerCase();
    const danger = String(state.danger || '').toLowerCase();

    let next = 'fly';

    if (
      mode.includes('reconnect') ||
      stage.includes('reconnect')
    ) {
      next = 'hover';
    } else if (
      mode.includes('parachute') ||
      stage.includes('parachute') ||
      mode.includes('stop') ||
      stage.includes('stop')
    ) {
      next = 'parachute';
    } else if (
      mode.includes('crash') ||
      stage.includes('crash') ||
      danger.includes('crash')
    ) {
      next = 'crash';
    } else if (
      mode.includes('cash') ||
      stage.includes('cash')
    ) {
      next = 'cashout';
    } else if (
      mode.includes('target') ||
      stage.includes('target') ||
      mode.includes('victory') ||
      stage.includes('victory')
    ) {
      next = 'target';
    } else if (
      Number(state.boost || 0) > 0.45 ||
      Number(state.thrust || 0) > 0.8
    ) {
      next = 'boost';
    } else if (
      mode === 'idle' ||
      stage === 'ground'
    ) {
      next = 'hover';
    }

    classicPepe.setState(next);
    classicPepe.setVisible(true);
    classicPepe.update(dt);
  },

  destroy() {
    classicPepe.destroy();
  }
};


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

    scale=THREE.MathUtils.clamp(scale*1.7,.62,1.45);baseScale=scale;

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

  if(next.flightState!=null)
    target.flightState=String(next.flightState);

  if(next.outcome!=null)
    target.outcome=String(next.outcome);

  if(next.reason!=null)
    target.reason=String(next.reason);

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

  current.flightState=
    target.flightState || '';

  current.outcome=
    target.outcome || 'none';

  current.reason=
    target.reason || '';
  }

  let pepeTerminalKey='';
let pepeTerminalAt=0;
let pepeTerminalStartX=0;
let pepeTerminalStartY=0;

function placeRocket(){
  const p=clamp(Number(current.progress)||0,0,1);
  const mode=String(current.mode||'idle').toLowerCase();
  const flightState=String(current.flightState||'').toLowerCase();
  const outcome=String(current.outcome||'none').toLowerCase();
  const reason=String(current.reason||'').toUpperCase();

  const live=
    mode==='live' ||
    mode==='settling';

  const searching=
    mode==='searching';

  let terminal='';

  if(reason.includes('AUTO_CASH_OUT')){
    terminal='target';
  }else if(reason.includes('STOP_LOSS')){
    terminal='stop';
  }else if(reason.includes('MANUAL_CASH_OUT')){
    terminal='cashout';
  }else if(outcome==='crash' || flightState==='crash'){
    terminal='crash';
  }else if(outcome==='secure' || flightState==='secured'){
    terminal='cashout';
  }

  const key=terminal
    ? terminal+':'+(reason||outcome||flightState)
    : '';

  if(key && key!==pepeTerminalKey){
    pepeTerminalKey=key;
    pepeTerminalAt=t;
    pepeTerminalStartX=fitGroup.position.x;
    pepeTerminalStartY=fitGroup.position.y;
  }

  if(!key){
    pepeTerminalKey='';
  }

  if(terminal){
    const age=Math.max(0,t-pepeTerminalAt);

    const duration=
      terminal==='target' ? .55 :
      terminal==='cashout' ? .62 :
      terminal==='stop' ? .85 :
      .72;

    const q=clamp(age/duration,0,1);
    const e=q*q;

    if(terminal==='target'){
      fitGroup.position.x=
        pepeTerminalStartX+1.65*e;

      fitGroup.position.y=
        pepeTerminalStartY+1.05*e;

      fitGroup.rotation.z=
        THREE.MathUtils.degToRad(-24*e);

      fitGroup.scale.setScalar(
        baseScale*(1+.08*e)
      );
      return;
    }

    if(terminal==='cashout'){
      fitGroup.position.x=
        pepeTerminalStartX+1.35*e;

      fitGroup.position.y=
        pepeTerminalStartY+.62*e;

      fitGroup.rotation.z=
        THREE.MathUtils.degToRad(-12*e);

      fitGroup.scale.setScalar(baseScale);
      return;
    }

    if(terminal==='stop'){
      fitGroup.position.x=
        pepeTerminalStartX+1.15*e;

      fitGroup.position.y=
        pepeTerminalStartY-1.05*e;

      fitGroup.rotation.z=
        THREE.MathUtils.degToRad(8*e);

      fitGroup.scale.setScalar(baseScale);
      return;
    }

    fitGroup.position.x=
      pepeTerminalStartX+1.05*e;

    fitGroup.position.y=
      pepeTerminalStartY-1.28*e;

    fitGroup.rotation.z=
      age*(2.2+age*2.4);

    fitGroup.scale.setScalar(baseScale);
    return;
  }

  const xTravel=
    live
      ? .08+p*.52
      : searching
        ? Math.sin(t*.48)*.025
        : 0;

  const yTravel=
    live
      ? p*.30
      : Math.sin(t*.72)*.018;

  const dip=
    Math.max(0,-current.direction)*.085;

  fitGroup.position.x=
    baseX+
    xTravel+
    current.direction*.025;

  fitGroup.position.y=
    baseY+
    yTravel-
    dip;

  fitGroup.rotation.z=
    live
      ? THREE.MathUtils.degToRad(
          -current.direction*6
        )
      : 0;

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
