#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_TRUE_3D_LAB_V1"
STAMP = time.strftime("%Y%m%d-%H%M%S")

FILES = {
    "memeflow-3d/layout.js": r"""
export const NODES = [
  { id: 'discovery',  label: 'DISCOVERY',        color: 0x2b59ff, pos: [-4.2,  0.0, -3.8], size: [2.15, 1.45] },
  { id: 'bootstrap',  label: 'FAST BOOTSTRAP',  color: 0x2b59ff, pos: [ 0.0,  0.0, -3.8], size: [2.40, 1.45] },
  { id: 'core',       label: 'MEMEFLOW CORE',   color: 0x65f0a5, pos: [ 4.2,  0.0, -3.8], size: [3.15, 2.05], core: true },
  { id: 'risk',       label: 'RISK ENGINE',     color: 0x53cfff, pos: [-4.2,  0.0, -0.6], size: [2.20, 1.45] },
  { id: 'market',     label: 'MARKET LEDGER',   color: 0x3579ff, pos: [ 0.0,  0.0, -0.6], size: [2.25, 1.45] },
  { id: 'holders',    label: 'HOLDER LEDGER',   color: 0x53cfff, pos: [ 4.2,  0.0, -0.6], size: [2.20, 1.45] },
  { id: 'openai',     label: 'OPENAI ASSISTANT',color: 0x53cfff, pos: [-4.2,  0.0,  2.5], size: [2.35, 1.45] },
  { id: 'decision',   label: 'DECISION',        color: 0x8c52ff, pos: [ 0.0,  0.0,  2.5], size: [2.05, 1.45], decision: true },
  { id: 'paper',      label: 'PAPER ENGINE',    color: 0x2b59ff, pos: [ 4.2,  0.0,  2.5], size: [2.20, 1.45] },
  { id: 'execution',  label: 'LIVE EXECUTION',  color: 0x47e28c, pos: [ 0.0,  0.0,  5.6], size: [2.25, 1.45], execution: true }
];

export const ROUTES = [
  ['discovery', 'bootstrap', 0x7bdfff],
  ['bootstrap', 'core', 0x7bdfff],
  ['core', 'risk', 0x7bdfff],
  ['risk', 'market', 0x7bdfff],
  ['market', 'holders', 0x7bdfff],
  ['risk', 'openai', 0xc486ff],
  ['openai', 'decision', 0x7bdfff],
  ['market', 'decision', 0x7bdfff],
  ['holders', 'core', 0x7bdfff],
  ['decision', 'paper', 0xb48cff],
  ['paper', 'execution', 0x7affaa],
];
""",

    "memeflow-3d/materials.js": r"""
import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

export function roundedGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
  g.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.50)');
  g.addColorStop(0.48, 'rgba(255,255,255,0.16)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const GLOW_TEXTURE = roundedGlowTexture();

export function glowPlane(width, depth, color, opacity=0.2) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: GLOW_TEXTURE,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  plane.rotation.x = -Math.PI / 2;
  return plane;
}

export function shellMaterial(color, top=false) {
  return new THREE.MeshPhysicalMaterial({
    color: top ? 0x071622 : 0x04090d,
    emissive: color,
    emissiveIntensity: top ? 0.28 : 0.08,
    metalness: top ? 0.28 : 0.62,
    roughness: top ? 0.14 : 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: top ? 0.76 : 0.98
  });
}

export function edgeMaterial(color, opacity=0.75) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function lineMaterial(color, opacity=0.85) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function labelTexture(text, accent) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 220;
  const ctx = c.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, 220);
  bg.addColorStop(0, 'rgba(7,12,18,0.98)');
  bg.addColorStop(1, 'rgba(2,5,8,0.98)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 220);

  ctx.strokeStyle = '#' + accent.toString(16).padStart(6, '0');
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.9;
  ctx.strokeRect(8, 8, 1008, 204);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#f4f8fb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#' + accent.toString(16).padStart(6, '0');
  ctx.shadowBlur = 18;
  const fontSize = text.length > 14 ? 58 : text.length > 11 ? 66 : 74;
  ctx.font = `800 ${fontSize}px Arial`;
  ctx.fillText(text, 512, 110);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function iconTexture(symbol, accent) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  ctx.strokeStyle = '#' + accent.toString(16).padStart(6, '0');
  ctx.lineWidth = 12;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(256, 230, 100, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#eef7ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#' + accent.toString(16).padStart(6, '0');
  ctx.shadowBlur = 20;
  ctx.font = '700 140px Arial';
  ctx.fillText(symbol, 256, 235);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
""",

    "memeflow-3d/modules.js": r"""
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
""",

    "memeflow-3d/routes.js": r"""
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
""",

    "memeflow-3d/scene.js": r"""
import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.166.1/examples/jsm/controls/OrbitControls.js';
import { NODES, ROUTES } from './layout.js';
import { createModule } from './modules.js';
import { createRoute, animateRoutes } from './routes.js';

export function bootMemeflowTrue3D(rootId='app') {
  const mount = document.getElementById(rootId);
  if (!mount) throw new Error('Mount element not found: ' + rootId);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.id = 'memeflowTrue3DCanvas';
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.58;
  controls.zoomSpeed = 1.06;
  controls.minDistance = 5.5;
  controls.maxDistance = 24;
  controls.minPolarAngle = 0.34;
  controls.maxPolarAngle = Math.PI / 2.05;

  const ambient = new THREE.AmbientLight(0x9ec6ff, 0.50);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.10);
  key.position.set(5, 10, 4);
  scene.add(key);

  const rim = new THREE.PointLight(0x7deaff, 15, 30, 2);
  rim.position.set(-8, 4, 8);
  scene.add(rim);

  const green = new THREE.PointLight(0x65f0a5, 14, 24, 2);
  green.position.set(4.5, 4, -3.8);
  scene.add(green);

  const floorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 24),
    new THREE.MeshBasicMaterial({
      color: 0x08111a,
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = -1.30;
  scene.add(floorGlow);

  const modules = new Map();
  for (const node of NODES) {
    const built = createModule(node);
    scene.add(built.group);
    modules.set(node.id, built);
  }

  const routes = [];
  for (const [from, to, color] of ROUTES) {
    const a = NODES.find(n => n.id === from);
    const b = NODES.find(n => n.id === to);
    const built = createRoute(a.pos, b.pos, color);
    scene.add(built.group);
    routes.push(built);
  }

  const homeCam = new THREE.Vector3(0, 10.8, 6.6);
  const homeTarget = new THREE.Vector3(0, 0.05, 0.2);

  function resetView() {
    camera.position.copy(homeCam);
    controls.target.copy(homeTarget);
    controls.update();
  }

  function resize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const resetButton = document.getElementById('resetView');
  if (resetButton) resetButton.addEventListener('click', resetView);

  resetView();
  resize();
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    const core = modules.get('core');
    const decision = modules.get('decision');
    const execution = modules.get('execution');

    if (core?.rings) core.rings.rotation.y += 0.0025;
    if (core?.inner?.material) core.inner.material.opacity = 0.19 + Math.sin(t * 2.0) * 0.03;
    if (decision?.inner?.material) decision.inner.material.opacity = 0.12 + Math.sin(t * 2.3 + 1.3) * 0.02;
    if (execution?.inner?.material) execution.inner.material.opacity = 0.14 + Math.sin(t * 2.3 + 2.1) * 0.02;

    animateRoutes(routes, t);

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}
""",

    "memeflow-3d-lab.html": r"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MEMEFLOW True 3D Lab</title>
  <style>
    :root {
      --bg: #020507;
      --panel: rgba(7, 13, 19, 0.88);
      --line: rgba(94, 146, 176, 0.24);
      --text: #eef5fb;
      --muted: #8ea2b2;
      --accent: #75ecff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 50% 10%, rgba(40, 74, 110, 0.16), transparent 40%),
        #020507;
      color: var(--text);
      font-family: Arial, sans-serif;
    }
    .page {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto auto 1fr;
      gap: 10px;
      padding: 14px;
    }
    .topbar, .titlebar {
      border: 1px solid var(--line);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(8,13,18,0.96), rgba(5,9,14,0.96));
      box-shadow: inset 0 0 0 1px rgba(46, 84, 102, 0.18);
    }
    .topbar {
      min-height: 82px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 18px;
    }
    .brand {
      display: flex;
      gap: 16px;
      align-items: center;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.08em;
    }
    .logo {
      width: 34px; height: 34px;
      border-radius: 8px;
      background: linear-gradient(135deg, #74f4a4, #70d9ff);
      clip-path: polygon(0 0, 22% 0, 50% 34%, 78% 0, 100% 0, 58% 100%, 42% 100%);
      filter: drop-shadow(0 0 12px rgba(117, 232, 255, 0.55));
    }
    .actions { display: flex; gap: 10px; }
    .btn {
      min-width: 128px;
      border: 1px solid rgba(89, 132, 159, 0.28);
      border-radius: 16px;
      background: rgba(5, 10, 15, 0.8);
      color: var(--text);
      padding: 14px 18px;
      cursor: pointer;
    }
    .titlebar {
      padding: 18px 20px;
    }
    .eyebrow {
      color: #68d6ff;
      font-size: 12px;
      letter-spacing: 0.18em;
      font-weight: 700;
      margin-bottom: 8px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      line-height: 1.2;
      font-weight: 800;
    }
    .viewport {
      position: relative;
      border: 1px solid var(--line);
      border-radius: 24px;
      overflow: hidden;
      min-height: 620px;
      background: #000;
    }
    #app {
      position: absolute;
      inset: 0;
    }
    .legend {
      position: absolute;
      left: 14px;
      top: 14px;
      z-index: 2;
      display: flex;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(5, 10, 15, 0.84);
      border: 1px solid rgba(89, 132, 159, 0.24);
      color: var(--muted);
      font-size: 12px;
      pointer-events: none;
    }
    .legend i {
      display: inline-block;
      width: 8px; height: 8px;
      border-radius: 50%;
      margin-right: 6px;
    }
    @media (max-width: 760px) {
      .topbar { min-height: 74px; padding: 14px; }
      .brand { font-size: 18px; gap: 12px; }
      .actions { gap: 8px; }
      .btn { min-width: 108px; padding: 12px 14px; font-size: 14px; }
      .viewport { min-height: 520px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div class="brand">
        <div class="logo"></div>
        <div>MEMEFLOW</div>
      </div>
      <div class="actions">
        <button class="btn">Trading</button>
        <button class="btn">Settings</button>
        <button class="btn" id="resetView">Reset view</button>
      </div>
    </div>

    <div class="titlebar">
      <div class="eyebrow">REAL-TIME ARCHITECTURE</div>
      <h1>Live MEMEFLOW pipeline</h1>
    </div>

    <div class="viewport">
      <div class="legend">
        <span><i style="background:#9ba7b4"></i>WAITING</span>
        <span><i style="background:#4b75ff"></i>WATCH</span>
        <span><i style="background:#f06578"></i>BLOCKED</span>
        <span><i style="background:#66f0a6"></i>BUY READY</span>
      </div>
      <div id="app"></div>
    </div>
  </div>

  <script type="module">
    import { bootMemeflowTrue3D } from './memeflow-3d/scene.js';
    bootMemeflowTrue3D('app');
  </script>
</body>
</html>
""",
}


def log(message: str) -> None:
    print(f"[TRUE-3D-LAB-V1] {message}", flush=True)


def run(*args: str, cwd: Path | None = None, check: bool = True):
    result = subprocess.run(list(args), cwd=cwd, text=True, capture_output=True)
    if result.stdout.strip():
        print(result.stdout.rstrip())
    if result.stderr.strip():
        print(result.stderr.rstrip(), file=sys.stderr)
    if check and result.returncode != 0:
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(args)}")
    return result


def find_root() -> Path:
    cwd = Path.cwd()
    candidates = [
        cwd, cwd / "memeflow-app", cwd.parent / "memeflow-app",
        Path.home() / "workspace", Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace"), Path("/home/runner/workspace/memeflow-app"),
        Path("/workspace"), Path("/workspace/memeflow-app"),
    ]
    seen = set()
    for candidate in candidates:
        try:
            candidate = candidate.resolve()
        except Exception:
            continue
        if candidate in seen:
            continue
        seen.add(candidate)
        if (candidate / "system.html").is_file():
            return candidate
    raise RuntimeError("MEMEFLOW project root not found (need system.html)")


def git_root(project_root: Path) -> Path | None:
    result = run("git", "rev-parse", "--show-toplevel", cwd=project_root, check=False)
    if result.returncode != 0:
        return None
    value = result.stdout.strip()
    return Path(value).resolve() if value else None


def rel_to_repo(path: Path, repo: Path) -> str:
    return str(path.resolve().relative_to(repo.resolve()))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create standalone MEMEFLOW True 3D Lab page (option 2 foundation)."
    )
    parser.add_argument("--push", action="store_true", help="commit and push after creation")
    args = parser.parse_args()

    root = find_root()
    log(f"project: {root}")

    repo = git_root(root)
    branch = None
    old_head = None

    if repo is not None:
      branch = run("git", "branch", "--show-current", cwd=repo).stdout.strip()
      old_head = run("git", "rev-parse", "HEAD", cwd=repo).stdout.strip()
      log(f"git branch: {branch or '(detached)'}")
      log(f"git HEAD:   {old_head or '(unknown)'}")

    backup_dir = root / ".patch-backups" / f"true-3d-lab-v1-{STAMP}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    log(f"backup: {backup_dir}")

    created = []
    for rel_path, content in FILES.items():
        target = root / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            shutil.copy2(target, backup_dir / target.name)
        target.write_text(content.strip() + "\n", encoding="utf-8")
        created.append(target)

    log("CREATED FILES:")
    for path in created:
        print(" -", path)

    if repo is not None:
        relative = [rel_to_repo(path, repo) for path in created]
        run("git", "diff", "--check", "--", *relative, cwd=repo)

    log("VALIDATION PASS")
    log("Standalone true-3D lab page created")
    log("Real 3D scene layer created under /memeflow-3d/")
    log("Independent scene, camera, lighting, modules and routes created")
    log("Does not modify current production system page")
    log("Open /memeflow-3d-lab.html in the project to review")

    if args.push:
        if repo is None or not branch:
            log("--push requested, but no git worktree is available.")
            return 0

        relative = [rel_to_repo(path, repo) for path in created]
        run("git", "add", "--", *relative, cwd=repo)
        run("git", "diff", "--cached", "--check", cwd=repo)

        staged = run(
            "git", "diff", "--cached", "--quiet", "--", *relative,
            cwd=repo, check=False
        )
        if staged.returncode == 0:
            log("No staged changes; nothing to commit.")
            return 0

        commit = run(
            "git", "commit", "-m", "Create standalone MEMEFLOW true 3D lab",
            cwd=repo, check=False
        )
        if commit.returncode != 0:
            log("WARNING: files created, but git commit failed.")
            return 0

        push = run("git", "push", "-u", "origin", branch, cwd=repo, check=False)
        if push.returncode != 0:
            log("WARNING: commit created, but push failed.")
            return 0

        new_head = run("git", "rev-parse", "HEAD", cwd=repo).stdout.strip()
        log("COMMIT + PUSH COMPLETE")
        log(f"branch: {branch}")
        log(f"previous HEAD: {old_head}")
        log(f"new HEAD:      {new_head}")

    else:
        log("Files created locally. Re-run with --push to commit + push.")

    log("DONE")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[TRUE-3D-LAB-V1] ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
