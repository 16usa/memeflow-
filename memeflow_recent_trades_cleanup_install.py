#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

EXPECTED_HEAD = "c8f437a7317f68242f77f4a23541379fdfa253bd"
SELFTEST = os.environ.get("MEMEFLOW_INSTALL_SELFTEST") == "1"


def run(args, cwd=None, check=True):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=check)


def find_root() -> Path:
    candidates = []
    try:
        p = run(["git", "rev-parse", "--show-toplevel"], check=False)
        if p.returncode == 0 and p.stdout.strip():
            candidates.append(Path(p.stdout.strip()))
    except Exception:
        pass
    candidates += [Path.cwd(), Path("/home/runner/workspace"), Path("/workspace")]
    seen = set()
    for base in candidates:
        try:
            base = base.resolve()
        except Exception:
            continue
        if base in seen:
            continue
        seen.add(base)
        if (base / "memeflow-app" / "trading.html").exists():
            return base
    raise SystemExit("ABORT: MEMEFLOW project root not found.")


ROOT = find_root()
APP = ROOT / "memeflow-app"
TOUCH_RELS = [
    "memeflow-app/trading.html",
    "memeflow-app/trading.css",
    "memeflow-app/trading-light-polish-v61.css",
    "memeflow-app/memeflow-trading-white-surfaces-v154.css",
]
TOUCH = [ROOT / rel for rel in TOUCH_RELS]
V89 = APP / "trading-row-height-v89.css"

missing = [str(p.relative_to(ROOT)) for p in TOUCH + [V89] if not p.exists()]
if missing:
    raise SystemExit("ABORT: required files missing:\n  " + "\n  ".join(missing))

if not SELFTEST:
    head = run(["git", "rev-parse", "HEAD"], cwd=ROOT).stdout.strip()
    if head != EXPECTED_HEAD:
        raise SystemExit(
            "ABORT: Git HEAD is not the exact tested Open Positions commit.\n"
            f"Expected: {EXPECTED_HEAD}\nFound:    {head}\nNo files were changed."
        )
    dirty = run(["git", "status", "--porcelain", "--", *TOUCH_RELS], cwd=ROOT).stdout.strip()
    if dirty:
        raise SystemExit("ABORT: Recent Trades source files have uncommitted changes:\n" + dirty)

trading_before = (APP / "trading.css").read_text(encoding="utf-8")
if "MEMEFLOW_CANDIDATES_CANONICAL_PRESENTATION_END" not in trading_before:
    raise SystemExit("ABORT: Candidates cleanup is not present.")
if "MEMEFLOW_OPEN_POSITIONS_CANONICAL_END" not in trading_before:
    raise SystemExit("ABORT: Open Positions cleanup is not present.")
if "MEMEFLOW_RECENT_TRADES_CANONICAL_END" in trading_before:
    raise SystemExit("ABORT: Recent Trades cleanup already appears installed.")

START = "/* ===== MEMEFLOW_RECENT_TRADES_TRUE_TWO_ROWS_V4 ===== */"
END = "/* ===== /MEMEFLOW_RECENT_TRADES_TRUE_TWO_ROWS_V4 ===== */"
if trading_before.count(START) != 1 or trading_before.count(END) != 1:
    raise SystemExit(
        f"ABORT: expected exactly one current Recent Trades V4 block; "
        f"start={trading_before.count(START)}, end={trading_before.count(END)}"
    )

v89_text = V89.read_text(encoding="utf-8")
if ".trade-row.trade-log-row" not in v89_text or "--mf-trading-row-height-v89" not in v89_text:
    raise SystemExit("ABORT: canonical row-height V89 contract is missing or changed.")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / ".memeflow-backups" / f"recent-trades-style-cleanup-{stamp}"
BACKUP.mkdir(parents=True, exist_ok=False)
for src in TOUCH:
    rel = src.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

before_hashes = {
    str(src.relative_to(ROOT)): hashlib.sha256(src.read_bytes()).hexdigest()
    for src in TOUCH
}
(BACKUP / "ROLLBACK_SHA256.txt").write_text(
    "".join(f"{digest}  {rel}\n" for rel, digest in before_hashes.items()), encoding="utf-8"
)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    # Generated rule removal can leave indentation-only blank lines. Normalize
    # only those blank lines; do not rewrite trailing spaces on content lines.
    text = re.sub(r"(?m)^[ \t]+$", "", text)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def restore_all() -> None:
    for src in TOUCH:
        rel = src.relative_to(ROOT)
        bak = BACKUP / rel
        if bak.exists():
            src.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(bak, src)
    print(f"ROLLBACK COMPLETE: restored original files from {BACKUP}")


def find_matching_brace(text: str, open_idx: int) -> int:
    depth = 1
    i = open_idx + 1
    quote = None
    while i < len(text):
        if quote:
            if text[i] == "\\":
                i += 2
                continue
            if text[i] == quote:
                quote = None
            i += 1
            continue
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            if j < 0:
                raise RuntimeError("unterminated CSS comment")
            i = j + 2
            continue
        ch = text[i]
        if ch in ('"', "'"):
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise RuntimeError("unbalanced CSS block")


def next_open_brace(text: str, start: int) -> int:
    i = start
    quote = None
    paren = 0
    bracket = 0
    while i < len(text):
        if quote:
            if text[i] == "\\":
                i += 2
                continue
            if text[i] == quote:
                quote = None
            i += 1
            continue
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            if j < 0:
                raise RuntimeError("unterminated CSS comment")
            i = j + 2
            continue
        ch = text[i]
        if ch in ('"', "'"):
            quote = ch
        elif ch == "(":
            paren += 1
        elif ch == ")" and paren:
            paren -= 1
        elif ch == "[":
            bracket += 1
        elif ch == "]" and bracket:
            bracket -= 1
        elif ch == "{" and paren == 0 and bracket == 0:
            return i
        i += 1
    return -1


def selector_header_start(text: str, brace_idx: int, floor: int) -> int:
    # Walk backward to the previous top-level rule boundary. Comments directly
    # before a selector stay with the previous raw segment, not the selector.
    i = brace_idx - 1
    paren = bracket = 0
    while i >= floor:
        ch = text[i]
        if ch == ")":
            paren += 1
        elif ch == "(" and paren:
            paren -= 1
        elif ch == "]":
            bracket += 1
        elif ch == "[" and bracket:
            bracket -= 1
        elif paren == 0 and bracket == 0 and ch in "};":
            return i + 1
        i -= 1
    return floor


def split_selectors(header: str) -> list[str]:
    parts = []
    start = 0
    paren = bracket = 0
    quote = None
    i = 0
    while i < len(header):
        ch = header[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
        elif ch in ('"', "'"):
            quote = ch
        elif ch == "(":
            paren += 1
        elif ch == ")" and paren:
            paren -= 1
        elif ch == "[":
            bracket += 1
        elif ch == "]" and bracket:
            bracket -= 1
        elif ch == "," and paren == 0 and bracket == 0:
            parts.append(header[start:i].strip())
            start = i + 1
        i += 1
    parts.append(header[start:].strip())
    return [p for p in parts if p]


def sanitize_function_lists(selector: str, targets: tuple[str, ...]) -> str:
    # Remove only Recent Trades members from :is(...) / :where(...) while
    # preserving the other modules in the shared selector.
    pattern = re.compile(r":(is|where)\(")
    pos = 0
    out = ""
    while True:
        m = pattern.search(selector, pos)
        if not m:
            out += selector[pos:]
            break
        out += selector[pos:m.start()]
        open_idx = m.end() - 1
        depth = 1
        i = open_idx + 1
        while i < len(selector) and depth:
            if selector[i] == "(":
                depth += 1
            elif selector[i] == ")":
                depth -= 1
            i += 1
        if depth:
            return selector
        inner = selector[open_idx + 1:i - 1]
        members = split_selectors(inner)
        kept = [x for x in members if not any(t in x for t in targets)]
        if not kept:
            return ""
        out += f":{m.group(1)}(" + ", ".join(kept) + ")"
        pos = i
    return out


def strip_target_rules(text: str, targets: tuple[str, ...], collect: bool = False) -> tuple[str, str, int]:
    """Remove target selectors while preserving non-target members of shared rules.

    Recurses through @media/@supports/@container/@layer. If collect=True, target
    rules are also returned so late, already-winning Recent Trades rules can be
    moved into the canonical section without changing the visual result.
    """
    out = []
    extracted = []
    removed_count = 0
    pos = 0
    n = len(text)
    while pos < n:
        brace = next_open_brace(text, pos)
        if brace < 0:
            out.append(text[pos:])
            break
        hs = selector_header_start(text, brace, pos)
        prefix = text[pos:hs]
        header_raw = text[hs:brace]
        end = find_matching_brace(text, brace)
        body = text[brace + 1:end]
        # Keep leading whitespace/comments byte-for-byte so cleanup does not
        # collapse adjacent rules or erase section markers.
        trivia_len = 0
        while True:
            m_ws = re.match(r"\s+", header_raw[trivia_len:])
            if m_ws:
                trivia_len += m_ws.end()
                continue
            if header_raw.startswith("/*", trivia_len):
                j = header_raw.find("*/", trivia_len + 2)
                if j >= 0:
                    trivia_len = j + 2
                    continue
            break
        trivia = header_raw[:trivia_len]
        header_core = header_raw[trivia_len:]
        stripped = re.sub(r"/\*.*?\*/", "", header_core, flags=re.S).strip()
        if not stripped:
            out.append(text[pos:end + 1])
            pos = end + 1
            continue

        if stripped.startswith("@"):
            name = stripped.split(None, 1)[0].lower()
            if name in {"@media", "@supports", "@container", "@layer", "@document"}:
                clean_body, extracted_body, cnt = strip_target_rules(body, targets, collect=collect)
                removed_count += cnt
                out.append(prefix + trivia)
                if clean_body.strip():
                    out.append(header_core + "{" + clean_body + "}")
                if collect and extracted_body.strip():
                    extracted.append(header_raw.strip() + " {\n" + extracted_body.strip() + "\n}\n")
            else:
                out.append(text[pos:end + 1])
            pos = end + 1
            continue

        selectors = split_selectors(stripped)
        kept = []
        removed = []
        for sel in selectors:
            sanitized = sanitize_function_lists(sel, targets)
            if sanitized and not any(t in sanitized for t in targets):
                kept.append(sanitized)
                # If target members were removed from :is/:where, count it as cleanup.
                if sanitized != sel:
                    removed_count += 1
            else:
                removed.append(sel)
        if removed:
            removed_count += len(removed)

        out.append(prefix + trivia)
        if kept:
            out.append(",\n".join(kept) + " {" + body + "}")
        if collect and removed:
            extracted.append(",\n".join(removed) + " {" + body + "}\n")
        pos = end + 1

    return "".join(out), "\n".join(extracted), removed_count


TARGETS_TRADING = (
    ".bottom-history-panel",
    ".trade-history",
    ".trade-row",
    ".trade-log-",
    ".history-panel",
)
TARGETS_LAYER = (
    ".bottom-history-panel",
    ".trade-history",
    ".trade-row.trade-log-row",
)

LIGHT_BLOCK = r'''
/* Recent Trades Light surface is owned here, not by V61/V154. */
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.bottom-history-panel,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.bottom-history-panel > .panel-head,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.bottom-history-panel > .trade-history,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.bottom-history-panel .trade-history > .trade-row.trade-log-row {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.bottom-history-panel .empty {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}
'''

try:
    trading = APP / "trading.css"
    text = read(trading)
    a = text.index(START)
    b = text.index(END, a) + len(END)
    prefix = text[:a]
    canonical = text[a:b]
    suffix = text[b:]

    # Old generations before V4 are discarded. Later winning rules (mobile page
    # order / avatar-fit) are moved into V4 so their final behavior is preserved.
    clean_prefix, _, old_removed = strip_target_rules(prefix, TARGETS_TRADING, collect=False)
    clean_suffix, late_rules, late_removed = strip_target_rules(suffix, TARGETS_TRADING, collect=True)
    if old_removed < 1:
        raise RuntimeError("no obsolete pre-V4 Recent Trades rules were found")
    if late_removed < 1:
        raise RuntimeError("no late Recent Trades override was found to consolidate")

    canonical_body = canonical[:-len(END)].rstrip()
    canonical_new = (
        canonical_body
        + "\n\n/* Consolidated late winning Recent Trades rules (moved here unchanged). */\n"
        + late_rules.strip()
        + "\n"
        + LIGHT_BLOCK.rstrip()
        + "\n\n/* MEMEFLOW_RECENT_TRADES_CANONICAL_END */\n"
        + END
    )
    write(trading, clean_prefix + canonical_new + clean_suffix)

    # V61: remove all Recent Trades ownership while retaining other modules.
    v61 = APP / "trading-light-polish-v61.css"
    clean, _, removed = strip_target_rules(read(v61), TARGETS_LAYER, collect=False)
    if removed < 1:
        raise RuntimeError("V61 contained no Recent Trades ownership to remove")
    write(v61, clean)

    # V154: remove all Recent Trades ownership, including its member inside
    # shared :is(...). Other modules remain untouched.
    v154 = APP / "memeflow-trading-white-surfaces-v154.css"
    clean, _, removed = strip_target_rules(read(v154), TARGETS_LAYER, collect=False)
    if removed < 1:
        raise RuntimeError("V154 contained no Recent Trades ownership to remove")
    write(v154, clean)

    # Cache-bust only edited stylesheets.
    html = APP / "trading.html"
    h = read(html)
    for filename, version in [
        ("trading.css", "recent-trades-canonical-cleanup-v1-20260909"),
        ("trading-light-polish-v61.css", "recent-trades-cleanup-v1-20260909"),
        ("memeflow-trading-white-surfaces-v154.css", "recent-trades-cleanup-v1-20260909"),
    ]:
        pattern = rf'(<link\s+rel="stylesheet"\s+href="/{re.escape(filename)}\?v=)[^"]+("\s*/?>)'
        h2, count = re.subn(pattern, rf'\g<1>{version}\2', h, count=1)
        if count != 1:
            raise RuntimeError(f"cache-bust link not uniquely found for {filename}: {count}")
        h = h2
    write(html, h)

    # Validation.
    t = read(trading)
    if t.count("MEMEFLOW_RECENT_TRADES_CANONICAL_END") != 1:
        raise RuntimeError("canonical Recent Trades marker count is not 1")
    if t.count(START) != 1 or t.count(END) != 1:
        raise RuntimeError("V4 canonical block boundary changed unexpectedly")
    # Outside the canonical block, no Recent Trades presentation selectors remain.
    aa = t.index(START)
    bb = t.index(END, aa) + len(END)
    outside = t[:aa] + t[bb:]
    leftovers = [term for term in TARGETS_TRADING if term in re.sub(r"/\*.*?\*/", "", outside, flags=re.S)]
    if leftovers:
        raise RuntimeError("Recent Trades selectors remain outside canonical block: " + ", ".join(leftovers))

    for path in [v61, v154]:
        body = re.sub(r"/\*.*?\*/", "", read(path), flags=re.S)
        bad = [term for term in TARGETS_LAYER if term in body]
        if bad:
            raise RuntimeError(f"{path.name} still owns Recent Trades selectors: {bad}")

    if ".trade-row.trade-log-row" not in read(V89):
        raise RuntimeError("V89 shared row-height contract was lost")

    # Braces/EOF checks.
    for path in [trading, v61, v154]:
        data = re.sub(r"/\*.*?\*/", "", read(path), flags=re.S)
        if data.count("{") != data.count("}"):
            raise RuntimeError(f"CSS brace balance failed: {path.name}")
    for path in TOUCH:
        data = read(path)
        if not data.endswith("\n") or data.endswith("\n\n"):
            raise RuntimeError(f"EOF newline contract failed: {path.name}")

    diff = run(["git", "diff", "--check", "--", *TOUCH_RELS], cwd=ROOT, check=False)
    if diff.returncode != 0:
        raise RuntimeError("git diff --check failed:\n" + diff.stdout + diff.stderr)

    rollback = BACKUP / "ROLLBACK.sh"
    rollback.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BACKUP="$(cd "$(dirname "$0")" && pwd)"
python3 - "$ROOT" "$BACKUP" <<'PYROLLBACK'
import hashlib, pathlib, shutil, sys
root = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])
manifest = {}
for line in (backup / "ROLLBACK_SHA256.txt").read_text().splitlines():
    digest, rel = line.split("  ", 1)
    manifest[rel] = digest
for rel, expected in manifest.items():
    src = backup / rel
    dst = root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    actual = hashlib.sha256(dst.read_bytes()).hexdigest()
    if actual != expected:
        raise SystemExit(f"ROLLBACK HASH MISMATCH: {rel}")
print("ROLLBACK COMPLETE: all restored files match backup SHA-256")
PYROLLBACK
git -C "$ROOT" diff --check -- memeflow-app/trading.html memeflow-app/trading.css memeflow-app/trading-light-polish-v61.css memeflow-app/memeflow-trading-white-surfaces-v154.css
""",
        encoding="utf-8",
    )
    rollback.chmod(0o755)

    print("✅ RECENT TRADES CLEANUP INSTALLED SUCCESSFULLY")
    print(f"Project:  {ROOT}")
    print(f"Backup:   {BACKUP}")
    print(f"Rollback: {rollback}")
    print("Validation: exact Git HEAD gate = OK" if not SELFTEST else "Validation: self-test gate = OK")
    print("Validation: git diff --check = OK")
    print("Validation: CSS braces / EOF = OK")
    print("Validation: one Recent Trades canonical owner = OK")
    print("Validation: V61/V154 Recent Trades ownership removed = OK")
    print("Validation: shared V89 row-height contract preserved = OK")
    print("\nChanged files:")
    subprocess.run(["git", "status", "--short"], cwd=ROOT, check=False)
    print("\nRollback if needed:")
    print(f'bash "{rollback}"')

except Exception as exc:
    print(f"❌ INSTALL FAILED: {exc}")
    print("Automatic rollback is running. No partial Recent Trades cleanup will remain.")
    restore_all()
    sys.exit(1)
