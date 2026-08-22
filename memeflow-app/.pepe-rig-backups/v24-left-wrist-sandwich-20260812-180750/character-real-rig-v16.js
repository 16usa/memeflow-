import * as THREE from '/vendor/three.module.js';

export function createPepeRealRigV16({ parent, baseUrl='/game-assets/character-v16/' }={}) {
  if (!parent) throw new Error('[PEPE V23] LEFT WRIST INSERT');

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
        Screen-left arm source image.
        True center of the open wrist socket.
      */
      armWrist: [141.9896, 241.8993],

      /*
        Screen-left hand uses hand_right.png.
        True center of the hand cuff opening.
      */
      handCuff: [109.9722, 23.6371]
    },

    handRight: {
      armName: 'armRight',

      /*
        Mirrored point of the screen-left arm.
        Source arm width is 208 px.
      */
      armWrist: [47.3473, 242.6623],

      /*
        Mirrored point of the screen-left hand.
        Source hand width is 236 px.
      */
      handCuff: [123.5530, 24.0983]
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


  /*
    V23_LEFT_WRIST_INSERT

    The source arm PNG contains an opaque black socket.
    Merely aligning the hand behind it can never make
    the hand appear inserted because that black socket
    remains painted over the hand.

    For the screen-left wrist only:
      1. Convert only the black center of the arm socket
         to transparency.
      2. Keep the original green sleeve rim untouched.
      3. Add a small green wrist bridge behind the sleeve
         and in front of the hand.
      4. Do not move or rotate the hand.
  */

  function makeSocketTransparent(part, cx, cy, rx, ry) {
    const oldMap = part?.mesh?.material?.map;

    if (
      !oldMap ||
      !oldMap.image ||
      !oldMap.image.width ||
      !oldMap.image.height
    ) {
      throw new Error(
        '[PEPE V23] socket texture unavailable'
      );
    }

    const image = oldMap.image;

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext(
      '2d',
      { willReadFrequently: true }
    );

    ctx.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const x0 = Math.max(
      0,
      Math.floor(cx - rx - 2)
    );

    const y0 = Math.max(
      0,
      Math.floor(cy - ry - 2)
    );

    const x1 = Math.min(
      canvas.width,
      Math.ceil(cx + rx + 2)
    );

    const y1 = Math.min(
      canvas.height,
      Math.ceil(cy + ry + 2)
    );

    const w = x1 - x0;
    const h = y1 - y0;

    const data = ctx.getImageData(
      x0,
      y0,
      w,
      h
    );

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = x + x0;
        const sy = y + y0;

        const nx = (sx - cx) / rx;
        const ny = (sy - cy) / ry;

        if (
          nx * nx + ny * ny > 1
        ) {
          continue;
        }

        const i = (y * w + x) * 4;

        const r = data.data[i];
        const g = data.data[i + 1];
        const b = data.data[i + 2];
        const a = data.data[i + 3];

        const luminance =
          r * 0.2126 +
          g * 0.7152 +
          b * 0.0722;

        /*
          Remove only the dark painted socket.
          Preserve the bright green sleeve rim.
        */
        if (
          a > 0 &&
          luminance < 105
        ) {
          data.data[i + 3] = 0;
        }
      }
    }

    ctx.putImageData(
      data,
      x0,
      y0
    );

    const map =
      new THREE.CanvasTexture(canvas);

    map.colorSpace =
      THREE.SRGBColorSpace;

    map.needsUpdate = true;

    part.mesh.material.map = map;
    part.mesh.material.transparent = true;
    part.mesh.material.alphaTest = 0.01;
    part.mesh.material.needsUpdate = true;

    disposables.push(map);
  }

  function createWristBridgeTexture() {
    const canvas =
      document.createElement('canvas');

    canvas.width = 128;
    canvas.height = 128;

    const ctx =
      canvas.getContext('2d');

    ctx.clearRect(
      0,
      0,
      128,
      128
    );

    ctx.save();

    ctx.translate(
      64,
      64
    );

    ctx.scale(
      1,
      0.92
    );

    const gradient =
      ctx.createRadialGradient(
        -20,
        -24,
        5,
        0,
        0,
        62
      );

    gradient.addColorStop(
      0,
      '#d6ff9d'
    );

    gradient.addColorStop(
      0.18,
      '#77ff39'
    );

    gradient.addColorStop(
      0.55,
      '#32e719'
    );

    gradient.addColorStop(
      0.82,
      '#12b932'
    );

    gradient.addColorStop(
      1,
      '#087b35'
    );

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      55,
      0,
      Math.PI * 2
    );

    ctx.fill();

    const shine =
      ctx.createRadialGradient(
        -20,
        -26,
        1,
        -20,
        -26,
        24
      );

    shine.addColorStop(
      0,
      'rgba(255,255,255,0.78)'
    );

    shine.addColorStop(
      1,
      'rgba(255,255,255,0)'
    );

    ctx.fillStyle = shine;

    ctx.beginPath();

    ctx.arc(
      -18,
      -24,
      23,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();

    const texture =
      new THREE.CanvasTexture(canvas);

    texture.colorSpace =
      THREE.SRGBColorSpace;

    texture.needsUpdate = true;

    disposables.push(texture);

    return texture;
  }

  function installLeftWristInsert() {
    const arm =
      parts.armLeft;

    const hand =
      parts.handLeft;

    if (
      !arm ||
      !hand ||
      !hand.wristJoint
    ) {
      throw new Error(
        '[PEPE V23] left wrist hierarchy unavailable'
      );
    }

    /*
      Actual black socket center measured directly
      from arm_left.png.
    */
    makeSocketTransparent(
      arm,
      141.99,
      241.94,
      23.5,
      25.5
    );

    const bridgeTexture =
      createWristBridgeTexture();

    const bridgeGeometry =
      new THREE.PlaneGeometry(
        0.17,
        0.17
      );

    const bridgeMaterial =
      new THREE.MeshBasicMaterial({
        map: bridgeTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        alphaTest: 0.01,
        side: THREE.DoubleSide
      });

    const bridge =
      new THREE.Mesh(
        bridgeGeometry,
        bridgeMaterial
      );

    bridge.name =
      'leftWristInsert';

    /*
      Same true wrist joint already used by the rig.
      No manual X/Y hand correction.
    */
    bridge.position.set(
      0,
      0,
      0.001
    );

    bridge.renderOrder = 39;

    hand.mesh.renderOrder = 38;
    arm.mesh.renderOrder = 40;

    hand.wristJoint.add(
      bridge
    );

    hand.wristBridge =
      bridge;

    disposables.push(
      bridgeGeometry,
      bridgeMaterial
    );

    hand.wristJoint.updateMatrixWorld(
      true
    );

    console.log(
      '[PEPE V23] LEFT WRIST INSERT ACTIVE'
    );
  }

  function attachHandToArm(handName, armName) {
    const hand = parts[handName];
    const arm = parts[armName];
    const cfg = wristSockets[handName];

    if (!hand || !arm || !cfg) {
      throw new Error(
        `[PEPE V22] missing ${handName}/${armName}`
      );
    }

    if (cfg.armName !== armName) {
      throw new Error(
        `[PEPE V22] arm mapping mismatch for ${handName}`
      );
    }

    /*
      Resolve the real wrist socket from the arm PNG.
    */
    const wristLocal = sourcePixelToLocal(
      arm,
      cfg.armWrist[0],
      cfg.armWrist[1]
    );

    /*
      Resolve the authored cuff anchor from the hand PNG.
    */
    const cuffLocal = sourcePixelToLocal(
      hand,
      cfg.handCuff[0],
      cfg.handCuff[1]
    );

    const wristJoint = new THREE.Group();

    wristJoint.name =
      handName === 'handLeft'
        ? 'wristJointScreenLeft'
        : 'wristJointScreenRight';

    wristJoint.position.copy(wristLocal);
    wristJoint.rotation.set(0, 0, 0);
    wristJoint.scale.set(1, 1, 1);

    arm.pivot.add(wristJoint);

    /*
      Move the artwork so the hand cuff itself becomes
      the local origin of the hand pivot.
    */
    hand.mesh.position.x -= cuffLocal.x;
    hand.mesh.position.y -= cuffLocal.y;

    if (hand.pivot.parent) {
      hand.pivot.parent.remove(hand.pivot);
    }

    wristJoint.add(hand.pivot);

    hand.pivot.position.set(0, 0, 0);
    hand.pivot.scale.set(1, 1, 1);

    /*
      Mirror the palm direction across the forearm axis.

      Screen-left arm:
          arm world angle = +28 deg
          hand world angle = -28 deg
          hand local angle = -56 deg

      Screen-right arm:
          arm world angle = -28 deg
          hand world angle = +28 deg
          hand local angle = +56 deg

      This rotates the hands outward while the cuff
      remains locked at the wrist socket.
    */
    hand.pivot.rotation.set(
      0,
      0,
      -2 * arm.baseRot
    );

    hand.basePosition =
      hand.pivot.position.clone();

    hand.baseLocalRot =
      hand.pivot.rotation.z;

    hand.wristJoint =
      wristJoint;

    /*
      Hands render behind sleeves.
    */
    if (handName === 'handLeft') {
      hand.mesh.renderOrder = 38;
      arm.mesh.renderOrder = 40;
    } else {
      hand.mesh.renderOrder = 39;
      arm.mesh.renderOrder = 41;
    }

    if (hand.mesh.material) {
      hand.mesh.material.depthTest = false;
      hand.mesh.material.depthWrite = false;
      hand.mesh.material.needsUpdate = true;
    }

    if (arm.mesh.material) {
      arm.mesh.material.depthTest = false;
      arm.mesh.material.depthWrite = false;
      arm.mesh.material.needsUpdate = true;
    }

    /*
      Final exact cuff lock after parenting and rotation.
    */
    hand.pivot.updateMatrixWorld(true);
    wristJoint.updateMatrixWorld(true);

    const actualCuff = sourcePixelToLocal(
      hand,
      cfg.handCuff[0],
      cfg.handCuff[1]
    );

    hand.pivot.localToWorld(actualCuff);
    wristJoint.worldToLocal(actualCuff);

    hand.pivot.position.sub(actualCuff);

    hand.pivot.updateMatrixWorld(true);
    wristJoint.updateMatrixWorld(true);
  

    /*
      V22_TRUE_SOCKET_CENTERS

      Final visual seating of each hand inside its own
      sleeve. The wrist hierarchy remains unchanged.
    */

    const handSeat = { x: 0, y: 0 };

    hand.pivot.position.x += handSeat.x;
    hand.pivot.position.y += handSeat.y;

    /*
      Keep the hand behind the sleeve so the sleeve
      covers the wrist seam.
    */
    hand.mesh.renderOrder =
      handName === 'handLeft' ? 38 : 39;

    arm.mesh.renderOrder =
      handName === 'handLeft' ? 40 : 41;

    hand.pivot.updateMatrixWorld(true);
    wristJoint.updateMatrixWorld(true);

}






  const ready = Promise.all(defs.map(addPart)).then(() => {
    attachHandToArm('handLeft', 'armLeft');
    attachHandToArm('handRight', 'armRight');

    /*
      V23 test only.
      Screen-right wrist remains completely unchanged.
    */
    installLeftWristInsert();

    console.log('[PEPE V23] LEFT WRIST INSERT');
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
