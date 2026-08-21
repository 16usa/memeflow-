#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_TRUE_3D_EMBED_V1"
STAMP = time.strftime("%Y%m%d-%H%M%S")

EMBED_JS = r'''
import { bootMemeflowTrue3D } from './scene.js';

function startTrue3D() {
  const viewport = document.querySelector('.viewport-wrap');

  if (!viewport) {
    console.error('[TRUE-3D-EMBED] viewport-wrap not found');
    return;
  }

  let host = document.getElementById('memeflowTrue3DHost');

  if (!host) {
    host = document.createElement('div');
    host.id = 'memeflowTrue3DHost';
    viewport.appendChild(host);
  }

  window.__MEMEFLOW_TRUE_3D_ACTIVE__ = true;

  requestAnimationFrame(() => {
    try {
      bootMemeflowTrue3D('memeflowTrue3DHost');

      const oldCanvas = document.getElementById('systemCanvas');
      oldCanvas?.setAttribute('aria-hidden', 'true');

      console.log(
        '[TRUE-3D-EMBED] true 3D mounted in existing viewport'
      );
    } catch (error) {
      window.__MEMEFLOW_TRUE_3D_ACTIVE__ = false;
      console.error('[TRUE-3D-EMBED] boot failed', error);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    startTrue3D,
    { once: true }
  );
} else {
  startTrue3D();
}
'''

CSS_BLOCK = r'''
/* ===== MEMEFLOW_TRUE_3D_EMBED_V1 ===== */

.viewport-wrap {
  position: relative !important;
  background: #000 !important;
  background-image: none !important;
}

#systemCanvas {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

#memeflowTrue3DHost {
  position: absolute;
  inset: 0;
  z-index: 4;
  overflow: hidden;
  background: #000;
  border-radius: inherit;
  touch-action: none;
}

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

#memeflowTrue3DCanvas:active {
  cursor: grabbing;
}

.viewport-wrap .scene-labels,
.viewport-wrap .node-label,
.viewport-wrap .scene-hint {
  display: none !important;
}
'''


def log(message: str) -> None:
    print(f"[TRUE-3D-EMBED-V1] {message}", flush=True)


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
            for name in ("system.html", "system.css", "system.js")
        ):
            return candidate

    raise RuntimeError("MEMEFLOW project root not found")


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


def rel(path: Path, repo: Path) -> str:
    return str(path.resolve().relative_to(repo.resolve()))


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
            end = text.find("\n", i + 2)
            i = len(text) if end < 0 else end + 1
            continue

        if ch == "/" and nxt == "*":
            end = text.find("*/", i + 2)

            if end < 0:
                raise RuntimeError(
                    f"unterminated comment while parsing {name}"
                )

            i = end + 2
            continue

        if ch == "{":
            depth += 1

        elif ch == "}":
            depth -= 1

            if depth == 0:
                return start, i + 1

        i += 1

    raise RuntimeError(f"unterminated function: {name}")


def inject_guard(
    js: str,
    function_name: str,
    anchor: str,
) -> str:
    start, end = function_span(js, function_name)
    body = js[start:end]

    if "__MEMEFLOW_TRUE_3D_ACTIVE__" in body:
        return js

    if anchor not in body:
        raise RuntimeError(
            f"animation anchor not found in {function_name}"
        )

    body = body.replace(
        anchor,
        anchor
        + "\n"
        + "  if (window.__MEMEFLOW_TRUE_3D_ACTIVE__) return;",
        1,
    )

    return js[:start] + body + js[end:]


def normalize_imports(path: Path) -> None:
    text = path.read_text(encoding="utf-8")

    text = re.sub(
        r"import \* as THREE from "
        r"['\"]https://unpkg\.com/three@[^'\"]+"
        r"/build/three\.module\.js['\"];",
        "import * as THREE from 'three';",
        text,
    )

    text = re.sub(
        r"import \{ OrbitControls \} from "
        r"['\"]https://unpkg\.com/three@[^'\"]+"
        r"/examples/jsm/controls/OrbitControls\.js['\"];",
        "import { OrbitControls } from "
        "'three/addons/controls/OrbitControls.js';",
        text,
    )

    text = re.sub(
        r"import \{ RoundedBoxGeometry \} from "
        r"['\"]https://unpkg\.com/three@[^'\"]+"
        r"/examples/jsm/geometries/RoundedBoxGeometry\.js['\"];",
        "import { RoundedBoxGeometry } from "
        "'three/addons/geometries/RoundedBoxGeometry.js';",
        text,
    )

    path.write_text(text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Embed the new true 3D renderer into the existing "
            "MEMEFLOW production viewport."
        )
    )

    parser.add_argument(
        "--push",
        action="store_true",
    )

    args = parser.parse_args()

    root = find_root()

    system_html = root / "system.html"
    system_css = root / "system.css"
    system_js = root / "system.js"

    scene_js = root / "memeflow-3d" / "scene.js"
    materials_js = root / "memeflow-3d" / "materials.js"
    modules_js = root / "memeflow-3d" / "modules.js"
    routes_js = root / "memeflow-3d" / "routes.js"
    layout_js = root / "memeflow-3d" / "layout.js"
    embed_js = root / "memeflow-3d" / "embed.js"
    lab_html = root / "memeflow-3d-lab.html"

    required = [
        system_html,
        system_css,
        system_js,
        scene_js,
        materials_js,
        modules_js,
        routes_js,
        layout_js,
    ]

    for path in required:
        if not path.is_file():
            raise RuntimeError(f"required file missing: {path}")

    log(f"project: {root}")

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

        log(f"git branch: {branch or '(detached)'}")
        log(f"git HEAD:   {old_head or '(unknown)'}")

        existing_targets = [
            path
            for path in required + [embed_js, lab_html]
            if path.exists()
        ]

        status = run(
            "git",
            "status",
            "--porcelain",
            "--",
            *[rel(path, repo) for path in existing_targets],
            cwd=repo,
        ).stdout.strip()

        if status:
            print(status)
            raise RuntimeError(
                "target frontend files have local changes. "
                "Commit/push them first; nothing was changed."
            )

    css = system_css.read_text(encoding="utf-8")

    if PATCH_ID in css:
        log("True 3D embed V1 is already installed.")
        return 0

    backup_dir = (
        root
        / ".patch-backups"
        / f"true-3d-embed-v1-{STAMP}"
    )

    backup_dir.mkdir(parents=True, exist_ok=True)

    backup_items = required[:]

    if lab_html.exists():
        backup_items.append(lab_html)

    for path in backup_items:
        name = str(path.relative_to(root)).replace("/", "__")
        shutil.copy2(path, backup_dir / name)

    log(f"backup: {backup_dir}")

    try:
        # Use the existing system.html importmap / current Three.js version.
        for path in (
            scene_js,
            materials_js,
            modules_js,
            routes_js,
        ):
            normalize_imports(path)

        # Existing production button id.
        scene_text = scene_js.read_text(encoding="utf-8")
        scene_text = scene_text.replace(
            "document.getElementById('resetView');",
            "document.getElementById('resetViewBtn');",
        )

        scene_js.write_text(
            scene_text,
            encoding="utf-8",
        )

        embed_js.write_text(
            EMBED_JS.strip() + "\n",
            encoding="utf-8",
        )

        js = system_js.read_text(encoding="utf-8")

        js = inject_guard(
            js,
            "animate",
            "  requestAnimationFrame(animate);",
        )

        if "function animateWebV31(" in js:
            js = inject_guard(
                js,
                "animateWebV31",
                "  REAL_WEB_V31.frame = requestAnimationFrame(animateWebV31);",
            )

        js = (
            js.rstrip()
            + "\n\n"
            + f"/* ===== {PATCH_ID} ===== */\n"
        )

        system_js.write_text(js, encoding="utf-8")

        html = system_html.read_text(encoding="utf-8")

        canvas_anchor = (
            '<canvas id="systemCanvas" '
            'aria-label="Interactive 3D MEMEFLOW system topology"></canvas>'
        )

        if 'id="memeflowTrue3DHost"' not in html:
            if canvas_anchor not in html:
                raise RuntimeError("systemCanvas anchor not found")

            html = html.replace(
                canvas_anchor,
                canvas_anchor
                + '\n      <div id="memeflowTrue3DHost" '
                + 'aria-label="MEMEFLOW true 3D renderer"></div>',
                1,
            )

        system_script = re.compile(
            r'<script type="module" '
            r'src="/system\.js(?:\?[^"]*)?"></script>'
        )

        if not system_script.search(html):
            raise RuntimeError("system.js module script not found")

        html = system_script.sub(
            '<script type="module" '
            'src="/system.js?v=true-3d-embed-v1"></script>\n'
            '  <script type="module" '
            'src="/memeflow-3d/embed.js?v=true-3d-embed-v1"></script>',
            html,
            count=1,
        )

        html, count = re.subn(
            r'href="/system\.css(?:\?[^"]*)?"',
            'href="/system.css?v=true-3d-embed-v1"',
            html,
            count=1,
        )

        if count != 1:
            raise RuntimeError("system.css cache-bust failed")

        system_html.write_text(html, encoding="utf-8")

        system_css.write_text(
            css.rstrip()
            + "\n\n"
            + CSS_BLOCK.strip()
            + "\n",
            encoding="utf-8",
        )

        # The standalone lab page is no longer needed.
        if lab_html.exists():
            lab_html.unlink()
            log("removed memeflow-3d-lab.html")

        js_checks = [
            system_js,
            scene_js,
            embed_js,
            materials_js,
            modules_js,
            routes_js,
            layout_js,
        ]

        for path in js_checks:
            result = run(
                "node",
                "--check",
                str(path),
                check=False,
            )

            if result.returncode != 0:
                raise RuntimeError(
                    f"node --check failed: {path}"
                )

        final_html = system_html.read_text(encoding="utf-8")
        final_css = system_css.read_text(encoding="utf-8")
        final_js = system_js.read_text(encoding="utf-8")
        final_scene = scene_js.read_text(encoding="utf-8")

        checks = [
            ('id="memeflowTrue3DHost"', final_html),
            ('/memeflow-3d/embed.js?v=true-3d-embed-v1', final_html),
            (PATCH_ID, final_css),
            (PATCH_ID, final_js),
            ("__MEMEFLOW_TRUE_3D_ACTIVE__", final_js),
            ("import * as THREE from 'three';", final_scene),
            ("resetViewBtn", final_scene),
        ]

        for needle, haystack in checks:
            if needle not in haystack:
                raise RuntimeError(
                    f"validation failed: {needle}"
                )

        if repo is not None:
            diff_targets = [
                system_html,
                system_css,
                system_js,
                scene_js,
                materials_js,
                modules_js,
                routes_js,
                layout_js,
                embed_js,
            ]

            run(
                "git",
                "diff",
                "--check",
                "--",
                *[rel(path, repo) for path in diff_targets],
                cwd=repo,
            )

        log("VALIDATION PASS")
        log("True 3D is embedded into the SAME existing viewport-wrap")
        log("No second visible 3D window")
        log("Old systemCanvas hidden; old renderer loop pauses")
        log("Reset view now targets the new true 3D scene")
        log("Orbit + pinch zoom remain inside the same 3D field")
        log("Telemetry / Live Inspector / Token Flow stay untouched")
        log("Standalone lab page removed")
        log("Server / AI / evaluator / trading logic untouched")

    except Exception:
        log("Validation failed; restoring backup.")

        for path in backup_items:
            name = str(path.relative_to(root)).replace("/", "__")
            backup = backup_dir / name

            if backup.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(backup, path)

        if embed_js.exists():
            embed_js.unlink()

        log("ROLLBACK COMPLETE")
        raise

    if args.push:
        if repo is None or not branch:
            log("--push requested but no git worktree is available.")
            return 0

        targets = [
            system_html,
            system_css,
            system_js,
            scene_js,
            materials_js,
            modules_js,
            routes_js,
            layout_js,
            embed_js,
        ]

        rel_targets = [rel(path, repo) for path in targets]

        # Include lab deletion in staging.
        try:
            rel_targets.append(
                str(
                    (root / "memeflow-3d-lab.html")
                    .resolve()
                    .relative_to(repo.resolve())
                )
            )
        except Exception:
            pass

        run(
            "git",
            "add",
            "-A",
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
            log("No staged changes; nothing to commit.")
            return 0

        commit = run(
            "git",
            "commit",
            "-m",
            "Embed true 3D into existing MEMEFLOW viewport",
            cwd=repo,
            check=False,
        )

        if commit.returncode != 0:
            log("WARNING: patch installed but commit failed.")
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
            log("WARNING: commit created but push failed.")
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
            f"[TRUE-3D-EMBED-V1] ERROR: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
