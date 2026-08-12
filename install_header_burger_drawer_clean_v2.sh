#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"
INDEX="$APP/index.html"; V26="$APP/ai-nav-layout-v26.js"; V44="$APP/bottom-nav-flush-v44.js"; V51="$APP/native-ai-sheet-v51.js"
for f in "$INDEX" "$V26" "$V44" "$V51"; do [[ -f "$f" ]] || { echo "ERROR: missing $f"; exit 1; }; done
DIR="$APP/.memeflow-patches/header-burger-drawer-clean-v2"; mkdir -p "$DIR"; STAMP="$(date +%Y%m%d-%H%M%S)"
IB="$DIR/index.html.$STAMP.bak"; B26="$DIR/v26.$STAMP.bak"; B44="$DIR/v44.$STAMP.bak"; B51="$DIR/v51.$STAMP.bak"
IW="$DIR/index.$STAMP.work.html"; W26="$DIR/v26.$STAMP.work.js"; W44="$DIR/v44.$STAMP.work.js"; W51="$DIR/v51.$STAMP.work.js"; P="$DIR/patcher.$STAMP.py"
cp "$INDEX" "$IB"; cp "$V26" "$B26"; cp "$V44" "$B44"; cp "$V51" "$B51"; cp "$INDEX" "$IW"; cp "$V51" "$W51"
cat > "$W26" <<'JS26'
/* MEMEFLOW AI Repair V26 — CLEAN V2
   Desktop bridge only. No phone/tablet navigation ownership.
*/
(() => {
  'use strict';
  if (window.__MEMEFLOW_AI_REPAIR_V26__) return;
  window.__MEMEFLOW_AI_REPAIR_V26__ = true;

  const AI='mf-ai-center-nav-v24';
  const DESKTOP='mf-ai-desktop-v26';
  const STYLE='mf-ai-repair-v26-style';

  function coarse(){
    return !!(navigator.maxTouchPoints>0||window.matchMedia?.('(pointer:coarse)').matches);
  }
  function realDesktop(){
    const w=window.innerWidth||document.documentElement.clientWidth||0;
    return w>1024&&!coarse();
  }
  function installStyle(){
    let s=document.getElementById(STYLE);
    if(!s){s=document.createElement('style');s.id=STYLE;document.head.appendChild(s)}
    s.textContent=`
      #${DESKTOP}{cursor:pointer}
      #${DESKTOP} .mf-v26-star{display:inline-block;margin-right:7px;color:#72e5ff}
      .mf-v26-hide-manual-ai{display:none!important;visibility:hidden!important;pointer-events:none!important}
    `;
  }
  function sidebarNav(){
    const side=document.querySelector('.sidebar');
    return side?.querySelector('nav[aria-label="Main navigation"]')||side?.querySelector('.nav')||null;
  }
  function ensureDesktopAi(){
    let a=document.getElementById(DESKTOP);
    if(!realDesktop()){if(a)a.hidden=true;return}
    const nav=sidebarNav();if(!nav)return;
    if(!a){
      a=document.createElement('a');
      a.id=DESKTOP;a.href='#ai-assistant';
      a.innerHTML='<span class="mf-v26-star" aria-hidden="true">✦</span><span>AI</span>';
      a.addEventListener('click',e=>{e.preventDefault();document.getElementById(AI)?.click()});
    }
    a.hidden=false;
    if(a.parentElement!==nav){
      const anchor=nav.querySelector('a[href="#wallet"]')||nav.querySelector('a[href="#positions"]');
      if(anchor?.nextSibling)nav.insertBefore(a,anchor.nextSibling);else nav.appendChild(a);
    }
  }
  function hideLegacyManual(){
    for(const el of document.querySelectorAll('button,a,[role="button"]')){
      if(el.id===AI||el.id===DESKTOP||el.closest('#sheet-ai'))continue;
      const text=(el.textContent||'').replace(/\s+/g,' ').replace(/[✦★✧]/g,'').trim().toLowerCase();
      if(text!=='open ai assistant'&&el.id!=='mfManualAiButton')continue;
      const area=el.closest('section,article,.panel,.card,[class*="manual"],[id*="manual"]');
      const t=(area?.textContent||'').toLowerCase();
      if(el.id==='mfManualAiButton'||t.includes('manual ai scan')||t.includes('analyze any solana token')){
        el.classList.add('mf-v26-hide-manual-ai');el.setAttribute('aria-hidden','true');el.tabIndex=-1;
      }
    }
  }
  function apply(){ensureDesktopAi();hideLegacyManual()}
  function install(){
    installStyle();apply();
    let timer=0;
    addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(apply,120)},{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

JS26
cat > "$W44" <<'JS44'
/* MEMEFLOW Header Burger Drawer V44 — CLEAN V2
   ONE phone/tablet navigation owner.
   Reuses original .mobile-nav. No bottom bar. No delayed layout retry loop.
*/
(() => {
  'use strict';
  if (window.__MEMEFLOW_BOTTOM_NAV_FLUSH_V44__) return;
  window.__MEMEFLOW_BOTTOM_NAV_FLUSH_V44__ = true;

  const STYLE='mf-bottom-nav-flush-v44-style';
  const AI='mf-ai-center-nav-v24';
  const MENU='mf-mobile-drawer-v2';
  const TRIGGER='mf-menu-trigger-v2';
  const CLOSE='mf-menu-close-v2';
  const BACKDROP='mf-menu-backdrop-v2';
  const MODES=['mf-v44-phone','mf-v44-tablet','mf-v44-desktop'];

  const aiIcon="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='28' viewBox='0 0 30 26'%3E%3Cg fill='%237fe9ff'%3E%3Cpath d='M15 2.4c.73 4.33 3.47 7.07 7.8 7.8-4.33.73-7.07 3.47-7.8 7.8-.73-4.33-3.47-7.07-7.8-7.8 4.33-.73 7.07-3.47 7.8-7.8Z'/%3E%3Cpath d='M5.2 2.3c.29 1.7 1.36 2.77 3.06 3.06-1.7.29-2.77 1.36-3.06 3.06-.29-1.7-1.36-2.77-3.06-3.06 1.7-.29 2.77-1.36 3.06-3.06Z' opacity='.9'/%3E%3Cpath d='M24.2 16.2c.34 2.02 1.62 3.3 3.64 3.64-2.02.34-3.3 1.62-3.64 3.64-.34-2.02-1.62-3.3-3.64-3.64 2.02-.34 3.3-1.62 3.64-3.64Z' opacity='.82'/%3E%3C/g%3E%3C/svg%3E\")";
  const walletIcon="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M4.5 7.25h14A1.75 1.75 0 0 1 20.25 9v8A1.75 1.75 0 0 1 18.5 18.75h-14A1.75 1.75 0 0 1 2.75 17V6.5A1.75 1.75 0 0 1 4.5 4.75h11.25' stroke='%238D99A8' stroke-width='1.7' stroke-linecap='round'/%3E%3Cpath d='M16.25 11h4v4h-4a2 2 0 1 1 0-4Z' stroke='%238D99A8' stroke-width='1.7'/%3E%3C/svg%3E\")";

  const css=`
    [id^="mf-header-wallet-v"]{display:none!important;visibility:hidden!important;pointer-events:none!important}

    body.mf-v44-phone .topbar,body.mf-v44-tablet .topbar{
      display:flex!important;align-items:center!important;justify-content:space-between!important
    }
    body.mf-v44-phone .topbar .top-actions,body.mf-v44-tablet .topbar .top-actions{
      display:flex!important;align-items:center!important;justify-content:flex-end!important;
      flex:0 0 auto!important;width:auto!important;min-width:88px!important;gap:6px!important
    }
    body.mf-v44-phone .topbar .top-actions>:not(#walletConnectTop):not(#${TRIGGER}),
    body.mf-v44-tablet .topbar .top-actions>:not(#walletConnectTop):not(#${TRIGGER}){display:none!important}

    body.mf-v44-phone #walletConnectTop,body.mf-v44-tablet #walletConnectTop,
    body.mf-v44-phone #${TRIGGER},body.mf-v44-tablet #${TRIGGER}{
      display:grid!important;place-items:center!important;visibility:visible!important;pointer-events:auto!important;
      width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;
      max-width:40px!important;max-height:40px!important;flex:0 0 40px!important;
      margin:0!important;padding:0!important;border:0!important;border-radius:10px!important;
      background:transparent!important;box-shadow:none!important;outline:0!important;text-decoration:none!important
    }
    body.mf-v44-phone #walletConnectTop,body.mf-v44-tablet #walletConnectTop{
      font-size:0!important;line-height:0!important;color:transparent!important;background-image:none!important
    }
    body.mf-v44-phone #walletConnectTop>*,body.mf-v44-tablet #walletConnectTop>*{display:none!important}
    body.mf-v44-phone #walletConnectTop::after,body.mf-v44-tablet #walletConnectTop::after{content:none!important;display:none!important}
    body.mf-v44-phone #walletConnectTop::before,body.mf-v44-tablet #walletConnectTop::before{
      content:""!important;display:block!important;width:26px!important;height:26px!important;
      background:${walletIcon} center/26px 26px no-repeat!important
    }

    body.mf-v44-phone #${TRIGGER},body.mf-v44-tablet #${TRIGGER}{color:#9ba8b7!important}
    #${TRIGGER} .mf-menu-lines{
      display:flex!important;flex-direction:column!important;align-items:flex-end!important;justify-content:space-between!important;
      width:22px!important;height:13px!important;pointer-events:none!important
    }
    #${TRIGGER} .mf-menu-line{
      display:block!important;height:2px!important;margin:0!important;padding:0!important;border:0!important;
      border-radius:999px!important;background:currentColor!important;pointer-events:none!important
    }
    #${TRIGGER} .mf-menu-line:first-child{width:22px!important}
    #${TRIGGER} .mf-menu-line:last-child{width:14px!important}

    body.mf-v44-phone,body.mf-v44-tablet{padding-bottom:0!important}
    body.mf-v44-phone .main,body.mf-v44-tablet .main{padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))!important}

    body.mf-v44-phone .mobile-nav,body.mf-v44-tablet .mobile-nav{
      display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;
      gap:10px!important;position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:auto!important;
      height:100dvh!important;max-height:none!important;margin:0!important;
      padding:calc(18px + env(safe-area-inset-top,0px)) 18px calc(20px + env(safe-area-inset-bottom,0px))!important;
      overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;
      grid-template-columns:none!important;grid-template-rows:none!important;
      background:radial-gradient(circle at 88% 4%,rgba(84,221,255,.055),transparent 28%),linear-gradient(180deg,#0b1118,#070b10)!important;
      border:0!important;border-radius:0!important;transform:translate3d(102%,0,0)!important;
      visibility:hidden!important;pointer-events:none!important;opacity:1!important;
      transition:transform .28s cubic-bezier(.2,.82,.2,1),visibility 0s linear .28s!important;z-index:1400!important
    }
    body.mf-v44-phone .mobile-nav{width:100vw!important;min-width:100vw!important;max-width:100vw!important}
    body.mf-v44-tablet .mobile-nav{
      width:min(420px,100vw)!important;min-width:min(420px,100vw)!important;max-width:100vw!important;
      border-left:1px solid rgba(41,57,74,.82)!important;box-shadow:-28px 0 70px rgba(0,0,0,.38)!important
    }
    body.mf-v44-phone.mf-menu-open .mobile-nav,body.mf-v44-tablet.mf-menu-open .mobile-nav{
      transform:translate3d(0,0,0)!important;visibility:visible!important;pointer-events:auto!important;
      transition:transform .28s cubic-bezier(.2,.82,.2,1),visibility 0s linear 0s!important
    }

    .mf-menu-drawer-head{
      display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;
      width:100%!important;min-height:62px!important;padding:2px 0 15px!important;margin:0 0 4px!important;
      border-bottom:1px solid rgba(41,57,74,.74)!important
    }
    .mf-menu-drawer-copy{display:flex!important;flex-direction:column!important;gap:4px!important}
    .mf-menu-drawer-copy small{color:var(--cyan,#54ddff)!important;font-size:9px!important;font-weight:900!important;letter-spacing:.16em!important}
    .mf-menu-drawer-copy b{color:var(--text,#f4f8fb)!important;font-size:22px!important;font-weight:900!important}
    #${CLOSE}{
      display:grid!important;place-items:center!important;width:42px!important;height:42px!important;min-width:42px!important;
      border:1px solid rgba(41,57,74,.82)!important;border-radius:13px!important;background:rgba(255,255,255,.018)!important;
      color:#b7c2cf!important;padding:0!important
    }
    #${CLOSE} span{font-size:24px!important;line-height:1!important}

    body.mf-v44-phone .mobile-nav>[data-sheet],body.mf-v44-tablet .mobile-nav>[data-sheet]{
      display:flex!important;align-items:center!important;justify-content:space-between!important;position:relative!important;
      grid-column:auto!important;grid-row:auto!important;transform:none!important;width:100%!important;min-height:58px!important;
      margin:0!important;padding:15px 17px!important;border:1px solid rgba(41,57,74,.78)!important;border-radius:14px!important;
      background:rgba(255,255,255,.016)!important;color:#aeb9c7!important;font-size:14px!important;font-weight:760!important;text-align:left!important
    }
    body.mf-v44-phone .mobile-nav>[data-sheet].active,body.mf-v44-tablet .mobile-nav>[data-sheet].active{
      border-color:rgba(84,221,255,.45)!important;background:rgba(84,221,255,.055)!important;color:#f4fbff!important
    }
    body.mf-v44-phone .mobile-nav>[data-sheet="home"],body.mf-v44-tablet .mobile-nav>[data-sheet="home"],
    body.mf-v44-phone .mobile-nav>[data-sheet="wallet"],body.mf-v44-tablet .mobile-nav>[data-sheet="wallet"],
    body.mf-v44-phone .mobile-nav>[data-sheet="ai"],body.mf-v44-tablet .mobile-nav>[data-sheet="ai"]{
      display:none!important;visibility:hidden!important;pointer-events:none!important
    }

    #${BACKDROP}{display:none}
    body.mf-v44-tablet #${BACKDROP}{
      display:block;position:fixed;inset:0;background:rgba(1,4,8,.58);opacity:0;visibility:hidden;pointer-events:none;
      transition:opacity .22s ease,visibility 0s linear .22s;z-index:1390
    }
    body.mf-v44-tablet.mf-menu-open #${BACKDROP}{
      opacity:1;visibility:visible;pointer-events:auto;transition:opacity .22s ease,visibility 0s linear 0s
    }

    body.mf-v44-phone #${AI},body.mf-v44-tablet #${AI}{
      position:fixed!important;inset:auto!important;right:16px!important;bottom:calc(18px + env(safe-area-inset-bottom,0px))!important;
      display:grid!important;place-items:center!important;width:56px!important;height:56px!important;min-width:56px!important;
      max-width:56px!important;min-height:56px!important;max-height:56px!important;margin:0!important;padding:0!important;
      border:1px solid rgba(84,221,255,.20)!important;border-radius:18px!important;
      background:linear-gradient(180deg,rgba(18,29,40,.96),rgba(7,12,18,.985))!important;
      box-shadow:0 16px 42px rgba(0,0,0,.34)!important;color:transparent!important;font-size:0!important;line-height:0!important;
      transform:none!important;pointer-events:auto!important;visibility:visible!important;opacity:1!important;z-index:900!important
    }
    body.mf-v44-phone #${AI}>*,body.mf-v44-tablet #${AI}>*{display:none!important}
    body.mf-v44-phone #${AI}::before,body.mf-v44-tablet #${AI}::before{
      content:""!important;display:block!important;width:32px!important;height:28px!important;background:${aiIcon} center/32px 28px no-repeat!important
    }
    body.mf-v44-phone.mf-menu-open #${AI},body.mf-v44-tablet.mf-menu-open #${AI}{
      opacity:0!important;visibility:hidden!important;pointer-events:none!important
    }

    body.mf-v44-phone .mobile-sheet,body.mf-v44-tablet .mobile-sheet{
      padding-bottom:calc(20px + env(safe-area-inset-bottom,0px))!important
    }

    body.mf-v44-desktop #walletConnectTop,body.mf-v44-desktop #${TRIGGER},
    body.mf-v44-desktop #${BACKDROP},body.mf-v44-desktop #${AI}{display:none!important;visibility:hidden!important;pointer-events:none!important}
    body.mf-v44-desktop .mobile-nav{display:none!important}
    body.mf-v44-desktop .sidebar{display:block!important}
  `;

  let previousOverflow='';

  function style(){
    let s=document.getElementById(STYLE);
    if(!s){s=document.createElement('style');s.id=STYLE;document.head.appendChild(s)}
    s.textContent=css;
  }
  function coarse(){return !!(navigator.maxTouchPoints>0||window.matchMedia?.('(pointer:coarse)').matches)}
  function currentMode(){
    const w=window.innerWidth||document.documentElement.clientWidth||0;
    if(w<=820)return'phone';
    if(w<=1024)return'tablet';
    if(w<=1366&&coarse())return'tablet';
    return'desktop';
  }
  function setMode(m){document.body?.classList.remove(...MODES);document.body?.classList.add(`mf-v44-${m}`)}
  function topActions(){
    let h=document.querySelector('.topbar .top-actions');if(h)return h;
    const t=document.querySelector('.topbar');if(!t)return null;
    h=document.createElement('div');h.className='top-actions';t.appendChild(h);return h;
  }
  function ensureWallet(){
    let w=document.getElementById('walletConnectTop');if(w)return w;
    const h=topActions();if(!h)return null;
    w=document.createElement('a');w.id='walletConnectTop';w.className='btn wallet-connect-top';w.href='#wallet';
    w.setAttribute('aria-label','Wallet');w.textContent='Connect Wallet';h.appendChild(w);return w;
  }
  function ensureBurger(){
    let b=document.getElementById(TRIGGER);if(b)return b;
    const h=topActions();if(!h)return null;
    b=document.createElement('button');b.id=TRIGGER;b.type='button';
    b.setAttribute('aria-label','Open navigation');b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls',MENU);
    b.innerHTML='<span class="mf-menu-lines" aria-hidden="true"><span class="mf-menu-line"></span><span class="mf-menu-line"></span></span>';
    h.appendChild(b);return b;
  }
  function ensureBackdrop(){
    let d=document.getElementById(BACKDROP);if(d)return d;
    d=document.createElement('div');d.id=BACKDROP;d.setAttribute('aria-hidden','true');document.body.appendChild(d);return d;
  }
  function getNav(){return document.querySelector('.mobile-nav')}
  function floatAi(){
    const a=document.getElementById(AI);if(!a)return null;
    if(a.parentElement!==document.body)document.body.appendChild(a);
    a.removeAttribute('data-sheet');a.dataset.mfAiFloating='1';a.setAttribute('aria-label','Open MEMEFLOW OpenAI');return a;
  }
  function ensureDrawer(){
    const n=getNav();if(!n)return null;
    n.id=MENU;n.dataset.mfNavigationOwner='header-burger-clean-v2';
    n.querySelector('[data-sheet="home"]')?.remove();floatAi();
    let head=n.querySelector('.mf-menu-drawer-head');
    if(!head){
      head=document.createElement('div');head.className='mf-menu-drawer-head';
      head.innerHTML='<div class="mf-menu-drawer-copy"><small>NAVIGATION</small><b>MEMEFLOW</b></div>'+
        `<button id="${CLOSE}" type="button" aria-label="Close navigation"><span aria-hidden="true">×</span></button>`;
      n.prepend(head);
    }
    return n;
  }
  function tabOrder(open){
    const n=getNav();if(!n)return;
    const c=document.getElementById(CLOSE);if(c)c.tabIndex=open?0:-1;
    n.querySelectorAll('[data-sheet]').forEach(b=>{
      const k=String(b.dataset.sheet||'').toLowerCase();
      b.tabIndex=open&&['candidates','positions','more'].includes(k)?0:-1;
    });
  }
  function openMenu(){
    if(currentMode()==='desktop')return;
    const n=ensureDrawer(),b=ensureBurger();if(!n||!b)return;
    previousOverflow=document.body.style.overflow||'';
    n.hidden=false;n.setAttribute('aria-hidden','false');document.body.classList.add('mf-menu-open');
    document.body.style.overflow='hidden';b.setAttribute('aria-expanded','true');tabOrder(true);
  }
  function closeMenu(preserve=false){
    const n=getNav(),b=document.getElementById(TRIGGER);document.body.classList.remove('mf-menu-open');
    if(!preserve)document.body.style.overflow=previousOverflow;
    if(n)n.setAttribute('aria-hidden','true');if(b)b.setAttribute('aria-expanded','false');tabOrder(false);
  }
  function openWalletSheet(){
    const s=document.getElementById('sheet-wallet');if(!s)return false;
    document.getElementById('walletModal')?.classList.remove('open');
    document.querySelectorAll('.mobile-sheet.open').forEach(x=>{if(x!==s)x.classList.remove('open')});
    s.classList.add('open');s.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';s.scrollTop=0;return true;
  }
  function bind(){
    const b=ensureBurger(),n=ensureDrawer(),d=ensureBackdrop();if(!b||!n||!d)return;
    if(!b.dataset.mfBound){
      b.dataset.mfBound='1';b.addEventListener('click',e=>{e.preventDefault();document.body.classList.contains('mf-menu-open')?closeMenu(false):openMenu()});
    }
    const c=document.getElementById(CLOSE);
    if(c&&!c.dataset.mfBound){c.dataset.mfBound='1';c.addEventListener('click',()=>closeMenu(false))}
    if(!d.dataset.mfBound){d.dataset.mfBound='1';d.addEventListener('click',()=>closeMenu(false))}
    if(!n.dataset.mfBound){
      n.dataset.mfBound='1';n.addEventListener('click',e=>{
        const dest=e.target instanceof Element?e.target.closest('[data-sheet]'):null;if(!dest)return;
        const k=String(dest.dataset.sheet||'').toLowerCase();if(!['candidates','positions','more'].includes(k))return;
        setTimeout(()=>closeMenu(!!document.querySelector('.mobile-sheet.open')),0);
      });
    }
  }
  function captureWallet(e){
    if(currentMode()==='desktop')return;
    const t=e.target instanceof Element?e.target.closest('#walletConnectTop'):null;if(!t||!openWalletSheet())return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  }
  function apply(){
    const m=currentMode();setMode(m);
    document.querySelectorAll('[id^="mf-header-wallet-v"]').forEach(x=>x.remove());
    const n=ensureDrawer();
    if(m==='desktop'){
      closeMenu(false);if(n){n.hidden=true;n.setAttribute('aria-hidden','true')}return;
    }
    ensureWallet();ensureBurger();ensureBackdrop();floatAi();bind();
    if(n){n.hidden=false;n.setAttribute('aria-hidden',document.body.classList.contains('mf-menu-open')?'false':'true')}
    tabOrder(document.body.classList.contains('mf-menu-open'));
  }
  function install(){
    style();apply();document.addEventListener('click',captureWallet,true);
    let timer=0;addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(apply,120)},{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

JS44
cat > "$P" <<'PY'
from pathlib import Path
import re,sys
index=Path(sys.argv[1]);v51=Path(sys.argv[2])
si=index.read_text(encoding='utf-8');s51=v51.read_text(encoding='utf-8')

si,_=re.subn(r'\s*<style\b[^>]*\bid=(["\'])mobile-icon-cleanup-v2\1[^>]*>.*?</style>\s*','\n',si,count=1,flags=re.I|re.S)

srx=re.compile(r'(<style\b[^>]*\bid=(["\'])memeflow-consolidated-css\2[^>]*>)(.*?)(</style>)',re.I|re.S)
m=srx.search(si)
if not m: raise SystemExit('PRECHECK FAILED: memeflow-consolidated-css not found.')
css=m.group(3)
css,_=re.subn(r'\.mobile-nav\{(?=[^{}]*display:grid)(?=[^{}]*position:fixed)(?=[^{}]*bottom:)[^{}]*\}','',css,count=1)
css,_=re.subn(r'\.mobile-nav button\{[^{}]*\}','',css,count=1)
css,_=re.subn(r'\.mobile-nav button\.active\{[^{}]*\}','',css,count=1)
css=css.replace('body{padding-bottom:calc(72px + env(safe-area-inset-bottom))}','body{padding-bottom:0}')
css=css.replace('.main{padding:calc(12px + env(safe-area-inset-top)) 12px 90px}', '.main{padding:calc(12px + env(safe-area-inset-top)) 12px calc(24px + env(safe-area-inset-bottom))}')
css=css.replace('padding:calc(14px + env(safe-area-inset-top)) 12px calc(88px + env(safe-area-inset-bottom))','padding:calc(14px + env(safe-area-inset-top)) 12px calc(20px + env(safe-area-inset-bottom))')
si=si[:m.start()]+m.group(1)+css+m.group(4)+si[m.end():]

si,_=re.subn(r'<button\b(?=[^>]*\bdata-sheet=(["\'])home\1)[^>]*>.*?</button>','',si,flags=re.I|re.S)

nrx=re.compile(r'<(?P<tag>nav|div)\b(?=[^>]*\bclass=(["\'])[^"\']*\bmobile-nav\b[^"\']*\2)[^>]*>',re.I)
navs=list(nrx.finditer(si))
if len(navs)!=1: raise SystemExit(f'PRECHECK FAILED: .mobile-nav expected 1, found {len(navs)}.')
n=navs[0];tag=n.group(0)
if not re.search(r'\bhidden(?:\s|=|>)',tag,re.I):tag=tag[:-1]+' hidden>'
if re.search(r'\baria-hidden=(["\']).*?\1',tag,re.I):tag=re.sub(r'\baria-hidden=(["\']).*?\1','aria-hidden="true"',tag,count=1,flags=re.I)
else:tag=tag[:-1]+' aria-hidden="true">'
si=si[:n.start()]+tag+si[n.end():]

versions={'ai-nav-layout-v26.js':'26.HEADER-DRAWER-CLEAN-V2','bottom-nav-flush-v44.js':'44.HEADER-DRAWER-CLEAN-V2','native-ai-sheet-v51.js':'51.HEADER-DRAWER-CLEAN-V2'}
for f,v in versions.items():
    rx=re.compile(r'(<script\b[^>]*\bsrc=["\'])((?:\./|/)?'+re.escape(f)+r')(?:\?v=[^"\']*)?(["\'][^>]*>\s*</script>)',re.I)
    hits=list(rx.finditer(si))
    if len(hits)!=1: raise SystemExit(f'PRECHECK FAILED: {f} ref expected 1, found {len(hits)}.')
    si=rx.sub(lambda x:x.group(1)+x.group(2)+'?v='+v+x.group(3),si,count=1)

guard="if (btn.id === 'mf-ai-center-nav-v24') return;"
if guard not in s51:
    rx=re.compile(r"(?m)^(\s*)\$\$\('button'\)\.forEach\(btn\s*=>\s*\{\s*$")
    hits=list(rx.finditer(s51))
    if len(hits)!=1:raise SystemExit('PRECHECK FAILED: V51 cleaner loop.')
    h=hits[0];indent=h.group(1)
    s51=s51[:h.start()]+h.group(0)+'\n'+indent+'  '+guard+s51[h.end():]

rx=re.compile(r'(?ms)^  function ensureCenterButton\(\)\{.*?^  \}')
hits=list(rx.finditer(s51))
if len(hits)!=1:raise SystemExit('PRECHECK FAILED: V51 ensureCenterButton.')
new=("  function ensureCenterButton(){\n"
"    let ai=$('#mf-ai-center-nav-v24');\n"
"    if(!ai){ai=document.createElement('button');ai.id='mf-ai-center-nav-v24';}\n"
"    if(ai.parentElement!==document.body)document.body.appendChild(ai);\n"
"    ai.type='button';ai.removeAttribute('data-sheet');ai.dataset.mfAiFloating='1';\n"
"    ai.setAttribute('aria-label','Open MEMEFLOW OpenAI');ai.setAttribute('aria-expanded','false');\n"
"    ai.innerHTML='<span class=\"mf-ai-center-star\" aria-hidden=\"true\">✦</span><span class=\"mf-ai-center-label\">AI</span>';\n"
"    return ai;\n"
"  }")
s51=rx.sub(new,s51,count=1)

for name,overflow,hidden in [('openSheet',"    document.body.style.overflow='hidden';",'true'),('closeSheet',"    document.body.style.overflow='';",'false')]:
    rx=re.compile(r'(?ms)^  function '+name+r'\(\)\{.*?^  \}')
    hits=list(rx.finditer(s51))
    if len(hits)!=1:raise SystemExit('PRECHECK FAILED: V51 '+name)
    b=hits[0].group(0)
    b=re.sub(r"^\s*\$\$\('\.mobile-nav \[data-sheet\]'\)\.forEach\(.*?\);\s*$",'',b,flags=re.M)
    token='ai.hidden='+hidden
    if token not in b:
        if overflow not in b:raise SystemExit('PRECHECK FAILED: '+name+' overflow anchor')
        b=b.replace(overflow,overflow+"\n    const ai=$('#mf-ai-center-nav-v24');\n    if(ai){"+token+";ai.setAttribute('aria-expanded','"+('true' if hidden=='true' else 'false')+"');}",1)
    s51=s51[:hits[0].start()]+b+s51[hits[0].end():]

s51=s51.replace('padding-bottom:calc(84px + env(safe-area-inset-bottom,0px))!important','padding-bottom:calc(20px + env(safe-area-inset-bottom,0px))!important')

m=srx.search(si)
if not m:raise SystemExit('VERIFY FAILED: CSS missing.')
if re.search(r'\.mobile-nav\{(?=[^{}]*position:fixed)(?=[^{}]*bottom:)[^{}]*\}',m.group(3)):raise SystemExit('VERIFY FAILED: old fixed nav remains.')
if 'mobile-icon-cleanup-v2' in si:raise SystemExit('VERIFY FAILED: old icon layer remains.')
if re.search(r'<button\b(?=[^>]*\bdata-sheet=(["\'])home\1)',si,re.I):raise SystemExit('VERIFY FAILED: Home remains.')
if 'nav.insertBefore(ai' in s51 or 'nav.appendChild(ai)' in s51:raise SystemExit('VERIFY FAILED: V51 still inserts AI in nav.')
for t in (guard,"ai.parentElement!==document.body","ai.removeAttribute('data-sheet')","ai.hidden=true","ai.hidden=false"):
    if t not in s51:raise SystemExit('VERIFY FAILED: '+t)

index.write_text(si,encoding='utf-8');v51.write_text(s51,encoding='utf-8')
print('INDEX/V51 CLEANUP: PASS')

PY
rollback(){ cp "$IB" "$INDEX" 2>/dev/null||true; cp "$B26" "$V26" 2>/dev/null||true; cp "$B44" "$V44" 2>/dev/null||true; cp "$B51" "$V51" 2>/dev/null||true; }
trap 'echo "ERROR: V2 failed; restoring exact pre-install files."; rollback' ERR
python3 "$P" "$IW" "$W51"
node --check "$W26" >/dev/null
node --check "$W44" >/dev/null
node --check "$W51" >/dev/null
! grep -q '\.mobile-nav' "$W26"
grep -q 'mf-menu-trigger-v2' "$W44"
[[ "$(grep -o 'class="mf-menu-line"' "$W44"|wc -l|tr -d ' ')" = "2" ]]
! grep -q 'grid-template-columns:repeat(5' "$W44"
! grep -q 'grid-template-columns:repeat(6' "$W44"
! grep -q 'nav.insertBefore(ai' "$W51"
grep -q "ai.parentElement!==document.body" "$W51"
cp "$IW" "$INDEX"; cp "$W26" "$V26"; cp "$W44" "$V44"; cp "$W51" "$V51"
cat > "$DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
V26=$V26
V44=$V44
V51=$V51
INDEX_BACKUP=$IB
V26_BACKUP=$B26
V44_BACKUP=$B44
V51_BACKUP=$B51
EOF
rm -f "$IW" "$W26" "$W44" "$W51" "$P"; trap - ERR
echo "HEADER BURGER DRAWER CLEAN V2: PASS"
echo "index bottom-nav owner: REMOVED"
echo "V26 compact-nav owner: REMOVED"
echo "V44 compact-nav owner: ONE"
echo "V51 AI-in-nav owner: REMOVED"
echo "burger bars: EXACTLY 2"
echo "V44 delayed layout retries: NONE"
echo "Stop -> Run -> fully close old Safari tab -> reopen URL."
