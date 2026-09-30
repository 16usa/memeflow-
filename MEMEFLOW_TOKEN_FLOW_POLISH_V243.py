#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import shutil
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-compact-sort-v242.css"
CSS_MARKER = "MEMEFLOW_TOKEN_FLOW_POLISH_V243_CSS"
JS_MARKER = "MEMEFLOW_TOKEN_FLOW_POLISH_V243_JS"

CSS = r'''
/* ===== MEMEFLOW_TOKEN_FLOW_POLISH_V243_CSS ===== */
body.mf-page-system-tokens{
  --mf-v243-line:rgba(255,255,255,.10);
  --mf-v243-line-strong:rgba(255,255,255,.22);
  --mf-v243-text:rgba(255,255,255,.92);
}

body.mf-page-system-tokens #mfCompactSortV242{
  border-color:var(--mf-v243-line) !important;
  border-radius:12px !important;
  background:#000 !important;
}
body.mf-page-system-tokens .mf-compact-row-v242{
  height:38px !important;
  padding:0 5px !important;
  gap:2px !important;
}
body.mf-page-system-tokens .mf-timeframes-v242,
body.mf-page-system-tokens .mf-sorters-v242{
  gap:1px !important;
}
body.mf-page-system-tokens .mf-timeframes-v242 button,
body.mf-page-system-tokens .mf-sorters-v242 button{
  position:relative !important;
  height:28px !important;
  min-height:28px !important;
  border-color:transparent !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  opacity:.42 !important;
}
body.mf-page-system-tokens .mf-timeframes-v242 button.is-active,
body.mf-page-system-tokens .mf-sorters-v242 button.is-active{
  opacity:1 !important;
  border-color:transparent !important;
  color:var(--mf-v243-text) !important;
}
body.mf-page-system-tokens .mf-timeframes-v242 button.is-active::after,
body.mf-page-system-tokens .mf-sorters-v242 button.is-active::after{
  content:"" !important;
  position:absolute !important;
  left:6px !important;
  right:6px !important;
  bottom:-1px !important;
  height:1px !important;
  border-radius:2px !important;
  background:rgba(255,255,255,.72) !important;
}
body.mf-page-system-tokens .mf-sorters-v242 button i{
  width:auto !important;
  min-width:7px !important;
  margin-left:1px !important;
}
body.mf-page-system-tokens .mf-compact-divider-v242{
  height:16px !important;
  margin:0 1px !important;
  background:var(--mf-v243-line) !important;
}
body.mf-page-system-tokens #mfCompactInfoV242{
  width:24px !important;
  height:24px !important;
  min-width:24px !important;
  min-height:24px !important;
  flex-basis:24px !important;
  border-color:var(--mf-v243-line) !important;
  opacity:.56 !important;
}

body.mf-page-system-tokens .token-list > .flow-token{
  min-height:76px !important;
  grid-template-columns:
    minmax(0,2.65fr)
    minmax(0,.74fr)
    minmax(0,.52fr)
    minmax(0,.84fr)
    minmax(0,.68fr)
    minmax(0,.50fr) !important;
  column-gap:0 !important;
  padding:7px 7px !important;
  border-left-width:2px !important;
}
body.mf-page-system-tokens .token-list > .flow-token > .token-primary{
  padding-right:7px !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-head{
  gap:7px !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-meta,
body.mf-page-system-tokens .token-list > .flow-token .token-top{
  min-width:0 !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-top{
  gap:5px !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-name{
  min-width:0 !important;
  max-width:none !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  white-space:nowrap !important;
}
body.mf-page-system-tokens .token-list > .flow-token .mf-token-age-chip-v47c{
  flex:0 0 auto !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-avatar{
  width:54px !important;
  height:54px !important;
  min-width:54px !important;
  min-height:54px !important;
  border-radius:10px !important;
}

body.mf-page-system-tokens .token-list > .flow-token >
:is(.mf-open-market-strip,.mf-regular-market-strip) >
:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3),
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot,
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-pnl-slot{
  min-height:38px !important;
  padding:0 5px !important;
  border:0 !important;
  border-left:.5px solid var(--mf-v243-line) !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
}
body.mf-page-system-tokens .token-list > .flow-token >
:is(.mf-open-market-strip,.mf-regular-market-strip) >
:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > strong,
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot > strong,
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-pnl-slot > strong{
  color:var(--mf-v243-text) !important;
  opacity:.90 !important;
  font-variant-numeric:tabular-nums !important;
}

body.mf-page-system-tokens:has(#mfCompactSortV242 [data-mf-v242-sort="volume"].is-active)
.token-list > .flow-token >
:is(.mf-open-market-strip,.mf-regular-market-strip) >
:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(3),
body.mf-page-system-tokens:has(#mfCompactSortV242 [data-mf-v242-sort="transactions"].is-active)
.token-list > .flow-token >
:is(.mf-open-market-strip,.mf-regular-market-strip) >
:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(4),
body.mf-page-system-tokens:has(#mfCompactSortV242 [data-mf-v242-sort="mc"].is-active)
.token-list > .flow-token >
:is(.mf-open-market-strip,.mf-regular-market-strip) >
:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(5),
body.mf-page-system-tokens:has(#mfCompactSortV242 [data-mf-v242-sort="change"].is-active)
.token-list > .flow-token >
:is(.mf-open-market-strip,.mf-regular-market-strip) >
:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(6),
body.mf-page-system-tokens:has(#mfCompactSortV242 [data-mf-v242-sort="score"].is-active)
.token-list > .flow-token > .mf-score-slot{
  background:rgba(255,255,255,.018) !important;
}
body.mf-page-system-tokens:has(#mfCompactSortV242 [data-mf-v242-sort="volume"].is-active)
.token-list > .flow-token >
:is(.mf-open-market-strip,.mf-regular-market-strip) >
:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(3) > strong,
body.mf-page-system-tokens:has(#mfCompactSortV242 [data-mf-v242-sort="transactions"].is-active)
.token-list > .flow-token >
:is(.mf-open-market-strip,.mf-regular-market-strip) >
:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(4) > strong,
body.mf-page-system-tokens:has(#mfCompactSortV242 [data-mf-v242-sort="mc"].is-active)
.token-list > .flow-token >
:is(.mf-open-market-strip,.mf-regular-market-strip) >
:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(5) > strong,
body.mf-page-system-tokens:has(#mfCompactSortV242 [data-mf-v242-sort="change"].is-active)
.token-list > .flow-token >
:is(.mf-open-market-strip,.mf-regular-market-strip) >
:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(6) > strong,
body.mf-page-system-tokens:has(#mfCompactSortV242 [data-mf-v242-sort="score"].is-active)
.token-list > .flow-token > .mf-score-slot > strong{
  opacity:1 !important;
  color:#fff !important;
}

body.mf-page-system-tokens .flow-hero{
  min-height:112px !important;
  padding:15px 18px !important;
}
body.mf-page-system-tokens .flow-toolbar{
  min-height:0 !important;
  padding:0 !important;
  gap:10px !important;
  border:0 !important;
  background:transparent !important;
  box-shadow:none !important;
}
body.mf-page-system-tokens .search-wrap{
  height:70px !important;
  min-height:70px !important;
  border-radius:18px !important;
  padding-inline:18px !important;
}
body.mf-page-system-tokens .refresh-info{
  height:70px !important;
  min-height:70px !important;
}
body.mf-page-system-tokens .refresh-info #lastUpdate{
  display:none !important;
}
body.mf-page-system-tokens #refreshButton{
  width:100% !important;
  height:70px !important;
  min-height:70px !important;
  border-radius:18px !important;
}

@media(max-width:390px){
  body.mf-page-system-tokens .token-list > .flow-token{
    grid-template-columns:
      minmax(0,2.55fr)
      minmax(0,.72fr)
      minmax(0,.50fr)
      minmax(0,.82fr)
      minmax(0,.66fr)
      minmax(0,.49fr) !important;
    padding-inline:6px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token .token-avatar{
    width:50px !important;
    height:50px !important;
    min-width:50px !important;
    min-height:50px !important;
  }
  body.mf-page-system-tokens .search-wrap,
  body.mf-page-system-tokens .refresh-info,
  body.mf-page-system-tokens #refreshButton{
    height:66px !important;
    min-height:66px !important;
  }
}
/* ===== /MEMEFLOW_TOKEN_FLOW_POLISH_V243_CSS ===== */
'''

JS = r'''
// ===== MEMEFLOW_TOKEN_FLOW_POLISH_V243_JS =====
function __mfCompactMarketCapV243(value){
  if(!finite(value))return '—';
  const number=Number(value);
  const abs=Math.abs(number);
  if(abs>=1_000_000_000)return `${Math.round(number/100_000_000)/10}B`;
  if(abs>=1_000_000)return `${Math.round(number/100_000)/10}M`;
  if(abs>=1_000)return `${Math.round(number/1_000)}K`;
  return `${Math.round(number)}`;
}

regularMarketCapLabel=function(metrics){
  if(!trustedMarketCapSource(metrics))return '—';
  if(finite(metrics?.marketCapUsd))return `$${__mfCompactMarketCapV243(metrics.marketCapUsd)}`;
  if(finite(metrics?.marketCapSol))return `${__mfCompactMarketCapV243(metrics.marketCapSol)} SOL`;
  return '—';
};

openMarketCapLabel=function(metrics){
  if(!trustedMarketCapSource(metrics))return '—';
  if(finite(metrics?.marketCapUsd))return `$${__mfCompactMarketCapV243(metrics.marketCapUsd)}`;
  if(finite(metrics?.marketCapSol))return `${__mfCompactMarketCapV243(metrics.marketCapSol)} SOL`;
  return '—';
};
// ===== /MEMEFLOW_TOKEN_FLOW_POLISH_V243_JS =====
'''

def fail(message):
    print(f"\n[FAIL] {message}")
    sys.exit(1)

def main():
    root=Path.cwd()
    app=root/'memeflow-app'
    if not app.is_dir() and root.name=='memeflow-app':
        app=root
        root=app.parent
    if not app.is_dir():
        fail('memeflow-app not found. Run from the existing Replit workspace Shell.')

    try:
        origin=subprocess.check_output(
            ['git','config','--get','remote.origin.url'],
            cwd=root,text=True,stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        origin=''

    if origin and EXPECTED_REPO_FRAGMENT not in origin:
        fail(f'Unexpected git origin: {origin}')

    html_path=app/'system-tokens.html'
    js_path=app/'system-tokens.js'
    css_path=app/CSS_NAME

    for path in (html_path,js_path,css_path):
        if not path.is_file():
            fail(f'Missing required file: {path}')

    html=html_path.read_text(encoding='utf-8')
    js=js_path.read_text(encoding='utf-8')
    css=css_path.read_text(encoding='utf-8')

    if 'mfCompactSortV242' not in html:
        fail('V242 compact sort markup is not installed. Nothing changed.')
    if 'MEMEFLOW_TOKEN_FLOW_COMPACT_SORT_V242' not in js:
        fail('V242 client logic is not installed. Nothing changed.')

    stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
    backup=root/f'.memeflow-token-flow-before-v243-{stamp}'
    backup.mkdir(parents=True,exist_ok=False)

    for path in (html_path,js_path,css_path):
        target=backup/path.relative_to(root)
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(path,target)

    if CSS_MARKER not in css:
        css=css.rstrip()+'\n\n'+CSS.strip()+'\n'

    if JS_MARKER not in js:
        anchor='// MEMEFLOW_TOKEN_SCAN_V27'
        if anchor not in js:
            fail(f'JS insertion anchor not found. Backup: {backup}')
        js=js.replace(anchor,JS.strip()+'\n\n'+anchor,1)

    css_pattern=r'href="/'+re.escape(CSS_NAME)+r'(?:\?v=[^"]*)?"'
    html,n_css=re.subn(
        css_pattern,
        f'href="/{CSS_NAME}?v=243-20260928"',
        html,
        count=1
    )
    if n_css!=1:
        fail(f'V242 stylesheet link not found. Backup: {backup}')

    html,n_js=re.subn(
        r'src="/system-tokens\.js(?:\?v=[^"]*)?"',
        'src="/system-tokens.js?v=token-flow-polish-v243-20260928"',
        html,
        count=1
    )
    if n_js!=1:
        fail(f'system-tokens.js script tag not found. Backup: {backup}')

    tmp=root/'.memeflow-v243-system-tokens-check.js'
    tmp.write_text(js,encoding='utf-8')
    try:
        subprocess.run(['node','--check',str(tmp)],cwd=root,check=True)
    except FileNotFoundError:
        print('[WARN] node unavailable; JS syntax check skipped.')
    except subprocess.CalledProcessError:
        tmp.unlink(missing_ok=True)
        fail(f'JS syntax validation failed. Source files were NOT changed. Backup: {backup}')
    finally:
        tmp.unlink(missing_ok=True)

    css_path.write_text(css,encoding='utf-8')
    js_path.write_text(js,encoding='utf-8')
    html_path.write_text(html,encoding='utf-8')

    try:
        subprocess.run(
            ['git','diff','--check','--',
             'memeflow-app/system-tokens.html',
             'memeflow-app/system-tokens.js',
             f'memeflow-app/{CSS_NAME}'],
            cwd=root,check=True
        )
    except Exception:
        print('[WARN] git diff --check reported an issue; inspect diff before push.')

    print('\n[OK] MEMEFLOW TOKEN FLOW POLISH V243 installed.')
    print(f'[BACKUP] {backup}')
    print('\nV243:')
    print('  • sorting row reduced to 38px')
    print('  • active item uses underline instead of a heavy box')
    print('  • per-metric boxes removed; 0.5px vertical separators remain')
    print('  • token/name column widened')
    print('  • active sort column is subtly highlighted')
    print('  • MC becomes compact: $352.8K -> $353K')
    print('  • hero + Search/Analyze are shorter')
    print('  • left state stripe stays 2px')
    print('  • ! help remains intact')
    print('  • scanner/trading/Entry/Score logic untouched')
    print('\nNo process/server restart was performed.')
    print('\nPush after visual check:')
    print('git add memeflow-app/system-tokens.html memeflow-app/system-tokens.js memeflow-app/memeflow-token-flow-compact-sort-v242.css && git commit -m "Polish Token Flow compact cards and sorting" && git push')

if __name__=='__main__':
    main()
