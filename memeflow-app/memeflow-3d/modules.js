import * as THREE from 'three';

import {
  RoundedBoxGeometry
} from 'three/addons/geometries/RoundedBoxGeometry.js';

import {
  cloneHardwareAsset
} from './assets.js?v=true-3d-glb-v5';

import {
  metalMaterial,
  darkMetal,
  glassMaterial,
  additive,
  textTexture,
  iconTexture
} from './materials.js?v=data-tunnel-page-v1';

function frameBar(w, h, d, material) {
  return new THREE.Mesh(
    new RoundedBoxGeometry(
      w,
      h,
      d,
      3,
      Math.min(w, h, d) * .18
    ),
    material
  );
}

function addCornerBolts(group, width, height, z, color) {
  const material =
    new THREE.MeshStandardMaterial({
      color: 0x8fa1aa,
      emissive: color,
      emissiveIntensity: .025,
      metalness: .95,
      roughness: .15
    });

  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      const bolt =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            .035,
            .035,
            .022,
            12
          ),
          material
        );

      bolt.rotation.x =
        Math.PI / 2;

      bolt.position.set(
        x * width * .43,
        y * height * .43,
        z
      );

      group.add(bolt);
    }
  }
}

function addInnerHardware(
  group,
  assets,
  node,
  width,
  height,
  frontZ
) {
  if (!assets) return;

  try {
    const inner =
      cloneHardwareAsset(
        assets,
        node
      );

    inner.name =
      `INNER_GLB_${node.id}`;

    inner.rotation.x =
      Math.PI / 2;

    inner.rotation.z =
      Math.PI / 2;

    const scale =
      Math.min(
        width * .19,
        height * .095
      );

    inner.scale.setScalar(scale);

    inner.position.set(
      0,
      .06,
      frontZ - .11
    );

    inner.traverse(object => {
      if (!object.isMesh) return;

      object.material =
        object.material?.clone?.()
        || darkMetal();

      if (
        object.material
        && 'transparent' in object.material
      ) {
        object.material.transparent =
          true;

        object.material.opacity =
          .35;
      }
    });

    group.add(inner);
  }

  catch (error) {
    console.warn(
      '[DATA-TUNNEL] inner GLB skipped',
      node.id,
      error
    );
  }
}

export function createTunnelModule(node, assets) {
  const root =
    new THREE.Group();

  root.name =
    `MEMEFLOW_TUNNEL_NODE_${node.id}`;

  root.position.set(
    node.pos[0],
    node.pos[1],
    node.pos[2]
  );

  const [
    width,
    height,
    depth
  ] = node.size;

  const chassis =
    new THREE.Mesh(
      new RoundedBoxGeometry(
        width,
        height,
        depth,
        5,
        .12
      ),
      metalMaterial(
        node.color,
        node.core ? .08 : .025
      )
    );

  root.add(chassis);

  const frameMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x10191f,
      emissive: node.color,
      emissiveIntensity:
        node.execution
          ? .07
          : node.core
            ? .07
            : .025,
      metalness: .92,
      roughness: .18
    });

  const frontZ =
    depth / 2 + .022;

  const railW =
    Math.max(.09, width * .075);

  const railH =
    Math.max(.09, height * .045);

  const leftRail =
    frameBar(
      railW,
      height * .92,
      .075,
      frameMaterial
    );

  leftRail.position.set(
    -width * .46,
    0,
    frontZ
  );

  root.add(leftRail);

  const rightRail =
    leftRail.clone();

  rightRail.position.x =
    width * .46;

  root.add(rightRail);

  const topRail =
    frameBar(
      width * .92,
      railH,
      .075,
      frameMaterial
    );

  topRail.position.set(
    0,
    height * .46,
    frontZ
  );

  root.add(topRail);

  const bottomRail =
    topRail.clone();

  bottomRail.position.y =
    -height * .46;

  root.add(bottomRail);

  const glass =
    new THREE.Mesh(
      new RoundedBoxGeometry(
        width * .78,
        height * .62,
        .06,
        4,
        .06
      ),
      glassMaterial(
        node.color
      )
    );

  glass.position.set(
    0,
    height * .08,
    frontZ + .018
  );

  root.add(glass);

  addInnerHardware(
    root,
    assets,
    node,
    width,
    height,
    frontZ
  );

  const icon =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * .50,
        width * .50
      ),
      new THREE.MeshBasicMaterial({
        map: iconTexture(
          node.id,
          node.color
        ),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

  icon.position.set(
    0,
    height * .10,
    frontZ + .07
  );

  root.add(icon);

  const label =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * .86,
        Math.min(.38, height * .12)
      ),
      new THREE.MeshBasicMaterial({
        map: textTexture(
          node.label,
          node.color,
          {
            width: 1200,
            height: 240,
            fontSize:
              node.label.length > 12
                ? 63
                : 76,
            border: false,
            glow: 5
          }
        ),
        transparent: true,
        depthWrite: false
      })
    );

  label.position.set(
    0,
    -height * .32,
    frontZ + .074
  );

  root.add(label);

  const accent =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        .055,
        height * .54,
        .035
      ),
      additive(
        node.color,
        node.execution
          ? .95
          : .62
      )
    );

  accent.position.set(
    -width * .40,
    height * .05,
    frontZ + .09
  );

  root.add(accent);

  addCornerBolts(
    root,
    width,
    height,
    frontZ + .08,
    node.color
  );

  const pickMesh =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        depth + .16
      ),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );

  pickMesh.userData.nodeId =
    node.id;

  root.add(pickMesh);

  let halo = null;

  if (node.core) {
    halo =
      new THREE.Group();

    halo.position.z =
      frontZ + .13;

    for (
      const [radius, opacity]
      of [
        [.34, .80],
        [.55, .44],
        [.78, .18]
      ]
    ) {
      const ring =
        new THREE.Mesh(
          new THREE.TorusGeometry(
            radius,
            .012,
            10,
            64
          ),
          additive(
            node.color,
            opacity
          )
        );

      halo.add(ring);
    }

    root.add(halo);
  }

  return {
    root,
    node,
    chassis,
    glass,
    icon,
    label,
    pickMesh,
    halo
  };
}
