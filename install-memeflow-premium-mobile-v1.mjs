import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PREMIUM_MOBILE_V1';
const STYLE_START='<!-- MF_PREMIUM_MOBILE_V1_STYLE_START -->';
const STYLE_END='<!-- MF_PREMIUM_MOBILE_V1_STYLE_END -->';
const SCRIPT_START='/* MF_PREMIUM_MOBILE_V1_SCRIPT_START */';
const SCRIPT_END='/* MF_PREMIUM_MOBILE_V1_SCRIPT_END */';

const STYLE=`${STYLE_START}
<style id="mf-premium-mobile-v1-style">
/* MEMEFLOW Premium Mobile V1 — presentation only. No trading/business logic. */

/* ---------- subtle global polish ---------- */
:root{
  --mf-pm-line:rgba(145,166,190,.105);
  --mf-pm-line-strong:rgba(145,166,190,.18);
  --mf-pm-soft:rgba(255,255,255,.018);
  --mf-pm-soft-2:rgba(255,255,255,.028);
}

@media(max-width:820px){
  :root{--mobile-nav-height:68px!important}

  /* 1) Higher information density: ~20% less vertical waste. */
  .main{
    padding:calc(10px + env(safe-area-inset-top,0px)) 12px calc(var(--mobile-nav-height) + var(--mobile-safe-bottom) + 34px)!important;
  }
  .grid{gap:9px!important}
  .panel{border-radius:16px!important;border-color:var(--mf-pm-line-strong)!important}
  .panel-head{padding:10px 12px!important;min-height:50px!important}
  .panel-body{padding:11px 12px!important}
  .panel-head h2{font-size:13px!important}
  .eyebrow{font-size:8px!important;letter-spacing:.14em!important}

  /* 2) Compact top status area. Keep only the two statuses users need constantly. */
  .topbar{
    padding:8px 10px!important;
    margin:0 0 8px!important;
    gap:8px!important;
    border-radius:14px!important;
    min-height:62px!important;
  }
  .top-left{gap:7px!important;min-width:0!important}
  .top-left .mode-indicator{display:none!important}
  .top-left>.chip,.top-plan-badge{
    padding:7px 10px!important;
    font-size:9px!important;
    min-height:34px!important;
    display:inline-flex!important;
    align-items:center!important;
  }
  .top-actions{gap:6px!important;width:auto!important}
  .top-actions>.chip,.top-actions #focusToggle{display:none!important}
  #walletConnectTop{min-height:38px!important;padding:7px 10px!important}

  .connection-strip{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:0!important;
    margin:0 0 10px!important;
    padding:0 2px 8px!important;
    border-bottom:1px solid var(--mf-pm-line-strong)!important;
  }
  .connection-strip .connection-item{
    min-height:28px!important;
    padding:2px 8px!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
  }
  .connection-strip .connection-item:first-child{border-right:1px solid var(--mf-pm-line-strong)!important}
  .connection-strip .connection-item:nth-child(n+3){display:none!important}
  .connection-item small{display:none!important}
  .connection-item b{font-size:10px!important;font-weight:560!important;color:var(--muted)!important}
  .connection-item i{width:7px!important;height:7px!important}

  /* 3) Mission/context card: same hierarchy, much less height. */
  .context-banner{
    grid-template-columns:minmax(0,1fr)!important;
    gap:10px!important;
    padding:15px 16px!important;
    margin:0 0 10px!important;
    border-radius:16px!important;
    box-shadow:none!important;
  }
  .context-icon{display:none!important}
  .context-copy small{font-size:8px!important}
  .context-copy b{font-size:22px!important;line-height:1.08!important;margin:6px 0 0!important}
  .context-copy p{font-size:11px!important;line-height:1.42!important;margin-top:9px!important;max-width:620px!important}
  .context-actions{grid-column:auto!important;grid-template-columns:1.18fr .82fr!important;gap:8px!important}
  .context-actions .btn{min-height:44px!important;padding:8px 10px!important;font-size:11px!important}

  /* 4) Manual scan: premium but compact. JS adds data attribute safely. */
  [data-mf-premium="manual-scan"]{margin-bottom:10px!important}
  [data-mf-premium="manual-scan"] .panel-head,[data-mf-premium="manual-scan"]>header{padding-block:11px!important}
  [data-mf-premium="manual-scan"] input{min-height:48px!important}
  [data-mf-premium="manual-scan"] .btn,[data-mf-premium="manual-scan"] button{min-height:48px!important}
  [data-mf-premium="manual-scan"] p{font-size:10.5px!important;line-height:1.42!important}

  /* 5) Primary Candidate remains the visual benchmark. Waiting state becomes shorter. */
  #primary-candidate{margin-top:10px!important}
  #primary-candidate .panel-head{padding:10px 12px!important}
  #primary-candidate .primary-card{gap:9px!important}
  #primary-candidate.mf-pm-empty .metric-row,
  #primary-candidate.mf-pm-empty .check-strip{display:none!important}
  #primary-candidate.mf-pm-empty .primary-card{gap:8px!important}
  #primary-candidate.mf-pm-empty .reason{margin:8px 0!important;padding:10px 11px!important}

  /* 6) Pre-trade: summary first, detailed seven-check grid on demand. */
  #executionPreview{
    margin:10px 0!important;
    padding:11px 12px!important;
    border-radius:16px!important;
    box-shadow:none!important;
  }
  #executionPreview .execution-head{
    padding:0 2px 9px!important;
    margin:0!important;
    border-bottom:1px solid var(--mf-pm-line)!important;
  }
  #executionPreview .signal-explainer{
    margin:8px 0!important;
    padding:9px 10px!important;
    border-radius:10px!important;
    font-size:10px!important;
    line-height:1.4!important;
  }
  #executionPreview .primary-blocker{
    margin:8px 0!important;
    padding:10px 11px!important;
    border-color:rgba(242,198,104,.18)!important;
    background:rgba(242,198,104,.025)!important;
  }
  #executionPreview .primary-blocker span{font-size:9.5px!important;line-height:1.38!important}
  #executionPreview .execution-readiness{margin:8px 0 0!important;padding:9px 10px!important}
  #executionPreview .execution-grid{
    display:none!important;
    grid-template-columns:1fr 1fr!important;
    gap:6px!important;
    padding:7px 0 2px!important;
    background:transparent!important;
  }
  #executionPreview.mf-pm-checks-open .execution-grid{display:grid!important}
  #executionPreview .exec-cell{
    min-height:54px!important;
    padding:8px 9px!important;
    border:0!important;
    border-radius:10px!important;
    background:var(--mf-pm-soft-2)!important;
  }
  #executionPreview .exec-cell:nth-child(7){grid-column:1/-1!important;min-height:50px!important}
  .mf-pm-check-toggle{
    width:100%;
    min-height:40px;
    margin:2px 0 4px;
    border:1px solid var(--mf-pm-line-strong);
    border-radius:10px;
    background:transparent;
    color:#dce5ee;
    font:inherit;
    font-size:10px;
    font-weight:760;
    cursor:pointer;
  }

  /* 7) Billing: application pricing, not a landing page. */
  #billing{margin-top:10px!important}
  #billing .panel-head{padding:11px 12px!important}
  #billing .panel-body{padding:11px 12px 13px!important}
  #billing .subscription-summary{gap:6px!important}
  #billing .subscription-metric{
    padding:9px 10px!important;
    border-color:var(--mf-pm-line)!important;
    background:var(--mf-pm-soft)!important;
    border-radius:11px!important;
  }
  #billing .subscription-metric small{font-size:8px!important}
  #billing .subscription-metric b{font-size:12px!important;margin-top:4px!important}
  #billing .live-lock{padding:10px 11px!important;margin-top:8px!important;border-left-width:2px!important}
  #billing .live-lock .muted{font-size:10px!important;line-height:1.4!important}
  #billing .billing-grid{gap:9px!important;margin-top:10px!important}
  #billing .plan-card{
    padding:15px!important;
    border-radius:15px!important;
    box-shadow:none!important;
    border-color:var(--mf-pm-line-strong)!important;
  }
  #billing .plan-card.featured{border-color:rgba(97,223,255,.52)!important}
  #billing .plan-name{font-size:17px!important}
  #billing .plan-price{font-size:34px!important;margin-top:8px!important}
  #billing .plan-price small{font-size:12px!important}
  #billing .plan-copy{font-size:10.5px!important;line-height:1.4!important;margin-top:8px!important}
  #billing .feature-list{margin-top:12px!important;gap:7px!important}
  #billing .feature{font-size:11px!important;line-height:1.35!important}
  #billing .plan-card .btn{min-height:44px!important;margin-top:10px!important}
  #billing .settings-group{margin-top:10px!important}

  /* 8) Settings: rows instead of giant nested cards. */
  #settings{margin-top:10px!important}
  #settings .settings-hero{
    grid-template-columns:1fr!important;
    gap:10px!important;
    padding:15px!important;
  }
  #settings .settings-hero h2{font-size:21px!important;margin:4px 0 6px!important}
  #settings .settings-hero p{font-size:10.5px!important;line-height:1.42!important}
  #settings .settings-summary{gap:6px!important}
  #settings .settings-summary>div{
    padding:9px 10px!important;
    border-color:var(--mf-pm-line)!important;
    background:var(--mf-pm-soft)!important;
    border-radius:10px!important;
  }
  #settings .settings-summary small{font-size:8px!important}
  #settings .settings-summary b{font-size:12px!important;margin-top:4px!important}
  #settings .settings-body{padding:11px 12px!important}
  #settings .settings-context{
    margin-bottom:9px!important;
    padding:10px 11px!important;
    border-color:rgba(84,221,255,.16)!important;
    background:rgba(84,221,255,.02)!important;
    border-radius:11px!important;
  }
  #settings .settings-context b{font-size:11px!important}
  #settings .settings-context span{font-size:9.5px!important;line-height:1.35!important}
  #settings .settings-accordion{display:grid!important;gap:7px!important}
  #settings .settings-group{
    margin:0!important;
    border-color:var(--mf-pm-line-strong)!important;
    border-radius:13px!important;
    background:rgba(255,255,255,.009)!important;
    box-shadow:none!important;
  }
  #settings .settings-group>summary{
    min-height:72px!important;
    padding:12px 14px!important;
  }
  #settings .settings-group>summary small{font-size:8px!important}
  #settings .settings-group>summary b{font-size:15px!important;line-height:1.12!important;margin-top:4px!important}
  #settings .settings-group>summary em{font-size:9px!important;letter-spacing:.12em!important}
  #settings .settings-group-body{padding:12px 14px!important;border-top-color:var(--mf-pm-line)!important}
  #settings .settings-fields{gap:8px!important}
  #settings .setting-field{gap:5px!important}
  #settings .setting-field label,#settings .setting-field>span{font-size:9px!important}
  #settings .setting-field input,#settings .setting-field select{height:40px!important}
  #settings .toggle-row{padding:9px 0!important}
  #settings .toggle-copy b{font-size:10.5px!important}
  #settings .toggle-copy span{font-size:9px!important;line-height:1.35!important}
  #settings .settings-footer{
    position:static!important;
    margin-top:9px!important;
    padding:10px 11px!important;
    border-radius:12px!important;
    box-shadow:none!important;
  }
  #settings .settings-footer p{font-size:9px!important;line-height:1.35!important}
  #settings .settings-footer-actions{display:grid!important;grid-template-columns:1fr 1fr!important;width:100%!important;gap:7px!important}
  #settings .settings-footer-actions .btn{width:100%!important;min-height:42px!important}
  #settings .settings-footer-actions .btn.primary{grid-column:1/-1!important}

  /* 9) Less visual noise: inner surfaces rely on spacing/background more than borders. */
  #executionPreview .exec-cell,
  #billing .subscription-metric,
  #settings .settings-summary>div{
    box-shadow:none!important;
  }
  .reason{border-left-width:2px!important}

  /* 10) Secondary copy one step quieter/smaller. */
  .objective p,.reason span,.wallet-note,.plan-copy,.settings-footer p{
    color:#8795a6!important;
  }

  /* 11) Bottom navigation: same system, slightly less height. */
  .mobile-nav{
    left:8px!important;
    right:8px!important;
    bottom:calc(6px + var(--mobile-safe-bottom))!important;
    height:var(--mobile-nav-height)!important;
    padding:4px!important;
    border-radius:14px!important;
    border-color:var(--mf-pm-line-strong)!important;
    box-shadow:0 14px 32px rgba(0,0,0,.28)!important;
  }
  .mobile-nav button{
    min-height:42px!important;
    padding:5px 2px!important;
    font-size:11px!important;
  }

  /* 12) Yellow is semantic only, not decorative. */
  #executionPreview,#billing{box-shadow:none!important}
  #executionPreview{border-color:rgba(242,198,104,.25)!important}

  /* Safe compact spacing between main sections. */
  #positions,#billing,#settings,.decision-intelligence,.advanced-intelligence{scroll-margin-top:10px!important}
}

@media(max-width:390px){
  .main{padding-left:9px!important;padding-right:9px!important}
  .context-banner{padding:13px 14px!important}
  .context-copy b{font-size:20px!important}
  .context-actions{grid-template-columns:1fr 1fr!important}
  #billing .plan-price{font-size:31px!important}
  #settings .settings-group>summary{min-height:68px!important;padding:11px 12px!important}
  #settings .settings-group>summary b{font-size:14px!important}
}
</style>
${STYLE_END}`;

const SCRIPT=`${SCRIPT_START}
(()=>{
  'use strict';
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];

  function tagManualScan(){
    const nodes=qa('.eyebrow,small,b,h2,h3');
    const hit=nodes.find(el=>String(el.textContent||'').trim().toUpperCase()==='MANUAL AI SCAN');
    if(!hit)return;
    const host=hit.closest('.panel,section,article,div');
    if(host)host.setAttribute('data-mf-premium','manual-scan');
  }

  function syncPrimaryEmpty(){
    const host=q('#primary-candidate');
    if(!host)return;
    const name=String(q('#primaryName')?.textContent||'').trim().toLowerCase();
    const score=String(q('#primaryScore')?.textContent||'').trim();
    const empty=!name || name==='—' || name.includes('no token') || !score || score==='—';
    host.classList.toggle('mf-pm-empty',empty);
  }

  function installChecksToggle(){
    const host=q('#executionPreview');
    const grid=q('.execution-grid',host||document);
    if(!host||!grid||q('.mf-pm-check-toggle',host))return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='mf-pm-check-toggle';
    btn.setAttribute('aria-expanded','false');
    btn.textContent='View all checks';
    btn.addEventListener('click',()=>{
      const open=host.classList.toggle('mf-pm-checks-open');
      btn.setAttribute('aria-expanded',String(open));
      btn.textContent=open?'Hide detailed checks':'View all checks';
    });
    grid.parentNode.insertBefore(btn,grid);
  }

  function init(){
    tagManualScan();
    syncPrimaryEmpty();
    installChecksToggle();
  }

  init();
  document.addEventListener('memeflow:statechange',syncPrimaryEmpty);
  window.addEventListener('load',init,{once:true});
})();
${SCRIPT_END}`;

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
if(!html.includes('class="mobile-nav"') || !html.includes('id="executionPreview"') || !html.includes('id="billing"') || !html.includes('id="settings"')){
  console.error('ERROR: expected MEMEFLOW production sections were not found. Patch aborted without changes.');
  process.exit(2);
}

const backup=target+'.before-premium-mobile-v1.bak';
const alreadyInstalled=html.includes(STYLE_START)||html.includes(SCRIPT_START);
if(!alreadyInstalled){
  fs.copyFileSync(target,backup);
  console.log('BACKUP:',path.relative(process.cwd(),backup)||backup);
}

html=stripRange(html,STYLE_START,STYLE_END);
html=stripRange(html,SCRIPT_START,SCRIPT_END);

const headClose=html.lastIndexOf('</head>');
const bodyClose=html.lastIndexOf('</body>');
if(headClose<0||bodyClose<0){
  console.error('ERROR: malformed HTML');
  process.exit(3);
}

html=html.slice(0,headClose)+'\n'+STYLE+'\n'+html.slice(headClose);
const newBodyClose=html.lastIndexOf('</body>');
html=html.slice(0,newBodyClose)+'\n<script id="mf-premium-mobile-v1-script">\n'+SCRIPT+'\n</script>\n'+html.slice(newBodyClose);

fs.writeFileSync(target,html,'utf8');
console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Trading logic changed: NO');
console.log('Desktop layout changed: NO (mobile rules only, <=820px)');
console.log('Rollback available: YES');
