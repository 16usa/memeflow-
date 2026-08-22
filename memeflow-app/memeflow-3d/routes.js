import * as THREE from 'three';

import {
  accentMaterial,
  lineMaterial
} from './materials.js?v=neon-pcb-scene-v1';

function nodePoint(node) {
  return new THREE.Vector3(
    node.pos[0],
    0.08,
    node.pos[2]
  );
}

function makeOrthogonalCurve(aNode, bNode) {
  const a =
    nodePoint(aNode);

  const b =
    nodePoint(bNode);

  const path =
    new THREE.CurvePath();

  const dx =
    Math.abs(b.x - a.x);

  const dz =
    Math.abs(b.z - a.z);

  if (
    dx < 0.35
    || dz < 0.35
  ) {
    path.add(
      new THREE.LineCurve3(
        a,
        b
      )
    );

    return path;
  }

  const useHorizontalFirst =
    dx > dz;

  const turn =
    useHorizontalFirst
      ? new THREE.Vector3(
          b.x,
          a.y,
          a.z
        )
      : new THREE.Vector3(
          a.x,
          a.y,
          b.z
        );

  path.add(
    new THREE.LineCurve3(
      a,
      turn
    )
  );

  path.add(
    new THREE.LineCurve3(
      turn,
      b
    )
  );

  return path;
}

export function createRoute(
  aNode,
  bNode,
  color
) {
  const curve =
    makeOrthogonalCurve(
      aNode,
      bNode
    );

  const group =
    new THREE.Group();

  const halo =
    new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        48,
        0.035,
        6,
        false
      ),
      accentMaterial(
        color,
        0.08
      )
    );

  group.add(
    halo
  );

  const tube =
    new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        48,
        0.010,
        6,
        false
      ),
      accentMaterial(
        color,
        0.72
      )
    );

  group.add(
    tube
  );

  const line =
    new THREE.Line(
      new THREE.BufferGeometry()
        .setFromPoints(
          curve.getPoints(90)
        ),
      lineMaterial(
        color,
        0.72
      )
    );

  group.add(
    line
  );

  const packets = [];

  for (
    let index = 0;
    index < 4;
    index++
  ) {
    const packet =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.060,
          0.042,
          0.060
        ),
        accentMaterial(
          index % 2 === 0
            ? 0xffffff
            : color,
          0.98
        )
      );

    packet.userData.seed =
      index / 4;

    packet.userData.speed =
      0.045
      + index * 0.0035;

    group.add(
      packet
    );

    packets.push(
      packet
    );
  }

  return {
    group,
    curve,
    packets
  };
}

export function animateRoutes(
  routes,
  time
) {
  for (
    const route
    of routes
  ) {
    for (
      let index = 0;
      index < route.packets.length;
      index++
    ) {
      const packet =
        route.packets[index];

      const t =
        (
          packet.userData.seed
          + time * packet.userData.speed
        ) % 1;

      packet.position.copy(
        route.curve.getPointAt(t)
      );

      packet.position.y +=
        0.035;

      const pulse =
        0.78
        + Math.sin(
          time * 9
          + index * 1.4
        ) * 0.16;

      packet.scale.setScalar(
        pulse
      );
    }
  }
}
