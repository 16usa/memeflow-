#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
V34_MARKER = "MEMEFLOW_TRADING_CHART_AXIS_RAIL_V34"

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

# ---------------------------------------------------------------------------
# trading.html — add a DOM rail over the ECharts Y-axis gutter.
# ---------------------------------------------------------------------------
if 'id="chartAxisRail"' not in html:
    html = replace_once(
        html,
        '''            <div id="chartCanvas" aria-label="Live candlestick chart with optional technical indicators"></div>
            <div id="chartEmpty" class="chart-empty">''',
        '''            <div id="chartCanvas" aria-label="Live candlestick chart with optional technical indicators"></div>
            <div id="chartAxisRail" class="chart-axis-rail-v34" aria-hidden="true"></div>
            <div id="chartEmpty" class="chart-empty">''',
        "chartAxisRail HTML insertion"
    )
    changed = True

# Cache bust both trading.css and trading.js.
if "chart-axis-rail-v34-20260928" not in html:
    if "chart-level-integration-v33-20260927" not in html:
        fail("V33 cache-version anchor not found in trading.html")
    html = html.replace(
        "chart-level-integration-v33-20260927",
        "chart-axis-rail-v34-20260928"
    )
    changed = True

if V34_MARKER not in html:
    html += f"\n<!-- {V34_MARKER} -->\n"
    changed = True

# ---------------------------------------------------------------------------
# trading.js — remove plot endLabels and render level+value on right Y-axis rail.
# ---------------------------------------------------------------------------
if "// V34: right-axis rail renderer" not in js:
    js = replace_once(
        js,
        '''  resizeObserver:null,
  pendingFx:null
};''',
        '''  resizeObserver:null,
  pendingFx:null,
  axisRailRows:[],
  axisRailLowerVisible:false,
  axisRailRaf:null
};''',
        "chartRuntime rail state"
    )

    start = js.find("function chartLevelLabelBackgroundV33(){")
    end = js.find("\n// V30.19: keep sparse timeframes visually dense", start)
    if start < 0 or end < 0:
        fail("Could not find V33 horizontal-level block. Make sure V33 is installed first.")

    v34_block = r'''// V34: right-axis rail renderer.
// Strategy/live lines remain true ECharts Y-series for scale geometry,
// but their labels + numeric values live in the SAME right-side rail
// as the normal PRICE / MARKET CAP axis values.
function chartHorizontalLevelSeries(labels,visibleLevels,liveValue){
  const count=Array.isArray(labels)?labels.length:0;
  if(!count)return [];

  const constantData=value=>
    Array.from({length:count},()=>Number(value));

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
      z:8
    });
  }

  return rows;
}

function chartAxisRailClearV34(){
  const rail=$('chartAxisRail');
  if(rail)rail.innerHTML='';
  chartRuntime.axisRailRows=[];
}

function chartAxisRailRowsV34(levels,liveValue){
  const rows=(Array.isArray(levels)?levels:[])
    .filter(level=>
      Number.isFinite(Number(level?.price)) &&
      Number(level.price)>0
    )
    .map(level=>({
      kind:String(level.kind||'level'),
      label:chartLevelTagV32(level),
      price:Number(level.price),
      color:levelColor(level)
    }));

  const live=Number(liveValue);
  if(Number.isFinite(live) && live>0){
    rows.push({
      kind:'live',
      label:'LIVE',
      price:live,
      color:'#f5c451'
    });
  }

  return rows;
}

function chartAxisRailScheduleV34(){
  if(chartRuntime.axisRailRaf)return;

  chartRuntime.axisRailRaf=requestAnimationFrame(()=>{
    chartRuntime.axisRailRaf=null;
    chartAxisRailRenderV34();
  });
}

function chartAxisRailRenderV34(){
  const rail=$('chartAxisRail');
  const api=chartRuntime.api;

  if(!rail || !api){
    return;
  }

  const source=Array.isArray(chartRuntime.axisRailRows)
    ? chartRuntime.axisRailRows
    : [];

  if(!source.length){
    rail.innerHTML='';
    return;
  }

  const width=Number(api.getWidth?.()||0);
  const height=Number(api.getHeight?.()||0);
  if(!(width>0) || !(height>0))return;

  const gutter=Math.max(64,Number(chartRightGutterV32())||0);

  rail.style.left=`${Math.max(0,width-gutter+2)}px`;
  rail.style.right='2px';

  const top=Number(chartMainGridTopV32())||0;
  const rawHeight=chartMainGridHeightV32(
    Boolean(chartRuntime.axisRailLowerVisible)
  );

  const mainHeight=
    typeof rawHeight==='string' && rawHeight.trim().endsWith('%')
      ? height*(Number.parseFloat(rawHeight)||0)/100
      : Number(rawHeight)||Math.max(0,height-top);

  const minY=top+10;
  const maxY=Math.min(
    height-10,
    top+mainHeight-10
  );

  const mapped=source
    .map(row=>{
      let y=null;
      try{
        y=Number(api.convertToPixel({yAxisIndex:0},row.price));
      }catch{}

      return {
        ...row,
        targetY:y,
        y
      };
    })
    .filter(row=>
      Number.isFinite(row.y) &&
      row.y>=top-2 &&
      row.y<=top+mainHeight+2
    )
    .sort((a,b)=>a.targetY-b.targetY);

  if(!mapped.length){
    rail.innerHTML='';
    return;
  }

  const gap=window.innerWidth<700 ? 18 : 20;

  mapped[0].y=Math.max(minY,Math.min(maxY,mapped[0].targetY));

  for(let i=1;i<mapped.length;i++){
    mapped[i].y=Math.max(
      mapped[i].targetY,
      mapped[i-1].y+gap
    );
  }

  if(mapped[mapped.length-1].y>maxY){
    mapped[mapped.length-1].y=maxY;

    for(let i=mapped.length-2;i>=0;i--){
      mapped[i].y=Math.min(
        mapped[i].y,
        mapped[i+1].y-gap
      );
    }

    if(mapped[0].y<minY){
      const shift=minY-mapped[0].y;
      for(const row of mapped){
        row.y+=shift;
      }
    }
  }

  rail.innerHTML=mapped.map(row=>{
    const kind=String(row.kind||'level').toLowerCase();
    const value=formatChartValue(row.price);
    const shift=row.y-row.targetY;

    return (
      `<div class="chart-axis-marker-v34 ${esc(kind)}"`+
      ` style="top:${row.y.toFixed(1)}px;`+
      `--mf-level-color:${esc(row.color)};`+
      `--mf-level-shift:${shift.toFixed(1)}px">`+
        `<span>${esc(row.label)}</span>`+
        `<strong>${esc(value)}</strong>`+
      `</div>`
    );
  }).join('');
}
'''
    js = js[:start] + v34_block + js[end:]
    changed = True

    js = replace_once(
        js,
        '''  chartRuntime.api.on('datazoom',()=>{
    captureChartViewport();
  });''',
        '''  chartRuntime.api.on('datazoom',()=>{
    captureChartViewport();
    chartAxisRailScheduleV34();
  });''',
        "datazoom rail sync"
    )

    js = replace_once(
        js,
        '''    chartRuntime.resizeObserver=new ResizeObserver(()=>{
      try{chartRuntime.api?.resize?.()}catch{}
      resizeBreakoutFxCanvas();
    });''',
        '''    chartRuntime.resizeObserver=new ResizeObserver(()=>{
      try{chartRuntime.api?.resize?.()}catch{}
      chartAxisRailScheduleV34();
      resizeBreakoutFxCanvas();
    });''',
        "ResizeObserver rail sync"
    )

    js = replace_once(
        js,
        '''    window.addEventListener('resize',()=>{
      try{chartRuntime.api?.resize?.()}catch{}
      resizeBreakoutFxCanvas();
    },{passive:true});''',
        '''    window.addEventListener('resize',()=>{
      try{chartRuntime.api?.resize?.()}catch{}
      chartAxisRailScheduleV34();
      resizeBreakoutFxCanvas();
    },{passive:true});''',
        "window resize rail sync"
    )

    js = replace_once(
        js,
        '''function chartRightGutterV32(){
  if(state.chartMetric==='marketCap'){
    return window.innerWidth<700 ? 48 : 56;
  }
  return window.innerWidth<700 ? 80 : 88;
}''',
        '''function chartRightGutterV32(){
  // V34: this gutter is shared by ordinary Y-axis numbers and
  // LIVE / ENTRY / SL / TP1 / TP2 axis markers.
  if(state.chartMetric==='marketCap'){
    return window.innerWidth<700 ? 88 : 100;
  }
  return window.innerWidth<700 ? 116 : 128;
}''',
        "right gutter V34"
    )

    js = replace_once(
        js,
        '''  if(!state.selectedMint){
    chartRuntime.api.clear();''',
        '''  if(!state.selectedMint){
    chartAxisRailClearV34();
    chartRuntime.api.clear();''',
        "clear rail without selected mint"
    )

    js = replace_once(
        js,
        '''  if(!candles.length){
    chartRuntime.api.clear();''',
        '''  if(!candles.length){
    chartAxisRailClearV34();
    chartRuntime.api.clear();''',
        "clear rail without candles"
    )

    js = replace_once(
        js,
        '''  chartRuntime.metric=state.chartMetric;
  chartRuntime.candleCount=candles.length;''',
        '''  chartRuntime.metric=state.chartMetric;
  chartRuntime.axisRailRows=chartAxisRailRowsV34(
    levelInfo.visible,
    last.close
  );
  chartRuntime.axisRailLowerVisible=lowerIndicatorVisible;
  chartAxisRailScheduleV34();
  chartRuntime.candleCount=candles.length;''',
        "drawChart rail state"
    )

# ---------------------------------------------------------------------------
# trading.css — make the markers visually part of the numeric rail.
# ---------------------------------------------------------------------------
css_marker = "/* ===== MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */"
if css_marker not in css:
    css += r'''

/* ===== MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */
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
  left:0;
  right:0;
  box-sizing:border-box;
  height:18px;
  padding:0 4px 0 5px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:4px;
  transform:translateY(-50%);
  border:1px solid color-mix(in srgb,var(--mf-level-color) 78%,transparent);
  border-left-width:2px;
  border-radius:4px;
  background:rgba(3,7,10,.97);
  box-shadow:0 0 0 1px rgba(0,0,0,.20);
  white-space:nowrap;
  overflow:hidden;
  font-family:"IBM Plex Mono",monospace;
  font-size:8px;
  line-height:1;
  letter-spacing:0;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34::before{
  content:"";
  position:absolute;
  left:-7px;
  top:50%;
  width:7px;
  height:1px;
  transform:translateY(-50%);
  background:var(--mf-level-color);
  opacity:.92;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34 span{
  flex:0 0 auto;
  color:var(--mf-level-color);
  font-weight:800;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34 strong{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  color:#eef3f5;
  font-weight:650;
  text-align:right;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live{
  border-color:#f5c451;
  background:#f5c451;
  box-shadow:none;
}

body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live span,
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live strong{
  color:#171103;
  font-weight:850;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34{
  background:rgba(255,255,255,.98);
  box-shadow:0 0 0 1px rgba(32,53,64,.08);
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34 strong{
  color:#263b47;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live{
  background:#f5c451;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live span,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34.live strong{
  color:#171103;
}

@media (max-width:700px){
  body.mf-page-trading.mf-trading-terminal .chart-axis-marker-v34{
    height:17px;
    padding-left:4px;
    padding-right:3px;
    gap:3px;
    font-size:7.6px;
    border-radius:3px;
  }
}
/* ===== /MEMEFLOW_CHART_AXIS_RAIL_V34 ===== */
'''
    changed = True

if not changed:
    print("\n[OK] V34 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-chart-axis-rail-v34-backup-{stamp}"
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

print("\n[OK] MEMEFLOW chart axis rail V34 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV34 behavior:")
print("  • TP1 / TP2 / SL / ENTRY / LIVE labels no longer float inside the plot.")
print("  • Each level is rendered in the same right-side rail as PRICE / MARKET CAP numbers.")
print("  • Each rail marker includes BOTH the level name and its live numeric axis value.")
print("  • Markers use ECharts convertToPixel(yAxis) and move with the Y-axis scale.")
print("  • PRICE <-> MARKET CAP automatically reformats every marker value.")
print("  • Close levels are collision-spaced so all labels remain readable.")
print("  • Horizontal lines remain at exact mathematical prices.")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
print('git add memeflow-app/trading.js memeflow-app/trading.css memeflow-app/trading.html && '
      'git commit -m "Integrate trade levels into chart Y-axis rail" && git push')
