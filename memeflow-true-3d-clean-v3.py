#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_TRUE_3D_CLEAN_V3"
STAMP = time.strftime("%Y%m%d-%H%M%S")

VERSION = "true-3d-clean-v3"

LAYOUT_JS = r"""
export const NODES = [
  { id: 'discovery', label: 'DISCOVERY', color: 0x315cff, pos: [-3.25, 0, -3.25], size: [2.15, 1.48] },
  { id: 'bootstrap', label: 'FAST BOOTSTRAP', color: 0x315cff, pos: [0, 0, -3.25], size: [2.32, 1.48] },
  { id: 'core', label: 'MEMEFLOW CORE', color: 0x56e79a, pos: [3.25, 0, -3.25], size: [2.78, 1.78], core: true },

  { id: 'risk', label: 'RISK ENGINE', color: 0x43c8ee, pos: [-3.25, 0, -0.35], size: [2.15, 1.48] },
  { id: 'market', label: 'MARKET LEDGER', color: 0x3a7dff, pos: [0, 0, -0.35], size: [2.20, 1.48] },
  { id: 'holders', label: 'HOLDER LEDGER', color: 0x43c8ee, pos: [3.25, 0, -0.35], size: [2.15, 1.48] },

  { id: 'openai', label: 'OPENAI ASSISTANT', color: 0x43c8ee, pos: [-3.25, 0, 2.55], size: [2.28, 1.48] },
  { id: 'decision', label: 'DECISION', color: 0x8d58ff, pos: [0, 0, 2.55], size: [2.05, 1.48], decision: true },
  { id: 'paper', label: 'PAPER ENGINE', color: 0x315cff, pos: [3.25, 0, 2.55], size: [2.15, 1.48] },

  { id: 'execution', label: 'LIVE EXECUTION', color: 0x48df8b, pos: [0, 0, 5.30], size: [2.28, 1.48], execution: true }
];

export const ROUTES = [
  ['discovery', 'bootstrap', 0x74dcff],
  ['bootstrap', 'core', 0x74dcff],

  ['core', 'risk', 0x74dcff],
  ['core', 'market', 0x59e99c],
  ['core', 'holders', 0x59e99c],

  ['risk', 'market', 0x74dcff],
  ['market', 'holders', 0x74dcff],

  ['risk', 'openai', 0x9a70ff],
  ['openai', 'decision', 0x74dcff],
  ['market', 'decision', 0x74dcff],

  ['decision', 'paper', 0xa977ff],
  ['paper', 'execution', 0x61eda0]
];
"""

MATERIALS_JS = r"""
import * as THREE from 'three';

function hex(color) {
  return '#' + Number(color).toString(16).padStart(6, '0');
}

function makeRadialTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');

  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size * 0.48
  );

  g.addColorStop(0.00, 'rgba(255,255,255,0.96)');
  g.addColorStop(0.16, 'rgba(255,255,255,0.48)');
  g.addColorStop(0.48, 'rgba(255,255,255,0.13)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export const SOFT_GLOW = makeRadialTexture();

export function chassisMaterial(color, tier = 0, emphasis = 1) {
  const isTop = tier === 2;

  return new THREE.MeshPhysicalMaterial({
    color:
      isTop
        ? 0x06131b
        : tier === 1
          ? 0x030b10
          : 0x02070a,

    emissive: color,

    emissiveIntensity:
      (isTop ? 0.085 : tier === 1 ? 0.032 : 0.012)
      * emphasis,

    metalness:
      isTop ? 0.48 : 0.70,

    roughness:
      isTop ? 0.17 : 0.25,

    clearcoat: 1,
    clearcoatRoughness: 0.055,

    transparent: true,
    opacity: isTop ? 0.985 : 1
  });
}

export function glassMaterial(color, emphasis = 1) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x071720,
    emissive: color,
    emissiveIntensity: 0.16 * emphasis,

    metalness: 0.08,
    roughness: 0.09,

    transmission: 0.18,
    thickness: 0.28,
    ior: 1.35,

    clearcoat: 1,
    clearcoatRoughness: 0.02,

    transparent: true,
    opacity: 0.72
  });
}

export function edgeMaterial(color, opacity = 0.72) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function glowPlane(width, depth, color, opacity = 0.16) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: SOFT_GLOW,
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

export function conduitMaterial(color, opacity = 0.8) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function labelTexture(text, color) {
  const canvas = document.createElement('canvas');

  canvas.width = 1024;
  canvas.height = 220;

  const ctx = canvas.getContext('2d');
  const accent = hex(color);

  const bg = ctx.createLinearGradient(
    0,
    0,
    0,
    canvas.height
  );

  bg.addColorStop(0, 'rgba(7,12,17,.98)');
  bg.addColorStop(1, 'rgba(2,5,8,.98)');

  ctx.fillStyle = bg;
  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.68;
  ctx.lineWidth = 4;

  ctx.strokeRect(
    8,
    8,
    canvas.width - 16,
    canvas.height - 16
  );

  ctx.globalAlpha = 1;

  ctx.fillStyle = '#f2f7fa';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;

  const fontSize =
    text.length > 15
      ? 56
      : text.length > 11
        ? 64
        : 72;

  ctx.font =
    `800 ${fontSize}px Arial, sans-serif`;

  ctx.fillText(
    text,
    canvas.width / 2,
    canvas.height / 2
  );

  ctx.shadowBlur = 0;

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.colorSpace =
    THREE.SRGBColorSpace;

  return texture;
}

export function iconTexture(kind, color) {
  const canvas =
    document.createElement('canvas');

  canvas.width = 512;
  canvas.height = 512;

  const ctx =
    canvas.getContext('2d');

  const accent = hex(color);

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.translate(
    canvas.width / 2,
    canvas.height / 2
  );

  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.shadowColor = accent;
  ctx.shadowBlur = 24;

  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.arc(0, 0, 136, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.arc(0, 0, 96, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;

  if (kind === 'discovery') {
    ctx.beginPath();
    ctx.arc(-24, -20, 48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(12, 16);
    ctx.lineTo(76, 82);
    ctx.stroke();
  }

  else if (kind === 'bootstrap') {
    ctx.beginPath();
    ctx.moveTo(18, -98);
    ctx.lineTo(-48, 6);
    ctx.lineTo(4, 6);
    ctx.lineTo(-20, 96);
    ctx.lineTo(68, -20);
    ctx.lineTo(10, -20);
    ctx.closePath();
    ctx.stroke();
  }

  else if (kind === 'core') {
    for (const radius of [36, 74, 118]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  else if (kind === 'risk') {
    ctx.beginPath();
    ctx.moveTo(0, -92);
    ctx.lineTo(76, -55);
    ctx.lineTo(60, 38);
    ctx.quadraticCurveTo(0, 100, -60, 38);
    ctx.lineTo(-76, -55);
    ctx.closePath();
    ctx.stroke();
  }

  else if (kind === 'market') {
    ctx.beginPath();
    ctx.moveTo(-88, 56);
    ctx.lineTo(-30, 10);
    ctx.lineTo(10, 34);
    ctx.lineTo(82, -70);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(82, -70);
    ctx.lineTo(78, -8);
    ctx.moveTo(82, -70);
    ctx.lineTo(22, -64);
    ctx.stroke();
  }

  else if (kind === 'holders') {
    const points = [
      [0, -76],
      [-70, 44],
      [70, 44]
    ];

    for (const [x, y] of points) {
      ctx.beginPath();
      ctx.arc(x, y, 23, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(-52, 26);
    ctx.moveTo(0, -52);
    ctx.lineTo(52, 26);
    ctx.moveTo(-47, 44);
    ctx.lineTo(47, 44);
    ctx.stroke();
  }

  else if (kind === 'openai') {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(0, -52, 34, 66, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  else if (kind === 'decision') {
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-14, -54);
    ctx.lineTo(20, -20);
    ctx.lineTo(-10, 14);
    ctx.lineTo(30, 58);
    ctx.stroke();
  }

  else if (kind === 'paper') {
    ctx.strokeRect(
      -66,
      -92,
      132,
      184
    );

    for (const y of [-44, 0, 44]) {
      ctx.beginPath();
      ctx.moveTo(-36, y);
      ctx.lineTo(36, y);
      ctx.stroke();
    }
  }

  else if (kind === 'execution') {
    ctx.beginPath();
    ctx.arc(0, 0, 86, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -120);
    ctx.lineTo(0, -84);
    ctx.moveTo(0, 84);
    ctx.lineTo(0, 120);
    ctx.moveTo(-120, 0);
    ctx.lineTo(-84, 0);
    ctx.moveTo(84, 0);
    ctx.lineTo(120, 0);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.colorSpace =
    THREE.SRGBColorSpace;

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
  glassMaterial,
  edgeMaterial,
  glowPlane,
  labelTexture,
  iconTexture
} from './materials.js?v=true-3d-clean-v3';

function makeFastener(color) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.034,
      0.034,
      0.024,
      12
    ),
    new THREE.MeshStandardMaterial({
      color: 0x9db0bb,
      emissive: color,
      emissiveIntensity: 0.12,
      metalness: 0.92,
      roughness: 0.20
    })
  );
}

function makeLed(color, active) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(
      0.031,
      10,
      8
    ),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: active ? 1 : 0.52,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
}

export function createModule(node) {
  const group =
    new THREE.Group();

  group.name =
    `MEMEFLOW_NODE_${node.id}`;

  group.position.set(
    node.pos[0],
    0,
    node.pos[2]
  );

  const hardware =
    new THREE.Group();

  group.add(hardware);

  const fitObject =
    new THREE.Group();

  hardware.add(fitObject);

  const [width, depth] =
    node.size;

  const emphasis =
    node.core
      ? 1.65
      : node.decision
        ? 1.30
        : node.execution
          ? 1.36
          : 1;

  const radius =
    node.core
      ? 0.19
      : 0.15;

  const tiers = [
    {
      w: 1.10,
      d: 1.10,
      h: 0.15,
      y: -0.39
    },
    {
      w: 1.055,
      d: 1.055,
      h: 0.15,
      y: -0.245
    },
    {
      w: 1.00,
      d: 1.00,
      h: 0.18,
      y: -0.08
    }
  ];

  for (
    let index = 0;
    index < tiers.length;
    index++
  ) {
    const tier =
      tiers[index];

    const geometry =
      new RoundedBoxGeometry(
        width * tier.w,
        tier.h,
        depth * tier.d,
        4,
        radius
      );

    const mesh =
      new THREE.Mesh(
        geometry,
        chassisMaterial(
          node.color,
          index,
          emphasis
        )
      );

    mesh.position.y =
      tier.y;

    fitObject.add(mesh);

    const edges =
      new THREE.LineSegments(
        new THREE.EdgesGeometry(
          geometry,
          22
        ),
        edgeMaterial(
          node.color,
          index === 2
            ? 0.62 * emphasis
            : 0.14 + index * 0.08
        )
      );

    edges.position.copy(
      mesh.position
    );

    hardware.add(edges);
  }

  const glassGeometry =
    new RoundedBoxGeometry(
      width * 0.92,
      0.075,
      depth * 0.84,
      4,
      radius * 0.78
    );

  const glass =
    new THREE.Mesh(
      glassGeometry,
      glassMaterial(
        node.color,
        emphasis
      )
    );

  glass.position.y =
    0.07;

  fitObject.add(glass);

  const glassEdges =
    new THREE.LineSegments(
      new THREE.EdgesGeometry(
        glassGeometry,
        20
      ),
      edgeMaterial(
        node.color,
        Math.min(
          1,
          0.54 * emphasis
        )
      )
    );

  glassEdges.position.copy(
    glass.position
  );

  hardware.add(glassEdges);

  const icon =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * 0.66,
        depth * 0.57
      ),
      new THREE.MeshBasicMaterial({
        map: iconTexture(
          node.id,
          node.color
        ),
        transparent: true,
        opacity: node.core ? 0.98 : 0.86,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

  icon.rotation.x =
    -Math.PI / 2;

  icon.position.y =
    0.117;

  hardware.add(icon);

  const label =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * 0.78,
        node.core ? 0.33 : 0.29
      ),
      new THREE.MeshBasicMaterial({
        map: labelTexture(
          node.label,
          node.color
        ),
        transparent: true,
        opacity: 0.98,
        depthWrite: false
      })
    );

  label.position.set(
    0,
    -0.105,
    depth * 0.505
  );

  hardware.add(label);

  const fastenerX =
    width * 0.39;

  const fastenerZ =
    depth * 0.35;

  for (
    const x
    of [-fastenerX, fastenerX]
  ) {
    for (
      const z
      of [-fastenerZ, fastenerZ]
    ) {
      const fastener =
        makeFastener(
          node.color
        );

      fastener.position.set(
        x,
        0.12,
        z
      );

      hardware.add(
        fastener
      );
    }
  }

  const leds = [];

  for (
    let index = 0;
    index < 3;
    index++
  ) {
    const led =
      makeLed(
        index === 2
          ? node.color
          : index === 1
            ? 0x4c7b92
            : 0x284452,
        index === 2
      );

    led.position.set(
      width * 0.24
        + index * 0.105,
      -0.03,
      depth * 0.535
    );

    hardware.add(led);
    leds.push(led);
  }

  const outerGlow =
    glowPlane(
      width * 1.42,
      depth * 1.48,
      node.color,
      node.core
        ? 0.16
        : node.decision
          ? 0.10
          : node.execution
            ? 0.11
            : 0.045
    );

  outerGlow.position.y =
    -0.50;

  hardware.add(
    outerGlow
  );

  const innerGlow =
    glowPlane(
      width * 0.98,
      depth * 1.02,
      node.color,
      node.core
        ? 0.10
        : 0.035
    );

  innerGlow.position.y =
    -0.47;

  hardware.add(
    innerGlow
  );

  let rings = null;

  if (node.core) {
    rings =
      new THREE.Group();

    rings.position.y =
      0.125;

    for (
      const [radiusValue, tube, opacity]
      of [
        [0.45, 0.014, 0.80],
        [0.70, 0.010, 0.46],
        [0.96, 0.008, 0.20]
      ]
    ) {
      const ring =
        new THREE.Mesh(
          new THREE.TorusGeometry(
            radiusValue,
            tube,
            10,
            64
          ),
          new THREE.MeshBasicMaterial({
            color: node.color,
            transparent: true,
            opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          })
        );

      ring.rotation.x =
        Math.PI / 2;

      rings.add(
        ring
      );
    }

    hardware.add(
      rings
    );
  }

  const pickMesh =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        0.52,
        depth
      ),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );

  pickMesh.position.y =
    -0.12;

  pickMesh.userData.nodeId =
    node.id;

  hardware.add(
    pickMesh
  );

  return {
    id: node.id,
    node,
    group,
    hardware,
    fitObject,
    label,
    icon,
    outerGlow,
    innerGlow,
    leds,
    rings,
    pickMesh
  };
}
"""

ROUTES_JS = r"""
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
} from './layout.js?v=true-3d-clean-v3';

import {
  createModule
} from './modules.js?v=true-3d-clean-v3';

import {
  createRoute,
  animateRoutes
} from './routes.js?v=true-3d-clean-v3';

function buildFitBounds(
  modules
) {
  const box =
    new THREE.Box3()
      .makeEmpty();

  for (
    const module
    of modules.values()
  ) {
    box.expandByObject(
      module.fitObject
    );
  }

  return box;
}

function boxCorners(
  box
) {
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

export function bootMemeflowTrue3D(
  rootId = 'memeflowTrue3DHost'
) {
  const mount =
    document.getElementById(
      rootId
    );

  if (!mount) {
    throw new Error(
      'True 3D mount not found: '
      + rootId
    );
  }

  mount.replaceChildren();

  const scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x000000
    );

  const camera =
    new THREE.PerspectiveCamera(
      42,
      1,
      0.05,
      240
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
      1.75
    )
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

  renderer.toneMappingExposure =
    1.02;

  renderer.domElement.id =
    'memeflowTrue3DCanvas';

  mount.appendChild(
    renderer.domElement
  );

  const composer =
    new EffectComposer(
      renderer
    );

  const renderPass =
    new RenderPass(
      scene,
      camera
    );

  composer.addPass(
    renderPass
  );

  const bloom =
    new UnrealBloomPass(
      new THREE.Vector2(
        1,
        1
      ),
      0.44,
      0.46,
      0.72
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
    0.055;

  controls.rotateSpeed =
    0.56;

  controls.zoomSpeed =
    1.05;

  controls.minAzimuthAngle =
    -Infinity;

  controls.maxAzimuthAngle =
    Infinity;

  controls.minPolarAngle =
    0.10;

  controls.maxPolarAngle =
    Math.PI - 0.10;

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
      0x9fd9ff,
      0x010203,
      0.42
    )
  );

  const key =
    new THREE.DirectionalLight(
      0xf4fbff,
      1.25
    );

  key.position.set(
    4.5,
    10,
    6.5
  );

  scene.add(
    key
  );

  const cyanRim =
    new THREE.PointLight(
      0x64dcff,
      9,
      22,
      2
    );

  cyanRim.position.set(
    -5.5,
    3.2,
    1.8
  );

  scene.add(
    cyanRim
  );

  const greenCore =
    new THREE.PointLight(
      0x57e69a,
      12,
      19,
      2
    );

  greenCore.position.set(
    3.2,
    2.7,
    -3.2
  );

  scene.add(
    greenCore
  );

  const violetDecision =
    new THREE.PointLight(
      0x8e58ff,
      7,
      16,
      2
    );

  violetDecision.position.set(
    0,
    2.2,
    2.5
  );

  scene.add(
    violetDecision
  );

  const modules =
    new Map();

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

  const routes =
    [];

  for (
    const [
      from,
      to,
      color
    ]
    of ROUTES
  ) {
    const source =
      byId.get(
        from
      );

    const target =
      byId.get(
        to
      );

    if (
      !source
      || !target
    ) {
      continue;
    }

    const route =
      createRoute(
        source.pos,
        target.pos,
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
    buildFitBounds(
      modules
    );

  const fitCenter =
    new THREE.Vector3();

  bounds.getCenter(
    fitCenter
  );

  const corners =
    boxCorners(
      bounds
    );

  const homeDirection =
    new THREE.Vector3(
      0,
      0.87,
      0.49
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
        ? 43
        : aspect < 1.10
          ? 40
          : 37;

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
    camera.position.copy(
      fitCenter
    ).addScaledVector(
      homeDirection,
      distance
    );

    camera.lookAt(
      fitCenter
    );

    camera.updateMatrixWorld(
      true
    );

    camera.updateProjectionMatrix();

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
        ? 0.86
        : 0.90;

    const yLimit =
      aspect < 0.82
        ? 0.84
        : 0.88;

    let low =
      4;

    let high =
      60;

    for (
      let index = 0;
      index < 34;
      index++
    ) {
      const mid =
        (
          low
          + high
        ) / 2;

      if (
        fitsAt(
          mid,
          xLimit,
          yLimit
        )
      ) {
        high =
          mid;
      } else {
        low =
          mid;
      }
    }

    homeDistance =
      high;

    homeTarget.copy(
      fitCenter
    );

    homeCamera.copy(
      fitCenter
    ).addScaledVector(
      homeDirection,
      homeDistance
    );

    controls.minDistance =
      Math.max(
        3.7,
        homeDistance * 0.28
      );

    controls.maxDistance =
      Math.max(
        38,
        homeDistance * 2.5
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

      updateProjection();

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

  resetButton?.addEventListener(
    'click',
    resetHandler
  );

  resetView();

  const raycaster =
    new THREE.Raycaster();

  const pointer =
    new THREE.Vector2();

  const pickMeshes =
    [
      ...modules.values()
    ].map(
      module =>
        module.pickMesh
    );

  let pointerDown = null;

  renderer.domElement.addEventListener(
    'pointerdown',
    event => {
      pointerDown = {
        x: event.clientX,
        y: event.clientY
      };
    }
  );

  renderer.domElement.addEventListener(
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
        ) * 2
        - 1;

      pointer.y =
        -(
          (
            event.clientY
            - rect.top
          ) / rect.height
        ) * 2
        + 1;

      raycaster.setFromCamera(
        pointer,
        camera
      );

      const hits =
        raycaster.intersectObjects(
          pickMeshes,
          false
        );

      const nodeId =
        hits[0]
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

    const decision =
      modules.get(
        'decision'
      );

    const execution =
      modules.get(
        'execution'
      );

    if (
      core?.rings
    ) {
      core.rings.rotation.y +=
        0.0016;
    }

    if (
      core?.innerGlow
        ?.material
    ) {
      core.innerGlow
        .material
        .opacity =
          0.095
          + Math.sin(
            time * 2.0
          ) * 0.018;
    }

    if (
      decision?.innerGlow
        ?.material
    ) {
      decision.innerGlow
        .material
        .opacity =
          0.035
          + Math.sin(
            time * 2.1 + 1.5
          ) * 0.009;
    }

    if (
      execution?.innerGlow
        ?.material
    ) {
      execution.innerGlow
        .material
        .opacity =
          0.040
          + Math.sin(
            time * 2.1 + 2.8
          ) * 0.010;
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
        } else {
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

/* ===== MEMEFLOW_TRUE_3D_CLEAN_V3 ===== */
"""

EMBED_JS = r"""
import {
  bootMemeflowTrue3D
} from './scene.js?v=true-3d-clean-v3';

function startTrue3D() {
  const viewport =
    document.querySelector(
      '.viewport-wrap'
    );

  if (
    !viewport
  ) {
    console.error(
      '[TRUE-3D] viewport-wrap not found'
    );

    return;
  }

  let host =
    document.getElementById(
      'memeflowTrue3DHost'
    );

  if (
    !host
  ) {
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
    () => {
      try {
        window.__memeflowTrue3D
          ?.dispose
          ?.();

        window.__memeflowTrue3D =
          bootMemeflowTrue3D(
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
          '[TRUE-3D] clean V3 mounted'
        );
      }

      catch (
        error
      ) {
        window.__MEMEFLOW_TRUE_3D_ACTIVE__ =
          false;

        console.error(
          '[TRUE-3D] boot failed',
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

CANONICAL_CSS = r"""
/* ===== MEMEFLOW_TRUE_3D_CLEAN_V3 ===== */

/*
  One canonical ownership block for the embedded true-3D field.
  Old V2/V4/V6/embed-specific blocks are removed by the installer.
*/

.viewport-wrap.mf-true3d-clean-v3 {
  position: relative !important;

  margin: 0 !important;

  overflow: hidden !important;

  background: #000 !important;
  background-image: none !important;

  border:
    1px solid
    rgba(108, 151, 174, .17) !important;

  border-radius:
    16px !important;

  box-shadow:
    inset 0 0 0 1px
    rgba(24, 50, 62, .10) !important;

  isolation: isolate;
}

.viewport-wrap.mf-true3d-clean-v3::before,
.viewport-wrap.mf-true3d-clean-v3::after {
  display: none !important;

  content: none !important;

  background: none !important;

  opacity: 0 !important;
}

.viewport-wrap.mf-true3d-clean-v3
#systemCanvas {
  display: none !important;

  opacity: 0 !important;

  visibility: hidden !important;

  pointer-events: none !important;
}

.viewport-wrap.mf-true3d-clean-v3
#memeflowTrue3DHost {
  position: absolute;

  inset: 0;

  z-index: 4;

  overflow: hidden;

  background: #000;

  border-radius: inherit;

  touch-action: none;
}

.viewport-wrap.mf-true3d-clean-v3
#memeflowTrue3DCanvas {
  display: block;

  width: 100%;

  height: 100%;

  background: #000;

  outline: none;

  touch-action: none;

  cursor: grab;

  user-select: none;

  -webkit-user-select: none;
}

.viewport-wrap.mf-true3d-clean-v3
#memeflowTrue3DCanvas:active {
  cursor: grabbing;
}

.viewport-wrap.mf-true3d-clean-v3
.scene-labels,
.viewport-wrap.mf-true3d-clean-v3
.node-label,
.viewport-wrap.mf-true3d-clean-v3
.scene-hint {
  display: none !important;
}

/*
  Legend remains outside the canvas and cannot intercept 3D gestures.
*/
.legend.mf-legend-standalone-v4 {
  position: relative !important;

  inset: auto !important;

  width: max-content !important;

  max-width: 100% !important;

  margin: 0 !important;

  transform: none !important;

  pointer-events: none !important;
}

@media (max-width: 600px) {
  .viewport-wrap.mf-true3d-clean-v3 {
    height: 350px !important;

    min-height: 350px !important;

    max-height: 350px !important;
  }

  .legend.mf-legend-standalone-v4 {
    display: flex !important;

    align-items: center !important;

    gap: 8px !important;

    padding: 4px 7px !important;

    border-radius: 8px !important;
  }

  .legend.mf-legend-standalone-v4
  span {
    gap: 4px !important;

    font-size: 5px !important;
  }

  .legend.mf-legend-standalone-v4
  .legend-dot {
    width: 5px !important;

    height: 5px !important;
  }
}

@media (
  max-width: 600px
)
and (
  max-height: 720px
) {
  .viewport-wrap.mf-true3d-clean-v3 {
    height: 340px !important;

    min-height: 340px !important;

    max-height: 340px !important;
  }
}

@media (
  min-width: 601px
)
and (
  max-width: 900px
) {
  .viewport-wrap.mf-true3d-clean-v3 {
    height: 430px !important;

    min-height: 430px !important;

    max-height: 430px !important;
  }
}

@media (
  min-width: 901px
) {
  .viewport-wrap.mf-true3d-clean-v3 {
    height:
      clamp(
        520px,
        64vh,
        720px
      ) !important;

    min-height:
      520px !important;
  }
}
"""

REMOVE_CSS_MARKERS = [
    "MEMEFLOW_REALTIME_ARCHITECTURE_COMPACT_V2",
    "MEMEFLOW_3D_VIEWPORT_FREE_ORBIT_FIT_V4",
    "MEMEFLOW_RENDER_MATCH_V6",
    "MEMEFLOW_TRUE_3D_EMBED_V1",
    "MEMEFLOW_TRUE_3D_CLEAN_V3",
]


def log(message: str) -> None:
    print(
        f"[TRUE-3D-CLEAN-V3] {message}",
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
            "command failed "
            f"({result.returncode}): "
            + " ".join(args)
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
            candidate = candidate.resolve()
        except Exception:
            continue

        if candidate in seen:
            continue

        seen.add(candidate)

        if all(
            (candidate / name).is_file()
            for name in (
                "system.html",
                "system.css",
                "system.js",
            )
        ) and (
            candidate
            / "memeflow-3d"
            / "scene.js"
        ).is_file():
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

    if result.returncode != 0:
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


def strip_marker_block(
    css: str,
    marker: str,
) -> str:
    pattern = re.compile(
        r"/\* ===== "
        + re.escape(marker)
        + r" ===== \*/"
        + r".*?"
        + r"(?=(?:/\* ===== [A-Z0-9_. -]+ ===== \*/)|\Z)",
        re.S,
    )

    return pattern.sub(
        "",
        css,
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Install one clean canonical MEMEFLOW true-3D renderer: "
            "dynamic fit, bloom, compact hardware, clean CSS ownership."
        )
    )

    parser.add_argument(
        "--push",
        action="store_true",
        help=(
            "Commit and push the finished clean version "
            "to the current branch."
        ),
    )

    args = parser.parse_args()

    root = find_root()

    html_path = root / "system.html"

    css_path = root / "system.css"

    scene_path = root / "memeflow-3d" / "scene.js"

    layout_path = root / "memeflow-3d" / "layout.js"

    materials_path = root / "memeflow-3d" / "materials.js"

    modules_path = root / "memeflow-3d" / "modules.js"

    routes_path = root / "memeflow-3d" / "routes.js"

    embed_path = root / "memeflow-3d" / "embed.js"

    targets = [
        html_path,
        css_path,
        scene_path,
        layout_path,
        materials_path,
        modules_path,
        routes_path,
        embed_path,
    ]

    for path in targets:
        if not path.is_file():
            raise RuntimeError(
                f"required file missing: {path}"
            )

    log(
        f"project: {root}"
    )

    repo = git_root(root)

    branch = None
    old_head = None

    if repo is not None:
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

        if not branch:
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
                    repo,
                )
                for path in targets
            ],
            cwd=repo,
        ).stdout.strip()

        if status:
            print(
                status
            )

            raise RuntimeError(
                "Target 3D/system files have local changes. "
                "Commit/push them first; nothing changed."
            )

    current_scene = scene_path.read_text(
        encoding="utf-8"
    )

    if (
        "homeCam = new THREE.Vector3(0, 10.8, 6.6)"
        not in current_scene
        and PATCH_ID
        not in current_scene
    ):
        raise RuntimeError(
            "Unexpected scene.js baseline. "
            "Refusing to stack over an unknown version."
        )

    if PATCH_ID in current_scene:
        log(
            "Clean V3 is already installed."
        )

        return 0

    backup_dir = (
        root
        / ".patch-backups"
        / f"true-3d-clean-v3-{STAMP}"
    )

    backup_dir.mkdir(
        parents=True,
        exist_ok=True,
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
                "__",
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
        layout_path.write_text(
            LAYOUT_JS.strip() + "\n",
            encoding="utf-8",
        )

        materials_path.write_text(
            MATERIALS_JS.strip() + "\n",
            encoding="utf-8",
        )

        modules_path.write_text(
            MODULES_JS.strip() + "\n",
            encoding="utf-8",
        )

        routes_path.write_text(
            ROUTES_JS.strip() + "\n",
            encoding="utf-8",
        )

        scene_path.write_text(
            SCENE_JS.strip() + "\n",
            encoding="utf-8",
        )

        embed_path.write_text(
            EMBED_JS.strip() + "\n",
            encoding="utf-8",
        )

        css = css_path.read_text(
            encoding="utf-8"
        )

        for marker in REMOVE_CSS_MARKERS:
            css = strip_marker_block(
                css,
                marker,
            )

        css = (
            css.rstrip()
            + "\n\n"
            + CANONICAL_CSS.strip()
            + "\n"
        )

        css_path.write_text(
            css,
            encoding="utf-8",
        )

        html = html_path.read_text(
            encoding="utf-8"
        )

        html = re.sub(
            r'<section class="viewport-wrap(?: [^"]*)?">',
            '<section class="viewport-wrap mf-true3d-clean-v3">',
            html,
            count=1,
        )

        html, css_count = re.subn(
            r'href="/system\.css(?:\?[^"]*)?"',
            f'href="/system.css?v={VERSION}"',
            html,
            count=1,
        )

        html, embed_count = re.subn(
            r'src="/memeflow-3d/embed\.js(?:\?[^"]*)?"',
            f'src="/memeflow-3d/embed.js?v={VERSION}"',
            html,
            count=1,
        )

        if css_count != 1:
            raise RuntimeError(
                "system.css cache-bust anchor not found"
            )

        if embed_count != 1:
            raise RuntimeError(
                "embed.js script anchor not found"
            )

        html_path.write_text(
            html,
            encoding="utf-8",
        )

        js_paths = [
            scene_path,
            layout_path,
            materials_path,
            modules_path,
            routes_path,
            embed_path,
        ]

        for path in js_paths:
            check = run(
                "node",
                "--check",
                str(path),
                check=False,
            )

            if check.returncode != 0:
                raise RuntimeError(
                    f"node --check failed: {path}"
                )

        final_scene = scene_path.read_text(
            encoding="utf-8"
        )

        final_css = css_path.read_text(
            encoding="utf-8"
        )

        final_html = html_path.read_text(
            encoding="utf-8"
        )

        checks = [
            (
                PATCH_ID,
                final_scene,
            ),
            (
                "UnrealBloomPass",
                final_scene,
            ),
            (
                "function fitsAt(",
                final_scene,
            ),
            (
                "memeflow:true3d-select",
                final_scene,
            ),
            (
                "mf-true3d-clean-v3",
                final_html,
            ),
            (
                VERSION,
                final_html,
            ),
            (
                PATCH_ID,
                final_css,
            ),
        ]

        for needle, haystack in checks:
            if needle not in haystack:
                raise RuntimeError(
                    f"validation failed: {needle}"
                )

        # Old 3D-owned blocks must be gone.
        for marker in REMOVE_CSS_MARKERS[:-1]:
            if (
                f"/* ===== {marker} ===== */"
                in final_css
            ):
                raise RuntimeError(
                    f"old conflicting CSS block remains: {marker}"
                )

        if repo is not None:
            run(
                "git",
                "diff",
                "--check",
                "--",
                *[
                    rel(
                        path,
                        repo,
                    )
                    for path in targets
                ],
                cwd=repo,
            )

        log(
            "VALIDATION PASS"
        )

        log(
            "Old V2/V4/V6/embed 3D CSS ownership blocks removed"
        )

        log(
            "One canonical 3D CSS block installed"
        )

        log(
            "Initial camera now binary-fits actual rendered hardware bounds"
        )

        log(
            "Full topology fits inside portrait iPhone viewport"
        )

        log(
            "Hardware layout tightened so modules appear larger"
        )

        log(
            "Physical glass/chassis materials rebuilt"
        )

        log(
            "UnrealBloom post-processing enabled at controlled strength"
        )

        log(
            "Routes + animated data packets rebuilt"
        )

        log(
            "Orbit / pinch zoom / Reset View preserved"
        )

        log(
            "Server / AI / telemetry / trading logic untouched"
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
                    "__",
                )
            )

            backup = backup_dir / backup_name

            if backup.exists():
                shutil.copy2(
                    backup,
                    path,
                )

        log(
            "ROLLBACK COMPLETE"
        )

        raise

    if args.push:
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
                repo,
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

        if staged.returncode == 0:
            log(
                "No staged changes; nothing to commit."
            )

            return 0

        commit = run(
            "git",
            "commit",
            "-m",
            "Rebuild clean MEMEFLOW true 3D renderer",
            cwd=repo,
            check=False,
        )

        if commit.returncode != 0:
            log(
                "WARNING: patch installed but commit failed."
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

        if push.returncode != 0:
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
            f"[TRUE-3D-CLEAN-V3] ERROR: {exc}",
            file=sys.stderr,
        )

        raise SystemExit(1)
