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
  NODES,
  ROUTES
} from './layout.js?v=neon-pcb-scene-v1';

import {
  createModule
} from './modules.js?v=neon-pcb-scene-v1';

import {
  createRoute,
  animateRoutes
} from './routes.js?v=neon-pcb-scene-v1';

import {
  createBoardTexture,
  accentMaterial
} from './materials.js?v=neon-pcb-scene-v1';

function logicalBounds() {
  const box =
    new THREE.Box3()
      .makeEmpty();

  for (const node of NODES) {
    const w =
      Number(node.size?.[0])
      || 2.4;

    const d =
      Number(node.size?.[1])
      || 1.6;

    box.expandByPoint(
      new THREE.Vector3(
        node.pos[0] - w * 0.56,
        -0.35,
        node.pos[2] - d * 0.60
      )
    );

    box.expandByPoint(
      new THREE.Vector3(
        node.pos[0] + w * 0.56,
        0.82,
        node.pos[2] + d * 0.60
      )
    );
  }

  return box;
}

function boxCorners(box) {
  const min = box.min;
  const max = box.max;

  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ];
}

function addBoard(scene) {
  const board =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        13.8,
        11.4
      ),
      new THREE.MeshPhysicalMaterial({
        map: createBoardTexture(),
        color: 0x071017,
        metalness: 0.74,
        roughness: 0.33,
        clearcoat: 0.68,
        clearcoatRoughness: 0.20
      })
    );

  board.rotation.x =
    -Math.PI / 2;

  board.position.y =
    -0.38;

  scene.add(
    board
  );

  const edgeColor =
    0x0b4161;

  for (const [x, z, w, d] of [
    [0, -5.58, 13.65, 0.035],
    [0, 5.58, 13.65, 0.035],
    [-6.72, 0, 0.035, 11.15],
    [6.72, 0, 0.035, 11.15]
  ]) {
    const edge =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          w,
          0.025,
          d
        ),
        accentMaterial(
          edgeColor,
          0.34
        )
      );

    edge.position.set(
      x,
      -0.345,
      z
    );

    scene.add(
      edge
    );
  }
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
      'Neon PCB mount not found: '
      + rootId
    );
  }

  mount.replaceChildren();

  const scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x000102
    );

  scene.fog =
    new THREE.FogExp2(
      0x000204,
      0.026
    );

  const camera =
    new THREE.PerspectiveCamera(
      39,
      1,
      0.05,
      120
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
      1.65
    )
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

  renderer.toneMappingExposure =
    0.93;

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
      0.23,
      0.34,
      0.89
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
    0.052;

  controls.rotateSpeed =
    0.48;

  controls.zoomSpeed =
    1.00;

  controls.minPolarAngle =
    0.42;

  controls.maxPolarAngle =
    1.47;

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
      0x6ca6c7,
      0x000102,
      0.30
    )
  );

  const key =
    new THREE.DirectionalLight(
      0xe8f6ff,
      1.25
    );

  key.position.set(
    -1.5,
    8.2,
    6.2
  );

  scene.add(
    key
  );

  const cyan =
    new THREE.PointLight(
      0x18aaff,
      3.6,
      16,
      2
    );

  cyan.position.set(
    -4.2,
    2.4,
    -0.2
  );

  scene.add(
    cyan
  );

  const violet =
    new THREE.PointLight(
      0xa052ff,
      3.4,
      13,
      2
    );

  violet.position.set(
    -0.1,
    2.3,
    0.0
  );

  scene.add(
    violet
  );

  const green =
    new THREE.PointLight(
      0x36ec8b,
      4.0,
      15,
      2
    );

  green.position.set(
    3.5,
    2.5,
    0.1
  );

  scene.add(
    green
  );

  addBoard(
    scene
  );

  const modules =
    new Map();

  const pickMeshes =
    [];

  for (
    const node
    of NODES
  ) {
    const built =
      createModule(
        node
      );

    scene.add(
      built.group
    );

    modules.set(
      node.id,
      built
    );

    pickMeshes.push(
      built.pickMesh
    );
  }

  const byId =
    new Map(
      NODES.map(
        node => [
          node.id,
          node
        ]
      )
    );

  const routes = [];

  for (
    const [from, to, color]
    of ROUTES
  ) {
    const a =
      byId.get(
        from
      );

    const b =
      byId.get(
        to
      );

    if (!a || !b) {
      continue;
    }

    const route =
      createRoute(
        a,
        b,
        color
      );

    scene.add(
      route.group
    );

    routes.push(
      route
    );
  }

  const bounds =
    logicalBounds();

  const center =
    new THREE.Vector3();

  bounds.getCenter(
    center
  );

  const corners =
    boxCorners(
      bounds
    );

  const homeDirection =
    new THREE.Vector3(
      0.10,
      0.95,
      0.88
    ).normalize();

  const homeCamera =
    new THREE.Vector3();

  const homeTarget =
    new THREE.Vector3();

  let homeDistance =
    18;

  function updateProjection() {
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

    camera.fov =
      aspect < 0.82
        ? 42
        : aspect < 1.10
          ? 39
          : 36;

    camera.updateProjectionMatrix();

    return {
      width,
      height,
      aspect
    };
  }

  function fitsAt(
    distance,
    xLimit,
    yLimit
  ) {
    camera.position
      .copy(
        center
      )
      .addScaledVector(
        homeDirection,
        distance
      );

    camera.lookAt(
      center
    );

    camera.updateMatrixWorld(
      true
    );

    for (
      const corner
      of corners
    ) {
      const projected =
        corner.clone()
          .project(
            camera
          );

      if (
        !Number.isFinite(
          projected.x
        )
        || !Number.isFinite(
          projected.y
        )
        || Math.abs(
          projected.x
        ) > xLimit
        || Math.abs(
          projected.y
        ) > yLimit
      ) {
        return false;
      }
    }

    return true;
  }

  function computeHomeView() {
    const {
      width,
      height,
      aspect
    } =
      updateProjection();

    renderer.setSize(
      width,
      height,
      false
    );

    composer.setSize(
      width,
      height
    );

    const xLimit =
      aspect < 0.82
        ? 0.965
        : 0.958;

    const yLimit =
      aspect < 0.82
        ? 0.950
        : 0.945;

    let low = 4;
    let high = 50;

    for (
      let index = 0;
      index < 34;
      index++
    ) {
      const mid =
        (low + high) / 2;

      if (
        fitsAt(
          mid,
          xLimit,
          yLimit
        )
      ) {
        high = mid;
      }

      else {
        low = mid;
      }
    }

    homeDistance =
      high;

    homeTarget.copy(
      center
    );

    homeTarget.y =
      0.08;

    homeCamera
      .copy(
        center
      )
      .addScaledVector(
        homeDirection,
        homeDistance
      );

    controls.minDistance =
      Math.max(
        4.1,
        homeDistance * 0.34
      );

    controls.maxDistance =
      Math.max(
        32,
        homeDistance * 2.2
      );
  }

  function resetView() {
    computeHomeView();

    camera.position.copy(
      homeCamera
    );

    controls.target.copy(
      homeTarget
    );

    controls.update();
  }

  let atHome =
    true;

  controls.addEventListener(
    'start',
    () => {
      atHome =
        false;
    }
  );

  const resize =
    () => {
      const wasHome =
        atHome;

      const {
        width,
        height
      } =
        updateProjection();

      renderer.setSize(
        width,
        height,
        false
      );

      composer.setSize(
        width,
        height
      );

      if (
        wasHome
      ) {
        resetView();
      }
    };

  const resizeObserver =
    new ResizeObserver(
      resize
    );

  resizeObserver.observe(
    mount
  );

  const resetButton =
    document.getElementById(
      'resetViewBtn'
    );

  const resetHandler =
    () => {
      atHome =
        true;

      resetView();
    };

  resetButton
    ?.addEventListener(
      'click',
      resetHandler
    );

  resetView();

  const raycaster =
    new THREE.Raycaster();

  const pointer =
    new THREE.Vector2();

  let pointerDown =
    null;

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
        if (
          !pointerDown
        ) {
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
          hit
            ?.object
            ?.userData
            ?.nodeId;

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

    const openai =
      modules.get(
        'openai'
      );

    if (
      core?.icon
    ) {
      core.icon.material.opacity =
        0.86
        + Math.sin(
          time * 2.2
        ) * 0.10;
    }

    if (
      openai?.glass
    ) {
      openai.glass.material.emissiveIntensity =
        0.07
        + Math.sin(
          time * 1.8
        ) * 0.018;
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

/* ===== MEMEFLOW_NEON_PCB_SCENE_V1 ===== */
