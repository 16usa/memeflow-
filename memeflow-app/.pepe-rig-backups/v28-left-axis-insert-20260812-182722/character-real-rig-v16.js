import * as THREE from '/vendor/three.module.js';

export function createPepeRealRigV16({ parent, baseUrl='/game-assets/character-v16/' }={}) {
  if (!parent) throw new Error('[PEPE V27] LEFT SPLIT HAND');

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
    V27_LEFT_SPLIT_HAND

    Final layer structure for the screen-left wrist:

      arm base      renderOrder 40
      hand          renderOrder 41
      wrist bridge  renderOrder 42
      sleeve rim    renderOrder 43

    The hand is no longer hidden behind the entire arm.
    The sleeve rim alone covers the connection seam.
  */

  function createWristBridgeTextureV24() {
    const canvas = document.createElement('canvas');

    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 128, 128);

    ctx.save();

    ctx.translate(64, 64);
    ctx.scale(1.0, 0.90);

    const gradient =
      ctx.createRadialGradient(
        -18,
        -22,
        4,
        0,
        0,
        58
      );

    gradient.addColorStop(0.00, '#d9ffab');
    gradient.addColorStop(0.20, '#7bff3d');
    gradient.addColorStop(0.52, '#31e51b');
    gradient.addColorStop(0.82, '#12b932');
    gradient.addColorStop(1.00, '#087a35');

    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
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

  function createLeftSleeveRimTextureV24(arm) {
    const source = arm.mesh.material.map;

    if (
      !source ||
      !source.image ||
      !source.image.width ||
      !source.image.height
    ) {
      throw new Error(
        '[PEPE V24] left arm texture unavailable'
      );
    }

    const image = source.image;

    const canvas =
      document.createElement('canvas');

    canvas.width = image.width;
    canvas.height = image.height;

    const ctx =
      canvas.getContext(
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

    const frame =
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const cx = 141.92;
    const cy = 241.91;

    const rx = 34.0;
    const ry = 34.0;

    for (
      let y = 0;
      y < canvas.height;
      y++
    ) {
      for (
        let x = 0;
        x < canvas.width;
        x++
      ) {
        const i =
          (y * canvas.width + x) * 4;

        const r = frame.data[i];
        const g = frame.data[i + 1];
        const b = frame.data[i + 2];
        const a = frame.data[i + 3];

        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;

        const q =
          nx * nx +
          ny * ny;

        const luminance =
          r * 0.2126 +
          g * 0.7152 +
          b * 0.0722;

        const insideRim =
          q >= 0.46 &&
          q <= 1.30;

        const isGreenRim =
          a > 0 &&
          luminance > 80 &&
          g > r * 0.75 &&
          g > b * 1.10;

        if (
          !insideRim ||
          !isGreenRim
        ) {
          frame.data[i + 3] = 0;
        }
      }
    }

    ctx.putImageData(
      frame,
      0,
      0
    );

    const texture =
      new THREE.CanvasTexture(canvas);

    texture.colorSpace =
      THREE.SRGBColorSpace;

    texture.needsUpdate = true;

    disposables.push(texture);

    return texture;
  }

  function installLeftSplitHandV27() {
    const arm = parts.armLeft;
    const hand = parts.handLeft;

    if (
      !arm ||
      !hand ||
      !hand.wristJoint ||
      !hand.mesh ||
      !hand.mesh.material ||
      !hand.mesh.material.map
    ) {
      throw new Error(
        '[PEPE V27] left hand hierarchy unavailable'
      );
    }

    /*
      V27 LEFT SPLIT HAND

      Proper 2D cutout sandwich:

          back cuff      39
          arm            40
          front palm     42
          sleeve rim     43

      Same hand.
      Same pivot.
      Same coordinates.
      Same rotation.
    */

    const source =
      hand.mesh.material.map;

    const image =
      source.image;

    if (
      !image ||
      !image.width ||
      !image.height
    ) {
      throw new Error(
        '[PEPE V27] original hand texture unavailable'
      );
    }

    /*
      BACK COPY

      Full original hand stays behind the arm.
      Its wrist/cuff therefore naturally disappears
      into the forearm.
    */

    const backMaterial =
      new THREE.MeshBasicMaterial({
        map: source,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        alphaTest: 0.01,
        side: THREE.DoubleSide
      });

    const backMesh =
      new THREE.Mesh(
        hand.mesh.geometry,
        backMaterial
      );

    backMesh.name =
      'leftHandBackV27';

    backMesh.position.copy(
      hand.mesh.position
    );

    backMesh.rotation.copy(
      hand.mesh.rotation
    );

    backMesh.scale.copy(
      hand.mesh.scale
    );

    backMesh.renderOrder = 39;

    hand.pivot.add(
      backMesh
    );

    /*
      FRONT COPY

      Use the existing hand mesh, but hide only the
      upper cuff section.

      The fingers/palm remain in front of the arm.
      The cuff itself is supplied by the back layer.
    */

    const canvas =
      document.createElement('canvas');

    canvas.width =
      image.width;

    canvas.height =
      image.height;

    const ctx =
      canvas.getContext(
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

    const frame =
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    /*
      hand_right.png:
      the complete open cuff occupies approximately
      the first 55 source pixels.

      Remove it from the FRONT layer only.
    */

    const hardCut = 52;
    const softEnd = 66;

    for (
      let y = 0;
      y < canvas.height;
      y++
    ) {
      for (
        let x = 0;
        x < canvas.width;
        x++
      ) {
        const i =
          (y * canvas.width + x) * 4;

        if (y <= hardCut) {
          frame.data[i + 3] = 0;
          continue;
        }

        if (y < softEnd) {
          const t =
            (y - hardCut) /
            (softEnd - hardCut);

          frame.data[i + 3] =
            Math.round(
              frame.data[i + 3] * t
            );
        }
      }
    }

    ctx.putImageData(
      frame,
      0,
      0
    );

    const frontTexture =
      new THREE.CanvasTexture(
        canvas
      );

    frontTexture.colorSpace =
      THREE.SRGBColorSpace;

    frontTexture.needsUpdate =
      true;

    hand.mesh.material.map =
      frontTexture;

    hand.mesh.material.transparent =
      true;

    hand.mesh.material.depthTest =
      false;

    hand.mesh.material.depthWrite =
      false;

    hand.mesh.material.alphaTest =
      0.01;

    hand.mesh.material.needsUpdate =
      true;

    /*
      MAIN LAYER ORDER
    */

    backMesh.renderOrder = 39;
    arm.mesh.renderOrder = 40;
    hand.mesh.renderOrder = 42;

    if (arm.mesh.material) {
      arm.mesh.material.depthTest =
        false;

      arm.mesh.material.depthWrite =
        false;

      arm.mesh.material.needsUpdate =
        true;
    }

    /*
      ORIGINAL SLEEVE RIM

      Only the green rim stays above the palm.
      It hides the joint seam.
    */

    const rimTexture =
      createLeftSleeveRimTextureV24(
        arm
      );

    const rimMaterial =
      new THREE.MeshBasicMaterial({
        map: rimTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        alphaTest: 0.01,
        side: THREE.DoubleSide
      });

    const rim =
      new THREE.Mesh(
        arm.mesh.geometry,
        rimMaterial
      );

    rim.name =
      'leftSleeveRimV27';

    rim.position.copy(
      arm.mesh.position
    );

    rim.position.z +=
      0.004;

    rim.renderOrder = 43;

    arm.pivot.add(
      rim
    );

    hand.backMesh =
      backMesh;

    hand.sleeveRim =
      rim;

    disposables.push(
      backMaterial,
      frontTexture,
      rimMaterial
    );

    arm.pivot.updateMatrixWorld(
      true
    );

    hand.wristJoint.updateMatrixWorld(
      true
    );

    console.log(
      '[PEPE V27] LEFT SPLIT HAND ACTIVE'
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
    installLeftSplitHandV27();

    console.log('[PEPE V27] LEFT SPLIT HAND');
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
