#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
THEME = APP / "memeflow-theme.css"
HTML = APP / "trading.html"
JS = APP / "trading.js"

CSS_MARKER = "/* ===== MEMEFLOW_TRADING_LIGHT_CHART_V2 ===== */"
JS_MARKER = "function mfTradingChartPaletteV2()"
CSS = '/* ===== MEMEFLOW_TRADING_LIGHT_CHART_V2 ===== */\n/*\n  Trading Terminal · Light mode only.\n  Full chart workspace becomes a native Light-theme surface.\n  Dark theme, chart data, candles, TP/SL logic, zoom/pan and trading behavior are untouched.\n*/\n\nhtml[data-theme="light"] .chart-panel,\nhtml[data-theme="light"][data-mf-chart-unify-all-states="1"] .chart-panel,\nhtml[data-theme="light"][data-mf-chart-unify-all-states="1"] #chartCanvas,\nhtml[data-theme="light"][data-mf-chart-unify-all-states="1"] #chartCanvas > div,\nhtml[data-theme="light"][data-mf-chart-unify-all-states="1"] [data-mf-chart-unified="1"],\nhtml[data-theme="light"][data-mf-chart-unify-all-states="1"] [data-mf-chart-placeholder="1"] {\n  background: #f6f9fb !important;\n  background-color: #f6f9fb !important;\n}\n\nhtml[data-theme="light"] .chart-panel {\n  border-color: rgba(55, 79, 94, .12) !important;\n  box-shadow: 0 14px 34px rgba(27, 42, 53, .045) !important;\n}\n\nhtml[data-theme="light"] .chart-panel .chart-head,\nhtml[data-theme="light"] .chart-panel .timeframes,\nhtml[data-theme="light"] .chart-panel .indicator-bar,\nhtml[data-theme="light"] .chart-panel .selected-metrics {\n  background: #f6f9fb !important;\n  border-color: rgba(55, 79, 94, .10) !important;\n}\n\nhtml[data-theme="light"] .chart-panel .chart-wrap {\n  background:\n    linear-gradient(rgba(59, 88, 103, .055) 1px, transparent 1px),\n    linear-gradient(90deg, rgba(59, 88, 103, .04) 1px, transparent 1px),\n    #f6f9fb !important;\n  background-size: 100% 64px, 85px 100% !important;\n}\n\nhtml[data-theme="light"] .chart-panel .token-avatar {\n  background: rgba(38, 74, 92, .035) !important;\n  border-color: rgba(47, 84, 102, .16) !important;\n  color: #5d7682 !important;\n}\n\nhtml[data-theme="light"] .chart-panel .token-name-row h1 {\n  color: #172733 !important;\n}\n\nhtml[data-theme="light"] .chart-panel .token-meta,\nhtml[data-theme="light"] .chart-panel .token-meta button,\nhtml[data-theme="light"] .chart-panel .token-market {\n  color: #607783 !important;\n}\n\nhtml[data-theme="light"] .chart-panel .token-price {\n  color: #172733 !important;\n}\n\nhtml[data-theme="light"] .chart-panel .decision-badge {\n  color: #607783 !important;\n  border-color: rgba(55, 79, 94, .16) !important;\n  background: rgba(255,255,255,.44) !important;\n}\n\nhtml[data-theme="light"] .chart-panel .timeframes button {\n  color: #607783 !important;\n  border-color: rgba(55, 79, 94, .08) !important;\n  background: transparent !important;\n}\n\nhtml[data-theme="light"] .chart-panel .timeframes button.active {\n  color: #176f88 !important;\n  border-color: rgba(32, 155, 188, .28) !important;\n  background: rgba(85, 217, 255, .10) !important;\n}\n\nhtml[data-theme="light"] .chart-panel .chart-empty strong {\n  color: #506a77 !important;\n}\n\nhtml[data-theme="light"] .chart-panel .chart-empty span {\n  color: #718590 !important;\n}\n\nhtml[data-theme="light"] .chart-panel .chart-legend span {\n  color: #516a76 !important;\n  background: rgba(255,255,255,.76) !important;\n  border-color: rgba(55,79,94,.08) !important;\n}\n\nhtml[data-theme="light"] .chart-panel .indicator-bar {\n  border-top-color: rgba(55,79,94,.10) !important;\n}\n\nhtml[data-theme="light"] .chart-panel .indicator-bar button {\n  color: #647b86 !important;\n}\n\nhtml[data-theme="light"] .chart-panel .indicator-bar button:hover {\n  color: #344e5b !important;\n}\n\nhtml[data-theme="light"] .chart-panel .indicator-bar button.active,\nhtml[data-theme="light"] .chart-panel .indicator-bar button[aria-pressed="true"] {\n  color: #176f88 !important;\n  background: rgba(85,217,255,.075) !important;\n}\n\nhtml[data-theme="light"] .chart-panel .indicator-divider {\n  background: rgba(55,79,94,.14) !important;\n}\n\nhtml[data-theme="light"] .chart-panel .selected-metrics span {\n  color: #617884 !important;\n}\n\nhtml[data-theme="light"] .chart-panel .selected-metrics strong {\n  color: #334b57 !important;\n}\n\n/* Keep the surrounding Light panels readable too. */\nhtml[data-theme="light"] .strategy-summary-row strong {\n  color: #6d818c !important;\n}\n\nhtml[data-theme="light"] .position-row .position-symbol {\n  color: #2a3b46 !important;\n}\n\nhtml[data-theme="light"] .position-row strong {\n  color: #687e89 !important;\n}\n\nhtml[data-theme="light"] .candidate-price {\n  color: #687d88 !important;\n}\n/* ===== /MEMEFLOW_TRADING_LIGHT_CHART_V2 ===== */\n'
HELPER = "/* ===== MEMEFLOW_TRADING_LIGHT_CHART_V2 ===== */\nfunction mfTradingChartPaletteV2(){\n  const light =\n    document.documentElement.getAttribute('data-theme') === 'light';\n\n  if(light){\n    return {\n      background:'#f6f9fb',\n      text:'#607783',\n      pointerLabelBg:'#ffffff',\n      pointerLabelText:'#263b47',\n      pointerLine:'rgba(52,94,113,.30)',\n      tooltipBg:'rgba(255,255,255,.985)',\n      tooltipBorder:'rgba(55,93,111,.20)',\n      tooltipText:'#263b47',\n      tooltipShadow:'box-shadow:0 10px 28px rgba(27,42,53,.12);',\n      legend:'#607783',\n      axis:'#607783',\n      lowerAxis:'#7a8f99',\n      axisLine:'rgba(55,79,94,.14)',\n      grid:'rgba(55,79,94,.10)',\n      lowerGrid:'rgba(55,79,94,.07)'\n    };\n  }\n\n  return {\n    background:'#131b23',\n    text:'#536f7b',\n    pointerLabelBg:'#0b171d',\n    pointerLabelText:'#cfe0e7',\n    pointerLine:'rgba(120,176,195,.30)',\n    tooltipBg:'rgba(5,12,17,.96)',\n    tooltipBorder:'rgba(111,170,190,.22)',\n    tooltipText:'#cfe0e7',\n    tooltipShadow:'box-shadow:0 8px 30px rgba(0,0,0,.32);',\n    legend:'#718894',\n    axis:'#536f7b',\n    lowerAxis:'#455c67',\n    axisLine:'rgba(111,154,172,.10)',\n    grid:'rgba(106,145,162,.07)',\n    lowerGrid:'rgba(106,145,162,.045)'\n  };\n}\n\nif(!window.__mfTradingLightChartThemeObserverV2){\n  window.__mfTradingLightChartThemeObserverV2 = true;\n\n  try{\n    new MutationObserver(mutations=>{\n      if(!mutations.some(m=>m.attributeName==='data-theme'))return;\n      chartRuntime.dataKey='';\n      scheduleChart();\n    }).observe(\n      document.documentElement,\n      {attributes:true,attributeFilter:['data-theme']}\n    );\n  }catch{}\n}\n/* ===== /MEMEFLOW_TRADING_LIGHT_CHART_V2 ===== */"

def die(msg):
    print(f"[TRADING LIGHT CHART V2] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (THEME, HTML, JS):
    if not path.exists():
        die(f"missing {path}")

theme_before = THEME.read_text(encoding="utf-8")
html_before = HTML.read_text(encoding="utf-8")
js_before = JS.read_text(encoding="utf-8")

if CSS_MARKER in theme_before or JS_MARKER in js_before:
    print("[TRADING LIGHT CHART V2] already installed")
    raise SystemExit(0)

required_js = [
    "function drawChart()",
    "const touchUi=chartTouchUi();",
    "backgroundColor:'#131b23'",
    "color:'#536f7b'",
    "backgroundColor:'#0b171d'",
    "backgroundColor:'rgba(5,12,17,.96)'",
    "borderColor:'rgba(111,170,190,.22)'",
    "color:'#cfe0e7'",
    "color:'#718894'",
    "color:'rgba(106,145,162,.07)'",
    "color:'#455c67'",
    "color:'rgba(106,145,162,.045)'",
]
for needle in required_js:
    if needle not in js_before:
        die("expected chart renderer token not found: " + needle)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".trading-light-chart-v2-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)
for path in (THEME, HTML, JS):
    shutil.copy2(path, backup / path.name)

# 1) Theme CSS: full light chart surface.
THEME.write_text(theme_before.rstrip() + "\n\n" + CSS, encoding="utf-8")

# 2) JS: add a runtime palette before drawChart.
insert_at = js_before.index("function drawChart()")
js_after = js_before[:insert_at] + HELPER + "\n\n" + js_before[insert_at:]

# Scope palette replacements to drawChart only.
start = js_after.index("function drawChart()")
end = js_after.index("function formatPrice(price)", start)
draw = js_after[start:end]

touch = "const touchUi=chartTouchUi();"
if touch not in draw:
    die("touchUi anchor not found inside drawChart")
draw = draw.replace(
    touch,
    touch + "\n  const chartTheme=mfTradingChartPaletteV2();",
    1
)

repls = [
    ("backgroundColor:'#131b23'", "backgroundColor:chartTheme.background", 1),
    ("color:'#536f7b'", "color:chartTheme.text", 1),
    ("backgroundColor:'#0b171d'", "backgroundColor:chartTheme.pointerLabelBg,\n          color:chartTheme.pointerLabelText", 1),
    ("color:'rgba(120,176,195,.30)'", "color:chartTheme.pointerLine", 1),
    ("backgroundColor:'#0b171d'", "backgroundColor:chartTheme.pointerLabelBg,\n            color:chartTheme.pointerLabelText", 1),
    ("backgroundColor:'rgba(5,12,17,.96)'", "backgroundColor:chartTheme.tooltipBg", 1),
    ("borderColor:'rgba(111,170,190,.22)'", "borderColor:chartTheme.tooltipBorder", 1),
    ("color:'#cfe0e7'", "color:chartTheme.tooltipText", 1),
    ("extraCssText:'box-shadow:0 8px 30px rgba(0,0,0,.32);'", "extraCssText:chartTheme.tooltipShadow", 1),
    ("color:'#718894'", "color:chartTheme.legend", 1),
    ("color:'#536f7b'", "color:chartTheme.axis", 1),
    ("lineStyle:{color:'rgba(111,154,172,.10)'}", "lineStyle:{color:chartTheme.axisLine}", 1),
    ("color:'#536f7b'", "color:chartTheme.axis", 1),
    ("backgroundColor:'#0b171d'", "backgroundColor:chartTheme.pointerLabelBg,\n              color:chartTheme.pointerLabelText", 1),
    ("color:'#536f7b'", "color:chartTheme.axis", 1),
    ("color:'rgba(106,145,162,.07)'", "color:chartTheme.grid", 1),
    ("color:'#455c67'", "color:chartTheme.lowerAxis", 1),
    ("color:'rgba(106,145,162,.045)'", "color:chartTheme.lowerGrid", 1),
]

for old, new, count in repls:
    if draw.count(old) < count:
        die("renderer replacement token missing: " + old)
    draw = draw.replace(old, new, count)

js_after = js_after[:start] + draw + js_after[end:]
JS.write_text(js_after, encoding="utf-8")

# 3) Cache-bust both JS and theme CSS on Trading Terminal only.
html_after = html_before
html_after, js_count = re.subn(
    r'/trading\.js\?v=[^"\']+',
    '/trading.js?v=light-chart-v2-20260830',
    html_after,
    count=1
)
if js_count == 0:
    die("trading.js script URL not found in trading.html")

html_after, css_count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    '/memeflow-theme.css?v=light-theme-v1-trading-light-chart-v2-20260830',
    html_after,
    count=1
)
if css_count == 0:
    die("memeflow-theme.css link not found in trading.html")

HTML.write_text(html_after, encoding="utf-8")

rollback = ROOT / "rollback_trading_light_chart_v2.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("memeflow-theme.css", "trading.html", "trading.js"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

print("[TRADING LIGHT CHART V2] ROLLED BACK")
print("[TRADING LIGHT CHART V2] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[TRADING LIGHT CHART V2] INSTALLED")
print("[TRADING LIGHT CHART V2] Light: full chart workspace + ECharts canvas are light")
print("[TRADING LIGHT CHART V2] candles / TP / SL / indicators remain color-coded")
print("[TRADING LIGHT CHART V2] Dark theme untouched")
print("[TRADING LIGHT CHART V2] chart data / zoom / trading logic untouched")
print("[TRADING LIGHT CHART V2] backup:", backup)
print("[TRADING LIGHT CHART V2] rollback: python3 rollback_trading_light_chart_v2.py")
