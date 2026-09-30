from pathlib import Path

ROOT=Path("memeflow-app")
js=ROOT/"trading.js"
css=ROOT/"trading.css"
html=ROOT/"trading.html"

for p in (js,css,html):
    if not p.exists():
        raise SystemExit(f"ERROR: missing {p}")

MARKER="MEMEFLOW_CHART_INFORMATION_HIERARCHY_V32"

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"ERROR: {label}: expected V31 code not found")
    return text.replace(old,new,1)

s=js.read_text()

if MARKER not in s:
    if "MEMEFLOW_CHART_COMPACT_LAYOUT_V31" not in s:
        raise SystemExit("ERROR: V31 chart patch is not installed")

    s=s.replace(
        "label: `TP1 +${fmt(tp1, 0)}% · SELL ${fmt(tp1Sell, 0)}%`",
        "label: `TP1 +${fmt(tp1, 0)}% · ${fmt(tp1Sell, 0)}%`",
        1
    )
    s=s.replace(
        "label: `TP2 +${fmt(tp2, 0)}% · SELL ${fmt(tp2Sell, 0)}%`",
        "label: `TP2 +${fmt(tp2, 0)}% · ${fmt(tp2Sell, 0)}%`",
        1
    )

    start=s.index("// MEMEFLOW_CHART_COMPACT_LAYOUT_V31")
    end=s.index("\nfunction scheduleChart()", start)

    new_block=r'''// MEMEFLOW_CHART_INFORMATION_HIERARCHY_V32
function chartRightGutterV32(){
  if(state.chartMetric==='marketCap'){
    return window.innerWidth<700 ? 48 : 56;
  }
  return window.innerWidth<700 ? 80 : 88;
}

function chartMainGridTopV32(){
  return window.innerWidth<700 ? 60 : 56;
}

function chartMainGridHeightV32(lowerIndicatorVisible){
  if(lowerIndicatorVisible){
    return window.innerWidth<700 ? '54%' : '56%';
  }
  return window.innerWidth<700 ? '76%' : '78%';
}

function chartLevelBadgeV32(level){
  const kind=String(level?.kind||'').toLowerCase();
  const raw=String(level?.label||'').trim();

  if(kind==='stop'){
    return {
      label:'SL',
      value:raw.replace(/^SL\s*/i,'')||'—',
      kind:'stop'
    };
  }

  if(kind==='tp'){
    return {
      label:'TP1',
      value:raw.replace(/^TP1\s*/i,'').replace(/\s*·\s*/g,' · ')||'—',
      kind:'tp'
    };
  }

  if(kind==='tp2'){
    return {
      label:'TP2',
      value:raw.replace(/^TP2\s*/i,'').replace(/\s*·\s*/g,' · ')||'—',
      kind:'tp2'
    };
  }

  if(kind==='entry'){
    return {label:'ENTRY',value:'',kind:'entry'};
  }

  return null;
}

function chartLevelTagV32(level){
  const kind=String(level?.kind||'').toLowerCase();
  if(kind==='stop')return 'SL';
  if(kind==='tp')return 'TP1';
  if(kind==='tp2')return 'TP2';
  if(kind==='entry')return 'ENTRY';
  return 'LEVEL';
}

function renderLegend(last,totalCandles,totalTicks,offscreenLevels=[]){
  const root=$('chartLegend');

  if(!last){
    root.innerHTML='';
    return;
  }

  const ohlc=[
    ['O',formatChartValue(last.open)],
    ['H',formatChartValue(last.high)],
    ['L',formatChartValue(last.low)],
    ['C',formatChartValue(last.close)]
  ];

  const stats=[
    ['CANDLES',String(totalCandles??0),'meta'],
    ['TRADES',String(totalTicks||0),'meta']
  ];

  const orderedKinds=['stop','tp','tp2'];
  const strategy=strategyLevels();

  for(const kind of orderedKinds){
    const level=strategy.find(row=>String(row?.kind||'')===kind);
    if(!level)continue;

    const badge=chartLevelBadgeV32(level);
    if(badge){
      stats.push([badge.label,badge.value,badge.kind]);
    }
  }

  root.innerHTML=
    `<div class="chart-info-v32">`+
      `<div class="chart-ohlc-row-v32">`+
        ohlc.map(([label,value])=>
          `<span class="chart-ohlc-cell-v32">`+
            `<b>${esc(label)}</b>`+
            `<em>${esc(value)}</em>`+
          `</span>`
        ).join('')+
      `</div>`+
      `<div class="chart-status-row-v32">`+
        stats.map(([label,value,kind])=>
          `<span class="chart-status-cell-v32 ${esc(kind)}">`+
            `<b>${esc(label)}</b>`+
            `<em>${esc(value)}</em>`+
          `</span>`
        ).join('')+
      `</div>`+
    `</div>`;
}'''

    s=s[:start]+new_block+s[end:]

    s=s.replace("right:chartRightGutterV31()", "right:chartRightGutterV32()")
    s=s.replace("top:chartMainGridTopV31()", "top:chartMainGridTopV32()")
    s=s.replace(
        "height:chartMainGridHeightV31(lowerIndicatorVisible)",
        "height:chartMainGridHeightV32(lowerIndicatorVisible)"
    )

    old_levels=r'''      lineStyle:{
        color:levelColor(level),
        width:1,
        type:'dashed',
        opacity:.85
      },
      z:5
    }));'''

    new_levels=r'''      lineStyle:{
        color:levelColor(level),
        width:1,
        type:'dashed',
        opacity:.76
      },
      endLabel:{
        show:true,
        formatter:()=>chartLevelTagV32(level),
        color:levelColor(level),
        backgroundColor:'rgba(3,7,10,.82)',
        borderRadius:3,
        padding:[2,4],
        distance:3,
        fontSize:8,
        fontWeight:600
      },
      labelLayout:{
        hideOverlap:true,
        moveOverlap:'shiftY'
      },
      z:5
    }));'''

    s=replace_once(s,old_levels,new_levels,"strategy line labels")

    s=s.replace(
        "while (host.children.length > 8) {",
        "while (host.children.length > 5) {",
        1
    )
    s=s.replace(
        "}, 3300);",
        "}, 2400);",
        1
    )

    js.write_text(s)

s=css.read_text()

if MARKER not in s:
    s += r'''

/* ===== MEMEFLOW_CHART_INFORMATION_HIERARCHY_V32 ===== */
body.mf-page-trading.mf-trading-terminal .chart-legend{
  top:5px !important;
  left:10px !important;
  right:10px !important;
  width:auto !important;
  max-width:none !important;
}

body.mf-page-trading.mf-trading-terminal .chart-info-v32{
  width:100%;
  display:grid;
  gap:3px;
}

body.mf-page-trading.mf-trading-terminal .chart-ohlc-row-v32{
  width:100%;
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:3px;
}

body.mf-page-trading.mf-trading-terminal .chart-ohlc-cell-v32{
  min-width:0;
  height:21px;
  padding:0 5px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:4px;
  border:1px solid rgba(111,154,172,.08);
  border-radius:4px;
  background:rgba(15,20,26,.72);
  overflow:hidden;
}

body.mf-page-trading.mf-trading-terminal .chart-ohlc-cell-v32 b,
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32 b{
  flex:0 0 auto;
  opacity:.64;
  white-space:nowrap;
}

body.mf-page-trading.mf-trading-terminal .chart-ohlc-cell-v32 em,
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32 em{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-style:normal;
}

body.mf-page-trading.mf-trading-terminal .chart-status-row-v32{
  width:100%;
  display:grid;
  grid-template-columns:
    minmax(0,1fr)
    minmax(0,1fr)
    minmax(0,.82fr)
    minmax(0,1.08fr)
    minmax(0,1.08fr);
  gap:3px;
}

body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32{
  box-sizing:border-box;
  min-width:0;
  height:21px;
  padding:0 4px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:3px;
  border:1px solid rgba(111,154,172,.065);
  border-radius:4px;
  background:rgba(15,20,26,.60);
  overflow:hidden;
}

body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.stop{
  border-color:rgba(255,102,121,.16);
}

body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.tp,
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32.tp2{
  border-color:rgba(77,230,161,.12);
}

body.mf-page-trading.mf-trading-terminal .live-trade-tape{
  top:78px !important;
  width:68px !important;
  gap:2px !important;
  opacity:.48;
}

body.mf-page-trading.mf-trading-terminal .live-tape-row{
  max-width:68px !important;
  gap:2px !important;
}

body.mf-page-trading.mf-trading-terminal .live-tape-row strong{
  font-size:.78em;
  font-weight:500;
}

body.mf-page-trading.mf-trading-terminal .live-tape-arrow{
  width:7px !important;
  font-size:.72em;
}

body.mf-page-trading.mf-trading-terminal .price-toggle{
  align-self:center;
}

body.mf-page-trading.mf-trading-terminal .token-market{
  opacity:.72;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-ohlc-cell-v32,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32{
  background:rgba(255,255,255,.80);
  border-color:rgba(55,93,111,.12);
}

@media (max-width:700px){
  body.mf-page-trading.mf-trading-terminal .chart-legend{
    left:8px !important;
    right:8px !important;
  }

  body.mf-page-trading.mf-trading-terminal .chart-ohlc-cell-v32,
  body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32{
    height:20px;
    padding-left:3px;
    padding-right:3px;
    gap:2px;
  }

  body.mf-page-trading.mf-trading-terminal .chart-status-row-v32{
    grid-template-columns:
      minmax(0,.92fr)
      minmax(0,.92fr)
      minmax(0,.72fr)
      minmax(0,1.22fr)
      minmax(0,1.22fr);
  }

  body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32 b{
    font-size:.86em;
  }

  body.mf-page-trading.mf-trading-terminal .chart-status-cell-v32 em{
    font-size:.92em;
  }
}
/* ===== /MEMEFLOW_CHART_INFORMATION_HIERARCHY_V32 ===== */
'''
    css.write_text(s)

s=html.read_text()
s=s.replace(
    '/trading.css?v=chart-compact-layout-v31-20260927',
    '/trading.css?v=chart-information-hierarchy-v32-20260927'
)
s=s.replace(
    '/trading.js?v=chart-compact-layout-v31-20260927',
    '/trading.js?v=chart-information-hierarchy-v32-20260927'
)
html.write_text(s)

print("V32 PATCH APPLIED")
