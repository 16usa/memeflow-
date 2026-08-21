import * as THREE from 'three';

import {
  conduitMaterial
} from './materials.js?v=true-3d-clean-v3';

function point(nodePos) {
  return new THREE.Vector3(
    nodePos[0],
    0.02,
    nodePos[2]
  );
}

export function makeRouteCurve(
  from,
  to
) {
  const a =
    point(from);

  const b =
    point(to);

  const dx =
    Math.abs(
      b.x - a.x
    );

  const dz =
    Math.abs(
      b.z - a.z
    );

  const points =
    [a];

  if (
    dx < 0.15
    || dz < 0.15
  ) {
    points.push(
      a.clone()
        .lerp(
          b,
          0.5
        )
    );
  }

  else if (
    dx >= dz
  ) {
    const midX =
      a.x
      + (
        b.x - a.x
      ) * 0.52;

    points.push(
      new THREE.Vector3(
        midX,
        0.02,
        a.z
      )
    );

    points.push(
      new THREE.Vector3(
        midX,
        0.02,
        b.z
      )
    );
  }

  else {
    const midZ =
      a.z
      + (
        b.z - a.z
      ) * 0.50;

    points.push(
      new THREE.Vector3(
        a.x,
        0.02,
        midZ
      )
    );

    points.push(
      new THREE.Vector3(
        b.x,
        0.02,
        midZ
      )
    );
  }

  points.push(
    b
  );

  return new THREE.CatmullRomCurve3(
    points,
    false,
    'catmullrom',
    0.025
  );
}

export function createRoute(
  from,
  to,
  color
) {
  const curve =
    makeRouteCurve(
      from,
      to
    );

  const group =
    new THREE.Group();

  const halo =
    new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        80,
        0.055,
        8,
        false
      ),
      conduitMaterial(
        color,
        0.055
      )
    );

  group.add(
    halo
  );

  const pipe =
    new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        80,
        0.017,
        8,
        false
      ),
      conduitMaterial(
        color,
        0.55
      )
    );

  group.add(
    pipe
  );

  const points =
    curve.getPoints(
      100
    );

  const coreLine =
    new THREE.Line(
      new THREE.BufferGeometry()
        .setFromPoints(
          points
        ),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

  group.add(
    coreLine
  );

  const packets = [];

  for (
    let index = 0;
    index < 4;
    index++
  ) {
    const packet =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.034,
          10,
          8
        ),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.86,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

    packet.userData.seed =
      index / 4;

    packet.userData.speed =
      0.050
      + index * 0.003;

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
    packets,
    halo,
    pipe,
    coreLine,
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
        route.curve.getPointAt(
          t
        )
      );

      const pulse =
        0.92
        + Math.sin(
          time * 7.5
          + index * 1.7
          + t * 10
        ) * 0.16;

      packet.scale.setScalar(
        pulse
      );

      packet.material.opacity =
        0.62
        + pulse * 0.20;
    }
  }
}
