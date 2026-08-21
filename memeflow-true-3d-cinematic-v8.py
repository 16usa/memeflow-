#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_TRUE_3D_CINEMATIC_V8"
VERSION = "true-3d-cinematic-v8"
STAMP = time.strftime("%Y%m%d-%H%M%S")

NEW_BUILD_FIT_BOUNDS = r'''
function buildFitBounds() {
  /*
    V8 FRAMING:
    Home framing must describe the visible logical topology, not every
    internal GLB mesh bound. Some chassis assets contain construction
    geometry whose box is larger than what the eye actually reads.
  */
  const box =
    new THREE.Box3()
      .makeEmpty();

  for (const node of NODES) {
    const width =
      Number(node.size?.[0])
      || 2.4;

    const depth =
      Number(node.size?.[1])
      || 1.6;

    const x =
      Number(node.pos?.[0])
      || 0;

    const y =
      Number(node.pos?.[1])
      || 0;

    const z =
      Number(node.pos?.[2])
      || 0;

    box.expandByPoint(
      new THREE.Vector3(
        x - width * 0.56,
        y - 0.62,
        z - depth * 0.57
      )
    );

    box.expandByPoint(
      new THREE.Vector3(
        x + width * 0.56,
        y + 0.38,
        z + depth * 0.57
      )
    );
  }

  return box;
}
'''


def log(message: str) -> None:
    print(f"[TRUE-3D-CINEMATIC-V8] {message}", flush=True)


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

        if (
            (candidate / "system.html").is_file()
            and
            (candidate / "memeflow-3d" / "scene.js").is_file()
            and
            (candidate / "memeflow-3d" / "embed.js").is_file()
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
    return str(
        path.resolve()
        .relative_to(repo.resolve())
    )


def function_span(text: str, name: str) -> tuple[int, int]:
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
                raise RuntimeError(f"unterminated comment: {name}")

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


def replace_function(
    text: str,
    name: str,
    replacement: str,
) -> str:
    start, end = function_span(text, name)
    return text[:start] + replacement.strip() + text[end:]


def replace_once(
    text: str,
    old: str,
    new: str,
    label: str,
) -> str:
    count = text.count(old)

    if count != 1:
        raise RuntimeError(
            f"{label}: expected one anchor, found {count}"
        )

    return text.replace(old, new, 1)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Correct V7 framing using logical topology bounds and a stronger "
            "cinematic 3/4 camera. No CSS changes."
        )
    )

    parser.add_argument(
        "--push",
        action="store_true",
        help="commit and push after validation",
    )

    args = parser.parse_args()
    root = find_root()

    scene_path = root / "memeflow-3d" / "scene.js"
    embed_path = root / "memeflow-3d" / "embed.js"
    html_path = root / "system.html"

    targets = [
        scene_path,
        embed_path,
        html_path,
    ]

    scene = scene_path.read_text(encoding="utf-8")

    if PATCH_ID in scene:
        log("Cinematic V8 is already installed.")
        return 0

    if "MEMEFLOW_TRUE_3D_STAGE_FILL_V7" not in scene:
        raise RuntimeError(
            "Stage Fill V7 baseline not found; refusing to patch unknown renderer."
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

        log(f"git branch: {branch or '(detached)'}")
        log(f"git HEAD:   {old_head or '(unknown)'}")

        if not branch:
            raise RuntimeError("detached HEAD")

        status = run(
            "git",
            "status",
            "--porcelain",
            "--",
            *[rel(path, repo) for path in targets],
            cwd=repo,
        ).stdout.strip()

        if status:
            print(status)
            raise RuntimeError(
                "Target scene/embed/system files have local changes. "
                "Commit/push them first; nothing changed."
            )

    backup_dir = (
        root
        / ".patch-backups"
        / f"true-3d-cinematic-v8-{STAMP}"
    )

    backup_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    for path in targets:
        shutil.copy2(
            path,
            backup_dir / path.name,
        )

    log(f"backup: {backup_dir}")

    try:
        scene = replace_function(
            scene,
            "buildFitBounds",
            NEW_BUILD_FIT_BOUNDS,
        )

        scene = replace_once(
            scene,
            (
                "  const bounds =\n"
                "    buildFitBounds(\n"
                "      scene,\n"
                "      modules\n"
                "    );"
            ),
            (
                "  const bounds =\n"
                "    buildFitBounds();"
            ),
            "buildFitBounds call",
        )

        scene = replace_once(
            scene,
            "      0,\n      0.64,\n      0.77",
            "      0.10,\n      0.50,\n      0.86",
            "home camera direction",
        )

        scene = replace_once(
            scene,
            "        ? 41\n        : aspect < 1.10\n          ? 38\n          : 35;",
            "        ? 38\n        : aspect < 1.10\n          ? 36\n          : 34;",
            "responsive FOV",
        )

        scene = replace_once(
            scene,
            "        ? 0.985\n        : 0.975;",
            "        ? 0.972\n        : 0.965;",
            "x limit",
        )

        scene = replace_once(
            scene,
            "        ? 0.972\n        : 0.962;",
            "        ? 0.948\n        : 0.942;",
            "y limit",
        )

        scene = replace_once(
            scene,
            "      opacity: 0.12,",
            "      opacity: 0.18,",
            "stage opacity",
        )

        scene = replace_once(
            scene,
            "      opacity: 0.055,",
            "      opacity: 0.075,",
            "stage ring opacity",
        )

        scene = replace_once(
            scene,
            "      0x57e69a,\n      5.0,\n      17,",
            "      0x57e69a,\n      3.8,\n      16,",
            "core point light",
        )

        scene = (
            scene.rstrip()
            + "\n\n"
            + f"/* ===== {PATCH_ID} ===== */\n"
        )

        scene_path.write_text(
            scene,
            encoding="utf-8",
        )

        embed = embed_path.read_text(encoding="utf-8")

        embed, embed_count = re.subn(
            r"\./scene\.js\?v=[^'\"]+",
            f"./scene.js?v={VERSION}",
            embed,
            count=1,
        )

        if embed_count != 1:
            raise RuntimeError(
                "embed scene cache-bust anchor not found"
            )

        embed = embed.replace(
            "[TRUE-3D] STAGE FILL V7 mounted",
            "[TRUE-3D] CINEMATIC V8 mounted",
            1,
        )

        embed_path.write_text(
            embed,
            encoding="utf-8",
        )

        html = html_path.read_text(encoding="utf-8")

        html, html_count = re.subn(
            r"/memeflow-3d/embed\.js\?v=[^\"']+",
            f"/memeflow-3d/embed.js?v={VERSION}",
            html,
            count=1,
        )

        if html_count != 1:
            raise RuntimeError(
                "system.html cache-bust anchor not found"
            )

        html_path.write_text(
            html,
            encoding="utf-8",
        )

        for path in (
            scene_path,
            embed_path,
        ):
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

        final_scene = scene_path.read_text(encoding="utf-8")

        checks = [
            PATCH_ID,
            "function buildFitBounds()",
            "for (const node of NODES)",
            "0.10,",
            "0.50,",
            "0.86",
            "? 38",
            "? 0.972",
            "? 0.948",
            "opacity: 0.18",
            "opacity: 0.075",
        ]

        for needle in checks:
            if needle not in final_scene:
                raise RuntimeError(
                    f"validation failed: {needle}"
                )

        if repo is not None:
            run(
                "git",
                "diff",
                "--check",
                "--",
                *[rel(path, repo) for path in targets],
                cwd=repo,
            )

        log("VALIDATION PASS")
        log("Home framing now uses logical visible topology bounds")
        log("Scene should occupy substantially more of the existing 3D window")
        log("Camera moved to a stronger 3/4 hardware angle")
        log("Narrower responsive FOV makes modules larger on iPhone")
        log("Stage is now subtly visible under the hardware")
        log("Core hotspot reduced again")
        log("GLB models / routes / V7 node elevations preserved")
        log("NO CSS changed; no new style layer")
        log("Orbit / pinch / Reset View preserved")
        log("Server / AI / telemetry / trading logic untouched")

    except Exception:
        log("Validation failed; restoring exact backup.")

        for path in targets:
            backup = backup_dir / path.name

            if backup.exists():
                shutil.copy2(
                    backup,
                    path,
                )

        log("ROLLBACK COMPLETE")
        raise

    if args.push:
        if repo is None or not branch:
            log(
                "--push requested but git worktree is unavailable."
            )
            return 0

        rel_targets = [
            rel(path, repo)
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
            log("No staged changes; nothing to commit.")
            return 0

        commit = run(
            "git",
            "commit",
            "-m",
            "Correct MEMEFLOW 3D cinematic framing",
            cwd=repo,
            check=False,
        )

        if commit.returncode != 0:
            log(
                "WARNING: V8 installed but commit failed."
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
            f"[TRUE-3D-CINEMATIC-V8] ERROR: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
