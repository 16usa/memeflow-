#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
MARKER = "MEMEFLOW_TRADING_CHART_LEVEL_INTEGRATION_V33"

def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)

def replace_once(src, old, new, label):
    count = src.count(old)
    if count != 1:
        fail(f"{label}: expected exactly 1 anchor, found {count}")
    return src.replace(old, new, 1)

root = Path.cwd()

# Detect existing Replit workspace without forcing cd.
app = root / "memeflow-app"
if not app.is_dir() and root.name == "memeflow-app":
    app = root
if not app.is_dir():
    fail("memeflow-app not found from the current workspace. Run this from the existing project Shell.")

# Safety check: verify this is the expected repo when git metadata is available.
try:
    origin = subprocess.check_output(
        ["git", "config", "--get", "remote.origin.url"],
        cwd=root,
        text=True,
        stderr=subprocess.DEVNULL
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

originals = {
    js_path: js,
    css_path: css,
    html_path: html,
}

changed = False

# ---------------- trading.js ----------------
if "// V33: strategy levels are first-class chart geometry." not in js:
    old_level_info = r'''function chartLevelInfo(candles){
  const levels=strategyLevels();
  if(!candles.length || !levels.length){
    return {visible:[],offscreen:levels};
  }

  const basis=
    state.timeframe==='all'
      ? candles
      : candles.slice(-Math.min(140,candles.length));

  const values=basis.flatMap(c=>[
    Number(c.high),
    Number(c.low)
  ]).filter(Number.isFinite);

  if(!values.length){
    return {visible:[],offscreen:levels};
  }

  const min=Math.min(...values);
  const max=Math.max(...values);
  const span=Math.max(
    max-min,
    Math.abs(max||1)*.006
  );

  const low=Math.max(0,min-span*.30);
  const high=max+span*.30;

  return {
    visible:levels.filter(level=>
      Number(level?.price)>=low &&
      Number(level?.price)<=high
    ),
    offscreen:levels.filter(level=>
      Number(level?.price)<low ||
      Number(level?.price)>high
    )
  };
}'''

    new_level_info = r'''function chartLevelInfo(candles){
  // V33: strategy levels are first-class chart geometry.
  // Never drop TP/SL/ENTRY just because the candle-only autoscale would
  // place them outside the current price band. ECharts will include these
  // real-price line series in the Y range, so every configured level stays
  // visible in both PRICE and MARKET CAP modes.
  const levels=strategyLevels()
    .filter(level=>
      Number.isFinite(Number(level?.price)) &&
      Number(level.price)>0
    );

  return {
    visible:levels,
    offscreen:[]
  };
}'''

    js = replace_once(js, old_level_info, new_level_info, "chartLevelInfo")

    block_start = js.find("function levelColor(level){")
    block_end = js.find("\n// V30.19: keep sparse timeframes visually dense", block_start)
    if block_start < 0 or block_end < 0:
        fail("horizontal level block anchors not found")

    new_horizontal = r'''function levelColor(level){
  const kind=String(level?.kind||'').toLowerCase();
  if(kind==='stop')return '#ff6679';
  if(kind==='entry')return '#55d9ff';
  if(kind==='tp')return '#4de6a1';
  if(kind==='tp2')return '#a98bff';
  return '#91a6b0';
}

function levelLineTypeV33(level){
  const kind=String(level?.kind||'').toLowerCase();
  if(kind==='stop')return 'dotted';
  if(kind==='tp')return 'dashed';
  if(kind==='tp2')return 'solid';
  return 'solid';
}

function chartLevelLabelBackgroundV33(){
  return document.documentElement.getAttribute('data-theme')==='light'
    ? 'rgba(255,255,255,.94)'
    : 'rgba(3,7,10,.88)';
}

// V33: strategy rail is integrated into the plot. Labels sit INSIDE the
// chart edge, while the numeric Y-axis remains outside and unobstructed.
function chartHorizontalLevelSeries(labels,visibleLevels,liveValue){
  const count=Array.isArray(labels)?labels.length:0;
  if(!count)return [];

  const constantData=value=>
    Array.from({length:count},()=>Number(value));

  const labelBg=chartLevelLabelBackgroundV33();

  const rows=(Array.isArray(visibleLevels)?visibleLevels:[])
    .filter(level=>Number.isFinite(Number(level?.price)) && Number(level.price)>0)
    .map((level,index)=>({
      name:`__MF_LEVEL_${index}_${String(level.kind||'level')}`,
      type:'line',
      xAxisIndex:0,
      yAxisIndex:0,
      data:constantData(level.price),
      showSymbol:false,
      symbol:'none',
      silent:true,
      animation:false,
      tooltip:{show:false},
      emphasis:{disabled:true},
      lineStyle:{
        color:levelColor(level),
        width:String(level?.kind||'')==='entry' ? 1.35 : 1.1,
        type:levelLineTypeV33(level),
        opacity:.90
      },
      endLabel:{
        show:true,
        formatter:()=>chartLevelTagV32(level),
        color:levelColor(level),
        backgroundColor:labelBg,
        borderColor:levelColor(level),
        borderWidth:.6,
        borderRadius:3,
        padding:[2,4],
        distance:8,
        align:'right',
        verticalAlign:'middle',
        fontSize:8,
        fontWeight:700
      },
      labelLayout:{
        hideOverlap:false,
        moveOverlap:'shiftY'
      },
      z:7
    }));

  const live=Number(liveValue);
  if(Number.isFinite(live) && live>0){
    rows.push({
      name:'__MF_LIVE_LEVEL',
      type:'line',
      xAxisIndex:0,
      yAxisIndex:0,
      data:constantData(live),
      showSymbol:false,
      symbol:'none',
      silent:true,
      animation:false,
      tooltip:{show:false},
      emphasis:{disabled:true},
      lineStyle:{
        color:'#f5c451',
        width:1.45,
        type:'solid',
        opacity:.96
      },
      endLabel:{
        show:true,
        color:'#171103',
        backgroundColor:'#f5c451',
        borderColor:'#f5c451',
        borderWidth:.6,
        borderRadius:3,
        padding:[2,4],
        distance:8,
        align:'right',
        verticalAlign:'middle',
        fontSize:8,
        fontWeight:800,
        formatter:()=>`LIVE ${formatChartValue(live)}`
      },
      labelLayout:{
        hideOverlap:false,
        moveOverlap:'shiftY'
      },
      z:8
    });
  }

  return rows;
}
'''
    js = js[:block_start] + new_horizontal + js[block_end:]

    js = replace_once(
        js,
        r"value:raw.replace(/^TP1\s*/i,'').replace(/\s*·\s*/g,' · ')||'—',",
        r"value:(raw.replace(/^TP1\s*/i,'').split('·')[0]||'').trim()||'—',",
        "TP1 compact badge"
    )
    js = replace_once(
        js,
        r"value:raw.replace(/^TP2\s*/i,'').replace(/\s*·\s*/g,' · ')||'—',",
        r"value:(raw.replace(/^TP2\s*/i,'').split('·')[0]||'').trim()||'—',",
        "TP2 compact badge"
    )
    js = replace_once(
        js,
        "const orderedKinds=['stop','tp','tp2'];",
        "const orderedKinds=['entry','stop','tp','tp2'];",
        "legend order"
    )
    changed = True

# ---------------- trading.css ----------------
css_marker = "/* ===== MEMEFLOW_CHART_LEVEL_INTEGRATION_V33 ===== */"
if css_marker not in css:
    css += r'''

/* ===== MEMEFLOW_CHART_LEVEL_INTEGRATION_V33 ===== */
body.mf-page-trading.mf-trading-terminal .chart-status-row-v32{
  grid-template-columns:
    minmax(0,.95fr)
    minmax(0,.95fr)
    minmax(0,.72fr)
    minmax(0,.78fr)
    minmax(0,1.02fr)
    minmax(0,1.02fr);
}

body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.entry{
  border-color:rgba(85,217,255,.20);
}
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.entry b{
  color:#55d9ff;
  opacity:1;
}
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.stop{
  border-color:rgba(255,102,121,.22);
}
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.stop b{
  color:#ff6679;
  opacity:1;
}
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.tp{
  border-color:rgba(77,230,161,.20);
}
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.tp b{
  color:#4de6a1;
  opacity:1;
}
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.tp2{
  border-color:rgba(169,139,255,.22);
}
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.tp2 b{
  color:#a98bff;
  opacity:1;
}

@media (max-width:700px){
  body.mf-page-trading.mf-trading-terminal .chart-status-row-v32{
    grid-template-columns:
      minmax(0,.92fr)
      minmax(0,.92fr)
      minmax(0,.66fr)
      minmax(0,.72fr)
      minmax(0,.94fr)
      minmax(0,.94fr);
    gap:2px;
  }

  body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32{
    padding-left:2px;
    padding-right:2px;
  }
}
/* ===== /MEMEFLOW_CHART_LEVEL_INTEGRATION_V33 ===== */
'''
    changed = True

# ---------------- trading.html / cache bust ----------------
if "chart-level-integration-v33-20260927" not in html:
    old_version = "chart-information-hierarchy-v32-20260927"
    if old_version not in html:
        fail("trading.html cache-version anchor not found")
    html = html.replace(old_version, "chart-level-integration-v33-20260927")
    changed = True

if MARKER not in html:
    html += f"\n<!-- {MARKER} -->\n"
    changed = True

if not changed:
    print("\n[OK] V33 is already installed. No files changed.")
    sys.exit(0)

# Backup before writing.
stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-chart-level-v33-backup-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=False)
for p, content in originals.items():
    rel = p.relative_to(root) if root in p.parents else Path(p.name)
    target = backup_dir / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

js_path.write_text(js, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

# Syntax / whitespace checks only. No server restart.
try:
    subprocess.run(["node", "--check", str(js_path)], cwd=root, check=True)
except FileNotFoundError:
    print("[WARN] node is not available; JS syntax check skipped.")
except subprocess.CalledProcessError:
    fail("node --check failed. Restore from backup: " + str(backup_dir))

try:
    subprocess.run(
        ["git", "diff", "--check", "--",
         str(js_path.relative_to(root)),
         str(css_path.relative_to(root)),
         str(html_path.relative_to(root))],
        cwd=root,
        check=True
    )
except Exception:
    print("[WARN] git diff --check could not run.")

print("\n[OK] MEMEFLOW chart V33 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nChanged behavior:")
print("  • ENTRY / SL / TP1 / TP2 are always included in the real Y-axis scale.")
print("  • LIVE = amber, ENTRY = cyan, SL = red, TP1 = green, TP2 = purple.")
print("  • Line labels are moved inside the plot so they do not cover Y-axis numbers.")
print("  • Close labels shift vertically instead of disappearing.")
print("  • Top strategy row now includes ENTRY and uses matching semantic colors.")
print("  • PRICE / MARKET CAP use the same level model.")
print("\nNo process/server restart was performed.")
print("\nPush when ready:")
print("git add memeflow-app/trading.js memeflow-app/trading.css memeflow-app/trading.html && "
      "git commit -m \"Integrate strategy levels into trading chart\" && git push")
