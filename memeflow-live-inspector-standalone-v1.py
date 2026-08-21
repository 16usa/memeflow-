#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_LIVE_INSPECTOR_STANDALONE_V1"
STAMP = time.strftime("%Y%m%d-%H%M%S")

JS_BLOCK = r'''
/* ===== MEMEFLOW_LIVE_INSPECTOR_STANDALONE_V1 =====
   Layout-only patch:
   - moves the existing LIVE INSPECTOR DOM node out of the 3D architecture card
   - places that SAME live node immediately before TOKEN FLOW
   - preserves all existing IDs, event handlers and live data bindings
*/
const MF_LIVE_INSPECTOR_STANDALONE_V1 = {
  installed: false,
  observer: null,
  retryTimer: null,
  retryCount: 0
};

function mfLiveInspectorV1TokenFlow() {
  const panels = Array.from(document.querySelectorAll('.activity-panel'));

  const byHeading = panels.find((panel) => {
    const head = panel.querySelector('.activity-head');
    const text = String(head?.textContent || panel.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    return text.includes('TOKEN FLOW') ||
      text.includes('RECENT PIPELINE STATE');
  });

  return byHeading || panels[0] || null;
}

function mfLiveInspectorV1Move() {
  const inspector = document.querySelector('.inspector');
  const tokenFlow = mfLiveInspectorV1TokenFlow();

  if (!inspector || !tokenFlow || !tokenFlow.parentElement) {
    return false;
  }

  if (inspector === tokenFlow || inspector.contains(tokenFlow)) {
    console.error(
      '[LIVE-INSPECTOR-V1] Refusing invalid inspector/token-flow topology'
    );
    return false;
  }

  const parent = tokenFlow.parentElement;

  inspector.classList.add('mf-live-inspector-standalone-v1');
  document.documentElement.classList.add(
    'mf-live-inspector-standalone-layout-v1'
  );

  if (
    inspector.parentElement !== parent ||
    inspector.nextElementSibling !== tokenFlow
  ) {
    parent.insertBefore(inspector, tokenFlow);
  }

  return (
    inspector.parentElement === parent &&
    inspector.nextElementSibling === tokenFlow
  );
}

function mfLiveInspectorV1Install() {
  if (MF_LIVE_INSPECTOR_STANDALONE_V1.installed) {
    mfLiveInspectorV1Move();
    return;
  }

  MF_LIVE_INSPECTOR_STANDALONE_V1.installed = true;

  if (!mfLiveInspectorV1Move()) {
    MF_LIVE_INSPECTOR_STANDALONE_V1.retryTimer = setInterval(() => {
      MF_LIVE_INSPECTOR_STANDALONE_V1.retryCount += 1;

      if (
        mfLiveInspectorV1Move() ||
        MF_LIVE_INSPECTOR_STANDALONE_V1.retryCount >= 120
      ) {
        clearInterval(
          MF_LIVE_INSPECTOR_STANDALONE_V1.retryTimer
        );
        MF_LIVE_INSPECTOR_STANDALONE_V1.retryTimer = null;
      }
    }, 100);
  }

  MF_LIVE_INSPECTOR_STANDALONE_V1.observer =
    new MutationObserver(() => {
      const inspector = document.querySelector('.inspector');
      const tokenFlow = mfLiveInspectorV1TokenFlow();

      if (
        inspector &&
        tokenFlow &&
        tokenFlow.parentElement &&
        (
          inspector.parentElement !== tokenFlow.parentElement ||
          inspector.nextElementSibling !== tokenFlow
        )
      ) {
        queueMicrotask(mfLiveInspectorV1Move);
      }
    });

  MF_LIVE_INSPECTOR_STANDALONE_V1.observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  console.log(
    '[LIVE-INSPECTOR-V1] Standalone LIVE INSPECTOR installed'
  );
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    mfLiveInspectorV1Install,
    { once: true }
  );
} else {
  queueMicrotask(mfLiveInspectorV1Install);
}
'''

CSS_BLOCK = r'''
/* ===== MEMEFLOW_LIVE_INSPECTOR_STANDALONE_V1 ===== */

/*
  The real .inspector node is now a sibling of TOKEN FLOW.
  These rules neutralize its old overlay/grid positioning only.
*/
.mf-live-inspector-standalone-v1 {
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
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;

  margin: 0 !important;
  transform: none !important;
  translate: none !important;

  align-self: auto !important;
  justify-self: stretch !important;

  overflow: hidden !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  z-index: 8 !important;
}

/* Keep the architecture, standalone Inspector and Token Flow in document order. */
.mf-live-inspector-standalone-layout-v1 body {
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

.mf-live-inspector-standalone-layout-v1 .system-shell {
  height: auto !important;
  min-height: 100dvh !important;
  overflow: visible !important;
  align-content: start !important;
}

/*
  Existing mobile V29.x used:
    row 1 = canvas
    row 2 = inspector
    row 3 = telemetry
  After re-parenting Inspector, the empty second row collapses and telemetry
  remains inside REAL-TIME ARCHITECTURE.
*/
@media (max-width: 900px) {
  .mf-live-inspector-standalone-layout-v1,
  .mf-live-inspector-standalone-layout-v1 body {
    width: 100% !important;
    height: auto !important;
    min-height: 100% !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    overscroll-behavior-y: auto !important;
  }

  .mf-live-inspector-standalone-layout-v1 .system-shell {
    display: grid !important;
    grid-template-rows: auto auto auto auto !important;
    gap: 6px !important;
    height: auto !important;
    min-height: 100dvh !important;
    overflow: visible !important;
  }

  .mf-live-inspector-standalone-layout-v1 .viewport-wrap {
    /*
      Keep a real 3D scene after the shell stops being a fixed-height grid.
      No scene/Three.js logic is changed.
    */
    height: clamp(500px, 68dvh, 760px) !important;
    min-height: 500px !important;
  }

  .mf-live-inspector-standalone-v1 {
    margin: 0 !important;
    padding: 8px 9px !important;
    border-radius: 13px !important;
  }
}

@media (max-width: 430px) {
  .mf-live-inspector-standalone-layout-v1 .viewport-wrap {
    height: clamp(500px, 66dvh, 690px) !important;
  }
}

/* Desktop/tablet: standalone card, not a floating overlay. */
@media (min-width: 901px) {
  .mf-live-inspector-standalone-layout-v1 .system-shell {
    grid-template-rows: auto minmax(620px, 1fr) auto auto !important;
  }

  .mf-live-inspector-standalone-v1 {
    margin: 0 !important;
  }
}
'''


def log(message: str) -> None:
    print(f"[LIVE-INSPECTOR-V1] {message}", flush=True)


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

    for base in (
        Path("/home/runner/workspace"),
        Path.home() / "workspace",
        cwd,
    ):
        if not base.exists():
            continue
        try:
            for system_js in base.glob("**/system.js"):
                root = system_js.parent
                if (
                    (root / "system.css").is_file()
                    and (root / "system.html").is_file()
                ):
                    return root.resolve()
        except Exception:
            pass

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
        "git", "branch", "--show-current", cwd=repo
    ).stdout.strip()
    head = run(
        "git", "rev-parse", "HEAD", cwd=repo
    ).stdout.strip()

    log(f"git branch: {branch or '(detached)'}")
    log(f"git HEAD:   {head or '(unknown)'}")

    if not branch:
        raise RuntimeError(
            "detached HEAD: switch to the pushed branch first"
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
            "target System files have local changes. "
            "Commit/push them first; nothing was changed."
        )

    return branch, head


def cache_bust(html: str) -> str:
    html2, css_count = re.subn(
        r'href="/system\.css(?:\?[^"]*)?"',
        'href="/system.css?v=live-inspector-standalone-v1"',
        html,
        count=1,
    )
    html3, js_count = re.subn(
        r'src="/system\.js(?:\?[^"]*)?"',
        'src="/system.js?v=live-inspector-standalone-v1"',
        html2,
        count=1,
    )

    if css_count != 1:
        raise RuntimeError(
            f"system.html: expected one system.css reference, found {css_count}"
        )
    if js_count != 1:
        raise RuntimeError(
            f"system.html: expected one system.js reference, found {js_count}"
        )

    return html3


def node_check(path: Path) -> None:
    result = run("node", "--check", str(path), check=False)
    if result.returncode != 0:
        raise RuntimeError(f"JavaScript syntax failed: {path}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Move MEMEFLOW LIVE INSPECTOR out of REAL-TIME ARCHITECTURE "
            "and place it immediately above TOKEN FLOW."
        )
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="after validation, commit and push the active git branch",
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

    js_has = PATCH_ID in js
    css_has = PATCH_ID in css

    if js_has and css_has:
        log("Patch is already installed; nothing to do.")
        return 0

    if js_has != css_has:
        raise RuntimeError(
            "partial previous installation detected "
            "(marker exists in only one of system.js/system.css)"
        )

    # Fail early if the expected live UI anchors disappeared in a newer build.
    if ".inspector" not in css and "inspector" not in js:
        raise RuntimeError(
            "LIVE INSPECTOR anchor not found in current System frontend"
        )
    if ".activity-panel" not in css and "activity-panel" not in js:
        raise RuntimeError(
            "TOKEN FLOW / activity-panel anchor not found in current System frontend"
        )

    repo = git_root(root)
    branch, old_head = preflight_git(repo, targets)

    backup_dir = root / ".patch-backups" / (
        f"live-inspector-standalone-v1-{STAMP}"
    )
    backup_dir.mkdir(parents=True, exist_ok=True)

    for path in targets:
        shutil.copy2(path, backup_dir / path.name)

    log(f"backup: {backup_dir}")

    new_js = js.rstrip() + "\n\n" + JS_BLOCK.strip() + "\n"
    new_css = css.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"
    new_html = cache_bust(html)

    try:
        js_path.write_text(new_js, encoding="utf-8")
        css_path.write_text(new_css, encoding="utf-8")
        html_path.write_text(new_html, encoding="utf-8")

        node_check(js_path)

        if new_js.count(PATCH_ID) != 1:
            raise RuntimeError("system.js patch marker verification failed")
        if new_css.count(PATCH_ID) != 1:
            raise RuntimeError("system.css patch marker verification failed")
        if "live-inspector-standalone-v1" not in new_html:
            raise RuntimeError("system.html cache-bust verification failed")

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
        log("REAL-TIME ARCHITECTURE keeps the 3D scene + telemetry")
        log("LIVE INSPECTOR is now a standalone block")
        log("LIVE INSPECTOR is inserted immediately before TOKEN FLOW")
        log("Existing Inspector node/IDs/live bindings are preserved")
        log("No server, AI, evaluator, market or trading logic was modified")

    except Exception:
        log("Validation failed; restoring exact pre-patch System files.")
        for path in targets:
            backup = backup_dir / path.name
            if backup.exists():
                shutil.copy2(backup, path)
        log("ROLLBACK COMPLETE")
        raise

    if args.push:
        if repo is None or branch is None:
            log("--push requested but no git worktree is available; local patch kept.")
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
            log("No staged delta after patch; nothing to commit.")
            return 0

        commit = run(
            "git",
            "commit",
            "-m",
            "Move Live Inspector above Token Flow",
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
                "WARNING: commit created, but git push failed. "
                "The local Replit patch remains installed."
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
        print(f"[LIVE-INSPECTOR-V1] ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
