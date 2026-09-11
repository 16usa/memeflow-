#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

EXPECTED_HEAD = "f5dbc2f12d38cdf7dbff36b4209f3303a342dd14"
EXPECTED_BLOBS = {
    "memeflow-app/trading.css": "982587a2eab655ccc11ad6adf8810f38d77f4f70",
    "memeflow-app/trading.html": "76740450ae0bc8a47dd1a496d7d7a96ea0fd0fe6",
    "memeflow-app/trading.js": "b1dfd933c95fffaaefe02ffce8385fcc4d3f305a",
}

OLD_CACHE = "/trading.css?v=pending-approvals-canonical-cleanup-v1-20260909"
NEW_CACHE = "/trading.css?v=trade-control-cleanup-v1-20260909"

# Legacy inline Trade Control editor/actions no longer exist in current trading.html.
# Keep .control-panel because it is the live Trade Strategy container.
# Keep .control-error because Trade Strategy still renders it.
DEAD_SELECTORS = (
    ".control-section",
    ".primary-control",
    ".row-title",
    ".amount-box",
    ".unit-toggle",
    ".field-hint",
    ".strategy-grid",
    ".switch-label",
    ".control-actions",
    ".secondary-btn",
    ".start-btn",
    ".pause-btn",
    ".assist-btn",
    ".control-foot",
)

CORE_DEAD = (
    ".control-section",
    ".amount-box",
    ".strategy-grid",
    ".control-actions",
    ".assist-btn",
    ".start-btn",
    ".pause-btn",
)

LIVE_REQUIRED = (
    ".control-panel",
    ".control-error",
    ".strategy-summary-panel",
    ".mode-badge",
)


def sh(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=check)


def project_root() -> Path:
    candidates = [Path.cwd(), Path("/home/runner/workspace")]
    for root in candidates:
        if (root / "memeflow-app" / "trading.css").is_file() and (root / ".git").exists():
            return root.resolve()
    raise RuntimeError("MEMEFLOW project root not found")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    lines = [line.rstrip(" \t") for line in text.splitlines()]
    path.write_text("\n".join(lines).rstrip("\n") + "\n", encoding="utf-8")


def git_blob(path: Path, root: Path) -> str:
    return sh(["git", "hash-object", str(path.relative_to(root))], root).stdout.strip()


def previous_boundary(text: str, pos: int) -> int:
    # CSS selector begins after the nearest structural delimiter. Comments and
    # whitespace between the delimiter and selector are intentionally included
    # only when they are directly attached to that rule.
    candidates = [text.rfind("}", 0, pos), text.rfind("{", 0, pos), text.rfind(";", 0, pos)]
    return max(candidates) + 1


def matching_brace(text: str, open_pos: int) -> int:
    depth = 0
    i = open_pos
    quote = None
    while i < len(text):
        ch = text[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end < 0:
                raise RuntimeError("unterminated CSS comment")
            i = end + 2
            continue
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
            if depth < 0:
                break
        i += 1
    raise RuntimeError("unbalanced CSS while locating rule")


def remove_rules_for_token(text: str, token: str) -> tuple[str, int]:
    removed = 0
    search_from = 0
    while True:
        pos = text.find(token, search_from)
        if pos < 0:
            break

        # Ignore token-like text inside a comment.
        comment_start = text.rfind("/*", 0, pos)
        comment_end = text.rfind("*/", 0, pos)
        if comment_start > comment_end:
            search_from = pos + len(token)
            continue

        brace = text.find("{", pos + len(token))
        if brace < 0:
            raise RuntimeError(f"selector {token} has no opening brace")

        between = text[pos + len(token):brace]
        if "}" in between or ";" in between:
            # Not part of a selector prelude.
            search_from = pos + len(token)
            continue

        start = previous_boundary(text, pos)
        prelude = text[start:brace]
        if token not in prelude:
            search_from = pos + len(token)
            continue

        end = matching_brace(text, brace) + 1
        text = text[:start] + text[end:]
        removed += 1
        search_from = max(0, start - 1)
    return text, removed


def remove_empty_media(text: str) -> str:
    # Rule removal can leave a media wrapper with only whitespace/comments.
    # Remove only obviously empty wrappers; never collapse non-empty media.
    pattern = re.compile(r"@media\s*[^{}]+\{(?:\s|/\*.*?\*/)*\}", re.S)
    while True:
        new = pattern.sub("", text)
        if new == text:
            return text
        text = new


def transform_css(css: str) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    out = css
    for token in DEAD_SELECTORS:
        out, n = remove_rules_for_token(out, token)
        counts[token] = n

    # The retained note was useful during Pending Approvals cleanup, but is now
    # stale because this pass intentionally removes those legacy Trade Control rules.
    out = out.replace("/* Trade-control ASSIST state controls retained unchanged. */\n", "")
    out = remove_empty_media(out)
    out = re.sub(r"\n{4,}", "\n\n\n", out)
    return out, counts


def braces_ok(text: str) -> bool:
    depth = 0
    i = 0
    quote = None
    while i < len(text):
        ch = text[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end < 0:
                return False
            i = end + 2
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth < 0:
                return False
        i += 1
    return depth == 0 and quote is None


def validate(root: Path, before_html: str | None = None, before_js: str | None = None) -> None:
    css_path = root / "memeflow-app/trading.css"
    html_path = root / "memeflow-app/trading.html"
    js_path = root / "memeflow-app/trading.js"
    css = read(css_path)
    html = read(html_path)
    js = read(js_path)

    if not braces_ok(css):
        raise RuntimeError("CSS braces / comments / strings validation failed")
    if not css.endswith("\n") or not html.endswith("\n"):
        raise RuntimeError("EOF newline validation failed")

    leftovers = [token for token in DEAD_SELECTORS if token in css]
    if leftovers:
        raise RuntimeError("legacy Trade Control selectors remain: " + ", ".join(leftovers))

    for token in LIVE_REQUIRED:
        if token not in css:
            raise RuntimeError(f"live selector was lost: {token}")

    if html.count(NEW_CACHE) != 1:
        raise RuntimeError(f"HTML cache-bust expected exactly once: {NEW_CACHE}")
    if OLD_CACHE in html:
        raise RuntimeError("old Trading CSS cache-bust still remains")

    # No DOM/JS structure or behavior is changed by this style cleanup.
    if before_html is not None:
        expected_html = before_html.replace(OLD_CACHE, NEW_CACHE, 1)
        if html != expected_html:
            raise RuntimeError("trading.html changed beyond the one cache-bust replacement")
    if before_js is not None and js != before_js:
        raise RuntimeError("trading.js changed unexpectedly")

    diff = sh(["git", "diff", "--check"], root, check=False)
    if diff.returncode != 0:
        raise RuntimeError("git diff --check failed:\n" + diff.stdout + diff.stderr)


def preflight(root: Path, selftest: bool) -> tuple[str, str, str]:
    css_path = root / "memeflow-app/trading.css"
    html_path = root / "memeflow-app/trading.html"
    js_path = root / "memeflow-app/trading.js"

    css = read(css_path)
    html = read(html_path)
    js = read(js_path)

    if not selftest:
        head = sh(["git", "rev-parse", "HEAD"], root).stdout.strip()
        if head != EXPECTED_HEAD:
            raise RuntimeError(f"Git HEAD mismatch: expected {EXPECTED_HEAD}, got {head}")
        for rel, expected in EXPECTED_BLOBS.items():
            actual = git_blob(root / rel, root)
            if actual != expected:
                raise RuntimeError(f"working file changed since GitHub baseline: {rel}")

    if html.count(OLD_CACHE) != 1:
        raise RuntimeError(f"preflight cache-bust mismatch: expected exactly one {OLD_CACHE}")
    if NEW_CACHE in html:
        raise RuntimeError("Trade Control cleanup already appears installed")

    for token in CORE_DEAD:
        if token not in css:
            raise RuntimeError(f"expected legacy Trade Control selector missing: {token}")

    # The old CSS is safe to delete only because the current page and current JS
    # no longer create/use these CSS classes. IDs such as assistBtn may remain as
    # optional legacy hooks in JS; this check is intentionally class-selector based.
    for token in DEAD_SELECTORS:
        cls = token[1:]
        if re.search(rf"class\s*=\s*['\"][^'\"]*\b{re.escape(cls)}\b", html):
            raise RuntimeError(f"live HTML still uses legacy class: {token}")
        if re.search(rf"['\"]{re.escape(cls)}['\"]", js):
            raise RuntimeError(f"live JS still creates/uses legacy class: {token}")

    return css, html, js


def make_backup(root: Path, files: list[Path]) -> tuple[Path, dict[str, str]]:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup = root / ".memeflow-backups" / f"trade-control-style-cleanup-{stamp}"
    backup.mkdir(parents=True, exist_ok=False)
    hashes: dict[str, str] = {}
    for path in files:
        rel = path.relative_to(root)
        dest = backup / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
        hashes[str(rel)] = hashlib.sha256(path.read_bytes()).hexdigest()

    rollback = backup / "ROLLBACK.sh"
    lines = ["#!/usr/bin/env bash", "set -euo pipefail", f"cd {shlex_quote(str(root))}"]
    for path in files:
        rel = path.relative_to(root)
        lines.append(f"cp {shlex_quote(str(backup / rel))} {shlex_quote(str(root / rel))}")
    lines += ["git diff --check", 'echo "ROLLBACK COMPLETE"']
    rollback.write_text("\n".join(lines) + "\n", encoding="utf-8")
    rollback.chmod(0o755)
    return backup, hashes


def shlex_quote(value: str) -> str:
    import shlex
    return shlex.quote(value)


def apply(root: Path, original_css: str, original_html: str, original_js: str) -> dict[str, int]:
    css_path = root / "memeflow-app/trading.css"
    html_path = root / "memeflow-app/trading.html"
    transformed, counts = transform_css(original_css)

    if transformed == original_css:
        raise RuntimeError("Trade Control CSS transformation produced no changes")
    missing_core = [t for t in CORE_DEAD if counts.get(t, 0) < 1]
    if missing_core:
        raise RuntimeError("no CSS rule removed for core selector(s): " + ", ".join(missing_core))

    new_html = original_html.replace(OLD_CACHE, NEW_CACHE, 1)
    write(css_path, transformed)
    write(html_path, new_html)
    validate(root, before_html=original_html, before_js=original_js)
    return counts


def dry_run_exact(root: Path, original_css: str, original_html: str, original_js: str) -> None:
    # Prove the exact current working bytes transform cleanly before touching them.
    with tempfile.TemporaryDirectory(prefix="mf-trade-control-preflight-") as td:
        tmp = Path(td)
        app = tmp / "memeflow-app"
        app.mkdir(parents=True)
        (app / "trading.css").write_text(original_css, encoding="utf-8")
        (app / "trading.html").write_text(original_html, encoding="utf-8")
        (app / "trading.js").write_text(original_js, encoding="utf-8")
        sh(["git", "init", "-q"], tmp)
        sh(["git", "config", "user.email", "selftest@memeflow.local"], tmp)
        sh(["git", "config", "user.name", "MEMEFLOW installer self-test"], tmp)
        sh(["git", "add", "."], tmp)
        sh(["git", "commit", "-qm", "baseline"], tmp)
        apply(tmp, original_css, original_html, original_js)


def main() -> int:
    root = project_root()
    selftest = os.environ.get("MEMEFLOW_INSTALL_SELFTEST") == "1"
    touched = [root / "memeflow-app/trading.css", root / "memeflow-app/trading.html"]

    try:
        original_css, original_html, original_js = preflight(root, selftest)
        dry_run_exact(root, original_css, original_html, original_js)

        backup, hashes = make_backup(root, touched)
        try:
            counts = apply(root, original_css, original_html, original_js)
        except Exception:
            for path in touched:
                rel = path.relative_to(root)
                shutil.copy2(backup / rel, path)
            raise

        print("✅ TRADE CONTROL CLEANUP INSTALLED SUCCESSFULLY")
        print(f"Project:  {root}")
        print(f"Backup:   {backup}")
        print(f"Rollback: {backup / 'ROLLBACK.sh'}")
        print("Validation: exact baseline Git HEAD/blob gate = OK" if not selftest else "Validation: self-test baseline = OK")
        print("Validation: exact-working-copy dry run before install = OK")
        print("Validation: git diff --check = OK")
        print("Validation: CSS braces / EOF = OK")
        print("Validation: obsolete Trade Control editor/action selectors removed = OK")
        print("Validation: live control-panel / control-error / strategy-summary / mode badge preserved = OK")
        print("Validation: trading.js unchanged = OK")
        print("\nChanged files:")
        status = sh(["git", "status", "--short"], root).stdout.rstrip()
        if status:
            print(status)
        print("\nAfter visual check, commit with:")
        print('git add memeflow-app/trading.css memeflow-app/trading.html && git commit -m "refactor(trading): remove legacy Trade Control styles" && git push')
        print("\nRollback if needed:")
        print(f'bash "{backup / "ROLLBACK.sh"}"')
        return 0
    except Exception as exc:
        print(f"❌ INSTALL FAILED: {exc}")
        print("No partial Trade Control cleanup will remain.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
