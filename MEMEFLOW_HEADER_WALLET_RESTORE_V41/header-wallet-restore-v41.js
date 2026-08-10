/* MEMEFLOW Header Wallet Restore V41
   Restores the wallet placement after the AI icon patches.

   Desired behavior:
   - PHONE <= 820px: exactly one wallet button in the header, no Wallet item in bottom nav.
   - TABLET: wallet in bottom nav, hidden from header.
   - DESKTOP: wallet in sidebar/original place, hidden from header.

   Does not touch AI/runtime/API logic.
*/
(() => {
  'use strict';
  if (window.__MEMEFLOW_HEADER_WALLET_RESTORE_V41__) return;
  window.__MEMEFLOW_HEADER_WALLET_RESTORE_V41__ = true;

  const STYLE_ID = 'mf-header-wallet-restore-v41-style';
  const MODE_CLASSES = ['mf-w41-phone', 'mf-w41-tablet', 'mf-w41-desktop'];

  const css = `
    body.mf-w41-phone .mobile-nav > [data-sheet="wallet"]{
      display:none!important;
      visibility:hidden!important;
      pointer-events:none!important;
    }
    body.mf-w41-phone .mobile-nav{
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
    }
    body.mf-w41-phone .topbar .top-actions #walletConnectTop,
    body.mf-w41-phone .topbar .top-actions a[href="#wallet"],
    body.mf-w41-phone .topbar .top-actions [id^="mf-header-wallet-v"]{
      visibility:visible!important;
      pointer-events:auto!important;
    }

    body.mf-w41-tablet .topbar .top-actions #walletConnectTop,
    body.mf-w41-tablet .topbar .top-actions a[href="#wallet"],
    body.mf-w41-tablet .topbar .top-actions [id^="mf-header-wallet-v"],
    body.mf-w41-desktop .topbar .top-actions #walletConnectTop,
    body.mf-w41-desktop .topbar .top-actions a[href="#wallet"],
    body.mf-w41-desktop .topbar .top-actions [id^="mf-header-wallet-v"]{
      display:none!important;
      visibility:hidden!important;
      pointer-events:none!important;
    }

    body.mf-w41-tablet .mobile-nav{
      display:grid!important;
      grid-template-columns:repeat(6,minmax(0,1fr))!important;
    }
    body.mf-w41-tablet .mobile-nav > [data-sheet="wallet"]{
      display:block!important;
      visibility:visible!important;
      pointer-events:auto!important;
      order:5!important;
    }
    body.mf-w41-tablet .mobile-nav > [data-sheet="home"]{order:1!important}
    body.mf-w41-tablet .mobile-nav > [data-sheet="candidates"]{order:2!important}
    body.mf-w41-tablet .mobile-nav > [id^="mf-ai-center-nav-v"],
    body.mf-w41-tablet .mobile-nav > [data-mf-ai-nav]{order:3!important}
    body.mf-w41-tablet .mobile-nav > [data-sheet="positions"]{order:4!important}
    body.mf-w41-tablet .mobile-nav > [data-sheet="more"]{order:6!important}

    body.mf-w41-desktop .mobile-nav{ display:none!important; }
    body.mf-w41-desktop .sidebar .nav a[href="#wallet"]{
      display:block!important;
      visibility:visible!important;
      pointer-events:auto!important;
    }
  `;

  function ensureStyle(){
    let s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLE_ID;
      document.head.appendChild(s);
    }
    s.textContent = css;
  }

  function coarseTouch(){
    return !!(navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches);
  }

  function currentMode(){
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const coarse = coarseTouch();
    if (width <= 820) return 'phone';
    if (width <= 1024) return 'tablet';
    if (width <= 1366 && coarse) return 'tablet';
    return 'desktop';
  }

  function setModeClass(name){
    if (!document.body) return;
    document.body.classList.remove(...MODE_CLASSES);
    document.body.classList.add(`mf-w41-${name}`);
  }

  function topActions(){
    return document.querySelector('.topbar .top-actions');
  }

  function topWalletCandidates(){
    const top = topActions();
    if (!top) return [];
    return [...new Set([
      ...top.querySelectorAll('#walletConnectTop'),
      ...top.querySelectorAll('[id^="mf-header-wallet-v"]'),
      ...top.querySelectorAll('a[href="#wallet"]')
    ])];
  }

  function showOne(el){
    if (!el) return;
    el.hidden = false;
    el.removeAttribute('aria-hidden');
    el.style.setProperty('display','inline-flex','important');
    el.style.setProperty('visibility','visible','important');
    el.style.setProperty('pointer-events','auto','important');
  }

  function hideOne(el){
    if (!el) return;
    el.style.setProperty('display','none','important');
    el.style.setProperty('visibility','hidden','important');
    el.style.setProperty('pointer-events','none','important');
  }

  function phoneLayout(){
    const candidates = topWalletCandidates();
    const native = document.getElementById('walletConnectTop');

    let keeper = native || null;
    if (!keeper && candidates.length === 1) keeper = candidates[0];
    if (!keeper && candidates.length > 1) keeper = candidates[candidates.length - 1];

    candidates.forEach(el => {
      if (el === keeper) showOne(el);
      else hideOne(el);
    });

    const bottomWallet = document.querySelector('.mobile-nav > [data-sheet="wallet"]');
    if (bottomWallet) hideOne(bottomWallet);
  }

  function tabletLayout(){
    topWalletCandidates().forEach(hideOne);
    const wallet = document.querySelector('.mobile-nav > [data-sheet="wallet"]');
    if (wallet) {
      wallet.hidden = false;
      wallet.removeAttribute('aria-hidden');
      wallet.style.setProperty('display','block','important');
      wallet.style.setProperty('visibility','visible','important');
      wallet.style.setProperty('pointer-events','auto','important');
    }
  }

  function desktopLayout(){
    topWalletCandidates().forEach(hideOne);
    const sidebarWallet = document.querySelector('.sidebar .nav a[href="#wallet"]');
    if (sidebarWallet) {
      sidebarWallet.hidden = false;
      sidebarWallet.removeAttribute('aria-hidden');
      sidebarWallet.style.setProperty('display','block','important');
      sidebarWallet.style.setProperty('visibility','visible','important');
      sidebarWallet.style.setProperty('pointer-events','auto','important');
    }
  }

  function apply(){
    const mode = currentMode();
    setModeClass(mode);
    if (mode === 'phone') phoneLayout();
    else if (mode === 'tablet') tabletLayout();
    else desktopLayout();
  }

  function install(){
    ensureStyle();
    apply();
    [50,150,400,900,1800,3200,5200,7800,10500].forEach(ms => setTimeout(apply, ms));
    let timer = 0;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    }, { passive:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
