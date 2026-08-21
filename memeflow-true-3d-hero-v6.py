#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_TRUE_3D_HERO_V6"
VERSION = "true-3d-hero-v6"
STAMP = time.strftime("%Y%m%d-%H%M%S")


def log(message: str) -> None:
    print(f"[TRUE-3D-HERO-V6] {message}", flush=True)


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
            (candidate / "memeflow-3d" / "modules.js").is_file()
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


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)

    if count != 1:
        raise RuntimeError(
            f"{label}: expected one anchor, found {count}"
        )

    return text.replace(old, new, 1)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Refine the existing MEMEFLOW GLB 3D into a larger, lower-angle "
            "hero composition. No CSS changes."
        )
    )

    parser.add_argument(
        "--push",
        action="store_true",
        help="commit and push after validation",
    )

    args = parser.parse_args()
    root = find_root()

    layout_path = root / "memeflow-3d" / "layout.js"
    modules_path = root / "memeflow-3d" / "modules.js"
    scene_path = root / "memeflow-3d" / "scene.js"
    embed_path = root / "memeflow-3d" / "embed.js"
    html_path = root / "system.html"

    targets = [
        layout_path,
        modules_path,
        scene_path,
        embed_path,
        html_path,
    ]

    for path in targets:
        if not path.is_file():
            raise RuntimeError(f"required file missing: {path}")

    current_scene = scene_path.read_text(encoding="utf-8")

    if PATCH_ID in current_scene:
        log("Hero V6 is already installed.")
        return 0

    if "MEMEFLOW_TRUE_3D_GLB_V5" not in current_scene:
        raise RuntimeError(
            "GLB V5 baseline not found; refusing to patch unknown renderer."
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
                "Target 3D files have local changes. "
                "Commit/push them first; nothing changed."
            )

    backup_dir = (
        root
        / ".patch-backups"
        / f"true-3d-hero-v6-{STAMP}"
    )

    backup_dir.mkdir(parents=True, exist_ok=True)

    for path in targets:
        shutil.copy2(
            path,
            backup_dir / path.name,
        )

    log(f"backup: {backup_dir}")

    try:
        # ---------- layout ----------
        layout = layout_path.read_text(encoding="utf-8")

        replacements = [
            (
                "{ id: 'discovery', label: 'DISCOVERY', color: 0x315cff, pos: [-3.20, 0, -3.18], size: [2.20, 1.50] }",
                "{ id: 'discovery', label: 'DISCOVERY', color: 0x315cff, pos: [-3.00, 0, -3.00], size: [2.36, 1.60] }",
            ),
            (
                "{ id: 'bootstrap', label: 'FAST BOOTSTRAP', color: 0x315cff, pos: [0, 0, -3.18], size: [2.36, 1.50] }",
                "{ id: 'bootstrap', label: 'FAST BOOTSTRAP', color: 0x315cff, pos: [0, 0, -3.00], size: [2.52, 1.60] }",
            ),
            (
                "{ id: 'core', label: 'MEMEFLOW CORE', color: 0x56e79a, pos: [3.20, 0, -3.18], size: [2.90, 1.88], core: true }",
                "{ id: 'core', label: 'MEMEFLOW CORE', color: 0x56e79a, pos: [3.00, 0, -3.00], size: [3.12, 2.02], core: true }",
            ),
            (
                "{ id: 'risk', label: 'RISK ENGINE', color: 0x43c8ee, pos: [-3.20, 0, -0.34], size: [2.20, 1.50] }",
                "{ id: 'risk', label: 'RISK ENGINE', color: 0x43c8ee, pos: [-3.00, 0, -0.42], size: [2.36, 1.60] }",
            ),
            (
                "{ id: 'market', label: 'MARKET LEDGER', color: 0x3a7dff, pos: [0, 0, -0.34], size: [2.26, 1.50] }",
                "{ id: 'market', label: 'MARKET LEDGER', color: 0x3a7dff, pos: [0, 0, -0.42], size: [2.42, 1.60] }",
            ),
            (
                "{ id: 'holders', label: 'HOLDER LEDGER', color: 0x43c8ee, pos: [3.20, 0, -0.34], size: [2.20, 1.50] }",
                "{ id: 'holders', label: 'HOLDER LEDGER', color: 0x43c8ee, pos: [3.00, 0, -0.42], size: [2.36, 1.60] }",
            ),
            (
                "{ id: 'openai', label: 'OPENAI ASSISTANT', color: 0x43c8ee, pos: [-3.20, 0, 2.50], size: [2.34, 1.50] }",
                "{ id: 'openai', label: 'OPENAI ASSISTANT', color: 0x43c8ee, pos: [-3.00, 0, 2.16], size: [2.48, 1.60] }",
            ),
            (
                "{ id: 'decision', label: 'DECISION', color: 0x8d58ff, pos: [0, 0, 2.50], size: [2.12, 1.50], decision: true }",
                "{ id: 'decision', label: 'DECISION', color: 0x8d58ff, pos: [0, 0, 2.16], size: [2.28, 1.60], decision: true }",
            ),
            (
                "{ id: 'paper', label: 'PAPER ENGINE', color: 0x315cff, pos: [3.20, 0, 2.50], size: [2.20, 1.50] }",
                "{ id: 'paper', label: 'PAPER ENGINE', color: 0x315cff, pos: [3.00, 0, 2.16], size: [2.36, 1.60] }",
            ),
            (
                "{ id: 'execution', label: 'LIVE EXECUTION', color: 0x48df8b, pos: [0, 0, 5.18], size: [2.36, 1.50], execution: true }",
                "{ id: 'execution', label: 'LIVE EXECUTION', color: 0x48df8b, pos: [0, 0, 4.70], size: [2.58, 1.66], execution: true }",
            ),
        ]

        for old, new in replacements:
            layout = replace_once(
                layout,
                old,
                new,
                "layout node",
            )

        layout_path.write_text(
            layout,
            encoding="utf-8",
        )

        # ---------- modules ----------
        modules = modules_path.read_text(encoding="utf-8")

        modules = replace_once(
            modules,
            "'./materials.js?v=true-3d-glb-v5'",
            "'./materials.js?v=true-3d-glb-v5'",
            "materials import",
        )

        modules = replace_once(
            modules,
            "    1,\n    node.size[1] / sourceSize[1]",
            "    1.22,\n    node.size[1] / sourceSize[1]",
            "chassis vertical scale",
        )

        modules = replace_once(
            modules,
            "      width * 0.58,\n      depth * 0.50",
            "      width * 0.54,\n      depth * 0.46",
            "icon size",
        )

        modules = replace_once(
            modules,
            "  icon.position.y = 0.125;",
            "  icon.position.y = 0.155;",
            "icon height",
        )

        modules = replace_once(
            modules,
            "      width * 0.72,\n      node.core ? 0.30 : 0.27",
            "      width * 0.86,\n      node.core ? 0.39 : 0.35",
            "label size",
        )

        modules = replace_once(
            modules,
            "    -0.13,\n    depth * 0.545",
            "    -0.12,\n    depth * 0.555",
            "label position",
        )

        modules = replace_once(
            modules,
            "      width * 0.22 + index * 0.095,\n      -0.07,\n      depth * 0.555",
            "      width * 0.20 + index * 0.095,\n      -0.06,\n      depth * 0.568",
            "LED position",
        )

        modules_path.write_text(
            modules,
            encoding="utf-8",
        )

        # ---------- scene ----------
        scene = scene_path.read_text(encoding="utf-8")

        scene = replace_once(
            scene,
            "./layout.js?v=true-3d-glb-v5",
            "./layout.js?v=true-3d-hero-v6",
            "layout import version",
        )

        scene = replace_once(
            scene,
            "./modules.js?v=true-3d-glb-v5",
            "./modules.js?v=true-3d-hero-v6",
            "modules import version",
        )

        scene = replace_once(
            scene,
            "      41,\n      1,",
            "      40,\n      1,",
            "camera FOV baseline",
        )

        scene = replace_once(
            scene,
            "  renderer.toneMappingExposure =\n    0.98;",
            "  renderer.toneMappingExposure =\n    0.96;",
            "tone exposure",
        )

        scene = replace_once(
            scene,
            "      0.24,\n      0.34,\n      0.86",
            "      0.18,\n      0.28,\n      0.90",
            "bloom",
        )

        scene = replace_once(
            scene,
            "      0.84,\n      0.54",
            "      0.73,\n      0.69",
            "hero camera direction",
        )

        scene = replace_once(
            scene,
            "      aspect < 0.82\n        ? 42\n        : aspect < 1.10\n          ? 39\n          : 36;",
            "      aspect < 0.82\n        ? 41\n        : aspect < 1.10\n          ? 38\n          : 35;",
            "responsive FOV",
        )

        scene = replace_once(
            scene,
            "      aspect < 0.82\n        ? 0.92\n        : 0.93;",
            "      aspect < 0.82\n        ? 0.965\n        : 0.955;",
            "x fit",
        )

        scene = replace_once(
            scene,
            "      aspect < 0.82\n        ? 0.90\n        : 0.92;",
            "      aspect < 0.82\n        ? 0.955\n        : 0.945;",
            "y fit",
        )

        scene = scene.rstrip() + f"\n\n/* ===== {PATCH_ID} ===== */\n"

        scene_path.write_text(
            scene,
            encoding="utf-8",
        )

        # ---------- embed ----------
        embed = embed_path.read_text(encoding="utf-8")

        embed, import_count = re.subn(
            r"\./scene\.js\?v=[^'\"]+",
            f"./scene.js?v={VERSION}",
            embed,
            count=1,
        )

        if import_count != 1:
            raise RuntimeError(
                "embed scene cache-bust anchor not found"
            )

        embed = embed.replace(
            "[TRUE-3D] GLB V5 mounted",
            "[TRUE-3D] HERO V6 mounted",
            1,
        )

        embed_path.write_text(
            embed,
            encoding="utf-8",
        )

        # ---------- system cache bust ----------
        html = html_path.read_text(encoding="utf-8")

        html, html_count = re.subn(
            r"/memeflow-3d/embed\.js\?v=[^\"']+",
            f"/memeflow-3d/embed.js?v={VERSION}",
            html,
            count=1,
        )

        if html_count != 1:
            raise RuntimeError(
                "system.html embed cache-bust anchor not found"
            )

        html_path.write_text(
            html,
            encoding="utf-8",
        )

        for path in (
            layout_path,
            modules_path,
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
        final_modules = modules_path.read_text(encoding="utf-8")
        final_layout = layout_path.read_text(encoding="utf-8")

        checks = [
            (PATCH_ID, final_scene),
            ("0.73,", final_scene),
            ("0.69", final_scene),
            ("0.965", final_scene),
            ("0.955", final_scene),
            ("1.22,", final_modules),
            ("width * 0.86", final_modules),
            ("pos: [-3.00", final_layout),
            ("size: [3.12, 2.02]", final_layout),
        ]

        for needle, haystack in checks:
            if needle not in haystack:
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
        log("GLB hardware preserved")
        log("Topology tightened and modules enlarged")
        log("Camera lowered to reveal more physical chassis depth")
        log("Home view uses more of the mobile viewport while staying fit-safe")
        log("Chassis vertical thickness increased 22%")
        log("Front label plates enlarged for phone readability")
        log("Bloom reduced for cleaner premium lighting")
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
            "Refine MEMEFLOW GLB 3D hero composition",
            cwd=repo,
            check=False,
        )

        if commit.returncode != 0:
            log(
                "WARNING: V6 installed but commit failed."
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
            f"[TRUE-3D-HERO-V6] ERROR: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
