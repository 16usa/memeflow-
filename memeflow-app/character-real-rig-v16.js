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

    {n:'armLeft',   f:'arm_left.png',   c:[385,535], s:.72, r: 6, p:[420,475], z:.35, order:40},
    {n:'armRight',  f:'arm_right.png',  c:[615,535], s:.72, r:-6, p:[580,475], z:.36, order:41},

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

  const seatDepth = 0.020;

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

    const localRotation =
      targetAngle -
      sourceAngle;

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
      x: 0.545,
      y: -0.075,
      z: 0,

      inOut: -0.5,

      rotationDeg: 92,

      finalRenderOrder: 68,

      scale: 1,
      width: 1
    },

    handRight: {
      x: -0.545,
      y: -0.075,
      z: 0,

      inOut: -0.5,

      rotationDeg: -96,

      finalRenderOrder: 39,

      scale: 1,
      width: 1
    }

  };


  function applyFinalHandCalibration(handName) {

    const hand =
      parts[handName];

    const cfg =
      handCalibration[handName];


    if (!hand || !cfg) {
      throw new Error(
        `[PEPE CALIBRATION] missing ${handName}`
      );
    }


    /*
      1. POSITION

      hand.pivot already lives inside wristJoint,
      therefore these are local wrist offsets.
    */

    hand.pivot.position.set(

      cfg.x,

      cfg.y,

      cfg.z

    );


    /*
      2. ROTATION

      Calibration rotation is relative to the
      authored hand angle produced by attachHandToArm().
    */

    hand.pivot.rotation.z =

      hand.baseLocalRot +

      THREE.MathUtils.degToRad(
        cfg.rotationDeg
      );


    /*
      3. SCALE / WIDTH
    */

    hand.pivot.scale.set(

      cfg.scale * cfg.width,

      cfg.scale,

      cfg.scale

    );


    /*
      4. IN / OUT

      Use exactly the same direction calculation
      used by the mobile calibrator.
    */

    const seatDirection =
      hand.mesh.position.clone();


    seatDirection.z = 0;


    if (
      seatDirection.lengthSq() >
      1e-8
    ) {

      seatDirection.normalize();


      hand.mesh.position
        .addScaledVector(

          seatDirection,

          cfg.inOut

        );

    }


    /*
      5. FINAL DRAW LAYER

      Exact values copied from calibration output.
    */

    hand.mesh.renderOrder =
      cfg.finalRenderOrder;


    if (hand.mesh.material) {

      hand.mesh.material.depthTest =
        false;

      hand.mesh.material.depthWrite =
        false;

      hand.mesh.material.needsUpdate =
        true;

    }


    /*
      6. Store calibrated values as new base values.
    */

    hand.basePosition =
      hand.pivot.position.clone();

    hand.baseLocalRot =
      hand.pivot.rotation.z;


    hand.pivot.updateMatrixWorld(
      true
    );


    console.log(
      `[PEPE CALIBRATION] ${handName}`,
      {
        position:
          hand.pivot.position.toArray(),

        rotationDeg:
          THREE.MathUtils.radToDeg(
            hand.pivot.rotation.z
          ),

        renderOrder:
          hand.mesh.renderOrder
      }
    );

  }

  /* === PEPE HAND CALIBRATION V1 END === */























  /* === PEPE CLEAN CUFF ASSEMBLY V6 START === */

  /*
    GOALS:

    1. left hand must sit in left cuff
    2. right hand must sit in right cuff
    3. reduce smearing / seam artifacts
    4. keep shoulders under torso
    5. keep visible arms in front of torso
    6. keep cuff rim in front of hand base
  */



  function addSeatAlongCurrentHandDirection(
    hand,
    amount
  ) {

    const dir =
      hand.mesh.position.clone();

    dir.z = 0;

    if (
      dir.lengthSq() > 1e-8
    ) {

      dir.normalize();

      hand.mesh.position.addScaledVector(
        dir,
        amount
      );

    }

  }



  function refineHandIntoOwnCuffV6() {

    const handLeft =
      parts.handLeft;

    const handRight =
      parts.handRight;

    if (
      !handLeft ||
      !handRight
    ) {

      throw new Error(
        '[PEPE V6] missing hands'
      );

    }


    /*
      IMPORTANT:

      We refine AFTER final mobile calibration.

      handLeft  = screen-right hand
      handRight = screen-left hand

      We move each slightly OUTWARD from center
      and slightly DEEPER into its own cuff.
    */


    /*
      LEFT HAND
      (screen-right)
    */
    handLeft.pivot.position.x += 0.035;
    handLeft.pivot.position.y -= 0.010;
    handLeft.pivot.rotation.z +=
      THREE.MathUtils.degToRad(-2);

    addSeatAlongCurrentHandDirection(
      handLeft,
      -0.060
    );


    /*
      RIGHT HAND
      (screen-left)
    */
    handRight.pivot.position.x -= 0.035;
    handRight.pivot.position.y -= 0.010;
    handRight.pivot.rotation.z +=
      THREE.MathUtils.degToRad(6);

    addSeatAlongCurrentHandDirection(
      handRight,
      -0.060
    );


    /*
      Hands should stay above visible arm segment,
      but below cuff rim segment.
    */
    handRight.mesh.renderOrder =
      50;

    handLeft.mesh.renderOrder =
      51;


    for (
      const hand of [
        handLeft,
        handRight
      ]
    ) {

      if (
        hand.mesh.material
      ) {

        hand.mesh.material.depthTest =
          false;

        hand.mesh.material.depthWrite =
          false;

        hand.mesh.material.needsUpdate =
          true;

      }

      hand.pivot.updateMatrixWorld(
        true
      );
    }


    console.log(
      '[PEPE V6] hands refined into cuffs'
    );

  }



  function createArmSegmentGeometryV6(
    fullWidth,
    fullHeight,
    imageTop,
    imageBottom
  ) {

    const segmentHeight =
      fullHeight *
      (imageBottom - imageTop);

    const geometry =
      new THREE.PlaneGeometry(
        fullWidth,
        segmentHeight
      );

    const uv =
      geometry.attributes.uv;

    const textureTop =
      1 - imageTop;

    const textureBottom =
      1 - imageBottom;

    for (
      let i = 0;
      i < uv.count;
      i++
    ) {

      const originalV =
        uv.getY(i);

      const croppedV =
        textureBottom +
        originalV *
        (
          textureTop -
          textureBottom
        );

      uv.setY(
        i,
        croppedV
      );

    }

    uv.needsUpdate = true;

    return geometry;
  }



  function splitArmVisualV6(
    armName,
    {
      shoulderEnd = 0.245,
      cuffStart = 0.775,
      overlap = 0.010,

      shoulderOrder = 20,
      mainOrder = 40,
      cuffOrder = 60
    } = {}
  ) {

    const arm =
      parts[armName];

    if (
      !arm ||
      !arm.mesh
    ) {

      throw new Error(
        `[PEPE V6] missing ${armName}`
      );

    }

    const originalMesh =
      arm.mesh;

    const geometry =
      originalMesh.geometry;

    const fullWidth =
      geometry.parameters?.width;

    const fullHeight =
      geometry.parameters?.height;

    if (
      !fullWidth ||
      !fullHeight
    ) {

      throw new Error(
        `[PEPE V6] invalid geometry ${armName}`
      );

    }


    const holder =
      new THREE.Group();

    holder.name =
      armName + 'SplitVisualV6';

    holder.position.copy(
      originalMesh.position
    );

    holder.rotation.copy(
      originalMesh.rotation
    );

    holder.scale.copy(
      originalMesh.scale
    );

    arm.pivot.add(
      holder
    );

    originalMesh.visible =
      false;


    function addSegment(
      name,
      top,
      bottom,
      renderOrder
    ) {

      const geo =
        createArmSegmentGeometryV6(
          fullWidth,
          fullHeight,
          top,
          bottom
        );

      const material =
        originalMesh.material.clone();

      material.map =
        originalMesh.material.map;

      material.transparent =
        true;

      material.depthTest =
        false;

      material.depthWrite =
        false;

      material.alphaTest =
        0.035;

      material.needsUpdate =
        true;

      const mesh =
        new THREE.Mesh(
          geo,
          material
        );

      mesh.name =
        armName + '_' + name;

      const centerY =
        fullHeight *
        (
          0.5 -
          (
            top + bottom
          ) / 2
        );

      mesh.position.set(
        0,
        centerY,
        0
      );

      mesh.renderOrder =
        renderOrder;

      holder.add(
        mesh
      );

      disposables.push(
        geo,
        material
      );

      return mesh;
    }


    /*
      Small overlap removes visible seam / blur line
      between segments.
    */

    const shoulder =
      addSegment(
        'shoulder',
        0,
        shoulderEnd + overlap,
        shoulderOrder
      );

    const main =
      addSegment(
        'main',
        shoulderEnd - overlap,
        cuffStart + overlap,
        mainOrder
      );

    const cuff =
      addSegment(
        'cuff',
        cuffStart - overlap,
        1,
        cuffOrder
      );

    arm.splitVisual = {
      holder,
      shoulder,
      main,
      cuff
    };

    console.log(
      `[PEPE V6] ${armName} split cleanly`,
      {
        shoulderEnd,
        cuffStart,
        overlap
      }
    );
  }



  function applyCleanCuffAssemblyV6() {

    const body =
      parts.body;

    const head =
      parts.head;

    const handLeft =
      parts.handLeft;

    const handRight =
      parts.handRight;

    const armLeft =
      parts.armLeft;

    const armRight =
      parts.armRight;

    if (
      !body ||
      !head ||
      !handLeft ||
      !handRight ||
      !armLeft ||
      !armRight
    ) {

      throw new Error(
        '[PEPE V6] missing body/head/arms/hands'
      );

    }


    /*
      Global stack:

        shoulder segments
          < body
          < main arm segments
          < hands
          < cuff segments
          < head
    */

    body.mesh.renderOrder =
      30;

    head.mesh.renderOrder =
      90;

    for (
      const part of [
        body,
        head,
        handLeft,
        handRight,
        armLeft,
        armRight
      ]
    ) {

      if (
        part.mesh.material
      ) {

        part.mesh.material.depthTest =
          false;

        part.mesh.material.depthWrite =
          false;

        part.mesh.material.needsUpdate =
          true;

      }

    }


    splitArmVisualV6(
      'armLeft',
      {
        shoulderEnd: 0.245,
        cuffStart: 0.780,
        overlap: 0.010,

        shoulderOrder: 20,
        mainOrder: 41,
        cuffOrder: 61
      }
    );

    splitArmVisualV6(
      'armRight',
      {
        shoulderEnd: 0.245,
        cuffStart: 0.780,
        overlap: 0.010,

        shoulderOrder: 21,
        mainOrder: 40,
        cuffOrder: 60
      }
    );


    /*
      Final hand placement relative to each own cuff.
    */
    // V45 disabled bad center refinement

    console.log(
      '[PEPE V6] CLEAN CUFF ASSEMBLY READY'
    );
  }

  /* === PEPE CLEAN CUFF ASSEMBLY V6 END === */


  const ready = Promise.all(defs.map(addPart)).then(() => {
    attachHandToArm('handLeft', 'armLeft');
    attachHandToArm('handRight', 'armRight');

    /*
      Apply final values from mobile calibration.
    */
    // V45 disabled bad center calibration left
    // V45 disabled bad center calibration right

    /*
      Final clean assembly:
      own cuffs + cleaner seams.
    */
    applyCleanCuffAssemblyV6();



    /*
      Final structural assembly:
      body -> arms -> wrists -> hands.
    */

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
