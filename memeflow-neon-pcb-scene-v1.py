#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_NEON_PCB_SCENE_V1"
VERSION = "neon-pcb-scene-v1"
STAMP = time.strftime("%Y%m%d-%H%M%S")

LAYOUT_JS = r"""
export const NODES = [
  {
    id: 'discovery',
    label: 'DISCOVERY',
    color: 0x159dff,
    pos: [-3.55, 0.34, -3.15],
    size: [2.30, 1.60],
    icon: 'discovery'
  },
  {
    id: 'risk',
    label: 'RISK ENGINE',
    color: 0x268dff,
    pos: [-0.35, 0.34, -3.30],
    size: [2.38, 1.62],
    icon: 'risk'
  },
  {
    id: 'core',
    label: 'MEMEFLOW CORE',
    color: 0x39ef88,
    pos: [3.25, 0.40, -3.15],
    size: [2.58, 1.76],
    icon: 'core',
    emphasis: 1.26
  },

  {
    id: 'bootstrap',
    label: 'FAST BOOTSTRAP',
    color: 0x23c8ff,
    pos: [-3.80, 0.34, -0.20],
    size: [2.42, 1.62],
    icon: 'bootstrap'
  },
  {
    id: 'openai',
    label: 'OPENAI ASSISTANT',
    color: 0x9b4fff,
    pos: [-0.10, 0.46, -0.05],
    size: [2.72, 1.86],
    icon: 'openai',
    emphasis: 1.22
  },
  {
    id: 'decision',
    label: 'DECISION',
    color: 0x45ed8e,
    pos: [3.45, 0.38, -0.10],
    size: [2.34, 1.62],
    icon: 'decision'
  },

  {
    id: 'market',
    label: 'MARKET LEDGER',
    color: 0x20bfff,
    pos: [-3.62, 0.34, 2.95],
    size: [2.42, 1.62],
    icon: 'market'
  },
  {
    id: 'paper',
    label: 'PAPER ENGINE',
    color: 0x43e99a,
    pos: [-0.12, 0.38, 3.16],
    size: [2.42, 1.66],
    icon: 'paper'
  },
  {
    id: 'execution',
    label: 'LIVE EXECUTION',
    color: 0x30ed82,
    pos: [3.62, 0.42, 2.88],
    size: [2.52, 1.70],
    icon: 'execution',
    emphasis: 1.18
  },

  {
    id: 'holders',
    label: 'HOLDER LEDGER',
    color: 0x2bbdff,
    pos: [2.20, 0.32, 1.34],
    size: [2.05, 1.48],
    icon: 'holders',
    compact: true
  }
];

export const ROUTES = [
  ['discovery', 'risk', 0x32bfff],
  ['discovery', 'bootstrap', 0x1ca9ff],
  ['bootstrap', 'risk', 0x28c8ff],
  ['bootstrap', 'market', 0x23bfff],

  ['risk', 'core', 0x3bd3ff],
  ['risk', 'openai', 0x6f72ff],
  ['market', 'openai', 0x7657ff],

  ['market', 'holders', 0x28bfff],
  ['holders', 'decision', 0x45dbb2],

  ['core', 'decision', 0x43ef91],
  ['openai', 'decision', 0xa65aff],
  ['openai', 'paper', 0x9a5cff],

  ['paper', 'execution', 0x42eda0],
  ['decision', 'execution', 0x4bed94]
];
"""

MATERIALS_JS = r"""
import * as THREE from 'three';

function hex(color) {
  return '#' + Number(color).toString(16).padStart(6, '0');
}

export function chassisMaterial(color, tier = 0, emphasis = 1) {
  const palette = [
    0x010407,
    0x03080d,
    0x071016,
    0x0b151c
  ];

  return new THREE.MeshPhysicalMaterial({
    color: palette[Math.min(tier, palette.length - 1)],
    emissive: color,
    emissiveIntensity:
      (tier === 3 ? 0.035 : tier === 2 ? 0.020 : 0.008)
      * emphasis,
    metalness: 0.91,
    roughness: tier === 3 ? 0.14 : 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.035
  });
}

export function topGlassMaterial(color, emphasis = 1) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x061018,
    emissive: color,
    emissiveIntensity: 0.075 * emphasis,
    metalness: 0.18,
    roughness: 0.08,
    transmission: 0.08,
    thickness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.91
  });
}

export function accentMaterial(color, opacity = 0.92) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function lineMaterial(color, opacity = 0.86) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function createBoardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#010306';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const grid = 64;

  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += grid) {
    ctx.strokeStyle =
      x % (grid * 4) === 0
        ? 'rgba(31,96,135,.18)'
        : 'rgba(20,57,80,.08)';

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += grid) {
    ctx.strokeStyle =
      y % (grid * 4) === 0
        ? 'rgba(31,96,135,.18)'
        : 'rgba(20,57,80,.08)';

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Deterministic pseudo-random PCB traces.
  let seed = 918273;

  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 330; i++) {
    const x = Math.floor(rand() * 32) * grid;
    const y = Math.floor(rand() * 32) * grid;
    const w = (1 + Math.floor(rand() * 5)) * grid;
    const h = (1 + Math.floor(rand() * 4)) * grid;

    const cyan = rand() > 0.5;

    ctx.strokeStyle =
      cyan
        ? `rgba(22,132,195,${0.05 + rand() * 0.12})`
        : `rgba(29,79,113,${0.04 + rand() * 0.10})`;

    ctx.lineWidth = rand() > 0.75 ? 2 : 1;

    ctx.beginPath();
    ctx.moveTo(x, y);

    if (rand() > 0.5) {
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
    } else {
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
    }

    ctx.stroke();

    if (rand() > 0.72) {
      ctx.fillStyle =
        cyan
          ? 'rgba(32,164,234,.20)'
          : 'rgba(45,99,130,.14)';

      ctx.fillRect(
        x - 3,
        y - 3,
        6,
        6
      );
    }
  }

  const vignette = ctx.createRadialGradient(
    1024,
    980,
    120,
    1024,
    980,
    1160
  );

  vignette.addColorStop(0, 'rgba(15,39,52,.06)');
  vignette.addColorStop(0.62, 'rgba(0,0,0,.06)');
  vignette.addColorStop(1, 'rgba(0,0,0,.72)');

  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 2048, 2048);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;

  return texture;
}

export function createLabelTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 220;

  const ctx = canvas.getContext('2d');
  const accent = hex(color);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, 'rgba(3,7,10,.96)');
  bg.addColorStop(1, 'rgba(0,2,4,.995)');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 10, canvas.height);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f3f7f9';

  const fontSize =
    text.length > 14
      ? 62
      : text.length > 11
        ? 70
        : 80;

  ctx.font = `800 ${fontSize}px Arial, sans-serif`;

  ctx.shadowColor = accent;
  ctx.shadowBlur = 8;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export function createIconTexture(kind, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext('2d');
  const accent = hex(color);

  ctx.translate(256, 256);

  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 22;

  ctx.globalAlpha = 0.20;
  ctx.beginPath();
  ctx.arc(0, 0, 126, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.95;

  if (kind === 'discovery') {
    ctx.beginPath();
    ctx.arc(-24, -20, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 15);
    ctx.lineTo(80, 82);
    ctx.stroke();
  }

  else if (kind === 'risk') {
    ctx.beginPath();
    ctx.moveTo(0, -92);
    ctx.lineTo(78, -54);
    ctx.lineTo(60, 38);
    ctx.quadraticCurveTo(0, 100, -60, 38);
    ctx.lineTo(-78, -54);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14, -62);
    ctx.lineTo(-34, 7);
    ctx.lineTo(4, 7);
    ctx.lineTo(-12, 63);
    ctx.lineTo(48, -12);
    ctx.lineTo(12, -12);
    ctx.stroke();
  }

  else if (kind === 'core') {
    for (const radius of [34, 70, 108]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  else if (kind === 'bootstrap') {
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
  }

  else if (kind === 'openai') {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(0, -47, 31, 61, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  else if (kind === 'decision') {
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
    for (const [x1, y1, x2, y2] of [
      [0, -116, 0, -82],
      [0, 82, 0, 116],
      [-116, 0, -82, 0],
      [82, 0, 116, 0]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  else if (kind === 'market') {
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(
        Math.cos(angle) * 58,
        Math.sin(angle) * 58,
        26,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }

  else if (kind === 'paper') {
    ctx.beginPath();
    ctx.moveTo(-80, 55);
    ctx.lineTo(-15, -46);
    ctx.lineTo(24, -3);
    ctx.lineTo(82, -86);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(82, -86);
    ctx.lineTo(76, -30);
    ctx.moveTo(82, -86);
    ctx.lineTo(26, -78);
    ctx.stroke();
  }

  else if (kind === 'execution') {
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(18, -92);
    ctx.lineTo(-42, 0);
    ctx.lineTo(4, 0);
    ctx.lineTo(-16, 88);
    ctx.lineTo(62, -18);
    ctx.lineTo(12, -18);
    ctx.closePath();
    ctx.fill();
  }

  else if (kind === 'holders') {
    const pts = [
      [0, -70],
      [-62, 42],
      [62, 42]
    ];

    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(-45, 26);
    ctx.moveTo(0, -48);
    ctx.lineTo(45, 26);
    ctx.moveTo(-40, 42);
    ctx.lineTo(40, 42);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}
"""

MODULES_JS = r"""
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
"""

ROUTES_JS = r"""
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
"""

SCENE_JS = r"""
import * as THREE from 'three';

import {
  OrbitControls
} from 'three/addons/controls/OrbitControls.js';

import {
  EffectComposer
} from 'three/addons/postprocessing/EffectComposer.js';

import {
  RenderPass
} from 'three/addons/postprocessing/RenderPass.js';

import {
  UnrealBloomPass
} from 'three/addons/postprocessing/UnrealBloomPass.js';

import {
  OutputPass
} from 'three/addons/postprocessing/OutputPass.js';

import {
  NODES,
  ROUTES
} from './layout.js?v=neon-pcb-scene-v1';

import {
  createModule
} from './modules.js?v=neon-pcb-scene-v1';

import {
  createRoute,
  animateRoutes
} from './routes.js?v=neon-pcb-scene-v1';

import {
  createBoardTexture,
  accentMaterial
} from './materials.js?v=neon-pcb-scene-v1';

function logicalBounds() {
  const box =
    new THREE.Box3()
      .makeEmpty();

  for (const node of NODES) {
    const w =
      Number(node.size?.[0])
      || 2.4;

    const d =
      Number(node.size?.[1])
      || 1.6;

    box.expandByPoint(
      new THREE.Vector3(
        node.pos[0] - w * 0.56,
        -0.35,
        node.pos[2] - d * 0.60
      )
    );

    box.expandByPoint(
      new THREE.Vector3(
        node.pos[0] + w * 0.56,
        0.82,
        node.pos[2] + d * 0.60
      )
    );
  }

  return box;
}

function boxCorners(box) {
  const min = box.min;
  const max = box.max;

  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ];
}

function addBoard(scene) {
  const board =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        13.8,
        11.4
      ),
      new THREE.MeshPhysicalMaterial({
        map: createBoardTexture(),
        color: 0x071017,
        metalness: 0.74,
        roughness: 0.33,
        clearcoat: 0.68,
        clearcoatRoughness: 0.20
      })
    );

  board.rotation.x =
    -Math.PI / 2;

  board.position.y =
    -0.38;

  scene.add(
    board
  );

  const edgeColor =
    0x0b4161;

  for (const [x, z, w, d] of [
    [0, -5.58, 13.65, 0.035],
    [0, 5.58, 13.65, 0.035],
    [-6.72, 0, 0.035, 11.15],
    [6.72, 0, 0.035, 11.15]
  ]) {
    const edge =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          w,
          0.025,
          d
        ),
        accentMaterial(
          edgeColor,
          0.34
        )
      );

    edge.position.set(
      x,
      -0.345,
      z
    );

    scene.add(
      edge
    );
  }
}

export async function bootMemeflowTrue3D(
  rootId = 'memeflowTrue3DHost'
) {
  const mount =
    document.getElementById(
      rootId
    );

  if (!mount) {
    throw new Error(
      'Neon PCB mount not found: '
      + rootId
    );
  }

  mount.replaceChildren();

  const scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x000102
    );

  scene.fog =
    new THREE.FogExp2(
      0x000204,
      0.026
    );

  const camera =
    new THREE.PerspectiveCamera(
      39,
      1,
      0.05,
      120
    );

  const renderer =
    new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference:
        'high-performance'
    });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      1.65
    )
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

  renderer.toneMappingExposure =
    0.93;

  renderer.domElement.id =
    'memeflowTrue3DCanvas';

  mount.appendChild(
    renderer.domElement
  );

  const composer =
    new EffectComposer(
      renderer
    );

  composer.addPass(
    new RenderPass(
      scene,
      camera
    )
  );

  const bloom =
    new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0.23,
      0.34,
      0.89
    );

  composer.addPass(
    bloom
  );

  composer.addPass(
    new OutputPass()
  );

  const controls =
    new OrbitControls(
      camera,
      renderer.domElement
    );

  controls.enablePan =
    false;

  controls.enableDamping =
    true;

  controls.dampingFactor =
    0.052;

  controls.rotateSpeed =
    0.48;

  controls.zoomSpeed =
    1.00;

  controls.minPolarAngle =
    0.42;

  controls.maxPolarAngle =
    1.47;

  if (
    controls.touches
  ) {
    controls.touches.ONE =
      THREE.TOUCH.ROTATE;

    controls.touches.TWO =
      THREE.TOUCH.DOLLY_ROTATE;
  }

  scene.add(
    new THREE.HemisphereLight(
      0x6ca6c7,
      0x000102,
      0.30
    )
  );

  const key =
    new THREE.DirectionalLight(
      0xe8f6ff,
      1.25
    );

  key.position.set(
    -1.5,
    8.2,
    6.2
  );

  scene.add(
    key
  );

  const cyan =
    new THREE.PointLight(
      0x18aaff,
      3.6,
      16,
      2
    );

  cyan.position.set(
    -4.2,
    2.4,
    -0.2
  );

  scene.add(
    cyan
  );

  const violet =
    new THREE.PointLight(
      0xa052ff,
      3.4,
      13,
      2
    );

  violet.position.set(
    -0.1,
    2.3,
    0.0
  );

  scene.add(
    violet
  );

  const green =
    new THREE.PointLight(
      0x36ec8b,
      4.0,
      15,
      2
    );

  green.position.set(
    3.5,
    2.5,
    0.1
  );

  scene.add(
    green
  );

  addBoard(
    scene
  );

  const modules =
    new Map();

  const pickMeshes =
    [];

  for (
    const node
    of NODES
  ) {
    const built =
      createModule(
        node
      );

    scene.add(
      built.group
    );

    modules.set(
      node.id,
      built
    );

    pickMeshes.push(
      built.pickMesh
    );
  }

  const byId =
    new Map(
      NODES.map(
        node => [
          node.id,
          node
        ]
      )
    );

  const routes = [];

  for (
    const [from, to, color]
    of ROUTES
  ) {
    const a =
      byId.get(
        from
      );

    const b =
      byId.get(
        to
      );

    if (!a || !b) {
      continue;
    }

    const route =
      createRoute(
        a,
        b,
        color
      );

    scene.add(
      route.group
    );

    routes.push(
      route
    );
  }

  const bounds =
    logicalBounds();

  const center =
    new THREE.Vector3();

  bounds.getCenter(
    center
  );

  const corners =
    boxCorners(
      bounds
    );

  const homeDirection =
    new THREE.Vector3(
      0.10,
      0.95,
      0.88
    ).normalize();

  const homeCamera =
    new THREE.Vector3();

  const homeTarget =
    new THREE.Vector3();

  let homeDistance =
    18;

  function updateProjection() {
    const width =
      Math.max(
        1,
        mount.clientWidth
      );

    const height =
      Math.max(
        1,
        mount.clientHeight
      );

    const aspect =
      width / height;

    camera.aspect =
      aspect;

    camera.fov =
      aspect < 0.82
        ? 42
        : aspect < 1.10
          ? 39
          : 36;

    camera.updateProjectionMatrix();

    return {
      width,
      height,
      aspect
    };
  }

  function fitsAt(
    distance,
    xLimit,
    yLimit
  ) {
    camera.position
      .copy(
        center
      )
      .addScaledVector(
        homeDirection,
        distance
      );

    camera.lookAt(
      center
    );

    camera.updateMatrixWorld(
      true
    );

    for (
      const corner
      of corners
    ) {
      const projected =
        corner.clone()
          .project(
            camera
          );

      if (
        !Number.isFinite(
          projected.x
        )
        || !Number.isFinite(
          projected.y
        )
        || Math.abs(
          projected.x
        ) > xLimit
        || Math.abs(
          projected.y
        ) > yLimit
      ) {
        return false;
      }
    }

    return true;
  }

  function computeHomeView() {
    const {
      width,
      height,
      aspect
    } =
      updateProjection();

    renderer.setSize(
      width,
      height,
      false
    );

    composer.setSize(
      width,
      height
    );

    const xLimit =
      aspect < 0.82
        ? 0.965
        : 0.958;

    const yLimit =
      aspect < 0.82
        ? 0.950
        : 0.945;

    let low = 4;
    let high = 50;

    for (
      let index = 0;
      index < 34;
      index++
    ) {
      const mid =
        (low + high) / 2;

      if (
        fitsAt(
          mid,
          xLimit,
          yLimit
        )
      ) {
        high = mid;
      }

      else {
        low = mid;
      }
    }

    homeDistance =
      high;

    homeTarget.copy(
      center
    );

    homeTarget.y =
      0.08;

    homeCamera
      .copy(
        center
      )
      .addScaledVector(
        homeDirection,
        homeDistance
      );

    controls.minDistance =
      Math.max(
        4.1,
        homeDistance * 0.34
      );

    controls.maxDistance =
      Math.max(
        32,
        homeDistance * 2.2
      );
  }

  function resetView() {
    computeHomeView();

    camera.position.copy(
      homeCamera
    );

    controls.target.copy(
      homeTarget
    );

    controls.update();
  }

  let atHome =
    true;

  controls.addEventListener(
    'start',
    () => {
      atHome =
        false;
    }
  );

  const resize =
    () => {
      const wasHome =
        atHome;

      const {
        width,
        height
      } =
        updateProjection();

      renderer.setSize(
        width,
        height,
        false
      );

      composer.setSize(
        width,
        height
      );

      if (
        wasHome
      ) {
        resetView();
      }
    };

  const resizeObserver =
    new ResizeObserver(
      resize
    );

  resizeObserver.observe(
    mount
  );

  const resetButton =
    document.getElementById(
      'resetViewBtn'
    );

  const resetHandler =
    () => {
      atHome =
        true;

      resetView();
    };

  resetButton
    ?.addEventListener(
      'click',
      resetHandler
    );

  resetView();

  const raycaster =
    new THREE.Raycaster();

  const pointer =
    new THREE.Vector2();

  let pointerDown =
    null;

  renderer.domElement
    .addEventListener(
      'pointerdown',
      event => {
        pointerDown = {
          x: event.clientX,
          y: event.clientY
        };
      }
    );

  renderer.domElement
    .addEventListener(
      'pointerup',
      event => {
        if (
          !pointerDown
        ) {
          return;
        }

        const movement =
          Math.hypot(
            event.clientX
              - pointerDown.x,
            event.clientY
              - pointerDown.y
          );

        pointerDown =
          null;

        if (
          movement > 8
        ) {
          return;
        }

        const rect =
          renderer.domElement
            .getBoundingClientRect();

        pointer.x =
          (
            (
              event.clientX
              - rect.left
            ) / rect.width
          ) * 2 - 1;

        pointer.y =
          -(
            (
              event.clientY
              - rect.top
            ) / rect.height
          ) * 2 + 1;

        raycaster.setFromCamera(
          pointer,
          camera
        );

        const hit =
          raycaster
            .intersectObjects(
              pickMeshes,
              false
            )[0];

        const nodeId =
          hit
            ?.object
            ?.userData
            ?.nodeId;

        if (
          nodeId
        ) {
          window.dispatchEvent(
            new CustomEvent(
              'memeflow:true3d-select',
              {
                detail: {
                  nodeId
                }
              }
            )
          );
        }
      }
    );

  const clock =
    new THREE.Clock();

  let frame =
    0;

  let disposed =
    false;

  function animate() {
    if (
      disposed
    ) {
      return;
    }

    frame =
      requestAnimationFrame(
        animate
      );

    const time =
      clock.getElapsedTime();

    animateRoutes(
      routes,
      time
    );

    const core =
      modules.get(
        'core'
      );

    const openai =
      modules.get(
        'openai'
      );

    if (
      core?.icon
    ) {
      core.icon.material.opacity =
        0.86
        + Math.sin(
          time * 2.2
        ) * 0.10;
    }

    if (
      openai?.glass
    ) {
      openai.glass.material.emissiveIntensity =
        0.07
        + Math.sin(
          time * 1.8
        ) * 0.018;
    }

    controls.update();

    composer.render();
  }

  animate();

  function dispose() {
    if (
      disposed
    ) {
      return;
    }

    disposed =
      true;

    cancelAnimationFrame(
      frame
    );

    resizeObserver.disconnect();

    resetButton
      ?.removeEventListener(
        'click',
        resetHandler
      );

    controls.dispose();

    scene.traverse(
      object => {
        object.geometry
          ?.dispose
          ?.();

        if (
          Array.isArray(
            object.material
          )
        ) {
          for (
            const material
            of object.material
          ) {
            material
              ?.dispose
              ?.();
          }
        }

        else {
          object.material
            ?.dispose
            ?.();
        }
      }
    );

    composer.dispose();
    renderer.dispose();
    mount.replaceChildren();
  }

  return {
    scene,
    camera,
    renderer,
    composer,
    controls,
    modules,
    routes,
    resetView,
    dispose
  };
}

/* ===== MEMEFLOW_NEON_PCB_SCENE_V1 ===== */
"""

EMBED_JS = r"""
import {
  bootMemeflowTrue3D
} from './scene.js?v=neon-pcb-scene-v1';

async function startTrue3D() {
  const viewport =
    document.querySelector(
      '.viewport-wrap'
    );

  if (!viewport) {
    console.error(
      '[NEON-PCB] viewport-wrap not found'
    );

    return;
  }

  let host =
    document.getElementById(
      'memeflowTrue3DHost'
    );

  if (!host) {
    host =
      document.createElement(
        'div'
      );

    host.id =
      'memeflowTrue3DHost';

    viewport.appendChild(
      host
    );
  }

  window.__MEMEFLOW_TRUE_3D_ACTIVE__ =
    true;

  requestAnimationFrame(
    async () => {
      try {
        const previous =
          window.__memeflowTrue3D;

        if (
          previous
          && typeof previous.dispose === 'function'
        ) {
          previous.dispose();
        }

        window.__memeflowTrue3D =
          await bootMemeflowTrue3D(
            'memeflowTrue3DHost'
          );

        document
          .getElementById(
            'systemCanvas'
          )
          ?.setAttribute(
            'aria-hidden',
            'true'
          );

        console.log(
          '[NEON-PCB] scene V1 mounted'
        );
      }

      catch (error) {
        window.__MEMEFLOW_TRUE_3D_ACTIVE__ =
          false;

        console.error(
          '[NEON-PCB] boot failed',
          error
        );
      }
    }
  );
}

if (
  document.readyState
  === 'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    startTrue3D,
    {
      once: true
    }
  );
}

else {
  startTrue3D();
}
"""

FILES = {
    "memeflow-3d/layout.js": LAYOUT_JS,
    "memeflow-3d/materials.js": MATERIALS_JS,
    "memeflow-3d/modules.js": MODULES_JS,
    "memeflow-3d/routes.js": ROUTES_JS,
    "memeflow-3d/scene.js": SCENE_JS,
    "memeflow-3d/embed.js": EMBED_JS,
}


def log(message: str) -> None:
    print(
        f"[NEON-PCB-SCENE-V1] {message}",
        flush=True,
    )


def run(
    *args: str,
    cwd: Path | None = None,
    check: bool = True,
):
    result = subprocess.run(
        list(args),
        cwd=cwd,
        text=True,
        capture_output=True,
    )

    if result.stdout.strip():
        print(
            result.stdout.rstrip()
        )

    if result.stderr.strip():
        print(
            result.stderr.rstrip(),
            file=sys.stderr,
        )

    if (
        check
        and result.returncode != 0
    ):
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(args)}"
        )

    return result


def find_root() -> Path:
    cwd = Path.cwd()

    candidates = [
        cwd,
        cwd / "memeflow-app",
        cwd.parent / "memeflow-app",
        Path.home() / "workspace",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace"),
        Path("/home/runner/workspace/memeflow-app"),
        Path("/workspace"),
        Path("/workspace/memeflow-app"),
    ]

    seen = set()

    for candidate in candidates:
        try:
            candidate = (
                candidate.resolve()
            )

        except Exception:
            continue

        if (
            candidate in seen
        ):
            continue

        seen.add(
            candidate
        )

        if (
            (candidate / "system.html").is_file()
            and
            (candidate / "system.css").is_file()
            and
            (candidate / "memeflow-3d" / "scene.js").is_file()
        ):
            return candidate

    raise RuntimeError(
        "MEMEFLOW project root not found"
    )


def git_root(
    project_root: Path,
) -> Path | None:
    result = run(
        "git",
        "rev-parse",
        "--show-toplevel",
        cwd=project_root,
        check=False,
    )

    if (
        result.returncode != 0
    ):
        return None

    value = result.stdout.strip()

    return (
        Path(value).resolve()
        if value
        else None
    )


def rel(
    path: Path,
    repo: Path,
) -> str:
    return str(
        path.resolve()
        .relative_to(
            repo.resolve()
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(
            description=(
                "Replace only the MEMEFLOW 3D viewport renderer with the "
                "neon cyberpunk PCB scene shown in the approved mockup."
            )
        )

    parser.add_argument(
        "--push",
        action="store_true",
        help=(
            "commit and push after validation"
        ),
    )

    args = parser.parse_args()

    root = find_root()

    log(
        f"project: {root}"
    )

    scene_path = root / "memeflow-3d" / "scene.js"

    current_scene = scene_path.read_text(
        encoding="utf-8"
    )

    if (
        PATCH_ID
        in current_scene
    ):
        log(
            "Neon PCB V1 is already installed."
        )

        return 0

    known_baselines = [
        "MEMEFLOW_VARIANT_2_FULLFRAME_V2",
        "MEMEFLOW_VARIANT_2_SHOWCASE_V1",
        "MEMEFLOW_TRUE_3D_CINEMATIC_V8",
        "MEMEFLOW_TRUE_3D_STAGE_FILL_V7",
        "MEMEFLOW_TRUE_3D_HERO_V6",
        "MEMEFLOW_TRUE_3D_GLB_V5",
    ]

    if not any(
        marker in current_scene
        for marker in known_baselines
    ):
        raise RuntimeError(
            "Known MEMEFLOW 3D baseline not found; "
            "refusing to replace an unknown renderer."
        )

    html_path = root / "system.html"

    targets = [
        root / rel_path
        for rel_path in FILES
    ] + [
        html_path
    ]

    repo = git_root(root)

    branch = None
    old_head = None

    if (
        repo is not None
    ):
        branch = run(
            "git",
            "branch",
            "--show-current",
            cwd=repo,
        ).stdout.strip()

        old_head = run(
            "git",
            "rev-parse",
            "HEAD",
            cwd=repo,
        ).stdout.strip()

        log(
            f"git branch: "
            f"{branch or '(detached)'}"
        )

        log(
            f"git HEAD: "
            f"{old_head or '(unknown)'}"
        )

        if (
            not branch
        ):
            raise RuntimeError(
                "detached HEAD"
            )

        status = run(
            "git",
            "status",
            "--porcelain",
            "--",
            *[
                rel(
                    path,
                    repo
                )
                for path in targets
            ],
            cwd=repo,
        ).stdout.strip()

        if (
            status
        ):
            print(
                status
            )

            raise RuntimeError(
                "Target 3D files have local changes. "
                "Commit/push them first; nothing changed."
            )

    backup_dir = (
        root
        / ".patch-backups"
        / f"neon-pcb-scene-v1-{STAMP}"
    )

    backup_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    for path in targets:
        if not path.exists():
            continue

        backup_name = (
            str(
                path.relative_to(
                    root
                )
            )
            .replace(
                "/",
                "__"
            )
        )

        shutil.copy2(
            path,
            backup_dir / backup_name,
        )

    log(
        f"backup: {backup_dir}"
    )

    try:
        # Replace ONLY the renderer-side 3D files.
        for rel_path, content in FILES.items():
            path = root / rel_path

            path.parent.mkdir(
                parents=True,
                exist_ok=True,
            )

            path.write_text(
                content.strip()
                + "\n",
                encoding="utf-8",
            )

        # Only cache-bust the existing 3D embed in system.html.
        html = html_path.read_text(
            encoding="utf-8"
        )

        html, count = re.subn(
                r"/memeflow-3d/embed\.js\?v=[^\"']+",
                f"/memeflow-3d/embed.js?v={VERSION}",
                html,
                count=1,
            )

        if (
            count != 1
        ):
            raise RuntimeError(
                "system.html 3D embed cache-bust anchor not found"
            )

        html_path.write_text(
            html,
            encoding="utf-8",
        )

        # JS syntax validation.
        for rel_path in FILES:
            path = root / rel_path

            result = run(
                "node",
                "--check",
                str(path),
                check=False,
            )

            if (
                result.returncode != 0
            ):
                raise RuntimeError(
                    f"node --check failed: {path}"
                )

        final_scene = (
            root / "memeflow-3d" / "scene.js"
        ).read_text(encoding="utf-8")

        final_layout = (
            root / "memeflow-3d" / "layout.js"
        ).read_text(encoding="utf-8")

        required = [
            (
                PATCH_ID,
                final_scene
            ),
            (
                "createBoardTexture",
                final_scene
            ),
            (
                "MEMEFLOW_NEON_NODE_",
                (
                    root
                    / "memeflow-3d"
                    / "modules.js"
                ).read_text(
                    encoding="utf-8"
                )
            ),
            (
                "OPENAI ASSISTANT",
                final_layout
            ),
            (
                "MEMEFLOW CORE",
                final_layout
            ),
            (
                "LIVE EXECUTION",
                final_layout
            ),
            (
                "new THREE.FogExp2",
                final_scene
            ),
            (
                "memeflow:true3d-select",
                final_scene
            ),
        ]

        for needle, haystack in required:
            if (
                needle
                not in haystack
            ):
                raise RuntimeError(
                    f"validation failed: {needle}"
                )

        # Confirm this patch did not touch page CSS.
        css_status = ""

        if (
            repo is not None
        ):
            css_status = run(
                "git",
                "status",
                "--porcelain",
                "--",
                rel(
                    root / "system.css",
                    repo
                ),
                cwd=repo,
            ).stdout.strip()

        if (
            css_status
        ):
            raise RuntimeError(
                "system.css changed unexpectedly; rollback."
            )

        if (
            repo is not None
        ):
            run(
                "git",
                "diff",
                "--check",
                "--",
                *[
                    rel(
                        path,
                        repo
                    )
                    for path in targets
                ],
                cwd=repo,
            )

        log(
            "VALIDATION PASS"
        )

        log(
            "ONLY the 3D screen renderer was replaced"
        )

        log(
            "Neon PCB floor installed"
        )

        log(
            "Layered black-metal hardware modules installed"
        )

        log(
            "Blue / purple / green emissive top panels installed"
        )

        log(
            "Orthogonal glowing circuit routes + moving packets installed"
        )

        log(
            "Approved 3/4 top-down camera and automatic fit installed"
        )

        log(
            "Real MEMEFLOW module names preserved"
        )

        log(
            "Orbit / pinch zoom / Reset View / node selection preserved"
        )

        log(
            "system.css / page layout / Live Inspector / Token Flow untouched"
        )

        log(
            "Server / AI / evaluator / trading logic untouched"
        )

    except Exception:
        log(
            "Validation failed; restoring exact backup."
        )

        for path in targets:
            backup_name = (
                str(
                    path.relative_to(
                        root
                    )
                )
                .replace(
                    "/",
                    "__"
                )
            )

            backup = backup_dir / backup_name

            if (
                backup.exists()
            ):
                path.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )

                shutil.copy2(
                    backup,
                    path,
                )

        log(
            "ROLLBACK COMPLETE"
        )

        raise

    if (
        args.push
    ):
        if (
            repo is None
            or not branch
        ):
            log(
                "--push requested but git worktree is unavailable."
            )

            return 0

        rel_targets = [
            rel(
                path,
                repo
            )
            for path in targets
        ]

        run(
            "git",
            "add",
            "--",
            *rel_targets,
            cwd=repo,
        )

        run(
            "git",
            "diff",
            "--cached",
            "--check",
            cwd=repo,
        )

        staged = run(
                "git",
                "diff",
                "--cached",
                "--quiet",
                cwd=repo,
                check=False,
            )

        if (
            staged.returncode == 0
        ):
            log(
                "No staged changes; nothing to commit."
            )

            return 0

        commit = run(
                "git",
                "commit",
                "-m",
                "Build MEMEFLOW neon PCB 3D scene",
                cwd=repo,
                check=False,
            )

        if (
            commit.returncode != 0
        ):
            log(
                "WARNING: scene installed but commit failed."
            )

            return 0

        push = run(
                "git",
                "push",
                "-u",
                "origin",
                branch,
                cwd=repo,
                check=False,
            )

        if (
            push.returncode != 0
        ):
            log(
                "WARNING: commit created but push failed."
            )

            return 0

        new_head = run(
                "git",
                "rev-parse",
                "HEAD",
                cwd=repo,
            ).stdout.strip()

        log(
            "COMMIT + PUSH COMPLETE"
        )

        log(
            f"branch: {branch}"
        )

        log(
            f"previous HEAD: {old_head}"
        )

        log(
            f"new HEAD: {new_head}"
        )

    else:
        log(
            "Patch applied locally. "
            "Re-run with --push to commit + push."
        )

    log(
        "DONE"
    )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(
            main()
        )

    except Exception as exc:
        print(
            f"[NEON-PCB-SCENE-V1] ERROR: {exc}",
            file=sys.stderr,
        )

        raise SystemExit(1)
