import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_NAV_ACTIVE_GLASS_V1';
const STYLE_START='<!-- MF_NAV_ACTIVE_GLASS_V1_STYLE_START -->';
const STYLE_END='<!-- MF_NAV_ACTIVE_GLASS_V1_STYLE_END -->';
const SCRIPT_START='/* MF_NAV_ACTIVE_GLASS_V1_SCRIPT_START */';
const SCRIPT_END='/* MF_NAV_ACTIVE_GLASS_V1_SCRIPT_END */';

const STYLE=`${STYLE_START}
<style id="mf-nav-active-glass-v1-style">
/*
  MEMEFLOW Nav Active Glass V1
  Presentation only:
  - does NOT change navigation order, click handlers, routes, sheets or trading logic
  - changes only the visual ACTIVE state inside .mobile-nav
*/
@media(max-width:1024px){
  .mobile-nav button{
    position:relative!important;
    isolation:isolate!important;
    border:1px solid transparent!important;
    transition:
      background-color 170ms cubic-bezier(.2,.8,.2,1),
      border-color 170ms cubic-bezier(.2,.8,.2,1),
      color 170ms cubic-bezier(.2,.8,.2,1),
      box-shadow 170ms cubic-bezier(.2,.8,.2,1),
      transform 170ms cubic-bezier(.2,.8,.2,1),
      filter 170ms cubic-bezier(.2,.8,.2,1)!important;
  }

  /* Inactive tabs stay quiet and clean. */
  .mobile-nav button:not(.active):not(.mf-nav-ai){
    color:var(--muted)!important;
    background:transparent!important;
    border-color:transparent!important;
    box-shadow:none!important;
    transform:none!important;
  }

  /*
    Standard active tab:
    matte/glass surface + white label + subtle cyan edge + short cyan underline.
    This also removes the old bright left-side activation stripe by forcing
    the same thin border on all four sides.
  */
  .mobile-nav button.active:not(.mf-nav-ai){
    color:#f7fbff!important;
    background:
      linear-gradient(180deg,rgba(255,255,255,.058),rgba(84,221,255,.034)),
      rgba(18,27,38,.72)!important;
    border-color:rgba(84,221,255,.17)!important;
    border-left-color:rgba(84,221,255,.17)!important;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.055),
      inset 0 -1px 0 rgba(84,221,255,.028),
      0 7px 18px rgba(0,0,0,.18)!important;
    transform:translateY(-1px)!important;
    text-shadow:0 1px 10px rgba(255,255,255,.04)!important;
  }

  /* Kill the legacy left activation marker only on normal tabs. */
  .mobile-nav button.active:not(.mf-nav-ai)::before{
    content:none!important;
    display:none!important;
    width:0!important;
    height:0!important;
    border:0!important;
    box-shadow:none!important;
  }

  /* Premium short selection indicator. */
  .mobile-nav button.active:not(.mf-nav-ai)::after{
    content:""!important;
    display:block!important;
    position:absolute!important;
    left:50%!important;
    right:auto!important;
    top:auto!important;
    bottom:4px!important;
    width:22px!important;
    height:2px!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    border-radius:999px!important;
    background:linear-gradient(90deg,rgba(84,221,255,.52),#64e7ff,rgba(81,231,168,.52))!important;
    box-shadow:0 0 10px rgba(84,221,255,.34)!important;
    opacity:1!important;
    transform:translateX(-50%)!important;
    pointer-events:none!important;
  }

  /*
    AI center item: no rectangular pill when active.
    It gets a restrained cyan glow so the stars/icon remain the visual focus.
    Existing icon/pseudo-elements are deliberately preserved.
  */
  .mobile-nav button.mf-nav-ai{
    background:transparent!important;
    border-color:transparent!important;
    box-shadow:none!important;
  }
  .mobile-nav button.mf-nav-ai.active{
    color:#9cecff!important;
    background:transparent!important;
    border-color:transparent!important;
    box-shadow:none!important;
    transform:translateY(-1px) scale(1.055)!important;
    filter:
      drop-shadow(0 0 5px rgba(84,221,255,.44))
      drop-shadow(0 0 12px rgba(84,221,255,.18))!important;
  }

  /* Touch feedback without changing the selected state. */
  .mobile-nav button:active{
    transform:translateY(0) scale(.985)!important;
  }
  .mobile-nav button.mf-nav-ai:active{
    transform:translateY(0) scale(1.02)!important;
  }
}

@media(prefers-reduced-motion:reduce){
  .mobile-nav button{transition:none!important}
}
</style>
${STYLE_END}`;

const SCRIPT=`${SCRIPT_START}
(()=>{
  'use strict';

  /*
    Presentation-only AI detection.
    We add one class so the center AI icon can use a glow instead of a glass pill.
    No click handler, data-sheet, route, active class or navigation logic is changed.
  */
  function tagAiButton(){
    const nav=document.querySelector('.mobile-nav');
    if(!nav)return;

    const buttons=[...nav.querySelectorAll('button')];
    if(!buttons.length)return;

    buttons.forEach(b=>b.classList.remove('mf-nav-ai'));

    let ai=buttons.find((b)=>{
      const hay=[
        b.getAttribute('data-sheet')||'',
        b.getAttribute('aria-label')||'',
        b.getAttribute('title')||'',
        String(b.textContent||'')
      ].join(' ').toLowerCase();
      return /(^|[^a-z])(ai|assistant|intelligence)([^a-z]|$)/.test(hay);
    });

    /*
      Current MEMEFLOW mobile design uses five equal navigation positions
      with the AI control in the visual center. Use the center as a fallback
      only when it looks icon-like rather than like a normal word label.
    */
    if(!ai && buttons.length===5){
      const center=buttons[2];
      const text=String(center.textContent||'').trim();
      const looksIconLike=
        center.querySelector('svg,img') ||
        text.length===0 ||
        /^[^A-Za-zА-Яа-я0-9]{1,8}$/.test(text);

      if(looksIconLike)ai=center;
    }

    if(ai)ai.classList.add('mf-nav-ai');
  }

  tagAiButton();

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',tagAiButton,{once:true});
  }else{
    requestAnimationFrame(tagAiButton);
  }

  window.addEventListener('pageshow',tagAiButton,{passive:true});
})();
${SCRIPT_END}`;

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

if(!html.includes('mobile-nav')){
  console.error('ERROR: .mobile-nav not found. Patch aborted without changes.');
  process.exit(2);
}

const backup=target+'.before-nav-active-glass-v1.bak';
if(!fs.existsSync(backup)){
  fs.copyFileSync(target,backup);
  console.log('BACKUP:',path.relative(process.cwd(),backup)||backup);
}

html=stripRange(html,STYLE_START,STYLE_END);
html=stripRange(html,SCRIPT_START,SCRIPT_END);

const headClose=html.lastIndexOf('</head>');
if(headClose<0){
  console.error('ERROR: missing </head>');
  process.exit(3);
}
html=html.slice(0,headClose)+'\n'+STYLE+'\n'+html.slice(headClose);

const bodyClose=html.lastIndexOf('</body>');
if(bodyClose<0){
  console.error('ERROR: missing </body>');
  process.exit(4);
}
html=html.slice(0,bodyClose)+'\n<script id="mf-nav-active-glass-v1-script">\n'+SCRIPT+'\n</script>\n'+html.slice(bodyClose);

fs.writeFileSync(target,html,'utf8');

console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Navigation logic changed: NO');
console.log('Menu geometry/order changed: NO');
console.log('Active visual: GLASS + SHORT CYAN INDICATOR');
console.log('AI active visual: SOFT CYAN GLOW');
console.log('Rollback available: YES');
