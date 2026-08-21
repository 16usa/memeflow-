#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_VARIANT_2_FULLFRAME_V2"
VERSION = "variant-2-fullframe-v2"
STAMP = time.strftime("%Y%m%d-%H%M%S")


def log(message: str) -> None:
    print(f"[VARIANT-2-FULLFRAME-V2] {message}", flush=True)


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
            (candidate / "memeflow-3d" / "layout.js").is_file()
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
    return str(path.resolve().relative_to(repo.resolve()))


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
            "Correct Variant 2 composition: expand the topology vertically, "
            "match the viewport aspect, and make the live GLB scene fill the "
            "existing 3D window without CSS layering."
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
    scene_path = root / "memeflow-3d" / "scene.js"
    embed_path = root / "memeflow-3d" / "embed.js"
    html_path = root / "system.html"

    targets = [
        layout_path,
        scene_path,
        embed_path,
        html_path,
    ]

    scene = scene_path.read_text(encoding="utf-8")

    if PATCH_ID in scene:
        log("Variant 2 Fullframe V2 is already installed.")
        return 0

    if "MEMEFLOW_VARIANT_2_SHOWCASE_V1" not in scene:
        raise RuntimeError(
            "Variant 2 Showcase V1 baseline not found; "
            "refusing to patch an unknown renderer."
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
        / f"variant-2-fullframe-v2-{STAMP}"
    )

    backup_dir.mkdir(parents=True, exist_ok=True)

    for path in targets:
        shutil.copy2(
            path,
            backup_dir / path.name,
        )

    log(f"backup: {backup_dir}")

    try:
        # ------------------------------------------------------------
        # 1. FIX THE ACTUAL PROBLEM:
        #    V1 compressed Z so strongly that the scene's projected
        #    aspect ratio was almost 2:1 inside a ~1.1:1 viewport.
        #    V2 spreads rows in depth and narrows X slightly so the
        #    visible topology naturally fills BOTH width and height.
        # ------------------------------------------------------------
        layout = layout_path.read_text(encoding="utf-8")

        replacements = [
            (
                "{ id: 'discovery', label: 'DISCOVERY', color: 0x315cff, pos: [-3.15, 0.00, -2.32], size: [2.62, 1.68] }",
                "{ id: 'discovery', label: 'DISCOVERY', color: 0x315cff, pos: [-3.00, 0.00, -3.70], size: [2.62, 1.68] }",
            ),
            (
                "{ id: 'bootstrap', label: 'FAST BOOTSTRAP', color: 0x315cff, pos: [0, 0.00, -2.32], size: [2.78, 1.68] }",
                "{ id: 'bootstrap', label: 'FAST BOOTSTRAP', color: 0x315cff, pos: [0, 0.00, -3.70], size: [2.78, 1.68] }",
            ),
            (
                "{ id: 'core', label: 'MEMEFLOW CORE', color: 0x56e79a, pos: [3.15, 0.16, -2.32], size: [3.34, 2.08], core: true }",
                "{ id: 'core', label: 'MEMEFLOW CORE', color: 0x56e79a, pos: [3.00, 0.16, -3.70], size: [3.34, 2.08], core: true }",
            ),
            (
                "{ id: 'risk', label: 'RISK ENGINE', color: 0x43c8ee, pos: [-3.15, 0.02, -0.32], size: [2.62, 1.68] }",
                "{ id: 'risk', label: 'RISK ENGINE', color: 0x43c8ee, pos: [-3.00, 0.02, -1.10], size: [2.62, 1.68] }",
            ),
            (
                "{ id: 'market', label: 'MARKET LEDGER', color: 0x3a7dff, pos: [0, 0.02, -0.32], size: [2.70, 1.68] }",
                "{ id: 'market', label: 'MARKET LEDGER', color: 0x3a7dff, pos: [0, 0.02, -1.10], size: [2.70, 1.68] }",
            ),
            (
                "{ id: 'holders', label: 'HOLDER LEDGER', color: 0x43c8ee, pos: [3.15, 0.02, -0.32], size: [2.62, 1.68] }",
                "{ id: 'holders', label: 'HOLDER LEDGER', color: 0x43c8ee, pos: [3.00, 0.02, -1.10], size: [2.62, 1.68] }",
            ),
            (
                "{ id: 'openai', label: 'OPENAI ASSISTANT', color: 0x43c8ee, pos: [-3.15, 0.04, 1.40], size: [2.76, 1.68] }",
                "{ id: 'openai', label: 'OPENAI ASSISTANT', color: 0x43c8ee, pos: [-3.00, 0.04, 1.50], size: [2.76, 1.68] }",
            ),
            (
                "{ id: 'decision', label: 'DECISION', color: 0x8d58ff, pos: [0, 0.10, 1.40], size: [2.54, 1.68], decision: true }",
                "{ id: 'decision', label: 'DECISION', color: 0x8d58ff, pos: [0, 0.10, 1.50], size: [2.54, 1.68], decision: true }",
            ),
            (
                "{ id: 'paper', label: 'PAPER ENGINE', color: 0x315cff, pos: [3.15, 0.04, 1.40], size: [2.62, 1.68] }",
                "{ id: 'paper', label: 'PAPER ENGINE', color: 0x315cff, pos: [3.00, 0.04, 1.50], size: [2.62, 1.68] }",
            ),
            (
                "{ id: 'execution', label: 'LIVE EXECUTION', color: 0x48df8b, pos: [0, 0.14, 3.18], size: [2.90, 1.80], execution: true }",
                "{ id: 'execution', label: 'LIVE EXECUTION', color: 0x48df8b, pos: [0, 0.14, 4.30], size: [2.90, 1.80], execution: true }",
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

        # ------------------------------------------------------------
        # 2. CAMERA:
        #    More top-down than Showcase V1 so the new Z depth maps
        #    into screen height. Still enough 3/4 angle to read GLB depth.
        # ------------------------------------------------------------
        scene = scene_path.read_text(encoding="utf-8")

        scene = re.sub(
            r"\./layout\.js\?v=[^'\"]+",
            f"./layout.js?v={VERSION}",
            scene,
            count=1,
        )

        scene = replace_once(
            scene,
            "      0.00,\n      0.58,\n      0.81",
            "      0.05,\n      0.82,\n      0.57",
            "home camera direction",
        )

        scene = replace_once(
            scene,
            "        ? 36\n        : aspect < 1.10\n          ? 34\n          : 32;",
            "        ? 38\n        : aspect < 1.10\n          ? 36\n          : 34;",
            "responsive FOV",
        )

        scene = replace_once(
            scene,
            "        ? 0.985\n        : 0.978;",
            "        ? 0.955\n        : 0.952;",
            "x safe fit",
        )

        scene = replace_once(
            scene,
            "        ? 0.962\n        : 0.955;",
            "        ? 0.948\n        : 0.945;",
            "y safe fit",
        )

        # Slightly stronger dark stage, still subtle.
        scene = replace_once(
            scene,
            "      opacity: 0.12,",
            "      opacity: 0.145,",
            "stage opacity",
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

        # ------------------------------------------------------------
        # 3. CACHE BUST
        # ------------------------------------------------------------
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
            "[TRUE-3D] VARIANT 2 SHOWCASE V1 mounted",
            "[TRUE-3D] VARIANT 2 FULLFRAME V2 mounted",
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
                "system.html embed cache-bust anchor not found"
            )

        html_path.write_text(
            html,
            encoding="utf-8",
        )

        # ------------------------------------------------------------
        # 4. VALIDATION
        # ------------------------------------------------------------
        for path in (
            layout_path,
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
        final_layout = layout_path.read_text(encoding="utf-8")

        checks = [
            (PATCH_ID, final_scene),
            ("0.05,\n      0.82,\n      0.57", final_scene),
            ("? 0.955\n        : 0.952;", final_scene),
            ("? 0.948\n        : 0.945;", final_scene),
            ("pos: [-3.00, 0.00, -3.70]", final_layout),
            ("pos: [0, 0.14, 4.30]", final_layout),
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
        log("Variant 2 now matches the viewport aspect instead of forming a flat strip")
        log("Rows expanded in Z so the architecture fills much more vertical space")
        log("Camera moved more top-down so depth maps into screen height")
        log("GLB hardware / labels / live routes preserved")
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
            "Correct MEMEFLOW variant 2 full-frame composition",
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
            f"[VARIANT-2-FULLFRAME-V2] ERROR: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
