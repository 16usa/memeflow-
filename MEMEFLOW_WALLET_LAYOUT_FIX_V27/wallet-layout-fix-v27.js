/* MEMEFLOW Wallet Layout Fix V27
   Purpose:
   - PHONE: keep exactly ONE wallet control in the header (the app's original walletConnectTop).
            Remove every injected mf-header-wallet-v* duplicate.
            Bottom nav stays Home | Candidates | ✦ | Positions | More.
   - TABLET: restore Wallet to its original bottom navigation location.
             Keep AI in the same bottom nav, giving six slots:
             Home | Candidates | ✦ AI | Positions | Wallet | More.
             No injected header-wallet duplicate.
   - DESKTOP: keep the original Wallet in the left sidebar.
              No injected header-wallet duplicate.
              AI remains in the sidebar from V26.
   This file does NOT modify AI evaluator logic or API calls.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_WALLET_LAYOUT_V27__) return;
  window.__MEMEFLOW_WALLET_LAYOUT_V27__ = true;

  const STYLE_ID = 'mf-wallet-layout-v27-style';
  const AI_ID = 'mf-ai-center-nav-v24';

  const css = `
    /* Kill only wallet buttons injected by our older AI UI patches.
       The app's native #walletConnectTop is intentionally untouched. */
    [id^="mf-header-wallet-v"]{
      display:none!important;
      visibility:hidden!important;
      pointer-events:none!important;
    }

    /* PHONE
       Keep Wallet OUT of the bottom nav.
       V26/V24 already keep AI centered. */
    body.mf-v26-phone .mobile-nav>[data-sheet="wallet"]{
      display:none!important;
    }

    /* TABLET
       Restore Wallet to bottom nav, while AI gets its own center slot. */
    body.mf-v26-tablet .mobile-nav{
      display:grid!important;
      grid-template-columns:repeat(6,minmax(0,1fr))!important;
      align-items:center!important;
    }

    body.mf-v26-tablet .mobile-nav>[data-sheet="home"]{
      grid-column:1!important;
    }

    body.mf-v26-tablet .mobile-nav>[data-sheet="candidates"]{
      grid-column:2!important;
    }

    body.mf-v26-tablet .mobile-nav>#${AI_ID}{
      grid-column:3!important;
      grid-row:1!important;

      position:relative!important;
      inset:auto!important;
      left:auto!important;
      right:auto!important;
      top:auto!important;
      bottom:auto!important;
      transform:none!important;

      width:100%!important;
      min-width:0!important;
      height:auto!important;
      min-height:44px!important;
      margin:0!important;
      padding:4px 3px!important;

      display:flex!important;
      flex-direction:column!important;
      align-items:center!important;
      justify-content:center!important;
      gap:2px!important;

      border:0!important;
      outline:0!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
    }

    body.mf-v26-tablet .mobile-nav>#${AI_ID} .mf-ai-center-label{
      display:block!important;
      font-size:9px!important;
      line-height:1!important;
      font-weight:700!important;
      letter-spacing:.06em!important;
      color:#a9b7c7!important;
    }

    body.mf-v26-tablet .mobile-nav>[data-sheet="positions"]{
      grid-column:4!important;
    }

    body.mf-v26-tablet .mobile-nav>[data-sheet="wallet"]{
      display:block!important;
      visibility:visible!important;
      grid-column:5!important;
      grid-row:1!important;
    }

    body.mf-v26-tablet .mobile-nav>[data-sheet="more"]{
      display:block!important;
      grid-column:6!important;
      grid-row:1!important;
    }

    /* DESKTOP
       Original Wallet stays in sidebar; phone/tablet nav remains hidden by V26. */
    body.mf-v26-desktop [id^="mf-header-wallet-v"]{
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

  function removeInjectedHeaderWallets() {
    document
      .querySelectorAll('[id^="mf-header-wallet-v"]')
      .forEach(el => el.remove());
  }

  function restoreTabletWalletNode() {
    if (!document.body?.classList.contains('mf-v26-tablet')) return;

    const wallet = document.querySelector('.mobile-nav [data-sheet="wallet"]');
    if (!wallet) return;

    wallet.hidden = false;
    wallet.removeAttribute('aria-hidden');
    wallet.style.removeProperty('display');
    wallet.style.removeProperty('visibility');
  }

  function enforce() {
    removeInjectedHeaderWallets();
    restoreTabletWalletNode();
  }

  function install() {
    ensureStyle();
    enforce();

    /* V24 creates its injected wallet during bounded startup retries.
       Remove it after each possible retry window. */
    [25, 120, 350, 900, 1800, 3200, 5200, 8000, 11000].forEach(ms => {
      setTimeout(enforce, ms);
    });

    /* Watch ONLY for injected wallet IDs, then disconnect.
       This avoids expensive full-page observation. */
    const observer = new MutationObserver(records => {
      let relevant = false;

      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;

          if (
            node.matches?.('[id^="mf-header-wallet-v"]') ||
            node.querySelector?.('[id^="mf-header-wallet-v"]')
          ) {
            relevant = true;
          }
        }
      }

      if (relevant) enforce();
    });

    observer.observe(document.documentElement, {
      childList:true,
      subtree:true
    });

    setTimeout(() => observer.disconnect(), 12500);

    let timer = 0;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(enforce, 120);
    }, { passive:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
