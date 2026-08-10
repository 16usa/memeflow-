/* MEMEFLOW AI Safe Mobile Sheet Patch v9.0
   UI-only. Does NOT move/reparent the existing OpenAI DOM.
   Requires the stable v7 Manual AI button.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_SAFE_SHEET_V9__) return;
  window.__MEMEFLOW_AI_SAFE_SHEET_V9__ = true;

  const OPEN_BUTTON_ID = 'mfManualAiButton';
  const PANEL_CLASS = 'mf-ai-safe-sheet-v9';
  const OVERLAY_CLASS = 'mf-ai-safe-overlay-v9';
  const CLOSED_CLASS = 'mf-ai-v9-closed';
  const CLOSE_ID = 'mfAiCloseV9';
  const BODY_CLASS = 'mf-ai-v9-open';
  const STYLE_ID = 'mfAiSafeSheetV9Style';

  const css = `
@media (max-width:820px){
  body.${BODY_CLASS}{
    overflow:hidden!important;
  }

  .${OVERLAY_CLASS}{
    position:fixed!important;
    inset:0!important;
    width:100vw!important;
    height:100dvh!important;
    max-width:none!important;
    max-height:none!important;
    margin:0!important;
    transform:none!important;
    overflow:visible!important;
    z-index:890!important;
  }

  .${PANEL_CLASS}{
    position:fixed!important;
    top:0!important;
    right:0!important;
    left:0!important;
    bottom:calc(var(--mobile-nav-height,76px) + env(safe-area-inset-bottom,0px) + 8px)!important;

    width:100vw!important;
    height:auto!important;
    min-width:0!important;
    max-width:none!important;
    min-height:0!important;
    max-height:none!important;

    margin:0!important;
    transform:none!important;
    border-radius:0!important;

    z-index:900!important;
    overflow:auto!important;
    overscroll-behavior:contain!important;
    -webkit-overflow-scrolling:touch!important;

    padding:
      calc(18px + env(safe-area-inset-top,0px))
      16px
      24px!important;

    background:#070a0f!important;
    box-shadow:none!important;
  }

  .${PANEL_CLASS} > *{
    min-width:0!important;
    max-width:100%!important;
  }

  .${PANEL_CLASS} input,
  .${PANEL_CLASS} textarea,
  .${PANEL_CLASS} select,
  .${PANEL_CLASS} button{
    max-width:100%!important;
  }

  .${PANEL_CLASS} input,
  .${PANEL_CLASS} textarea,
  .${PANEL_CLASS} select{
    font-size:16px!important;
  }

  .${PANEL_CLASS} textarea{
    resize:vertical!important;
  }

  #${CLOSE_ID}{
    position:fixed!important;
    top:calc(12px + env(safe-area-inset-top,0px))!important;
    right:14px!important;
    z-index:930!important;

    width:40px!important;
    height:40px!important;
    min-width:40px!important;
    min-height:40px!important;
    padding:0!important;
    margin:0!important;

    display:grid!important;
    place-items:center!important;

    border:1px solid rgba(142,157,175,.22)!important;
    border-radius:12px!important;
    background:rgba(18,26,36,.94)!important;
    color:#f4f8fb!important;

    font:500 23px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif!important;
    box-shadow:0 8px 24px rgba(0,0,0,.28)!important;
    backdrop-filter:blur(18px)!important;
    -webkit-backdrop-filter:blur(18px)!important;
  }

  #${CLOSE_ID}:active{
    transform:scale(.96)!important;
  }

  .${CLOSED_CLASS}{
    display:none!important;
  }

  /* v9 wins over the older v7 fullscreen helper without deleting v7. */
  .mf-ai-fullscreen-sheet-v7.${PANEL_CLASS}{
    top:0!important;
    right:0!important;
    left:0!important;
    bottom:calc(var(--mobile-nav-height,76px) + env(safe-area-inset-bottom,0px) + 8px)!important;
    width:100vw!important;
    height:auto!important;
    max-height:none!important;
    border-radius:0!important;
    padding:
      calc(18px + env(safe-area-inset-top,0px))
      16px
      24px!important;
  }
}
`;

  const qsa = (selector, root = document) => {
    try { return [...root.querySelectorAll(selector)]; }
    catch { return []; }
  };

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  function addStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 240 && r.height > 180;
    } catch {
      return false;
    }
  }

  function panelScore(el) {
    if (!el || el === document.body || el === document.documentElement) return -999;

    const t = text(el);
    if (!/MEMEFLOW OpenAI/i.test(t)) return -999;
    if (!/Ask AI/i.test(t)) return -999;
    if (!el.querySelector('textarea')) return -999;
    if (!el.querySelector('input')) return -999;

    let score = 100;

    if (/Analyze token/i.test(t)) score += 25;
    if (/AUTO AI/i.test(t)) score += 15;
    if (/Strategy/i.test(t)) score += 10;

    const directHeading = qsa('h1,h2,h3,h4,strong,b', el)
      .some(node => /MEMEFLOW OpenAI/i.test(text(node)));
    if (directHeading) score += 20;

    try {
      const r = el.getBoundingClientRect();
      const area = Math.max(1, r.width * r.height);
      // Prefer the smallest complete container, not a page-sized ancestor.
      score += Math.max(0, 30 - Math.log10(area) * 3);
    } catch {}

    return score;
  }

  function findAiPanel() {
    const markerNodes = qsa('h1,h2,h3,h4,strong,b,span,div')
      .filter(el => /MEMEFLOW OpenAI/i.test(text(el)));

    const candidates = new Set();

    for (const marker of markerNodes) {
      let node = marker;
      for (let depth = 0; depth < 9 && node && node !== document.body; depth++, node = node.parentElement) {
        if (panelScore(node) > 0) candidates.add(node);
      }
    }

    // Fallback if the heading is rendered in a non-heading element.
    for (const el of qsa('section,article,dialog,div')) {
      if (panelScore(el) > 0) candidates.add(el);
    }

    return [...candidates]
      .map(el => ({ el, score: panelScore(el) + (isVisible(el) ? 20 : 0) }))
      .sort((a, b) => b.score - a.score)[0]?.el || null;
  }

  function findOverlayAncestor(panel) {
    if (!panel) return null;

    let node = panel.parentElement;
    let best = null;

    for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
      try {
        const cs = getComputedStyle(node);
        const signature = [
          typeof node.className === 'string' ? node.className : '',
          node.id || '',
          node.getAttribute('role') || ''
        ].join(' ').toLowerCase();

        if (
          cs.position === 'fixed' ||
          /overlay|modal|dialog|assistant|chat/.test(signature) ||
          node.getAttribute('role') === 'dialog'
        ) {
          best = node;
          break;
        }
      } catch {}
    }

    return best;
  }

  function clearClosedState() {
    qsa('.' + CLOSED_CLASS).forEach(el => el.classList.remove(CLOSED_CLASS));
  }

  function closeAiSheet() {
    const panel = document.querySelector('.' + PANEL_CLASS);
    if (!panel) return;

    const overlay = panel.__mfAiOverlayV9 || findOverlayAncestor(panel);

    panel.classList.add(CLOSED_CLASS);
    panel.classList.remove(PANEL_CLASS);

    if (overlay) {
      overlay.classList.add(CLOSED_CLASS);
      overlay.classList.remove(OVERLAY_CLASS);
    }

    document.body.classList.remove(BODY_CLASS);
  }

  function ensureCloseButton(panel) {
    let close = document.getElementById(CLOSE_ID);

    if (!close) {
      close = document.createElement('button');
      close.id = CLOSE_ID;
      close.type = 'button';
      close.setAttribute('aria-label', 'Close AI');
      close.title = 'Close AI';
      close.textContent = '×';
      close.addEventListener('click', closeAiSheet);
      panel.appendChild(close);
    } else if (close.parentElement !== panel) {
      panel.appendChild(close);
    }
  }

  function activateSheet(panel) {
    if (!panel) return false;

    clearClosedState();

    const overlay = findOverlayAncestor(panel);
    if (overlay) {
      overlay.classList.add(OVERLAY_CLASS);
      panel.__mfAiOverlayV9 = overlay;
    }

    panel.classList.add(PANEL_CLASS);
    panel.classList.remove(CLOSED_CLASS);

    ensureCloseButton(panel);
    document.body.classList.add(BODY_CLASS);

    return true;
  }

  function tryActivate() {
    const panel = findAiPanel();
    if (!panel || !isVisible(panel)) return false;
    return activateSheet(panel);
  }

  function bindOpenButton() {
    const button = document.getElementById(OPEN_BUTTON_ID);
    if (!button) return false;

    if (button.dataset.mfAiSafeV9 === '1') return true;
    button.dataset.mfAiSafeV9 = '1';

    // Capture runs before the existing v7 onclick. It only clears v9's own hidden state.
    button.addEventListener('click', () => {
      clearClosedState();
      document.body.classList.remove(BODY_CLASS);

      // v7 opens the real AI window. v9 only restyles it after it exists.
      [30, 90, 180, 320, 600].forEach(delay => {
        setTimeout(tryActivate, delay);
      });
    }, true);

    return true;
  }

  function install() {
    addStyle();
    bindOpenButton();

    const observer = new MutationObserver(() => {
      bindOpenButton();

      // Only touch the AI panel if the user has actually opened it.
      const panel = findAiPanel();
      if (panel && isVisible(panel) && /MEMEFLOW OpenAI/i.test(text(panel))) {
        activateSheet(panel);
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 20000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
