import * as THREE from 'three';

import {
  OrbitControls
} from 'three/addons/controls/OrbitControls.js';

import {
  EffectComposer
} from 'three/addons/postprocessing/EffectComposer.js';

import {
  RenderPass
} from 'three/addons/postprocessing/RenderPass.js';

import {
  UnrealBloomPass
} from 'three/addons/postprocessing/UnrealBloomPass.js';

import {
  OutputPass
} from 'three/addons/postprocessing/OutputPass.js';

import {
  RoundedBoxGeometry
} from 'three/addons/geometries/RoundedBoxGeometry.js';

import {
  NODES,
  ROUTES
} from './layout.js?v=data-tunnel-page-v1';

import {
  loadHardwareAssets
} from './assets.js?v=true-3d-glb-v5';

import {
  createTunnelModule
} from './modules.js?v=data-tunnel-page-v1';

import {
  createRoute,
  animateRoutes
} from './routes.js?v=data-tunnel-page-v1';

import {
  darkMetal,
  additive,
  lineMaterial,
  textTexture
} from './materials.js?v=data-tunnel-page-v1';

function nodeMap() {
  return new Map(
    NODES.map(
      node => [
        node.id,
        node
      ]
    )
  );
}

function makeBeam(
  width,
  height,
  depth,
  x,
  y,
  z,
  material
) {
  const mesh =
    new THREE.Mesh(
      new RoundedBoxGeometry(
        width,
        height,
        depth,
        3,
        .04
      ),
      material
    );

  mesh.position.set(
    x,
    y,
    z
  );

  return mesh;
}

function addTunnelFloor(scene) {
  const floor =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        13.8,
        28
      ),
      new THREE.MeshPhysicalMaterial({
        color: 0x010407,
        metalness: .82,
        roughness: .23,
        clearcoat: .88,
        clearcoatRoughness: .12
      })
    );

  floor.rotation.x =
    -Math.PI / 2;

  floor.position.set(
    0,
    -.22,
    -2.2
  );

  scene.add(floor);

  const guideXs =
    [-5.35, -4.85, -2.2, -1.72, 1.72, 2.2, 4.85, 5.35];

  const colors = [
    0x2f78ff,
    0x55cbff,
    0x426cff,
    0x8b62ff,
    0x9c63ff,
    0x71a7ff,
    0x4ae19a,
    0x33bb7f
  ];

  guideXs.forEach(
    (x, index) => {
      const guide =
        makeBeam(
          .055,
          .035,
          25.5,
          x,
          -.16,
          -2.5,
          additive(
            colors[index],
            .28
          )
        );

      scene.add(guide);
    }
  );

  for (
    const z
    of [2.5, 0, -2.5, -5, -7.5, -10]
  ) {
    const cross =
      makeBeam(
        11.6,
        .025,
        .035,
        0,
        -.15,
        z,
        additive(
          0x497a96,
          .08
        )
      );

    scene.add(cross);
  }
}

function addTunnelFrames(scene) {
  const material =
    darkMetal();

  for (
    const z
    of [2.7, .3, -2.4, -5.1, -7.8, -10.2]
  ) {
    const scale =
      THREE.MathUtils.mapLinear(
        z,
        2.7,
        -10.2,
        1,
        .48
      );

    const halfWidth =
      6.25 * scale
      + .95;

    const height =
      5.05 * scale
      + 1.05;

    const left =
      makeBeam(
        .18,
        height,
        .20,
        -halfWidth,
        height / 2 - .20,
        z,
        material
      );

    const right =
      left.clone();

    right.position.x =
      halfWidth;

    const top =
      makeBeam(
        halfWidth * 2,
        .15,
        .20,
        0,
        height - .20,
        z,
        material
      );

    scene.add(
      left,
      right,
      top
    );
  }

  const leftGlow =
    makeBeam(
      .045,
      .045,
      25,
      -5.75,
      .18,
      -2.4,
      additive(
        0x3598ff,
        .35
      )
    );

  const rightGlow =
    makeBeam(
      .045,
      .045,
      25,
      5.75,
      .18,
      -2.4,
      additive(
        0x53e49c,
        .32
      )
    );

  scene.add(
    leftGlow,
    rightGlow
  );
}

function addOverheadLabel(
  scene,
  node
) {
  if (!node.overhead) {
    return null;
  }

  const group =
    new THREE.Group();

  const texture =
    textTexture(
      node.label,
      0xa6b6be,
      {
        width: 820,
        height: 250,
        fontSize:
          node.label.length > 13
            ? 58
            : 66,
        background: null,
        border: false,
        glow: 0
      }
    );

  const material =
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: .86,
      depthWrite: false
    });

  const sprite =
    new THREE.Sprite(
      material
    );

  sprite.position.set(
    node.pos[0],
    4.36,
    node.pos[2] + .10
  );

  const scale =
    node.label.length > 12
      ? 2.55
      : 2.15;

  sprite.scale.set(
    scale,
    .72,
    1
  );

  group.add(sprite);

  const points = [
    new THREE.Vector3(
      node.pos[0],
      4.00,
      node.pos[2]
    ),
    new THREE.Vector3(
      node.pos[0],
      node.pos[1] + node.size[1] * .52,
      node.pos[2]
    )
  ];

  const guide =
    new THREE.Line(
      new THREE.BufferGeometry()
        .setFromPoints(points),
      new THREE.LineDashedMaterial({
        color: 0x718792,
        dashSize: .06,
        gapSize: .055,
        transparent: true,
        opacity: .42
      })
    );

  guide.computeLineDistances();

  group.add(guide);

  scene.add(group);

  return group;
}

function colorForRoute(aNode, bNode) {
  if (
    aNode.id === 'openai'
    || aNode.id === 'decision'
    || bNode.id === 'openai'
    || bNode.id === 'decision'
  ) {
    return 0x9b6dff;
  }

  if (
    aNode.id === 'paper'
    || aNode.id === 'execution'
    || bNode.id === 'paper'
    || bNode.id === 'execution'
    || aNode.id === 'core'
    || bNode.id === 'core'
  ) {
    return 0x59e5a0;
  }

  return 0x52b9ff;
}

export async function bootMemeflowTrue3D(
  rootId = 'memeflowTrue3DHost'
) {
  const mount =
    document.getElementById(
      rootId
    );

  if (!mount) {
    throw new Error(
      'Data Tunnel mount not found: '
      + rootId
    );
  }

  mount.replaceChildren();

  const scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x000204
    );

  scene.fog =
    new THREE.FogExp2(
      0x000205,
      .038
    );

  const camera =
    new THREE.PerspectiveCamera(
      46,
      1,
      .05,
      100
    );

  const renderer =
    new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference:
        'high-performance'
    });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      1.75
    )
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

  renderer.toneMappingExposure =
    .92;

  renderer.domElement.id =
    'memeflowTrue3DCanvas';

  mount.appendChild(
    renderer.domElement
  );

  const composer =
    new EffectComposer(
      renderer
    );

  composer.addPass(
    new RenderPass(
      scene,
      camera
    )
  );

  const bloom =
    new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      .20,
      .30,
      .91
    );

  composer.addPass(
    bloom
  );

  composer.addPass(
    new OutputPass()
  );

  const controls =
    new OrbitControls(
      camera,
      renderer.domElement
    );

  controls.enablePan =
    false;

  controls.enableDamping =
    true;

  controls.dampingFactor =
    .055;

  controls.rotateSpeed =
    .47;

  controls.zoomSpeed =
    .95;

  controls.minPolarAngle =
    .35;

  controls.maxPolarAngle =
    1.48;

  if (
    controls.touches
  ) {
    controls.touches.ONE =
      THREE.TOUCH.ROTATE;

    controls.touches.TWO =
      THREE.TOUCH.DOLLY_ROTATE;
  }

  scene.add(
    new THREE.HemisphereLight(
      0x6da8ca,
      0x010204,
      .23
    )
  );

  const key =
    new THREE.DirectionalLight(
      0xf2f9ff,
      1.10
    );

  key.position.set(
    0,
    8,
    7
  );

  scene.add(
    key
  );

  const blueFill =
    new THREE.PointLight(
      0x409fff,
      5.2,
      18,
      2
    );

  blueFill.position.set(
    -4.8,
    2.8,
    1.8
  );

  scene.add(
    blueFill
  );

  const violetFill =
    new THREE.PointLight(
      0x9a67ff,
      3.8,
      16,
      2
    );

  violetFill.position.set(
    .2,
    2.1,
    -4.8
  );

  scene.add(
    violetFill
  );

  const greenFill =
    new THREE.PointLight(
      0x52e89c,
      4.8,
      18,
      2
    );

  greenFill.position.set(
    4.8,
    2.7,
    1.2
  );

  scene.add(
    greenFill
  );

  addTunnelFloor(
    scene
  );

  addTunnelFrames(
    scene
  );

  let assets = null;

  try {
    assets =
      await loadHardwareAssets();
  }

  catch (error) {
    console.warn(
      '[DATA-TUNNEL] GLB decoration unavailable',
      error
    );
  }

  const modules =
    new Map();

  const pickMeshes =
    [];

  for (
    const node
    of NODES
  ) {
    const built =
      createTunnelModule(
        node,
        assets
      );

    scene.add(
      built.root
    );

    modules.set(
      node.id,
      built
    );

    pickMeshes.push(
      built.pickMesh
    );

    addOverheadLabel(
      scene,
      node
    );
  }

  const nodes =
    nodeMap();

  const routes =
    [];

  for (
    const [from, to]
    of ROUTES
  ) {
    const a =
      nodes.get(from);

    const b =
      nodes.get(to);

    if (!a || !b) {
      continue;
    }

    const route =
      createRoute(
        a,
        b,
        colorForRoute(
          a,
          b
        )
      );

    scene.add(
      route.root
    );

    routes.push(
      route
    );
  }

  const home =
    {
      position:
        new THREE.Vector3(
          0,
          4.45,
          12.4
        ),

      target:
        new THREE.Vector3(
          0,
          1.42,
          -4.10
        )
    };

  function configureHomeForAspect() {
    const width =
      Math.max(
        1,
        mount.clientWidth
      );

    const height =
      Math.max(
        1,
        mount.clientHeight
      );

    const aspect =
      width / height;

    camera.aspect =
      aspect;

    if (
      aspect < .88
    ) {
      camera.fov = 51;

      home.position.set(
        0,
        4.85,
        14.65
      );

      home.target.set(
        0,
        1.40,
        -4.10
      );
    }

    else if (
      aspect < 1.30
    ) {
      camera.fov = 47;

      home.position.set(
        0,
        4.55,
        13.20
      );

      home.target.set(
        0,
        1.42,
        -4.10
      );
    }

    else {
      camera.fov = 43;

      home.position.set(
        0,
        4.15,
        11.80
      );

      home.target.set(
        0,
        1.45,
        -4.25
      );
    }

    camera.updateProjectionMatrix();

    controls.minDistance =
      5.4;

    controls.maxDistance =
      30;
  }

  function resetView() {
    configureHomeForAspect();

    camera.position.copy(
      home.position
    );

    controls.target.copy(
      home.target
    );

    controls.update();
  }

  resetView();

  const resetButton =
    document.getElementById(
      'resetViewBtn'
    );

  const resetHandler =
    () => resetView();

  resetButton
    ?.addEventListener(
      'click',
      resetHandler
    );

  const resize =
    () => {
      const width =
        Math.max(
          1,
          mount.clientWidth
        );

      const height =
        Math.max(
          1,
          mount.clientHeight
        );

      renderer.setSize(
        width,
        height,
        false
      );

      composer.setSize(
        width,
        height
      );

      camera.aspect =
        width / height;

      camera.updateProjectionMatrix();
    };

  const resizeObserver =
    new ResizeObserver(
      resize
    );

  resizeObserver.observe(
    mount
  );

  resize();

  const raycaster =
    new THREE.Raycaster();

  const pointer =
    new THREE.Vector2();

  let pointerDown = null;

  renderer.domElement
    .addEventListener(
      'pointerdown',
      event => {
        pointerDown = {
          x: event.clientX,
          y: event.clientY
        };
      }
    );

  renderer.domElement
    .addEventListener(
      'pointerup',
      event => {
        if (!pointerDown) {
          return;
        }

        const movement =
          Math.hypot(
            event.clientX
              - pointerDown.x,
            event.clientY
              - pointerDown.y
          );

        pointerDown =
          null;

        if (
          movement > 8
        ) {
          return;
        }

        const rect =
          renderer.domElement
            .getBoundingClientRect();

        pointer.x =
          (
            (
              event.clientX
              - rect.left
            ) / rect.width
          ) * 2 - 1;

        pointer.y =
          -(
            (
              event.clientY
              - rect.top
            ) / rect.height
          ) * 2 + 1;

        raycaster.setFromCamera(
          pointer,
          camera
        );

        const hit =
          raycaster
            .intersectObjects(
              pickMeshes,
              false
            )[0];

        const nodeId =
          hit?.object?.userData?.nodeId;

        if (
          nodeId
        ) {
          window.dispatchEvent(
            new CustomEvent(
              'memeflow:true3d-select',
              {
                detail: {
                  nodeId
                }
              }
            )
          );
        }
      }
    );

  const clock =
    new THREE.Clock();

  let frame =
    0;

  let disposed =
    false;

  function animate() {
    if (
      disposed
    ) {
      return;
    }

    frame =
      requestAnimationFrame(
        animate
      );

    const time =
      clock.getElapsedTime();

    animateRoutes(
      routes,
      time
    );

    const core =
      modules.get(
        'core'
      );

    if (
      core?.halo
    ) {
      core.halo.rotation.z +=
        .0015;
    }

    controls.update();

    composer.render();
  }

  animate();

  function dispose() {
    if (
      disposed
    ) {
      return;
    }

    disposed =
      true;

    cancelAnimationFrame(
      frame
    );

    resizeObserver.disconnect();

    resetButton
      ?.removeEventListener(
        'click',
        resetHandler
      );

    controls.dispose();

    scene.traverse(
      object => {
        object.geometry
          ?.dispose
          ?.();

        if (
          Array.isArray(
            object.material
          )
        ) {
          for (
            const material
            of object.material
          ) {
            material
              ?.dispose
              ?.();
          }
        }

        else {
          object.material
            ?.dispose
            ?.();
        }
      }
    );

    composer.dispose();

    renderer.dispose();

    mount.replaceChildren();
  }

  return {
    scene,
    camera,
    renderer,
    composer,
    controls,
    modules,
    routes,
    resetView,
    dispose
  };
}

/* ===== MEMEFLOW_DATA_TUNNEL_PAGE_V1 ===== */
