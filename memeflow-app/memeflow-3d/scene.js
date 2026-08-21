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
} from './layout.js?v=true-3d-clean-v3';

import {
  createModule
} from './modules.js?v=true-3d-clean-v3';

import {
  createRoute,
  animateRoutes
} from './routes.js?v=true-3d-clean-v3';

function buildFitBounds(
  modules
) {
  const box =
    new THREE.Box3()
      .makeEmpty();

  for (
    const module
    of modules.values()
  ) {
    box.expandByObject(
      module.fitObject
    );
  }

  return box;
}

function boxCorners(
  box
) {
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

export function bootMemeflowTrue3D(
  rootId = 'memeflowTrue3DHost'
) {
  const mount =
    document.getElementById(
      rootId
    );

  if (!mount) {
    throw new Error(
      'True 3D mount not found: '
      + rootId
    );
  }

  mount.replaceChildren();

  const scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x000000
    );

  const camera =
    new THREE.PerspectiveCamera(
      42,
      1,
      0.05,
      240
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
    1.02;

  renderer.domElement.id =
    'memeflowTrue3DCanvas';

  mount.appendChild(
    renderer.domElement
  );

  const composer =
    new EffectComposer(
      renderer
    );

  const renderPass =
    new RenderPass(
      scene,
      camera
    );

  composer.addPass(
    renderPass
  );

  const bloom =
    new UnrealBloomPass(
      new THREE.Vector2(
        1,
        1
      ),
      0.44,
      0.46,
      0.72
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
    0.055;

  controls.rotateSpeed =
    0.56;

  controls.zoomSpeed =
    1.05;

  controls.minAzimuthAngle =
    -Infinity;

  controls.maxAzimuthAngle =
    Infinity;

  controls.minPolarAngle =
    0.10;

  controls.maxPolarAngle =
    Math.PI - 0.10;

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
      0x9fd9ff,
      0x010203,
      0.42
    )
  );

  const key =
    new THREE.DirectionalLight(
      0xf4fbff,
      1.25
    );

  key.position.set(
    4.5,
    10,
    6.5
  );

  scene.add(
    key
  );

  const cyanRim =
    new THREE.PointLight(
      0x64dcff,
      9,
      22,
      2
    );

  cyanRim.position.set(
    -5.5,
    3.2,
    1.8
  );

  scene.add(
    cyanRim
  );

  const greenCore =
    new THREE.PointLight(
      0x57e69a,
      12,
      19,
      2
    );

  greenCore.position.set(
    3.2,
    2.7,
    -3.2
  );

  scene.add(
    greenCore
  );

  const violetDecision =
    new THREE.PointLight(
      0x8e58ff,
      7,
      16,
      2
    );

  violetDecision.position.set(
    0,
    2.2,
    2.5
  );

  scene.add(
    violetDecision
  );

  const modules =
    new Map();

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

  const routes =
    [];

  for (
    const [
      from,
      to,
      color
    ]
    of ROUTES
  ) {
    const source =
      byId.get(
        from
      );

    const target =
      byId.get(
        to
      );

    if (
      !source
      || !target
    ) {
      continue;
    }

    const route =
      createRoute(
        source.pos,
        target.pos,
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
    buildFitBounds(
      modules
    );

  const fitCenter =
    new THREE.Vector3();

  bounds.getCenter(
    fitCenter
  );

  const corners =
    boxCorners(
      bounds
    );

  const homeDirection =
    new THREE.Vector3(
      0,
      0.87,
      0.49
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
        ? 43
        : aspect < 1.10
          ? 40
          : 37;

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
    camera.position.copy(
      fitCenter
    ).addScaledVector(
      homeDirection,
      distance
    );

    camera.lookAt(
      fitCenter
    );

    camera.updateMatrixWorld(
      true
    );

    camera.updateProjectionMatrix();

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
        ? 0.86
        : 0.90;

    const yLimit =
      aspect < 0.82
        ? 0.84
        : 0.88;

    let low =
      4;

    let high =
      60;

    for (
      let index = 0;
      index < 34;
      index++
    ) {
      const mid =
        (
          low
          + high
        ) / 2;

      if (
        fitsAt(
          mid,
          xLimit,
          yLimit
        )
      ) {
        high =
          mid;
      } else {
        low =
          mid;
      }
    }

    homeDistance =
      high;

    homeTarget.copy(
      fitCenter
    );

    homeCamera.copy(
      fitCenter
    ).addScaledVector(
      homeDirection,
      homeDistance
    );

    controls.minDistance =
      Math.max(
        3.7,
        homeDistance * 0.28
      );

    controls.maxDistance =
      Math.max(
        38,
        homeDistance * 2.5
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

      updateProjection();

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

  resetButton?.addEventListener(
    'click',
    resetHandler
  );

  resetView();

  const raycaster =
    new THREE.Raycaster();

  const pointer =
    new THREE.Vector2();

  const pickMeshes =
    [
      ...modules.values()
    ].map(
      module =>
        module.pickMesh
    );

  let pointerDown = null;

  renderer.domElement.addEventListener(
    'pointerdown',
    event => {
      pointerDown = {
        x: event.clientX,
        y: event.clientY
      };
    }
  );

  renderer.domElement.addEventListener(
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
        ) * 2
        - 1;

      pointer.y =
        -(
          (
            event.clientY
            - rect.top
          ) / rect.height
        ) * 2
        + 1;

      raycaster.setFromCamera(
        pointer,
        camera
      );

      const hits =
        raycaster.intersectObjects(
          pickMeshes,
          false
        );

      const nodeId =
        hits[0]
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

    const decision =
      modules.get(
        'decision'
      );

    const execution =
      modules.get(
        'execution'
      );

    if (
      core?.rings
    ) {
      core.rings.rotation.y +=
        0.0016;
    }

    if (
      core?.innerGlow
        ?.material
    ) {
      core.innerGlow
        .material
        .opacity =
          0.095
          + Math.sin(
            time * 2.0
          ) * 0.018;
    }

    if (
      decision?.innerGlow
        ?.material
    ) {
      decision.innerGlow
        .material
        .opacity =
          0.035
          + Math.sin(
            time * 2.1 + 1.5
          ) * 0.009;
    }

    if (
      execution?.innerGlow
        ?.material
    ) {
      execution.innerGlow
        .material
        .opacity =
          0.040
          + Math.sin(
            time * 2.1 + 2.8
          ) * 0.010;
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
        } else {
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

/* ===== MEMEFLOW_TRUE_3D_CLEAN_V3 ===== */
