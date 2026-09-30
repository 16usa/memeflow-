#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
V37_MARKER = "MEMEFLOW_CHART_AXIS_FINISH_V37"

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

# --- JS geometry / spacing refinements ---
old_gutter = """function chartRightGutterV32(){
  // V36: polished rail geometry. Keep axis markers integrated, but reduce
  // wasted right-side space so the PRICE / MARKET CAP rail looks tighter.
  if(state.chartMetric==='marketCap'){
    return window.innerWidth<700 ? 82 : 92;
  }
  return window.innerWidth<700 ? 102 : 112;
}"""

new_gutter = """function chartRightGutterV32(){
  // V37: final rail geometry. Slightly tighter than V36 while leaving
  // enough room for compact level tags to feel native to the Y-axis.
  if(state.chartMetric==='marketCap'){
    return window.innerWidth<700 ? 78 : 88;
  }
  return window.innerWidth<700 ? 96 : 106;
}"""

if "final rail geometry" not in js:
    js = replace_once(js, old_gutter, new_gutter, "chartRightGutterV32 V37")
    changed = True

old_left = """  rail.style.left=`${Math.max(0,width-gutter+8)}px`;
  rail.style.right='0px';"""
new_left = """  rail.style.left=`${Math.max(0,width-gutter+10)}px`;
  rail.style.right='1px';"""
if "width-gutter+10" not in js:
    js = replace_once(js, old_left, new_left, "axis rail left/right V37")
    changed = True

old_gap = "  const gap=window.innerWidth<700 ? 14 : 16;"
new_gap = "  const gap=window.innerWidth<700 ? 12 : 14;"
if old_gap in js and new_gap not in js:
    js = js.replace(old_gap, new_gap, 1)
    changed = True

# --- CSS block replacement for slimmer, more integrated markers ---
block_start = "/* ===== MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */"
block_end = "/* ===== /MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */"
start = css.find(block_start)
end = css.find(block_end)
if start < 0 or end < 0:
    fail("Could not find axis rail CSS block. Install V34/V35/V36 first.")
end += len(block_end)

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
  min-height:13px;
  padding:0 4px 0 5px;
  display:inline-flex;
  align-items:center;
  justify-content:flex-end;
  gap:4px;
  transform:translateY(-50%);
  border:0.7px solid color-mix(in srgb,var(--mf-level-color) 50%,transparent);
  border-left-width:1.2px;
  border-radius:2px;
  background:rgba(6,10,13,.34);
  white-space:nowrap;
  overflow:hidden;
  box-shadow:none;
  font-family:"IBM Plex Mono",monospace;
  font-size:6.6px;
  line-height:1;
  letter-spacing:0;
  backdrop-filter:blur(1.5px);
  -webkit-backdrop-filter:blur(1.5px);
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34::before{
  content:"";
  position:absolute;
  left:-4px;
  top:50%;
  width:4px;
  height:1px;
  transform:translateY(-50%);
  background:var(--mf-level-color);
  opacity:.72;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34 span{
  flex:0 0 auto;
  color:var(--mf-level-color);
  font-weight:760;
  opacity:.94;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34 strong{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  color:#e9eef0;
  font-weight:600;
  text-align:right;
  opacity:.94;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.entry{
  background:rgba(85,217,255,.07);
}
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.stop{
  background:rgba(255,102,121,.06);
}
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.tp{
  background:rgba(77,230,161,.06);
}
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.tp2{
  background:rgba(169,139,255,.06);
}
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live{
  border-color:rgba(245,196,81,.58);
  background:rgba(245,196,81,.09);
}
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live span{
  color:#f2c34f;
  font-weight:790;
}
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live strong{
  color:#f7efcf;
  font-weight:650;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34{
  background:rgba(255,255,255,.68);
  box-shadow:none;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34 strong{
  color:#223540;
}
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.entry{
  background:rgba(85,217,255,.10);
}
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.stop{
  background:rgba(255,102,121,.09);
}
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.tp{
  background:rgba(77,230,161,.09);
}
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.tp2{
  background:rgba(169,139,255,.09);
}
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live{
  background:rgba(245,196,81,.14);
  border-color:rgba(201,154,29,.60);
}

@media (max-width:700px){
  body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34{
    min-height:12px;
    padding-left:4px;
    padding-right:4px;
    gap:3px;
    font-size:6.2px;
    border-radius:2px;
  }
}
/* ===== /MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */"""

if "font-size:6.6px;" not in css:
    css = css[:start] + new_css_block + css[end:]
    changed = True

# --- HTML cache bust / marker ---
if "chart-axis-finish-v37-20260928" not in html:
    replaced = False
    for old in (
        "chart-axis-polish-v36-20260928",
        "real-entry-only-v35-20260928",
        "chart-axis-rail-v34-20260928",
        "chart-level-integration-v33-20260927",
    ):
        if old in html:
            html = html.replace(old, "chart-axis-finish-v37-20260928")
            replaced = True
    if not replaced:
        fail("Could not find trading cache-version anchor in trading.html")
    changed = True

if V37_MARKER not in html:
    html += f"\n<!-- {V37_MARKER} -->\n"
    changed = True

if not changed:
    print("\n[OK] V37 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-chart-axis-finish-v37-backup-{stamp}"
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

print("\n[OK] MEMEFLOW CHART AXIS FINISH V37 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV37 visual changes:")
print("  • Right-axis pills are slimmer, lighter, and more native-looking.")
print("  • LIVE becomes less brick-like and less visually aggressive.")
print("  • Right gutter is tightened again for cleaner PRICE / MARKET CAP alignment.")
print("  • Marker spacing is denser and more consistent.")
print("  • Colored backgrounds are reduced to subtle accents instead of heavy blocks.")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
print(
    'git add memeflow-app/trading.js memeflow-app/trading.css memeflow-app/trading.html && '
    'git commit -m "Finish chart axis rail visual integration" && git push'
)
