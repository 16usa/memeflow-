import fs from 'node:fs';
import path from 'node:path';

const VERSION='MEMEFLOW_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV';

const OLD=[
  ['<!-- MF_PREMIUM_MOBILE_V1_6_HEADER_MODULE_SCROLL_START -->','<!-- MF_PREMIUM_MOBILE_V1_6_HEADER_MODULE_SCROLL_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_5_HEADER_SHELL_START -->','<!-- MF_PREMIUM_MOBILE_V1_5_HEADER_SHELL_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV_START -->','<!-- MF_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_START -->','<!-- MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_START -->','<!-- MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_START -->','<!-- MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_END -->'],
  ['<!-- MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_START -->','<!-- MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_END -->'],
  ['/* MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_JS_START */','/* MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_JS_END */']
];

const STYLE_START='<!-- MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_START -->';
const STYLE_END='<!-- MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_END -->';
const JS_START='/* MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_JS_START */';
const JS_END='/* MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_JS_END */';

const STYLE=`${STYLE_START}
<style id="mf-premium-mobile-v1-7-header-like-bottom-nav">
@media(max-width:600px){
  /*
    V1.7 mobile only.
    Geometry is copied at runtime from .mobile-nav, so no guessed viewport
    width or hard-coded side offsets are used.
  */
  .topbar{
    box-sizing:border-box!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    grid-template-rows:auto auto!important;
    align-items:center!important;
    column-gap:10px!important;
    row-gap:0!important;

    /* JS writes exact left shift + exact width from bottom nav. */
    max-width:none!important;
    min-width:0!important;
    margin-right:0!important;
    margin-bottom:10px!important;
    padding:12px 14px 10px!important;

    /* Scroll with page — never pinned. */
    position:static!important;
    inset:auto!important;
    top:auto!important;
    right:auto!important;
    bottom:auto!important;
    left:auto!important;
    z-index:auto!important;
    transform:none!important;

    overflow:hidden!important;
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
</style>
${STYLE_END}`;

const SCRIPT=`<script>
${JS_START}
(()=>{
  const mq=window.matchMedia('(max-width:600px)');
  const props=[
    'width','marginLeft','marginTop','borderRadius','borderTopWidth','borderRightWidth',
    'borderBottomWidth','borderLeftWidth','borderTopStyle','borderRightStyle',
    'borderBottomStyle','borderLeftStyle','borderTopColor','borderRightColor',
    'borderBottomColor','borderLeftColor','background','boxShadow',
    'backdropFilter','webkitBackdropFilter'
  ];

  const clear=()=>{
    const h=document.querySelector('.topbar');
    if(!h)return;
    for(const p of props)h.style[p]='';
    h.removeAttribute('data-mf-v17-nav-copy');
  };

  const apply=()=>{
    const h=document.querySelector('.topbar');
    const nav=document.querySelector('.mobile-nav');
    if(!h||!nav)return;

    if(!mq.matches){
      clear();
      return;
    }

    /*
      First return header to its natural in-flow geometry so its current left
      edge can be measured without accumulating previous corrections.
    */
    h.style.width='';
    h.style.marginLeft='0px';
    h.style.marginTop='0px';

    const parent=h.parentElement;
    const parentStyle=parent ? getComputedStyle(parent) : null;
    const parentPadTop=parentStyle ? (parseFloat(parentStyle.paddingTop)||0) : 0;

    const navRect=nav.getBoundingClientRect();
    const headRect=h.getBoundingClientRect();
    const navStyle=getComputedStyle(nav);

    /*
      Exact horizontal geometry from the real lower navigation:
      no 50vw, no guessed 8/12px.
    */
    const shift=Math.round((navRect.left-headRect.left)*100)/100;
    const width=Math.round(navRect.width*100)/100;

    h.style.width=width+'px';
    h.style.marginLeft=shift+'px';

    /*
      Since the header is the first module, consume the parent's top padding
      so its outer shell reaches the same top boundary behavior as the lower nav.
      It remains position:static and scrolls normally.
    */
    h.style.marginTop=(-parentPadTop)+'px';

    /* Copy the visible shell styling from the actual bottom menu. */
    h.style.borderRadius=navStyle.borderRadius;
    h.style.borderTopWidth=navStyle.borderTopWidth;
    h.style.borderRightWidth=navStyle.borderRightWidth;
    h.style.borderBottomWidth=navStyle.borderBottomWidth;
    h.style.borderLeftWidth=navStyle.borderLeftWidth;
    h.style.borderTopStyle=navStyle.borderTopStyle;
    h.style.borderRightStyle=navStyle.borderRightStyle;
    h.style.borderBottomStyle=navStyle.borderBottomStyle;
    h.style.borderLeftStyle=navStyle.borderLeftStyle;
    h.style.borderTopColor=navStyle.borderTopColor;
    h.style.borderRightColor=navStyle.borderRightColor;
    h.style.borderBottomColor=navStyle.borderBottomColor;
    h.style.borderLeftColor=navStyle.borderLeftColor;
    h.style.background=navStyle.background;
    h.style.boxShadow=navStyle.boxShadow;
    h.style.backdropFilter=navStyle.backdropFilter;
    h.style.webkitBackdropFilter=navStyle.webkitBackdropFilter;

    h.setAttribute('data-mf-v17-nav-copy','yes');
  };

  const schedule=()=>{
    if(typeof requestAnimationFrame==='function'){
      requestAnimationFrame(()=>requestAnimationFrame(apply));
    }else{
      setTimeout(apply,0);
    }
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',schedule,{once:true});
  }else{
    schedule();
  }

  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  if(mq.addEventListener)mq.addEventListener('change',schedule);
  else if(mq.addListener)mq.addListener(schedule);

  if(document.fonts?.ready)document.fonts.ready.then(schedule).catch(()=>{});
})();
${JS_END}
</script>`;

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

const backup=target+'.before-premium-mobile-v1-7-header-like-bottom-nav.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);

for(const [a,b] of OLD)html=stripRange(html,a,b);

const headClose=html.lastIndexOf('</head>');
if(headClose<0){
  console.error('ERROR: missing </head>');
  process.exit(1);
}
html=html.slice(0,headClose)+'\n'+STYLE+'\n'+html.slice(headClose);

const bodyClose=html.lastIndexOf('</body>');
if(bodyClose<0){
  console.error('ERROR: missing </body>');
  process.exit(1);
}
html=html.slice(0,bodyClose)+'\n'+SCRIPT+'\n'+html.slice(bodyClose);

fs.writeFileSync(target,html,'utf8');

console.log('PATCHED:',path.relative(process.cwd(),target)||target);
console.log('VERSION:',VERSION);
console.log('Mobile only <=600px: YES');
console.log('Header geometry copied from real bottom nav: YES');
console.log('No guessed side offsets: YES');
console.log('Header scrolls with page: YES');
console.log('Tablet/desktop changed: NO');
console.log('Rollback available: YES');
