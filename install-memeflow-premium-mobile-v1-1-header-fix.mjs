import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PREMIUM_MOBILE_V1_1_HEADER_FIX';
const STYLE_START='<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_START -->';
const STYLE_END='<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_END -->';

const STYLE=`${STYLE_START}
<style id="mf-premium-mobile-v1-1-header-fix">
/* Header-only correction. Keeps Premium Mobile V1 everywhere else. */
@media(max-width:820px){
  .topbar{
    width:auto!important;
    max-width:none!important;
    margin:0 -12px 10px!important;
    padding:9px 12px!important;
    border-radius:0!important;
    border-top:0!important;
    border-left:0!important;
    border-right:0!important;
    border-bottom:1px solid var(--line)!important;
    box-shadow:none!important;
    gap:10px!important;
    align-items:center!important;
    justify-content:space-between!important;
    overflow:visible!important;
  }
  .top-left{
    flex:1 1 auto!important;
    min-width:0!important;
    max-width:calc(100% - 62px)!important;
    gap:7px!important;
  }
  .top-actions{
    flex:0 0 auto!important;
    width:auto!important;
    min-width:0!important;
    margin:0!important;
    padding:0!important;
  }
  #walletConnectTop{
    flex:0 0 auto!important;
    max-width:52px!important;
    min-width:46px!important;
    min-height:46px!important;
    padding:7px 9px!important;
    margin:0!important;
  }
}
@media(max-width:430px){
  .topbar{margin-left:-9px!important;margin-right:-9px!important}
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
  console.error('ERROR: Premium Mobile V1 is not installed. Install V1 first.');
  process.exit(1);
}

const backup=target+'.before-premium-mobile-v1-1-header-fix.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

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
console.log('Header full-bleed restored: YES');
console.log('Rounded floating topbar removed: YES');
console.log('Wallet button constrained inside viewport: YES');
console.log('Rollback available: YES');
