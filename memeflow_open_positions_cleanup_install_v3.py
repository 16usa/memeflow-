#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


EXPECTED_HEAD = "81de6cd75672eb7c12533742b70b19e74356f4e4"
EXPECTED_BLOBS = {
    "memeflow-app/trading.html": "1bdc58a3d86b281c350651352a62cdbe4329122e",
    "memeflow-app/trading.css": "94135d53f0cd96d2316cccab6209f7f6ef94baba",
    "memeflow-app/trading-light-polish-v61.css": "1dbe05979014acd05fcc68491a3a2c11622677b7",
    "memeflow-app/trading-visual-hierarchy-v67.css": "e828a0727b6dc85c41b2d98a132fafbb777e5a63",
    "memeflow-app/memeflow-dark-x-surface-v131.css": "05a63ab5f0a7b447415fe3fa593855c4196089e4",
    "memeflow-app/memeflow-trading-white-surfaces-v154.css": "4262377f8b121151234ec687003f7cc2e046e0d5",
    "memeflow-app/open-position-info-v84.css": "64a304d626ce989646abd1d939272b0fb94428d0",
    "memeflow-app/open-position-popover-v85.css": "14d133cdb155546a49f04cf6574d160ea527d243",
    "memeflow-app/open-position-surface-v86.css": "46f118489adfa7777fc69df4d96253b2a4037b71",
    "memeflow-app/trading-row-height-v89.css": "7df79ec9d93d6a6e5ef5f150f1f5006e505e169c",
    "memeflow-app/memeflow-open-position-selection-v117.css": "ef1c5dbfebe8d7b21776f6fb0b6f83c2d23d3951",
}
SELFTEST = os.environ.get("MEMEFLOW_INSTALL_SELFTEST") == "1"


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

TOUCH = [
    APP / "trading.html",
    APP / "trading.css",
    APP / "trading-light-polish-v61.css",
    APP / "trading-visual-hierarchy-v67.css",
    APP / "memeflow-dark-x-surface-v131.css",
    APP / "memeflow-trading-white-surfaces-v154.css",
    APP / "open-position-info-v84.css",
    APP / "open-position-popover-v85.css",
    APP / "open-position-surface-v86.css",
    APP / "memeflow-open-position-selection-v117.css",
    APP / "trading-row-height-v89.css",
]

missing = [str(p.relative_to(ROOT)) for p in TOUCH if not p.exists()]
if missing:
    raise SystemExit("ABORT: required files missing:\n  " + "\n  ".join(missing))

if not SELFTEST:
    head = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    if head != EXPECTED_HEAD:
        raise SystemExit(
            "ABORT: Git HEAD does not match the exact tested Candidates commit.\n"
            f"Expected: {EXPECTED_HEAD}\nFound:    {head}\n"
            "No files were changed."
        )

    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--", "memeflow-app"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    if dirty:
        raise SystemExit(
            "ABORT: memeflow-app has uncommitted changes. "
            "Commit/push them before this cleanup.\n" + dirty
        )

    mismatches = []
    for rel, expected in EXPECTED_BLOBS.items():
        actual = subprocess.run(
            ["git", "hash-object", rel],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
        if actual != expected:
            mismatches.append(f"{rel}: expected {expected}, found {actual}")
    if mismatches:
        raise SystemExit(
            "ABORT: exact GitHub blob verification failed:\n" + "\n".join(mismatches)
        )

# This cleanup is intentionally based on the already-installed Candidates cleanup.
trading_text = (APP / "trading.css").read_text(encoding="utf-8")
if "MEMEFLOW_CANDIDATES_CANONICAL_PRESENTATION_END" not in trading_text:
    raise SystemExit(
        "ABORT: Candidates canonical cleanup is not present in trading.css. "
        "Open Positions cleanup must run after Candidates cleanup."
    )
if "MEMEFLOW_OPEN_POSITIONS_CANONICAL_END" in trading_text:
    raise SystemExit("ABORT: Open Positions canonical cleanup already appears installed.")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / ".memeflow-backups" / f"open-positions-style-cleanup-{stamp}"
BACKUP.mkdir(parents=True, exist_ok=False)

for src in TOUCH:
    rel = src.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

# Store independent SHA-256 hashes of the exact backup bytes. Rollback uses
# this manifest to prove every restored file matches the pre-install state.
import hashlib
rollback_hashes = {}
for src in TOUCH:
    rel = src.relative_to(ROOT)
    rollback_hashes[str(rel)] = hashlib.sha256((BACKUP / rel).read_bytes()).hexdigest()
(BACKUP / "ROLLBACK_SHA256.txt").write_text(
    "".join(f"{digest}  {rel}\n" for rel, digest in rollback_hashes.items()),
    encoding="utf-8",
)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, data: str) -> None:
    path.write_text(data.rstrip() + "\n", encoding="utf-8")


def restore_all() -> None:
    for src in TOUCH:
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
        raise RuntimeError(f"{label}: expected 1 exact match in {path.name}, found {count}")
    write(path, text.replace(old, new, 1))


def regex_sub_once(path: Path, pattern: str, repl: str, label: str, flags=0) -> None:
    text = read(path)
    new, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 regex match in {path.name}, found {count}")
    write(path, new)


def remove_exact(path: Path, block: str, label: str) -> None:
    replace_once(path, block, "", label)


def remove_between_first(path: Path, start: str, end: str, label: str) -> None:
    text = read(path)
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f"{label}: start marker not found in {path.name}")
    b = text.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f"{label}: end marker not found after first start in {path.name}")
    write(path, text[:a] + text[b:])


def remove_between_unique(path: Path, start: str, end: str, label: str) -> None:
    text = read(path)
    starts = [m.start() for m in re.finditer(re.escape(start), text)]
    matches = []
    for a in starts:
        b = text.find(end, a + len(start))
        if b >= 0:
            matches.append((a, b))
    if len(matches) != 1:
        raise RuntimeError(f"{label}: expected one bounded block in {path.name}, found {len(matches)}")
    a, b = matches[0]
    write(path, text[:a] + text[b:])


def remove_legacy_open_positions_block(path: Path) -> None:
    """Remove only the base Open Positions component block.

    trading.css legitimately contains more than one `.positions-list {` selector
    because responsive rules repeat it later. The old installer incorrectly
    required a unique selector. This routine identifies the base component by
    its actual contents instead: position row + telemetry + CLOSE ownership,
    bounded by the next `.bottom-history-panel {` block.
    """
    text = read(path)
    starts = [m.start() for m in re.finditer(r"(?m)^\s*\.positions-list\s*\{", text)]
    candidates = []
    for a in starts:
        b = text.find(".bottom-history-panel {", a)
        if b < 0:
            continue
        chunk = text[a:b]
        required = [
            ".position-row {",
            ".position-bottomline {",
            ".close-position {",
        ]
        if all(token in chunk for token in required):
            candidates.append((a, b))
    if len(candidates) != 1:
        diagnostics = []
        for a in starts:
            preview = text[a:a+320].replace("\n", " ")
            diagnostics.append(preview[:300])
        raise RuntimeError(
            "could not uniquely identify legacy Open Positions base block; "
            f"positions-list occurrences={len(starts)}, matching base blocks={len(candidates)}; "
            f"previews={diagnostics}"
        )
    a, b = candidates[0]
    write(path, text[:a] + text[b:])


def ensure_no_live_reference(term: str, exclude_names: set[str] | None = None) -> None:
    exclude_names = exclude_names or set()
    refs = []
    for p in APP.rglob("*"):
        if not p.is_file() or p.name in exclude_names:
            continue
        if p.suffix.lower() not in {".html", ".css", ".js", ".mjs", ".json", ".md", ".txt"}:
            continue
        try:
            if term in p.read_text(encoding="utf-8", errors="ignore"):
                refs.append(str(p.relative_to(ROOT)))
        except Exception:
            pass
    if refs:
        raise RuntimeError(f"live reference to {term!r} remains in: {', '.join(refs)}")


def css_braces_ok(path: Path) -> bool:
    text = read(path)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return text.count("{") == text.count("}")


def whitespace_ok(path: Path) -> None:
    # Validate only the EOF contract here. The baseline contains historical
    # whitespace on untouched lines; rejecting that would make a safe cleanup
    # fail for unrelated pre-existing formatting. `git diff --check` below
    # remains the authority for whitespace introduced by THIS installer.
    data = read(path)
    if not data.endswith("\n") or data.endswith("\n\n"):
        raise RuntimeError(f"EOF newline contract failed: {path.relative_to(ROOT)}")


CANONICAL = r'''/* ==========================================================================
   MEMEFLOW OPEN POSITIONS - CANONICAL PRESENTATION V1

   Single component owner for Open Positions presentation inside trading.css.

   Shared layer intentionally retained:
     - trading-row-height-v89.css: canonical 64px operational row height

   Current approved result preserved:
     - desktop row columns: 42px / content / action
     - mobile row columns: 46px / content / action
     - Light module and rows: true white
     - Light selected row: white, no cyan stripe
     - Dark selected row: approved Surface-2, no visible stripe
     - one-line telemetry with mobile ellipsis
     - V85 owns only the info icon/popover
   ========================================================================== */

.positions-list {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y proximity;
  -webkit-overflow-scrolling: touch;
  padding: 0;
}

.positions-panel .position-row {
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border: 0;
  border-bottom: 1px solid rgba(111, 154, 172, .06);
  border-radius: 0;
  background: transparent;
  color: #6d8590;
  scroll-snap-align: start;
}

.positions-panel .position-row:last-child {
  border-bottom: 0;
}

.positions-panel .position-token-avatar {
  align-self: center;
}

.positions-panel .position-main {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.positions-panel .position-topline,
.positions-panel .position-bottomline {
  min-width: 0;
  display: flex;
  align-items: center;
}

.positions-panel .position-topline {
  gap: 7px;
}

.positions-panel .position-bottomline {
  flex-wrap: nowrap !important;
  gap: 4px !important;
  overflow: hidden;
  color: #657d88;
  font-size: var(--mf-type-micro);
  white-space: nowrap;
}

.positions-panel .position-bottomline i {
  color: #455f6a;
  font-style: normal;
}

.positions-panel .position-bottomline span,
.positions-panel .position-bottomline strong {
  margin: 0;
  font-size: var(--mf-type-micro);
  font-variant-numeric: tabular-nums;
}

.positions-panel .position-size,
.positions-panel .position-pnl {
  flex: 0 0 auto;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.positions-panel .position-symbol {
  min-width: 0;
  overflow: hidden;
  color: #c8d6dd;
  font-size: var(--mf-type-micro);
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.positions-panel .position-pnl {
  font-weight: 720;
}

.positions-panel .position-pnl.pnl-positive {
  color: #22b67a !important;
}

.positions-panel .position-pnl.pnl-negative {
  color: #e3485d !important;
}

html[data-theme="dark"] .positions-panel .position-pnl.pnl-positive {
  color: #49e79e !important;
}

html[data-theme="dark"] .positions-panel .position-pnl.pnl-negative {
  color: #ff6679 !important;
}

.positions-panel .close-position {
  align-self: center;
  justify-self: end;
  height: 27px;
  padding: 0 8px;
  border: 1px solid rgba(255, 102, 121, .14);
  border-radius: 7px;
  background: rgba(255, 102, 121, .04);
  color: #d68a95;
  font-size: var(--mf-type-micro);
}

.positions-panel .positions-list > .position-row.selected {
  background: rgba(85, 217, 255, .035) !important;
  background-image: none !important;
  border-left: 2px solid transparent !important;
  box-shadow: none !important;
}

html[data-theme="dark"]
body.mf-page-trading.mf-trading-terminal
.positions-panel .positions-list > .position-row.selected {
  background: var(--mf-dark-surface-2, #0f141a) !important;
  background-color: var(--mf-dark-surface-2, #0f141a) !important;
  background-image: none !important;
  border-left-color: transparent !important;
  box-shadow: none !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel > .panel-head,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel > .positions-list,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel .positions-list > .position-row {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel .positions-list > .position-row {
  border-bottom-color: var(--mf-trading-v61-line, rgba(23, 23, 23, .075)) !important;
  box-shadow: none !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel .positions-list > .position-row.selected {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
  border-left: 0 !important;
  border-right: 0 !important;
  border-top: 0 !important;
  border-bottom-color: #EBEBEB !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel .empty {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

@media (max-width: 820px) {
  body.mf-page-trading.mf-trading-terminal
  .positions-panel .position-row {
    padding-left: 9px;
    padding-right: 9px;
    grid-template-columns: 46px minmax(0, 1fr) auto;
    gap: 7px;
  }

  body.mf-page-trading.mf-trading-terminal
  .positions-panel .position-main {
    overflow: hidden;
  }

  body.mf-page-trading.mf-trading-terminal
  .positions-panel .position-bottomline {
    display: block !important;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  body.mf-page-trading.mf-trading-terminal
  .positions-panel .positions-list > .position-row.selected {
    padding-left: 7px !important;
  }
}

/* MEMEFLOW_OPEN_POSITIONS_CANONICAL_END */'''


try:
    trading_css = APP / "trading.css"

    # 1) Remove the exact legacy base block from the tested GitHub revision.
    base_start = """.positions-list {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y proximity;
  -webkit-overflow-scrolling: touch;
  padding: 0;
}

/* MEMEFLOW_OPEN_POSITIONS_TRADE_ROW_LAYOUT_V1 */
"""
    remove_between_unique(
        trading_css,
        base_start,
        ".bottom-history-panel {",
        "remove exact legacy Open Positions base block",
    )

    # Remove the earlier generic mobile 62px/28px override.
    remove_exact(
        trading_css,
        """  .position-row {
    min-height: 62px;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    padding: 8px 9px;
    gap: 7px;
  }
  .position-bottomline {
    gap: 3px 5px;
  }
  .close-position { justify-self: end; }

""",
        "remove first mobile Open Positions override",
    )

    # Remove the later Compact Trading V4 Open Positions block by its exact
    # 39px header start and the following history-panel boundary.
    remove_between_unique(
        trading_css,
        "  .positions-panel .panel-head { min-height: 39px; padding: 7px 9px; }",
        "  .history-panel .panel-head { min-height: 39px; padding: 7px 9px; }",
        "remove Compact Trading V4 Open Positions duplicate block",
    )

    # Remove Open Positions from the shared avatar-fit override; the exact
    # mobile 46px column geometry moves into the canonical component block.
    remove_exact(
        trading_css,
        """  .position-row {
    grid-template-columns: 46px minmax(0, 1fr) auto;
  }

""",
        "move mobile 46px Open Positions columns into canonical owner",
    )

    # 2) V61: stop legacy Light layer from owning Open Positions.
    v61 = APP / "trading-light-polish-v61.css"
    replace_once(
        v61,
        'html[data-theme="light"] body.mf-trading-terminal .center-stack > .panel {',
        'html[data-theme="light"] body.mf-trading-terminal .center-stack > .panel:not(.positions-panel) {',
        "exclude Open Positions from V61 panel surface",
    )
    remove_exact(
        v61,
        'html[data-theme="light"] body.mf-trading-terminal .position-row,\n',
        "remove Open Positions row from V61 row group",
    )
    remove_exact(
        v61,
        "  .positions-panel,\n",
        "remove Open Positions from V153 white-module group",
    )
    replace_once(
        v61,
        'html[data-theme="light"] body.mf-trading-terminal .center-stack > .panel.chart-panel,\nhtml[data-theme="light"] body.mf-trading-terminal .center-stack > .panel.positions-panel {',
        'html[data-theme="light"] body.mf-trading-terminal .center-stack > .panel.chart-panel {',
        "remove Open Positions from V153.1 white selector group",
    )

    # 3) V67/V70: move Open Positions mobile flow into trading.css canonical block.
    v67 = APP / "trading-visual-hierarchy-v67.css"
    remove_exact(
        v67,
        '''  /* Real source of the Open Positions jump:\n     trading.css intentionally had flex-wrap: wrap here.\n     Render the same inline pieces as one ellipsized telemetry line. */\n  body.mf-page-trading.mf-trading-terminal .position-main {\n    overflow: hidden;\n  }\n\n  body.mf-page-trading.mf-trading-terminal .position-bottomline {\n    display: block !important;\n    width: 100%;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n  }\n\n''',
        "remove V70 Open Positions flow override",
    )

    # 4) V131/V152: the Candidates cleanup already removed the Candidates
    #    rules, leaving only Open Positions cancellation. Remove the whole
    #    obsolete V152 section instead of keeping an empty historical shell.
    v131 = APP / "memeflow-dark-x-surface-v131.css"
    regex_sub_once(
        v131,
        r'/\* ={20,}\n   MEMEFLOW CANDIDATE FILTER \+ SELECTION STRIPE CLEANUP V152.*?/\* MEMEFLOW_CANDIDATE_FILTER_STRIPE_CLEANUP_V152_END \*/\n?',
        "",
        "remove obsolete V152 selection-cancellation section",
        flags=re.S,
    )

    # 5) V154: stop final white patch from owning Open Positions.
    v154 = APP / "memeflow-trading-white-surfaces-v154.css"
    remove_exact(
        v154,
        "       - Open positions\n",
        "remove Open Positions from V154 scope comment",
    )
    replace_once(
        v154,
        '''html[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.center-stack > .panel.chart-panel,\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.center-stack > .panel.positions-panel {''',
        '''html[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.center-stack > .panel.chart-panel {''',
        "remove Open Positions from V154 outer module group",
    )
    remove_between_unique(
        v154,
        "/* Open positions: list and every row, including selected row. */",
        "/* Recent trades: header, list and every trade row. */",
        "remove Open Positions section from V154",
    )
    remove_exact(
        v154,
        "  .positions-panel,\n",
        "remove Open Positions from V154 empty-state group",
    )

    # 6) V85: popover-only; absorb V86 surface tokens.
    v85 = APP / "open-position-popover-v85.css"
    replace_once(
        v85,
        """/* MEMEFLOW_OPEN_POSITION_POPOVER_V85
   Open positions row:
   LIVE VALUE · TOTAL P&L · info-icon
   Tap the tiny icon for a compact contextual popover.
*/

""",
        """/* MEMEFLOW_OPEN_POSITION_POPOVER_V85
   Compact Open Positions info icon + contextual popover only.
   Row layout, P&L colors and selected state are owned by trading.css.
*/

""",
        "update V85 ownership header",
    )
    remove_between_first(
        v85,
        ".positions-panel .position-bottomline {",
        ".position-info-v85 {",
        "remove duplicated row rules from V85",
    )
    regex_sub_once(
        v85,
        r'(?ms)^  \.positions-panel \.position-bottomline \{\n    gap: 3px !important;\n  \}\n\n',
        "",
        "remove V85 mobile bottomline override",
    )
    replace_once(
        v85,
        "  border: 1px solid rgba(20, 31, 40, .12);\n  border-radius: 14px;\n  background: rgba(255, 255, 255, .98);",
        "  border: 1px solid var(--mf-app-line, rgba(38, 59, 74, .105));\n  border-color: var(--mf-app-line, rgba(38, 59, 74, .105)) !important;\n  border-radius: 14px;\n  background: var(--mf-app-surface-2, #f7f9fb) !important;",
        "merge V86 Light popover surface into V85",
    )
    replace_once(
        v85,
        "  border-left: 1px solid rgba(20, 31, 40, .10);\n  border-top: 1px solid rgba(20, 31, 40, .10);",
        "  border-left: 1px solid var(--mf-app-line, rgba(38, 59, 74, .105)) !important;\n  border-top: 1px solid var(--mf-app-line, rgba(38, 59, 74, .105)) !important;",
        "merge V86 Light arrow surface into V85",
    )
    replace_once(
        v85,
        '''html[data-theme="dark"] .position-popover-v85 {\n  border-color: rgba(126, 153, 166, .16);\n  background: rgba(13, 20, 26, .96);\n  color: #ecf5f7;\n  box-shadow: 0 20px 46px rgba(0, 0, 0, .42);\n}\n\nhtml[data-theme="dark"] .position-popover-v85::after {\n  border-left-color: rgba(126, 153, 166, .12);\n  border-top-color: rgba(126, 153, 166, .12);\n}\n''',
        '''html[data-theme="dark"] .position-popover-v85 {\n  border-color: var(--mf-x-dark-line, #2f3336) !important;\n  background: var(--mf-x-dark-inset, #101113) !important;\n  color: #ecf5f7;\n  box-shadow: 0 20px 46px rgba(0, 0, 0, .42);\n}\n\nhtml[data-theme="dark"] .position-popover-v85::after {\n  border-left-color: var(--mf-x-dark-line, #2f3336) !important;\n  border-top-color: var(--mf-x-dark-line, #2f3336) !important;\n}\n''',
        "merge V86 Dark popover surface into V85",
    )

    # 7) HTML: remove V84/V86/V117 asset links; V85 remains.
    html = APP / "trading.html"
    for version, filename in [
        ("V84", "open-position-info-v84.css"),
        ("V86", "open-position-surface-v86.css"),
        ("V117_1", "memeflow-open-position-selection-v117.css"),
    ]:
        regex_sub_once(
            html,
            rf'<!-- MEMEFLOW_[A-Z0-9_]*{re.escape(version)}[A-Z0-9_]*_ASSET -->\s*<link[^>]+{re.escape(filename)}[^>]*>\s*<!-- /MEMEFLOW_[A-Z0-9_]*{re.escape(version)}[A-Z0-9_]*_ASSET -->\s*',
            "",
            f"remove {version} asset block",
            flags=re.S,
        )
    text = read(html)
    new, count = re.subn(
        r'(<link\s+rel="stylesheet"\s+href="/open-position-popover-v85\.css\?v=)[^"]+("\s*>)',
        r'\1open-position-popover-canonical-v3-20260909\2',
        text,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f"cache-bust V85: expected 1 link, found {count}")
    write(html, new)

    # Cache-bust modified styles already linked by trading.html.
    def cache_bust(filename: str, version: str) -> None:
        text = read(html)
        pattern = rf'(<link\s+rel="stylesheet"\s+href="/{re.escape(filename)}\?v=)[^"]+("\s*>)'
        new_text, count = re.subn(pattern, rf'\1{version}\2', text, count=1)
        if count != 1:
            raise RuntimeError(f"cache-bust {filename}: expected 1 link, found {count}")
        write(html, new_text)

    cache_bust("trading.css", "open-positions-canonical-cleanup-v3-20260909")
    cache_bust("trading-light-polish-v61.css", "open-positions-cleanup-v3-20260909")
    cache_bust("trading-visual-hierarchy-v67.css", "open-positions-cleanup-v3-20260909")
    cache_bust("memeflow-dark-x-surface-v131.css", "open-positions-cleanup-v3-20260909")
    cache_bust("memeflow-trading-white-surfaces-v154.css", "open-positions-cleanup-v3-20260909")

    # 8) Verify V84 is dead and obsolete CSS assets are no longer referenced.
    ensure_no_live_reference("position-info-v84", {"open-position-info-v84.css"})
    ensure_no_live_reference("position-info-sheet-v84", {"open-position-info-v84.css"})
    ensure_no_live_reference("open-position-info-v84.css", {"open-position-info-v84.css"})
    ensure_no_live_reference("open-position-surface-v86.css", {"open-position-surface-v86.css"})
    ensure_no_live_reference("memeflow-open-position-selection-v117.css", {"memeflow-open-position-selection-v117.css"})

    # 9) Add canonical Open Positions presentation to trading.css itself.
    text = read(trading_css)
    write(trading_css, text.rstrip() + "\n\n" + CANONICAL.strip() + "\n")

    # 10) Delete obsolete component files only after reference checks pass.
    (APP / "open-position-info-v84.css").unlink()
    (APP / "open-position-surface-v86.css").unlink()
    (APP / "memeflow-open-position-selection-v117.css").unlink()

    # 11) Verification.
    live_html = read(html)
    for dead in [
        "open-position-info-v84.css",
        "open-position-surface-v86.css",
        "memeflow-open-position-selection-v117.css",
    ]:
        if dead in live_html:
            raise RuntimeError(f"obsolete asset still linked: {dead}")

    final_trading = read(trading_css)
    if final_trading.count("MEMEFLOW_OPEN_POSITIONS_CANONICAL_END") != 1:
        raise RuntimeError("canonical Open Positions marker missing or duplicated")
    if "MEMEFLOW_CANDIDATES_CANONICAL_PRESENTATION_END" not in final_trading:
        raise RuntimeError("Candidates canonical block was lost")

    # Base legacy row ownership must be gone; responsive .positions-list repeats may remain.
    if "MEMEFLOW_OPEN_POSITIONS_TRADE_ROW_LAYOUT_V1" in final_trading:
        raise RuntimeError("legacy Open Positions base marker still remains in trading.css")
    if "MEMEFLOW_OPEN_POSITIONS_MOBILE_CONFLICT_FIX_V1" in final_trading:
        raise RuntimeError("old Open Positions mobile conflict-fix marker still remains")
    if final_trading.count(".positions-list {") != 1:
        raise RuntimeError(
            f"expected exactly one .positions-list owner in trading.css, found {final_trading.count('.positions-list {')}"
        )
    if "  .position-row {\n    grid-template-columns: 46px minmax(0, 1fr) auto;\n  }" in final_trading:
        raise RuntimeError("shared avatar-fit file still owns Open Positions mobile columns")

    v85_text = read(v85)
    if ".positions-panel .position-bottomline" in v85_text:
        raise RuntimeError("V85 still owns .position-bottomline")
    if "var(--mf-app-surface-2, #f7f9fb)" not in v85_text:
        raise RuntimeError("V85 Light theme surface merge missing")
    if "var(--mf-x-dark-inset, #101113)" not in v85_text:
        raise RuntimeError("V85 Dark theme surface merge missing")
    if "MEMEFLOW_OPEN_POSITION_ICON_GEOMETRY_V93" not in v85_text:
        raise RuntimeError("V93 coarse-pointer icon fix was lost")

    v89 = read(APP / "trading-row-height-v89.css")
    if ".positions-panel .positions-list > .position-row" not in v89 or "--mf-v89-row-height: 64px" not in v89:
        raise RuntimeError("V89 64px Open Positions row contract is missing")

    for p in [trading_css, v61, v67, v131, v154, v85, APP / "trading-row-height-v89.css"]:
        if not css_braces_ok(p):
            raise RuntimeError(f"CSS brace balance failed: {p.relative_to(ROOT)}")
        whitespace_ok(p)

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
  memeflow-app/open-position-info-v84.css \
  memeflow-app/open-position-popover-v85.css \
  memeflow-app/open-position-surface-v86.css \
  memeflow-app/memeflow-open-position-selection-v117.css \
  memeflow-app/trading-row-height-v89.css
do
  mkdir -p "$ROOT/$(dirname "$f")"
  cp "$BACKUP/$f" "$ROOT/$f"
done

python3 - "$ROOT" "$BACKUP" <<'PYVERIFY'
import hashlib, pathlib, sys
root = pathlib.Path(sys.argv[1])
backup = pathlib.Path(sys.argv[2])
manifest = backup / "ROLLBACK_SHA256.txt"
failed = []
for line in manifest.read_text(encoding="utf-8").splitlines():
    if not line.strip():
        continue
    digest, rel = line.split("  ", 1)
    path = root / rel
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else "MISSING"
    if actual != digest:
        failed.append(f"{rel}: expected {digest}, got {actual}")
if failed:
    print("ROLLBACK HASH VERIFICATION FAILED:")
    print("\\n".join(failed))
    raise SystemExit(1)
print("Rollback SHA-256 verification: OK")
PYVERIFY

git -C "$ROOT" diff --check
echo "Open Positions rollback complete."
git -C "$ROOT" status --short
''',
        encoding="utf-8",
    )
    rollback.chmod(0o755)

    print("\n✅ OPEN POSITIONS CLEANUP INSTALLED SUCCESSFULLY")
    print(f"Project:  {ROOT}")
    print(f"Backup:   {BACKUP}")
    print(f"Rollback: {rollback}")
    print("\nValidation: git diff --check = OK")
    print("Validation: CSS braces / EOF / live references = OK")
    print("Validation: exact GitHub HEAD/blob gate = OK" if not SELFTEST else "Validation: self-test baseline gate bypassed")
    print("Validation: exactly one .positions-list owner in trading.css = OK")
    print("\nChanged files:")
    subprocess.run(["git", "status", "--short"], cwd=ROOT, check=False)
    print("\nAfter visual check, commit with:")
    print('git add memeflow-app && git commit -m "refactor(trading): canonicalize Open Positions styles"')
    print("\nRollback if needed:")
    print(f'bash "{rollback}"')

except Exception as exc:
    print(f"\n❌ INSTALL FAILED: {exc}")
    print("Automatic rollback is running. No partial Open Positions cleanup will remain.")
    restore_all()
    sys.exit(1)
