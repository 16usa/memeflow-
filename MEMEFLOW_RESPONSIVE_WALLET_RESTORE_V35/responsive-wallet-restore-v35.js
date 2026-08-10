/* MEMEFLOW Responsive Wallet Restore V35
   GitHub-grounded responsive fix.

   PHONE <= 820px:
     - keep exactly one header Wallet control
     - bottom Wallet hidden
     - Home | Candidates | AI | Positions | More

   TABLET:
     - no Wallet in top header
     - Wallet restored to bottom menu
     - Home | Candidates | AI | Positions | Wallet | More

   DESKTOP:
     - no Wallet in top header
     - Wallet remains in original sidebar menu

   No wallet connection, AI, API, trading, Positions, Candidates,
   or Manual AI Scan logic is changed.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_RESPONSIVE_WALLET_RESTORE_V35__) return;
  window.__MEMEFLOW_RESPONSIVE_WALLET_RESTORE_V35__ = true;

  const STYLE_ID = 'mf-wallet-restore-v35-style';
  const MODE_CLASSES = ['mf-w35-phone', 'mf-w35-tablet', 'mf-w35-desktop'];

  const css = `
    body.mf-w35-tablet [id^="mf-header-wallet-v"],
    body.mf-w35-desktop [id^="mf-header-wallet-v"]{
      display:none!important;
      visibility:hidden!important;
      pointer-events:none!important;
    }

    body.mf-w35-phone .mobile-nav>[data-sheet="wallet"]{
      display:none!important;
      visibility:hidden!important;
    }
    body.mf-w35-phone .mobile-nav{
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
    }

    body.mf-w35-tablet .topbar .top-actions #walletConnectTop,
    body.mf-w35-tablet .topbar .top-actions a[href="#wallet"],
    body.mf-w35-tablet .topbar .top-actions [id^="mf-header-wallet-v"]{
      display:none!important;
      visibility:hidden!important;
      pointer-events:none!important;
    }
    body.mf-w35-tablet .mobile-nav{
      display:grid!important;
      grid-template-columns:repeat(6,minmax(0,1fr))!important;
    }
    body.mf-w35-tablet .mobile-nav>[data-sheet="wallet"]{
      display:block!important;
      visibility:visible!important;
      pointer-events:auto!important;
    }
    body.mf-w35-tablet .mobile-nav>[data-sheet="home"]{order:1!important}
    body.mf-w35-tablet .mobile-nav>[data-sheet="candidates"]{order:2!important}
    body.mf-w35-tablet .mobile-nav>[id^="mf-ai-center-nav-v"],
    body.mf-w35-tablet .mobile-nav>[data-mf-ai-nav]{order:3!important}
    body.mf-w35-tablet .mobile-nav>[data-sheet="positions"]{order:4!important}
    body.mf-w35-tablet .mobile-nav>[data-sheet="wallet"]{order:5!important}
    body.mf-w35-tablet .mobile-nav>[data-sheet="more"]{order:6!important}

    body.mf-w35-desktop .topbar .top-actions #walletConnectTop,
    body.mf-w35-desktop .topbar .top-actions a[href="#wallet"],
    body.mf-w35-desktop .topbar .top-actions [id^="mf-header-wallet-v"]{
      display:none!important;
      visibility:hidden!important;
      pointer-events:none!important;
    }
    body.mf-w35-desktop .sidebar .nav a[href="#wallet"]{
      display:block!important;
      visibility:visible!important;
      pointer-events:auto!important;
    }
    body.mf-w35-desktop .mobile-nav{
      display:none!important;
    }
  `;

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function coarseTouch() {
    return !!(
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.('(pointer: coarse)').matches
    );
  }

  function currentMode() {
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const coarse = coarseTouch();

    if (width <= 820) return 'phone';
    if (width <= 1024) return 'tablet';
    if (width <= 1366 && coarse) return 'tablet';
    return 'desktop';
  }

  function setModeClass(name) {
    if (!document.body) return;
    document.body.classList.remove(...MODE_CLASSES);
    document.body.classList.add(`mf-w35-${name}`);
  }

  function topWalletCandidates() {
    const top = document.querySelector('.topbar .top-actions');
    if (!top) return [];

    return [...new Set([
      ...top.querySelectorAll('#walletConnectTop'),
      ...top.querySelectorAll('[id^="mf-header-wallet-v"]'),
      ...top.querySelectorAll('a[href="#wallet"]')
    ])];
  }

  function removeInjectedWallets() {
    document.querySelectorAll('[id^="mf-header-wallet-v"]').forEach(el => el.remove());
  }

  function phoneLayout() {
    const candidates = topWalletCandidates();
    const native = document.getElementById('walletConnectTop');

    if (native) {
      native.style.setProperty('display', 'inline-flex', 'important');
      native.style.setProperty('visibility', 'visible', 'important');
      native.style.setProperty('pointer-events', 'auto', 'important');
      removeInjectedWallets();
      return;
    }

    /* Replit may have lost the GitHub id. If there are two header wallet
       controls, keep only the right-most/last one instead of deleting both. */
    if (candidates.length > 1) {
      const keeper = candidates[candidates.length - 1];
      for (const el of candidates) {
        if (el === keeper) {
          el.style.setProperty('display', 'inline-flex', 'important');
          el.style.setProperty('visibility', 'visible', 'important');
          el.style.setProperty('pointer-events', 'auto', 'important');
        } else {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      }
    }
  }

  function tabletLayout() {
    for (const el of topWalletCandidates()) {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    }
    removeInjectedWallets();

    const wallet = document.querySelector('.mobile-nav [data-sheet="wallet"]');
    if (wallet) {
      wallet.hidden = false;
      wallet.removeAttribute('aria-hidden');
      wallet.style.setProperty('display', 'block', 'important');
      wallet.style.setProperty('visibility', 'visible', 'important');
      wallet.style.setProperty('pointer-events', 'auto', 'important');
    }
  }

  function desktopLayout() {
    for (const el of topWalletCandidates()) {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    }
    removeInjectedWallets();

    const sidebarWallet = document.querySelector('.sidebar .nav a[href="#wallet"]');
    if (sidebarWallet) {
      sidebarWallet.hidden = false;
      sidebarWallet.removeAttribute('aria-hidden');
      sidebarWallet.style.setProperty('display', 'block', 'important');
      sidebarWallet.style.setProperty('visibility', 'visible', 'important');
      sidebarWallet.style.setProperty('pointer-events', 'auto', 'important');
    }
  }

  function apply() {
    const mode = currentMode();
    setModeClass(mode);
    if (mode === 'phone') phoneLayout();
    else if (mode === 'tablet') tabletLayout();
    else desktopLayout();
  }

  function install() {
    ensureStyle();
    apply();

    /* Old local UI patches may mount controls during startup. Re-apply only
       for the startup window; no permanent MutationObserver is used. */
    [50,150,400,900,1800,3200,5200,7800,10500].forEach(ms => setTimeout(apply, ms));

    let resizeTimer = 0;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(apply, 120);
    }, { passive:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
