#!/usr/bin/env python3
from pathlib import Path
import re, sys

if len(sys.argv) != 2:
    raise SystemExit('Usage: transform.py <memeflow-app-dir>')

APP = Path(sys.argv[1])
SOURCE = APP / 'memeflow-x-canonical-v184.css'
TARGET = APP / 'memeflow-x-canonical-v185.css'
MARKET_JS = APP / 'market-chart-final-v5.js'
TRADING_JS = APP / 'trading.js'
PAGES = [
    'index.html','system.html','how-it-works.html','smart-vault.html',
    'trading.html','settings.html','system-tokens.html','x100.html',
    'agent-performance.html','owner-intelligence.html','system-source.html',
]
for p in (SOURCE, MARKET_JS, TRADING_JS):
    if not p.exists():
        raise SystemExit(f'ERROR: required current V184 file missing: {p}')

# MARKET CHART: remove isolated Shadow DOM + embedded <style> text system.
market = MARKET_JS.read_text(encoding='utf-8')
market, n = re.subn(
    r"host\.style\.cssText\s*=\s*['\"]display:block;width:100%;max-width:100%;['\"]\s*;",
    '', market, count=1)
if n != 1:
    raise SystemExit('ERROR: expected market-chart host.style.cssText assignment not found')

m = re.search(
    r"if\(host\.shadowRoot\)return host;\s*"
    r"const root=host\.attachShadow\(\{mode:'open'\}\);\s*"
    r"root\.innerHTML=`",
    market)
if not m:
    raise SystemExit('ERROR: expected market-chart Shadow DOM mount not found')
market = market[:m.start()] + (
    "if(host.dataset.mfFinalChartMounted==='1')return host;"
    "host.dataset.mfFinalChartMounted='1';"
    "const root=host;root.innerHTML=`"
) + market[m.end():]

m = re.search(r"root\.innerHTML=`\s*<style>[\s\S]*?</style>\s*", market)
if not m:
    raise SystemExit('ERROR: embedded market-chart <style> block not found')
market = market[:m.start()] + 'root.innerHTML=`\n' + market[m.end():]

market, n_shadow = re.subn(r'host\.shadowRoot', 'host', market)
if n_shadow < 2:
    raise SystemExit(f'ERROR: expected remaining host.shadowRoot uses, got {n_shadow}')

old_canvas = "ctx.font='10px system-ui,-apple-system,sans-serif';ctx.fillStyle='#97a4b5';"
if old_canvas not in market:
    raise SystemExit('ERROR: expected literal canvas font/color not found')
new_canvas = (
    "const chartTextStyle=getComputedStyle(host),"
    "axisSize=chartTextStyle.getPropertyValue('--mf-size-11').trim()||'11px',"
    "axisColor=chartTextStyle.getPropertyValue('--mf-neutral-text-3').trim()||'#a3a3a3';"
    "ctx.font=axisSize+' '+chartTextStyle.fontFamily;"
    "ctx.fillStyle=axisColor;"
)
market = market.replace(old_canvas, new_canvas, 1)
for bad in ('attachShadow','shadowRoot','.style.cssText','<style>'):
    if bad in market:
        raise SystemExit(f'ERROR: market-chart still contains legacy style owner: {bad}')
MARKET_JS.write_text(market, encoding='utf-8')
print('CLEANED market-chart-final-v5.js runtime text/style ownership')

# TRADING: semantic state data instead of direct style.color.
trading = TRADING_JS.read_text(encoding='utf-8')
pattern = re.compile(
    r"node\.style\.color\s*=\s*Math\.abs\(allocation\s*-\s*100\)\s*<=\s*\.001\s*"
    r"\?\s*'#4de6a1'\s*:\s*'#ff6679'\s*;"
)
trading, n = pattern.subn(
    "node.dataset.mfTone = Math.abs(allocation - 100) <= .001 ? 'allocation-ok' : 'allocation-bad';",
    trading, count=1)
if n != 1:
    raise SystemExit('ERROR: expected trading allocationBadge style.color assignment not found')
TRADING_JS.write_text(trading, encoding='utf-8')
print('CLEANED trading.js runtime allocation text color ownership')

canon = SOURCE.read_text(encoding='utf-8')
canon = re.sub(
    r'/\* MEMEFLOW_RUNTIME_TEXT_FINAL_V185_START \*/[\s\S]*?'
    r'/\* MEMEFLOW_RUNTIME_TEXT_FINAL_V185_END \*/',
    '', canon)

component_css = r'''
/* MEMEFLOW_RUNTIME_TEXT_FINAL_V185_START */
#mf-final-chart-host{display:block;width:100%;max-width:100%;color:var(--mf-neutral-text-1);}
#mf-final-chart-host *{box-sizing:border-box;}
#mf-final-chart-host .card{width:100%;overflow:hidden;background:linear-gradient(180deg,#0d141d,#080d13);border-radius:0 0 18px 18px;}
#mf-final-chart-host .token{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:14px;align-items:center;padding:16px;border-bottom:1px solid #1d2936;}
#mf-final-chart-host .avatar{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:linear-gradient(145deg,rgba(84,221,255,.16),rgba(81,231,168,.07));font-size:var(--mf-size-17);font-weight:900;}
#mf-final-chart-host .avatar img{width:100%;height:100%;object-fit:cover;display:block;}
#mf-final-chart-host .copy{min-width:0;}
#mf-final-chart-host .name{margin:0;font-size:var(--mf-size-24);line-height:1.05;letter-spacing:-.035em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#mf-final-chart-host .meta{margin-top:7px;color:var(--mf-neutral-text-3);font-size:var(--mf-size-11);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#mf-final-chart-host .quote{text-align:right;min-width:138px;}
#mf-final-chart-host .price{display:block;font-size:var(--mf-size-36);line-height:1;font-weight:900;letter-spacing:-.04em;white-space:nowrap;}
#mf-final-chart-host .change{display:block;margin-top:7px;color:var(--green);font-size:var(--mf-size-12);font-weight:800;}
#mf-final-chart-host .change.down{color:var(--red);}
#mf-final-chart-host .toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:13px 15px 10px;border-bottom:1px solid #1d2936;}
#mf-final-chart-host .label{display:flex;align-items:baseline;gap:9px;min-width:0;}
#mf-final-chart-host .label small{color:var(--mf-neutral-text-3);font-size:var(--mf-size-11);letter-spacing:.13em;}
#mf-final-chart-host .label b{font-size:var(--mf-size-13);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
#mf-final-chart-host .source{color:var(--mf-neutral-text-3);font-size:var(--mf-size-11);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;}
#mf-final-chart-host .intervals{grid-column:1/-1;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;}
#mf-final-chart-host .intervals button{min-height:42px;border:1px solid transparent;border-radius:11px;background:transparent;color:var(--mf-neutral-text-3);font:inherit;font-size:var(--mf-size-11);font-weight:850;}
#mf-final-chart-host .intervals button.active{color:var(--mf-neutral-text-1);border-color:rgba(84,221,255,.28);background:rgba(84,221,255,.08);}
#mf-final-chart-host .stage{position:relative;height:380px;background:#070c12;overflow:hidden;border-bottom:1px solid #1d2936;}
#mf-final-chart-host .stage canvas{display:block;width:100%;height:100%;}
#mf-final-chart-host .badge{position:absolute;right:10px;top:10px;padding:5px 8px;border-radius:9px;background:rgba(81,231,168,.1);color:var(--green);font-size:var(--mf-size-11);font-weight:900;letter-spacing:.1em;}
#mf-final-chart-host .last{position:absolute;right:10px;top:46px;padding:4px 6px;border-radius:7px;background:rgba(7,12,18,.88);font-size:var(--mf-size-11);font-weight:850;max-width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#mf-final-chart-host .age{position:absolute;right:10px;top:70px;color:var(--mf-neutral-text-3);font-size:var(--mf-size-11);}
#mf-final-chart-host .empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:28px;color:var(--mf-neutral-text-3);font-size:var(--mf-size-11);line-height:1.5;}
#mf-final-chart-host .empty b{display:block;color:var(--mf-neutral-text-1);font-size:var(--mf-size-13);margin-bottom:5px;}
#mf-final-chart-host .footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 15px;color:var(--mf-neutral-text-3);font-size:var(--mf-size-11);flex-wrap:wrap;}
#mf-final-chart-host .live{display:flex;align-items:center;gap:7px;}
#mf-final-chart-host .dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px rgba(81,231,168,.09);}
:where(#allocationBadge[data-mf-tone="allocation-ok"]){color:#4de6a1!important;}
:where(#allocationBadge[data-mf-tone="allocation-bad"]){color:#ff6679!important;}
@media(max-width:560px){
  #mf-final-chart-host .token{grid-template-columns:54px minmax(0,1fr);gap:11px;padding:13px;}
  #mf-final-chart-host .avatar{width:54px;height:54px;border-radius:16px;}
  #mf-final-chart-host .name{font-size:var(--mf-size-17);}
  #mf-final-chart-host .meta{font-size:var(--mf-size-11);margin-top:5px;}
  #mf-final-chart-host .quote{grid-column:1/-1;display:flex;align-items:baseline;justify-content:space-between;text-align:left;min-width:0;padding-top:2px;}
  #mf-final-chart-host .price{font-size:var(--mf-size-24);}
  #mf-final-chart-host .change{margin-top:0;font-size:var(--mf-size-11);}
  #mf-final-chart-host .toolbar{padding:11px 10px 9px;}
  #mf-final-chart-host .source{max-width:42%;font-size:var(--mf-size-11);}
  #mf-final-chart-host .intervals{gap:3px;}
  #mf-final-chart-host .intervals button{min-height:44px;padding:6px 1px;}
  #mf-final-chart-host .stage{height:320px;}
  #mf-final-chart-host .footer{padding:9px 10px;font-size:var(--mf-size-11);}
  #mf-final-chart-host .card{padding-bottom:2px;}
}
/* MEMEFLOW_RUNTIME_TEXT_FINAL_V185_END */
'''

canon = canon.rstrip() + '\n\n' + component_css.strip() + '\n'
canon = canon.replace('MEMEFLOW_TEXT_CANONICAL_V184_START','MEMEFLOW_TEXT_CANONICAL_V185_START')
canon = canon.replace('MEMEFLOW_TEXT_CANONICAL_V184_END','MEMEFLOW_TEXT_CANONICAL_V185_END')
TARGET.write_text(canon, encoding='utf-8')
SOURCE.unlink()

for page in PAGES:
    p = APP/page
    html = p.read_text(encoding='utf-8')
    html = html.replace('/memeflow-x-canonical-v184.css?v=text-canonical-v184-20260922', '/memeflow-x-canonical-v185.css?v=runtime-text-final-v185-20260922')
    html = html.replace('memeflow-x-canonical-v184.css','memeflow-x-canonical-v185.css')
    p.write_text(html,encoding='utf-8')

print('CREATED', TARGET)
print('REMOVED', SOURCE)
print('V185 market chart text now uses shared canonical tokens')
print('V185 trading allocation state now uses canonical semantic data')
