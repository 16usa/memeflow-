import * as THREE from '/vendor/three.module.js';

export function createPepeRealRigV16({ parent, baseUrl='/game-assets/character-v16/' }={}) {
  if (!parent) throw new Error('[PEPE V17] TRUE WRIST HIERARCHY');

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

  function texturePoint(part, px, py) {
    const tex = part.mesh.material.map;
    const iw = tex.image.width;
    const ih = tex.image.height;
    const gw = part.mesh.geometry.parameters.width;
    const gh = part.mesh.geometry.parameters.height;

    return new THREE.Vector2(
      part.mesh.position.x + ((px / iw) - 0.5) * gw,
      part.mesh.position.y + (0.5 - (py / ih)) * gh
    );
  }

  function rotatePoint(v, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new THREE.Vector2(
      v.x * c - v.y * s,
      v.x * s + v.y * c
    );
  }

  const wristRig = {
    handLeft: {
      armName: 'armLeft',
      wrist: [141.8945, 241.8896],
      shoulder: [167.1173, 38.8309],
      cuff: [110.0825, 23.6376],
      insetPx: 9
    },

    handRight: {
      armName: 'armRight',
      wrist: [47.3952, 242.6635],
      shoulder: [42.3032, 39.8811],
      cuff: [123.7073, 24.1189],
      insetPx: 9
    }
  };

  function pixelToPartLocal(part, px, py) {
    const tex = part.mesh.material.map;

    if (!tex || !tex.image) {
      throw new Error('[PEPE V17] texture is not ready');
    }

    const iw = tex.image.width;
    const ih = tex.image.height;

    const gw = part.mesh.geometry.parameters.width;
    const gh = part.mesh.geometry.parameters.height;

    return new THREE.Vector3(
      part.mesh.position.x + ((px / iw) - 0.5) * gw,
      part.mesh.position.y + (0.5 - (py / ih)) * gh,
      0
    );
  }

  function sourcePixelScale(part) {
    const tex = part.mesh.material.map;

    if (!tex || !tex.image) return 0;

    return part.mesh.geometry.parameters.width / tex.image.width;
  }

  function buildWristJoint(handName, armName) {
    const hand = parts[handName];
    const arm = parts[armName];
    const cfg = wristRig[handName];

    if (!hand || !arm || !cfg) {
      throw new Error(`[PEPE V17] missing ${handName}/${armName}`);
    }

    const wrist = pixelToPartLocal(
      arm,
      cfg.wrist[0],
      cfg.wrist[1]
    );

    const shoulder = pixelToPartLocal(
      arm,
      cfg.shoulder[0],
      cfg.shoulder[1]
    );

    const sleeveDirection = shoulder
      .clone()
      .sub(wrist)
      .normalize();

    const inset =
      cfg.insetPx * sourcePixelScale(arm);

    const wristJoint = new THREE.Group();

    wristJoint.name =
      handName === 'handLeft'
        ? 'wristJointScreenLeft'
        : 'wristJointScreenRight';

    wristJoint.position.copy(
      wrist.clone().addScaledVector(
        sleeveDirection,
        inset
      )
    );

    arm.pivot.add(wristJoint);

    const cuff = pixelToPartLocal(
      hand,
      cfg.cuff[0],
      cfg.cuff[1]
    );

    /*
      Move the image inside its own pivot so that
      the cuff center becomes the local origin.
    */
    hand.mesh.position.x -= cuff.x;
    hand.mesh.position.y -= cuff.y;

    /*
      Parent using local-space hierarchy.
      No world-space preservation and no per-frame
      wrist position solving.
    */
    wristJoint.add(hand.pivot);

    hand.pivot.position.set(0, 0, 0);

    /*
      Cancel the arm's setup rotation at rest.
      The hand still inherits future arm animation.
    */
    hand.pivot.rotation.set(
      0,
      0,
      -arm.baseRot
    );

    /*
      The sleeve is drawn above the hand cuff,
      hiding the connection seam.
    */
    if (handName === 'handLeft') {
      hand.mesh.renderOrder = 38;
      arm.mesh.renderOrder = 48;
    } else {
      hand.mesh.renderOrder = 39;
      arm.mesh.renderOrder = 49;
    }

    if (hand.mesh.material) {
      hand.mesh.material.transparent = true;
      hand.mesh.material.depthTest = false;
      hand.mesh.material.depthWrite = false;
      hand.mesh.material.needsUpdate = true;
    }

    if (arm.mesh.material) {
      arm.mesh.material.transparent = true;
      arm.mesh.material.depthTest = false;
      arm.mesh.material.depthWrite = false;
      arm.mesh.material.needsUpdate = true;
    }

    hand.basePosition =
      hand.pivot.position.clone();

    hand.baseLocalRot =
      hand.pivot.rotation.z;

    hand.wristJoint = wristJoint;
  }

  function attachHandToArm(handName, armName) {
    buildWristJoint(handName, armName);
  }


  const ready = Promise.all(defs.map(addPart)).then(() => {
    attachHandToArm('handLeft', 'armLeft');
    attachHandToArm('handRight', 'armRight');

    console.log('[PEPE V17] TRUE WRIST HIERARCHY');
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
