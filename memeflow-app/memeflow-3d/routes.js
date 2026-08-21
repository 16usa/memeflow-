import * as THREE from 'three';

function routePoint(nodePos) {
  return new THREE.Vector3(
    nodePos[0],
    -0.22,
    nodePos[2]
  );
}

function routeCurve(from, to) {
  const a = routePoint(from);
  const b = routePoint(to);

  const dx = Math.abs(b.x - a.x);
  const dz = Math.abs(b.z - a.z);

  const points = [a];

  if (dx < 0.15 || dz < 0.15) {
    points.push(
      a.clone().lerp(b, 0.5)
    );
  }

  else if (dx >= dz) {
    const mx =
      a.x
      + (b.x - a.x) * 0.52;

    points.push(
      new THREE.Vector3(
        mx,
        -0.22,
        a.z
      ),
      new THREE.Vector3(
        mx,
        -0.22,
        b.z
      )
    );
  }

  else {
    const mz =
      a.z
      + (b.z - a.z) * 0.50;

    points.push(
      new THREE.Vector3(
        a.x,
        -0.22,
        mz
      ),
      new THREE.Vector3(
        b.x,
        -0.22,
        mz
      )
    );
  }

  points.push(b);

  return new THREE.CatmullRomCurve3(
    points,
    false,
    'catmullrom',
    0.022
  );
}

function additive(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function port(color, point) {
  const group = new THREE.Group();

  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.075,
      0.075,
      0.028,
      18
    ),
    new THREE.MeshStandardMaterial({
      color: 0x08131a,
      emissive: color,
      emissiveIntensity: 0.26,
      metalness: 0.86,
      roughness: 0.18
    })
  );

  outer.position.copy(point);
  outer.position.y = -0.18;

  group.add(outer);

  const light = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.030,
      10,
      8
    ),
    additive(color, 0.86)
  );

  light.position.copy(point);
  light.position.y = -0.145;

  group.add(light);

  return group;
}

export function createRoute(from, to, color) {
  const curve = routeCurve(from, to);

  const group = new THREE.Group();

  const outer = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      84,
      0.042,
      8,
      false
    ),
    additive(color, 0.040)
  );

  group.add(outer);

  const rail = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      84,
      0.013,
      8,
      false
    ),
    additive(color, 0.42)
  );

  group.add(rail);

  const coreLine = new THREE.Line(
    new THREE.BufferGeometry()
      .setFromPoints(
        curve.getPoints(100)
      ),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.67,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  group.add(coreLine);

  group.add(
    port(color, curve.getPointAt(0.015)),
    port(color, curve.getPointAt(0.985))
  );

  const packets = [];

  for (let index = 0; index < 3; index++) {
    const packetGroup = new THREE.Group();

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.030,
        10,
        8
      ),
      additive(0xffffff, 0.92)
    );

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.065,
        10,
        8
      ),
      additive(color, 0.10)
    );

    packetGroup.add(core, halo);

    packetGroup.userData.seed =
      index / 3;

    packetGroup.userData.speed =
      0.040 + index * 0.003;

    group.add(packetGroup);
    packets.push(packetGroup);
  }

  return {
    group,
    curve,
    packets,
    color
  };
}

export function animateRoutes(routes, time) {
  for (const route of routes) {
    for (
      let index = 0;
      index < route.packets.length;
      index++
    ) {
      const packet = route.packets[index];

      const t =
        (
          packet.userData.seed
          + time * packet.userData.speed
        ) % 1;

      packet.position.copy(
        route.curve.getPointAt(t)
      );

      const pulse =
        0.90
        + Math.sin(
          time * 6.8
          + index * 1.8
          + t * 9
        ) * 0.12;

      packet.scale.setScalar(pulse);
    }
  }
}
