#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_ARCHITECTURE_FRAME_SPLIT_V3"
STAMP = time.strftime("%Y%m%d-%H%M%S")

TITLE_CLASS = "mf-architecture-title-standalone-v3"
TELEMETRY_CLASS = "mf-telemetry-standalone-v3"

CSS_BLOCK = r'''
/* ===== MEMEFLOW_ARCHITECTURE_FRAME_SPLIT_V3 =====
   Physical layout split:
   TITLE CARD
   -> pure 3D architecture viewport
   -> telemetry card
   -> LIVE INSPECTOR
   -> TOKEN FLOW

   No IDs or live data bindings are changed.
*/

/* ---------- standalone architecture title ---------- */
.scene-title.mf-architecture-title-standalone-v3 {
  position: relative !important;
  inset: auto !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;

  width: 100% !important;
  max-width: none !important;
  height: auto !important;

  margin: 0 !important;
  padding: 13px 15px !important;

  border-radius: 14px !important;
  transform: none !important;
  pointer-events: none !important;
  z-index: 10 !important;
}

.scene-title.mf-architecture-title-standalone-v3 h1 {
  margin: 5px 0 0 !important;
}

.scene-title.mf-architecture-title-standalone-v3 p {
  margin: 5px 0 0 !important;
}

/* ---------- standalone telemetry ---------- */
.telemetry.mf-telemetry-standalone-v3 {
  position: relative !important;
  inset: auto !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;

  grid-column: auto !important;
  grid-row: auto !important;

  width: 100% !important;
  max-width: none !important;

  margin: 0 !important;
  transform: none !important;

  z-index: 10 !important;
}

/*
  The 3D frame is now allowed to be smaller because title and telemetry
  no longer consume visual space inside the canvas.
*/
@media (max-width: 600px) {
  .mf-live-inspector-standalone-layout-v1 .system-shell {
    grid-template-rows: auto !important;
    grid-auto-rows: auto !important;
    gap: 6px !important;
  }

  .scene-title.mf-architecture-title-standalone-v3 {
    padding: 10px 11px !important;
    border-radius: 13px !important;
  }

  .scene-title.mf-architecture-title-standalone-v3 .eyebrow {
    font-size: 5px !important;
    letter-spacing: .17em !important;
  }

  .scene-title.mf-architecture-title-standalone-v3 h1 {
    margin-top: 4px !important;
    font-size: 13px !important;
    line-height: 1.05 !important;
  }

  .scene-title.mf-architecture-title-standalone-v3 p {
    display: none !important;
  }

  /*
    Pure 3D canvas:
    350px keeps all four architecture rows readable on current iPhone
    while removing the large black vertical gaps.
  */
  .mf-live-inspector-standalone-layout-v1 .viewport-wrap,
  .viewport-wrap {
    height: 350px !important;
    min-height: 350px !important;
    max-height: 350px !important;
    margin: 0 !important;
  }

  /*
    The legend stays inside the 3D frame, but moves to its own compact
    top position now that the title card is no longer overlaying it.
  */
  .viewport-wrap .legend {
    left: 9px !important;
    top: 8px !important;
    right: auto !important;
    bottom: auto !important;

    gap: 8px !important;
    padding: 4px 6px !important;
    border-radius: 8px !important;
  }

  .viewport-wrap .legend span {
    font-size: 5px !important;
    gap: 4px !important;
  }

  .viewport-wrap .legend-dot {
    width: 5px !important;
    height: 5px !important;
  }

  .telemetry.mf-telemetry-standalone-v3 {
    height: 58px !important;
    min-height: 58px !important;
    max-height: 58px !important;

    padding: 5px 6px !important;
    border-radius: 11px !important;

    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 4px !important;
  }

  .telemetry.mf-telemetry-standalone-v3 .telemetry-item {
    min-width: 0 !important;
    padding: 2px 6px !important;
  }

  .telemetry.mf-telemetry-standalone-v3
  .telemetry-item:nth-child(n + 4) {
    display: none !important;
  }

  .telemetry.mf-telemetry-standalone-v3 .telemetry-item span {
    font-size: 4.5px !important;
  }

  .telemetry.mf-telemetry-standalone-v3 .telemetry-item strong {
    margin-top: 2px !important;
    font-size: 10px !important;
  }

  .telemetry.mf-telemetry-standalone-v3 .telemetry-item small {
    margin-left: 2px !important;
    font-size: 4.5px !important;
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

/* Tablet: same split, with a little more room for the 3D topology. */
@media (min-width: 601px) and (max-width: 900px) {
  .mf-live-inspector-standalone-layout-v1 .system-shell {
    grid-template-rows: auto !important;
    grid-auto-rows: auto !important;
  }

  .scene-title.mf-architecture-title-standalone-v3 {
    padding: 11px 13px !important;
  }

  .mf-live-inspector-standalone-layout-v1 .viewport-wrap,
  .viewport-wrap {
    height: 430px !important;
    min-height: 430px !important;
    max-height: 430px !important;
    margin: 0 !important;
  }

  .viewport-wrap .legend {
    top: 12px !important;
  }

  .telemetry.mf-telemetry-standalone-v3 {
    min-height: 62px !important;
    margin: 0 !important;
  }
}

/* Desktop: title and telemetry are still true siblings of the 3D viewport. */
@media (min-width: 901px) {
  .mf-live-inspector-standalone-layout-v1 .system-shell {
    grid-template-rows: auto !important;
    grid-auto-rows: auto !important;
    gap: 10px !important;
  }

  .scene-title.mf-architecture-title-standalone-v3 {
    margin: 0 !important;
  }

  .telemetry.mf-telemetry-standalone-v3 {
    min-height: 62px !important;
    margin: 0 !important;
  }
}
'''


def log(message: str) -> None:
    print(f"[ARCH-SPLIT-V3] {message}", flush=True)


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
            "system.css/system.html have local changes. "
            "Commit/push them first; nothing was changed."
        )

    return branch, head


def extract_title(html: str) -> tuple[str, str]:
    pattern = re.compile(
        r'(?P<indent>[ \t]*)'
        r'<div class="scene-title glass">\s*'
        r'<span class="eyebrow">REAL-TIME ARCHITECTURE</span>\s*'
        r'<h1>Live MEMEFLOW pipeline</h1>\s*'
        r'<p>.*?</p>\s*'
        r'</div>\s*',
        re.S,
    )

    match = pattern.search(html)

    if not match:
        raise RuntimeError(
            "REAL-TIME ARCHITECTURE title block not found"
        )

    block = match.group(0).strip()
    block = block.replace(
        'class="scene-title glass"',
        f'class="scene-title glass {TITLE_CLASS}"',
        1,
    )

    html_without = html[:match.start()] + html[match.end():]

    return html_without, block


def extract_telemetry(html: str) -> tuple[str, str]:
    pattern = re.compile(
        r'(?P<indent>[ \t]*)'
        r'<section class="telemetry glass" '
        r'aria-label="Live telemetry">.*?</section>\s*',
        re.S,
    )

    match = pattern.search(html)

    if not match:
        raise RuntimeError("Live telemetry block not found")

    block = match.group(0).strip()
    block = block.replace(
        'class="telemetry glass"',
        f'class="telemetry glass {TELEMETRY_CLASS}"',
        1,
    )

    html_without = html[:match.start()] + html[match.end():]

    return html_without, block


def reparent_blocks(html: str) -> str:
    html, title = extract_title(html)
    html, telemetry = extract_telemetry(html)

    viewport_anchor = '    <section class="viewport-wrap">'

    if html.count(viewport_anchor) != 1:
        raise RuntimeError(
            "Expected exactly one viewport-wrap opening section"
        )

    html = html.replace(
        viewport_anchor,
        "    " + title.replace("\n", "\n    ")
        + "\n\n"
        + viewport_anchor,
        1,
    )

    activity_anchor = '    <section class="activity-panel glass">'

    if html.count(activity_anchor) != 1:
        raise RuntimeError(
            "Expected exactly one TOKEN FLOW activity panel"
        )

    html = html.replace(
        activity_anchor,
        "    " + telemetry.replace("\n", "\n    ")
        + "\n\n"
        + activity_anchor,
        1,
    )

    return html


def update_css_cache(html: str) -> str:
    updated, count = re.subn(
        r'href="/system\.css(?:\?[^"]*)?"',
        'href="/system.css?v=architecture-frame-split-v3"',
        html,
        count=1,
    )

    if count != 1:
        raise RuntimeError(
            f"system.html: expected one system.css link, found {count}"
        )

    return updated


def validate_html(html: str) -> None:
    required_once = [
        'class="scene-title glass ' + TITLE_CLASS + '"',
        'class="telemetry glass ' + TELEMETRY_CLASS + '"',
        'class="viewport-wrap"',
        'class="activity-panel glass"',
        'id="eventCount"',
        'id="tradeCount"',
        'id="holderQueue"',
        'id="inspector"',
    ]

    for needle in required_once:
        count = html.count(needle)
        if count != 1:
            raise RuntimeError(
                f"HTML validation failed for {needle!r}: count={count}"
            )

    title_pos = html.index(TITLE_CLASS)
    viewport_pos = html.index('class="viewport-wrap"')
    telemetry_pos = html.index(TELEMETRY_CLASS)
    token_flow_pos = html.index('class="activity-panel glass"')

    if not (
        title_pos
        < viewport_pos
        < telemetry_pos
        < token_flow_pos
    ):
        raise RuntimeError(
            "Final document order is wrong: "
            "TITLE -> 3D -> TELEMETRY -> TOKEN FLOW expected"
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Move the MEMEFLOW architecture title above the 3D viewport "
            "and telemetry below it."
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

    if PATCH_ID in css and TITLE_CLASS in html and TELEMETRY_CLASS in html:
        log("Architecture frame split V3 is already installed.")
        return 0

    if PATCH_ID in css or TITLE_CLASS in html or TELEMETRY_CLASS in html:
        raise RuntimeError(
            "partial V3 installation detected; refusing to stack over it"
        )

    # Guard the exact current layout generation.
    if "MEMEFLOW_LIVE_INSPECTOR_STANDALONE_V1" not in css:
        raise RuntimeError(
            "Standalone LIVE INSPECTOR V1 marker not found"
        )

    if "MEMEFLOW_REALTIME_ARCHITECTURE_COMPACT_V2" not in css:
        raise RuntimeError(
            "Compact REAL-TIME ARCHITECTURE V2 marker not found"
        )

    repo = git_root(root)
    branch, old_head = preflight_git(repo, targets)

    backup_dir = root / ".patch-backups" / (
        f"architecture-frame-split-v3-{STAMP}"
    )
    backup_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(css_path, backup_dir / "system.css")
    shutil.copy2(html_path, backup_dir / "system.html")

    log(f"backup: {backup_dir}")

    new_html = reparent_blocks(html)
    new_html = update_css_cache(new_html)
    new_css = css.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"

    try:
        validate_html(new_html)

        if new_css.count(PATCH_ID) != 1:
            raise RuntimeError("CSS marker verification failed")

        css_path.write_text(new_css, encoding="utf-8")
        html_path.write_text(new_html, encoding="utf-8")

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
        log("REAL-TIME ARCHITECTURE title is now ABOVE the 3D frame")
        log("3D viewport now contains only the scene + decision legend")
        log("EVENTS / TRADE EVENTS / HOLDER QUEUE is now BELOW the 3D frame")
        log("LIVE INSPECTOR remains below telemetry")
        log("TOKEN FLOW remains below LIVE INSPECTOR")
        log("iPhone pure 3D viewport height: 350px")
        log("No telemetry IDs, Three.js, server, AI or trading logic changed")

    except Exception:
        log("Validation failed; restoring exact pre-patch files.")

        shutil.copy2(
            backup_dir / "system.css",
            css_path,
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
            "Split architecture title and telemetry from 3D frame",
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
            f"[ARCH-SPLIT-V3] ERROR: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
