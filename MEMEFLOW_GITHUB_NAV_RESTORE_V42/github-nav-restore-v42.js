/* MEMEFLOW GitHub Nav Restore V42
   Grounded in GitHub main (16usa/memeflow- / memeflow-app/index.html).

   GitHub canonical elements:
     #walletConnectTop                     -> top header Wallet control
     .mobile-nav [data-sheet="wallet"]    -> mobile/tablet Wallet route
     .sidebar .nav a[href="#wallet"]      -> desktop Wallet route

   This runtime repairs ONLY responsive navigation / header presentation.
   It leaves the existing AI button node, AI click handler, Wallet backend,
   Manual AI Scan, API calls, positions, candidates and trading logic intact.
*/
(() => {
  'use strict';
  if (window.__MEMEFLOW_GITHUB_NAV_RESTORE_V42__) return;
  window.__MEMEFLOW_GITHUB_NAV_RESTORE_V42__ = true;

  const STYLE_ID = 'mf-github-nav-restore-v42-style';
  const AI_ID = 'mf-ai-center-nav-v24';
  const MODE_CLASSES = ['mf-v42-phone','mf-v42-tablet','mf-v42-desktop'];

  const walletSvg = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M4.5 7.25h14A1.75 1.75 0 0 1 20.25 9v8A1.75 1.75 0 0 1 18.5 18.75h-14A1.75 1.75 0 0 1 2.75 17V6.5A1.75 1.75 0 0 1 4.5 4.75h11.25"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16.25 11h4v4h-4a2 2 0 1 1 0-4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <circle cx="16.5" cy="13" r=".7" fill="currentColor"/>
    </svg>`;

  const aiIcon = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='26' viewBox='0 0 30 26'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='2' y1='1' x2='28' y2='24' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23F0FDFF'/%3E%3Cstop offset='.40' stop-color='%2386ECFF'/%3E%3Cstop offset='1' stop-color='%2338CBEA'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cg fill='url(%23g)'%3E%3Cpath d='M15 2.4c.73 4.33 3.47 7.07 7.8 7.8-4.33.73-7.07 3.47-7.8 7.8-.73-4.33-3.47-7.07-7.8-7.8 4.33-.73 7.07-3.47 7.8-7.8Z'/%3E%3Cpath d='M5.2 2.3c.29 1.7 1.36 2.77 3.06 3.06-1.7.29-2.77 1.36-3.06 3.06-.29-1.7-1.36-2.77-3.06-3.06 1.7-.29 2.77-1.36 3.06-3.06Z' opacity='.90'/%3E%3Cpath d='M24.2 16.2c.34 2.02 1.62 3.30 3.64 3.64-2.02.34-3.30 1.62-3.64 3.64-.34-2.02-1.62-3.30-3.64-3.64 2.02-.34 3.30-1.62 3.64-3.64Z' opacity='.82'/%3E%3C/g%3E%3C/svg%3E\")";

  const css = `
    /* All old V30-injected header wallets are suppressed. V42 uses the GitHub-native id. */
    [id^="mf-header-wallet-v"]{
      display:none!important;
      visibility:hidden!important;
      pointer-events:none!important;
    }

    /* ---------------- PHONE ---------------- */
    body.mf-v42-phone .topbar{
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
    }
    body.mf-v42-phone .topbar .top-actions{
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      flex:0 0 auto!important;
      width:auto!important;
      min-width:44px!important;
      gap:0!important;
    }
    body.mf-v42-phone #walletConnectTop{
      display:grid!important;
      place-items:center!important;
      visibility:visible!important;
      pointer-events:auto!important;
      flex:0 0 44px!important;
      width:44px!important;
      height:44px!important;
      min-width:44px!important;
      min-height:44px!important;
      max-width:44px!important;
      margin:0!important;
      padding:0!important;
      border:1px solid #29394a!important;
      border-radius:14px!important;
      background:#101720!important;
      color:#a9b7c7!important;
      font-size:0!important;
      line-height:0!important;
      overflow:hidden!important;
      text-decoration:none!important;
      box-shadow:none!important;
      transform:none!important;
    }
    body.mf-v42-phone #walletConnectTop::before{
      content:""!important;
      display:block!important;
      width:22px!important;
      height:22px!important;
      background-repeat:no-repeat!important;
      background-position:center!important;
      background-size:22px 22px!important;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M4.5 7.25h14A1.75 1.75 0 0 1 20.25 9v8A1.75 1.75 0 0 1 18.5 18.75h-14A1.75 1.75 0 0 1 2.75 17V6.5A1.75 1.75 0 0 1 4.5 4.75h11.25' stroke='%23A9B7C7' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M16.25 11h4v4h-4a2 2 0 1 1 0-4Z' stroke='%23A9B7C7' stroke-width='1.7' stroke-linejoin='round'/%3E%3Ccircle cx='16.5' cy='13' r='.7' fill='%23A9B7C7'/%3E%3C/svg%3E")!important;
    }
    body.mf-v42-phone #walletConnectTop.connected{
      border-color:rgba(81,231,168,.38)!important;
      color:#51e7a8!important;
    }

    body.mf-v42-phone .mobile-nav{
      display:grid!important;
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
      align-items:center!important;
      position:fixed!important;
      left:8px!important;
      right:8px!important;
      bottom:calc(8px + env(safe-area-inset-bottom,0px))!important;
      width:auto!important;
      height:76px!important;
      min-height:76px!important;
      max-height:76px!important;
      padding:5px!important;
      overflow:visible!important;
      z-index:1000!important;
    }
    body.mf-v42-phone .mobile-nav>[data-sheet="home"]{grid-column:1!important;grid-row:1!important}
    body.mf-v42-phone .mobile-nav>[data-sheet="candidates"]{grid-column:2!important;grid-row:1!important}
    body.mf-v42-phone .mobile-nav>[data-sheet="positions"]{grid-column:4!important;grid-row:1!important}
    body.mf-v42-phone .mobile-nav>[data-sheet="more"]{grid-column:5!important;grid-row:1!important}
    body.mf-v42-phone .mobile-nav>[data-sheet="wallet"]{
      display:none!important;
      visibility:hidden!important;
      pointer-events:none!important;
    }

    body.mf-v42-phone .mobile-nav>#${AI_ID}{
      position:absolute!important;
      grid-column:auto!important;
      grid-row:auto!important;
      inset:auto!important;
      right:auto!important;
      bottom:auto!important;
      left:50%!important;
      top:50%!important;
      transform:translate(-50%,-50%)!important;
      width:50px!important;
      height:50px!important;
      min-width:50px!important;
      min-height:50px!important;
      margin:0!important;
      padding:0!important;
      display:grid!important;
      place-items:center!important;
      align-self:auto!important;
      justify-self:auto!important;
      overflow:visible!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
      color:transparent!important;
      font-size:0!important;
      line-height:0!important;
      z-index:20!important;
    }
    body.mf-v42-phone #${AI_ID} .mf-ai-center-star,
    body.mf-v42-phone #${AI_ID} .mf-ai-center-label{
      display:none!important;
      visibility:hidden!important;
      opacity:0!important;
      width:0!important;
      height:0!important;
      margin:0!important;
      padding:0!important;
      font-size:0!important;
      pointer-events:none!important;
    }
    body.mf-v42-phone #${AI_ID}::after{content:none!important;display:none!important}
    body.mf-v42-phone #${AI_ID}::before{
      content:""!important;
      display:block!important;
      width:30px!important;
      height:26px!important;
      background-repeat:no-repeat!important;
      background-position:center!important;
      background-size:30px 26px!important;
      background-image:${aiIcon}!important;
      filter:drop-shadow(0 0 1.5px rgba(83,221,255,.18))!important;
      transform:none!important;
      pointer-events:none!important;
    }
    body.mf-v42-phone #${AI_ID}:active{
      transform:translate(-50%,-50%) scale(.92)!important;
    }

    /* ---------------- TABLET ---------------- */
    body.mf-v42-tablet #walletConnectTop{display:none!important;visibility:hidden!important;pointer-events:none!important}
    body.mf-v42-tablet .mobile-nav{
      display:grid!important;
      grid-template-columns:repeat(6,minmax(0,1fr))!important;
      align-items:center!important;
      height:76px!important;
      min-height:76px!important;
      max-height:76px!important;
    }
    body.mf-v42-tablet .mobile-nav>[data-sheet="home"]{grid-column:1!important;grid-row:1!important}
    body.mf-v42-tablet .mobile-nav>[data-sheet="candidates"]{grid-column:2!important;grid-row:1!important}
    body.mf-v42-tablet .mobile-nav>#${AI_ID}{
      position:relative!important;
      inset:auto!important;
      left:auto!important;
      top:auto!important;
      transform:none!important;
      grid-column:3!important;
      grid-row:1!important;
      width:100%!important;
      height:100%!important;
      min-width:0!important;
      min-height:44px!important;
      display:grid!important;
      place-items:center!important;
      margin:0!important;
      padding:0!important;
    }
    body.mf-v42-tablet .mobile-nav>#${AI_ID} .mf-ai-center-star{display:block!important;font-size:20px!important;line-height:1!important}
    body.mf-v42-tablet .mobile-nav>#${AI_ID} .mf-ai-center-label{display:block!important;font-size:10px!important;line-height:1!important;margin-top:2px!important}
    body.mf-v42-tablet .mobile-nav>[data-sheet="positions"]{grid-column:4!important;grid-row:1!important}
    body.mf-v42-tablet .mobile-nav>[data-sheet="wallet"]{display:block!important;visibility:visible!important;pointer-events:auto!important;grid-column:5!important;grid-row:1!important}
    body.mf-v42-tablet .mobile-nav>[data-sheet="more"]{display:block!important;visibility:visible!important;grid-column:6!important;grid-row:1!important}

    /* ---------------- DESKTOP ---------------- */
    body.mf-v42-desktop #walletConnectTop{display:none!important;visibility:hidden!important;pointer-events:none!important}
    body.mf-v42-desktop .mobile-nav{display:none!important}
    body.mf-v42-desktop .sidebar{display:block!important}
    body.mf-v42-desktop .sidebar .nav a[href="#wallet"]{
      display:block!important;
      visibility:visible!important;
      pointer-events:auto!important;
    }
  `;

  function ensureStyle(){
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function coarseTouch(){
    return !!(navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer:coarse)').matches);
  }

  function currentMode(){
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    if (width <= 820) return 'phone';
    if (width <= 1024) return 'tablet';
    if (width <= 1366 && coarseTouch()) return 'tablet';
    return 'desktop';
  }

  function setMode(name){
    if (!document.body) return;
    document.body.classList.remove(...MODE_CLASSES);
    document.body.classList.add(`mf-v42-${name}`);
  }

  function ensureTopActions(){
    let host = document.querySelector('.topbar .top-actions');
    if (host) return host;
    const topbar = document.querySelector('.topbar');
    if (!topbar) return null;
    host = document.createElement('div');
    host.className = 'top-actions';
    topbar.appendChild(host);
    return host;
  }

  function ensureNativeHeaderWallet(){
    let wallet = document.getElementById('walletConnectTop');
    if (wallet) return wallet;

    const host = ensureTopActions();
    if (!host) return null;

    wallet = document.createElement('a');
    wallet.id = 'walletConnectTop';
    wallet.className = 'btn wallet-connect-top mf-v42-created-wallet';
    wallet.href = '#wallet';
    wallet.setAttribute('aria-label','Wallet');
    wallet.title = 'Wallet';
    wallet.textContent = 'Connect Wallet';
    wallet.dataset.mfV42Created = '1';

    wallet.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (window.MEMEFLOW_WALLET && typeof window.MEMEFLOW_WALLET.open === 'function') {
        window.MEMEFLOW_WALLET.open();
        return;
      }
      document.querySelector('.mobile-nav [data-sheet="wallet"]')?.click();
    });

    host.appendChild(wallet);
    return wallet;
  }

  function cleanInjectedWallets(){
    document.querySelectorAll('[id^="mf-header-wallet-v"]').forEach(el => el.remove());
  }

  function normalizeAiButton(){
    const nav = document.querySelector('.mobile-nav');
    const ai = document.getElementById(AI_ID);
    if (!nav || !ai) return;
    if (ai.parentElement !== nav) nav.appendChild(ai);
    ai.classList.remove('mf-ai-sparkles-v36','mf-ai-icon-compact-v37','mf-ai-icon-final-v38','mf-ai-icon-center-v39','mf-ai-icon-true-center-v40');
  }

  function applyPhone(){
    cleanInjectedWallets();
    ensureNativeHeaderWallet();
    normalizeAiButton();
  }

  function applyTablet(){
    cleanInjectedWallets();
    normalizeAiButton();
    const wallet = document.querySelector('.mobile-nav [data-sheet="wallet"]');
    if (wallet) {
      wallet.hidden = false;
      wallet.removeAttribute('aria-hidden');
    }
  }

  function applyDesktop(){
    cleanInjectedWallets();
    const sidebarWallet = document.querySelector('.sidebar .nav a[href="#wallet"]');
    if (sidebarWallet) {
      sidebarWallet.hidden = false;
      sidebarWallet.removeAttribute('aria-hidden');
    }
  }

  function apply(){
    const mode = currentMode();
    setMode(mode);
    if (mode === 'phone') applyPhone();
    else if (mode === 'tablet') applyTablet();
    else applyDesktop();
  }

  function install(){
    ensureStyle();
    apply();
    [50,150,350,700,1400,2600,4500,7000,10000].forEach(ms => setTimeout(apply, ms));
    let timer = 0;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    }, {passive:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
