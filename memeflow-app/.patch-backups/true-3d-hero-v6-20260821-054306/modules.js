import * as THREE from 'three';

import {
  cloneHardwareAsset
} from './assets.js?v=true-3d-glb-v5';

import {
  chassisMaterial,
  glassMaterial,
  metalDetailMaterial,
  silverMaterial,
  glowPlane,
  labelTexture,
  iconTexture
} from './materials.js?v=true-3d-glb-v5';

const BASE_SIZE = {
  standard: [2.2, 1.5],
  core: [2.8, 1.8],
  terminal: [2.3, 1.5]
};

function variantFor(node) {
  if (node.core) return 'core';
  if (node.decision || node.execution) return 'terminal';
  return 'standard';
}

function styleHardware(root, node, emphasis) {
  root.traverse(object => {
    if (!object.isMesh) return;

    const name = (object.name || '').toLowerCase();

    if (name.includes('base')) {
      object.material = chassisMaterial(node.color, 0, emphasis);
    }

    else if (name.includes('mid')) {
      object.material = chassisMaterial(node.color, 1, emphasis);
    }

    else if (name.includes('top')) {
      object.material = chassisMaterial(node.color, 2, emphasis);
    }

    else if (
      name.includes('glass')
      || name.includes('inset')
    ) {
      object.material = glassMaterial(node.color, emphasis);
    }

    else if (name.includes('post')) {
      object.material = silverMaterial(node.color);
    }

    else {
      object.material = metalDetailMaterial(node.color, emphasis);
    }

    object.castShadow = false;
    object.receiveShadow = false;
  });
}

function makeLed(color, active) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 10, 8),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: active ? 1 : 0.46,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
}

export function createModule(node, assets) {
  const group = new THREE.Group();

  group.name = `MEMEFLOW_NODE_${node.id}`;

  group.position.set(
    node.pos[0],
    0,
    node.pos[2]
  );

  const hardware = new THREE.Group();
  group.add(hardware);

  const emphasis =
    node.core
      ? 1.55
      : node.decision
        ? 1.26
        : node.execution
          ? 1.32
          : 1;

  const variant = variantFor(node);
  const sourceSize = BASE_SIZE[variant];

  const chassis = cloneHardwareAsset(
    assets,
    node
  );

  chassis.name = `GLB_CHASSIS_${node.id}`;

  chassis.scale.set(
    node.size[0] / sourceSize[0],
    1,
    node.size[1] / sourceSize[1]
  );

  styleHardware(
    chassis,
    node,
    emphasis
  );

  hardware.add(chassis);

  const fitObject = chassis;

  const width = node.size[0];
  const depth = node.size[1];

  const icon = new THREE.Mesh(
    new THREE.PlaneGeometry(
      width * 0.58,
      depth * 0.50
    ),
    new THREE.MeshBasicMaterial({
      map: iconTexture(
        node.id,
        node.color
      ),
      transparent: true,
      opacity: node.core ? 0.96 : 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  icon.rotation.x = -Math.PI / 2;
  icon.position.y = 0.125;

  hardware.add(icon);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(
      width * 0.72,
      node.core ? 0.30 : 0.27
    ),
    new THREE.MeshBasicMaterial({
      map: labelTexture(
        node.label,
        node.color
      ),
      transparent: true,
      opacity: 0.98,
      depthWrite: false
    })
  );

  label.position.set(
    0,
    -0.13,
    depth * 0.545
  );

  hardware.add(label);

  const leds = [];

  for (let index = 0; index < 3; index++) {
    const led = makeLed(
      index === 2
        ? node.color
        : index === 1
          ? 0x426d82
          : 0x233d4a,
      index === 2
    );

    led.position.set(
      width * 0.22 + index * 0.095,
      -0.07,
      depth * 0.555
    );

    hardware.add(led);
    leds.push(led);
  }

  const outerGlow = glowPlane(
    width * 1.32,
    depth * 1.38,
    node.color,
    node.core
      ? 0.12
      : node.decision
        ? 0.070
        : node.execution
          ? 0.080
          : 0.026
  );

  outerGlow.position.y = -0.48;
  hardware.add(outerGlow);

  const innerGlow = glowPlane(
    width * 0.94,
    depth * 0.98,
    node.color,
    node.core ? 0.075 : 0.020
  );

  innerGlow.position.y = -0.455;
  hardware.add(innerGlow);

  let rings = null;

  if (node.core) {
    rings = new THREE.Group();
    rings.position.y = 0.145;

    for (const [radius, tube, opacity] of [
      [0.42, 0.012, 0.72],
      [0.68, 0.009, 0.40],
      [0.94, 0.007, 0.16]
    ]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(
          radius,
          tube,
          10,
          64
        ),
        new THREE.MeshBasicMaterial({
          color: node.color,
          transparent: true,
          opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      ring.rotation.x = Math.PI / 2;
      rings.add(ring);
    }

    hardware.add(rings);
  }

  const pickMesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      width,
      0.54,
      depth
    ),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );

  pickMesh.position.y = -0.10;
  pickMesh.userData.nodeId = node.id;

  hardware.add(pickMesh);

  return {
    id: node.id,
    node,
    group,
    hardware,
    fitObject,
    chassis,
    label,
    icon,
    outerGlow,
    innerGlow,
    leds,
    rings,
    pickMesh
  };
}
