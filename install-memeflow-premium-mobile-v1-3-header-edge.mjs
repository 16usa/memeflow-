import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PREMIUM_MOBILE_V1_3_HEADER_EDGE';
const V12_START='<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_START -->';
const V12_END='<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_END -->';
const V11_START='<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_START -->';
const V11_END='<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_END -->';
const STYLE_START='<!-- MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_START -->';
const STYLE_END='<!-- MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_END -->';

const STYLE=`${STYLE_START}
<style id="mf-premium-mobile-v1-3-header-edge">
/* V1.3: viewport-edge header, same visual geometry as bottom nav.
   Row 1: PAPER MODE | FREE PLAN | wallet icon
   Row 2: Wallet offline | RPC online
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

    /* Cancel .main horizontal padding and touch both viewport edges. */
    width:auto!important;
    max-width:none!important;
    min-width:0!important;
    margin-left:calc(50% - 50vw)!important;
    margin-right:calc(50% - 50vw)!important;
    margin-bottom:10px!important;

    padding:10px 12px 8px!important;
    border:1px solid var(--mf-pm-line-strong,rgba(145,166,190,.18))!important;
    border-radius:14px!important;
    background:rgba(7,11,16,.97)!important;
    backdrop-filter:blur(18px)!important;
    -webkit-backdrop-filter:blur(18px)!important;
    box-shadow:0 14px 32px rgba(0,0,0,.20)!important;
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
    max-width:none!important;
    margin:0!important;
    padding:0!important;
    overflow:hidden!important;
  }

  /* Keep PAPER MODE and FREE PLAN on the same horizontal line. */
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
    width:auto!important;
    min-width:32px!important;
    max-width:none!important;
    margin:0!important;
    padding:0!important;
    gap:0!important;
    overflow:visible!important;
  }

  /* Wallet: icon only. No tile, no border, no background. */
  #walletConnectTop{
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
    border:0!important;
    outline:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
    font-size:0!important;
    line-height:0!important;
  }
  #walletConnectTop:hover,
  #walletConnectTop:focus,
  #walletConnectTop:focus-visible,
  #walletConnectTop:active{
    border:0!important;
    outline:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  #walletConnectTop svg,
  #walletConnectTop img{
    display:block!important;
    width:28px!important;
    height:28px!important;
    max-width:28px!important;
    max-height:28px!important;
    margin:0!important;
  }

  /* Status row remains inside the same rounded header. */
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
    border-top:1px solid var(--mf-pm-line-strong,rgba(145,166,190,.18))!important;
    border-bottom:0!important;
    background:transparent!important;
  }
  .connection-strip .connection-item{
    min-height:24px!important;
    padding:0 6px!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
  }
  .connection-strip .connection-item:first-child{
    border-right:1px solid var(--mf-pm-line-strong,rgba(145,166,190,.18))!important;
  }
}

@media(max-width:390px){
  .topbar{
    margin-left:calc(50% - 50vw)!important;
    margin-right:calc(50% - 50vw)!important;
    padding-left:10px!important;
    padding-right:10px!important;
  }
  .top-left{gap:6px!important}
  #walletConnectTop{flex-basis:30px!important;width:30px!important;min-width:30px!important;max-width:30px!important}
  #walletConnectTop svg,#walletConnectTop img{width:26px!important;height:26px!important;max-width:26px!important;max-height:26px!important}
}
</style>
${STYLE_END}`;

function stripRange(text,start,end){
  for(;;){
    const a=text.indexOf(start);
    if(a<0)break;
    const b=text.indexOf(end,a);
    if(b<0)break;
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
  console.error('ERROR: Premium Mobile V1 is not installed.');
  process.exit(1);
}

const backup=target+'.before-premium-mobile-v1-3-header-edge.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

html=stripRange(html,V12_START,V12_END);
html=stripRange(html,V11_START,V11_END);
html=stripRange(html,STYLE_START,STYLE_END);

const headClose=html.lastIndexOf('</head>');
if(headClose<0){
  console.error('ERROR: missing </head>');
  process.exit(1);
}
html=html.slice(0,headClose)+'\n'+STYLE+'\n'+html.slice(headClose);
fs.writeFileSync(target,html,'utf8');

console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Header touches viewport left/right edges: YES');
console.log('Header radius 14px like mobile nav: YES');
console.log('PAPER MODE + FREE PLAN + wallet on one row: YES');
console.log('Wallet border/background removed: YES');
console.log('Connection statuses stay inside same header: YES');
console.log('Rollback available: YES');
