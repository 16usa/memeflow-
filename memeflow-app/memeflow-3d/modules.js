import * as THREE from 'three';
import {
  RoundedBoxGeometry
} from 'three/addons/geometries/RoundedBoxGeometry.js';

import {
  chassisMaterial,
  glassMaterial,
  edgeMaterial,
  glowPlane,
  labelTexture,
  iconTexture
} from './materials.js?v=true-3d-clean-v3';

function makeFastener(color) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.034,
      0.034,
      0.024,
      12
    ),
    new THREE.MeshStandardMaterial({
      color: 0x9db0bb,
      emissive: color,
      emissiveIntensity: 0.12,
      metalness: 0.92,
      roughness: 0.20
    })
  );
}

function makeLed(color, active) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(
      0.031,
      10,
      8
    ),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: active ? 1 : 0.52,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
}

export function createModule(node) {
  const group =
    new THREE.Group();

  group.name =
    `MEMEFLOW_NODE_${node.id}`;

  group.position.set(
    node.pos[0],
    0,
    node.pos[2]
  );

  const hardware =
    new THREE.Group();

  group.add(hardware);

  const fitObject =
    new THREE.Group();

  hardware.add(fitObject);

  const [width, depth] =
    node.size;

  const emphasis =
    node.core
      ? 1.65
      : node.decision
        ? 1.30
        : node.execution
          ? 1.36
          : 1;

  const radius =
    node.core
      ? 0.19
      : 0.15;

  const tiers = [
    {
      w: 1.10,
      d: 1.10,
      h: 0.15,
      y: -0.39
    },
    {
      w: 1.055,
      d: 1.055,
      h: 0.15,
      y: -0.245
    },
    {
      w: 1.00,
      d: 1.00,
      h: 0.18,
      y: -0.08
    }
  ];

  for (
    let index = 0;
    index < tiers.length;
    index++
  ) {
    const tier =
      tiers[index];

    const geometry =
      new RoundedBoxGeometry(
        width * tier.w,
        tier.h,
        depth * tier.d,
        4,
        radius
      );

    const mesh =
      new THREE.Mesh(
        geometry,
        chassisMaterial(
          node.color,
          index,
          emphasis
        )
      );

    mesh.position.y =
      tier.y;

    fitObject.add(mesh);

    const edges =
      new THREE.LineSegments(
        new THREE.EdgesGeometry(
          geometry,
          22
        ),
        edgeMaterial(
          node.color,
          index === 2
            ? 0.62 * emphasis
            : 0.14 + index * 0.08
        )
      );

    edges.position.copy(
      mesh.position
    );

    hardware.add(edges);
  }

  const glassGeometry =
    new RoundedBoxGeometry(
      width * 0.92,
      0.075,
      depth * 0.84,
      4,
      radius * 0.78
    );

  const glass =
    new THREE.Mesh(
      glassGeometry,
      glassMaterial(
        node.color,
        emphasis
      )
    );

  glass.position.y =
    0.07;

  fitObject.add(glass);

  const glassEdges =
    new THREE.LineSegments(
      new THREE.EdgesGeometry(
        glassGeometry,
        20
      ),
      edgeMaterial(
        node.color,
        Math.min(
          1,
          0.54 * emphasis
        )
      )
    );

  glassEdges.position.copy(
    glass.position
  );

  hardware.add(glassEdges);

  const icon =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * 0.66,
        depth * 0.57
      ),
      new THREE.MeshBasicMaterial({
        map: iconTexture(
          node.id,
          node.color
        ),
        transparent: true,
        opacity: node.core ? 0.98 : 0.86,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

  icon.rotation.x =
    -Math.PI / 2;

  icon.position.y =
    0.117;

  hardware.add(icon);

  const label =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * 0.78,
        node.core ? 0.33 : 0.29
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
    -0.105,
    depth * 0.505
  );

  hardware.add(label);

  const fastenerX =
    width * 0.39;

  const fastenerZ =
    depth * 0.35;

  for (
    const x
    of [-fastenerX, fastenerX]
  ) {
    for (
      const z
      of [-fastenerZ, fastenerZ]
    ) {
      const fastener =
        makeFastener(
          node.color
        );

      fastener.position.set(
        x,
        0.12,
        z
      );

      hardware.add(
        fastener
      );
    }
  }

  const leds = [];

  for (
    let index = 0;
    index < 3;
    index++
  ) {
    const led =
      makeLed(
        index === 2
          ? node.color
          : index === 1
            ? 0x4c7b92
            : 0x284452,
        index === 2
      );

    led.position.set(
      width * 0.24
        + index * 0.105,
      -0.03,
      depth * 0.535
    );

    hardware.add(led);
    leds.push(led);
  }

  const outerGlow =
    glowPlane(
      width * 1.42,
      depth * 1.48,
      node.color,
      node.core
        ? 0.16
        : node.decision
          ? 0.10
          : node.execution
            ? 0.11
            : 0.045
    );

  outerGlow.position.y =
    -0.50;

  hardware.add(
    outerGlow
  );

  const innerGlow =
    glowPlane(
      width * 0.98,
      depth * 1.02,
      node.color,
      node.core
        ? 0.10
        : 0.035
    );

  innerGlow.position.y =
    -0.47;

  hardware.add(
    innerGlow
  );

  let rings = null;

  if (node.core) {
    rings =
      new THREE.Group();

    rings.position.y =
      0.125;

    for (
      const [radiusValue, tube, opacity]
      of [
        [0.45, 0.014, 0.80],
        [0.70, 0.010, 0.46],
        [0.96, 0.008, 0.20]
      ]
    ) {
      const ring =
        new THREE.Mesh(
          new THREE.TorusGeometry(
            radiusValue,
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

      ring.rotation.x =
        Math.PI / 2;

      rings.add(
        ring
      );
    }

    hardware.add(
      rings
    );
  }

  const pickMesh =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        0.52,
        depth
      ),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );

  pickMesh.position.y =
    -0.12;

  pickMesh.userData.nodeId =
    node.id;

  hardware.add(
    pickMesh
  );

  return {
    id: node.id,
    node,
    group,
    hardware,
    fitObject,
    label,
    icon,
    outerGlow,
    innerGlow,
    leds,
    rings,
    pickMesh
  };
}
