#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_REALTIME_ARCHITECTURE_COMPACT_V2"
STAMP = time.strftime("%Y%m%d-%H%M%S")

CSS_BLOCK = r'''
/* ===== MEMEFLOW_REALTIME_ARCHITECTURE_COMPACT_V2 =====
   Mobile-only visual compaction of REAL-TIME ARCHITECTURE.
   LIVE INSPECTOR / TOKEN FLOW / Three.js logic are untouched.
*/

/*
  Current iPhone layout is ~500+ CSS px tall.
  420px is the compact sweet spot:
  - all 4 visual architecture rows still fit
  - LIVE EXECUTION remains above telemetry
  - title + legend stay readable
  - LIVE INSPECTOR moves visibly higher on screen
*/
@media (max-width: 600px) {
  .mf-live-inspector-standalone-layout-v1 .viewport-wrap,
  .viewport-wrap {
    height: 420px !important;
    min-height: 420px !important;
    max-height: 420px !important;
  }
}

/*
  Very short phones: allow a tiny reduction, but never collapse the topology.
*/
@media (max-width: 600px) and (max-height: 720px) {
  .mf-live-inspector-standalone-layout-v1 .viewport-wrap,
  .viewport-wrap {
    height: 410px !important;
    min-height: 410px !important;
    max-height: 410px !important;
  }
}

/*
  Keep tablet composition roomy. The previous standalone Inspector patch
  remains the owner of the general <=900px layout.
*/
@media (min-width: 601px) and (max-width: 900px) {
  .mf-live-inspector-standalone-layout-v1 .viewport-wrap {
    height: clamp(470px, 58dvh, 560px) !important;
    min-height: 470px !important;
    max-height: 560px !important;
  }
}
'''


def log(message: str) -> None:
    print(f"[ARCH-COMPACT-V2] {message}", flush=True)


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

        if (
            (candidate / "system.css").is_file()
            and (candidate / "system.html").is_file()
        ):
            return candidate

    raise RuntimeError(
        "MEMEFLOW project root not found "
        "(need system.css + system.html)"
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
        "git", "branch", "--show-current", cwd=repo
    ).stdout.strip()
    head = run(
        "git", "rev-parse", "HEAD", cwd=repo
    ).stdout.strip()

    log(f"git branch: {branch or '(detached)'}")
    log(f"git HEAD:   {head or '(unknown)'}")

    if not branch:
        raise RuntimeError(
            "detached HEAD: switch to the active pushed branch first"
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
            "system.css/system.html have local changes. "
            "Commit/push them first; nothing was changed."
        )

    return branch, head


def update_css_cache(html: str) -> str:
    updated, count = re.subn(
        r'href="/system\.css(?:\?[^"]*)?"',
        'href="/system.css?v=realtime-architecture-compact-v2"',
        html,
        count=1,
    )
    if count != 1:
        raise RuntimeError(
            f"system.html: expected one system.css link, found {count}"
        )
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Reduce the mobile height of MEMEFLOW REAL-TIME ARCHITECTURE "
            "without touching live data or Three.js logic."
        )
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="commit and push after validation",
    )
    args = parser.parse_args()

    root = find_root()
    css_path = root / "system.css"
    html_path = root / "system.html"
    targets = [css_path, html_path]

    log(f"project: {root}")

    css = css_path.read_text(encoding="utf-8")
    html = html_path.read_text(encoding="utf-8")

    if PATCH_ID in css:
        log("Compact architecture patch is already installed.")
        return 0

    # This patch is designed for the already-installed standalone Inspector.
    if "MEMEFLOW_LIVE_INSPECTOR_STANDALONE_V1" not in css:
        raise RuntimeError(
            "Standalone LIVE INSPECTOR V1 marker not found. "
            "Apply the previous Inspector patch first."
        )

    if ".viewport-wrap" not in css:
        raise RuntimeError("viewport-wrap CSS anchor not found")

    repo = git_root(root)
    branch, old_head = preflight_git(repo, targets)

    backup_dir = root / ".patch-backups" / (
        f"realtime-architecture-compact-v2-{STAMP}"
    )
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(css_path, backup_dir / "system.css")
    shutil.copy2(html_path, backup_dir / "system.html")
    log(f"backup: {backup_dir}")

    new_css = css.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"
    new_html = update_css_cache(html)

    try:
        css_path.write_text(new_css, encoding="utf-8")
        html_path.write_text(new_html, encoding="utf-8")

        if new_css.count(PATCH_ID) != 1:
            raise RuntimeError("CSS patch marker verification failed")

        if "height: 420px !important;" not in new_css:
            raise RuntimeError("420px mobile architecture height not installed")

        if "realtime-architecture-compact-v2" not in new_html:
            raise RuntimeError("system.css cache-bust not installed")

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
        log("iPhone REAL-TIME ARCHITECTURE height: 420px")
        log("Short-phone fallback: 410px")
        log("LIVE INSPECTOR stays separate and immediately below architecture")
        log("TOKEN FLOW order is unchanged")
        log("Three.js / server / AI / trading logic untouched")

    except Exception:
        log("Validation failed; restoring exact pre-patch files.")
        shutil.copy2(backup_dir / "system.css", css_path)
        shutil.copy2(backup_dir / "system.html", html_path)
        log("ROLLBACK COMPLETE")
        raise

    if args.push:
        if repo is None or branch is None:
            log("--push requested, but no git worktree is available.")
            return 0

        relative = [rel_to_repo(path, repo) for path in targets]
        run("git", "add", "--", *relative, cwd=repo)
        run("git", "diff", "--cached", "--check", cwd=repo)

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
            "Compact mobile Real Time Architecture",
            cwd=repo,
            check=False,
        )

        if commit.returncode != 0:
            log(
                "WARNING: visual patch is installed and validated, "
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
            "git", "rev-parse", "HEAD", cwd=repo
        ).stdout.strip()

        log("COMMIT + PUSH COMPLETE")
        log(f"branch: {branch}")
        log(f"previous HEAD: {old_head}")
        log(f"new HEAD:      {new_head}")
    else:
        log("Patch applied locally. Re-run with --push to commit + push.")

    log("DONE")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[ARCH-COMPACT-V2] ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
