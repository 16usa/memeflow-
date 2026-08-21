#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_TRUE_3D_STAGE_FILL_V7"
VERSION = "true-3d-stage-fill-v7"
STAMP = time.strftime("%Y%m%d-%H%M%S")


def log(message: str) -> None:
    print(f"[TRUE-3D-STAGE-V7] {message}", flush=True)


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
            and
            (candidate / "memeflow-3d" / "layout.js").is_file()
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
            "Make the current GLB scene fill the existing viewport more strongly, "
            "compress empty depth, lower the hero camera, and add subtle stage depth. "
            "No CSS changes."
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

    current_scene = scene_path.read_text(
        encoding="utf-8"
    )

    if PATCH_ID in current_scene:
        log("Stage Fill V7 is already installed.")
        return 0

    if (
        "MEMEFLOW_TRUE_3D_HERO_V6"
        not in current_scene
    ):
        raise RuntimeError(
            "Hero V6 baseline not found; refusing to patch unknown renderer."
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
        / f"true-3d-stage-v7-{STAMP}"
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
        # ---------- tighter, wider composition ----------
        layout = layout_path.read_text(
            encoding="utf-8"
        )

        replacements = [
            (
                "{ id: 'discovery', label: 'DISCOVERY', color: 0x315cff, pos: [-3.00, 0, -3.00], size: [2.36, 1.60] }",
                "{ id: 'discovery', label: 'DISCOVERY', color: 0x315cff, pos: [-3.30, 0.00, -2.48], size: [2.58, 1.68] }",
            ),
            (
                "{ id: 'bootstrap', label: 'FAST BOOTSTRAP', color: 0x315cff, pos: [0, 0, -3.00], size: [2.52, 1.60] }",
                "{ id: 'bootstrap', label: 'FAST BOOTSTRAP', color: 0x315cff, pos: [0, 0.00, -2.48], size: [2.72, 1.68] }",
            ),
            (
                "{ id: 'core', label: 'MEMEFLOW CORE', color: 0x56e79a, pos: [3.00, 0, -3.00], size: [3.12, 2.02], core: true }",
                "{ id: 'core', label: 'MEMEFLOW CORE', color: 0x56e79a, pos: [3.30, 0.14, -2.48], size: [3.44, 2.16], core: true }",
            ),
            (
                "{ id: 'risk', label: 'RISK ENGINE', color: 0x43c8ee, pos: [-3.00, 0, -0.42], size: [2.36, 1.60] }",
                "{ id: 'risk', label: 'RISK ENGINE', color: 0x43c8ee, pos: [-3.30, 0.02, -0.42], size: [2.58, 1.68] }",
            ),
            (
                "{ id: 'market', label: 'MARKET LEDGER', color: 0x3a7dff, pos: [0, 0, -0.42], size: [2.42, 1.60] }",
                "{ id: 'market', label: 'MARKET LEDGER', color: 0x3a7dff, pos: [0, 0.02, -0.42], size: [2.64, 1.68] }",
            ),
            (
                "{ id: 'holders', label: 'HOLDER LEDGER', color: 0x43c8ee, pos: [3.00, 0, -0.42], size: [2.36, 1.60] }",
                "{ id: 'holders', label: 'HOLDER LEDGER', color: 0x43c8ee, pos: [3.30, 0.02, -0.42], size: [2.58, 1.68] }",
            ),
            (
                "{ id: 'openai', label: 'OPENAI ASSISTANT', color: 0x43c8ee, pos: [-3.00, 0, 2.16], size: [2.48, 1.60] }",
                "{ id: 'openai', label: 'OPENAI ASSISTANT', color: 0x43c8ee, pos: [-3.30, 0.04, 1.64], size: [2.72, 1.68] }",
            ),
            (
                "{ id: 'decision', label: 'DECISION', color: 0x8d58ff, pos: [0, 0, 2.16], size: [2.28, 1.60], decision: true }",
                "{ id: 'decision', label: 'DECISION', color: 0x8d58ff, pos: [0, 0.10, 1.64], size: [2.48, 1.68], decision: true }",
            ),
            (
                "{ id: 'paper', label: 'PAPER ENGINE', color: 0x315cff, pos: [3.00, 0, 2.16], size: [2.36, 1.60] }",
                "{ id: 'paper', label: 'PAPER ENGINE', color: 0x315cff, pos: [3.30, 0.04, 1.64], size: [2.58, 1.68] }",
            ),
            (
                "{ id: 'execution', label: 'LIVE EXECUTION', color: 0x48df8b, pos: [0, 0, 4.70], size: [2.58, 1.66], execution: true }",
                "{ id: 'execution', label: 'LIVE EXECUTION', color: 0x48df8b, pos: [0, 0.12, 3.72], size: [2.84, 1.76], execution: true }",
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

        # ---------- use node Y for real depth hierarchy ----------
        modules = modules_path.read_text(
            encoding="utf-8"
        )

        modules = replace_once(
            modules,
            "  group.position.set(\n    node.pos[0],\n    0,\n    node.pos[2]\n  );",
            "  group.position.set(\n    node.pos[0],\n    Number(node.pos?.[1]) || 0,\n    node.pos[2]\n  );",
            "node Y positioning",
        )

        modules_path.write_text(
            modules,
            encoding="utf-8",
        )

        # ---------- camera / lighting / stage ----------
        scene = scene_path.read_text(
            encoding="utf-8"
        )

        scene = replace_once(
            scene,
            "./layout.js?v=true-3d-hero-v6",
            "./layout.js?v=true-3d-stage-fill-v7",
            "layout import",
        )

        scene = replace_once(
            scene,
            "./modules.js?v=true-3d-hero-v6",
            "./modules.js?v=true-3d-stage-fill-v7",
            "modules import",
        )

        scene = replace_once(
            scene,
            "      0.18,\n      0.28,\n      0.90",
            "      0.12,\n      0.24,\n      0.92",
            "bloom",
        )

        scene = replace_once(
            scene,
            "      0x58d7ff,\n      6.5,\n      21,",
            "      0x58d7ff,\n      3.6,\n      19,",
            "cyan light",
        )

        scene = replace_once(
            scene,
            "      0x57e69a,\n      9.0,\n      18,",
            "      0x57e69a,\n      5.0,\n      17,",
            "green light",
        )

        scene = replace_once(
            scene,
            "      0x8d58ff,\n      5.2,\n      15,",
            "      0x8d58ff,\n      3.2,\n      14,",
            "violet light",
        )

        scene = replace_once(
            scene,
            "      0.73,\n      0.69",
            "      0.64,\n      0.77",
            "camera direction",
        )

        scene = replace_once(
            scene,
            "      aspect < 0.82\n        ? 0.965\n        : 0.955;",
            "      aspect < 0.82\n        ? 0.985\n        : 0.975;",
            "x fill limit",
        )

        scene = replace_once(
            scene,
            "      aspect < 0.82\n        ? 0.955\n        : 0.945;",
            "      aspect < 0.82\n        ? 0.972\n        : 0.962;",
            "y fill limit",
        )

        stage_anchor = (
            "  scene.add(violetDecision);\n\n"
            "  const assets =\n"
            "    await loadHardwareAssets();"
        )

        stage_code = (
            "  scene.add(violetDecision);\n\n"
            "  const stage = new THREE.Mesh(\n"
            "    new THREE.PlaneGeometry(13.6, 9.8),\n"
            "    new THREE.MeshBasicMaterial({\n"
            "      color: 0x071018,\n"
            "      transparent: true,\n"
            "      opacity: 0.12,\n"
            "      depthWrite: false,\n"
            "      side: THREE.DoubleSide\n"
            "    })\n"
            "  );\n\n"
            "  stage.rotation.x = -Math.PI / 2;\n"
            "  stage.position.set(0, -0.72, 0.55);\n"
            "  scene.add(stage);\n\n"
            "  const stageRing = new THREE.Mesh(\n"
            "    new THREE.RingGeometry(3.9, 5.6, 96),\n"
            "    new THREE.MeshBasicMaterial({\n"
            "      color: 0x133247,\n"
            "      transparent: true,\n"
            "      opacity: 0.055,\n"
            "      depthWrite: false,\n"
            "      side: THREE.DoubleSide\n"
            "    })\n"
            "  );\n\n"
            "  stageRing.rotation.x = -Math.PI / 2;\n"
            "  stageRing.position.set(0, -0.705, 0.55);\n"
            "  scene.add(stageRing);\n\n"
            "  const assets =\n"
            "    await loadHardwareAssets();"
        )

        scene = replace_once(
            scene,
            stage_anchor,
            stage_code,
            "stage insertion",
        )

        scene = scene.rstrip() + f"\n\n/* ===== {PATCH_ID} ===== */\n"

        scene_path.write_text(
            scene,
            encoding="utf-8",
        )

        # ---------- cache bust ----------
        embed = embed_path.read_text(
            encoding="utf-8"
        )

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
            "[TRUE-3D] HERO V6 mounted",
            "[TRUE-3D] STAGE FILL V7 mounted",
            1,
        )

        embed_path.write_text(
            embed,
            encoding="utf-8",
        )

        html = html_path.read_text(
            encoding="utf-8"
        )

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

        # ---------- checks ----------
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

        final_scene = scene_path.read_text(
            encoding="utf-8"
        )

        final_layout = layout_path.read_text(
            encoding="utf-8"
        )

        final_modules = modules_path.read_text(
            encoding="utf-8"
        )

        checks = [
            (PATCH_ID, final_scene),
            ("0.64,", final_scene),
            ("0.77", final_scene),
            ("0.985", final_scene),
            ("0.972", final_scene),
            ("new THREE.PlaneGeometry(13.6, 9.8)", final_scene),
            ("pos: [-3.30", final_layout),
            ("pos: [0, 0.12, 3.72]", final_layout),
            ("Number(node.pos?.[1]) || 0", final_modules),
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
        log("Scene width increased and vertical topology compressed")
        log("Initial view now uses almost the entire 3D window")
        log("Camera lowered again for stronger physical depth")
        log("Node Y hierarchy enabled: Core / Decision / Execution sit at real elevations")
        log("Subtle dark stage + ring added under topology")
        log("Bloom and point lights reduced to remove the green/white hotspot")
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
            "Fill MEMEFLOW 3D stage and deepen hero composition",
            cwd=repo,
            check=False,
        )

        if commit.returncode != 0:
            log(
                "WARNING: V7 installed but commit failed."
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
            f"[TRUE-3D-STAGE-V7] ERROR: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
