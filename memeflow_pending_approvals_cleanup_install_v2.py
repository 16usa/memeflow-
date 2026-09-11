#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import shutil
import subprocess
import time
import secrets
from pathlib import Path

EXPECTED_HEAD = "4b18f7ea9e21e2c4bb555c72edc40caa3f133ff4"
EXPECTED_BLOBS = {
    "memeflow-app/trading.css": "66b832c17ecd8a259a5ef0c298f5cc7d0f4e5af1",
    "memeflow-app/trading-light-polish-v61.css": "5ef0d6c559bcfa5bcc7b3d35746aec507c4cbad2",
    "memeflow-app/trading-visual-hierarchy-v67.css": "51665ea0070211ab6a8e5b8b1a15c9f8001f8f0e",
    "memeflow-app/memeflow-trading-white-surfaces-v154.css": "b894277123e565ea91c59fe943718a8ad9b69c49",
    "memeflow-app/trading.html": "6f9e8e05ee758f84650e3887d68cd8a43a5e5212",
}
SELFTEST = os.environ.get("MEMEFLOW_INSTALL_SELFTEST") == "1"
ROOT = Path.cwd().resolve() if SELFTEST else Path("/home/runner/workspace").resolve()
BACKUP_ROOT = ROOT / ".memeflow-backups"

TRADING = ROOT / "memeflow-app/trading.css"
V61 = ROOT / "memeflow-app/trading-light-polish-v61.css"
V67 = ROOT / "memeflow-app/trading-visual-hierarchy-v67.css"
V154 = ROOT / "memeflow-app/memeflow-trading-white-surfaces-v154.css"
HTML = ROOT / "memeflow-app/trading.html"
FILES = [TRADING, V61, V67, V154, HTML]

CANONICAL = r'''/* ==========================================================================
   MEMEFLOW PENDING APPROVALS — CANONICAL PRESENTATION V1

   Single component owner for Pending Approvals / Assist Mode presentation.
   Shared global layers may still provide neutral/semantic color tokens.
   Trading / approval behavior and JS are untouched.
   ========================================================================== */

.approvals-panel {
  min-height: 0;
}

.approvals-panel[data-active="true"] {
  border-color: rgba(106, 153, 255, .22);
}

.approval-count {
  flex: 0 0 auto;
  padding: 4px 7px;
  border: 1px solid rgba(111, 154, 172, .14);
  border-radius: 999px;
  color: #738b96;
  font-size: var(--mf-type-micro);
  font-weight: 800;
  letter-spacing: .05em;
  white-space: nowrap;
}

.approval-count[data-active="true"] {
  border-color: rgba(106, 153, 255, .28);
  background: rgba(106, 153, 255, .055);
  color: #8db0ff;
}

.approvals-panel > .approval-list {
  padding: 6px;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

.approvals-panel:not([data-active="true"]) > .approval-list {
  display: none;
}

.approvals-panel:not([data-active="true"]) > .panel-head {
  min-height: 51px;
  border-bottom: 0;
}

.approvals-panel[data-active="true"] > .approval-list {
  display: block;
}

.approvals-panel .approval-list > .empty,
.approvals-panel .approval-list > .approval-empty,
.approvals-panel .approval-empty {
  min-height: 50px !important;
  padding: 12px !important;
  display: grid;
  place-items: center;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: 0 !important;
  border-color: transparent !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  font-size: var(--mf-type-system, 8px) !important;
  color: var(--mf-text-tertiary) !important;
  -webkit-text-size-adjust: none !important;
  text-size-adjust: none !important;
}

.approval-row {
  margin-bottom: 5px;
  padding: 9px;
  display: grid;
  grid-template-columns: minmax(130px, .9fr) minmax(250px, 1.4fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(111, 154, 172, .12);
  border-radius: 9px;
  background: rgba(15, 20, 26, .72);
}

.approval-row:last-child {
  margin-bottom: 0;
}

.approval-main {
  min-width: 0;
}

.approval-main strong {
  display: block;
  overflow: hidden;
  color: #e8f1f5;
  font-size: var(--mf-type-ui);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.approval-main span {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: #58717c;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--mf-type-micro);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.approval-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(48px, 1fr));
  gap: 5px;
}

.approval-stats span {
  min-width: 0;
  padding: 6px 7px;
  border: 1px solid rgba(111, 154, 172, .09);
  border-radius: 7px;
  background: rgba(6, 14, 19, .55);
}

.approval-stats b,
.approval-stats strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.approval-stats b {
  color: #4e6671;
  font-size: var(--mf-type-micro);
  letter-spacing: .08em;
}

.approval-stats strong {
  margin-top: 3px;
  color: #afc0c8;
  font-size: var(--mf-type-micro);
  font-weight: 720;
  font-variant-numeric: tabular-nums;
}

.approval-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.approval-actions button {
  min-height: 31px;
  padding: 0 9px;
  border-radius: 7px;
  font-size: var(--mf-type-micro);
  font-weight: 820;
  white-space: nowrap;
}

.approval-reject {
  border: 1px solid rgba(255, 102, 121, .18);
  background: rgba(255, 102, 121, .035);
  color: #c9858e;
}

.approval-approve {
  border: 1px solid rgba(77, 230, 161, .27);
  background: rgba(77, 230, 161, .065);
  color: #82e7b5;
}

.approval-actions button:disabled {
  cursor: wait;
  opacity: .45;
}

/* Trade-control ASSIST state controls retained unchanged. */
.assist-btn {
  border: 1px solid rgba(106, 153, 255, .22);
  background: rgba(106, 153, 255, .04);
  color: #8caaf0;
}

.assist-btn[data-active="true"] {
  border-color: rgba(106, 153, 255, .40);
  background: rgba(106, 153, 255, .10);
  color: #b4c8ff;
}

.start-btn[data-active="true"] {
  box-shadow: inset 0 0 0 1px rgba(77, 230, 161, .12);
}

.control-actions .pause-btn {
  grid-column: auto;
}

.control-actions .pause-btn[data-active="true"] {
  border-color: rgba(239, 198, 106, .28);
  background: rgba(239, 198, 106, .07);
}

@media (max-width: 820px) {
  .approvals-panel {
    order: 2;
    width: 100%;
  }

  .approvals-panel > .panel-head {
    min-height: 46px !important;
    padding: 8px 10px !important;
    gap: 10px !important;
  }

  .approvals-panel > .panel-head > div:first-child {
    min-width: 0;
    display: flex !important;
    align-items: baseline !important;
    gap: 8px !important;
  }

  .approvals-panel > .panel-head .eyebrow {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .approvals-panel > .panel-head h2 {
    min-width: 0;
    margin: 0 !important;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .approvals-panel > .approval-list {
    padding: 4px 6px 6px !important;
  }

  .approval-row {
    grid-template-columns: 1fr;
    gap: 7px;
  }

  .approval-stats {
    grid-template-columns: repeat(4, 1fr);
  }

  .approval-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .approval-actions button {
    min-height: 34px;
  }

  .approval-count,
  .approval-actions button {
    font-size: 9px !important;
    font-weight: 500 !important;
    -webkit-text-size-adjust: none !important;
    text-size-adjust: none !important;
  }

  .approval-main :where(span, strong),
  .approval-stats :where(b, strong) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .approval-main span,
  .approval-stats b,
  .approval-stats strong {
    font-size: 9px !important;
    font-weight: 500 !important;
    color: var(--mf-text-secondary) !important;
    -webkit-text-size-adjust: none !important;
    text-size-adjust: none !important;
  }
}

@media (max-width: 430px) {
  .approval-stats {
    grid-template-columns: 1fr 1fr;
  }
}

/* MEMEFLOW_PENDING_APPROVALS_CANONICAL_PRESENTATION_V1_END */'''

V94_REPLACEMENT = r'''/* ==========================================================================
   MEMEFLOW_TRADING_SYSTEM_TEXT_RENDER_FIX_V94

   Final rendering contract for the remaining Trade Strategy service message.
   Pending Approvals service-copy ownership moved to trading.css canonical V1.
   ========================================================================== */

html body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel .strategy-summary-foot > #saveState {
  font-size: var(--mf-type-system, 8px) !important;
  color: var(--mf-text-tertiary) !important;
  -webkit-text-size-adjust: none !important;
  text-size-adjust: none !important;
}

/* MEMEFLOW_TRADING_SYSTEM_TEXT_RENDER_FIX_V94_END */'''

V98_REPLACEMENT = r'''/* ==========================================================================
   MEMEFLOW_9PX_KEEP_SEMANTIC_COLORS_V98

   Shared compact typography for non-Approvals Trading components.
   Pending Approvals typography ownership moved to trading.css canonical V1.
   ========================================================================== */

@media (max-width: 820px) {
  html body.mf-page-trading.mf-trading-terminal :where(
    .candidates-panel .tiny-state,
    .candidates-panel .state-dot,
    .copy-trade-badge,
    .strategy-summary-panel .mode-badge,
    .positions-panel .close-position,
    .positions-panel .pnl-summary strong
  ) {
    font-size: 9px !important;
    font-weight: 500 !important;
    -webkit-text-size-adjust: none !important;
    text-size-adjust: none !important;
  }

  html body.mf-page-trading.mf-trading-terminal :where(
    .strategy-summary-panel .strategy-edit-link,
    .bottom-history-panel .trade-log-bottomline,
    .bottom-history-panel .trade-log-time
  ) {
    font-size: 9px !important;
    font-weight: 500 !important;
    color: var(--mf-text-secondary) !important;
    -webkit-text-size-adjust: none !important;
    text-size-adjust: none !important;
  }

  .bottom-history-panel .trade-log-bottomline :where(
    .pnl-positive,
    .pnl-negative
  ) {
    font-size: 9px !important;
    font-weight: 500 !important;
  }
}

/* MEMEFLOW_9PX_KEEP_SEMANTIC_COLORS_V98_END */'''

V125_REPLACEMENT = r'''/* ==========================================================================
   MEMEFLOW TRADING FLAT INNER SURFACES V125

   Chart-only compatibility remainder.
   Pending Approvals flat-surface ownership moved to trading.css canonical V1.
   ========================================================================== */

body.mf-page-trading.mf-trading-terminal
.chart-panel .selected-metrics {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

body.mf-page-trading.mf-trading-terminal
.chart-panel .selected-metrics > div {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

body.mf-page-trading.mf-trading-terminal
.chart-panel .selected-metrics {
  border-top-color: var(--mf-trading-v61-line, var(--line)) !important;
}

body.mf-page-trading.mf-trading-terminal
.chart-panel .selected-metrics > div {
  border-right-color: var(--mf-trading-v61-line, var(--line)) !important;
}

body.mf-page-trading.mf-trading-terminal
.chart-panel .selected-metrics > div:last-child {
  border-right-color: transparent !important;
}

/* MEMEFLOW_TRADING_FLAT_INNER_SURFACES_V125_END */'''

V154_APPROVALS = r'''
/* --------------------------------------------------------------------------
   PENDING APPROVALS — single Light-theme surface owner
   -------------------------------------------------------------------------- */

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.center-stack > .panel.approvals-panel,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.approvals-panel > .panel-head,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.approvals-panel > .approval-list {
  --mf-trading-v61-surface: #ffffff !important;
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.approvals-panel .approval-row {
  background: var(--mf-trading-v61-inset, #ebebeb) !important;
  background-color: var(--mf-trading-v61-inset, #ebebeb) !important;
  background-image: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.approvals-panel .approval-list > .empty,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.approvals-panel .approval-list > .approval-empty,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.approvals-panel .approval-empty {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}
'''

def run(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        list(args),
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=check,
    )

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write(path: Path, text: str) -> None:
    lines = [line.rstrip(" \t") for line in text.splitlines()]
    path.write_text("\n".join(lines).rstrip("\n") + "\n", encoding="utf-8")

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)

def replace_marker_range(text: str, start: str, end: str, replacement: str, label: str) -> str:
    s = text.count(start)
    e = text.count(end)
    if s != 1 or e != 1:
        raise RuntimeError(f"{label}: marker counts start={s}, end={e}")
    i = text.index(start)
    j = text.index(end, i) + len(end)
    return text[:i] + replacement + text[j:]

def css_braces_ok(text: str) -> bool:
    cleaned = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    cleaned = re.sub(r'"(?:\\.|[^"\\])*"', '""', cleaned)
    cleaned = re.sub(r"'(?:\\.|[^'\\])*'", "''", cleaned)
    depth = 0
    for ch in cleaned:
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth < 0:
                return False
    return depth == 0

def gate() -> None:
    for path in FILES:
        if not path.is_file():
            raise RuntimeError(f"missing required file: {path.relative_to(ROOT)}")
    if SELFTEST:
        return
    head = run("git", "rev-parse", "HEAD").stdout.strip()
    if head != EXPECTED_HEAD:
        raise RuntimeError(
            f"Git HEAD mismatch: expected {EXPECTED_HEAD}, got {head}. No files were changed."
        )
    for rel, expected in EXPECTED_BLOBS.items():
        got = run("git", "hash-object", rel).stdout.strip()
        if got != expected:
            raise RuntimeError(
                f"baseline blob mismatch for {rel}: expected {expected}, got {got}. No files were changed."
            )

def make_backup() -> Path:
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup = BACKUP_ROOT / f"pending-approvals-style-cleanup-{stamp}-{secrets.token_hex(3)}"
    backup.mkdir(parents=True, exist_ok=False)
    for path in FILES:
        rel = path.relative_to(ROOT)
        dst = backup / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dst)
    rollback = backup / "ROLLBACK.sh"
    lines = [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        f'ROOT="{ROOT}"',
        f'BACKUP="{backup}"',
    ]
    for path in FILES:
        rel = path.relative_to(ROOT).as_posix()
        lines.append(f'mkdir -p "$ROOT/{Path(rel).parent.as_posix()}"')
        lines.append(f'cp -p "$BACKUP/{rel}" "$ROOT/{rel}"')
    lines += [
        'cd "$ROOT"',
        'git diff --check -- memeflow-app',
        'echo "ROLLBACK COMPLETE"',
    ]
    rollback.write_text("\n".join(lines) + "\n", encoding="utf-8")
    rollback.chmod(0o755)
    return backup

def restore(backup: Path) -> None:
    for path in FILES:
        rel = path.relative_to(ROOT)
        shutil.copy2(backup / rel, path)

def transform_trading() -> None:
    text = read(TRADING)
    text = replace_marker_range(
        text,
        "/* MEMEFLOW_ASSIST_APPROVALS_V1_START */",
        "/* MEMEFLOW_APPROVALS_LAYOUT_V2_END */",
        CANONICAL,
        "trading.css legacy approvals V1/V2",
    )
    write(TRADING, text)

def transform_v61() -> None:
    text = read(V61)
    old = '''/* Approvals are nested actionable cards. */
html[data-theme="light"] body.mf-trading-terminal .approval-row {
  background: var(--mf-trading-v61-inset) !important;
  background-image: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

'''
    text = replace_once(text, old, "", "V61 approval-row ownership")
    old2 = '''html[data-theme="light"] body.mf-trading-terminal :where(.approval-stats, .control-error) {
  box-shadow: none !important;
}'''
    new2 = '''html[data-theme="light"] body.mf-trading-terminal .control-error {
  box-shadow: none !important;
}'''
    text = replace_once(text, old2, new2, "V61 approval-stats ownership")
    write(V61, text)

def transform_v67() -> None:
    text = read(V67)

    old_empty = '''/* Empty approvals remain visible, but stop consuming card-like vertical space. */
body.mf-page-trading.mf-trading-terminal .approvals-panel .approval-empty,
body.mf-page-trading.mf-trading-terminal .approvals-panel .empty {
  min-height: 50px !important;
  padding: 12px !important;
  display: grid;
  place-items: center;
}

'''
    text = replace_once(text, old_empty, "", "V67 old approval empty state")

    approvals_line = "    .approvals-panel,\n"
    n = text.count(approvals_line)
    if n != 5:
        raise RuntimeError(f"V67 shared-header approvals occurrence count changed: {n}")
    text = text.replace(approvals_line, "")

    count_line = "  .approval-count,\n"
    n = text.count(count_line)
    if n != 2:
        raise RuntimeError(f"V67 approval-count flow occurrence count changed: {n}")
    text = text.replace(count_line, "")

    old_list = '''  body.mf-page-trading.mf-trading-terminal .approvals-panel .approval-list {
    padding: 4px 6px 6px !important;
  }

'''
    text = replace_once(text, old_list, "", "V67 approval-list padding")

    old_identity = '''  /* Strategy values and approval identity are dynamic. Keep one-line behavior
     even when server text becomes longer than the examples on screen. */
  body.mf-page-trading.mf-trading-terminal .approval-main :where(span, strong),
  body.mf-page-trading.mf-trading-terminal .approval-stats :where(b, strong) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
'''
    text = replace_once(text, old_identity, "", "V70 approval identity flow")

    text = replace_marker_range(
        text,
        "/* ==========================================================================\n   MEMEFLOW_TRADING_SYSTEM_TEXT_RENDER_FIX_V94",
        "/* MEMEFLOW_TRADING_SYSTEM_TEXT_RENDER_FIX_V94_END */",
        V94_REPLACEMENT,
        "V94 approval system text",
    )
    text = replace_marker_range(
        text,
        "/* ==========================================================================\n   MEMEFLOW_9PX_KEEP_SEMANTIC_COLORS_V98",
        "/* MEMEFLOW_9PX_KEEP_SEMANTIC_COLORS_V98_END */",
        V98_REPLACEMENT,
        "V98 approval typography",
    )

    old_dark = ''':where(.candidate:hover, .candidate.selected, .approval-row) {
  background: var(--mf-dark-surface-2) !important;
  background-image: none !important;
  box-shadow: none !important;
}

html[data-theme="dark"] body.mf-page-trading.mf-trading-terminal
.approval-row {
  border-color: transparent !important;
}'''
    new_dark = ''':where(.candidate:hover, .candidate.selected) {
  background: var(--mf-dark-surface-2) !important;
  background-image: none !important;
  box-shadow: none !important;
}'''
    text = replace_once(text, old_dark, new_dark, "V109 approval-row surface ownership")

    text = replace_marker_range(
        text,
        "/* ==========================================================================\n   MEMEFLOW TRADING FLAT INNER SURFACES V125",
        "/* MEMEFLOW_TRADING_FLAT_INNER_SURFACES_V125_END */",
        V125_REPLACEMENT,
        "V125 Pending Approvals flat surfaces",
    )
    write(V67, text)

def transform_v154() -> None:
    text = read(V154)
    old_owner = '''   Owners in this file:
     - Chart light surfaces / neutral Chart controls / Chart light text
     - Trade strategy light surfaces
'''
    new_owner = '''   Owners in this file:
     - Chart light surfaces / neutral Chart controls / Chart light text
     - Trade strategy light surfaces
     - Pending approvals light surfaces
'''
    text = replace_once(text, old_owner, new_owner, "V154 owners comment")
    marker = "/* MEMEFLOW_TRADING_LIGHT_SURFACES_V154_CANONICAL_END */"
    text = replace_once(text, marker, V154_APPROVALS.rstrip() + "\n\n" + marker, "V154 final marker")
    write(V154, text)

def transform_html() -> None:
    text = read(HTML)
    replacements = {
        "trading.css?v=trade-strategy-canonical-v1-20260909":
            "trading.css?v=pending-approvals-canonical-cleanup-v1-20260909",
        "trading-light-polish-v61.css?v=trade-strategy-cleanup-v1-20260909":
            "trading-light-polish-v61.css?v=pending-approvals-cleanup-v1-20260909",
        "trading-visual-hierarchy-v67.css?v=trade-strategy-cleanup-v1-20260909":
            "trading-visual-hierarchy-v67.css?v=pending-approvals-cleanup-v1-20260909",
        "memeflow-trading-white-surfaces-v154.css?v=trade-strategy-cleanup-v1-20260909":
            "memeflow-trading-white-surfaces-v154.css?v=pending-approvals-cleanup-v1-20260909",
    }
    for old, new in replacements.items():
        text = replace_once(text, old, new, f"HTML cache-bust {old}")
    write(HTML, text)

def validate() -> None:
    for css in [TRADING, V61, V67, V154]:
        text = read(css)
        if not css_braces_ok(text):
            raise RuntimeError(f"CSS brace validation failed: {css.relative_to(ROOT)}")
        if not text.endswith("\n"):
            raise RuntimeError(f"EOF newline missing: {css.relative_to(ROOT)}")

    trading = read(TRADING)
    if trading.count("MEMEFLOW_PENDING_APPROVALS_CANONICAL_PRESENTATION_V1_END") != 1:
        raise RuntimeError("Pending Approvals canonical owner count is not 1")
    for legacy in ("MEMEFLOW_ASSIST_APPROVALS_V1_START", "MEMEFLOW_APPROVALS_LAYOUT_V2_START"):
        if legacy in trading:
            raise RuntimeError(f"legacy Pending Approvals marker remains: {legacy}")

    v61 = read(V61)
    if ".approval-row" in v61 or ".approval-stats" in v61:
        raise RuntimeError("V61 still owns Pending Approvals component presentation")

    v67 = read(V67)
    forbidden = (
        ".approvals-panel",
        "#approvalList",
        ".approval-row",
        ".approval-main :where",
        ".approval-stats :where",
    )
    for token in forbidden:
        if token in v67:
            raise RuntimeError(f"V67 still owns Pending Approvals presentation: {token}")

    for semantic in (
        ".approval-approve",
        ".approval-reject",
        '.approval-count[data-active="true"]',
    ):
        if semantic not in v67:
            raise RuntimeError(f"shared semantic bridge lost: {semantic}")

    v154 = read(V154)
    if "PENDING APPROVALS — single Light-theme surface owner" not in v154:
        raise RuntimeError("V154 Pending Approvals light owner missing")
    if ".approvals-panel .approval-row" not in v154:
        raise RuntimeError("V154 approval-row light surface missing")

    html = read(HTML)
    if "pending-approvals-canonical-cleanup-v1-20260909" not in html:
        raise RuntimeError("trading.css cache-bust was not updated")
    if html.count("pending-approvals-cleanup-v1-20260909") != 3:
        raise RuntimeError("Pending Approvals dependent CSS cache-bust count is not 3")

    diff = run("git", "diff", "--check", "--", "memeflow-app", check=False)
    if diff.returncode != 0:
        raise RuntimeError("git diff --check failed:\n" + diff.stdout.rstrip())

def main() -> int:
    backup = None
    try:
        gate()
        html_preflight = read(HTML)
        current_html_anchors = (
            "trading.css?v=trade-strategy-canonical-v1-20260909",
            "trading-light-polish-v61.css?v=trade-strategy-cleanup-v1-20260909",
            "trading-visual-hierarchy-v67.css?v=trade-strategy-cleanup-v1-20260909",
            "memeflow-trading-white-surfaces-v154.css?v=trade-strategy-cleanup-v1-20260909",
        )
        for anchor in current_html_anchors:
            count = html_preflight.count(anchor)
            if count != 1:
                raise RuntimeError(
                    f"preflight HTML anchor mismatch: {anchor}: expected exactly 1 match, found {count}. No files were changed."
                )
        backup = make_backup()
        transform_trading()
        transform_v61()
        transform_v67()
        transform_v154()
        transform_html()
        validate()

        print("✅ PENDING APPROVALS CLEANUP V2 INSTALLED SUCCESSFULLY")
        print(f"Project:  {ROOT}")
        print(f"Backup:   {backup}")
        print(f"Rollback: {backup / 'ROLLBACK.sh'}")
        print("Validation: exact baseline Git HEAD/blob gate = OK")
        print("Validation: git diff --check = OK")
        print("Validation: CSS braces / EOF = OK")
        print("Validation: one canonical Pending Approvals presentation owner = OK")
        print("Validation: V61/V67 Pending Approvals presentation ownership removed = OK")
        print("Validation: V154 is the single Light-theme Pending Approvals owner = OK")
        print("Validation: shared semantic approval colors preserved = OK")
        print()
        print("Changed files:")
        status = run("git", "status", "--short", "--", "memeflow-app", check=False).stdout.rstrip()
        print(status or "(none)")
        print()
        print("After visual check, commit with:")
        print('git add memeflow-app && git commit -m "refactor(trading): canonicalize Pending Approvals styles" && git push')
        print()
        print("Rollback if needed:")
        print(f'bash "{backup / "ROLLBACK.sh"}"')
        return 0
    except Exception as exc:
        print(f"❌ INSTALL FAILED: {exc}")
        if backup is not None:
            print("Automatic rollback is running. No partial Pending Approvals cleanup will remain.")
            try:
                restore(backup)
                print(f"ROLLBACK COMPLETE: restored original files from {backup}")
            except Exception as rb_exc:
                print(f"⚠️ ROLLBACK FAILED: {rb_exc}")
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
