import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { RoundedBoxGeometry } from 'https://unpkg.com/three@0.166.1/examples/jsm/geometries/RoundedBoxGeometry.js';
import { glowPlane, shellMaterial, edgeMaterial, labelTexture, iconTexture } from './materials.js';

const ICONS = {
  discovery: '⌕',
  bootstrap: '⚡',
  core: '◎',
  risk: '🛡',
  market: '↗',
  holders: '◌',
  openai: '✦',
  decision: '◍',
  paper: '▣',
  execution: '◉'
};

export function createModule(node) {
  const group = new THREE.Group();
  group.position.set(node.pos[0], 0, node.pos[2]);

  const [w, d] = node.size;
  const tiers = [
    { ww: 1.12, dd: 1.12, h: 0.18, y: -0.44 },
    { ww: 1.06, dd: 1.06, h: 0.18, y: -0.26 },
    { ww: 1.00, dd: 1.00, h: 0.22, y: -0.06 }
  ];

  const hardware = new THREE.Group();
  const parts = { group, hardware };

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const g = new RoundedBoxGeometry(w * t.ww, t.h, d * t.dd, 4, node.core ? 0.20 : 0.16);
    const body = new THREE.Mesh(g, shellMaterial(node.color, i === 2));
    body.position.y = t.y;
    hardware.add(body);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(g, 20),
      edgeMaterial(node.color, i === 2 ? 0.9 : 0.35 + i * 0.12)
    );
    edges.position.copy(body.position);
    hardware.add(edges);
  }

  const glassGeo = new RoundedBoxGeometry(w * 0.94, 0.09, d * 0.88, 4, node.core ? 0.18 : 0.14);
  const glass = new THREE.Mesh(glassGeo, shellMaterial(node.color, true));
  glass.position.y = 0.10;
  hardware.add(glass);

  const glassEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(glassGeo, 20),
    edgeMaterial(node.color, node.core ? 1.0 : 0.8)
  );
  glassEdges.position.copy(glass.position);
  hardware.add(glassEdges);

  const icon = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.70, d * 0.56),
    new THREE.MeshBasicMaterial({
      map: iconTexture(ICONS[node.id] || '•', node.color),
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  icon.rotation.x = -Math.PI / 2;
  icon.position.y = 0.18;
  hardware.add(icon);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.78, node.core ? 0.40 : 0.34),
    new THREE.MeshBasicMaterial({
      map: labelTexture(node.label, node.color),
      transparent: true,
      opacity: 1,
      depthWrite: false
    })
  );
  label.position.set(0, -0.10, d * 0.51);
  hardware.add(label);

  const glow = glowPlane(
    w * 1.7,
    d * 1.8,
    node.color,
    node.core ? 0.30 : node.decision || node.execution ? 0.22 : 0.12
  );
  glow.position.y = -0.58;
  hardware.add(glow);

  const inner = glowPlane(
    w * 1.18,
    d * 1.22,
    node.color,
    node.core ? 0.18 : 0.08
  );
  inner.position.y = -0.54;
  hardware.add(inner);

  if (node.core) {
    const rings = new THREE.Group();
    rings.position.y = 0.18;
    for (const [r, t, o] of [[0.70, 0.02, 0.9], [0.92, 0.015, 0.55], [1.16, 0.012, 0.24]]) {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(r, t, 12, 72),
        new THREE.MeshBasicMaterial({
          color: node.color,
          transparent: true,
          opacity: o,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      torus.rotation.x = Math.PI / 2;
      rings.add(torus);
    }
    hardware.add(rings);
    parts.rings = rings;
  }

  group.add(hardware);
  parts.label = label;
  parts.glow = glow;
  parts.inner = inner;
  return parts;
}
