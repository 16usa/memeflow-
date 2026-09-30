
from pathlib import Path

ROOT=Path("memeflow-app")
js=ROOT/"trading.js"
css=ROOT/"trading.css"
html=ROOT/"trading.html"

for p in (js,css,html):
    if not p.exists():
        raise SystemExit(f"ERROR: missing {p}")

MARKER="MEMEFLOW_CHART_COMPACT_LAYOUT_V31"

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"ERROR: {label}: expected code not found")
    return text.replace(old,new,1)

s=js.read_text()

if MARKER not in s:
    old_legend='''function renderLegend(last,totalCandles,totalTicks,offscreenLevels=[]){
  if(!last){
    $('chartLegend').innerHTML='';
    return;
  }

  const parts=[
    `<span>O ${formatChartValue(last.open)}</span>`,
    `<span>H ${formatChartValue(last.high)}</span>`,
    `<span>L ${formatChartValue(last.low)}</span>`,
    `<span>C ${formatChartValue(last.close)}</span>`
  ];

  if(totalCandles!==null && totalCandles!==undefined){
    parts.push(
      `<span>${totalCandles} candles · ${totalTicks||0} trades</span>`
    );
  }

  for(const level of offscreenLevels.slice(0,3)){
    const current=Number(last.close);
    const arrow=Number(level.price)>current?'↑':'↓';
    parts.push(
      `<span>${arrow} ${esc(level.label)}</span>`
    );
  }

  $('chartLegend').innerHTML=parts.join('');
}'''

    new_legend='''// MEMEFLOW_CHART_COMPACT_LAYOUT_V31
function chartRightGutterV31(){
  if(state.chartMetric==='marketCap'){
    return window.innerWidth<700 ? 58 : 64;
  }
  return window.innerWidth<700 ? 88 : 96;
}

function chartMainGridTopV31(){
  return window.innerWidth<700 ? 84 : 62;
}

function chartMainGridHeightV31(lowerIndicatorVisible){
  if(lowerIndicatorVisible){
    return window.innerWidth<700 ? '47%' : '52%';
  }
  return window.innerWidth<700 ? '68%' : '74%';
}

function renderLegend(last,totalCandles,totalTicks,offscreenLevels=[]){
  const root=$('chartLegend');

  if(!last){
    root.innerHTML='';
    return;
  }

  const cells=[
    ['O',formatChartValue(last.open),'ohlc'],
    ['H',formatChartValue(last.high),'ohlc'],
    ['L',formatChartValue(last.low),'ohlc'],
    ['C',formatChartValue(last.close),'ohlc']
  ];

  if(totalCandles!==null && totalCandles!==undefined){
    cells.push(
      ['CANDLES',String(totalCandles),'meta'],
      ['TRADES',String(totalTicks||0),'meta']
    );
  }

  for(const level of offscreenLevels.slice(0,3)){
    const current=Number(last.close);
    const arrow=Number(level.price)>current?'↑':'↓';
    const kind=String(level.kind||'level').toLowerCase();

    cells.push([
      `${arrow} ${kind==='stop'?'SL':kind==='tp'?'TP1':kind==='tp2'?'TP2':'LEVEL'}`,
      String(level.label||'—'),
      `level ${kind}`
    ]);
  }

  root.innerHTML=
    `<div class="chart-legend-grid-v31">`+
      cells.map(([label,value,kind])=>
        `<span class="chart-legend-cell-v31 ${esc(kind)}">`+
          `<b>${esc(label)}</b>`+
          `<em>${esc(value)}</em>`+
        `</span>`
      ).join('')+
    `</div>`;
}'''

    s=replace_once(s,old_legend,new_legend,"renderLegend")

    old_grid='''      grid:[
        {
          left:10,
          right:76,
          top:42,
          height:lowerIndicatorVisible ? '55%' : '78%',
          containLabel:false
        },
        {
          show:lowerIndicatorVisible,
          left:10,
          right:76,
          top:lowerIndicatorVisible ? '77%' : '94%',
          height:lowerIndicatorVisible ? '15%' : 0,
          containLabel:false
        }
      ],'''

    new_grid='''      grid:[
        {
          left:10,
          right:chartRightGutterV31(),
          top:chartMainGridTopV31(),
          height:chartMainGridHeightV31(lowerIndicatorVisible),
          containLabel:false
        },
        {
          show:lowerIndicatorVisible,
          left:10,
          right:chartRightGutterV31(),
          top:lowerIndicatorVisible ? '77%' : '94%',
          height:lowerIndicatorVisible ? '15%' : 0,
          containLabel:false
        }
      ],'''

    s=replace_once(s,old_grid,new_grid,"ECharts grid")
    js.write_text(s)

s=css.read_text()

if MARKER not in s:
    s += r'''

/* ===== MEMEFLOW_CHART_COMPACT_LAYOUT_V31 ===== */
body.mf-page-trading.mf-trading-terminal .chart-head{
  box-sizing:border-box;
  width:100%;
  min-width:0;
  display:grid;
  grid-template-columns:minmax(0,1fr) max-content;
  align-items:center;
  column-gap:12px;
}

body.mf-page-trading.mf-trading-terminal .chart-head .token-title{
  min-width:0;
  overflow:hidden;
  display:flex;
  align-items:center;
  gap:10px;
}

body.mf-page-trading.mf-trading-terminal .chart-head .token-title > div:last-child{
  min-width:0;
}

body.mf-page-trading.mf-trading-terminal .price-toggle{
  width:max-content;
  min-width:0;
  max-width:min(52vw,360px);
  justify-self:end;
  padding-left:8px;
  display:grid;
  justify-items:end;
}

body.mf-page-trading.mf-trading-terminal
.price-toggle[data-metric="marketCap"]{
  max-width:min(46vw,300px);
}

body.mf-page-trading.mf-trading-terminal .token-price,
body.mf-page-trading.mf-trading-terminal .token-market{
  max-width:100%;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

body.mf-page-trading.mf-trading-terminal .chart-legend{
  top:6px;
  left:10px;
  right:10px;
  max-width:none;
  width:auto;
  display:block;
  pointer-events:none;
}

body.mf-page-trading.mf-trading-terminal .chart-legend-grid-v31{
  width:100%;
  display:grid;
  grid-template-columns:repeat(6,minmax(0,1fr));
  gap:4px;
}

body.mf-page-trading.mf-trading-terminal .chart-legend-cell-v31{
  box-sizing:border-box;
  min-width:0;
  min-height:24px;
  padding:3px 5px;
  display:grid;
  grid-template-columns:auto minmax(0,1fr);
  align-items:center;
  gap:4px;
  border:1px solid rgba(111,154,172,.10);
  border-radius:5px;
  background:rgba(15,20,26,.82);
  overflow:hidden;
}

body.mf-page-trading.mf-trading-terminal .chart-legend-cell-v31 b{
  min-width:0;
  opacity:.72;
  white-space:nowrap;
}

body.mf-page-trading.mf-trading-terminal .chart-legend-cell-v31 em{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-style:normal;
}

body.mf-page-trading.mf-trading-terminal .chart-legend-cell-v31.stop{
  border-color:rgba(255,102,121,.18);
}

body.mf-page-trading.mf-trading-terminal .chart-legend-cell-v31.tp,
body.mf-page-trading.mf-trading-terminal .chart-legend-cell-v31.tp2{
  border-color:rgba(77,230,161,.15);
}

@media (max-width:700px){
  body.mf-page-trading.mf-trading-terminal .chart-head{
    column-gap:8px;
  }

  body.mf-page-trading.mf-trading-terminal .price-toggle{
    max-width:48vw;
  }

  body.mf-page-trading.mf-trading-terminal
  .price-toggle[data-metric="marketCap"]{
    max-width:42vw;
  }

  body.mf-page-trading.mf-trading-terminal .chart-legend-grid-v31{
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:3px;
  }

  body.mf-page-trading.mf-trading-terminal .chart-legend-cell-v31{
    min-height:22px;
    padding:2px 4px;
    gap:3px;
  }

  body.mf-page-trading.mf-trading-terminal .chart-legend-cell-v31.level em{
    white-space:normal;
    line-height:1.08;
    max-height:2.16em;
  }
}
/* ===== /MEMEFLOW_CHART_COMPACT_LAYOUT_V31 ===== */
'''
    css.write_text(s)

s=html.read_text()
s=s.replace(
    '/trading.css?v=candidates-filter-row-removed-v1-20260927',
    '/trading.css?v=chart-compact-layout-v31-20260927'
)
s=s.replace(
    '/trading.js?v=candidates-entry-filter-v207-20260927',
    '/trading.js?v=chart-compact-layout-v31-20260927'
)
html.write_text(s)

print("V31 PATCH APPLIED")
