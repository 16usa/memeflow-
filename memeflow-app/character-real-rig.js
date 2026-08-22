import * as THREE from '/vendor/three.module.js';

export function createPepeRealRig({ parent, baseUrl='/game-assets/character/' }={}) {
  if (!parent) throw new Error('[PEPE REAL RIG] parent required');

  const root = new THREE.Group();
  root.name = 'PepeRealRigV1';
  parent.add(root);

  const K = 4.2 / 1000;
  const loader = new THREE.TextureLoader();
  const parts = {};
  const disposables = [];

  const state = {
    direction: 0,
    speed: 0,
    thrust: 0,
    smoothedDirection: 0,
    smoothedSpeed: 0,
    smoothedThrust: 0
  };

  const W = (x) => (x - 500) * K;
  const H = (y) => (500 - y) * K;

  const defs = [
    {n:'legLeft',  f:'leg_left.png',   c:[430,720], s:.75, r:-10, p:[450,630], z:.01},
    {n:'legRight', f:'leg_right.png',  c:[570,720], s:.75, r: 10, p:[550,630], z:.02},
    {n:'body',     f:'body.png',       c:[500,560], s:.85, r:  0, p:[500,560], z:.10},
    {n:'armLeft',  f:'arm_left.png',   c:[365,540], s:.72, r: 10, p:[420,475], z:.20},
    {n:'armRight', f:'arm_right.png',  c:[635,540], s:.72, r:-10, p:[580,475], z:.21},
    {n:'handLeft', f:'hand_left.png',  c:[340,650], s:.52, r:  0, p:[365,605], z:.30},
    {n:'handRight',f:'hand_right.png', c:[660,650], s:.52, r:  0, p:[635,605], z:.31},
    {n:'head',     f:'head.png',       c:[500,315], s:.85, r:  0, p:[500,450], z:.40},
  ];

  function addPart(d) {
    return new Promise((resolve,reject)=>{
      loader.load(baseUrl+d.f, tex=>{
        tex.colorSpace = THREE.SRGBColorSpace;
        const iw = tex.image.width;
        const ih = tex.image.height;
        const geo = new THREE.PlaneGeometry(iw*d.s*K, ih*d.s*K);
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent:true, depthWrite:false,
          alphaTest:.01, side:THREE.DoubleSide
        });
        const pivot = new THREE.Group();
        pivot.name = d.n+'Pivot';
        pivot.position.set(W(d.p[0]), H(d.p[1]), 0);
        pivot.rotation.z = THREE.MathUtils.degToRad(d.r);

        const mesh = new THREE.Mesh(geo,mat);
        mesh.position.set(
          W(d.c[0]) - W(d.p[0]),
          H(d.c[1]) - H(d.p[1]),
          d.z
        );

        pivot.add(mesh);
        root.add(pivot);
        parts[d.n] = {pivot,mesh,base:THREE.MathUtils.degToRad(d.r)};
        disposables.push(tex,geo,mat);
        resolve();
      }, undefined, reject);
    });
  }

  const ready = Promise.all(defs.map(addPart)).then(()=>{
    console.log('[PEPE REAL RIG] READY');
    return true;
  });

  function setMarket({direction=0,speed=0,thrust=0}={}) {
    state.direction = THREE.MathUtils.clamp(direction,-1,1);
    state.speed = THREE.MathUtils.clamp(speed,0,1);
    state.thrust = THREE.MathUtils.clamp(thrust,0,1);
  }

  function update(t,dt=1/60) {
    if (!parts.body) return;
    const a = 1-Math.exp(-dt*5);
    state.smoothedDirection = THREE.MathUtils.lerp(state.smoothedDirection,state.direction,a);
    state.smoothedSpeed = THREE.MathUtils.lerp(state.smoothedSpeed,state.speed,a);
    state.smoothedThrust = THREE.MathUtils.lerp(state.smoothedThrust,state.thrust,a);

    const dir=state.smoothedDirection, speed=state.smoothedSpeed, thrust=state.smoothedThrust;

    root.position.y = Math.sin(t*(1.5+speed*1.5))*(.018+thrust*.025);
    root.rotation.z = Math.sin(t*1.15)*(.008+speed*.018);

    parts.head.pivot.rotation.z =
      parts.head.base + Math.sin(t*1.3)*.035 + (-dir)*.018;

    const arm = Math.sin(t*(2.0+speed*2.2))*(.025+thrust*.08);
    parts.armLeft.pivot.rotation.z = parts.armLeft.base + arm;
    parts.armRight.pivot.rotation.z = parts.armRight.base - arm;

    parts.handLeft.pivot.rotation.z = parts.handLeft.base + arm*.7;
    parts.handRight.pivot.rotation.z = parts.handRight.base - arm*.7;

    const leg = Math.sin(t*(2.3+speed*2.5))*(.015+thrust*.045);
    parts.legLeft.pivot.rotation.z = parts.legLeft.base + leg;
    parts.legRight.pivot.rotation.z = parts.legRight.base - leg;
  }

  function setVisible(v){ root.visible=!!v; }
  function destroy(){
    root.removeFromParent();
    for (const x of disposables) x.dispose?.();
  }

  return {root,state,ready,setMarket,update,setVisible,destroy};
}
