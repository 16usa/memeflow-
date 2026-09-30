#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re, shutil, subprocess, sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-compact-sort-v242.css"
START = "/* ===== MEMEFLOW_TOKEN_FLOW_IDENTITY_FIX_V246 ===== */"
END = "/* ===== /MEMEFLOW_TOKEN_FLOW_IDENTITY_FIX_V246 ===== */"

CSS = r'''/* ===== MEMEFLOW_TOKEN_FLOW_IDENTITY_FIX_V246 ===== */
/*
  V246 is layout-only.
  Fixes the left identity rail after V245 while preserving the now-readable
  VOL / TX / MC / Δ% / SCORE columns.
*/
body.mf-page-system-tokens{
  --mf-v246-avatar:40px;
  --mf-v246-gap:6px;
  --mf-v246-name:9.5px;
  --mf-v246-meta:8.5px;
}

/* Give identity a little more room without sacrificing the market rails. */
body.mf-page-system-tokens .token-list > .flow-token{
  grid-template-columns:
    minmax(0,1fr)
    46px
    35px
    44px
    44px
    34px !important;
}

/* Old generic card metrics must never auto-place themselves inside identity. */
body.mf-page-system-tokens .token-list > .flow-token > .token-metric:not(.mf-score-slot):not(.mf-open-pnl-slot){
  display:none !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .token-primary{
  min-width:0 !important;
  width:100% !important;
  overflow:hidden !important;
  padding-right:4px !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-head{
  min-width:0 !important;
  width:100% !important;
  grid-template-columns:var(--mf-v246-avatar) minmax(0,1fr) !important;
  gap:var(--mf-v246-gap) !important;
  overflow:hidden !important;
}
body.mf-page-system-tokens .token-list > .flow-token :is(
  .token-avatar,
  .mf-token-avatar-anchor-v51,
  .mf-token-avatar-anchor-v51 > .token-avatar
){
  width:var(--mf-v246-avatar) !important;
  height:var(--mf-v246-avatar) !important;
  min-width:var(--mf-v246-avatar) !important;
  min-height:var(--mf-v246-avatar) !important;
  max-width:var(--mf-v246-avatar) !important;
  max-height:var(--mf-v246-avatar) !important;
}

/* Rebuild the text side as two clean rows. */
body.mf-page-system-tokens .token-list > .flow-token .token-meta{
  min-width:0 !important;
  width:100% !important;
  height:52px !important;
  display:grid !important;
  grid-template-columns:minmax(0,auto) auto minmax(16px,1fr) !important;
  grid-template-rows:28px 20px !important;
  column-gap:5px !important;
  row-gap:0 !important;
  align-content:center !important;
  align-items:center !important;
  overflow:hidden !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-top{
  display:contents !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-name{
  grid-column:1 / -1 !important;
  grid-row:1 !important;
  min-width:0 !important;
  width:100% !important;
  max-width:100% !important;
  margin:0 !important;
  padding:0 !important;
  font-size:var(--mf-v246-name) !important;
  line-height:1.05 !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  white-space:nowrap !important;
}

/* HOLDERS -> AGE -> action/source icon, all on one compact baseline. */
body.mf-page-system-tokens .token-list > .flow-token .mf-token-subline-v47c{
  grid-column:1 !important;
  grid-row:2 !important;
  min-width:0 !important;
  width:auto !important;
  min-height:0 !important;
  height:18px !important;
  margin:0 !important;
  padding:0 !important;
  display:flex !important;
  align-items:center !important;
  overflow:hidden !important;
}
body.mf-page-system-tokens .token-list > .flow-token .mf-holder-mini-v47c{
  min-width:0 !important;
  width:auto !important;
  max-width:58px !important;
  height:18px !important;
  margin:0 !important;
  padding:0 !important;
  gap:3px !important;
  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  font-size:var(--mf-v246-meta) !important;
  font-weight:700 !important;
  line-height:18px !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:clip !important;
}
body.mf-page-system-tokens .token-list > .flow-token .mf-holder-mini-v47c svg{
  width:9px !important;
  height:9px !important;
  min-width:9px !important;
  flex:0 0 9px !important;
}
body.mf-page-system-tokens .token-list > .flow-token .mf-token-age-chip-v47c{
  grid-column:2 !important;
  grid-row:2 !important;
  min-width:0 !important;
  width:auto !important;
  height:18px !important;
  margin:0 !important;
  padding:0 !important;
  border:0 !important;
  border-radius:0 !important;
  outline:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  font-size:var(--mf-v246-meta) !important;
  font-weight:700 !important;
  line-height:18px !important;
  white-space:nowrap !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-source-links{
  grid-column:3 !important;
  grid-row:2 !important;
  min-width:0 !important;
  width:auto !important;
  height:18px !important;
  margin:0 !important;
  padding:0 !important;
  justify-self:start !important;
  align-self:center !important;
  display:inline-flex !important;
  align-items:center !important;
  gap:2px !important;
  overflow:hidden !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-source-link{
  width:15px !important;
  height:15px !important;
  min-width:15px !important;
  min-height:15px !important;
  margin:0 !important;
  padding:0 !important;
  border:0 !important;
  border-radius:3px !important;
  background:transparent !important;
  box-shadow:none !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-source-link svg{
  width:10px !important;
  height:10px !important;
}

/* Remove any inherited pill decoration from the second row. */
body.mf-page-system-tokens .token-list > .flow-token :is(
  .mf-token-subline-v47c,
  .mf-holder-mini-v47c,
  .mf-token-age-chip-v47c,
  .token-source-links
)::before,
body.mf-page-system-tokens .token-list > .flow-token :is(
  .mf-token-subline-v47c,
  .mf-holder-mini-v47c,
  .mf-token-age-chip-v47c,
  .token-source-links
)::after{
  display:none !important;
  content:none !important;
}

/* Keep market values readable and centered. */
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > strong{
  font-size:8.5px !important;
  letter-spacing:-.04em !important;
}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot) > strong{
  font-size:9.5px !important;
}

@media(max-width:390px){
  body.mf-page-system-tokens{
    --mf-v246-avatar:38px;
    --mf-v246-gap:5px;
    --mf-v246-name:9px;
    --mf-v246-meta:8px;
  }
  body.mf-page-system-tokens .token-list > .flow-token{
    grid-template-columns:
      minmax(0,1fr)
      44px
      33px
      43px
      43px
      33px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token .token-meta{
    column-gap:4px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token .mf-holder-mini-v47c{
    max-width:54px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > strong{
    font-size:8px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot) > strong{
    font-size:9px !important;
  }
}

@media(min-width:520px){
  body.mf-page-system-tokens{
    --mf-v246-avatar:46px;
    --mf-v246-name:10.5px;
    --mf-v246-meta:9px;
  }
  body.mf-page-system-tokens .token-list > .flow-token{
    grid-template-columns:minmax(0,1fr) 60px 48px 60px 56px 44px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > strong{
    font-size:9.5px !important;
  }
}
/* ===== /MEMEFLOW_TOKEN_FLOW_IDENTITY_FIX_V246 ===== */'''


def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)


def main():
    root=Path.cwd()
    app=root/'memeflow-app'
    if not app.is_dir() and root.name=='memeflow-app':
        app=root; root=app.parent
    if not app.is_dir():
        fail('memeflow-app not found. Run from the existing Replit workspace Shell.')

    try:
        origin=subprocess.check_output(['git','config','--get','remote.origin.url'],cwd=root,text=True,stderr=subprocess.DEVNULL).strip()
    except Exception:
        origin=''
    if origin and EXPECTED_REPO_FRAGMENT not in origin:
        fail(f'Unexpected git origin: {origin}')

    css_path=app/CSS_NAME
    html_path=app/'system-tokens.html'
    for p in (css_path,html_path):
        if not p.is_file(): fail(f'Missing required file: {p}')

    css=css_path.read_text(encoding='utf-8')
    html=html_path.read_text(encoding='utf-8')

    if 'MEMEFLOW_TOKEN_FLOW_FIT_ALL_V245_CSS' not in css:
        fail('V245 card layout is not installed. Nothing changed.')

    # Idempotent replacement of V246 only.
    css=re.sub(re.escape(START)+r'.*?'+re.escape(END), '', css, flags=re.S)
    css=css.rstrip()+"\n\n"+CSS+"\n"

    pattern=r'href="/'+re.escape(CSS_NAME)+r'(?:\?v=[^"]*)?"'
    html,n=re.subn(pattern,f'href="/{CSS_NAME}?v=246-20260928"',html,count=1)
    if n!=1: fail('Compact Token Flow stylesheet link not found. Nothing changed.')

    if css.count(START)!=1 or css.count(END)!=1:
        fail('Internal V246 validation failed. Nothing changed.')

    stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
    backup=root/f'.memeflow-token-flow-before-v246-{stamp}'
    backup.mkdir(parents=True,exist_ok=False)
    for p in (css_path,html_path):
        target=backup/p.relative_to(root)
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,target)

    css_path.write_text(css,encoding='utf-8')
    html_path.write_text(html,encoding='utf-8')

    try:
        subprocess.run(['git','diff','--check','--',f'memeflow-app/{CSS_NAME}','memeflow-app/system-tokens.html'],cwd=root,check=True)
    except subprocess.CalledProcessError:
        shutil.copy2(backup/css_path.relative_to(root),css_path)
        shutil.copy2(backup/html_path.relative_to(root),html_path)
        fail(f'git diff --check failed; V246 rolled back. Backup: {backup}')

    print('\n[OK] MEMEFLOW TOKEN FLOW IDENTITY FIX V246 installed.')
    print(f'[BACKUP] {backup}')
    print('\nV246:')
    print('  • keeps V245 market values readable')
    print('  • restores usable token-name width')
    print('  • removes auto-placed legacy metric chips from identity')
    print('  • second row is holders -> age -> source/action icon')
    print('  • removes inherited pill/circle decoration from that row')
    print('  • SCORE remains the final far-right centered column')
    print('  • trading / scanner / Entry / Score / sorting logic untouched')
    print('\nNo process/server restart was performed.')
    print('\nPush after visual check:')
    print(f'git add memeflow-app/system-tokens.html memeflow-app/{CSS_NAME} && git commit -m "Fix Token Flow identity row after V245" && git push')

if __name__=='__main__':
    main()
