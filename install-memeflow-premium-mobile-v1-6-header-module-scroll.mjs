import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PREMIUM_MOBILE_V1_6_HEADER_MODULE_SCROLL';
const OLD=[
  ['<!-- MF_PREMIUM_MOBILE_V1_5_HEADER_SHELL_START -->','<!-- MF_PREMIUM_MOBILE_V1_5_HEADER_SHELL_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV_START -->','<!-- MF_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_START -->','<!-- MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_START -->','<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_START -->','<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_END -->']
];

const START='<!-- MF_PREMIUM_MOBILE_V1_6_HEADER_MODULE_SCROLL_START -->';
const END='<!-- MF_PREMIUM_MOBILE_V1_6_HEADER_MODULE_SCROLL_END -->';

const STYLE=`${START}
<style id="mf-premium-mobile-v1-6-header-module-scroll">
/*
  V1.6 — MOBILE ONLY.
  Goal:
  1) Top header is exactly the same outer width as normal modules in .main.
  2) Header is NOT sticky/fixed; it scrolls away with page content.
  3) Tablet/desktop are untouched.
  4) Wallet remains a bare icon in the first row.
*/
@media(max-width:600px){
  /* Header becomes an ordinary module in the page flow. */
  .topbar{
    box-sizing:border-box!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    grid-template-rows:auto auto!important;
    align-items:center!important;
    column-gap:10px!important;
    row-gap:0!important;

    /* SAME WIDTH AS OTHER MODULES: respect .main horizontal padding. */
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    margin:0 0 10px!important;
    padding:12px 14px 10px!important;

    /* Normal module appearance. */
    border:1px solid rgba(145,166,190,.18)!important;
    outline:0!important;
    border-radius:16px!important;
    background:linear-gradient(180deg,rgba(14,20,28,.94),rgba(8,12,17,.97))!important;
    box-shadow:none!important;
    backdrop-filter:none!important;
    -webkit-backdrop-filter:none!important;
    overflow:hidden!important;

    /* Critical: never pin the header. */
    position:static!important;
    inset:auto!important;
    top:auto!important;
    right:auto!important;
    bottom:auto!important;
    left:auto!important;
    z-index:auto!important;
    transform:none!important;
  }

  .topbar::before,.topbar::after{
    content:none!important;
    display:none!important;
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

  /* Wallet remains on the same line, without its own tile/frame. */
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
    overflow:visible!important;
    position:static!important;
  }

  .top-actions .chip,
  .top-actions #focusToggle,
  .top-actions #presentationBtn,
  .top-actions #themeToggle{display:none!important}

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

  .top-actions #walletConnectTop svg,
  .top-actions #walletConnectTop img{
    display:block!important;
    width:27px!important;
    height:27px!important;
    max-width:27px!important;
    max-height:27px!important;
    margin:0!important;
    padding:0!important;
  }

  /* Status row stays inside the same module. */
  .topbar .connection-strip,.connection-strip{
    grid-column:1/-1!important;
    grid-row:2!important;
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    align-items:center!important;
    width:100%!important;
    min-width:0!important;
    margin:9px 0 0!important;
    padding:8px 0 0!important;
    border:0!important;
    border-top:1px solid rgba(145,166,190,.16)!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
    outline:0!important;
    position:static!important;
  }

  .connection-strip .connection-item{
    min-height:22px!important;
    padding:0 6px!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  .connection-strip .connection-item:first-child{
    border-right:1px solid rgba(145,166,190,.16)!important;
  }
}

/* Explicitly do NOT apply this module-scroll treatment to tablets. */
@media(min-width:601px){
  .topbar.mf-v16-noop{display:initial}
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
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

if(!fs.existsSync(target)){
  console.error('ERROR: index.html not found');
  process.exit(1);
}

let html=fs.readFileSync(target,'utf8');
if(!html.includes('MF_PREMIUM_MOBILE_V1_STYLE_START')){
  console.error('ERROR: Premium Mobile V1 is not installed');
  process.exit(1);
}

const backup=target+'.before-premium-mobile-v1-6-header-module-scroll.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

for(const [a,b] of OLD)html=stripRange(html,a,b);
html=stripRange(html,START,END);

const headClose=html.lastIndexOf('</head>');
if(headClose<0){
  console.error('ERROR: missing </head>');
  process.exit(1);
}

html=html.slice(0,headClose)+'\n'+STYLE+'\n'+html.slice(headClose);
fs.writeFileSync(target,html,'utf8');

console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Mobile only <=600px: YES');
console.log('Header width = normal module width: YES');
console.log('Header scrolls with page: YES');
console.log('Sticky/fixed disabled: YES');
console.log('Tablet changed: NO');
console.log('Rollback available: YES');
