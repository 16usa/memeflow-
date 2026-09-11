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

NEW_CANONICAL = APP / "open-positions.css"
if NEW_CANONICAL.exists():
    raise SystemExit("ABORT: memeflow-app/open-positions.css already exists; refusing to overwrite unknown canonical file.")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / ".memeflow-backups" / f"open-positions-style-cleanup-{stamp}"
BACKUP.mkdir(parents=True, exist_ok=False)

for src in TOUCH:
    rel = src.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


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
    if NEW_CANONICAL.exists():
        NEW_CANONICAL.unlink()
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


def remove_between(path: Path, start: str, end: str, label: str) -> None:
    text = read(path)
    if text.count(start) != 1:
        raise RuntimeError(f"{label}: start marker count is {text.count(start)} in {path.name}")
    a = text.find(start)
    b = text.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f"{label}: end marker not found in {path.name}")
    write(path, text[:a] + text[b:])


def remove_between_first(path: Path, start: str, end: str, label: str) -> None:
    text = read(path)
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f"{label}: start marker not found in {path.name}")
    b = text.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f"{label}: end marker not found in {path.name}")
    write(path, text[:a] + text[b:])


def remove_exact(path: Path, block: str, label: str) -> None:
    replace_once(path, block, "", label)


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
    data = read(path)
    if not data.endswith("\n") or data.endswith("\n\n"):
        raise RuntimeError(f"EOF newline contract failed: {path.relative_to(ROOT)}")
    for i, line in enumerate(data.splitlines(), 1):
        if line.endswith(" ") or line.endswith("\t"):
            raise RuntimeError(f"trailing whitespace: {path.relative_to(ROOT)}:{i}")


try:
    # ------------------------------------------------------------------
    # 1. Remove the legacy Open Positions component block from trading.css.
    #    A new non-versioned canonical component file will own it instead.
    # ------------------------------------------------------------------
    trading_css = APP / "trading.css"
    remove_between(
        trading_css,
        ".positions-list {",
        ".bottom-history-panel {",
        "remove legacy Open Positions block from trading.css",
    )

    # ------------------------------------------------------------------
    # 2. V61: stop the old Light polish layer from owning Open Positions.
    #    This script expects the already-installed Candidates cleanup state.
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # 3. V67/V70: move explicit Open Positions mobile flow into canonical CSS.
    # ------------------------------------------------------------------
    v67 = APP / "trading-visual-hierarchy-v67.css"
    remove_exact(
        v67,
        '''  /* Real source of the Open Positions jump:\n     trading.css intentionally had flex-wrap: wrap here.\n     Render the same inline pieces as one ellipsized telemetry line. */\n  body.mf-page-trading.mf-trading-terminal .position-main {\n    overflow: hidden;\n  }\n\n  body.mf-page-trading.mf-trading-terminal .position-bottomline {\n    display: block !important;\n    width: 100%;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n  }\n\n''',
        "remove V70 Open Positions flow override",
    )

    # ------------------------------------------------------------------
    # 4. V131/V152: remove only the obsolete selected-row cancellation rules.
    #    Shared structural hairlines, contrast, badges remain global.
    # ------------------------------------------------------------------
    v131 = APP / "memeflow-dark-x-surface-v131.css"
    remove_exact(
        v131,
        '''/* Open-position V117 dark/default uses a left border accent.\n   Keep its width and selected fill; hide only the accent color. */\nhtml[data-theme]\nbody.mf-page-trading.mf-trading-terminal\n.positions-panel\n.positions-list\n.position-row.selected {\n  border-left-color: transparent !important;\n}\n\n/* Open-position V117 light uses an inset box-shadow as the left accent.\n   Removing this shadow removes only that stripe; the selected fill remains. */\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.positions-panel\n.positions-list\n.position-row.selected {\n  box-shadow: none !important;\n}\n''',
        "remove V152 Open Positions selected-row cancellation",
    )

    # ------------------------------------------------------------------
    # 5. V154: stop the final white-surface patch from owning Open Positions.
    # ------------------------------------------------------------------
    v154 = APP / "memeflow-trading-white-surfaces-v154.css"

    replace_once(
        v154,
        """html[data-theme=\"light\"]\nbody.mf-page-trading.mf-trading-terminal\n.center-stack > .panel.chart-panel,\n\nhtml[data-theme=\"light\"]\nbody.mf-page-trading.mf-trading-terminal\n.center-stack > .panel.positions-panel {""",
        """html[data-theme=\"light\"]\nbody.mf-page-trading.mf-trading-terminal\n.center-stack > .panel.chart-panel {""",
        "remove Open Positions from V154 outer module selector group",
    )

    remove_between(
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

    # ------------------------------------------------------------------
    # 6. V85: keep only the live info icon/popover component. Remove old row
    #    ownership, and absorb V86 theme surfaces directly into V85.
    # ------------------------------------------------------------------
    v85 = APP / "open-position-popover-v85.css"
    remove_between_first(
        v85,
        ".positions-panel .position-bottomline {",
        ".position-info-v85 {",
        "remove duplicated Open Positions row rules from V85",
    )

    remove_exact(
        v85,
        '''@media (max-width: 430px) {\n  .positions-panel .position-bottomline {\n    gap: 3px !important;\n  }\n\n''',
        "remove V85 mobile bottomline override prefix",
    )
    # Re-open the media block removed above for the popover-only rules.
    text = read(v85)
    marker = "  .position-info-v85,\n  .position-info-v85 svg {"
    if text.count(marker) != 1:
        raise RuntimeError("V85 mobile popover marker not found exactly once")
    text = text.replace(marker, "@media (max-width: 430px) {\n" + marker, 1)
    write(v85, text)

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
        "merge V86 Dark surface into V85",
    )

    # ------------------------------------------------------------------
    # 7. HTML: remove V84, V86 and V117 assets; add one canonical component
    #    stylesheet after V154 so it is the final Open Positions owner.
    # ------------------------------------------------------------------
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

    # Cache-bust V85 because it now owns its final theme surface directly.
    text = read(html)
    new, count = re.subn(
        r'(<link\s+rel="stylesheet"\s+href="/open-position-popover-v85\.css\?v=)[^"]+("\s*>)',
        r'\1open-position-popover-canonical-20260909\2',
        text,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f"cache-bust V85: expected 1 link, found {count}")
    write(html, new)

    text = read(html)
    anchor = "<!-- /MEMEFLOW_TRADING_LIGHT_WHITE_MODULE_SURFACES_V154_FINAL_ASSET -->"
    if text.count(anchor) != 1:
        raise RuntimeError(f"V154 asset anchor expected once, found {text.count(anchor)}")
    insertion = anchor + '''\n<!-- MEMEFLOW_OPEN_POSITIONS_CANONICAL_ASSET -->\n<link rel="stylesheet" href="/open-positions.css?v=canonical-20260909">\n<!-- /MEMEFLOW_OPEN_POSITIONS_CANONICAL_ASSET -->'''
    write(html, text.replace(anchor, insertion, 1))

    # ------------------------------------------------------------------
    # 8. Verify V84 is genuinely dead before deletion.
    # ------------------------------------------------------------------
    ensure_no_live_reference("position-info-v84", {"open-position-info-v84.css"})
    ensure_no_live_reference("position-info-sheet-v84", {"open-position-info-v84.css"})

    # The old asset filenames must no longer be referenced by the live app.
    ensure_no_live_reference("open-position-info-v84.css", {"open-position-info-v84.css"})
    ensure_no_live_reference("open-position-surface-v86.css", {"open-position-surface-v86.css"})
    ensure_no_live_reference("memeflow-open-position-selection-v117.css", {"memeflow-open-position-selection-v117.css"})

    # ------------------------------------------------------------------
    # 9. Create the single non-versioned Open Positions presentation owner.
    #    V89 remains the shared 64px row-height owner. V131 shared structural
    #    hairlines/contrast/badge contracts remain reusable system layers.
    # ------------------------------------------------------------------
    canonical = r'''/* ==========================================================================
   MEMEFLOW OPEN POSITIONS — CANONICAL PRESENTATION

   Single component owner for Open Positions presentation.

   Shared layers intentionally retained:
     - trading-row-height-v89.css: canonical 64px operational row height
     - global typography/contrast tokens
     - global structural hairline/inset divider system
     - global badge/action semantic tokens

   Current approved visual result preserved:
     - Light module + rows: true white
     - Light selected row: white, no cyan stripe
     - Dark selected row: approved dark Surface-2, no visible stripe
     - compact one-line telemetry
     - mobile telemetry ellipsis behavior
     - compact CLOSE action
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
  border-radius: 0;
  background: transparent;
  scroll-snap-align: start;
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
  white-space: nowrap;
}

.positions-panel .position-bottomline i {
  color: #455f6a;
  font-style: normal;
}

.positions-panel .position-bottomline span,
.positions-panel .position-bottomline strong {
  margin: 0;
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
  text-overflow: ellipsis;
  white-space: nowrap;
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
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 3px !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 1px 3px !important;
  border-width: var(--mf-structure-hairline, 1px) !important;
  border-style: solid !important;
  border-color: rgba(255, 102, 121, .14) !important;
  border-radius: 5px !important;
  background: rgba(255, 102, 121, .04) !important;
  color: #d68a95 !important;
  box-shadow: none !important;
  font-family: inherit !important;
  font-size: 9px !important;
  line-height: 1.05 !important;
  font-weight: 500 !important;
  letter-spacing: .025em !important;
  text-transform: uppercase !important;
  white-space: nowrap !important;
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
  background: var(--mf-dark-surface-2, #101113) !important;
  background-color: var(--mf-dark-surface-2, #101113) !important;
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
.positions-panel .positions-list > .position-row,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel .positions-list > .position-row.selected {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel .positions-list > .position-row.selected {
  border-left: 0 !important;
  border-right: 0 !important;
  border-top: 0 !important;
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

@media (max-width: 430px) {
  body.mf-page-trading.mf-trading-terminal
  .positions-panel .position-bottomline {
    gap: 3px !important;
  }
}

/* MEMEFLOW_OPEN_POSITIONS_CANONICAL_END */
'''
    write(NEW_CANONICAL, canonical)

    # ------------------------------------------------------------------
    # 10. Delete obsolete versioned component files after all live-reference
    #     checks have passed.
    # ------------------------------------------------------------------
    (APP / "open-position-info-v84.css").unlink()
    (APP / "open-position-surface-v86.css").unlink()
    (APP / "memeflow-open-position-selection-v117.css").unlink()

    # ------------------------------------------------------------------
    # 11. Verification.
    # ------------------------------------------------------------------
    live_html = read(html)
    for dead in [
        "open-position-info-v84.css",
        "open-position-surface-v86.css",
        "memeflow-open-position-selection-v117.css",
    ]:
        if dead in live_html:
            raise RuntimeError(f"obsolete asset still linked: {dead}")
    if 'href="/open-positions.css?v=canonical-20260909"' not in live_html:
        raise RuntimeError("canonical Open Positions stylesheet not linked")

    # V85 must now be popover-only.
    v85_text = read(v85)
    if ".positions-panel .position-bottomline" in v85_text:
        raise RuntimeError("V85 still owns .position-bottomline")
    if "var(--mf-app-surface-2, #f7f9fb)" not in v85_text:
        raise RuntimeError("V85 Light theme surface merge missing")
    if "var(--mf-x-dark-inset, #101113)" not in v85_text:
        raise RuntimeError("V85 Dark theme surface merge missing")
    if "MEMEFLOW_OPEN_POSITION_ICON_GEOMETRY_V93" not in v85_text:
        raise RuntimeError("V93 coarse-pointer icon fix was lost")

    # V89 is deliberately retained as the shared row-height authority.
    v89 = read(APP / "trading-row-height-v89.css")
    if ".positions-panel .positions-list > .position-row" not in v89 or "--mf-v89-row-height: 64px" not in v89:
        raise RuntimeError("V89 64px Open Positions row contract is missing")

    canonical_text = read(NEW_CANONICAL)
    for token in [
        "MEMEFLOW OPEN POSITIONS — CANONICAL PRESENTATION",
        "background: #ffffff !important",
        "var(--mf-dark-surface-2, #101113)",
        "display: block !important",
        "padding-left: 7px !important",
    ]:
        if token not in canonical_text:
            raise RuntimeError(f"canonical verification token missing: {token}")

    for p in [
        APP / "trading.css",
        APP / "trading-light-polish-v61.css",
        APP / "trading-visual-hierarchy-v67.css",
        APP / "memeflow-dark-x-surface-v131.css",
        APP / "memeflow-trading-white-surfaces-v154.css",
        APP / "open-position-popover-v85.css",
        APP / "open-positions.css",
    ]:
        if not css_braces_ok(p):
            raise RuntimeError(f"CSS brace balance failed: {p.relative_to(ROOT)}")
        whitespace_ok(p)
    whitespace_ok(APP / "trading.html")

    diff_check = subprocess.run(["git", "diff", "--check"], cwd=ROOT, capture_output=True, text=True)
    if diff_check.returncode != 0:
        raise RuntimeError("git diff --check failed:\n" + diff_check.stdout + diff_check.stderr)

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
rm -f "$ROOT/memeflow-app/open-positions.css"
echo "Open Positions rollback complete."
git -C "$ROOT" status --short
''',
        encoding="utf-8",
    )
    rollback.chmod(0o755)

    print("")
    print("✅ OPEN POSITIONS CLEANUP INSTALLED SUCCESSFULLY")
    print(f"Project:  {ROOT}")
    print(f"Backup:   {BACKUP}")
    print(f"Rollback: {rollback}")
    print("")
    print("Validation: git diff --check = OK")
    print("Validation: CSS braces / EOF / live references = OK")
    print("")
    print("Changed files:")
    subprocess.run(["git", "status", "--short"], cwd=ROOT, check=False)
    print("")
    print("After visual check, commit all accumulated style cleanup with:")
    print('  git add memeflow-app && git commit -m "refactor(trading): canonicalize Candidates and Open Positions styles"')
    print("")
    print("Rollback if needed:")
    print(f'  bash "{rollback}"')

except Exception as exc:
    print("")
    print(f"❌ INSTALL FAILED: {exc}")
    print("Automatic rollback is running. No partial Open Positions cleanup will remain.")
    restore_all()
    sys.exit(1)
