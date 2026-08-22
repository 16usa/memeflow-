import * as THREE from '/vendor/three.module.js';

export function createPepeCharacterRig({
  parent,
  baseUrl = '/game-assets/character/'
} = {}) {

  if (!parent) {
    throw new Error('[PEPE RIG] parent required');
  }

  const root = new THREE.Group();
  root.name = 'PepeCharacterRig';
  parent.add(root);

  const loader = new THREE.TextureLoader();

  const textures = [];
  const materials = [];
  const geometries = [];
  const parts = {};

  const state = {
    mood: 'happy',
    direction: 0,
    speed: 0,
    thrust: 0,
    cameraLook: 0.35,

    smoothedSpeed: 0,
    smoothedThrust: 0,
    smoothedDirection: 0,

    enabled: true
  };


  /*
    Every SVG is 1000x1000.
    Every plane has EXACTLY same size.
    This guarantees perfect neutral alignment.
  */

  const PLANE = 2.55;


  function pixelToWorldX(px) {
    return ((px - 500) / 1000) * PLANE;
  }

  function pixelToWorldY(py) {
    return ((500 - py) / 1000) * PLANE;
  }


  function createLayer(
    name,
    file,
    z,
    pivotPixelX = 500,
    pivotPixelY = 500
  ) {

    const pivot = new THREE.Group();
    pivot.name = name + 'Pivot';

    const px = pixelToWorldX(pivotPixelX);
    const py = pixelToWorldY(pivotPixelY);

    pivot.position.set(px, py, 0);

    root.add(pivot);

    return new Promise(resolve => {

      loader.load(

        baseUrl + file,

        texture => {

          texture.colorSpace =
            THREE.SRGBColorSpace;

          const geometry =
            new THREE.PlaneGeometry(
              PLANE,
              PLANE
            );

          const material =
            new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              depthWrite: false,
              alphaTest: 0.015,
              side: THREE.DoubleSide
            });

          const mesh =
            new THREE.Mesh(
              geometry,
              material
            );

          /*
            Counter-offset keeps the layer
            perfectly aligned while its GROUP
            rotates around the chosen joint.
          */

          mesh.position.set(
            -px,
            -py,
            z
          );

          pivot.add(mesh);

          parts[name] = {
            pivot,
            mesh
          };

          textures.push(texture);
          materials.push(material);
          geometries.push(geometry);

          resolve(true);
        },

        undefined,

        err => {
          console.error(
            '[PEPE RIG] failed:',
            file,
            err
          );

          resolve(false);
        }
      );
    });
  }


  const ready = Promise.all([

    // hips
    createLayer(
      'legLeft',
      'leg_left_aligned_1786492600.svg',
      0.01,
      405,
      630
    ),

    createLayer(
      'legRight',
      'leg_right_aligned_1786492600.svg',
      0.02,
      595,
      630
    ),

    // torso
    createLayer(
      'body',
      'body_aligned_1786492600.svg',
      0.10
    ),

    // shoulders
    createLayer(
      'armLeft',
      'arm_left_aligned_1786492600.svg',
      0.14,
      390,
      500
    ),

    createLayer(
      'armRight',
      'arm_right_aligned_1786492600.svg',
      0.15,
      610,
      500
    ),

    // wrists / hands
    createLayer(
      'handLeft',
      'hand_left_aligned_1786492600.svg',
      0.18,
      350,
      710
    ),

    createLayer(
      'handRight',
      'hand_right_aligned_1786492600.svg',
      0.19,
      650,
      710
    ),

    // neck / head
    createLayer(
      'head',
      'head_aligned_1786492600.svg',
      0.25,
      500,
      490
    ),

    createLayer(
      'eyesOpen',
      'eyes_open_aligned_1786492600.svg',
      0.28,
      500,
      490
    ),

    createLayer(
      'eyesClosed',
      'eyes_closed_aligned_1786492600.svg',
      0.29,
      500,
      490
    ),

    createLayer(
      'mouthHappy',
      'mouth_happy_aligned_1786492600.svg',
      0.30,
      500,
      490
    ),

    createLayer(
      'mouthSad',
      'mouth_sad_aligned_1786492600.svg',
      0.31,
      500,
      490
    )

  ]).then(() => {

    parts.eyesClosed.mesh.visible = false;
    parts.mouthSad.mesh.visible = false;

    console.log(
      '[PEPE RIG] ALIGNED RIG READY'
    );

    return true;
  });


  function visible(name, value) {
    const p = parts[name];
    if (p) {
      p.mesh.visible = !!value;
    }
  }


  function setMood(mood) {

    state.mood = mood;

    if (!parts.mouthHappy) return;

    visible(
      'mouthHappy',
      mood !== 'sad'
    );

    visible(
      'mouthSad',
      mood === 'sad'
    );
  }


  function setMarket({
    direction = 0,
    speed = 0,
    thrust = 0
  } = {}) {

    state.direction =
      THREE.MathUtils.clamp(
        direction,
        -1,
        1
      );

    state.speed =
      THREE.MathUtils.clamp(
        speed,
        0,
        1
      );

    state.thrust =
      THREE.MathUtils.clamp(
        thrust,
        0,
        1
      );

    if (direction > 0.05) {
      setMood('happy');
    }

    if (direction < -0.05) {
      setMood('sad');
    }
  }


  function setLookToCamera(value = 1) {

    state.cameraLook =
      THREE.MathUtils.clamp(
        value,
        0,
        1
      );
  }


  let nextBlink = 2;
  let blinkEnd = 0;


  function update(
    t,
    dt = 1 / 60
  ) {

    if (!state.enabled) return;
    if (!parts.body) return;

    const s =
      1 - Math.exp(-dt * 5);

    state.smoothedSpeed =
      THREE.MathUtils.lerp(
        state.smoothedSpeed,
        state.speed,
        s
      );

    state.smoothedThrust =
      THREE.MathUtils.lerp(
        state.smoothedThrust,
        state.thrust,
        s
      );

    state.smoothedDirection =
      THREE.MathUtils.lerp(
        state.smoothedDirection,
        state.direction,
        s
      );

    const speed =
      state.smoothedSpeed;

    const thrust =
      state.smoothedThrust;

    const direction =
      state.smoothedDirection;


    /*
      Whole body floating.
      Very subtle — no rubber character.
    */

    root.position.y =
      Math.sin(t * (1.5 + speed))
      * (0.012 + thrust * 0.016);

    root.rotation.z =
      Math.sin(t * 1.15)
      * (0.008 + speed * 0.010);


    /*
      HEAD
    */

    const sad =
      Math.max(0, -direction);

    const headTurn =
      Math.sin(t * 1.25)
      * 0.025
      * state.cameraLook;

    for (const name of [
      'head',
      'eyesOpen',
      'eyesClosed',
      'mouthHappy',
      'mouthSad'
    ]) {

      parts[name].pivot.rotation.z =
        headTurn;

      parts[name].pivot.position.y +=
        0;
    }

    parts.head.pivot.rotation.x =
      sad * 0.045;


    /*
      ARMS
    */

    const armWave =
      Math.sin(
        t * (2.2 + speed * 2.0)
      );

    parts.armLeft.pivot.rotation.z =
      0.015 +
      armWave *
      (0.015 + thrust * 0.045);

    parts.handLeft.pivot.rotation.z =
      parts.armLeft.pivot.rotation.z;

    parts.armRight.pivot.rotation.z =
      -0.015 -
      armWave *
      (0.015 + thrust * 0.045);

    parts.handRight.pivot.rotation.z =
      parts.armRight.pivot.rotation.z;


    /*
      LEGS
    */

    const legWave =
      Math.sin(
        t * (2.5 + thrust * 3)
      );

    parts.legLeft.pivot.rotation.z =
      legWave *
      (0.008 + thrust * 0.022);

    parts.legRight.pivot.rotation.z =
      -legWave *
      (0.008 + thrust * 0.022);


    /*
      BLINK
    */

    if (t >= nextBlink) {

      blinkEnd =
        t + 0.11;

      nextBlink =
        t +
        2.4 +
        Math.random() * 2.8;
    }

    const blinking =
      t < blinkEnd;

    visible(
      'eyesOpen',
      !blinking
    );

    visible(
      'eyesClosed',
      blinking
    );
  }


  function setVisible(value) {
    root.visible = !!value;
  }


  function destroy() {

    root.removeFromParent();

    geometries.forEach(
      x => x.dispose()
    );

    materials.forEach(
      x => x.dispose()
    );

    textures.forEach(
      x => x.dispose()
    );
  }


  return {
    root,
    state,
    ready,

    setMood,
    setMarket,
    setLookToCamera,
    setVisible,

    update,
    destroy
  };
}
