#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_3D_VIEWPORT_FREE_ORBIT_FIT_V4"
STAMP = time.strftime("%Y%m%d-%H%M%S")

LEGEND_CLASS = "mf-legend-standalone-v4"

NEW_APPLY_WEB_LAYOUT = r'''function applyWebLayoutV31(forceHome = false) {
  if (!app.scene || !app.camera || !app.controls || !app.nodes?.size) return false;

  const mobile = webMobileV31();
  const layout = mobile ? WEB_LAYOUT_MOBILE_V31 : WEB_LAYOUT_DESKTOP_V31;

  for (const [id, cfg] of Object.entries(layout)) {
    const node = webNodeV31(id);
    if (!node?.group) continue;

    node.group.position.set(...cfg.pos);
    node.group.scale.setScalar(cfg.scale);
  }

  /*
    V4: the 3D frame is a pure black viewport.
    Remove the legacy floor/glow planes that created the lighter band.
  */
  app.scene.background = new THREE.Color(0x000000);

  if (app.scene.fog?.color) {
    app.scene.fog.color.set(0x000000);
  }

  if (typeof MF20 !== 'undefined' && MF20.floor) {
    MF20.floor.visible = false;
  }

  app.scene.traverse((object) => {
    if (!object?.isMesh || object.geometry?.type !== 'PlaneGeometry') return;

    const width = Number(object.geometry.parameters?.width) || 0;
    const height = Number(object.geometry.parameters?.height) || 0;

    /*
      Only the old giant environment plane is removed.
      Small module display planes remain untouched.
    */
    if (width >= 40 && height >= 30) {
      object.visible = false;
    }
  });

  const box = new THREE.Box3().makeEmpty();

  if (typeof MF20 !== 'undefined' && MF20.hardware?.values) {
    for (const hardware of MF20.hardware.values()) {
      if (hardware?.group) box.expandByObject(hardware.group);
    }
  }

  const center = new THREE.Vector3(0, 0, 0.65);
  const size = new THREE.Vector3(9.0, 1.2, 10.0);

  if (!box.isEmpty()) {
    box.getCenter(center);
    box.getSize(size);
  }

  const canvas =
    app.renderer?.domElement ||
    document.getElementById('systemCanvas');

  const aspect =
    canvas?.clientHeight > 0
      ? Math.max(0.55, canvas.clientWidth / canvas.clientHeight)
      : (mobile ? 1.10 : 1.60);

  /*
    V4 initial fit:
    - full architecture visible at reset/first load
    - substantially larger than V31
    - no title/telemetry/legend overlay is consuming canvas space
  */
  app.camera.fov = mobile ? 42 : 39;
  app.camera.near = 0.05;
  app.camera.far = 180;
  app.camera.updateProjectionMatrix();

  const fov = THREE.MathUtils.degToRad(app.camera.fov);
  const tanHalf = Math.tan(fov / 2);

  const halfX = Math.max(4.0, size.x * 0.5);
  const halfZ = Math.max(4.4, size.z * 0.5);

  const forWidth =
    halfX /
    Math.max(0.01, tanHalf * aspect);

  const forDepth =
    halfZ /
    Math.max(0.01, tanHalf);

  /*
    Old V31 used 1.28 on mobile, which made the topology too small.
    1.10 keeps a safe frame while filling the viewport much better.
  */
  const fitMargin = mobile ? 1.10 : 1.12;
  const distance = Math.max(forWidth, forDepth) * fitMargin;

  const topTilt = mobile ? 0.105 : 0.13;

  app.cameraHome.set(
    center.x,
    center.y + distance,
    center.z + distance * topTilt
  );

  app.targetHome.set(
    center.x,
    center.y - 0.04,
    center.z
  );

  /*
    Full free orbit inside the 3D frame.
    Pan remains disabled so the architecture cannot be accidentally lost.
  */
  app.controls.enableZoom = true;
  app.controls.enableRotate = true;
  app.controls.enablePan = false;

  app.controls.enableDamping = true;
  app.controls.dampingFactor = 0.055;

  app.controls.zoomSpeed = 1.08;
  app.controls.rotateSpeed = mobile ? 0.62 : 0.56;

  /*
    Unlimited horizontal orbit and almost the full vertical sphere.
    Tiny pole guards avoid OrbitControls singularities.
  */
  app.controls.minAzimuthAngle = -Infinity;
  app.controls.maxAzimuthAngle = Infinity;
  app.controls.minPolarAngle = 0.025;
  app.controls.maxPolarAngle = Math.PI - 0.025;

  /*
    Much wider zoom range than V31:
    close inspection is possible, but Reset View always restores the fit.
  */
  app.controls.minDistance = Math.max(3.2, distance * 0.27);
  app.controls.maxDistance = Math.max(42, distance * 3.2);

  app.controls.autoRotate = false;
  app.autoRotate = false;

  if ('zoomToCursor' in app.controls) {
    app.controls.zoomToCursor = false;
  }

  if (app.controls.touches) {
    app.controls.touches.ONE = THREE.TOUCH.ROTATE;
    app.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  }

  if (app.controls.mouseButtons) {
    app.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    app.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    app.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  }

  if (canvas) {
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
  }

  if (forceHome) {
    app.camera.position.copy(app.cameraHome);
    app.controls.target.copy(app.targetHome);
  }

  app.controls.update();
  resize();
  updateLabels();
  return true;
}'''

CSS_BLOCK = r'''
/* ===== MEMEFLOW_3D_VIEWPORT_FREE_ORBIT_FIT_V4 ===== */

/*
  V4 visual goal:
  TITLE
  LEGEND
  PURE BLACK INTERACTIVE 3D VIEWPORT
  TELEMETRY
  LIVE INSPECTOR
  TOKEN FLOW
*/

.viewport-wrap {
  background: #000 !important;
  background-image: none !important;
  box-shadow: none !important;
  isolation: isolate;
}

.viewport-wrap::after {
  display: none !important;
  content: none !important;
  background: none !important;
  opacity: 0 !important;
}

#systemCanvas {
  background: #000 !important;
  touch-action: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
  cursor: grab;
}

#systemCanvas:active {
  cursor: grabbing;
}

/*
  Legend is no longer an overlay over the 3D canvas.
  It cannot block orbit / pinch gestures or cover the topology.
*/
.legend.mf-legend-standalone-v4 {
  position: relative !important;
  inset: auto !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;

  width: max-content !important;
  max-width: 100% !important;

  margin: 0 !important;
  transform: none !important;

  pointer-events: none !important;
  z-index: 10 !important;
}

@media (max-width: 600px) {
  .mf-live-inspector-standalone-layout-v1 .system-shell {
    grid-template-rows: auto !important;
    grid-auto-rows: auto !important;
    gap: 6px !important;
  }

  .legend.mf-legend-standalone-v4 {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;

    padding: 4px 7px !important;
    border-radius: 8px !important;
  }

  .legend.mf-legend-standalone-v4 span {
    font-size: 5px !important;
    gap: 4px !important;
  }

  .legend.mf-legend-standalone-v4 .legend-dot {
    width: 5px !important;
    height: 5px !important;
  }

  /*
    Keep the compact V3 frame height.
    The V4 camera fit now uses the whole 350px because no card overlays it.
  */
  .mf-live-inspector-standalone-layout-v1 .viewport-wrap,
  .viewport-wrap {
    height: 350px !important;
    min-height: 350px !important;
    max-height: 350px !important;
    margin: 0 !important;
    overflow: hidden !important;
  }
}

@media (max-width: 600px) and (max-height: 720px) {
  .mf-live-inspector-standalone-layout-v1 .viewport-wrap,
  .viewport-wrap {
    height: 340px !important;
    min-height: 340px !important;
    max-height: 340px !important;
  }
}

@media (min-width: 601px) and (max-width: 900px) {
  .legend.mf-legend-standalone-v4 {
    padding: 6px 8px !important;
  }

  .mf-live-inspector-standalone-layout-v1 .viewport-wrap,
  .viewport-wrap {
    height: 430px !important;
    min-height: 430px !important;
    max-height: 430px !important;
    overflow: hidden !important;
  }
}
'''


def log(message: str) -> None:
    print(f"[3D-V4] {message}", flush=True)


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
            "System frontend files have local changes. "
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
            if endline < 0:
                i = len(text)
            else:
                i = endline + 1
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


def reparent_legend(html: str) -> str:
    if LEGEND_CLASS in html:
        raise RuntimeError("V4 legend class already exists")

    pattern = re.compile(
        r'(?P<indent>[ \t]*)'
        r'<aside class="legend glass" aria-label="Decision legend">'
        r'.*?</aside>\s*',
        re.S,
    )

    match = pattern.search(html)

    if not match:
        raise RuntimeError(
            "Decision legend block not found inside 3D viewport"
        )

    block = match.group(0).strip()
    block = block.replace(
        'class="legend glass"',
        f'class="legend glass {LEGEND_CLASS}"',
        1,
    )

    html_without = html[:match.start()] + html[match.end():]

    viewport_anchor = '    <section class="viewport-wrap">'

    if html_without.count(viewport_anchor) != 1:
        raise RuntimeError(
            "Expected exactly one viewport-wrap opening section"
        )

    block_indented = "    " + block.replace("\n", "\n    ")

    return html_without.replace(
        viewport_anchor,
        block_indented
        + "\n\n"
        + viewport_anchor,
        1,
    )


def update_cache(html: str) -> str:
    html2, css_count = re.subn(
        r'href="/system\.css(?:\?[^"]*)?"',
        'href="/system.css?v=3d-free-orbit-fit-v4"',
        html,
        count=1,
    )

    html3, js_count = re.subn(
        r'src="/system\.js(?:\?[^"]*)?"',
        'src="/system.js?v=3d-free-orbit-fit-v4"',
        html2,
        count=1,
    )

    if css_count != 1:
        raise RuntimeError(
            f"system.html: expected one system.css link, found {css_count}"
        )

    if js_count != 1:
        raise RuntimeError(
            f"system.html: expected one system.js script, found {js_count}"
        )

    return html3


def validate_html(html: str) -> None:
    if html.count(LEGEND_CLASS) != 1:
        raise RuntimeError("standalone legend verification failed")

    legend_pos = html.index(LEGEND_CLASS)
    viewport_pos = html.index('class="viewport-wrap"')
    telemetry_pos = html.index("mf-telemetry-standalone-v3")
    token_flow_pos = html.index('class="activity-panel glass"')

    # LIVE INSPECTOR is intentionally re-parented at runtime by V1,
    # so its static source position is not used for this HTML-order check.
    if not (
        legend_pos
        < viewport_pos
        < telemetry_pos
        < token_flow_pos
    ):
        raise RuntimeError(
            "final static order verification failed: "
            "LEGEND -> 3D -> TELEMETRY -> TOKEN FLOW"
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Make MEMEFLOW 3D viewport pure black, initially fitted larger, "
            "and freely rotatable/zoomable."
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

    if (
        PATCH_ID in css
        and PATCH_ID in js
        and LEGEND_CLASS in html
    ):
        log("3D viewport V4 is already installed.")
        return 0

    if (
        PATCH_ID in css
        or PATCH_ID in js
        or LEGEND_CLASS in html
    ):
        raise RuntimeError(
            "partial V4 installation detected; refusing to stack over it"
        )

    if "MEMEFLOW_ARCHITECTURE_FRAME_SPLIT_V3" not in css:
        raise RuntimeError(
            "Architecture Frame Split V3 marker not found. "
            "Apply the previous V3 patch first."
        )

    if "function applyWebLayoutV31(" not in js:
        raise RuntimeError(
            "V31 camera/layout function not found in system.js"
        )

    repo = git_root(root)
    branch, old_head = preflight_git(repo, targets)

    backup_dir = root / ".patch-backups" / (
        f"3d-free-orbit-fit-v4-{STAMP}"
    )
    backup_dir.mkdir(parents=True, exist_ok=True)

    for path in targets:
        shutil.copy2(path, backup_dir / path.name)

    log(f"backup: {backup_dir}")

    new_js = replace_function(
        js,
        "applyWebLayoutV31",
        NEW_APPLY_WEB_LAYOUT,
    )

    # One explicit marker in JS for idempotency/audit.
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

    new_html = reparent_legend(html)
    new_html = update_cache(new_html)

    try:
        validate_html(new_html)

        if new_js.count(PATCH_ID) != 1:
            raise RuntimeError("system.js V4 marker verification failed")

        if new_css.count(PATCH_ID) != 1:
            raise RuntimeError("system.css V4 marker verification failed")

        if "app.controls.enableRotate = true;" not in new_js:
            raise RuntimeError("free orbit was not installed")

        if "fitMargin = mobile ? 1.10 : 1.12" not in new_js:
            raise RuntimeError("larger initial camera fit was not installed")

        if "app.scene.background = new THREE.Color(0x000000)" not in new_js:
            raise RuntimeError("pure-black Three.js background not installed")

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
            raise RuntimeError("node --check failed for system.js")

        if repo is not None:
            relative = [rel_to_repo(path, repo) for path in targets]

            run(
                "git",
                "diff",
                "--check",
                "--",
                *relative,
                cwd=repo,
            )

        log("VALIDATION PASS")
        log("3D viewport background: pure black")
        log("Legacy floor/glow band: disabled")
        log("Decision legend: moved outside the 3D canvas")
        log("Initial camera: full topology visible, ~16% larger than old V31 fit")
        log("One-finger drag: free orbit")
        log("Pinch: zoom + rotate")
        log("Horizontal orbit: unrestricted 360 degrees")
        log("Vertical orbit: almost full sphere")
        log("Zoom range: significantly expanded")
        log("Reset View: restores exact fitted home view")
        log("No server, telemetry, AI, evaluator or trading logic modified")

    except Exception:
        log("Validation failed; restoring exact pre-patch files.")

        for path in targets:
            backup = backup_dir / path.name
            if backup.exists():
                shutil.copy2(backup, path)

        log("ROLLBACK COMPLETE")
        raise

    if args.push:
        if repo is None or branch is None:
            log(
                "--push requested, but no git worktree is available. "
                "Local patch remains installed."
            )
            return 0

        relative = [rel_to_repo(path, repo) for path in targets]

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
            "Fix 3D viewport fit background and free orbit",
            cwd=repo,
            check=False,
        )

        if commit.returncode != 0:
            log(
                "WARNING: patch is installed and validated, "
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
                "Local Replit files remain patched."
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
            f"[3D-V4] ERROR: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
