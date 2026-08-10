/*
  MEMEFLOW — Mobile AI Bottom Navigation Patch v2.0
  Purpose: move the existing floating AI launcher into the center of the mobile
  bottom navigation without changing its original click behavior.

  This patch is intentionally UI-only. It does not touch trading, scanning,
  wallet, candidate, chart, or AI evaluation logic.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_NAV_PATCH__) return;
  window.__MEMEFLOW_AI_NAV_PATCH__ = true;

  const MOBILE_MAX = 820;
  const STYLE_ID = 'mf-ai-bottom-nav-patch-style';
  const MORE_PROXY_ID = 'mf-mobile-more-proxy';

  const css = `
/* === MEMEFLOW AI bottom-nav patch === */
@media (max-width: 820px) {
  .mobile-nav.mf-ai-nav-ready {
    overflow: visible !important;
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    align-items: center !important;
    padding: 5px !important;
  }


  .mobile-nav.mf-ai-nav-ready {
    min-height: var(--mobile-nav-height, 76px) !important;
  }

  .mobile-nav.mf-ai-nav-ready > [data-sheet="home"] { grid-column: 1 !important; }
  .mobile-nav.mf-ai-nav-ready > [data-sheet="candidates"] { grid-column: 2 !important; }
  .mobile-nav.mf-ai-nav-ready > .mf-ai-nav-button { grid-column: 3 !important; }
  .mobile-nav.mf-ai-nav-ready > [data-sheet="positions"] { grid-column: 4 !important; }
  .mobile-nav.mf-ai-nav-ready > [data-sheet="wallet"] { grid-column: 5 !important; }

  .mobile-nav.mf-ai-nav-ready > [data-sheet="more"] {
    display: none !important;
  }

  .mobile-nav .mf-ai-nav-button {
    position: relative !important;
    align-self: center !important;
    justify-self: center !important;
    width: 56px !important;
    min-width: 56px !important;
    height: 56px !important;
    min-height: 56px !important;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: 18px !important;
    border: 1px solid rgba(94, 220, 255, .46) !important;
    background:
      radial-gradient(circle at 32% 18%, rgba(112, 228, 255, .15), transparent 42%),
      linear-gradient(180deg, rgba(17, 27, 38, .98), rgba(8, 14, 21, .98)) !important;
    color: #f4f8fb !important;
    box-shadow:
      0 12px 28px rgba(0, 0, 0, .38),
      0 0 0 1px rgba(255, 255, 255, .025) inset,
      0 0 22px rgba(84, 221, 255, .09) !important;
    backdrop-filter: blur(22px) saturate(130%) !important;
    -webkit-backdrop-filter: blur(22px) saturate(130%) !important;
    overflow: visible !important;
    transform: translateY(-7px) !important;
    z-index: 3 !important;
    font-size: 0 !important;
    line-height: 1 !important;
    cursor: pointer !important;
    -webkit-tap-highlight-color: transparent;
    transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease !important;
  }

  .mobile-nav .mf-ai-nav-button::before {
    content: "✦";
    position: absolute;
    left: 50%;
    top: 9px;
    transform: translateX(-50%);
    font-size: 17px;
    line-height: 1;
    color: #75e6ff;
    text-shadow: 0 0 16px rgba(84, 221, 255, .34);
    pointer-events: none;
  }

  .mobile-nav .mf-ai-nav-button::after {
    content: "AI";
    position: absolute;
    left: 50%;
    bottom: 9px;
    transform: translateX(-50%);
    font: 800 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    letter-spacing: .08em;
    color: #f5f8fb;
    pointer-events: none;
  }

  .mobile-nav .mf-ai-nav-button:active {
    transform: translateY(-5px) scale(.96) !important;
  }

  .mobile-nav .mf-ai-nav-button:focus-visible {
    outline: none !important;
    border-color: rgba(117, 230, 255, .84) !important;
    box-shadow:
      0 12px 28px rgba(0,0,0,.38),
      0 0 0 3px rgba(84, 221, 255, .12),
      0 0 26px rgba(84, 221, 255, .16) !important;
  }

  .mobile-nav .mf-ai-nav-button[aria-expanded="true"],
  .mobile-nav .mf-ai-nav-button.active,
  .mobile-nav .mf-ai-nav-button.is-active {
    border-color: rgba(117, 230, 255, .72) !important;
    box-shadow:
      0 12px 30px rgba(0,0,0,.4),
      0 0 0 3px rgba(84,221,255,.08),
      0 0 30px rgba(84,221,255,.14) !important;
  }

  #${MORE_PROXY_ID} {
    display: inline-grid !important;
    place-items: center !important;
    width: 38px !important;
    height: 38px !important;
    min-width: 38px !important;
    min-height: 38px !important;
    margin-left: auto !important;
    padding: 0 !important;
    border: 1px solid rgba(142, 157, 175, .18) !important;
    border-radius: 12px !important;
    background: rgba(10, 17, 25, .66) !important;
    color: #9eacbc !important;
    font-size: 20px !important;
    line-height: 1 !important;
    letter-spacing: .08em !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
  }

  #${MORE_PROXY_ID}:active { transform: scale(.96); }
}

@media (min-width: 821px) {
  #${MORE_PROXY_ID} { display: none !important; }
}
`;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  const cleanText = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  function scoreAiCandidate(el) {
    if (!el || el.closest('.mobile-nav')) return -999;
    const text = cleanText(el).toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const title = (el.getAttribute('title') || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    const id = (el.id || '').toLowerCase();

    // Do not capture the manual scan CTA.
    if (/analy[sz]e token|manual ai scan|scan token/.test(text + ' ' + aria + ' ' + title)) return -999;

    let score = 0;
    if (text === 'ai') score += 120;
    if (aria === 'ai' || title === 'ai') score += 100;
    if (/\bai\b/.test(aria) && /chat|assistant|copilot|open|launch/.test(aria)) score += 75;
    if (/ai[-_ ]?(fab|float|chat|assistant|launcher|button)/.test(cls + ' ' + id)) score += 90;
    if (/assistant|copilot|ai-chat|ai_chat/.test(cls + ' ' + id)) score += 55;

    try {
      const s = getComputedStyle(el);
      if (s.position === 'fixed' || s.position === 'sticky') score += 30;
      const r = el.getBoundingClientRect();
      if (r.width >= 42 && r.width <= 110 && r.height >= 42 && r.height <= 110) score += 20;
      if (r.right > innerWidth * .68 && r.bottom > innerHeight * .45) score += 18;
    } catch (_) {}

    return score;
  }

  function findAiLauncher() {
    const selectors = [
      '#aiFab', '#ai-fab', '#aiButton', '#ai-button', '#aiAssistant', '#ai-assistant',
      '.ai-fab', '.ai-float', '.ai-button', '.ai-launcher', '.ai-assistant', '.ai-chat-button',
      '[data-ai-launcher]', '[data-ai-button]', '[data-open-ai]', '[aria-label*="AI" i]',
      'button', 'a[role="button"]', '[role="button"]'
    ];
    const pool = [...new Set(selectors.flatMap(sel => {
      try { return [...document.querySelectorAll(sel)]; } catch (_) { return []; }
    }))];

    const ranked = pool
      .map(el => ({ el, score: scoreAiCandidate(el) }))
      .filter(x => x.score >= 55)
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.el || null;
  }

  function createMoreProxy(nav) {
    const originalMore = nav.querySelector('[data-sheet="more"]');
    if (!originalMore) return;
    if (document.getElementById(MORE_PROXY_ID)) return;

    const proxy = document.createElement('button');
    proxy.id = MORE_PROXY_ID;
    proxy.type = 'button';
    proxy.setAttribute('aria-label', 'More');
    proxy.title = 'More';
    proxy.textContent = '•••';
    proxy.addEventListener('click', () => originalMore.click());

    const host = document.querySelector('.topbar .top-actions') ||
                 document.querySelector('.topbar') ||
                 document.querySelector('.top-left');
    if (host) host.appendChild(proxy);
  }

  let launcher = null;
  let originalParent = null;
  let originalNext = null;
  let originalStyle = null;
  let observer = null;

  function moveIntoNav() {
    if (innerWidth > MOBILE_MAX) return restoreDesktop();

    const nav = document.querySelector('.mobile-nav');
    if (!nav) return false;

    launcher = launcher?.isConnected ? launcher : findAiLauncher();
    if (!launcher) return false;

    if (!originalParent) {
      originalParent = launcher.parentNode;
      originalNext = launcher.nextSibling;
      originalStyle = launcher.getAttribute('style');
    }

    if (!launcher.classList.contains('mf-ai-nav-button')) {
      launcher.classList.add('mf-ai-nav-button');
      launcher.setAttribute('aria-label', launcher.getAttribute('aria-label') || 'Open AI assistant');
      launcher.setAttribute('title', launcher.getAttribute('title') || 'AI');
    }

    const positions = nav.querySelector('[data-sheet="positions"]');
    if (positions && launcher.parentNode !== nav) {
      nav.insertBefore(launcher, positions);
    } else if (!positions && launcher.parentNode !== nav) {
      nav.appendChild(launcher);
    }

    // Remove inline floating placement only while the element lives in the nav.
    ['position','right','left','top','bottom','inset','z-index','width','height','transform','margin'].forEach(p => {
      try { launcher.style.removeProperty(p); } catch (_) {}
    });

    nav.classList.add('mf-ai-nav-ready');
    createMoreProxy(nav);
    return true;
  }

  function restoreDesktop() {
    if (!launcher || !originalParent) return;
    const nav = document.querySelector('.mobile-nav');
    nav?.classList.remove('mf-ai-nav-ready');

    if (launcher.parentNode !== originalParent) {
      if (originalNext && originalNext.parentNode === originalParent) {
        originalParent.insertBefore(launcher, originalNext);
      } else {
        originalParent.appendChild(launcher);
      }
    }

    launcher.classList.remove('mf-ai-nav-button');
    if (originalStyle == null) launcher.removeAttribute('style');
    else launcher.setAttribute('style', originalStyle);
  }

  function install() {
    injectStyle();
    if (moveIntoNav()) return;

    // AI launcher may be mounted after initial render.
    if (!observer) {
      observer = new MutationObserver(() => {
        if (moveIntoNav()) {
          observer.disconnect();
          observer = null;
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer?.disconnect();
        observer = null;
      }, 15000);
    }
  }

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (innerWidth <= MOBILE_MAX) install();
      else restoreDesktop();
    }, 120);
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
