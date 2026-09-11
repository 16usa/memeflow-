#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def find_root() -> Path:
    candidates = []
    try:
        p = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
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
    raise SystemExit("ABORT: MEMEFLOW project root not found (expected memeflow-app/trading.html).")


ROOT = find_root()
APP = ROOT / "memeflow-app"
FILES = [
    APP / "trading.html",
    APP / "trading.css",
    APP / "trading-light-polish-v61.css",
    APP / "trading-visual-hierarchy-v67.css",
    APP / "memeflow-dark-x-surface-v131.css",
    APP / "memeflow-trading-white-surfaces-v154.css",
    APP / "memeflow-candidate-state-filters-v119.css",
    APP / "memeflow-candidate-edit-fill-v121.css",
]

missing = [str(p.relative_to(ROOT)) for p in FILES if not p.exists()]
if missing:
    raise SystemExit("ABORT: expected files are missing:\n  " + "\n  ".join(missing))

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / ".memeflow-backups" / f"candidates-style-cleanup-{stamp}"
BACKUP.mkdir(parents=True, exist_ok=False)
for src in FILES:
    rel = src.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def restore_all() -> None:
    for src in FILES:
        rel = src.relative_to(ROOT)
        bak = BACKUP / rel
        if bak.exists():
            src.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(bak, src)
    print(f"ROLLBACK COMPLETE: restored original files from {BACKUP}")


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    write(path, text.replace(old, new, 1))


def remove_once(path: Path, old: str, label: str) -> None:
    replace_once(path, old, "", label)


def remove_between(path: Path, start: str, end: str, label: str) -> None:
    text = read(path)
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f"{label}: start marker not found")
    b = text.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f"{label}: end marker not found")
    write(path, text[:a] + text[b:])


def regex_sub_once(path: Path, pattern: str, repl: str, label: str, flags=0) -> None:
    text = read(path)
    new, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 regex match, found {count}")
    write(path, new)


def css_braces_ok(path: Path) -> bool:
    text = re.sub(r"/\*.*?\*/", "", read(path), flags=re.S)
    return text.count("{") == text.count("}")


def cache_bust(filename: str, version: str) -> None:
    path = APP / "trading.html"
    text = read(path)
    pattern = rf'(<link\s+rel="stylesheet"\s+href="/{re.escape(filename)}\?v=)[^"]+("\s*>)'
    new, count = re.subn(pattern, rf'\1{version}\2', text, count=1)
    if count != 1:
        raise RuntimeError(f"cache bust failed for {filename}: found {count}")
    write(path, new)


try:
    trading_css = APP / "trading.css"

    replace_once(
        trading_css,
        ".candidate-filter {\n  padding: 7px 8px;\n  display: flex;\n  gap: 5px;\n  border-bottom: 1px solid rgba(111, 154, 172, .055);\n}\n",
        ".candidate-filter {\n  display: grid;\n  grid-template-columns: repeat(5, minmax(0, 1fr));\n  align-items: stretch;\n  gap: 0;\n  padding: 0;\n  border: 0;\n  border-bottom: var(--mf-structure-hairline, 1px) solid var(--mf-structure-divider, rgba(111, 154, 172, .055));\n  background: transparent;\n}\n",
        "replace legacy Candidate filter container",
    )
    replace_once(
        trading_css,
        ".candidate-filter button, .timeframes button {\n",
        ".timeframes button {\n",
        "detach Candidate buttons from old shared timeframe rule",
    )
    remove_once(
        trading_css,
        ".candidate-filter button {\n  min-height: 27px;\n  padding: 0 8px;\n}\n\n",
        "remove legacy Candidate button geometry",
    )
    replace_once(
        trading_css,
        ".candidate-filter button.active, .timeframes button.active {\n",
        ".timeframes button.active {\n",
        "detach Candidate active state from old shared timeframe rule",
    )

    canonical = r'''

/* ==========================================================================
   MEMEFLOW CANDIDATES — CANONICAL PRESENTATION CONTRACT
   One page-level owner for Candidates geometry, surfaces and selection state.
   Shared global files may provide tokens, but do not redefine Candidates.
   ========================================================================== */

body.mf-page-trading.mf-trading-terminal
.candidates-panel > .panel-head {
  border-bottom: 0 !important;
}

body.mf-page-trading.mf-trading-terminal
.candidates-panel .candidate-filter {
  display: grid !important;
  grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
  align-items: stretch !important;
  gap: 0 !important;
  row-gap: 0 !important;
  column-gap: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border-top: 0 !important;
  border-left: 0 !important;
  border-right: 0 !important;
  border-bottom-width: var(--mf-structure-hairline, 1px) !important;
  border-bottom-style: solid !important;
  border-bottom-color: var(--mf-structure-divider, rgba(111, 154, 172, .055)) !important;
}

body.mf-page-trading.mf-trading-terminal
.candidates-panel .candidate-filter > button[data-filter] {
  box-sizing: border-box !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  min-width: 0 !important;
  height: 48px !important;
  min-height: 48px !important;
  margin: 0 !important;
  padding: 0 4px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  color: var(--mf-text-tertiary, #818c99) !important;
  font-size: 9px !important;
  line-height: 1 !important;
  font-weight: 650 !important;
  letter-spacing: .025em !important;
  text-transform: uppercase !important;
  white-space: nowrap !important;
  -webkit-text-size-adjust: none !important;
  text-size-adjust: none !important;
  touch-action: manipulation;
}

body.mf-page-trading.mf-trading-terminal
.candidates-panel .candidate-filter > button[data-filter].active {
  color: var(--mf-text-primary, #e7e9ea) !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

body.mf-page-trading.mf-trading-terminal
.candidates-panel .candidate-filter > button[data-filter]:focus-visible {
  outline: 1px solid rgba(161, 170, 181, .55) !important;
  outline-offset: 2px !important;
}

body.mf-page-trading.mf-trading-terminal
.candidates-panel #candidateList > .candidate {
  border-left: 2px solid transparent !important;
}

body.mf-page-trading.mf-trading-terminal
.candidates-panel #candidateList > .candidate:hover,
body.mf-page-trading.mf-trading-terminal
.candidates-panel #candidateList > .candidate.selected {
  background: rgba(85, 217, 255, .035);
  background-image: none;
}

body.mf-page-trading.mf-trading-terminal
.candidates-panel .candidate-list > .empty {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  color: var(--mf-text-tertiary, #818c99) !important;
  font-size: var(--mf-type-system, 8px) !important;
  line-height: 1.2 !important;
  font-weight: 500 !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel > .panel-head,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel > .candidate-filter,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel > #candidateList,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel #candidateList > .candidate,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel #candidateList > .candidate.selected,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel #candidateList > .candidate:hover {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

@media (max-width: 820px) {
  body.mf-page-trading.mf-trading-terminal
  .candidates-panel #candidateList > .candidate.selected {
    padding-left: 7px !important;
  }
}

/* MEMEFLOW_CANDIDATES_CANONICAL_PRESENTATION_END */
'''
    text = read(trading_css)
    if "MEMEFLOW_CANDIDATES_CANONICAL_PRESENTATION_END" in text:
        raise RuntimeError("canonical Candidates block already exists")
    write(trading_css, text.rstrip() + canonical + "\n")

    # V61: keep shared tokens, remove Candidate ownership.
    v61 = APP / "trading-light-polish-v61.css"
    replace_once(
        v61,
        'html[data-theme="light"] body.mf-trading-terminal .terminal > .panel,\nhtml[data-theme="light"] body.mf-trading-terminal .center-stack > .panel {\n',
        'html[data-theme="light"] body.mf-trading-terminal .terminal > .panel:not(.candidates-panel),\nhtml[data-theme="light"] body.mf-trading-terminal .center-stack > .panel {\n',
        "exclude Candidates panel from V61 surface rule",
    )
    replace_once(
        v61,
        'html[data-theme="light"] body.mf-trading-terminal .panel-head,\nhtml[data-theme="light"] body.mf-trading-terminal .chart-head,\nhtml[data-theme="light"] body.mf-trading-terminal .candidate-filter,\nhtml[data-theme="light"] body.mf-trading-terminal .timeframes {\n',
        'html[data-theme="light"] body.mf-trading-terminal .panel-head,\nhtml[data-theme="light"] body.mf-trading-terminal .chart-head,\nhtml[data-theme="light"] body.mf-trading-terminal .timeframes {\n',
        "remove Candidate filter separator ownership from V61",
    )
    replace_once(
        v61,
        'html[data-theme="light"] body.mf-trading-terminal .candidate,\nhtml[data-theme="light"] body.mf-trading-terminal .position-row,\nhtml[data-theme="light"] body.mf-trading-terminal .trade-row.trade-log-row {\n',
        'html[data-theme="light"] body.mf-trading-terminal .position-row,\nhtml[data-theme="light"] body.mf-trading-terminal .trade-row.trade-log-row {\n',
        "remove Candidate row surface ownership from V61",
    )
    remove_once(
        v61,
        'html[data-theme="light"] body.mf-trading-terminal .candidate:hover,\nhtml[data-theme="light"] body.mf-trading-terminal .candidate.selected {\n  background: var(--mf-trading-v61-inset) !important;\n}\n\n',
        "remove old V61 Candidate selected fill",
    )
    replace_once(
        v61,
        'html[data-theme="light"] body.mf-trading-terminal\n.candidate-filter button:not(.active),\nhtml[data-theme="light"] body.mf-trading-terminal\n.timeframes button:not(.active),\n',
        'html[data-theme="light"] body.mf-trading-terminal\n.timeframes button:not(.active),\n',
        "remove Candidate inactive controls from V61",
    )
    replace_once(
        v61,
        '  html[data-theme="light"] body.mf-trading-terminal\n  .candidate-filter button:not(.active):hover,\n  html[data-theme="light"] body.mf-trading-terminal\n  .timeframes button:not(.active):hover,\n',
        '  html[data-theme="light"] body.mf-trading-terminal\n  .timeframes button:not(.active):hover,\n',
        "remove Candidate hover controls from V61",
    )
    replace_once(
        v61,
        '  .chart-panel,\n  .strategy-summary-panel,\n  .positions-panel,\n  .candidates-panel,\n  .bottom-history-panel\n',
        '  .chart-panel,\n  .strategy-summary-panel,\n  .positions-panel,\n  .bottom-history-panel\n',
        "remove Candidates from V153 module group",
    )
    remove_once(
        v61,
        'html[data-theme="light"] body.mf-trading-terminal .terminal > .panel.candidates-panel,\n',
        "remove Candidates from V153.1 panel group",
    )

    # V67: remove obsolete selection stripe/padding ownership.
    v67 = APP / "trading-visual-hierarchy-v67.css"
    remove_once(
        v67,
        '/* Selected candidate: keep one restrained accent instead of stacked effects. */\nbody.mf-page-trading.mf-trading-terminal .candidate.selected {\n  border-left: 2px solid var(--mf-v67-selected-accent) !important;\n  box-shadow: none !important;\n}\n\nbody.mf-page-trading.mf-trading-terminal .candidate:not(.selected) {\n  border-left: 2px solid transparent !important;\n}\n\n',
        "remove V67 Candidate selection stripe",
    )
    remove_once(
        v67,
        '  body.mf-page-trading.mf-trading-terminal .candidate.selected {\n    padding-left: 7px !important;\n  }\n',
        "move V67 mobile selected padding into canonical owner",
    )

    # V131/V136/V146/V152: remove Candidate-specific late overrides.
    v131 = APP / "memeflow-dark-x-surface-v131.css"
    remove_between(
        v131,
        '/* --------------------------------------------------------------------------\n   THIRD / LIGHTEST DARK TONE\n',
        '/* --------------------------------------------------------------------------\n   X-STYLE SEPARATORS\n',
        "remove old V131 Candidate dark-fill exception",
    )
    remove_once(
        v131,
        '/* Candidates title flows directly into its segmented control. */\nhtml[data-theme] body.mf-page-trading.mf-trading-terminal\n.candidates-panel > .panel-head {\n  border-bottom: 0 !important;\n}\n\n',
        "remove Candidate header ownership from V136",
    )
    remove_between(
        v131,
        '/* --------------------------------------------------------------------------\n   3) CANDIDATES SEGMENTS\n',
        '/* --------------------------------------------------------------------------\n   4) ROW LISTS\n',
        "remove Candidate segment ownership from V136",
    )
    remove_once(
        v131,
        'html[data-theme]\nbody.mf-page-trading.mf-trading-terminal\n.candidates-panel\n.candidate-filter\n> button[data-filter],\n',
        "remove Candidate filter from V146 control group",
    )
    remove_between(
        v131,
        '/* --------------------------------------------------------------------------\n   CANDIDATES FILTER\n   -------------------------------------------------------------------------- */\n',
        '/* --------------------------------------------------------------------------\n   SELECTED ROW LEFT ACCENT\n',
        "remove Candidate filter override from V152",
    )
    remove_once(
        v131,
        '/* Candidate V67 uses a 2px border-left accent.\n   Make only the accent color transparent so row geometry does not move. */\nhtml[data-theme]\nbody.mf-page-trading.mf-trading-terminal\n.candidates-panel\n.candidate.selected {\n  border-left-color: transparent !important;\n}\n\n',
        "remove Candidate selection stripe override from V152",
    )

    # V154/V155: remove Candidates; preserve other white modules.
    v154 = APP / "memeflow-trading-white-surfaces-v154.css"
    remove_once(
        v154,
        'html[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.terminal > .panel.candidates-panel,\n\n',
        "remove Candidate panel from V154 outer module group",
    )
    remove_between(
        v154,
        '/* Candidates: title, strip container, list, all rows and selected/hover rows. */\n',
        '/* Recent trades: header, list and every trade row. */\n',
        "remove Candidate section from V154",
    )
    replace_once(
        v154,
        '  .chart-panel,\n  .strategy-summary-panel,\n  .positions-panel,\n  .candidates-panel,\n  .bottom-history-panel\n',
        '  .chart-panel,\n  .strategy-summary-panel,\n  .positions-panel,\n  .bottom-history-panel\n',
        "remove Candidates from V154 empty-state group",
    )

    # trading.html: remove obsolete V119/V121 assets.
    trading_html = APP / "trading.html"
    regex_sub_once(
        trading_html,
        r'<!-- MEMEFLOW_CANDIDATE_STATE_FILTERS_V119_ASSET -->\s*<link[^>]+memeflow-candidate-state-filters-v119\.css[^>]*>\s*<!-- /MEMEFLOW_CANDIDATE_STATE_FILTERS_V119_ASSET -->\s*',
        "",
        "remove V119 asset block",
        flags=re.S,
    )
    regex_sub_once(
        trading_html,
        r'<!-- MEMEFLOW_CANDIDATE_EDIT_FILL_V121_ASSET -->\s*<link[^>]+memeflow-candidate-edit-fill-v121\.css[^>]*>\s*<!-- /MEMEFLOW_CANDIDATE_EDIT_FILL_V121_ASSET -->\s*',
        "",
        "remove V121 asset block",
        flags=re.S,
    )
    text = read(trading_html).replace('        <!-- MEMEFLOW_CANDIDATE_STATE_FILTERS_V119 -->\n', '')
    write(trading_html, text)

    cache_bust("trading.css", "candidates-canonical-cleanup-v2-20260909")
    cache_bust("trading-light-polish-v61.css", "candidates-cleanup-v2-20260909")
    cache_bust("trading-visual-hierarchy-v67.css", "candidates-cleanup-v2-20260909")
    cache_bust("memeflow-dark-x-surface-v131.css", "candidates-cleanup-v2-20260909")
    cache_bust("memeflow-trading-white-surfaces-v154.css", "candidates-cleanup-v2-20260909")

    # Verify old assets are no longer referenced by the LIVE application
    # before deleting them. Historical .memeflow-*-backup-* directories under
    # the repository root are intentionally ignored.
    for asset in ["memeflow-candidate-state-filters-v119.css", "memeflow-candidate-edit-fill-v121.css"]:
        refs = []
        for p in APP.rglob("*"):
            if not p.is_file() or p.name == asset:
                continue
            if p.suffix.lower() not in {".html", ".css", ".js", ".mjs", ".json", ".md", ".txt"}:
                continue
            try:
                if asset in p.read_text(encoding="utf-8", errors="ignore"):
                    refs.append(str(p.relative_to(ROOT)))
            except Exception:
                pass
        if refs:
            raise RuntimeError(f"{asset} still referenced by LIVE app files: {', '.join(refs)}")

    (APP / "memeflow-candidate-state-filters-v119.css").unlink()
    (APP / "memeflow-candidate-edit-fill-v121.css").unlink()

    # Verification.
    html = read(APP / "trading.html")
    if "memeflow-candidate-state-filters-v119.css" in html or "memeflow-candidate-edit-fill-v121.css" in html:
        raise RuntimeError("obsolete Candidate CSS asset still linked")

    css = read(APP / "trading.css")
    for token in [
        "MEMEFLOW CANDIDATES — CANONICAL PRESENTATION CONTRACT",
        "grid-template-columns: repeat(5, minmax(0, 1fr))",
        "height: 48px !important",
        "color: var(--mf-text-tertiary",
        "color: var(--mf-text-primary",
        "background: #ffffff !important",
    ]:
        if token not in css:
            raise RuntimeError(f"canonical verification token missing: {token}")

    for p in [trading_css, v61, v67, v131, v154]:
        if not css_braces_ok(p):
            raise RuntimeError(f"CSS brace balance failed: {p.relative_to(ROOT)}")

    diff = subprocess.run(["git", "diff", "--check"], cwd=ROOT, capture_output=True, text=True)
    if diff.returncode != 0:
        raise RuntimeError("git diff --check failed:\n" + diff.stdout + diff.stderr)

    rollback = BACKUP / "ROLLBACK.sh"
    rollback.write_text(
        '''#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BACKUP="$(cd "$(dirname "$0")" && pwd)"
for f in \
  memeflow-app/trading.html \
  memeflow-app/trading.css \
  memeflow-app/trading-light-polish-v61.css \
  memeflow-app/trading-visual-hierarchy-v67.css \
  memeflow-app/memeflow-dark-x-surface-v131.css \
  memeflow-app/memeflow-trading-white-surfaces-v154.css \
  memeflow-app/memeflow-candidate-state-filters-v119.css \
  memeflow-app/memeflow-candidate-edit-fill-v121.css
do
  mkdir -p "$ROOT/$(dirname "$f")"
  cp "$BACKUP/$f" "$ROOT/$f"
done
echo "Candidates rollback complete."
git -C "$ROOT" status --short
''',
        encoding="utf-8",
    )
    rollback.chmod(0o755)

    print("\n✅ CANDIDATES CLEANUP INSTALLED SUCCESSFULLY")
    print(f"Project:  {ROOT}")
    print(f"Backup:   {BACKUP}")
    print(f"Rollback: {rollback}")
    print("\nValidation: git diff --check = OK")
    print("\nChanged files:")
    subprocess.run(["git", "status", "--short"], cwd=ROOT, check=False)
    print("\nAfter visual check, commit with:")
    print('git add memeflow-app && git commit -m "refactor(trading): canonicalize Candidates styles"')
    print("\nRollback if needed:")
    print(f'bash "{rollback}"')

except Exception as exc:
    print(f"\n❌ INSTALL FAILED: {exc}")
    print("Automatic rollback is running. No partial cleanup will remain.")
    restore_all()
    sys.exit(1)
