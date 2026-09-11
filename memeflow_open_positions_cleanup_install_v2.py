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
    data = read(path)
    if not data.endswith("\n") or data.endswith("\n\n"):
        raise RuntimeError(f"EOF newline contract failed: {path.relative_to(ROOT)}")
    for i, line in enumerate(data.splitlines(), 1):
        if line.endswith(" ") or line.endswith("\t"):
            raise RuntimeError(f"trailing whitespace: {path.relative_to(ROOT)}:{i}")


CANONICAL = r'''/* ==========================================================================
   MEMEFLOW OPEN POSITIONS — CANONICAL PRESENTATION

   Single component owner for Open Positions presentation inside trading.css.

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

/* MEMEFLOW_OPEN_POSITIONS_CANONICAL_END */'''


try:
    trading_css = APP / "trading.css"

    # 1) Remove only the base Open Positions block; duplicate responsive selectors are valid.
    remove_legacy_open_positions_block(trading_css)

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

    # 4) V131/V152: remove obsolete selected-row cancellation.
    v131 = APP / "memeflow-dark-x-surface-v131.css"
    remove_exact(
        v131,
        '''/* Open-position V117 dark/default uses a left border accent.\n   Keep its width and selected fill; hide only the accent color. */\nhtml[data-theme]\nbody.mf-page-trading.mf-trading-terminal\n.positions-panel\n.positions-list\n.position-row.selected {\n  border-left-color: transparent !important;\n}\n\n/* Open-position V117 light uses an inset box-shadow as the left accent.\n   Removing this shadow removes only that stripe; the selected fill remains. */\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.positions-panel\n.positions-list\n.position-row.selected {\n  box-shadow: none !important;\n}\n''',
        "remove V152 Open Positions selected-row cancellation",
    )

    # 5) V154: stop final white patch from owning Open Positions.
    v154 = APP / "memeflow-trading-white-surfaces-v154.css"
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
        r'\1open-position-popover-canonical-20260909\2',
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

    cache_bust("trading.css", "open-positions-canonical-cleanup-v2-20260909")
    cache_bust("trading-light-polish-v61.css", "open-positions-cleanup-v2-20260909")
    cache_bust("trading-visual-hierarchy-v67.css", "open-positions-cleanup-v2-20260909")
    cache_bust("memeflow-dark-x-surface-v131.css", "open-positions-cleanup-v2-20260909")
    cache_bust("memeflow-trading-white-surfaces-v154.css", "open-positions-cleanup-v2-20260909")

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
    print("Validation: duplicate responsive .positions-list selectors handled safely")
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
