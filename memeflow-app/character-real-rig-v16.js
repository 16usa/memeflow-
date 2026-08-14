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

  /*
    V41 EXACT WRIST SEAT

    These are PIXEL coordinates in each original PNG.
    They are NEVER subtracted from each other directly.

    sourcePixelToLocal() converts each point into the
    correct Three.js local coordinate system first.
  */

  const seatDepth = 0.045;

  const wristSockets = {
    handLeft: {
      armName: 'armLeft',

      // measured independently from arm_left.png
      armWrist: [141.6607, 240.4957],

      // authored cuff anchor in hand_right.png
      handCuff: [89.1538, 63.4231]
    },

    handRight: {
      armName: 'armRight',

      // measured independently from arm_right.png
      armWrist: [47.9139, 240.0915],

      // authored cuff anchor in hand_left.png
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

  /*
    Detect the actual direction cuff -> fingers from
    the alpha silhouette of each hand PNG.

    No authored 110 / 170 / 205 degree values.
    No normalization of hand.mesh.position.
  */
  function detectFingerAxis(part, cuffPixel) {
    const texture = part.mesh.material.map;
    const image = texture && texture.image;

    if (!image || !image.width || !image.height) {
      throw new Error(
        '[PEPE V42] hand image unavailable'
      );
    }

    const canvas =
      document.createElement('canvas');

    canvas.width = image.width;
    canvas.height = image.height;

    const ctx =
      canvas.getContext(
        '2d',
        { willReadFrequently: true }
      );

    if (!ctx) {
      throw new Error(
        '[PEPE V42] canvas context unavailable'
      );
    }

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
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

    const data = frame.data;
    const points = [];

    const cuffX = cuffPixel[0];
    const cuffY = cuffPixel[1];

    let maxDistanceSq = 0;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i =
          (y * canvas.width + x) * 4;

        const alpha = data[i + 3];

        if (alpha < 64) {
          continue;
        }

        const dx = x - cuffX;
        const dy = y - cuffY;

        const distanceSq =
          dx * dx + dy * dy;

        /*
          Ignore pixels immediately surrounding
          the cuff itself.
        */
        if (distanceSq < 100) {
          continue;
        }

        maxDistanceSq =
          Math.max(
            maxDistanceSq,
            distanceSq
          );

        points.push({
          x,
          y,
          alpha,
          distanceSq
        });
      }
    }

    if (points.length < 50) {
      throw new Error(
        '[PEPE V42] hand silhouette unavailable'
      );
    }

    /*
      The farthest opaque region from the cuff is
      the finger end of the hand.

      Use the farthest 6% rather than one pixel,
      so antialiasing cannot change the direction.
    */
    points.sort(
      (a, b) =>
        b.distanceSq -
        a.distanceSq
    );

    const sampleCount =
      Math.max(
        30,
        Math.floor(
          points.length * 0.06
        )
      );

    let totalWeight = 0;
    let sumX = 0;
    let sumY = 0;

    for (
      let i = 0;
      i < sampleCount;
      i++
    ) {
      const p = points[i];

      const distanceWeight =
        p.distanceSq /
        maxDistanceSq;

      const weight =
        (p.alpha / 255) *
        (0.5 + distanceWeight);

      totalWeight += weight;
      sumX += p.x * weight;
      sumY += p.y * weight;
    }

    const fingerX =
      sumX / totalWeight;

    const fingerY =
      sumY / totalWeight;

    /*
      Convert PNG vector into the exact local
      coordinate scale of this particular hand.

      PNG Y points DOWN.
      Three.js local Y points UP.
    */
    const geometryWidth =
      part.mesh.geometry.parameters.width;

    const geometryHeight =
      part.mesh.geometry.parameters.height;

    const axis =
      new THREE.Vector2(
        (fingerX - cuffX) *
          geometryWidth /
          image.width,

        -(fingerY - cuffY) *
          geometryHeight /
          image.height
      );

    if (axis.lengthSq() < 1e-8) {
      throw new Error(
        '[PEPE V42] invalid finger axis'
      );
    }

    return axis.normalize();
  }


  function attachHandToArm(
    handName,
    armName
  ) {
    const hand = parts[handName];
    const arm = parts[armName];
    const cfg = wristSockets[handName];

    if (!hand || !arm || !cfg) {
      throw new Error(
        `[PEPE V41] missing ${handName}/${armName}`
      );
    }

    if (cfg.armName !== armName) {
      throw new Error(
        `[PEPE V41] arm mapping mismatch for ${handName}`
      );
    }

    /*
      STEP 1
      Convert BOTH PNG points independently.

      We never do:
        armPixel - handPixel
    */
    const wristLocal =
      sourcePixelToLocal(
        arm,
        cfg.armWrist[0],
        cfg.armWrist[1]
      );

    const cuffLocal =
      sourcePixelToLocal(
        hand,
        cfg.handCuff[0],
        cfg.handCuff[1]
      );

    /*
      STEP 2
      Create the physical wrist joint at the exact
      center of the real sleeve opening.
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
      STEP 3
      Move the PNG INSIDE hand.pivot so that the
      exact cuff pixel becomes local origin 0,0.

      After this, rotating hand.pivot can no longer
      tear the cuff away from wristJoint.
    */
    hand.mesh.position.x -=
      cuffLocal.x;

    hand.mesh.position.y -=
      cuffLocal.y;

    /*
      Keep original layer depth.
      Do NOT use mesh.position normalization.
    */
    const handLayerZ =
      hand.mesh.position.z;

    hand.mesh.position.z =
      handLayerZ;

    /*
      STEP 4
      Re-parent the hand onto the wrist joint.
    */
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
      1,
      1,
      1
    );

    /*
      STEP 5
      Determine cuff -> fingers FROM THE ACTUAL PNG.
      There is no manually selected hand angle.
    */
    const sourceFingerAxis =
      detectFingerAxis(
        hand,
        cfg.handCuff
      );

    /*
      Desired direction is exact WORLD UP.

      Because wristJoint inherits arm.pivot rotation,
      WORLD UP must be converted into arm-local space.
    */
    /*
      V42 — exact LOCAL wrist geometry.

      wristLocal is already expressed in arm.pivot space.

      arm pivot -> sleeve opening:
          wristLocal

      sleeve opening -> inside the arm:
          -wristLocal

      This direction automatically follows every
      rotation.z of the arm because wristJoint is
      a child of arm.pivot.

      No WORLD UP.
      No manual angle.
    */
    /*
      V43 — exact directed wrist geometry.

      arm pivot -> wrist socket = OUTWARD
      wrist socket -> arm pivot = INWARD

      Fingers must point OUT of the sleeve.
      Seating depth must move IN to the sleeve.
    */
    const sleeveOutwardAxis =
      new THREE.Vector2(
        wristLocal.x,
        wristLocal.y
      ).normalize();

    const sleeveInwardAxis =
      sleeveOutwardAxis
        .clone()
        .multiplyScalar(-1);

    const targetLocalAxis =
      sleeveOutwardAxis.clone();

    const sourceAngle =
      Math.atan2(
        sourceFingerAxis.y,
        sourceFingerAxis.x
      );

    const targetAngle =
      Math.atan2(
        targetLocalAxis.y,
        targetLocalAxis.x
      );

    const localRotation = 0; // V-FIX no center twist

    hand.pivot.rotation.set(
      0,
      0,
      localRotation
    );

    /*
      STEP 6
      Seat the cuff deeper INTO the sleeve.

      The outward direction is the hand's exact
      target longitudinal axis.

      Therefore inward is exactly its opposite.
      This is local wristJoint / hand.pivot space,
      so arm rotation cannot break the seat.
    */
    /*
      Exact seating INSIDE the sleeve.

      The translation is performed in wristJoint /
      arm-local coordinates, therefore it remains
      stable under every arm rotation.
    */
    hand.pivot.position.set(
      sleeveInwardAxis.x *
        seatDepth,

      sleeveInwardAxis.y *
        seatDepth,

      0
    );

    /*
      STEP 7
      Sleeve stays above the hand and hides the seam.
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

    hand.basePosition =
      hand.pivot.position.clone();

    hand.baseLocalRot =
      hand.pivot.rotation.z;

    hand.wristJoint =
      wristJoint;

    console.log(
      `[PEPE V42] ${handName} seated`,
      {
        armWrist:
          cfg.armWrist,

        handCuff:
          cfg.handCuff,

        fingerAxis: [
          sourceFingerAxis.x,
          sourceFingerAxis.y
        ],

        seatDepth
      }
    );
  }



  /* === PEPE HAND CALIBRATION V1 START === */

  /*
    FINAL VALUES FROM MOBILE CALIBRATOR V8.

    These values are applied AFTER the authored
    wristJoint / cuff attachment has been completed.

    This preserves the existing wrist rig and applies
    only the final visual calibration chosen by hand.
  */

  const handCalibration = {
    handLeft: {
      x: 0,
      y: 0,
      z: 0,
      inOut: 0,
      rotationDeg: 0,
      finalRenderOrder: 51,
      scale: 1,
      width: 1
    },
    handRight: {
      x: 0,
      y: 0,
      z: 0,
      inOut: 0,
      rotationDeg: 0,
      finalRenderOrder: 50,
      scale: 1,
      width: 1
    }
  };
}
