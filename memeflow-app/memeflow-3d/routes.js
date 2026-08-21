import * as THREE from 'three';

import {
  additive,
  lineMaterial
} from './materials.js?v=data-tunnel-page-v1';

function point(node) {
  return new THREE.Vector3(
    node.pos[0],
    node.pos[1] - .42,
    node.pos[2]
  );
}

function routeCurve(aNode, bNode) {
  const a = point(aNode);
  const b = point(bNode);

  const middle =
    a.clone()
      .lerp(b, .5);

  middle.y =
    Math.min(a.y, b.y) - .12;

  return new THREE.CatmullRomCurve3(
    [
      a,
      middle,
      b
    ],
    false,
    'catmullrom',
    .12
  );
}

export function createRoute(
  aNode,
  bNode,
  color
) {
  const curve =
    routeCurve(
      aNode,
      bNode
    );

  const root =
    new THREE.Group();

  const halo =
    new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        48,
        .034,
        8,
        false
      ),
      additive(
        color,
        .07
      )
    );

  root.add(halo);

  const tube =
    new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        48,
        .009,
        8,
        false
      ),
      additive(
        color,
        .48
      )
    );

  root.add(tube);

  const coreLine =
    new THREE.Line(
      new THREE.BufferGeometry()
        .setFromPoints(
          curve.getPoints(80)
        ),
      lineMaterial(
        color,
        .50
      )
    );

  root.add(coreLine);

  const packets = [];

  for (
    let index = 0;
    index < 3;
    index++
  ) {
    const packet =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          .035,
          10,
          8
        ),
        additive(
          0xffffff,
          .86
        )
      );

    packet.userData.seed =
      index / 3;

    packet.userData.speed =
      .055
      + index * .004;

    root.add(packet);

    packets.push(packet);
  }

  return {
    root,
    curve,
    packets,
    color
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

      const scale =
        .78
        + Math.sin(
          time * 6
          + index * 1.7
        ) * .12;

      packet.scale.setScalar(
        scale
      );
    }
  }
}
