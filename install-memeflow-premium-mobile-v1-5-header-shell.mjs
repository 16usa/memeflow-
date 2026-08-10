import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PREMIUM_MOBILE_V1_5_HEADER_SHELL';
const OLD=[
  ['<!-- MF_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV_START -->','<!-- MF_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_START -->','<!-- MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_START -->','<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_START -->','<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_END -->']
];
const START='<!-- MF_PREMIUM_MOBILE_V1_5_HEADER_SHELL_START -->';
const END='<!-- MF_PREMIUM_MOBILE_V1_5_HEADER_SHELL_END -->';

const STYLE=`${START}
<style id="mf-premium-mobile-v1-5-header-shell">
/* V1.5 — top header behaves like the bottom navigation SHELL, not a bordered card.
   The shell itself is full-bleed. All content lives INSIDE via padding.
   No visible outer top/left/right frame. Only the free edge is rounded.
*/
@media(max-width:820px){
  html,body,.app,.main{max-width:100%!important;overflow-x:hidden!important}

  .topbar{
    box-sizing:border-box!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    grid-template-rows:auto auto!important;
    align-items:center!important;
    column-gap:10px!important;
    row-gap:0!important;

    /* Full bleed: cancel ONLY .main's horizontal padding. No vw math. */
    width:auto!important;
    max-width:none!important;
    min-width:0!important;
    margin:calc(-10px - env(safe-area-inset-top,0px)) -12px 10px!important;
    padding:14px 16px 10px!important;

    /* Like bottom nav: one dark glass surface, NO exterior outline. */
    border:0!important;
    border-top:0!important;
    border-left:0!important;
    border-right:0!important;
    outline:0!important;
    outline-offset:0!important;
    border-radius:0 0 22px 22px!important;
    background:rgba(7,9,12,.96)!important;
    backdrop-filter:blur(26px)!important;
    -webkit-backdrop-filter:blur(26px)!important;
    box-shadow:0 12px 30px rgba(0,0,0,.24)!important;
    overflow:hidden!important;
    isolation:isolate!important;
  }
  .topbar::before,.topbar::after{
    content:none!important;
    display:none!important;
    border:0!important;
    outline:0!important;
    box-shadow:none!important;
    background:none!important;
  }

  .top-left{
    grid-column:1!important;
    grid-row:1!important;
    display:flex!important;
    align-items:center!important;
    flex-wrap:nowrap!important;
    gap:8px!important;
    min-width:0!important;
    width:auto!important;
    max-width:100%!important;
    margin:0!important;
    padding:0!important;
    overflow:hidden!important;
  }
  .top-left>.chip,.top-left>.top-plan-badge,.top-left>.mode-indicator{
    flex:0 1 auto!important;
    min-width:0!important;
    margin:0!important;
  }

  /* Wallet is a bare icon in the SAME first row as PAPER MODE / FREE PLAN. */
  .top-actions{
    grid-column:2!important;
    grid-row:1!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    width:34px!important;
    min-width:34px!important;
    max-width:34px!important;
    height:34px!important;
    min-height:34px!important;
    max-height:34px!important;
    margin:0!important;
    padding:0!important;
    gap:0!important;
    border:0!important;
    outline:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
    filter:none!important;
    overflow:visible!important;
  }
  .top-actions .chip,.top-actions #focusToggle,.top-actions #presentationBtn,.top-actions #themeToggle{display:none!important}

  /* Reset the ENTIRE wallet action subtree, including unknown wrappers from current UI. */
  .topbar .top-actions,
  .topbar .top-actions > *,
  .topbar .top-actions > * > *,
  .topbar .top-actions #walletConnectTop,
  .topbar .top-actions #walletConnectTop *{
    border:0!important;
    outline:0!important;
    background:transparent!important;
    box-shadow:none!important;
    filter:none!important;
  }
  .topbar .top-actions > *::before,
  .topbar .top-actions > *::after,
  .topbar .top-actions #walletConnectTop::before,
  .topbar .top-actions #walletConnectTop::after,
  .topbar .top-actions #walletConnectTop *::before,
  .topbar .top-actions #walletConnectTop *::after{
    content:none!important;
    display:none!important;
    border:0!important;
    background:none!important;
    box-shadow:none!important;
  }
  .top-actions #walletConnectTop{
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    flex:0 0 34px!important;
    width:34px!important;
    min-width:34px!important;
    max-width:34px!important;
    height:34px!important;
    min-height:34px!important;
    max-height:34px!important;
    margin:0!important;
    padding:0!important;
    gap:0!important;
    border-radius:0!important;
    font-size:0!important;
    line-height:0!important;
    appearance:none!important;
    -webkit-appearance:none!important;
  }
  .top-actions #walletConnectTop svg,.top-actions #walletConnectTop img{
    display:block!important;
    width:28px!important;
    height:28px!important;
    max-width:28px!important;
    max-height:28px!important;
    margin:0!important;
    padding:0!important;
  }

  /* Second row remains INSIDE the same dark shell. */
  .topbar .connection-strip,.connection-strip{
    grid-column:1/-1!important;
    grid-row:2!important;
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    align-items:center!important;
    width:100%!important;
    min-width:0!important;
    margin:10px 0 0!important;
    padding:8px 0 0!important;
    border:0!important;
    border-top:1px solid rgba(145,166,190,.16)!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
    outline:0!important;
  }
  .connection-strip .connection-item{
    min-height:22px!important;
    padding:0 6px!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  .connection-strip .connection-item:first-child{border-right:1px solid rgba(145,166,190,.16)!important}
}

/* Premium V1 uses 9px side padding at <=390px. Cancel exactly that. */
@media(max-width:390px){
  .topbar{
    margin-left:-9px!important;
    margin-right:-9px!important;
    padding-left:13px!important;
    padding-right:13px!important;
  }
  .top-left{gap:6px!important}
  .top-actions,.top-actions #walletConnectTop{
    width:32px!important;min-width:32px!important;max-width:32px!important;
    height:32px!important;min-height:32px!important;max-height:32px!important;
  }
  .top-actions #walletConnectTop{flex-basis:32px!important}
  .top-actions #walletConnectTop svg,.top-actions #walletConnectTop img{width:26px!important;height:26px!important;max-width:26px!important;max-height:26px!important}
}

/* Base project uses 8px side padding at <=360px. */
@media(max-width:360px){
  .topbar{margin-left:-8px!important;margin-right:-8px!important}
}
</style>
${END}`;

function stripRange(text,start,end){
  for(;;){
    const a=text.indexOf(start); if(a<0)break;
    const b=text.indexOf(end,a); if(b<0)break;
    text=text.slice(0,a)+text.slice(b+end.length);
  }
  return text;
}

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html')) ? path.resolve('memeflow-app/index.html') : path.resolve('index.html'));

if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1)}
let html=fs.readFileSync(target,'utf8');
if(!html.includes('MF_PREMIUM_MOBILE_V1_STYLE_START')){console.error('ERROR: Premium Mobile V1 is not installed');process.exit(1)}

const backup=target+'.before-premium-mobile-v1-5-header-shell.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

for(const [a,b] of OLD)html=stripRange(html,a,b);
html=stripRange(html,START,END);
const headClose=html.lastIndexOf('</head>');
if(headClose<0){console.error('ERROR: missing </head>');process.exit(1)}
html=html.slice(0,headClose)+'\n'+STYLE+'\n'+html.slice(headClose);
fs.writeFileSync(target,html,'utf8');

console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Full-bleed header shell: YES');
console.log('Outer top/left/right frame: NONE');
console.log('Rounded free edge like bottom nav: YES');
console.log('Content stays inside viewport: YES');
console.log('Wallet same first row: YES');
console.log('Wallet wrapper/tile/frame reset: YES');
console.log('Rollback available: YES');
