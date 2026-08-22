import * as THREE from 'three';

import {
  RoundedBoxGeometry
} from 'three/addons/geometries/RoundedBoxGeometry.js';

import {
  chassisMaterial,
  topGlassMaterial,
  accentMaterial,
  createLabelTexture,
  createIconTexture
} from './materials.js?v=neon-pcb-scene-v1';

function makeRoundedBox(
  width,
  height,
  depth,
  radius,
  material
) {
  return new THREE.Mesh(
    new RoundedBoxGeometry(
      width,
      height,
      depth,
      4,
      radius
    ),
    material
  );
}

function addCornerScrews(
  group,
  width,
  depth,
  y,
  color
) {
  const material =
    new THREE.MeshStandardMaterial({
      color: 0x8aa1ad,
      emissive: color,
      emissiveIntensity: 0.025,
      metalness: 0.98,
      roughness: 0.14
    });

  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const screw =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.045,
            0.045,
            0.026,
            12
          ),
          material
        );

      screw.position.set(
        xSign * width * 0.41,
        y,
        zSign * depth * 0.39
      );

      group.add(screw);
    }
  }
}

function addGlowFrame(
  group,
  width,
  depth,
  y,
  color,
  emphasis
) {
  const barMaterial =
    accentMaterial(
      color,
      0.48 * emphasis
    );

  const thickness = 0.028;
  const lift = 0.012;

  const front =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width * 0.83,
        thickness,
        thickness
      ),
      barMaterial
    );

  front.position.set(
    0,
    y + lift,
    depth * 0.40
  );

  const back =
    front.clone();

  back.position.z =
    -depth * 0.40;

  const side =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        thickness,
        thickness,
        depth * 0.80
      ),
      barMaterial
    );

  side.position.set(
    width * 0.42,
    y + lift,
    0
  );

  const side2 =
    side.clone();

  side2.position.x =
    -width * 0.42;

  group.add(
    front,
    back,
    side,
    side2
  );
}

export function createModule(node) {
  const group =
    new THREE.Group();

  group.name =
    `MEMEFLOW_NEON_NODE_${node.id}`;

  group.position.set(
    node.pos[0],
    node.pos[1],
    node.pos[2]
  );

  const width =
    node.size[0];

  const depth =
    node.size[1];

  const emphasis =
    Number(node.emphasis) || 1;

  // Deep floating shadow slab.
  const shadow =
    makeRoundedBox(
      width * 1.07,
      0.15,
      depth * 1.08,
      0.12,
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.72
      })
    );

  shadow.position.y =
    -0.23;

  group.add(shadow);

  // Layer 1.
  const base =
    makeRoundedBox(
      width,
      0.30,
      depth,
      0.13,
      chassisMaterial(
        node.color,
        0,
        emphasis
      )
    );

  base.position.y =
    -0.04;

  group.add(base);

  // Layer 2 gives the thick expensive hardware profile.
  const mid =
    makeRoundedBox(
      width * 0.95,
      0.19,
      depth * 0.95,
      0.11,
      chassisMaterial(
        node.color,
        1,
        emphasis
      )
    );

  mid.position.y =
    0.15;

  group.add(mid);

  // Main top chassis.
  const top =
    makeRoundedBox(
      width * 0.90,
      0.16,
      depth * 0.90,
      0.10,
      chassisMaterial(
        node.color,
        3,
        emphasis
      )
    );

  top.position.y =
    0.31;

  group.add(top);

  // Inset top glass.
  const glass =
    makeRoundedBox(
      width * 0.78,
      0.045,
      depth * 0.69,
      0.07,
      topGlassMaterial(
        node.color,
        emphasis
      )
    );

  glass.position.y =
    0.415;

  group.add(glass);

  addGlowFrame(
    group,
    width,
    depth,
    0.43,
    node.color,
    emphasis
  );

  addCornerScrews(
    group,
    width,
    depth,
    0.455,
    node.color
  );

  // Top icon.
  const icon =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * 0.46,
        depth * 0.46
      ),
      new THREE.MeshBasicMaterial({
        map: createIconTexture(
          node.icon || node.id,
          node.color
        ),
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

  icon.rotation.x =
    -Math.PI / 2;

  icon.position.y =
    0.449;

  group.add(icon);

  // Front label plate.
  const label =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * 0.79,
        node.compact ? 0.25 : 0.29
      ),
      new THREE.MeshBasicMaterial({
        map: createLabelTexture(
          node.label,
          node.color
        ),
        transparent: true,
        depthWrite: false
      })
    );

  label.position.set(
    0,
    0.07,
    depth * 0.505
  );

  group.add(label);

  // Tiny side LEDs.
  for (let index = 0; index < 4; index++) {
    const led =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.06,
          0.025,
          0.025
        ),
        accentMaterial(
          index === 3
            ? node.color
            : 0x2a5166,
          index === 3
            ? 0.88
            : 0.26
        )
      );

    led.position.set(
      width * 0.18
        + index * 0.10,
      -0.005,
      depth * 0.512
    );

    group.add(led);
  }

  // Invisible pick volume.
  const pickMesh =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        0.85,
        depth
      ),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );

  pickMesh.position.y =
    0.12;

  pickMesh.userData.nodeId =
    node.id;

  group.add(
    pickMesh
  );

  return {
    id: node.id,
    node,
    group,
    base,
    mid,
    top,
    glass,
    icon,
    label,
    pickMesh
  };
}
