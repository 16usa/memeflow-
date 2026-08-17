import { createClassicPepeSpriteV1 } from './classic-pepe-sprite-v1.js?v=14';
import * as THREE from '/vendor/three.module.js';
import { createPepeRealRigV16 } from '/character-real-rig-v16.js?v=32800';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const stage=document.getElementById('stage');
const stateEl=document.getElementById('state');
const subStateEl=document.getElementById('subState');
const multEl=document.getElementById('multiplier');
const pnlEl=document.getElementById('pnl');
const targetInput=document.getElementById('target');
const stopInput=document.getElementById('stop');
const targetLabel=document.getElementById('targetLabel');
const stopLabel=document.getElementById('stopLabel');
const stopLine=document.getElementById('stopLine');
const result=document.getElementById('result');
const resultTitle=document.getElementById('resultTitle');
const resultText=document.getElementById('resultText');

/* VISUAL_VIEWPORT_LAYOUT_V4 */
const demoPanel = document.getElementById('demo');
const controlsPanel = document.getElementById('controls');
const startButton = document.getElementById('start');

function applyVisualViewportLayout() {
  const vv = window.visualViewport;

  const viewportWidth = Math.max(
    240,
    Math.floor(
      vv?.width ||
      document.documentElement.clientWidth ||
      window.innerWidth
    )
  );

  const viewportHeight = Math.max(
    240,
    Math.floor(
      vv?.height ||
      document.documentElement.clientHeight ||
      window.innerHeight
    )
  );

  const viewportLeft = Math.max(
    0,
    Math.floor(vv?.offsetLeft || 0)
  );

  const isPortrait = viewportHeight > viewportWidth;
  const edge = isPortrait ? 4 : 8;

  const panelWidth = Math.max(
    220,
    viewportWidth - edge * 2
  );

  for (const panel of [demoPanel, controlsPanel]) {
    if (!panel) continue;

    panel.style.left = `${viewportLeft + edge}px`;
    panel.style.right = 'auto';
    panel.style.width = `${panelWidth}px`;
    panel.style.maxWidth = `${panelWidth}px`;
    panel.style.minWidth = '0';
    panel.style.boxSizing = 'border-box';
    panel.style.marginLeft = '0';
    panel.style.marginRight = '0';
  }

  if (demoPanel) {
    demoPanel.style.gridTemplateColumns = isPortrait
      ? 'repeat(3, minmax(0, 1fr))'
      : 'repeat(5, minmax(0, 1fr))';

    demoPanel.style.gap = isPortrait ? '4px' : '5px';
  }

  if (controlsPanel) {
    controlsPanel.style.gridTemplateColumns = isPortrait
      ? 'repeat(2, minmax(0, 1fr))'
      : 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, .82fr)';
  }

  if (startButton) {
    startButton.style.gridColumn = isPortrait
      ? '1 / -1'
      : 'auto';
  }

  document.querySelectorAll('.demoBtn, .field, .start').forEach((element) => {
    element.style.minWidth = '0';
    element.style.maxWidth = '100%';
    element.style.width = '100%';
    element.style.boxSizing = 'border-box';
  });

  document.querySelectorAll('.demoBtn').forEach((button) => {
    button.style.overflow = 'hidden';
    button.style.whiteSpace = 'nowrap';
    button.style.textOverflow = 'ellipsis';
  });
}

window.addEventListener('resize', applyVisualViewportLayout);
window.addEventListener('orientationchange', () => {
  requestAnimationFrame(applyVisualViewportLayout);
  setTimeout(applyVisualViewportLayout, 150);
  setTimeout(applyVisualViewportLayout, 400);
});

window.visualViewport?.addEventListener(
  'resize',
  applyVisualViewportLayout
);

window.visualViewport?.addEventListener(
  'scroll',
  applyVisualViewportLayout
);

requestAnimationFrame(applyVisualViewportLayout);
/* END_VISUAL_VIEWPORT_LAYOUT_V4 */

const scene=new THREE.Scene();

/* FLIGHT_WORLD_V6 */

const flightWorld = new THREE.Group();
flightWorld.name = 'FlightWorld';
scene.add(flightWorld);

const worldLayers = [];
const worldObjects = [];

function createStarLayer({
  count,
  size,
  opacity,
  speed,
  z
}) {
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    positions[i3] =
      THREE.MathUtils.randFloat(-12, 12);

    positions[i3 + 1] =
      THREE.MathUtils.randFloat(-5.5, 5.5);

    positions[i3 + 2] = z;
  }

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: false
  });

  const points = new THREE.Points(
    geometry,
    material
  );

  points.frustumCulled = false;

  flightWorld.add(points);

  worldLayers.push({
    points,
    geometry,
    speed
  });

  return points;
}

createStarLayer({
  count: 90,
  size: 1.1,
  opacity: .30,
  speed: .12,
  z: -8
});

createStarLayer({
  count: 60,
  size: 1.5,
  opacity: .46,
  speed: .25,
  z: -7
});

createStarLayer({
  count: 34,
  size: 2.0,
  opacity: .70,
  speed: .52,
  z: -6
});

function createPlanet({
  x,
  y,
  radius,
  opacity,
  speed,
  z
}) {
  const geometry =
    new THREE.CircleGeometry(radius, 48);

  const material =
    new THREE.MeshBasicMaterial({
      color: 0x28465d,
      transparent: true,
      opacity,
      depthWrite: false
    });

  const planet =
    new THREE.Mesh(geometry, material);

  planet.position.set(x, y, z);

  flightWorld.add(planet);

  worldObjects.push({
    object: planet,
    speed,
    resetX: x + 16
  });

  return planet;
}

const farPlanet = createPlanet({
  x: 7.8,
  y: 1.15,
  radius: 1.15,
  opacity: .11,
  speed: .055,
  z: -9
});

const smallPlanet = createPlanet({
  x: 4.8,
  y: -1.35,
  radius: .42,
  opacity: .17,
  speed: .11,
  z: -8
});

const ringGeometry =
  new THREE.RingGeometry(.55, .60, 64);

const ringMaterial =
  new THREE.MeshBasicMaterial({
    color: 0x7390a5,
    transparent: true,
    opacity: .12,
    depthWrite: false,
    side: THREE.DoubleSide
  });

const planetRing =
  new THREE.Mesh(
    ringGeometry,
    ringMaterial
  );

planetRing.position.set(
  smallPlanet.position.x,
  smallPlanet.position.y,
  -7.9
);

planetRing.scale.y = .30;
planetRing.rotation.z = -.30;

flightWorld.add(planetRing);

worldObjects.push({
  object: planetRing,
  speed: .11,
  resetX: 20.8
});

const speedLineGroup = new THREE.Group();
speedLineGroup.name = 'SpeedLines';
flightWorld.add(speedLineGroup);

const speedLines = [];

for (let i = 0; i < 18; i++) {
  const geometry =
    new THREE.BufferGeometry();

  const length =
    THREE.MathUtils.randFloat(.32, .90);

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0,
        length, 0, 0
      ],
      3
    )
  );

  const material =
    new THREE.LineBasicMaterial({
      color: 0xa8dff5,
      transparent: true,
      opacity: .12,
      depthWrite: false
    });

  const line =
    new THREE.Line(
      geometry,
      material
    );

  line.position.set(
    THREE.MathUtils.randFloat(-8, 8),
    THREE.MathUtils.randFloat(-3.2, 3.2),
    -4
  );

  speedLineGroup.add(line);

  speedLines.push({
    line,
    speed:
      THREE.MathUtils.randFloat(.9, 1.7)
  });
}

function resetFlightWorld() {
  for (const layer of worldLayers) {
    const position =
      layer.geometry.attributes.position;

    for (let i = 0; i < position.count; i++) {
      position.setX(
        i,
        THREE.MathUtils.randFloat(-10, 10)
      );

      position.setY(
        i,
        THREE.MathUtils.randFloat(-4, 4)
      );
    }

    position.needsUpdate = true;
  }
}

function updateFlightWorld(dt) {
  const active =
    runtime &&
    ['launch', 'flying'].includes(
      runtime.state
    );

  const baseSpeed =
    active
      ? 2.35 +
        Math.min(
          Math.max(
            runtime.multiplier - 1,
            0
          ) * .32,
          1.1
        )
      : .10;

  const worldWidth =
    camera.right - camera.left;

  const leftEdge =
    camera.left - worldWidth * .30;

  const rightEdge =
    camera.right + worldWidth * .35;

  for (const layer of worldLayers) {
    const position =
      layer.geometry.attributes.position;

    for (let i = 0; i < position.count; i++) {
      let x =
        position.getX(i) -
        dt *
        baseSpeed *
        layer.speed *
        worldWidth;

      if (x < leftEdge) {
        x =
          rightEdge +
          THREE.MathUtils.randFloat(
            0,
            worldWidth * .35
          );

        position.setY(
          i,
          THREE.MathUtils.randFloat(
            camera.bottom,
            camera.top
          )
        );
      }

      position.setX(i, x);
    }

    position.needsUpdate = true;
  }

  for (const item of worldObjects) {
    item.object.position.x -=
      dt *
      baseSpeed *
      item.speed *
      worldWidth;

    if (
      item.object.position.x <
      leftEdge - 2
    ) {
      item.object.position.x =
        rightEdge +
        THREE.MathUtils.randFloat(
          2,
          worldWidth * .6
        );
    }
  }

  const speedOpacity =
    active
      ? THREE.MathUtils.clamp(
          .16 +
          baseSpeed * .075,
          .18,
          .42
        )
      : .025;

  for (const item of speedLines) {
    const line = item.line;

    line.material.opacity =
      speedOpacity;

    line.position.x -=
      dt *
      baseSpeed *
      item.speed *
      worldWidth;

    if (line.position.x < leftEdge) {
      line.position.x =
        rightEdge +
        THREE.MathUtils.randFloat(
          0,
          worldWidth * .25
        );

      line.position.y =
        THREE.MathUtils.randFloat(
          camera.bottom * .88,
          camera.top * .88
        );
    }
  }

  if (typeof characterAnchor !== 'undefined') {
    const isPortrait =
      window.innerHeight >
      window.innerWidth;

    const worldWidth =
      camera.right - camera.left;

    const roundElapsed =
      runtime.startedAt
        ? Math.max(
            0,
            (performance.now() - runtime.startedAt) / 1000
          )
        : 0;

    /*
      Real side-view launch:
      start near the left edge,
      move visibly forward,
      then camera-follow around the left-middle lane.
    */
    const launchDuration = 1.35;

    const rawLaunchProgress =
      THREE.MathUtils.clamp(
        roundElapsed / launchDuration,
        0,
        1
      );

    const launchProgress =
      1 - Math.pow(
        1 - rawLaunchProgress,
        3
      );

    const startRatio =
      isPortrait ? .16 : .12;

    const cruiseRatio =
      isPortrait ? .35 : .31;

    const laneRatio =
      THREE.MathUtils.lerp(
        startRatio,
        cruiseRatio,
        launchProgress
      );

    const baseLaneX =
      camera.left +
      worldWidth * laneRatio;

    /*
      Small forward surges make the character feel
      powered rather than pinned to one X coordinate.
    */
    const forwardSurge =
      active
        ? Math.sin(
            performance.now() * .0042
          ) * worldWidth * .009
        : 0;

    const accelerationKick =
      active &&
      rawLaunchProgress < 1
        ? Math.sin(
            rawLaunchProgress * Math.PI
          ) * worldWidth * .035
        : 0;

    const targetX =
      baseLaneX +
      forwardSurge +
      accelerationKick;

    characterAnchor.position.x =
      THREE.MathUtils.lerp(
        characterAnchor.position.x,
        targetX,
        1 - Math.exp(-dt * 6.5)
      );

    const direction =
      pepe?.state?.smoothedDirection || 0;

    const launchTilt =
      active &&
      rawLaunchProgress < 1
        ? -.13 *
          Math.sin(
            rawLaunchProgress * Math.PI
          )
        : 0;

    const priceTilt =
      active
        ? direction * -.085
        : 0;

    characterAnchor.rotation.z =
      THREE.MathUtils.lerp(
        characterAnchor.rotation.z,
        launchTilt + priceTilt,
        1 - Math.exp(-dt * 5)
      );
  }
}

/* END_FLIGHT_WORLD_V6 */


const camera=new THREE.OrthographicCamera(-4,4,2.2,-2.2,.1,100);
camera.position.set(0,0,10);
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.setClearColor(0x000000,0);
stage.appendChild(renderer.domElement);

const world=new THREE.Group();
scene.add(world);
const bgFar=new THREE.Group(),bgMid=new THREE.Group(),fxLayer=new THREE.Group(),characterAnchor=new THREE.Group();
world.add(bgFar,bgMid,fxLayer,characterAnchor);

const fitGroup=new THREE.Group();
characterAnchor.add(fitGroup);
const pepe=createPepeRealRigV16({parent:fitGroup});

const classicPepe =
  createClassicPepeSpriteV1({
    parent: characterAnchor,
    baseUrl:
      '/game-assets/classic-pepe-jetpack-v4/'
  });

/*
  Keep the old articulated rig alive for compatibility,
  but never render it.
*/
pepe.root.visible = false;
fitGroup.visible = false;
classicPepe.setVisible(true);



const runtime={
  state:'loading',entryPrice:1,price:1,multiplier:1,pnlPct:0,
  target:5,stopLoss:null,startedAt:0,stateAt:performance.now(),pending:null,
  y:0,vy:0,worldX:0,shake:0,demo:null,demoT:0,finished:false,
  autoFlight:false,externalFeed:false,flightSeed:Math.random()*1000
};

function makeStarField(group,count,z,size,opacity){
  const geo=new THREE.BufferGeometry();
  const pos=[];
  for(let i=0;i<count;i++)pos.push((Math.random()-.5)*18,(Math.random()-.5)*7,z);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({color:0xd8edff,size,transparent:true,opacity,depthWrite:false});
  const pts=new THREE.Points(geo,mat);group.add(pts);return pts;
}
const farStars=makeStarField(bgFar,150,-2,.018,.42);
const midStars=makeStarField(bgMid,80,-1,.03,.72);

const trailPoints=[];
const trailGeo=new THREE.BufferGeometry();
const trailMat=new THREE.LineBasicMaterial({color:0x58d8ff,transparent:true,opacity:.42,depthWrite:false});
const trailLine=new THREE.Line(trailGeo,trailMat);trailLine.frustumCulled=false;fxLayer.add(trailLine);

const flameGroup=new THREE.Group();characterAnchor.add(flameGroup);
function makeFlame(color,xScale,opacity){
  const geo=new THREE.ConeGeometry(.12,.72,12);geo.rotateZ(Math.PI/2);geo.translate(-.36,0,0);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Mesh(geo,mat);mesh.scale.set(xScale,1,1);flameGroup.add(mesh);return mesh;
}
const flameOuter=makeFlame(0x3ecbff,1.3,.6);
const flameInner=makeFlame(0xe9fbff,.72,.95);
flameGroup.position.set(-1.05,-.28,.2);

const parachute=new THREE.Group();characterAnchor.add(parachute);parachute.visible=false;
const canopyMat=new THREE.MeshBasicMaterial({color:0xe8eef2,transparent:true,opacity:.96,side:THREE.DoubleSide,depthWrite:false});
const canopy=new THREE.Mesh(new THREE.CircleGeometry(.75,40,0,Math.PI),canopyMat);canopy.rotation.z=Math.PI;canopy.position.y=1.36;parachute.add(canopy);
const ropeMat=new THREE.LineBasicMaterial({color:0xcfd9df,transparent:true,opacity:.9});
for(const x of [-.56,.56]){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.3,.1),new THREE.Vector3(x,1.22,.1)]);parachute.add(new THREE.Line(g,ropeMat));}
parachute.scale.setScalar(.001);

function fitCharacter(){
  fitGroup.position.set(0,0,0);fitGroup.scale.setScalar(1);pepe.root.position.set(0,0,0);pepe.root.rotation.set(0,0,0);pepe.root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(fitGroup);if(box.isEmpty())return;
  const size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);
  const isPortrait = window.innerHeight > window.innerWidth;
  const maxW = isPortrait ? 1.05 : 1.85;
  const maxH = isPortrait ? 1.62 : 2.55;
  const s=clamp(Math.min(maxW/Math.max(size.x,.001),maxH/Math.max(size.y,.001)),.16,.82);
  fitGroup.scale.setScalar(s);fitGroup.position.set(-center.x*s,-center.y*s,0);fitGroup.updateMatrixWorld(true);
  flameGroup.scale.setScalar(s*.86);parachute.scale.setScalar(.001);
}

function resize(){
  const r=stage.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));
  renderer.setSize(w,h,false);const halfH=2.2,aspect=w/h;camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();
  fitCharacter();
}
new ResizeObserver(resize).observe(stage);addEventListener('resize',resize);visualViewport?.addEventListener('resize',resize);

function readConfig(){
  runtime.target=clamp(Number(targetInput.value)||5,1.05,100);
  const raw=stopInput.value.trim();runtime.stopLoss=raw===''?null:clamp(Math.abs(Number(raw)||0),.1,99);
  targetLabel.textContent=`TARGET ${runtime.target.toFixed(2)}x`;
  stopLabel.textContent=runtime.stopLoss==null?'NO STOP-LOSS':`STOP −${runtime.stopLoss}%`;
  stopLine.style.display=runtime.stopLoss==null?'none':'block';
}
function setHud(title,sub){stateEl.textContent=title;subStateEl.textContent=sub;}

const GAME_STATES = Object.freeze({
  READY: 'ready',
  LAUNCH: 'launch',
  FLYING: 'flying',
  RECONNECTING: 'reconnecting',
  STOP_DEPLOY: 'stopDeploy',
  PARACHUTING: 'parachuting',
  TARGET_HIT: 'targetHit',
  VICTORY: 'victory',
  CASH_OUT: 'cashOut',
  CRASH: 'crash',
  CANCELLED: 'cancelled'
});

const STATE_TRANSITIONS = {
  ready:        ['launch'],

  launch:       [
    'flying',
    'reconnecting',
    'stopDeploy',
    'targetHit',
    'cashOut',
    'crash',
    'cancelled'
  ],

  flying:       [
    'reconnecting',
    'stopDeploy',
    'targetHit',
    'cashOut',
    'crash',
    'cancelled'
  ],

  reconnecting: [
    'flying',
    'stopDeploy',
    'targetHit',
    'cashOut',
    'crash',
    'cancelled'
  ],

  stopDeploy:   ['parachuting'],
  targetHit:    ['victory'],

  parachuting:  ['launch'],
  victory:      ['launch'],
  cashOut:      ['launch'],
  crash:        ['launch'],
  cancelled:    ['launch']
};

function canEnterState(from, to) {
  if (from === to) return true;

  const allowed = STATE_TRANSITIONS[from];

  // Keep startup/backward compatibility safe.
  if (!allowed) return true;

  return allowed.includes(to);
}

function enter(next) {
  const previous = runtime.state;

  if (!canEnterState(previous, next)) {
    console.warn(
      '[GAME STATE] blocked transition:',
      previous,
      '->',
      next
    );

    return false;
  }

  runtime.state = next;
  runtime.stateAt = performance.now();

  console.log(
    '[GAME STATE]',
    previous,
    '->',
    next
  );

  if (next === 'launch') {
    setHud(
      'IGNITION',
      `Target ${runtime.target.toFixed(2)}x${runtime.stopLoss === null
        ? ' · No stop-loss'
        : ` · Stop −${runtime.stopLoss}%`
      }`
    );
  }

  if (next === 'flying') {
    setHud(
      'LIVE',
      'Price controls vertical flight'
    );
  }

  if (next === 'stopDeploy') {
    setHud(
      'STOP LOSS',
      'Emergency parachute'
    );
  }

  if (next === 'parachuting') {
    setHud(
      'STOPPED',
      'Protected exit'
    );
  }

  if (next === 'targetHit') {
    setHud(
      `${runtime.target.toFixed(2)}x TARGET HIT`,
      'Maximum thrust'
    );

    runtime.shake = .12;
  }

  if (next === 'victory') {
    setHud(
      'TARGET COMPLETE',
      'Moon exit'
    );
  }

  if (next === 'cashOut') {
    setHud(
      'CASH OUT',
      'Controlled exit'
    );
  }

  if (next === 'crash') {
    setHud(
      'NO STOP · LOSS',
      'Engine failure · uncontrolled fall'
    );
  }

  if (next === 'reconnecting') {
    setHud(
      'RECONNECTING…',
      'Flight frozen · no loss event'
    );
  }

  if (next === 'cancelled') {
    setHud(
      'ROUND CANCELLED',
      'Neutral exit'
    );
  }

  return true;
}

function queueOutcome(next){
  if(runtime.state==='launch'&&performance.now()-runtime.startedAt<340){runtime.pending=next;return;}enter(next);
}
function startRound(demo=null, options={}){
  readConfig();

  runtime.entryPrice=1;
  runtime.price=1;
  runtime.multiplier=1;
  runtime.pnlPct=0;

  runtime.y=0;
  runtime.vy=0;
  runtime.worldX=0;
  runtime.pending=null;

  runtime.startedAt=performance.now();
  runtime.finished=false;

  runtime.demo=demo;
  runtime.demoT=0;

  runtime.autoFlight=options.autoFlight===true;
  runtime.externalFeed=options.externalFeed===true;
  runtime.flightSeed=Math.random()*1000;

  trailPoints.length=0;

  resetFlightWorld();

  result.classList.remove('show');

  parachute.visible=false;
  parachute.scale.setScalar(.001);

  flameGroup.visible=true;

  const isPortrait=window.innerHeight>window.innerWidth;
  const anchorRatio=isPortrait?.34:.30;

  characterAnchor.position.set(
    camera.left+(camera.right-camera.left)*anchorRatio,
    -.05,
    0
  );

  characterAnchor.rotation.z=0;
  pepe.root.rotation.z=0;

  enter('launch');
}

function applyPriceTick({
  multiplier = null,
  price = null,
  pnlPct = null,
  source = 'external',
  timestamp = performance.now()
} = {}) {
  if (
    !['launch', 'flying', 'reconnecting'].includes(runtime.state)
  ) {
    return false;
  }

  let nextMultiplier = null;

  if (multiplier != null) {
    nextMultiplier = Number(multiplier);
  } else if (price != null) {
    const numericPrice = Number(price);

    if (
      Number.isFinite(numericPrice) &&
      runtime.entryPrice > 0
    ) {
      nextMultiplier =
        numericPrice / runtime.entryPrice;
    }
  } else if (pnlPct != null) {
    const numericPnl = Number(pnlPct);

    if (Number.isFinite(numericPnl)) {
      nextMultiplier =
        1 + numericPnl / 100;
    }
  }

  if (
    !Number.isFinite(nextMultiplier) ||
    nextMultiplier <= 0
  ) {
    console.warn(
      '[PRICE FEED] invalid tick',
      { multiplier, price, pnlPct, source }
    );

    return false;
  }

  if (source === 'external') {
    runtime.externalFeed = true;
    runtime.autoFlight = false;
  }

  runtime.multiplier = Math.max(
    0.01,
    nextMultiplier
  );

  runtime.pnlPct =
    (runtime.multiplier - 1) * 100;

  runtime.price =
    runtime.entryPrice * runtime.multiplier;

  runtime.lastPriceTickAt = timestamp;
  runtime.lastPriceSource = source;

  if (
    source !== 'external' &&
    runtime.multiplier >= runtime.target
  ) {
    dispatchGameEvent(
      ROUND_EVENTS.TARGET_HIT,
      {
        multiplier: runtime.multiplier,
        price: runtime.price,
        pnlPct: runtime.pnlPct,
        source,
        timestamp
      }
    );

    return true;
  }

  if (
    source !== 'external' &&
    runtime.stopLoss != null &&
    runtime.pnlPct <= -runtime.stopLoss
  ) {
    dispatchGameEvent(
      ROUND_EVENTS.STOP_LOSS_HIT,
      {
        multiplier: runtime.multiplier,
        price: runtime.price,
        pnlPct: runtime.pnlPct,
        source,
        timestamp
      }
    );

    return true;
  }

  return true;
}

/*
 * Backward-compatible wrapper.
 * Existing internal/demo code can still call onPrice(mult).
 */
function onPrice(mult, source = 'external') {
  return applyPriceTick({
    multiplier: mult,
    source
  });
}

window.MemeFlowGame={
  start:(cfg={})=>{
    if(cfg.targetMultiplier!=null)targetInput.value=cfg.targetMultiplier;
    if(cfg.stopLossPct==null)stopInput.value='';
    else if(cfg.stopLossPct!==undefined)stopInput.value=cfg.stopLossPct;

    startRound(null,{
      autoFlight:false,
      externalFeed:true
    });
  },
  priceTick:(tick={})=>applyPriceTick({
    ...tick,
    source: tick.source || 'external'
  }),
  targetHit:()=>dispatchGameEvent(ROUND_EVENTS.TARGET_HIT),
  stopLossHit:()=>dispatchGameEvent(ROUND_EVENTS.STOP_LOSS_HIT),
  cashOut:()=>dispatchGameEvent(ROUND_EVENTS.CASH_OUT),
  roundCrash:()=>dispatchGameEvent(ROUND_EVENTS.ROUND_CRASH),
  feedLost:()=>dispatchGameEvent(ROUND_EVENTS.FEED_LOST),
  feedRestored:()=>dispatchGameEvent(ROUND_EVENTS.FEED_RESTORED),
  cancel:()=>dispatchGameEvent(ROUND_EVENTS.CANCEL),
  getState:()=>({...runtime})
};


const ROUND_EVENTS = Object.freeze({
  TARGET_HIT: 'targetHit',
  STOP_LOSS_HIT: 'stopLossHit',
  CASH_OUT: 'cashOut',
  ROUND_CRASH: 'roundCrash',
  FEED_LOST: 'feedLost',
  FEED_RESTORED: 'feedRestored',
  CANCEL: 'cancel'
});

function dispatchGameEvent(type, payload = {}) {
  console.log('[ROUND EVENT]', type, payload);

  switch (type) {
    case ROUND_EVENTS.TARGET_HIT:
      queueOutcome('targetHit');
      return true;

    case ROUND_EVENTS.STOP_LOSS_HIT:
      queueOutcome('stopDeploy');
      return true;

    case ROUND_EVENTS.CASH_OUT:
      queueOutcome('cashOut');
      return true;

    case ROUND_EVENTS.ROUND_CRASH:
      queueOutcome('crash');
      return true;

    case ROUND_EVENTS.FEED_LOST:
      if (
        runtime.state === 'launch' ||
        runtime.state === 'flying'
      ) {
        enter('reconnecting');
      }
      return true;

    case ROUND_EVENTS.FEED_RESTORED:
      if (runtime.state === 'reconnecting') {
        enter('flying');
      }
      return true;

    case ROUND_EVENTS.CANCEL:
      queueOutcome('cancelled');
      return true;

    default:
      console.warn('[ROUND EVENT] unknown event:', type);
      return false;
  }
}

function priceToY(){
  const positive=Math.log(Math.max(1,runtime.multiplier))/Math.log(Math.max(1.05,runtime.target));
  if(runtime.multiplier>=1)return clamp(positive*(window.innerWidth<=600?.95:1.25),0,window.innerWidth<=600?1.05:1.35);
  const lossScale=runtime.stopLoss!=null?Math.abs(Math.log(Math.max(.01,1-runtime.stopLoss/100))):Math.log(2.4);
  return -clamp(Math.abs(Math.log(Math.max(.02,runtime.multiplier)))/Math.max(.01,lossScale)*(window.innerWidth<=600?.9:1.15),0,window.innerWidth<=600?1.15:1.5);
}
function updateTrail(){
  trailPoints.push(new THREE.Vector3(characterAnchor.position.x-.75,characterAnchor.position.y,0));if(trailPoints.length>100)trailPoints.shift();
  const pts=trailPoints.map((p,i)=>new THREE.Vector3(p.x-(trailPoints.length-1-i)*.026,p.y,0));trailGeo.setFromPoints(pts);
}

function autoFlightStep(dt){
  if(
    !runtime.autoFlight ||
    runtime.externalFeed ||
    runtime.demo ||
    !['launch','flying'].includes(runtime.state)
  ) return;

  runtime.demoT+=dt;

  const t=runtime.demoT;
  const seed=runtime.flightSeed;

  /*
    Test market path:
    - slow trend
    - medium swings
    - small high-frequency noise
    - always continuous, never teleporting
  */
  const trend=
    Math.sin((t+seed)*.18)*.10 +
    Math.sin((t+seed)*.07)*.08;

  const wave=
    Math.sin((t+seed)*.72)*.115 +
    Math.sin((t+seed)*1.63)*.050 +
    Math.sin((t+seed)*3.15)*.018;

  const drift=
    Math.min(t*.010, .24);

  let m=
    1 +
    trend +
    wave +
    drift;

  m=clamp(m,.62,Math.max(1.05,runtime.target*.82));

  onPrice(m,'simulation');
}

function demoStep(dt){
  if(!runtime.demo||!['launch','flying'].includes(runtime.state))return;runtime.demoT+=dt;const t=runtime.demoT;let m=1;
  if(runtime.demo==='flight')m=1+Math.sin(t*.85)*.22+Math.sin(t*2.3)*.04;
  if(runtime.demo==='stop'){if(runtime.stopLoss==null){runtime.stopLoss=18;stopInput.value='18';readConfig();}m=1-Math.min(.35,t*.12)+Math.sin(t*3.7)*.015;}
  if(runtime.demo==='crash'){runtime.stopLoss=null;stopInput.value='';readConfig();m=1-Math.min(.88,t*.17);if(t>4.7)queueOutcome('crash');}
  if(runtime.demo==='cash'){m=1+Math.min(.7,t*.16)+Math.sin(t*2.8)*.02;if(t>3.6)queueOutcome('cashOut');}
  if(runtime.demo==='win'){m=1+(runtime.target-1)*clamp((t-.7)/4.4,0,1)+Math.sin(t*3)*.025;if(t>5.2)m=runtime.target;}
  onPrice(m,'simulation');
}
function finish(title,text){if(runtime.finished)return;runtime.finished=true;resultTitle.textContent=title;resultText.textContent=text;result.classList.add('show');}

const clock=new THREE.Clock();let t=0;









/* FINAL_TRAJECTORY_V10 */

const finalTrajectoryV10 = {
  roundId: 0,
  lockedMode: null,
  startTime: 0,
  startX: 0,
  startY: 0,
  startRotation: 0,
  completed: false
};

function resetFinalTrajectoryV10() {
  finalTrajectoryV10.lockedMode = null;
  finalTrajectoryV10.startTime = 0;
  finalTrajectoryV10.startX = 0;
  finalTrajectoryV10.startY = 0;
  finalTrajectoryV10.startRotation = 0;
  finalTrajectoryV10.completed = false;
}

function detectFinalModeV10() {
  const state =
    String(runtime?.state || '')
      .toLowerCase();

  if (
    state.includes('target') ||
    state.includes('victory') ||
    state.includes('won')
  ) {
    return 'target';
  }

  if (
    state.includes('cash')
  ) {
    return 'cashout';
  }

  if (
    state.includes('parach') ||
    state.includes('stoploss') ||
    state.includes('stop_loss') ||
    state === 'stopped'
  ) {
    return 'stop';
  }

  if (
    state.includes('crash') ||
    state.includes('tumble') ||
    state.includes('lost')
  ) {
    return 'crash';
  }

  return null;
}

function lockFinalModeV10(mode) {
  if (
    finalTrajectoryV10.lockedMode ||
    !mode
  ) {
    return;
  }

  finalTrajectoryV10.lockedMode = mode;
  finalTrajectoryV10.startTime =
    performance.now();

  finalTrajectoryV10.startX =
    characterAnchor.position.x;

  finalTrajectoryV10.startY =
    characterAnchor.position.y;

  finalTrajectoryV10.startRotation =
    characterAnchor.rotation.z;

  finalTrajectoryV10.completed = false;

  runtime.vy = 0;
}

function easeInQuadV10(x) {
  const p =
    THREE.MathUtils.clamp(
      x,
      0,
      1
    );

  return p * p;
}

function easeOutCubicV10(x) {
  const p =
    THREE.MathUtils.clamp(
      x,
      0,
      1
    );

  return 1 - Math.pow(1 - p, 3);
}

function applyFinalTrajectoryV10(dt) {
  if (
    !runtime ||
    !characterAnchor ||
    !camera
  ) {
    return;
  }

  if (
    runtime.startedAt &&
    runtime.startedAt !==
      finalTrajectoryV10.roundId
  ) {
    finalTrajectoryV10.roundId =
      runtime.startedAt;

    resetFinalTrajectoryV10();
  }

  const detected =
    detectFinalModeV10();

  if (
    detected &&
    !finalTrajectoryV10.lockedMode
  ) {
    lockFinalModeV10(detected);
  }

  const mode =
    finalTrajectoryV10.lockedMode;

  if (!mode) {
    return;
  }

  const elapsed =
    (
      performance.now() -
      finalTrajectoryV10.startTime
    ) / 1000;

  const worldWidth =
    camera.right - camera.left;

  const worldHeight =
    camera.top - camera.bottom;

  /*
    TARGET HIT
    Real diagonal airplane-style climb.
    X and Y move together.
  */
  if (mode === 'target') {
    const duration = 0.82;

    const p =
      THREE.MathUtils.clamp(
        elapsed / duration,
        0,
        1.25
      );

    const move =
      easeInQuadV10(
        Math.min(p, 1)
      );

    const distanceX =
      worldWidth * 1.55;

    const distanceY =
      worldHeight * 0.95;

    characterAnchor.position.x =
      finalTrajectoryV10.startX +
      distanceX * move;

    characterAnchor.position.y =
      finalTrajectoryV10.startY +
      distanceY * move;

    characterAnchor.rotation.z =
      THREE.MathUtils.lerp(
        finalTrajectoryV10.startRotation,
        THREE.MathUtils.degToRad(-20),
        easeOutCubicV10(
          Math.min(
            elapsed / .28,
            1
          )
        )
      );

    pepe.setMarket({
      direction: 1,
      speed: 1,
      thrust: 1
    });

    runtime.vy = 0;
    runtime.shake =
      Math.max(
        .02,
        .13 - elapsed * .08
      );

    if (
      typeof flameGroup !==
      'undefined'
    ) {
      flameGroup.visible = true;

      flameGroup.scale.setScalar(
        2.6 +
        Math.sin(
          performance.now() * .04
        ) * .20
      );
    }

    if (
      characterAnchor.position.x >
        camera.right + worldWidth * .20 ||
      characterAnchor.position.y >
        camera.top + worldHeight * .20
    ) {
      finalTrajectoryV10.completed =
        true;
    }

    return;
  }

  /*
    CASH OUT
    Controlled diagonal exit.
    Same direction as TARGET but slower
    and with a shallower climb angle.
  */
  if (mode === 'cashout') {
    const duration = 1.45;

    const p =
      easeOutCubicV10(
        elapsed / duration
      );

    characterAnchor.position.x =
      finalTrajectoryV10.startX +
      worldWidth * .68 * p;

    characterAnchor.position.y =
      finalTrajectoryV10.startY +
      worldHeight * .34 * p;

    characterAnchor.rotation.z =
      THREE.MathUtils.lerp(
        finalTrajectoryV10.startRotation,
        THREE.MathUtils.degToRad(-15),
        p
      );

    pepe.setMarket({
      direction: .55,
      speed: .70,
      thrust: .62
    });

    runtime.vy = 0;

    if (
      typeof flameGroup !==
      'undefined'
    ) {
      flameGroup.visible = true;

      flameGroup.scale.setScalar(
        1.45
      );
    }

    if (
      characterAnchor.position.x >
        camera.right + worldWidth * .18
    ) {
      finalTrajectoryV10.completed =
        true;
    }

    return;
  }

  /*
    STOP LOSS
    Parachute glides diagonally down-right.
    The existing parachute animation is preserved.
  */
  if (mode === 'stop') {
    const duration = 2.35;

    const p =
      easeOutCubicV10(
        elapsed / duration
      );

    const sway =
      Math.sin(
        elapsed * 3.2
      ) *
      worldWidth *
      .012;

    characterAnchor.position.x =
      finalTrajectoryV10.startX +
      worldWidth * .58 * p +
      sway;

    characterAnchor.position.y =
      finalTrajectoryV10.startY -
      worldHeight * .78 * p;

    characterAnchor.rotation.z =
      THREE.MathUtils.lerp(
        finalTrajectoryV10.startRotation,
        THREE.MathUtils.degToRad(8),
        p
      ) +
      Math.sin(
        elapsed * 2.6
      ) * .035;

    pepe.setMarket({
      direction: -.20,
      speed: .05,
      thrust: 0
    });

    runtime.vy = 0;

    if (
      typeof parachute !==
      'undefined'
    ) {
      parachute.visible = true;
    }

    if (
      typeof flameGroup !==
      'undefined'
    ) {
      flameGroup.visible = false;
    }

    if (
      characterAnchor.position.y <
        camera.bottom -
        worldHeight * .22 ||
      characterAnchor.position.x >
        camera.right +
        worldWidth * .20
    ) {
      finalTrajectoryV10.completed =
        true;
    }

    return;
  }

  /*
    NO STOP-LOSS CRASH
    Fast uncontrolled diagonal down-right fall.
  */
  if (mode === 'crash') {
    const duration = 1.35;

    const p =
      THREE.MathUtils.clamp(
        elapsed / duration,
        0,
        1.3
      );

    const move =
      easeInQuadV10(
        Math.min(p, 1)
      );

    characterAnchor.position.x =
      finalTrajectoryV10.startX +
      worldWidth * .72 * move;

    characterAnchor.position.y =
      finalTrajectoryV10.startY -
      worldHeight * .92 * move;

    characterAnchor.rotation.z =
      finalTrajectoryV10.startRotation +
      elapsed * 3.4;

    pepe.setMarket({
      direction: -1,
      speed: .10,
      thrust: 0
    });

    runtime.vy = 0;

    if (
      typeof parachute !==
      'undefined'
    ) {
      parachute.visible = false;
    }

    if (
      typeof flameGroup !==
      'undefined'
    ) {
      flameGroup.visible = false;
    }

    if (
      characterAnchor.position.y <
        camera.bottom -
        worldHeight * .28 ||
      characterAnchor.position.x >
        camera.right +
        worldWidth * .22
    ) {
      finalTrajectoryV10.completed =
        true;
    }
  }
}

/* END_FINAL_TRAJECTORY_V10 */



/* CLASSIC_PEPE_STATE_BRIDGE_V11 */

function resolveClassicPepeStateV11() {
  const state =
    String(
      runtime?.state || ''
    ).toLowerCase();

  if (
    state.includes('target') ||
    state.includes('victory') ||
    state.includes('won')
  ) {
    return 'target';
  }

  if (
    state.includes('cash')
  ) {
    return 'cashout';
  }

  if (
    state.includes('parach') ||
    state.includes('stoploss') ||
    state.includes('stop_loss') ||
    state === 'stopped'
  ) {
    return 'parachute';
  }

  if (
    state.includes('crash') ||
    state.includes('tumble')
  ) {
    return 'crash';
  }

  if (
    state.includes('reconnect')
  ) {
    return 'hover';
  }

  if (
    state.includes('launch')
  ) {
    return 'boost';
  }

  return 'fly';
}

function updateClassicPepeV11(dt) {
  if (
    typeof classicPepe ===
    'undefined'
  ) {
    return;
  }

  const state =
    resolveClassicPepeStateV11();

  classicPepe.setState(
    state
  );

  classicPepe.setVisible(
    true
  );

  classicPepe.update(
    dt
  );

  /*
    The old rig must remain hidden.
  */
  if (
    pepe?.root
  ) {
    pepe.root.visible = false;
  }

  /*
    New PNG states already contain their own
    jet flame / parachute artwork.
    Hide legacy procedural visuals to avoid doubles.
  */
  if (
    typeof flameGroup !==
    'undefined'
  ) {
    flameGroup.visible = false;
  }

  if (
    typeof parachute !==
    'undefined'
  ) {
    parachute.visible = false;
  }
}

/* END_CLASSIC_PEPE_STATE_BRIDGE_V11 */

function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),.05);
  t+=dt;

  autoFlightStep(dt);
  demoStep(dt);
  updateFlightWorld(dt);const age=(performance.now()-runtime.stateAt)/1000;
  farStars.position.x=-(runtime.worldX*.035)%3;midStars.position.x=-(runtime.worldX*.08)%3;runtime.worldX+=dt*(runtime.state==='reconnecting'?.08:1.0);
  {
  const isPortrait = window.innerHeight > window.innerWidth;
  const anchorRatio = isPortrait ? 0.30 : 0.27;
  const anchorX = camera.left + (camera.right - camera.left) * anchorRatio;
  characterAnchor.position.x = anchorX;
}
  if(runtime.state==='launch'){
    characterAnchor.position.y=lerp(-.12,0,clamp(age/.42,0,1));pepe.setMarket({direction:0,speed:.75,thrust:.88});
    if(age>=.42){if(runtime.pending){const n=runtime.pending;runtime.pending=null;enter(n);}else enter('flying');}
  }else if(runtime.state==='flying'){
    const targetY=priceToY(),a=1-Math.exp(-dt*5.5);runtime.vy=lerp(runtime.vy,(targetY-runtime.y)*3.2,a);runtime.y+=runtime.vy*dt;characterAnchor.position.y=runtime.y;
    const direction=clamp(runtime.vy*2.5,-1,1);pepe.setMarket({direction,speed:clamp(.25+Math.abs(runtime.vy)*.8,.2,1),thrust:clamp(.3+Math.max(0,runtime.vy)*.7,.18,1)});
    characterAnchor.rotation.z=lerp(characterAnchor.rotation.z,clamp(runtime.vy*.14,-.18,.18),a);updateTrail();
  }else if(runtime.state==='reconnecting'){
    characterAnchor.position.y=runtime.y+Math.sin(t*2)*.025;pepe.setMarket({direction:0,speed:.08,thrust:.16});
  }else if(runtime.state==='stopDeploy'){
    pepe.setMarket({direction:-1,speed:.03,thrust:0});flameGroup.visible=false;parachute.visible=true;const s=clamp(age/.3,0,1);parachute.scale.setScalar(s);characterAnchor.position.y-=dt*.12;if(age>.32)enter('parachuting');
  }else if(runtime.state==='parachuting'){
    characterAnchor.position.y-=dt*.72;characterAnchor.rotation.z=Math.sin(t*2.4)*.025;pepe.setMarket({direction:-1,speed:.03,thrust:0});if(characterAnchor.position.y<camera.bottom-1.2)finish('STOP LOSS','Parachute exit · position closed at stop.');
  }else if(runtime.state==='targetHit'){
    pepe.setMarket({direction:1,speed:1,thrust:1});characterAnchor.rotation.z=lerp(characterAnchor.rotation.z,-.45,1-Math.exp(-dt*9));flameGroup.visible=true;flameGroup.scale.x=1.8;if(age>.28)enter('victory');
  }else if(runtime.state==='victory'){
    characterAnchor.position.y+=dt*(1.5+age*.9);pepe.setMarket({direction:1,speed:1,thrust:1});runtime.shake=Math.max(0,runtime.shake-dt*.18);if(characterAnchor.position.y>camera.top+1.5)finish('TARGET HIT',`${runtime.target.toFixed(2)}x reached · victory boost.`);
  }else if(runtime.state==='cashOut'){
    characterAnchor.position.x+=dt*1.7;characterAnchor.position.y+=dt*.38;pepe.setMarket({direction:1,speed:.7,thrust:.7});if(age>1.2)finish('CASH OUT',`${runtime.multiplier.toFixed(2)}x · controlled exit.`);
  }else if(runtime.state==='crash'){
    flameGroup.visible=false;parachute.visible=false;characterAnchor.position.y-=dt*(.55+age*.72);characterAnchor.rotation.z+=dt*(2.4+age);pepe.setMarket({direction:-1,speed:.02,thrust:0});if(characterAnchor.position.y<camera.bottom-1.3)finish('ROUND LOST','No stop-loss · uncontrolled fall after terminal loss event.');
  }else if(runtime.state==='cancelled'){
    characterAnchor.position.x+=dt*.9;characterAnchor.position.y+=dt*.08;pepe.setMarket({direction:0,speed:.2,thrust:.2});if(age>1.3)finish('CANCELLED','Neutral exit · no win/loss animation.');
  }
  if(runtime.shake>0){camera.position.x=(Math.random()-.5)*runtime.shake;camera.position.y=(Math.random()-.5)*runtime.shake*.45;}else{camera.position.x=0;camera.position.y=0;}
  const boost=['targetHit','victory'].includes(runtime.state)?1.5:1;flameOuter.scale.x=boost*(1+Math.sin(t*28)*.08);flameInner.scale.x=boost*(1+Math.sin(t*32)*.06);
  pepe.update(t,dt);
  multEl.textContent=`${runtime.multiplier.toFixed(2)}x`;pnlEl.textContent=`${runtime.pnlPct>=0?'+':''}${runtime.pnlPct.toFixed(1)}%`;pnlEl.style.color=runtime.pnlPct>=0?'#68e5ad':'#ff7183';
applyFinalTrajectoryV10(dt);
  updateClassicPepeV11(dt);
  renderer.render(scene,camera);
}

pepe.ready.then(()=>{runtime.state='ready';readConfig();resize();fitCharacter();setHud('READY','Choose target and press START');frame();}).catch(err=>{console.error('[GAME FLIGHT]',err);setHud('LOAD ERROR','Pepe rig failed to load');});

document.getElementById('start').onclick=()=>startRound(null,{
  autoFlight:true,
  externalFeed:false
});
document.getElementById('again').onclick=()=>{
  result.classList.remove('show');
  startRound(null,{
    autoFlight:true,
    externalFeed:false
  });
};
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>startRound(
  b.dataset.demo,
  {
    autoFlight:false,
    externalFeed:false
  }
));
targetInput.addEventListener('change',readConfig);stopInput.addEventListener('change',readConfig);
