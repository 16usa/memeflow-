#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_RENDER_MATCH_V6"
STAMP = time.strftime("%Y%m%d-%H%M%S")

V6_HELPERS = r'''
/* ===== MEMEFLOW_RENDER_MATCH_V6 HELPERS ===== */

function mf6Hex(value) {
  return '#' + Number(value).toString(16).padStart(6, '0');
}

function mf6MakeLabelTexture(id, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 220;

  const ctx = canvas.getContext('2d');
  const accent = mf6Hex(color);
  const label = MF20_LABELS[id] || id.toUpperCase();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, 'rgba(5,10,14,0.96)');
  bg.addColorStop(1, 'rgba(2,5,8,0.98)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.88;
  ctx.lineWidth = 6;
  ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
  ctx.globalAlpha = 1;

  ctx.shadowColor = accent;
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#f3f8fb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fontSize =
    label.length > 15
      ? 58
      : label.length > 11
        ? 66
        : 74;

  ctx.font = `800 ${fontSize}px Arial`;
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function mf6GlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 124);

  g.addColorStop(0.00, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.38)');
  g.addColorStop(0.52, 'rgba(255,255,255,0.10)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const MF6_GLOW_TEXTURE = mf6GlowTexture();

function mf6SoftGlow(width, depth, color, opacity) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: MF6_GLOW_TEXTURE,
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

function mf6ShellMaterial(color, core = false, top = false) {
  return new THREE.MeshPhysicalMaterial({
    color: top
      ? core ? 0x0a251c : 0x07131d
      : 0x03090d,
    emissive: color,
    emissiveIntensity:
      top
        ? core ? 0.34 : 0.16
        : core ? 0.11 : 0.055,
    metalness: top ? 0.32 : 0.58,
    roughness: top ? 0.14 : 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    transparent: true,
    opacity: top ? 0.78 : 0.98
  });
}

function mf6BrightLine(color, opacity) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function mf6AddCoreRings(hardware, color) {
  const group = new THREE.Group();
  group.position.y = 0.19;

  for (const [radius, tube, opacity] of [
    [0.63, 0.024, 0.92],
    [0.84, 0.018, 0.62],
    [1.04, 0.013, 0.32]
  ]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 10, 72),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  hardware.add(group);
  return group;
}

function mf6HideLegacyDomLabels() {
  const labels = document.getElementById('labels');
  if (labels) labels.setAttribute('aria-hidden', 'true');
}
'''

NEW_BUILD_MODULE = r'''
function mf20BuildModule(id) {
  const node = app.nodes.get(id);
  if (!node?.group) return;

  const color = MF20_NODE_COLOR[id];
  const core = id === 'core';
  const decision = id === 'decision';
  const execution = id === 'execution';

  node.group.position.set(...MF20_LAYOUT[id]);
  node.group.scale.set(1, 1, 1);
  mf20HideExistingNode(node);

  const hardware = new THREE.Group();
  hardware.name = 'MF20_HARDWARE_' + id;

  const width =
    core ? 3.45 :
    decision ? 2.72 :
    execution ? 2.82 : 2.66;

  const depth =
    core ? 2.30 :
    decision ? 1.82 :
    execution ? 1.84 : 1.76;

  const radius = core ? 0.22 : 0.17;

  const tiers = [
    { w: 1.12, d: 1.12, h: 0.19, y: -0.47, glow: 0.16 },
    { w: 1.065, d: 1.065, h: 0.18, y: -0.285, glow: 0.26 },
    { w: 1.00, d: 1.00, h: 0.22, y: -0.09, glow: 0.50 }
  ];

  const bodies = [];
  const edgeLayers = [];

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];

    const geometry = new RoundedBoxGeometry(
      width * tier.w,
      tier.h,
      depth * tier.d,
      4,
      radius
    );

    const body = new THREE.Mesh(
      geometry,
      mf6ShellMaterial(color, core, i === 2)
    );

    body.position.y = tier.y;
    body.renderOrder = 4 + i;
    hardware.add(body);
    bodies.push(body);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 22),
      mf6BrightLine(
        color,
        core
          ? Math.min(1, tier.glow + 0.26)
          : decision || execution
            ? Math.min(1, tier.glow + 0.15)
            : tier.glow
      )
    );

    edges.position.copy(body.position);
    edges.renderOrder = 9;
    hardware.add(edges);
    edgeLayers.push(edges);
  }

  const glassGeometry = new RoundedBoxGeometry(
    width * 0.94,
    0.11,
    depth * 0.89,
    4,
    radius * 0.86
  );

  const glass = new THREE.Mesh(
    glassGeometry,
    new THREE.MeshPhysicalMaterial({
      color: core ? 0x0b2f22 : 0x081723,
      emissive: color,
      emissiveIntensity:
        core ? 0.40 :
        decision ? 0.27 :
        execution ? 0.32 : 0.18,
      metalness: 0.18,
      roughness: 0.10,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      transparent: true,
      opacity: core ? 0.68 : 0.58
    })
  );

  glass.position.y = 0.105;
  glass.renderOrder = 7;
  hardware.add(glass);

  const glassEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(glassGeometry, 22),
    mf6BrightLine(
      color,
      core ? 1.00 :
      decision ? 0.94 :
      execution ? 0.96 : 0.82
    )
  );

  glassEdges.position.copy(glass.position);
  glassEdges.renderOrder = 11;
  hardware.add(glassEdges);

  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(
      width * 0.78,
      depth * 0.69
    ),
    new THREE.MeshBasicMaterial({
      map: mf20MakeTopTexture(id, color),
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  display.rotation.x = -Math.PI / 2;
  display.position.y = 0.168;
  display.renderOrder = 13;
  hardware.add(display);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(
      width * 0.78,
      core ? 0.38 : 0.34
    ),
    new THREE.MeshBasicMaterial({
      map: mf6MakeLabelTexture(id, color),
      transparent: true,
      opacity: 1,
      depthWrite: false
    })
  );

  label.position.set(0, -0.115, depth * 0.505);
  label.renderOrder = 14;
  hardware.add(label);

  const boltX = width * 0.405;
  const boltZ = depth * 0.375;

  for (const x of [-boltX, boltX]) {
    for (const z of [-boltZ, boltZ]) {
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.040, 0.040, 0.028, 12),
        new THREE.MeshStandardMaterial({
          color: 0x9bb5c2,
          emissive: color,
          emissiveIntensity: 0.18,
          metalness: 0.92,
          roughness: 0.16
        })
      );

      bolt.position.set(x, 0.175, z);
      hardware.add(bolt);
    }
  }

  const leds = [];

  for (let index = 0; index < 3; index++) {
    const ledColor =
      index === 2
        ? color
        : index === 1
          ? 0x4e819a
          : 0x315565;

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 10, 8),
      new THREE.MeshBasicMaterial({
        color: ledColor,
        transparent: true,
        opacity: index === 2 ? 1 : 0.74,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    led.position.set(
      width * 0.27 + index * 0.13,
      -0.005,
      depth * 0.535
    );

    hardware.add(led);
    leds.push(led);
  }

  const underside = mf6SoftGlow(
    width * 1.62,
    depth * 1.72,
    color,
    core ? 0.27 :
    decision ? 0.20 :
    execution ? 0.23 : 0.115
  );

  underside.position.y = -0.59;
  underside.renderOrder = 1;
  hardware.add(underside);

  const innerGlow = mf6SoftGlow(
    width * 1.14,
    depth * 1.18,
    color,
    core ? 0.22 : 0.095
  );

  innerGlow.position.y = -0.545;
  innerGlow.renderOrder = 2;
  hardware.add(innerGlow);

  let coreRings = null;
  if (core) coreRings = mf6AddCoreRings(hardware, color);

  node.group.add(hardware);

  MF20.hardware.set(id, {
    group: hardware,
    display,
    label,
    underside,
    innerGlow,
    glass,
    glassEdges,
    bodies,
    edgeLayers,
    leds,
    coreRings,
    color
  });
}
'''

NEW_WEB_CURVE = r'''
function webCurveV31(edge, index = 0) {
  const a = webPointV31(edge.from);
  const b = webPointV31(edge.to);
  const points = [a];

  const dx = Math.abs(b.x - a.x);
  const dz = Math.abs(b.z - a.z);

  if (dx < 0.22 || dz < 0.22) {
    points.push(a.clone().lerp(b, 0.5));
  } else if (dx >= dz) {
    const mx = a.x + (b.x - a.x) * 0.52;

    points.push(
      new THREE.Vector3(mx, a.y + 0.03, a.z),
      new THREE.Vector3(mx, b.y + 0.03, b.z)
    );
  } else {
    const mz = a.z + (b.z - a.z) * 0.50;

    points.push(
      new THREE.Vector3(a.x, a.y + 0.03, mz),
      new THREE.Vector3(b.x, b.y + 0.03, mz)
    );
  }

  points.push(b);

  return new THREE.CatmullRomCurve3(
    points,
    false,
    'catmullrom',
    0.035
  );
}
'''

NEW_BUILD_WEB = r'''
function buildWebV31() {
  if (!app.scene || !app.nodes?.size) return;

  clearWebV31();
  mf5HideLegacyPipes();

  const group = new THREE.Group();
  group.name = 'MEMEFLOW_REAL_EVENT_WEB_V31';
  app.scene.add(group);
  REAL_WEB_V31.group = group;

  WEB_EDGES_V31.forEach((edge, index) => {
    const curve = webCurveV31(edge, index);
    const points = curve.getPoints(110);

    const color =
      edge.key === 'decision:paper'
        ? COLORS.purple
        : edge.key === 'paper:execution'
          ? COLORS.green
          : edge.key === 'core:holders' ||
            edge.key === 'core:market' ||
            edge.key === 'risk:decision'
            ? COLORS.green
            : edge.color;

    const outer = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        96,
        webMobileV31() ? 0.080 : 0.090,
        10,
        false
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.085,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    outer.renderOrder = 2;
    group.add(outer);

    const pipe = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        96,
        webMobileV31() ? 0.030 : 0.036,
        9,
        false
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: edge.key === 'paper:execution' ? 0.92 : 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    pipe.renderOrder = 5;
    group.add(pipe);

    const baseGeometry =
      new THREE.BufferGeometry().setFromPoints(points);

    const base = new THREE.Line(
      baseGeometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    base.renderOrder = 7;
    group.add(base);

    const hotGeometry =
      new THREE.BufferGeometry().setFromPoints(points);

    hotGeometry.setDrawRange(0, 0);

    const hot = new THREE.Line(
      hotGeometry,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    hot.renderOrder = 12;
    group.add(hot);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(
        webMobileV31() ? 0.085 : 0.098,
        12,
        10
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    head.visible = false;
    head.renderOrder = 13;
    group.add(head);

    const idleDots = [];

    for (let dotIndex = 0; dotIndex < 5; dotIndex++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(
          webMobileV31() ? 0.046 : 0.054,
          10,
          8
        ),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.68,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      dot.userData.mf6 = {
        seed:
          (
            dotIndex / 5 +
            index * 0.061
          ) % 1,
        speed:
          edge.key === 'paper:execution'
            ? 0.070
            : 0.088 + (index % 3) * 0.010
      };

      dot.renderOrder = 10;
      group.add(dot);
      idleDots.push(dot);
    }

    REAL_WEB_V31.edges.set(edge.key, {
      ...edge,
      color,
      curve,
      points,
      outer,
      pipe,
      base,
      hot,
      head,
      idleDots,
      active: false,
      startedAt: 0,
      durationMs: 95,
      fadeStartedAt: 0,
      fadeMs: 150,
      boost: 1,
      lastShotAt: 0
    });
  });
}
'''

NEW_ANIMATE_WEB = r'''
function animateWebV31(now) {
  REAL_WEB_V31.frame = requestAnimationFrame(animateWebV31);

  if (document.hidden || !REAL_WEB_V31.installed) return;
  if ((now - REAL_WEB_V31.lastFrameAt) < 32) return;

  REAL_WEB_V31.lastFrameAt = now;
  const seconds = now * 0.001;

  for (const entry of REAL_WEB_V31.edges.values()) {
    for (let index = 0; index < (entry.idleDots || []).length; index++) {
      const dot = entry.idleDots[index];
      const data = dot.userData.mf6 || {};

      const t =
        (
          Number(data.seed || 0) +
          seconds * Number(data.speed || 0.09)
        ) % 1;

      dot.position.copy(entry.curve.getPointAt(t));

      const pulse =
        0.84 +
        Math.sin(
          seconds * 8.5 +
          index * 1.7 +
          t * 12
        ) * 0.16;

      dot.scale.setScalar(
        entry.active
          ? 1.42 + pulse * 0.18
          : 0.92 + pulse * 0.12
      );

      dot.material.opacity =
        entry.active
          ? 0.96
          : 0.48 + pulse * 0.20;
    }

    if (!entry.active) continue;

    const elapsed = now - entry.startedAt;
    const p = webClampV31(
      elapsed / entry.durationMs,
      0,
      1
    );

    if (p < 1) {
      const count = Math.max(
        2,
        Math.floor(entry.points.length * p)
      );

      entry.hot.geometry.setDrawRange(0, count);
      entry.hot.material.opacity =
        Math.min(1, 0.98 * entry.boost);

      const headP =
        entry.curve.getPointAt(
          Math.min(0.999, p)
        );

      entry.head.position.copy(headP);
      entry.head.material.opacity =
        Math.min(1, 1.0 * entry.boost);

      entry.head.scale.setScalar(
        1.0 + 0.36 * entry.boost
      );

      continue;
    }

    if (!entry.fadeStartedAt) {
      entry.fadeStartedAt = now;
      entry.hot.geometry.setDrawRange(
        0,
        entry.points.length
      );
    }

    const fade = webClampV31(
      1 - (
        (now - entry.fadeStartedAt) /
        entry.fadeMs
      ),
      0,
      1
    );

    entry.hot.material.opacity =
      fade * 0.82 * entry.boost;

    entry.head.material.opacity =
      fade * 0.96 * entry.boost;

    if (fade <= 0) {
      entry.active = false;
      entry.boost = 1;
      entry.head.visible = false;
      entry.hot.geometry.setDrawRange(0, 0);
    }
  }

  for (const id of ['core', 'decision', 'execution']) {
    const hardware = MF20?.hardware?.get?.(id);
    if (!hardware?.innerGlow?.material) continue;

    const base =
      id === 'core'
        ? 0.19
        : id === 'decision'
          ? 0.12
          : 0.14;

    hardware.innerGlow.material.opacity =
      base +
      Math.sin(
        seconds * 2.1 +
        (id === 'core' ? 0 : id === 'decision' ? 1.8 : 3.2)
      ) * 0.035;

    if (hardware.coreRings) {
      hardware.coreRings.rotation.y += 0.0025;
    }
  }

  applyNodeFlashV31(now);
}
'''

CSS_BLOCK = r'''
/* ===== MEMEFLOW_RENDER_MATCH_V6 ===== */

/* Old floating pill labels are not part of the approved 3D render. */
.viewport-wrap .scene-labels,
.viewport-wrap .node-label {
  display: none !important;
}

/* Pure black viewport; no page-layout changes. */
.viewport-wrap,
#systemCanvas {
  background: #000 !important;
  background-image: none !important;
}

#systemCanvas {
  touch-action: none !important;
  cursor: grab;
}

#systemCanvas:active {
  cursor: grabbing;
}
'''

REPLACEMENTS = {
    "discovery: { pos:[-3.75, 0.08, -3.70], scale:0.67 }":
    "discovery: { pos:[-3.42, 0.08, -3.45], scale:0.82 }",
    "bootstrap: { pos:[ 0.00, 0.08, -3.70], scale:0.67 }":
    "bootstrap: { pos:[ 0.00, 0.08, -3.45], scale:0.82 }",
    "core:      { pos:[ 3.75, 0.12, -3.70], scale:0.82 }":
    "core:      { pos:[ 3.42, 0.12, -3.45], scale:0.92 }",
    "risk:      { pos:[-3.75, 0.05, -0.70], scale:0.65 }":
    "risk:      { pos:[-3.42, 0.05, -0.55], scale:0.80 }",
    "market:    { pos:[ 0.00, 0.05, -0.70], scale:0.65 }":
    "market:    { pos:[ 0.00, 0.05, -0.55], scale:0.80 }",
    "holders:   { pos:[ 3.75, 0.05, -0.70], scale:0.65 }":
    "holders:   { pos:[ 3.42, 0.05, -0.55], scale:0.80 }",
    "openai:    { pos:[-3.75, 0.03,  2.30], scale:0.63 }":
    "openai:    { pos:[-3.42, 0.03,  2.35], scale:0.78 }",
    "decision:  { pos:[ 0.00, 0.03,  2.30], scale:0.70 }":
    "decision:  { pos:[ 0.00, 0.03,  2.35], scale:0.86 }",
    "paper:     { pos:[ 3.75, 0.03,  2.30], scale:0.63 }":
    "paper:     { pos:[ 3.42, 0.03,  2.35], scale:0.78 }",
    "execution: { pos:[ 0.00, 0.03,  5.20], scale:0.69 }":
    "execution: { pos:[ 0.00, 0.03,  5.05], scale:0.82 }",
    "app.camera.fov = mobile ? 42 : 39;":
    "app.camera.fov = mobile ? 38 : 36;",
    "const fitMargin = mobile ? 1.15 : 1.14;":
    "const fitMargin = mobile ? 0.93 : 1.02;",
    "const topTilt = mobile ? 0.42 : 0.46;":
    "const topTilt = mobile ? 0.72 : 0.70;",
}

OLD_TOP_TITLE = r'''
  ctx.shadowBlur = 0;

  ctx.font =
    id === 'core'
      ? '700 66px Arial'
      : '700 56px Arial';

  ctx.fillStyle = '#d8e8ef';

  ctx.fillText(
    MF20_LABELS[id] || id,
    512,
    385
  );
'''


def log(message: str) -> None:
    print(f"[RENDER-MATCH-V6] {message}", flush=True)


def run(*args: str, cwd: Path | None = None, check: bool = True):
    result = subprocess.run(
        list(args),
        cwd=cwd,
        text=True,
        capture_output=True,
    )

    if result.stdout.strip():
        print(result.stdout.rstrip())

    if result.stderr.strip():
        print(result.stderr.rstrip(), file=sys.stderr)

    if check and result.returncode != 0:
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
            candidate = candidate.resolve()
        except Exception:
            continue

        if candidate in seen:
            continue

        seen.add(candidate)

        if all(
            (candidate / name).is_file()
            for name in ("system.js", "system.css", "system.html")
        ):
            return candidate

    raise RuntimeError(
        "MEMEFLOW project root not found "
        "(need system.js + system.css + system.html)"
    )


def git_root(project_root: Path) -> Path | None:
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
    return Path(value).resolve() if value else None


def rel_to_repo(path: Path, repo: Path) -> str:
    return str(path.resolve().relative_to(repo.resolve()))


def preflight_git(repo: Path | None, targets: list[Path]):
    if repo is None:
        log("No git worktree detected; applying local files only.")
        return None, None

    branch = run(
        "git",
        "branch",
        "--show-current",
        cwd=repo,
    ).stdout.strip()

    head = run(
        "git",
        "rev-parse",
        "HEAD",
        cwd=repo,
    ).stdout.strip()

    log(f"git branch: {branch or '(detached)'}")
    log(f"git HEAD:   {head or '(unknown)'}")

    if not branch:
        raise RuntimeError(
            "detached HEAD: switch to the active branch first"
        )

    relative = [rel_to_repo(path, repo) for path in targets]

    status = run(
        "git",
        "status",
        "--porcelain",
        "--",
        *relative,
        cwd=repo,
    ).stdout.strip()

    if status:
        print(status)
        raise RuntimeError(
            "System frontend files have local changes. "
            "Commit/push them first; nothing was changed."
        )

    return branch, head


def function_span(text: str, name: str):
    start = text.find(f"function {name}(")

    if start < 0:
        raise RuntimeError(f"function not found: {name}")

    brace = text.find("{", start)

    if brace < 0:
        raise RuntimeError(f"opening brace not found: {name}")

    depth = 0
    quote = None
    template = False
    escape = False
    i = brace

    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None

            i += 1
            continue

        if template:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == "`":
                template = False

            i += 1
            continue

        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue

        if ch == "`":
            template = True
            i += 1
            continue

        if ch == "/" and nxt == "/":
            endline = text.find("\n", i + 2)
            i = len(text) if endline < 0 else endline + 1
            continue

        if ch == "/" and nxt == "*":
            endcomment = text.find("*/", i + 2)

            if endcomment < 0:
                raise RuntimeError(
                    f"unterminated comment while parsing {name}"
                )

            i = endcomment + 2
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1

            if depth == 0:
                return start, i + 1

        i += 1

    raise RuntimeError(f"unterminated function: {name}")


def replace_function(text: str, name: str, replacement: str) -> str:
    start, end = function_span(text, name)
    return text[:start] + replacement.strip() + text[end:]


def insert_helpers(js: str) -> str:
    anchor = "function mf20BuildModule(id) {"

    if js.count(anchor) != 1:
        raise RuntimeError(
            "Expected exactly one mf20BuildModule()"
        )

    return js.replace(
        anchor,
        V6_HELPERS.strip() + "\n\n" + anchor,
        1,
    )


def apply_replacements(js: str) -> str:
    updated = js

    for old, new in REPLACEMENTS.items():
        count = updated.count(old)

        if count != 1:
            raise RuntimeError(
                "Expected exactly one current V5 anchor:\n"
                + old
                + f"\nfound={count}"
            )

        updated = updated.replace(old, new, 1)

    return updated


def remove_top_title(js: str) -> str:
    if OLD_TOP_TITLE not in js:
        raise RuntimeError(
            "Could not locate duplicated top-surface title block"
        )

    return js.replace(
        OLD_TOP_TITLE,
        "\n  ctx.shadowBlur = 0;\n",
        1,
    )


def update_cache(html: str) -> str:
    html2, css_count = re.subn(
        r'href="/system\.css(?:\?[^"]*)?"',
        'href="/system.css?v=render-match-v6"',
        html,
        count=1,
    )

    html3, js_count = re.subn(
        r'src="/system\.js(?:\?[^"]*)?"',
        'src="/system.js?v=render-match-v6"',
        html2,
        count=1,
    )

    if css_count != 1 or js_count != 1:
        raise RuntimeError(
            f"cache-bust failed css={css_count} js={js_count}"
        )

    return html3


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Rebuild only MEMEFLOW 3D to match the approved "
            "glass/neon render much more closely."
        )
    )

    parser.add_argument(
        "--push",
        action="store_true",
        help="commit and push after validation",
    )

    args = parser.parse_args()

    root = find_root()
    js_path = root / "system.js"
    css_path = root / "system.css"
    html_path = root / "system.html"
    targets = [js_path, css_path, html_path]

    log(f"project: {root}")

    js = js_path.read_text(encoding="utf-8")
    css = css_path.read_text(encoding="utf-8")
    html = html_path.read_text(encoding="utf-8")

    if PATCH_ID in js or PATCH_ID in css:
        log("Render Match V6 is already installed.")
        return 0

    if "MEMEFLOW_PREMIUM_GLASS_3D_V5" not in js:
        raise RuntimeError(
            "Premium Glass V5 marker not found in current system.js"
        )

    if "RoundedBoxGeometry" not in js:
        raise RuntimeError(
            "RoundedBoxGeometry import is missing"
        )

    repo = git_root(root)
    branch, old_head = preflight_git(repo, targets)

    backup_dir = root / ".patch-backups" / (
        f"render-match-v6-{STAMP}"
    )
    backup_dir.mkdir(parents=True, exist_ok=True)

    for path in targets:
        shutil.copy2(path, backup_dir / path.name)

    log(f"backup: {backup_dir}")

    new_js = remove_top_title(js)
    new_js = insert_helpers(new_js)

    new_js = replace_function(
        new_js,
        "mf20BuildModule",
        NEW_BUILD_MODULE,
    )

    new_js = replace_function(
        new_js,
        "webCurveV31",
        NEW_WEB_CURVE,
    )

    new_js = replace_function(
        new_js,
        "buildWebV31",
        NEW_BUILD_WEB,
    )

    new_js = replace_function(
        new_js,
        "animateWebV31",
        NEW_ANIMATE_WEB,
    )

    new_js = apply_replacements(new_js)

    install_anchor = "function installRealWebV31() {"

    if install_anchor not in new_js:
        raise RuntimeError(
            "installRealWebV31 anchor not found"
        )

    new_js = new_js.replace(
        install_anchor,
        install_anchor + "\n  mf6HideLegacyDomLabels();",
        1,
    )

    new_js = (
        new_js.rstrip()
        + "\n\n"
        + f"/* ===== {PATCH_ID} ===== */\n"
    )

    new_css = (
        css.rstrip()
        + "\n\n"
        + CSS_BLOCK.strip()
        + "\n"
    )

    new_html = update_cache(html)

    try:
        required = [
            PATCH_ID,
            "mf6MakeLabelTexture",
            "mf6SoftGlow",
            "const fitMargin = mobile ? 0.93 : 1.02;",
            "const topTilt = mobile ? 0.72 : 0.70;",
            "scale:0.92",
            "idleDots",
            ".viewport-wrap .node-label",
            "render-match-v6",
        ]

        combined = new_js + "\n" + new_css + "\n" + new_html

        for needle in required:
            if needle not in combined:
                raise RuntimeError(
                    f"V6 verification failed: {needle}"
                )

        js_path.write_text(new_js, encoding="utf-8")
        css_path.write_text(new_css, encoding="utf-8")
        html_path.write_text(new_html, encoding="utf-8")

        node = run(
            "node",
            "--check",
            str(js_path),
            check=False,
        )

        if node.returncode != 0:
            raise RuntimeError(
                "node --check failed for system.js"
            )

        if repo is not None:
            relative = [
                rel_to_repo(path, repo)
                for path in targets
            ]

            run(
                "git",
                "diff",
                "--check",
                "--",
                *relative,
                cwd=repo,
            )

        log("VALIDATION PASS")
        log("Old floating black label pills removed from 3D")
        log("Names moved onto physical front faces")
        log("Hardware rebuilt larger/thicker/brighter")
        log("Soft radial glow added beneath every module")
        log("Core / Decision / Execution strongly emphasized")
        log("Bright colored conduits + 5 moving packets per route")
        log("Camera moved closer and lower for real depth")
        log("Scene fills substantially more of the viewport")
        log("Orbit / pinch zoom / Reset View preserved")
        log("No page layout, server, AI, telemetry or trading logic changed")

    except Exception:
        log(
            "Validation failed; restoring exact pre-patch files."
        )

        for path in targets:
            backup = backup_dir / path.name

            if backup.exists():
                shutil.copy2(backup, path)

        log("ROLLBACK COMPLETE")
        raise

    if args.push:
        if repo is None or branch is None:
            log(
                "--push requested but no git worktree is available."
            )
            return 0

        relative = [
            rel_to_repo(path, repo)
            for path in targets
        ]

        run(
            "git",
            "add",
            "--",
            *relative,
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
            "--",
            *relative,
            cwd=repo,
            check=False,
        )

        if staged.returncode == 0:
            log("No staged changes; nothing to commit.")
            return 0

        commit = run(
            "git",
            "commit",
            "-m",
            "Match MEMEFLOW 3D to approved glass render",
            cwd=repo,
            check=False,
        )

        if commit.returncode != 0:
            log(
                "WARNING: V6 is installed but commit failed."
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

        log("COMMIT + PUSH COMPLETE")
        log(f"branch: {branch}")
        log(f"previous HEAD: {old_head}")
        log(f"new HEAD:      {new_head}")

    else:
        log(
            "Patch applied locally. Re-run with --push to commit + push."
        )

    log("DONE")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(
            f"[RENDER-MATCH-V6] ERROR: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
