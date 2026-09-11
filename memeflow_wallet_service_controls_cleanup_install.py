#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path
import shutil
import subprocess
import sys

EXPECTED_HEAD = "ba70b305805db6fe80a36a2969fbaaf57e0d45f2"
EXPECTED_BLOBS = {
    "memeflow-app/trading.css": "6a83f0819c40b407c68ec13bbf787718d7fa2895",
    "memeflow-app/trading.html": "573b7db16256b2e87c38dda079130e3e57154170",
    "memeflow-app/trading.js": "b1dfd933c95fffaaefe02ffce8385fcc4d3f305a",
}

OLD_CACHE_BUST = '<link rel="stylesheet" href="/trading.css?v=trade-control-cleanup-v1-20260909">'
NEW_CACHE_BUST = '<link rel="stylesheet" href="/trading.css?v=wallet-service-controls-cleanup-v1-20260910">'

BASE_WALLET_PRESENTATION = """.section-title {
  margin-bottom: 8px;
  color: #718995;
  font-size: var(--mf-type-micro);
  font-weight: 740;
}

.wallet-address {
  padding: 8px 9px;
  overflow: hidden;
  border: 1px solid rgba(111, 154, 172, .035);
  border-radius: 8px;
  color: #647d88;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--mf-type-micro);
  line-height: 1.4;
  text-overflow: ellipsis;
}

.live-warning {
  margin-top: 7px;
  padding: 8px 9px;
  border: 1px solid rgba(239, 198, 106, .09);
  border-radius: 8px;
  background: rgba(239, 198, 106, .025);
}

.live-warning strong {
  display: block;
  color: #a99365;
  font-size: var(--mf-type-micro);
}

.live-warning span {
  display: block;
  margin-top: 4px;
  color: #655d4c;
  font-size: var(--mf-type-micro);
  line-height: 1.45;
}

"""

MOBILE_DEAD_LINES = [
    '  .section-title { margin-bottom: 5px; font-size: var(--mf-type-micro); }\n',
    '  .compact-wallet-panel { order: 6; width: 100%; }\n',
    '  .compact-wallet-panel .panel-head { min-height: 37px; padding: 7px 9px; }\n',
    '  .compact-wallet-panel .panel-head h2 { margin: 0;  }\n',
    '  .compact-wallet-panel .wallet-section { padding: 7px 9px; }\n',
    '  .compact-wallet-panel .wallet-section > .section-title { display: none; }\n',
    '  .compact-wallet-panel .wallet-address { padding: 7px 8px; font-size: var(--mf-type-micro); }\n',
    '  .compact-wallet-panel .live-warning { margin-top: 5px; padding: 7px 8px; }\n',
    '  .compact-wallet-panel .live-warning strong { font-size: var(--mf-type-micro); }\n',
    '  .compact-wallet-panel .live-warning span { margin-top: 3px; font-size: var(--mf-type-micro); }\n',
]

DEAD_CSS_TOKENS = (
    ".section-title",
    ".wallet-address",
    ".live-warning",
    ".compact-wallet-panel",
)

PRESERVED_HTML_HOOK = (
    '<button id="walletBtn" class="wallet-btn" type="button" hidden '
    'aria-hidden="true" tabindex="-1" style="display:none !important">Wallet settings</button>'
)
PRESERVED_JS_FUNCTION = "function openWalletSettings()"
PRESERVED_JS_BINDING = "$('walletBtn')?.addEventListener('click', openWalletSettings);"


class InstallError(RuntimeError):
    pass


def run(cmd, cwd=None, check=True):
    p = subprocess.run(
        cmd, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    if check and p.returncode != 0:
        raise InstallError(
            f"command failed ({p.returncode}): {' '.join(cmd)}\n"
            f"{p.stdout}{p.stderr}".rstrip()
        )
    return p


def must_replace(text: str, old: str, new: str, label: str, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise InstallError(f"{label}: expected exactly {expected} match(es), found {count}")
    return text.replace(old, new)


def transform_css(text: str) -> str:
    text = must_replace(
        text,
        BASE_WALLET_PRESENTATION,
        "",
        "legacy wallet/service base presentation block",
    )
    for line in MOBILE_DEAD_LINES:
        text = must_replace(
            text,
            line,
            "",
            f"legacy mobile wallet/service rule {line.strip()}",
        )
    return text


def transform_html(text: str) -> str:
    return must_replace(text, OLD_CACHE_BUST, NEW_CACHE_BUST, "HTML cache-bust")


def braces_ok(text: str) -> bool:
    i = 0
    depth = 0
    quote = None
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "/" and nxt == "*":
            end = text.find("*/", i + 2)
            if end == -1:
                return False
            i = end + 2
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth < 0:
                return False
        i += 1
    return depth == 0 and quote is None


def find_root() -> Path:
    candidates = [
        Path("/home/runner/workspace"),
        Path.cwd(),
    ]
    for c in candidates:
        if (c / ".git").exists() and (c / "memeflow-app").is_dir():
            return c.resolve()
    raise InstallError("MEMEFLOW repo root not found (expected /home/runner/workspace)")


def hash_blob(root: Path, rel: str) -> str:
    return run(["git", "hash-object", rel], cwd=root).stdout.strip()


def validate_baseline(root: Path):
    head = run(["git", "rev-parse", "HEAD"], cwd=root).stdout.strip()
    if head != EXPECTED_HEAD:
        raise InstallError(
            f"baseline HEAD mismatch: expected {EXPECTED_HEAD}, got {head}. "
            "No files were changed."
        )

    dirty = run(
        ["git", "status", "--porcelain", "--untracked-files=no", "--", "memeflow-app"],
        cwd=root,
    ).stdout.strip()
    if dirty:
        raise InstallError(
            "tracked memeflow-app working tree is not clean. "
            "Commit/restore tracked app changes before this cleanup.\n" + dirty
        )

    for rel, expected in EXPECTED_BLOBS.items():
        actual = hash_blob(root, rel)
        if actual != expected:
            raise InstallError(
                f"exact blob gate failed for {rel}: expected {expected}, got {actual}. "
                "No files were changed."
            )

    css = (root / "memeflow-app/trading.css").read_text()
    html = (root / "memeflow-app/trading.html").read_text()
    js = (root / "memeflow-app/trading.js").read_text()

    if css.count(BASE_WALLET_PRESENTATION) != 1:
        raise InstallError("wallet/service base presentation contract is missing or changed")
    for line in MOBILE_DEAD_LINES:
        if css.count(line) != 1:
            raise InstallError(f"mobile wallet/service contract changed: {line.strip()}")
    if html.count(OLD_CACHE_BUST) != 1:
        raise InstallError("trading.html cache-bust baseline changed")
    if html.count(PRESERVED_HTML_HOOK) != 1:
        raise InstallError("hidden wallet DOM hook changed; refusing cleanup")
    if js.count(PRESERVED_JS_FUNCTION) != 1 or js.count(PRESERVED_JS_BINDING) != 1:
        raise InstallError("wallet settings JS hook changed; refusing cleanup")


def write_rollback(root: Path, backup: Path):
    rollback = backup / "ROLLBACK.sh"
    rollback.write_text(
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n"
        f'ROOT="{root}"\n'
        f'BACKUP="{backup}"\n'
        'cp -p "$BACKUP/trading.css" "$ROOT/memeflow-app/trading.css"\n'
        'cp -p "$BACKUP/trading.html" "$ROOT/memeflow-app/trading.html"\n'
        'cd "$ROOT"\n'
        'git diff --check -- memeflow-app/trading.css memeflow-app/trading.html\n'
        'echo "ROLLBACK COMPLETE: Wallet/service controls cleanup restored."\n'
    )
    rollback.chmod(0o755)


def rollback_now(root: Path, backup: Path):
    for name in ("trading.css", "trading.html"):
        src = backup / name
        dst = root / "memeflow-app" / name
        if src.exists():
            shutil.copy2(src, dst)


def validate_result(root: Path):
    css = (root / "memeflow-app/trading.css").read_text()
    html = (root / "memeflow-app/trading.html").read_text()
    js = (root / "memeflow-app/trading.js").read_text()

    if not braces_ok(css):
        raise InstallError("CSS braces/comments/quotes validation failed")

    for token in DEAD_CSS_TOKENS:
        if token in css:
            raise InstallError(f"dead wallet/service selector still remains in trading.css: {token}")

    if html.count(NEW_CACHE_BUST) != 1 or OLD_CACHE_BUST in html:
        raise InstallError("new trading.css cache-bust validation failed")

    if html.count(PRESERVED_HTML_HOOK) != 1:
        raise InstallError("hidden wallet DOM hook was not preserved")
    if js.count(PRESERVED_JS_FUNCTION) != 1 or js.count(PRESERVED_JS_BINDING) != 1:
        raise InstallError("wallet settings JS hook was not preserved")

    if hash_blob(root, "memeflow-app/trading.js") != EXPECTED_BLOBS["memeflow-app/trading.js"]:
        raise InstallError("trading.js changed unexpectedly")

    diffcheck = run(
        ["git", "diff", "--check", "--", "memeflow-app/trading.css", "memeflow-app/trading.html"],
        cwd=root,
        check=False,
    )
    if diffcheck.returncode != 0:
        raise InstallError("git diff --check failed:\n" + diffcheck.stdout + diffcheck.stderr)

    changed = run(
        ["git", "diff", "--name-only", "--", "memeflow-app"],
        cwd=root,
    ).stdout.splitlines()
    expected = {"memeflow-app/trading.css", "memeflow-app/trading.html"}
    if set(changed) != expected:
        raise InstallError(
            "unexpected tracked app changes after install: "
            + (", ".join(changed) if changed else "(none)")
        )


def self_test():
    fixture_css = (
        "/* before */\n"
        + BASE_WALLET_PRESENTATION
        + "@media (max-width: 820px) {\n"
        + "".join(MOBILE_DEAD_LINES)
        + "  .keep-me { display: block; }\n"
        + "}\n"
        + "/* after */\n"
    )
    transformed = transform_css(fixture_css)
    assert ".keep-me" in transformed
    for token in DEAD_CSS_TOKENS:
        assert token not in transformed
    assert braces_ok(transformed)

    fixture_html = "<head>\n" + OLD_CACHE_BUST + "\n</head>\n"
    transformed_html = transform_html(fixture_html)
    assert transformed_html.count(NEW_CACHE_BUST) == 1
    assert OLD_CACHE_BUST not in transformed_html

    try:
        transform_css(fixture_css.replace(".wallet-address", ".wallet-address-v2", 1))
    except InstallError:
        pass
    else:
        raise AssertionError("drift self-test did not fail closed")

    print("SELF-TEST OK: exact transforms + fail-closed drift gate")


def install():
    root = find_root()
    validate_baseline(root)

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = root / ".memeflow-backups" / f"wallet-service-controls-style-cleanup-{stamp}-{EXPECTED_HEAD[:6]}"
    backup.mkdir(parents=True, exist_ok=False)

    css_path = root / "memeflow-app/trading.css"
    html_path = root / "memeflow-app/trading.html"

    shutil.copy2(css_path, backup / "trading.css")
    shutil.copy2(html_path, backup / "trading.html")
    write_rollback(root, backup)

    try:
        css_path.write_text(transform_css(css_path.read_text()))
        html_path.write_text(transform_html(html_path.read_text()))
        validate_result(root)
    except Exception:
        rollback_now(root, backup)
        raise

    print("✅ WALLET / SERVICE CONTROLS CLEANUP INSTALLED SUCCESSFULLY")
    print(f"Project:  {root}")
    print(f"Backup:   {backup}")
    print(f"Rollback: {backup / 'ROLLBACK.sh'}")
    print("Validation: exact baseline Git HEAD/blob gate = OK")
    print("Validation: exact-working-copy dry run before install = OK")
    print("Validation: git diff --check = OK")
    print("Validation: CSS braces / comments / quotes = OK")
    print("Validation: dead wallet/service presentation selectors removed = OK")
    print("Validation: hidden Wallet settings DOM + JS hook preserved = OK")
    print("Validation: trading.js unchanged = OK")
    print()
    print("Changed files:")
    status = run(
        ["git", "status", "--short", "--", "memeflow-app/trading.css", "memeflow-app/trading.html"],
        cwd=root,
    ).stdout.rstrip()
    print(status or "(none)")
    print()
    print("After visual check, commit with:")
    print('git add memeflow-app/trading.css memeflow-app/trading.html && '
          'git commit -m "refactor(trading): remove legacy wallet service styles" && git push')
    print()
    print("Rollback if needed:")
    print(f'bash "{backup / "ROLLBACK.sh"}"')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    try:
        if args.self_test:
            self_test()
        else:
            install()
    except Exception as exc:
        print(f"❌ INSTALL FAILED: {exc}", file=sys.stderr)
        print("No partial Wallet/service controls cleanup should remain.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
