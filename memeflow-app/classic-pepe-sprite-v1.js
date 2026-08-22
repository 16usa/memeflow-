import * as THREE from '/vendor/three.module.js';

export function createClassicPepeSpriteV1({
  parent,
  baseUrl = '/game-assets/classic-pepe-jetpack-v4/'
} = {}) {
  if (!parent) {
    throw new Error('[CLASSIC PEPE V4] parent is required');
  }

  const group = new THREE.Group();
  group.name = 'ClassicPepeJetpackV4';
  group.position.set(0, 0, 1.5);
  parent.add(group);

  const loader = new THREE.TextureLoader();
  const disposables = [];
  const textures = {};

  const states = {
    fly: {
      count: 10,
      fps: 10,
      loop: true,
      height: 0.54
    },

    boost: {
      count: 5,
      fps: 12,
      loop: true,
      height: 0.58
    },

    target: {
      count: 5,
      fps: 13,
      loop: false,
      height: 0.61
    },

    cashout: {
      count: 6,
      fps: 10,
      loop: false,
      height: 0.56
    },

    parachute: {
      count: 7,
      fps: 8,
      loop: false,
      height: 1.02
    },

    crash: {
      count: 4,
      fps: 9,
      loop: false,
      height: 0.68
    },

    hover: {
      count: 15,
      fps: 9,
      loop: true,
      height: 0.57
    }
  };

  const aliases = {
    flight: 'fly',
    flying: 'fly',

    ignition: 'boost',
    launch: 'boost',

    targetHit: 'target',
    victory: 'target',

    cashOut: 'cashout',

    stopDeploy: 'parachute',
    parachuting: 'parachute',
    stop: 'parachute',

    reconnect: 'hover',
    reconnecting: 'hover',

    cancelled: 'hover'
  };

  const geometry = new THREE.PlaneGeometry(1, 1);

  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    alphaTest: 0.02,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'ClassicPepeV4Animated';
  mesh.renderOrder = 500;

  group.add(mesh);

  disposables.push(geometry, material);

  let currentState = 'fly';
  let frameIndex = 0;
  let frameClock = 0;
  let visible = true;

  function frameUrl(state, index) {
    const number = String(index + 1).padStart(2, '0');

    return (
      baseUrl +
      state +
      '/' +
      state +
      '_' +
      number +
      '.png?v=4'
    );
  }

  function applyTexture(texture) {
    if (!texture) return;

    material.map = texture;
    material.needsUpdate = true;
  }

  function applyScale() {
    const config = states[currentState];
    const h = config?.height ?? 0.56;

    mesh.scale.set(h, h, 1);
  }

  function showFrame(index) {
    const list = textures[currentState];

    if (!list || !list.length) return;

    const safeIndex = Math.max(
      0,
      Math.min(index, list.length - 1)
    );

    frameIndex = safeIndex;

    applyTexture(list[safeIndex]);
  }

  function loadState(state) {
    const config = states[state];
    textures[state] = new Array(config.count);

    for (let i = 0; i < config.count; i += 1) {
      loader.load(
        frameUrl(state, i),

        texture => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;

          textures[state][i] = texture;
          disposables.push(texture);

          if (
            state === currentState &&
            i === frameIndex
          ) {
            applyTexture(texture);
          }
        },

        undefined,

        error => {
          console.error(
            `[CLASSIC PEPE V4] Failed: ${state} frame ${i + 1}`,
            error
          );
        }
      );
    }
  }

  Object.keys(states).forEach(loadState);

  function normalizeState(name) {
    if (states[name]) return name;
    if (aliases[name]) return aliases[name];

    return 'fly';
  }

  function setState(name) {
    const next = normalizeState(name);

    if (next === currentState) return;

    currentState = next;
    frameIndex = 0;
    frameClock = 0;

    applyScale();
    showFrame(0);
  }

  function setVisible(value) {
    visible = Boolean(value);
    group.visible = visible;
  }

  function update(dt = 0.016) {
    if (!visible) return;

    const config = states[currentState];
    if (!config) return;

    frameClock += Math.max(0, dt);

    const frameDuration = 1 / config.fps;

    while (frameClock >= frameDuration) {
      frameClock -= frameDuration;

      let next = frameIndex + 1;

      if (next >= config.count) {
        next = config.loop
          ? 0
          : config.count - 1;
      }

      if (next === frameIndex && !config.loop) {
        break;
      }

      showFrame(next);
    }

    if (currentState === 'hover') {
      group.position.y =
        Math.sin(performance.now() * 0.004) * 0.018;
    } else {
      group.position.y =
        THREE.MathUtils.lerp(
          group.position.y,
          0,
          1 - Math.exp(-dt * 8)
        );
    }
  }

  function destroy() {
    group.removeFromParent();

    for (const item of disposables) {
      item.dispose?.();
    }
  }

  applyScale();

  const sprites = {
    fly: mesh,
    boost: mesh,
    target: mesh,
    cashout: mesh,
    parachute: mesh,
    crash: mesh,
    hover: mesh
  };

  return {
    group,
    sprites,
    setState,
    setVisible,
    update,
    destroy,

    get state() {
      return currentState;
    }
  };
}
