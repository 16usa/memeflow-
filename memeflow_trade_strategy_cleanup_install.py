#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

EXPECTED_HEAD = "74141f4fcd8b2ce28e62f40587c8f59ffc6dd6e5"
EXPECTED_BLOBS = {
    "memeflow-app/trading.css": "f1930c9563369d8f3a894c84dfb2a52dd94287f6",
    "memeflow-app/trading-light-polish-v61.css": "58b317216bdc62653c79fbd40257105d11e528ef",
    "memeflow-app/trading-visual-hierarchy-v67.css": "bf138d3bb149362049878bee252c4021680bb238",
    "memeflow-app/memeflow-trading-white-surfaces-v154.css": "9b660142ef24ac2791395f65dd9b8817a82a2dbc",
    "memeflow-app/trading.html": "b46e1dc6c9d3df62a996cc0089a126fba0d5024a",
}
TARGET_RELS = tuple(EXPECTED_BLOBS)
SELFTEST = os.environ.get("MEMEFLOW_INSTALL_SELFTEST") == "1"

def run(cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)

def find_root() -> Path:
    p = run(["git", "rev-parse", "--show-toplevel"])
    candidates = []
    if p.returncode == 0 and p.stdout.strip():
        candidates.append(Path(p.stdout.strip()))
    candidates += [Path.cwd(), Path("/home/runner/workspace"), Path("/workspace")]
    seen = set()
    for c in candidates:
        try:
            c = c.resolve()
        except Exception:
            continue
        if c in seen:
            continue
        seen.add(c)
        if (c / "memeflow-app" / "trading.html").is_file():
            return c
    raise RuntimeError("MEMEFLOW project root not found")

ROOT = find_root()
APP = ROOT / "memeflow-app"
TARGETS = [ROOT / rel for rel in TARGET_RELS]

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write(path: Path, text: str) -> None:
    lines = [line.rstrip(" \t") for line in text.splitlines()]
    path.write_text("\n".join(lines).rstrip("\n") + "\n", encoding="utf-8")

def git_blob(path: Path) -> str:
    p = run(["git", "hash-object", str(path)], cwd=ROOT)
    if p.returncode != 0:
        raise RuntimeError(f"git hash-object failed for {path.relative_to(ROOT)}: {p.stderr.strip()}")
    return p.stdout.strip()

def require_once(text: str, needle: str, label: str) -> None:
    n = text.count(needle)
    if n != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence, found {n}")

def marker_region(text: str, start: str, end: str, label: str):
    if text.count(start) != 1:
        raise RuntimeError(f"{label}: start marker count={text.count(start)}")
    a = text.index(start)
    b = text.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f"{label}: end marker missing")
    return a, b, text[a:b]

def remove_strategy_restore_block(path: Path) -> None:
    text = read(path)
    start = "/* ===== MEMEFLOW_RESTORE_COMPACT_TRADE_STRATEGY_V1 ===== */"
    end = "/* ===== /MEMEFLOW_RESTORE_COMPACT_TRADE_STRATEGY_V1 ===== */"
    require_once(text, start, "legacy Trade Strategy start")
    require_once(text, end, "legacy Trade Strategy end")
    a = text.index(start)
    b = text.index(end, a) + len(end)

    canonical = r'''/* ==========================================================================
   MEMEFLOW TRADE STRATEGY - CANONICAL PRESENTATION V1

   Single component owner for Trade Strategy presentation inside trading.css.

   Intentional separate owners:
     - trading-typography-v66.css / late type bridges: shared typography only
     - memeflow-trading-white-surfaces-v154.css: Light-theme Strategy surfaces
     - shared Trading theme tokens: neutral/semantic palette values

   Current approved result preserved:
     - compact 51px desktop header
     - current 46px mobile header composition
     - two-column 43px summary rows
     - flat inner rows on the parent panel surface
     - canonical header / vertical / footer separators
     - dark Edit control surface
     - one-line mobile values and compact Edit action
   ========================================================================== */

.strategy-summary-panel .panel-head {
  min-height: 51px;
}

.strategy-summary-panel .strategy-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.strategy-summary-panel .strategy-edit-link {
  min-width: 42px;
  height: 25px;
  padding: 0 8px;
  border: 1px solid rgba(111, 154, 172, .08);
  border-radius: 7px;
  background: transparent;
  color: #718995;
  font-size: var(--mf-type-micro);
  font-weight: 720;
  line-height: 1;
}

.strategy-summary-panel .strategy-edit-link:active,
.strategy-summary-panel .strategy-edit-link:hover {
  border-color: rgba(85, 217, 255, .20);
  color: #a9dce8;
}

.strategy-summary-panel .strategy-summary-list {
  display: grid;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

.strategy-summary-panel .strategy-summary-row {
  min-height: 43px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid transparent !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

.strategy-summary-panel .strategy-summary-row > div {
  min-width: 0;
  padding: 7px 10px;
}

.strategy-summary-panel .strategy-summary-row > div + div {
  border-left: 1px solid var(--mf-trading-v61-line, var(--line)) !important;
}

.strategy-summary-panel .strategy-summary-row span {
  display: block;
  color: #526a75;
  font-size: var(--mf-type-micro);
  line-height: 1.2;
  font-weight: 500;
}

.strategy-summary-panel .strategy-summary-row strong {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: #c8d6dd;
  font-size: var(--mf-type-micro);
  font-weight: 700;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strategy-summary-panel > .panel-head {
  border-bottom-color: var(--mf-trading-v61-line, var(--line)) !important;
}

.strategy-summary-panel .strategy-summary-foot {
  min-height: 27px;
  padding: 7px 10px;
  display: flex;
  align-items: center;
  border-top: 1px solid var(--mf-trading-v61-line, var(--line)) !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  color: #405965;
  font-size: var(--mf-type-micro);
  line-height: 1.2;
}

.strategy-summary-panel .control-error {
  margin: 7px 9px;
}

html[data-theme="dark"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel .strategy-edit-link {
  background: var(--mf-dark-surface-2) !important;
  background-image: none !important;
  border-color: var(--mf-dark-line) !important;
  box-shadow: none !important;
}

@media (hover: hover) and (pointer: fine) {
  html[data-theme="dark"]
  body.mf-page-trading.mf-trading-terminal
  .strategy-summary-panel .strategy-edit-link:hover {
    background: var(--mf-dark-surface-2) !important;
  }
}

@media (max-width: 820px) {
  body.mf-page-trading.mf-trading-terminal
  .strategy-summary-panel {
    width: 100%;
  }

  body.mf-page-trading.mf-trading-terminal
  .strategy-summary-panel > .panel-head {
    min-height: 46px !important;
    padding: 8px 10px !important;
    gap: 10px !important;
  }

  body.mf-page-trading.mf-trading-terminal
  .strategy-summary-panel > .panel-head > div:first-child {
    min-width: 0;
    display: flex !important;
    align-items: baseline !important;
    gap: 8px !important;
  }

  body.mf-page-trading.mf-trading-terminal
  .strategy-summary-panel > .panel-head .eyebrow {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  body.mf-page-trading.mf-trading-terminal
  .strategy-summary-panel > .panel-head h2 {
    min-width: 0;
    margin: 0 !important;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  body.mf-page-trading.mf-trading-terminal
  .strategy-summary-panel .strategy-head-actions {
    flex: 0 0 auto;
  }

  body.mf-page-trading.mf-trading-terminal
  .strategy-summary-panel .strategy-edit-link {
    white-space: nowrap;
  }

  body.mf-page-trading.mf-trading-terminal
  .strategy-summary-panel .strategy-summary-row :where(span, strong) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 460px) {
  .strategy-summary-panel .strategy-summary-row > div {
    padding: 7px 9px;
  }

  .strategy-summary-panel .strategy-summary-row strong {
    font-size: var(--mf-type-micro);
  }

  .strategy-summary-panel .strategy-edit-link {
    min-width: 40px;
    height: 24px;
    padding: 0 7px;
    font-size: var(--mf-type-micro);
  }
}

/* MEMEFLOW_TRADE_STRATEGY_CANONICAL_END */'''
    text = text[:a] + canonical + text[b:]
    write(path, text)

def clean_v61(path: Path) -> None:
    text = read(path)

    old = 'html[data-theme="light"] body.mf-trading-terminal .terminal > .panel:not(.candidates-panel):not(.chart-panel),'
    new = 'html[data-theme="light"] body.mf-trading-terminal .terminal > .panel:not(.candidates-panel):not(.chart-panel):not(.strategy-summary-panel),'
    if text.count(old) != 1:
        raise RuntimeError(f"V61 shared panel selector expected once, found {text.count(old)}")
    text = text.replace(old, new, 1)

    old = '''html[data-theme="light"] body.mf-trading-terminal .strategy-summary-row,
html[data-theme="light"] body.mf-trading-terminal .empty {
'''
    new = '''html[data-theme="light"] body.mf-trading-terminal .empty {
'''
    if text.count(old) != 1:
        raise RuntimeError("V61 strategy row/inset rule changed")
    text = text.replace(old, new, 1)

    old = '''html[data-theme="light"] body.mf-trading-terminal .strategy-edit-link,
html[data-theme="light"] body.mf-trading-terminal .wallet-btn {
'''
    new = '''html[data-theme="light"] body.mf-trading-terminal .wallet-btn {
'''
    if text.count(old) != 1:
        raise RuntimeError("V61 strategy Edit rule changed")
    text = text.replace(old, new, 1)

    old = '''  html[data-theme="light"] body.mf-trading-terminal .strategy-edit-link:hover,
  html[data-theme="light"] body.mf-trading-terminal .wallet-btn:hover {
'''
    new = '''  html[data-theme="light"] body.mf-trading-terminal .wallet-btn:hover {
'''
    if text.count(old) != 1:
        raise RuntimeError("V61 strategy Edit hover rule changed")
    text = text.replace(old, new, 1)

    old = '''html[data-theme="light"] body.mf-trading-terminal .panel-head h2,
html[data-theme="light"] body.mf-trading-terminal .candidate-name strong,
html[data-theme="light"] body.mf-trading-terminal .strategy-summary-row strong {
'''
    new = '''html[data-theme="light"] body.mf-trading-terminal .panel-head h2,
html[data-theme="light"] body.mf-trading-terminal .candidate-name strong {
'''
    if text.count(old) != 1:
        raise RuntimeError("V61 strategy primary-text rule changed")
    text = text.replace(old, new, 1)

    old = 'html[data-theme="light"] body.mf-trading-terminal .strategy-summary-row span,\n'
    if text.count(old) != 1:
        raise RuntimeError("V61 strategy secondary-text selector changed")
    text = text.replace(old, "", 1)

    for start, end, label in (
        ("/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153\n",
         "/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153_END */",
         "V153 Strategy compatibility"),
        ("/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153_1 */",
         "/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153_1_END */",
         "V153.1 Strategy compatibility"),
    ):
        if text.count(start) != 1 or text.count(end) != 1:
            raise RuntimeError(f"{label} markers changed")
        a = text.index(start)
        b = text.index(end, a) + len(end)
        text = text[:a] + text[b:]

    write(path, text)

def clean_v67(path: Path) -> None:
    text = read(path)

    start_v70 = "/* ==========================================================================\n   SINGLE-LINE FLOW STABILITY V70"
    start_v71 = "/* ==========================================================================\n   MOBILE DENSITY FLOW V71"
    if text.count(start_v70) != 1 or text.count(start_v71) != 1:
        raise RuntimeError("V67 V70/V71 markers changed")

    a70 = text.index(start_v70)
    pre = text[:a70]
    standalone = "    .strategy-summary-panel,\n"
    if pre.count(standalone) != 4:
        raise RuntimeError(f"V67 pre-V70 Strategy panel entries expected 4, found {pre.count(standalone)}")
    pre = pre.replace(standalone, "")
    if pre.count("  .strategy-head-actions,\n") != 1:
        raise RuntimeError("V67 strategy-head-actions entry changed")
    pre = pre.replace("  .strategy-head-actions,\n", "", 1)

    rest = text[a70:]
    b71rel = rest.index(start_v71)
    v70 = rest[:b71rel]
    tail = rest[b71rel:]
    if v70.count(standalone) != 1:
        raise RuntimeError(f"V70 Strategy panel entry expected 1, found {v70.count(standalone)}")
    v70 = v70.replace(standalone, "", 1)
    if v70.count("    .strategy-edit-link,\n") != 1:
        raise RuntimeError("V70 strategy-edit-link entry changed")
    v70 = v70.replace("    .strategy-edit-link,\n", "", 1)
    strategy_flow = "  body.mf-page-trading.mf-trading-terminal .strategy-summary-row :where(span, strong),\n"
    if v70.count(strategy_flow) != 1:
        raise RuntimeError("V70 Strategy value-flow selector changed")
    v70 = v70.replace(strategy_flow, "", 1)
    text = pre + v70 + tail

    start109 = "/* ==========================================================================\n   MEMEFLOW_TRADING_DARK_SURFACE_BRIDGE_V109"
    end109 = "/* MEMEFLOW_TRADING_DARK_SURFACE_BRIDGE_V109_END */"
    a, b, region = marker_region(text, start109, end109, "V109 dark bridge")
    old = ":where(.selected-metrics > div, .strategy-summary-row, .empty)"
    if region.count(old) != 1:
        raise RuntimeError("V109 Strategy row surface selector changed")
    region = region.replace(old, ":where(.selected-metrics > div, .empty)", 1)

    old = ":where(.strategy-edit-link, .wallet-btn)"
    if region.count(old) != 2:
        raise RuntimeError(f"V109 Strategy Edit selectors expected 2, found {region.count(old)}")
    region = region.replace(old, ".wallet-btn")
    text = text[:a] + region + text[b:]

    start125 = "/* ==========================================================================\n   MEMEFLOW TRADING FLAT INNER SURFACES V125"
    end125 = "/* MEMEFLOW_TRADING_FLAT_INNER_SURFACES_V125_END */"
    a, b, region = marker_region(text, start125, end125, "V125 flat surfaces")

    old = '''body.mf-page-trading.mf-trading-terminal
.chart-panel .selected-metrics,
body.mf-page-trading.mf-trading-terminal
.approvals-panel .approval-list,
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel .strategy-summary-list {
'''
    new = '''body.mf-page-trading.mf-trading-terminal
.chart-panel .selected-metrics,
body.mf-page-trading.mf-trading-terminal
.approvals-panel .approval-list {
'''
    if region.count(old) != 1:
        raise RuntimeError("V125 Strategy list surface selector changed")
    region = region.replace(old, new, 1)

    old = '''body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel .strategy-summary-row,
'''
    if region.count(old) != 1:
        raise RuntimeError("V125 Strategy row selector changed")
    region = region.replace(old, "", 1)

    s = '''body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .panel-head {
'''
    e = '''body.mf-page-trading.mf-trading-terminal
.chart-panel .selected-metrics {
'''
    if region.count(s) != 1 or region.count(e) != 1:
        raise RuntimeError("V125 Strategy separator block changed")
    sa = region.index(s)
    eb = region.index(e, sa)
    region = region[:sa] + region[eb:]

    text = text[:a] + region + text[b:]
    write(path, text)

def clean_v154(path: Path) -> None:
    text = read(path)

    old_outer = '''html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.terminal > .panel.control-panel.strategy-summary-panel,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.center-stack > .panel.chart-panel {
'''
    new_outer = '''html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.center-stack > .panel.chart-panel {
'''
    if text.count(old_outer) != 1:
        raise RuntimeError("V154 shared outer Chart/Strategy selector changed")
    text = text.replace(old_outer, new_outer, 1)

    start = '''/* --------------------------------------------------------------------------
   TRADE STRATEGY
   -------------------------------------------------------------------------- */
'''
    end = "/* MEMEFLOW_TRADING_LIGHT_SURFACES_V154_CANONICAL_END */"
    if text.count(start) != 1 or text.count(end) != 1:
        raise RuntimeError("V154 Trade Strategy section markers changed")
    a = text.index(start)
    b = text.index(end, a)

    new_strategy = r'''/* --------------------------------------------------------------------------
   TRADE STRATEGY - single Light-theme owner
   -------------------------------------------------------------------------- */

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.terminal > .panel.control-panel.strategy-summary-panel,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .panel-head,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .strategy-summary-list,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel .strategy-summary-list > .strategy-summary-row,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .strategy-summary-list > .strategy-summary-row > div,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .strategy-summary-foot {
  --mf-trading-v61-surface: #ffffff !important;
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel .strategy-summary-row strong {
  color: var(--mf-trading-v61-text, #171717) !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel .strategy-summary-row span {
  color: var(--mf-trading-v61-muted, #737373) !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel .strategy-edit-link {
  background: var(--mf-trading-v61-inset, #ebebeb) !important;
  background-image: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

@media (hover: hover) and (pointer: fine) {
  html[data-theme="light"]
  body.mf-page-trading.mf-trading-terminal
  .strategy-summary-panel .strategy-edit-link:hover {
    background: #e4e4e4 !important;
  }
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel .empty {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
}

'''
    text = text[:a] + new_strategy + text[b:]
    write(path, text)

def cache_bust(path: Path) -> None:
    text = read(path)
    versions = {
        "trading.css": "trade-strategy-canonical-v1-20260909",
        "trading-light-polish-v61.css": "trade-strategy-cleanup-v1-20260909",
        "trading-visual-hierarchy-v67.css": "trade-strategy-cleanup-v1-20260909",
        "memeflow-trading-white-surfaces-v154.css": "trade-strategy-cleanup-v1-20260909",
    }
    for filename, version in versions.items():
        pattern = re.compile(rf'(<link\s+rel="stylesheet"\s+href="/{re.escape(filename)}\?v=)[^"]+(">)')
        text, n = pattern.subn(rf'\g<1>{version}\2', text, count=1)
        if n != 1:
            raise RuntimeError(f"cache-bust link not found exactly once: {filename}")
    write(path, text)

def css_braces_ok(path: Path) -> bool:
    text = read(path)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return text.count("{") == text.count("}")

def validate() -> None:
    css = read(APP / "trading.css")
    if css.count("MEMEFLOW TRADE STRATEGY - CANONICAL PRESENTATION V1") != 1:
        raise RuntimeError("canonical Trade Strategy owner count != 1")
    if "MEMEFLOW_RESTORE_COMPACT_TRADE_STRATEGY_V1" in css:
        raise RuntimeError("legacy Trade Strategy V1 marker remains")

    v61 = read(APP / "trading-light-polish-v61.css")
    for bad in (".strategy-summary-row", ".strategy-edit-link", "MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153"):
        if bad in v61:
            raise RuntimeError(f"V61 still owns Trade Strategy: {bad}")

    v67 = read(APP / "trading-visual-hierarchy-v67.css")
    start_v71 = "/* ==========================================================================\n   MOBILE DENSITY FLOW V71"
    pre_v71 = v67[:v67.index(start_v71)]
    for bad in (".strategy-summary-panel", ".strategy-head-actions", ".strategy-edit-link"):
        if bad in pre_v71:
            raise RuntimeError(f"V67 pre-V71 still owns Strategy presentation: {bad}")

    _, _, r109 = marker_region(
        v67,
        "/* ==========================================================================\n   MEMEFLOW_TRADING_DARK_SURFACE_BRIDGE_V109",
        "/* MEMEFLOW_TRADING_DARK_SURFACE_BRIDGE_V109_END */",
        "validate V109",
    )
    for bad in (".strategy-summary-row", ".strategy-edit-link"):
        if bad in r109:
            raise RuntimeError(f"V109 still owns Strategy presentation: {bad}")

    _, _, r125 = marker_region(
        v67,
        "/* ==========================================================================\n   MEMEFLOW TRADING FLAT INNER SURFACES V125",
        "/* MEMEFLOW_TRADING_FLAT_INNER_SURFACES_V125_END */",
        "validate V125",
    )
    if ".strategy-summary-panel" in r125:
        raise RuntimeError("V125 still owns Strategy presentation")

    v154 = read(APP / "memeflow-trading-white-surfaces-v154.css")
    if v154.count("TRADE STRATEGY - single Light-theme owner") != 1:
        raise RuntimeError("V154 Trade Strategy Light owner count != 1")

    for path in (
        APP / "trading.css",
        APP / "trading-light-polish-v61.css",
        APP / "trading-visual-hierarchy-v67.css",
        APP / "memeflow-trading-white-surfaces-v154.css",
    ):
        if not css_braces_ok(path):
            raise RuntimeError(f"CSS brace balance failed: {path.relative_to(ROOT)}")
        data = path.read_bytes()
        if not data.endswith(b"\n") or data.endswith(b"\n\n"):
            raise RuntimeError(f"EOF normalization failed: {path.relative_to(ROOT)}")

    diff = run(["git", "diff", "--check"], cwd=ROOT)
    if diff.returncode != 0:
        raise RuntimeError("git diff --check failed:\n" + diff.stdout + diff.stderr)

for p in TARGETS:
    if not p.is_file():
        raise SystemExit(f"ABORT: missing {p.relative_to(ROOT)}")

if not SELFTEST:
    head = run(["git", "rev-parse", "HEAD"], cwd=ROOT)
    if head.returncode != 0:
        raise SystemExit("ABORT: cannot read Git HEAD")
    actual_head = head.stdout.strip()
    if actual_head != EXPECTED_HEAD:
        raise SystemExit(
            f"ABORT: Git HEAD is {actual_head}, expected {EXPECTED_HEAD}. No files were changed."
        )

    for rel, expected in EXPECTED_BLOBS.items():
        actual = git_blob(ROOT / rel)
        if actual != expected:
            raise SystemExit(
                f"ABORT: {rel} differs from committed baseline "
                f"(blob {actual}, expected {expected}). No files were changed."
            )

    for staged_flag in ([], ["--cached"]):
        p = run(["git", "diff", "--quiet", *staged_flag, "HEAD", "--", *TARGET_RELS], cwd=ROOT)
        if p.returncode != 0:
            raise SystemExit(
                "ABORT: one or more Trade Strategy target files already have "
                "local/staged changes. No files were changed."
            )

stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
BACKUP = ROOT / ".memeflow-backups" / f"trade-strategy-style-cleanup-{stamp}"
BACKUP.mkdir(parents=True, exist_ok=False)

for src in TARGETS:
    rel = src.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

def restore_all() -> None:
    for dst in TARGETS:
        rel = dst.relative_to(ROOT)
        src = BACKUP / rel
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    print(f"ROLLBACK COMPLETE: restored original files from {BACKUP}")

try:
    remove_strategy_restore_block(APP / "trading.css")
    clean_v61(APP / "trading-light-polish-v61.css")
    clean_v67(APP / "trading-visual-hierarchy-v67.css")
    clean_v154(APP / "memeflow-trading-white-surfaces-v154.css")
    cache_bust(APP / "trading.html")
    validate()

    rollback = BACKUP / "ROLLBACK.sh"
    rollback.write_text(
        '''#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BACKUP="$(cd "$(dirname "$0")" && pwd)"
for f in \
  memeflow-app/trading.css \
  memeflow-app/trading-light-polish-v61.css \
  memeflow-app/trading-visual-hierarchy-v67.css \
  memeflow-app/memeflow-trading-white-surfaces-v154.css \
  memeflow-app/trading.html
do
  mkdir -p "$ROOT/$(dirname "$f")"
  cp "$BACKUP/$f" "$ROOT/$f"
done
echo "Trade Strategy rollback complete."
git -C "$ROOT" diff --check
git -C "$ROOT" status --short
''',
        encoding="utf-8",
    )
    rollback.chmod(0o755)

    print("✅ TRADE STRATEGY CLEANUP INSTALLED SUCCESSFULLY")
    print(f"Project:  {ROOT}")
    print(f"Backup:   {BACKUP}")
    print(f"Rollback: {rollback}")
    print("Validation: exact baseline Git HEAD/blob gate = OK" if not SELFTEST else "Validation: self-test baseline gate = OK")
    print("Validation: git diff --check = OK")
    print("Validation: CSS braces / EOF = OK")
    print("Validation: one canonical Trade Strategy presentation owner = OK")
    print("Validation: V61/V153 Trade Strategy ownership removed = OK")
    print("Validation: V67 V70/V109/V125 Trade Strategy presentation ownership removed = OK")
    print("Validation: V154 is the single Light-theme Trade Strategy owner = OK")
    print("")
    print("Changed files:")
    subprocess.run(["git", "status", "--short"], cwd=ROOT, check=False)
    print("")
    print("After visual check, commit with:")
    print('git add memeflow-app && git commit -m "refactor(trading): canonicalize Trade Strategy styles" && git push')
    print("")
    print("Rollback if needed:")
    print(f'bash "{rollback}"')

except Exception as exc:
    print(f"❌ INSTALL FAILED: {exc}")
    print("Automatic rollback is running. No partial Trade Strategy cleanup will remain.")
    restore_all()
    sys.exit(1)
