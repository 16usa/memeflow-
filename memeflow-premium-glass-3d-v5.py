#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_PREMIUM_GLASS_3D_V5"
STAMP = time.strftime("%Y%m%d-%H%M%S")

ROUNDED_IMPORT = (
    "import { RoundedBoxGeometry } "
    "from 'three/addons/geometries/RoundedBoxGeometry.js';"
)

HELPERS = r'''
/* ===== MEMEFLOW_PREMIUM_GLASS_3D_V5 HELPERS ===== */

function mf5GlassMaterial(color, core = false, layer = 0) {
  const top = layer === 2;

  return new THREE.MeshPhysicalMaterial({
    color: top ? 0x071018 : 0x020609,
    emissive: color,
    emissiveIntensity:
      top
        ? core ? 0.16 : 0.065
        : core ? 0.045 : 0.018,
    metalness: top ? 0.48 : 0.62,
    roughness: top ? 0.20 : 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: top ? 0.93 : 0.97
  });
}

function mf5TopGlassMaterial(color, core = false) {
  return new THREE.MeshPhysicalMaterial({
    color: core ? 0x082018 : 0x07131b,
    emissive: color,
    emissiveIntensity: core ? 0.21 : 0.075,
    metalness: 0.26,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: core ? 0.72 : 0.58,
    depthWrite: true
  });
}

function mf5EdgeMaterial(color, opacity = 0.5) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function mf5GlowPlane(width, depth, color, opacity) {
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
  );

  glow.rotation.x = -Math.PI / 2;
  return glow;
}

function mf5MakeLed(color, opacity = 0.94) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 10, 8),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
}

function mf5RouteColor(edge) {
  if (edge?.key === 'paper:execution') {
    return COLORS.green;
  }

  return edge?.color || COLORS.cyan;
}

function mf5HideLegacyPipes() {
  if (typeof MF20 === 'undefined') return;

  for (const route of MF20.pipes || []) {
    if (route?.pipe) route.pipe.visible = false;
    if (route?.halo) route.halo.visible = false;
  }

  for (const packet of MF20.packets || []) {
    if (packet) packet.visible = false;
  }
}
'''

NEW_BUILD_MODULE = r'''
function mf20BuildModule(id) {
  const node = app.nodes.get(id);

  if (!node?.group) {
    return;
  }

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
    core
      ? 3.35
      : decision
        ? 2.62
        : execution
          ? 2.72
          : 2.58;

  const depth =
    core
      ? 2.20
      : decision
        ? 1.72
        : execution
          ? 1.72
          : 1.68;

  const radius = core ? 0.19 : 0.15;

  const levels = [
    { w: 1.10, d: 1.10, h: 0.16, y: -0.40 },
    { w: 1.055, d: 1.055, h: 0.16, y: -0.245 },
    { w: 1.00, d: 1.00, h: 0.20, y: -0.085 }
  ];

  const bodies = [];
  const edgeLayers = [];

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];

    const geometry = new RoundedBoxGeometry(
      width * level.w,
      level.h,
      depth * level.d,
      3,
      radius
    );

    const body = new THREE.Mesh(
      geometry,
      mf5GlassMaterial(color, core, i)
    );

    body.position.y = level.y;
    body.renderOrder = 2 + i;

    hardware.add(body);
    bodies.push(body);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      mf5EdgeMaterial(
        color,
        i === 2
          ? core ? 0.82 : decision ? 0.72 : 0.56
          : i === 1
            ? 0.30
            : 0.20
      )
    );

    edges.position.copy(body.position);
    edges.renderOrder = 6;

    hardware.add(edges);
    edgeLayers.push(edges);
  }

  const glassGeometry = new RoundedBoxGeometry(
    width * 0.93,
    0.085,
    depth * 0.87,
    3,
    radius * 0.82
  );

  const glass = new THREE.Mesh(
    glassGeometry,
    mf5TopGlassMaterial(color, core)
  );

  glass.position.y = 0.055;
  glass.renderOrder = 4;
  hardware.add(glass);

  const glassEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(glassGeometry, 24),
    mf5EdgeMaterial(
      color,
      core ? 0.88 : decision ? 0.78 : 0.60
    )
  );

  glassEdges.position.copy(glass.position);
  glassEdges.renderOrder = 7;
  hardware.add(glassEdges);

  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(
      width * 0.84,
      depth * 0.76
    ),
    new THREE.MeshBasicMaterial({
      map: mf20MakeTopTexture(id, color),
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
  );

  display.rotation.x = -Math.PI / 2;
  display.position.y = 0.105;
  display.renderOrder = 9;
  hardware.add(display);

  const boltInsetX = width * 0.405;
  const boltInsetZ = depth * 0.37;

  for (const x of [-boltInsetX, boltInsetX]) {
    for (const z of [-boltInsetZ, boltInsetZ]) {
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.022, 12),
        new THREE.MeshStandardMaterial({
          color: 0x95b3c2,
          emissive: color,
          emissiveIntensity: 0.20,
          metalness: 0.88,
          roughness: 0.18
        })
      );

      bolt.position.set(x, 0.112, z);
      hardware.add(bolt);
    }
  }

  const leds = [];

  for (let index = 0; index < 3; index++) {
    const led = mf5MakeLed(
      index === 2
        ? color
        : index === 1
          ? 0x3e6f86
          : 0x274755,
      index === 2 ? 0.96 : 0.62
    );

    led.position.set(
      width * 0.30 + index * 0.11,
      -0.045,
      depth * 0.505
    );

    hardware.add(led);
    leds.push(led);
  }

  const underside = mf5GlowPlane(
    width * 1.22,
    depth * 1.25,
    color,
    core
      ? 0.115
      : decision
        ? 0.082
        : execution
          ? 0.092
          : 0.042
  );

  underside.position.y = -0.505;
  underside.renderOrder = 1;
  hardware.add(underside);

  const innerGlow = mf5GlowPlane(
    width * 0.96,
    depth * 0.94,
    color,
    core ? 0.075 : 0.026
  );

  innerGlow.position.y = -0.47;
  innerGlow.renderOrder = 1;
  hardware.add(innerGlow);

  node.group.add(hardware);

  MF20.hardware.set(id, {
    group: hardware,
    display,
    underside,
    innerGlow,
    glass,
    glassEdges,
    bodies,
    edgeLayers,
    leds,
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

  if (dx < 0.35 || dz < 0.35) {
    const mid = a.clone().lerp(b, 0.5);
    mid.y += 0.03 + (index % 2) * 0.015;
    points.push(mid);
  } else if (dx >= dz) {
    const mx = a.x + (b.x - a.x) * 0.52;

    points.push(
      new THREE.Vector3(
        mx,
        a.y + 0.03,
        a.z
      ),
      new THREE.Vector3(
        mx,
        b.y + 0.03,
        b.z
      )
    );
  } else {
    const mz = a.z + (b.z - a.z) * 0.50;

    points.push(
      new THREE.Vector3(
        a.x,
        a.y + 0.03,
        mz
      ),
      new THREE.Vector3(
        b.x,
        b.y + 0.03,
        mz
      )
    );
  }

  points.push(b);

  return new THREE.CatmullRomCurve3(
    points,
    false,
    'catmullrom',
    0.045
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
    const points = curve.getPoints(92);
    const color = mf5RouteColor(edge);

    const pipe = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        86,
        webMobileV31() ? 0.034 : 0.040,
        8,
        false
      ),
      new THREE.MeshStandardMaterial({
        color: 0x06131a,
        emissive: color,
        emissiveIntensity: 0.72,
        metalness: 0.34,
        roughness: 0.24,
        transparent: true,
        opacity: edge.key === 'paper:execution' ? 0.58 : 0.48,
        depthWrite: false
      })
    );

    pipe.renderOrder = 3;
    group.add(pipe);

    const halo = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        86,
        webMobileV31() ? 0.072 : 0.082,
        7,
        false
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: edge.key === 'paper:execution' ? 0.070 : 0.050,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    halo.renderOrder = 2;
    group.add(halo);

    const baseGeometry = new THREE.BufferGeometry().setFromPoints(points);

    const base = new THREE.Line(
      baseGeometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: edge.key === 'paper:execution' ? 0.64 : 0.44,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    base.renderOrder = 5;
    group.add(base);

    const hotGeometry = new THREE.BufferGeometry().setFromPoints(points);
    hotGeometry.setDrawRange(0, 0);

    const hot = new THREE.Line(
      hotGeometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    hot.renderOrder = 9;
    group.add(hot);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(
        webMobileV31() ? 0.080 : 0.090,
        12,
        10
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    head.visible = false;
    head.renderOrder = 10;
    group.add(head);

    const idleDots = [];

    for (let dotIndex = 0; dotIndex < 3; dotIndex++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(
          webMobileV31() ? 0.042 : 0.050,
          10,
          8
        ),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.46,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      dot.userData.mf5 = {
        seed: (dotIndex / 3 + index * 0.071) % 1,
        speed:
          edge.key === 'paper:execution'
            ? 0.060
            : 0.075 + (index % 3) * 0.010
      };

      dot.renderOrder = 8;
      group.add(dot);
      idleDots.push(dot);
    }

    REAL_WEB_V31.edges.set(edge.key, {
      ...edge,
      color,
      curve,
      points,
      pipe,
      halo,
      base,
      hot,
      head,
      idleDots,
      active: false,
      startedAt: 0,
      durationMs: 90,
      fadeStartedAt: 0,
      fadeMs: 105,
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
      const data = dot.userData.mf5 || {};

      const t =
        (
          Number(data.seed || 0) +
          seconds * Number(data.speed || 0.07)
        ) % 1;

      dot.position.copy(entry.curve.getPointAt(t));

      const pulse =
        0.72 +
        Math.sin(
          seconds * 7.0 +
          index * 1.9 +
          t * 10
        ) * 0.18;

      dot.scale.setScalar(
        entry.active
          ? 1.34 + pulse * 0.20
          : 0.90 + pulse * 0.10
      );

      dot.material.opacity =
        entry.active
          ? 0.82
          : 0.32 + pulse * 0.15;
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
        Math.min(1, 0.94 * entry.boost);

      const headP =
        entry.curve.getPointAt(
          Math.min(0.999, p)
        );

      entry.head.position.copy(headP);
      entry.head.material.opacity =
        Math.min(1, 1.0 * entry.boost);

      entry.head.scale.setScalar(
        0.90 + 0.28 * entry.boost
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
      fade * 0.72 * entry.boost;

    entry.head.material.opacity =
      fade * 0.90 * entry.boost;

    if (fade <= 0) {
      entry.active = false;
      entry.boost = 1;
      entry.head.visible = false;
      entry.hot.geometry.setDrawRange(0, 0);
    }
  }

  applyNodeFlashV31(now);
}
'''

REPLACEMENTS = {
    "core:      { pos:[ 3.75, 0.12, -3.70], scale:0.72 }":
    "core:      { pos:[ 3.75, 0.12, -3.70], scale:0.82 }",
    "decision:  { pos:[ 0.00, 0.03,  2.30], scale:0.65 }":
    "decision:  { pos:[ 0.00, 0.03,  2.30], scale:0.70 }",
    "execution: { pos:[ 0.00, 0.03,  5.20], scale:0.64 }":
    "execution: { pos:[ 0.00, 0.03,  5.20], scale:0.69 }",
    "core:      { pos:[ 4.65, 0.13, -3.85], scale:0.84 }":
    "core:      { pos:[ 4.65, 0.13, -3.85], scale:0.94 }",
    "decision:  { pos:[ 0.00, 0.03,  2.75], scale:0.77 }":
    "decision:  { pos:[ 0.00, 0.03,  2.75], scale:0.82 }",
    "execution: { pos:[ 0.00, 0.03,  5.95], scale:0.74 }":
    "execution: { pos:[ 0.00, 0.03,  5.95], scale:0.80 }",
    "const fitMargin = mobile ? 1.10 : 1.12;":
    "const fitMargin = mobile ? 1.15 : 1.14;",
    "const topTilt = mobile ? 0.105 : 0.13;":
    "const topTilt = mobile ? 0.42 : 0.46;",
}


def log(message: str) -> None:
    print(f"[PREMIUM-3D-V5] {message}", flush=True)


def run(
    *args: str,
    cwd: Path | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess:
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

    seen: set[Path] = set()

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
            for name in ("system.js", "system.html")
        ):
            return candidate

    raise RuntimeError(
        "MEMEFLOW project root not found "
        "(need system.js + system.html)"
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


def preflight_git(
    repo: Path | None,
    targets: list[Path],
) -> tuple[str | None, str | None]:
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
            "system.js/system.html have local changes. "
            "Commit/push them first; nothing was changed."
        )

    return branch, head


def function_span(text: str, name: str) -> tuple[int, int]:
    needle = f"function {name}("
    start = text.find(needle)

    if start < 0:
        raise RuntimeError(f"function not found: {name}")

    brace = text.find("{", start)

    if brace < 0:
        raise RuntimeError(f"opening brace not found: {name}")

    depth = 0
    quote: str | None = None
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


def replace_function(
    text: str,
    name: str,
    replacement: str,
) -> str:
    start, end = function_span(text, name)

    return (
        text[:start]
        + replacement.strip()
        + text[end:]
    )


def ensure_import(js: str) -> str:
    if "RoundedBoxGeometry" in js:
        return js

    anchor = (
        "import { OrbitControls } "
        "from 'three/addons/controls/OrbitControls.js';"
    )

    if anchor not in js:
        raise RuntimeError(
            "OrbitControls import anchor not found"
        )

    return js.replace(
        anchor,
        anchor + "\n" + ROUNDED_IMPORT,
        1,
    )


def insert_helpers(js: str) -> str:
    if PATCH_ID in js:
        raise RuntimeError("V5 marker already exists")

    anchor = "function mf20BuildModule(id) {"

    if js.count(anchor) != 1:
        raise RuntimeError(
            "Expected exactly one mf20BuildModule()"
        )

    return js.replace(
        anchor,
        HELPERS.strip()
        + "\n\n"
        + anchor,
        1,
    )


def apply_exact_replacements(js: str) -> str:
    updated = js

    for old, new in REPLACEMENTS.items():
        count = updated.count(old)

        if count != 1:
            raise RuntimeError(
                "Expected exactly one current-layout anchor:\n"
                + old
                + f"\nfound={count}"
            )

        updated = updated.replace(old, new, 1)

    return updated


def update_cache(html: str) -> str:
    updated, count = re.subn(
        r'src="/system\.js(?:\?[^"]*)?"',
        'src="/system.js?v=premium-glass-3d-v5"',
        html,
        count=1,
    )

    if count != 1:
        raise RuntimeError(
            f"system.html: expected one system.js script, found {count}"
        )

    return updated


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Replace only the MEMEFLOW Three.js visualization with the "
            "approved premium glass/neon 3D style. No page layout changes."
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
    html_path = root / "system.html"
    targets = [js_path, html_path]

    log(f"project: {root}")

    js = js_path.read_text(encoding="utf-8")
    html = html_path.read_text(encoding="utf-8")

    if PATCH_ID in js:
        log("Premium Glass 3D V5 is already installed.")
        return 0

    if "MEMEFLOW_3D_VIEWPORT_FREE_ORBIT_FIT_V4" not in js:
        raise RuntimeError(
            "Current 3D Free Orbit/Fit V4 marker not found. "
            "Apply the previous V4 patch first."
        )

    required_functions = [
        "mf20BuildModule",
        "webCurveV31",
        "buildWebV31",
        "animateWebV31",
    ]

    for name in required_functions:
        if f"function {name}(" not in js:
            raise RuntimeError(
                f"Required current 3D function missing: {name}"
            )

    repo = git_root(root)
    branch, old_head = preflight_git(repo, targets)

    backup_dir = root / ".patch-backups" / (
        f"premium-glass-3d-v5-{STAMP}"
    )
    backup_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(js_path, backup_dir / "system.js")
    shutil.copy2(html_path, backup_dir / "system.html")

    log(f"backup: {backup_dir}")

    new_js = ensure_import(js)
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

    new_js = apply_exact_replacements(new_js)

    new_js = (
        new_js.rstrip()
        + "\n\n"
        + f"/* ===== {PATCH_ID} ===== */\n"
    )

    new_html = update_cache(html)

    try:
        if new_js.count(PATCH_ID) != 2:
            raise RuntimeError(
                "V5 marker verification failed"
            )

        checks = [
            "new RoundedBoxGeometry(",
            "mf5TopGlassMaterial",
            "idleDots",
            "const topTilt = mobile ? 0.42 : 0.46;",
            "scale:0.82",
            "premium-glass-3d-v5",
        ]

        combined = new_js + "\n" + new_html

        for needle in checks:
            if needle not in combined:
                raise RuntimeError(
                    f"V5 verification failed: {needle}"
                )

        js_path.write_text(
            new_js,
            encoding="utf-8",
        )

        html_path.write_text(
            new_html,
            encoding="utf-8",
        )

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
        log("ONLY 3D VISUALIZATION WAS CHANGED")
        log("Premium rounded glass hardware modules installed")
        log("Core is larger and green, Decision purple, Execution green")
        log("Three stacked hardware layers + illuminated top installed")
        log("Corner fasteners + front status LEDs installed")
        log("Orthogonal luminous glass conduits installed")
        log("Always-on moving data packets installed")
        log("Live-event hot trails remain driven by existing real events")
        log("Camera changed to a stronger isometric angle")
        log("Existing free orbit / pinch zoom / Reset View preserved")
        log("Page layout, telemetry, inspector, server, AI and trading logic untouched")

    except Exception:
        log(
            "Validation failed; restoring exact pre-patch files."
        )

        shutil.copy2(
            backup_dir / "system.js",
            js_path,
        )

        shutil.copy2(
            backup_dir / "system.html",
            html_path,
        )

        log("ROLLBACK COMPLETE")
        raise

    if args.push:
        if repo is None or branch is None:
            log(
                "--push requested, but no git worktree is available. "
                "Local patch remains installed."
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
            "Build premium glass MEMEFLOW 3D visualization",
            cwd=repo,
            check=False,
        )

        if commit.returncode != 0:
            log(
                "WARNING: 3D patch is installed and validated, "
                "but git commit failed."
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
                "WARNING: commit created, but push failed. "
                "Local Replit 3D remains patched."
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
            "Patch applied locally. "
            "Re-run with --push to commit + push."
        )

    log("DONE")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(
            f"[PREMIUM-3D-V5] ERROR: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
