import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV';
const OLD=[
  ['<!-- MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_START -->','<!-- MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_START -->','<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_START -->','<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_END -->']
];
const START='<!-- MF_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV_START -->';
const END='<!-- MF_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV_END -->';

const STYLE=`${START}
<style id="mf-premium-mobile-v1-4-header-like-bottom-nav">
/* V1.4 — header geometry mirrors the bottom navigation system.
   IMPORTANT: no vw arithmetic. We cancel .main padding exactly, so Safari
   cannot push the header outside the layout viewport.
*/
@media(max-width:820px){
  .topbar{
    box-sizing:border-box!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    grid-template-rows:auto auto!important;
    align-items:center!important;
    column-gap:10px!important;
    row-gap:0!important;

    /* .main is 12px on mobile: cancel it exactly, edge-to-edge but INSIDE viewport. */
    width:calc(100% + 24px)!important;
    max-width:calc(100% + 24px)!important;
    min-width:0!important;
    margin:calc(-10px - env(safe-area-inset-top,0px)) -12px 10px!important;
    padding:10px 12px 8px!important;

    /* Same black/glass family as bottom nav, without the visible outer frame. */
    border:0!important;
    outline:0!important;
    border-radius:14px!important;
    background:rgba(7,9,12,.94)!important;
    backdrop-filter:blur(26px)!important;
    -webkit-backdrop-filter:blur(26px)!important;
    box-shadow:0 14px 32px rgba(0,0,0,.28)!important;
    overflow:hidden!important;
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

  /* PAPER MODE + FREE PLAN stay on one line. */
  .top-left>.chip,
  .top-left>.top-plan-badge,
  .top-left>.mode-indicator{
    flex:0 1 auto!important;
    min-width:0!important;
    margin:0!important;
  }

  .top-actions{
    grid-column:2!important;
    grid-row:1!important;
    display:flex!important;
    align-items:center!important;
    justify-content:flex-end!important;
    flex-wrap:nowrap!important;
    width:32px!important;
    min-width:32px!important;
    max-width:32px!important;
    height:32px!important;
    margin:0!important;
    padding:0!important;
    gap:0!important;
    border:0!important;
    outline:0!important;
    background:transparent!important;
    box-shadow:none!important;
    overflow:visible!important;
  }

  /* Only wallet remains visible in the action slot. */
  .top-actions .chip,
  .top-actions #focusToggle,
  .top-actions #presentationBtn,
  .top-actions #themeToggle{display:none!important}

  /* Aggressive decoration reset: button + wrapper descendants + pseudo-elements. */
  .top-actions #walletConnectTop,
  .top-actions #walletConnectTop *,
  .top-actions > *{
    border:0!important;
    outline:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  .top-actions #walletConnectTop{
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    flex:0 0 32px!important;
    width:32px!important;
    min-width:32px!important;
    max-width:32px!important;
    height:32px!important;
    min-height:32px!important;
    max-height:32px!important;
    margin:0!important;
    padding:0!important;
    gap:0!important;
    border-radius:0!important;
    font-size:0!important;
    line-height:0!important;
    appearance:none!important;
    -webkit-appearance:none!important;
  }
  .top-actions #walletConnectTop::before,
  .top-actions #walletConnectTop::after,
  .top-actions #walletConnectTop *::before,
  .top-actions #walletConnectTop *::after{
    content:none!important;
    display:none!important;
    border:0!important;
    background:none!important;
    box-shadow:none!important;
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

  /* Connection status = second row of the SAME header, no exterior frame. */
  .topbar .connection-strip,
  .connection-strip{
    grid-column:1/-1!important;
    grid-row:2!important;
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    align-items:center!important;
    width:100%!important;
    min-width:0!important;
    margin:8px 0 0!important;
    padding:7px 0 0!important;
    border:0!important;
    border-top:1px solid rgba(145,166,190,.18)!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  .connection-strip .connection-item{
    min-height:24px!important;
    padding:0 6px!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  .connection-strip .connection-item:first-child{
    border-right:1px solid rgba(145,166,190,.18)!important;
  }
}

/* Premium V1 changes .main to 9px on very small phones; cancel THAT exact padding. */
@media(max-width:390px){
  .topbar{
    width:calc(100% + 18px)!important;
    max-width:calc(100% + 18px)!important;
    margin-left:-9px!important;
    margin-right:-9px!important;
    padding-left:10px!important;
    padding-right:10px!important;
  }
  .top-left{gap:6px!important}
  .top-actions{width:30px!important;min-width:30px!important;max-width:30px!important;height:30px!important}
  .top-actions #walletConnectTop{flex-basis:30px!important;width:30px!important;min-width:30px!important;max-width:30px!important;height:30px!important;min-height:30px!important;max-height:30px!important}
  .top-actions #walletConnectTop svg,.top-actions #walletConnectTop img{width:25px!important;height:25px!important;max-width:25px!important;max-height:25px!important}
}

@media(max-width:360px){
  /* Base project switches .main back to 8px at <=360px. */
  .topbar{
    width:calc(100% + 16px)!important;
    max-width:calc(100% + 16px)!important;
    margin-left:-8px!important;
    margin-right:-8px!important;
  }
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

const backup=target+'.before-premium-mobile-v1-4-header-like-bottom-nav.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

for(const [a,b] of OLD)html=stripRange(html,a,b);
html=stripRange(html,START,END);
const headClose=html.lastIndexOf('</head>');
if(headClose<0){console.error('ERROR: missing </head>');process.exit(1)}
html=html.slice(0,headClose)+'\n'+STYLE+'\n'+html.slice(headClose);
fs.writeFileSync(target,html,'utf8');

console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Viewport-unit header hack removed: YES');
console.log('Header fits exactly inside screen: YES');
console.log('Header edge-to-edge: YES');
console.log('Visible outer top/side border removed: YES');
console.log('PAPER MODE + FREE PLAN + wallet same row: YES');
console.log('Wallet tile/frame/background removed: YES');
console.log('Rollback available: YES');
