#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
V36_MARKER = "MEMEFLOW_CHART_AXIS_POLISH_V36"

def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)

def replace_once(src, old, new, label):
    count = src.count(old)
    if count != 1:
        fail(f"{label}: expected exactly 1 anchor, found {count}")
    return src.replace(old, new, 1)

root = Path.cwd()
app = root / "memeflow-app"
if not app.is_dir() and root.name == "memeflow-app":
    app = root
if not app.is_dir():
    fail("memeflow-app not found. Run this from the existing Replit workspace Shell.")

try:
    origin = subprocess.check_output(
        ["git", "config", "--get", "remote.origin.url"],
        cwd=root,
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
except Exception:
    origin = ""

if origin and EXPECTED_REPO_FRAGMENT not in origin:
    fail(f"Unexpected git origin: {origin}")

js_path = app / "trading.js"
css_path = app / "trading.css"
html_path = app / "trading.html"

for p in (js_path, css_path, html_path):
    if not p.is_file():
        fail(f"Missing required file: {p}")

js = js_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")
originals = {js_path: js, css_path: css, html_path: html}
changed = False

old_gutter = """function chartRightGutterV32(){
  // V34: this gutter is shared by ordinary Y-axis numbers and
  // LIVE / ENTRY / SL / TP1 / TP2 axis markers.
  if(state.chartMetric==='marketCap'){
    return window.innerWidth<700 ? 88 : 100;
  }
  return window.innerWidth<700 ? 116 : 128;
}"""

new_gutter = """function chartRightGutterV32(){
  // V36: polished rail geometry. Keep axis markers integrated, but reduce
  // wasted right-side space so the PRICE / MARKET CAP rail looks tighter.
  if(state.chartMetric==='marketCap'){
    return window.innerWidth<700 ? 82 : 92;
  }
  return window.innerWidth<700 ? 102 : 112;
}"""

if "polished rail geometry" not in js:
    js = replace_once(js, old_gutter, new_gutter, "chartRightGutterV32 V36")
    changed = True

old_left = """  rail.style.left=`${Math.max(0,width-gutter+2)}px`;
  rail.style.right='2px';"""
new_left = """  rail.style.left=`${Math.max(0,width-gutter+8)}px`;
  rail.style.right='0px';"""
if "width-gutter+8" not in js:
    js = replace_once(js, old_left, new_left, "axis rail left/right V36")
    changed = True

old_gap = "  const gap=window.innerWidth<700 ? 18 : 20;"
new_gap = "  const gap=window.innerWidth<700 ? 14 : 16;"
if old_gap in js and new_gap not in js:
    js = js.replace(old_gap, new_gap, 1)
    changed = True

old_css_start = "/* ===== MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */"
old_css_end = "/* ===== /MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */"
start = css.find(old_css_start)
end = css.find(old_css_end)
if start < 0 or end < 0:
    fail("Could not find V34 axis-rail CSS block. Install V34/V35 first.")
end += len(old_css_end)

new_css_block = r"""/* ===== MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */
body.mf-page-trading.mf-trading-terminal .chart-axis-rail-v34{
  position:absolute;
  top:0;
  bottom:0;
  z-index:5;
  overflow:visible;
  pointer-events:none;
  contain:layout style;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34{
  --mf-level-color:#91a6b0;
  position:absolute;
  left:auto;
  right:0;
  width:max-content;
  max-width:100%;
  box-sizing:border-box;
  min-height:15px;
  padding:0 5px;
  display:inline-flex;
  align-items:center;
  justify-content:flex-end;
  gap:4px;
  transform:translateY(-50%);
  border:0.8px solid color-mix(in srgb,var(--mf-level-color) 62%,transparent);
  border-left-width:1.4px;
  border-radius:3px;
  background:rgba(4,8,10,.78);
  white-space:nowrap;
  overflow:hidden;
  box-shadow:none;
  font-family:"IBM Plex Mono",monospace;
  font-size:7.2px;
  line-height:1;
  letter-spacing:0;
  backdrop-filter:blur(2px);
  -webkit-backdrop-filter:blur(2px);
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34::before{
  content:"";
  position:absolute;
  left:-5px;
  top:50%;
  width:5px;
  height:1px;
  transform:translateY(-50%);
  background:var(--mf-level-color);
  opacity:.78;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34 span{
  flex:0 0 auto;
  color:var(--mf-level-color);
  font-weight:780;
  opacity:.96;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34 strong{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  color:#eef3f5;
  font-weight:620;
  text-align:right;
  opacity:.96;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live{
  border-color:rgba(245,196,81,.72);
  background:rgba(245,196,81,.17);
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live span{
  color:#f5c451;
  font-weight:820;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live strong{
  color:#fff4ce;
  font-weight:700;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34{
  background:rgba(255,255,255,.88);
  box-shadow:none;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34 strong{
  color:#233744;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live{
  background:rgba(245,196,81,.20);
  border-color:rgba(201,154,29,.72);
}

@media (max-width:700px){
  body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34{
    min-height:14px;
    padding-left:4px;
    padding-right:4px;
    gap:3px;
    font-size:6.9px;
    border-radius:3px;
  }
}
/* ===== /MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */"""

if "font-size:7.2px;" not in css:
    css = css[:start] + new_css_block + css[end:]
    changed = True

if "chart-axis-polish-v36-20260928" not in html:
    replaced = False
    for old in (
        "real-entry-only-v35-20260928",
        "chart-axis-rail-v34-20260928",
        "chart-level-integration-v33-20260927",
    ):
        if old in html:
            html = html.replace(old, "chart-axis-polish-v36-20260928")
            replaced = True
    if not replaced:
        fail("Could not find trading cache-version anchor in trading.html")
    changed = True

if V36_MARKER not in html:
    html += f"\n<!-- {V36_MARKER} -->\n"
    changed = True

if not changed:
    print("\n[OK] V36 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-chart-axis-polish-v36-backup-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=False)

for p, content in originals.items():
    rel = p.relative_to(root) if root in p.parents else Path(p.name)
    target = backup_dir / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

js_path.write_text(js, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

try:
    subprocess.run(["node", "--check", str(js_path)], cwd=root, check=True)
except FileNotFoundError:
    print("[WARN] node is unavailable; JS syntax check skipped.")
except subprocess.CalledProcessError:
    fail("node --check failed. Restore from backup: " + str(backup_dir))

try:
    subprocess.run(
        [
            "git", "diff", "--check", "--",
            str(js_path.relative_to(root)),
            str(css_path.relative_to(root)),
            str(html_path.relative_to(root)),
        ],
        cwd=root,
        check=True,
    )
except Exception:
    print("[WARN] git diff --check could not run.")

print("\n[OK] MEMEFLOW CHART AXIS POLISH V36 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV36 visual changes:")
print("  • Right rail markers are thinner, smaller, and cleaner.")
print("  • LIVE / ENTRY / SL / TP pills no longer look like oversized blocks.")
print("  • Right-side gutter is tightened so MARKET CAP / PRICE looks less offset.")
print("  • Marker spacing is reduced for a denser, cleaner rail.")
print("  • LIVE highlight becomes subtler and more premium.")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
print(
    'git add memeflow-app/trading.js memeflow-app/trading.css memeflow-app/trading.html && '
    'git commit -m "Polish chart axis rail layout and styling" && git push'
)
