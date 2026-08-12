import * as THREE from '/vendor/three.module.js';

export function createPepeRealRigV2({
  parent,
  baseUrl = '/game-assets/character/'
} = {}) {

  if (!parent) {
    throw new Error('[PEPE V2] parent required');
  }

  const root = new THREE.Group();
  root.name = 'PepeRealRigV2';
  parent.add(root);

  /*
    Наш мастер-холст = 1000 × 1000.
    1000 px = 4 world units.
  */

  const UNIT = 4 / 1000;

  const loader = new THREE.TextureLoader();
  const parts = {};
  const resources = [];

  const state = {
    direction: 0,
    speed: 0,
    thrust: 0,

    smoothDirection: 0,
    smoothSpeed: 0,
    smoothThrust: 0
  };


  function worldX(px) {
    return (px - 500) * UNIT;
  }

  function worldY(py) {
    return (500 - py) * UNIT;
  }


  /*
    IMPORTANT:
    Никаких старых pivot-offset формул.

    Сначала каждый PNG просто ставится
    в абсолютную координату мастер-холста.
  */

  const layout = [

    {
      name: 'legLeft',
      file: 'leg_right.png',
      center: [430, 720],
      scale: .75,
      z: 1
    },

    {
      name: 'legRight',
      file: 'leg_left.png',
      center: [570, 720],
      scale: .75,
      z: 2
    },

    {
      name: 'body',
      file: 'body.png',
      center: [500, 560],
      scale: .85,
      z: 10
    },

    {
      name: 'armLeft',
      file: 'arm_left.png',
      center: [365, 540],
      scale: .72,
      z: 20
    },

    {
      name: 'armRight',
      file: 'arm_right.png',
      center: [635, 540],
      scale: .72,
      z: 21
    },

    {
      name: 'handLeft',
      file: 'hand_left.png',
      center: [340, 650],
      scale: .52,
      z: 30
    },

    {
      name: 'handRight',
      file: 'hand_right.png',
      center: [660, 650],
      scale: .52,
      z: 31
    },

    {
      name: 'head',
      file: 'head.png',
      center: [500, 315],
      scale: .85,
      z: 40
    }

  ];


  function loadPart(def) {

    return new Promise((resolve, reject) => {

      loader.load(

        baseUrl + def.file + '?pepev2=1',

        texture => {

          texture.colorSpace =
            THREE.SRGBColorSpace;

          const img = texture.image;

          const width =
            img.width *
            def.scale *
            UNIT;

          const height =
            img.height *
            def.scale *
            UNIT;

          const geometry =
            new THREE.PlaneGeometry(
              width,
              height
            );

          const material =
            new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              depthWrite: false,
              depthTest: false,
              alphaTest: 0.01,
              side: THREE.DoubleSide
            });

          const mesh =
            new THREE.Mesh(
              geometry,
              material
            );

          /*
            ПРЯМЫЕ координаты.
            Никаких родительских offset.
          */

          mesh.position.set(
            worldX(def.center[0]),
            worldY(def.center[1]),
            def.z * 0.001
          );

          mesh.renderOrder =
            def.z;

          root.add(mesh);

          parts[def.name] = {
            mesh,
            baseX: mesh.position.x,
            baseY: mesh.position.y,
            baseRotation: 0
          };

          resources.push(
            texture,
            geometry,
            material
          );

          resolve();
        },

        undefined,

        reject
      );
    });
  }


  const ready =
    Promise.all(
      layout.map(loadPart)
    ).then(() => {

      /*
        Центрируем всю собранную фигуру.
      */

      root.position.set(
        0,
        -0.05,
        0
      );

      root.scale.setScalar(.92);

      console.log(
        '[PEPE REAL RIG V2] READY'
      );

      return true;
    });


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
  }


  function update(t, dt = 1 / 60) {

    if (!parts.body) return;

    const smooth =
      1 - Math.exp(-dt * 5);

    state.smoothDirection =
      THREE.MathUtils.lerp(
        state.smoothDirection,
        state.direction,
        smooth
      );

    state.smoothSpeed =
      THREE.MathUtils.lerp(
        state.smoothSpeed,
        state.speed,
        smooth
      );

    state.smoothThrust =
      THREE.MathUtils.lerp(
        state.smoothThrust,
        state.thrust,
        smooth
      );


    const dir =
      state.smoothDirection;

    const speed =
      state.smoothSpeed;

    const thrust =
      state.smoothThrust;


    /*
      Пока очень мягкая анимация.
      Сначала добиваемся идеальной сборки.
    */

    root.position.y =
      -0.05 +
      Math.sin(
        t * (1.3 + speed)
      ) *
      (0.012 + thrust * 0.018);


    root.rotation.z =
      Math.sin(t * 1.1) *
      (0.006 + speed * 0.008);


    /*
      Голова двигается независимо,
      но вокруг собственного центра.
    */

    parts.head.mesh.rotation.z =
      Math.sin(t * 1.15) *
      (0.012 + thrust * 0.016) -
      dir * 0.008;


    /*
      Минимальное движение конечностей.
      Без разрушения сборки.
    */

    const armMotion =
      Math.sin(
        t * (1.8 + speed)
      ) *
      (0.008 + thrust * 0.012);

    parts.armLeft.mesh.rotation.z =
      armMotion;

    parts.armRight.mesh.rotation.z =
      -armMotion;


    const legMotion =
      Math.sin(
        t * (2 + speed)
      ) *
      (0.004 + thrust * 0.008);

    parts.legLeft.mesh.rotation.z =
      legMotion;

    parts.legRight.mesh.rotation.z =
      -legMotion;
  }


  function destroy() {

    root.removeFromParent();

    for (const item of resources) {
      item.dispose?.();
    }
  }


  return {
    root,
    state,
    parts,
    ready,
    setMarket,
    update,
    destroy
  };
}
