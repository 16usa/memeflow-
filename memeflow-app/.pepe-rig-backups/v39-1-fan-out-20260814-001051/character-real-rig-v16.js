import * as THREE from '/vendor/three.module.js';

export function createPepeRealRigV16({ parent, baseUrl='/game-assets/character-v16/' }={}) {
  if (!parent) throw new Error('[PEPE V32] CLEAN WRIST PIVOTS READY');

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

  const wristSockets = {
    handLeft: {
      armName: 'armLeft',

      /*
        V38 — measured directly from arm_left.png
        and hand_right.png.
      */
      armWrist: [141.6607, 240.4957],
      handCuff: [89.1538, 63.4231]
    },

    handRight: {
      armName: 'armRight',

      /*
        V38 — measured independently.
        NO mirrored coordinates.
      */
      armWrist: [47.9139, 240.0915],
      handCuff: [146.8462, 63.4231]
    }
  };

  function sourcePixelToLocal(part, px, py) {
    const texture = part.mesh.material.map;

    if (
      !texture ||
      !texture.image ||
      !texture.image.width ||
      !texture.image.height
    ) {
      throw new Error(
        '[PEPE V19] texture dimensions unavailable'
      );
    }

    const imageWidth = texture.image.width;
    const imageHeight = texture.image.height;

    const geometryWidth =
      part.mesh.geometry.parameters.width;

    const geometryHeight =
      part.mesh.geometry.parameters.height;

    const x =
      part.mesh.position.x +
      ((px / imageWidth) - 0.5) *
      geometryWidth;

    const y =
      part.mesh.position.y +
      (0.5 - (py / imageHeight)) *
      geometryHeight;

    return new THREE.Vector3(x, y, 0);
  }

  function attachHandToArm(handName, armName) {
    const hand = parts[handName];
    const arm = parts[armName];
    const cfg = wristSockets[handName];

    if (!hand || !arm || !cfg) {
      throw new Error(
        `[PEPE V32] missing ${handName}/${armName}`
      );
    }

    if (cfg.armName !== armName) {
      throw new Error(
        `[PEPE V32] arm mapping mismatch for ${handName}`
      );
    }

    /*
      1. Exact center of the sleeve opening.
    */

    const wristLocal =
      sourcePixelToLocal(
        arm,
        cfg.armWrist[0],
        cfg.armWrist[1]
      );

    /*
      2. Exact authored cuff point inside the hand PNG.
    */

    const cuffLocal =
      sourcePixelToLocal(
        hand,
        cfg.handCuff[0],
        cfg.handCuff[1]
      );

    /*
      3. Real wrist pivot.
    */

    const wristJoint =
      new THREE.Group();

    wristJoint.name =
      handName === 'handLeft'
        ? 'wristJointScreenLeft'
        : 'wristJointScreenRight';

    wristJoint.position.copy(
      wristLocal
    );

    wristJoint.rotation.set(
      0,
      0,
      0
    );

    wristJoint.scale.set(
      1,
      1,
      1
    );

    arm.pivot.add(
      wristJoint
    );

    /*
      4. Move the PNG artwork inside handPivot so
         the cuff pixel becomes local origin 0,0.

         From this point on, rotation cannot pull
         the cuff away from the sleeve.
    */

    hand.mesh.position.x -=
      cuffLocal.x;

    hand.mesh.position.y -=
      cuffLocal.y;

    /*
      V32.7
      Extend the visible hand away from its cuff
      along the hand artwork own longitudinal axis.
      The wristJoint itself never moves.
    */
    const handExtendDirection =
      hand.mesh.position.clone();

    handExtendDirection.z = 0;

    if (handExtendDirection.lengthSq() > 1e-8) {
      handExtendDirection.normalize();

      hand.mesh.position.addScaledVector(handExtendDirection, 0.03);
    }

    if (hand.pivot.parent) {
      hand.pivot.parent.remove(
        hand.pivot
      );
    }

    wristJoint.add(
      hand.pivot
    );

    hand.pivot.position.set(
      0,
      0,
      0
    );

    hand.pivot.scale.set(
      1.00,
      1.00,
      1.00
    );

    /*
      5. Fingers UP, but keep each hand on its
         own side.

         V30 used approximately +/-152 deg world
         angle, which drove both hands toward the
         center.

         V32 uses +/-170 deg:
         almost vertical upward, with much less
         inward crossing.
    */

    const targetWorldDeg =
      handName === 'handLeft'
        ? 170
        : -170;

    const targetWorldAngle =
      THREE.MathUtils.degToRad(
        targetWorldDeg
      );

    /*
      wristJoint inherits arm.pivot rotation.
      Convert WORLD target angle into LOCAL hand angle.
    */

    const localHandAngle =
      targetWorldAngle -
      arm.baseRot;

    hand.pivot.rotation.set(
      0,
      0,
      localHandAngle
    );

    hand.basePosition =
      hand.pivot.position.clone();

    hand.baseLocalRot =
      hand.pivot.rotation.z;

    hand.wristJoint =
      wristJoint;

    /*
      6. Real sleeves hide the wrist seam.
    */

    if (handName === 'handLeft') {
      hand.mesh.renderOrder = 38;
      arm.mesh.renderOrder = 40;
    } else {
      hand.mesh.renderOrder = 39;
      arm.mesh.renderOrder = 41;
    }

    if (hand.mesh.material) {
      hand.mesh.material.depthTest =
        false;

      hand.mesh.material.depthWrite =
        false;

      hand.mesh.material.needsUpdate =
        true;
    }

    if (arm.mesh.material) {
      arm.mesh.material.depthTest =
        false;

      arm.mesh.material.depthWrite =
        false;

      arm.mesh.material.needsUpdate =
        true;
    }

    /*
      7. Verification only.
         Absolutely NO correction offsets.
    */

    hand.pivot.updateMatrixWorld(true);
    wristJoint.updateMatrixWorld(true);

    const actualCuffLocal =
      sourcePixelToLocal(
        hand,
        cfg.handCuff[0],
        cfg.handCuff[1]
      );

    const actualCuffWorld =
      actualCuffLocal.clone();

    hand.pivot.localToWorld(
      actualCuffWorld
    );

    const socketWorld =
      new THREE.Vector3();

    wristJoint.getWorldPosition(
      socketWorld
    );

    const wristError =
      actualCuffWorld.distanceTo(
        socketWorld
      );

    console.log(
      `[PEPE V32] ${handName} wrist error`,
      wristError
    );
  }






  const ready = Promise.all(defs.map(addPart)).then(() => {
    attachHandToArm('handLeft', 'armLeft');
    attachHandToArm('handRight', 'armRight');

    console.log('[PEPE V32] CLEAN WRIST PIVOTS READY');
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
