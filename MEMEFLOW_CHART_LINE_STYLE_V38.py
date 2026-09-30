#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
V38_MARKER = "MEMEFLOW_CHART_LINE_STYLE_V38"

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

# ------------------------------------------------------------------
# trading.js — make horizontal strategy/live lines 1px and visually
# closer to the site's separator-line language.
# ------------------------------------------------------------------
if "// V38: line styling follows site separators." not in js:
    js = replace_once(
        js,
        '''function levelLineTypeV33(level){
  const kind=String(level?.kind||'').toLowerCase();
  if(kind==='stop')return 'dotted';
  if(kind==='tp')return 'dashed';
  if(kind==='tp2')return 'solid';
  return 'solid';
}''',
        '''function levelLineTypeV33(level){
  const kind=String(level?.kind||'').toLowerCase();
  if(kind==='stop')return 'dotted';
  if(kind==='tp')return 'dashed';
  if(kind==='tp2')return 'solid';
  return 'solid';
}

// V38: line styling follows site separators.
// Keep semantic colors, but render all chart levels as thin 1px rails
// with calmer opacity so they feel like native divider lines, not thick overlays.
function chartLevelLineWidthV38(){
  return 1;
}

function chartLevelLineOpacityV38(level){
  const kind=String(level?.kind||'').toLowerCase();
  if(kind==='entry')return .76;
  if(kind==='stop')return .70;
  if(kind==='tp')return .74;
  if(kind==='tp2')return .74;
  return .72;
}

function chartLiveLineOpacityV38(){
  return .78;
}''',
        "V38 helper functions"
    )
    changed = True

old_normal = '''      lineStyle:{
        color:levelColor(level),
        width:String(level?.kind||'')==='entry' ? 1.35 : 1.1,
        type:levelLineTypeV33(level),
        opacity:.90
      },'''
new_normal = '''      lineStyle:{
        color:levelColor(level),
        width:chartLevelLineWidthV38(),
        type:levelLineTypeV33(level),
        opacity:chartLevelLineOpacityV38(level)
      },'''
if old_normal in js and "chartLevelLineOpacityV38(level)" not in js:
    js = replace_once(js, old_normal, new_normal, "V38 normal line style")
    changed = True

old_live = '''      lineStyle:{
        color:'#f5c451',
        width:1.45,
        type:'solid',
        opacity:.96
      },'''
new_live = '''      lineStyle:{
        color:'#f5c451',
        width:chartLevelLineWidthV38(),
        type:'solid',
        opacity:chartLiveLineOpacityV38()
      },'''
if old_live in js and "chartLiveLineOpacityV38()" not in js:
    js = replace_once(js, old_live, new_live, "V38 live line style")
    changed = True

# ------------------------------------------------------------------
# trading.css — make the small connector on the rail match divider style.
# ------------------------------------------------------------------
css_marker = "/* ===== MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */"
if css_marker not in css:
    fail("Axis rail CSS block not found. Install V37 first.")

if "MEMEFLOW_CHART_LINE_STYLE_V38_CSS" not in css:
    css += '''

/* ===== MEMEFLOW_CHART_LINE_STYLE_V38_CSS ===== */
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34::before{
  height:1px;
  opacity:.58;
}
/* ===== /MEMEFLOW_CHART_LINE_STYLE_V38_CSS ===== */
'''
    changed = True

# ------------------------------------------------------------------
# trading.html — cache bust.
# ------------------------------------------------------------------
if "chart-line-style-v38-20260928" not in html:
    replaced = False
    for old in (
        "chart-axis-finish-v37-20260928",
        "chart-axis-polish-v36-20260928",
        "real-entry-only-v35-20260928",
        "chart-axis-rail-v34-20260928",
        "chart-level-integration-v33-20260927",
    ):
        if old in html:
            html = html.replace(old, "chart-line-style-v38-20260928")
            replaced = True
    if not replaced:
        fail("Could not find trading cache-version anchor in trading.html")
    changed = True

if V38_MARKER not in html:
    html += f"\n<!-- {V38_MARKER} -->\n"
    changed = True

if not changed:
    print("\n[OK] V38 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-chart-line-style-v38-backup-{stamp}"
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

print("\n[OK] MEMEFLOW CHART LINE STYLE V38 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV38 visual changes:")
print("  • Horizontal LIVE / ENTRY / SL / TP lines are now 1px.")
print("  • Line opacity is reduced so they match the site's separator-line feel.")
print("  • Semantic colors stay intact, but the rails feel lighter and cleaner.")
print("  • The small marker connector also follows the same thin divider style.")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
print(
    'git add memeflow-app/trading.js memeflow-app/trading.css memeflow-app/trading.html && '
    'git commit -m "Align chart level lines with site divider style" && git push'
)
