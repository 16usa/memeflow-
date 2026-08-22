import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { lineMaterial } from './materials.js';

export function makeRouteCurve(a, b) {
  const pa = new THREE.Vector3(a[0], 0.08, a[2]);
  const pb = new THREE.Vector3(b[0], 0.08, b[2]);
  const dx = Math.abs(pb.x - pa.x);
  const dz = Math.abs(pb.z - pa.z);
  const points = [pa];

  if (dx < 0.2 || dz < 0.2) {
    points.push(pa.clone().lerp(pb, 0.5));
  } else if (dx >= dz) {
    const mx = pa.x + (pb.x - pa.x) * 0.52;
    points.push(new THREE.Vector3(mx, 0.08, pa.z));
    points.push(new THREE.Vector3(mx, 0.08, pb.z));
  } else {
    const mz = pa.z + (pb.z - pa.z) * 0.50;
    points.push(new THREE.Vector3(pa.x, 0.08, mz));
    points.push(new THREE.Vector3(pb.x, 0.08, mz));
  }

  points.push(pb);
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.04);
}

export function createRoute(a, b, color) {
  const curve = makeRouteCurve(a, b);
  const points = curve.getPoints(120);

  const group = new THREE.Group();

  const outer = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 110, 0.085, 10, false),
    lineMaterial(color, 0.08)
  );
  group.add(outer);

  const pipe = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 110, 0.032, 10, false),
    lineMaterial(color, 0.82)
  );
  group.add(pipe);

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  group.add(line);

  const packets = [];
  for (let i = 0; i < 5; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    dot.userData.seed = (i / 5 + Math.random() * 0.2) % 1;
    dot.userData.speed = 0.07 + Math.random() * 0.02;
    group.add(dot);
    packets.push(dot);
  }

  return { group, curve, packets };
}

export function animateRoutes(routes, t) {
  for (const route of routes) {
    for (let i = 0; i < route.packets.length; i++) {
      const p = route.packets[i];
      const tt = (p.userData.seed + t * p.userData.speed) % 1;
      p.position.copy(route.curve.getPointAt(tt));
      const pulse = 0.92 + Math.sin(t * 8 + i * 1.7 + tt * 10) * 0.15;
      p.scale.setScalar(pulse);
      p.material.opacity = 0.65 + pulse * 0.18;
    }
  }
}
