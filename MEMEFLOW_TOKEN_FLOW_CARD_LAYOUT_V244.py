#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import shutil
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-compact-sort-v242.css"
CSS_MARKER = "MEMEFLOW_TOKEN_FLOW_CARD_LAYOUT_V244_CSS"
JS_MARKER = "MEMEFLOW_TOKEN_FLOW_CARD_LAYOUT_V244_JS"

CSS = r'''
/* ===== MEMEFLOW_TOKEN_FLOW_CARD_LAYOUT_V244_CSS ===== */
body.mf-page-system-tokens{
  --mf-v244-line:rgba(255,255,255,.10);
  --mf-v244-cell-h:34px;
  --mf-v244-chip-h:24px;
  --mf-v244-num-size:11.5px;
  --mf-v244-num-weight:700;
}

/* Two-row card: top = VOL/TX/MC/Δ%; right = SCORE centered; bottom = holders/age/action inside token column */
body.mf-page-system-tokens .token-list > .flow-token{
  min-height:92px !important;
  grid-template-columns:
    minmax(0,2.85fr)
    minmax(0,.80fr)
    minmax(0,.62fr)
    minmax(0,.86fr)
    minmax(0,.80fr)
    minmax(0,.58fr) !important;
  grid-template-rows: 1fr auto !important;
  align-items:stretch !important;
  row-gap:0 !important;
  column-gap:0 !important;
  padding:7px 7px !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .token-primary{
  grid-column:1 !important;
  grid-row:1 / span 2 !important;
  min-width:0 !important;
  width:100% !important;
  display:grid !important;
  grid-template-rows:minmax(0,1fr) auto !important;
  align-items:center !important;
  padding-right:8px !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .token-primary .token-head{
  min-width:0 !important;
  height:100% !important;
  align-items:center !important;
  gap:8px !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .token-primary .token-avatar{
  width:52px !important;
  height:52px !important;
  min-width:52px !important;
  min-height:52px !important;
  border-radius:10px !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .token-primary .token-meta{
  min-width:0 !important;
  width:100% !important;
  display:grid !important;
  grid-template-rows:auto auto !important;
  align-items:center !important;
  row-gap:7px !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .token-primary .token-top{
  min-width:0 !important;
  display:flex !important;
  align-items:center !important;
  gap:6px !important;
  flex-wrap:nowrap !important;
}
body.mf-page-system-tokens .token-list > .flow-token > .token-primary .token-name{
  min-width:0 !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  white-space:nowrap !important;
}

/* Build a second row strip inside the token column */
body.mf-page-system-tokens .token-list > .flow-token .mf-v244-meta-row{
  min-width:0 !important;
  display:flex !important;
  align-items:center !important;
  gap:7px !important;
  overflow:hidden !important;
}
body.mf-page-system-tokens .token-list > .flow-token .mf-v244-meta-item{
  min-width:0 !important;
  max-width:100% !important;
  height:var(--mf-v244-chip-h) !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:5px !important;
  padding:0 8px !important;
  border:.5px solid var(--mf-v244-line) !important;
  border-radius:999px !important;
  background:transparent !important;
  color:rgba(255,255,255,.76) !important;
  font-size:var(--mf-v244-num-size) !important;
  font-weight:var(--mf-v244-num-weight) !important;
  line-height:1 !important;
  white-space:nowrap !important;
  box-shadow:none !important;
}
body.mf-page-system-tokens .token-list > .flow-token .mf-v244-meta-item svg,
body.mf-page-system-tokens .token-list > .flow-token .mf-v244-meta-item i{
  width:12px !important;
  height:12px !important;
  flex:0 0 auto !important;
}

/* Keep top-row market cells only in row 1 */
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip){
  display:contents !important;
}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(-n+2),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(-n+2){
  display:none !important;
}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(3),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(3){grid-column:2 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(4),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(4){grid-column:3 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(5),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(5){grid-column:4 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(6),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(6){grid-column:5 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot){
  grid-column:6 !important;
  grid-row:1 / span 2 !important;
}

body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3){
  min-width:0 !important;
  width:100% !important;
  min-height:var(--mf-v244-cell-h) !important;
  margin:0 !important;
  padding:0 5px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  border-left:.5px solid var(--mf-v244-line) !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  text-align:center !important;
  box-sizing:border-box !important;
}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > strong,
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot > strong,
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-pnl-slot > strong{
  width:100% !important;
  margin:0 !important;
  text-align:center !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  font-size:13px !important;
  font-weight:700 !important;
  font-variant-numeric:tabular-nums !important;
}
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot,
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-pnl-slot{
  min-width:0 !important;
  width:100% !important;
  min-height:100% !important;
  margin:0 !important;
  padding:0 5px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  border-left:.5px solid var(--mf-v244-line) !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  text-align:center !important;
  box-sizing:border-box !important;
}

body.mf-page-system-tokens .token-list > .flow-token .token-details{
  grid-column:1 / -1 !important;
  grid-row:3 !important;
}

/* Force old age chip visuals to match row size if it remains anywhere */
body.mf-page-system-tokens .token-list > .flow-token .mf-token-age-chip-v47c{
  font-size:var(--mf-v244-num-size) !important;
  font-weight:var(--mf-v244-num-weight) !important;
  line-height:1 !important;
  height:var(--mf-v244-chip-h) !important;
}

/* Small screens */
@media(max-width:390px){
  body.mf-page-system-tokens .token-list > .flow-token{
    grid-template-columns:
      minmax(0,2.75fr)
      minmax(0,.80fr)
      minmax(0,.60fr)
      minmax(0,.84fr)
      minmax(0,.76fr)
      minmax(0,.57fr) !important;
    padding-inline:6px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token > .token-primary .token-avatar{
    width:50px !important;
    height:50px !important;
    min-width:50px !important;
    min-height:50px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token .mf-v244-meta-item{
    padding:0 7px !important;
    gap:4px !important;
  }
}
/* ===== /MEMEFLOW_TOKEN_FLOW_CARD_LAYOUT_V244_CSS ===== */
'''

JS = r'''
// ===== MEMEFLOW_TOKEN_FLOW_CARD_LAYOUT_V244_JS =====
function __mfV244FindMetaCandidate(root){
  if(!root)return null;
  const selectors=[
    '[class*="holders"]',
    '[class*="holder"]',
    '[data-role*="holders"]',
    '[data-mf-role*="holders"]'
  ];
  for(const selector of selectors){
    const node=root.querySelector(selector);
    if(node)return node;
  }
  const nodes=[...root.querySelectorAll('div,span,p,small')];
  for(const node of nodes){
    const text=String(node.textContent||'').trim();
    if(!text)continue;
    if(text.length>14)continue;
    if(!/\d/.test(text))continue;
    if(node.closest('.mf-token-age-chip-v47c'))continue;
    if(node.closest('.token-top'))continue;
    if(node.querySelector('svg, i'))return node;
  }
  return null;
}

function __mfV244FindActionCandidate(root){
  if(!root)return null;
  const selectors=[
    '[aria-expanded]',
    '[class*="toggle"]',
    '[class*="expand"]',
    '[data-role*="detail"]',
    '[data-mf-role*="detail"]'
  ];
  for(const selector of selectors){
    const node=root.querySelector(selector);
    if(node && !node.closest('.token-avatar'))return node;
  }
  const buttons=[...root.querySelectorAll('button')];
  for(const button of buttons){
    if(button.closest('.token-avatar'))continue;
    if(button.closest('.token-top'))continue;
    return button;
  }
  return null;
}

function __mfBuildCardMetaRowV244(card){
  const primary=card?.querySelector?.('.token-primary');
  if(!primary)return;
  if(primary.dataset.mfV244Built==='1')return;
  primary.dataset.mfV244Built='1';

  const meta=primary.querySelector('.token-meta') || primary;
  const top=meta.querySelector('.token-top') || meta.firstElementChild || meta;

  const existing=meta.querySelector('.mf-v244-meta-row');
  if(existing)return;

  const row=document.createElement('div');
  row.className='mf-v244-meta-row';

  const holdersSource=__mfV244FindMetaCandidate(primary);
  if(holdersSource){
    const holdersItem=document.createElement('div');
    holdersItem.className='mf-v244-meta-item mf-v244-holders';
    holdersItem.innerHTML=holdersSource.innerHTML || holdersSource.textContent || '';
    row.appendChild(holdersItem);
    holdersSource.style.display='none';
  }

  const ageChip=primary.querySelector('.mf-token-age-chip-v47c');
  if(ageChip){
    const ageItem=document.createElement('div');
    ageItem.className='mf-v244-meta-item mf-v244-age';
    ageItem.textContent=String(ageChip.textContent || '').trim();
    row.appendChild(ageItem);
    ageChip.style.display='none';
  }

  const actionSource=__mfV244FindActionCandidate(primary);
  if(actionSource){
    const actionItem=document.createElement('div');
    actionItem.className='mf-v244-meta-item mf-v244-action';
    actionItem.innerHTML=actionSource.innerHTML || actionSource.textContent || '•';
    row.appendChild(actionItem);
    actionSource.style.display='none';
  }

  if(!row.children.length)return;

  if(top && top.parentNode===meta){
    top.insertAdjacentElement('afterend',row);
  }else{
    meta.appendChild(row);
  }
}

function __mfApplyCardLayoutV244(){
  document.querySelectorAll('.flow-token[data-mint]').forEach(__mfBuildCardMetaRowV244);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{__mfApplyCardLayoutV244();},{once:true});
}else{
  __mfApplyCardLayoutV244();
}

setInterval(()=>{__mfApplyCardLayoutV244();},1200);
// ===== /MEMEFLOW_TOKEN_FLOW_CARD_LAYOUT_V244_JS =====
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

    stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
    backup=root/f'.memeflow-token-flow-before-v244-{stamp}'
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

    html,n_css=re.subn(
        r'href="/'+re.escape(CSS_NAME)+r'(?:\?v=[^"]*)?"',
        f'href="/{CSS_NAME}?v=244-20260928"',
        html,
        count=1
    )
    if n_css!=1:
        fail(f'Stylesheet link not found. Backup: {backup}')

    html,n_js=re.subn(
        r'src="/system-tokens\.js(?:\?v=[^"]*)?"',
        'src="/system-tokens.js?v=token-flow-card-layout-v244-20260928"',
        html,
        count=1
    )
    if n_js!=1:
        fail(f'system-tokens.js script tag not found. Backup: {backup}')

    tmp=root/'.memeflow-v244-system-tokens-check.js'
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

    print('\n[OK] MEMEFLOW TOKEN FLOW CARD LAYOUT V244 installed.')
    print(f'[BACKUP] {backup}')
    print('\nV244:')
    print('  • SCORE stays the last far-right column and is vertically centered')
    print('  • VOL / TX / MC / Δ% stay on the first row')
    print('  • token card gets a second row with holders -> age -> action icon')
    print('  • second-row items are normalized to the same visual size family as the metric info')
    print('  • name row keeps max width and truncates cleanly')
    print('  • scanner/trading/Entry/Score logic untouched')
    print('\nNo process/server restart was performed.')
    print('\nPush after visual check:')
    print('git add memeflow-app/system-tokens.html memeflow-app/system-tokens.js memeflow-app/memeflow-token-flow-compact-sort-v242.css && git commit -m "Refine Token Flow card rows and score alignment" && git push')

if __name__=='__main__':
    main()
