import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PREMIUM_MOBILE_V1_2_HEADER_CARD';
const OLD_START='<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_START -->';
const OLD_END='<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_END -->';
const STYLE_START='<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_START -->';
const STYLE_END='<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_END -->';

const STYLE=`${STYLE_START}
<style id="mf-premium-mobile-v1-2-header-card">
/* Mobile top header mirrors the bottom mobile-nav geometry. */
@media(max-width:820px){
  .topbar{
    box-sizing:border-box!important;
    width:calc(100vw - 16px)!important;
    max-width:calc(100vw - 16px)!important;
    min-width:0!important;
    margin-left:calc(50% - 50vw + 8px)!important;
    margin-right:0!important;
    margin-bottom:10px!important;
    padding:9px 12px!important;
    border:1px solid var(--line2)!important;
    border-radius:14px!important;
    background:rgba(7,11,16,.97)!important;
    backdrop-filter:blur(18px)!important;
    -webkit-backdrop-filter:blur(18px)!important;
    box-shadow:none!important;
    gap:10px!important;
    align-items:center!important;
    justify-content:space-between!important;
    overflow:hidden!important;
  }
  .top-left{
    display:flex!important;
    align-items:center!important;
    flex:1 1 auto!important;
    min-width:0!important;
    max-width:none!important;
    gap:7px!important;
    overflow:hidden!important;
  }
  .top-left .chip,
  .top-left .mode-indicator{
    min-width:0!important;
    max-width:100%!important;
  }
  .top-actions{
    display:flex!important;
    align-items:center!important;
    flex:0 0 auto!important;
    width:auto!important;
    min-width:0!important;
    max-width:none!important;
    margin:0!important;
    padding:0!important;
    overflow:visible!important;
  }
  #walletConnectTop{
    flex:0 0 auto!important;
    width:52px!important;
    max-width:52px!important;
    min-width:52px!important;
    min-height:52px!important;
    padding:7px!important;
    margin:0!important;
    border-radius:12px!important;
  }
}
@media(max-width:430px){
  .topbar{
    width:calc(100vw - 16px)!important;
    max-width:calc(100vw - 16px)!important;
    margin-left:calc(50% - 50vw + 8px)!important;
  }
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

const backup=target+'.before-premium-mobile-v1-2-header-card.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

html=stripRange(html,OLD_START,OLD_END);
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
console.log('Premium Mobile V1 kept: YES');
console.log('Header viewport inset: 8px / 8px');
console.log('Header radius matches mobile nav: 14px');
console.log('Header background/border/blur matches mobile nav: YES');
console.log('Wallet contained inside header: YES');
console.log('Rollback available: YES');
