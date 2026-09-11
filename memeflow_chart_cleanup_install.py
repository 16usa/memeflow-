#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

EXPECTED_HEAD = "7cdc3d249e1c0d6f3ed94706b1a5c19e5a1a6c63"

def find_root() -> Path:
    candidates = []
    try:
        p = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            check=False, capture_output=True, text=True
        )
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
SELFTEST = os.environ.get("MEMEFLOW_INSTALL_SELFTEST") == "1"

TARGETS = [
    APP / "trading.css",
    APP / "trading-light-polish-v61.css",
    APP / "trading-visual-hierarchy-v67.css",
    APP / "memeflow-trading-white-surfaces-v154.css",
    APP / "trading.html",
]
REQUIRED = TARGETS + [APP / "chart-header-geometry-v97.css"]

for path in REQUIRED:
    if not path.exists():
        raise SystemExit(f"ABORT: expected file not found: {path}")

def run(args, **kwargs):
    return subprocess.run(args, cwd=ROOT, text=True, **kwargs)

if not SELFTEST:
    head = run(["git", "rev-parse", "HEAD"], capture_output=True, check=True).stdout.strip()
    if head != EXPECTED_HEAD:
        raise SystemExit(
            f"ABORT: Git HEAD changed. Expected {EXPECTED_HEAD}, got {head}. "
            "Do not apply this Chart patch to a different revision."
        )
    for path in TARGETS:
        rel = str(path.relative_to(ROOT))
        if run(["git", "diff", "--quiet", "--", rel]).returncode != 0:
            raise SystemExit(f"ABORT: tracked file has local changes: {rel}")
        if run(["git", "diff", "--cached", "--quiet", "--", rel]).returncode != 0:
            raise SystemExit(f"ABORT: tracked file has staged changes: {rel}")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / ".memeflow-backups" / f"chart-style-cleanup-{stamp}"
BACKUP.mkdir(parents=True, exist_ok=False)
for src in TARGETS:
    rel = src.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write(path: Path, text: str) -> None:
    # Never introduce diff-check noise while consolidating old generated CSS.
    lines = [line.rstrip(" \t") for line in text.splitlines()]
    path.write_text("\n".join(lines).rstrip("\n") + "\n", encoding="utf-8")

def restore_all() -> None:
    for dst in TARGETS:
        rel = dst.relative_to(ROOT)
        src = BACKUP / rel
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    print(f"ROLLBACK COMPLETE: restored original files from {BACKUP}")

def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match in {path.name}, found {count}")
    write(path, text.replace(old, new, 1))

def remove_once(path: Path, old: str, label: str) -> None:
    replace_once(path, old, "", label)

def replace_between(path: Path, start: str, end: str, replacement: str, label: str) -> None:
    text = read(path)
    if text.count(start) != 1:
        raise RuntimeError(f"{label}: start marker count is {text.count(start)} in {path.name}")
    a = text.find(start)
    b = text.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f"{label}: end marker not found in {path.name}")
    if text.find(end, b + len(end)) >= 0:
        # End can exist elsewhere for generic selectors; only enforce uniqueness
        # for comment markers.
        if end.lstrip().startswith("/*"):
            raise RuntimeError(f"{label}: end marker is not unique in {path.name}")
    write(path, text[:a] + replacement + text[b:])

def replace_link_version(path: Path, filename: str, version: str) -> None:
    text = read(path)
    pattern = rf'(<link\s+rel="stylesheet"\s+href="/{re.escape(filename)}\?v=)[^"]+(">)'
    text2, count = re.subn(pattern, rf'\1{version}\2', text, count=1)
    if count != 1:
        raise RuntimeError(f"cache-bust link not found exactly once: {filename}")
    write(path, text2)

def css_braces_ok(path: Path) -> bool:
    text = read(path)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return text.count("{") == text.count("}")

try:
    trading = APP / "trading.css"

    # 1) Remove the old pre-Chart timeframe owner.
    remove_once(
        trading,
        """.timeframes button {
  border: 1px solid rgba(111, 154, 172, .045);
  border-radius: 7px;
  background: transparent;
  color: #647d88;
  font-size: var(--mf-type-micro);
  font-weight: 700;
}

.timeframes button.active {
  border-color: rgba(85, 217, 255, .28);
  background: rgba(85, 217, 255, .06);
  color: #b5edfa;
}

""",
        "remove old timeframe base owner",
    )

    # 2) Remove old responsive Chart overrides before adding the canonical block.
    remove_once(
        trading,
        """  .chart-panel { min-height: 0; }
  .token-name-row h1 { max-width: 150px; font-size: var(--mf-type-body); }
  .token-price { font-size: var(--mf-type-body); }
  .token-market,
.token-meta { font-size: var(--mf-type-micro); }
  .chart-wrap { height: 290px; }

  .selected-metrics div {
    min-height: 42px;
    padding: 7px 6px;
  }
  .selected-metrics span { font-size: var(--mf-type-micro); }
  .selected-metrics strong { font-size: var(--mf-type-micro); }

""",
        "remove legacy base mobile Chart overrides",
    )

    remove_once(
        trading,
        """  .chart-wrap { height: 255px; }
  .timeframes { padding: 5px 7px; gap: 3px; }
  .timeframes button { min-width: 30px; font-size: var(--mf-type-micro); }
  .selected-metrics { grid-template-columns: repeat(5, 1fr); }
""",
        "remove legacy narrow Chart overrides",
    )

    # 3) Remove the stacked V30 chart generations as one obsolete chain.
    replace_between(
        trading,
        "/* MEMEFLOW_TRADING_CHART_V30_5",
        "/* MEMEFLOW_COMPACT_TRADING_V4_START */",
        "",
        "remove V30 Chart generation chain",
    )

    # 4) Remove Chart-specific pieces from Compact Trading V4; their winning
    # values are preserved in the canonical Chart block.
    remove_once(
        trading,
        """  .token-name-row { gap: 5px; }
  .token-name-row h1 { max-width: 145px; font-size: var(--mf-type-ui); }
  .decision-badge { padding: 2px 4px; font-size: var(--mf-type-micro); }
  .token-meta { margin-top: 2px; gap: 4px; font-size: var(--mf-type-micro); }
  .price-toggle { min-width: 120px; padding: 4px 0 4px 5px; }
  .token-price { font-size: var(--mf-type-body); }
  .token-market { margin-top: 2px; font-size: var(--mf-type-micro); }

  .timeframes { height: 33px; padding: 4px 7px; gap: 3px; }
  .timeframes button { min-width: 31px; height: 23px; font-size: var(--mf-type-micro); }

  .chart-wrap { height: 330px; }
  .indicator-bar { height: 31px; }
  .indicator-scroll { padding: 0 5px; }
  .indicator-bar button { min-width: 34px; padding: 0 6px; font-size: var(--mf-type-micro); }

  .selected-metrics div { min-height: 38px; padding: 6px 5px; }
  .selected-metrics span { font-size: var(--mf-type-micro); }
  .selected-metrics strong { margin-top: 3px; font-size: var(--mf-type-micro); }

""",
        "remove Compact V4 Chart overrides",
    )

    remove_once(
        trading,
        """@media (max-width: 430px) {
  .chart-wrap { height: 315px; }
}
/* MEMEFLOW_COMPACT_TRADING_V4_END */
""",
        "remove Compact V4 narrow Chart override",
    )
    # Keep the Compact marker so non-Chart rules still have a clean terminator.
    text = read(trading)
    compact_anchor = "/* MEMEFLOW_ASSIST_APPROVALS_V1_START */"
    if compact_anchor not in text:
        raise RuntimeError("Compact V4 end insertion anchor missing")
    text = text.replace(
        compact_anchor,
        "/* MEMEFLOW_COMPACT_TRADING_V4_END */\n\n\n" + compact_anchor,
        1,
    )
    write(trading, text)

    # 5) Replace the original base Chart block with one canonical contract.
    replace_between(
        trading,
        ".chart-panel { min-height: 560px; }",
        ".pnl-summary { text-align: right; }",
        '/* ==========================================================================\n   MEMEFLOW CHART — CANONICAL PRESENTATION V1\n\n   Single owner in trading.css for:\n     - chart panel base geometry\n     - timeframe strip\n     - ECharts host / touch containment / z-index layers\n     - live trade tape\n     - indicator toolbar geometry + touch layer\n     - selected metrics geometry\n\n   Separate intentional owners:\n     - chart-header-geometry-v97.css: selected-token header geometry only\n     - trading-visual-hierarchy-v67.css: OHLC legend visual density only\n     - memeflow-trading-white-surfaces-v154.css: Light-theme Chart surfaces\n   ========================================================================== */\n\n.chart-panel {\n  min-height: 560px;\n}\n\n.chart-head {\n  border-bottom: 1px solid rgba(111, 154, 172, .065);\n}\n\n.token-title {\n  min-width: 0;\n}\n\n.token-avatar {\n  width: 36px;\n  height: 36px;\n  display: grid;\n  place-items: center;\n  flex: 0 0 auto;\n  overflow: hidden;\n  border: 1px solid rgba(111, 154, 172, .18);\n  border-radius: 10px;\n  background: rgba(111, 154, 172, .05);\n  color: #77909c;\n  font-size: var(--mf-type-body);\n  font-weight: 800;\n}\n\n.token-avatar img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n}\n\n.token-name-row {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n}\n\n.token-name-row h1 {\n  max-width: 320px;\n  margin: 0;\n  overflow: hidden;\n  color: #edf5f8;\n  font-size: var(--mf-type-title);\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.decision-badge {\n  padding: 3px 5px;\n  border: 1px solid rgba(111, 154, 172, .15);\n  border-radius: 6px;\n  color: #8ba0aa;\n  font-size: var(--mf-type-micro);\n  font-weight: 800;\n}\n\n.decision-badge.open {\n  color: var(--green);\n  border-color: rgba(77, 230, 161, .24);\n}\n\n.decision-badge.ready {\n  color: var(--yellow);\n  border-color: rgba(239, 198, 106, .23);\n}\n\n.decision-badge.blocked {\n  color: var(--red);\n  border-color: rgba(255, 102, 121, .20);\n}\n\n.decision-badge.watch {\n  color: var(--blue);\n  border-color: rgba(106, 153, 255, .20);\n}\n\n.token-meta {\n  margin-top: 4px;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  color: #526b76;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: var(--mf-type-micro);\n}\n\n.token-meta button {\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: #6c8793;\n  font-size: var(--mf-type-micro);\n}\n\n.price-block {\n  text-align: right;\n}\n\n.price-toggle {\n  min-width: 170px;\n  padding: 6px 0 6px 8px;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: inherit;\n  appearance: none;\n  -webkit-appearance: none;\n  touch-action: manipulation;\n}\n\n.price-toggle:active {\n  background: rgba(85, 217, 255, .035);\n}\n\n.price-toggle:focus-visible {\n  outline: 1px solid rgba(85, 217, 255, .34);\n  outline-offset: 2px;\n}\n\n.price-toggle[data-metric="marketCap"] .token-price {\n  letter-spacing: -.015em;\n}\n\n.token-price {\n  font-size: var(--mf-type-title);\n  font-weight: 760;\n  font-variant-numeric: tabular-nums;\n}\n\n.token-market {\n  margin-top: 4px;\n  color: #647d88;\n  font-size: var(--mf-type-micro);\n}\n\n.timeframes {\n  height: 39px;\n  padding: 6px 10px;\n  display: flex;\n  align-items: center;\n  gap: 5px;\n  border-bottom: 1px solid rgba(111, 154, 172, .05);\n}\n\n.timeframes button {\n  min-width: 35px;\n  height: 25px;\n  border: 1px solid rgba(111, 154, 172, .045);\n  border-radius: 7px;\n  background: transparent;\n  color: #647d88;\n  font-size: var(--mf-type-micro);\n  font-weight: 700;\n}\n\n.timeframes button.active {\n  border-color: rgba(85, 217, 255, .28);\n  background: rgba(85, 217, 255, .06);\n  color: #b5edfa;\n}\n\n.chart-wrap {\n  position: relative;\n  height: 455px;\n  overflow: hidden;\n  isolation: isolate;\n  z-index: 0;\n  background-size: 100% 64px, 85px 100%;\n}\n\n#chartCanvas {\n  position: absolute;\n  inset: 0;\n  z-index: 1;\n  display: block;\n  width: 100%;\n  height: 100%;\n  overflow: hidden !important;\n  touch-action: pan-y;\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n#chartCanvas > div {\n  width: 100% !important;\n  height: 100% !important;\n  overflow: hidden !important;\n}\n\n#chartCanvas canvas {\n  outline: 0;\n}\n\n.chart-empty {\n  position: absolute;\n  inset: 0;\n  z-index: 7;\n  display: grid;\n  place-content: center;\n  gap: 6px;\n  text-align: center;\n  pointer-events: none;\n}\n\n.chart-empty strong {\n  color: #728a95;\n  font-size: 12px;\n}\n\n.chart-empty span {\n  max-width: 340px;\n  color: #425963;\n  font-size: var(--mf-type-micro);\n  line-height: 1.5;\n}\n\n.chart-legend {\n  position: absolute;\n  top: 8px;\n  left: 10px;\n  z-index: 6;\n  max-width: calc(100% - 24px);\n  display: flex;\n  flex-wrap: wrap;\n  gap: 7px;\n  pointer-events: none;\n}\n\n.chart-legend span {\n  padding: 3px 5px;\n  border: 1px solid rgba(111, 154, 172, .04);\n  border-radius: 5px;\n  background: rgba(15, 20, 26, .88);\n  color: #748d98;\n  font-size: var(--mf-type-micro);\n}\n\n.chart-credit {\n  position: absolute;\n  right: 8px;\n  bottom: 5px;\n  z-index: 4;\n  color: rgba(111, 154, 172, .42);\n  font-size: var(--mf-type-micro);\n  line-height: 1;\n  text-decoration: none;\n}\n\n.chart-credit:hover {\n  color: rgba(181, 237, 250, .72);\n}\n\n.live-trade-tape {\n  position: absolute;\n  z-index: 6;\n  left: 9px;\n  top: 88px;\n  width: 92px;\n  display: grid;\n  gap: 5px;\n  pointer-events: none;\n  contain: layout paint;\n}\n\n.live-tape-row {\n  width: max-content;\n  max-width: 90px;\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  opacity: .84;\n  transform: translate3d(0, 0, 0);\n  transition:\n    opacity .38s ease,\n    transform .38s ease;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: var(--mf-type-ui);\n  line-height: 1;\n  text-shadow: 0 1px 10px rgba(0, 0, 0, .9);\n}\n\n.live-tape-row strong {\n  font-weight: 820;\n  font-variant-numeric: tabular-nums;\n}\n\n.live-tape-row.buy {\n  color: rgba(77, 230, 161, .82);\n}\n\n.live-tape-row.sell {\n  color: rgba(255, 102, 121, .78);\n}\n\n.live-tape-arrow {\n  width: 9px;\n  text-align: center;\n  font-size: var(--mf-type-micro);\n}\n\n.live-tape-row.leaving {\n  opacity: 0;\n  transform: translate3d(-5px, -2px, 0);\n}\n\n.indicator-bar {\n  position: relative;\n  z-index: 20;\n  isolation: isolate;\n  height: 38px;\n  display: flex;\n  align-items: center;\n  overflow: hidden;\n  border-top: 1px solid rgba(111, 154, 172, .08);\n  pointer-events: auto;\n  -webkit-transform: translateZ(0);\n  transform: translateZ(0);\n}\n\n.indicator-scroll {\n  position: relative;\n  z-index: 1;\n  width: 100%;\n  height: 100%;\n  padding: 0 8px;\n  display: flex;\n  align-items: stretch;\n  gap: 1px;\n  overflow-x: auto;\n  overflow-y: hidden;\n  overscroll-behavior-x: contain;\n  scrollbar-width: none;\n  -webkit-overflow-scrolling: touch;\n  pointer-events: auto;\n}\n\n.indicator-scroll::-webkit-scrollbar {\n  display: none;\n}\n\n.indicator-bar button {\n  position: relative;\n  z-index: 2;\n  flex: 0 0 auto;\n  min-width: 38px;\n  height: 100%;\n  padding: 0 8px;\n  border: 0;\n  border-radius: 0;\n  background: transparent;\n  color: #617985;\n  white-space: nowrap;\n  font-size: var(--mf-type-micro);\n  font-weight: 690;\n  line-height: 1;\n  touch-action: manipulation;\n  pointer-events: auto;\n  -webkit-tap-highlight-color: transparent;\n}\n\n.indicator-bar button::after {\n  content: "";\n  position: absolute;\n  left: 8px;\n  right: 8px;\n  bottom: 0;\n  height: 2px;\n  border-radius: 2px 2px 0 0;\n  background: transparent;\n}\n\n.indicator-bar button:hover {\n  color: #91a7b1;\n}\n\n.indicator-bar button.active,\n.indicator-bar button[aria-pressed="true"] {\n  color: #d5e6ed;\n  background: rgba(85, 217, 255, .025);\n}\n\n.indicator-bar button.active::after,\n.indicator-bar button[aria-pressed="true"]::after {\n  background: #55d9ff;\n}\n\n.indicator-divider {\n  flex: 0 0 1px;\n  width: 1px;\n  height: 16px;\n  margin: auto 5px;\n  background: rgba(111, 154, 172, .14);\n}\n\n.selected-metrics {\n  display: grid;\n  grid-template-columns: repeat(5, 1fr);\n  border-top: 1px solid rgba(111, 154, 172, .055);\n}\n\n.selected-metrics div {\n  min-height: 48px;\n  padding: 8px 10px;\n  border-right: 1px solid rgba(111, 154, 172, .045);\n}\n\n.selected-metrics div:last-child {\n  border-right: 0;\n}\n\n.selected-metrics span {\n  display: block;\n  color: #526a75;\n  font-size: var(--mf-type-micro);\n}\n\n.selected-metrics strong {\n  display: block;\n  margin-top: 4px;\n  color: #c9d7dd;\n  font-size: var(--mf-type-ui);\n  font-variant-numeric: tabular-nums;\n}\n\n@media (max-width: 820px) {\n  .chart-panel {\n    min-height: 0;\n  }\n\n  .chart-wrap {\n    height: 330px;\n  }\n\n  .timeframes {\n    height: 33px;\n    padding: 4px 7px;\n    gap: 3px;\n  }\n\n  .timeframes button {\n    min-width: 31px;\n    height: 23px;\n  }\n\n  .indicator-bar {\n    height: 31px;\n  }\n\n  .indicator-scroll {\n    padding: 0 5px;\n  }\n\n  .indicator-bar button {\n    min-width: 34px;\n    padding: 0 6px;\n  }\n\n  .selected-metrics div {\n    min-height: 38px;\n    padding: 6px 5px;\n  }\n}\n\n@media (max-width: 760px) {\n  .live-trade-tape {\n    top: 86px;\n    left: 8px;\n    width: 84px;\n    gap: 4px;\n  }\n\n  .live-tape-row {\n    max-width: 82px;\n    font-size: var(--mf-type-meta);\n  }\n}\n\n@media (max-width: 430px) {\n  .chart-wrap {\n    height: 315px;\n  }\n\n  .timeframes {\n    overflow-x: auto;\n    scrollbar-width: none;\n  }\n\n  .timeframes::-webkit-scrollbar {\n    display: none;\n  }\n\n  .indicator-bar button {\n    min-width: 34px;\n    padding: 0 6px;\n  }\n\n  .indicator-divider {\n    margin-left: 3px;\n    margin-right: 3px;\n  }\n}\n\n/* MEMEFLOW_CHART_CANONICAL_PRESENTATION_V1_END */\n\n',
        "replace base Chart block with canonical contract",
    )

    # 6) V61 becomes shared Light tokens only; it no longer owns Chart.
    write(APP / "trading-light-polish-v61.css", '/* MEMEFLOW Trading Terminal Light Polish V61\n   Light theme only.\n   Shared Trading Terminal neutral tokens and non-Chart surfaces.\n   Chart light-theme ownership is intentionally delegated to\n   memeflow-trading-white-surfaces-v154.css.\n*/\nhtml[data-theme="light"] body.mf-trading-terminal {\n  --mf-trading-v61-canvas: #ffffff;\n  --mf-trading-v61-surface: #f5f5f5;\n  --mf-trading-v61-inset: #ebebeb;\n  --mf-trading-v61-line: rgba(23, 23, 23, .075);\n  --mf-trading-v61-line-strong: rgba(23, 23, 23, .11);\n  --mf-trading-v61-text: #171717;\n  --mf-trading-v61-muted: #737373;\n\n  background: var(--mf-trading-v61-canvas) !important;\n  background-image: none !important;\n  color: var(--mf-trading-v61-text) !important;\n}\n\nhtml[data-theme="light"] body.mf-trading-terminal .shell,\nhtml[data-theme="light"] body.mf-trading-terminal .terminal,\nhtml[data-theme="light"] body.mf-trading-terminal .center-stack {\n  background: transparent !important;\n  background-image: none !important;\n}\n\n/* Shared panel surfaces. Chart/Candidates/Open Positions have component owners. */\nhtml[data-theme="light"] body.mf-trading-terminal .terminal > .panel:not(.candidates-panel):not(.chart-panel),\nhtml[data-theme="light"] body.mf-trading-terminal .center-stack > .panel:not(.positions-panel):not(.chart-panel) {\n  background: var(--mf-trading-v61-surface) !important;\n  background-image: none !important;\n  border-color: transparent !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] body.mf-trading-terminal .panel-head {\n  border-color: var(--mf-trading-v61-line) !important;\n}\n\nhtml[data-theme="light"] body.mf-trading-terminal .strategy-summary-row,\nhtml[data-theme="light"] body.mf-trading-terminal .empty {\n  background: var(--mf-trading-v61-inset) !important;\n  background-image: none !important;\n  border-color: transparent !important;\n  box-shadow: none !important;\n}\n\n/* Approvals are nested actionable cards. */\nhtml[data-theme="light"] body.mf-trading-terminal .approval-row {\n  background: var(--mf-trading-v61-inset) !important;\n  background-image: none !important;\n  border-color: transparent !important;\n  box-shadow: none !important;\n}\n\n/* Shared non-Chart controls. */\nhtml[data-theme="light"] body.mf-trading-terminal .strategy-edit-link,\nhtml[data-theme="light"] body.mf-trading-terminal .wallet-btn {\n  background: var(--mf-trading-v61-inset) !important;\n  background-image: none !important;\n  border-color: transparent !important;\n  box-shadow: none !important;\n}\n\n@media (hover: hover) and (pointer: fine) {\n  html[data-theme="light"] body.mf-trading-terminal .strategy-edit-link:hover,\n  html[data-theme="light"] body.mf-trading-terminal .wallet-btn:hover {\n    background: #e4e4e4 !important;\n  }\n}\n\n/* Shared non-Chart neutral text. */\nhtml[data-theme="light"] body.mf-trading-terminal .panel-head h2,\nhtml[data-theme="light"] body.mf-trading-terminal .candidate-name strong,\nhtml[data-theme="light"] body.mf-trading-terminal .strategy-summary-row strong {\n  color: var(--mf-trading-v61-text) !important;\n}\n\nhtml[data-theme="light"] body.mf-trading-terminal .candidate-name span,\nhtml[data-theme="light"] body.mf-trading-terminal .candidate-bottom,\nhtml[data-theme="light"] body.mf-trading-terminal .strategy-summary-row span,\nhtml[data-theme="light"] body.mf-trading-terminal .trade-log-hint {\n  color: var(--mf-trading-v61-muted) !important;\n}\n\nhtml[data-theme="light"] body.mf-trading-terminal :where(.approval-stats, .control-error) {\n  box-shadow: none !important;\n}\n\n/* MEMEFLOW_TRADING_LIGHT_POLISH_V61_END */\n\n/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153\n   Strategy-only compatibility contract.\n   Chart ownership was removed during Chart canonicalization.\n*/\nhtml[data-theme="light"] body.mf-trading-terminal .strategy-summary-panel {\n  background: #ffffff !important;\n  background-color: #ffffff !important;\n  background-image: none !important;\n}\n\nhtml[data-theme="light"] body.mf-trading-terminal\n.strategy-summary-panel .strategy-summary-row {\n  background: #ffffff !important;\n  background-color: #ffffff !important;\n  background-image: none !important;\n}\n\n/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153_END */\n\n/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153_1 */\nhtml[data-theme="light"] body.mf-trading-terminal\n.terminal > .panel.control-panel.strategy-summary-panel {\n  background: #ffffff !important;\n  background-color: #ffffff !important;\n  background-image: none !important;\n}\n/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153_1_END */\n')

    # 7) V67 keeps only its intentional legend density ownership; V97 already
    # owns selected-token header geometry.
    v67 = APP / "trading-visual-hierarchy-v67.css"
    replace_between(
        v67,
        "/* Keep the token value block calm and predictable without changing data. */",
        "/* OHLC / candles legend: same information, less \"mini input box\" noise. */",
        "",
        "remove obsolete V67 Chart-header fallback",
    )
    replace_between(
        v67,
        "/* Narrow phone: reserve enough width for PRICE / MC / BP metadata to stay calm. */",
        "/* ==========================================================================\n   SINGLE-LINE FLOW STABILITY V70",
        """/* Narrow phone: keep only OHLC legend containment here. */
@media (max-width: 430px) {
  body.mf-page-trading.mf-trading-terminal .chart-legend {
    left: 9px !important;
    max-width: calc(100% - 18px) !important;
  }
}


""",
        "remove obsolete V67 header geometry",
    )
    text = read(v67).replace(
        "     - top price/meta containment\n",
        "",
        1,
    )
    write(v67, text)

    # 8) V154 is the one late Light-theme Chart owner.
    write(APP / "memeflow-trading-white-surfaces-v154.css", '/* ==========================================================================\n   MEMEFLOW TRADING LIGHT SURFACES V154 — CANONICAL\n\n   LIGHT MODE ONLY.\n\n   Owners in this file:\n     - Chart light surfaces / neutral Chart controls / Chart light text\n     - Trade strategy light surfaces\n\n   Geometry and behavior stay outside this file.\n   ========================================================================== */\n\n/* Outer module canvases. */\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.terminal > .panel.control-panel.strategy-summary-panel,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.center-stack > .panel.chart-panel {\n  --mf-trading-v61-surface: #ffffff !important;\n  background: #ffffff !important;\n  background-color: #ffffff !important;\n  background-image: none !important;\n}\n\n/* --------------------------------------------------------------------------\n   CHART — one Light-theme owner\n   -------------------------------------------------------------------------- */\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel > .chart-head,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel > .timeframes,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel > .chart-wrap,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel #chartCanvas,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel > .indicator-bar,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel > .indicator-bar > .indicator-scroll,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel > .selected-metrics,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel > .selected-metrics > div {\n  background: #ffffff !important;\n  background-color: #ffffff !important;\n  background-image: none !important;\n}\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel > .chart-head,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel > .timeframes,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel > .indicator-bar {\n  border-color: var(--mf-trading-v61-line, rgba(23, 23, 23, .075)) !important;\n}\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .token-name-row h1,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .token-price,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .selected-metrics strong {\n  color: var(--mf-trading-v61-text, #171717) !important;\n}\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .token-meta,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .token-market,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .selected-metrics span {\n  color: var(--mf-trading-v61-muted, #737373) !important;\n}\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .token-avatar {\n  background: var(--mf-trading-v61-inset, #ebebeb) !important;\n  background-image: none !important;\n  border-color: transparent !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .price-toggle {\n  background: transparent !important;\n  background-color: transparent !important;\n  background-image: none !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .timeframes button:not(.active),\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .indicator-scroll button:not([aria-pressed="true"]) {\n  background: transparent !important;\n  background-color: transparent !important;\n  background-image: none !important;\n  border-color: transparent !important;\n  color: var(--mf-trading-v61-muted, #737373) !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .indicator-scroll button,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .indicator-scroll button[aria-pressed="true"] {\n  background-color: transparent !important;\n  background-image: none !important;\n}\n\n@media (hover: hover) and (pointer: fine) {\n  html[data-theme="light"]\n  body.mf-page-trading.mf-trading-terminal\n  .chart-panel .timeframes button:not(.active):hover,\n  html[data-theme="light"]\n  body.mf-page-trading.mf-trading-terminal\n  .chart-panel .indicator-scroll button:not([aria-pressed="true"]):hover {\n    background: var(--mf-trading-v61-inset, #ebebeb) !important;\n  }\n}\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.chart-panel .chart-empty {\n  background: transparent !important;\n  background-color: transparent !important;\n  background-image: none !important;\n}\n\n/* --------------------------------------------------------------------------\n   TRADE STRATEGY\n   -------------------------------------------------------------------------- */\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.strategy-summary-panel > .panel-head,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.strategy-summary-panel > .strategy-summary-list,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.strategy-summary-panel .strategy-summary-list > .strategy-summary-row,\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.strategy-summary-panel > .strategy-summary-foot {\n  background: #ffffff !important;\n  background-color: #ffffff !important;\n  background-image: none !important;\n}\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.strategy-summary-panel > .strategy-summary-list > .strategy-summary-row > div {\n  background: #ffffff !important;\n  background-color: #ffffff !important;\n  background-image: none !important;\n}\n\nhtml[data-theme="light"]\nbody.mf-page-trading.mf-trading-terminal\n.strategy-summary-panel .empty {\n  background: transparent !important;\n  background-color: transparent !important;\n  background-image: none !important;\n}\n\n/* MEMEFLOW_TRADING_LIGHT_SURFACES_V154_CANONICAL_END */\n')

    # 9) Cache-bust only the files modified by this cleanup.
    html = APP / "trading.html"
    replace_link_version(html, "trading.css", "chart-canonical-cleanup-v1-20260909")
    replace_link_version(html, "trading-light-polish-v61.css", "chart-cleanup-v1-20260909")
    replace_link_version(html, "trading-visual-hierarchy-v67.css", "chart-cleanup-v1-20260909")
    replace_link_version(html, "memeflow-trading-white-surfaces-v154.css", "chart-cleanup-v1-20260909")

    # -----------------------------------------------------------------------
    # Validation
    # -----------------------------------------------------------------------
    css = read(trading)
    if css.count("MEMEFLOW CHART — CANONICAL PRESENTATION V1") != 1:
        raise RuntimeError("canonical Chart owner count is not 1")
    if css.count("MEMEFLOW_CHART_CANONICAL_PRESENTATION_V1_END") != 1:
        raise RuntimeError("canonical Chart end marker count is not 1")
    if "MEMEFLOW_TRADING_CHART_V30_" in css:
        raise RuntimeError("legacy V30 Chart generation marker remains")
    if "\\n" in css:
        raise RuntimeError("literal \\n artifact remains in trading.css")
    for required_token in (
        "height: 455px;",
        "height: 330px;",
        "height: 315px;",
        "z-index: 20;",
        "isolation: isolate;",
        "touch-action: pan-y;",
        "pointer-events: auto;",
    ):
        if required_token not in css:
            raise RuntimeError(f"canonical Chart token missing: {required_token}")

    v61_text = read(APP / "trading-light-polish-v61.css")
    forbidden_v61 = (
        ".chart-wrap",
        "#chartCanvas",
        ".indicator-bar",
        ".timeframes",
        ".chart-head",
        ".token-price",
        ".token-market",
        ".token-meta",
        ".selected-metrics",
        ".price-toggle",
        ".token-avatar",
    )
    for token in forbidden_v61:
        if token in v61_text:
            raise RuntimeError(f"V61 still owns Chart selector: {token}")

    v67_text = read(v67)
    if ".chart-head .price-toggle" in v67_text:
        raise RuntimeError("V67 still overrides Chart header price geometry")
    if ".chart-legend" not in v67_text:
        raise RuntimeError("V67 legend-density contract was lost")

    v154_text = read(APP / "memeflow-trading-white-surfaces-v154.css")
    if v154_text.count("CHART — one Light-theme owner") != 1:
        raise RuntimeError("V154 Chart Light owner missing")
    if "MEMEFLOW TRADING WHITE RESIDUAL SURFACES V155" in v154_text:
        raise RuntimeError("old V155 residual Chart layer remains")
    for token in (
        ".chart-panel > .indicator-bar > .indicator-scroll",
        ".chart-panel .timeframes button:not(.active)",
        ".chart-panel .selected-metrics strong",
    ):
        if token not in v154_text:
            raise RuntimeError(f"V154 Chart contract missing: {token}")

    v97 = read(APP / "chart-header-geometry-v97.css")
    if "MEMEFLOW_CHART_HEADER_ROW_PARITY_V97" not in v97:
        raise RuntimeError("V97 canonical Chart-header contract missing")

    for path in (
        APP / "trading.css",
        APP / "trading-light-polish-v61.css",
        APP / "trading-visual-hierarchy-v67.css",
        APP / "memeflow-trading-white-surfaces-v154.css",
        APP / "chart-header-geometry-v97.css",
    ):
        if not css_braces_ok(path):
            raise RuntimeError(f"CSS brace balance failed: {path.relative_to(ROOT)}")
        data = read(path)
        if not data.endswith("\n") or data.endswith("\n\n"):
            raise RuntimeError(f"CSS EOF normalization failed: {path.relative_to(ROOT)}")

    diff = run(["git", "diff", "--check"], capture_output=True)
    if diff.returncode != 0:
        raise RuntimeError("git diff --check failed:\n" + diff.stdout + diff.stderr)

    rollback = BACKUP / "ROLLBACK.sh"
    rollback.write_text(
        """#!/usr/bin/env bash
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
  cp "$BACKUP/$f" "$ROOT/$f"
done
echo "Chart rollback complete."
git -C "$ROOT" diff --check
git -C "$ROOT" status --short
""",
        encoding="utf-8",
    )
    rollback.chmod(0o755)

    print("")
    print("✅ CHART CLEANUP INSTALLED SUCCESSFULLY")
    print(f"Project:  {ROOT}")
    print(f"Backup:   {BACKUP}")
    print(f"Rollback: {rollback}")
    print("Validation: baseline Git HEAD = OK")
    print("Validation: git diff --check = OK")
    print("Validation: CSS braces / EOF = OK")
    print("Validation: one canonical Chart presentation owner = OK")
    print("Validation: legacy V30 Chart generation chain removed = OK")
    print("Validation: V61 Chart ownership removed = OK")
    print("Validation: V154 is the single Light-theme Chart owner = OK")
    print("Validation: V97 Chart-header geometry preserved = OK")
    print("")
    print("Changed files:")
    run(["git", "status", "--short"], check=False)

except Exception as exc:
    print("")
    print(f"❌ INSTALL FAILED: {exc}")
    print("Automatic rollback is running. No partial Chart cleanup will remain.")
    restore_all()
    sys.exit(1)
