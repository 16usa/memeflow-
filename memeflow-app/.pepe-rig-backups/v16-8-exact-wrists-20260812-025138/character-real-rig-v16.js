import * as THREE from '/vendor/three.module.js';

export function createPepeRealRigV16({ parent, baseUrl='/game-assets/character-v16/' }={}) {
  if (!parent) throw new Error('[PEPE V16.6] parent required');

  const root = new THREE.Group();
  root.name = 'PepeRealRigV16';
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
    {n:'legLeft',   f:'leg_right.png',  c:[430,720], s:.75, r:-10, p:[450,630], z:.05, order:10},
    {n:'legRight',  f:'leg_left.png',   c:[570,720], s:.75, r: 10, p:[550,630], z:.06, order:11},

    {n:'body',      f:'body.png',       c:[500,560], s:.85, r:  0, p:[500,560], z:.10, order:20},

    {n:'handLeft',  f:'hand_right.png', c:[425,650], s:.52, r:-10, p:[410,625], z:.32, order:38},
    {n:'handRight', f:'hand_left.png',  c:[575,650], s:.52, r: 10, p:[590,625], z:.33, order:39},

    {n:'armLeft',   f:'arm_left.png',   c:[385,535], s:.72, r: 28, p:[420,475], z:.35, order:40},
    {n:'armRight',  f:'arm_right.png',  c:[615,535], s:.72, r:-28, p:[580,475], z:.36, order:41},

    {n:'head',      f:'head.png',       c:[500,315], s:.85, r:  0, p:[500,450], z:.60, order:60}
  ];

  function addPart(d) {
    return new Promise((resolve, reject) => {
      loader.load(baseUrl + d.f, tex => {
        tex.colorSpace = THREE.SRGBColorSpace;

        const iw = tex.image.width;
        const ih = tex.image.height;

        const geo = new THREE.PlaneGeometry(
          iw * d.s * K,
          ih * d.s * K
        );

        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          alphaTest: .01,
          side: THREE.DoubleSide
        });

        const pivot = new THREE.Group();
        pivot.name = d.n + 'Pivot';
        pivot.position.set(W(d.p[0]), H(d.p[1]), 0);
        pivot.rotation.z = THREE.MathUtils.degToRad(d.r);

        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = d.n;

        mesh.position.set(
          W(d.c[0]) - W(d.p[0]),
          H(d.c[1]) - H(d.p[1]),
          d.z
        );

        mesh.renderOrder = d.order;

        pivot.add(mesh);
        root.add(pivot);

        parts[d.n] = {
          pivot,
          mesh,
          baseRot: THREE.MathUtils.degToRad(d.r),
          basePosition: null,
          baseLocalRot: null
        };

        disposables.push(tex, geo, mat);
        resolve();
      }, undefined, reject);
    });
  }

  function attachHandToArm(handName, armName) {
    const hand = parts[handName];
    const arm = parts[armName];

    if (!hand || !arm) {
      throw new Error(`[PEPE V16.6] missing ${handName}/${armName}`);
    }

    root.updateMatrixWorld(true);

    arm.pivot.attach(hand.pivot);

    arm.pivot.updateMatrixWorld(true);

    if (handName === 'handLeft') {
      hand.pivot.position.x += 0.34;
      hand.pivot.position.y += 0.14;
      hand.pivot.rotation.z -= THREE.MathUtils.degToRad(4);
    }

    if (handName === 'handRight') {
      hand.pivot.position.x -= 0.34;
      hand.pivot.position.y += 0.14;
      hand.pivot.rotation.z += THREE.MathUtils.degToRad(4);
    }

    hand.basePosition = hand.pivot.position.clone();
    hand.baseLocalRot = hand.pivot.rotation.z;
  }

  const ready = Promise.all(defs.map(addPart)).then(() => {
    attachHandToArm('handLeft', 'armLeft');
    attachHandToArm('handRight', 'armRight');

    console.log('[PEPE V16.7] WRISTS ALIGNED · LEGS SWAPPED · REAL CANVAS');
    return true;
  });

  function setMarket({ direction=0, speed=0, thrust=0 }={}) {
    state.direction = THREE.MathUtils.clamp(direction, -1, 1);
    state.speed = THREE.MathUtils.clamp(speed, 0, 1);
    state.thrust = THREE.MathUtils.clamp(thrust, 0, 1);
  }

  function update(t, dt=1/60) {
    if (
      !parts.body ||
      !parts.handLeft?.basePosition ||
      !parts.handRight?.basePosition
    ) return;

    const a = 1 - Math.exp(-dt * 5);

    state.smoothedDirection = THREE.MathUtils.lerp(
      state.smoothedDirection,
      state.direction,
      a
    );

    state.smoothedSpeed = THREE.MathUtils.lerp(
      state.smoothedSpeed,
      state.speed,
      a
    );

    state.smoothedThrust = THREE.MathUtils.lerp(
      state.smoothedThrust,
      state.thrust,
      a
    );

    const dir = state.smoothedDirection;
    const speed = state.smoothedSpeed;
    const thrust = state.smoothedThrust;

    root.position.y =
      Math.sin(t * (1.4 + speed * 1.7)) *
      (.016 + thrust * .025);

    root.rotation.z =
      Math.sin(t * 1.15) *
      (.006 + speed * .015);

    parts.head.pivot.rotation.z =
      parts.head.baseRot +
      Math.sin(t * 1.2) * .025 -
      dir * .025;

    const brace = .12 * thrust;

    const armBob =
      Math.sin(t * (1.8 + speed * 2.0)) *
      (.018 + thrust * .035);

    parts.armLeft.pivot.rotation.z =
      parts.armLeft.baseRot +
      armBob +
      brace;

    parts.armRight.pivot.rotation.z =
      parts.armRight.baseRot -
      armBob -
      brace;

    parts.handLeft.pivot.position.copy(
      parts.handLeft.basePosition
    );

    parts.handRight.pivot.position.copy(
      parts.handRight.basePosition
    );

    parts.handLeft.pivot.rotation.z =
      parts.handLeft.baseLocalRot -
      armBob * .14 -
      brace * .06;

    parts.handRight.pivot.rotation.z =
      parts.handRight.baseLocalRot +
      armBob * .14 +
      brace * .06;

    const leg =
      Math.sin(t * (2.1 + speed * 2.4)) *
      (.012 + thrust * .035);

    parts.legLeft.pivot.rotation.z =
      parts.legLeft.baseRot + leg;

    parts.legRight.pivot.rotation.z =
      parts.legRight.baseRot - leg;
  }

  function setVisible(v) {
    root.visible = !!v;
  }

  function destroy() {
    root.removeFromParent();

    for (const x of disposables) {
      x.dispose?.();
    }
  }

  return {
    root,
    parts,
    state,
    ready,
    setMarket,
    update,
    setVisible,
    destroy
  };
}
