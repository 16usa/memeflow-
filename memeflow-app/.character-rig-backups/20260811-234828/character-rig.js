import * as THREE from '/vendor/three.module.js';

export function createPepeCharacterRig({
  parent,
  baseUrl = '/game-assets/character/'
} = {}) {

  if (!parent) {
    throw new Error('[PEPE RIG] parent Three.js group is required');
  }

  const root = new THREE.Group();
  root.name = 'PepeCharacterRig';
  parent.add(root);

  /* Главные группы */
  const bodyGroup = new THREE.Group();
  const headGroup = new THREE.Group();

  const armLeftPivot = new THREE.Group();
  const armRightPivot = new THREE.Group();

  const legLeftPivot = new THREE.Group();
  const legRightPivot = new THREE.Group();

  root.add(
    legLeftPivot,
    legRightPivot,
    bodyGroup,
    armLeftPivot,
    armRightPivot,
    headGroup
  );

  const loader = new THREE.TextureLoader();

  const parts = {};
  const textures = [];
  const materials = [];
  const geometries = [];

  const state = {
    mood: 'happy',

    /* -1 = падение, 0 = neutral, +1 = рост */
    direction: 0,

    /* 0..1 */
    speed: 0,

    /* 0..1 */
    thrust: 0,

    /* насколько смотрит на камеру */
    cameraLook: 0.25,

    /* внутреннее сглаживание */
    smoothedSpeed: 0,
    smoothedThrust: 0,
    smoothedDirection: 0,

    enabled: true
  };

  function makePart(
    name,
    file,
    parentGroup,
    {
      x = 0,
      y = 0,
      z = 0,
      width = 1,
      height = 1,
      opacity = 1
    } = {}
  ) {
    return new Promise((resolve) => {

      loader.load(
        baseUrl + file,

        texture => {
          texture.colorSpace = THREE.SRGBColorSpace;

          const geometry =
            new THREE.PlaneGeometry(width, height);

          const material =
            new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              depthWrite: false,
              alphaTest: 0.01,
              side: THREE.DoubleSide,
              opacity
            });

          const mesh =
            new THREE.Mesh(geometry, material);

          mesh.name = name;
          mesh.position.set(x, y, z);

          parentGroup.add(mesh);

          parts[name] = mesh;
          textures.push(texture);
          materials.push(material);
          geometries.push(geometry);

          resolve(mesh);
        },

        undefined,

        () => {
          console.warn(
            '[PEPE RIG] asset missing:',
            baseUrl + file
          );

          resolve(null);
        }
      );
    });
  }

  const ready = Promise.all([

    /* LEGS — сзади */
    makePart(
      'legLeft',
      'leg_left.svg',
      legLeftPivot,
      {
        x: -0.27,
        y: -0.55,
        z: 0.01,
        width: 0.70,
        height: 0.95
      }
    ),

    makePart(
      'legRight',
      'leg_right.svg',
      legRightPivot,
      {
        x: 0.27,
        y: -0.55,
        z: 0.02,
        width: 0.70,
        height: 0.95
      }
    ),

    /* BODY */
    makePart(
      'body',
      'body.svg',
      bodyGroup,
      {
        x: 0,
        y: -0.05,
        z: 0.10,
        width: 1.25,
        height: 1.35
      }
    ),

    /* ARMS */
    makePart(
      'armLeft',
      'arm_left.svg',
      armLeftPivot,
      {
        x: -0.45,
        y: 0.02,
        z: 0.16,
        width: 0.75,
        height: 1.05
      }
    ),

    makePart(
      'armRight',
      'arm_right.svg',
      armRightPivot,
      {
        x: 0.45,
        y: 0.02,
        z: 0.17,
        width: 0.75,
        height: 1.05
      }
    ),

    makePart(
      'handLeft',
      'hand_left.svg',
      armLeftPivot,
      {
        x: -0.61,
        y: -0.30,
        z: 0.20,
        width: 0.50,
        height: 0.50
      }
    ),

    makePart(
      'handRight',
      'hand_right.svg',
      armRightPivot,
      {
        x: 0.61,
        y: -0.30,
        z: 0.21,
        width: 0.50,
        height: 0.50
      }
    ),

    /* HEAD */
    makePart(
      'head',
      'head.svg',
      headGroup,
      {
        x: 0,
        y: 0.65,
        z: 0.30,
        width: 1.25,
        height: 1.05
      }
    ),

    makePart(
      'eyesOpen',
      'eyes_open.svg',
      headGroup,
      {
        x: 0,
        y: 0.79,
        z: 0.34,
        width: 1.00,
        height: 0.55
      }
    ),

    makePart(
      'eyesClosed',
      'eyes_closed.svg',
      headGroup,
      {
        x: 0,
        y: 0.79,
        z: 0.35,
        width: 1.00,
        height: 0.55,
        opacity: 0
      }
    ),

    makePart(
      'mouthHappy',
      'mouth_happy.svg',
      headGroup,
      {
        x: 0,
        y: 0.52,
        z: 0.36,
        width: 0.70,
        height: 0.48
      }
    ),

    makePart(
      'mouthSad',
      'mouth_sad.svg',
      headGroup,
      {
        x: 0,
        y: 0.52,
        z: 0.37,
        width: 0.70,
        height: 0.48,
        opacity: 0
      }
    )

  ]).then(() => {

    /*
      Pivot'ы примерно на плечах/бедрах.
      Потом подгоним точно под наши PNG.
    */

    armLeftPivot.position.set(-0.05, 0.18, 0);
    armRightPivot.position.set(0.05, 0.18, 0);

    legLeftPivot.position.set(-0.03, -0.05, 0);
    legRightPivot.position.set(0.03, -0.05, 0);

    console.log('[PEPE RIG] READY');

    return true;
  });

  function opacity(name, value) {
    const mesh = parts[name];

    if (mesh?.material) {
      mesh.material.opacity = value;
      mesh.visible = value > 0.001;
    }
  }

  function setMood(mood) {
    state.mood = mood;

    if (mood === 'sad') {
      opacity('mouthHappy', 0);
      opacity('mouthSad', 1);
    } else {
      opacity('mouthHappy', 1);
      opacity('mouthSad', 0);
    }
  }

  function setMarket({
    direction = 0,
    speed = 0,
    thrust = 0
  } = {}) {

    state.direction =
      THREE.MathUtils.clamp(direction, -1, 1);

    state.speed =
      THREE.MathUtils.clamp(speed, 0, 1);

    state.thrust =
      THREE.MathUtils.clamp(thrust, 0, 1);

    if (direction < -0.05) {
      setMood('sad');
    }

    if (direction > 0.05) {
      setMood('happy');
    }
  }

  function setLookToCamera(amount = 1) {
    state.cameraLook =
      THREE.MathUtils.clamp(amount, 0, 1);
  }

  let nextBlink = 1.5;
  let blinkUntil = 0;

  function update(timeSeconds, deltaSeconds = 1 / 60) {

    if (!state.enabled) return;

    const smooth =
      1 - Math.exp(-deltaSeconds * 5);

    state.smoothedSpeed =
      THREE.MathUtils.lerp(
        state.smoothedSpeed,
        state.speed,
        smooth
      );

    state.smoothedThrust =
      THREE.MathUtils.lerp(
        state.smoothedThrust,
        state.thrust,
        smooth
      );

    state.smoothedDirection =
      THREE.MathUtils.lerp(
        state.smoothedDirection,
        state.direction,
        smooth
      );

    const speed = state.smoothedSpeed;
    const thrust = state.smoothedThrust;
    const direction = state.smoothedDirection;

    /* Всё тело слегка плавает */
    root.position.y =
      Math.sin(timeSeconds * (1.6 + speed * 2.5))
      * (0.018 + thrust * 0.028);

    root.rotation.z =
      Math.sin(timeSeconds * 1.25)
      * (0.015 + speed * 0.025);

    /*
      Голова смотрит к камере.
      При падении — немного опускается.
    */
    const sadAmount =
      Math.max(0, -direction);

    headGroup.rotation.z =
      Math.sin(timeSeconds * 1.4)
      * 0.025
      * state.cameraLook;

    headGroup.rotation.x =
      -0.05 * state.cameraLook
      + sadAmount * 0.10;

    headGroup.position.y =
      -sadAmount * 0.035;

    /*
      Руки двигаются сильнее,
      когда ракета ускоряется.
    */
    const armMotion =
      Math.sin(timeSeconds * (2.5 + speed * 4));

    armLeftPivot.rotation.z =
      0.06
      + armMotion * (0.03 + thrust * 0.10);

    armRightPivot.rotation.z =
      -0.06
      - armMotion * (0.03 + thrust * 0.10);

    /*
      Ноги слегка вибрируют
      от двигателя.
    */
    const legMotion =
      Math.sin(timeSeconds * (3 + thrust * 8));

    legLeftPivot.rotation.z =
      legMotion * (0.02 + thrust * 0.06);

    legRightPivot.rotation.z =
      -legMotion * (0.02 + thrust * 0.06);

    /*
      Автоматическое моргание.
    */
    if (timeSeconds >= nextBlink) {
      blinkUntil = timeSeconds + 0.12;

      nextBlink =
        timeSeconds
        + 2.2
        + Math.random() * 3.2;
    }

    const blinking =
      timeSeconds < blinkUntil;

    opacity(
      'eyesOpen',
      blinking ? 0 : 1
    );

    opacity(
      'eyesClosed',
      blinking ? 1 : 0
    );
  }

  function setVisible(value) {
    root.visible = !!value;
  }

  function destroy() {

    root.removeFromParent();

    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    textures.forEach(t => t.dispose());
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
